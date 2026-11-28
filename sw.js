const C='ashen-v0-5-0';
// 버전을 올릴 때마다 위 캐시 이름도 올린다. 이름이 바뀌면 새 서비스 워커가 옛 캐시를 지우고, 다음 실행부터 새 버전이 뜬다.
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim()});
// 캐시를 먼저 보여 주고 뒤에서 새로 받아 둔다 (글꼴 같은 외부 파일도 한 번 받으면 오프라인에서 씀)
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(hit=>{const net=fetch(e.request).then(r=>{if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp))}return r}).catch(()=>hit);return hit||net}))});
