import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fiches des lieux stockées chez nous (commande import:fiches), pour ne plus interroger Wikipédia à chaque clic.
 *   place_cards  : un texte par lieu Wikidata et par langue (description Wikidata, résumé Wikipédia CC BY-SA)
 *   place_photos : une miniature par lieu (Wikimedia Commons), avec son auteur et sa licence
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('place_cards', (table) => {
      table.string('wikidata', 16).notNullable()
      table.string('lang', 8).notNullable()
      table.string('description', 500).nullable()
      table.text('extract').nullable()
      table.string('article_url', 500).nullable()
      table.timestamp('fetched_at').notNullable()
      table.primary(['wikidata', 'lang'])
    })
    this.schema.createTable('place_photos', (table) => {
      table.string('wikidata', 16).primary()
      table.string('file', 255).notNullable()
      /** Chemin de la miniature sous FICHES_PHOTOS : <continent>/<pays>/fiches/photos/ab/<empreinte>.jpg */
      table.string('path', 200).notNullable()
      table.string('author', 255).nullable()
      table.string('license', 64).nullable()
      table.timestamp('fetched_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable('place_photos')
    this.schema.dropTable('place_cards')
  }
}
