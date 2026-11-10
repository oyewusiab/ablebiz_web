/**
 * Date Utility Functions for ABLEBIZ SUITE
 * Provides reliable, timezone-safe date parsing, validation, and formatting.
 * Designed to prevent timezone shifts across local, UTC, and West Africa Time (WAT).
 */

/**
 * Checks whether a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  if (year % 4 !== 0) return false;
  if (year % 100 !== 0) return true;
  return year % 400 === 0;
}

/**
 * Returns the number of days in a given month (1-12) for a given year.
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

export interface DateParseResult {
  isValid: boolean;
  date: Date | null;
  day?: number;
  month?: number;
  year?: number;
  error?: string;
  formattedDDMMYYYY?: string;
  formattedYYYYMMDD?: string;
  timezoneSafeIso?: string;
}

/**
 * Parses user input into a validated calendar date.
 * Supports:
 * - DD/MM/YYYY (recommended display/input format)
 * - DD-MM-YYYY
 * - YYYY-MM-DD (standard HTML5 date input)
 * - DD.MM.YYYY
 */
export function parseFlexibleDate(input?: string | null): DateParseResult {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      date: null,
      error: "Date is required.",
    };
  }

  const trimmed = input.trim();

  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  // 1. Check for YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10);
    day = parseInt(ymdMatch[3], 10);
  } else {
    // 2. Check for DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1], 10);
      month = parseInt(dmyMatch[2], 10);
      year = parseInt(dmyMatch[3], 10);
    }
  }

  if (day === null || month === null || year === null) {
    return {
      isValid: false,
      date: null,
      error: "Please enter a valid date in DD/MM/YYYY format.",
    };
  }

  // Validate year range
  if (year < 1970 || year > 2100) {
    return {
      isValid: false,
      date: null,
      error: `Year must be between 1970 and 2100 (entered: ${year}).`,
    };
  }

  // Validate month (1-12)
  if (month < 1 || month > 12) {
    return {
      isValid: false,
      date: null,
      error: `Invalid month: ${month}. Month must be between 1 and 12.`,
    };
  }

  // Validate day against specific month and leap year
  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    if (month === 2 && day === 29) {
      return {
        isValid: false,
        date: null,
        error: `${year} is not a leap year. February only has 28 days.`,
      };
    }
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return {
      isValid: false,
      date: null,
      error: `Invalid day: ${day}. ${monthNames[month - 1]} ${year} has ${maxDays} days.`,
    };
  }

  // Timezone-safe date creation:
  // Using 12:00:00 UTC (noon) guarantees that any timezone between UTC-11 and UTC+12
  // stays on the exact same calendar date.
  const paddedDay = day.toString().padStart(2, "0");
  const paddedMonth = month.toString().padStart(2, "0");
  const isoString = `${year}-${paddedMonth}-${paddedDay}T12:00:00.000Z`;
  const dateObj = new Date(isoString);

  return {
    isValid: true,
    date: dateObj,
    day,
    month,
    year,
    formattedDDMMYYYY: `${paddedDay}/${paddedMonth}/${year}`,
    formattedYYYYMMDD: `${year}-${paddedMonth}-${paddedDay}`,
    timezoneSafeIso: isoString,
  };
}

/**
 * Formats a Date object, ISO string, or timestamp into DD/MM/YYYY.
 */
export function formatDateToDDMMYYYY(val?: Date | string | number | null): string {
  if (!val) return "";
  try {
    const d = typeof val === "object" ? val : new Date(val);
    if (isNaN(d.getTime())) return "";
    const day = d.getUTCDate().toString().padStart(2, "0");
    const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}

/**
 * Formats a Date object, ISO string, or timestamp into YYYY-MM-DD for native <input type="date">.
 */
export function formatDateToYYYYMMDD(val?: Date | string | number | null): string {
  if (!val) return "";
  try {
    const d = typeof val === "object" ? val : new Date(val);
    if (isNaN(d.getTime())) return "";
    const day = d.getUTCDate().toString().padStart(2, "0");
    const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
}

/**
 * Returns today's date formatted as DD/MM/YYYY in local/WAT time.
 */
export function getTodayFormattedDDMMYYYY(): string {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in local/WAT time.
 */
export function getTodayFormattedYYYYMMDD(): string {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear();
  return `${year}-${month}-${day}`;
}
