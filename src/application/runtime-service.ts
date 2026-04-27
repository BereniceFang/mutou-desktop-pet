import { randomUUID } from 'node:crypto'

import { isBadgeUnlocked, isStoryCardUnlocked } from '../domain/collection-unlock.js'
import { resolvePriorityCelebration } from '../domain/calendar-celebration.js'
import { resolveMainState, resolveRelationshipTier } from '../domain/main-state-machine.js'
import { appendDiaryEvent, getDiaryEntryForDate, listRecentDiaryEntries, runDiarySessionHooks } from './diary-service.js'
import { loadCollectionBadges, loadStoryCards } from '../infrastructure/content/collection-loader.js'
import { loadFarewellBundle } from '../infrastructure/content/farewell-loader.js'
import { loadContentBundle, pickDialogue } from '../infrastructure/content/content-loader.js'
import { loadHolidayCalendar } from '../infrastructure/content/holiday-loader.js'
import { loadInteractivePlotsBundle } from '../infrastructure/content/interactive-plots-loader.js'
import { loadAppState, saveAppState } from '../infrastructure/storage/app-state-storage.js'
import {
  getFeedSatietyGainForPreference,
  getFoodCatalogItem,
  getFoodDialogueType,
  getFoodUnlockTierLabel,
  isFoodUnlockedForTier,
} from '../shared/food-catalog.js'

import type { CelebrationResult } from '../domain/calendar-celebration.js'
import type {
  AppState,
  ComfortReason,
  ContentBundle,
  DialogueLine,
  FocusSessionReviewTone,
  PendingBranchPlotChoice,
  Settings,
  TimeGreetingPeriod,
  WindowPosition,
} from '../shared/content-schema.js'
import type { FoodCategory } from '../shared/food-catalog.js'
import type { HolidayCalendar } from '../shared/holiday-schema.js'
import type { InteractivePlotsBundle } from '../shared/interactive-plots-schema.js'
import type { CollectionBadgeDef } from '../shared/collection-schema.js'
import type { CollectionCardDef } from '../shared/collection-schema.js'
import type { DiaryEntry } from '../shared/diary-schema.js'
import type { InteractivePlotDef } from '../shared/interactive-plots-schema.js'

type IpcResponse = { state: AppState; bubbleText: string | null }
type IpcResponseWithActions = IpcResponse & { actions: Action[] }
type IpcResponseWithBranch = IpcResponse & { branchChoices?: PendingBranchPlotChoice[] }
type Action = { id: string; label: string }
type PickedLine = {
  line: DialogueLine
  comfortReason?: ComfortReason
  milestoneLabel?: string
  timeGreetingPeriod?: TimeGreetingPeriod
}

const SCHEMA_VERSION = 1

/** 累计互动达到该值后，才可能触发分支小剧情 */
const BRANCH_PLOT_MIN_INTERACTIONS = 6
/** 两次分支剧情之间的最小互动间隔（按累计互动计数） */
const BRANCH_PLOT_COOLDOWN_INTERACTIONS = 22

const ACTIONS: Action[] = [
  { id: 'status', label: '状态' },
  { id: 'feed', label: '喂食' },
  { id: 'focus', label: '专注' },
  { id: 'comfort', label: '陪陪我' },
  { id: 'settings', label: '设置' },
  { id: 'collection', label: '收藏' },
]

const CLICK_SPAM_WINDOW_MS = 6000
const CLICK_SPAM_THRESHOLD = 4
const AMBIENT_BUBBLE_COOLDOWN_MS = 10000
const FEED_REPEAT_WINDOW_MS = 90000
/** 在 FEED_REPEAT_WINDOW 内允许的正常喂食次数，超过后触发连续喂食话术 */
const FEED_REPEAT_GRACE_COUNT = 3

/** 专注心跳主要用于陪伴反馈，不需要每次都立刻写盘；按分钟级节流即可。 */
const FOCUS_HEARTBEAT_PERSIST_INTERVAL_MS = 2 * 60 * 1000

/** 饱腹度：低于此值视为「偏饿」，优先使用饥饿提示台词 */
const SATIETY_HUNGER_THRESHOLD = 36

/** 每小时自然衰减（0–100 标尺），长时间离线会单次封顶避免暴扣 */
const SATIETY_DECAY_PER_HOUR = 3.25
const SATIETY_DECAY_BURST_CAP = 48

/** 单次点击、双击带来的「活动消耗」饱腹扣减（互动越密额外略增） */
const SATIETY_ACTIVITY_DRAIN_CLICK = 1
const SATIETY_ACTIVITY_DRAIN_DOUBLE = 2
const SATIETY_ACTIVITY_DRAIN_BURST_EXTRA = 1

/** 低于该心情值时，木头会更倾向认为你今天需要被安抚 */
const COMFORT_MOOD_THRESHOLD = 42
/** 低于该活力值时，木头会优先切到更轻的安抚语气 */
const COMFORT_ENERGY_THRESHOLD = 38
/** 待机安抚的最小冷却，避免连续多次冒泡都在重复"接情绪" */
const COMFORT_IDLE_COOLDOWN_MS = 90000
/** 专注中断后的短时间内，后续待机 / 点击更容易继续接住情绪 */
const COMFORT_RECENT_FOCUS_INTERRUPT_MS = 18 * 60 * 1000
/** 连续点击要搭配偏晚 / 低状态，才会被解释成"需要安抚"而非单纯玩宠物 */
const COMFORT_RAPID_CLICK_MOOD_GATE = 58
const COMFORT_RAPID_CLICK_ENERGY_GATE = 52

const FOOD_EFFECTS: Record<
  FoodCategory,
  { favorability: number; tacit: number; mood: number; energy: number; dialogueType: string }
> = {
  sweet: { favorability: 1, tacit: 1, mood: 6, energy: 1, dialogueType: 'feed_sweet' },
  fruit: { favorability: 1, tacit: 1, mood: 5, energy: 3, dialogueType: 'feed_fruit' },
  drink: { favorability: 1, tacit: 1, mood: 3, energy: 4, dialogueType: 'feed_drink' },
  savory: { favorability: 1, tacit: 1, mood: 5, energy: 3, dialogueType: 'feed_savory' },
  meal: { favorability: 2, tacit: 1, mood: 6, energy: 5, dialogueType: 'feed_meal' },
}

function normalizeFocusGoal(goal: string | undefined | null): string | null {
  const trimmed = goal?.trim().replace(/\s+/g, ' ') ?? ''
  return trimmed ? trimmed.slice(0, 40) : null
}

function clampFocusDurationMinutes(duration: number): number {
  if (!Number.isFinite(duration)) {
    return 25
  }
  return Math.min(240, Math.max(1, Math.round(duration)))
}

function focusReviewSuffix(reviewTone: FocusSessionReviewTone): string {
  switch (reviewTone) {
    case 'done':
      return ' 这轮我给你好好记上了。'
    case 'partial':
      return ' 做到一部分也算认真往前推了。'
    case 'enough':
      return ' 先记到这里也可以，别急着苛责自己。'
    default:
      return ''
  }
}

export class RuntimeService {
  contentBundle: ContentBundle | null = null
  holidayCalendar: HolidayCalendar | null = null
  interactivePlots: InteractivePlotsBundle | null = null
  farewellLines: string[] | null = null
  collectionDefs: { badges: CollectionBadgeDef[]; cards: CollectionCardDef[] } | null = null

