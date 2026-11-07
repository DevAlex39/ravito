#!/usr/bin/env bash
# Envoie sur le VPS les données de pays préparés dans le labo, puis les importe dans la base d'un site.
# À lancer depuis Git Bash sur Windows (clé SSH de Windows ; données lues dans Ubuntu/WSL) :
#   scripts/labo/envoyer-pays.sh <site> <pays>…
#     site : test → ~/alpas-test (base alpas_test) ; prod → /var/www/alpas
#   Exemple : scripts/labo/envoyer-pays.sh test italie espagne reunion
# Pour chaque pays : fond de carte, miniatures des fiches, lieux candidats et contour → ~/alpas-data/donnees ;
# tuiles BRouter manquantes → ~/alpas-data/brouter/segments4 ; puis import:lieux, import:wikidata (si le pays en a),
# et fiches:charger (fiches exportées du labo, pour ne pas tout redemander à Wikipédia).
# Rien n'est envoyé deux fois : tar ne recopie pas, il remplace (relancer après une coupure est sans risque).
# Penser ensuite à ajouter les fonds dans VITE_CARTE_FONDS (.env du site) et à reconstruire le site.
set -euo pipefail
export MSYS_NO_PATHCONV=1
site=${1:?site : test ou prod}; shift
[ $# -gt 0 ] || { echo "Pays manquants" >&2; exit 1; }
case $site in
  test) app='~/alpas-test' ;;
  prod) app=/var/www/alpas ;;
  *) echo "Site inconnu : $site (test ou prod)" >&2; exit 1 ;;
esac
VPS=alexis@213.32.69.211
depot=$(cd "$(dirname "$0")/../.." && pwd)
labo='/mnt/d/Perso/Site web/Ravito/scripts/labo'

# Description des pays depuis config/pays.json : dossier code continent nom-geofabrik wikidata
infos=$(cd "$depot" && node -e "
  const all = require('./config/pays.json').pays
  for (const d of process.argv.slice(1)) {
    const p = all.find(p => p.dossier === d)
    if (!p) { console.error('Pays inconnu : ' + d); process.exit(1) }
    console.log([p.dossier, p.code, p.continent, p.geofabrik.split('/').pop(), p.wikidata ? 'oui' : 'non'].join(' '))
  }" "$@")

echo "== Fiches exportées du labo"
fiches=$(mktemp -u -t fiches-XXXX).jsonl.gz
# Node (Windows) veut un chemin Windows, scp le chemin Git Bash
(cd "$depot" && node ace fiches:exporter "$(cygpath -w "$fiches")" "$@" | tail -1)
scp -q "$fiches" "$VPS:alpas-data/fiches-envoi.jsonl.gz"
rm -f "$fiches"

# La liste passe par le descripteur 3 : ssh et wsl lisent l'entrée standard et la videraient
while read -r -u 3 dossier code continent base wikidata; do
  rel=$continent/$dossier
  echo "== $dossier : fichiers"
  # Déjà envoyés (pour l'autre site, les données sont communes) : même taille de fond de carte et de lieux
  ici=$(wsl -d Ubuntu --exec bash -c "cd ~/alpast-data/$rel && stat -c %s fond-de-carte/$dossier.pmtiles lieux/$dossier-lieux.geojsonseq 2>/dev/null" | tr '\n' ' ' || true)
  la_bas=$(ssh "$VPS" "cd ~/alpas-data/donnees/$rel 2>/dev/null && stat -c %s fond-de-carte/$dossier.pmtiles lieux/$dossier-lieux.geojsonseq 2>/dev/null" | tr '\n' ' ' || true)
  if [ -n "$ici" ] && [ "$ici" = "$la_bas" ]; then
    echo "   déjà sur le serveur"
  else
    wsl -d Ubuntu --exec tar -C /home/alexis/alpast-data -cf - \
        "$rel/fond-de-carte/$dossier.pmtiles" "$rel/fiches/photos" "$rel/lieux/$dossier-lieux.geojsonseq" "$rel/source/$base.poly" \
      | ssh "$VPS" 'tar -xf - -C ~/alpas-data/donnees'
  fi

  echo "== $dossier : tuiles d'itinéraires"
  tuiles=$(wsl -d Ubuntu --exec bash -c ". '$labo/commun.sh'; tuiles_brouter \"\$DATA/$rel/source/$base.poly\"")
  manquantes=$(ssh "$VPS" "cd ~/alpas-data/brouter/segments4 && for t in $(echo $tuiles); do [ -s \$t.rd5 ] || echo \$t.rd5; done")
  if [ -n "$manquantes" ]; then
    echo "   $(echo $manquantes)"
    # Les carrés tout en mer n'existent pas : on n'envoie que ceux présents dans la réserve du labo
    wsl -d Ubuntu --exec bash -c "cd ~/alpast-data/monde/itineraires/segments4 && ls $(echo $manquantes) 2>/dev/null | tar -cf - -T -" \
      | ssh "$VPS" 'tar -xf - -C ~/alpas-data/brouter/segments4'
  fi

  echo "== $dossier : import des lieux ($site)"
  ssh "$VPS" "source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && cd $app/build && \
    nice node ace import:lieux ~/alpas-data/donnees/$rel/lieux/$dossier-lieux.geojsonseq ~/alpas-data/donnees/$rel/source/$base.poly --pays=$code 2>&1 | tail -3 && \
    if [ $wikidata = oui ]; then nice node ace import:wikidata --pays=$dossier 2>&1 | tail -2; fi"
done 3<<< "$infos"

echo "== Fiches ($site)"
ssh "$VPS" "source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && cd $app/build && node ace fiches:charger ~/alpas-data/fiches-envoi.jsonl.gz 2>&1 | tail -1"
ssh "$VPS" 'df -h / | tail -1'
echo "Fini. Fonds à ajouter dans VITE_CARTE_FONDS : $(echo "$infos" | cut -d' ' -f1 | tr '\n' ',' | sed 's/,$//')"
