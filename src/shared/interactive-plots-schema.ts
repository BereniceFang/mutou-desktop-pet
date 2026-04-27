// AIGC START
import { z } from 'zod'

const plotChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(48),
  text: z.string().min(1),
  expressionHint: z.string().min(1),
  motionHint: z.string().min(1),
})

export const interactivePlotSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  promptExpressionHint: z.string().min(1).optional(),
  promptMotionHint: z.string().min(1).optional(),
  choices: z.array(plotChoiceSchema).min(2).max(6),
})

export const interactivePlotsBundleSchema = z.object({
  plots: z.array(interactivePlotSchema).min(1),
})

export type InteractivePlotDef = z.infer<typeof interactivePlotSchema>
export type InteractivePlotsBundle = z.infer<typeof interactivePlotsBundleSchema>
// AIGC END
