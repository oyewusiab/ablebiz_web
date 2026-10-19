import type { ParsedDateRange } from "./types";

export const BUSINESS_TIMEZONE = "Africa/Lagos" as const;
export const ABILITY_TIMEZONE = BUSINESS_TIMEZONE;

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  a: 1,
  an: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fourteen: 14,
  twenty: 20,
  "twenty-one": 21,
  thirty: 30,
};

/**
 * Extracts YYYY, MM (1-12), DD (1-31) in Africa/Lagos timezone from a reference Date.
 */
export function getLagosDateParts(refDate: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  isoDate: string;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(refDate);
  const year = Number(parts.find((p) => p.type === "year")?.value || refDate.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value || refDate.getUTCMonth() + 1);
  const day = Number(parts.find((p) => p.type === "day")?.value || refDate.getUTCDate());
  const isoDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, isoDate };
}

/**
 * Converts a YYYY-MM-DD calendar date in Africa/Lagos (+01:00) into start/end ISO timestamps.
 */
export function lagosDateToStartIso(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00+01:00`).toISOString();
}

export function lagosDateToEndIso(isoDate: string): string {
  return new Date(`${isoDate}T23:59:59.999+01:00`).toISOString();
}

/**
 * Adds calendar days to a YYYY-MM-DD date string safely in UTC calendar arithmetic.
 */
export function addCalendarDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatShortDate(isoDateOrTimestamp: string | null | undefined): string {
  if (!isoDateOrTimestamp) return "—";
  try {
    const dt =
      /^\d{4}-\d{2}-\d{2}$/.test(isoDateOrTimestamp)
        ? new Date(`${isoDateOrTimestamp}T12:00:00+01:00`)
        : new Date(isoDateOrTimestamp);
    if (Number.isNaN(dt.getTime())) return String(isoDateOrTimestamp);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: BUSINESS_TIMEZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(dt);
  } catch {
    return String(isoDateOrTimestamp);
  }
}

export function formatDateTimeLagos(refDate: Date | string = new Date()): string {
  try {
    const dt = typeof refDate === "string" ? new Date(refDate) : refDate;
    if (Number.isNaN(dt.getTime())) return String(refDate);
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: BUSINESS_TIMEZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(dt);
    return `${formatted} WAT (Africa/Lagos)`;
  } catch {
    return "Africa/Lagos";
  }
}

export function formatNgn(amount: number | string | null | undefined): string {
  const num = Number(amount || 0);
  if (Number.isNaN(num)) return "₦0";
  const hasCents = Math.abs(num % 1) > 0.001;
  const absFormatted = Math.abs(num).toLocaleString("en-NG", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `-₦${absFormatted}` : `₦${absFormatted}`;
}

export function formatCount(count: number | string | null | undefined): string {
  const num = Number(count || 0);
  if (Number.isNaN(num)) return "0";
  return Math.round(num).toLocaleString("en-NG");
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  const num = Number(value || 0);
  if (Number.isNaN(num) || !Number.isFinite(num)) return "0%";
  return `${num.toFixed(decimals).replace(/\.0$/, "")}%`;
}

function parseWordOrDigit(raw: string): number | null {
  const clean = raw.toLowerCase().trim();
  if (WORD_NUMBERS[clean] !== undefined) return WORD_NUMBERS[clean];
  const n = parseInt(clean, 10);
  return Number.isNaN(n) ? null : n;
}

function buildRangeObject(params: {
  key: NonNullable<ParsedDateRange["key"]>;
  preset: string;
  label: string;
  startDateIso: string;
  endDateIso: string;
  isFuture: boolean;
  isExplicit: boolean;
  daysSpan: number;
}): ParsedDateRange {
  const startTimestampIso = lagosDateToStartIso(params.startDateIso);
  const endTimestampIso = lagosDateToEndIso(params.endDateIso);
  return {
    key: params.key,
    preset: params.preset,
    label: params.label,
    startDateIso: params.startDateIso,
    endDateIso: params.endDateIso,
    startDate: params.preset === "all_time" ? null : params.startDateIso,
    endDate: params.preset === "all_time" ? null : params.endDateIso,
    startTimestampIso,
    endTimestampIso,
    startIso: startTimestampIso,
    endIso: endTimestampIso,
    isFuture: params.isFuture,
    isExplicit: params.isExplicit,
    daysSpan: params.daysSpan,
    timezone: BUSINESS_TIMEZONE,
  };
}

/**
 * Checks whether two YYYY-MM-DD intervals [recordStart, recordEnd] and [windowStart, windowEnd] overlap.
 */
export function overlapsDateWindow(
  recordStart: string | null | undefined,
  recordEnd: string | null | undefined,
  windowStart: string,
  windowEnd: string
): boolean {
  if (!recordStart && !recordEnd) return false;
  const rStart = String(recordStart || recordEnd).slice(0, 10);
  const rEnd = String(recordEnd || recordStart).slice(0, 10);
  return rStart <= windowEnd && rEnd >= windowStart;
}

/**
 * Checks whether a single date/timestamp falls inside a ParsedDateRange.
 */
export function isDateInRange(
  dateOrIso: string | null | undefined,
  range: ParsedDateRange
): boolean {
  if (range.preset === "all_time" || range.key === "all_time") return true;
  if (!dateOrIso) return false;
  const startYmd = range.startDate || range.startDateIso;
  const endYmd = range.endDate || range.endDateIso;
  const ymd = String(dateOrIso).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd) && startYmd && endYmd) {
    return ymd >= startYmd && ymd <= endYmd;
  }
  const ts = new Date(dateOrIso).getTime();
  if (Number.isNaN(ts)) return false;
  return (
    ts >= new Date(range.startTimestampIso).getTime() &&
    ts <= new Date(range.endTimestampIso).getTime()
  );
}

/**
 * Parses a natural-language query for past, current, or future date ranges in Africa/Lagos.
 */
export function parseQueryDateRange(
  query: string,
  refDate: Date = new Date(),
  fallbackRange?: ParsedDateRange
): ParsedDateRange {
  const q = query.toLowerCase();
  const { year, month, isoDate: todayIso } = getLagosDateParts(refDate);

  // 1. Check "next N weeks" / "coming N weeks" / "in the next N weeks"
  const nextWeeksMatch = q.match(
    /\b(?:next|coming|upcoming|within(?:\s+the\s+next)?)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a)\s+weeks?\b/i
  );
  if (nextWeeksMatch) {
    const weeks = parseWordOrDigit(nextWeeksMatch[1]) || 1;
    const days = weeks * 7;
    const endIso = addCalendarDays(todayIso, days);
    const key =
      days === 7
        ? "next_7_days"
        : days === 14
        ? "next_14_days"
        : days === 21
        ? "next_21_days"
        : "next_n_days";
    return buildRangeObject({
      key,
      preset: "next_n_weeks",
      label: `Next ${weeks === 1 ? "7 Days (1 Week)" : `${days} Days (${weeks} Weeks)`}: ${formatShortDate(todayIso)} – ${formatShortDate(endIso)} (Africa/Lagos)`,
      startDateIso: todayIso,
      endDateIso: endIso,
      isFuture: true,
      isExplicit: true,
      daysSpan: days,
    });
  }

  // 2. Check "next week" (without number)
  if (/\b(?:next\s+week|coming\s+week)\b/i.test(q)) {
    const endIso = addCalendarDays(todayIso, 7);
    return buildRangeObject({
      key: "next_7_days",
      preset: "next_n_weeks",
      label: `Next 7 Days: ${formatShortDate(todayIso)} – ${formatShortDate(endIso)} (Africa/Lagos)`,
      startDateIso: todayIso,
      endDateIso: endIso,
      isFuture: true,
      isExplicit: true,
      daysSpan: 7,
    });
  }

  // 3. Check "next N days" / "coming N days"
  const nextDaysMatch = q.match(
    /\b(?:next|coming|upcoming|within(?:\s+the\s+next)?)\s+(\d+|one|two|three|four|five|six|seven|ten|fourteen|twenty-one|thirty)\s+days?\b/i
  );
  if (nextDaysMatch) {
    const days = parseWordOrDigit(nextDaysMatch[1]) || 7;
    const endIso = addCalendarDays(todayIso, days);
    const key =
      days === 7
        ? "next_7_days"
        : days === 14
        ? "next_14_days"
        : days === 21
        ? "next_21_days"
        : "next_n_days";
    return buildRangeObject({
      key,
      preset: "next_n_days",
      label: `Next ${days} Days: ${formatShortDate(todayIso)} – ${formatShortDate(endIso)} (Africa/Lagos)`,
      startDateIso: todayIso,
      endDateIso: endIso,
      isFuture: true,
      isExplicit: true,
      daysSpan: days,
    });
  }

  // 4. Check "tomorrow"
  if (/\btomorrow\b/i.test(q)) {
    const tomorrowIso = addCalendarDays(todayIso, 1);
    return buildRangeObject({
      key: "next_n_days",
      preset: "next_n_days",
      label: `Tomorrow: ${formatShortDate(tomorrowIso)} (Africa/Lagos)`,
      startDateIso: tomorrowIso,
      endDateIso: tomorrowIso,
      isFuture: true,
      isExplicit: true,
      daysSpan: 1,
    });
  }

  // 5. Check "next month"
  if (/\bnext\s+month\b/i.test(q)) {
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const startIso = `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(nextMonthYear, nextMonth, 0)).getUTCDate();
    const endIso = `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return buildRangeObject({
      key: "next_month",
      preset: "next_month",
      label: `Next Month: ${formatShortDate(startIso)} – ${formatShortDate(endIso)} (Africa/Lagos)`,
      startDateIso: startIso,
      endDateIso: endIso,
      isFuture: true,
      isExplicit: true,
      daysSpan: lastDay,
    });
  }

  // 6. Check "yesterday"
  if (/\byesterday\b/i.test(q)) {
    const yestIso = addCalendarDays(todayIso, -1);
    return buildRangeObject({
      key: "yesterday",
      preset: "yesterday",
      label: `Yesterday: ${formatShortDate(yestIso)} (Africa/Lagos)`,
      startDateIso: yestIso,
      endDateIso: yestIso,
      isFuture: false,
      isExplicit: true,
      daysSpan: 1,
    });
  }

  // 7. Check "today"
  if (/\btoday\b/i.test(q)) {
    return buildRangeObject({
      key: "today",
      preset: "today",
      label: `Today: ${formatShortDate(todayIso)} (Africa/Lagos)`,
      startDateIso: todayIso,
      endDateIso: todayIso,
      isFuture: false,
      isExplicit: true,
      daysSpan: 1,
    });
  }

  // 8. Check "last 7 days" / "past 7 days" / "past week" / "last week"
  if (/\b(?:last|past)\s+(?:7\s+days|seven\s+days|week)\b/i.test(q)) {
    const startIso = addCalendarDays(todayIso, -6);
    return buildRangeObject({
      key: "last_7_days",
      preset: "last_7_days",
      label: `Last 7 Days: ${formatShortDate(startIso)} – ${formatShortDate(todayIso)} (Africa/Lagos)`,
      startDateIso: startIso,
      endDateIso: todayIso,
      isFuture: false,
      isExplicit: true,
      daysSpan: 7,
    });
  }

  // 9. Check "this week"
  if (/\bthis\s+week\b/i.test(q)) {
    const [y, m, d] = todayIso.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const mondayIso = addCalendarDays(todayIso, diffToMonday);
    const sundayIso = addCalendarDays(mondayIso, 6);
    return buildRangeObject({
      key: "this_week",
      preset: "this_week",
      label: `This Week: ${formatShortDate(mondayIso)} – ${formatShortDate(sundayIso)} (Africa/Lagos)`,
      startDateIso: mondayIso,
      endDateIso: sundayIso,
      isFuture: false,
      isExplicit: true,
      daysSpan: 7,
    });
  }

  // 10. Check "last month" / "previous month"
  if (/\b(?:last|previous)\s+month\b/i.test(q)) {
    const prevMonthYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const startIso = `${prevMonthYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(prevMonthYear, prevMonth, 0)).getUTCDate();
    const endIso = `${prevMonthYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return buildRangeObject({
      key: "last_month",
      preset: "last_month",
      label: `Last Month: ${formatShortDate(startIso)} – ${formatShortDate(endIso)} (Africa/Lagos)`,
      startDateIso: startIso,
      endDateIso: endIso,
      isFuture: false,
      isExplicit: true,
      daysSpan: lastDay,
    });
  }

  // 11. Check "this month"
  if (/\bthis\s+month\b/i.test(q)) {
    const startIso = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endIso = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return buildRangeObject({
      key: "this_month",
      preset: "this_month",
      label: `This Month: ${formatShortDate(startIso)} – ${formatShortDate(endIso)} (Africa/Lagos)`,
      startDateIso: startIso,
      endDateIso: endIso,
      isFuture: false,
      isExplicit: true,
      daysSpan: lastDay,
    });
  }

  // 12. Check "this quarter"
  if (/\bthis\s+quarter\b/i.test(q)) {
    const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const qEndMonth = qStartMonth + 2;
    const startIso = `${year}-${String(qStartMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(year, qEndMonth, 0)).getUTCDate();
    const endIso = `${year}-${String(qEndMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return buildRangeObject({
      key: "this_quarter",
      preset: "this_quarter",
      label: `This Quarter: ${formatShortDate(startIso)} – ${formatShortDate(endIso)} (Africa/Lagos)`,
      startDateIso: startIso,
      endDateIso: endIso,
      isFuture: false,
      isExplicit: true,
      daysSpan: 90,
    });
  }

  // 13. Check "this year"
  if (/\bthis\s+year\b/i.test(q)) {
    const startIso = `${year}-01-01`;
    const endIso = `${year}-12-31`;
    return buildRangeObject({
      key: "this_year",
      preset: "this_year",
      label: `This Year (${year}): ${formatShortDate(startIso)} – ${formatShortDate(endIso)} (Africa/Lagos)`,
      startDateIso: startIso,
      endDateIso: endIso,
      isFuture: false,
      isExplicit: true,
      daysSpan: 365,
    });
  }

  // 14.If follow-up context had an explicit range and user didn't specify a new one nor say "all time"
  if (fallbackRange && fallbackRange.isExplicit && !/\b(?:all\s+time|overall|total\s+ever|all\s+records)\b/i.test(q)) {
    return { ...fallbackRange, isExplicit: false };
  }

  // Default: All-Time Cumulative Snapshot as of Today (Africa/Lagos)
  return buildRangeObject({
    key: "all_time",
    preset: "all_time",
    label: `All Active Records as of ${formatShortDate(todayIso)} (Africa/Lagos)`,
    startDateIso: "2019-01-01",
    endDateIso: todayIso,
    isFuture: false,
    isExplicit: false,
    daysSpan: 0,
  });
}
