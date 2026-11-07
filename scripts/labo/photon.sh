#!/usr/bin/env bash
# Recherche d'adresses et de lieux (Photon, données OSM) : base toute prête de GraphHopper, servie chez nous.
#   photon.sh telecharger japon   → ~/alpast-data/asie/japon/adresses/photon_data
#   photon.sh telecharger europe  → ~/alpast-data/europe/adresses/photon_data (toute l'Europe, France comprise)
#   photon.sh telecharger monde   → ~/alpast-data/monde/adresses/photon_data (tous les pays)
#   photon.sh demarrer japon 2323 → http://localhost:2323/api?q=kyoto
set -euo pipefail
. "$(dirname "$0")/commun.sh"
VERSION=1.3.0
jar=$DATA/monde/outils/photon-$VERSION.jar

zone() {
  case $1 in
    japon) DOSSIER_ADRESSES=$DATA/asie/japon/adresses; FICHIER=asia/japan/photon-db-japan-1.0-latest.tar.bz2 ;;
    france) DOSSIER_ADRESSES=$DATA/europe/france/adresses; FICHIER=europe/france-monacco/photon-db-france-monacco-1.0-latest.tar.bz2 ;;
    europe) DOSSIER_ADRESSES=$DATA/europe/adresses; FICHIER=europe/photon-db-europe-1.0-latest.tar.bz2 ;;
    # France et voisins (it, es, be, ch, lu, mc, ad, li, sm, va), importée de l'export brut Europe filtré par pays :
    # demarrer seulement (base construite dans le labo, voir README) ; c'est celle du serveur
    voisins) DOSSIER_ADRESSES=$DATA/europe/adresses-voisins; FICHIER= ;;
    # Le monde entier (~63 Go à télécharger, ~150 à 200 Go décompressé) : un seul Photon pour tous les pays
    monde) DOSSIER_ADRESSES=$DATA/monde/adresses; FICHIER=photon-db-planet-1.0-latest.tar.bz2 ;;
    *) echo "Zone inconnue : $1" >&2; exit 1 ;;
  esac
}

case $1 in
  telecharger)
    zone "$2"
    mkdir -p "$(dirname "$jar")" "$DOSSIER_ADRESSES"
    [ -s "$jar" ] || curl -sfSL -o "$jar" "https://github.com/komoot/photon/releases/download/$VERSION/photon-$VERSION.jar"
    cd "$DOSSIER_ADRESSES"
    # L'archive est d'abord enregistrée : le serveur est lent (~0,5 Mo/s), une coupure reprend là où elle s'est arrêtée
    archive=$(basename "$FICHIER")
    url="https://download1.graphhopper.com/public/$FICHIER"
    until curl -fSL -C - --retry 10 --retry-delay 60 --retry-all-errors -o "$archive" "$url"; do
      echo "$(date '+%F %T') téléchargement interrompu, reprise dans 2 min" >&2
      sleep 120
    done
    # Somme de contrôle publiée à côté de l'archive
    if curl -sfL -o "$archive.md5" "$url.md5"; then
      [ "$(cut -d' ' -f1 "$archive.md5")" = "$(md5sum "$archive" | cut -d' ' -f1)" ] \
        || { echo "Archive abîmée (MD5 différent) : supprimer $DOSSIER_ADRESSES/$archive et relancer" >&2; exit 1; }
    fi
    rm -rf photon_data.nouveau && mkdir photon_data.nouveau
    # lbzip2 (s'il est installé) décompresse sur tous les cœurs ; bzip2 sur un seul
    "$(command -v lbzip2 || echo bzip2)" -dc "$archive" | tar -x -C photon_data.nouveau
    rm -rf photon_data && mv photon_data.nouveau/photon_data photon_data && rmdir photon_data.nouveau
    rm -f "$archive" "$archive.md5"
    du -sh photon_data
    ;;
  demarrer)
    zone "$2"
    cd "$DOSSIER_ADRESSES"
    # Labo : ouvert à Windows (WSL ne relaie pas 127.0.0.1) ; serveur : PHOTON_ECOUTE=127.0.0.1 PHOTON_MEMOIRE=2g
    exec java -Xmx"${PHOTON_MEMOIRE:-4g}" -jar "$jar" serve -data-dir "$DOSSIER_ADRESSES" -listen-ip "${PHOTON_ECOUTE:-0.0.0.0}" -listen-port "${3:-2322}" -cors-any
    ;;
  *)
    echo "Usage : photon.sh telecharger|demarrer <zone> [port]" >&2
    exit 1
    ;;
esac
