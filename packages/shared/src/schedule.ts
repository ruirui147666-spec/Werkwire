import { z } from "zod";
import { WEEKDAYS } from "./enums.js";

export const timeSlotSchema = z.object({
  from: z.string().regex(/^\d{2}:\d{2}$/),
  to: z.string().regex(/^\d{2}:\d{2}$/),
});
export type TimeSlot = z.infer<typeof timeSlotSchema>;

export const weeklyScheduleSchema = z.object({
  mon: z.array(timeSlotSchema),
  tue: z.array(timeSlotSchema),
  wed: z.array(timeSlotSchema),
  thu: z.array(timeSlotSchema),
  fri: z.array(timeSlotSchema),
  sat: z.array(timeSlotSchema),
  sun: z.array(timeSlotSchema),
});
export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>;

export const emptyWeeklySchedule = (): WeeklySchedule => ({
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
});

/** Total minutes covered across the whole week. */
export function totalMinutes(schedule: WeeklySchedule): number {
  let sum = 0;
  for (const day of WEEKDAYS) {
    for (const slot of schedule[day]) {
      sum += minutesOf(slot);
    }
  }
  return sum;
}

export function minutesOf(slot: TimeSlot): number {
  const [fh, fm] = slot.from.split(":").map(Number);
  const [th, tm] = slot.to.split(":").map(Number);
  return th * 60 + tm - (fh * 60 + fm);
}
