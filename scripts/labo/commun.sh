#!/usr/bin/env bash
# Réglages partagés des scripts du labo : rangement des données et description de chaque pays.
#   ~/alpast-data/<continent>/<pays>/{source,lieux,fond-de-carte,fiches,adresses}
#   ~/alpast-data/monde/itineraires/  BRouter et sa réserve de tuiles (des carrés de 5° qui chevauchent les frontières)
# Les pays sont décrits dans config/pays.json (lu aussi par les imports du site).
# Sur le serveur : ALPAST_DATA=~/alpas-data/donnees
DATA=${ALPAST_DATA:-$HOME/alpast-data}
ITINERAIRES=$DATA/monde/itineraires
DEPOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

set +u; source ~/.nvm/nvm.sh >/dev/null; set -u

# Liste des pays (noms de dossier), dans l'ordre du fichier
tous_les_pays() {
  node -e "for (const p of require(process.argv[1]).pays) console.log(p.dossier)" "$DEPOT/config/pays.json"
}

# Charge la description d'un pays : PAYS, CODE, CONTINENT, GEOFABRIK, DOSSIER, SOURCE, BASE
pays_connu() {
  local champs
  champs=$(node -e "
    const p = require(process.argv[1]).pays.find(p => p.dossier === process.argv[2])
    if (!p) process.exit(1)
    console.log([p.code, p.continent, p.geofabrik].join(' '))" "$DEPOT/config/pays.json" "$1") \
    || { echo "Pays inconnu : $1 (voir config/pays.json)" >&2; exit 1; }
  read -r CODE CONTINENT GEOFABRIK <<< "$champs"
  PAYS=$1
  DOSSIER=$DATA/$CONTINENT/$PAYS
  SOURCE=$DOSSIER/source
  # Nom des fichiers Geofabrik : « japan » pour asia/japan
  BASE=${GEOFABRIK##*/}
}

# Contour .poly de Geofabrik, téléchargé s'il manque
contour() {
  mkdir -p "$SOURCE"
  [ -s "$SOURCE/$BASE.poly" ] || curl -sfSL -o "$SOURCE/$BASE.poly" "https://download.geofabrik.de/$GEOFABRIK.poly"
  echo "$SOURCE/$BASE.poly"
}

# Tuiles BRouter (carrés de 5°, nommés par leur coin sud-ouest : E5_N45, W10_N35) qui recouvrent le contour
tuiles_brouter() {
  awk 'NR > 1 && NF == 2 && $1 !~ /^!/ { x = $1 + 0; y = $2 + 0
         if (!n++) { x0 = x1 = x; y0 = y1 = y }
         if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
       function f(v) { return v >= 0 ? int(v / 5) * 5 : -int((-v + 4.999999) / 5) * 5 }
       END { for (x = f(x0); x <= f(x1); x += 5) for (y = f(y0); y <= f(y1); y += 5)
               printf "%s%d_%s%d\n", x < 0 ? "W" : "E", x < 0 ? -x : x, y < 0 ? "S" : "N", y < 0 ? -y : y }' "$1"
}
