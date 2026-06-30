/**
 * ============================================================================
 * app.js — UI layer (connects HTML to state.js + logic.js)
 * ============================================================================
 *
 * Storage is ASYNC (Capacitor Preferences). Any time we load or save,
 * we use await:
 *
 *   state = await loadState();
 *   await saveState(state);
 *
 * boot(), handleStart(), handleFeed(), and handleReset() are all async.
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
  formatStage,
  getPetMoodSummary,
  isWithinFeedWindow,
} from './logic.js';

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

/** In-memory copy of the save (synced with Preferences via saveState) */
let state = null;

// -----------------------------------------------------------------------------
// UI helpers
// -----------------------------------------------------------------------------

function setBar(fillEl, valueEl, value) {
  const v = Math.round(value);
  fillEl.style.width = `${v}%`;
  valueEl.textContent = String(v);
}

function pickPetEmoji(stage, mood) {
  if (mood === 'critical') return '💔';
  if (stage === 'adult') return '🦊';
  if (stage === 'baby') return '🐣';
  return '🥚';
}

function render() {
  if (!state) return;

  dom.petNameDisplay.textContent = state.petName;
  dom.stageLabel.textContent = formatStage(state.stage);
  dom.streakCount.textContent = String(state.streak);
  dom.windowLabel.textContent = formatFeedWindow(state.feedWindow);

  setBar(dom.healthBar, dom.healthValue, state.health);
  setBar(dom.happinessBar, dom.happinessValue, state.happiness);

  const mood = getPetMoodSummary(state);
  dom.petEmoji.textContent = pickPetEmoji(state.stage, mood);

  const now = new Date();
  const today = todayDateString(now);
  const inWindow = isWithinFeedWindow(now, state.feedWindow);
  const fedToday = state.lastFedDate === today;

  if (fedToday) {
    dom.feedBtn.disabled = true;
    dom.feedBtn.textContent = 'Fed today ✓';
  } else {
    dom.feedBtn.disabled = false;
    dom.feedBtn.textContent = inWindow ? 'Feed (on time)' : 'Feed (late)';
  }
}

function showMessage(text) {
  dom.statusMessage.textContent = text || '';
}

function showOnboarding() {
  dom.onboarding.hidden = false;
  dom.app.hidden = true;
}

function showApp() {
  dom.onboarding.hidden = true;
  dom.app.hidden = false;
  render();
}

/** Prevent double-taps while an async save is running */
function setButtonsBusy(busy) {
  dom.feedBtn.disabled = busy;
  dom.startBtn.disabled = busy;
}

// -----------------------------------------------------------------------------
// Async button handlers
// -----------------------------------------------------------------------------

async function handleStart() {
  const name = dom.petNameInput.value.trim();
  if (!name) {
    dom.petNameInput.focus();
    return;
  }

  setButtonsBusy(true);

  try {
    state = createDefaultState(name);
    state.onboarded = true;
    await saveState(state);

    const check = applyMissedDayIfNeeded(state);
    state = check.state;
    await saveState(state);

    showApp();
    showMessage(
      `Welcome to the sanctuary. Feed ${state.petName} between ${formatFeedWindow(state.feedWindow)}.`
    );
  } finally {
    setButtonsBusy(false);
    render();
  }
}

async function handleFeed() {
  setButtonsBusy(true);

  try {
    const { state: next, outcome } = applyFeed(state);
    state = next;

    if (!outcome.allowed) {
      showMessage(outcome.message);
      return;
    }

    await saveState(state);
    showMessage(outcome.message);
    render();
  } finally {
    setButtonsBusy(false);
    render();
  }
}

async function handleReset() {
  const ok = confirm('Reset all progress? Your pet will start over.');
  if (!ok) return;

  await clearState();
  location.reload();
}

// -----------------------------------------------------------------------------
// Async boot — wait for save BEFORE showing pet or checking missed days
// -----------------------------------------------------------------------------

async function boot() {
  cacheDom();

  dom.startBtn.addEventListener('click', () => {
    handleStart().catch((err) => console.error('Start failed:', err));
  });
  dom.feedBtn.addEventListener('click', () => {
    handleFeed().catch((err) => console.error('Feed failed:', err));
  });
  dom.resetBtn.addEventListener('click', () => {
    handleReset().catch((err) => console.error('Reset failed:', err));
  });

  // 1. Load save from native Preferences (must await!)
  state = await loadState();

  // 2. New player → welcome screen
  if (!state || !state.onboarded) {
    showOnboarding();
    return;
  }

  // 3. Returning player → check missed days, then show pet
  const check = applyMissedDayIfNeeded(state);
  state = check.state;

  if (check.missed) {
    await saveState(state);
    showApp();
    showMessage(check.message);
    return;
  }

  await saveState(state);
  showApp();
}

function showBootError(message) {
  const banner = document.getElementById('loadError');
  if (banner) {
    banner.hidden = false;
    banner.textContent = message;
  }
  console.error(message);
}

document.addEventListener('DOMContentLoaded', () => {
  boot().catch((err) => {
    console.error('App failed to start:', err);
    cacheDom();
    showBootError(
      'App could not start. Run npm start and open http://localhost:3000 (not src/index.html).'
    );
    showOnboarding();
  });
});
