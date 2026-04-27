export function resolveMainState(trigger) {
    switch (trigger) {
        case 'click':
            return 'feedback';
        case 'longPress':
            return 'actionLayer';
        case 'focusStart':
            return 'focusMode';
        case 'focusEnd':
        default:
            return 'idle';
    }
}
export function resolveRelationshipTier(favorability) {
    if (favorability >= 200) {
        return 'high';
    }
    if (favorability >= 60) {
        return 'mid';
    }
    return 'low';
}
// AIGC END
//# sourceMappingURL=main-state-machine.js.map