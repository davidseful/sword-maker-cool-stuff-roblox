// Sword Forge test runner.
//   node tests/run.mjs              run everything
//   node tests/run.mjs flame        only presets / cases whose id contains "flame"
//   node tests/run.mjs --dump       also write every generated script to tests/out/
//
// For every sword it (1) lints the generated Luau with the real Luau analyzer,
// (2) executes it in a real Luau VM against tests/mock.luau (a strict Roblox API mock)
// and (3) plays a short fight (tests/scenario.luau) checking damage, effects, enchantments...
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Lua } from '@luau-rs/luau';
import { Analysis } from '@luau-rs/luau/analysis';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['data', 'anims', 'model', 'engine', 'luau', 'export', 'presets']) await import(pathToFileURL(path.join(root, 'js', f + '.js')).href);
const SF = globalThis.SF;

const args = process.argv.slice(2);
const dump = args.includes('--dump');
const filter = args.find((a) => !a.startsWith('--')) || '';
const mockSource = fs.readFileSync(path.join(root, 'tests/mock.luau'), 'utf8');
const scenarioSource = fs.readFileSync(path.join(root, 'tests/scenario.luau'), 'utf8');
const outDir = path.join(root, 'tests/out');
if (dump) fs.mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ lint */
const GLOBALS = ['game', 'workspace', 'script', 'Instance', 'Vector3', 'Vector2', 'CFrame', 'Color3', 'ColorSequence',
  'ColorSequenceKeypoint', 'NumberSequence', 'NumberSequenceKeypoint', 'NumberRange', 'Enum', 'OverlapParams', 'RaycastParams', 'task', 'warn'];
const analysis = await Analysis.create({ mode: 'nonstrict', lint: true, globals: GLOBALS });
let lintCounter = 0;
function lint(code) {
  const name = 'sword' + lintCounter++;
  analysis.setModule(name, code, 'script');
  const res = analysis.check(name);
  analysis.deleteModule(name);
  return res.diagnostics;
}

