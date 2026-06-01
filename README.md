# PetHabit

Lightweight mobile habit tracker: feed your digital pet **on time** and watch it grow.

## Project layout

```
pet-app/
├── src/                 ← Web app (Capacitor copies this to native builds)
│   ├── index.html       ← Structure
│   ├── style.css        ← Look and feel
│   ├── app.js           ← Buttons, bars, screens
│   ├── state.js         ← Save/load JSON from Local Storage
│   └── logic.js         ← Feed window rules, health, happiness, streak
├── capacitor.config.json
└── package.json
```

The old single-file `index.html` in the repo root is the previous prototype. **Use `src/` going forward.**

## Terminal setup (run once)

From the project folder:

```bash
cd /Users/ratha/Downloads/pet-app

# 1. Install Node dependencies
npm install

# 2. Capacitor is already configured (webDir: src).
#    Add native platforms:
npx cap add ios
npx cap add android

# 3. After you change any file in src/, sync to native projects:
npx cap sync
```

### Preview in the browser

```bash
npm start
```

Open http://localhost:3000

### Open in Xcode / Android Studio

```bash
npx cap open ios
# or
npx cap open android
```

You need Xcode (Mac) for iOS and Android Studio for Android installed on your machine.

## V1 rules (see `src/logic.js`)

| Action | Health | Happiness | Streak |
|--------|--------|-----------|--------|
| Fed **inside** window (e.g. 7–9 AM) | +10 | +15 | +1 |
| Fed **late** (same day, outside window) | no change | −15 | no change |
| **Missed** yesterday entirely | −25 | −30 | reset to 0 |

Growth: **Egg** → **Baby** (7-day streak) → **Adult** (30-day streak).

## Data shape (`src/state.js`)

Saved under Local Storage key `pethabit_v2` as JSON.
