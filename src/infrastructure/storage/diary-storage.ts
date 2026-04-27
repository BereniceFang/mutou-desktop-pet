import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { DEFAULT_FIRST_ENCOUNTER_DATE_KEY } from '../../shared/diary-defaults.js'
import type { DiaryEntriesFile, DiaryEntry, DiaryEventsFile, DiarySummariesFile } from '../../shared/diary-schema.js'
import {
  diaryEntriesFileSchema,
  diaryEventsFileSchema,
  diarySummariesFileSchema,
} from '../../shared/diary-schema.js'

const EVENTS_FILE = 'diary-events.json'
const ENTRIES_FILE = 'diary-entries.json'
const SUMMARIES_FILE = 'diary-day-summaries.json'

function todayDateKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function localDateKeyFromTime(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function loadDiaryEvents(dataRoot: string): Promise<DiaryEventsFile> {
  const filePath = path.join(dataRoot, EVENTS_FILE)
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    const data: DiaryEventsFile = diaryEventsFileSchema.parse(parsed)

    if (!data.meta.firstEncounterDate) {
      const merged: DiaryEventsFile = {
        ...data,
        meta: {
          ...data.meta,
          firstEncounterDate: DEFAULT_FIRST_ENCOUNTER_DATE_KEY,
        },
      }
      await saveDiaryEvents(dataRoot, merged)
      return merged
    }

    return data
  } catch {
    const initial: DiaryEventsFile = {
      version: 1,
      meta: {
        appFirstOpenDate: todayDateKey(),
        firstEncounterDate: DEFAULT_FIRST_ENCOUNTER_DATE_KEY,
        lastFinalizedDate: null,
      },
      events: [],
    }
    await saveDiaryEvents(dataRoot, initial)
    return initial
  }
}

export async function saveDiaryEvents(dataRoot: string, data: DiaryEventsFile): Promise<void> {
  const filePath = path.join(dataRoot, EVENTS_FILE)
  const tempPath = path.join(dataRoot, 'diary-events.tmp.json')
  await mkdir(dataRoot, { recursive: true })
  const raw = JSON.stringify(data, null, 2)
  await writeFile(tempPath, raw, 'utf8')
  await rename(tempPath, filePath)
}

export async function loadDiaryEntries(dataRoot: string): Promise<DiaryEntriesFile> {
  const filePath = path.join(dataRoot, ENTRIES_FILE)
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return diaryEntriesFileSchema.parse(parsed)
  } catch {
    const initial: DiaryEntriesFile = {
      version: 1,
      byDate: {},
    }
    await saveDiaryEntries(dataRoot, initial)
    return initial
  }
}

export async function saveDiaryEntries(dataRoot: string, data: DiaryEntriesFile): Promise<void> {
  const filePath = path.join(dataRoot, ENTRIES_FILE)
  const tempPath = path.join(dataRoot, 'diary-entries.tmp.json')
  await mkdir(dataRoot, { recursive: true })
  const raw = JSON.stringify(data, null, 2)
  await writeFile(tempPath, raw, 'utf8')
  await rename(tempPath, filePath)
}

export async function loadDiarySummaries(dataRoot: string): Promise<DiarySummariesFile> {
  const filePath = path.join(dataRoot, SUMMARIES_FILE)
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return diarySummariesFileSchema.parse(parsed)
  } catch {
    const initial: DiarySummariesFile = {
      version: 1,
      byDate: {},
    }
    await saveDiarySummaries(dataRoot, initial)
    return initial
  }
}

export async function saveDiarySummaries(dataRoot: string, data: DiarySummariesFile): Promise<void> {
  const filePath = path.join(dataRoot, SUMMARIES_FILE)
  const tempPath = path.join(dataRoot, 'diary-day-summaries.tmp.json')
  await mkdir(dataRoot, { recursive: true })
  const raw = JSON.stringify(data, null, 2)
  await writeFile(tempPath, raw, 'utf8')
  await rename(tempPath, filePath)
}

/** 仅当该日尚无日记时写入，保证同一日期内容稳定不变 */
export async function putDiaryEntryIfAbsent(
  dataRoot: string,
  dateKey: string,
  entry: DiaryEntry,
): Promise<DiaryEntry> {
  const data = await loadDiaryEntries(dataRoot)
  const existing = data.byDate[dateKey]
  if (existing) {
    return existing
  }

  const next: DiaryEntriesFile = {
    ...data,
    byDate: {
      ...data.byDate,
      [dateKey]: entry,
    },
  }
  await saveDiaryEntries(dataRoot, next)
  return entry
}
