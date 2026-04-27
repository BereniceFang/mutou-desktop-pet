import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ZodType } from 'zod'

import type { AppState, RuntimeState, Settings } from '../../shared/content-schema.js'
import { appStateSchema, runtimeStateSchema, settingsSchema } from '../../shared/content-schema.js'

const LAST_GOOD_MIN_WRITE_INTERVAL_MS = 5 * 60 * 1000
const lastGoodWriteAtByPath = new Map<string, number>()

// AIGC START
const lastSavedSettingsRawByPath = new Map<string, string>()

const LEGACY_CURRENT_FILE = 'current.json'
const SETTINGS_FILE = 'settings.json'
const RUNTIME_STATE_FILE = 'runtime-state.json'
// AIGC END

function withJourneyStartedAt(parsed: AppState): AppState {
  return {
    ...parsed,
    journeyStartedAt: parsed.journeyStartedAt ?? parsed.lastInteractionAt ?? new Date().toISOString(),
  }
}

export async function loadAppState(dataRoot: string, defaultState: AppState): Promise<AppState> {
  // AIGC START
  await mkdir(dataRoot, { recursive: true })

  const settingsPath = path.join(dataRoot, SETTINGS_FILE)
  const runtimeStatePath = path.join(dataRoot, RUNTIME_STATE_FILE)

  const settings = await readParsedFile(settingsPath, settingsSchema)
  const runtimeState = await readParsedFile(runtimeStatePath, runtimeStateSchema)

  if (settings || runtimeState) {
    const merged = mergeAppState(defaultState, settings, runtimeState)
    lastSavedSettingsRawByPath.set(settingsPath, JSON.stringify(merged.settings, null, 2))

    if (!settings || !runtimeState) {
      await persistSplitState(dataRoot, merged, { forceSettingsWrite: !settings })
    }
    return merged
  }

  const legacyState = await loadLegacyCurrentState(dataRoot)
  if (legacyState) {
    await persistSplitState(dataRoot, legacyState, { forceSettingsWrite: true })
    return legacyState
  }

  await persistSplitState(dataRoot, defaultState, { forceSettingsWrite: true })
  return defaultState
  // AIGC END
}

export async function saveAppState(dataRoot: string, state: AppState): Promise<void> {
  // AIGC START
  await persistSplitState(dataRoot, state)
  // AIGC END
}

async function shouldRefreshLastGoodBackup(backupPath: string): Promise<boolean> {
  const now = Date.now()
  const cachedWriteAt = lastGoodWriteAtByPath.get(backupPath)

  if (cachedWriteAt !== undefined) {
    return now - cachedWriteAt >= LAST_GOOD_MIN_WRITE_INTERVAL_MS
  }

  try {
    const backupStat = await stat(backupPath)
    lastGoodWriteAtByPath.set(backupPath, backupStat.mtimeMs)
    return now - backupStat.mtimeMs >= LAST_GOOD_MIN_WRITE_INTERVAL_MS
  } catch {
    return true
  }
}

// AIGC START
async function loadLegacyCurrentState(dataRoot: string): Promise<AppState | null> {
  const filePath = path.join(dataRoot, LEGACY_CURRENT_FILE)
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return withJourneyStartedAt(appStateSchema.parse(parsed))
  } catch (error) {
    // AIGC START
    if (!isMissingFileError(error)) {
      console.warn(`[storage] Failed to read legacy app state: ${filePath}`, error)
    }
    // AIGC END
    return null
  }
}

async function readParsedFile<T>(filePath: string, schema: ZodType<T>): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return schema.parse(JSON.parse(raw))
  } catch (error) {
    // AIGC START
    if (!isMissingFileError(error)) {
      console.warn(`[storage] Failed to parse state file: ${filePath}`, error)
    }
    // AIGC END
    return null
  }
}

function mergeAppState(
  defaultState: AppState,
  settings: Settings | null,
  runtimeState: RuntimeState | null,
): AppState {
  return withJourneyStartedAt(
    appStateSchema.parse({
      ...defaultState,
      ...(runtimeState ?? {}),
      settings: settings ?? defaultState.settings,
    }),
  )
}

function splitAppState(state: AppState): { settings: Settings; runtimeState: RuntimeState } {
  const { settings, ...runtimeState } = state
  return {
    settings,
    runtimeState: runtimeStateSchema.parse(runtimeState),
  }
}

async function persistSplitState(
  dataRoot: string,
  state: AppState,
  options?: { forceSettingsWrite?: boolean },
): Promise<void> {
  const settingsPath = path.join(dataRoot, SETTINGS_FILE)
  const runtimeStatePath = path.join(dataRoot, RUNTIME_STATE_FILE)
  const backupPath = path.join(dataRoot, 'last-good.json')

  const { settings, runtimeState } = splitAppState(state)
  const settingsRaw = JSON.stringify(settings, null, 2)
  const runtimeStateRaw = JSON.stringify(runtimeState, null, 2)
  const combinedRaw = JSON.stringify(state, null, 2)

  await mkdir(dataRoot, { recursive: true })
  await atomicWriteFile(runtimeStatePath, 'runtime-state.tmp.json', runtimeStateRaw)

  const cachedSettingsRaw = lastSavedSettingsRawByPath.get(settingsPath)
  if (options?.forceSettingsWrite || cachedSettingsRaw !== settingsRaw) {
    await atomicWriteFile(settingsPath, 'settings.tmp.json', settingsRaw)
    lastSavedSettingsRawByPath.set(settingsPath, settingsRaw)
  }

  if (await shouldRefreshLastGoodBackup(backupPath)) {
    await writeFile(backupPath, combinedRaw, 'utf8')
    lastGoodWriteAtByPath.set(backupPath, Date.now())
  }
}

async function atomicWriteFile(filePath: string, tempFileName: string, raw: string): Promise<void> {
  const tempPath = path.join(path.dirname(filePath), tempFileName)
  await writeFile(tempPath, raw, 'utf8')
  await rename(tempPath, filePath)
}

// AIGC START
function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'ENOENT',
  )
}
// AIGC END
// AIGC END
