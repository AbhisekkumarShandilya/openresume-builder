# Changelog

## Unreleased (v2)

- Replaced the fixed Experience/Education/Skills layout with an ordered, customizable sections model: add, remove, and reorder whole sections (left nav, with ▲▼ controls and a live item count) and reorder individual entries within a section.
- Added new section types: **Projects**, **Certifications**, and a free-form **Custom Section** (alongside Experience/Education/Skills); section titles are renameable.
- Added the **Resumatic** template (serif, bold header, company/dates + role/location rows, square/circle bullet hierarchy) and made it the default.
- Reworked the Skills editor from a single comma-separated textarea into individual rows with per-skill delete and an "+ Add Skill" button.
- Added a three-tab workspace: **Template** (live-thumbnail gallery to pick a template), **Details** (the section nav + editor + preview), and **Final Preview** (a clean, chrome-free view of the rendered resume).
- Replaced the toolbar's explicit Save button with a **snapshot** system: take a named, timestamped backup at any point, then browse/restore/delete/rename snapshots from a table (with a confirmation warning before restoring, since it overwrites current edits) and a "Clear All Snapshots" action.
- Added a debounced autosave status indicator ("Saving…" / "All changes saved") in the toolbar.
- Moved **Open** and **Save As** into the native **File** menu (Ctrl+O / Ctrl+Shift+S), removed from the toolbar.
- Added a **Settings** (⚙) menu with a "Reset resume to blank" action.
- Reworked the toolbar into two rows and fixed a CSS overflow bug that produced a stray horizontal scrollbar across the whole window.

## 1.1.0

- Added automatic update checking via `electron-updater` — checks GitHub Releases on launch and prompts to download/install when a newer version exists (opt-in dialogs, since builds are unsigned).
- Added Windows portable `.exe` build alongside the NSIS installer.
- Added macOS `.dmg` builds (x64 + arm64) via a GitHub Actions macOS runner, since `electron-builder` can't cross-compile mac targets from Windows. Untested on real Mac hardware so far.
- Upgraded Electron 31 → 42, Vite 5 → 6, and forced `tar` to 7.5.16 (transitive dev dependency), fixing all 27 open Dependabot security alerts. Electron 31 had stopped receiving security backports, which accounted for most of them.
- Enabled Dependabot vulnerability alerts and security updates on the repo.
- Restructured docs: README is now feature-focused with a screenshot; setup/build instructions moved to `DEVELOPMENT.md`.
- Set up the project wiki (Home, Features, Installation, Development, Roadmap pages).

## 1.0.0

- Renamed project to **OpenResume Builder**.
- Fixed Electron main process to run as CommonJS, avoiding a Node/Electron ESM interop bug with the `electron` built-in module.
- Added a launcher script that clears `ELECTRON_RUN_AS_NODE` so the app runs correctly from Electron-based terminals (e.g. VS Code).
- Added autosave: resume data now persists to `localStorage` on every edit and reloads automatically on launch.
- Pushed to GitHub.

## 0.5

- Initial scaffold: Electron + React + Vite app with editor/preview panes, JSON save/load, PDF export, and a stubbed AI hook.
