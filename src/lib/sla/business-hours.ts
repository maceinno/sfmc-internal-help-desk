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
 * Get the date/time components in a specific timezone.
 * Uses Intl.DateTimeFormat to convert from UTC to the target timezone.
 */
function getDateInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0');

  return {
    year: get('year'),
    month: get('month'), // 1-12
    day: get('day'),
    hours: get('hour') === 24 ? 0 : get('hour'), // midnight edge case
    minutes: get('minute'),
    seconds: get('second'),
    dayOfWeek: new Date(
      Date.UTC(get('year'), get('month') - 1, get('day'))
    ).getUTCDay(),
  };
}

/**
 * Create a Date from timezone-local components.
 * Finds the UTC instant that corresponds to the given local time in the timezone.
 */
function createDateInTimezone(
  year: number,
  month: number, // 1-12
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  timezone: string,
): Date {
  // Start with a rough UTC guess
  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  // Get what time that guess represents in the target timezone
  const inTz = getDateInTimezone(guess, timezone);

  // Calculate the offset and adjust
  const guessMs = guess.getTime();
  const diffHours = hours - inTz.hours;
  const diffMinutes = minutes - inTz.minutes;
  const offsetMs = (diffHours * 60 + diffMinutes) * 60 * 1000;

  return new Date(guessMs + offsetMs);
}

/**
 * Check whether a given date falls on a holiday.
 */
export function isHoliday(
  date: Date,
  holidays: { date: string }[],
  timezone: string = 'UTC',
): boolean {
  const tz = getDateInTimezone(date, timezone);
  const dateStr = `${tz.year}-${String(tz.month).padStart(2, '0')}-${String(tz.day).padStart(2, '0')}`;
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
  const tz = schedule.timezone || 'America/New_York';
  if (isHoliday(date, schedule.holidays, tz)) return null;

  const tzDate = getDateInTimezone(date, tz);
  const dayName = DAY_MAP[tzDate.dayOfWeek];
  const entry = schedule.business_hours.find((bh: BusinessHoursEntry) => bh.day === dayName);
  return entry && entry.enabled ? entry : null;
}

/**
 * Calculate a business-hours-aware deadline.
 *
 * Starting from `startDate`, walk forward through the schedule counting
 * only open hours until `hours` business hours have been consumed.
 * All time calculations are done in the schedule's timezone.
 */
export function calculateBusinessHoursDeadline(
  startDate: number | Date,
  hours: number,
  schedule: DepartmentSchedule,
): number {
  const tz = schedule.timezone || 'America/New_York';
  let remainingMs = hours * 60 * 60 * 1000;
  let cursor = new Date(typeof startDate === 'number' ? startDate : startDate.getTime());

  const maxIterations = 365;
  let iterations = 0;

  while (remainingMs > 0 && iterations < maxIterations) {
    iterations++;
    const entry = getBusinessHoursForDay(cursor, schedule);

    if (!entry) {
      // Advance to midnight in the schedule's timezone
      const tzDate = getDateInTimezone(cursor, tz);
      cursor = createDateInTimezone(
        tzDate.year, tzDate.month, tzDate.day + 1,
        0, 0, 0, tz,
      );
      continue;
    }

    const tzDate = getDateInTimezone(cursor, tz);
    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);

    const dayStart = createDateInTimezone(
      tzDate.year, tzDate.month, tzDate.day,
      start.hours, start.minutes, 0, tz,
    );
    const dayEnd = createDateInTimezone(
      tzDate.year, tzDate.month, tzDate.day,
      end.hours, end.minutes, 0, tz,
    );

    if (cursor.getTime() < dayStart.getTime()) {
      cursor = dayStart;
    }

    if (cursor.getTime() >= dayEnd.getTime()) {
      cursor = createDateInTimezone(
        tzDate.year, tzDate.month, tzDate.day + 1,
        0, 0, 0, tz,
      );
      continue;
    }

    const availableMs = dayEnd.getTime() - cursor.getTime();

    if (remainingMs <= availableMs) {
      return cursor.getTime() + remainingMs;
    } else {
      remainingMs -= availableMs;
      cursor = createDateInTimezone(
        tzDate.year, tzDate.month, tzDate.day + 1,
        0, 0, 0, tz,
      );
    }
  }

  return cursor.getTime() + remainingMs;
}

/**
 * Calculate how many business-hours milliseconds have elapsed between
 * two points in time, counting only scheduled business hours.
 * All time calculations are done in the schedule's timezone.
 */
export function calculateBusinessHoursElapsed(
  startDate: number | Date,
  endDate: number | Date,
  schedule: DepartmentSchedule,
): number {
  const tz = schedule.timezone || 'America/New_York';
  const endMs = typeof endDate === 'number' ? endDate : endDate.getTime();

  let elapsed = 0;
  let cursor = new Date(typeof startDate === 'number' ? startDate : startDate.getTime());

  const maxIterations = 365;
  let iterations = 0;

  while (cursor.getTime() < endMs && iterations < maxIterations) {
    iterations++;
    const entry = getBusinessHoursForDay(cursor, schedule);

    if (!entry) {
      const tzDate = getDateInTimezone(cursor, tz);
      cursor = createDateInTimezone(
        tzDate.year, tzDate.month, tzDate.day + 1,
        0, 0, 0, tz,
      );
      continue;
    }

    const tzDate = getDateInTimezone(cursor, tz);
    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);

    const dayStart = createDateInTimezone(
      tzDate.year, tzDate.month, tzDate.day,
      start.hours, start.minutes, 0, tz,
    );
    const dayEnd = createDateInTimezone(
      tzDate.year, tzDate.month, tzDate.day,
      end.hours, end.minutes, 0, tz,
    );

    if (cursor.getTime() < dayStart.getTime()) {
      cursor = dayStart;
    }

    if (cursor.getTime() >= dayEnd.getTime()) {
      cursor = createDateInTimezone(
        tzDate.year, tzDate.month, tzDate.day + 1,
        0, 0, 0, tz,
      );
      continue;
    }

    const periodEnd = Math.min(dayEnd.getTime(), endMs);
    elapsed += periodEnd - cursor.getTime();
    cursor = createDateInTimezone(
      tzDate.year, tzDate.month, tzDate.day + 1,
      0, 0, 0, tz,
    );
  }

  return elapsed;
}
