/* ==========================================================================
   Sword Forge - luau.js
   Config -> finished Luau script.

   Two output modes:
     'script'     one Script for ServerScriptService. Builds + gives the sword to
                  every player at runtime. (Easiest: paste, press Play.)
     'commandbar' paste into Studio's Command Bar once; it builds the sword as
                  a real Tool in StarterPack with its own Script inside.
   ========================================================================== */
(function (SF) {
  'use strict';

  /* ------------------------------------------------------------ serializing */
  const KEYWORDS = new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while', 'continue']);

  function luaStr(s) {
    s = String(s);
    let out = '"';
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (ch === '\\') out += '\\\\';
      else if (ch === '"') out += '\\"';
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else if (c < 32 || c === 127) out += '';
      else out += ch;
    }
    return out + '"';
  }
  function luaNum(n) {
    if (!isFinite(n)) return '0';
    let s = String(Math.round(n * 10000) / 10000);
    if (s.indexOf('e') >= 0) s = '0';
    if (s === '-0') s = '0';
    return s;
  }
  function luaKey(k) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && !KEYWORDS.has(k) ? k : '[' + luaStr(k) + ']';
  }

  /* mode: 'auto' (inline when short), 'inline', 'rows' (each element inline on its own line) */
  function ser(v, level, mode) {
    mode = mode || 'auto';
    const pad = '\t'.repeat(level + 1);
    const padEnd = '\t'.repeat(level);
    if (v === null || v === undefined) return 'nil';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return luaNum(v);
    if (typeof v === 'string') return luaStr(v);
    if (Array.isArray(v)) {
      if (!v.length) return '{}';
      const inline = '{' + v.map((x) => ser(x, level + 1, 'inline')).join(', ') + '}';
      if (mode === 'inline' || v.every((x) => typeof x === 'number') || (mode === 'auto' && inline.length <= 96)) return inline;
      const sub = mode === 'rows' ? 'inline' : 'auto';
      return '{\n' + v.map((x) => pad + ser(x, level + 1, sub) + ',').join('\n') + '\n' + padEnd + '}';
    }
    const keys = Object.keys(v).filter((k) => v[k] !== undefined);
    if (!keys.length) return '{}';
    const inline = '{ ' + keys.map((k) => luaKey(k) + ' = ' + ser(v[k], level + 1, 'inline')).join(', ') + ' }';
    if (mode === 'inline' || (mode === 'auto' && inline.length <= 96)) return inline;
    return '{\n' + keys.map((k) => pad + luaKey(k) + ' = ' + ser(v[k], level + 1, k === 'Parts' || k === 'keys' ? 'rows' : 'auto') + ',').join('\n') + '\n' + padEnd + '}';
  }
  SF.luaSerialize = (v, level, mode) => ser(v, level || 0, mode);
  SF.luaStr = luaStr;

  /* ------------------------------------------------------------- data tables */
  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function buildData(model, cfg) {
    const fx = model.effects;
    const hasRainbow = fx.some((e) => e.kind === 'rainbow');

    const parts = model.parts.map((p) => {
      const o = { n: p.n, s: p.s, sz: p.sz, p: p.p, r: p.r, c: SF.hex2rgb(p.c), m: p.m, t: p.t, rf: p.rf };
      if (p.main) o.main = true;
      if (p.rainbow && hasRainbow) o.rb = true;
      if (p.auraPulse > 0) o.ap = p.auraPulse;
      return o;
    });

    const effects = fx.filter((e) => ['glow', 'particles', 'trail', 'outline', 'arcs', 'rainbow'].includes(e.kind));
    // drop fields that only the preview needs
    const cleanEffects = effects.map((e) => {
      const o = Object.assign({}, e);
      delete o.style;
      return o;
    });

    const config = {
      Name: cfg.name,
      Tilt: cfg.hold.tilt,
      Parts: parts,
      Hitbox: { sz: model.hitbox.size, p: model.hitbox.pos },
      Trail: { a: model.trail.a, b: model.trail.b },
      Tip: model.tip,
      Hilt: model.hilt,
      Sounds: {
        Swing: cfg.sounds.swing ? 'rbxasset://sounds/swordslash.wav' : '',
        Lunge: cfg.sounds.swing ? 'rbxasset://sounds/swordlunge.wav' : '',
        Equip: cfg.sounds.equip ? 'rbxasset://sounds/unsheath.wav' : '',
        Hit: cfg.sounds.hit ? 'rbxassetid://' + cfg.sounds.hit : '',
      },
      Effects: cleanEffects,
    };

    const c = cfg.combat;
    const stats = {
      Damage: c.damage,
      Cooldown: c.cooldown,
      SwingStyle: cap(c.swing),
      FinisherMultiplier: c.finisher,
      LungeDash: c.dash,
      FriendlyFire: c.friendlyFire,
    };

    const enchants = {};
    SF.ENCHANT_IDS.forEach((id) => {
      const e = c.enchants[id];
      if (!e.on) return;
      const o = {};
      SF.ENCHANTS[id].params.forEach((p) => {
        o[p.k] = p.t === 'color' ? SF.hex2rgb(e[p.k]) : e[p.k];
      });
      if (id === 'burn') o.color2 = SF.hex2rgb(SF.darken(e.color, 0.45));
      enchants[id] = o;
    });

    const w = c.wave;
    const wave = w.mode === 'off' ? null : {
      damage: w.damage, speed: w.speed, range: w.range, size: w.size, angle: w.angle, color: SF.hex2rgb(w.color),
    };

    // does anything need the animated-effects loop?
    const needsLoops = hasRainbow || fx.some((e) => (e.kind === 'glow' && e.pulse > 0) || e.kind === 'arcs') || parts.some((p) => p.ap);

    const anim = SF.animData(cfg.anim);
    return { config, stats, enchants, wave, waveMode: w.mode, needsLoops, effects, anim };
  }

  /* ----------------------------------------------------------- code blocks */
  const E = () => SF.ENGINE;

  function combatDataBlock(d) {
    const out = [];
    out.push('local STATS = ' + ser(d.stats, 0) + '\n');
    const keys = Object.keys(d.enchants);
    if (keys.length) out.push('local ENCHANT_CFG = ' + ser(d.enchants, 0) + '\n');
    out.push('local WAVE_MODE = ' + luaStr(d.waveMode));
    if (d.wave) out.push('local WAVE = ' + ser(d.wave, 0));
    if (d.anim) out.push('\nlocal ANIMATION = ' + ser(animTable(d.anim), 0));
    return out.join('\n');
  }

  /* the moves, in the order they read best in the script */
  function animTable(a) {
    return { speed: a.speed, swings: a.swings, idle: a.idle, equip: a.equip, moves: a.moves };
  }

  function combatCode(d) {
    const e = E();
    const names = Object.keys(d.enchants);
    const has = (...k) => k.some((x) => names.includes(x));
    const blocks = [];
    blocks.push(e.combatServices);
    blocks.push(e.combatUtil);
    if (has('burn', 'poison')) blocks.push(e.enchantUtil.dot);
    if (has('freeze', 'stun', 'lifesteal')) blocks.push(e.enchantUtil.status);
    if (has('freeze', 'stun')) blocks.push(e.enchantUtil.movement);
    SF.ENCHANT_IDS.forEach((id) => {
      if (names.includes(id)) blocks.push(e.enchants[id]);
    });
    blocks.push(d.needsLoops ? e.loops : e.loopsStub);
    const A = d.anim ? { swings: d.anim.swings.length > 0 } : null;
    blocks.push(e.combatA(A) + (d.wave ? e.wave : e.waveStub) + '\n' + e.combatB(A));
    return blocks.join('\n\n');
  }

  function builderCode(d) {
    const e = E();
    const blocks = [e.builderTop];
    const kinds = [];
    d.config.Effects.forEach((fx) => {
      if (!kinds.includes(fx.kind)) kinds.push(fx.kind);
    });
    kinds.forEach((k) => {
      if (e.fx[k]) blocks.push(e.fx[k]);
    });
    blocks.push(e.builderMain);
    return blocks.join('\n\n');
  }

  /* Drops helper functions that nothing uses, so the script has no dead code. */
  function pruneHelpers(helpers, rest) {
    let blocks = helpers.split(/\n\n(?=(?:--[^\n]*\n)*local function )/);
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = blocks.length - 1; i >= 0; i--) {
        const m = blocks[i].match(/local function (\w+)\(/);
        if (!m) continue;
        const re = new RegExp('\\b' + m[1] + '\\b');
        const others = blocks.filter((_, j) => j !== i).join('\n') + '\n' + rest;
        if (!re.test(others)) {
          blocks.splice(i, 1);
          changed = true;
        }
      }
    }
    return blocks.join('\n\n');
  }

  function banner_anim() {
    return '-- Animations. Each move is a few keyframes: at time t (0..1 of the move) these body parts are turned by this many degrees.\n'
      + '-- ra right arm, wr wrist, la left arm, to torso, he head, rl / ll legs, dy / dz body height / forward (studs).\n'
      + '-- swings = the combo in order, idle = the stance, equip = the flourish. "" means none. speed 1 = normal.';
  }

  function banner(title, sub) {
    const line = '-- ' + '='.repeat(76);
    return line + '\n--  ' + title + (sub ? '\n--  ' + sub : '') + '\n' + line;
  }

  function pickDelimiter(text) {
    for (let n = 2; n < 12; n++) {
      const eq = '='.repeat(n);
      if (text.indexOf(']' + eq + ']') < 0) return eq;
    }
    return '==========';
  }

  /* ------------------------------------------------------------ the generator */
  SF.generate = function (cfgIn, modeIn) {
    const model = SF.buildModel(cfgIn);
    const cfg = model.cfg;
    const mode = modeIn === 'commandbar' ? 'commandbar' : 'script';
    const d = buildData(model, cfg);
    const e = E();
    const name = cfg.name;
    const out = [];

    if (mode === 'script') {
      out.push([
        '-- ' + name + '  -  made with Sword Forge',
        '--',
        '-- HOW TO USE (takes 30 seconds):',
        '--   1. In Roblox Studio open the Explorer  (View > Explorer).',
        '--   2. Hover over ServerScriptService, click the + button and add a  Script.',
        '--   3. Delete the default code, paste ALL of this in, then press Play.',
        '--   4. The sword is in your hotbar: press 1 (or tap it), then click to swing!',
        '--',
        '-- Want to tweak it? Change the numbers in STATS (damage, cooldown ...),',
        '-- ENCHANT_CFG and CONFIG below, then press Play again.',
      ].concat(d.anim ? [
        '--',
        '-- ANIMATIONS: this sword moves your character (swings, stance, flourish). That needs one more piece:',
        '--   inside this Script, add a LocalScript named  SwordForgeAnimator  and paste the animator code into it.',
        '--   (Skip it and the sword still works with Roblox\'s normal swing. The "Studio file" download has it built in.)',
      ] : []).join('\n'));
    } else {
      out.push([
        '-- ' + name + '  -  made with Sword Forge  (Command Bar builder)',
        '--',
        '-- HOW TO USE (takes 30 seconds):',
        '--   1. In Roblox Studio open  View > Command Bar.',
        '--   2. Copy ALL of this, paste it into the Command Bar and press Enter.',
        '--   3. The sword is built into StarterPack (look in the Explorer).',
        '--      Press Play and it is in your hotbar. You can now edit its parts,',
        '--      change Attributes (damage ...) or save it to your Toolbox.',
      ].concat(d.anim ? [
        '--   It also adds a LocalScript called SwordForgeAnimator to StarterPlayerScripts: that is what plays the animations.',
      ] : []).join('\n'));
    }

    out.push('\n' + banner('1. YOUR SWORD', 'Numbers you can tweak.') + '\n');
    out.push('local STATS = ' + ser(d.stats, 0));
    out.push('');
    if (mode === 'script') {
      if (Object.keys(d.enchants).length) out.push('local ENCHANT_CFG = ' + ser(d.enchants, 0) + '\n');
      out.push('local WAVE_MODE = ' + luaStr(d.waveMode));
      if (d.wave) out.push('local WAVE = ' + ser(d.wave, 0));
      if (d.anim) out.push('\n' + banner_anim() + '\nlocal ANIMATION = ' + ser(animTable(d.anim), 0));
      out.push('');
    }
    out.push('local CONFIG = ' + ser(d.config, 0));

    const builder = builderCode(d);
    const combat = combatCode(d);

    out.push('\n' + banner('2. HELPERS') + '\n');
    out.push(pruneHelpers(e.helpers, mode === 'script' ? builder + '\n' + combat : builder));

    out.push('\n' + banner('3. BUILDER', 'Turns CONFIG into a real Tool (parts, welds, effects).') + '\n');
    out.push(builder);

    if (mode === 'script') {
      out.push('\n' + banner('4. COMBAT', 'Swings, damage and special powers.') + '\n');
      out.push(combat);
      out.push('\n' + banner('5. GIVE THE SWORD TO PLAYERS') + '\n');
      if (d.anim) out.push(e.animatorInstall + '\n');
      out.push(e.delivery);
    } else {
      // the combat code becomes the Script that lives inside the Tool
      const chunk = [
        '-- ' + name + ' - sword script (made with Sword Forge)',
        '-- Swings, damage and special powers. Stats can also be changed in the Tool\'s Attributes.',
        '',
        combatDataBlock(d),
        '',
        pruneHelpers(e.helpers, combat),
        '',
        d.anim ? combat.replace('local animatorReady = false', 'local animatorReady = true -- the builder also puts SwordForgeAnimator into StarterPlayerScripts') : combat,
        '',
        'setupCombat(script.Parent)',
        '',
      ].join('\n');
      const eq = pickDelimiter(chunk);
      out.push('\n' + banner('4. THE SCRIPT THAT GOES INSIDE THE TOOL') + '\n');
      out.push('local COMBAT_SOURCE = [' + eq + '[\n' + chunk + ']' + eq + ']');
      if (d.anim) {
        const aeq = pickDelimiter(e.animator);
        out.push('\n' + banner('4b. THE ANIMATOR (a LocalScript that turns the joints)') + '\n');
        out.push('local ANIMATOR_SOURCE = [' + aeq + '[\n' + e.animator + ']' + aeq + ']');
      }
      out.push('\n' + banner('5. BUILD IT') + '\n');
      out.push(e.install + (d.anim ? '\n' + e.installAnimator : ''));
    }

    const code = out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
    return {
      code, mode, model, animator: d.anim ? e.animator : null,
      lines: code.split('\n').length - 1,
      bytes: code.length,
    };
  };

  /* quick lookup used by the UI to show what the sword contains */
  SF.describe = function (cfgIn) {
    const m = SF.buildModel(cfgIn);
    const cfg = m.cfg;
    const bits = [];
    const names = SF.ENCHANT_IDS.filter((id) => cfg.combat.enchants[id].on).map((id) => SF.ENCHANTS[id].label);
    if (names.length) bits.push(names.join(', '));
    if (cfg.combat.wave.mode !== 'off') bits.push('Sword wave');
    // animations: the names of what plays (empty when the sword just uses Roblox's own swing)
    const an = cfg.anim, moves = [];
    if (an.on) {
      if (an.swings.length) moves.push(an.swings.length + (an.swings.length === 1 ? ' swing' : ' swings'));
      if (an.idle !== 'none') moves.push(SF.MOVES[an.idle].label.toLowerCase());
      if (an.equip !== 'none') moves.push(SF.MOVES[an.equip].label.toLowerCase());
    }
    return { parts: m.stats.parts, length: m.stats.length, effects: m.effects.length, powers: bits, animations: moves };
  };
})((globalThis.SF = globalThis.SF || {}));
