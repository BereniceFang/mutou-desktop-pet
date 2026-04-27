// AIGC START
import { z } from 'zod'

export const collectionBadgeDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  unlockHint: z.string(),
})

export const collectionCardDefSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  unlockHint: z.string(),
})

export const collectionBundleSchema = z.object({
  badges: z.array(collectionBadgeDefSchema),
})

export const storyCardsBundleSchema = z.object({
  cards: z.array(collectionCardDefSchema),
})

export type CollectionBadgeDef = z.infer<typeof collectionBadgeDefSchema>
export type CollectionCardDef = z.infer<typeof collectionCardDefSchema>
export type CollectionBundle = z.infer<typeof collectionBundleSchema>
export type StoryCardsBundle = z.infer<typeof storyCardsBundleSchema>
// AIGC END
