# Labo : version autonome, pays par pays

Préparation en local (Ubuntu sous WSL, disque D:) d'une version d'Alpast qui ne dépend plus d'aucun service extérieur.
La prod n'est pas concernée : elle suit `master`, le labo vit sur la branche `v2`.

Données dans `~/alpast-data` (dans Ubuntu) : `brouter/` (moteur + tuiles), `osm/` (extraits Geofabrik).
Lancer les scripts **depuis PowerShell** (Git Bash transforme les chemins `/mnt/...`) :

```powershell
wsl -d Ubuntu --exec bash "/mnt/d/Perso/Site web/Ravito/scripts/labo/demarrer-brouter.sh"
```

| Script | Rôle |
|---|---|
| `installer-brouter.sh` | BRouter 1.7.10 (même version que le serveur) + tuiles France |
| `telecharger-japon.sh` | Tuiles BRouter du Japon + extrait OSM et contour Geofabrik |
| `filtrer-pays.sh <pays>` | Lieux candidats d'un pays avec osmium (mêmes critères que `scripts/mise-a-jour-lieux.sh`) |
| `demarrer-brouter.sh` | BRouter sur le port 17777, profil `alpas` lu dans le dépôt |

Import d'un pays dans la base locale (depuis Windows, à la racine du projet) :

```powershell
node ace import:lieux "\\wsl.localhost\Ubuntu\home\alexis\alpast-data\osm\japan-lieux.geojsonseq" "\\wsl.localhost\Ubuntu\home\alexis\alpast-data\osm\japan.poly"
```

Le site local utilise ce BRouter si `.env` contient `VITE_BROUTER_URL=http://localhost:17777` (sinon celui de la prod, France seulement).
