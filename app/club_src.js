// ================= LA BANDA: profilo, guardaroba, archivio uscite e segmenti, confronti =================
// Archivio online su Supabase (account, pubblico/privato, approvazione dei membri) se SB_URL/SB_KEY sono impostati;
// altrimenti lo stesso archivio vive solo su questo telefono (IndexedDB), con le stesse funzioni.
const STRAVA_ID='300745';   // Client ID dell'app Strava "La banda in bici" (pubblico); la chiave segreta sta solo nei segreti di Supabase
const STV_IMG='https://studiobilancio2025-code.github.io/banda-in-bici/app/strava/';   // marchi ufficiali di Strava ("Connect with Strava", "Powered by Strava"), obbligatori per le regole di Strava: non modificarli
const stvPow=()=>`<img src="${STV_IMG}powered.svg" alt="Powered by Strava" class="stvpow">`;
const SB_URL='https://ysfbjemogvmbjzztcvvc.supabase.co',SB_KEY='sb_publishable_DY5s3yyiBRs68gRHkx69Rg_z8WRqB8M';   // indirizzo del progetto Supabase e chiave "anon" (pubblica per natura: le regole RLS proteggono i dati)
const IDB={db:null,open(){return this.db||(this.db=new Promise((res,rej)=>{const r=indexedDB.open('banda-archivio',1);
    r.onupgradeneeded=()=>{for(const t of['profiles','guardaroba','uscite','tracce','segmenti','passaggi'])r.result.createObjectStore(t,{keyPath:t==='tracce'?'uscita_id':'id'});};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));},
  async tx(t,mode,fn){const db=await this.open();return new Promise((res,rej)=>{const s=db.transaction(t,mode).objectStore(t),q=fn(s);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});},
  all(t){return this.tx(t,'readonly',s=>s.getAll());},get(t,k){return this.tx(t,'readonly',s=>s.get(k));},put(t,o){return this.tx(t,'readwrite',s=>s.put(o));},del(t,k){return this.tx(t,'readwrite',s=>s.delete(k));}};
const uuid=()=>crypto.randomUUID?crypto.randomUUID():'x'+Date.now().toString(36)+Math.random().toString(36).slice(2);
const DB={online:!!(SB_URL&&SB_KEY),sb:null,uid:null,prof:null,ready:null,
  async init(){if(this.ready)return this.ready;return this.ready=(async()=>{
    if(!this.online){this.uid='locale';this.prof=await IDB.get('profiles','locale')||{id:'locale',nome:'',dati:{},membro:true,admin:true};return;}
    if(!window.supabase)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';s.onload=res;s.onerror=()=>rej(new Error('Non riesco a scaricare il collegamento al database.'));document.head.appendChild(s);});
    this.sb=supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,detectSessionInUrl:true}});
    this.sb.auth.onAuthStateChange((ev)=>{if(ev==='PASSWORD_RECOVERY')setTimeout(clubNewPw,300);});
    const {data}=await this.sb.auth.getSession();await this.setUser(data.session&&data.session.user);})();},
  async setUser(u){this.uid=u?u.id:null;this.email=u?u.email:'';this.prof=null;if(!u)return;const {data}=await this.sb.from('profiles').select('*').eq('id',u.id).maybeSingle();this.prof=data||{id:u.id,nome:'',dati:{},membro:false,admin:false};},
  chk(r){if(r.error)throw new Error(r.error.message);return r.data;},
  async signUp(email,pw,nome){const r=await this.sb.auth.signUp({email,password:pw,options:{data:{nome},emailRedirectTo:location.origin+location.pathname}});this.chk(r);if(r.data.session)await this.setUser(r.data.user);return r.data;},
  async signIn(email,pw){const r=await this.sb.auth.signInWithPassword({email,password:pw});this.chk(r);await this.setUser(r.data.user);},
  async signOut(){await this.sb.auth.signOut();await this.setUser(null);},
  async resetPw(email){this.chk(await this.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}));},
  async newPw(pw){this.chk(await this.sb.auth.updateUser({password:pw}));},
  async saveProfile(nome,dati){this.prof.nome=nome;this.prof.dati=dati;if(!this.online)return IDB.put('profiles',this.prof);this.chk(await this.sb.from('profiles').update({nome,dati}).eq('id',this.uid));},
  async profiles(){if(!this.online)return[this.prof];return this.chk(await this.sb.from('profiles').select('id,nome,dati,membro,admin').order('nome'));},
  async approve(id,si){this.chk(await this.sb.rpc('approva',{uid:id,si}));},
  async items(){if(!this.online)return(await IDB.all('guardaroba')).sort((a,b)=>(a.created_at>b.created_at?1:-1));return this.chk(await this.sb.from('guardaroba').select('*').order('created_at'));},
  async saveItem(o){if(!this.online){o.id=o.id||uuid();o.owner='locale';o.created_at=o.created_at||new Date().toISOString();await IDB.put('guardaroba',o);return o;}
    if(o.id)return this.chk(await this.sb.from('guardaroba').update({nome:o.nome,dati:o.dati}).eq('id',o.id).select().single());return this.chk(await this.sb.from('guardaroba').insert({tipo:o.tipo,nome:o.nome,dati:o.dati}).select().single());},
  async delItem(id){if(!this.online)return IDB.del('guardaroba',id);this.chk(await this.sb.from('guardaroba').delete().eq('id',id));},
  async uscite(){if(!this.online)return(await IDB.all('uscite')).map(u=>({...u,traccia_pub:undefined}));return this.chk(await this.sb.from('uscite').select('id,owner,data,titolo,pubblica,info,created_at').order('data',{ascending:false}).limit(500));},
  async saveUscita(u,full,pub){if(!this.online){u.id=uuid();u.owner='locale';u.created_at=new Date().toISOString();u.traccia_pub=pub;await IDB.put('uscite',u);await IDB.put('tracce',{uscita_id:u.id,owner:'locale',dati:full});return u;}
    const d=this.chk(await this.sb.from('uscite').insert({data:u.data,titolo:u.titolo,pubblica:u.pubblica,info:u.info,traccia_pub:u.pubblica?pub:null}).select('id,owner,data,titolo,pubblica,info').single());
    this.chk(await this.sb.from('tracce').insert({uscita_id:d.id,dati:full}));return d;},
  async updUscita(id,patch){if(!this.online){const u=await IDB.get('uscite',id);Object.assign(u,patch);return IDB.put('uscite',u);}this.chk(await this.sb.from('uscite').update(patch).eq('id',id));},
  async delUscita(id){if(!this.online){await IDB.del('uscite',id);await IDB.del('tracce',id);for(const p of await IDB.all('passaggi'))if(p.uscita_id===id)await IDB.del('passaggi',p.id);return;}this.chk(await this.sb.from('uscite').delete().eq('id',id));},
  // traccia di un'uscita: completa se è mia, altrimenti la copia senza partenza e arrivo
  async track(u){if(!this.online){if(u.owner===this.uid)return(await IDB.get('tracce',u.id)).dati;return(await IDB.get('uscite',u.id)).traccia_pub;}
    if(u.owner===this.uid)return this.chk(await this.sb.from('tracce').select('dati').eq('uscita_id',u.id).single()).dati;
    return this.chk(await this.sb.from('uscite').select('traccia_pub').eq('id',u.id).single()).traccia_pub;},
  async segmenti(){if(!this.online)return IDB.all('segmenti');return this.chk(await this.sb.from('segmenti').select('*').order('nome'));},
  async saveSeg(s){if(!this.online){s.id=uuid();s.owner='locale';s.created_at=new Date().toISOString();await IDB.put('segmenti',s);return s;}
    return this.chk(await this.sb.from('segmenti').insert({nome:s.nome,pubblico:s.pubblico,a:s.a,b:s.b,info:s.info}).select().single());},
  async updSeg(id,patch){if(!this.online){const s=await IDB.get('segmenti',id);Object.assign(s,patch);return IDB.put('segmenti',s);}this.chk(await this.sb.from('segmenti').update(patch).eq('id',id));},
  async delSeg(id){if(!this.online){await IDB.del('segmenti',id);for(const p of await IDB.all('passaggi'))if(p.segmento_id===id)await IDB.del('passaggi',p.id);return;}this.chk(await this.sb.from('segmenti').delete().eq('id',id));},
  async passaggi(){if(!this.online)return IDB.all('passaggi');return this.chk(await this.sb.from('passaggi').select('*').limit(5000));},
  async addPassaggi(rows){if(!rows.length)return;if(!this.online){for(const r of rows){const ex=(await IDB.all('passaggi')).find(p=>p.segmento_id===r.segmento_id&&p.uscita_id===r.uscita_id);await IDB.put('passaggi',{...r,id:ex?ex.id:uuid()});}return;}
    this.chk(await this.sb.from('passaggi').upsert(rows,{onConflict:'segmento_id,uscita_id',ignoreDuplicates:true}));}};

