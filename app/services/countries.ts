import { readFileSync } from 'node:fs'
import app from '@adonisjs/core/services/app'

/** Un pays importable, décrit dans config/pays.json */
export interface Country {
  /** Nom du dossier (~/alpast-data/<continent>/<dossier>), aussi utilisé dans les commandes (--pays=japon) */
  dossier: string
  /** Code ISO enregistré sur chaque lieu (pois.country) */
  code: string
  continent: string
  /** Chemin de l'extrait chez Geofabrik (europe/france) */
  geofabrik: string
  /** Élément Wikidata du pays (P17) ; null si ses lieux Wikidata sont déjà couverts par un autre pays */
  wikidata: string | null
  /** Langues des noms et des fiches, par ordre de préférence */
  langues: string[]
}

let cache: Country[] | null = null

export function countries(): Country[] {
  cache ??= (JSON.parse(readFileSync(app.makePath('config/pays.json'), 'utf8')) as { pays: Country[] }).pays
  return cache
}

export function countryNamed(dossier: string): Country | undefined {
  return countries().find(c => c.dossier === dossier)
}

/** Code de l'édition de Wikipédia d'une langue Wikidata (le norvégien bokmål « nb » est sur no.wikipedia.org) */
export function wikipediaOf(lang: string): string {
  return lang === 'nb' ? 'no' : lang
}
