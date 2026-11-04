#!/usr/bin/env bash
# BRouter du labo, identique au serveur (1.7.10, profil alpas du dépôt) + tuiles France
set -euo pipefail
b=~/alpast-data/brouter
mkdir -p "$b/app" "$b/segments4" "$b/customprofiles"
cd "$b"
curl -sfSL -o brouter-1.7.10.zip https://github.com/abrensch/brouter/releases/download/v1.7.10/brouter-1.7.10.zip
unzip -oq brouter-1.7.10.zip -d app
ls app
cd segments4
for t in E0_N40 E0_N45 E0_N50 E5_N40 E5_N45 W10_N45 W5_N40 W5_N45; do
  curl -sfSL -o "$t.rd5" "https://brouter.de/brouter/segments4/$t.rd5"
done
echo "Tuiles : $(ls | wc -l), $(du -sh . | cut -f1)"
