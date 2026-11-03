#!/usr/bin/env bash
# Sauvegarde nocturne de TOUS les sites du VPS (remplace sauvegarde-base.sh, qui ne gardait qu'Alpast).
# Cron (utilisateur alexis, sans sudo) :
#   30 2 * * * /var/www/alpas/scripts/sauvegarde-vps.sh >> $HOME/sauvegardes/sauvegarde.log 2>&1
#
# ~/sauvegardes/AAAA-MM-JJ/ : bases MySQL (Alpast, Arcade Zone, XENOGRAFT) + bases SQLite (Ormois, téléchargement)
#   + statistiques du portfolio + photos du site Ormois. Gardé 14 jours.
# ~/sauvegardes/fichiers-telechargement.tar : les fichiers proposés au téléchargement (gros, changent rarement) :
#   un seul exemplaire, refait chaque dimanche.
# Une copie hors du VPS est récupérée par le PC d'Alexis (voir scripts/recuperer-sauvegardes.ps1).
# Les .env (mots de passe, clés) ne sont PAS copiés : à recréer à la main en cas de perte du serveur.
set -euo pipefail
umask 077
root=~/sauvegardes
dir="$root/$(date +%F)"
mkdir -p "$dir"

# Valeur d'une clé d'un .env, sans l'afficher
get() { grep -E "^$2=" "$1" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }

# Base MySQL d'un site : dump compressé (identifiants lus dans son .env, passés par un fichier temporaire)
dump() {
  local name=$1 env=$2 dbkey=$3
  shift 3
  local db cnf ignore=()
  db=$(get "$env" "$dbkey")
  cnf=$(mktemp)
  printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword="%s"\n' \
    "$(get "$env" DB_HOST)" "$(get "$env" DB_PORT)" "$(get "$env" DB_USER)" "$(get "$env" DB_PASSWORD)" > "$cnf"
  for t in "$@"; do ignore+=("--ignore-table=$db.$t"); done
  mysqldump --defaults-extra-file="$cnf" --single-transaction --no-tablespaces "${ignore[@]}" "$db" | gzip > "$dir/$name.sql.gz.tmp"
  rm -f "$cnf"
  mv "$dir/$name.sql.gz.tmp" "$dir/$name.sql.gz"
}

# Alpast : sans les lieux et équipements (réimportés chaque mois depuis OpenStreetMap) ni les compteurs anti-abus
dump alpas /var/www/alpas/.env DB_DATABASE pois poi_cells amenities rate_limits
dump arcade /var/www/arcade/.env DB_NAME
dump xenograft /var/www/xenograft/.env DB_NAME

# SQLite : petites bases rarement modifiées, une copie de fichier suffit
cp /var/www/lafermedelormois/data/ormois.db "$dir/ormois.db"
cp /var/www/telechargement/data/telechargement.db "$dir/telechargement.db"
tar -czf "$dir/ormois-photos.tar.gz" -C /var/www/lafermedelormois/public uploads
tar -czf "$dir/portfolio-stats.tar.gz" -C /var/www/portfolio data

# Fichiers du site de téléchargement : chaque dimanche, ou s'il n'y en a pas encore
if [ "$(date +%u)" = 7 ] || [ ! -f "$root/fichiers-telechargement.tar" ]; then
  tar -cf "$root/fichiers-telechargement.tar.tmp" -C /var/www/telechargement/data uploads
  mv "$root/fichiers-telechargement.tar.tmp" "$root/fichiers-telechargement.tar"
fi

find "$root" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +13 -exec rm -rf {} +
echo "$(date "+%Y-%m-%d %H:%M") $(basename "$dir") $(du -sh "$dir" | cut -f1)"
