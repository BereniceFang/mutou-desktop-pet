// AIGC START
import { create } from 'zustand'

export type PanelId = 'status' | 'feed' | 'focus' | 'comfort' | 'settings' | 'collection' | 'diary' | 'game' | 'debug' | null

export type FoodCategoryFilter = 'all' | 'sweet' | 'fruit' | 'drink' | 'savory' | 'meal'

interface UiStore {
  activePanel: PanelId
  actionBarVisible: boolean
  feedCategory: FoodCategoryFilter
  setPanel(panel: PanelId): void
  togglePanel(panel: Exclude<PanelId, null>): void
  toggleActionBar(): void
  hideActionBar(): void
  setFeedCategory(cat: FoodCategoryFilter): void
}

export const useUiStore = create<UiStore>((set) => ({
  activePanel: null,
  actionBarVisible: false,
  feedCategory: 'all',

  setPanel(panel: PanelId) {
    set({ activePanel: panel, actionBarVisible: panel !== null })
  },

  togglePanel(panel: Exclude<PanelId, null>) {
    set((prev) => {
      const next = prev.activePanel === panel ? null : panel
      console.log('[ui-store] togglePanel', { requested: panel, prev: prev.activePanel, next, actionBarVisible: next !== null || prev.actionBarVisible })
      return { activePanel: next, actionBarVisible: next !== null || prev.actionBarVisible }
    })
  },

  toggleActionBar() {
    set((prev) => {
      if (prev.actionBarVisible) {
        return { actionBarVisible: false, activePanel: null }
      }
      return { actionBarVisible: true }
    })
  },

  hideActionBar() {
    set({ actionBarVisible: false, activePanel: null })
  },

  setFeedCategory(cat: FoodCategoryFilter) {
    set({ feedCategory: cat })
  },
}))
// AIGC END
