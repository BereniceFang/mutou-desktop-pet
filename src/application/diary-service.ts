// AIGC START
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { DailyDiarySummary, DiaryEntry, DiaryEvent, DiaryTemplates } from '../shared/diary-schema.js'
import type { RelationshipTier } from '../shared/food-catalog.js'
import {
  loadDiaryEvents,
  loadDiarySummaries,
  localDateKeyFromTime,
  saveDiaryEvents,
  saveDiarySummaries,
} from '../infrastructure/storage/diary-storage.js'
import { DEFAULT_FIRST_ENCOUNTER_DATE_KEY } from '../shared/diary-defaults.js'
import { diaryTemplatesSchema } from '../shared/diary-schema.js'
import { getFoodCatalogItem } from '../shared/food-catalog.js'

type DiaryEventPartial = {
  type: DiaryEvent['type']
  dateKey?: string
  payload?: DiaryEvent['payload']
}

function hashSeed(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function pick<T>(items: T[], seed: number): T {
  if (items.length === 0) {
    throw new Error('pick: empty array')
  }
  return items[seed % items.length]
}

// AIGC START
function stripTerminalPunctuation(text: string): string {
  return text.trim().replace(/[，。！？；：、]+$/g, '')
}

const TITLE_JOINERS = ['，', '：', ' · ', '——', '｜']

function pickJoiner(seed: number): string {
  return TITLE_JOINERS[seed % TITLE_JOINERS.length]
}

function composeTitleParts(parts: string[], seed: number): string {
  const stripped = parts.map(stripTerminalPunctuation).filter(Boolean)
  if (stripped.length === 0) return '今天'
  if (stripped.length === 1) return stripped[0]
  return stripped.join(pickJoiner(seed))
}

function pickDistinct<T>(items: T[], seed: number, count: number): T[] {
  if (items.length === 0 || count <= 0) {
    return []
  }
  const results: T[] = []
  const seenIndexes = new Set<number>()
  const targetCount = Math.min(count, items.length)
  for (let step = 0; results.length < targetCount && step < items.length * 2; step += 1) {
    const index = (seed + step * 7) % items.length
    if (seenIndexes.has(index)) {
      continue
    }
    seenIndexes.add(index)
    results.push(items[index])
  }
  return results
}

function isQuietNormalDay(summary: DailyDiarySummary): boolean {
  return (
    !summary.absence &&
    summary.interactionCount === 0 &&
    summary.fedFoodLabels.length === 0 &&
    summary.focusStartedCount === 0 &&
    summary.focusCompletedCount === 0 &&
    summary.focusInterruptedCount === 0
  )
}

function absenceTitleFor(summary: DailyDiarySummary, templates: DiaryTemplates, seed: number): string {
  const s = seed + hashSeed(summary.dateKey)
  const primary = pick(templates.absenceTitle, s)
  const moodSuffix = pick(templates.moodTags.miss, s + 7)
  const closingSuffix = pick(templates.moodTags.quiet, s + 13)
  const variant = s % 3
  if (variant === 0) return composeTitleParts([primary, moodSuffix], s)
  if (variant === 1) return composeTitleParts([primary, closingSuffix], s + 3)
  return composeTitleParts([moodSuffix, primary], s + 5)
}

function quietNormalTitleFor(summary: DailyDiarySummary, templates: DiaryTemplates, seed: number): string {
  const s = seed + hashSeed(summary.dateKey)
  const tierPool = templates.title[summary.relationshipTier]
  const quietMood = pick(templates.moodTags.quiet, s + 11)
  const softMood = pick(templates.moodTags.soft, s + 19)
  const lowTitle = pick(templates.title.low, s + 3)
  const tierTitle = pick(tierPool, s + 7)
  const variant = s % 4
  if (variant === 0) return composeTitleParts([lowTitle, quietMood], s)
  if (variant === 1) return composeTitleParts([tierTitle, softMood], s + 2)
  if (variant === 2) return composeTitleParts([quietMood, lowTitle], s + 5)
  return composeTitleParts([softMood, tierTitle], s + 8)
}
// AIGC END

function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return localDateKeyFromTime(dt.getTime())
}

