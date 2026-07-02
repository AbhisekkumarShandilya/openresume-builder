# TODO / Roadmap

Ordered by priority for a solo, free, open-source workflow. Parked items
(need hardware or a different scale of effort) live at the bottom.

## Next up (in order)

_All the recent additive features are shipped — the next queue items are under "Also planned" below (Page-break handling in PDF export is the natural next pick)._

## Versioning plan

- Stay on 2.x for now — upcoming features (undo/redo, DOCX/TXT export, dark mode) are additive, so they ship as 2.3, 2.4, … with beta-N prereleases as usual
- [ ] Reserve v3.0 for the milestone that changes the data model / how the app is used: named resume profiles + JSON Resume import/export + backup/restore landing together
- Don't burn the major number on a feature release; it's the "something big changed" signal (and winget/auto-updater don't care about the number)

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
- [x] Undo/redo for edits — past/future history around the resume state (`src/history.js` + `useHistory` hook), Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z plus ↶/↷ toolbar buttons; rapid edits within 600ms coalesce into one undo step so undo rewinds a typing burst, not a keystroke
- [x] Export to DOCX and plain text, not just PDF — Export ▾ dropdown offers PDF / Word (.docx) / plain text (.txt). Shared `docx` package in the renderer; markup maps to real bold/italic runs and the bullet & numbering picker maps to real Word numbering definitions (not literal "•"). One format-agnostic export model (`src/exportModel.js`) feeds both the DOCX (`src/docxExport.js`) and TXT (`src/textExport.js`) serializers so they stay in step with the preview. Consistent `{Name} — Resume.ext` filename; remembers last export dir within the session
- [x] Winget manifest submitted: https://github.com/microsoft/winget-pkgs/pull/391215
- [x] Multiple saved resumes / named profile switching — profiles index (`resume-builder:profiles`) + one body key + one snapshots key per profile (`src/profiles.js`); idempotent, verify-before-delete migration off the legacy single-resume key; toolbar switcher with New / Duplicate ("Copy of X") / Rename / Delete (drops an insurance snapshot); undo stack + snapshots + autosave are per-profile and switching clears the undo stack. Migration and CRUD unit-tested (`src/profiles.test.js`) and the full flow verified in the real Electron app. Ships behind the scenes on 2.x; the v3.0 milestone (with JSON Resume import/export + backup/restore) is when it's *released*
- [x] Dark mode — full CSS-variable tokenization of `styles.css` (`:root` light defaults + one `[data-theme="dark"]` override); three-way System / Light / Dark setting (`src/theme.js`, app-level in localStorage under `resume-builder:theme`, defaults to System via `prefers-color-scheme` and re-applies on OS change) picked in the Settings popover; `nativeTheme.themeSource` set in main over a `set-theme` IPC so Electron chrome follows; index.html applies the saved theme before first paint (no white flash); the resume preview stays paper-white and is reframed via `--paper-shadow` on the dark backdrop. Scrollbars/focus rings/popovers/inputs/disabled states/the "saved" indicator all themed; `src/theme.test.js` unit tests + a dark-mode e2e block verify it in the real app. Also the tokenization groundwork for the "improve visual design" item
- [x] Dedicated languages/links fields — two new declarative `SECTION_TYPES` (`src/data.js`). Languages: `{ language, proficiency }` with proficiency free-text + autocomplete (Native/Fluent/Professional/Conversational/Basic + CEFR A1–C2), rendered compactly inline (`English (Native) · German (B2)`). Links: `{ label, url }` — the label shows and the URL is a real clickable anchor in the preview/PDF and a `docx` `ExternalHyperlink` in Word; TXT prints `Label: url`. Light validation only (`src/contactFields.js` prepends `https://` when a scheme is missing and shows a non-blocking "doesn't look like a URL" hint). Both addable/reorderable and render in all three templates. Placement decision: shipped as a reorderable **body section** (the header already carries `website`), keeping the uniform section model. Pure helpers unit-tested (`src/contactFields.test.js`) + export tests + an e2e block; DOCX hyperlink relationships verified by unzip

## Parked (needs hardware or outsized effort)

- [ ] AI integration (currently stubbed in `src/ai.js`): bullet rewriting, generated summary, ATS keyword matching against a pasted job description
- [ ] Code-signing certificate — would fix the SmartScreen/MOTW issue below and remove "unidentified developer" warnings (SignPath Foundation application is the path if ever pursued)
- [ ] `winget install` from the local manifest fails on a generic internal error during winget's pre-install Mark-of-the-Web step (not our installer — verified working directly, `/S` exits 0 and registers correctly). Most likely zero SmartScreen reputation on an unsigned binary; revisit once the file has been out for a while, or once code-signed
- [ ] Chocolatey — needs a chocolatey.org account + API key, stricter moderation than winget
- [ ] Snap Store (command-line install on Linux, `snap install`)
- [ ] Verify the macOS .dmg actually runs correctly on real Mac hardware — currently untested, needs hardware
- [ ] Android app via Capacitor — wraps the existing React/Vite build, but Electron file I/O needs swapping for Capacitor Filesystem/Share plugins; rewrite-scale effort
- [ ] Internationalization (i18n) for multi-language resumes — premature until the feature set stabilizes
