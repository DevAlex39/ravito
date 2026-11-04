#!/usr/bin/env bash
# Données du Japon pour le labo : tuiles BRouter + extrait OSM Geofabrik
set -euo pipefail
mkdir -p ~/alpast-data/brouter/segments4 ~/alpast-data/osm
cd ~/alpast-data/brouter/segments4
for t in E125_N25 E125_N30 E130_N30 E130_N35 E135_N30 E135_N35 E140_N35 E140_N40 E140_N45 E145_N40 E145_N45; do
  curl -sfS -o "$t.rd5" "https://brouter.de/brouter/segments4/$t.rd5"
done
echo "Tuiles : $(ls | wc -l), $(du -sh . | cut -f1)"
cd ~/alpast-data/osm
curl -sfS -O https://download.geofabrik.de/asia/japan.poly
# Geofabrik redirige vers le fichier daté du jour : -L obligatoire
curl -sfSL -o japan-latest.osm.pbf https://download.geofabrik.de/asia/japan-latest.osm.pbf
ls -la
osmium fileinfo -e japan-latest.osm.pbf | grep -E "Timestamp|Number of (nodes|ways)" | head -4
