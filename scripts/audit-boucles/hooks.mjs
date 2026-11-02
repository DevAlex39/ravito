// Fait tourner le code du site (inertia/utils/*.ts) sous Node : alias « ~/ », extensions .ts, import.meta.env
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const INERTIA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../inertia') + path.sep

export async function resolve(spec, ctx, next) {
  if (spec.startsWith('~/')) return next(pathToFileURL(INERTIA + spec.slice(2) + '.ts').href, ctx)
  if (spec.startsWith('./') && ctx.parentURL?.includes('/inertia/') && !spec.endsWith('.ts')) return next(spec + '.ts', ctx)
  return next(spec, ctx)
}

export async function load(url, ctx, next) {
  const r = await next(url, ctx)
  if (url.includes('/inertia/') && url.endsWith('.ts')) r.source = String(r.source).replace(/import\.meta\.env\.\w+/g, 'undefined')
  return r
}
