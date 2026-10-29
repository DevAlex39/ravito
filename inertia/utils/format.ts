export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 3725 s → "1h02" (ou "45 min" sous l'heure) */
export function formatDuration(sec: number): string {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h${pad(m % 60)}`
}

/** Secondes depuis minuit → "14:05" (avec "J+1" si on passe minuit) */
export function formatClock(sec: number): string {
  const total = Math.round(sec / 60)
  const day = Math.floor(total / 1440)
  const m = ((total % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}${day > 0 ? ` J+${day}` : ''}`
}

/** Secondes par km → "5:30" */
export function formatPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '–'
  const s = Math.round(secPerKm)
  return `${Math.floor(s / 60)}:${pad(s % 60)}`
}

/** Mètres → "12,4" (km) */
export function formatKm(m: number, digits = 1): string {
  return (m / 1000).toFixed(digits).replace('.', ',')
}

/** Écart en secondes → "+1h05" / "−12 min" */
export function formatMargin(sec: number): string {
  return (sec < 0 ? '−' : '+') + formatDuration(Math.abs(sec))
}

/** Allure "5:30" (min:s) → 330 s/km */
export function parsePace(txt: string): number | null {
  const m = txt.trim().match(/^(\d{1,2})\s*[:'’]\s*(\d{1,2})"?$/)
  if (!m) return null
  const s = Number(m[2])
  if (s >= 60) return null
  return Number(m[1]) * 60 + s
}

/** Durée ou heure "h:mm[:ss]", "1h30", "14:05" → secondes */
export function parseTime(txt: string): number | null {
  const parts = txt.trim().toLowerCase().replace(/[hm]/g, ':').replace(/s$/, '').split(':')
  if (parts[parts.length - 1] === '') parts.pop()
  if (!parts.length || parts.length > 3 || parts.some(p => !/^\d+$/.test(p.trim()))) return null
  const [h = 0, m = 0, s = 0] = parts.map(Number)
  if (m >= 60 || s >= 60) return null
  return h * 3600 + m * 60 + s
}
