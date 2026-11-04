# Labo : version autonome, pays par pays

Préparation en local (Ubuntu sous WSL, disque D:) d'une version d'Alpast qui ne dépend plus d'aucun service extérieur.
La prod n'est pas concernée : elle suit `master`, le labo vit sur la branche `v2`.

## Rangement des données (dans Ubuntu, donc sur D:)

```
~/alpast-data/                         (Explorateur Windows : \\wsl.localhost\Ubuntu\home\alexis\alpast-data)
├── monde/
│   ├── itineraires/   BRouter + réserve de tuiles .rd5 (carrés de 5° qui chevauchent les frontières)
│   └── outils/        pmtiles
└── <continent>/<pays>/
    ├── source/        carte OSM et contour .poly (Geofabrik)
    ├── lieux/         lieux candidats prêts à importer
    └── fond-de-carte/ <pays>.pmtiles (tuiles vectorielles Protomaps)
```

Les pays connus (continent, chemin Geofabrik, tuiles BRouter) sont décrits dans `commun.sh`.

## Scripts

Les lancer **depuis PowerShell** (Git Bash transforme les chemins `/mnt/...`) :

```powershell
wsl -d Ubuntu --exec bash "/mnt/d/Perso/Site web/Ravito/scripts/labo/preparer-pays.sh" japon
```

| Script | Rôle |
|---|---|
| `installer-brouter.sh` | BRouter 1.7.10 (même version que le serveur) |
| `preparer-pays.sh <pays>` | Carte OSM, contour, tuiles BRouter manquantes, lieux candidats ; affiche la commande d'import |
| `extraire-carte.sh <pays>` | Fond de carte du pays, découpé dans la dernière carte mondiale Protomaps |
| `demarrer-brouter.sh` | BRouter sur le port 17777, profil `alpas` lu dans le dépôt |
| `servir-carte.sh` | Données + démo du fond de carte sur http://localhost:8090/demo/ |

Import d'un pays dans la base locale (depuis Windows, à la racine du projet) : commande affichée à la fin de `preparer-pays.sh`.

Le site local utilise le BRouter du labo si `.env` contient `VITE_BROUTER_URL=http://localhost:17777` (sinon celui de la prod, France seulement).
