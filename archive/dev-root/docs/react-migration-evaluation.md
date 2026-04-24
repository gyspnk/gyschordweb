# React Migration Evaluation (April 2026)

## Summary
- React shell migration is implemented and production-active via Vite output to `docs/`.
- Existing traditional JavaScript runtime remains behavior authority to preserve all current features.
- Tailwind integration is already seamless (`docs/css/tailwind.css` kept as runtime stylesheet).
- Vue integration is **not applicable** in this codebase (no Vue runtime/dependencies/components detected).

## Current Architecture
- React entry and bundling:
  - `index.html` (Vite source entry)
  - `src/main.jsx`
  - `src/App.jsx`
  - `vite.config.mjs`
- Legacy runtime compatibility bridge:
  - `src/legacy/bootstrapLegacyRuntime.js`
  - `src/templates/app-shell.html`
- Legacy runtime bundle still powers all features:
  - `docs/js/app.bundle.min.js`

## What Can Be Migrated Next (Safest Order)
1. Navigation and page routing state
- Candidate from: `docs/js/app-core.js` (`navigateTo`, page rendering switches)
- React target: route + state container, controlled scroll restoration
- Risk: low (UI orchestration mostly isolated)

2. Playlist rendering + controls
- Candidate from: `docs/js/playlist-core.js`
- React target: playlist list/detail components + localStorage adapter
- Risk: medium (touches many click handlers)

3. Settings panel rendering
- Candidate from: `docs/js/ui-core.js` + HTML template fragments
- React target: controlled form components with persisted preferences
- Risk: medium

4. PDF viewer container and controls
- Candidate from: `docs/js/viewer-core.js`
- React target: viewer shell + control bar components first, then render pipeline
- Risk: high (complex gesture/zoom math + canvas lifecycle)

5. MIDI panel and transport UI
- Candidate from: `docs/js/midi-engine.js` + player UI hooks
- React target: thin UI adapters first, engine internals later
- Risk: high (timing-sensitive playback state)

## Performance/Loading Improvements Already Applied
- Production minification for:
  - `docs/js/app.bundle.min.js`
  - `docs/js/midi-render-worker.min.js`
  - `docs/sw.min.js`
  - `docs/css/tailwind.css`
- React chunk splitting in `docs/web/`.
- Service worker registration deferred in legacy bootstrap path.
- External dependency warm-up hints in source entry (`preconnect` + worker `prefetch`).

## Seamless Compatibility Rules (Maintained)
- Keep existing DOM IDs/classes until each feature is fully migrated.
- Keep `docs/js/app.bundle.min.js` loaded through the bridge until replacement parity is proven.
- Preserve all localStorage keys and data formats to avoid user-state breakage.
- Run `_test_temp/verify.mjs` after each migration slice.

## Suggested Naming/Folder Convention Going Forward
- React runtime source: `src/<feature>/...`
- Legacy bridge-only files: `src/legacy/...`
- Production artifacts remain in `docs/` for static hosting.
- Archived historical scripts stay in `archive/`.

## Validation Baseline
- Build pipeline: pass (`npm run build`)
- Regression suite: pass (`node _test_temp/verify.mjs`)
- Browser bug checks (playlist scroll inheritance): pass in Playwright MCP + Chrome MCP evaluators
