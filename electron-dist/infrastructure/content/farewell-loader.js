// AIGC START
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { farewellBundleSchema } from '../../shared/farewell-schema.js';
export async function loadFarewellBundle(contentRoot) {
    const raw = await readFile(path.join(contentRoot, 'farewell', 'goodbye.json'), 'utf8');
    return farewellBundleSchema.parse(JSON.parse(raw));
}
// AIGC END
//# sourceMappingURL=farewell-loader.js.map