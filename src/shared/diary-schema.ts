// AIGC START
import { z } from 'zod'

const relationshipTierSchema = z.enum(['low', 'mid', 'high'])

export const diaryEventSchema = z.object({
  id: z.string(),
  dateKey: z.string(),
  type: z.enum(['day_visit', 'interaction', 'feed', 'focus_start', 'focus_complete', 'focus_interrupt', 'mood_checkin']),
  timestamp: z.string(),
  payload: z
    .object({
      foodType: z.string().optional(),
      plannedDurationMinutes: z.number().optional(),
      actualDurationMinutes: z.number().optional(),
      relationshipTier: relationshipTierSchema.optional(),
      userMood: z.string().optional(),
    })
    .optional(),
})

export const diaryEventsFileSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    appFirstOpenDate: z.string(),
    /** 缺省时由运行时补默认并回写 */
    firstEncounterDate: z.string().optional(),
    lastFinalizedDate: z.string().nullable(),
  }),
  events: z.array(diaryEventSchema),
})

export const diaryEntrySchema = z.object({
  dateKey: z.string(),
  title: z.string(),
  moodTag: z.string(),
  paragraphs: z.array(z.string()),
  highlights: z.array(z.string()),
  finalized: z.boolean(),
  cacheKey: z.string().optional(),
})

export const diaryEntriesFileSchema = z.object({
  version: z.literal(1),
  byDate: z.record(z.string(), diaryEntrySchema),
})

export const dailyDiarySummarySchema = z.object({
  dateKey: z.string(),
  narrativeKind: z.enum(['prelude_stranger', 'first_encounter', 'absence', 'normal']),
  absence: z.boolean(),
  relationshipTier: relationshipTierSchema,
  interactionCount: z.number().int().min(0),
  fedFoodLabels: z.array(z.string()),
  focusStartedCount: z.number().int().min(0),
  focusCompletedCount: z.number().int().min(0),
  focusInterruptedCount: z.number().int().min(0),
  userMood: z.string().nullable().optional().default(null),
})

export const diarySummariesFileSchema = z.object({
  version: z.literal(1),
  byDate: z.record(z.string(), dailyDiarySummarySchema),
})

export const diaryTemplatesSchema = z.object({
  version: z.literal(1),
  moodTags: z.object({
    warm: z.array(z.string()),
    soft: z.array(z.string()),
    playful: z.array(z.string()),
    quiet: z.array(z.string()),
    miss: z.array(z.string()),
    stranger: z.array(z.string()),
  }),
  title: z.object({
    low: z.array(z.string()),
    mid: z.array(z.string()),
    high: z.array(z.string()),
  }),
  opening: z.array(z.string()),
  interactionNone: z.array(z.string()),
  interactionLight: z.array(z.string()),
  interactionBusy: z.array(z.string()),
  interactionSpam: z.array(z.string()),
  feedLine: z.array(z.string()),
  focusSuccess: z.array(z.string()),
  focusMixed: z.array(z.string()),
  focusRegret: z.array(z.string()),
  closing: z.array(z.string()),
  absenceTitle: z.array(z.string()),
  absenceBody: z.array(z.string()),
  absenceClosing: z.array(z.string()),
  preludeTitle: z.array(z.string()),
  preludeBody: z.array(z.string()),
  preludeClosing: z.array(z.string()),
  firstMeetTitle: z.array(z.string()),
  firstMeetOpening: z.array(z.string()),
  firstMeetQuiet: z.array(z.string()),
  firstMeetClosing: z.array(z.string()),
  moodCheckinGreat: z.array(z.string()).optional().default([]),
  moodCheckinOk: z.array(z.string()).optional().default([]),
  moodCheckinTired: z.array(z.string()).optional().default([]),
  moodCheckinSad: z.array(z.string()).optional().default([]),
})

export type DiaryEvent = z.infer<typeof diaryEventSchema>
export type DiaryEventsFile = z.infer<typeof diaryEventsFileSchema>
export type DiaryEntry = z.infer<typeof diaryEntrySchema>
export type DiaryEntriesFile = z.infer<typeof diaryEntriesFileSchema>
export type DailyDiarySummary = z.infer<typeof dailyDiarySummarySchema>
export type DiarySummariesFile = z.infer<typeof diarySummariesFileSchema>
export type DiaryTemplates = z.infer<typeof diaryTemplatesSchema>
// AIGC END
