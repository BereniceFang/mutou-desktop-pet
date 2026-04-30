import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronMain from 'electron/main';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { BrowserWindow } = electronMain;
export function createMainWindow(settings, windowPosition) {
    // AIGC START
    /** 与 `tsc -p tsconfig.electron.json` 输出一致，勿再使用根目录手写 `preload.cjs` */
    const preloadPath = path.join(__dirname, '../preload/index.js');
    // AIGC END
    const win = new BrowserWindow({
        width: 360,
        height: 640,
        x: windowPosition?.x,
        y: windowPosition?.y,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: settings.alwaysOnTop,
        hasShadow: false,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: preloadPath,
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    win.setOpacity(settings.opacity);
    win.setIgnoreMouseEvents(true, { forward: true });
    return win;
}
export function createMemoWindow(parentWindow) {
    const preloadPath = path.join(__dirname, '../preload/index.js');
    const [px, py] = parentWindow.getPosition();
    return new BrowserWindow({
        width: 320,
        height: 440,
        x: px - 340,
        y: py - 60,
        frame: false,
        resizable: true,
        alwaysOnTop: true,
        backgroundColor: '#120c24',
        webPreferences: {
            preload: preloadPath,
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
}
export function createGameWindow(parentWindow) {
    const preloadPath = path.join(__dirname, '../preload/index.js');
    const [px, py] = parentWindow.getPosition();
    return new BrowserWindow({
        width: 360,
        height: 480,
        x: px + 290,
        y: py,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        backgroundColor: '#120c24',
        webPreferences: {
            preload: preloadPath,
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
}
export function createDiaryWindow(parentWindow) {
    const preloadPath = path.join(__dirname, '../preload/index.js');
    const [px, py] = parentWindow.getPosition();
    const win = new BrowserWindow({
        width: 380,
        height: 400,
        x: px - 440,
        y: py,
        frame: false,
        resizable: true,
        alwaysOnTop: true,
        backgroundColor: '#120c24',
        webPreferences: {
            preload: preloadPath,
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    return win;
}
//# sourceMappingURL=window-manager.js.map