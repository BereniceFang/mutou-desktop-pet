export function isBadgeUnlocked(badgeId, state) {
    const { stats, relationshipTier } = state;
    switch (badgeId) {
        case 'first_hello':
            return stats.interactionCount >= 1;
        case 'keeps_coming':
            return stats.interactionCount >= 20;
        case 'week_together':
            return stats.companionDays >= 7;
        case 'night_walk':
            return stats.nightInteractionCount >= 5;
        case 'focus_first':
            return stats.focusCompletedCount >= 1;
        case 'tacit_mid':
            return relationshipTier === 'mid' || relationshipTier === 'high';
        case 'fed_with_care':
            return stats.feedCount >= 5;
        case 'tacit_high':
            return relationshipTier === 'high';
        case 'holiday_mutou_birthday':
            return stats.mutouBirthdayCelebrationYear != null;
        case 'holiday_new_year':
            return stats.newYearCelebrationYear != null;
        case 'holiday_festival_day':
            return stats.festivalDayCelebrationYear != null;
        default:
            return false;
    }
}
export function isStoryCardUnlocked(cardId, state) {
    const { stats, relationshipTier } = state;
    switch (cardId) {
        case 'story_01':
            return true;
        case 'story_02':
            return stats.companionDays >= 3;
        case 'story_03':
            return stats.interactionCount >= 30;
        case 'story_04':
            return stats.focusCompletedCount >= 1;
        case 'story_05':
            return stats.feedCount >= 5;
        case 'story_06':
            return stats.companionDays >= 14;
        case 'story_07':
            return stats.interactionCount >= 80;
        case 'story_08':
            return stats.focusCompletedCount >= 5;
        case 'story_09':
            return stats.nightInteractionCount >= 10;
        case 'story_10':
            return stats.feedCount >= 20;
        case 'story_11':
            return relationshipTier === 'high';
        case 'story_milestone_personal':
            return Object.keys(stats.personalDateCelebrationYears).length > 0;
        case 'story_12':
            return stats.companionDays >= 30;
        case 'story_13':
            return stats.interactionCount >= 150;
        case 'story_14':
            return stats.focusCompletedCount >= 12;
        case 'story_15':
            return stats.feedCount >= 40;
        case 'story_16':
            return stats.nightInteractionCount >= 25;
        case 'story_17':
            return relationshipTier === 'mid' || relationshipTier === 'high';
        case 'story_18':
            return stats.companionDays >= 60;
        case 'story_holiday_birthday':
            return stats.mutouBirthdayCelebrationYear != null;
        case 'story_holiday_new_year':
            return stats.newYearCelebrationYear != null;
        case 'story_holiday_festival':
            return stats.festivalDayCelebrationYear != null;
        default:
            return false;
    }
}
//# sourceMappingURL=collection-unlock.js.map