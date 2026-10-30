import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('plans', (table) => {
      // Partagé : visible de tous, proposé autour de son point de départ
      table.boolean('is_public').notNullable().defaultTo(false)
      table.double('start_lat').nullable()
      table.double('start_lon').nullable()
      table.index(['is_public', 'start_lat', 'start_lon'])
    })

    // Un vote par compte et par parcours
    this.schema.createTable('plan_votes', (table) => {
      table.integer('plan_id').unsigned().notNullable().references('id').inTable('plans').onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.timestamp('created_at').notNullable()
      table.primary(['plan_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTable('plan_votes')
    this.schema.alterTable('plans', (table) => {
      table.dropIndex(['is_public', 'start_lat', 'start_lon'])
      table.dropColumn('is_public')
      table.dropColumn('start_lat')
      table.dropColumn('start_lon')
    })
  }
}
