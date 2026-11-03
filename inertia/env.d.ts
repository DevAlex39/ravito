/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adresse du calcul d'itinéraires (BRouter) ; serveur public par défaut */
  readonly VITE_BROUTER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Numéro de version (package.json), injecté par Vite : voir vite.config.ts */
declare const __APP_VERSION__: string
