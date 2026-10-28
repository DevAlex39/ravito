# Ravito

Plan de course à partir d'un GPX : découpage du parcours, temps de passage selon le niveau du coureur,
barrières horaires, plan de ravitaillement, fiche A4 et bracelet imprimables.

Application 100 % côté client (Nuxt 4, `ssr: false`) : le GPX est lu dans le navigateur, rien n'est envoyé
au serveur. L'état est gardé dans le `localStorage` pour retrouver son plan au rechargement.

## Lancer

```bash
npm install
npm run dev        # http://localhost:3000
npm run generate   # site statique dans .output/public
```

## Organisation

| Fichier | Rôle |
| --- | --- |
| `app/utils/gpx.ts` | Lecture du GPX (traces et itinéraires), distance cumulée |
| `app/utils/profile.ts` | Profil ré-échantillonné tous les 25 m, lissé, pentes, D+/D− avec hystérésis |
| `app/utils/segments.ts` | Découpage automatique en montées / descentes / plats |
| `app/utils/model.ts` | Modèle de temps (voir ci-dessous) |
| `app/composables/usePlan.ts` | État partagé, calculs dérivés (passages, portions, nutrition), sauvegarde locale |
| `app/components/` | Carte (Leaflet + OpenTopoMap), profil SVG, formulaires, tableaux, vues d'impression |

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
