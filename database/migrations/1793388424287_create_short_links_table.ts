import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Liens courts des boucles partagées (/b/<code>) : le lien complet d'une boucle (départ, points de passage,
 * lieux…) dépasse souvent 300 caractères. Un même lien donne toujours le même code.
 */
export default class extends BaseSchema {
  protected tableName = 'short_links'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('code', 12).notNullable().unique()
      // Paramètres de la page /boucles, sans le « ? »
      table.text('query').notNullable()
      // Empreinte SHA-256 des paramètres : retrouve le code d'un lien déjà raccourci
      table.string('query_hash', 64).notNullable().unique()
      table.integer('hits').unsigned().notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('last_used_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