// ---------- tracce: compresse come i link (punti al secondo, interi a differenze) ----------
async function encTrack(P){return b64u(await zip(JSON.stringify(encPts(P,1))));}
async function decTrack(s){return decPts(JSON.parse(await unzip(ub64(s))));}
const farFromEnds=(P,m)=>{const a=P[0],b=P[P.length-1];return P.filter(p=>distM(p,a)>m&&distM(p,b)>m);};
const ptsArr=r=>r.pts.map(p=>[p.lat,p.lon,p.ele,p.t,p.hr,p.cad,p.pw]);
function trackInfo(P){let km=0,up=0,el=P[0][2];for(let i=1;i<P.length;i++){km+=distM(P[i-1],P[i]);if(i%5===0){const e=P[i][2];if(e>el)up+=e-el;el=e;}}return{km:km/1000,dplus:Math.round(up),durata:P[P.length-1][3]-P[0][3]};}
// passaggio su un segmento: vicino (< 40 m) alla partenza e poi all'arrivo; se ci passa più volte, il migliore
function effOf(P,a,b){const near=(pt,i)=>distM(P[i],pt);let best=null;
  for(let i=0;i<P.length;i++){if(near(a,i)>=40)continue;let ia=i;while(i+1<P.length&&near(a,i+1)<40){i++;if(near(a,i)<near(a,ia))ia=i;}
    let ib=-1;for(let j=i+1;j<P.length&&P[j][3]-P[ia][3]<4*3600;j++){if(near(a,j)<40)break;if(near(b,j)<40){ib=j;while(j+1<P.length&&near(b,j+1)<40){j++;if(near(b,j)<near(b,ib))ib=j;}break;}}
    if(ib>0){const d=P[ib][3]-P[ia][3];if(d>20&&(!best||d<best.durata))best={ta:P[ia][3],tb:P[ib][3],durata:d};}}
  return best;}
function segInfo(P,e){let km=0,up=0;const Q=P.filter(p=>p[3]>=e.ta&&p[3]<=e.tb);for(let i=1;i<Q.length;i++){km+=distM(Q[i-1],Q[i]);up+=Math.max(0,Q[i][2]-Q[i-1][2]);}return{km:km/1000,dplus:Math.round(up)};}

// ---------- foto e colori ----------
const fileImg=f=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(f);});
function imgData(im,max,square){const c=document.createElement('canvas');let sx=0,sy=0,sw=im.width,sh=im.height;
  if(square){const s=Math.min(sw,sh)*.85;sx=(sw-s)/2;sy=Math.max(0,sh*.42-s/2);sw=sh=s;c.width=c.height=max;}else{const k=Math.min(1,max/Math.max(sw,sh));c.width=Math.round(sw*k);c.height=Math.round(sh*k);}
  c.getContext('2d').drawImage(im,sx,sy,sw,sh,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.82);}
// colore dominante in una zona della foto (fra x0..x1, y0..y1 in frazioni), senza grigi se "vivo"
function domColor(src,x0,y0,x1,y1,vivo){return new Promise(res=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=48;const g=c.getContext('2d');
    g.drawImage(im,im.width*x0,im.height*y0,im.width*(x1-x0),im.height*(y1-y0),0,0,48,48);const d=g.getImageData(0,0,48,48).data,B=new Map();
    for(let i=0;i<d.length;i+=4){const r=d[i]/255,gg=d[i+1]/255,b=d[i+2]/255,mx=Math.max(r,gg,b),mn=Math.min(r,gg,b),l=(mx+mn)/2,s=mx===mn?0:(mx-mn)/(1-Math.abs(2*l-1));
      let k;if(vivo){if(s<.28||l<.12||l>.9)continue;let h=0;if(mx===r)h=((gg-b)/(mx-mn)+6)%6;else if(mx===gg)h=(b-r)/(mx-mn)+2;else h=(r-gg)/(mx-mn)+4;k='h'+Math.round(h*3);}else k='l'+Math.round(l*6);
      const e=B.get(k)||{n:0,r:0,g:0,b:0};e.n++;e.r+=d[i];e.g+=d[i+1];e.b+=d[i+2];B.set(k,e);}
    const top=[...B.values()].sort((a,b)=>b.n-a.n).filter(e=>e.n>20);const hex=e=>'#'+[e.r,e.g,e.b].map(v=>Math.round(v/e.n).toString(16).padStart(2,'0')).join('');
    res(top.map(hex));};im.onerror=()=>res([]);im.src=src;});}

// ---------- interfaccia ----------
const CL={tab:'prof',items:[],usc:[],segs:[],pas:[],profs:[],sel:new Set(),edit:null,seg:null};
const clubBox=()=>$('cbody');
function clubMsg(t,err){$('cmsg').innerHTML=t?`<p class="${err?'warn':'meta'}">${t}</p>`:'';}
async function clubOpen(tab){$('club').style.display='block';document.body.style.overflow='hidden';if(tab)CL.tab=tab;clubMsg('Un attimo…');
  try{await DB.init();clubMsg('');}catch(e){clubMsg(e.message,true);}clubRender();}
