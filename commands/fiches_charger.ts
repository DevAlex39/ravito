import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'
import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

const TABLES: Record<string, { key: string[], cols: string[] }> = {
  place_cards: { key: ['wikidata', 'lang'], cols: ['description', 'extract', 'article_url', 'fetched_at'] },
  place_photos: { key: ['wikidata'], cols: ['file', 'path', 'author', 'license', 'fetched_at'] },
}

/**
 * Charge les fiches exportées par fiches:exporter (textes et références des photos) ; une fiche déjà présente est remplacée.
 *   node ace fiches:charger fiches.jsonl.gz
 */
export default class FichesCharger extends BaseCommand {
  static commandName = 'fiches:charger'
  static description = 'Charge les fiches des lieux exportées par fiches:exporter'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Fichier écrit par fiches:exporter (.jsonl.gz)' })
  declare fichier: string

  async run() {
    const knex = db.connection().getWriteClient()
    const pending: Record<string, Record<string, unknown>[]> = { place_cards: [], place_photos: [] }
    const counts: Record<string, number> = { place_cards: 0, place_photos: 0 }
    let bad = 0
    const flush = async (table: string) => {
      const rows = pending[table]!
      if (!rows.length) return
      const { key, cols } = TABLES[table]!
      await knex.table(table).insert(rows).onConflict(key).merge(cols)
      counts[table]! += rows.length
      pending[table] = []
    }
    const lines = createInterface({ input: createReadStream(this.fichier).pipe(createGunzip()), crlfDelay: Infinity })
    for await (const line of lines) {
      if (!line) continue
      let parsed: { table: string, row: Record<string, unknown> }
      try {
        parsed = JSON.parse(line)
      }
      catch {
        bad++
        continue
      }
      const { table, row } = parsed
      const spec = TABLES[table]
      if (!spec) continue
      // Seules les colonnes connues ; dates relues depuis le texte JSON
      const clean: Record<string, unknown> = {}
      for (const col of [...spec.key, ...spec.cols]) clean[col] = col === 'fetched_at' ? new Date(row[col] as string) : row[col] ?? null
      pending[table]!.push(clean)
      if (pending[table]!.length >= 500) await flush(table)
    }
    for (const table of Object.keys(pending)) await flush(table)
    if (bad) this.logger.warning(`${bad} lignes illisibles ignorées`)
    this.logger.success(`Fiches chargées : ${counts.place_cards} textes, ${counts.place_photos} photos`)
  }
}
