import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pays de chaque lieu (code ISO à deux lettres : fr, jp…), rempli par les imports.
 * Chaque import ne nettoie que son pays. Vide pour les lieux mis en cache depuis Overpass
 * et pour ceux importés avant cette colonne (tous en France).
 */
export default class extends BaseSchema {
  protected tableName = 'pois'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('country', 2).nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('country')
    })
  }
}
