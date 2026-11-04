#!/usr/bin/env bash
# Réglages partagés des scripts du labo : rangement des données et description de chaque pays.
#   ~/alpast-data/<continent>/<pays>/{source,lieux,fond-de-carte,…}
#   ~/alpast-data/monde/itineraires/  BRouter et sa réserve de tuiles (des carrés de 5° qui chevauchent les frontières)
DATA=~/alpast-data
ITINERAIRES=$DATA/monde/itineraires

# Pour chaque pays : continent, chemin chez Geofabrik, tuiles BRouter qui le couvrent
pays_connu() {
  case $1 in
    france)
      CODE=fr
      CONTINENT=europe
      GEOFABRIK=europe/france
      TUILES_BROUTER="E0_N40 E0_N45 E0_N50 E5_N40 E5_N45 W10_N45 W5_N40 W5_N45"
      ;;
    japon)
      CODE=jp
      CONTINENT=asie
      GEOFABRIK=asia/japan
      TUILES_BROUTER="E125_N25 E125_N30 E130_N30 E130_N35 E135_N30 E135_N35 E140_N35 E140_N40 E140_N45 E145_N40 E145_N45"
      ;;
    *)
      echo "Pays inconnu : $1 (à décrire dans scripts/labo/commun.sh)" >&2
      exit 1
      ;;
  esac
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
