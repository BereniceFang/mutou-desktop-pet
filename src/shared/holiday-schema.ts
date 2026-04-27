// AIGC START
import { z } from 'zod'

export const holidayCalendarSchema = z.object({
  mutouBirthday: z.object({
    month: z.number().min(1).max(12),
    day: z.number().min(1).max(31),
  }),
  festivalDays: z.array(z.object({
    id: z.string(),
    month: z.number().min(1).max(12),
    day: z.number().min(1).max(31),
  })),
})

export type HolidayCalendar = z.infer<typeof holidayCalendarSchema>
// AIGC END
