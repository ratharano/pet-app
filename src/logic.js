/**
 * logic.js — Rules for feeding, streaks, growth, and missed days.
 *
 * No DOM here — only math and plain objects. app.js calls these functions
 * and updates the screen.
 */

import { todayDateString } from './state.js';

// ---------------------------------------------------------------------------
// Tunable numbers (change these to balance how forgiving the pet is)
// ---------------------------------------------------------------------------

/** Fed inside the daily window */
export const REWARD_ON_TIME = {
  health: 10,
  happiness: 15,
};

/** Fed today, but after the window ended */
export const PENALTY_LATE = {
  health: 0, // stays stable (we do not add or subtract)
  happiness: -15,
};

/** User opened the app on a new day without feeding yesterday */
export const PENALTY_MISSED_DAY = {
  health: -25,
  happiness: -30,
};

/** Streak needed for each growth stage */
export const GROWTH_THRESHOLDS = {
  baby: 7, // streak >= 7 → baby
  adult: 30, // streak >= 30 → adult
};

// ---------------------------------------------------------------------------
// Time window helpers
// ---------------------------------------------------------------------------

/**
 * Build a Date for today at a specific hour:minute (local time).
 */
function timeToday(hour, minute, referenceDate = new Date()) {
  const d = new Date(referenceDate);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Is `now` inside the feed window on that calendar day?
 *
 * Example window 7:00–9:00 means:
 *   - 6:59 AM → false
 *   - 7:00 AM → true
 *   - 9:00 AM → true (inclusive end)
 *   - 9:01 AM → false
 */
export function isWithinFeedWindow(now, feedWindow) {
  const start = timeToday(feedWindow.startHour, feedWindow.startMinute, now);
  const end = timeToday(feedWindow.endHour, feedWindow.endMinute, now);
  return now >= start && now <= end;
}

/**
 * Human-readable window label for the UI, e.g. "7:00 AM – 9:00 AM"
 */
export function formatFeedWindow(feedWindow) {
  const fmt = (h, m) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };
  return `${fmt(feedWindow.startHour, feedWindow.startMinute)} – ${fmt(feedWindow.endHour, feedWindow.endMinute)}`;
}

/**
 * Shift a YYYY-MM-DD string by N days (negative = go back).
 */
export function shiftDateString(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  return todayDateString(date);
}

// ---------------------------------------------------------------------------
// Growth
// ---------------------------------------------------------------------------

/**
 * Egg → Baby at 7-day on-time streak, Baby → Adult at 30.
 * (Based on current streak counter.)
 */
export function getStageFromStreak(streak) {
  if (streak >= GROWTH_THRESHOLDS.adult) return 'adult';
  if (streak >= GROWTH_THRESHOLDS.baby) return 'baby';
  return 'egg';
}

// ---------------------------------------------------------------------------
// Stat helpers
// ---------------------------------------------------------------------------

function clamp0100(value) {
  return Math.min(100, Math.max(0, value));
}

function applyDeltas(state, { health = 0, happiness = 0 }) {
  return {
    ...state,
    health: clamp0100(state.health + health),
    happiness: clamp0100(state.happiness + happiness),
  };
}

// ---------------------------------------------------------------------------
// Missed day (run when the app loads on a new day)
// ---------------------------------------------------------------------------

/**
 * If the user did not feed yesterday, apply heavy penalties and reset streak.
 * Safe to call every app launch — it only runs once per "gap" day.
 *
 * @returns {{ state: object, missed: boolean, message: string|null }}
 */
export function applyMissedDayIfNeeded(state, now = new Date()) {
  const today = todayDateString(now);
  const yesterday = shiftDateString(today, -1);

  // Already ran the daily check today — do not punish again on every open
  if (state.lastMissedCheckDate === today) {
    return { state, missed: false, message: null };
  }

  const markChecked = (s) => ({ ...s, lastMissedCheckDate: today });

  // Never fed yet — nothing to punish
  if (!state.lastFedDate) {
    return { state: markChecked(state), missed: false, message: null };
  }

  // Fed yesterday or already fed today — no miss
  if (state.lastFedDate === yesterday || state.lastFedDate === today) {
    return { state: markChecked(state), missed: false, message: null };
  }

  // lastFedDate is older than yesterday → skipped at least one day
  if (state.lastFedDate < yesterday) {
    let next = applyDeltas(state, PENALTY_MISSED_DAY);
    next = { ...next, streak: 0, stage: 'egg', lastMissedCheckDate: today };
    return {
      state: next,
      missed: true,
      message: `${state.petName} missed you yesterday. Health and happiness dropped.`,
    };
  }

  return { state: markChecked(state), missed: false, message: null };
}

// ---------------------------------------------------------------------------
// Feed button
// ---------------------------------------------------------------------------

/**
 * Decide what SHOULD happen when the user taps "Feed" right now.
 * Does not mutate state — use applyFeed() for that.
 *
 * @returns {{
 *   allowed: boolean,
 *   kind: 'on_time' | 'late' | 'already_fed' | 'blocked',
 *   healthDelta: number,
 *   happinessDelta: number,
 *   streakDelta: number,
 *   message: string
 * }}
 */
export function calculateFeedOutcome(state, now = new Date()) {
  const today = todayDateString(now);

  // Already fed today — one feed per day in V1
  if (state.lastFedDate === today) {
    return {
      allowed: false,
      kind: 'already_fed',
      healthDelta: 0,
      happinessDelta: 0,
      streakDelta: 0,
      message: `You already fed ${state.petName} today. Come back tomorrow!`,
    };
  }

  const onTime = isWithinFeedWindow(now, state.feedWindow);

  if (onTime) {
    return {
      allowed: true,
      kind: 'on_time',
      healthDelta: REWARD_ON_TIME.health,
      happinessDelta: REWARD_ON_TIME.happiness,
      streakDelta: 1,
      message: `${state.petName} loved feeding on time!`,
    };
  }

  // Same calendar day but outside the window = late feed
  return {
    allowed: true,
    kind: 'late',
    healthDelta: PENALTY_LATE.health,
    happinessDelta: PENALTY_LATE.happiness,
    streakDelta: 0, // late feed does not grow streak
    message: `Late feed — ${state.petName} is okay, but a bit disappointed.`,
  };
}

/**
 * Apply feed rules and return the new state (remember to saveState in app.js).
 *
 * @param {object} state
 * @param {Date} [now]
 * @returns {{ state: object, outcome: object }}
 */
export function applyFeed(state, now = new Date()) {
  const outcome = calculateFeedOutcome(state, now);
  if (!outcome.allowed) {
    return { state, outcome };
  }

  const today = todayDateString(now);
  let next = applyDeltas(state, {
    health: outcome.healthDelta,
    happiness: outcome.happinessDelta,
  });

  const newStreak =
    outcome.kind === 'on_time' ? (state.streak || 0) + outcome.streakDelta : state.streak;

  next = {
    ...next,
    streak: newStreak,
    stage: getStageFromStreak(newStreak),
    lastFedDate: today,
    lastOnTimeFeedDate: outcome.kind === 'on_time' ? today : state.lastOnTimeFeedDate,
    feedLog: {
      ...next.feedLog,
      [today]: outcome.kind === 'on_time' ? 'on_time' : 'late',
    },
  };

  return { state: next, outcome };
}

/**
 * Quick summary for the status line under the pet.
 */
export function getPetMoodSummary(state) {
  if (state.health < 30 || state.happiness < 30) return 'critical';
  if (state.health < 55 || state.happiness < 55) return 'sad';
  return 'healthy';
}
