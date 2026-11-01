import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Points d'eau potable et toilettes publiques (import de la carte de France) : affichés en option
 * le long des boucles. À part des lieux à voir : ce ne sont pas des buts de balade.
 */
export default class extends BaseSchema {
  protected tableName = 'amenities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('osm_key', 30).notNullable().unique()
      // water = eau potable, toilets = toilettes
      table.string('kind', 20).notNullable()
      table.string('name', 255).nullable()
      table.double('lat').notNullable()
      table.double('lon').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['lat', 'lon'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
