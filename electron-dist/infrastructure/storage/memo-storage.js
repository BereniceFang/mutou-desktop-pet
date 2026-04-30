// AIGC START
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { memoFileSchema } from '../../shared/memo-schema.js';
const MEMO_FILE = 'memos.json';
export async function loadMemos(dataRoot) {
    const filePath = path.join(dataRoot, MEMO_FILE);
    try {
        const raw = await readFile(filePath, 'utf8');
        return memoFileSchema.parse(JSON.parse(raw));
    }
    catch {
        const initial = { version: 1, items: [] };
        await saveMemos(dataRoot, initial);
        return initial;
    }
}
export async function saveMemos(dataRoot, data) {
    const filePath = path.join(dataRoot, MEMO_FILE);
    const tempPath = path.join(dataRoot, 'memos.tmp.json');
    await mkdir(dataRoot, { recursive: true });
    await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await rename(tempPath, filePath);
}
// AIGC END
//# sourceMappingURL=memo-storage.js.map