// Sword Forge UI test: drives the real page in headless Chromium.
//   node tests/ui.mjs            (needs Playwright's Chromium: npx playwright install chromium)
//   node tests/ui.mjs --shots    also saves screenshots to tests/out/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.argv.includes('--shots');
const outDir = path.join(root, 'tests/out');
if (shots) fs.mkdirSync(outDir, { recursive: true });
const url = pathToFileURL(path.join(root, process.env.PAGE || 'index.html')).href;

const results = [];
const check = (ok, msg) => { results.push({ ok: !!ok, msg }); if (!ok) console.log('  FAIL  ' + msg); };
const eq = (a, b, msg) => check(a === b, `${msg} (got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)})`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });

// Text nodes that are really a leaked JS value ("null", "undefined", "false", "NaN", "[object Object]").
const strays = (page) => page.evaluate(() => {
  const bad = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || p.closest('script, style, textarea, .code')) continue;
    const t = n.nodeValue;
    if (/^\s*(null|undefined|false|NaN)\s*$/.test(t) || /\b(undefined|NaN)\b|\[object /.test(t)) bad.push(`${p.tagName.toLowerCase()}.${p.className}: "${t.trim().slice(0, 40)}"`);
  }
  return bad;
});

async function openPage(viewport, extra, init) {
  const ctx = await browser.newContext(Object.assign({ viewport, colorScheme: 'dark', permissions: ['clipboard-read', 'clipboard-write'] }, extra || {}));
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  const problems = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_CERT|fonts\.g|net::ERR/.test(m.text())) problems.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => problems.push('PAGEERROR: ' + e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.SF && SF.app && document.querySelectorAll('.card').length > 0);
  await page.waitForTimeout(600);
  return { ctx, page, problems };
}

