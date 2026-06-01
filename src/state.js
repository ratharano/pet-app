/**
 * state.js — Save and load your pet data from the phone's Local Storage.
 *
 * Everything lives in one JSON object. When the user feeds the pet or changes
 * settings, we update that object and call saveState().
 */

/** Key used in localStorage — change only if you want to reset all users' data */
export const STORAGE_KEY = 'pethabit_v2';

/**
 * Default feed window: 7:00 AM – 9:00 AM (24-hour clock).
 * Users can change these later in settings (V2).
 */
export const DEFAULT_FEED_WINDOW = {
  startHour: 7,
  startMinute: 0,
  endHour: 9,
  endMinute: 0,
};

/**
 * Creates a brand-new pet + habit profile (first launch or after reset).
 *
 * @param {string} petName - Name the user chose for their pet
 * @param {object} [feedWindow] - Optional custom window; uses DEFAULT_FEED_WINDOW if omitted
 * @returns {object} Fresh app state
 */
export function createDefaultState(petName = 'Mochi', feedWindow = DEFAULT_FEED_WINDOW) {
  const today = todayDateString();

  return {
    // --- Pet identity ---
    petName: petName.trim() || 'Mochi',

    /**
     * Growth stage is derived from streak in logic.js, but we store it
     * so the UI can show it without recalculating every time.
     * Values: 'egg' | 'baby' | 'adult'
     */
    stage: 'egg',

    /** 0–100. Drops heavily if the user misses a full day. */
    health: 80,

    /** 0–100. Drops if they feed late or miss a day. */
    happiness: 80,

    /**
     * Consecutive days the pet was fed INSIDE the time window.
     * Resets to 0 on a missed day. Drives evolution (egg → baby → adult).
     */
    streak: 0,

    /**
     * Last calendar day the user pressed "Feed" (YYYY-MM-DD).
     * null = never fed yet.
     */
    lastFedDate: null,

    /**
     * Last calendar day they fed ON TIME (inside the window).
     * Used to detect missed days vs late feeds.
     */
    lastOnTimeFeedDate: null,

    /**
     * Daily log: { '2026-06-01': 'on_time' | 'late' }
     * Helps show history and debug; optional for V1 UI.
     */
    feedLog: {},

    /** When the user finished onboarding */
    createdAt: today,

    /**
     * Last calendar day we ran the "missed day" check (YYYY-MM-DD).
     * Stops the app from applying the same penalty every time you open it.
     */
    lastMissedCheckDate: null,

    /** Has the user completed the first-time setup screen? */
    onboarded: false,

    /**
     * When the pet may be fed each day (local device time).
     * startHour/startMinute = window opens
     * endHour/endMinute   = window closes (still "on time" through this minute)
     */
    feedWindow: {
      startHour: feedWindow.startHour,
      startMinute: feedWindow.startMinute ?? 0,
      endHour: feedWindow.endHour,
      endMinute: feedWindow.endMinute ?? 0,
    },
  };
}

/**
 * Today's date as YYYY-MM-DD in the user's local timezone.
 * (Same format we use for lastFedDate and feedLog keys.)
 */
export function todayDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Load saved state from localStorage, or return null if none / corrupt.
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    // Bad JSON or storage blocked — treat as no save
    return null;
  }
}

/**
 * Save state to localStorage.
 * @param {object} state
 */
export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Remove all saved progress (reset button).
 */
export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Fix up old or partial saves so the app does not crash.
 * @param {object|null} raw
 * @returns {object|null}
 */
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const window = raw.feedWindow || DEFAULT_FEED_WINDOW;

  return {
    petName: typeof raw.petName === 'string' ? raw.petName : 'Mochi',
    stage: ['egg', 'baby', 'adult'].includes(raw.stage) ? raw.stage : 'egg',
    health: clampStat(raw.health, 80),
    happiness: clampStat(raw.happiness, 80),
    streak: Math.max(0, parseInt(raw.streak, 10) || 0),
    lastFedDate: raw.lastFedDate || null,
    lastOnTimeFeedDate: raw.lastOnTimeFeedDate || null,
    feedLog: raw.feedLog && typeof raw.feedLog === 'object' ? raw.feedLog : {},
    createdAt: raw.createdAt || todayDateString(),
    lastMissedCheckDate: raw.lastMissedCheckDate || null,
    onboarded: Boolean(raw.onboarded),
    feedWindow: {
      startHour: toInt(window.startHour, DEFAULT_FEED_WINDOW.startHour),
      startMinute: toInt(window.startMinute, 0),
      endHour: toInt(window.endHour, DEFAULT_FEED_WINDOW.endHour),
      endMinute: toInt(window.endMinute, 0),
    },
  };
}

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

/** Keep health/happiness between 0 and 100 */
function clampStat(value, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}