  persistQueue: Promise<void> = Promise.resolve()
  lastFocusHeartbeatPersistAt: number = 0
  recentAmbientLineIds: string[] = []

  state: AppState
  dialogueSequence: number = 0
  recentClickAt: number[] = []
  recentFeedAt: number[] = []

  contentRoot: string
  dataRoot: string
  appVersion: string

  constructor(contentRoot: string, dataRoot: string, appVersion: string) {
    this.contentRoot = contentRoot
    this.dataRoot = dataRoot
    this.appVersion = appVersion
    this.state = createDefaultState()
  }

  async initialize(): Promise<void> {
    this.contentBundle = await loadContentBundle(this.contentRoot)
    this.holidayCalendar = await loadHolidayCalendar(this.contentRoot)
    this.interactivePlots = await loadInteractivePlotsBundle(this.contentRoot)
    this.state = await loadAppState(this.dataRoot, createDefaultState())
    this.dialogueSequence = this.state.stats.interactionCount
    this.applySatietyDecayToState(new Date())
    this.applyDailyProgress()
    await this.persist()
    await runDiarySessionHooks(this.dataRoot, this.contentRoot, this.state.relationshipTier)
  }

  async loadBootstrapData(): Promise<{
    state: AppState
    actions: Action[]
    environment: { platform: string; appVersion: string; schemaVersion: number }
  }> {
    return {
      state: this.state,
      actions: ACTIONS,
      environment: {
        platform: process.platform,
        appVersion: this.appVersion,
        schemaVersion: SCHEMA_VERSION,
      },
    }
  }

  async triggerStartupGreeting(): Promise<IpcResponse> {
    if (!this.state.settings.speechEnabled || this.state.focusSession.status === 'in_progress') {
      return {
        state: this.state,
        bubbleText: null,
      }
    }

    const nowDate = new Date()
    this.applySatietyDecayToState(nowDate)

    const period = this.getTimeGreetingPeriod(nowDate)
    if (!this.shouldOfferTimeGreeting(period, nowDate)) {
      return {
        state: this.state,
        bubbleText: null,
      }
    }

    const line = this.decorateSpeechLine(
      this.pickLineWithFallback(this.getTimeGreetingDialogueType(period), 'idle'),
    )

    this.state = {
      ...this.state,
      mainState: 'idle',
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      timeGreetingState: this.nextTimeGreetingStateAfterSpeech(period, nowDate),
    }

    this.rememberRecentAmbientLine(line.id)
    await this.persist()

    return {
      state: this.state,
      bubbleText: line.text,
    }
  }

  buildFocusContextLine(): DialogueLine {
    return this.decorateSpeechLine(
      this.pickLineWithFallback('focus_during_interaction', 'focus_progress'),
    )
  }

  applyFocusContextAffordance(mainState: AppState['mainState'], line: DialogueLine): void {
    this.state = {
      ...this.state,
      mainState,
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      lastInteractionAt: new Date().toISOString(),
      relationshipTier: resolveRelationshipTier(this.state.stats.favorability + 1),
      stats: {
        ...this.state.stats,
        favorability: this.state.stats.favorability + 1,
        tacit: this.state.stats.tacit + 1,
      },
    }
  }

  async handlePetClick(): Promise<IpcResponseWithBranch> {
    const nowDate = new Date()
    this.applySatietyDecayToState(nowDate)
    const nowMs = nowDate.getTime()

    if (this.state.pendingBranchPlotId) {
      const plot = this.getInteractivePlot(this.state.pendingBranchPlotId)
      if (!plot) {
        this.state = {
          ...this.state,
          pendingBranchPlotId: null,
          pendingBranchPlotChoices: null,
        }
        await this.persist()
      } else {
        const promptText = this.formatSpeechText(plot.prompt)
        return {
          state: this.state,
          bubbleText: promptText,
          branchChoices: plot.choices.map((c) => ({ id: c.id, label: c.label })),
        }
      }
    }

    if (this.state.focusSession.status === 'in_progress') {
      if (!this.state.settings.speechEnabled) {
        return { state: this.state, bubbleText: null }
      }
      const line = this.buildFocusContextLine()
      this.applyFocusContextAffordance('focusMode', line)
      await this.persist()
      return { state: this.state, bubbleText: line.text }
    }

    const priorInWindow = this.recentClickAt.filter(
      (t) => nowMs - t <= CLICK_SPAM_WINDOW_MS,
    ).length
    const burstExtra = priorInWindow >= 2 ? SATIETY_ACTIVITY_DRAIN_BURST_EXTRA : 0
    this.applyActivitySatietyDrain(nowDate, SATIETY_ACTIVITY_DRAIN_CLICK + burstExtra)

    const celebration = this.resolveCelebration(nowDate)
    const wouldSpam = this.wouldBeClickRepeatSpamy(nowMs)

    if (this.couldOfferBranchPlotNow(nowDate, wouldSpam, celebration)) {
      const plots = this.interactivePlots!.plots
      const plot = plots[this.state.stats.branchPlotRotation % plots.length]

      this.recentClickAt = this.recentClickAt.filter((t) => nowMs - t <= CLICK_SPAM_WINDOW_MS)
      this.recentClickAt.push(nowMs)

      const hour = nowDate.getHours()
      const isNight = hour >= 23 || hour < 5
      const milestonePatch = this.celebrationMilestonePatch(celebration, nowDate.getFullYear())
      const promptText = this.formatSpeechText(plot.prompt)
      const nextInteractionCount = this.state.stats.interactionCount + 1
      const choices: PendingBranchPlotChoice[] = plot.choices.map((c) => ({
        id: c.id,
        label: c.label,
      }))

      this.state = {
        ...this.state,
        mainState: resolveMainState('click'),
        currentExpression: plot.promptExpressionHint ?? 'happy',
        currentMotion: plot.promptMotionHint ?? 'idle',
        lastBubbleText: promptText,
        lastInteractionAt: new Date().toISOString(),
        pendingBranchPlotId: plot.id,
        pendingBranchPlotChoices: choices,
        relationshipTier: resolveRelationshipTier(this.state.stats.favorability + 1),
        stats: {
          ...this.state.stats,
          ...milestonePatch,
          interactionCount: nextInteractionCount,
          favorability: this.state.stats.favorability + 1,
          tacit: this.state.stats.tacit + 1,
          nightInteractionCount: isNight
            ? this.state.stats.nightInteractionCount + 1
            : this.state.stats.nightInteractionCount,
          lastBranchPlotAtInteraction: nextInteractionCount,
        },
      }

      await this.persist()
      await appendDiaryEvent(this.dataRoot, { type: 'interaction' })

      return {
        state: this.state,
        bubbleText: promptText,
        branchChoices: choices,
      }
    }

    const picked = this.pickClickLine()
    const line = this.decorateSpeechLine(picked.line, picked.milestoneLabel)

    const hour = nowDate.getHours()
    const isNight = hour >= 23 || hour < 5
    const milestonePatch = this.celebrationMilestonePatch(celebration, nowDate.getFullYear())

    console.log('[pet-debug:runtime-click] picked-line', {
      id: line.id,
      text: line.text,
      expressionHint: line.expressionHint,
      motionHint: line.motionHint,
    })

    this.state = {
      ...this.state,
      mainState: resolveMainState('click'),
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      lastInteractionAt: new Date().toISOString(),
      comfortState: this.nextComfortStateAfterSpeech(picked.comfortReason, nowDate),
      relationshipTier: resolveRelationshipTier(this.state.stats.favorability + 1),
      stats: {
        ...this.state.stats,
        ...milestonePatch,
        interactionCount: this.state.stats.interactionCount + 1,
        favorability: this.state.stats.favorability + 1,
        tacit: this.state.stats.tacit + 1,
        nightInteractionCount: isNight
          ? this.state.stats.nightInteractionCount + 1
          : this.state.stats.nightInteractionCount,
      },
    }

    await this.persist()
    await appendDiaryEvent(this.dataRoot, { type: 'interaction' })

    console.log('[pet-debug:runtime-click] next-state', {
      lastBubbleText: this.state.lastBubbleText,
      mainState: this.state.mainState,
      interactionCount: this.state.stats.interactionCount,
    })

    return {
      state: this.state,
      bubbleText: line.text,
    }
  }

