import { BaseSchema } from '@adonisjs/lucid/schema'

/** Origine d'une case : « overpass » (renouvelée après 30 jours) ou « import » (extrait OSM, définitive) */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('poi_cells', (table) => {
      table.string('source', 10).notNullable().defaultTo('overpass')
    })
  }

  async down() {
    this.schema.alterTable('poi_cells', (table) => {
      table.dropColumn('source')
    })
  }
}
