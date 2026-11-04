import { join } from 'node:path'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

/** Chemin d'une miniature rangée par import:fiches : <continent>/<pays>/fiches/photos/ab/<empreinte>.<ext> */
const PHOTO_PATH = /^[a-z-]+\/[a-z-]+\/fiches\/photos\/[0-9a-f]{2}\/[0-9a-f]{40}\.(jpg|png|gif|webp)$/

/** Fiches des lieux stockées chez nous (voir commands/import_fiches.ts) */
export default class PlaceCardsController {
  /** Textes de la fiche dans chaque langue disponible et photo ; 404 si le lieu n'a pas encore de fiche stockée */
  async show({ params, response }: HttpContext) {
    const cards = await db.from('place_cards')
      .where('wikidata', params.wikidata)
      .select('lang', 'description', 'extract', 'article_url as articleUrl') as { lang: string, description: string | null, extract: string | null, articleUrl: string | null }[]
    if (!cards.length) return response.notFound({ message: 'Pas de fiche stockée' })
    const photo = await db.from('place_photos').where('wikidata', params.wikidata).first() as { file: string, path: string, author: string | null, license: string | null } | null
    response.header('Cache-Control', 'public, max-age=86400')
    return {
      cards,
      photo: photo && env.get('FICHES_PHOTOS')
        ? {
            url: `/fiches/photos/${photo.path}`,
            author: photo.author,
            license: photo.license,
            page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(`File:${photo.file.replace(/ /g, '_')}`)}`,
          }
        : null,
    }
  }

  /** Miniature (en production, Nginx peut servir ce dossier directement) */
  async photo({ params, response }: HttpContext) {
    const path = (params['*'] as string[]).join('/')
    const root = env.get('FICHES_PHOTOS')
    if (!root || !PHOTO_PATH.test(path)) return response.notFound()
    response.header('Cache-Control', 'public, max-age=2592000, immutable')
    return response.download(join(root, path))
  }
}
