import { defineConfig } from 'vite';

// Bundles src/ so Capacitor plugins (Preferences) work on iOS/Android.
export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
