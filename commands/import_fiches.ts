import { createHash } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

const USER_AGENT = 'Alpast/0.1 (https://alpastudio.fr; contact@alpastudio.fr)'
/** Largeur des miniatures : une taille standard de Wikimedia (déjà calculée chez eux, et celle de la fiche actuelle) */
const THUMB = 330
/** Une fiche est redemandée au bout de ce délai */
const REFRESH_DAYS = 30

/** Pays : code des lieux en base, dossier des données, langues des fiches (la première sert de repère d'avancement) */
const PAYS: Record<string, { code: string, dossier: string, langs: string[] }> = {
  france: { code: 'fr', dossier: 'europe/france', langs: ['fr', 'en'] },
  japon: { code: 'jp', dossier: 'asie/japon', langs: ['fr', 'en', 'ja'] },
}

interface Entity { photo: string | null, descriptions: Map<string, string>, articles: Map<string, string> }
interface Article { extract: string | null, image: string | null }

/**
 * Stocke les fiches des lieux d'un pays : description Wikidata et résumé Wikipédia dans chaque langue,
 * miniature Wikimedia Commons avec son auteur et sa licence. Reprend là où il s'est arrêté (fiches de moins de 30 jours ignorées).
 *   node ace import:fiches --pays=japon
 */
export default class ImportFiches extends BaseCommand {
  static commandName = 'import:fiches'
  static description = 'Stocke les fiches des lieux (résumés Wikipédia, descriptions Wikidata, miniatures Commons)'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: `Pays (${Object.keys(PAYS).join(', ')})`, default: 'france' })
  declare pays: string

  @flags.boolean({ description: 'Textes seulement, sans télécharger les photos' })
  declare sansPhotos: boolean

  @flags.number({ description: 'Nombre maximum de lieux traités (pour un essai)' })
  declare limite?: number

  private lastCall = 0

  async run() {
    const pays = PAYS[this.pays]
    if (!pays) {
      this.logger.error(`Pays inconnu : ${this.pays}`)
      this.exitCode = 1
      return
    }
    const root = env.get('FICHES_PHOTOS')
    if (!this.sansPhotos && !root) {
      this.logger.error('FICHES_PHOTOS manquant dans .env (racine des données par pays), ou --sans-photos')
      this.exitCode = 1
      return
    }

    const ids = await this.todo(pays.code, pays.langs[0]!)
    this.logger.info(`${ids.length} lieux Wikidata à traiter (${this.pays})`)
    let photos = 0
    let texts = 0
    for (let k = 0; k < ids.length; k += 500) {
      const batch = ids.slice(k, k + 500)
      const entities = await this.entities(batch, pays.langs)
      const articles = new Map<string, Map<string, Article>>()
      for (const lang of pays.langs) {
        const titles = [...entities.values()].map(e => e.articles.get(lang)).filter((t): t is string => !!t)
        articles.set(lang, await this.articles(lang, titles))
      }
      texts += await this.saveCards(batch, entities, articles, pays.langs)
      if (!this.sansPhotos) photos += await this.savePhotos(entities, articles, pays.langs, root!, pays.dossier)
      this.logger.info(`${Math.min(k + 500, ids.length)} / ${ids.length} lieux — ${texts} textes, ${photos} photos`)
    }
    this.logger.success(`Fiches à jour : ${texts} textes, ${photos} photos`)
  }

  /** Lieux du pays reliés à Wikidata dont la fiche manque ou a plus de 30 jours */
  private async todo(code: string, lang: string): Promise<string[]> {
    const old = new Date(Date.now() - REFRESH_DAYS * 86_400_000)
    const query = db.from('pois as p')
      .leftJoin('place_cards as c', q => q.on('c.wikidata', 'p.wikidata').andOnVal('c.lang', lang))
      .whereNotNull('p.wikidata')
      // Lieux importés avant la colonne « country » : tous français
      .where(w => code === 'fr' ? w.where('p.country', code).orWhereNull('p.country') : w.where('p.country', code))
      .where(w => w.whereNull('c.wikidata').orWhere('c.fetched_at', '<', old))
      .distinct('p.wikidata')
    if (this.limite) query.limit(this.limite)
    return (await query as { wikidata: string }[]).map(r => r.wikidata)
  }

  /** Photo, descriptions et titres d'articles de chaque élément : API Wikidata, 50 éléments par requête */
  private async entities(ids: string[], langs: string[]): Promise<Map<string, Entity>> {
    const result = new Map<string, Entity>(ids.map(q => [q, { photo: null, descriptions: new Map(), articles: new Map() }]))
    for (let k = 0; k < ids.length; k += 50) {
      const params = new URLSearchParams({
        action: 'wbgetentities', ids: ids.slice(k, k + 50).join('|'), props: 'descriptions|claims|sitelinks',
        languages: langs.join('|'), sitefilter: langs.map(l => `${l}wiki`).join('|'), format: 'json', maxlag: '5',
      })
      const json = await this.fetchJson(`https://www.wikidata.org/w/api.php?${params}`) as {
        entities?: Record<string, {
          descriptions?: Record<string, { value: string }>
          claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] }
          sitelinks?: Record<string, { title: string }>
        }>
      }
      for (const [q, raw] of Object.entries(json.entities ?? {})) {
        const entity = result.get(q)
        if (!entity) continue
        entity.photo = raw.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null
        for (const lang of langs) {
          const desc = raw.descriptions?.[lang]?.value
          if (desc) entity.descriptions.set(lang, desc)
          const title = raw.sitelinks?.[`${lang}wiki`]?.title
          if (title) entity.articles.set(lang, title)
        }
      }
    }
    return result
  }

  /** Résumé (introduction en texte brut) et image principale de chaque article : 20 articles par requête */
  private async articles(lang: string, titles: string[]): Promise<Map<string, Article>> {
    const result = new Map<string, Article>()
    for (let k = 0; k < titles.length; k += 20) {
      const batch = titles.slice(k, k + 20)
      const params = new URLSearchParams({
        action: 'query', prop: 'extracts|pageimages', exintro: '1', explaintext: '1', exlimit: '20',
        piprop: 'name', redirects: '1', titles: batch.join('|'), format: 'json', formatversion: '2', maxlag: '5',
      })
      const json = await this.fetchJson(`https://${lang}.wikipedia.org/w/api.php?${params}`) as {
        query?: {
          normalized?: { from: string, to: string }[]
          redirects?: { from: string, to: string }[]
          pages?: { title: string, extract?: string, pageimage?: string, missing?: boolean }[]
        }
      }
      const pages = new Map((json.query?.pages ?? []).filter(p => !p.missing).map(p => [p.title, p]))
      const follow = (t: string) => {
        for (const step of [json.query?.normalized, json.query?.redirects]) t = step?.find(s => s.from === t)?.to ?? t
        return t
      }
      for (const title of batch) {
        const page = pages.get(follow(title))
        if (page) result.set(title, { extract: page.extract?.trim() || null, image: page.pageimage?.replace(/_/g, ' ') ?? null })
      }
    }
    return result
  }

  /** Une ligne par lieu et par langue (même vide : le lieu est marqué comme traité) */
  private async saveCards(ids: string[], entities: Map<string, Entity>, articles: Map<string, Map<string, Article>>, langs: string[]) {
    const now = new Date()
    const rows = ids.flatMap(q => langs.map((lang) => {
      const e = entities.get(q)!
      const title = e.articles.get(lang)
      const extract = title ? articles.get(lang)!.get(title)?.extract ?? null : null
      return {
        wikidata: q,
        lang,
        description: e.descriptions.get(lang)?.slice(0, 500) ?? null,
        extract,
        article_url: title ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` : null,
        fetched_at: now,
      }
    }))
    const knex = db.connection().getWriteClient()
    for (let k = 0; k < rows.length; k += 500) {
      await knex.table('place_cards').insert(rows.slice(k, k + 500)).onConflict(['wikidata', 'lang']).merge(['description', 'extract', 'article_url', 'fetched_at'])
    }
    return rows.filter(r => r.extract || r.description).length
  }

  /** Photo Wikidata, sinon image principale de l'article (dans l'ordre des langues) ; miniature téléchargée chez nous */
  private async savePhotos(entities: Map<string, Entity>, articles: Map<string, Map<string, Article>>, langs: string[], root: string, dossier: string) {
    const chosen = new Map<string, string>()
    for (const [q, e] of entities) {
      let file = e.photo
      for (const lang of langs) {
        const title = e.articles.get(lang)
        file ??= title ? articles.get(lang)!.get(title)?.image ?? null : null
      }
      if (file) chosen.set(q, file)
    }
    const infos = await this.photoInfos([...new Set(chosen.values())])
    const knex = db.connection().getWriteClient()
    let saved = 0
    for (const [q, file] of chosen) {
      const info = infos.get(file)
      if (!info) continue
      const hash = createHash('sha1').update(file).digest('hex')
      const ext = /\.(jpe?g|png|gif|webp)$/i.exec(info.url)?.[1]?.toLowerCase().replace('jpeg', 'jpg') ?? 'jpg'
      const path = `${dossier}/fiches/photos/${hash.slice(0, 2)}/${hash}.${ext}`
      const target = join(root, path)
      if (!(await exists(target))) {
        const res = await this.fetchRaw(info.url)
        if (!res) continue
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, res)
      }
      await knex.table('place_photos')
        .insert({ wikidata: q, file: file.slice(0, 255), path, author: info.author, license: info.license, fetched_at: new Date() })
        .onConflict('wikidata').merge(['file', 'path', 'author', 'license', 'fetched_at'])
      saved++
    }
    return saved
  }

  /** Adresse de la miniature, auteur et licence de chaque fichier Commons : 50 fichiers par requête */
  private async photoInfos(files: string[]): Promise<Map<string, { url: string, author: string | null, license: string | null }>> {
    const result = new Map<string, { url: string, author: string | null, license: string | null }>()
    for (let k = 0; k < files.length; k += 50) {
      const batch = files.slice(k, k + 50)
      const params = new URLSearchParams({
        action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(THUMB),
        iiextmetadatafilter: 'Artist|LicenseShortName', titles: batch.map(f => `File:${f}`).join('|'),
        format: 'json', formatversion: '2', maxlag: '5',
      })
      const json = await this.fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`) as {
        query?: {
          normalized?: { from: string, to: string }[]
          pages?: { title: string, imageinfo?: { thumburl?: string, url?: string, extmetadata?: Record<string, { value?: string }> }[] }[]
        }
      }
      const pages = new Map((json.query?.pages ?? []).map(p => [p.title, p]))
      for (const file of batch) {
        const asked = `File:${file}`
        const title = json.query?.normalized?.find(n => n.from === asked)?.to ?? asked
        const info = pages.get(title)?.imageinfo?.[0]
        const url = info?.thumburl ?? info?.url
        if (!url) continue
        result.set(file, {
          url,
          author: plain(info?.extmetadata?.Artist?.value)?.slice(0, 255) ?? null,
          license: plain(info?.extmetadata?.LicenseShortName?.value)?.slice(0, 64) ?? null,
        })
      }
    }
    return result
  }

  /** Requête JSON polie : une à la fois, 150 ms d'écart, nouvel essai si Wikimedia demande d'attendre */
  private async fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
    for (let attempt = 1; ; attempt++) {
      await this.pace()
      try {
        const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers }, signal: AbortSignal.timeout(120_000) })
        const json = res.ok ? await res.json() as { error?: { code?: string } } : null
        if (json && json.error?.code !== 'maxlag') return json
        if (attempt >= 6) throw new Error(`${res.status} ${json?.error?.code ?? ''} sur ${url.slice(0, 80)}`)
      }
      catch (e) {
        if (attempt >= 6) throw e
      }
      await sleep(attempt * 10_000)
    }
  }

  /** Fichier (miniature) ; null après plusieurs échecs : la photo sera retentée au prochain passage */
  private async fetchRaw(url: string): Promise<Buffer | null> {
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.pace()
      try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) })
        if (res.ok) return Buffer.from(await res.arrayBuffer())
        if (res.status === 404) return null
      }
      catch {
        // Réseau : nouvel essai
      }
      await sleep(attempt * 15_000)
    }
    this.logger.warning(`Miniature non récupérée : ${url}`)
    return null
  }

  private async pace() {
    const wait = this.lastCall + 150 - Date.now()
    if (wait > 0) await sleep(wait)
    this.lastCall = Date.now()
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function exists(path: string) {
  return access(path).then(() => true, () => false)
}

/** Texte brut d'une valeur Commons (souvent un lien HTML vers la page de l'auteur) */
function plain(html?: string): string | null {
  if (!html) return null
  const text = html.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim()
  return text || null
}
