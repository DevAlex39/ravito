/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adresse du calcul d'itinéraires (BRouter) ; serveur public par défaut */
  readonly VITE_BROUTER_URL?: string
  /** Où sont servis nos fonds de carte (.pmtiles), polices et icônes ; sans elle, tuiles OpenStreetMap */
  readonly VITE_CARTE_URL?: string
  /** Fonds de carte présents à cette adresse, séparés par des virgules (serveur : « france ») ; sans elle, ceux du labo */
  readonly VITE_CARTE_FONDS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Numéro de version (package.json), injecté par Vite : voir vite.config.ts */
declare const __APP_VERSION__: string
