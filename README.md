# Ravito

> Nom provisoire : il est défini à un seul endroit, `inertia/brand.ts`.

Plan de course à partir d'un GPX : découpage du parcours, temps de passage selon le niveau du coureur,
temps ciblé avec allures par tronçon, barrières horaires, plan de ravitaillement, fiche A4 et bracelet imprimables.

## Stack

- **AdonisJS 7** (backend, TypeScript) + **Inertia** + **Vue 3** (frontend, `inertia/`)
- Leaflet + OpenTopoMap pour la carte
- Base de données prévue : MySQL (pas encore utilisée — arrivera avec les comptes)

Les calculs (lecture GPX, profil, modèle de temps) tournent dans le navigateur : le fichier GPX n'est
pas envoyé au serveur. L'état est gardé dans le `localStorage`.

## Lancer

```bash
npm install
cp .env.example .env   # puis générer une clé : node ace generate:key
npm run dev            # http://localhost:3333
npm run typecheck
npm run build          # build de production dans build/
```

## Organisation

| Fichier | Rôle |
| --- | --- |
| `start/routes.ts` | Routes (une seule page Inertia pour l'instant : `home`) |
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

## Exemple

`public/exemple.gpx` est une boucle fictive (~24 km, ~1 270 m D+) servant au bouton « Essayer avec un exemple ».
