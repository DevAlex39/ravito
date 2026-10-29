import vine from '@vinejs/vine'

/** Plan envoyé par le navigateur : un résumé pour la liste + l'état complet sérialisé */
export const planValidator = vine.create(
  vine.object({
    name: vine.string().trim().maxLength(200),
    distance: vine.number().min(0),
    gain: vine.number().min(0),
    duration: vine.number().min(0).nullable(),
    // Envoyé en texte JSON : le bodyparser ne touche pas aux chaînes vides qu'il contient
    data: vine.string().maxLength(20_000_000),
  }),
)
