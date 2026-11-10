import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INACTIVITY_TIMEOUT_MS,
  INACTIVITY_WARNING_MS,
  WARNING_THRESHOLD_MS,
  LAST_ACTIVITY_STORAGE_KEY,
  AUTH_BROADCAST_CHANNEL,
} from "../sessionManager";

describe("sessionManager — Inactivity Thresholds & Policy", () => {
  it("enforces a strict 30-minute inactivity limit", () => {
    assert.equal(INACTIVITY_TIMEOUT_MS, 30 * 60 * 1000);
    assert.equal(INACTIVITY_TIMEOUT_MS, 1800000);
  });

  it("enforces a 2-minute advance warning before session termination", () => {
    assert.equal(INACTIVITY_WARNING_MS, 2 * 60 * 1000);
    assert.equal(INACTIVITY_WARNING_MS, 120000);
    assert.equal(WARNING_THRESHOLD_MS, 28 * 60 * 1000);
  });

  it("defines standard storage keys and broadcast channels", () => {
    assert.equal(LAST_ACTIVITY_STORAGE_KEY, "ablebiz_last_activity_time");
    assert.equal(AUTH_BROADCAST_CHANNEL, "ablebiz_auth_channel");
  });

  it("calculates countdown seconds accurately", () => {
    // 30 minutes total = 1800 seconds
    const totalSecs = Math.floor(INACTIVITY_TIMEOUT_MS / 1000);
    assert.equal(totalSecs, 1800);

    // Warning threshold = 120 seconds
    const warningSecs = Math.floor(INACTIVITY_WARNING_MS / 1000);
    assert.equal(warningSecs, 120);
  });
});