/* -------------------------------------------------------------- expectations */
function expectationsFor(cfgIn, mode, opts) {
  const model = SF.buildModel(cfgIn);
  const cfg = model.cfg;
  const c = cfg.combat;
  const swing = c.swing.charAt(0).toUpperCase() + c.swing.slice(1);
  const enchants = {};
  let hasExtra = false;
  let maxExtra = 0.5;
  SF.ENCHANT_IDS.forEach((id) => {
    const e = c.enchants[id];
    if (!e.on) return;
    enchants[id] = true;
    if (id === 'lightning' || id === 'explosion') { hasExtra = true; maxExtra += e.damage; }
    if (id === 'burn' || id === 'poison') { hasExtra = true; maxExtra += e.dps * 1.5; }
  });
  const fx = model.effects;
  const parts = fx.filter((e) => e.kind === 'particles');
  const trails = fx.filter((e) => e.kind === 'trail');
  const w = c.wave;

  // animations: what the sword should say, how long things take, and the exact poses the driver must reach
  const data = SF.animData(cfg.anim);
  const custom = !!(data && data.swings.length > 0);
  const clientAnimator = !!(data && !(opts && opts.noAnimator));
  const timing = (id) => {
    const r = SF.resolveMove(id);
    return { windup: r.hit[0] * r.dur / data.speed, window: Math.max(0.15, (r.hit[1] - r.hit[0]) * r.dur / data.speed), total: r.dur / data.speed };
  };
  let anim = null;
  if (data) {
    const moves = {};
    Object.keys(data.moves).forEach((id) => { moves[id] = { dur: data.moves[id].dur, keys: data.moves[id].keys.length }; });
    const samples = [];
    [...new Set([...data.swings, data.equip].filter(Boolean))].forEach((id) => {
      const r = SF.resolveMove(id);
      [0.15, 0.4, 0.65, 0.9].forEach((u) => {
        const pose = SF.poseAt(r, u);
        const m = {};
        SF.ANIM_CH3.forEach((ch) => { m[ch] = SF.math.eulerToMat(pose[ch]); });
        samples.push({ id, u, dur: r.dur, m, dy: pose.dy, dz: pose.dz });
      });
    });
    anim = { moves, swings: data.swings, idle: data.idle, equip: data.equip, speed: data.speed, samples };
  }
  const comboLength = custom ? Math.max(data.swings.length, 3) : 3;
  const first = custom ? timing(data.swings[0]) : null;
  const last = custom ? timing(data.swings[(comboLength - 1) % data.swings.length]) : null;
  const maxWindup = custom ? Math.max(...data.swings.map((id) => timing(id).windup)) : 0.12;
  const timings = {
    hasAnim: !!data, customSwings: custom, clientAnimator, comboLength,
    hitWait: custom ? first.windup + 0.1 : 0.2,
    swingTail: custom ? Math.max(0.6, first.windup + first.window + 0.3 - (first.windup + 0.1)) : 0.6,
    finisherWait: custom ? last.windup + 0.25 : 0.25,
    waveWatch: Math.ceil((maxWindup + 0.5) * 60),
  };
  return {
    anim, ...timings,
    mode, name: cfg.name,
    damage: c.damage, cooldown: c.cooldown, swing, finisher: c.finisher,
    firstDamage: swing === 'Lunge' ? c.damage * c.finisher : c.damage,
    hasExtraDamage: hasExtra, maxExtra, enchants,
    lifesteal: !!enchants.lifesteal,
    partCount: model.parts.length,
    swingTrails: trails.filter((t) => !t.always).length,
    alwaysTrails: trails.filter((t) => t.always).length,
    idleEmitters: parts.filter((p) => p.trigger === 'idle').length,
    swingEmitters: parts.filter((p) => p.trigger === 'swing').length,
    burstEmitters: parts.filter((p) => p.trigger === 'burst').length,
    hitEmitters: parts.filter((p) => p.trigger === 'hit').length,
    equipEmitters: parts.filter((p) => p.trigger === 'equip').length,
    lights: fx.filter((e) => e.kind === 'glow').length,
    arcs: fx.filter((e) => e.kind === 'arcs').reduce((n, a) => n + a.count, 0),
    outlines: fx.filter((e) => e.kind === 'outline').length,
    equipSound: cfg.sounds.equip, swingSound: cfg.sounds.swing,
    wave: w.mode,
    waveFires: w.mode === 'every' || (w.mode === 'finisher' && c.swing !== 'slash'),
    waveDamage: w.damage, waveRange: w.range, waveSpeed: w.speed,
    tilt: cfg.hold.tilt,
  };
}

/* ----------------------------------------------------------------- run one */
async function runOne(label, cfg, mode, opts) {
  const gen = SF.generate(cfg, mode);
  if (dump) fs.writeFileSync(path.join(outDir, `${label.replace(/[^a-z0-9_.-]+/gi, '_')}.${mode}.lua`), gen.code);
  const problems = [];

  // 1. lint
  for (const d of lint(gen.code)) {
    const line = d.location.begin.line + 1;
    if (d.severity === 'error') problems.push(`lint error (line ${line}): ${d.message}`);
    else problems.push(`lint warning ${d.code} (line ${line}): ${d.message}`);
  }
  if (gen.animator) for (const d of lint(gen.animator)) problems.push(`lint (animator line ${d.location.begin.line + 1}) ${d.severity} ${d.code}: ${d.message}`);
  // the long-string chunk of the command-bar mode is a script of its own: lint it too
  if (mode === 'commandbar') {
    const m = gen.code.match(/local COMBAT_SOURCE = \[(=+)\[\n([\s\S]*?)\]\1\]/);
    if (!m) problems.push('could not find COMBAT_SOURCE');
    else for (const d of lint(m[2])) problems.push(`lint (COMBAT_SOURCE line ${d.location.begin.line + 1}) ${d.severity} ${d.code}: ${d.message}`);
  }

  // 2. run in a Luau VM against the Roblox mock
  const lua = await Lua.create();
  const results = [];
  const printed = [];
  lua.addEventListener('print', (e) => printed.push(e.text));
  lua.globals.set('__report', lua.createFunction((ok, msg) => { results.push({ ok, msg: String(msg) }); }));
  lua.globals.set('__loadchunk', lua.createFunction((src) => lua.load(String(src), { name: '=chunk' })));
  try {
    lua.execute(mockSource, { name: '=mock' });
    lua.execute('Mock.setupStarter()');
    lua.globals.set('__animatorSource', gen.animator || '');
    lua.globals.set('__withAnimator', !(opts && opts.noAnimator));
    lua.execute(`
      function __runSource(src, scriptInstance)
        local fn = __loadchunk(src)
        script = scriptInstance
        task.spawn(fn)
      end
      script = Instance.new("Script")
      -- script mode: the Studio file carries the animator LocalScript inside the generated Script
      if __animatorSource ~= "" and __withAnimator then
        local ls = Instance.new("LocalScript")
        ls.Name = "SwordForgeAnimator"
        ls.Source = __animatorSource
        ls.Parent = script
      end
    `);
    const main = lua.load(gen.code, { name: '=generated' });
    lua.globals.set('__main', main);
    lua.execute('task.spawn(__main)');
    lua.execute('EXPECT = ' + SF.luaSerialize(expectationsFor(cfg, mode, opts)));
    lua.execute(scenarioSource, { name: '=scenario' });
  } catch (err) {
    problems.push('VM error: ' + String(err && err.message ? err.message : err).split('\n')[0]);
  }
  for (const r of results) if (!r.ok) problems.push('scenario: ' + r.msg);
  return { gen, problems, checks: results.length, printed };
}

