// AIGC START
import type { PersonalDateItem } from '../shared/content-schema.js'
import type { HolidayCalendar } from '../shared/holiday-schema.js'

export type CelebrationResult =
  | { kind: 'mutou_birthday' }
  | { kind: 'new_year' }
  | { kind: 'personal'; date: PersonalDateItem }
  | { kind: 'festival' }

export function resolvePriorityCelebration(
  now: Date,
  holidayCalendar: HolidayCalendar,
  personalDates: PersonalDateItem[],
): CelebrationResult | null {
  const month = now.getMonth() + 1
  const day = now.getDate()

  if (month === holidayCalendar.mutouBirthday.month && day === holidayCalendar.mutouBirthday.day) {
    return { kind: 'mutou_birthday' }
  }

  if (month === 1 && day === 1) {
    return { kind: 'new_year' }
  }

  for (const item of personalDates) {
    if (item.month === month && item.day === day) {
      return { kind: 'personal', date: item }
    }
  }

  for (const h of holidayCalendar.festivalDays) {
    if (h.month === month && h.day === day) {
      return { kind: 'festival' }
    }
  }

  return null
}
// AIGC END
