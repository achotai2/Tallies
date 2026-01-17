# Tree Tally (Offline-first PWA)

A minimal, extensible offline-first PWA foundation for a tree planting tally app. It uses **Vite + TypeScript** with a tiny UI and stores data locally in **IndexedDB** via [Dexie](https://dexie.org/) (small, well-supported wrapper).

## Requirements
- Node.js 18+

## Setup
```bash
npm install
npm run dev
```

## Offline testing
1. Run the app once online to allow the service worker to cache the app shell.
2. Open Chrome DevTools → **Application** → **Service Workers** to confirm it is registered.
3. Go to **Network** → toggle **Offline**.
4. Refresh the page. The app should load from the cache and continue to work offline.

### iOS notes
- Add the app to the Home Screen from Safari to run it in standalone mode.
- Safari will cache the app shell after the first load; re-open it offline to confirm.

## Configuration
- **API base URL** lives in `src/api/config.ts` and reads from `VITE_API_BASE_URL`.
  - Example: `VITE_API_BASE_URL=https://api.example.com npm run dev`

## Local DB + sync overview
- Tallies are stored locally in IndexedDB with a `sync_status` of `pending`, `synced`, or `error`.
- The sync engine posts batches to `POST ${API_BASE_URL}/tallies/batch` with payload `{ tallies: [...] }`.
- If the network is offline, sync exits cleanly. Failures mark each tally with `sync_status='error'` and keep the data locally.
- Use the **Sync now** button to retry uploads.

## Project structure
```
src/
  app/           # app bootstrap
  db/            # IndexedDB schema + CRUD
  api/           # network layer
  sync/          # sync engine
  features/
    tallies/     # tally domain types + helpers
  ui/            # UI helpers
```
