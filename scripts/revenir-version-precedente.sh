#!/usr/bin/env bash
# Retour arrière en une commande : remet en ligne la version d'avant la dernière mise en ligne.
#   ssh alexis@213.32.69.211 /var/www/alpas/scripts/revenir-version-precedente.sh
# Les deux versions sont échangées (build/ ↔ build.prev/) : relancer la commande revient à la plus récente.
# Les migrations de base déjà passées ne sont PAS défaites (elles n'ajoutent en général que des tables ou colonnes).
main() {
  set -euo pipefail
  cd /var/www/alpas
  exec 9>/tmp/alpas-deployer.lock
  flock -n 9 || { echo "Une mise en ligne est en cours : attends qu'elle se termine."; exit 1; }
  if [ ! -d build.prev ]; then
    echo "Pas de version précédente gardée (build.prev/ absent)."
    exit 1
  fi
  source ~/.nvm/nvm.sh >/dev/null
  nvm use 24 >/dev/null

  echo "En ligne : $(cat build/VERSION 2>/dev/null || echo 'version inconnue')"
  rm -rf build.swap
  mv build build.swap
  mv build.prev build
  mv build.swap build.prev
  pm2 restart alpas >/dev/null

  for _ in $(seq 15); do
    sleep 2
    if [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3004/)" = 200 ]; then
      echo "Remis en ligne : $(cat build/VERSION 2>/dev/null || echo 'version inconnue')"
      return 0
    fi
  done
  echo "Le site ne répond pas : relance la commande pour revenir à l'autre version, puis regarde pm2 logs alpas."
  exit 1
}

main "$@"
exit
