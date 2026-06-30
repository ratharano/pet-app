# Sanctuary Pet

A lightweight mobile habit tracker: feed your digital pet **on time** and watch it grow (EGG → BABY → ADULT).

**V1 only** — no backend, no React/Vue, no game economy. Plain HTML + CSS + JavaScript in `src/`.

## Folder structure

```
src/
├── index.html   ← UI
├── style.css    ← Cozy mobile styles
├── app.js       ← DOM / buttons
├── state.js     ← localStorage + JSON shape
└── logic.js     ← Feed window rules & stats
```

## Terminal setup

Run from the project folder:

```bash
# 1. Go to the project
cd path/to/pet-app

# 2. Create package.json and install Capacitor (skip if already done)
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

# 3. Tell Capacitor your web files live in src/
npx cap init "Sanctuary Pet" com.sanctuarypet.app --web-dir src

# 4. Add native projects
npx cap add ios
npx cap add android

# 5. After editing src/, copy files into native apps
npx cap sync
```

### Preview in browser

```bash
npm install
npm start
```

Open **http://localhost:3000** (uses Vite — required so Capacitor plugins load).

Do **not** open `src/index.html` directly in the browser (file://) or use a plain static server on `src/` — imports will fail.

Before syncing to iOS/Android, build the web app:

```bash
npm run build
npx cap sync
```

### Open native IDEs

```bash
npx cap open ios      # needs Xcode + CocoaPods on Mac
npx cap open android  # needs Android Studio
```

## V1 rules (`logic.js`)

| Action | Health | Happiness | Streak |
|--------|--------|-----------|--------|
| Fed **inside** window | +10 | +15 | +1 |
| Fed **late** same day | no change | −15 | unchanged |
| **Missed** yesterday (on open) | −25 | −30 | reset → 0 |

Evolution: **EGG** → **BABY** (7-day on-time streak) → **ADULT** (30 days).

## Save data

Stored with `@capacitor/preferences` under key `sanctuary_pet_v1` (UserDefaults on iOS, SharedPreferences on Android). In the browser dev server, Preferences uses localStorage as a fallback.
