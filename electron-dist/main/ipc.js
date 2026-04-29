import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';
import electronMain from 'electron/main';
import { createDiaryWindow, createGameWindow, createMemoWindow } from './window-manager.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { ipcMain } = electronMain;
let dragSession = null;
let currentWindowDisplayMode = 'desktop';
const WINDOW_SIZES = {
    desktop: { width: 280, height: 300 },
    desktop_expanded: { width: 360, height: 640 },
    panel: { width: 520, height: 760 },
};
export function registerIpcHandlers(runtimeService, getWindow) {
    ipcMain.handle('pet:mouse-enter', async () => {
        const win = getWindow();
        if (win) win.setIgnoreMouseEvents(false);
    });
    ipcMain.handle('pet:mouse-leave', async () => {
        const win = getWindow();
        if (win) win.setIgnoreMouseEvents(true, { forward: true });
    });
    let diaryWindow = null;
    ipcMain.handle('pet:open-diary-window', async () => {
        const mainWin = getWindow();
        if (!mainWin) return;
        if (diaryWindow && !diaryWindow.isDestroyed()) { diaryWindow.focus(); return; }
        diaryWindow = createDiaryWindow(mainWin);
        const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
        if (isDev && process.env.VITE_DEV_SERVER_URL) {
            await diaryWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?diary=1`);
        } else {
            await diaryWindow.loadFile(path.resolve(__dirname, '../../dist/index.html'), { query: { diary: '1' } });
        }
        diaryWindow.on('closed', () => { diaryWindow = null; });
    });
    ipcMain.handle('pet:close-diary-window', async () => {
        if (diaryWindow && !diaryWindow.isDestroyed()) { diaryWindow.close(); diaryWindow = null; }
    });
    let gameWindow = null;
    ipcMain.handle('pet:open-game-window', async () => {
        const mainWin = getWindow();
        if (!mainWin) return;
        if (gameWindow && !gameWindow.isDestroyed()) { gameWindow.focus(); return; }
        gameWindow = createGameWindow(mainWin);
        const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
        if (isDev && process.env.VITE_DEV_SERVER_URL) {
            await gameWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?game=1`);
        } else {
            await gameWindow.loadFile(path.resolve(__dirname, '../../dist/index.html'), { query: { game: '1' } });
        }
        gameWindow.on('closed', () => { gameWindow = null; });
    });
    ipcMain.handle('pet:close-game-window', async () => {
        if (gameWindow && !gameWindow.isDestroyed()) { gameWindow.close(); gameWindow = null; }
    });
    let memoWindow = null;
    ipcMain.handle('pet:open-memo-window', async () => {
        const mainWin = getWindow();
        if (!mainWin) return;
        if (memoWindow && !memoWindow.isDestroyed()) { memoWindow.focus(); return; }
        memoWindow = createMemoWindow(mainWin);
        const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
        if (isDev && process.env.VITE_DEV_SERVER_URL) {
            await memoWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?memo=1`);
        } else {
            await memoWindow.loadFile(path.resolve(__dirname, '../../dist/index.html'), { query: { memo: '1' } });
        }
        memoWindow.on('closed', () => { memoWindow = null; });
    });
    ipcMain.handle('pet:close-memo-window', async () => {
        if (memoWindow && !memoWindow.isDestroyed()) { memoWindow.close(); memoWindow = null; }
    });
    ipcMain.handle('pet:memo-list', async () => runtimeService.getMemos());
    ipcMain.handle('pet:memo-add', async (_event, text, remindAt, repeat, repeatTime) => runtimeService.addMemo(text, remindAt, repeat, repeatTime));
    ipcMain.handle('pet:memo-toggle', async (_event, id) => runtimeService.toggleMemoDone(id));
    ipcMain.handle('pet:memo-delete', async (_event, id) => runtimeService.deleteMemo(id));
    ipcMain.handle('pet:memo-check-reminders', async () => runtimeService.checkMemoReminders());
    ipcMain.handle('pet:game-result', async (_event, gameName, result) => runtimeService.recordGameResult(gameName, result));
    ipcMain.handle('pet:bootstrap', async () => runtimeService.loadBootstrapData());
    ipcMain.handle('pet:startup-greeting', async () => {
        return runtimeService.triggerStartupGreeting();
    });
    ipcMain.handle('pet:debug-log', async (_event, scope, payload) => {
        console.log(`[pet-debug:${scope}]`, payload);
    });
    ipcMain.handle('pet:window-display-mode', async (_event, mode) => {
        const win = getWindow();
        if (!win) {
            return;
        }
        const [x, y] = win.getPosition();
        await runtimeService.updateWindowPositionForDisplayMode(currentWindowDisplayMode, { x, y });
        const targetPosition = runtimeService.getWindowPositionForDisplayMode(mode) ?? { x, y };
        const size = WINDOW_SIZES[mode] ?? WINDOW_SIZES.desktop;
        win.setBounds({
            x: targetPosition.x,
            y: targetPosition.y,
            width: size.width,
            height: size.height,
        });
        currentWindowDisplayMode = mode;
    });
    ipcMain.handle('pet:click', async () => {
        console.log('[pet-debug:ipc-click] received');
        const result = await runtimeService.handlePetClick();
        console.log('[pet-debug:ipc-click] result', {
            bubbleText: result.bubbleText,
            mainState: result.state.mainState,
            lastBubbleText: result.state.lastBubbleText,
        });
        return result;
    });
    ipcMain.handle('pet:branchPlotChoice', async (_event, choiceId) => {
        return runtimeService.resolveBranchPlotChoice(choiceId);
    });
    ipcMain.handle('pet:debug:dialogue', async (_event, type, tierOverride) => {
        if (app.isPackaged) {
            return { state: runtimeService.getState(), bubbleText: null };
        }
        return runtimeService.debugShowDialogue(type, tierOverride);
    });
    ipcMain.handle('pet:debug:branch-plot', async (_event, plotId) => {
        if (app.isPackaged) {
            return { state: runtimeService.getState(), bubbleText: null };
        }
        return runtimeService.debugShowBranchPlot(plotId);
    });
    ipcMain.handle('pet:double-click', async () => {
        return runtimeService.handlePetDoubleClick();
    });
    ipcMain.handle('pet:comfort:request', async (_event, tone) => {
        return runtimeService.requestComfort(tone);
    });
    ipcMain.handle('pet:feed', async (_event, foodType) => {
        return runtimeService.handleFeed(foodType);
    });
    ipcMain.handle('pet:idleBubble', async () => {
        return runtimeService.triggerIdleBubble();
    });
    ipcMain.handle('pet:longPress', async () => {
        return runtimeService.handlePetLongPress();
    });
    ipcMain.handle('pet:context-menu', async () => {
        return runtimeService.handlePetContextMenu();
    });
    ipcMain.handle('pet:drag-bubble', async () => {
        return runtimeService.handleDragBubble();
    });
    ipcMain.handle('pet:window-drag:start', async (_event, screenX, screenY) => {
        const win = getWindow();
        if (!win) {
            return;
        }
        const [startWindowX, startWindowY] = win.getPosition();
        dragSession = {
            startCursorX: screenX,
            startCursorY: screenY,
            startWindowX,
            startWindowY,
        };
    });
    ipcMain.handle('pet:window-drag:move', async (_event, screenX, screenY) => {
        const win = getWindow();
        if (!win || !dragSession) {
            return;
        }
        const nextX = Math.round(dragSession.startWindowX + (screenX - dragSession.startCursorX));
        const nextY = Math.round(dragSession.startWindowY + (screenY - dragSession.startCursorY));
        win.setPosition(nextX, nextY);
    });
    ipcMain.handle('pet:window-drag:end', async () => {
        const win = getWindow();
        if (win) {
            const [x, y] = win.getPosition();
            await runtimeService.updateWindowPositionForDisplayMode(currentWindowDisplayMode, { x, y });
        }
        dragSession = null;
    });
    // AIGC START
    ipcMain.handle('pet:focus:start', async (_event, duration, goal) => {
        return runtimeService.startFocusSession(duration, goal);
    });
    ipcMain.handle('pet:focus:heartbeat', async () => {
        return runtimeService.focusHeartbeat();
    });
    ipcMain.handle('pet:focus:complete', async (_event, reviewTone) => {
        return runtimeService.completeFocusSession(reviewTone);
    });
    // AIGC END
    ipcMain.handle('pet:focus:interrupt', async () => {
        return runtimeService.interruptFocusSession();
    });
    ipcMain.handle('pet:settings:get', async () => runtimeService.getSettings());
    ipcMain.handle('pet:diary:list', async (_event, limit) => runtimeService.listDiaryEntries(limit));
    ipcMain.handle('pet:diary:get', async (_event, dateKey) => runtimeService.getDiaryEntry(dateKey));
    ipcMain.handle('pet:collection:get', async () => runtimeService.getCollection());
    ipcMain.handle('pet:farewell:random', async () => runtimeService.getRandomFarewellLine());
    ipcMain.handle('pet:app:quit', async () => {
        const win = getWindow();
        if (win) {
            const [x, y] = win.getPosition();
            await runtimeService.updateWindowPositionForDisplayMode(currentWindowDisplayMode, { x, y });
        }
        await runtimeService.flushPersist();
        app.quit();
    });
    ipcMain.handle('pet:settings:update', async (_event, input) => {
        const settings = await runtimeService.updateSettings(input);
        const win = getWindow();
        if (win) {
            win.setAlwaysOnTop(settings.alwaysOnTop);
            win.setOpacity(settings.opacity);
        }
        return settings;
    });
}
export function inferWindowDisplayMode(bounds) {
    for (const [mode, size] of Object.entries(WINDOW_SIZES)) {
        if (bounds.width === size.width && bounds.height === size.height) {
            return mode;
        }
    }
    return bounds.width >= WINDOW_SIZES.panel.width ? 'panel' : 'desktop';
}
//# sourceMappingURL=ipc.js.map