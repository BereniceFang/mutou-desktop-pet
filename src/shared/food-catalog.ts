// AIGC START
export type FoodCategory = 'sweet' | 'fruit' | 'drink' | 'savory' | 'meal'

export type RelationshipTier = 'low' | 'mid' | 'high'

export interface FoodCatalogItem {
  id: string
  label: string
  category: FoodCategory
  preferenceScore: number
  unlockTier: RelationshipTier
}

export const FOOD_CATALOG: FoodCatalogItem[] = [
  { id: 'candy', label: '糖果', category: 'sweet', preferenceScore: 3, unlockTier: 'low' },
  { id: 'orange', label: '橙子', category: 'fruit', preferenceScore: 3, unlockTier: 'low' },
  { id: 'milk', label: '牛奶', category: 'drink', preferenceScore: 3, unlockTier: 'low' },
  { id: 'juice', label: '果汁', category: 'drink', preferenceScore: 3, unlockTier: 'low' },
  { id: 'bread', label: '小面包', category: 'sweet', preferenceScore: 3, unlockTier: 'low' },
  { id: 'chips', label: '薯片', category: 'savory', preferenceScore: 3, unlockTier: 'low' },
  { id: 'riceMeal', label: '米饭套餐', category: 'meal', preferenceScore: 3, unlockTier: 'low' },
  { id: 'iceCream', label: '冰淇淋', category: 'sweet', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'chocolate', label: '巧克力', category: 'sweet', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'grape', label: '葡萄', category: 'fruit', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'watermelon', label: '西瓜', category: 'fruit', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'fruitTea', label: '果茶', category: 'drink', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'coffee', label: '咖啡', category: 'drink', preferenceScore: 2, unlockTier: 'mid' },
  { id: 'cocoa', label: '可可', category: 'drink', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'yogurt', label: '酸奶', category: 'drink', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'swissRoll', label: '蛋糕卷', category: 'sweet', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'donut', label: '甜甜圈', category: 'sweet', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'burger', label: '汉堡', category: 'savory', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'bento', label: '便当', category: 'meal', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'midnightSnack', label: '夜宵', category: 'meal', preferenceScore: 4, unlockTier: 'mid' },
  { id: 'pudding', label: '布丁', category: 'sweet', preferenceScore: 5, unlockTier: 'high' },
  { id: 'strawberry', label: '草莓', category: 'fruit', preferenceScore: 5, unlockTier: 'high' },
  { id: 'milkTea', label: '奶茶', category: 'drink', preferenceScore: 5, unlockTier: 'high' },
  { id: 'creamPuff', label: '泡芙', category: 'sweet', preferenceScore: 5, unlockTier: 'high' },
  { id: 'friedChicken', label: '炸鸡', category: 'savory', preferenceScore: 5, unlockTier: 'high' },
  { id: 'ramen', label: '拉面', category: 'meal', preferenceScore: 5, unlockTier: 'high' },
  { id: 'hotpot', label: '火锅', category: 'meal', preferenceScore: 5, unlockTier: 'high' },
  { id: 'snackPlatter', label: '小零食拼盘', category: 'savory', preferenceScore: 5, unlockTier: 'high' },
]

const RELATIONSHIP_TIER_ORDER: RelationshipTier[] = ['low', 'mid', 'high']

export function getFoodCatalogItem(foodType: string): FoodCatalogItem | undefined {
  return FOOD_CATALOG.find((item) => item.id === foodType)
}

export function isRelationshipTierUnlocked(currentTier: RelationshipTier, requiredTier: RelationshipTier): boolean {
  return RELATIONSHIP_TIER_ORDER.indexOf(currentTier) >= RELATIONSHIP_TIER_ORDER.indexOf(requiredTier)
}

export function isFoodUnlockedForTier(foodOrType: string | FoodCatalogItem, relationshipTier: RelationshipTier): boolean {
  const food = typeof foodOrType === 'string' ? getFoodCatalogItem(foodOrType) : foodOrType
  return Boolean(food && isRelationshipTierUnlocked(relationshipTier, food.unlockTier))
}

export function getFoodUnlockTierLabel(tier: RelationshipTier): string {
  switch (tier) {
    case 'mid':
      return '熟悉关系'
    case 'high':
      return '亲密关系'
    case 'low':
    default:
      return '初始关系'
  }
}

export function getFoodDialogueType(foodType: string): string {
  return `feed_food_${foodType}`
}

// AIGC START
/**
 * 与 `RuntimeService.handleFeed` 中饱腹增加一致，供 UI 预览。
 * 偏好 1–5：9 / 12 / 15 / 18 / 21（每档相差 3，与旧版 12–16 相比拉开梯度）
 */
export function getFeedSatietyGainForPreference(preferenceScore: number): number {
  const tier = Math.min(5, Math.max(1, Math.round(preferenceScore)))
  return 6 + tier * 3
}
// AIGC END
// AIGC END
