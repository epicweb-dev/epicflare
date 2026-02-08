import { z } from 'zod'

const resendEmailSchema = z.object({
	from: z.string().min(1),
	to: z.union([z.string().min(1), z.array(z.string().min(1))]),
	subject: z.string().min(1),
	html: z.string().min(1),
})

export type ResendEmail = z.infer<typeof resendEmailSchema>

export { resendEmailSchema }
