# SiteMind AI Assistant

## Offline / PWA

This app is configured as a PWA using `next-pwa`.

### Test Offline
1. Run a production build:
   ```bash
   npm run build
   npm run start
   ```
2. Open the app in Chrome/Safari.
3. Load a few pages to warm the cache.
4. Go offline in DevTools (or disable network) and refresh.

You should still see the app shell, and previously visited pages should load. If a route hasn’t been cached yet, you’ll see the offline fallback page.
