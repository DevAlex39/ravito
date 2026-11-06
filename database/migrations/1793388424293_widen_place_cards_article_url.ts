import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adresse de l'article Wikipédia : les titres en thaï, coréen… encodés dans l'URL dépassent 500 caractères
 * (9 caractères par lettre thaï). 2000 suffit largement.
 */
export default class extends BaseSchema {
  protected tableName = 'place_cards'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('article_url', 2000).nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('article_url', 500).nullable().alter()
    })
  }
}