/* ------------------------------------------------------------------- desktop */
{
  const { ctx, page, problems } = await openPage({ width: 1440, height: 900 });
  const name = () => page.inputValue('#sword-name');
  const stat = (label) => page.$eval('#statbar', (el, l) => { const s = [...el.querySelectorAll('.stat')].find((x) => x.textContent.includes(l)); return s ? s.querySelector('b').textContent : null; }, label);

  eq(await name(), 'Flame Tongue', 'opens with the Flame Tongue premade');
  eq(await page.locator('.card').count(), await page.evaluate(() => SF.PRESETS.length), 'every premade sword has a card');
  check((await page.locator('#cards .card[aria-pressed="true"]').count()) === 1, 'one card is highlighted');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('.stage-canvas')).display !== 'none'), 'the 3D canvas is showing');
  check(await page.evaluate(() => !document.getElementById('nogl').classList.contains('show')), 'WebGL is available');

  // gallery
  const partsBefore = await stat('parts');
  await page.click('.card[data-id="frost"]');
  eq(await name(), 'Frostbite', 'clicking a card loads that sword');
  check((await stat('parts')) !== partsBefore, 'the part count updates');
  eq(await page.locator('#cards .card[aria-pressed="true"]').getAttribute('data-id'), 'frost', 'the clicked card is highlighted');

  // tabs
  for (const t of ['hilt', 'fx', 'powers', 'blade']) {
    await page.click('#tab-' + t);
    check((await page.locator('#panel .field, #panel .layer, #panel .addbtn').count()) > 3, `the ${t} tab shows controls`);
    const leaked = await strays(page);
    check(leaked.length === 0, `no leaked null/undefined text on the ${t} tab: ${leaked.join(' | ')}`);
  }
  {
    const leaked = await strays(page);
    check(leaked.length === 0, `no leaked null/undefined text on the page header and stats: ${leaked.join(' | ')}`);
  }

  // slider -> model
  const lenBefore = parseFloat(await stat('studs long'));
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('#panel .field')].find((f) => f.textContent.startsWith('Length'));
    const input = s.querySelector('input[type=range]');
    input.value = 7; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  check(parseFloat(await stat('studs long')) > lenBefore + 1.5, 'the length slider changes the sword');

  // undo / redo
  await page.click('button[aria-label="Undo"]');
  check(Math.abs(parseFloat(await stat('studs long')) - lenBefore) < 0.05, 'undo restores the previous length');
  await page.click('button[aria-label="Redo"]');
  check(parseFloat(await stat('studs long')) > lenBefore + 1.5, 'redo re-applies it');

  // blade style picker
  await page.click('.pick[title*="Slim"]');
  const style = await page.evaluate(() => SF.app.state.cfg.blade.style);
  eq(style, 'katana', 'picking a blade style applies it');

  // colour theme
  await page.click('.pal >> nth=3');
  const bladeColor = await page.evaluate(() => SF.app.state.cfg.blade.color);
  check(bladeColor === '#46c33a', 'a color theme recolors the sword');

  // effects: add + remove
  await page.click('#tab-fx');
  const before = await page.locator('#panel .layer').count();
  await page.click('.addbtn >> nth=0');
  eq(await page.locator('#panel .layer').count(), before + 1, 'adding an effect adds a layer');
  await page.click('#panel .layer >> nth=-1 >> button[aria-label="Remove effect"]');
  eq(await page.locator('#panel .layer').count(), before, 'removing it again');

  // conditional controls: burst size only shows for burst triggers
  await page.click('.addbtn >> nth=1');
  const burstHidden = await page.evaluate(() => [...document.querySelectorAll('#panel .layer.open .field')].find((f) => f.textContent.startsWith('Burst size')).hidden);
  check(burstHidden === true, 'burst size is hidden while the effect runs continuously');
  await page.selectOption('#panel .layer.open select >> nth=2', 'burst');
  const burstShown = await page.evaluate(() => [...document.querySelectorAll('#panel .layer.open .field')].find((f) => f.textContent.startsWith('Burst size')).hidden);
  check(burstShown === false, 'burst size appears once the trigger is a burst');

  // powers: turn on an enchantment
  await page.click('#tab-powers');
  await page.evaluate(() => { const sw = document.querySelector('.ench .switch input'); sw.click(); });
  check(await page.evaluate(() => Object.values(SF.app.state.cfg.combat.enchants).some((e) => e.on)), 'enchantments can be switched on');

  // randomize
  const nameBefore = await name();
  await page.click('button:has-text("Surprise me")');
  check((await name()) !== nameBefore || (await stat('parts')) !== partsBefore, 'Surprise me rolls a new sword');

  // export dialog
  await page.click('.cta-desktop');
  await page.waitForSelector('#export-dlg[open]');
  const code = await page.$eval('#export-dlg .code', (el) => el.textContent);
  check(code.includes('local STATS') && code.includes('local CONFIG') && code.includes('buildSword'), 'the script is shown');
  check(/local function setupCombat/.test(code), 'the combat code is included');
  check((await page.$eval('#export-dlg .code-meta', (e) => e.textContent)).includes('lines'), 'the size is shown');
  if (shots) await page.screenshot({ path: path.join(outDir, 'ui-export.png') });
  await page.click('#export-dlg .seg button >> nth=1');
  const code2 = await page.$eval('#export-dlg .code', (el) => el.textContent);
  check(code2.includes('COMBAT_SOURCE') && code2.includes('StarterPack'), 'command bar mode shows the builder script');
  await page.click('#export-dlg .seg button >> nth=0');
  await page.click('#export-dlg .code-bar .btn.primary');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check(clip.includes('local STATS') && clip.length > 5000, 'Copy script puts the code on the clipboard');
  check(await page.locator('.toast').count() > 0, 'a toast confirms the copy');
  await page.keyboard.press('Escape');

  // a sword with no powers: the export summary lists three facts, not a stray "null"
  {
    const plainId = await page.evaluate(() => { const p = SF.PRESETS.find((x) => SF.describe(x.cfg).powers.length === 0); return p && p.id; });
    check(!!plainId, 'there is a premade sword without powers to test with');
    if (plainId) {
      await page.click(`.card[data-id="${plainId}"]`);
      await page.click('.cta-desktop');
      await page.waitForSelector('#export-dlg[open]');
      eq(await page.locator('#export-summary li').count(), 3, 'the export summary lists three facts for a sword without powers');
      const summary = await page.$eval('#export-summary', (e) => e.textContent);
      check(!/null|undefined|false/.test(summary), 'the export summary has no leaked null: ' + summary);
      const leaked = await strays(page);
      check(leaked.length === 0, 'no leaked null/undefined text in the export dialog: ' + leaked.join(' | '));
      await page.keyboard.press('Escape');
    }
  }

  // library
  await page.click('button:has-text("My swords")');
  await page.waitForSelector('#library-dlg[open]');
  await page.click('#library-dlg .btn.primary');
  eq(await page.locator('#library-dlg .mine-row').count(), 1, 'saving adds a row');
  const savedName = await page.$eval('#library-dlg .mine-row .nm', (e) => e.textContent);
  await page.keyboard.press('Escape');
  await page.click('.card[data-id="classic"]');
  await page.click('button:has-text("My swords")');
  await page.click('#library-dlg .mine-row .btn >> nth=0');
  eq(await name(), savedName, 'loading a saved sword brings it back');

  // keyboard: space swings, no crash
  await page.click('.stage-canvas', { position: { x: 5, y: 5 } });
  await page.keyboard.press('Space');

  // autosave
  await page.waitForTimeout(600);
  check(await page.evaluate(() => !!localStorage.getItem('sf.current')), 'the sword is autosaved');
  if (shots) await page.screenshot({ path: path.join(outDir, 'ui-desktop.png') });

  // hostile input in the name field must not break the generated script
  await page.fill('#sword-name', 'Evil "]]\\ name\n[==[');
  await page.click('.cta-desktop');
  const evil = await page.$eval('#export-dlg .code', (el) => el.textContent);
  check(evil.includes('Name = "Evil \\"]]\\\\ name [==["') || evil.includes('Name = "Evil'), 'a nasty sword name is escaped');
  await page.keyboard.press('Escape');

  check(problems.length === 0, 'no console errors: ' + problems.join(' | '));
  await ctx.close();
}

