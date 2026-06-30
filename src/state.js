/**
 * ============================================================================
 * state.js — Save / load with Capacitor Preferences (+ browser fallback)
 * ============================================================================
 *
 * Native app (after npm run build && cap sync):
 *   iOS → UserDefaults
 *   Android → SharedPreferences
 *
 * Browser preview (npm start):
 *   Uses the same API; falls back to localStorage if the plugin is unavailable.
 *
 * All functions are async — use await in app.js.
 */

import { Preferences } from '@capacitor/preferences';

export const STORAGE_KEY = 'sanctuary_pet_v1';
const LEGACY_KEYS = ['sanctuary_pet_v1', 'pethabit_v2'];

export const DEFAULT_FEED_WINDOW = {
  startHour: 7,
  startMinute: 0,
  endHour: 9,
  endMinute: 0,
};

// -----------------------------------------------------------------------------
// Storage wrapper — Preferences first, localStorage fallback for simple previews
// -----------------------------------------------------------------------------

/**
 * Thin wrapper so preview always works (even without a full native build).
 */
const storage = {
  async get(key) {
    try {
      return await Preferences.get({ key });
    } catch (err) {
      console.warn('Preferences.get failed, using localStorage:', err);
      return { value: localStorage.getItem(key) };
    }
  },

  async set(key, value) {
    try {
      await Preferences.set({ key, value });
    } catch (err) {
      console.warn('Preferences.set failed, using localStorage:', err);
      localStorage.setItem(key, value);
    }
  },

  async remove(key) {
    try {
      await Preferences.remove({ key });
    } catch (err) {
      console.warn('Preferences.remove failed, using localStorage:', err);
      localStorage.removeItem(key);
    }
  },
};

// -----------------------------------------------------------------------------
// Create default state
// -----------------------------------------------------------------------------

export function createDefaultState(petName = 'Mochi', feedWindow = DEFAULT_FEED_WINDOW) {
  const today = todayDateString();

  return {
    petName: petName.trim() || 'Mochi',
    stage: 'egg',
    health: 80,
    happiness: 80,
    streak: 0,
    lastFedDate: null,
    lastOnTimeFeedDate: null,
    lastMissedCheckDate: null,
    createdAt: today,
    feedLog: {},
    onboarded: false,
    feedWindow: {
      startHour: feedWindow.startHour,
      startMinute: feedWindow.startMinute ?? 0,
      endHour: feedWindow.endHour,
      endMinute: feedWindow.endMinute ?? 0,
    },
  };
}

export function todayDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// -----------------------------------------------------------------------------
// Async load / save / clear
// -----------------------------------------------------------------------------

export async function loadState() {
  try {
    const { value } = await storage.get(STORAGE_KEY);

    if (value) {
      return normalizeState(JSON.parse(value));
    }

    const migrated = await migrateFromLegacyLocalStorage();
    if (migrated) {
      await saveState(migrated);
      return migrated;
    }

    return null;
  } catch (err) {
    console.warn('Could not load save:', err);
    return null;
  }
}

export async function saveState(state) {
  await storage.set(STORAGE_KEY, JSON.stringify(state));
}

export async function clearState() {
  await storage.remove(STORAGE_KEY);
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

async function migrateFromLegacyLocalStorage() {
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = normalizeState(JSON.parse(raw));
      if (parsed) {
        console.info(`Migrated save from legacy key: ${key}`);
        localStorage.removeItem(key);
        return parsed;
      }
    } catch {
      // try next key
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// normalizeState
// -----------------------------------------------------------------------------

export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const win = raw.feedWindow || DEFAULT_FEED_WINDOW;
  const stage = String(raw.stage || 'egg').toLowerCase();

  return {
    petName: typeof raw.petName === 'string' ? raw.petName : 'Mochi',
    stage: ['egg', 'baby', 'adult'].includes(stage) ? stage : 'egg',
    health: clamp0100(raw.health, 80),
    happiness: clamp0100(raw.happiness, 80),
    streak: Math.max(0, parseInt(raw.streak, 10) || 0),
    lastFedDate: raw.lastFedDate || null,
    lastOnTimeFeedDate: raw.lastOnTimeFeedDate || null,
    lastMissedCheckDate: raw.lastMissedCheckDate || null,
    feedLog: raw.feedLog && typeof raw.feedLog === 'object' ? raw.feedLog : {},
    createdAt: raw.createdAt || todayDateString(),
    onboarded: Boolean(raw.onboarded),
    feedWindow: {
      startHour: toInt(win.startHour, DEFAULT_FEED_WINDOW.startHour),
      startMinute: toInt(win.startMinute, 0),
      endHour: toInt(win.endHour, DEFAULT_FEED_WINDOW.endHour),
      endMinute: toInt(win.endMinute, 0),
    },
  };
}

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function clamp0100(value, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}