function clubClose(){$('club').style.display='none';document.body.style.overflow='';}
function clubHead(){const p=DB.prof;
  if(!DB.online)return`<p class="meta">📱 Archivio <b>solo su questo telefono</b> per ora: quando colleghiamo il database online, ognuno avrà il suo account e le uscite si potranno condividere con la banda.</p>`;
  if(!DB.uid)return'';return`<div class="cuser"><span>👤 <b>${esc(p.nome||DB.email)}</b>${p.admin?' · amministratore':''}${p.membro?'':' · <span class="warn">in attesa di approvazione</span>'}</span><button class="lnk" id="clogout">Esci</button></div>`;}
function clubLogin(){return`<div class="ccard"><h3>Entra nella banda</h3><p class="meta">Ognuno ha il suo account: le tue uscite restano tue, e scegli tu quali far vedere agli altri.</p>
  <label>Email<input id="lemail" type="email" autocomplete="email"></label><label>Password<input id="lpw" type="password" autocomplete="current-password"></label>
  <div class="crow"><button class="btn" id="lin">Entra</button><button class="lnk" id="lforgot">Ho dimenticato la password</button></div>
  <hr><h3>Prima volta?</h3><label>Il tuo nome<input id="lnome" maxlength="24" placeholder="es. Geppino"></label><button class="btn ghost" id="lup">Registrati</button>
  <p class="meta">Dopo la registrazione Geppino ti approva, e da lì vedi le uscite e i segmenti pubblici della banda.</p></div>`;}
