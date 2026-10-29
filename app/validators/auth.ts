import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const messages = new SimpleMessagesProvider({
  'required': 'Ce champ est obligatoire.',
  'email.email': 'Cette adresse e-mail n\'est pas valide.',
  'password.minLength': 'Le mot de passe doit faire au moins {{ min }} caractères.',
  'password.maxLength': 'Le mot de passe est trop long.',
  'passwordConfirmation.sameAs': 'Les deux mots de passe ne correspondent pas.',
})

export const signupValidator = vine.create(
  vine.object({
    email: vine.string().trim().toLowerCase().email().maxLength(254),
    password: vine.string().minLength(8).maxLength(100),
  }),
)
signupValidator.messagesProvider = messages

export const loginValidator = vine.create(
  vine.object({
    email: vine.string().trim().toLowerCase(),
    password: vine.string(),
  }),
)
loginValidator.messagesProvider = messages
