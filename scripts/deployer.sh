#!/usr/bin/env bash
# Mise en ligne d'Alpast sur le VPS, avec retour automatique à la version précédente si le site ne répond plus.
#   ssh alexis@213.32.69.211 /var/www/alpas/scripts/deployer.sh
#
# 1. récupère la dernière version (git pull) et construit le site dans build/ ;
#    la version qui tournait est gardée dans build.prev/ ;
# 2. applique les migrations de base, relance PM2 et vérifie que le site répond ;
# 3. si le site ne répond pas : remet build.prev/ en place tout seul.
# Revenir à la main à la version précédente : scripts/revenir-version-precedente.sh
# Attention : un retour arrière ne défait pas les migrations de base déjà passées.
#
# Tout est dans main() : bash lit la fonction en entier avant de l'exécuter, le git pull peut donc
# modifier ce fichier sans perturber la mise en ligne en cours.
main() {
  set -euo pipefail
  local app=/var/www/alpas
  local url=http://127.0.0.1:3004/
  cd "$app"

  # Une seule mise en ligne à la fois, et pas pendant l'import mensuel des lieux
  exec 9>/tmp/alpas-deployer.lock
  flock -n 9 || { echo "Une mise en ligne est déjà en cours."; exit 1; }
  if pgrep -f "[m]ise-a-jour|ace [i]mport:" >/dev/null; then
    echo "Import des lieux en cours : réessaie plus tard."
    exit 1
  fi

  source ~/.nvm/nvm.sh >/dev/null
  nvm use 24 >/dev/null

  # Fichiers générés par le build précédent (non suivis en pratique) : remis à l'état du dépôt
  git checkout -- .adonisjs
  local before
  before=$(git rev-parse --short HEAD)
  git pull --ff-only -q
  local commit version
  commit=$(git rev-parse --short HEAD)
  version=$(node -p "require('./package.json').version")
  echo "Mise en ligne de v$version ($before → $commit)"

  npm ci --no-audit --no-fund >/dev/null 2>&1

  # La version en ligne est mise de côté ; le site tourne toujours (Node a déjà chargé son code)
  rm -rf build.prev
  [ -d build ] && mv build build.prev
  if ! node ace build >/tmp/alpas-build.log 2>&1; then
    echo "Échec de la construction (journal : /tmp/alpas-build.log) : la version précédente reste en ligne."
    rm -rf build
    [ -d build.prev ] && mv build.prev build
    exit 1
  fi
  cp .env build/
  chmod 600 build/.env
  printf 'v%s %s %s\n' "$version" "$commit" "$(date '+%Y-%m-%d %H:%M')" > build/VERSION
  (cd build && npm ci --omit=dev --no-audit --no-fund >/dev/null 2>&1)
  (cd build && node ace migration:run --force 2>&1 | tail -1)

  pm2 restart alpas >/dev/null
  if repond "$url"; then
    echo "En ligne : $(cat build/VERSION)"
    return 0
  fi

  echo "Le site ne répond pas après la mise en ligne : retour à la version précédente."
  if [ -d build.prev ]; then
    rm -rf build.echec
    mv build build.echec
    mv build.prev build
    pm2 restart alpas >/dev/null
    repond "$url" && echo "Version précédente remise en ligne : $(cat build/VERSION 2>/dev/null || echo inconnue)"
    echo "Version en échec gardée dans build.echec/ (journal PM2 : pm2 logs alpas --lines 50)"
  fi
  exit 1
}

# Le site répond-il (code 200) dans les 30 secondes ?
repond() {
  for _ in $(seq 15); do
    sleep 2
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$1")" = 200 ] && return 0
  done
  return 1
}

main "$@"
exit
