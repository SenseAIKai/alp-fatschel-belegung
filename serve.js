// Lokaler Testserver für den Belegungsplan (nur für die Entwicklung).
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
http.createServer((req, res) => {
  const f = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : path.normalize(req.url.split('?')[0]));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(d);
  });
}).listen(process.env.PORT || 3458, '127.0.0.1');
