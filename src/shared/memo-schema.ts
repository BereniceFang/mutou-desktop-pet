// AIGC START
import { z } from 'zod'

export const memoItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(200),
  createdAt: z.string(),
  remindAt: z.string().nullable().default(null),
  reminded: z.boolean().default(false),
  done: z.boolean().default(false),
  repeat: z.enum(['none', 'daily']).optional().default('none'),
  repeatTime: z.string().nullable().optional().default(null),
  lastRemindDate: z.string().nullable().optional().default(null),
})

export const memoFileSchema = z.object({
  version: z.literal(1),
  items: z.array(memoItemSchema),
})

export type MemoItem = z.infer<typeof memoItemSchema>
export type MemoFile = z.infer<typeof memoFileSchema>
// AIGC END
