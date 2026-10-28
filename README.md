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

## Exemple

`public/exemple.gpx` est une boucle fictive (~24 km, ~1 270 m D+) servant au bouton « Essayer avec un exemple ».