/* ------------------------------------------------------------------- cases */
const cases = [];
SF.PRESETS.forEach((p) => cases.push({ id: 'preset-' + p.id, cfg: p.cfg }));

// every blade style with default proportions
SF.BLADE_STYLE_IDS.forEach((id) => {
  const cfg = SF.applyBladeStyle(SF.defaultConfig(), id);
  cases.push({ id: 'blade-' + id, cfg });
});

// every guard / pommel / gem option
SF.GUARD_STYLES.forEach(([id]) => {
  const cfg = SF.defaultConfig();
  cfg.guard.style = id;
  cfg.guard.ends = 'ball';
  cfg.gem.where = 'all';
  cases.push({ id: 'guard-' + id, cfg });
});
SF.POMMEL_STYLES.forEach(([id]) => {
  const cfg = SF.defaultConfig();
  cfg.pommel.style = id;
  cfg.gem.where = 'pommel';
  cases.push({ id: 'pommel-' + id, cfg });
});

// kitchen sink: every effect, every enchant, wave on every swing
{
  const cfg = SF.defaultConfig();
  cfg.name = 'Kitchen "Sink" \\ [[test]]';
  cfg.effects = SF.FX_KIND_IDS.map((k) => SF.makeLayer(k));
  SF.PARTICLE_STYLE_IDS.forEach((s, i) => {
    cfg.effects.push(SF.makeLayer('particles', { style: s, trigger: ['idle', 'swing', 'burst', 'hit', 'equip'][i % 5], where: ['blade', 'tip', 'hilt'][i % 3] }));
  });
  SF.ENCHANT_IDS.forEach((id) => { cfg.combat.enchants[id].on = true; });
  cfg.combat.wave.mode = 'every';
  cfg.combat.swing = 'combo';
  cases.push({ id: 'kitchen-sink', cfg });
}
// swing styles, wave modes, scale extremes, silent sword
['slash', 'lunge'].forEach((s) => {
  const cfg = SF.defaultConfig();
  cfg.combat.swing = s;
  cfg.combat.wave.mode = 'finisher';
  cfg.combat.enchants.knockback.on = true;
  cases.push({ id: 'swing-' + s, cfg });
});
[0.4, 3].forEach((sc) => {
  const cfg = SF.defaultConfig();
  cfg.scale = sc;
  cfg.effects = [SF.makeLayer('aura'), SF.makeLayer('glow'), SF.makeLayer('particles')];
  cases.push({ id: 'scale-' + sc, cfg });
});
{
  const cfg = SF.defaultConfig();
  cfg.sounds = { swing: false, equip: false, hit: '12345' };
  cfg.combat.cooldown = 3;
  cases.push({ id: 'silent-slow', cfg });
}
{
  // hostile / broken input must still produce a working script
  const cfg = { name: '\u0001\u0002 weird\nname "with" quotes \\ and ]] brackets', blade: { style: 'nope', length: 'abc', color: 'red' }, effects: [{ kind: 'bogus' }, { kind: 'glow', color: 5 }], combat: { damage: -50, swing: 'x' } };
  cases.push({ id: 'garbage-input', cfg });
}

