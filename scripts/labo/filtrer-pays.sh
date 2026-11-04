#!/usr/bin/env bash
# Extrait les lieux candidats d'un pays (mêmes critères que scripts/mise-a-jour-lieux.sh pour la France)
#   filtrer-pays.sh japan  →  ~/alpast-data/osm/japan-lieux.geojsonseq
set -euo pipefail
pays=$1
cd ~/alpast-data/osm
time nice osmium tags-filter "$pays-latest.osm.pbf" \
  nwr/tourism=attraction,viewpoint,museum,gallery,artwork \
  nwr/historic \
  nwr/heritage \
  nwr/ref:mhs \
  nwr/amenity=place_of_worship,fountain,lavoir,drinking_water,toilets \
  nwr/drinking_water=yes \
  nwr/leisure=park,garden \
  nwr/man_made=tower,lighthouse,bridge \
  nwr/place=square \
  nwr/natural=waterfall,cave_entrance,peak,arch,gorge,volcano,spring,rock,stone,cliff,beach,saddle \
  nwr/waterway=waterfall \
  -o "$pays-lieux.osm.pbf" --overwrite
time nice osmium export "$pays-lieux.osm.pbf" -f geojsonseq -x print_record_separator=false -a type,id -o "$pays-lieux.geojsonseq" --overwrite
ls -la "$pays"-lieux.*
wc -l < "$pays-lieux.geojsonseq"
