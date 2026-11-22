# La banda in bici — istruzioni per Claude

Sito statico su GitHub Pages: https://studiobilancio2025-code.github.io/banda-in-bici/
Proprietario: Geppino (Giovangiuseppe Bilancio). Parlagli sempre in italiano, in modo semplice: non è uno sviluppatore.

## Cosa c'è
- `index.html` — scena 3D "La salita dei Prof." (segmento Strava del 22/09/2026), con foto satellitare. File unico con dati e immagini incorporati (~9 MB).
- `cave.html` — salita delle Cave con la "banda" (corsa con copione scritto a mano, non dati veri degli amici).
- `varcaturo.html` — tratto Varcaturo – Lago Patria.
- `crea.html` — **l'app**: costruisce da sola la scena 3D partendo da più file GPX. È generata da `app/crea_src.html` con `python3 app/build.py` (inserisce il CSS di Leaflet). Modifica sempre `app/crea_src.html`, poi rigenera `crea.html`.

## Come funziona crea.html
1. **GPX**: si caricano più file (uno per ciclista). I file arrivano quasi sempre dall'app Android "Esporta GPX per Strava": tempi **relativi** (anno 1970, e il primo punto può non essere a 0), niente battiti/cadenza/watt, a volte pause senza punti. Se un GPX ha ora vera o estensioni (hr, cad, power) vengono usate.
2. **Sincronizzazione**: il primo file è l'orologio di riferimento. Per gli altri si cerca lo spostamento `off` (t_rif = t_ciclista + off) che massimizza i secondi in cui le tracce distano < 12 m, contando **solo i secondi in movimento** (nelle soste qualunque spostamento sembrerebbe giusto). Ricerca a 10 s su ±90 min, poi al secondo. Chi non ha mai pedalato col primo diventa "fantasma": parte con lui all'inizio del tratto (`gshift`).
   - Verifica di riferimento: Geppino 21067817870 + Mario 21067822670 (21/11/2026) → off Mario ≈ −1685 s nel sistema dell'app (−1829 s se si contano i 144 s iniziali del file di Mario), insieme ~84 min; sul segmento "Le Cave" Geppino 14'19", Mario 19'17", Mario +4'59" in cima.
