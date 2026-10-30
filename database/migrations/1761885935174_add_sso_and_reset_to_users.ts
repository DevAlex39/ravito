import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Compte créé via Google ou Strava : pas de mot de passe, et Strava ne donne pas d'e-mail
      table.string('password').nullable().alter()
      table.string('email', 254).nullable().alter()
      table.string('google_id', 64).nullable().unique()
      table.string('strava_id', 32).nullable().unique()

      // Mot de passe oublié : seule l'empreinte du lien est gardée, valable 1 h
      table.string('reset_token_hash', 64).nullable().index()
      table.timestamp('reset_expires_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('reset_expires_at')
      table.dropColumn('reset_token_hash')
      table.dropColumn('strava_id')
      table.dropColumn('google_id')
    })
  }
}
