/**
 * app.js — Connects the HTML buttons and bars to state.js + logic.js.
 *
 * Flow on each page load:
 *   1. Load save from localStorage
 *   2. Check for missed days (logic.applyMissedDayIfNeeded)
 *   3. Draw the pet screen
 *
 * When user taps "Feed":
 *   1. logic.calculateFeedOutcome / applyFeed
 *   2. saveState
 *   3. Refresh UI
 */

import {
  loadState,
  saveState,
  clearState,
  createDefaultState,
  todayDateString,
} from './state.js';

import {
  applyMissedDayIfNeeded,
  applyFeed,
  formatFeedWindow,
  getPetMoodSummary,
  isWithinFeedWindow,
} from './logic.js';

// ---------------------------------------------------------------------------
// DOM references (filled in when the page loads)
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

let dom = {};

function cacheDom() {
  dom = {
    onboarding: $('onboarding'),
    app: $('app'),
    petNameInput: $('petNameInput'),
    startBtn: $('startBtn'),
    petNameDisplay: $('petNameDisplay'),
    stageLabel: $('stageLabel'),
    streakCount: $('streakCount'),
    healthBar: $('healthBar'),
    healthValue: $('healthValue'),
    happinessBar: $('happinessBar'),
    happinessValue: $('happinessValue'),
    windowLabel: $('windowLabel'),
    statusMessage: $('statusMessage'),
    feedBtn: $('feedBtn'),
    resetBtn: $('resetBtn'),
    petEmoji: $('petEmoji'),
  };
}

// ---------------------------------------------------------------------------
// In-memory copy of the save (synced to localStorage on every change)
// ---------------------------------------------------------------------------

let state = null;

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function setBar(fillEl, valueEl, value) {
  const v = Math.round(value);
  fillEl.style.width = `${v}%`;
  valueEl.textContent = String(v);
}

function stageEmoji(stage, mood) {
  if (mood === 'critical') return '💔';
  if (stage === 'adult') return '🦁';
  if (stage === 'baby') return '🐣';
  return '🥚';
}

function render() {
  if (!state) return;

  dom.petNameDisplay.textContent = state.petName;
  dom.stageLabel.textContent = state.stage.charAt(0).toUpperCase() + state.stage.slice(1);
  dom.streakCount.textContent = String(state.streak);
  dom.windowLabel.textContent = formatFeedWindow(state.feedWindow);

  setBar(dom.healthBar, dom.healthValue, state.health);
  setBar(dom.happinessBar, dom.happinessValue, state.happiness);

  const mood = getPetMoodSummary(state);
  dom.petEmoji.textContent = stageEmoji(state.stage, mood);

  const now = new Date();
  const today = todayDateString(now);
  const inWindow = isWithinFeedWindow(now, state.feedWindow);
  const fedToday = state.lastFedDate === today;

  if (fedToday) {
    dom.feedBtn.disabled = true;
    dom.feedBtn.textContent = 'Fed today ✓';
  } else {
    dom.feedBtn.disabled = false;
    dom.feedBtn.textContent = inWindow ? 'Feed (on time!)' : 'Feed (late)';
  }
}

function showMessage(text) {
  dom.statusMessage.textContent = text || '';
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function showOnboarding() {
  dom.onboarding.hidden = false;
  dom.app.hidden = true;
}

function showApp() {
  dom.onboarding.hidden = true;
  dom.app.hidden = false;
  render();
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function handleStart() {
  const name = dom.petNameInput.value.trim();
  if (!name) {
    dom.petNameInput.focus();
    return;
  }

  state = createDefaultState(name);
  state.onboarded = true;
  saveState(state);

  const missed = applyMissedDayIfNeeded(state);
  state = missed.state;
  saveState(state);

  showApp();
  showMessage(`Feed ${state.petName} between ${formatFeedWindow(state.feedWindow)} each day.`);
}

function handleFeed() {
  const { state: next, outcome } = applyFeed(state);
  state = next;

  if (!outcome.allowed) {
    showMessage(outcome.message);
    return;
  }

  saveState(state);
  showMessage(outcome.message);
  render();
}

function handleReset() {
  const ok = confirm('Reset all progress? This cannot be undone.');
  if (!ok) return;
  clearState();
  state = null;
  location.reload();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  cacheDom();

  dom.startBtn.addEventListener('click', handleStart);
  dom.feedBtn.addEventListener('click', handleFeed);
  dom.resetBtn.addEventListener('click', handleReset);

  state = loadState();

  if (!state || !state.onboarded) {
    showOnboarding();
    return;
  }

  // New day? Apply missed-day penalties before showing the pet.
  const missed = applyMissedDayIfNeeded(state);
  state = missed.state;
  if (missed.missed) {
    saveState(state);
    showApp();
    showMessage(missed.message);
    return;
  }

  showApp();
}

document.addEventListener('DOMContentLoaded', boot);
