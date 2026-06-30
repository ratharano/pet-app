/**
 * ============================================================================
 * logic.js — Game rules (pure functions, no HTML)
 * ============================================================================
 *
 * Everything here is "math only":
 *   - Is it inside the feed window?
 *   - What happens when user taps Feed?
 *   - Did they miss yesterday? (checked when app opens)
 *   - What evolution stage matches their streak?
 *
 * app.js calls these functions, then saves the result with saveState().
 */

import { todayDateString } from './state.js';

// =============================================================================
// BALANCE KNOBS — edit these numbers to make the pet stricter or gentler
// =============================================================================

/** User fed during the daily window (e.g. 7:00–9:00 AM) */
export const REWARD_ON_TIME = {
  health: 10,
  happiness: 15,
};

/** User fed today but AFTER the window ended */
export const PENALTY_LATE = {
  health: 0,       // stays stable — no change
  happiness: -15,
};

/** User did not feed yesterday (detected on app open) */
export const PENALTY_MISSED_DAY = {
  health: -25,
  happiness: -30,
};

/** Streak length required for each evolution (on-time streak only) */
export const GROWTH_THRESHOLDS = {
  baby: 7,   // 7+ days → BABY
  adult: 30, // 30+ days → ADULT
};

// =============================================================================
// TIME WINDOW
// =============================================================================

/**
 * Builds "today at 7:30" as a real Date object for comparisons.
 */
function dateAtTime(hour, minute, reference = new Date()) {
  const d = new Date(reference);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Returns true if `now` is inside the feed window on that calendar day.
 *
 * Window 7:00–9:00 means:
 *   6:59 AM → false
 *   7:00 AM → true
 *   9:00 AM → true (end minute is inclusive)
 *   9:01 AM → false
 */
export function isWithinFeedWindow(now, feedWindow) {
  const start = dateAtTime(feedWindow.startHour, feedWindow.startMinute, now);
  const end = dateAtTime(feedWindow.endHour, feedWindow.endMinute, now);
  return now >= start && now <= end;
}

/** Pretty label for UI: "7:00 AM – 9:00 AM" */
export function formatFeedWindow(feedWindow) {
  const format = (h, m) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };
  return `${format(feedWindow.startHour, feedWindow.startMinute)} – ${format(feedWindow.endHour, feedWindow.endMinute)}`;
}

/** Move a YYYY-MM-DD string forward/backward by N days */
export function shiftDateString(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  return todayDateString(date);
}

// =============================================================================
// EVOLUTION (EGG → BABY → ADULT)
// =============================================================================

/**
 * Evolution is based ONLY on on-time streak count (see applyFeed).
 */
export function getStageFromStreak(streak) {
  if (streak >= GROWTH_THRESHOLDS.adult) return 'adult';
  if (streak >= GROWTH_THRESHOLDS.baby) return 'baby';
  return 'egg';
}

/** Display label: EGG, BABY, ADULT */
export function formatStage(stage) {
  return String(stage || 'egg').toUpperCase();
}

// =============================================================================
// INTERNAL STAT MATH
// =============================================================================

function clamp0100(n) {
  return Math.min(100, Math.max(0, n));
}

function applyDeltas(state, { health = 0, happiness = 0 }) {
  return {
    ...state,
    health: clamp0100(state.health + health),
    happiness: clamp0100(state.happiness + happiness),
  };
}

// =============================================================================
// MISSED DAY — run once when app opens (app.js calls this in boot())
// =============================================================================

/**
 * If the user didn't feed yesterday, punish once and reset streak.
 *
 * Returns:
 *   state   — updated copy (or same)
 *   missed  — true if we applied penalty this time
 *   message — text to show the user (or null)
 */
export function applyMissedDayIfNeeded(state, now = new Date()) {
  const today = todayDateString(now);
  const yesterday = shiftDateString(today, -1);

  // Already checked today — don't punish on every app reopen
  if (state.lastMissedCheckDate === today) {
    return { state, missed: false, message: null };
  }

  const markChecked = (s) => ({ ...s, lastMissedCheckDate: today });

  if (!state.lastFedDate) {
    return { state: markChecked(state), missed: false, message: null };
  }

  if (state.lastFedDate === yesterday || state.lastFedDate === today) {
    return { state: markChecked(state), missed: false, message: null };
  }

  if (state.lastFedDate < yesterday) {
    let next = applyDeltas(state, PENALTY_MISSED_DAY);
    next = {
      ...next,
      streak: 0,
      stage: 'egg',
      lastMissedCheckDate: today,
    };
    return {
      state: next,
      missed: true,
      message: `${state.petName} was alone yesterday. Health and happiness fell, and the streak reset.`,
    };
  }

  return { state: markChecked(state), missed: false, message: null };
}

// =============================================================================
// FEED BUTTON
// =============================================================================

/**
 * Preview what would happen if user taps Feed RIGHT NOW.
 * Does NOT change state — use applyFeed() to actually apply.
 */
export function calculateFeedOutcome(state, now = new Date()) {
  const today = todayDateString(now);

  // V1 rule: only one feed per calendar day
  if (state.lastFedDate === today) {
    return {
      allowed: false,
      kind: 'already_fed',
      healthDelta: 0,
      happinessDelta: 0,
      streakDelta: 0,
      message: `You already fed ${state.petName} today. See you tomorrow!`,
    };
  }

  if (isWithinFeedWindow(now, state.feedWindow)) {
    return {
      allowed: true,
      kind: 'on_time',
      healthDelta: REWARD_ON_TIME.health,
      happinessDelta: REWARD_ON_TIME.happiness,
      streakDelta: 1,
      message: `${state.petName} is warm and full. On-time feeding!`,
    };
  }

  return {
    allowed: true,
    kind: 'late',
    healthDelta: PENALTY_LATE.health,
    happinessDelta: PENALTY_LATE.happiness,
    streakDelta: 0,
    message: `Late feeding — ${state.petName} is safe, but a little lonely.`,
  };
}

/**
 * Apply feed rules and return { state, outcome }.
 * app.js must call saveState(state) after this.
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
    outcome.kind === 'on_time'
      ? (state.streak || 0) + outcome.streakDelta
      : state.streak;

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

/** Used to pick a sadder or happier emoji on screen */
export function getPetMoodSummary(state) {
  if (state.health < 30 || state.happiness < 30) return 'critical';
  if (state.health < 55 || state.happiness < 55) return 'sad';
  return 'healthy';
}
