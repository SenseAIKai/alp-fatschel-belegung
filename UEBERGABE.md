# Übergabe: Belegungsplan Alp Fatschél

Stand: 17.11.2026, 04:30 Uhr. Geschrieben von Artus (Claude Code) für jede KI, die an dieser Software weiterbaut.

## 1. Worum es geht

Arthur (Geschäftsführer Swiss Bull GmbH, Arosa, keine Programmierkenntnisse, arbeitet am Mac) führt neu das Hotel **Alp Fatschél** in St. Peter GR: 8 Gästezimmer plus Restaurant.

Verkauft wird über **Feratel Deskline** (WebClient von Arosa Tourismus). Über Deskline laufen laut Arthur auch das Arosa-Portal, Booking.com und HRS (Vertrag mit Arosa Tourismus). Deskline ist für Arthur zu unübersichtlich. Deshalb gibt es diesen eigenen Belegungsplan:

- Arthur trägt Buchungen im Plan ein. Ein Server-Abgleich sperrt das Zimmer in Deskline.
- Buchungen, die von aussen in Deskline ankommen, sollen automatisch im Plan erscheinen.
- Nutzbar auf Mac, Büro-PC und Handy. Der Abgleich läuft auf dem Server, unabhängig von Arthurs Mac.
- Vorbild für die Bedienung: Smoobu. Arthur will aber **kein** fertiges Channel-Manager-Produkt, sondern diese eigene Lösung.

## 2. Wo alles liegt

| Was | Wo |
|---|---|
| Plan (live) | https://senseaikai.github.io/alp-fatschel-belegung/ |
| Code-Repository | https://github.com/SenseAIKai/alp-fatschel-belegung (öffentlich, Branch `main`, GitHub Pages) |
| Lokaler Ordner | `~/Documents/Claude Code/alp-fatschel-belegung` |
| Datenbank und Server | Supabase-Projekt `alp-fatschel-belegung`, ID `lujchdresoppqkydnrmw`, Region eu-central-2, Gratis-Tarif |
| Supabase-Konto | Anmeldung mit dem GitHub-Konto **ART-hur-richART** (nicht SenseAIKai) |
| Deskline | https://webclient4.deskline.net/ARO/de/ , Objekt-ID `6e4dd87d-fa4a-48e5-b4ae-c2b66568f7f4` |

Dateien im Repository:

- `index.html`: der ganze Plan in einer Datei (HTML, CSS, JavaScript, supabase-js 2.45.4 per CDN, kein Build-Schritt)
- `supabase/functions/deskline-sync/index.ts`: der Abgleich als Supabase Edge Function (Deno)
- `serve.js`: lokaler Testserver (`node serve.js`, Port 3458)
- `README.md`, `UEBERGABE.md`

Veröffentlichen des Plans: Änderung an `index.html` committen und nach `main` pushen, GitHub Pages aktualisiert sich selbst. Die Edge Function wird getrennt über Supabase deployt (Name `deskline-sync`, `verify_jwt` an).

## 3. Was der Plan kann

- Anmeldung und "Konto anlegen" über Supabase Auth (Passwort mindestens 10 Zeichen).
- Kalender: 8 Zimmer mal 62 Tage, Balken beginnen am Mittag des Anreisetags, Farbe nach Herkunft, gelber Punkt = noch nicht in Deskline, geschlossene Saison grau.
- Formular: Gast, Zimmer, Status (bestätigt, Option, storniert), An- und Abreise, Erwachsene, Kinder, Telefon, E-Mail, Herkunft, Preis, Notiz.
- Listen: Anreisen und Abreisen der nächsten 14 Tage, "Noch nicht mit Deskline abgeglichen".
- Knopf "Jetzt abgleichen"; ausserdem startet der Abgleich automatisch nach jedem Speichern und Löschen (`syncNow()` ruft `sb.functions.invoke('deskline-sync')`).
- Löschen einer bereits abgeglichenen Buchung setzt sie auf `storniert`, damit der Abgleich das Zimmer freigibt.
- Rollen: `admin` darf alles, `lesen` darf nur ansehen. Ohne Zeile in `profiles` kein Zugriff.

