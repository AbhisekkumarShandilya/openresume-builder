# Test Report

Generated while adding the first automated test suite to this repo (previously zero
automated tests — see the roadmap). Two layers: unit tests for pure logic (Vitest)
and an end-to-end smoke test driving the real Electron app (Playwright).

## How to run

```
npm test          # unit tests (Vitest, jsdom)
npm run test:watch
npm run test:e2e   # e2e smoke test (Playwright + the real Electron app)
```

`test:e2e` launches the actual app (reuses a running `npm run dev` if one is open,
otherwise starts Vite itself) and drives it like a user would. It takes ~15-20s.

## Unit tests — 67/67 passing

| File | What it covers |
|---|---|
| `src/format.test.js` | `renderFormatted` (bold/italic/combo/plain/unpaired-marker/multi-span/empty input), `splitIntroAndBullets` (no blank line, blank-line-with-content, trailing-blank-line no-op, empty input, multi-line intro joining) |
| `src/bulletStyles.test.js` | `normalizeBulletStyle` (legacy `'numbered'` migration, all valid ids passthrough, unknown/null/undefined fallback to `disc`), `isNumbered` |
| `src/data.test.js` | `createSection` (each section type, unique ids, unknown-type throw), `SECTION_TYPES` field-config shape, `normalizeResume` (passthrough, null/undefined, legacy flat-resume migration, partial legacy data, missing personal block) |
| `src/textEditing.test.js` | `detectWrap` (markers outside selection, markers inside selection, `***` vs `**` priority, no false positives, no-marker cases), `applyLineToggle` (promote/demote across the intro/list boundary, multi-line selections, straddling-separator no-op), `toggleLinesBullet` (offset→line-index translation, round-trip promote/demote, out-of-range selection) |
| `src/RichBulletField.test.js` | `buildLineElement` (marker text → DOM: plain/bold/italic/bold+italic/empty-line/multi-span), `lineElementToMarkerText` (DOM → marker text, round-trips with `buildLineElement`, recognizes execCommand's `<b>`/`<i>` not just `<strong>`/`<em>`, drops empty inline elements, detects nested bold+italic either tag order), `getLineElement` (DOM ancestor walk, including through an inline `<strong>`) |

These cover every pure function in the codebase that doesn't require a live DOM
event loop or React rendering — the parts most likely to silently regress (this
session alone fixed two real bugs in this exact logic: the bold/italic placeholder
corruption, and now the marker-hiding rewrite).

One test failure was caught and fixed *during* writing the suite, not before: my
first assertion for `applyLineToggle`'s "demote the only intro line" case assumed
demoting would delete the line; the actual (correct) behavior keeps it as an
ordinary list line and just removes the separator. The test was wrong, not the
code — fixed the test.

## E2E smoke test — 19/19 passing

Drives the real Electron app via Playwright (`_electron`), reusing the verification
workflow established earlier this session, now made permanent in `e2e/smoke.mjs`
instead of being written/deleted per-task.

Covers: personal field → live preview sync; the new Experience rich-text bullet
field (contenteditable, bold/italic hide markers, survives into the preview as
real `<strong>`); the no-selection-Bold-is-now-a-no-op regression check; Enter
creating a new bullet line; Ctrl+] indent; the ¶ paragraph-toggle button; Skills
+Add/delete/bold (and confirms no leftover chip/pill styling); Custom Section's
single-line-vs-multi-line bulleted-list rendering; and a check that zero uncaught
page errors occurred during the whole run.

**Found and fixed one real bug while writing this**: `firstWindow()` non-
deterministically grabbed the auto-opened DevTools window instead of the app
window in dev mode, causing every selector lookup afterward to fail. This wasn't
an app bug, but it was the source of most of the "flaky" verification runs earlier
in this session — worth knowing if `test:e2e` ever looks flaky again. The fix
(retry until the window URL isn't `devtools://`) is now baked into the script.

## What is NOT covered

Being explicit about this rather than overclaiming:

- **Electron main process / IPC** (`electron/main.cjs`, save/load/export-PDF
  dialogs, auto-update checking) — none of this is exercised by either suite.
- **PDF export** — not tested at all (no way to inspect PDF output cheaply).
- **AI stub** (`src/ai.js`) — does nothing yet, nothing to test.
- **Drag/reorder UI, snapshots, settings popover, template gallery** — exist and
  work (manually verified across earlier sessions per project memory) but have
  no automated coverage yet.
- **Cross-platform behavior** (Linux AppImage, macOS dmg) — only verified
  manually (WSL2/Ubuntu, per a prior session); not part of this automated suite.
- **Visual regression** — no screenshot/pixel-diff testing; layout/CSS bugs
  wouldn't be caught here unless they also break a DOM-structure assertion.
- The e2e suite is a single linear script, not `@playwright/test` — no parallel
  workers, no built-in HTML report, no retries. Chosen to match the project's
  existing throwaway-script pattern rather than introduce a second test runner;
  worth reconsidering if the suite grows much larger.

## Files added

- `vitest.config.js`, `src/*.test.js` (5 files, 67 tests)
- `e2e/smoke.mjs` (19 checks)
- `src/textEditing.js` — extracted `detectWrap`/`applyLineToggle`/`toggleLinesBullet`
  out of `Editor.jsx` (was a React component file with no exports) purely so this
  logic is importable in isolation for unit testing. No behavior change — `Editor.jsx`
  now imports from it instead of defining it locally.
- `package.json` — added `test`, `test:watch`, `test:e2e` scripts; `vitest`,
  `jsdom`, `playwright-core` as devDependencies (the latter was previously
  installed/uninstalled per-task — now permanent since there's a real suite to run).
