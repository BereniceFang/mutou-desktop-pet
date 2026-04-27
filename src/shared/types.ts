// AIGC START
export type { RelationshipTier, FoodCategory, FoodCatalogItem } from './food-catalog.js'

export type {
  PersonalDateItem,
  DialogueType,
  DialogueLine,
  ContentBundle,
  Settings,
  FocusSession,
  FocusSessionReviewTone,
  PetStats,
  WindowPosition,
  WindowPositions,
  ComfortReason,
  ComfortState,
  TimeGreetingPeriod,
  TimeGreetingState,
  AppState,
  RuntimeState,
  PendingBranchPlotChoice,
} from './content-schema.js'

export type {
  DiaryEvent,
  DiaryEventsFile,
  DiaryEntry,
  DiaryEntriesFile,
  DailyDiarySummary,
  DiarySummariesFile,
  DiaryTemplates,
} from './diary-schema.js'

export type MainState = 'idle' | 'feedback' | 'actionLayer' | 'focusMode'

export type WindowDisplayMode = 'desktop' | 'desktop_expanded' | 'panel'

export type NarrativeKind = 'prelude_stranger' | 'first_encounter' | 'absence' | 'normal'

export type DisturbanceLevel = 'low' | 'medium' | 'high'

export type ComfortTone = 'heavy' | 'light'
// AIGC END
