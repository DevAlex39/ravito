import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Nom français de l'élément Wikidata d'un lieu, mémorisé par les imports (null : pas encore demandé ;
 * vide : pas de nom français, ou élément qui désigne une personne). Sert de nom affiché hors de France
 * quand OpenStreetMap n'a que le nom local (« Vikingskipshuset » → « Musée des navires vikings »).
 */
export default class extends BaseSchema {
  protected tableName = 'pois'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('wikidata_fr', 255).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('wikidata_fr')
    })
  }
}
