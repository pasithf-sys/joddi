// เซิร์ฟเวอร์ทดสอบในเครื่อง: node server.js แล้วเปิด http://localhost:5174
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = Number(process.env.PORT) || 5174;
const ROOT = __dirname;
const TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if(p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if(!file.startsWith(ROOT)){ res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if(err){ res.writeHead(404, {'Content-Type':'text/plain'}).end('Not found'); return; }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-cache'});
    res.end(data);
  });
}).listen(PORT, () => console.log(`joddi: http://localhost:${PORT}`));
