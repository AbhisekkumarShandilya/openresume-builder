# Changelog

## 2.2.0-beta.1

- Added a real WYSIWYG editor for the Experience description: bold/italic render for real, with no visible `**`/`*` markers while typing, instead of the old textarea showing raw markup. Also applied to the Custom Section field and to each Skill row. Under the hood it still stores the same marker-string format the preview already parsed, so no data migration was needed.
- Fixed a bug where clicking Bold/Italic with nothing selected inserted a literal `**text**` placeholder that got permanently stuck in the field once un-toggled, corrupting saved bullets over repeated use — it's now a no-op when there's no selection and no existing markup to toggle.
- The "¶" (move line into/out of the bulleted list) button and the bullet/numbering style picker now work in the new WYSIWYG fields too, not just the older plain-textarea ones.
- Redesigned Skills editing as add/delete rows (each skill its own field with a × button, "+ Add Skill" to append), and changed how skills render in the preview from pill/chip boxes to stacked lines — better suited to longer "**Category:** comma, separated, items" entries.
- Added a month/year date picker for Start/End fields (Experience, Education, Projects): click the field or its 📅 button for a `‹ Year ›` navigator and a month grid, with a "Present" quick-pick for End fields. Future dates are blocked based on the real system clock. The field is still plain text underneath, so existing free-text dates ("2022", "Present", anything custom) keep working.
- Fixed a pre-existing bug in the Resumatic template where Education entries showed only the end date ("2018") instead of the full range ("2015 – 2018") — Experience and Projects, and the Classic/Modern templates' Education, were already correct.
- Added the installed version number and a manual "Check for Updates" button to Settings — previously only the silent on-launch check existed, with no UI for "you're already up to date" or "the check failed".
- Refactored Experience/Education/Projects/Certifications to share one generic field-config-driven card renderer instead of four near-duplicate JSX blocks, making future field additions (like the date picker above) a data-only change.
- Added the project's first automated test suite: Vitest unit tests for the pure logic (text formatting, bullet styles, resume data migration, list-toggle math, rich-field DOM helpers) and a Playwright e2e smoke test driving the real Electron app end to end.

## 2.1.0

- Added autocomplete suggestions (a native `<datalist>` dropdown) for Title, Role, Skill, and Degree fields, seeded from a curated list of common job titles, skills, and degrees.
- Added real spellcheck-based autocorrect: Electron's spellchecker wasn't wired up at all before, so misspellings had no underline and right-clicking did nothing. Now misspelled words get the usual red underline, and right-clicking offers correction suggestions, "Add to Dictionary", and Cut/Copy/Paste.
- Replaced the bulleted-vs-numbered toggle with a full list-style picker (bullets: •, ○, ▪, –; numbering: 1., a., A., i., I.), matching a Word/LibreOffice-style gallery.
- Added support for an intro sentence before a field's list: a blank line before your points turns everything above it into plain text instead of a bullet, and a new "¶" toolbar button lets you pull a highlighted line into or out of the list directly.
- A field with exactly one point now renders as plain text instead of a single, oddly lonely bullet.
- Bold and Italic now combine correctly when both are applied to the same selection (yielding real bold+italic) and toggle off independently when re-applied — previously, applying one after the other (or re-applying the same one) corrupted the text with stray or duplicated asterisks.
- Tab/Shift+Tab now move focus to the next/previous field like any normal input, instead of being trapped to indent/outdent a sub-bullet; that indenting moved to Ctrl+]/Ctrl+[.
- Fixed a CSS specificity bug that double-rendered numbered list markers (e.g. "1. 1.") in the Resumatic template.
- Fixed a bug where pressing Enter after your last point (to type a new one) left a trailing blank line that collapsed the entire list into one merged line with no bullets.
- Bullet/list fields now show a distinct teal outline when focused, instead of the default ring, so they're recognizable as list fields at a glance.

## 2.0.0

- Replaced the fixed Experience/Education/Skills layout with an ordered, customizable sections model: add, remove, and reorder whole sections (left nav, with ▲▼ controls and a live item count) and reorder individual entries within a section.
- Added new section types: **Projects**, **Certifications**, and a free-form **Custom Section** (alongside Experience/Education/Skills); section titles are renameable.
- Added the **Resumatic** template (serif, bold header, company/dates + role/location rows, square/circle bullet hierarchy) and made it the default.
- Reworked the Skills editor from a single comma-separated textarea into individual rows with per-skill delete and an "+ Add Skill" button.
- Added a three-tab workspace: **Template** (live-thumbnail gallery to pick a template), **Details** (the section nav + editor + preview), and **Final Preview** (a clean, chrome-free view of the rendered resume).
- Replaced the toolbar's explicit Save button with a **snapshot** system: take a named, timestamped backup at any point, then browse/restore/delete/rename snapshots from a table (with a confirmation warning before restoring, since it overwrites current edits) and a "Clear All Snapshots" action.
- Added a debounced autosave status indicator ("Saving…" / "All changes saved") in the toolbar.
- Moved **Open** and **Save As** into the native **File** menu (Ctrl+O / Ctrl+Shift+S), removed from the toolbar.
- Added a **Settings** (⚙) menu with a "Reset resume to blank" action.
- Reworked the toolbar into two rows: a top row with Settings (far left) and a single centered pill grouping the Template/Details/Final Preview tabs with Export PDF, and a bottom row with Make Snapshot/Snapshot Restore (left), the autosave status, and Improve with AI (right). Also fixed a CSS overflow bug that produced a stray horizontal scrollbar across the whole window, and fixed the Settings popover getting clipped off the right edge of the window.
- Added basic text formatting: a Bold/Italic toolbar in the editor that wraps selected text with `**bold**`/`*italic*` markup, rendered as actual bold/italic in the Summary and bullet points on the resume preview.
- Added a "1." toolbar button to switch a focused bullet list (per entry, or per custom section) between the default bulleted style and a numbered (1, 2, 3…) style.
- Made bullet list fields behave more like Word/LibreOffice: Tab/Shift+Tab indents/outdents the current line into a sub-bullet, Enter continues the list at the same indent level (instead of resetting to top-level), an empty indented line outdents on Enter instead of nesting deeper, and Backspace at the start of an indented line's text outdents it. Also fixed a bug where pressing Enter to start a brand-new bullet could silently swallow the newline.
- Fixed a stale-state bug where clicking Bold/Italic/"1." in the format toolbar after typing for a while (without re-focusing the field) could revert that field to its older content — the toolbar's stored update functions now always read the latest resume state instead of the snapshot from when the field was focused.

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
