import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

// Default "from" address — must be a verified domain in Resend,
// or use "onboarding@resend.dev" for testing.
export const EMAIL_FROM = process.env.EMAIL_FROM ?? 'SFMC Help Desk <notifications@resend.dev>'
