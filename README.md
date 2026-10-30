# AlpaS

> Le nom est défini à un seul endroit : `inertia/brand.ts`.

Plan de course à partir d'un GPX : découpage du parcours, temps de passage selon le niveau du coureur,
temps ciblé avec allures par tronçon, barrières horaires, plan de ravitaillement, fiche A4 et bracelet imprimables.

## Stack

- **AdonisJS 7** (backend, TypeScript) + **Inertia** + **Vue 3** (frontend, `inertia/`)
- Leaflet + OpenTopoMap pour la carte
- MySQL (Lucid) pour les comptes et les plans enregistrés

Les calculs (lecture GPX, profil, modèle de temps) tournent dans le navigateur. Sans compte, rien n'est
envoyé au serveur : l'état est gardé dans le `localStorage`. Avec un compte, le bouton « Enregistrer »
envoie le plan complet (GPX compris) dans la table `plans`, puis chaque modification est resynchronisée.
Les pages : `/connexion`, `/inscription`, `/mes-parcours`, `/parcours/:id`, `/tracer`, `/boucles`.

**Boucles découverte** (`/boucles`) : le serveur récupère les lieux remarquables auprès d'OpenStreetMap
(Overpass) et leur notoriété auprès de Wikidata (nombre de Wikipédia), puis les garde dans les tables `pois` /
`poi_cells` (cases de 0,05°, renouvelées après 30 jours) : chaque secteur n'est demandé qu'une fois. Le navigateur
compose ensuite les boucles (`inertia/utils/loops.ts`) et les fait tracer par BRouter.

## Lancer

```bash
npm install
cp .env.example .env   # puis générer une clé : node ace generate:key, et renseigner DB_*
node ace migration:run # crée les tables dans la base MySQL (à créer avant, utf8mb4)
npm run dev            # http://localhost:3333
npm run typecheck
npm run build          # build de production dans build/
```

## Organisation

| Fichier | Rôle |
| --- | --- |
| `start/routes.ts` | Routes (pages Inertia, compte, enregistrement des plans) |
| `app/controllers/` | Connexion / inscription, plans enregistrés |
| `inertia/composables/use_account.ts` | Enregistrement du plan dans le compte et synchronisation |
| `inertia/pages/home.vue` | Page principale (import GPX, plan, impressions) |
| `inertia/layouts/default.vue` | En-tête et pied de page |
| `inertia/brand.ts` | Nom et accroche de l'application |
| `inertia/utils/gpx.ts` | Lecture du GPX (traces et itinéraires), distance cumulée |
| `inertia/utils/profile.ts` | Profil ré-échantillonné tous les 25 m, lissé, pentes, D+/D− avec hystérésis |
| `inertia/utils/segments.ts` | Découpage automatique en montées / descentes / plats |
| `inertia/utils/model.ts` | Modèle de temps (voir ci-dessous) |
| `inertia/composables/use_plan.ts` | État partagé, calculs dérivés (passages, portions, nutrition, objectif), sauvegarde locale |
| `inertia/components/` | Carte, profil SVG, formulaires, tableaux, vues d'impression |

## Modèle de temps

1. Chaque mètre est converti en « mètre-effort » équivalent plat selon la pente, avec la courbe de coût
   énergétique de Minetti (2002). En descente, seule une partie du gain théorique est retenue (réglage
   « En descente »), puis un coefficient de terrain (route → très technique) s'applique.
2. Le temps total est extrapolé depuis la référence du coureur (allure 10 km, chrono récent, ou course
   passée avec son GPX) par la loi de Riegel `T = Tref × (D / Dref)^k`, `k` = réglage « Endurance ».
3. Le temps est réparti le long du parcours au prorata de l'effort ; les arrêts aux ravitos décalent les heures.

## Temps ciblé

Le bouton « Définir un temps ciblé » active un plan objectif à côté de la prédiction (qui reste intacte) :

- le temps visé (arrivée, arrêts compris) moins les arrêts est réparti sur les tronçons au prorata de l'effort ;
- une allure saisie dans le tableau des tronçons fixe ce tronçon et fait bouger le temps total ;
- « Revenir à l'objectif » étire ou resserre les tronçons non fixés (`objectiveScale`) pour retomber sur le temps visé ;
- « Retirer l'objectif » revient à la prédiction ; heures de passage, nutrition et impressions suivent le plan actif.

Les allures fixées sont attachées aux bornes du tronçon : recouper le parcours les libère.

## Itinéraires (BRouter)

Les itinéraires sont calculés par l'instance BRouter du VPS avec le profil `brouter/alpas.brf` : une copie de
`hiking-mountain` qui pénalise les routes à circulation (`road_avoidance`) et penche légèrement vers les chemins
(`path_preference = 1`). Le terrain choisi dans la page des boucles ajuste ces réglages dans la requête
(`profile:<variable>=<valeur>`, voir `TERRAIN_PARAMS` dans `inertia/utils/routing.ts`).

En développement, le site appelle directement `https://alpas.alpastudio.fr/brouter` (le profil n'existe que là).
Sur le VPS, le profil est un lien vers le fichier du dépôt, donc mis à jour à chaque `git pull` :

```bash
ln -sf /var/www/alpas/brouter/alpas.brf ~/alpas-data/brouter/app/brouter-1.7.10/profiles2/alpas.brf
```

## Exemple

`public/exemple.gpx` est une boucle fictive (~24 km, ~1 270 m D+) servant au bouton « Essayer avec un exemple ».
