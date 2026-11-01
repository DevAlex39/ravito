<template>
  <DefaultLayout>
    <Head title="Mentions légales et confidentialité" />
    <div class="container legal">
      <h1>Mentions légales et confidentialité</h1>
      <p class="updated">Mise à jour le 1er novembre 2026</p>

      <section class="card">
        <h2>Éditeur et hébergeur</h2>
        <p>{{ APP_NAME }} est un site personnel édité par <strong>{{ EDITOR }}</strong>.<br>Contact : <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a></p>
        <p>Hébergement : OVH SAS, 2 rue Kellermann, 59100 Roubaix, France — <a href="https://www.ovhcloud.com" target="_blank" rel="noopener">ovhcloud.com</a></p>
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
          <li>Ce que nous gardons : ton e-mail, ton nom s'il est fourni, ton mot de passe chiffré (jamais lisible), les parcours que tu enregistres, ceux que tu partages et tes votes.</li>
          <li>Pourquoi : te permettre de retrouver tes parcours et de partager ceux que tu choisis. Rien n'est vendu ni utilisé à des fins publicitaires.</li>
          <li>Connexion avec Google ou Strava : ils nous transmettent ton identifiant et ton e-mail ; nous ne lisons pas tes activités.</li>
          <li>E-mails : uniquement pour réinitialiser ton mot de passe.</li>
          <li>Durée : tant que ton compte existe. Un parcours partagé reste visible tant que tu ne le retires pas.</li>
          <li>
            Tes droits (RGPD) : consulter, corriger, exporter ou supprimer tes données, et supprimer ton compte, sur simple demande à
            <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>. Tu peux aussi saisir la <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">CNIL</a>.
          </li>
        </ul>
        <h3>Sécurité</h3>
        <p>
          Pour bloquer les abus, le serveur compte les requêtes par adresse IP pendant quelques minutes, sans les associer à ton compte.
          Un cookie de session te garde connecté ; il est indispensable et ne sert à rien d'autre.
        </p>
        <h3>Services appelés depuis ton navigateur</h3>
        <p>Pour afficher la carte et les informations, ton navigateur contacte directement ces services, qui voient donc ton adresse IP :</p>
        <ul>
          <li>fonds de carte : OpenStreetMap et OpenTopoMap ;</li>
          <li>recherche d'adresses : Géoplateforme de l'IGN (Base Adresse Nationale) et Nominatim (OpenStreetMap) ;</li>
          <li>fiches des lieux : Wikidata, Wikipédia et Wikimedia Commons.</li>
        </ul>
      </section>

      <section class="card">
        <h2>Sources et licences</h2>
        <ul>
          <li>Données cartographiques, lieux, points d'eau et toilettes : © les contributeurs d'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, licence ODbL. La base de lieux d'{{ APP_NAME }} en est dérivée et peut être fournie sous la même licence sur demande.</li>
          <li>Fond topographique : © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a>, CC BY-SA.</li>
          <li>Itinéraires : <a href="https://brouter.de" target="_blank" rel="noopener">BRouter</a> (logiciel libre, licence MIT), hébergé par nos soins.</li>
          <li>Notoriété des lieux : <a href="https://www.wikidata.org" target="_blank" rel="noopener">Wikidata</a> (CC0). Résumés : Wikipédia (CC BY-SA). Photos : Wikimedia Commons, auteur et licence indiqués sous chaque photo.</li>
          <li>Adresses : <a href="https://adresse.data.gouv.fr" target="_blank" rel="noopener">Base Adresse Nationale</a> et Géoplateforme IGN, Licence Ouverte 2.0.</li>
          <li>Carte interactive : <a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a> (licence BSD).</li>
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
