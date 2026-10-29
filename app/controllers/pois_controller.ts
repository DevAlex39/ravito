import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { poisAround } from '#services/poi_service'

const aroundValidator = vine.create(
  vine.object({
    lat: vine.number().range([-85, 85]),
    lon: vine.number().range([-180, 180]),
    // Rayon de recherche (m) : une boucle de 40 km tient dans ~8 km
    rayon: vine.number().range([300, 9000]),
    // Filtre des boucles : sans valeur, tous les lieux
    categorie: vine.enum(['patrimoine', 'nature'] as const).optional(),
  }),
)

export default class PoisController {
  /** Lieux remarquables autour d'un point (JSON), pour composer les boucles découverte */
  async around({ request, response }: HttpContext) {
    const { lat, lon, rayon, categorie } = await aroundValidator.validate(request.qs())
    try {
      return { lieux: await poisAround(lat, lon, rayon, categorie) }
    }
    catch {
      return response.serviceUnavailable({ message: 'Le service des lieux (OpenStreetMap) ne répond pas pour le moment.' })
    }
  }
}