// animations on every kind of sword, one without animations, and one without the LocalScript animator (the server animates)
{
  const cfg = SF.clone(SF.presetById('flame').cfg);
  cfg.anim.on = false;
  cases.push({ id: 'anim-off', cfg });
}
{
  const cfg = SF.defaultConfig();
  cfg.anim = { on: true, speed: 1.4, idle: 'none', equip: 'none', swings: ['spin'] };
  cases.push({ id: 'anim-one-swing', cfg });
}
{
  const cfg = SF.defaultConfig();
  cfg.anim = { on: true, speed: 0.6, idle: 'two_hand', equip: 'twirl', swings: SF.movesOf('swing').slice(0, 6) };
  cfg.combat.swing = 'combo';
  cfg.combat.wave.mode = 'finisher';
  cases.push({ id: 'anim-six-swings', cfg });
}
{
  const cfg = SF.defaultConfig();
  cfg.anim = { on: true, speed: 1, idle: 'rest', equip: 'salute', swings: [] };
  cases.push({ id: 'anim-idle-only', cfg });
}
['slash', 'lunge'].forEach((st) => {
  const cfg = SF.defaultConfig();
  cfg.combat.swing = st;
  cfg.combat.wave.mode = 'every';
  cfg.anim = { on: true, speed: 1.8, idle: 'low', equip: 'stomp', swings: ['thrust', 'iaido'] };
  cases.push({ id: 'anim-' + st, cfg });
});
SF.movesOf('swing').forEach((id) => {
  const cfg = SF.defaultConfig();
  cfg.anim = { on: true, speed: 1, idle: 'ready', equip: 'draw', swings: [id, id, id] };
  cases.push({ id: 'move-' + id, cfg });
});

cases.push({ id: 'anim-server-fallback', cfg: SF.presetById('flame').cfg, opts: { noAnimator: true }, scriptOnly: true });

/* ------------------------------------------------------------------- fuzzing */
// Random swords with values pushed to the edges of every slider, random effect stacks, random enchantments.
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function randomParams(specs, rnd, o) {
  specs.forEach((p) => {
    if (p.t === 'range') o[p.k] = rnd() < 0.25 ? (rnd() < 0.5 ? p.min : p.max) : p.min + rnd() * (p.max - p.min);
    else if (p.t === 'color') o[p.k] = '#' + Math.floor(rnd() * 0xffffff).toString(16).padStart(6, '0');
    else if (p.t === 'select') o[p.k] = p.options[Math.floor(rnd() * p.options.length)][0];
    else o[p.k] = rnd() < 0.5;
  });
  return o;
}
function randomCfg(rnd) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const col = () => '#' + Math.floor(rnd() * 0xffffff).toString(16).padStart(6, '0');
  const edge = (min, max) => (rnd() < 0.2 ? (rnd() < 0.5 ? min : max) : min + rnd() * (max - min));
  const cfg = SF.defaultConfig();
  cfg.name = pick(['Sword', 'A "quoted" one', 'back\\slash', 'unicode \u2694 blade', 'x'.repeat(40), '[[long]]']);
  cfg.scale = edge(0.4, 3);
  cfg.wedgeFlip = rnd() < 0.2;
  cfg.hold.tilt = edge(-60, 60);
  const b = cfg.blade;
  b.style = pick(SF.BLADE_STYLE_IDS);
  b.length = edge(1.2, 10); b.width = edge(0.15, 3.5); b.thickness = edge(0.05, 0.8); b.tip = edge(0, 4);
  b.curve = edge(-35, 45); b.taper = edge(0, 0.85); b.serrated = Math.floor(edge(0, 14));
  b.fuller = pick(SF.FULLER_STYLES)[0]; b.color = col(); b.accent = col(); b.coreColor = col();
  b.material = pick(SF.MATERIAL_IDS); b.transparency = edge(0, 0.9);
  const g = cfg.guard;
  g.style = pick(SF.GUARD_STYLES)[0]; g.width = edge(0.5, 6); g.height = edge(0.1, 1.2); g.thickness = edge(0.1, 1.4);
  g.ends = pick(['none', 'ball']); g.color = col(); g.material = pick(SF.MATERIAL_IDS);
  cfg.grip.length = edge(0.5, 3); cfg.grip.radius = edge(0.08, 0.6); cfg.grip.wrap = rnd() < 0.5; cfg.grip.color = col(); cfg.grip.wrapColor = col(); cfg.grip.material = pick(SF.MATERIAL_IDS);
  cfg.pommel.style = pick(SF.POMMEL_STYLES)[0]; cfg.pommel.size = edge(0.2, 1.6); cfg.pommel.color = col();
  cfg.gem.where = pick(SF.GEM_PLACES)[0]; cfg.gem.size = edge(0.12, 0.9); cfg.gem.color = col();
  cfg.effects = [];
  const n = Math.floor(rnd() * 9);
  for (let i = 0; i < n; i++) cfg.effects.push(randomParams(SF.FX_KINDS[pick(SF.FX_KIND_IDS)].params, rnd, { id: SF.newId(), kind: null, on: rnd() < 0.85 }));
  cfg.effects.forEach((l, i) => { l.kind = l.kind || null; });
  // the loop above needs the kind before it can pick params: rebuild properly
  cfg.effects = [];
  for (let i = 0; i < n; i++) {
    const kind = pick(SF.FX_KIND_IDS);
    cfg.effects.push(randomParams(SF.FX_KINDS[kind].params, rnd, { id: SF.newId(), kind, on: rnd() < 0.85 }));
  }
  const c = cfg.combat;
  randomParams(SF.COMBAT_PARAMS, rnd, c);
  SF.ENCHANT_IDS.forEach((id) => { randomParams(SF.ENCHANTS[id].params, rnd, c.enchants[id]); c.enchants[id].on = rnd() < 0.3; });
  randomParams(SF.WAVE_PARAMS, rnd, c.wave);
  cfg.sounds = { swing: rnd() < 0.7, equip: rnd() < 0.7, hit: rnd() < 0.3 ? '1234567' : '' };
  cfg.anim = {
    on: rnd() < 0.75, speed: 0.5 + rnd() * 1.3,
    idle: pick(['none', ...SF.movesOf('idle')]), equip: pick(['none', ...SF.movesOf('equip')]),
    swings: Array.from({ length: Math.floor(rnd() * 7) }, () => pick(SF.movesOf('swing'))),
  };
  return cfg;
}
{
  const rnd = mulberry32(20260502);
  for (let i = 0; i < 80; i++) cases.push({ id: 'fuzz-' + i, cfg: randomCfg(rnd) });
}