  async resolveBranchPlotChoice(choiceId: string): Promise<IpcResponse> {
    const plotId = this.state.pendingBranchPlotId
    if (!plotId) {
      return {
        state: this.state,
        bubbleText: this.state.lastBubbleText,
      }
    }

    const plot = this.getInteractivePlot(plotId)
    const choice = plot?.choices.find((c) => c.id === choiceId)

    if (!plot || !choice) {
      this.state = {
        ...this.state,
        pendingBranchPlotId: null,
        pendingBranchPlotChoices: null,
      }
      await this.persist()
      return {
        state: this.state,
        bubbleText: this.state.lastBubbleText,
      }
    }

    const text = this.formatSpeechText(choice.text)
    const len = this.interactivePlots?.plots.length ?? 1

    this.state = {
      ...this.state,
      mainState: resolveMainState('click'),
      currentExpression: choice.expressionHint,
      currentMotion: choice.motionHint,
      lastBubbleText: text,
      pendingBranchPlotId: null,
      pendingBranchPlotChoices: null,
      relationshipTier: resolveRelationshipTier(this.state.stats.favorability + 1),
      stats: {
        ...this.state.stats,
        favorability: this.state.stats.favorability + 1,
        tacit: this.state.stats.tacit + 1,
        branchPlotRotation: (this.state.stats.branchPlotRotation + 1) % len,
      },
    }

    await this.persist()

    return {
      state: this.state,
      bubbleText: text,
    }
  }

  async handlePetDoubleClick(): Promise<IpcResponse> {
    const nowDate = new Date()
    this.applySatietyDecayToState(nowDate)

    if (this.state.pendingBranchPlotId) {
      this.state = {
        ...this.state,
        pendingBranchPlotId: null,
        pendingBranchPlotChoices: null,
      }
    }

    if (this.state.focusSession.status === 'in_progress') {
      if (!this.state.settings.speechEnabled) {
        return { state: this.state, bubbleText: null }
      }
      const line = this.buildFocusContextLine()
      this.applyFocusContextAffordance('focusMode', line)
      await this.persist()
      return { state: this.state, bubbleText: line.text }
    }

    this.applyActivitySatietyDrain(nowDate, SATIETY_ACTIVITY_DRAIN_DOUBLE)

    const picked = this.pickDoubleLine()
    const line = this.decorateSpeechLine(picked.line, picked.milestoneLabel)

    const hour = nowDate.getHours()
    const isNight = hour >= 23 || hour < 5
    const celebration = this.resolveCelebration(nowDate)
    const milestonePatch = this.celebrationMilestonePatch(celebration, nowDate.getFullYear())

    this.state = {
      ...this.state,
      mainState: resolveMainState('click'),
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      lastInteractionAt: nowDate.toISOString(),
      comfortState: this.nextComfortStateAfterSpeech(picked.comfortReason, nowDate),
      relationshipTier: resolveRelationshipTier(this.state.stats.favorability + 1),
      stats: {
        ...this.state.stats,
        ...milestonePatch,
        interactionCount: this.state.stats.interactionCount + 1,
        favorability: this.state.stats.favorability + 1,
        tacit: this.state.stats.tacit + 1,
        nightInteractionCount: isNight
          ? this.state.stats.nightInteractionCount + 1
          : this.state.stats.nightInteractionCount,
      },
    }

    await this.persist()
    await appendDiaryEvent(this.dataRoot, { type: 'interaction' })

    return {
      state: this.state,
      bubbleText: line.text,
    }
  }

  async requestComfort(tone: 'light' | 'heavy'): Promise<IpcResponse> {
    const nowDate = new Date()
    this.applySatietyDecayToState(nowDate)

    if (this.state.focusSession.status === 'in_progress') {
      if (!this.state.settings.speechEnabled) {
        return { state: this.state, bubbleText: null }
      }
      const line = this.buildFocusContextLine()
      this.applyFocusContextAffordance('focusMode', line)
      await this.persist()
      return { state: this.state, bubbleText: line.text }
    }

    const explicitType =
      tone === 'heavy' ? 'interaction_comfort_heavy' : 'interaction_comfort_light'
    const fallbackType = tone === 'heavy' ? 'interaction_comfort' : 'interaction'

    const picked: PickedLine = {
      line: this.pickLineWithFallback(explicitType, fallbackType),
      comfortReason: 'user_request',
    }

    const line = this.decorateSpeechLine(picked.line, picked.milestoneLabel)

    const hour = nowDate.getHours()
    const isNight = hour >= 23 || hour < 5

    this.state = {
      ...this.state,
      mainState: resolveMainState('click'),
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      lastInteractionAt: nowDate.toISOString(),
      pendingBranchPlotId: null,
      pendingBranchPlotChoices: null,
      comfortState: this.nextComfortStateAfterSpeech(picked.comfortReason, nowDate),
      relationshipTier: resolveRelationshipTier(this.state.stats.favorability + 1),
      stats: {
        ...this.state.stats,
        interactionCount: this.state.stats.interactionCount + 1,
        favorability: this.state.stats.favorability + 1,
        tacit: this.state.stats.tacit + 1,
        nightInteractionCount: isNight
          ? this.state.stats.nightInteractionCount + 1
          : this.state.stats.nightInteractionCount,
      },
    }

    await this.persist()
    await appendDiaryEvent(this.dataRoot, { type: 'interaction' })

    return {
      state: this.state,
      bubbleText: line.text,
    }
  }

  async triggerIdleBubble(): Promise<IpcResponse> {
    if (!this.state.settings.speechEnabled || this.state.focusSession.status === 'in_progress') {
      return {
        state: this.state,
        bubbleText: null,
      }
    }

    if (this.state.lastInteractionAt) {
      const elapsed = Date.now() - new Date(this.state.lastInteractionAt).getTime()
      if (elapsed < AMBIENT_BUBBLE_COOLDOWN_MS) {
        return {
          state: this.state,
          bubbleText: null,
        }
      }
    }

    const nowDate = new Date()
    this.applySatietyDecayToState(nowDate)

    const picked = this.pickIdleLine()
    const line = this.decorateSpeechLine(picked.line, picked.milestoneLabel)

    this.state = {
      ...this.state,
      mainState: 'idle',
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      comfortState: this.nextComfortStateAfterSpeech(picked.comfortReason, nowDate),
      timeGreetingState: this.nextTimeGreetingStateAfterSpeech(picked.timeGreetingPeriod, nowDate),
    }

    this.rememberRecentAmbientLine(line.id)
    await this.persist()

    return {
      state: this.state,
      bubbleText: line.text,
    }
  }

