// End-to-end smoke test driving the real Electron app via Playwright.
// Run with `npm run test:e2e`. Requires the app to build/launch locally
// (uses the Vite dev server, same as `npm run dev`).
//
// This is a single consolidated script rather than the @playwright/test
// runner — kept consistent with the throwaway verification scripts used
// during development, just made permanent. See README/CONTRIBUTING for
// the manual verification workflow this formalizes.
import { _electron } from 'playwright-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
// Importing 'electron' resolves (and lazily downloads, if missing) the
// platform-correct binary path — this version of Electron has no
// postinstall script, it only downloads on first require().
import electronPath from 'electron';

const results = [];
function check(name, condition, detail) {
  results.push({ name, pass: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

async function main() {
  const env = { ...process.env, NODE_ENV: 'development' };
  delete env.ELECTRON_RUN_AS_NODE;

  // Start Vite if it isn't already running on 5173.
  let vite = null;
  const alreadyUp = await fetch('http://localhost:5173/').then(() => true).catch(() => false);
  if (!alreadyUp) {
    vite = spawn('npx', ['vite'], { cwd: process.cwd(), env, shell: true, stdio: 'ignore' });
    for (let i = 0; i < 40; i++) {
      const up = await fetch('http://localhost:5173/').then(() => true).catch(() => false);
      if (up) break;
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const app = await _electron.launch({
    executablePath: electronPath,
    // --disable-gpu avoids a renderer/GPU-process crash on GitHub Actions'
    // Windows runners, which have no real GPU.
    args: ['--disable-gpu', path.resolve('.')],
    env,
  });

  try {
    // app.firstWindow() can race with an auto-opened DevTools window in dev
    // mode and grab that instead of the app — wait it out.
    let page = await app.firstWindow({ timeout: 60000 });
    for (let i = 0; i < 20 && page.url().startsWith('devtools://'); i++) {
      await new Promise((r) => setTimeout(r, 300));
      page = app.windows().find((w) => !w.url().startsWith('devtools://')) || page;
    }
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.waitForLoadState('load', { timeout: 60000 });
    await page.waitForTimeout(3000);

    // Start from a clean slate so the run is deterministic regardless of any
    // locally-saved data (profiles / snapshots / a previous resume). Clearing
    // the app's keys and reloading lets startup migration recreate the default
    // profile from the built-in empty resume.
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('resume-builder:')) localStorage.removeItem(k);
      }
    });
    await page.reload();
    await page.waitForLoadState('load', { timeout: 60000 });
    await page.waitForTimeout(2000);

    check('main window loaded (not devtools)', page.url().startsWith('http://localhost:5173'), page.url());
    check('nav pane rendered', await page.locator('.nav-pane').count() > 0);

    // --- Personal ---
    const nameInput = await page.$('.editor input[placeholder="Name"]');
    await nameInput.fill('Marcus Bennett');
    await page.waitForTimeout(200);
    const previewName = await page.$eval('.preview-pane h1', (el) => el.textContent);
    check('personal name edit reflects in live preview', previewName === 'Marcus Bennett', previewName);

    // --- Undo/redo (Ctrl+Z / Ctrl+Y) ---
    // Wait out the coalesce window (600ms) so the next edit is its own undo
    // step rather than merging into the fill above.
    await page.waitForTimeout(700);
    await nameInput.fill('Marcus T. Bennett');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(200);
    const nameAfterUndo = await page.$eval('.preview-pane h1', (el) => el.textContent);
    check('Ctrl+Z reverts the last name edit', nameAfterUndo === 'Marcus Bennett', nameAfterUndo);
    await page.keyboard.press('Control+Y');
    await page.waitForTimeout(200);
    const nameAfterRedo = await page.$eval('.preview-pane h1', (el) => el.textContent);
    check('Ctrl+Y restores the undone edit', nameAfterRedo === 'Marcus T. Bennett', nameAfterRedo);
    await page.waitForTimeout(700);
    await nameInput.fill('Marcus Bennett');
    await page.waitForTimeout(200);

    // --- Experience: rich bold/italic, hidden markers ---
    await page.click('.nav-pane button.nav-item:has-text("Experience")');
    await page.waitForTimeout(300);
    const expTag = await page.$eval('.editor .rich-bullet-field', (el) => el.tagName);
    check('experience bullets field is a contenteditable div', expTag === 'DIV');

    await page.evaluate(() => {
      const root = document.querySelector('.editor .rich-bullet-field');
      const line = root.querySelector('.rb-line');
      const text = line.firstChild;
      const idx = text.textContent.indexOf('migration');
      if (idx === -1) return;
      const range = document.createRange();
      range.setStart(text, idx);
      range.setEnd(text, idx + 'migration'.length);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });
    await page.click('.format-toolbar button[title="Bold selected text"]');
    await page.waitForTimeout(200);
    const expVisible = await page.$eval('.editor .rich-bullet-field .rb-line', (el) => el.textContent);
    check('bold via toolbar leaves no visible asterisks', !expVisible.includes('*'), expVisible);
    const expPreviewHtml = await page.$eval('.preview-pane .r-entry ul li:first-child, .preview-pane .r-entry .r-bullet-intro', (el) => el.innerHTML).catch(() => '');
    check('bold survives into the preview as real <strong>', expPreviewHtml.includes('<strong>migration</strong>'), expPreviewHtml);

    // No-selection Bold/Italic must be a no-op (regression check for the
    // "**text**" placeholder corruption bug fixed this session).
    await page.evaluate(() => {
      const root = document.querySelector('.editor .rich-bullet-field');
      const line = root.querySelector('.rb-line:last-child');
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(line);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    });
    const beforeNoSel = await page.$eval('.editor .rich-bullet-field', (el) => el.textContent);
    await page.click('.format-toolbar button[title="Bold selected text"]');
    await page.waitForTimeout(150);
    const afterNoSel = await page.$eval('.editor .rich-bullet-field', (el) => el.textContent);
    check('bold with no selection does not insert placeholder text', beforeNoSel === afterNoSel, `${beforeNoSel} -> ${afterNoSel}`);

    // --- Experience: Enter / indent ---
    await page.evaluate(() => {
      const root = document.querySelector('.editor .rich-bullet-field');
      const lastLine = root.querySelector('.rb-line:last-child');
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(lastLine);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    });
    const linesBefore = await page.$$eval('.editor .rich-bullet-field .rb-line', (els) => els.length);
    await page.keyboard.press('Enter');
    await page.keyboard.type('Automated the release pipeline, cutting deploy time from 30 to 5 minutes.');
    await page.waitForTimeout(150);
    const linesAfter = await page.$$eval('.editor .rich-bullet-field .rb-line', (els) => els.length);
    check('Enter creates a new bullet line', linesAfter === linesBefore + 1, `${linesBefore} -> ${linesAfter}`);

    await page.keyboard.press('Control+]');
    await page.waitForTimeout(150);
    const indented = await page.$eval('.editor .rich-bullet-field .rb-line:last-child', (el) => el.firstChild?.nodeType === 3 ? el.firstChild.textContent : '');
    check('Ctrl+] indents the current line with 2 leading spaces', indented.startsWith('  '), JSON.stringify(indented));

    // --- Experience: paragraph (¶) toggle ---
    await page.evaluate(() => {
      const root = document.querySelector('.editor .rich-bullet-field');
      const line = root.querySelector('.rb-line');
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(line);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    });
    const paragraphBtnDisabled = await page.$eval('.format-toolbar button[title="Move the highlighted line(s) into or out of the bulleted list"]', (b) => b.disabled);
    check('paragraph (¶) button is enabled for the rich field', !paragraphBtnDisabled);
    await page.click('.format-toolbar button[title="Move the highlighted line(s) into or out of the bulleted list"]');
    await page.waitForTimeout(200);
    const introText = await page.$eval('.preview-pane .r-entry .r-bullet-intro', (el) => el.textContent).catch(() => null);
    check('¶ promotes a line to a plain intro paragraph in the preview', !!introText, introText);

    // --- Skills: +Add / delete / bold ---
    await page.click('.nav-pane button.nav-item:has-text("Skills")');
    await page.waitForTimeout(300);
    const skillRowsBefore = await page.$$eval('.skill-row', (els) => els.length);
    await page.click('.skills-list > button:has-text("+ Add Skill")');
    await page.waitForTimeout(150);
    const skillRowsAfter = await page.$$eval('.skill-row', (els) => els.length);
    check('+ Add Skill appends a new row', skillRowsAfter === skillRowsBefore + 1, `${skillRowsBefore} -> ${skillRowsAfter}`);

    const newSkillField = (await page.$$('.rich-skill-field')).at(-1);
    await newSkillField.click();
    await page.keyboard.type('Docker');
    await page.waitForTimeout(150);
    const previewChips = await page.$$eval('.preview-pane .r-skill-line', (els) => els.map((e) => e.textContent));
    check('typed skill appears as a stacked line in the preview (not a pill)', previewChips.includes('Docker'), JSON.stringify(previewChips));
    check('skills preview container has no leftover .r-chip pills', (await page.$$('.preview-pane .r-chip')).length === 0);

    await page.evaluate(() => {
      const line = document.querySelectorAll('.rich-skill-field .rb-line');
      const last = line[line.length - 1];
      const range = document.createRange();
      range.selectNodeContents(last);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });
    await page.click('.format-toolbar button[title="Bold selected text"]');
    await page.waitForTimeout(150);
    const lastSkillField = (await page.$$('.rich-skill-field')).at(-1);
    const lastSkillText = await lastSkillField.textContent();
    check('bold on a skill row leaves no visible asterisks', !lastSkillText.includes('*'), lastSkillText);

    const deleteButtons = await page.$$('.skill-row .danger');
    await deleteButtons.at(-1).click();
    await page.waitForTimeout(150);
    const skillRowsFinal = await page.$$eval('.skill-row', (els) => els.length);
    check('delete (x) removes the skill row', skillRowsFinal === skillRowsBefore, `${skillRowsBefore} -> ${skillRowsFinal}`);

    // --- Custom section: single line vs multi-line bullet rendering ---
    await page.selectOption('.nav-pane select.nav-add', 'custom');
    await page.waitForTimeout(300);
    const customField = await page.$('.editor .rich-bullet-field');
    await customField.click();
    await page.keyboard.type('Speaker at JSConf Australia 2023');
    await page.waitForTimeout(200);
    let customLi = await page.$$eval('.preview-pane .resume-sheet > section:last-child li', (els) => els.length);
    check('a single custom line renders with no bullet marker (no <li>)', customLi === 0, `li count=${customLi}`);

    await page.keyboard.press('Enter');
    await page.keyboard.type('Maintainer of three open-source npm packages');
    await page.waitForTimeout(200);
    customLi = await page.$$eval('.preview-pane .resume-sheet > section:last-child li', (els) => els.length);
    check('two custom lines render as a real bulleted list', customLi === 2, `li count=${customLi}`);

    // --- Undo inside a focused contenteditable ---
    // RichBulletField keeps its DOM as the source of truth while focused, so
    // the Ctrl+Z handler must blur it before rewinding or the visible text
    // wouldn't change. Wait out the coalesce window first so the 'X' edit is
    // its own undo step.
    await page.waitForTimeout(700);
    await page.keyboard.type('X');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(200);
    const customAfterUndo = await page.$eval('.editor .rich-bullet-field', (el) => el.textContent);
    check('Ctrl+Z in a focused rich field reverts the edit on screen', customAfterUndo === 'Speaker at JSConf Australia 2023Maintainer of three open-source npm packages', JSON.stringify(customAfterUndo));

    // --- Languages: inline compact render ---
    await page.selectOption('.nav-pane select.nav-add', 'languages');
    await page.waitForTimeout(300);
    await page.fill('.editor input[placeholder="Language"]', 'English');
    await page.fill('.editor input[placeholder="Proficiency"]', 'Native');
    await page.waitForTimeout(250);
    const langLine = await page.$eval('.preview-pane .r-languages', (el) => el.textContent).catch(() => null);
    check('languages render inline as "English (Native)"', langLine === 'English (Native)', langLine);

    // --- Links: label shown, URL a real clickable https anchor ---
    await page.selectOption('.nav-pane select.nav-add', 'links');
    await page.waitForTimeout(300);
    await page.fill('.editor input[placeholder^="Label"]', 'GitHub');
    await page.fill('.editor input[placeholder^="URL"]', 'github.com/you');
    await page.waitForTimeout(250);
    const linkText = await page.$eval('.preview-pane .r-links a', (el) => el.textContent).catch(() => null);
    check('link shows its label in the preview', linkText === 'GitHub', linkText);
    const linkHref = await page.$eval('.preview-pane .r-links a', (el) => el.getAttribute('href')).catch(() => null);
    check('bare URL gets an https:// scheme in the anchor href', linkHref === 'https://github.com/you', linkHref);

    // --- Profiles: duplicate / switch / undo-clear / delete ---
    const profileCountBefore = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('resume-builder:profiles')).profiles.length
    );
    await page.click('.profile-switch-btn');
    await page.waitForTimeout(150);
    await page.click('.profile-actions button:has-text("Duplicate")');
    await page.waitForTimeout(400);
    const countAfterDup = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('resume-builder:profiles')).profiles.length
    );
    check('Duplicate adds a profile and switches to the copy', countAfterDup === profileCountBefore + 1, `${profileCountBefore} -> ${countAfterDup}`);
    const dupBtn = await page.$eval('.profile-switch-btn', (el) => el.textContent);
    check('switcher shows the "Copy of" profile after duplicate', dupBtn.includes('Copy of'), dupBtn.trim());

    // Switching profiles clears the undo stack (fresh session per document).
    await page.click('.profile-switch-btn');
    await page.waitForTimeout(150);
    await page.click('.profile-item:not(.active)');
    await page.waitForTimeout(400);
    const undoDisabled = await page.$eval('.icon-btn[title="Undo (Ctrl+Z)"]', (b) => b.disabled);
    check('switching profiles clears the undo stack', undoDisabled === true, `undo disabled=${undoDisabled}`);

    // Make sure the copy is the active profile before deleting it (Delete acts
    // on the active profile).
    const activeIsCopy = await page.$eval('.profile-switch-btn', (el) => el.textContent);
    if (!activeIsCopy.includes('Copy of')) {
      await page.click('.profile-switch-btn');
      await page.waitForTimeout(150);
      await page.click('.profile-item:has-text("Copy of")');
      await page.waitForTimeout(400);
    }
    // Delete the copy (accept the confirm dialog) → count restored.
    page.once('dialog', (d) => d.accept());
    await page.click('.profile-switch-btn');
    await page.waitForTimeout(150);
    await page.click('.profile-actions button.danger:has-text("Delete")');
    await page.waitForTimeout(400);
    const countAfterDelete = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('resume-builder:profiles')).profiles.length
    );
    check('Delete removes the profile and restores the count', countAfterDelete === profileCountBefore, `${countAfterDup} -> ${countAfterDelete}`);

    // --- Dark mode: three-way setting, persistence, paper stays white ---
    await page.click('.icon-btn[title="Settings"]');
    await page.waitForTimeout(150);
    await page.click('.theme-toggle button:has-text("Dark")');
    await page.waitForTimeout(200);
    const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    check('selecting Dark sets data-theme="dark" on <html>', themeAttr === 'dark', themeAttr);
    const themeSaved = await page.evaluate(() => localStorage.getItem('resume-builder:theme'));
    check('dark setting persists to localStorage', themeSaved === 'dark', themeSaved);
    // The resume sheet represents paper and must stay light even in dark mode.
    const sheetBg = await page.$eval('.preview-pane .resume-sheet', (el) => getComputedStyle(el).backgroundColor);
    check('resume sheet stays paper-white in dark mode', sheetBg === 'rgb(255, 255, 255)', sheetBg);
    // The editor pane, by contrast, must actually go dark.
    const editorBg = await page.$eval('.editor-pane', (el) => getComputedStyle(el).backgroundColor);
    check('editor pane goes dark in dark mode', editorBg === 'rgb(13, 17, 23)', editorBg);
    // Persist across a reload (survives restart).
    await page.reload();
    await page.waitForLoadState('load', { timeout: 60000 });
    await page.waitForTimeout(1500);
    const themeAfterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    check('dark mode survives a reload', themeAfterReload === 'dark', themeAfterReload);
    // Reset back to System so the run leaves no dark preference behind.
    await page.click('.icon-btn[title="Settings"]');
    await page.waitForTimeout(150);
    await page.click('.theme-toggle button:has-text("System")');
    await page.waitForTimeout(150);
    await page.click('.icon-btn[title="Settings"]');

    check('no uncaught page errors during the whole run', pageErrors.length === 0, pageErrors.join('; '));
  } finally {
    await app.close();
    if (vite) vite.kill();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log('Failed:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('E2E smoke test crashed:', err);
  process.exit(1);
});
