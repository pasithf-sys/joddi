/* Service worker ของ joddi: ใช้ออฟไลน์ได้ — แก้ไฟล์แอปแล้วให้เปลี่ยน VERSION */
const VERSION = 'v1';
const CACHE = `joddi-${VERSION}`;
const FILES = ['./', 'index.html', 'css/app.css', 'js/app.js', 'manifest.webmanifest', 'icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  // เน็ตก่อน (ได้ของใหม่) ถ้าออฟไลน์ใช้แคช — รวมถึงฟอนต์ที่เคยโหลดแล้ว
  e.respondWith(fetch(req)
    .then(res => { if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || caches.match('index.html'))));
});