async function clubLoad(){const [items,usc,segs,pas,profs]=await Promise.all([DB.items(),DB.uscite(),DB.segmenti(),DB.passaggi(),DB.profiles()]);Object.assign(CL,{items,usc,segs,pas,profs});}
const profOf=id=>CL.profs.find(p=>p.id===id)||(id===DB.uid?DB.prof:null)||{nome:'?',dati:{}};
const riderName=u=>(u.info&&u.info.ciclista)||profOf(u.owner).nome||'?';
const dIt=d=>new Date(d+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
async function clubRender(){const b=clubBox();$('chead').innerHTML=clubHead();
  if(DB.online&&!DB.uid){$('ctabs').style.display='none';b.innerHTML=clubLogin();return;}
  $('ctabs').style.display='flex';$('ctabs').querySelectorAll('button').forEach(x=>{x.classList.toggle('on',x.dataset.t===CL.tab);if(x.dataset.t==='mem')x.style.display=DB.online?'':'none';});
  b.innerHTML='<p class="meta">Carico l\'archivio…</p>';try{await clubLoad();}catch(e){b.innerHTML=`<p class="warn">${esc(e.message)}</p>`;return;}
  ({prof:tabProf,gua:tabGua,usc:tabUsc,seg:tabSeg,mem:tabMem})[CL.tab]();}

// --- profilo ---
function tabProf(){const p=DB.prof,d=p.dati||{},ph=(k,l)=>`<label class="cph">${d[k]?`<img src="${d[k]}" alt="">`:`<span>${l}</span>`}<input type="file" accept="image/*" data-ph="${k}"></label>`;
  clubBox().innerHTML=`<div class="ccard"><h3>Il mio profilo</h3>
    <div class="cphs">${ph('testa','📷 Volto<br><small>per la testa sulla bici</small>')}${ph('intera','📷 Foto intera<br><small>in bici o in divisa</small>')}${ph('bici','📷 La bici')}</div>
    <button class="btn ghost" id="pcol">🎨 Prendi i colori dalle foto</button>
    <label>Nome<input id="pnome" maxlength="24" value="${esc(p.nome||'')}"></label><label>Soprannome<input id="pnick" maxlength="24" value="${esc(d.nick||'')}" placeholder="es. il Diesel"></label>
    <div class="sw">${COLORS.map(c=>`<button style="background:${c}" class="${c===(d.colore||COLORS[0])?'on':''}" data-pc="${c}" aria-label="Colore"></button>`).join('')}</div>
    <div class="crow"><select id="palt">${['bassa','media','alta'].map(v=>`<option ${v===(d.alt||'media')?'selected':''} value="${v}">Altezza ${v}</option>`).join('')}</select>
    <select id="pfis">${['magro','normale','robusto','grasso'].map(v=>`<option ${v===(d.fis||'normale')?'selected':''} value="${v}">Fisico ${v}</option>`).join('')}</select></div>
    <label>Battute per il telecronista (una per riga, {n} = il tuo nome)<textarea id="pbat" rows="2">${esc(d.bat||'')}</textarea></label>
    <button class="btn" id="psave">💾 Salva il profilo</button></div>
    ${STRAVA_ID&&DB.online?`<div class="ccard"><h3>Strava</h3><div id="stvbox"><p class="meta">Controllo il collegamento…</p></div></div>`:''}`;
  if(STRAVA_ID&&DB.online)stvStatus();}
// ---------- Strava: collegamento (OAuth tramite la funzione "strava" su Supabase) e importazione delle uscite coi segmenti esatti ----------
async function stv(op,extra){const r=await DB.sb.functions.invoke('strava',{body:Object.assign({op},extra||{})});
  if(r.error){let m=r.error.message;try{const j=await r.error.context.json();if(j.error)m=j.error;}catch(e){}throw new Error(m);}if(r.data&&r.data.error)throw new Error(r.data.error);return r.data;}
async function stvStatus(){const b=$('stvbox');if(!b)return;try{const s=await stv('status');CL.stv=s;
    b.innerHTML=s.connected?`<p>✅ Collegato${s.athlete&&s.athlete.nome?' come <b>'+esc(s.athlete.nome)+'</b>':''}. In «🚴 Uscite» trovi «⬇️ Prendi da Strava».</p><button class="lnk" id="stvoff">Scollega Strava</button>`
      :`<p class="meta">Collegando Strava, le tue uscite arrivano nell'archivio con un tocco, con battiti, cadenza, watt e <b>tutti i segmenti nel punto esatto</b>.</p><button id="stvon" class="stvbtn" aria-label="Connect with Strava"><img src="${STV_IMG}connetti.svg" alt="Connect with Strava" width="193" height="48"></button>`;
    b.insertAdjacentHTML('beforeend',stvPow());}
  catch(e){b.innerHTML=`<p class="warn">Strava: ${esc(e.message)}</p>`;}}
function stvConnect(){const mob=/Android|iPhone|iPad/i.test(navigator.userAgent),back=location.origin+location.pathname;
  location.href=`https://www.strava.com/oauth/${mob?'mobile/':''}authorize?client_id=${STRAVA_ID}&redirect_uri=${encodeURIComponent(back)}&response_type=code&approval_prompt=auto&scope=read,activity:read_all&state=strava`;}
// al ritorno da Strava: ?code=…&state=strava
(async()=>{const q=new URLSearchParams(location.search);if(q.get('state')!=='strava')return;history.replaceState(null,'',location.pathname);
  if(q.get('error')){clubOpen('prof').then(()=>clubMsg('Collegamento a Strava annullato.',true));return;}
  try{await DB.init();if(!DB.uid){clubOpen('prof');return;}await stv('exchange',{code:q.get('code')});await clubOpen('prof');clubMsg('✅ Strava collegato!');}
  catch(e){await clubOpen('prof');clubMsg('Strava: '+esc(e.message),true);}})();
async function stvList(page){const b=$('stvlist');b.innerHTML='<p class="meta">Chiedo a Strava le tue uscite…</p>';
  try{const L=await stv('activities',{page});CL.stvL=(page>1?CL.stvL||[]:[]).concat(L);const have=new Set(CL.usc.map(u=>u.info&&u.info.strava_id).filter(Boolean));
    b.innerHTML=CL.stvL.map(a=>`<div class="cusc"><div><b>${esc(a.nome)}</b><span class="meta">${a.locale.slice(0,10).split('-').reverse().join('/')} · ${kmS(a.km*1000)} km · ${Math.round(a.dplus)} m D+ · ${fmt(a.durata)}</span></div>${have.has(a.id)?'<span class="meta">✓ in archivio</span>':`<button class="btn ghost" data-stvimp="${a.id}">⬇️</button>`}</div>`).join('')
      +(L.length===30?`<button class="lnk" data-stvmore="${page+1}">Altre uscite…</button>`:'')+stvPow();}
  catch(e){b.innerHTML=`<p class="warn">${esc(e.message)}</p>`;}}
async function stvImport(id){const a=await stv('activity',{id}),st=a.st;if(!st.t||!st.ll)throw new Error('Questa attività non ha la traccia GPS.');
  const P=st.t.map((t,i)=>[st.ll[i][0],st.ll[i][1],st.el?st.el[i]:0,t,st.hr?st.hr[i]:null,st.cad?st.cad[i]:null,st.pw?st.pw[i]:null]);
  const kit={},ids={};for(const t of['completino','casco','bici']){const k=$('uk_'+t)&&$('uk_'+t).value;if(k){ids[t]=k;Object.assign(kit,CL.items.find(i=>i.id===k).dati);}}
  const day=a.locale.slice(0,10),info=Object.assign(trackInfo(P),{t0:Date.parse(a.start),ciclista:DB.prof.nome||'',kit:Object.keys(kit).length?kit:null,ids,src:'strava',strava_id:a.id});
  const u=await DB.saveUscita({data:day,titolo:day.replace(/-/g,'')+' - '+a.nome,pubblica:false,info},await encTrack(P),await encTrack(farFromEnds(P,600)));
  // segmenti Strava nel punto esatto (riusati se già in archivio), passaggi coi tempi di Strava
  const segs=CL.segs.slice(),rows=[];let nuovi=0;
  for(const g of a.segs){if(!g.a||!g.b||g.i0==null)continue;let s=segs.find(x=>x.info&&x.info.strava_id===g.sid);
    if(!s){s=await DB.saveSeg({nome:g.nome,pubblico:false,a:g.a,b:g.b,info:{km:g.km,strava_id:g.sid}});segs.push(s);nuovi++;}
    if(!rows.some(r=>r.segmento_id===s.id)){const ta=st.t[g.i0],tb=st.t[g.i1];rows.push({segmento_id:s.id,uscita_id:u.id,owner:u.owner,data:u.data,ta,tb,durata:tb-ta});}}
  for(const s of segs){if(rows.some(r=>r.segmento_id===s.id)||(s.info&&s.info.strava_id))continue;const e=effOf(P,s.a,s.b);if(e)rows.push({segmento_id:s.id,uscita_id:u.id,owner:u.owner,data:u.data,ta:e.ta,tb:e.tb,durata:e.durata});}
  await DB.addPassaggi(rows);return{nome:a.nome,seg:a.segs.length,nuovi};}
async function profSave(){const p=DB.prof,d=Object.assign({},p.dati,{nick:$('pnick').value.trim(),alt:$('palt').value,fis:$('pfis').value,bat:$('pbat').value.trim()});
  await DB.saveProfile($('pnome').value.trim(),d);clubMsg('✓ Profilo salvato.');}

// --- guardaroba ---
const GT={completino:'👕 Completini',casco:'⛑️ Caschi',bici:'🚲 Bici'};
const itemKit=(it)=>Object.assign({m1:'#1e88e5',m2:'#ffffff',pat:'unita',sh:'#1b1b1b',he:'#ffffff',bk:'#222222'},it.dati);
function itemPrev(it){const k=itemKit(it);if(it.tipo==='completino')return`<img src="${kitPrev({color:k.m1,kit:k})}" width="42" height="36" alt="">`;
  if(it.tipo==='casco')return`<span class="cdot" style="background:${k.he}">⛑️</span>`;return`<span class="cdot" style="background:${k.bk}">🚲</span>`;}
function tabGua(){const ed=CL.edit;clubBox().innerHTML=Object.entries(GT).map(([t,l])=>`<div class="ccard"><h3>${l}</h3>
    ${CL.items.filter(i=>i.tipo===t).map(i=>`<div class="citem">${itemPrev(i)}<b>${esc(i.nome||'senza nome')}</b><button class="lnk" data-ied="${i.id}">✏️</button><button class="lnk" data-idel="${i.id}">🗑️</button></div>`).join('')||'<p class="meta">Ancora niente.</p>'}
    ${ed&&ed.tipo===t?itemEditor(ed):`<button class="btn ghost" data-inew="${t}">➕ Aggiungi</button>`}</div>`).join('');}
function itemEditor(it){const k=itemKit(it),col=(f,l)=>`<label class="kc">${l}<input type="color" data-ik="${f}" value="${k[f]}"></label>`;
  return`<div class="cedit"><label>Nome<input id="inome" maxlength="30" value="${esc(it.nome||'')}" placeholder="${it.tipo==='completino'?'es. Maglia della banda':it.tipo==='casco'?'es. Casco bianco':'es. Bici da corsa'}"></label>
    ${it.tipo==='completino'?`<div class="crow">${col('m1','Maglia')}${col('m2','2° colore')}<label class="kc">Disegno<select data-ik="pat">${Object.entries(KITP).map(([v,l])=>`<option value="${v}" ${v===k.pat?'selected':''}>${l}</option>`).join('')}</select></label>${col('sh','Pantaloncini')}</div>`:''}
    ${it.tipo==='casco'?col('he','Colore del casco'):''}${it.tipo==='bici'?col('bk','Colore del telaio'):''}
    <div class="crow"><button class="btn" id="isave">💾 Salva</button><button class="lnk" id="icancel">Annulla</button></div></div>`;}

// --- uscite ---
function tabUsc(){const mine=CL.usc.filter(u=>u.owner===DB.uid),days=new Map();CL.usc.forEach(u=>{(days.get(u.data)||days.set(u.data,[]).get(u.data)).push(u);});
  const opt=t=>`<option value="">—</option>`+CL.items.filter(i=>i.tipo===t).map(i=>`<option value="${i.id}">${esc(i.nome||GT[t])}</option>`).join('');
  clubBox().innerHTML=`<div class="ccard"><h3>Archivia un'uscita</h3>
    ${STRAVA_ID&&DB.online?`<button class="btn" id="stvopen" style="width:100%;margin-bottom:8px">⬇️ Prendi da Strava</button><div id="stvlist"></div>`:''}
    <label class="btn ghost cfile">📂 Scegli i file GPX<input type="file" id="ufile" accept=".gpx,application/gpx+xml,application/octet-stream,text/xml" multiple></label>
    ${riders.length?`<button class="btn ghost" id="ufromapp">🗄️ Archivia i GPX caricati nell'app (${riders.length})</button>`:''}
    <div id="unew"></div>
    <details><summary class="meta">Cosa vestire (si può cambiare dopo)</summary><div class="crow"><label class="kc">Completino<select id="uk_completino">${opt('completino')}</select></label><label class="kc">Casco<select id="uk_casco">${opt('casco')}</select></label><label class="kc">Bici<select id="uk_bici">${opt('bici')}</select></label></div></details></div>
  <div class="ccard"><h3>Le uscite <span class="meta">(${mine.length} tue${DB.online?`, ${CL.usc.length-mine.length} della banda`:''})</span></h3>
    ${[...days.entries()].map(([d,us])=>`<div class="cday">${dIt(d)}</div>`+us.map(u=>{const i=u.info||{},m=u.owner===DB.uid;
      return`<div class="cusc"><label class="cck"><input type="checkbox" data-usel="${u.id}" ${CL.sel.has(u.id)?'checked':''}></label><div><b>${esc(u.titolo||'Uscita')}</b><span class="meta">${esc(riderName(u))} · ${kmS((i.km||0)*1000)} km · ${i.dplus||0} m D+ · ${fmt(i.durata||0)}</span>${i.src==='strava'&&i.strava_id?`<a class="stvlink" href="https://www.strava.com/activities/${encodeURIComponent(i.strava_id)}" target="_blank" rel="noopener">Vedi su Strava</a>`:''}</div>
      ${m?`<button class="lnk" data-upub="${u.id}" title="Chi la vede">${u.pubblica?'🌍':'🔒'}</button><button class="lnk" data-udel="${u.id}">🗑️</button>`:''}</div>`;}).join('')).join('')||'<p class="meta">Ancora nessuna uscita in archivio.</p>'}
    <p class="meta">🔒 = solo tu · 🌍 = tutta la banda (senza i primi e gli ultimi 600 m). Tocca per cambiare.</p></div>
  <div class="cbar" style="display:${CL.sel.size?'flex':'none'}"><span>${CL.sel.size} scelte</span><button class="btn" id="uplay">▶ Rivedi insieme</button></div>`;}
async function uscFromFiles(files){const out=[];for(const f of files){try{const r=parseGPX(await f.text(),f.name.replace(/\.gpx$/i,''));out.push({r,fname:f.name});}catch(e){clubMsg('Il file '+esc(f.name)+' non è un GPX valido.',true);}}uscForm(out);}
// nome del ciclista dal nome del file (Rocco_2026-11-22.gpx → Rocco); se è solo un numero (export di Strava) resta il mio
const guessName=f=>{const n=f.replace(/\.gpx$/i,'').replace(/20\d\d[-_.]?\d\d[-_.]?\d\d/g,'').replace(/[_\-.]+/g,' ').replace(/\b(completo|strava|gpx|uscita|activity)\b/gi,'').trim();return /[a-zà-ú]{2}/i.test(n)?n.split(' ').filter(w=>!/^\d+$/.test(w)).join(' ').slice(0,24):'';};
function uscForm(list){CL.pend=list;const today=new Date().toISOString().slice(0,10),dm=s=>{const m=s.match(/(20\d\d)[-_.]?(\d\d)[-_.]?(\d\d)/);return m?`${m[1]}-${m[2]}-${m[3]}`:null;};
  $('unew').innerHTML=list.map((x,i)=>{const d=x.r.abs&&x.r.t0?new Date(x.r.t0).toISOString().slice(0,10):dm(x.fname)||today,P=ptsArr(x.r),inf=trackInfo(P);
    return`<div class="cedit" data-pi="${i}"><b>${esc(x.fname)}</b> <span class="meta">${kmS(inf.km*1000)} km · ${fmt(inf.durata)}</span>
      <div class="crow"><label class="kc">Data<input type="date" data-pf="data" value="${d}"></label>${DB.online?`<input type="hidden" data-pf="ciclista" value="${esc(DB.prof.nome||'')}">`:`<label class="kc">Ciclista<input data-pf="ciclista" maxlength="24" value="${esc(x.r.prof||guessName(x.fname)||DB.prof.nome||'')}"></label>`}</div>
      <label>Titolo<input data-pf="titolo" maxlength="60" value="${esc(d.replace(/-/g,'')+' - '+(x.titolo||(DB.online&&guessName(x.fname))||'Uscita'))}"></label>
      <label class="cck2"><input type="checkbox" data-pf="pubblica" ${DB.online?'checked':''} ${DB.online?'':'disabled'}> 🌍 La vede tutta la banda</label></div>`;}).join('')+(list.length?`<button class="btn" id="usave">💾 Archivia ${list.length>1?list.length+' uscite':'l\'uscita'}</button>`:'');}
async function uscSave(){const kit={},ids={};for(const t of['completino','casco','bici']){const id=$('uk_'+t)&&$('uk_'+t).value;if(id){ids[t]=id;Object.assign(kit,CL.items.find(i=>i.id===id).dati);}}
  const segs=CL.segs.slice();let n=0;
  for(const el of document.querySelectorAll('#unew [data-pi]')){const x=CL.pend[+el.dataset.pi],v=k=>el.querySelector(`[data-pf="${k}"]`),P=ptsArr(x.r);
    clubMsg(`Archivio ${++n} di ${CL.pend.length}…`);
    const info=Object.assign(trackInfo(P),{t0:x.r.t0||null,ciclista:v('ciclista').value.trim(),kit:Object.keys(kit).length?kit:(x.r.kit||null),ids});
    const full=await encTrack(P),pub=await encTrack(farFromEnds(P,600)),u=await DB.saveUscita({data:v('data').value,titolo:v('titolo').value.trim(),pubblica:v('pubblica').checked,info},full,pub);
    // i segmenti Strava del GPX entrano nel mio archivio (privati), se non ci sono già
    for(const g of x.r.segs||[]){if(!segs.some(s=>distM(s.a,g.a)<40&&distM(s.b,g.b)<40)){const e=effOf(P,g.a,g.b);segs.push(await DB.saveSeg({nome:g.nome,pubblico:false,a:g.a,b:g.b,info:e?segInfo(P,e):{km:g.km}}));}}
    await DB.addPassaggi(segs.map(s=>{const e=effOf(P,s.a,s.b);return e&&{segmento_id:s.id,uscita_id:u.id,owner:u.owner,data:u.data,ta:e.ta,tb:e.tb,durata:e.durata};}).filter(Boolean));}
  CL.pend=[];clubMsg(`✓ Archiviat${n>1?'e':'a'} ${n} uscit${n>1?'e':'a'}.`);clubRender();}
async function uscTogglePub(id){const u=CL.usc.find(x=>x.id===id),si=!u.pubblica;
  if(si&&u.info&&u.info.src==='strava'){alert('Questa uscita viene da Strava: le regole di Strava permettono di mostrarla solo a te. Per farla vedere alla banda, archivia anche il GPX esportato (📂 Scegli i file GPX) e rendi pubblico quello. I segmenti invece si possono rendere pubblici.');return;}
  clubMsg('Aggiorno…');
  const patch={pubblica:si};if(DB.online)patch.traccia_pub=si?await encTrack(farFromEnds(await decTrack(await DB.track(u)),600)):null;await DB.updUscita(id,patch);clubMsg(si?'🌍 Ora la vede tutta la banda.':'🔒 Ora la vedi solo tu.');clubRender();}

// --- segmenti ---
function tabSeg(){const s=CL.seg?CL.segs.find(x=>x.id===CL.seg):null;if(s)return segDetail(s);
  clubBox().innerHTML=`<div class="ccard"><h3>I segmenti</h3><p class="meta">Si creano da soli dai segmenti Strava dei GPX, oppure dal tratto scelto nell'app (pulsante «⛰️ Salva come segmento» sotto la classifica).</p>
    ${CL.segs.map(g=>{const ps=CL.pas.filter(p=>p.segmento_id===g.id).sort((a,b)=>a.durata-b.durata),m=g.owner===DB.uid;
      return`<div class="cusc"><div style="flex:1" data-sopen="${g.id}"><b>${esc(g.nome)}</b><span class="meta">${g.info&&g.info.km?kmS(g.info.km*1000)+' km · ':''}${ps.length} passaggi${ps[0]?' · record '+fmt(ps[0].durata):''}</span></div>
      ${m?`<button class="lnk" data-spub="${g.id}">${g.pubblico?'🌍':'🔒'}</button><button class="lnk" data-sdel="${g.id}">🗑️</button>`:''}<button class="lnk" data-sopen="${g.id}">›</button></div>`;}).join('')||'<p class="meta">Ancora nessun segmento.</p>'}</div>`;}
function segDetail(g){const ps=CL.pas.filter(p=>p.segmento_id===g.id).sort((a,b)=>a.durata-b.durata),best=ps[0]&&ps[0].durata,mine=ps.filter(p=>p.owner===DB.uid);
  if(!CL.ref||!ps.some(p=>p.id===CL.ref))CL.ref=(mine[0]||ps[0]||{}).id;CL.pick=CL.pick||new Set();
  const u=id=>CL.usc.find(x=>x.id===id)||{};
  clubBox().innerHTML=`<div class="ccard"><button class="lnk" id="sback">‹ Tutti i segmenti</button><h3>${esc(g.nome)}</h3>
    <p class="meta">Tocca ◉ per il tuo passaggio di riferimento e spunta ☐ quelli da confrontare.</p>
    <table class="ctab"><tr><th></th><th></th><th>Ciclista</th><th>Data</th><th class="n">Tempo</th></tr>${ps.map((p,k)=>`<tr class="${p.owner===DB.uid?'me':''}"><td><input type="radio" name="sref" data-sref="${p.id}" ${p.id===CL.ref?'checked':''}></td><td><input type="checkbox" data-spk="${p.id}" ${CL.pick.has(p.id)?'checked':''}></td>
      <td>${k+1}. ${esc(riderName(u(p.uscita_id)))}</td><td>${new Date(p.data+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'2-digit'})}</td><td class="n">${fmt(p.durata)}${k?` <small>+${fmt(p.durata-best)}</small>`:''}</td></tr>`).join('')}</table>
    <div class="cmodes"><button class="btn" data-mode="insieme">👥 Con chi c'era<small>stessa uscita</small></button><button class="btn" data-mode="virtuale">🌐 Confronto virtuale<small>altri, altre date</small></button>
      <button class="btn" data-mode="ghost">👻 Ghost<small>te stesso, altre date</small></button><button class="btn" data-mode="h2h">⚔️ Testa a testa<small>2 passaggi spuntati</small></button>
      <button class="btn ghost" data-mode="solo">▶ Solo il mio</button></div>
    <button class="lnk" data-sscan="${g.id}" style="margin-top:8px">🔎 Cerca i passaggi in tutte le uscite dell'archivio</button></div>`;}
async function segScan(id){const g=CL.segs.find(x=>x.id===id),have=new Set(CL.pas.filter(p=>p.segmento_id===id).map(p=>p.uscita_id)),todo=CL.usc.filter(u=>!have.has(u.id)),rows=[];let k=0;
  for(const u of todo){clubMsg(`Cerco… ${++k} di ${todo.length}`);try{const P=await decTrack(await DB.track(u)),e=effOf(P,g.a,g.b);if(e)rows.push({segmento_id:g.id,uscita_id:u.id,owner:u.owner,data:u.data,ta:e.ta,tb:e.tb,durata:e.durata});}catch(err){}}
  await DB.addPassaggi(rows);clubMsg(rows.length?`✓ Trovati ${rows.length} passaggi nuovi.`:'Nessun passaggio nuovo.');await clubLoad();segDetail(g);}

// --- membri (solo online) ---
function tabMem(){const me=DB.prof;clubBox().innerHTML=`<div class="ccard"><h3>La banda</h3>${CL.profs.map(p=>`<div class="citem">${p.dati&&p.dati.testa?`<img src="${p.dati.testa}" class="cface" alt="">`:'<span class="cdot">🙂</span>'}<b>${esc(p.nome||'senza nome')}</b>
    <span class="meta">${p.admin?'amministratore':p.membro?'membro':'in attesa'}</span>${me.admin&&p.id!==me.id?`<button class="lnk" data-mapp="${p.id}" data-si="${p.membro?0:1}">${p.membro?'Togli':'✓ Approva'}</button>`:''}</div>`).join('')}</div>`;}

// ---------- rivedere: dalle uscite d'archivio ai ciclisti della scena ----------
async function riderFromUscita(u,P){const pr=profOf(u.owner),d=pr.dati||{},i=u.info||{},own=!i.ciclista||i.ciclista===pr.nome;
  return{name:(i.ciclista||pr.nome||'Ciclista').slice(0,18),pts:P.map(p=>({lat:p[0],lon:p[1],ele:p[2]??0,t:p[3],hr:p[4],cad:p[5],pw:p[6]})),abs:!!i.t0,t0:i.t0||null,off:0,sync:null,segs:[],
    color:own&&d.colore||COLORS[riders.length%COLORS.length],face:own?d.testa||null:null,alt:own&&d.alt||'media',fis:own&&d.fis||'normale',nick:own?d.nick||'':'',bat:own?d.bat||'':'',kit:i.kit||null,arch:u.id};}
// carica nell'app una lista di {u, ghost, etichetta}; se "real" i ciclisti si sincronizzano davvero, altrimenti partono insieme all'inizio del tratto
async function clubLoadRiders(list,seg,opts={}){loading(true);prog('Prendo le uscite dall\'archivio…','',.1);
  try{const rs=[];for(const x of list){const s=await DB.track(x.u);if(!s)throw new Error('Traccia non disponibile');let P=await decTrack(s);
      if(seg&&x.e){P=P.filter(p=>p[3]>=x.e.ta-240&&p[3]<=x.e.tb+240);}const r=await riderFromUscita(x.u,P);if(x.label)r.name=x.label.slice(0,18);r.ghostLook=!!x.ghost;rs.push(r);}
    riders=rs;window.H2H=!!opts.h2h;const p0=riders[0].pts[0];REF={lat:p0.lat,lon:p0.lon,c:Math.cos(p0.lat*D)};
    riders.forEach((r,i)=>{const t0=r.pts[0].t;r.pts.forEach(p=>p.t-=t0);if(r.t0!=null)r.t0+=t0*1000;grid(r);if(i===0)r.sync={ok:true,together:0};else if(opts.real)syncRider(r);else r.sync={ok:false,together:0};});
    // i segmenti d'archivio dove passa il primo compaiono nell'elenco dei tratti
    const P0=ptsArr(riders[0]);riders[0].segs=CL.segs.map(g=>{const e=effOf(P0,g.a,g.b);return e&&{nome:g.nome,km:(g.info&&g.info.km)||0,tempo:e.durata,a:g.a,b:g.b};}).filter(Boolean);
    built=false;segSel=-1;if(S3){S3.stop();S3=null;$('scene').innerHTML='';$('tags').innerHTML='';}
    if(seg){A=seg.a.slice();B=seg.b.slice();$('titolo').value=(opts.h2h?'⚔️ ':'')+seg.nome;}else{A=B=null;$('titolo').value=list.length>1?'Uscita insieme':(list[0].u.titolo||'Uscita');}
    renderRiders();drawMap();computeSeg();renderSegs();loading(false);clubClose();
    if(seg&&SEG){if(map)map.fitBounds([A,B],{padding:[40,40]});FX.init();unlockAudio();buildScene().catch(e=>{loading(false);alert('Errore: '+e.message);});}
    else{const h=$('hint');h.innerHTML=`<b style="display:block;background:#ffd400;color:#10151c;border-radius:10px;padding:10px 12px;font-size:17px">👉 Ora scegli il tratto da rivedere: ${riders[0].segs.length?'tocca un segmento qui sotto, oppure ':''}tocca sulla cartina <u>la partenza</u> e poi <u>l'arrivo</u>, vicino alla linea. Poi «Crea la scena 3D».${riders.length===1?' Per tutta l\'uscita c\'è anche «🎬 Sintesi dell\'uscita».':''}</b>`;
      h.scrollIntoView({behavior:'smooth',block:'start'});}}
  catch(e){loading(false);alert('Non riesco a caricare: '+e.message);}}
async function segPlay(mode){const g=CL.segs.find(x=>x.id===CL.seg),ps=CL.pas.filter(p=>p.segmento_id===g.id),ref=ps.find(p=>p.id===CL.ref),pick=ps.filter(p=>CL.pick.has(p.id)),u=p=>CL.usc.find(x=>x.id===p.uscita_id);
  const lab=(p,gh)=>riderName(u(p))+(gh?' 👻 ':' ')+new Date(p.data+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'numeric'});
  const same=(p,q)=>u(p).owner===u(q).owner&&riderName(u(p))===riderName(u(q));let L=[],real=false,h2h=false;const it=(p,gh,lb)=>({u:u(p),e:p,ghost:gh,label:lb});
  if(mode==='h2h'){if(pick.length!==2){alert('Per il testa a testa spunta ☐ esattamente 2 passaggi.');return;}const sd=pick[0].data===pick[1].data&&pick[0].uscita_id!==pick[1].uscita_id;real=sd;h2h=true;
    L=pick.map(p=>it(p,!sd&&same(p,pick[0])&&p!==pick[0],sd?null:lab(p)));}
  else{if(!ref){alert('Scegli ◉ il passaggio di riferimento.');return;}L=[it(ref,false,null)];
    if(mode==='insieme'){real=true;ps.filter(p=>p.data===ref.data&&p.uscita_id!==ref.uscita_id).forEach(p=>L.push(it(p,false,null)));if(L.length<2){alert('In quella data non ci sono altre uscite su questo segmento.');return;}}
    if(mode==='ghost'){let o=pick.filter(p=>same(p,ref)&&p.id!==ref.id);if(!o.length)o=ps.filter(p=>same(p,ref)&&p.id!==ref.id).sort((a,b)=>a.durata-b.durata).slice(0,1);if(!o.length){alert('Non ci sono altri tuoi passaggi su questo segmento.');return;}
      L[0].label=lab(ref);o.forEach(p=>L.push(it(p,true,lab(p,true))));}
    if(mode==='virtuale'){let o=pick.filter(p=>!same(p,ref)&&p.data!==ref.data);if(!o.length)o=ps.filter(p=>!same(p,ref)&&p.data!==ref.data).sort((a,b)=>a.durata-b.durata).slice(0,1);if(!o.length){alert('Nessun passaggio di altri ciclisti in altre date.');return;}
      L[0].label=lab(ref);o.forEach(p=>L.push(it(p,false,lab(p))));}}
  if(L.some(x=>!x.u)){alert('Una delle uscite non è più visibile.');return;}
  await clubLoadRiders(L,g,{real,h2h});}

// ---------- dal tratto scelto nell'app a un segmento d'archivio ----------
async function segFromApp(){if(!SEG){alert('Scegli prima il tratto.');return;}await DB.init();if(DB.online&&!DB.uid){clubOpen('seg');return;}
  const nome=prompt('Nome del segmento:',$('titolo').value||'Il nostro segmento');if(!nome)return;loading(true);prog('Salvo il segmento e cerco i passaggi…','',.2);
  try{await clubLoad();const P0=ptsArr(riders[0]),e0=effOf(P0,A,B),g=await DB.saveSeg({nome:nome.trim(),pubblico:false,a:A.slice(),b:B.slice(),info:e0?segInfo(P0,e0):{}});
    const rows=[];let k=0;for(const u of CL.usc){prog('Cerco i passaggi nell\'archivio…',`${++k} di ${CL.usc.length}`,.2+.7*k/CL.usc.length);try{const P=await decTrack(await DB.track(u)),e=effOf(P,g.a,g.b);if(e)rows.push({segmento_id:g.id,uscita_id:u.id,owner:u.owner,data:u.data,ta:e.ta,tb:e.tb,durata:e.durata});}catch(err){}}
    await DB.addPassaggi(rows);loading(false);alert(`Segmento «${g.nome}» salvato: ${rows.length} passaggi trovati nell'archivio.`);}
  catch(e){loading(false);alert('Non riesco a salvare: '+e.message);}}
function clubNewPw(){const pw=prompt('Scrivi la nuova password (almeno 6 caratteri):');if(pw&&pw.length>=6)DB.newPw(pw).then(()=>alert('Password cambiata.')).catch(e=>alert(e.message));}

// ---------- eventi ----------
$('clubbtn').addEventListener('click',()=>clubOpen());$('clubx').addEventListener('click',clubClose);$('segsave').addEventListener('click',segFromApp);
$('ctabs').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;CL.tab=b.dataset.t;CL.edit=null;CL.seg=null;clubMsg('');clubRender();});
$('club').addEventListener('change',async e=>{const t=e.target;
  if(t.dataset.ph){const f=t.files[0];if(!f)return;const im=await fileImg(f),k=t.dataset.ph;DB.prof.dati=Object.assign({},DB.prof.dati,{[k]:imgData(im,k==='testa'?256:640,k==='testa')});URL.revokeObjectURL(im.src);await DB.saveProfile(DB.prof.nome,DB.prof.dati);tabProf();clubMsg('✓ Foto salvata.');return;}
  if(t.id==='ufile'){uscFromFiles([...t.files]);return;}
  if(t.dataset.pf==='data'){const ti=t.closest('[data-pi]').querySelector('[data-pf="titolo"]');ti.value=t.value.replace(/-/g,'')+' - '+ti.value.replace(/^\d{8} - /,'');return;}
  if(t.dataset.usel){t.checked?CL.sel.add(t.dataset.usel):CL.sel.delete(t.dataset.usel);const b=document.querySelector('#club .cbar');b.style.display=CL.sel.size?'flex':'none';b.firstChild.textContent=CL.sel.size+' scelte';return;}
  if(t.dataset.sref){CL.ref=t.dataset.sref;return;}if(t.dataset.spk){t.checked?CL.pick.add(t.dataset.spk):CL.pick.delete(t.dataset.spk);return;}
  if(t.dataset.ik&&CL.edit){CL.edit.dati=Object.assign(itemKit(CL.edit),{[t.dataset.ik]:t.value});}});