  async handleFeed(foodType: string): Promise<IpcResponse> {
    const nowDate = new Date()
    const now = nowDate.toISOString()
    this.applySatietyDecayToState(nowDate)

    if (this.state.stats.satiety >= 100) {
      const line = this.decorateSpeechLine(
        this.pickLineWithFallback('feed_reject_full', 'interaction'),
      )
      this.state = {
        ...this.state,
        mainState: 'feedback',
        currentExpression: line.expressionHint,
        currentMotion: line.motionHint,
        lastBubbleText: line.text,
      }
      await this.persist()
      return {
        state: this.state,
        bubbleText: line.text,
      }
    }

    if (this.state.focusSession.status === 'in_progress') {
      if (!this.state.settings.speechEnabled) {
        return { state: this.state, bubbleText: null }
      }
      const line = this.buildFocusContextLine()
      this.applyFocusContextAffordance('focusMode', line)
      await this.persist()
      return { state: this.state, bubbleText: line.text }
    }

    const nowMs = Date.now()
    this.recentFeedAt = this.recentFeedAt.filter((t) => nowMs - t <= FEED_REPEAT_WINDOW_MS)
    this.recentFeedAt.push(nowMs)
    const shouldUseRepeatLine = this.recentFeedAt.length > FEED_REPEAT_GRACE_COUNT

    const foodItem = getFoodCatalogItem(foodType)
    if (!foodItem) {
      throw new Error(`Unknown food type: ${foodType}`)
    }

    if (!isFoodUnlockedForTier(foodItem, this.state.relationshipTier)) {
      const lockedText = this.formatSpeechText(
        `这份 ${foodItem.label} 我先记下啦，等我们到「${getFoodUnlockTierLabel(foodItem.unlockTier)}」再一起吃，好不好。`,
      )
      this.state = {
        ...this.state,
        mainState: 'feedback',
        currentExpression: 'calm',
        currentMotion: 'idle',
        lastBubbleText: lockedText,
      }
      await this.persist()
      return {
        state: this.state,
        bubbleText: lockedText,
      }
    }

    const effect = FOOD_EFFECTS[foodItem.category]
    const scoreBonus = foodItem.preferenceScore - 3
    const feedSatietyGain = getFeedSatietyGainForPreference(foodItem.preferenceScore, foodItem.category)

    const line = this.decorateSpeechLine(
      this.formatFoodLine(
        this.pickFeedLine(foodType, foodItem.category, shouldUseRepeatLine),
        foodItem.label,
        foodItem.preferenceScore,
      ),
    )

    const hour = new Date().getHours()
    const isNight = hour >= 23 || hour < 5

    this.state = {
      ...this.state,
      mainState: 'feedback',
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      lastInteractionAt: now,
      lastFeedAt: now,
      relationshipTier: resolveRelationshipTier(
        this.state.stats.favorability + effect.favorability + Math.max(0, scoreBonus),
      ),
      stats: {
        ...this.state.stats,
        satiety: clampStat(this.state.stats.satiety + feedSatietyGain),
        satietyClockAt: now,
        interactionCount: this.state.stats.interactionCount + 1,
        favorability:
          this.state.stats.favorability + effect.favorability + Math.max(0, scoreBonus),
        tacit: this.state.stats.tacit + effect.tacit,
        mood: clampStat(this.state.stats.mood + effect.mood + scoreBonus),
        energy: clampStat(this.state.stats.energy + effect.energy + Math.max(0, scoreBonus)),
        feedCount: this.state.stats.feedCount + 1,
        nightInteractionCount: isNight
          ? this.state.stats.nightInteractionCount + 1
          : this.state.stats.nightInteractionCount,
      },
    }

    await this.persist()
    await appendDiaryEvent(this.dataRoot, { type: 'feed', payload: { foodType } })

    return {
      state: this.state,
      bubbleText: line.text,
    }
  }

  async debugShowDialogue(type: string, tierOverride?: string): Promise<IpcResponse> {
    if (!this.contentBundle) {
      throw new Error('Content bundle not initialized')
    }

    const savedTier = this.state.relationshipTier
    if (tierOverride && ['low', 'mid', 'high'].includes(tierOverride)) {
      this.state = { ...this.state, relationshipTier: tierOverride as 'low' | 'mid' | 'high' }
    }

    const raw = this.pickLineWithFallback(type, 'interaction')

    const isFeedish =
      raw.type.startsWith('feed_food_') ||
      [
        'feed_sweet',
        'feed_fruit',
        'feed_drink',
        'feed_savory',
        'feed_meal',
        'feed_repeat',
        'feed_reject_full',
      ].includes(raw.type)

    const line = isFeedish ? this.formatFoodLine(raw, '调试食物', 4) : raw

    const needsMilestone = raw.type.includes('personal_milestone')
    const decorated = this.decorateSpeechLine(line, needsMilestone ? '调试纪念日' : undefined)

    this.state = {
      ...this.state,
      mainState: 'feedback',
      relationshipTier: savedTier,
      currentExpression: decorated.expressionHint,
      currentMotion: decorated.motionHint,
      lastBubbleText: decorated.text,
      pendingBranchPlotId: null,
      pendingBranchPlotChoices: null,
    }

    await this.persist()

    return {
      state: this.state,
      bubbleText: `${tierOverride ? `[${tierOverride}] ` : ''}${decorated.text}`,
    }
  }

  async debugShowBranchPlot(plotId: string): Promise<IpcResponseWithBranch> {
    const plot = this.getInteractivePlot(plotId)
    if (!plot) {
      throw new Error(`Unknown branch plot: ${plotId}`)
    }

    const promptText = this.formatSpeechText(plot.prompt)
    const choices: PendingBranchPlotChoice[] = plot.choices.map((c) => ({
      id: c.id,
      label: c.label,
    }))

    this.state = {
      ...this.state,
      mainState: 'feedback',
      currentExpression: plot.promptExpressionHint ?? 'happy',
      currentMotion: plot.promptMotionHint ?? 'idle',
      lastBubbleText: promptText,
      pendingBranchPlotId: plot.id,
      pendingBranchPlotChoices: choices,
    }

    await this.persist()

    return {
      state: this.state,
      bubbleText: promptText,
      branchChoices: choices,
    }
  }

  async handlePetLongPress(): Promise<IpcResponseWithActions> {
    if (this.state.focusSession.status === 'in_progress') {
      if (!this.state.settings.speechEnabled) {
        this.state = { ...this.state, mainState: resolveMainState('longPress') }
        await this.persist()
        return { state: this.state, bubbleText: null, actions: ACTIONS }
      }
      const line = this.buildFocusContextLine()
      this.state = {
        ...this.state,
        mainState: resolveMainState('longPress'),
        currentExpression: line.expressionHint,
        currentMotion: line.motionHint,
        lastBubbleText: line.text,
        lastInteractionAt: new Date().toISOString(),
        relationshipTier: resolveRelationshipTier(this.state.stats.favorability + 1),
        stats: {
          ...this.state.stats,
          favorability: this.state.stats.favorability + 1,
          tacit: this.state.stats.tacit + 1,
        },
      }
      await this.persist()
      return { state: this.state, bubbleText: line.text, actions: ACTIONS }
    }

    const line = this.decorateSpeechLine(
      this.pickLineWithFallback('interaction_long_press', 'interaction'),
    )

    this.state = {
      ...this.state,
      mainState: resolveMainState('longPress'),
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
    }

    await this.persist()

    return {
      state: this.state,
      bubbleText: line.text,
      actions: ACTIONS,
    }
  }

