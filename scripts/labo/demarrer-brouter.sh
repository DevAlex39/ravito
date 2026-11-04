#!/usr/bin/env bash
# Depuis PowerShell : wsl -d Ubuntu --exec bash "/mnt/d/Perso/Site web/Ravito/scripts/labo/demarrer-brouter.sh"
# BRouter du labo : même lancement que ~/alpas-data/brouter/start.sh sur le serveur, profil alpas lu dans le dépôt
set -euo pipefail
. "$(dirname "$0")/commun.sh"
app=$ITINERAIRES/app/brouter-1.7.10
ln -sf "$(cd "$(dirname "$0")/../.." && pwd)/brouter/alpas.brf" "$app/profiles2/alpas.brf"
cd "$app"
# 0.0.0.0 (et non 127.0.0.1 comme sur le serveur) : WSL ne relaie vers Windows que ce qui écoute sur toutes les adresses
exec java -Xmx2g -Xms128m -Xss16m -cp brouter-1.7.10-all.jar btools.server.RouteServer \
  "$ITINERAIRES/segments4" "$app/profiles2" "$ITINERAIRES/customprofiles" 17777 4 0.0.0.0
