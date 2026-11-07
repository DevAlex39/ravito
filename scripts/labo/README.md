# Labo : version autonome, pays par pays

Préparation en local (Ubuntu sous WSL, disque D:) d'une version d'Alpast qui ne dépend plus d'aucun service extérieur.
La prod n'est pas concernée : elle suit `master`, le labo vit sur la branche `v2`.

## Rangement des données (dans Ubuntu, donc sur D:)

```
~/alpast-data/                         (Explorateur Windows : \\wsl.localhost\Ubuntu\home\alexis\alpast-data)
├── monde/
│   ├── itineraires/   BRouter + réserve de tuiles .rd5 (carrés de 5° qui chevauchent les frontières)
│   ├── carte-assets/  polices et icônes du fond de carte (Protomaps basemaps-assets)
│   └── outils/        pmtiles
└── <continent>/<pays>/
    ├── source/        carte OSM et contour .poly (Geofabrik)
    ├── lieux/         lieux candidats prêts à importer
    ├── fond-de-carte/ <pays>.pmtiles (tuiles vectorielles Protomaps)
    ├── adresses/      base Photon (recherche d'adresses et de lieux)
    └── fiches/photos/ miniatures des photos Wikimedia des fiches de lieux
```

Les pays connus (dossier, code ISO, continent, chemin Geofabrik, élément Wikidata, langues) sont décrits dans
`config/pays.json`, lu à la fois par ces scripts et par les commandes d'import du site.
Les tuiles BRouter nécessaires sont déduites du contour du pays.

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
| `photon.sh telecharger <pays\|europe\|monde>` | Base Photon (GraphHopper) décompressée dans `adresses/` ; `monde` (~63 Go) : un seul Photon pour tous les pays |
| `photon.sh demarrer <pays\|europe\|monde> <port>` | Photon sur le port choisi (labo : `monde 2323`, seule base gardée) — un seul à la fois : chacun démarre son moteur interne sur le port 9201 |
| `pays.ps1 -Seulement a,b` (PowerShell) | Pays demandés de bout en bout : préparation, lieux OSM + Wikidata, fond de carte (hors Europe), fiches ; reprise par marqueurs, journal dans `~/alpast-data/journal.txt` |
| `europe.ps1` (PowerShell) | Prépare et importe tous les pays d'Europe de `config/pays.json`, journal dans `~/alpast-data/europe/journal.txt` |
| `servir-carte.sh` | Données, polices et icônes + démo du fond de carte sur http://localhost:8090/demo/ |
| `envoyer-pays.sh <test\|prod> <pays>…` (Git Bash) | Envoie au VPS les pays préparés (fond de carte, miniatures, lieux, contour, tuiles BRouter manquantes ; rien si déjà là), les importe dans la base du site et charge leurs fiches ; ajouter ensuite les fonds dans `VITE_CARTE_FONDS` et reconstruire |

Photon du serveur : zone `voisins` (France, Italie, Espagne, Belgique, Suisse, Luxembourg, Monaco, Andorre,
Liechtenstein, Saint-Marin, Vatican ; 14 Go), construite dans le labo depuis l'export brut Europe de GraphHopper
importé avec `-country-codes fr,it,es,be,ch,lu,mc,ad,li,sm,va`, puis copiée dans `~/alpas-data/donnees/europe/adresses-voisins`.
Sur le VPS, PM2 `photon` lance directement java (`-Xmx3g … serve -data-dir …/adresses-voisins -listen-ip 127.0.0.1 -listen-port 2322`).

Import d'un pays dans la base locale (depuis Windows, à la racine du projet) :

```powershell
node ace import:lieux "<lieux .geojsonseq>" "<contour .poly>" --pays=<code>   # commande affichée par preparer-pays.sh
node ace import:wikidata --pays=<dossier>                                       # lieux remarquables Wikidata
node ace import:fiches --pays=<dossier>                                         # textes Wikipédia + photos, stockés en local
```

Le nettoyage de `import:lieux` et `import:wikidata` ne touche que les lieux du pays importé.

Le site local utilise le BRouter du labo si `.env` contient `VITE_BROUTER_URL=http://localhost:17777` (sinon celui de la prod, France seulement).
La recherche d'adresses hors France passe par Photon si `.env` contient `PHOTON_URL=http://localhost:2323` (route `/adresses` du site ; sans lui, BAN + Nominatim comme en prod).
Les cartes du site local utilisent notre fond vectoriel (Europe + Japon, clair ou sombre selon le thème) si `.env` contient `VITE_CARTE_URL=http://localhost:8090` et que `servir-carte.sh` tourne (sans lui, tuiles OpenStreetMap comme en prod).
