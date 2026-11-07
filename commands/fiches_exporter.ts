import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { createGzip } from 'node:zlib'
import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import { countryNamed } from '#services/countries'

/**
 * Exporte les fiches stockées (textes et références des photos) des pays choisis, pour les recharger sur le serveur
 * avec fiches:charger sans tout redemander à Wikipédia. Les miniatures elles-mêmes s'envoient à part (fichiers).
 *   node ace fiches:exporter fiches.jsonl.gz italie espagne reunion
 */
export default class FichesExporter extends BaseCommand {
  static commandName = 'fiches:exporter'
  static description = 'Exporte les fiches des lieux de quelques pays (fichier .jsonl.gz pour fiches:charger)'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Fichier à écrire (.jsonl.gz)' })
  declare fichier: string

  @args.spread({ description: 'Pays, tels que nommés dans config/pays.json' })
  declare pays: string[]

  async run() {
    const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x85, 0x2028, 0x2029)}]`, 'g')
    const countries = this.pays.map(p => ({ p, c: countryNamed(p) }))
    const unknown = countries.filter(x => !x.c).map(x => x.p)
    if (unknown.length) {
      this.logger.error(`Pays inconnus : ${unknown.join(', ')} (voir config/pays.json)`)
      this.exitCode = 1
      return
    }
    const gz = createGzip()
    const out = gz.pipe(createWriteStream(this.fichier))
    // Séparateurs de ligne Unicode laissés tels quels par JSON.stringify : la relecture ligne par ligne y couperait
    const write = async (line: string) => {
      const safe = line.replace(LINE_SEPARATORS, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
      if (!gz.write(safe + '\n')) await once(gz, 'drain')
    }
    for (const { p, c } of countries) {
      const { code, continent, dossier } = c!
      // Lieux importés avant la colonne « country » : tous français
      const ofCountry = db.from('pois').select('wikidata').whereNotNull('wikidata')
        .where(w => code === 'fr' ? w.where('country', code).orWhereNull('country') : w.where('country', code))
      const cards = await db.from('place_cards').whereIn('wikidata', ofCountry)
      for (const row of cards) await write(JSON.stringify({ table: 'place_cards', row }))
      const photos = await db.from('place_photos').where('path', 'like', `${continent}/${dossier}/%`)
      for (const row of photos) await write(JSON.stringify({ table: 'place_photos', row }))
      this.logger.info(`${p} : ${cards.length} textes, ${photos.length} photos`)
    }
    gz.end()
    await once(out, 'finish')
    this.logger.success(`Fiches exportées dans ${this.fichier}`)
  }
}
