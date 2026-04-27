// AIGC START
import type { RelationshipTier } from '../shared/food-catalog.js'

export type MainState = 'idle' | 'feedback' | 'actionLayer' | 'focusMode'

export type MainStateTrigger = 'click' | 'longPress' | 'focusStart' | 'focusEnd'

export function resolveMainState(trigger: MainStateTrigger): MainState {
  switch (trigger) {
    case 'click':
      return 'feedback'
    case 'longPress':
      return 'actionLayer'
    case 'focusStart':
      return 'focusMode'
    case 'focusEnd':
    default:
      return 'idle'
  }
}

export function resolveRelationshipTier(favorability: number): RelationshipTier {
  if (favorability >= 200) {
    return 'high'
  }
  if (favorability >= 60) {
    return 'mid'
  }
  return 'low'
}
// AIGC END
