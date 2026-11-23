# Aggiorna le pagine in scene/ con l'ultima versione di crea.html, tenendo i loro dati.
# I dati sono il <script id="scena|sintesi|descrizione"> messo SUBITO dopo il primo <body>.
# Uso: python3 app/aggiorna_scene.py            (tutte)
#      python3 app/aggiorna_scene.py --da COMMIT scene/x.html   (riprende i dati da una versione vecchia)
import pathlib, re, subprocess, sys
root = pathlib.Path(__file__).parent.parent
app = (root / 'crea.html').read_text()
TAG = re.compile(r'<script id="(scena|sintesi|descrizione)" type="application/json">')

def dati(html):
    k = html.index('<body>') + 6
    m = TAG.match(html, k)
    if not m: return None
    e = html.index('</script>', m.end())
    return html[k:e + 9]

def scrivi(path, blocco):
    k = app.index('<body>') + 6
    out = app[:k] + blocco + app[k:]
    assert dati(out) == blocco
    path.write_text(out)
    print('aggiornato', path.relative_to(root), len(blocco) // 1024, 'KB di dati')

args = sys.argv[1:]
if args[:1] == ['--da']:
    commit, files = args[1], args[2:]
    for f in files:
        b = dati(subprocess.run(['git', 'show', f'{commit}:{f}'], cwd=root, capture_output=True, text=True, check=True).stdout)
        if not b: sys.exit(f'{f}: nessun dato nella versione {commit}')
        scrivi(root / f, b)
else:
    for p in sorted((root / 'scene').glob('*.html')):
        h = p.read_text()
        if 'id="setup"' not in h: continue          # pagine statiche (elenco, percorsi fatti a mano)
        b = dati(h)
        if not b: print('!! SENZA DATI, non tocco:', p.relative_to(root)); continue
        scrivi(p, b)
