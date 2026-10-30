#!/bin/bash
# Mise à jour mensuelle des lieux à voir d'AlpaS (lancée par cron, journal : ~/alpas-data/mise-a-jour.log)
#   1. retélécharge la carte de France si Geofabrik en a une plus récente
#   2. en extrait les lieux candidats (patrimoine + nature) ; le tri fin est fait par l'import (poi_service.ts)
#   3. les importe en base : notoriété Wikidata des seuls nouveaux lieux, suppression des lieux disparus
# Sur le serveur, ~/alpas-data/mise-a-jour.sh est un lien vers ce fichier.
set -euo pipefail
cd ~/alpas-data
echo "=== $(date "+%Y-%m-%d %H:%M") début"

curl -sSL -z france-latest.osm.pbf -o france-latest.osm.pbf https://download.geofabrik.de/europe/france-latest.osm.pbf
curl -sSL -o france.poly https://download.geofabrik.de/europe/france.poly
ls -l --time-style=+%Y-%m-%d france-latest.osm.pbf

nice osmium tags-filter france-latest.osm.pbf \
  nwr/tourism=attraction,viewpoint,museum,gallery,artwork \
  nwr/historic \
  nwr/heritage \
  nwr/ref:mhs \
  nwr/amenity=place_of_worship,fountain,lavoir \
  nwr/leisure=park,garden \
  nwr/man_made=tower,lighthouse,bridge \
  nwr/place=square \
  nwr/natural=waterfall,cave_entrance,peak,arch,gorge,volcano,spring,rock,stone,cliff,beach,saddle \
  nwr/waterway=waterfall \
  -o lieux.osm.pbf --overwrite
nice osmium export lieux.osm.pbf -f geojsonseq -x print_record_separator=false -a type,id -o lieux.geojsonseq --overwrite

set +u  # nvm utilise des variables non définies
source ~/.nvm/nvm.sh >/dev/null
nvm use 24 >/dev/null
set -u
cd /var/www/alpas/build
nice node ace import:lieux ~/alpas-data/lieux.geojsonseq ~/alpas-data/france.poly "$@"
echo "=== $(date "+%Y-%m-%d %H:%M") fin"
