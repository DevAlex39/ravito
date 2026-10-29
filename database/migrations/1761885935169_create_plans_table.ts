import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'plans'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 200).notNullable()

      // Résumé affiché dans « Mes parcours » (évite de relire tout le plan)
      table.integer('distance').unsigned().notNullable()
      table.integer('gain').unsigned().notNullable()
      table.integer('duration').unsigned().nullable()

      // Le plan complet tel que l'enregistre le navigateur (GPX compris)
      table.text('data', 'longtext').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['user_id', 'updated_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
