import db from '@adonisjs/lucid/services/db'
import type { OverpassElement } from '#services/poi_service'

export type AmenityKind = 'water' | 'toilets'

export interface AmenityDto {
  id: number
  kind: AmenityKind
  name: string | null
  lat: number
  lon: number
}

export interface NewAmenity {
  osmKey: string
  kind: AmenityKind
  name: string | null
  lat: number
  lon: number
}

/** Accès réservé (clients, privé…) : inutile au coureur de passage */
const CLOSED = /^(private|no|customers|permit|delivery)$/

/** Point d'eau potable ou toilettes publiques ; null pour tout le reste */
export function toAmenity(el: OverpassElement): NewAmenity | null {
  const t = el.tags ?? {}
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (lat == null || lon == null || CLOSED.test(t.access ?? '')) return null
  let kind: AmenityKind | null = null
  if (t.amenity === 'toilets') kind = 'toilets'
  else if (t.drinking_water !== 'no' && (t.amenity === 'drinking_water' || t.drinking_water === 'yes')) kind = 'water'
  if (!kind) return null
  return { osmKey: `${el.type[0]}${el.id}`, kind, name: t['name:fr'] ?? t.name ?? null, lat, lon }
}

/** Enregistre (ou met à jour) les équipements, par identifiant OSM */
export async function saveAmenities(list: NewAmenity[]): Promise<number> {
  const knex = db.connection().getWriteClient()
  const now = new Date()
  for (let k = 0; k < list.length; k += 1000) {
    const rows = list.slice(k, k + 1000).map(a => ({
      osm_key: a.osmKey,
      kind: a.kind,
      name: a.name?.slice(0, 255) ?? null,
      lat: a.lat,
      lon: a.lon,
      created_at: now,
      updated_at: now,
    }))
    await knex.table('amenities').insert(rows).onConflict('osm_key').merge(['kind', 'name', 'lat', 'lon', 'updated_at'])
  }
  return list.length
}

/** Équipements dans un carré autour d'un point (le tri le long de la boucle se fait dans le navigateur) */
export async function amenitiesAround(lat: number, lon: number, radius: number): Promise<AmenityDto[]> {
  const dLat = radius / 111_320
  const dLon = radius / (111_320 * Math.cos(lat * Math.PI / 180))
  const rows = await db.from('amenities')
    .select('id', 'kind', 'name', 'lat', 'lon')
    .whereBetween('lat', [lat - dLat, lat + dLat])
    .whereBetween('lon', [lon - dLon, lon + dLon])
    .limit(3000)
  return rows as AmenityDto[]
}
