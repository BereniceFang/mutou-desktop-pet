// AIGC START
import { create } from 'zustand'

import type { PetApi } from '../../preload/index.js'

type AppState = {
  mainState: string
  relationshipTier: string
  currentExpression: string
  currentMotion: string
  lastBubbleText: string | null
  settings: {
    alwaysOnTop: boolean
    opacity: number
    speechEnabled: boolean
    nightComfortEnabled: boolean
    disturbanceLevel: string
    bubbleStyle: {
      backgroundColor: string
      borderColor: string
      borderWidth: number
      textColor: string
    }
    userNickname: string
    personalDates: { id: string; label: string; month: number; day: number; kind: string }[]
  }
  focusSession: {
    sessionId: string
    status: string
    startAt: string | null
    plannedDurationMinutes: number | null
    lastHeartbeatAt: string | null
    goal: string | null
  }
  stats: {
    favorability: number
    tacit: number
    mood: number
    energy: number
    companionDays: number
    interactionCount: number
    focusCompletedCount: number
    focusTotalMinutes: number
    focusInterruptedCount: number
    lastFocusDurationMinutes: number | null
    lastFocusGoal: string | null
    lastFocusReviewTone: string | null
    feedCount: number
    nightInteractionCount: number
    satiety: number
    [key: string]: unknown
  }
  pendingBranchPlotId: string | null
  pendingBranchPlotChoices: { id: string; label: string }[] | null
  [key: string]: unknown
}

type Action = { id: string; label: string }

interface BootstrapEnvironment {
  platform: string
  appVersion: string
  schemaVersion: number
}

interface PetStore {
  ready: boolean
  appState: AppState | null
  bubbleText: string | null
  actions: Action[]
  branchChoices: { id: string; label: string }[] | null
  environment: BootstrapEnvironment | null

  bootstrap(): Promise<void>
  triggerStartupGreeting(): Promise<void>
  handleClick(): Promise<void>
  handleFeed(foodType: string): Promise<void>
  requestComfort(tone: 'heavy' | 'light'): Promise<void>
  resolveBranchChoice(choiceId: string): Promise<void>
  triggerIdleBubble(): Promise<void>
  startFocus(duration: number, goal?: string): Promise<void>
  focusHeartbeat(): Promise<void>
  completeFocus(reviewTone: 'done' | 'partial' | 'enough'): Promise<void>
  interruptFocus(): Promise<void>
  updateSettings(input: Record<string, unknown>): Promise<void>
  clearBubble(): void
}

declare global {
  interface Window {
    petApp: PetApi
  }
}

function applyIpcResult(
  set: (partial: Partial<PetStore>) => void,
  result: { state: AppState; bubbleText?: string | null; actions?: Action[]; branchChoices?: { id: string; label: string }[] },
) {
  set({
    appState: result.state,
    bubbleText: result.bubbleText ?? null,
    ...(result.actions ? { actions: result.actions } : {}),
    branchChoices: result.branchChoices ?? result.state.pendingBranchPlotChoices ?? null,
  })
}

export const usePetStore = create<PetStore>((set) => ({
  ready: false,
  appState: null,
  bubbleText: null,
  actions: [],
  branchChoices: null,
  environment: null,

  async bootstrap() {
    const data = await window.petApp.loadAppBootstrapData() as {
      state: AppState
      actions: Action[]
      environment: BootstrapEnvironment
    }
    set({
      ready: true,
      appState: data.state,
      actions: data.actions,
      environment: data.environment,
      bubbleText: data.state.lastBubbleText,
      branchChoices: data.state.pendingBranchPlotChoices,
    })
  },

  async triggerStartupGreeting() {
    const result = await window.petApp.triggerStartupGreeting() as { state: AppState; bubbleText: string | null }
    applyIpcResult(set, result)
  },

  async handleClick() {
    const result = await window.petApp.handlePetClick() as { state: AppState; bubbleText: string | null; branchChoices?: { id: string; label: string }[] }
    applyIpcResult(set, result)
  },

  async handleFeed(foodType: string) {
    const result = await window.petApp.handleFeed(foodType) as { state: AppState; bubbleText: string | null }
    applyIpcResult(set, result)
  },

  async requestComfort(tone: 'heavy' | 'light') {
    const result = await window.petApp.requestComfort(tone) as { state: AppState; bubbleText: string | null }
    applyIpcResult(set, result)
  },

  async resolveBranchChoice(choiceId: string) {
    const result = await window.petApp.resolveBranchPlotChoice(choiceId) as { state: AppState; bubbleText: string | null }
    applyIpcResult(set, result)
  },

  async triggerIdleBubble() {
    const result = await window.petApp.triggerIdleBubble() as { state: AppState; bubbleText: string | null }
    applyIpcResult(set, result)
  },

  async startFocus(duration: number, goal?: string) {
    const result = await window.petApp.startFocusSession(duration, goal) as { state: AppState; bubbleText: string | null }
    applyIpcResult(set, result)
  },

  async focusHeartbeat() {
    const result = await window.petApp.focusHeartbeat() as { state: AppState; bubbleText: string | null }
    applyIpcResult(set, result)
  },

  async completeFocus(reviewTone: 'done' | 'partial' | 'enough') {
    const result = await window.petApp.completeFocusSession(reviewTone) as { state: AppState; bubbleText: string | null }
    applyIpcResult(set, result)
  },

  async interruptFocus() {
    const result = await window.petApp.interruptFocusSession() as { state: AppState; bubbleText: string | null }
    applyIpcResult(set, result)
  },

  async updateSettings(input: Record<string, unknown>) {
    const settings = await window.petApp.updateSettings(input) as AppState['settings']
    set((prev) => ({
      appState: prev.appState ? { ...prev.appState, settings } : prev.appState,
    }))
  },

  clearBubble() {
    set({ bubbleText: null })
  },
}))
// AIGC END