Konstanten in `index.html`: `SB_URL`, `SB_KEY` (öffentlicher Publishable Key, darf im Code stehen), `SAISON`.

## 4. Datenbank (Schema `public`)

| Tabelle | Spalten |
|---|---|
| `rooms` | id, name, typ, max_personen, deskline_service_id, sort |
| `bookings` | id, room_id, gast, anreise, abreise, erwachsene, kinder, telefon, email, notiz, quelle, status, preis, deskline_ref, sync_state, sync_note, created_by, created_at, updated_at |
| `profiles` | user_id, name, role (`admin` oder `lesen`) |
| `saison` | von, bis |
| `deskline_blocks` | room_id, nacht (welche Nächte der Abgleich selbst in Deskline gesperrt hat) |
| `sync_config` | key, value (enthält `cron_key`; geheim, nicht ausgeben) |
| `sync_log` | id, ran_at, ok, note |

Wichtige Regeln:

- `bookings` hat eine Sperre gegen Doppelbelegung (Exclusion-Constraint `keine_doppelbelegung`).
- `sync_state`: `offen`, `erledigt`, `fehler`. Ein Trigger (`touch_booking`) setzt geänderte Buchungen zurück auf `offen`, ausser bei automatisch importierten.
- `quelle`: `manuell`, `telefon`, `homepage`, `deskline`, `booking`, `hrs`.
- Row Level Security ist überall an. Lesen über `has_access()`, Schreiben über `is_admin()`.
- Realtime ist für die Buchungen aktiv.

Zimmer und ihre Deskline-Service-IDs:

| Zimmer | Typ | Deskline-Service-ID |
|---|---|---|
| 2 | Doppelzimmer | f7897d6c-ac3d-4649-86ea-57c50166187f |
| 3 | Doppelzimmer | 8628eb98-fdd0-41eb-b837-b2cde293e645 |
| 4 | Doppelzimmer | 20fa329c-dea9-49bd-81c9-0184b28513c2 |
| 5 | Familienzimmer | 312ebb7b-2642-410a-9cda-54fa766a4a95 |
| 7 | Doppelzimmer | f4fe47af-9e66-45eb-94ce-440524d73ff3 |
| 8 | Doppelzimmer | dfa39ddb-7df0-4578-8247-115ba3803702 |
| 9 | Doppelzimmer | 67e7c281-b280-4de0-a76e-843eb4fae38d |
| 10 | Familienzimmer | 9f98a452-a552-4003-be74-3148dfdaf1d8 |

Saison: Winter 11.12.2026 bis 25.04.2027, Sommer 04.06.2027 bis 24.10.2027.

## 5. Der Abgleich mit Deskline

Deskline hat für uns keine offizielle Schnittstelle. Die Funktion meldet sich wie ein Browser an und nutzt die internen JSON-Adressen des WebClients. Das ist inoffiziell und kann bei einem Deskline-Update brechen.

Auslöser:

- **Zeitplan:** pg_cron-Job `deskline-sync-stuendlich`, `0 6-23 * * *` (UTC), ruft `public.deskline_sync_cron()` auf, die per `net.http_post` die Funktion mit Header `x-sync-key` startet. Die Funktion selbst macht von 01 bis 07 Uhr Schweizer Zeit Nachtpause.
- **Von Hand:** Knopf im Plan oder Speichern einer Buchung, mit dem Login eines `admin`. Dieser Weg gilt auch nachts.

Ablauf in `index.ts`:

