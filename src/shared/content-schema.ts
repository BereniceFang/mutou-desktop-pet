// AIGC START
import { z } from 'zod'
import { FOOD_CATALOG } from './food-catalog.js'

const personalDateItemSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1).max(32),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    kind: z.enum(['birthday', 'anniversary', 'other']),
  })
  .superRefine((data, ctx) => {
    const maxDay = new Date(2024, data.month, 0).getDate()
    if (data.day > maxDay) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '日期与月份不符', path: ['day'] })
    }
  })

const dialogueTypes = [
  'interaction',
  'interaction_repeat',
  'interaction_double',
  'interaction_long_press',
  'interaction_context_menu',
  'interaction_comfort',
  'interaction_comfort_light',
  'interaction_comfort_heavy',
  'interaction_drag',
  'idle',
  'idle_comfort',
  'idle_morning',
  'idle_noon',
  'idle_afternoon',
  'idle_evening',
  'idle_night',
  ...FOOD_CATALOG.map((item) => `feed_food_${item.id}`),
  'feed_sweet',
  'feed_fruit',
  'feed_drink',
  'feed_savory',
  'feed_meal',
  'feed_repeat',
  'feed_reject_full',
  'focus_start',
  'focus_progress',
  'focus_during_interaction',
  'focus_complete',
  'focus_interrupt',
  'idle_holiday_birthday_mutou',
  'interaction_holiday_birthday_mutou',
  'idle_holiday_new_year',
  'interaction_holiday_new_year',
  'idle_holiday_festival',
  'interaction_holiday_festival',
  'idle_personal_milestone',
  'interaction_personal_milestone',
  'idle_hunger_hint',
  'interaction_hunger_hint',
  'interaction_tier_up_mid',
  'interaction_tier_up_high',
] as const

/** 供调试面板等列出全部台词类型（与 DialogueType 对齐） */
export const ALL_DIALOGUE_TYPES = dialogueTypes

export const dialogueLineSchema = z.object({
  id: z.string(),
  type: z.enum(dialogueTypes),
  relationshipTier: z.enum(['low', 'mid', 'high']).optional(),
  text: z.string(),
  expressionHint: z.string(),
  motionHint: z.string(),
})

export const contentBundleSchema = z.object({
  dialogues: z.array(dialogueLineSchema).min(1),
})

export const settingsSchema = z.object({
  alwaysOnTop: z.boolean(),
  opacity: z.number().min(0.4).max(1),
  speechEnabled: z.boolean(),
  /** 关闭后深夜时段随机待机不再优先使用 idle_night 台词池 */
  nightComfortEnabled: z.boolean().default(true),
  disturbanceLevel: z.enum(['low', 'medium', 'high']),
  bubbleStyle: z.object({
    backgroundColor: z.string(),
    borderColor: z.string(),
    borderWidth: z.number().min(0).max(12),
    textColor: z.string(),
  }),
  userNickname: z.string().max(16).default(''),
  personalDates: z.array(personalDateItemSchema).max(8).default([]),
})

export const focusSessionSchema = z.object({
  sessionId: z.string(),
  status: z.enum(['idle', 'in_progress']),
  startAt: z.string().nullable(),
  plannedDurationMinutes: z.number().nullable(),
  lastHeartbeatAt: z.string().nullable(),
  goal: z.string().nullable().optional().default(null),
})

const focusSessionReviewToneSchema = z.enum(['done', 'partial', 'enough'])

export const petStatsSchema = z.object({
  favorability: z.number(),
  tacit: z.number(),
  mood: z.number(),
  energy: z.number(),
  companionDays: z.number(),
  interactionCount: z.number(),
  focusCompletedCount: z.number(),
  focusTotalMinutes: z.number().int().min(0).optional().default(0),
  focusInterruptedCount: z.number().int().min(0).optional().default(0),
  lastFocusDurationMinutes: z.number().int().positive().nullable().optional().default(null),
  lastFocusGoal: z.string().nullable().optional().default(null),
  lastFocusReviewTone: focusSessionReviewToneSchema.nullable().optional().default(null),
  feedCount: z.number(),
  nightInteractionCount: z.number().default(0),
  mutouBirthdayCelebrationYear: z.number().int().nullable().optional().default(null),
  newYearCelebrationYear: z.number().int().nullable().optional().default(null),
  festivalDayCelebrationYear: z.number().int().nullable().optional().default(null),
  personalDateCelebrationYears: z.record(z.string(), z.number().int()).optional().default({}),
  satiety: z.number().min(0).max(100).default(80),
  satietyClockAt: z.string().nullable().optional().default(null),
  lastBranchPlotAtInteraction: z.number().default(-1000),
  branchPlotRotation: z.number().int().min(0).default(0),
  visitStreak: z.number().int().min(0).optional().default(0),
  lastVisitDateKey: z.string().nullable().optional().default(null),
  milestones: z.record(z.string(), z.string()).optional().default({}),
})

