// AIGC START
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { CollectionBundle, StoryCardsBundle } from '../../shared/collection-schema.js'
import { collectionBundleSchema, storyCardsBundleSchema } from '../../shared/collection-schema.js'

export async function loadCollectionBadges(contentRoot: string): Promise<CollectionBundle> {
  const raw = await readFile(path.join(contentRoot, 'collection', 'badges.json'), 'utf8')
  return collectionBundleSchema.parse(JSON.parse(raw))
}

export async function loadStoryCards(contentRoot: string): Promise<StoryCardsBundle> {
  const raw = await readFile(path.join(contentRoot, 'collection', 'cards.json'), 'utf8')
  return storyCardsBundleSchema.parse(JSON.parse(raw))
}
// AIGC END
