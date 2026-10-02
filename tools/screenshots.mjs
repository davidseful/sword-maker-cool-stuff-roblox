// Regenerates the screenshots used in the README (docs/*.jpg).  node tools/screenshots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs');
fs.mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.join(root, 'index.html')).href;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });

async function open(viewport, extra) {
  const ctx = await browser.newContext(Object.assign({ viewport, colorScheme: 'dark' }, extra || {}));
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.SF && SF.app && document.querySelectorAll('.card').length > 0);
  await page.waitForTimeout(3500);          // let thumbnails and particles settle
  return { ctx, page };
}
const jpg = (page, name) => page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 84 });

{
  const { ctx, page } = await open({ width: 1440, height: 900 });
  await page.click('#tab-fx');
  await page.waitForTimeout(400);
  await jpg(page, 'main.jpg');
  await page.click('#tab-moves');
  await page.evaluate(() => SF.app.preview.swing());
  await page.waitForTimeout(420);
  await jpg(page, 'moves.jpg');
  await page.click('.cta-desktop');
  await page.waitForTimeout(900);
  await jpg(page, 'export.jpg');
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 390, height: 844 }, { deviceScaleFactor: 2, hasTouch: true });
  await jpg(page, 'phone.jpg');
  await ctx.close();
}
await browser.close();
console.log('wrote docs/main.jpg, docs/moves.jpg, docs/export.jpg, docs/phone.jpg');
