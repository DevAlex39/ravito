import env from '#start/env'

export type Provider = 'google' | 'strava'

/** Ce que l'on garde du compte Google ou Strava */
export interface OAuthProfile {
  id: string
  /** Seulement si le fournisseur l'a vérifiée (Strava ne la donne jamais) */
  email: string | null
  name: string | null
}

interface ProviderConfig {
  authorizeUrl: string
  tokenUrl: string
  scope: string
  clientId?: string
  clientSecret?: string
  extraParams?: Record<string, string>
  profile: (token: Record<string, any>) => Promise<OAuthProfile>
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    clientId: env.get('GOOGLE_CLIENT_ID'),
    clientSecret: env.get('GOOGLE_CLIENT_SECRET'),
    extraParams: { prompt: 'select_account' },
    async profile(token) {
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })
      if (!res.ok) throw new Error('Profil Google illisible')
      const u = await res.json() as { sub: string, email?: string, email_verified?: boolean, name?: string }
      return { id: u.sub, email: u.email && u.email_verified ? u.email.toLowerCase() : null, name: u.name ?? null }
    },
  },
  strava: {
    authorizeUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
    scope: 'read',
    clientId: env.get('STRAVA_CLIENT_ID'),
    clientSecret: env.get('STRAVA_CLIENT_SECRET'),
    extraParams: { approval_prompt: 'auto' },
    // Strava renvoie l'athlète avec le jeton
    async profile(token) {
      const a = token.athlete as { id?: number, firstname?: string, lastname?: string } | undefined
      if (!a?.id) throw new Error('Profil Strava illisible')
      return { id: String(a.id), email: null, name: [a.firstname, a.lastname].filter(Boolean).join(' ') || null }
    },
  },
}

export function enabledProviders(): Record<Provider, boolean> {
  return {
    google: !!(PROVIDERS.google.clientId && PROVIDERS.google.clientSecret),
    strava: !!(PROVIDERS.strava.clientId && PROVIDERS.strava.clientSecret),
  }
}

export function authorizeUrl(provider: Provider, redirectUri: string, state: string) {
  const p = PROVIDERS[provider]
  const params = new URLSearchParams({
    client_id: p.clientId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: p.scope,
    state,
    ...p.extraParams,
  })
  return `${p.authorizeUrl}?${params}`
}

/** Échange le code reçu au retour contre le profil de l'utilisateur */
export async function fetchProfile(provider: Provider, code: string, redirectUri: string): Promise<OAuthProfile> {
  const p = PROVIDERS[provider]
  const res = await fetch(p.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      client_id: p.clientId!,
      client_secret: p.clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) throw new Error(`Échange du code refusé (${res.status})`)
  return p.profile(await res.json() as Record<string, any>)
}
