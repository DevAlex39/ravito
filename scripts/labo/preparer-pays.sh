#!/usr/bin/env bash
# Prépare les lieux et les itinéraires d'un pays :
#   carte OSM et contour (Geofabrik) → source/, tuiles BRouter manquantes → monde/itineraires/segments4/,
#   lieux candidats (mêmes critères que scripts/mise-a-jour-lieux.sh) → lieux/<pays>-lieux.geojsonseq
#   preparer-pays.sh japon
set -euo pipefail
. "$(dirname "$0")/commun.sh"
pays_connu "$1"
mkdir -p "$SOURCE" "$DOSSIER/lieux" "$ITINERAIRES/segments4"

contour >/dev/null
# Geofabrik redirige vers le fichier daté du jour : -L obligatoire ; -z : seulement s'il y a plus récent
curl -sfSL -z "$SOURCE/$BASE-latest.osm.pbf" -o "$SOURCE/$BASE-latest.osm.pbf" "https://download.geofabrik.de/$GEOFABRIK-latest.osm.pbf"

for t in $TUILES_BROUTER; do
  [ -s "$ITINERAIRES/segments4/$t.rd5" ] || curl -sfSL -o "$ITINERAIRES/segments4/$t.rd5" "https://brouter.de/brouter/segments4/$t.rd5"
done

cd "$DOSSIER/lieux"
nice osmium tags-filter "$SOURCE/$BASE-latest.osm.pbf" \
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
  -o "$PAYS-lieux.osm.pbf" --overwrite
nice osmium export "$PAYS-lieux.osm.pbf" -f geojsonseq -x print_record_separator=false -a type,id -o "$PAYS-lieux.geojsonseq" --overwrite
echo "$(wc -l < "$PAYS-lieux.geojsonseq") lieux candidats dans $DOSSIER/lieux/$PAYS-lieux.geojsonseq"
echo "Import (depuis Windows, à la racine du projet) :"
windows() { local p="\\\\wsl.localhost\\Ubuntu$1"; echo "${p//\//\\}"; }
echo "  node ace import:lieux \"$(windows "$DOSSIER/lieux/$PAYS-lieux.geojsonseq")\" \"$(windows "$SOURCE/$BASE.poly")\" --pays=$CODE"
