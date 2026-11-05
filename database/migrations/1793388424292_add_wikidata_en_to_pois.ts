import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Nom anglais de l'élément Wikidata d'un lieu (null : pas encore demandé ; vide : aucun). Secours pour les lieux
 * dont le nom local est dans une écriture illisible pour nous (japonais…) et qui n'ont pas de nom français.
 */
export default class extends BaseSchema {
  protected tableName = 'pois'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('wikidata_en', 255).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('wikidata_en')
    })
  }
}
