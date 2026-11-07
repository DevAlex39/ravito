# Journal des versions

Chaque mise en ligne porte un numéro **vMAJEUR.MINEUR.CORRECTIF** (affiché en bas des pages) :
- **MINEUR** (v1.1.0) : nouvelle fonction visible ;
- **CORRECTIF** (v1.0.1) : correction sans nouveauté ;
- **MAJEUR** (v2.0.0) : grand changement (nouveau nom, refonte…).

Mettre en ligne : `ssh alexis@213.32.69.211 /var/www/alpas/scripts/deployer.sh`
Revenir à la version d'avant : `ssh alexis@213.32.69.211 /var/www/alpas/scripts/revenir-version-precedente.sh`

## v1.2.0 — 2026-11-07

- **Nouveaux pays** : Italie, Espagne, Belgique, Suisse, Luxembourg, Monaco, Andorre et Liechtenstein, avec leurs
  cartes, lieux, fiches et itinéraires.
- **Outre-mer** : Réunion, Mayotte, Guadeloupe, Martinique, Guyane, Nouvelle-Calédonie, Polynésie française,
  Wallis-et-Futuna.
- **Recherche d'adresses** : les villes étrangères (Barcelone, Genève, Florence…) passent devant les rues et
  lieux-dits français du même nom.
- **Boucles** : boutons GPX, lien, modifier et « Préparer ma course » dans la boucle choisie ; « D'autres boucles »
  en haut de la liste.
- **Créer une trace** : nom du parcours, GPX et plan de course juste sous la carte.
- **GPX pour la montre** : les lieux sont posés sur le tracé, pour que la montre prévienne bien à leur approche.

## v1.1.0 — 2026-11-07

- **Nouvelle carte** : fond de carte Alpast servi par notre serveur (plus de tuiles OpenStreetMap), plus fluide,
  en clair ou en sombre selon le thème.
- **Thème sombre** : suit le réglage de l'appareil, ou bouton soleil/lune.
- **Nouveau décor** : dessins au trait en fond d'écran (tour de village sur ordinateur, version verticale sur mobile).
- **Fiches des lieux plus rapides** : textes Wikipédia et photos stockés chez nous au lieu d'être demandés à chaque clic.
- **Recherche d'adresses** : suggestions dès la frappe, servies par notre serveur.
- **Boucles « Sans aller-retour »** : nouvelle option qui ne repasse jamais par le même chemin (quitte à passer
  par moins de lieux).
- **GPX pour la montre** : les lieux numérotés (et les points d'eau/WC s'ils sont affichés) sont ajoutés au GPX ;
  Garmin et les autres montres préviennent à leur approche.
- **Eau et WC** : seuls ceux à moins de 30 m du tracé sont retenus (au lieu de 60 m).
- Accueil : le compte garde aussi les boucles favorites.

## v1.0.2 — 2026-11-05

- **Import des lieux plus fiable** : quand Wikidata refuse des requêtes (« trop de requêtes »), l'import attend et
  réessaie au lieu d'enregistrer les lieux sans leur notoriété (ils remontaient moins bien dans les boucles).
- **Doublons Wikidata retirés** : les anciens lieux Wikidata devenus doublons d'un lieu OpenStreetMap sont maintenant
  supprimés à l'import mensuel (le garde-fou comptait seulement les nouveaux lieux et bloquait la suppression).
- Un type de lieu saisi à la main dans OpenStreetMap ne fait plus échouer l'import (il devient « lieu »).

## v1.0.1 — 2026-11-03

- **Mentions légales** mises à jour : boucles favorites, suppression du compte depuis Mon compte, sauvegardes
  (14 jours sur le serveur, 30 jours hors serveur), journaux du serveur (14 jours), cadre RGPD (responsable,
  base légale, données en France), liens courts, téléphone de l'hébergeur, API Découpage administratif.
- **Polices servies par le site** au lieu de Google Fonts : l'adresse IP des visiteurs n'est plus envoyée à Google.

## v1.0.0 — 2026-11-03

Première version numérotée : tout ce qui était en ligne à cette date.

- **Boucles découverte** : boucle à distance donnée qui enchaîne les plus beaux lieux (OpenStreetMap, IGN, Wikidata),
  3 boucles proposées + « D'autres boucles », « Moins de D+ », points d'eau et toilettes, lien court à partager,
  boucles favorites (avec un compte).
- **Créer une trace** : tracé sur les sentiers, lieux à voir à ajouter, ordre des lieux par glisser-déposer
  et « Optimiser l'ordre », ligne droite automatique là où il n'y a pas de chemin.
- **Plan de course** depuis un GPX : temps de passage, allures par tronçon, ravitaillements, fiche et bracelet.
- **Comptes** : parcours enregistrés et partagés, votes, suppression du compte.
- **Sécurité** : CSP et en-têtes de sécurité, limites par compte, sauvegardes quotidiennes copiées hors du serveur.
- **Mise en ligne** avec retour automatique à la version précédente si le site ne répond plus.
