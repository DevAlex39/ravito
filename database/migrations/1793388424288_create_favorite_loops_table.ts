import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Boucles favorites (étoile sur la page Boucles) : le lien de la boucle et de quoi l'afficher
 * dans « Mes parcours ». Supprimées avec le compte.
 */
export default class extends BaseSchema {
  protected tableName = 'favorite_loops'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      // Paramètres de la page /boucles, sans le « ? »
      table.text('query').notNullable()
      table.string('query_hash', 64).notNullable()
      table.string('name', 120).notNullable()
      table.integer('distance').unsigned().notNullable()
      table.integer('gain').unsigned().notNullable()
      table.smallint('stops').unsigned().notNullable()
      table.timestamp('created_at').notNullable()
      table.unique(['user_id', 'query_hash'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
