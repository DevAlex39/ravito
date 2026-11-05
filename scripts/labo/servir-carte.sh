#!/usr/bin/env bash
# Sert les données du labo (dont les fonds de carte .pmtiles, avec les requêtes partielles qu'ils exigent)
# avec les polices et icônes de la carte, et la page de démo → http://localhost:8090/demo/
# Le site local s'en sert si .env contient VITE_CARTE_URL=http://localhost:8090
set -euo pipefail
. "$(dirname "$0")/commun.sh"
mkdir -p "$DATA/demo"
ln -sf "$(cd "$(dirname "$0")" && pwd)/carte-demo/index.html" "$DATA/demo/index.html"
# Polices et icônes du fond de carte (Protomaps basemaps-assets, ~14 Mo), une seule fois
if [ ! -d "$DATA/monde/carte-assets/fonts" ]; then
  mkdir -p "$DATA/monde/carte-assets"
  curl -sL https://codeload.github.com/protomaps/basemaps-assets/tar.gz/refs/heads/main \
    | tar xz -C "$DATA/monde/carte-assets" --strip-components=1 basemaps-assets-main/fonts basemaps-assets-main/sprites/v4
fi
set +u; source ~/.nvm/nvm.sh >/dev/null; set -u
exec npx --yes http-server@14.1.1 "$DATA" -p 8090 -a 0.0.0.0 -c-1 --cors
