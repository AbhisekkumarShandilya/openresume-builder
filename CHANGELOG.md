# Changelog

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