  async handlePetContextMenu(): Promise<IpcResponseWithActions> {
    if (this.state.focusSession.status === 'in_progress') {
      if (!this.state.settings.speechEnabled) {
        this.state = {
          ...this.state,
          mainState: resolveMainState('longPress'),
          pendingBranchPlotId: null,
          pendingBranchPlotChoices: null,
        }
        await this.persist()
        return { state: this.state, bubbleText: null, actions: ACTIONS }
      }
      const line = this.buildFocusContextLine()
      this.state = {
        ...this.state,
        mainState: resolveMainState('longPress'),
        currentExpression: line.expressionHint,
        currentMotion: line.motionHint,
        lastBubbleText: line.text,
        lastInteractionAt: new Date().toISOString(),
        pendingBranchPlotId: null,
        pendingBranchPlotChoices: null,
        relationshipTier: resolveRelationshipTier(this.state.stats.favorability + 1),
        stats: {
          ...this.state.stats,
          favorability: this.state.stats.favorability + 1,
          tacit: this.state.stats.tacit + 1,
        },
      }
      await this.persist()
      return { state: this.state, bubbleText: line.text, actions: ACTIONS }
    }

    const line = this.decorateSpeechLine(
      this.pickLineWithFallback('interaction_context_menu', 'interaction_long_press'),
    )

    this.state = {
      ...this.state,
      mainState: resolveMainState('longPress'),
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      pendingBranchPlotId: null,
      pendingBranchPlotChoices: null,
    }

    await this.persist()

    return {
      state: this.state,
      bubbleText: line.text,
      actions: ACTIONS,
    }
  }

  async startFocusSession(duration: number, goal?: string): Promise<IpcResponse> {
    const minutes = clampFocusDurationMinutes(duration)
    const line = this.decorateSpeechLine(this.pickLine('focus_start'))
    const now = new Date().toISOString()
    const normalizedGoal = normalizeFocusGoal(goal)

    this.state = {
      ...this.state,
      mainState: resolveMainState('focusStart'),
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      focusSession: {
        sessionId: randomUUID(),
        status: 'in_progress',
        startAt: now,
        plannedDurationMinutes: minutes,
        lastHeartbeatAt: now,
        goal: normalizedGoal,
      },
    }

    await this.persist()
    await appendDiaryEvent(this.dataRoot, {
      type: 'focus_start',
      payload: { plannedDurationMinutes: minutes },
    })

    return {
      state: this.state,
      bubbleText: line.text,
    }
  }

  async focusHeartbeat(): Promise<IpcResponse> {
    if (this.state.focusSession.status !== 'in_progress' || !this.state.settings.speechEnabled) {
      return {
        state: this.state,
        bubbleText: null,
      }
    }

    const line = this.decorateSpeechLine(
      this.pickLineWithFallback('focus_progress', 'focus_start'),
    )
    const now = new Date().toISOString()

    this.state = {
      ...this.state,
      mainState: resolveMainState('focusStart'),
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      focusSession: {
        ...this.state.focusSession,
        lastHeartbeatAt: now,
      },
    }

    const nowMs = Date.now()
    if (nowMs - this.lastFocusHeartbeatPersistAt >= FOCUS_HEARTBEAT_PERSIST_INTERVAL_MS) {
      await this.persist()
      this.lastFocusHeartbeatPersistAt = nowMs
    }

    return {
      state: this.state,
      bubbleText: line.text,
    }
  }

  async completeFocusSession(reviewTone: FocusSessionReviewTone): Promise<IpcResponse> {
    const rawLine = this.decorateSpeechLine(this.pickLine('focus_complete'))
    const completedDurationMinutes = this.resolveCompletedFocusDurationMinutes()
    const completedGoal = this.state.focusSession.goal

    const line = {
      ...rawLine,
      text: `${rawLine.text}${focusReviewSuffix(reviewTone)}`,
    }

    this.state = {
      ...this.state,
      mainState: resolveMainState('focusEnd'),
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      relationshipTier: resolveRelationshipTier(this.state.stats.favorability + 2),
      focusSession: createDefaultState().focusSession,
      stats: {
        ...this.state.stats,
        favorability: this.state.stats.favorability + 2,
        tacit: this.state.stats.tacit + 2,
        focusCompletedCount: this.state.stats.focusCompletedCount + 1,
        focusTotalMinutes: this.state.stats.focusTotalMinutes + completedDurationMinutes,
        lastFocusDurationMinutes:
          completedDurationMinutes > 0
            ? completedDurationMinutes
            : this.state.stats.lastFocusDurationMinutes,
        lastFocusGoal: completedGoal,
        lastFocusReviewTone: reviewTone,
      },
    }

    await this.persist()
    await appendDiaryEvent(this.dataRoot, {
      type: 'focus_complete',
      payload: { actualDurationMinutes: completedDurationMinutes },
    })

    return {
      state: this.state,
      bubbleText: line.text,
    }
  }

  async interruptFocusSession(): Promise<IpcResponse> {
    const line = this.decorateSpeechLine(this.pickLine('focus_interrupt'))
    const now = new Date().toISOString()

    this.state = {
      ...this.state,
      mainState: resolveMainState('focusEnd'),
      currentExpression: line.expressionHint,
      currentMotion: line.motionHint,
      lastBubbleText: line.text,
      focusSession: createDefaultState().focusSession,
      comfortState: {
        ...this.state.comfortState,
        lastFocusInterruptAt: now,
        lastComfortAt: now,
        lastDetectedReason: 'focus_interrupt',
      },
      stats: {
        ...this.state.stats,
        focusInterruptedCount: this.state.stats.focusInterruptedCount + 1,
      },
    }

    await this.persist()
    await appendDiaryEvent(this.dataRoot, { type: 'focus_interrupt' })

    return {
      state: this.state,
      bubbleText: line.text,
    }
  }

  async listDiaryEntries(limit: number): Promise<DiaryEntry[]> {
    return listRecentDiaryEntries(this.dataRoot, this.contentRoot, limit, this.state.relationshipTier)
  }

  async getDiaryEntry(dateKey: string): Promise<DiaryEntry> {
    return getDiaryEntryForDate(this.dataRoot, this.contentRoot, dateKey, this.state.relationshipTier)
  }

  async getCollection(): Promise<{
    badges: (CollectionBadgeDef & { unlocked: boolean })[]
    cards: (CollectionCardDef & { unlocked: boolean })[]
  }> {
    if (!this.collectionDefs) {
      const [badgesBundle, cardsBundle] = await Promise.all([
        loadCollectionBadges(this.contentRoot),
        loadStoryCards(this.contentRoot),
      ])
      this.collectionDefs = {
        badges: badgesBundle.badges,
        cards: cardsBundle.cards,
      }
    }

    return {
      badges: this.collectionDefs.badges.map((badge) => ({
        ...badge,
        unlocked: isBadgeUnlocked(badge.id, this.state),
      })),
      cards: this.collectionDefs.cards.map((card) => ({
        ...card,
        unlocked: isStoryCardUnlocked(card.id, this.state),
      })),
    }
  }