/* -------------------------------------------------------------------- main */
let failedCases = 0;
let totalChecks = 0;
const started = Date.now();
for (const mode of ['script', 'commandbar']) {
  for (const c of cases) {
    if (filter && !(c.id + ':' + mode).includes(filter)) continue;
    if (c.scriptOnly && mode !== 'script') continue;
    // command-bar mode is slower to read, so cover presets + kitchen sink + a few shapes
    if (mode === 'commandbar' && !(c.id.startsWith('preset-') || c.id.startsWith('anim-') || c.id === 'move-thrust' || c.id === 'kitchen-sink' || c.id === 'garbage-input' || c.id === 'swing-lunge' || (c.id.startsWith('fuzz-') && Number(c.id.slice(5)) % 4 === 0))) continue;
    const t0 = Date.now();
    let r;
    try {
      r = await runOne(c.id, c.cfg, mode, c.opts);
    } catch (err) {
      r = { problems: ['runner crashed: ' + (err && err.stack ? err.stack : err)], checks: 0, gen: { lines: 0, bytes: 0 } };
    }
    totalChecks += r.checks;
    const ok = r.problems.length === 0;
    if (!ok) failedCases++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${(c.id + ' [' + mode + ']').padEnd(34)} ${String(r.gen.lines).padStart(5)} lines  ${String(r.checks).padStart(3)} checks  ${Date.now() - t0}ms`);
    if (!ok) {
      const unique = [...new Set(r.problems)];
      unique.slice(0, 12).forEach((p) => console.log('        - ' + p));
      if (unique.length > 12) console.log(`        ... and ${unique.length - 12} more`);
    }
  }
}
console.log(`\n${failedCases === 0 ? 'ALL GOOD' : failedCases + ' CASE(S) FAILED'} - ${totalChecks} checks in ${((Date.now() - started) / 1000).toFixed(1)}s`);
process.exit(failedCases === 0 ? 0 : 1);
