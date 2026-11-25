// La banda in bici: rende l'app installabile e riceve i GPX condivisi da altre app (menu "Condividi" di Android).
// Le pagine si prendono sempre dalla rete (così c'è sempre l'ultima versione); senza rete si usa la copia salvata.
const C='banda-app-v2';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['crea.html','manifest.webmanifest','app/icone/icona-192.png']).catch(()=>{})));});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
  if(r.method==='POST'&&u.pathname.endsWith('/condividi')){e.respondWith((async()=>{const fd=await r.formData(),fs=fd.getAll('gpx').filter(f=>f&&f.size),c=await caches.open('banda-condivisi');
      for(const k of await c.keys())await c.delete(k);
      await Promise.all(fs.map((f,i)=>c.put('condiviso-'+i,new Response(f,{headers:{'x-nome':encodeURIComponent(f.name||('traccia'+(i+1)+'.gpx'))}}))));
      return Response.redirect('crea.html?condiviso='+fs.length,303);})());return;}
  if(r.method!=='GET'||u.origin!==location.origin||r.mode!=='navigate')return;
  e.respondWith(fetch(r).then(res=>{if(res.ok&&u.pathname.endsWith('crea.html')){const cp=res.clone();caches.open(C).then(c=>c.put('crea.html',cp));}return res;}).catch(async()=>(await caches.match(r))||(await caches.match('crea.html'))));});
