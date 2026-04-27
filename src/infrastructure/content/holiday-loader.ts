// AIGC START
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { HolidayCalendar } from '../../shared/holiday-schema.js'
import { holidayCalendarSchema } from '../../shared/holiday-schema.js'

export const DEFAULT_HOLIDAY_CALENDAR: HolidayCalendar = {
  mutouBirthday: { month: 4, day: 16 },
  festivalDays: [
    { id: 'may_day', month: 5, day: 1 },
    { id: 'national_day', month: 10, day: 1 },
    { id: 'warm_winter', month: 12, day: 25 },
  ],
}

export async function loadHolidayCalendar(contentRoot: string): Promise<HolidayCalendar> {
  try {
    const raw = await readFile(path.join(contentRoot, 'holidays', 'calendar.json'), 'utf8')
    return holidayCalendarSchema.parse(JSON.parse(raw))
  } catch {
    return DEFAULT_HOLIDAY_CALENDAR
  }
}
// AIGC END
