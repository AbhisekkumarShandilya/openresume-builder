# TODO / Roadmap

## UI
- [ ] Improve overall visual design (spacing, typography, colors)
- [x] Add more resume templates beyond Classic/Modern (Resumatic added, with a template gallery picker)
- [ ] Dark mode
- [x] Reordering of experience/education/etc. entries (▲▼ controls, not drag-and-drop)
- [x] Visual "saved" indicator for autosave

## Functionality
- [x] Increase functionality: add sections for projects, certifications, custom — still missing dedicated languages/links fields
- [ ] Multiple saved resumes / profile switching (snapshots now cover backup/restore, but not distinct named profiles)
- [ ] Export to DOCX and plain text, not just PDF
- [x] Spell-check / grammar check on text fields — native spellcheck underlines + right-click correction suggestions; autocomplete dropdowns for Title/Role/Skill/Degree
- [ ] Undo/redo for edits (snapshots are a coarser-grained alternative)
- [x] Basic rich text formatting in Summary/bullet fields — bold/italic markup (combinable), a Word/LibreOffice-style bullet & numbering picker, intro-sentence-before-list support, Word-style list editing (Ctrl+]/Ctrl+[ to indent, Enter continues the list at the same level)

## AI Integration
- [ ] Implement the AI integration feature (currently stubbed in `src/ai.js`)
- [ ] AI-assisted bullet point rewriting ("Improve with AI" button)
- [ ] AI-generated resume summary from job title/experience
- [ ] ATS keyword matching against a pasted job description

## Platforms
- [x] Portable Windows .exe build alongside the NSIS installer
- [x] macOS .dmg built via GitHub Actions macOS runner (x64 + arm64)
- [ ] Verify the macOS .dmg actually runs correctly on real Mac hardware — currently untested
- [x] Build and publish the Linux AppImage via GitHub Actions ubuntu-latest runner
- [x] Verify the Linux AppImage actually runs correctly on a real Linux machine — tested on WSL2 (Ubuntu 26.04, real Linux kernel) via WSLg, full UI renders and works correctly. Needs these system libs on a fresh box (not bundled in the AppImage): `libfuse2t64` (FUSE, required to mount any AppImage), `libnss3`, `libnspr4`, `libatk1.0-0t64`, `libatk-bridge2.0-0t64`, `libcups2t64`, `libdrm2`, `libxkbcommon0`, `libxcomposite1`, `libxdamage1`, `libxfixes3`, `libxrandr2`, `libgbm1`, `libpango-1.0-0`, `libasound2t64`, `libgtk-3-0t64`
- [ ] Android app via Capacitor (wraps the existing React/Vite build; Electron file I/O needs swapping for Capacitor Filesystem/Share plugins)

## Other
- [x] Automated tests — Vitest unit tests for pure logic (format/bulletStyles/data/textEditing/RichBulletField helpers) plus a Playwright e2e smoke suite (`e2e/smoke.mjs`) driving the real Electron app
- [ ] CI workflow for Windows builds + lint on push (mac and Linux build CI already exist) — `npm test`/`npm run test:e2e` aren't wired into CI yet either
- [ ] Internationalization (i18n) for multi-language resumes

## Distribution
- [x] Winget manifest submitted: https://github.com/microsoft/winget-pkgs/pull/391215
- [ ] `winget install` from the local manifest currently fails on a generic internal error during winget's own pre-install Mark-of-the-Web step (not our installer — that was verified working directly, `/S` exits 0 and registers correctly). Most likely caused by zero SmartScreen reputation on an unsigned binary; revisit if it still fails once the file has been out for a while, or once code-signed
- [ ] Code-signing certificate would likely fix the SmartScreen/MOTW issue above, and removes the "unidentified developer" warnings on Windows generally — costs money, lower priority for a free hobby project
- [ ] Chocolatey — needs a chocolatey.org account + API key to push the package, stricter moderation than winget
- [ ] Snap Store (command-line install on Linux, `snap install`)
- [ ] Keep the winget manifest's version/hash updated on every future release