function compareDateKeys(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function firstEncounterFromMeta(firstEncounterDate?: string): string {
  return firstEncounterDate ?? DEFAULT_FIRST_ENCOUNTER_DATE_KEY
}

function groupEventsByDate(events: DiaryEvent[]): Map<string, DiaryEvent[]> {
  const grouped = new Map<string, DiaryEvent[]>()
  for (const event of events) {
    const bucket = grouped.get(event.dateKey)
    if (bucket) {
      bucket.push(event)
      continue
    }
    grouped.set(event.dateKey, [event])
  }
  return grouped
}

/** 可浏览的最早日期：初遇日前一天（序幕） */
export function getEarliestDiaryDateKey(firstEncounterDate: string): string {
  return addDaysToDateKey(firstEncounterDate, -1)
}

export async function loadDiaryTemplates(contentRoot: string): Promise<DiaryTemplates> {
  const filePath = path.join(contentRoot, 'diary', 'templates.json')
  const raw = await readFile(filePath, 'utf8')
  return diaryTemplatesSchema.parse(JSON.parse(raw))
}

function aggregateDayEvents(
  dayEvents: DiaryEvent[],
  fallbackTier: RelationshipTier,
) {
  const visitTier =
    (dayEvents.find((event) => event.type === 'day_visit')?.payload?.relationshipTier as RelationshipTier) ??
    fallbackTier
  const interactionCount = dayEvents.filter((event) => event.type === 'interaction').length
  const fedFoodLabels: string[] = []
  const seen = new Set<string>()
  for (const event of dayEvents) {
    if (event.type !== 'feed' || !event.payload?.foodType) continue
    const item = getFoodCatalogItem(event.payload.foodType)
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    fedFoodLabels.push(item.label)
  }
  const moodEvent = dayEvents.find((event) => event.type === 'mood_checkin')
  const userMood = moodEvent?.payload?.userMood ?? null

  const gameEvents = dayEvents.filter((event) => event.type === 'game_played')
  const gameWins = gameEvents.filter((e) => e.payload?.gameResult === 'win').length
  const gameLosses = gameEvents.filter((e) => e.payload?.gameResult === 'lose').length
  const gameDraws = gameEvents.filter((e) => e.payload?.gameResult === 'draw').length

  return {
    relationshipTier: visitTier,
    interactionCount,
    fedFoodLabels,
    focusStartedCount: dayEvents.filter((event) => event.type === 'focus_start').length,
    focusCompletedCount: dayEvents.filter((event) => event.type === 'focus_complete').length,
    focusInterruptedCount: dayEvents.filter((event) => event.type === 'focus_interrupt').length,
    userMood,
    gameWins,
    gameLosses,
    gameDraws,
  }
}

function buildSummary(
  dateKey: string,
  dayEventsByDate: Map<string, DiaryEvent[]>,
  fallbackTier: RelationshipTier,
  firstEncounterDate: string,
): DailyDiarySummary {
  const encounter = firstEncounterDate
  const preludeDay = addDaysToDateKey(encounter, -1)
  const dayEvents = dayEventsByDate.get(dateKey) ?? []

  if (dateKey === preludeDay) {
    return {
      dateKey, narrativeKind: 'prelude_stranger', absence: false,
      relationshipTier: 'low', interactionCount: 0, fedFoodLabels: [],
      focusStartedCount: 0, focusCompletedCount: 0, focusInterruptedCount: 0, userMood: null, gameWins: 0, gameLosses: 0, gameDraws: 0,
    }
  }

  if (dateKey === encounter) {
    const agg = dayEvents.length > 0 ? aggregateDayEvents(dayEvents, fallbackTier) : {
      relationshipTier: fallbackTier, interactionCount: 0, fedFoodLabels: [],
      focusStartedCount: 0, focusCompletedCount: 0, focusInterruptedCount: 0, userMood: null, gameWins: 0, gameLosses: 0, gameDraws: 0,
    }
    return { dateKey, narrativeKind: 'first_encounter', absence: false, ...agg }
  }

  if (dayEvents.length === 0) {
    return {
      dateKey, narrativeKind: 'absence', absence: true,
      relationshipTier: fallbackTier, interactionCount: 0, fedFoodLabels: [],
      focusStartedCount: 0, focusCompletedCount: 0, focusInterruptedCount: 0, userMood: null, gameWins: 0, gameLosses: 0, gameDraws: 0,
    }
  }

  return { dateKey, narrativeKind: 'normal', absence: false, ...aggregateDayEvents(dayEvents, fallbackTier) }
}

function moodTagFor(summary: DailyDiarySummary, templates: DiaryTemplates, seed: number): string {
  if (summary.narrativeKind === 'prelude_stranger') return pick(templates.moodTags.stranger, seed + 2)
  if (summary.narrativeKind === 'first_encounter') return pick(templates.moodTags.playful, seed + 4)
  if (summary.absence) return pick(templates.moodTags.miss, seed)
  if (summary.interactionCount >= 10) return pick(templates.moodTags.playful, seed + 3)
  if (summary.fedFoodLabels.length > 0) return pick(templates.moodTags.warm, seed + 5)
  if (summary.focusCompletedCount > 0) return pick(templates.moodTags.soft, seed + 7)
  return pick(templates.moodTags.quiet, seed + 11)
}

function highlightsFor(summary: DailyDiarySummary): string[] {
  if (summary.narrativeKind === 'prelude_stranger') return ['序幕', '还不认识']
  if (summary.narrativeKind === 'first_encounter') {
    const list = ['初遇']
    if (summary.interactionCount > 0) {
      list.push(summary.interactionCount < 5 ? '有互动' : summary.interactionCount < 13 ? '互动偏多' : '高频互动')
    }
    if (summary.fedFoodLabels.length > 0) list.push('投喂')
    if (summary.focusCompletedCount > 0) list.push('专注完成')
    else if (summary.focusInterruptedCount > 0) list.push('专注中断')
    else if (summary.focusStartedCount > 0) list.push('专注进行')
    return list
  }
  if (summary.absence) return ['缺席']
  const list: string[] = []
  if (summary.interactionCount === 0) list.push('轻互动')
  else if (summary.interactionCount < 5) list.push('有互动')
  else if (summary.interactionCount < 13) list.push('互动偏多')
  else list.push('高频互动')
  if (summary.fedFoodLabels.length > 0) list.push('投喂')
  if (summary.focusCompletedCount > 0) list.push('专注完成')
  else if (summary.focusInterruptedCount > 0) list.push('专注中断')
  else if (summary.focusStartedCount > 0) list.push('专注进行')
  return list
}

function pushActivityParagraphs(
  paragraphs: string[], summary: DailyDiarySummary, templates: DiaryTemplates, seed: number,
): void {
  if (summary.interactionCount === 0) paragraphs.push(pick(templates.interactionNone, seed + 17))
  else if (summary.interactionCount < 5) paragraphs.push(pick(templates.interactionLight, seed + 19))
  else if (summary.interactionCount < 13) paragraphs.push(pick(templates.interactionBusy, seed + 23))
  else paragraphs.push(pick(templates.interactionSpam, seed + 29))

  if (summary.fedFoodLabels.length > 0) {
    const foods = summary.fedFoodLabels.join('、')
    paragraphs.push(pick(templates.feedLine, seed + 31).replaceAll('{foods}', foods))
  }

  if (summary.focusCompletedCount > 0 && summary.focusInterruptedCount === 0) paragraphs.push(pick(templates.focusSuccess, seed + 37))
  else if (summary.focusCompletedCount > 0 && summary.focusInterruptedCount > 0) paragraphs.push(pick(templates.focusMixed, seed + 41))
  else if (summary.focusCompletedCount === 0 && summary.focusInterruptedCount > 0) paragraphs.push(pick(templates.focusRegret, seed + 43))
  else if (summary.focusStartedCount > 0) paragraphs.push(pick(templates.focusMixed, seed + 47))

  if (summary.userMood) {
    const poolMap: Record<string, string[] | undefined> = {
      great: templates.moodCheckinGreat,
      ok: templates.moodCheckinOk,
      tired: templates.moodCheckinTired,
      sad: templates.moodCheckinSad,
    }
    const pool = poolMap[summary.userMood]
    if (pool && pool.length > 0) {
      paragraphs.push(pick(pool, seed + 59))
    }
  }

  const totalGames = (summary.gameWins ?? 0) + (summary.gameLosses ?? 0) + (summary.gameDraws ?? 0)
  if (totalGames > 0) {
    if ((summary.gameWins ?? 0) > (summary.gameLosses ?? 0) && templates.gameLose?.length) {
      paragraphs.push(pick(templates.gameLose, seed + 67))
    } else if ((summary.gameLosses ?? 0) > (summary.gameWins ?? 0) && templates.gameWin?.length) {
      paragraphs.push(pick(templates.gameWin, seed + 67))
    } else if (templates.gameDraw?.length) {
      paragraphs.push(pick(templates.gameDraw, seed + 67))
    }
  }
}

export function generateDiaryEntry(summary: DailyDiarySummary, templates: DiaryTemplates): DiaryEntry {
  const seed = hashSeed(`${summary.dateKey}:${summary.relationshipTier}:${summary.narrativeKind}`)

  if (summary.narrativeKind === 'prelude_stranger') {
    return {
      dateKey: summary.dateKey,
      title: pick(templates.preludeTitle, seed),
      moodTag: moodTagFor(summary, templates, seed),
      paragraphs: [pick(templates.preludeBody, seed + 1), pick(templates.preludeClosing, seed + 2)],
      highlights: highlightsFor(summary),
      finalized: false,
    }
  }

  if (summary.narrativeKind === 'first_encounter') {
    const paragraphs = [pick(templates.firstMeetOpening, seed)]
    const hasActivity = summary.interactionCount > 0 || summary.fedFoodLabels.length > 0 ||
      summary.focusStartedCount > 0 || summary.focusCompletedCount > 0 || summary.focusInterruptedCount > 0
    if (!hasActivity) paragraphs.push(pick(templates.firstMeetQuiet, seed + 7))
    else {
      paragraphs.push(pick(templates.opening, seed + 13))
      pushActivityParagraphs(paragraphs, summary, templates, seed)
    }
    paragraphs.push(pick(templates.firstMeetClosing, seed + 53))
    return {
      dateKey: summary.dateKey,
      title: pick(templates.firstMeetTitle, seed + 3),
      moodTag: moodTagFor(summary, templates, seed),
      paragraphs, highlights: highlightsFor(summary), finalized: false,
    }
  }

  if (summary.absence) {
    // AIGC START
    const absenceParagraphs = [
      ...pickDistinct(templates.absenceBody, seed + 1, 2),
      pick(templates.absenceClosing, seed + 19),
    ]
    // AIGC END
    return {
      dateKey: summary.dateKey,
      // AIGC START
      title: absenceTitleFor(summary, templates, seed),
      // AIGC END
      moodTag: moodTagFor(summary, templates, seed),
      paragraphs: absenceParagraphs, highlights: highlightsFor(summary), finalized: false,
    }
  }

  const titlePool = templates.title[summary.relationshipTier]
  const paragraphs: string[] = []
  paragraphs.push(pick(templates.opening, seed + 13))
  // AIGC START
  if (isQuietNormalDay(summary)) {
    paragraphs.push(...pickDistinct(templates.interactionNone, seed + 17, 2))
  } else {
    pushActivityParagraphs(paragraphs, summary, templates, seed)
  }
  // AIGC END
  paragraphs.push(pick(templates.closing, seed + 53))
  return {
    dateKey: summary.dateKey,
    // AIGC START
    title: isQuietNormalDay(summary) ? quietNormalTitleFor(summary, templates, seed) : pick(titlePool, seed + 3),
    // AIGC END
    moodTag: moodTagFor(summary, templates, seed),
    paragraphs, highlights: highlightsFor(summary), finalized: false,
  }
}

// === In-memory entry cache (replaces diary-entries.json persistence) ===
const entryCache = new Map<string, DiaryEntry>()

function getCachedEntry(dateKey: string): DiaryEntry | undefined {
  return entryCache.get(dateKey)
}

function setCachedEntry(entry: DiaryEntry): void {
  entryCache.set(entry.dateKey, entry)
  if (entryCache.size > 120) {
    const oldest = entryCache.keys().next().value
    if (oldest) entryCache.delete(oldest)
  }
}

export async function recordDiaryDayVisit(dataRoot: string, relationshipTier: RelationshipTier): Promise<void> {
  const eventsData = await loadDiaryEvents(dataRoot)
  const today = localDateKeyFromTime(Date.now())
  const hasVisit = eventsData.events.some((event) => event.dateKey === today && event.type === 'day_visit')
  if (hasVisit) return
  eventsData.events.push({
    id: randomUUID(), dateKey: today, type: 'day_visit',
    timestamp: new Date().toISOString(), payload: { relationshipTier },
  })
  await saveDiaryEvents(dataRoot, eventsData)
}

export async function appendDiaryEvent(dataRoot: string, partial: DiaryEventPartial): Promise<void> {
  const eventsData = await loadDiaryEvents(dataRoot)
  const dateKey = partial.dateKey ?? localDateKeyFromTime(Date.now())
  eventsData.events.push({
    id: randomUUID(), dateKey, type: partial.type,
    timestamp: new Date().toISOString(), payload: partial.payload,
  })
  await saveDiaryEvents(dataRoot, eventsData)
  entryCache.delete(dateKey)
}

async function finalizeCompletedDaysInner(
  dataRoot: string,
  _templates: DiaryTemplates,
  relationshipTier: RelationshipTier,
): Promise<void> {
  const eventsData = await loadDiaryEvents(dataRoot)
  const summariesData = await loadDiarySummaries(dataRoot)
  const today = localDateKeyFromTime(Date.now())

  const originalLastFinalizedDate = eventsData.meta.lastFinalizedDate
  const originalFirstEncounterDate = eventsData.meta.firstEncounterDate
  const firstEncounter = firstEncounterFromMeta(eventsData.meta.firstEncounterDate)
  const storyStart = getEarliestDiaryDateKey(firstEncounter)
  const dayEventsByDate = groupEventsByDate(eventsData.events)

  let cursor = storyStart
  let fallbackTier: RelationshipTier = relationshipTier
  let summariesDirty = false

  while (compareDateKeys(cursor, today) < 0) {
    let summary = summariesData.byDate[cursor]
    if (!summary) {
      summary = buildSummary(cursor, dayEventsByDate, fallbackTier, firstEncounter)
      summariesData.byDate[cursor] = summary
      summariesDirty = true
    }
    fallbackTier = summary.relationshipTier as RelationshipTier
    eventsData.meta.lastFinalizedDate = cursor
    eventsData.meta.firstEncounterDate = firstEncounter
    cursor = addDaysToDateKey(cursor, 1)
  }

  const compactedEvents = eventsData.events.filter(
    (event) => compareDateKeys(event.dateKey, today) >= 0,
  )
  const eventsDirty =
    compactedEvents.length !== eventsData.events.length ||
    originalLastFinalizedDate !== eventsData.meta.lastFinalizedDate ||
    originalFirstEncounterDate !== eventsData.meta.firstEncounterDate

  eventsData.events = compactedEvents

  if (eventsDirty) await saveDiaryEvents(dataRoot, eventsData)
  if (summariesDirty) await saveDiarySummaries(dataRoot, summariesData)
}

export async function runDiarySessionHooks(
  dataRoot: string,
  contentRoot: string,
  relationshipTier: RelationshipTier,
): Promise<void> {
  const templates = await loadDiaryTemplates(contentRoot)
  await recordDiaryDayVisit(dataRoot, relationshipTier)
  await finalizeCompletedDaysInner(dataRoot, templates, relationshipTier)
}

function entryBeforeStoryRange(dateKey: string, firstEncounter: string): boolean {
  return compareDateKeys(dateKey, getEarliestDiaryDateKey(firstEncounter)) < 0
}

export async function getDiaryEntryForDate(
  dataRoot: string,
  contentRoot: string,
  dateKey: string,
  relationshipTier: RelationshipTier,
): Promise<DiaryEntry> {
  const today = localDateKeyFromTime(Date.now())

  // AIGC START
  if (compareDateKeys(dateKey, today) >= 0) {
    return {
      dateKey, title: '这一页还在书写中', moodTag: '未完',
      paragraphs: ['当天的日记会在这一天结束后再整理成页，所以今天这页暂时还不能翻看。'],
      highlights: ['次日解锁'], finalized: true,
    }
  }
  // AIGC END

  const eventsData = await loadDiaryEvents(dataRoot)
  const firstEncounter = firstEncounterFromMeta(eventsData.meta.firstEncounterDate)

  if (entryBeforeStoryRange(dateKey, firstEncounter)) {
    return {
      dateKey, title: '这一页还没有翻开', moodTag: '空白',
      paragraphs: ['我们的日记是从初遇前一天才开始的，再早的页，木头还没为你留着。'],
      highlights: ['未开放'], finalized: true,
    }
  }

  const cached = getCachedEntry(dateKey)
  if (cached) return cached

  const summariesData = await loadDiarySummaries(dataRoot)
  const dayEventsByDate = groupEventsByDate(eventsData.events)
  const summary = summariesData.byDate[dateKey] ??
    buildSummary(dateKey, dayEventsByDate, relationshipTier, firstEncounter)

  if (!summariesData.byDate[dateKey]) {
    summariesData.byDate[dateKey] = summary
    await saveDiarySummaries(dataRoot, summariesData)
  }

  const templates = await loadDiaryTemplates(contentRoot)
  const entry: DiaryEntry = {
    ...generateDiaryEntry(summary, templates),
    finalized: compareDateKeys(dateKey, today) < 0,
  }
  setCachedEntry(entry)
  return entry
}

export async function listRecentDiaryEntries(
  dataRoot: string,
  contentRoot: string,
  limit: number,
  relationshipTier: RelationshipTier,
): Promise<DiaryEntry[]> {
  const today = localDateKeyFromTime(Date.now())
  const eventsData = await loadDiaryEvents(dataRoot)
  const summariesData = await loadDiarySummaries(dataRoot)
  const firstEncounter = firstEncounterFromMeta(eventsData.meta.firstEncounterDate)
  const earliestView = getEarliestDiaryDateKey(firstEncounter)
  const dayEventsByDate = groupEventsByDate(eventsData.events)

  let templates: DiaryTemplates | null = null
  const results: DiaryEntry[] = []
  let summariesDirty = false

  for (let i = 0; results.length < limit; i += 1) {
    // AIGC START
    const dateKey = addDaysToDateKey(today, -(i + 1))
    // AIGC END
    if (compareDateKeys(dateKey, earliestView) < 0) break

    const cached = getCachedEntry(dateKey)
    if (cached) { results.push(cached); continue }

    let summary = summariesData.byDate[dateKey]
    if (!summary) {
      summary = buildSummary(dateKey, dayEventsByDate, relationshipTier, firstEncounter)
      summariesData.byDate[dateKey] = summary
      summariesDirty = true
    }

    templates ??= await loadDiaryTemplates(contentRoot)
    const entry: DiaryEntry = {
      ...generateDiaryEntry(summary, templates),
      finalized: true,
    }
    setCachedEntry(entry)
    results.push(entry)
  }

  if (summariesDirty) await saveDiarySummaries(dataRoot, summariesData)
  return results
}
// AIGC END
