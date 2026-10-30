import nodemailer from 'nodemailer'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

const APP_NAME = 'AlpaS'

export function canSendMail() {
  return !!(env.get('SMTP_HOST') && env.get('SMTP_USER') && env.get('SMTP_PASS'))
}

/** Envoie le lien de réinitialisation. Sans SMTP en local, le lien est écrit dans la console. */
export async function sendResetMail(to: string, link: string) {
  if (!canSendMail()) {
    if (app.inProduction) throw new Error('SMTP non configuré')
    logger.info(`Mot de passe oublié pour ${to} : ${link}`)
    return
  }
  const port = env.get('SMTP_PORT') ?? 587
  const transport = nodemailer.createTransport({
    host: env.get('SMTP_HOST'),
    port,
    secure: port === 465,
    auth: { user: env.get('SMTP_USER'), pass: env.get('SMTP_PASS') },
  })
  await transport.sendMail({
    from: `"${APP_NAME}" <${env.get('SMTP_USER')}>`,
    to,
    subject: `${APP_NAME} : choisis un nouveau mot de passe`,
    text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable 1 heure) :\n${link}\n\nSi tu n'as rien demandé, ignore ce message : ton mot de passe ne change pas.\n\n${APP_NAME}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#1d2721">
      <h1 style="font-size:20px;color:#24503c">${APP_NAME}</h1>
      <p>Bonjour,</p>
      <p>Pour choisir un nouveau mot de passe, clique sur le bouton ci-dessous. Le lien est valable <strong>1 heure</strong>.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#e2672b;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600">Choisir un nouveau mot de passe</a></p>
      <p style="font-size:13px;color:#6b746e">Si tu n'as rien demandé, ignore ce message : ton mot de passe ne change pas.</p>
    </div>`,
  })
}
