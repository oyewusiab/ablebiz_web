/**
 * ABLEBIZ SUITE — Authentication Session & Inactivity Management
 *
 * Implements:
 * - 30-minute inactivity timeout tracking
 * - 2-minute advance warning before session termination
 * - Meaningful user interaction tracking (excludes background API/polling)
 * - Multi-tab synchronization via BroadcastChannel & storage events
 * - Computer shutdown / sleep detection via persistent timestamps
 * - Reliable token validation & recovery
 */

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const INACTIVITY_WARNING_MS = 2 * 60 * 1000; // 2 minutes warning
export const WARNING_THRESHOLD_MS = INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS; // 28 minutes
export const LAST_ACTIVITY_STORAGE_KEY = "ablebiz_last_activity_time";
export const AUTH_BROADCAST_CHANNEL = "ablebiz_auth_channel";

export type AuthBroadcastMessage =
  | { type: "LOGOUT"; reason?: string }
  | { type: "LOGIN"; userId: string }
  | { type: "ACTIVITY_PING"; timestamp: number }
  | { type: "SESSION_EXTENDED" };

/**
 * Gets the last recorded user activity timestamp from localStorage.
 */
export function getLastActivityTime(): number {
  try {
    const stored = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
    if (!stored) return Date.now();
    const parsed = parseInt(stored, 10);
    return isNaN(parsed) ? Date.now() : parsed;
  } catch {
    return Date.now();
  }
}

/**
 * Updates the last recorded activity timestamp in localStorage and broadcasts to other tabs.
 */
export function recordUserActivity(broadcast = true): void {
  const now = Date.now();
  try {
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, now.toString());
    if (broadcast) {
      broadcastAuthMessage({ type: "ACTIVITY_PING", timestamp: now });
    }
  } catch {
    // Ignore storage write issues
  }
}

/**
 * Clears the stored activity timestamp upon logout.
 */
export function clearActivityTracker(): void {
  try {
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Calculates milliseconds of user inactivity since the last meaningful interaction.
 */
export function getInactivityDuration(): number {
  return Date.now() - getLastActivityTime();
}

/**
 * Checks whether the user has been inactive for longer than the maximum inactivity limit (30 mins).
 */
export function isSessionExpiredByInactivity(): boolean {
  return getInactivityDuration() >= INACTIVITY_TIMEOUT_MS;
}

/**
 * Returns remaining seconds until session expiration.
 */
export function getRemainingInactivitySeconds(): number {
  const remainingMs = INACTIVITY_TIMEOUT_MS - getInactivityDuration();
  return Math.max(0, Math.floor(remainingMs / 1000));
}

/**
 * Cross-tab communication channel using BroadcastChannel with fallback to localStorage events.
 */
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
  }
} catch {
  broadcastChannel = null;
}

export function broadcastAuthMessage(msg: AuthBroadcastMessage): void {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(msg);
    } catch {
      // Ignore
    }
  }
  // Secondary fallback for cross-tab sync
  try {
    localStorage.setItem("ablebiz_cross_tab_sync", JSON.stringify({ ...msg, _t: Date.now() }));
  } catch {
    // Ignore
  }
}

export function subscribeToAuthBroadcast(
  handler: (msg: AuthBroadcastMessage) => void
): () => void {
  // 1. Primary: BroadcastChannel
  const handleBcMessage = (e: MessageEvent) => {
    if (e.data && typeof e.data === "object" && e.data.type) {
      handler(e.data as AuthBroadcastMessage);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener("message", handleBcMessage);
  }

  // 2. Secondary: storage event listener for browsers/windows where BC isn't shared
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === "ablebiz_cross_tab_sync" && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && parsed.type) {
          handler(parsed as AuthBroadcastMessage);
        }
      } catch {
        // Ignore
      }
    }
  };

  window.addEventListener("storage", handleStorageEvent);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener("message", handleBcMessage);
    }
    window.removeEventListener("storage", handleStorageEvent);
  };
}
