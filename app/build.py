# Costruisce crea.html (nella radice) da app/crea_src.html inserendo il CSS di Leaflet.
import pathlib
here=pathlib.Path(__file__).parent
src=(here/'crea_src.html').read_text()
(here.parent/'crea.html').write_text(src.replace('/*LEAFLETCSS*/',(here/'leaflet.css').read_text()).replace('/*CLUB*/',(here/'club_src.js').read_text()))
print('crea.html aggiornato')
