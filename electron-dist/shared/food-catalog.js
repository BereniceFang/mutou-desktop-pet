export const FOOD_CATALOG = [
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
    { id: 'iceCreamSummer', label: '夏日冰激凌', category: 'sweet', preferenceScore: 5, unlockTier: 'low', seasonalUnlock: { month: 6, day: 1, duration: 92 } },
    { id: 'dumplings', label: '饺子', category: 'meal', preferenceScore: 5, unlockTier: 'low', seasonalUnlock: { month: 1, day: 1, duration: 15 } },
    { id: 'tangyuan', label: '汤圆', category: 'sweet', preferenceScore: 5, unlockTier: 'low', seasonalUnlock: { month: 2, day: 1, duration: 28 } },
    { id: 'mooncake', label: '月饼', category: 'sweet', preferenceScore: 5, unlockTier: 'low', seasonalUnlock: { month: 9, day: 1, duration: 30 } },
    { id: 'zongzi', label: '粽子', category: 'meal', preferenceScore: 5, unlockTier: 'low', seasonalUnlock: { month: 5, day: 20, duration: 20 } },
    { id: 'birthdayCake', label: '生日蛋糕', category: 'sweet', preferenceScore: 5, unlockTier: 'low', seasonalUnlock: { month: 4, day: 16, duration: 3 } },
];
const RELATIONSHIP_TIER_ORDER = ['low', 'mid', 'high'];
export function getFoodCatalogItem(foodType) {
    return FOOD_CATALOG.find((item) => item.id === foodType);
}
export function isRelationshipTierUnlocked(currentTier, requiredTier) {
    return RELATIONSHIP_TIER_ORDER.indexOf(currentTier) >= RELATIONSHIP_TIER_ORDER.indexOf(requiredTier);
}
export function isSeasonalFoodAvailable(food, now) {
    if (!food.seasonalUnlock) return true;
    const d = now ?? new Date();
    const { month, day, duration } = food.seasonalUnlock;
    const start = new Date(d.getFullYear(), month - 1, day);
    const end = new Date(start.getTime() + duration * 86400000);
    if (d >= start && d < end) return true;
    const prevStart = new Date(d.getFullYear() - 1, month - 1, day);
    const prevEnd = new Date(prevStart.getTime() + duration * 86400000);
    return d >= prevStart && d < prevEnd;
}
export function isFoodUnlockedForTier(foodOrType, relationshipTier) {
    const food = typeof foodOrType === 'string' ? getFoodCatalogItem(foodOrType) : foodOrType;
    if (!food) return false;
    if (!isRelationshipTierUnlocked(relationshipTier, food.unlockTier)) return false;
    if (food.seasonalUnlock && !isSeasonalFoodAvailable(food)) return false;
    return true;
}
export function getFoodUnlockTierLabel(tier) {
    switch (tier) {
        case 'mid':
            return '熟悉关系';
        case 'high':
            return '亲密关系';
        case 'low':
        default:
            return '初始关系';
    }
}
export function getFoodDialogueType(foodType) {
    return `feed_food_${foodType}`;
}
// AIGC START
const CATEGORY_SATIETY_BASE = {
    sweet: 3,
    drink: 2,
    fruit: 4,
    savory: 5,
    meal: 8,
};
export function getFeedSatietyGainForPreference(preferenceScore, category) {
    const pref = Math.min(5, Math.max(1, Math.round(preferenceScore)));
    const base = category ? CATEGORY_SATIETY_BASE[category] : 5;
    return base + pref;
}
// AIGC END
// AIGC END
//# sourceMappingURL=food-catalog.js.map