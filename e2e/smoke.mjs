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
    executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
    args: [path.resolve('.')],
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

    check('main window loaded (not devtools)', page.url().startsWith('http://localhost:5173'), page.url());
    check('nav pane rendered', await page.locator('.nav-pane').count() > 0);

    // --- Personal ---
    const nameInput = await page.$('.editor input[placeholder="Name"]');
    await nameInput.fill('E2E Test User');
    await page.waitForTimeout(200);
    const previewName = await page.$eval('.preview-pane h1', (el) => el.textContent);
    check('personal name edit reflects in live preview', previewName === 'E2E Test User', previewName);

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
    await page.keyboard.type('Third point');
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
    await page.keyboard.type('Only point');
    await page.waitForTimeout(200);
    let customLi = await page.$$eval('.preview-pane .resume-sheet > section:last-child li', (els) => els.length);
    check('a single custom line renders with no bullet marker (no <li>)', customLi === 0, `li count=${customLi}`);

    await page.keyboard.press('Enter');
    await page.keyboard.type('Second point');
    await page.waitForTimeout(200);
    customLi = await page.$$eval('.preview-pane .resume-sheet > section:last-child li', (els) => els.length);
    check('two custom lines render as a real bulleted list', customLi === 2, `li count=${customLi}`);

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
