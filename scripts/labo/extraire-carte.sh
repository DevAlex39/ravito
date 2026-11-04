#!/usr/bin/env bash
# Fond de carte d'un pays : découpe la dernière carte mondiale Protomaps (tuiles vectorielles, données OSM)
# selon le contour du pays. Seuls les morceaux utiles sont téléchargés, pas les ~140 Go du monde.
#   extraire-carte.sh france  →  ~/alpast-data/europe/france/fond-de-carte/france.pmtiles
#   extraire-carte.sh europe  →  ~/alpast-data/europe/fond-de-carte/europe.pmtiles (tout le continent d'un coup)
set -euo pipefail
. "$(dirname "$0")/commun.sh"
if [ "$1" = europe ]; then
  PAYS=europe GEOFABRIK=europe BASE=europe DOSSIER=$DATA/europe SOURCE=$DATA/europe/source
else
  pays_connu "$1"
fi
outil=$DATA/monde/outils/pmtiles
if [ ! -x "$outil" ]; then
  mkdir -p "$(dirname "$outil")"
  curl -sfSL https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles_1.31.2_Linux_x86_64.tar.gz \
    | tar -xz -C "$(dirname "$outil")" pmtiles
fi

poly=$(contour)
mkdir -p "$DOSSIER/fond-de-carte"
cd "$DOSSIER/fond-de-carte"

# Contour .poly → GeoJSON (anneaux extérieurs seulement ; les trous « !… » sont ignorés, comme dans import:lieux)
awk 'NR == 1 { next }
  /^END/ { if (ring != "") { if (!skip) out = out (out == "" ? "" : ",") "[[" ring "]]"; ring = ""; inring = 0 } next }
  !inring { inring = 1; skip = ($1 ~ /^!/); ring = ""; next }
  { ring = ring (ring == "" ? "" : ",") "[" $1 "," $2 "]" }
  END { printf "{\"type\":\"MultiPolygon\",\"coordinates\":[%s]}\n", out }' "$poly" > "$PAYS.geojson"

build=$(curl -sfS https://build-metadata.protomaps.dev/builds.json | grep -oE '"[0-9]{8}\.pmtiles"' | tail -1 | tr -d '"')
echo "Carte mondiale du ${build%.pmtiles} → $PAYS.pmtiles"
time "$outil" extract "https://build.protomaps.com/$build" "$PAYS.pmtiles" --region="$PAYS.geojson" --download-threads=8
echo "${build%.pmtiles}" > SOURCE-DATE
"$outil" show "$PAYS.pmtiles" | grep -E "bounds|zoom|tile type" || true
ls -la "$PAYS.pmtiles"
