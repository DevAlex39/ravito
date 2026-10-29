import { BaseSchema } from '@adonisjs/lucid/schema'

/** Types classés « nature » au moment de la migration (même liste que NATURE_KINDS dans poi_service) */
const NATURE_KINDS = ['waterfall', 'cave_entrance', 'peak', 'arch', 'gorge', 'volcano', 'spring', 'rock', 'stone', 'cliff', 'beach', 'saddle', 'viewpoint', 'park', 'garden']

/** Catégorie d'un lieu pour le filtre des boucles : « patrimoine » ou « nature » */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('pois', (table) => {
      table.string('category', 12).notNullable().defaultTo('patrimoine')
    })
    // Lieux déjà en base : classés une fois pour toutes
    this.defer(async (db) => {
      await db.from('pois').whereIn('kind', NATURE_KINDS).update({ category: 'nature' })
    })
  }

  async down() {
    this.schema.alterTable('pois', (table) => {
      table.dropColumn('category')
    })
  }
}