1. Aufrufer prüfen, Zugangsdaten aus den Supabase-Secrets `DESKLINE_USER` und `DESKLINE_PASS` lesen, Sperre gegen Doppelläufe (90 Sekunden).
2. `login()`: Formular-Anmeldung an `identity.deskline.net` (OpenID Connect, form_post zurück zum WebClient). Der optionale Hinweis auf Zwei-Faktor wird übersprungen. Verlangt Deskline wirklich einen Code, bricht der Lauf mit Meldung ab.
3. Pro Zimmer `calendar()`: `GET /ARO/de/assignments/getcalendardata/{OBJ}?dataTypes=1&dateFrom=…&dateTo=…&parentId={serviceId}…`, Zeitraum heute minus 45 bis heute plus 420 Tage. Antwort: `Availabilities[{Date, Available, Booked}]`.
4. Nächte mit `Booked > 0` gelten als fremde Buchung und werden als Platzhalter "Buchung über Arosa / Feratel" angelegt (`quelle='deskline'`, `deskline_ref='auto:{zimmer}:{von}:{bis}'`). Entfallen sie, wird der Platzhalter storniert.
5. Buchungen aus dem Plan: fehlende Nächte sperren mit `setAvail(..., 0)`, nicht mehr benötigte freigeben mit `setAvail(..., 1)` (nur wenn `Booked == 0` und in der Saison). `setAvail` ist `POST /ARO/de/assignments/availabilityassign/{OBJ}` mit `UpdateAllValue` 0 oder 1 und `ParentIds` = Service-ID.
6. Konflikt (Nacht ist in Deskline schon gebucht): Buchung bekommt `sync_state='fehler'`.
7. Ergebnis in `sync_log`.

## 6. Was geprüft ist und was nicht

Geprüft am 17.11.2026:

- Anmeldung der Funktion bei Deskline klappt, Kalender wird gelesen.
- Probebuchung Zimmer 2, 12. bis 13.12.2026: Deskline ging von verfügbar 1 auf 0, nach dem Löschen wieder auf 1. Im WebClient gegengeprüft. Testdaten sind entfernt, der Plan ist leer.

Noch nicht geprüft:

- Ob echte Portalbuchungen wirklich als `Booked > 0` erscheinen. Das ist eine Annahme, bis die erste echte Buchung da ist.
- Stündlicher Zeitplan mit hinterlegten Zugangsdaten (erster Lauf 17.11., 08:00 Uhr).
- Bedienung auf dem Handy.

## 7. Offene Aufgaben und Ideen

1. Importierte Buchungen mit echten Gastdaten füllen (Name, Personen, Preis) aus `/ARO/de/transactions/transactionlist`, sobald eine echte Buchung existiert. Bisher gibt es nur Platzhalter.
2. Handy-Ansicht prüfen und verbessern.
3. Mitarbeiter-Logins: Mitarbeiter legt Konto an, danach per SQL Zeile in `profiles` mit `role='lesen'` (E-Mail bei Bedarf bestätigen). Eine Benutzerverwaltung im Plan fehlt noch.
4. Benachrichtigung, wenn der Abgleich fehlschlägt (z. B. Passwort geändert, Zwei-Faktor).
5. Gratis-Tarif von Supabase pausiert Projekte nach etwa einer Woche ohne Zugriffe. Der stündliche Lauf sollte das verhindern, bitte im Auge behalten.
6. Preise sind im Plan nur ein freies Feld. Geltende Preise: 1 Person CHF 110, 2 Personen CHF 160, Frühstück und Kurtaxe inklusive, Kinder 0 bis 1 gratis, 2 bis 12 CHF 35, Zustellbett Erwachsener in Zimmer 5 CHF 70, Parkplatz CHF 10 pro Nacht.

## 8. Regeln für jede KI, die hier weiterbaut

- Mit Arthur immer Deutsch, direkt, per Du, ohne Deko-Icons. Er programmiert nicht: Schritte einzeln und in Klartext erklären.
- **Keine Zugangsdaten in den Chat oder in den Code.** Deskline-Benutzer und -Passwort liegen nur in den Supabase-Secrets; Arthur trägt sie selbst ein. Das Repository ist öffentlich, also nie Passwörter, `cron_key` oder Service-Role-Keys committen.
- Ändert Arthur sein Deskline-Passwort, muss er `DESKLINE_PASS` in Supabase neu setzen.
- Testbuchungen immer deutlich als "TEST" kennzeichnen, in einer fernen Nacht anlegen und danach wieder entfernen. Jede Sperre in Deskline macht das Zimmer auf den Portalen unbuchbar.
- In Deskline nichts ändern ausser der Verfügbarkeit, solange Arthur nichts anderes verlangt.
- Vor Änderungen am Datenbank-Schema die bestehenden Tabellen ansehen; Schemaänderungen als Migration.
- Nur eine KI gleichzeitig an `index.html` und `index.ts`. Vor dem Start `git pull`, nach der Arbeit committen und pushen, sonst überschreiben sich die Stände.
- Nach wichtigen Änderungen diese Datei aktualisieren (Abschnitte 6 und 7) und im Senseai Dojo melden.