/* -------------------------------------------------------------------- phone */
{
  const { ctx, page, problems } = await openPage({ width: 390, height: 844 }, { deviceScaleFactor: 2, hasTouch: true });
  const w = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  eq(w.s, w.c, 'phone: nothing scrolls sideways');
  check(await page.locator('.cta-mobile').isVisible(), 'phone: the bottom action bar is visible');
  const bar = await page.locator('.cta-mobile .btn.primary').boundingBox();
  check(bar && bar.x + bar.width <= 390 + 0.5, 'phone: the Get script button fits on screen');
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  const stage = await page.locator('.stage').boundingBox();
  check(stage && stage.y >= -2 && stage.y < 60, 'phone: the stage stays pinned while scrolling');
  await page.click('.cta-mobile .btn.primary');
  await page.waitForSelector('#export-dlg[open]');
  const dw = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  eq(dw.s, dw.c, 'phone: the export dialog does not widen the page');
  if (shots) await page.screenshot({ path: path.join(outDir, 'ui-phone.png') });
  check(problems.length === 0, 'phone: no console errors: ' + problems.join(' | '));
  await ctx.close();
}

/* ------------------------------------------- Artifact viewer mode (no downloads, no #links) */
{
  const { ctx, page, problems } = await openPage({ width: 1366, height: 820 }, {}, () => { globalThis.SF_ARTIFACT = true; });
  eq(await page.locator('#theme-btn').count(), 0, 'artifact mode: the theme toggle is left out (the viewer has its own)');
  const leakedTop = await strays(page);
  check(leakedTop.length === 0, 'artifact mode: no leaked null/undefined text in the header: ' + leakedTop.join(' | '));
  eq(await page.locator('#top-actions .btn').count(), 5, 'artifact mode: header has undo, redo, Surprise me, My swords and Get script (no theme button)');
  await page.click('.cta-desktop');
  await page.waitForSelector('#export-dlg[open]');
  eq(await page.locator('#export-dlg button:has-text("Download")').count(), 0, 'artifact mode: no download button in the export dialog');
  const copyOk = await page.locator('#export-dlg .code-bar .btn.primary').count();
  check(copyOk === 1, 'artifact mode: the Copy script button is there');
  const leakedExport = await strays(page);
  check(leakedExport.length === 0, 'artifact mode: no leaked text in the export dialog: ' + leakedExport.join(' | '));
  await page.keyboard.press('Escape');
  await page.click('button:has-text("My swords")');
  await page.waitForSelector('#library-dlg[open]');
  eq(await page.locator('#library-dlg button:has-text("share link")').count(), 0, 'artifact mode: no share-link button (the viewer blocks #links)');
  eq(await page.locator('#library-dlg button:has-text("Download")').count(), 0, 'artifact mode: no download-file button');
  check(await page.locator('#library-dlg button:has-text("Copy sword code")').count() === 1, 'artifact mode: sword codes can still be copied');
  const leakedLib = await strays(page);
  check(leakedLib.length === 0, 'artifact mode: no leaked text in the library: ' + leakedLib.join(' | '));
  check(problems.length === 0, 'artifact mode: no console errors: ' + problems.join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------- light theme */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.SF && SF.app);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg !== 'rgb(12, 15, 21)', 'light theme: the page follows the OS and is not dark (' + bg + ')');
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? 'ALL GOOD' : failed.length + ' CHECK(S) FAILED'} - ${results.length} UI checks`);
process.exit(failed.length ? 1 : 0);