  async getSettings(): Promise<Settings> {
    return this.state.settings
  }

  async updateSettings(input: Partial<Settings>): Promise<Settings> {
    const nextPersonalYears =
      input.personalDates !== undefined
        ? Object.fromEntries(
            Object.entries(this.state.stats.personalDateCelebrationYears).filter(([id]) =>
              input.personalDates!.some((d) => d.id === id),
            ),
          )
        : this.state.stats.personalDateCelebrationYears

    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        ...input,
        bubbleStyle: {
          ...this.state.settings.bubbleStyle,
          ...input.bubbleStyle,
        },
      },
      ...(input.personalDates !== undefined
        ? {
            stats: {
              ...this.state.stats,
              personalDateCelebrationYears: nextPersonalYears,
            },
          }
        : {}),
    }

    await this.persist()
    return this.state.settings
  }

  async updateWindowPosition(position: WindowPosition): Promise<void> {
    this.state = {
      ...this.state,
      windowPosition: position,
      windowPositions: {
        ...this.state.windowPositions,
        desktop: position,
      },
    }
    await this.persist()
  }

  getWindowPositionForDisplayMode(mode: string): WindowPosition | null {
    const slot = getWindowPositionSlotForDisplayMode(mode)
    return this.state.windowPositions[slot] ?? (slot === 'desktop' ? this.state.windowPosition : null)
  }

  async updateWindowPositionForDisplayMode(mode: string, position: WindowPosition): Promise<void> {
    const slot = getWindowPositionSlotForDisplayMode(mode)
    this.state = {
      ...this.state,
      windowPosition: position,
      windowPositions: {
        ...this.state.windowPositions,
        [slot]: position,
      },
    }
    await this.persist()
  }

  getState(): AppState {
    return this.state
  }

  async getRandomFarewellLine(): Promise<string> {
    if (!this.farewellLines) {
      try {
        const bundle = await loadFarewellBundle(this.contentRoot)
        this.farewellLines = bundle.lines
      } catch {
        this.farewellLines = ['下次见，木头会等你回到桌面。']
      }
    }
    const lines = this.farewellLines
    const idx = Math.floor(Math.random() * lines.length)
    return this.formatSpeechText(lines[idx] ?? lines[0] ?? '下次见。')
  }

  async flushPersist(): Promise<void> {
    await this.persist()
  }

  resolveCelebration(now: Date): CelebrationResult | null {
    if (!this.holidayCalendar) {
      return null
    }
    return resolvePriorityCelebration(now, this.holidayCalendar, this.state.settings.personalDates)
  }

  formatSpeechText(text: string, milestoneLabel?: string): string {
    const nick = this.state.settings.userNickname.trim()
    let out = nick ? text.replaceAll('{nickname}', nick) : removeNicknamePlaceholder(text)
    if (milestoneLabel !== undefined) {
      out = out.replaceAll('{milestoneLabel}', milestoneLabel)
    }
    return out
  }

  decorateSpeechLine(line: DialogueLine, milestoneLabel?: string): DialogueLine {
    return { ...line, text: this.formatSpeechText(line.text, milestoneLabel) }
  }

  applyActivitySatietyDrain(now: Date, points: number): void {
    if (points <= 0) {
      return
    }
    const nextSatiety = Math.max(0, Math.round(this.state.stats.satiety - points))
    this.state = {
      ...this.state,
      stats: {
        ...this.state.stats,
        satiety: nextSatiety,
        satietyClockAt: now.toISOString(),
      },
    }
  }

  applySatietyDecayToState(now: Date): void {
    const clockIso = this.state.stats.satietyClockAt ?? this.state.journeyStartedAt
    const elapsedMs = now.getTime() - new Date(clockIso!).getTime()
    if (elapsedMs <= 0) {
      return
    }
    const hours = elapsedMs / 3600000
    const decay = Math.min(SATIETY_DECAY_BURST_CAP, hours * SATIETY_DECAY_PER_HOUR)
    const nextSatiety = Math.max(0, Math.round(this.state.stats.satiety - decay))
    this.state = {
      ...this.state,
      stats: {
        ...this.state.stats,
        satiety: nextSatiety,
        satietyClockAt: now.toISOString(),
      },
    }
  }

  shouldOfferHungerLines(): boolean {
    return this.state.stats.satiety <= SATIETY_HUNGER_THRESHOLD
  }

  nextComfortStateAfterSpeech(
    reason: ComfortReason | undefined,
    nowDate: Date,
  ): AppState['comfortState'] {
    if (!reason) {
      return this.state.comfortState
    }
    return {
      ...this.state.comfortState,
      lastComfortAt: nowDate.toISOString(),
      lastDetectedReason: reason,
    }
  }

  nextTimeGreetingStateAfterSpeech(
    period: TimeGreetingPeriod | undefined,
    nowDate: Date,
  ): AppState['timeGreetingState'] {
    const dateKey = localDateKeyFromDate(nowDate)
    const base =
      this.state.timeGreetingState.dateKey === dateKey
        ? this.state.timeGreetingState
        : {
            dateKey,
            greetedPeriods: [] as TimeGreetingPeriod[],
          }

    if (!period || base.greetedPeriods.includes(period)) {
      return base
    }

    return {
      dateKey,
      greetedPeriods: [...base.greetedPeriods, period],
    }
  }

  getTimeGreetingPeriod(nowDate: Date): TimeGreetingPeriod {
    const hour = nowDate.getHours()
    if (hour >= 6 && hour < 11) {
      return 'morning'
    }
    if (hour >= 11 && hour < 14) {
      return 'noon'
    }
    if (hour >= 14 && hour < 18) {
      return 'afternoon'
    }
    if (hour >= 18 && hour < 23) {
      return 'evening'
    }
    return 'night'
  }

  getTimeGreetingDialogueType(period: TimeGreetingPeriod): string {
    switch (period) {
      case 'morning':
        return 'idle_morning'
      case 'noon':
        return 'idle_noon'
      case 'afternoon':
        return 'idle_afternoon'
      case 'evening':
        return 'idle_evening'
      case 'night':
      default:
        return 'idle_night'
    }
  }

  shouldOfferTimeGreeting(period: TimeGreetingPeriod, nowDate: Date): boolean {
    const dateKey = localDateKeyFromDate(nowDate)
    const state =
      this.state.timeGreetingState.dateKey === dateKey
        ? this.state.timeGreetingState
        : {
            dateKey,
            greetedPeriods: [] as TimeGreetingPeriod[],
          }

    if (state.greetedPeriods.includes(period)) {
      return false
    }

    if (period === 'night' && !this.state.settings.nightComfortEnabled) {
      return false
    }

    return true
  }

  pickComfortLineIfNeeded(
    source: 'idle' | 'interaction' | 'double',
    nowDate: Date,
    forcedReason?: ComfortReason,
  ): PickedLine | null {
    const reason = forcedReason ?? this.detectComfortReason(source, nowDate)
    if (!reason) {
      return null
    }

    if (!forcedReason && source === 'idle' && this.state.comfortState.lastComfortAt) {
      const elapsed =
        nowDate.getTime() - new Date(this.state.comfortState.lastComfortAt).getTime()
      if (elapsed < COMFORT_IDLE_COOLDOWN_MS) {
        return null
      }
    }

    return {
      line: this.pickLineWithFallback(
        source === 'idle' ? 'idle_comfort' : 'interaction_comfort',
        source === 'idle' ? 'idle' : source === 'double' ? 'interaction_double' : 'interaction',
      ),
      comfortReason: reason,
    }
  }

  detectComfortReason(
    source: 'idle' | 'interaction' | 'double',
    nowDate: Date,
  ): ComfortReason | null {
    const nowMs = nowDate.getTime()
    const hour = nowDate.getHours()
    const isLateNight = hour >= 23 || hour < 5

    if (this.state.comfortState.lastFocusInterruptAt) {
      const elapsed =
        nowMs - new Date(this.state.comfortState.lastFocusInterruptAt).getTime()
      if (elapsed >= 0 && elapsed <= COMFORT_RECENT_FOCUS_INTERRUPT_MS) {
        return 'focus_interrupt'
      }
    }

    if (this.state.stats.mood <= COMFORT_MOOD_THRESHOLD) {
      return 'low_mood'
    }

    if (this.state.stats.energy <= COMFORT_ENERGY_THRESHOLD) {
      return 'low_energy'
    }

    if (
      source !== 'idle' &&
      this.recentClickAt.length >= CLICK_SPAM_THRESHOLD &&
      (isLateNight ||
        this.state.stats.mood <= COMFORT_RAPID_CLICK_MOOD_GATE ||
        this.state.stats.energy <= COMFORT_RAPID_CLICK_ENERGY_GATE)
    ) {
      return 'rapid_clicks'
    }

    if (source !== 'idle' && isLateNight) {
      return 'late_night'
    }

    return null
  }

  celebrationMilestonePatch(
    celebration: CelebrationResult | null,
    year: number,
  ): Partial<AppState['stats']> {
    if (!celebration) {
      return {}
    }
    switch (celebration.kind) {
      case 'mutou_birthday':
        return { mutouBirthdayCelebrationYear: year }
      case 'new_year':
        return { newYearCelebrationYear: year }
      case 'festival':
        return { festivalDayCelebrationYear: year }
      case 'personal':
        return {
          personalDateCelebrationYears: {
            ...this.state.stats.personalDateCelebrationYears,
            [celebration.date.id]: year,
          },
        }
      default:
        return {}
    }
  }

  pickClickLine(): PickedLine {
    const now = Date.now()
    const nowDate = new Date(now)

    this.recentClickAt = this.recentClickAt.filter(
      (timestamp) => now - timestamp <= CLICK_SPAM_WINDOW_MS,
    )
    this.recentClickAt.push(now)

    const celebration = this.resolveCelebration(nowDate)

    if (celebration?.kind === 'mutou_birthday') {
      return {
        line: this.pickLineWithFallback('interaction_holiday_birthday_mutou', 'interaction'),
      }
    }
    if (celebration?.kind === 'new_year') {
      return { line: this.pickLineWithFallback('interaction_holiday_new_year', 'interaction') }
    }
    if (celebration?.kind === 'personal') {
      return {
        line: this.pickLineWithFallback('interaction_personal_milestone', 'interaction'),
        milestoneLabel: celebration.date.label,
      }
    }
    if (celebration?.kind === 'festival') {
      return { line: this.pickLineWithFallback('interaction_holiday_festival', 'interaction') }
    }

    if (this.shouldOfferHungerLines()) {
      return { line: this.pickLineWithFallback('interaction_hunger_hint', 'interaction') }
    }

    const comfort = this.pickComfortLineIfNeeded('interaction', nowDate)
    if (comfort) {
      return comfort
    }

    if (this.recentClickAt.length >= CLICK_SPAM_THRESHOLD) {
      return { line: this.pickLine('interaction_repeat') }
    }

    return { line: this.pickLine('interaction') }
  }

  pickDoubleLine(): PickedLine {
    /** 双击只保留"亲密确认"语义，不再复用点击链路里的安抚 / 饥饿 / 节日差分。 */
    return { line: this.pickLine('interaction_double') }
  }

  pickIdleLine(): PickedLine {
    const nowDate = new Date()

    if (this.holidayCalendar) {
      const celebration = this.resolveCelebration(nowDate)

      if (celebration?.kind === 'mutou_birthday') {
        return { line: this.pickLineWithFallback('idle_holiday_birthday_mutou', 'idle') }
      }
      if (celebration?.kind === 'new_year') {
        return { line: this.pickLineWithFallback('idle_holiday_new_year', 'idle') }
      }
      if (celebration?.kind === 'personal') {
        return {
          line: this.pickLineWithFallback('idle_personal_milestone', 'idle'),
          milestoneLabel: celebration.date.label,
        }
      }
      if (celebration?.kind === 'festival') {
        return { line: this.pickLineWithFallback('idle_holiday_festival', 'idle') }
      }
    }

    if (this.shouldOfferHungerLines()) {
      return { line: this.pickLineWithFallback('idle_hunger_hint', 'idle') }
    }

    const timeGreetingPeriod = this.getTimeGreetingPeriod(nowDate)
    if (this.shouldOfferTimeGreeting(timeGreetingPeriod, nowDate)) {
      return {
        line: this.pickLineWithFallback(
          this.getTimeGreetingDialogueType(timeGreetingPeriod),
          'idle',
        ),
        timeGreetingPeriod,
      }
    }

    const comfort = this.pickComfortLineIfNeeded('idle', nowDate)
    if (comfort) {
      return comfort
    }

    return {
      line: this.pickIdleAmbientLine(timeGreetingPeriod),
    }
  }

  pickFeedLine(foodType: string, foodCategory: FoodCategory, shouldUseRepeatLine: boolean): DialogueLine {
    if (shouldUseRepeatLine) {
      return this.pickLine('feed_repeat')
    }
    return this.pickLineWithFallback(
      getFoodDialogueType(foodType),
      FOOD_EFFECTS[foodCategory].dialogueType,
    )
  }

  pickLineWithFallback(primaryType: string, fallbackType: string): DialogueLine {
    try {
      return this.pickLine(primaryType)
    } catch {
      return this.pickLine(fallbackType)
    }
  }

  getInteractivePlot(plotId: string): InteractivePlotDef | undefined {
    return this.interactivePlots?.plots.find((p) => p.id === plotId)
  }

  wouldBeClickRepeatSpamy(nowMs: number): boolean {
    const filtered = this.recentClickAt.filter((t) => nowMs - t <= CLICK_SPAM_WINDOW_MS)
    return filtered.length + 1 >= CLICK_SPAM_THRESHOLD
  }

  couldOfferBranchPlotNow(
    _nowDate: Date,
    wouldSpam: boolean,
    celebration: CelebrationResult | null,
  ): boolean {
    if (!this.interactivePlots || this.interactivePlots.plots.length === 0) {
      return false
    }
    if (this.state.pendingBranchPlotId) {
      return false
    }
    if (wouldSpam || celebration) {
      return false
    }

    const s = this.state.stats
    if (s.interactionCount < BRANCH_PLOT_MIN_INTERACTIONS) {
      return false
    }
    if (s.interactionCount - s.lastBranchPlotAtInteraction < BRANCH_PLOT_COOLDOWN_INTERACTIONS) {
      return false
    }
    if (this.shouldOfferHungerLines()) {
      return false
    }

    return true
  }

  pickLine(type: string): DialogueLine {
    if (!this.contentBundle) {
      throw new Error('Content bundle not initialized')
    }
    return pickDialogue(
      this.contentBundle,
      type,
      this.nextDialogueSeed(),
      this.state.relationshipTier,
    )
  }

  pickIdleAmbientLine(period: TimeGreetingPeriod): DialogueLine {
    const candidateTypes = this.getIdleAmbientCandidateTypes(period)
    const uniqueLines = candidateTypes.flatMap((type) => this.getScopedLinesForType(type))
    const dedupedLines = Array.from(new Map(uniqueLines.map((line) => [line.id, line])).values())
    const freshLines = dedupedLines.filter(
      (line) => !this.recentAmbientLineIds.includes(line.id),
    )
    const pool = freshLines.length > 0 ? freshLines : dedupedLines

    if (pool.length === 0) {
      return this.pickLine('idle')
    }

    return pool[this.nextDialogueSeed() % pool.length]
  }

  getIdleAmbientCandidateTypes(period: TimeGreetingPeriod): string[] {
    const seed = this.nextDialogueSeed()
    const candidateTypes: string[] = ['idle']

    switch (period) {
      case 'morning':
        if (seed % 100 < 25) {
          candidateTypes.unshift('idle_morning')
        }
        break
      case 'noon':
        if (seed % 100 < 25) {
          candidateTypes.unshift('idle_noon')
        }
        break
      case 'afternoon':
        if (seed % 100 < 25) {
          candidateTypes.unshift('idle_afternoon')
        }
        break
      case 'evening':
        if (seed % 100 < 25) {
          candidateTypes.unshift('idle_evening')
        }
        break
      case 'night':
        if (this.state.settings.nightComfortEnabled && seed % 100 < 30) {
          candidateTypes.unshift('idle_night')
        }
        break
      default:
        break
    }

    return candidateTypes
  }

  getScopedLinesForType(type: string): DialogueLine[] {
    if (!this.contentBundle) {
      throw new Error('Content bundle not initialized')
    }

    const allLines = this.contentBundle.dialogues.filter((line) => line.type === type)
    if (allLines.length === 0) {
      return []
    }

    const exactTierLines = allLines.filter(
      (line) => line.relationshipTier === this.state.relationshipTier,
    )
    if (exactTierLines.length > 0) {
      return exactTierLines
    }

    const genericLines = allLines.filter((line) => !line.relationshipTier)
    return genericLines.length > 0 ? genericLines : allLines
  }

  rememberRecentAmbientLine(lineId: string): void {
    this.recentAmbientLineIds = [
      ...this.recentAmbientLineIds.filter((id) => id !== lineId),
      lineId,
    ].slice(-10)
  }

  nextDialogueSeed(): number {
    const seed = this.dialogueSequence
    this.dialogueSequence += 1
    return seed
  }

  formatFoodLine(line: DialogueLine, foodLabel: string, preferenceScore: number): DialogueLine {
    const preferenceSuffix =
      preferenceScore >= 5
        ? '，这口是真的很对胃口。'
        : preferenceScore === 4
          ? '，今天这份投喂我会好好记着。'
          : preferenceScore === 3
            ? '，我会乖乖收下。'
            : '，不过我还是会认真收好的。'

    return {
      ...line,
      text: line.text.replaceAll('{food}', foodLabel).replaceAll('{preferenceSuffix}', preferenceSuffix),
    }
  }

  resolveCompletedFocusDurationMinutes(): number {
    const startedAt = this.state.focusSession.startAt
    if (!startedAt) {
      return Math.max(1, this.state.focusSession.plannedDurationMinutes ?? 1)
    }
    const elapsedMs = Math.max(0, Date.now() - new Date(startedAt).getTime())
    return Math.max(1, Math.round(elapsedMs / 60000))
  }

  async persist(): Promise<void> {
    const run = this.persistQueue.catch(() => undefined).then(async () => {
      await saveAppState(this.dataRoot, this.state)
    })
    this.persistQueue = run
    await run
  }

  applyDailyProgress(): void {
    const today = localDateKeyFromDate(new Date())
    const lastInteractionDay = this.state.lastInteractionAt
      ? localDateKeyFromDate(new Date(this.state.lastInteractionAt))
      : null

    if (lastInteractionDay === today) {
      return
    }

    this.state = {
      ...this.state,
      stats: {
        ...this.state.stats,
        companionDays: Math.max(
          1,
          this.state.stats.companionDays + (lastInteractionDay ? 1 : 0),
        ),
      },
    }
  }
}

