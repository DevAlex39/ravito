<template>
  <DefaultLayout>
    <Head title="Mentions légales et confidentialité" />
    <div class="container legal">
      <h1>Mentions légales et confidentialité</h1>
      <p class="updated">Mise à jour le 3 novembre 2026</p>

      <section class="card">
        <h2>Éditeur et hébergeur</h2>
        <p>{{ APP_NAME }} est un site personnel édité par <strong>{{ EDITOR }}</strong>.<br>Contact : <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a></p>
        <p>Hébergement : OVH SAS, 2 rue Kellermann, 59100 Roubaix, France — téléphone 1007 — <a href="https://www.ovhcloud.com" target="_blank" rel="noopener">ovhcloud.com</a></p>
      </section>

      <section class="card warn">
        <h2>À lire avant de partir</h2>
        <p>
          Les boucles et tracés sont <strong>calculés automatiquement</strong> à partir des données collaboratives d'OpenStreetMap.
          Un chemin peut être fermé, privé, impraticable ou dangereux selon la saison et la météo, et un point d'eau peut être à sec.
          Vérifie l'itinéraire, les accès et les conditions sur place : tu restes seul juge de ce que tu peux faire en sécurité.
          {{ APP_NAME }} ne peut être tenu responsable d'un itinéraire inadapté.
        </p>
      </section>

      <section class="card">
        <h2>Tes données</h2>
        <h3>Sans compte</h3>
        <p>
          Les fichiers GPX que tu ouvres et tes plans de course restent dans ton navigateur : ils ne sont pas envoyés au serveur.
          Les boucles déjà calculées (départ, réglages, tracés) sont gardées <strong>6 heures</strong> dans ton navigateur pour s'afficher
          aussitôt si tu refais la même recherche ; elles ne quittent pas ton appareil. Ce stockage sert uniquement au fonctionnement
          du site : il n'y a ni publicité, ni mesure d'audience, ni cookie de suivi.
        </p>
        <h3>Avec un compte</h3>
        <ul>
          <li>Ce que nous gardons : ton e-mail, ton nom s'il est fourni, ton mot de passe chiffré (jamais lisible), les parcours que tu enregistres, ceux que tu partages, tes boucles favorites et tes votes.</li>
          <li>Pourquoi : te permettre de retrouver tes parcours et tes boucles, et de partager ceux que tu choisis. Rien n'est vendu ni utilisé à des fins publicitaires.</li>
          <li>Si tu choisis de te connecter avec Google ou Strava : ils nous transmettent ton identifiant et ton e-mail ; nous ne lisons pas tes activités.</li>
          <li>E-mails : uniquement pour réinitialiser ton mot de passe.</li>
          <li>Durée : tant que ton compte existe. Un parcours partagé reste visible tant que tu ne le retires pas.</li>
          <li>
            Supprimer ton compte : bouton « Supprimer mon compte » dans <a href="/mon-compte">Mon compte</a>. Tout est effacé aussitôt
            (parcours, partages, favoris, votes), puis disparaît des sauvegardes au bout de 30 jours au plus.
          </li>
          <li>
            Tes droits (RGPD) : consulter, corriger, exporter ou supprimer tes données, sur simple demande à
            <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>. Tu peux aussi saisir la <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">CNIL</a>.
          </li>
        </ul>
        <h3>Responsable et cadre</h3>
        <p>
          Responsable du traitement : {{ EDITOR }}, joignable à l'adresse ci-dessus. Les données sont traitées parce qu'elles sont
          nécessaires au service que tu demandes (créer un compte, enregistrer tes parcours). Elles sont stockées en France chez OVH
          et ne sont transmises à personne.
        </p>
        <h3>Sauvegardes</h3>
        <p>
          Une copie de la base est faite chaque nuit pour pouvoir réparer le site en cas de panne : elle est gardée 14 jours sur le serveur,
          puis 30 jours au plus sur un disque personnel de l'éditeur, en France.
        </p>
        <h3>Sécurité et journaux</h3>
        <p>
          Comme tout site, le serveur note chaque visite (adresse IP, page demandée, date, navigateur) dans un journal technique effacé
          au bout de 14 jours ; il ne sert qu'à corriger les pannes et à repérer les attaques. Pour bloquer les abus, le serveur compte
          aussi les requêtes par adresse IP pendant quelques minutes, sans les associer à ton compte.
          Un cookie de session te garde connecté (30 jours au plus) ; il est indispensable et ne sert à rien d'autre.
        </p>
        <h3>Liens courts</h3>
        <p>Quand tu copies le lien d'une boucle, nous gardons ses réglages (départ, distance, lieux) et le nombre d'ouvertures du lien, sans rien qui te concerne.</p>
        <h3>Services appelés depuis ton navigateur</h3>
        <p>Pour afficher la carte et les informations, ton navigateur contacte directement ces services, qui voient donc ton adresse IP :</p>
        <ul>
          <li>fonds de carte : OpenStreetMap et OpenTopoMap ;</li>
          <li>recherche d'adresses et de communes : Géoplateforme de l'IGN (Base Adresse Nationale), API Découpage administratif (geo.api.gouv.fr) et Nominatim (OpenStreetMap) ;</li>
          <li>fiches des lieux : Wikidata, Wikipédia et Wikimedia Commons.</li>
        </ul>
        <p>Les polices de caractères et les itinéraires sont servis par notre propre serveur.</p>
      </section>

      <section class="card">
        <h2>Sources et licences</h2>
        <ul>
          <li>Données cartographiques, lieux, points d'eau et toilettes : © les contributeurs d'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, licence ODbL. La base de lieux d'{{ APP_NAME }} en est dérivée et peut être fournie sous la même licence sur demande.</li>
          <li>Fond topographique : © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a>, CC BY-SA.</li>
          <li>Itinéraires : <a href="https://brouter.de" target="_blank" rel="noopener">BRouter</a> (logiciel libre, licence MIT), hébergé par nos soins.</li>
          <li>Notoriété des lieux, et lieux complémentaires absents d'OpenStreetMap (châteaux, chapelles, musées…) : <a href="https://www.wikidata.org" target="_blank" rel="noopener">Wikidata</a> (CC0). Résumés : Wikipédia (CC BY-SA). Photos : Wikimedia Commons, auteur et licence indiqués sous chaque photo.</li>
          <li>Lieux complémentaires (belvédères, mégalithes, grottes, cascades, lavoirs… absents d'OpenStreetMap) : <a href="https://geoservices.ign.fr/bdtopo" target="_blank" rel="noopener">IGN, BD TOPO</a>, Licence Ouverte 2.0.</li>
          <li>Adresses : <a href="https://adresse.data.gouv.fr" target="_blank" rel="noopener">Base Adresse Nationale</a> et Géoplateforme IGN, Licence Ouverte 2.0.</li>
          <li>Carte interactive : <a href="https://maplibre.org" target="_blank" rel="noopener">MapLibre</a> (licence BSD) ; fond de carte <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> (données OpenStreetMap, polices Noto, licence SIL Open Font License).</li>
          <li>Polices : Barlow Condensed et Inter, licence SIL Open Font License.</li>
        </ul>
      </section>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import { APP_NAME, CONTACT_EMAIL, EDITOR } from '~/brand'
</script>

<style scoped>
.legal { display: flex; flex-direction: column; gap: 16px; max-width: 820px; padding-top: 24px; padding-bottom: 40px; }
h1 { font-size: 2.4rem; font-weight: 700; }
.updated { color: var(--text-soft); font-size: 0.88rem; margin-top: -10px; }
.card { display: flex; flex-direction: column; gap: 10px; padding: 20px 22px; border-radius: 18px; }
.card.warn { border-left: 4px solid var(--accent); }
h2 { font-size: 1.45rem; margin: 0; }
h3 { font-size: 1rem; margin: 6px 0 0; }
p, li { line-height: 1.55; font-size: 0.95rem; }
ul { display: flex; flex-direction: column; gap: 6px; padding-left: 20px; }
</style>
