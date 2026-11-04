#!/usr/bin/env bash
# BRouter du labo, identique au serveur (1.7.10, profil alpas du dépôt) ; les tuiles viennent avec preparer-pays.sh
set -euo pipefail
. "$(dirname "$0")/commun.sh"
mkdir -p "$ITINERAIRES/app" "$ITINERAIRES/segments4" "$ITINERAIRES/customprofiles"
cd "$ITINERAIRES"
curl -sfSL -o brouter-1.7.10.zip https://github.com/abrensch/brouter/releases/download/v1.7.10/brouter-1.7.10.zip
unzip -oq brouter-1.7.10.zip -d app
ls app