$('club').addEventListener('click',async e=>{const b=e.target.closest('button,[data-sopen]');if(!b)return;const d=b.dataset;
  try{
    if(b.id==='lin'){clubMsg('Entro…');await DB.signIn($('lemail').value.trim(),$('lpw').value);clubMsg('');clubRender();}
    else if(b.id==='lup'){const n=$('lnome').value.trim();if(!n){clubMsg('Scrivi il tuo nome.',true);return;}clubMsg('Registro…');const r=await DB.signUp($('lemail').value.trim(),$('lpw').value,n);
      clubMsg(r.session?'✓ Registrato!':'✓ Registrato: controlla la tua email e tocca il link di conferma, poi entra.');clubRender();}
    else if(b.id==='lforgot'){const m=$('lemail').value.trim();if(!m){clubMsg('Scrivi prima la tua email.',true);return;}await DB.resetPw(m);clubMsg('Ti ho mandato un\'email per cambiare la password.');}
    else if(b.id==='clogout'){await DB.signOut();clubRender();}
    else if(b.dataset.pc){DB.prof.dati=Object.assign({},DB.prof.dati,{colore:d.pc});document.querySelectorAll('#club [data-pc]').forEach(x=>x.classList.toggle('on',x===b));}
    else if(b.id==='psave')await profSave();
    else if(b.id==='pcol'){const ph=DB.prof.dati||{};if(!ph.bici&&!ph.intera){clubMsg('Carica prima la foto intera o quella della bici.',true);return;}clubMsg('Guardo i colori delle foto…');let n=0;
      if(ph.bici){const c=await domColor(ph.bici,0,.15,1,.95,true);if(c[0]){await DB.saveItem({tipo:'bici',nome:'La mia bici (dalla foto)',dati:{bk:c[0]}});n++;}}
      if(ph.intera){const top=await domColor(ph.intera,.3,.22,.7,.5,true),sh=await domColor(ph.intera,.3,.5,.7,.68,false);const dc=(x,y)=>{const h=v=>[1,3,5].map(i=>parseInt(v.substr(i,2),16));const A=h(x),B=h(y);return Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]);},m2=top.slice(1).find(c=>dc(c,top[0])>150);
        if(top[0]){await DB.saveItem({tipo:'completino',nome:'Completino (dalla foto)',dati:{m1:top[0],m2:m2||'#ffffff',pat:m2?'fascia':'unita',sh:sh[0]||'#1b1b1b'}});n++;}}
      clubMsg(n?`✓ Nel guardaroba trovi ${n===2?'completino e bici':'il nuovo capo'} con i colori delle foto: correggili se serve.`:'Non trovo colori chiari nelle foto.',!n);}
    else if(d.inew){CL.edit={tipo:d.inew,nome:'',dati:{}};tabGua();}
    else if(d.ied){CL.edit=JSON.parse(JSON.stringify(CL.items.find(i=>i.id===d.ied)));tabGua();}
    else if(d.idel){if(confirm('Togliere dal guardaroba?')){await DB.delItem(d.idel);clubRender();}}
    else if(b.id==='icancel'){CL.edit=null;tabGua();}
    else if(b.id==='isave'){CL.edit.nome=$('inome').value.trim();CL.edit.dati=itemKit(CL.edit);await DB.saveItem(CL.edit);CL.edit=null;clubRender();}
    else if(b.id==='ufromapp'){uscForm(riders.map(r=>({r,fname:r.fname||r.name,titolo:$('titolo').value&&!/segmento/i.test($('titolo').value)?$('titolo').value:null})));}
    else if(b.id==='usave'){b.disabled=true;await uscSave();}
    else if(b.id==='stvon')stvConnect();
    else if(b.id==='stvoff'){if(confirm('Scollegare Strava? Le uscite già archiviate restano.')){await stv('disconnect');stvStatus();}}
    else if(b.id==='stvopen'){b.style.display='none';stvList(1);}
    else if(d.stvmore)stvList(+d.stvmore);
    else if(d.sscan){b.disabled=true;await segScan(d.sscan);}
    else if(d.stvimp){b.disabled=true;b.textContent='…';clubMsg('Scarico da Strava traccia e segmenti…');const r=await stvImport(d.stvimp);clubMsg(`✓ «${esc(r.nome)}» archiviata con ${r.seg} segmenti Strava${r.nuovi?` (${r.nuovi} nuovi nel tuo archivio)`:''}. È 🔒 privata.`);clubRender();}
    else if(d.upub)await uscTogglePub(d.upub);
    else if(d.udel){if(confirm('Cancellare questa uscita dall\'archivio? Spariscono anche i suoi passaggi sui segmenti.')){await DB.delUscita(d.udel);CL.sel.delete(d.udel);clubRender();}}
    else if(b.id==='uplay'){const L=[...CL.sel].map(id=>({u:CL.usc.find(x=>x.id===id)})).filter(x=>x.u);const days=new Set(L.map(x=>x.u.data));await clubLoadRiders(L,null,{real:days.size===1});}
    else if(d.sopen){CL.seg=d.sopen;CL.pick=new Set();CL.ref=null;tabSeg();}
    else if(b.id==='sback'){CL.seg=null;tabSeg();}
    else if(d.spub){const g=CL.segs.find(x=>x.id===d.spub);await DB.updSeg(g.id,{pubblico:!g.pubblico});clubRender();}
    else if(d.sdel){if(confirm('Cancellare il segmento e i suoi passaggi?')){await DB.delSeg(d.sdel);clubRender();}}
    else if(d.mode){await segPlay(d.mode==='solo'?'solo':d.mode);}
    else if(d.mapp){await DB.approve(d.mapp,d.si==='1');clubRender();}
  }catch(err){clubMsg(esc(err.message||String(err)),true);}});
window.__CLUB={DB,CL,effOf,decTrack};