function createDefaultState(): AppState {
  const now = new Date().toISOString()
  return {
    mainState: 'idle',
    relationshipTier: 'low',
    journeyStartedAt: now,
    currentExpression: 'calm',
    currentMotion: 'idle',
    lastBubbleText: '我在呢。',
    lastInteractionAt: null,
    lastFeedAt: null,
    pendingBranchPlotId: null,
    pendingBranchPlotChoices: null,
    windowPosition: null,
    windowPositions: {
      desktop: null,
      panel: null,
    },
    comfortState: {
      lastFocusInterruptAt: null,
      lastComfortAt: null,
      lastDetectedReason: null,
    },
    timeGreetingState: {
      dateKey: null,
      greetedPeriods: [],
    },
    settings: {
      alwaysOnTop: true,
      opacity: 0.96,
      speechEnabled: true,
      nightComfortEnabled: true,
      disturbanceLevel: 'medium',
      bubbleStyle: {
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        textColor: '#ffffff',
      },
      userNickname: '',
      personalDates: [],
    },
    focusSession: {
      sessionId: '',
      status: 'idle',
      startAt: null,
      plannedDurationMinutes: null,
      lastHeartbeatAt: null,
      goal: null,
    },
    stats: {
      favorability: 0,
      tacit: 0,
      mood: 80,
      energy: 90,
      companionDays: 1,
      interactionCount: 0,
      focusCompletedCount: 0,
      focusTotalMinutes: 0,
      focusInterruptedCount: 0,
      lastFocusDurationMinutes: null,
      lastFocusGoal: null,
      lastFocusReviewTone: null,
      feedCount: 0,
      nightInteractionCount: 0,
      mutouBirthdayCelebrationYear: null,
      newYearCelebrationYear: null,
      festivalDayCelebrationYear: null,
      personalDateCelebrationYears: {},
      satiety: 80,
      satietyClockAt: null,
      lastBranchPlotAtInteraction: -1000,
      branchPlotRotation: 0,
    },
  }
}

function localDateKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWindowPositionSlotForDisplayMode(mode: string): 'desktop' | 'panel' {
  return mode === 'panel' ? 'panel' : 'desktop'
}

function removeNicknamePlaceholder(text: string): string {
  return text
    .replace(/(^|[。！？……])\s*\{nickname\}，?/g, '$1')
    .replace(/，?\s*\{nickname\}\s*，?/g, '，')
    .replace(/(^|[。！？……])，/g, '$1')
    .replace(/，，+/g, '，')
    .replace(/([。！？……])，/g, '$1')
    .replace(/^，+/, '')
    .replace(/，+$/, '')
    .trim()
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, value))
}
