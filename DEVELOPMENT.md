# Development

## Prerequisites

Install **Node.js** (LTS, v18 or newer) from https://nodejs.org. This gives you `node` and `npm`.

Check it's installed:

```bash
node -v
npm -v
```

On Windows, also have **Git** (optional, for version control) and a code editor like **VS Code**.

## Setup

```bash
npm install
```

## Run in development (hot reload)

```bash
npm run dev
```

This starts Vite and opens the Electron app pointing at it. Edits to React files refresh live.

## Run the production build locally

```bash
npm start
```

## Package installers (.exe / .dmg / AppImage)

```bash
npm run dist
```

Output lands in the `release/` folder. On Windows you'll get an NSIS installer and a portable `.exe`. macOS `.dmg` builds can't be cross-compiled from Windows/Linux — see `.github/workflows/build-mac.yml`, which builds it on a GitHub Actions macOS runner instead.

## Releasing a new version (for auto-update to work)

The app checks GitHub Releases on startup via `electron-updater`. For that to detect a new version, every release must include the `.yml` metadata file alongside the installer, not just the installer itself:

- Windows: upload `release/latest.yml` together with the `Setup.exe`
- macOS: upload `release/latest-mac.yml` together with the `.dmg` (the mac workflow does this automatically)

If you bump the version and only upload the installer without its `.yml`, existing installs won't see the update.

## Versioning

`MAJOR.MINOR.PATCH`, trailing zero segments dropped in anything user-facing:

- **Major** release: `1.0`, `2.0`, `3.0`, ...
- **Significant update**: `1.1`, `1.2`, ...
- **Bug-fix only**: third segment, e.g. `1.0.1`, `1.0.2`, ... `1.0.156`.
- **Beta**: always the literal word "beta" plus a number, naming the release it's leading up to — `2.2 beta 1`, `2.2 beta 2`, ... so a beta is never confused with a maintenance/patch release that happens to share a number.

`package.json`'s `version` field still has to be strict semver for npm/electron-builder/electron-updater (3 numeric segments, optional `-beta.N` suffix) — e.g. `2.2.0`, `2.2.0-beta.1`, `1.0.1`. `formatVersion()` in `src/version.js` converts that internal string to the friendly display form above; it's what the in-app Settings popover and GitHub release titles use. Git tags and `package.json` stay semver as-is — only what's *shown to users* (Settings, release titles) follows the friendly format.

## Project structure

```
electron/
  main.cjs      Electron main process — window, file save/load, PDF export
  preload.cjs   Safe bridge between UI and file system
src/
  main.jsx      React entry
  App.jsx       Layout, toolbar, state
  Editor.jsx    Left-side form
  Preview.jsx   Right-side live resume render (2 templates)
  data.js       The resume JSON model
  ai.js         AI stub — fill in later
  styles.css    All styling + print rules
```

## Adding AI later

See the comments in `src/ai.js`. The key rule: do the actual API call in
`electron/main.cjs` (the main process) so your API key is never exposed in the
UI. Expose it through `preload.cjs` the same way save/load/export work, then
call it from `ai.js`.
