# TODO / Roadmap

Ordered by priority for a solo, free, open-source workflow. Parked items
(need hardware or a different scale of effort) live at the bottom.

## Next up (in order)

1. [ ] Undo/redo for edits — the resume is one JSON object, so a past/future stack around `setResume` covers most of it (snapshots stay as the coarse-grained fallback)
2. [ ] Export to DOCX and plain text, not just PDF — job portals demand .docx; `docx` npm package in the renderer, TXT nearly free once a serializer exists
3. [ ] Multiple saved resumes / named profile switching — tailoring per job is the core workflow; snapshots already prove the storage pattern
4. [ ] Dark mode — CSS-variable pass over `styles.css`
5. [ ] Dedicated languages/links fields — `SECTION_TYPES` in `src/data.js` makes new sections nearly declarative

## Also planned

- [ ] Page-break handling in PDF export — avoid slicing a bullet/heading at the page boundary (`break-inside: avoid` pass + a page-boundary indicator in the preview)
- [ ] JSON Resume (jsonresume.org) import/export — interop with the wider ecosystem; mapping to/from the existing format
- [ ] Backup/restore all app data to a file — everything lives in localStorage today; one corrupted profile loses everything
- [ ] Keyboard shortcuts (GitHub issue #5)
- [ ] `.json` file association — double-clicking a saved resume opens the app with it loaded (electron-builder config + `open-file`/argv handling)
- [ ] Validate/sanitize resume data on file open — `normalizeResume` currently trusts any object with a `sections` array; a malformed file can crash the render
- [ ] Improve overall visual design (spacing, typography, colors)
- [ ] Keep the winget manifest's version/hash updated on every future release (automate eventually)

## Done

- [x] Add more resume templates beyond Classic/Modern (Resumatic added, with a template gallery picker)
- [x] Reordering of experience/education/etc. entries (▲▼ controls, not drag-and-drop)
- [x] Visual "saved" indicator for autosave
- [x] Increase functionality: add sections for projects, certifications, custom
- [x] Spell-check / grammar check on text fields — native spellcheck underlines + right-click correction suggestions; autocomplete dropdowns for Title/Role/Skill/Degree
- [x] Basic rich text formatting in Summary/bullet fields — bold/italic markup (combinable), a Word/LibreOffice-style bullet & numbering picker, intro-sentence-before-list support, Word-style list editing (Ctrl+]/Ctrl+[ to indent, Enter continues the list at the same level)
- [x] Portable Windows .exe build alongside the NSIS installer
- [x] macOS .dmg built via GitHub Actions macOS runner (x64 + arm64)
- [x] Build and publish the Linux AppImage via GitHub Actions ubuntu-latest runner
- [x] Verify the Linux AppImage actually runs correctly on a real Linux machine — tested on WSL2 (Ubuntu 26.04, real Linux kernel) via WSLg, full UI renders and works correctly. Needs these system libs on a fresh box (not bundled in the AppImage): `libfuse2t64` (FUSE, required to mount any AppImage), `libnss3`, `libnspr4`, `libatk1.0-0t64`, `libatk-bridge2.0-0t64`, `libcups2t64`, `libdrm2`, `libxkbcommon0`, `libxcomposite1`, `libxdamage1`, `libxfixes3`, `libxrandr2`, `libgbm1`, `libpango-1.0-0`, `libasound2t64`, `libgtk-3-0t64`
- [x] Automated tests — Vitest unit tests for pure logic (format/bulletStyles/data/textEditing/RichBulletField helpers) plus a Playwright e2e smoke suite (`e2e/smoke.mjs`) driving the real Electron app
- [x] Tests gate every push and every release — CI runs lint + unit + e2e on all branch pushes, and the three release build workflows call the CI suite (`workflow_call`) as a required job, so a broken tag never uploads installers
- [x] Winget manifest submitted: https://github.com/microsoft/winget-pkgs/pull/391215

## Parked (needs hardware or outsized effort)

- [ ] AI integration (currently stubbed in `src/ai.js`): bullet rewriting, generated summary, ATS keyword matching against a pasted job description
- [ ] Code-signing certificate — would fix the SmartScreen/MOTW issue below and remove "unidentified developer" warnings (SignPath Foundation application is the path if ever pursued)
- [ ] `winget install` from the local manifest fails on a generic internal error during winget's pre-install Mark-of-the-Web step (not our installer — verified working directly, `/S` exits 0 and registers correctly). Most likely zero SmartScreen reputation on an unsigned binary; revisit once the file has been out for a while, or once code-signed
- [ ] Chocolatey — needs a chocolatey.org account + API key, stricter moderation than winget
- [ ] Snap Store (command-line install on Linux, `snap install`)
- [ ] Verify the macOS .dmg actually runs correctly on real Mac hardware — currently untested, needs hardware
- [ ] Android app via Capacitor — wraps the existing React/Vite build, but Electron file I/O needs swapping for Capacitor Filesystem/Share plugins; rewrite-scale effort
- [ ] Internationalization (i18n) for multi-language resumes — premature until the feature set stabilizes
