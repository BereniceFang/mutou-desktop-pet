import electronRenderer from 'electron/renderer';
const { contextBridge, ipcRenderer } = electronRenderer;
const petApi = {
    notifyMouseEnter: () => ipcRenderer.invoke('pet:mouse-enter'),
    notifyMouseLeave: () => ipcRenderer.invoke('pet:mouse-leave'),
    openDiaryWindow: () => ipcRenderer.invoke('pet:open-diary-window'),
    closeDiaryWindow: () => ipcRenderer.invoke('pet:close-diary-window'),
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
};
contextBridge.exposeInMainWorld('petApp', petApi);
//# sourceMappingURL=index.js.map