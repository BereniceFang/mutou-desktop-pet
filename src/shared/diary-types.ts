// AIGC START
export type { DiaryEvent, DiaryEventsFile, DiaryEntry, DiaryEntriesFile } from './diary-schema.js'
export type { DailyDiarySummary, DiarySummariesFile, DiaryTemplates } from './diary-schema.js'

export type NarrativeKind = 'prelude_stranger' | 'first_encounter' | 'absence' | 'normal'

export type DiaryEventType = 'day_visit' | 'interaction' | 'feed' | 'focus_start' | 'focus_complete' | 'focus_interrupt'

export type MoodTagGroup = 'warm' | 'soft' | 'playful' | 'quiet' | 'miss' | 'stranger'
// AIGC END
