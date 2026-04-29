import electronRenderer from 'electron/renderer'

const { contextBridge, ipcRenderer } = electronRenderer

export interface PetApi {
  notifyMouseEnter(): Promise<void>
  notifyMouseLeave(): Promise<void>
  openDiaryWindow(): Promise<void>
  closeDiaryWindow(): Promise<void>
  openGameWindow(): Promise<void>
  closeGameWindow(): Promise<void>
  getMilestones(): Promise<{ key: string; label: string; date: string }[]>
  checkNewUnlocks(): Promise<string[]>
  recordGameResult(gameName: string, result: string): Promise<void>
  recordMoodCheckin(mood: string): Promise<void>
  checkTierUp(): Promise<string | null>
  loadAppBootstrapData(): Promise<unknown>
  triggerStartupGreeting(): Promise<unknown>
  handlePetClick(): Promise<unknown>
  resolveBranchPlotChoice(choiceId: string): Promise<unknown>
  handlePetDoubleClick(): Promise<unknown>
  requestComfort(tone: 'heavy' | 'light'): Promise<unknown>
  handleFeed(foodType: string): Promise<unknown>
  triggerIdleBubble(): Promise<unknown>
  handlePetLongPress(): Promise<unknown>
  handlePetContextMenu(): Promise<unknown>
  debugLog(scope: string, payload: unknown): Promise<void>
  setWindowDisplayMode(mode: string): Promise<void>
  triggerDragBubble(): Promise<unknown>
  startWindowDrag(screenX: number, screenY: number): Promise<void>
  dragWindowTo(screenX: number, screenY: number): Promise<void>
  endWindowDrag(): Promise<void>
  startFocusSession(duration: number, goal?: string): Promise<unknown>
  focusHeartbeat(): Promise<unknown>
  completeFocusSession(reviewTone: 'done' | 'partial' | 'enough'): Promise<unknown>
  interruptFocusSession(): Promise<unknown>
  getSettings(): Promise<unknown>
  updateSettings(input: Record<string, unknown>): Promise<unknown>
  listDiaryEntries(limit: number): Promise<unknown>
  getDiaryEntry(dateKey: string): Promise<unknown>
  getCollection(): Promise<unknown>
  getRandomFarewellLine(): Promise<string>
  quitApp(): Promise<void>
  debugShowDialogue(type: string, tierOverride?: string): Promise<unknown>
  debugShowBranchPlot(plotId: string): Promise<unknown>
}

const petApi: PetApi = {
  notifyMouseEnter: () => ipcRenderer.invoke('pet:mouse-enter'),
  notifyMouseLeave: () => ipcRenderer.invoke('pet:mouse-leave'),
  openDiaryWindow: () => ipcRenderer.invoke('pet:open-diary-window'),
  closeDiaryWindow: () => ipcRenderer.invoke('pet:close-diary-window'),
  openGameWindow: () => ipcRenderer.invoke('pet:open-game-window'),
  closeGameWindow: () => ipcRenderer.invoke('pet:close-game-window'),
  getMilestones: () => ipcRenderer.invoke('pet:milestones'),
  checkNewUnlocks: () => ipcRenderer.invoke('pet:check-unlocks'),
  recordGameResult: (gameName, result) => ipcRenderer.invoke('pet:game-result', gameName, result),
  recordMoodCheckin: (mood) => ipcRenderer.invoke('pet:mood-checkin', mood),
  checkTierUp: () => ipcRenderer.invoke('pet:check-tier-up'),
  loadAppBootstrapData: () => ipcRenderer.invoke('pet:bootstrap'),
  triggerStartupGreeting: () => ipcRenderer.invoke('pet:startup-greeting'),
  handlePetClick: () => ipcRenderer.invoke('pet:click'),
  resolveBranchPlotChoice: (choiceId) => ipcRenderer.invoke('pet:branchPlotChoice', choiceId),
  handlePetDoubleClick: () => ipcRenderer.invoke('pet:double-click'),
  requestComfort: (tone) => ipcRenderer.invoke('pet:comfort:request', tone),
  handleFeed: (foodType) => ipcRenderer.invoke('pet:feed', foodType),
  triggerIdleBubble: () => ipcRenderer.invoke('pet:idleBubble'),
  handlePetLongPress: () => ipcRenderer.invoke('pet:longPress'),
  // AIGC START
  handlePetContextMenu: () => ipcRenderer.invoke('pet:context-menu'),
  // AIGC END
  debugLog: (scope, payload) => ipcRenderer.invoke('pet:debug-log', scope, payload),
  setWindowDisplayMode: (mode) => ipcRenderer.invoke('pet:window-display-mode', mode),
  triggerDragBubble: () => ipcRenderer.invoke('pet:drag-bubble'),
  startWindowDrag: (screenX, screenY) => ipcRenderer.invoke('pet:window-drag:start', screenX, screenY),
  dragWindowTo: (screenX, screenY) => ipcRenderer.invoke('pet:window-drag:move', screenX, screenY),
  endWindowDrag: () => ipcRenderer.invoke('pet:window-drag:end'),
  // AIGC START
  startFocusSession: (duration, goal) => ipcRenderer.invoke('pet:focus:start', duration, goal),
  focusHeartbeat: () => ipcRenderer.invoke('pet:focus:heartbeat'),
  completeFocusSession: (reviewTone) => ipcRenderer.invoke('pet:focus:complete', reviewTone),
  // AIGC END
  interruptFocusSession: () => ipcRenderer.invoke('pet:focus:interrupt'),
  getSettings: () => ipcRenderer.invoke('pet:settings:get'),
  updateSettings: (input) => ipcRenderer.invoke('pet:settings:update', input),
  listDiaryEntries: (limit) => ipcRenderer.invoke('pet:diary:list', limit),
  getDiaryEntry: (dateKey) => ipcRenderer.invoke('pet:diary:get', dateKey),
  getCollection: () => ipcRenderer.invoke('pet:collection:get'),
  getRandomFarewellLine: () => ipcRenderer.invoke('pet:farewell:random'),
  quitApp: () => ipcRenderer.invoke('pet:app:quit'),
  debugShowDialogue: (type, tierOverride) => ipcRenderer.invoke('pet:debug:dialogue', type, tierOverride),
  debugShowBranchPlot: (plotId) => ipcRenderer.invoke('pet:debug:branch-plot', plotId),
}

contextBridge.exposeInMainWorld('petApp', petApi)
