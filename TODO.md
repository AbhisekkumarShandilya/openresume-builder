# TODO / Roadmap

## UI
- [ ] Improve overall visual design (spacing, typography, colors)
- [ ] Add more resume templates beyond Classic/Modern
- [ ] Dark mode
- [ ] Drag-and-drop reordering of experience/education entries
- [ ] Visual "saved" indicator for autosave

## Functionality
- [ ] Increase functionality: add sections for projects, certifications, languages, links
- [ ] Multiple saved resumes / profile switching (not just single autosave slot)
- [ ] Export to DOCX and plain text, not just PDF
- [ ] Spell-check / grammar check on text fields
- [ ] Undo/redo for edits

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
- [ ] Winget (command-line install on Windows) — manifest PR in progress
- [ ] Chocolatey — needs a chocolatey.org account + API key to push the package, stricter moderation than winget
- [ ] Snap Store (command-line install on Linux, `snap install`)
- [ ] Keep the winget manifest's version/hash updated on every future release