Verwandte Unterlagen auf Arthurs Mac: `~/Documents/Claude Code/ALP-FATSCHEL-DOMAIN.md` (Homepage alpfatschel.ch) und das Senseai Dojo unter `~/Desktop/Gemini`.

---
<!-- OBSIDIAN_SCHIFFSVERKEHR_BRUECKE -->
**Obsidian-Schiffsverkehr:** [[05_Swiss_Bull_und_Betriebe]] · [[00_GEHIRN_LANDKARTE]]
<!-- /OBSIDIAN_SCHIFFSVERKEHR_BRUECKE -->

## 9. Postfach in der Mac-App (Stand 25.11.2026, Artus / Claude Code)

Das Postfach gehört zur Mac-App «Alp Fatschél PMS», nicht zur Web-Version. Quelle der App-Seite ist `HTML_TEMPLATE` in `~/Desktop/Gemini/cockpit/upgrade_alp_fatschel_pms.py`; der Server ist `~/Desktop/Gemini/cockpit/alp_fatschel_mail_server.py` (Port 8798, IMAP/SMTP mail.cyon.ch, Passwort aus dem macOS-Schlüsselbund). Änderungen immer in der Vorlage UND in `gedaechtnis/Externe_Projekte/alp-fatschel-belegung/index.html` machen und nach `Alp-Fatschel.app/Contents/Resources/` kopieren.

- **Löschen:** `POST /api/alp/mail/delete` {folder, uid, message_id} verschiebt nach `INBOX.Trash` (wiederherstellbar). Fest gebuchte Mails haben keinen Löschen-Knopf.
- **Ordner wie in Outlook:** Die Reiter kommen aus dem echten Postfach (`list_user_mail_folders`): Posteingang, Kunden beantwortet, Kontaktformular beantwortet, Archiv und jeder weitere eigene Unterordner; dazu «Gesendet» und «Alle Ordner». Der Reiter Posteingang zeigt auch Anfragen aus dem Spam-Ordner. Die Antwort von `/api/alp/mail/list` enthält dafür das Feld `folders`.
- **Verschieben:** `POST /api/alp/mail/move` {folder, uid, message_id, target}; Ziel muss ein eigener Ordner sein. Ablauf: Message-ID prüfen, kopieren, dann nur diese eine Mail per `UID EXPUNGE` entfernen. Nie ein allgemeines `EXPUNGE` verwenden.
- **Automatisch ablegen:** Nach dem Senden einer Antwort aus der App legt `auto_file_answered_mail` die Mail aus dem Posteingang in «Kunden beantwortet» ab, Wix-Formulare in «Kontaktformular beantwortet».
- Pro Ordner gibt es einen Eintrag je Gast (neueste Mail). Selbst einsortierte Ordner werden ohne Werbefilter gezeigt; Status dort `archived`, wenn nicht beantwortet.
- Löschen und Verschieben gehen nur am Mac mit laufendem Server; die Web-Version zeigt einen Hinweis.
- Bekannter Fehler (nicht behoben): `currentView` ist im Skript nirgends definiert, dadurch bricht der stille 60-Sekunden-Abruf in `refreshSmartMailboxFromServer(false)` vor dem Neuzeichnen ab. Neue Mails erscheinen erst nach «Postfach jetzt abrufen».
- Offen und wichtig: Im öffentlichen Repo liegen Gästedaten (`smart_mailbox.json`, `bookings_vault.json`, Beispieldaten in `index.html`); die lokale `smart_mailbox.json` enthält zusätzlich den Telegram-Bot-Token. Nicht pushen, bevor das bereinigt ist. Der Server lauscht ohne Anmeldung auf 0.0.0.0:8798.
