#!/bin/bash
# Sauvegarde nocturne de la base d'Alpast (lancée par cron, journal : ~/alpas-backups/sauvegarde.log)
#   - comptes, parcours, partages et votes : tout ce qui ne se retrouve pas ailleurs ;
#   - sans les lieux, points d'eau et secteurs (refaits par l'import mensuel) ni les compteurs anti-abus ;
#   - 7 jours d'historique dans ~/alpas-backups.
# Restaurer : gunzip -c ~/alpas-backups/alpas-AAAA-MM-JJ.sql.gz | mysql <base>
set -euo pipefail
dir=~/alpas-backups
mkdir -p "$dir"
chmod 700 "$dir"

# Identifiants lus dans le .env de l'appli et passés par un fichier temporaire (jamais sur la ligne de commande)
env=/var/www/alpas/.env
get() { grep -E "^$1=" "$env" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
db=$(get DB_DATABASE)
cnf=$(mktemp)
chmod 600 "$cnf"
trap 'rm -f "$cnf"' EXIT
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword="%s"\n' "$(get DB_HOST)" "$(get DB_PORT)" "$(get DB_USER)" "$(get DB_PASSWORD)" > "$cnf"

file="$dir/alpas-$(date +%F).sql.gz"
mysqldump --defaults-extra-file="$cnf" --single-transaction --no-tablespaces \
  --ignore-table="$db.pois" --ignore-table="$db.poi_cells" --ignore-table="$db.amenities" --ignore-table="$db.rate_limits" \
  "$db" | gzip > "$file.tmp"
mv "$file.tmp" "$file"
chmod 600 "$file"

find "$dir" -name 'alpas-*.sql.gz' -mtime +6 -delete
echo "$(date "+%Y-%m-%d %H:%M") $(basename "$file") $(du -h "$file" | cut -f1)"
