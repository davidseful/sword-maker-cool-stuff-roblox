// Bundles the app into single files.
//   node tools/build.mjs           writes dist/sword-forge.html (one self-contained file)
//                                  and dist/sword-forge.artifact.html (page fragment for the Artifact viewer)
//   node tools/build.mjs --check   fails if dist/sword-forge.html is out of date (used by `npm test`)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const check = process.argv.includes('--check');

const index = read('index.html');
const css = read('css/style.css');
const scriptFiles = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
if (!scriptFiles.length) throw new Error('no <script src> found in index.html');

// keep the JS safe to inline inside a <script> element
const safe = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const js = scriptFiles.map((f) => `/* ---- ${f} ---- */\n${read(f).trimEnd()}\n`).join('\n');

const fontLink = (index.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/) || [''])[0];
const title = (index.match(/<title>([^<]*)<\/title>/) || [, 'Sword Forge'])[1];
const bodyMarkup = index
  .slice(index.indexOf('<body>') + 6, index.indexOf('</body>'))
  .replace(/<script src="[^"]+"><\/script>\s*/g, '')
  .trim();

/* ---- 1. standalone document */
const standalone = index
  .replace(/<link rel="stylesheet" href="css\/style\.css">/, () => `<style>\n${css.trimEnd()}\n</style>`)
  .replace(/(<script src="[^"]+"><\/script>\s*)+/, () => `<script>\n${safe(js)}</script>\n`);

/* ---- 2. Artifact fragment (the viewer wraps it in its own <html>/<head>/<body>) */
const artifact = [
  `<title>${title}</title>`,
  fontLink,
  `<style>\n${css.trimEnd()}\n</style>`,
  bodyMarkup,
  `<script>\nglobalThis.SF_ARTIFACT = true;\n${safe(js)}</script>`,
  '',
].join('\n');

const out = path.join(root, 'dist');
const standalonePath = path.join(out, 'sword-forge.html');

if (check) {
  const current = fs.existsSync(standalonePath) ? fs.readFileSync(standalonePath, 'utf8') : '';
  if (current !== standalone) {
    console.error('dist/sword-forge.html is out of date. Run: npm run build');
    process.exit(1);
  }
  console.log('dist/sword-forge.html is up to date');
} else {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(standalonePath, standalone);
  fs.writeFileSync(path.join(out, 'sword-forge.artifact.html'), artifact);
  const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
  console.log(`dist/sword-forge.html           ${kb(standalone)}  (single file, open it anywhere)`);
  console.log(`dist/sword-forge.artifact.html  ${kb(artifact)}  (for the Artifact viewer)`);
}
