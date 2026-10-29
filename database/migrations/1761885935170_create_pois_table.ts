import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Lieux remarquables (OpenStreetMap + notoriété Wikidata), mis en cache par case de grille :
 * chaque secteur n'est demandé qu'une fois aux services publics, la base se complète au fil des recherches.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('pois', (table) => {
      table.increments('id').notNullable()
      // Identifiant OSM : n = nœud, w = chemin, r = relation (ex. « w123456 »)
      table.string('osm_key', 30).notNullable().unique()
      table.string('name', 255).notNullable()
      table.double('lat').notNullable()
      table.double('lon').notNullable()
      table.string('kind', 40).notNullable()
      table.string('wikidata', 20).nullable()
      // Nombre de Wikipédia qui parlent du lieu : bon indicateur de notoriété
      table.integer('sitelinks').unsigned().notNullable().defaultTo(0)
      table.float('score').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['lat', 'lon'])
    })

    this.schema.createTable('poi_cells', (table) => {
      table.string('cell', 30).primary()
      table.timestamp('fetched_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable('poi_cells')
    this.schema.dropTable('pois')
  }
}