3. **Tratto**: se il primo GPX contiene i segmenti Strava (elemento `bb:segmento` in `metadata/extensions`, scritto da Claude quando prepara il GPX completo di Geppino dal suo Strava), compare l'elenco: un tocco sceglie partenza e arrivo. Altrimenti mappa Leaflet con foto Esri, si tocca partenza e arrivo; passaggi di ciascuno al punto più vicino (< 40 m).
4. **Scena**: percorso = traccia del riferimento da 150 m prima a 200 m dopo, agganciata alle strade OSM (< 14 m). Dal browser: OpenStreetMap API (`api.openstreetmap.org/api/0.6/map`, CORS ok, se 400 divide il riquadro in 4) e tile Esri World Imagery (CORS ok) zoom 17 (±380 m) e 18 (±120 m). Dai pixel delle foto: colore dei tetti (mediana dentro la pianta) e alberi (indice verde 2G−R−B > 14) su griglia da 5 m. Ogni ciclista è proiettato sul percorso secondo per secondo; in corsia si mettono in fila o a coppie quando sono vicini.
5. **Visuali**: Regia automatica (predefinita: cambia inquadratura ogni 6-11 s scegliendo tra moto, lato, droni, elicottero, panoramica che gira attorno, zoom, telecamera a bordo strada con zoom ottico, gru che scende, tutti dall'alto; soggetto automatico = chi è in testa o chi insegue da vicino, oppure quello scelto in "Inquadra"), Dalla moto, Di lato, Drone dietro, Drone davanti, Elicottero, **Tutti dall'alto** (elicottero che si alza quanto serve per tenere tutti nell'inquadratura, guardando dall'ultimo verso il primo; sulle etichette distacco dal primo "+0'12"", il primo ha "1°"), Libera; "Inquadra" sceglie il ciclista. Velocità ×1…×20. Barra del tempo con −10"/+10" per andare avanti e indietro (funzione `seek`). Classifica dal vivo con distacchi in tempo.
6. **Volti e morfotipo**: altezza (bassa/media/alta) scala tutto il ciclista con la bici; fisico (magro/normale/robusto/grasso) ingrossa busto, braccia e gambe, il grasso ha la pancia. foto caricata per ciascun ciclista → ritaglio quadrato 256 px → disco col volto sulla testa (testa un po' più grande).
7. **La banda (ciclisti salvati)**: nome, colore, volto, altezza e fisico si salvano una volta sola nel `localStorage` del telefono (chiave `banda.ciclisti`). Caricando un GPX, se il nome del file contiene il nome di un ciclista salvato, la scheda si compila da sola; altrimenti c'è il menu "Chi è?". Si salva **solo col pulsante "Salva … nella banda"** sotto ogni ciclista (niente salvataggio automatico, che dava problemi): salva col nome scritto, se il nome esiste già lo aggiorna; dopo una modifica compare "modifiche non salvate". "Esporta la banda"/"Importa" (file JSON) per passarla su un altro telefono.
8. **Salva scena**: crea un HTML unico con i dati (solo la finestra del tratto ± 4 min) in `<script id="scena" type="application/json">`; aprendolo la scena si costruisce da sola (mappe e foto scaricate al momento). Su Android usa la condivisione (WhatsApp), altrimenti scarica il file.

9. **Tratti salvati**: "Salva il tratto" (sotto la classifica) o "Salva tratto" (nella scena) mette nel `localStorage` (chiave `banda.tratti`) gli stessi dati di "Salva scena" (titolo, A, B, ciclisti con punti del tratto ± 4 min, `off`, `t0`). In cima alla pagina compare "Tratti salvati": "apri" ricarica tutto (`loadData`, condivisa col file di scena salvata) e si possono aggiungere altri GPX, che si sincronizzano col primo. Attenzione: dopo l'apertura il primo ha `off` ≠ 0, quindi in `syncRider` la ricerca va su ±90 min **dell'orologio di riferimento** (`lo=-5400-riders[0].off`) e l'off trovato si somma a `riders[0].off`. Verificato: tratto Le Cave salvato con solo Geppino, riaperto, aggiunto Mario → off −1687, Mario +4'57". Anche nella scena salvata in un file "Modifica" ora funziona (si può aggiungere gente).
10. **Telecronaca** (pulsante 🎙️, attiva di serie): frasi in italiano generate dagli eventi (`crUpdate`, chiamata a ogni frame se non in pausa) lette con la sintesi vocale del telefono (`speechSynthesis`, voce it-IT) e scritte nel riquadro `#cron` in alto a sinistra. Eventi: via, partenze in ritardo, sorpassi (≥ 4 m, così chi è affiancato non conta), distacchi ogni 35-55 s di corsa (insieme / allunga / rientra / stabile, più l'ultimo se sono 3+), mancano 2 km/1 km/500/200 m, pendenza > 6,5 %, velocità > 41 km/h, watt > 430, arrivi con tempi e distacchi. Priorità 2 interrompe la voce, priorità 1 si salta se sta parlando o se sono passati < 5 s reali. Tempi detti a parole (`dS`: "2 minuti e 19 secondi"). `crReset(t)` dopo seek/ricomincia segna come già detti gli eventi passati.

## GPX completi di Geppino (preparati da Claude)
Geppino chiede "scarica da Strava l'uscita di oggi": con il connettore Strava si prendono gli stream (time, location, altitude, heart_rate, cadence, watts, distance) e l'elenco dei segmenti; per ogni segmento si trova inizio/fine nella traccia confrontando durata, distanza, battiti e watt medi; si scrive un GPX con ora vera (UTC), estensioni hr/cad/power e i segmenti. Nome file: `geppino_AAAA-MM-GG_completo.gpx`.

## Regole importanti
- **Mai** mettere file GPX/FIT/TCX nel repository (è pubblico e i file contengono la casa dei ciclisti): c'è `.gitignore`. I file di prova vanno caricati nella sessione.
- Pubblicare dati di altri ciclisti solo col loro consenso (Geppino lo chiede su WhatsApp).
- Strava: non usare l'API per mostrare a Geppino i dati di altri (regole Strava dal 2024). I file li esportano gli amici o li scarica Geppino con l'app.
- three.js **0.147.0** da jsdelivr: `examples/js/` (OrbitControls) non esiste dalla 0.148. In 0.147 `InstancedMesh` non calcola il proprio boundingSphere: impostarlo a mano sulla geometria clonata (vedi alberi), altrimenti sparisce.
- Pedali in avanti: piede a `(x, .3−cos a·.17, −sin a·.17)`, pedivella `rotation.x = a + π/2`.
- Strisce (strip) con offset crescenti, altrimenti le facce guardano in basso.
- Fonti da citare sempre: "© OpenStreetMap · Esri, Maxar, Earthstar Geographics".
- Overpass API e altimetria Esri non sono utilizzabili (bloccata / valori sbagliati): il terreno segue la quota della traccia.

## Da fare / idee
- Mini-altimetria con pallino; fantasma del miglior tempo; luce all'ora vera dell'uscita.
- Modalità leggera automatica sui telefoni lenti (meno alberi, ombre ridotte).
- Pagina indice con l'elenco delle scene.
- Gestione di uscite lunghe (> 8 km di tratto): limitare tile e alberi.
- Caricamento diretto delle scene salvate nel repository (oggi: Geppino manda il file e lo si carica a mano).
