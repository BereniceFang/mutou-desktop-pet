// AIGC START
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { interactivePlotsBundleSchema } from '../../shared/interactive-plots-schema.js';
export async function loadInteractivePlotsBundle(contentRoot) {
    const raw = await readFile(path.join(contentRoot, 'interactive-plots.json'), 'utf8');
    return interactivePlotsBundleSchema.parse(JSON.parse(raw));
}
// AIGC END
//# sourceMappingURL=interactive-plots-loader.js.map