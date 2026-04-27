/** 本地日期（机器时区）判定当日节日槽位；优先级：木头生日 > 元旦 > 配置的 festivalDays */
export function resolveHolidaySlot(now, calendar) {
    const month = now.getMonth() + 1;
    const day = now.getDate();
    if (month === calendar.mutouBirthday.month && day === calendar.mutouBirthday.day) {
        return 'mutou_birthday';
    }
    if (month === 1 && day === 1) {
        return 'new_year';
    }
    for (const h of calendar.festivalDays) {
        if (h.month === month && h.day === day) {
            return 'festival';
        }
    }
    return null;
}
// AIGC END
//# sourceMappingURL=holiday-context.js.map