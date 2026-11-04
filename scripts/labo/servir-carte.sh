#!/usr/bin/env bash
# Sert les données du labo (dont les fonds de carte .pmtiles, avec les requêtes partielles qu'ils exigent)
# et la page de démo → http://localhost:8090/demo/
set -euo pipefail
. "$(dirname "$0")/commun.sh"
mkdir -p "$DATA/demo"
ln -sf "$(cd "$(dirname "$0")" && pwd)/carte-demo/index.html" "$DATA/demo/index.html"
set +u; source ~/.nvm/nvm.sh >/dev/null; set -u
exec npx --yes http-server@14.1.1 "$DATA" -p 8090 -a 0.0.0.0 -c-1 --cors
