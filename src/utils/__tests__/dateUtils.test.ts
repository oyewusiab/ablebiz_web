import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLeapYear,
  getDaysInMonth,
  parseFlexibleDate,
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
} from "../dateUtils";

describe("dateUtils — Calendar & Leap Year Logic", () => {
  it("correctly identifies leap years and common years", () => {
    // Divisible by 4, not 100 -> leap
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(2028), true);
    assert.equal(isLeapYear(2032), true);

    // Common years
    assert.equal(isLeapYear(2023), false);
    assert.equal(isLeapYear(2025), false);
    assert.equal(isLeapYear(2026), false);

    // Century years divisible by 100 but not 400 -> common
    assert.equal(isLeapYear(1900), false);
    assert.equal(isLeapYear(2100), false);

    // Century years divisible by 400 -> leap
    assert.equal(isLeapYear(2000), true);
    assert.equal(isLeapYear(2400), true);
  });

  it("calculates exact days in each month including February in leap years", () => {
    // 31-day months
    assert.equal(getDaysInMonth(2026, 1), 31); // Jan
    assert.equal(getDaysInMonth(2026, 3), 31); // Mar
    assert.equal(getDaysInMonth(2026, 5), 31); // May
    assert.equal(getDaysInMonth(2026, 7), 31); // Jul
    assert.equal(getDaysInMonth(2026, 8), 31); // Aug
    assert.equal(getDaysInMonth(2026, 10), 31); // Oct
    assert.equal(getDaysInMonth(2026, 12), 31); // Dec

    // 30-day months
    assert.equal(getDaysInMonth(2026, 4), 30); // Apr
    assert.equal(getDaysInMonth(2026, 6), 30); // Jun
    assert.equal(getDaysInMonth(2026, 9), 30); // Sep
    assert.equal(getDaysInMonth(2026, 11), 30); // Nov

    // February: 28 days in non-leap year (2026)
    assert.equal(getDaysInMonth(2026, 2), 28);

    // February: 29 days in leap year (2024)
    assert.equal(getDaysInMonth(2024, 2), 29);
  });
});

describe("dateUtils — Flexible Date Parsing & Validation", () => {
  it("parses valid DD/MM/YYYY date strings cleanly", () => {
    const res = parseFlexibleDate("15/11/2026");
    assert.equal(res.isValid, true);
    assert.equal(res.day, 15);
    assert.equal(res.month, 11);
    assert.equal(res.year, 2026);
    assert.equal(res.formattedDDMMYYYY, "15/11/2026");
    assert.equal(res.formattedYYYYMMDD, "2026-11-15");
    assert.equal(res.timezoneSafeIso, "2026-11-15T12:00:00.000Z");
  });

  it("parses native HTML5 YYYY-MM-DD date inputs correctly", () => {
    const res = parseFlexibleDate("2026-11-10");
    assert.equal(res.isValid, true);
    assert.equal(res.day, 10);
    assert.equal(res.month, 11);
    assert.equal(res.year, 2026);
    assert.equal(res.formattedDDMMYYYY, "10/11/2026");
    assert.equal(res.timezoneSafeIso, "2026-11-10T12:00:00.000Z");
  });

  it("handles valid leap day (29/02/2024)", () => {
    const res = parseFlexibleDate("29/02/2024");
    assert.equal(res.isValid, true);
    assert.equal(res.day, 29);
    assert.equal(res.month, 2);
    assert.equal(res.year, 2024);
  });

  it("rejects invalid leap day on common year (29/02/2026)", () => {
    const res = parseFlexibleDate("29/02/2026");
    assert.equal(res.isValid, false);
    assert.match(res.error || "", /not a leap year/i);
  });

  it("rejects nonexistent calendar days (31/04/2026, 32/01/2026, 00/05/2026)", () => {
    const resApr = parseFlexibleDate("31/04/2026");
    assert.equal(resApr.isValid, false);
    assert.match(resApr.error || "", /April 2026 has 30 days/i);

    const resJan = parseFlexibleDate("32/01/2026");
    assert.equal(resJan.isValid, false);

    const resZero = parseFlexibleDate("00/05/2026");
    assert.equal(resZero.isValid, false);
  });

  it("rejects invalid month numbers (> 12 or < 1)", () => {
    const res = parseFlexibleDate("15/13/2026");
    assert.equal(res.isValid, false);
    assert.match(res.error || "", /Invalid month: 13/i);
  });

  it("rejects empty or malformed strings", () => {
    assert.equal(parseFlexibleDate("").isValid, false);
    assert.equal(parseFlexibleDate("   ").isValid, false);
    assert.equal(parseFlexibleDate("not-a-date").isValid, false);
  });
});

describe("dateUtils — Formatting & Timezone Safety", () => {
  it("formats ISO timestamps to DD/MM/YYYY without timezone drift", () => {
    const formatted = formatDateToDDMMYYYY("2026-11-15T12:00:00.000Z");
    assert.equal(formatted, "15/11/2026");
  });

  it("formats Date objects to YYYY-MM-DD", () => {
    const d = new Date("2026-05-20T12:00:00.000Z");
    const formatted = formatDateToYYYYMMDD(d);
    assert.equal(formatted, "2026-05-20");
  });
});
