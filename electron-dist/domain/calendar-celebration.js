export function resolvePriorityCelebration(now, holidayCalendar, personalDates) {
    const month = now.getMonth() + 1;
    const day = now.getDate();
    if (month === holidayCalendar.mutouBirthday.month && day === holidayCalendar.mutouBirthday.day) {
        return { kind: 'mutou_birthday' };
    }
    if (month === 1 && day === 1) {
        return { kind: 'new_year' };
    }
    for (const item of personalDates) {
        if (item.month === month && item.day === day) {
            return { kind: 'personal', date: item };
        }
    }
    for (const h of holidayCalendar.festivalDays) {
        if (h.month === month && h.day === day) {
            return { kind: 'festival' };
        }
    }
    return null;
}
// AIGC END
//# sourceMappingURL=calendar-celebration.js.map