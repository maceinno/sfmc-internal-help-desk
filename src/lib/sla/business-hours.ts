import type {
  DayOfWeek,
  DepartmentSchedule,
  BusinessHoursEntry,
} from '@/types/ticket';

// ── Helpers ──────────────────────────────────────────────────

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/** Parse an "HH:MM" time string into numeric hours and minutes. */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':').map(Number);
  return { hours: h, minutes: m };
}

/**
 * Check whether a given date falls on a holiday.
 *
 * @param date  - The date to test.
 * @param holidays - Array of objects with a `date` field in "YYYY-MM-DD" format.
 */
export function isHoliday(
  date: Date,
  holidays: { date: string }[],
): boolean {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return holidays.some((h) => h.date === dateStr);
}

/**
 * Return the business-hours entry for a given date, or `null` if the day
 * is a holiday or not a scheduled business day.
 */
export function getBusinessHoursForDay(
  date: Date,
  schedule: DepartmentSchedule,
): BusinessHoursEntry | null {
  if (isHoliday(date, schedule.holidays)) return null;
  const dayName = DAY_MAP[date.getDay()];
  const entry = schedule.businessHours.find((bh) => bh.day === dayName);
  return entry && entry.enabled ? entry : null;
}

/**
 * Calculate a business-hours-aware deadline.
 *
 * Starting from `startDate`, walk forward through the schedule counting
 * only open hours until `hours` business hours have been consumed.
 *
 * @param startDate - Start timestamp (epoch ms or Date).
 * @param hours     - Number of business hours until the deadline.
 * @param schedule  - The department schedule to use.
 * @returns The deadline as epoch milliseconds.
 */
export function calculateBusinessHoursDeadline(
  startDate: number | Date,
  hours: number,
  schedule: DepartmentSchedule,
): number {
  let remainingMs = hours * 60 * 60 * 1000;
  let cursor = new Date(typeof startDate === 'number' ? startDate : startDate.getTime());

  const maxIterations = 365;
  let iterations = 0;

  while (remainingMs > 0 && iterations < maxIterations) {
    iterations++;
    const entry = getBusinessHoursForDay(cursor, schedule);

    if (!entry) {
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
        0, 0, 0,
      );
      continue;
    }

    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);

    const dayStart = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      start.hours,
      start.minutes,
      0,
    );
    const dayEnd = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      end.hours,
      end.minutes,
      0,
    );

    if (cursor.getTime() < dayStart.getTime()) {
      cursor = dayStart;
    }

    if (cursor.getTime() >= dayEnd.getTime()) {
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
        0, 0, 0,
      );
      continue;
    }

    const availableMs = dayEnd.getTime() - cursor.getTime();

    if (remainingMs <= availableMs) {
      return cursor.getTime() + remainingMs;
    } else {
      remainingMs -= availableMs;
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
        0, 0, 0,
      );
    }
  }

  // Fallback: if iterations are exhausted, return best-effort future timestamp
  return cursor.getTime() + remainingMs;
}

/**
 * Calculate how many business-hours milliseconds have elapsed between
 * two points in time, counting only scheduled business hours.
 *
 * @param startDate - Start timestamp (epoch ms or Date).
 * @param endDate   - End timestamp (epoch ms or Date).
 * @param schedule  - The department schedule to use.
 * @returns Elapsed business-hours time in milliseconds.
 */
export function calculateBusinessHoursElapsed(
  startDate: number | Date,
  endDate: number | Date,
  schedule: DepartmentSchedule,
): number {
  const startMs = typeof startDate === 'number' ? startDate : startDate.getTime();
  const endMs = typeof endDate === 'number' ? endDate : endDate.getTime();

  let elapsed = 0;
  let cursor = new Date(startMs);

  const maxIterations = 365;
  let iterations = 0;

  while (cursor.getTime() < endMs && iterations < maxIterations) {
    iterations++;
    const entry = getBusinessHoursForDay(cursor, schedule);

    if (!entry) {
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
        0, 0, 0,
      );
      continue;
    }

    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);

    const dayStart = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      start.hours,
      start.minutes,
      0,
    );
    const dayEnd = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      end.hours,
      end.minutes,
      0,
    );

    if (cursor.getTime() < dayStart.getTime()) {
      cursor = dayStart;
    }

    if (cursor.getTime() >= dayEnd.getTime()) {
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
        0, 0, 0,
      );
      continue;
    }

    const periodEnd = Math.min(dayEnd.getTime(), endMs);
    elapsed += periodEnd - cursor.getTime();
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
      0, 0, 0,
    );
  }

  return elapsed;
}
