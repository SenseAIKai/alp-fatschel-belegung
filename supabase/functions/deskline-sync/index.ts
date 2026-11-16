// Abgleich Belegungsplan <-> feratel Deskline WebClient (Alp Fatschél).
// Meldet sich mit DESKLINE_USER / DESKLINE_PASS an, belegt Nächte aus dem Plan in Deskline
// und trägt fremde Buchungen (Arosa-Portal, Booking.com, HRS) als Platzhalter in den Plan ein.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const WC = "https://webclient4.deskline.net";
const ID = "https://identity.deskline.net";
const DB = "ARO";
const OBJ = "6e4dd87d-fa4a-48e5-b4ae-c2b66568f7f4";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-key" };

const D = (s: string) => new Date(s + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const add = (s: string, n: number) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const zurich = () => { const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" }).format(new Date()); return { today: p.slice(0, 10), hour: +p.slice(11, 13) }; };
const dec = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x2B;/gi, "+").replace(/&#x2F;/gi, "/").replace(/&#x3D;/gi, "=").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

class Fail extends Error {}

// ---- kleiner Cookie-Speicher und Weiterleitungen von Hand ----
const jar = new Map<string, Map<string, string>>();
function store(host: string, res: Response) {
  for (const c of res.headers.getSetCookie()) {
    const [nv, ...attrs] = c.split(";");
    const i = nv.indexOf("="); if (i < 1) continue;
    const dom = attrs.map((a) => a.trim()).find((a) => /^domain=/i.test(a));
    const key = dom ? dom.slice(7).replace(/^\./, "").toLowerCase() : host;
    if (!jar.has(key)) jar.set(key, new Map());
    jar.get(key)!.set(nv.slice(0, i).trim(), nv.slice(i + 1).trim());
  }
}
function cookies(host: string) {
  const out: string[] = [];
  for (const [dom, m] of jar) if (host === dom || host.endsWith("." + dom)) for (const [k, v] of m) out.push(k + "=" + v);
  return out.join("; ");
}
async function go(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
  let method = init.method || "GET", body = init.body;
  for (let i = 0; i < 12; i++) {
    const u = new URL(url);
    const headers: Record<string, string> = { "User-Agent": UA, "Accept-Language": "de-CH,de;q=0.9", ...(init.headers || {}) };
    const ck = cookies(u.hostname); if (ck) headers["Cookie"] = ck;
    const res = await fetch(url, { method, body: method === "GET" ? undefined : body, headers, redirect: "manual" });
    store(u.hostname, res);
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url).toString();
      if (res.status < 307) { method = "GET"; body = undefined; if (init.headers) delete init.headers["Content-Type"]; }
      await res.body?.cancel();
      continue;
    }
    return { status: res.status, url, text: await res.text() };
  }
  throw new Fail("Zu viele Weiterleitungen bei der Anmeldung.");
}
const form = (o: Record<string, string>) => ({ method: "POST", body: new URLSearchParams(o).toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });

async function login(user: string, pass: string) {
  let r = await go(`${WC}/${DB}/de/accommodation/overview`);
  if (new URL(r.url).origin === WC && !/di-page-login/.test(r.text)) return;
  if (!/di-page-login/.test(r.text)) throw new Fail("Anmeldeseite von Deskline nicht erkannt.");
  const ret = new URL(r.url).searchParams.get("ReturnUrl") || "";
  r = await go(r.url, form({ button: "login", ReturnUrl: ret, Username: user, Password: pass, RememberLogin: "false" }));
  for (let step = 0; step < 5; step++) {
    if (new URL(r.url).origin === WC) return;
    const cb = r.text.match(/<form[^>]*action=['"]([^'"]*desklineidentitycallback[^'"]*)['"][\s\S]*?<\/form>/i);
    if (cb) {
      const f: Record<string, string> = {};
      for (const m of cb[0].matchAll(/<input[^>]*>/gi)) {
        const n = m[0].match(/name=['"]([^'"]+)['"]/i), v = m[0].match(/value=['"]([^'"]*)['"]/i);
        if (n) f[n[1]] = dec(v ? v[1] : "");
      }
      r = await go(dec(cb[1]), form(f));
      if (new URL(r.url).origin === WC) return;
      throw new Fail("Deskline hat die Anmeldung nach der Rückleitung nicht angenommen.");
    }
    if (/di-page-security-enhancement/.test(r.text)) {
      if (/is-mfa-required=["'](true|is-mfa-required|)["']/i.test(r.text)) throw new Fail("Deskline verlangt jetzt Zwei-Faktor-Anmeldung. Ein automatischer Abgleich ist damit nicht möglich.");
      const ru = r.text.match(/return-url=["']([^"']*)["']/i);
      r = await go(`${ID}/Account/MfaSecurityEnhancementSkip`, form({ returnUrl: dec(ru ? ru[1] : ret), rememberLogin: "false" }));
      continue;
    }
    if (/di-page-otc|di-page-auth-app/.test(r.text)) throw new Fail("Für dieses Deskline-Konto ist Zwei-Faktor-Anmeldung aktiv. Ein automatischer Abgleich ist damit nicht möglich.");
    if (/di-page-login/.test(r.text)) throw new Fail("Deskline hat Benutzername oder Passwort abgelehnt.");
    throw new Fail("Unerwartete Seite bei der Deskline-Anmeldung (Status " + r.status + ").");
  }
  throw new Fail("Deskline-Anmeldung nicht abgeschlossen.");
}

const XHR = { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json, text/plain, */*" };
type Day = { a: number; b: number };
async function calendar(service: string, from: string, to: string) {
  const q = new URLSearchParams({ dataTypes: "1", dateFrom: from + "T00:00:00.000Z", dateTo: to + "T00:00:00.000Z", isAdditionalService: "false", isHourlyAvailability: "false", parentId: service, timestamp: String(Date.now()) });
  const r = await go(`${WC}/${DB}/de/assignments/getcalendardata/${OBJ}?${q}`, { headers: { ...XHR } });
  let j; try { j = JSON.parse(r.text); } catch { throw new Fail("Deskline-Kalender nicht lesbar (Status " + r.status + ")."); }
  if (!Array.isArray(j?.Availabilities)) throw new Fail("Deskline-Kalender hat ein unerwartetes Format.");
  const m = new Map<string, Day>();
  for (const x of j.Availabilities) m.set(String(x.Date).slice(0, 10), { a: +x.Available || 0, b: +x.Booked || 0 });
  return m;
}
async function setAvail(service: string, from: string, to: string, value: number) {
  const body = JSON.stringify({ UpdateAll: true, UpdateAllType: "0", UpdateAllValue: value, PerParent: [], Message: "", ParentIds: [service], ProductGroupId: "", Periods: [{ DateFrom: from + "T00:00:00.000Z", DateTo: to + "T00:00:00.000Z" }], Weekdays: 127 });
  const r = await go(`${WC}/${DB}/de/assignments/availabilityassign/${OBJ}`, { method: "POST", body, headers: { ...XHR, "Content-Type": "application/json;charset=UTF-8" } });
  let ok = false; try { ok = JSON.parse(r.text)?.success === true; } catch { /* leer */ }
  if (!ok) throw new Fail("Deskline hat die Verfügbarkeit nicht gespeichert (Status " + r.status + ").");
}
// zusammenhängende Nächte zu Zeiträumen bündeln
function runs(nights: string[]) {
  const s = [...new Set(nights)].sort(), out: { from: string; to: string }[] = [];
  for (const n of s) { const l = out[out.length - 1]; if (l && add(l.to, 1) === n) l.to = n; else out.push({ from: n, to: n }); }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const reply = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const { today, hour } = zurich();

  // Wer ruft auf? Zeitplan (Schlüssel) oder angemeldeter Verwalter.
  const key = req.headers.get("x-sync-key");
  let cron = false;
  if (key) {
    const { data } = await sb.from("sync_config").select("value").eq("key", "cron_key").maybeSingle();
    if (!data || data.value !== key) return reply({ ok: false, note: "Nicht berechtigt." }, 403);
    cron = true;
    if (hour >= 1 && hour <= 7) return reply({ ok: true, note: "Nachtpause." });
  } else {
    const tok = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
    const { data: u } = await sb.auth.getUser(tok);
    const { data: p } = u?.user ? await sb.from("profiles").select("role").eq("user_id", u.user.id).maybeSingle() : { data: null };
    if (!p || p.role !== "admin") return reply({ ok: false, note: "Nicht berechtigt." }, 403);
  }

  const log = async (ok: boolean, note: string) => { await sb.from("sync_log").insert({ ok, note: note.slice(0, 900) }); return reply({ ok, note }); };
  const user = Deno.env.get("DESKLINE_USER"), pass = Deno.env.get("DESKLINE_PASS");
  if (!user || !pass) return await log(false, "Deskline-Zugangsdaten sind noch nicht hinterlegt.");

  // Doppelte Läufe vermeiden
  const { data: run } = await sb.from("sync_config").select("value").eq("key", "running_since").maybeSingle();
  if (run && Date.now() - +run.value < 90000) return reply({ ok: true, note: "Abgleich läuft bereits." });
  await sb.from("sync_config").upsert({ key: "running_since", value: String(Date.now()) });

  const problems: string[] = [], done: string[] = [];
  try {
    jar.clear();
    await login(user, pass);
    const from = add(today, -45), to = add(today, 420);
    const [{ data: rooms }, { data: bookings }, { data: blocks }, { data: saison }] = await Promise.all([
      sb.from("rooms").select("*").order("sort"),
      sb.from("bookings").select("*").gt("abreise", from),
      sb.from("deskline_blocks").select("*"),
      sb.from("saison").select("*"),
    ]);
    const inSeason = (d: string) => (saison || []).some((s) => d >= s.von && d < s.bis);
    await sb.from("deskline_blocks").delete().lt("nacht", today);

    for (const room of rooms || []) {
      if (!room.deskline_service_id) continue;
      let cal = await calendar(room.deskline_service_id, from, to);
      const mine = (bookings || []).filter((b) => b.room_id === room.id);
      const isAuto = (b: { deskline_ref: string | null }) => (b.deskline_ref || "").startsWith("auto:");

      // 1) Fremde Buchungen aus Deskline in den Plan übernehmen
      const booked = [...cal].filter(([, v]) => v.b > 0).map(([d]) => d);
      const foreign = runs(booked).map((r) => ({ from: r.from, to: add(r.to, 1) })).filter((r) => r.to > today);
      const want = new Map(foreign.map((r) => [`auto:${room.id}:${r.from}:${r.to}`, r]));
      for (const b of mine.filter((b) => isAuto(b) && b.status !== "storniert" && b.abreise > today)) {
        if (!want.has(b.deskline_ref)) {
          await sb.from("bookings").update({ status: "storniert", sync_note: "In Deskline nicht mehr gebucht." }).eq("id", b.id);
          done.push(`Zi. ${room.id}: Buchung ${b.anreise} in Deskline storniert`);
        }
      }
      for (const [ref, r] of want) {
        const ex = mine.find((b) => b.deskline_ref === ref);
        if (ex && ex.status !== "storniert") continue;
        const q = ex
          ? sb.from("bookings").update({ status: "bestaetigt", sync_note: null }).eq("id", ex.id)
          : sb.from("bookings").insert({ room_id: room.id, gast: "Buchung über Arosa / Feratel", anreise: r.from, abreise: r.to, erwachsene: 2, kinder: 0, quelle: "deskline", status: "bestaetigt", deskline_ref: ref, sync_state: "erledigt", notiz: "Automatisch erkannt. Die Gastdaten stehen in Deskline unter Angebote/Buchungen." });
        const { error } = await q;
        if (error) problems.push(`Zi. ${room.id}: Deskline-Buchung ${r.from} bis ${r.to} überschneidet sich mit einer Buchung im Plan (Doppelbuchung prüfen).`);
        else done.push(`Zi. ${room.id}: neue Deskline-Buchung ${r.from} bis ${r.to}`);
      }

      // 2) Buchungen aus dem Plan in Deskline belegen bzw. wieder freigeben
      const manual = mine.filter((b) => !isAuto(b));
      const active = manual.filter((b) => b.status !== "storniert");
      const tracked = new Set((blocks || []).filter((x) => x.room_id === room.id && x.nacht >= today).map((x) => x.nacht));
      const conflict = new Set<string>(), wantBlock = new Set<string>();
      for (const b of active) {
        const nights: string[] = [];
        for (let d = b.anreise < today ? today : b.anreise; d < b.abreise; d = add(d, 1)) nights.push(d);
        if (nights.some((n) => !tracked.has(n) && (cal.get(n)?.b || 0) > 0)) { conflict.add(b.id); continue; }
        nights.forEach((n) => wantBlock.add(n));
      }
      const toBlock = [...wantBlock].filter((n) => !tracked.has(n));
      const toRelease = [...tracked].filter((n) => !wantBlock.has(n));
      const reopen = toRelease.filter((n) => (cal.get(n)?.b || 0) === 0 && inSeason(n));
      for (const r of runs(toBlock)) await setAvail(room.deskline_service_id, r.from, r.to, 0);
      for (const r of runs(reopen)) await setAvail(room.deskline_service_id, r.from, r.to, 1);
      if (toBlock.length || reopen.length) {
        cal = await calendar(room.deskline_service_id, from, to);
        const bad = [...toBlock.filter((n) => (cal.get(n)?.a ?? 1) !== 0), ...reopen.filter((n) => (cal.get(n)?.a ?? 0) < 1)];
        if (bad.length) throw new Fail(`Zi. ${room.id}: Deskline zeigt nach dem Speichern nicht den erwarteten Stand (${bad[0]}).`);
        if (toBlock.length) { await sb.from("deskline_blocks").upsert(toBlock.map((n) => ({ room_id: room.id, nacht: n }))); done.push(`Zi. ${room.id}: ${toBlock.length} Nächte belegt`); }
        if (reopen.length) done.push(`Zi. ${room.id}: ${reopen.length} Nächte freigegeben`);
      }
      if (toRelease.length) await sb.from("deskline_blocks").delete().eq("room_id", room.id).in("nacht", toRelease);
      for (const b of manual) {
        if (conflict.has(b.id)) {
          if (b.sync_state !== "fehler") await sb.from("bookings").update({ sync_state: "fehler", sync_note: "In Deskline liegt für diese Nächte bereits eine Buchung vor." }).eq("id", b.id);
          problems.push(`Zi. ${room.id}: ${b.gast} ${b.anreise} kollidiert mit einer Buchung in Deskline.`);
        } else if (b.sync_state !== "erledigt") {
          await sb.from("bookings").update({ sync_state: "erledigt", sync_note: null }).eq("id", b.id);
        }
      }
    }
    await sb.from("sync_config").delete().eq("key", "running_since");
    return await log(problems.length === 0, [...problems, ...(done.length ? done : ["Keine Änderungen."])].join(" | "));
  } catch (e) {
    await sb.from("sync_config").delete().eq("key", "running_since");
    const msg = e instanceof Fail ? e.message : "Technischer Fehler: " + (e instanceof Error ? e.message : String(e));
    return await log(false, [msg, ...problems, ...done].join(" | "));
  }
});
