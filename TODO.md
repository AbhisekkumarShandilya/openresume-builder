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
- [ ] Spell-check / grammar check on text fields
- [ ] Undo/redo for edits (snapshots are a coarser-grained alternative)

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
- [ ] Verify the Linux AppImage actually runs correctly on a real Linux machine — currently untested
- [ ] Android app via Capacitor (wraps the existing React/Vite build; Electron file I/O needs swapping for Capacitor Filesystem/Share plugins)

## Other
- [ ] Automated tests (component tests for Editor/Preview, at minimum)
- [ ] CI workflow for Windows builds + lint on push (mac and Linux build CI already exist)
- [ ] Internationalization (i18n) for multi-language resumes

## Distribution
- [x] Winget manifest submitted: https://github.com/microsoft/winget-pkgs/pull/391215
- [ ] `winget install` from the local manifest currently fails on a generic internal error during winget's own pre-install Mark-of-the-Web step (not our installer — that was verified working directly, `/S` exits 0 and registers correctly). Most likely caused by zero SmartScreen reputation on an unsigned binary; revisit if it still fails once the file has been out for a while, or once code-signed
- [ ] Code-signing certificate would likely fix the SmartScreen/MOTW issue above, and removes the "unidentified developer" warnings on Windows generally — costs money, lower priority for a free hobby project
- [ ] Chocolatey — needs a chocolatey.org account + API key to push the package, stricter moderation than winget
- [ ] Snap Store (command-line install on Linux, `snap install`)
- [ ] Keep the winget manifest's version/hash updated on every future release