export const windowPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

export const windowPositionsSchema = z.object({
  desktop: windowPositionSchema.nullable().default(null),
  panel: windowPositionSchema.nullable().default(null),
})

const comfortReasonSchema = z.enum(['focus_interrupt', 'rapid_clicks', 'late_night', 'low_mood', 'low_energy', 'user_request'])

export const comfortStateSchema = z.object({
  lastFocusInterruptAt: z.string().nullable().default(null),
  lastComfortAt: z.string().nullable().default(null),
  lastDetectedReason: comfortReasonSchema.nullable().default(null),
})

const timeGreetingPeriodSchema = z.enum(['morning', 'noon', 'afternoon', 'evening', 'night'])

export const timeGreetingStateSchema = z.object({
  dateKey: z.string().nullable().default(null),
  greetedPeriods: z.array(timeGreetingPeriodSchema).default([]),
})

const pendingBranchPlotChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
})

export const appStateSchema = z.object({
  mainState: z.enum(['idle', 'feedback', 'actionLayer', 'focusMode']),
  relationshipTier: z.enum(['low', 'mid', 'high']),
  journeyStartedAt: z.string().optional(),
  currentExpression: z.string(),
  currentMotion: z.string(),
  lastBubbleText: z.string().nullable(),
  lastInteractionAt: z.string().nullable(),
  lastFeedAt: z.string().nullable().default(null),
  windowPosition: windowPositionSchema.nullable().default(null),
  windowPositions: windowPositionsSchema
    .optional()
    .default({
      desktop: null,
      panel: null,
    }),
  comfortState: comfortStateSchema
    .optional()
    .default({
      lastFocusInterruptAt: null,
      lastComfortAt: null,
      lastDetectedReason: null,
    }),
  timeGreetingState: timeGreetingStateSchema
    .optional()
    .default({
      dateKey: null,
      greetedPeriods: [],
    }),
  settings: settingsSchema,
  focusSession: focusSessionSchema,
  stats: petStatsSchema,
  pendingBranchPlotId: z.string().nullable().default(null),
  pendingBranchPlotChoices: z.array(pendingBranchPlotChoiceSchema).nullable().default(null),
})

export const runtimeStateSchema = appStateSchema.omit({
  settings: true,
})

export type PersonalDateItem = z.infer<typeof personalDateItemSchema>
export type DialogueType = (typeof dialogueTypes)[number]
export type DialogueLine = z.infer<typeof dialogueLineSchema>
export type ContentBundle = z.infer<typeof contentBundleSchema>
export type Settings = z.infer<typeof settingsSchema>
export type FocusSession = z.infer<typeof focusSessionSchema>
export type FocusSessionReviewTone = z.infer<typeof focusSessionReviewToneSchema>
export type PetStats = z.infer<typeof petStatsSchema>
export type WindowPosition = z.infer<typeof windowPositionSchema>
export type WindowPositions = z.infer<typeof windowPositionsSchema>
export type ComfortReason = z.infer<typeof comfortReasonSchema>
export type ComfortState = z.infer<typeof comfortStateSchema>
export type TimeGreetingPeriod = z.infer<typeof timeGreetingPeriodSchema>
export type TimeGreetingState = z.infer<typeof timeGreetingStateSchema>
export type AppState = z.infer<typeof appStateSchema>
export type RuntimeState = z.infer<typeof runtimeStateSchema>
export type PendingBranchPlotChoice = z.infer<typeof pendingBranchPlotChoiceSchema>
// AIGC END
