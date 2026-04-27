// AIGC START
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { FarewellBundle } from '../../shared/farewell-schema.js'
import { farewellBundleSchema } from '../../shared/farewell-schema.js'

export async function loadFarewellBundle(contentRoot: string): Promise<FarewellBundle> {
  const raw = await readFile(path.join(contentRoot, 'farewell', 'goodbye.json'), 'utf8')
  return farewellBundleSchema.parse(JSON.parse(raw))
}
// AIGC END
