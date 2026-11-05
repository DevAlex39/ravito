/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Database
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  // Envoi des e-mails (mot de passe oublié) : même compte SMTP que les autres sites
  SMTP_HOST: Env.schema.string.optional(),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_USER: Env.schema.string.optional(),
  SMTP_PASS: Env.schema.string.optional(),

  // Connexion avec Google / Strava : le bouton n'apparaît que si les deux valeurs sont remplies
  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),
  STRAVA_CLIENT_ID: Env.schema.string.optional(),
  STRAVA_CLIENT_SECRET: Env.schema.string.optional(),

  // Racine des données par pays (~/alpast-data), où import:fiches range les miniatures des fiches de lieux ;
  // sans elle, pas de photos stockées (les fiches restent servies par Wikipédia en direct)
  FICHES_PHOTOS: Env.schema.string.optional(),
  // Photon (recherche d'adresses hors France, voir scripts/labo/photon.sh) ; sans lui, la recherche reste BAN + Nominatim
  PHOTON_URL: Env.schema.string.optional(),

  // Limites de tentatives : en base par défaut (elles survivent à un redémarrage)
  LIMITER_STORE: Env.schema.enum.optional(['database', 'memory'] as const),
})
