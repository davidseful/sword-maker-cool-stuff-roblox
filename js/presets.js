/* ==========================================================================
   Sword Forge - presets.js
   The premade swords. Each one is a partial config: anything left out falls
   back to the defaults (see SF.normalize in data.js).
   ========================================================================== */
(function (SF) {
  'use strict';

  const L = (kind, o) => SF.makeLayer(kind, o);
  const en = (o) => Object.assign({ on: true }, o);

  const presets = [
    {
      id: 'classic', name: 'Knight\'s Longsword', tag: 'Classic',
      blurb: 'Honest steel. A balanced all-rounder with no tricks.',
      cfg: {
        name: 'Knight\'s Longsword',
        blade: { style: 'straight', length: 3.7, width: 0.74, thickness: 0.14, tip: 0.95, fuller: 'groove', color: '#cdd5df', material: 'Metal', accent: '#8190a3' },
        guard: { style: 'cross', width: 2.2, height: 0.3, thickness: 0.42, ends: 'ball', color: '#c9a227', material: 'Metal' },
        grip: { length: 1.15, radius: 0.2, color: '#4a3322', material: 'Fabric', wrap: true, wrapColor: '#24160d' },
        pommel: { style: 'ball', size: 0.54, color: '#c9a227', material: 'Metal' },
        effects: [L('trail', { color1: '#ffffff', color2: '#9fb4cc', life: 0.28, width: 0.9, glow: 0.4 })],
        combat: { damage: 20, cooldown: 0.45, swing: 'combo' },
      },
    },
    {
      id: 'flame', name: 'Flame Tongue', tag: 'Fire',
      blurb: 'A wavy blade of living flame. Burns whatever it cuts.',
      cfg: {
        name: 'Flame Tongue',
        blade: { style: 'wavy', length: 4.2, width: 0.86, thickness: 0.15, tip: 1.0, fuller: 'inlay', color: '#ff6a14', material: 'Neon', accent: '#ffe27a' },
        guard: { style: 'horned', width: 2.3, height: 0.32, thickness: 0.42, color: '#2b1b1a', material: 'Metal' },
        grip: { length: 1.2, radius: 0.21, color: '#241513', material: 'Fabric', wrap: true, wrapColor: '#8a2b12' },
        pommel: { style: 'spike', size: 0.5, color: '#2b1b1a', material: 'Metal' },
        gem: { where: 'guard', color: '#ffae1a', size: 0.3 },
        effects: [
          L('glow', { color: '#ff8a2a', brightness: 3, range: 20, pulse: 1.4 }),
          L('particles', { style: 'flames', where: 'blade', trigger: 'idle', color1: '#ffd24a', color2: '#ff3b00', density: 1.2, size: 1 }),
          L('particles', { style: 'embers', where: 'blade', trigger: 'idle', color1: '#ffb347', color2: '#ff2a00', density: 0.8 }),
          L('particles', { style: 'flames', where: 'blade', trigger: 'burst', color1: '#fff1a8', color2: '#ff4500', count: 26, size: 1.3 }),
          L('particles', { style: 'embers', where: 'tip', trigger: 'hit', color1: '#ffd24a', color2: '#ff2a00', count: 30, speed: 1.6 }),
          L('trail', { color1: '#ffd36b', color2: '#ff2d00', life: 0.45, width: 1.2, glow: 1 }),
        ],
        combat: { damage: 24, cooldown: 0.45, swing: 'combo', enchants: { burn: en({ dps: 7, duration: 4, color: '#ff7a1a' }) } },
      },
    },
    {
      id: 'frost', name: 'Frostbite', tag: 'Ice',
      blurb: 'A shard of eternal winter. Slows everything it touches.',
      cfg: {
        name: 'Frostbite',
        blade: { style: 'crystal', length: 4.0, width: 0.98, thickness: 0.2, tip: 1.2, fuller: 'inlay', color: '#a6e8ff', material: 'Ice', accent: '#5fd8ff', transparency: 0.12 },
        guard: { style: 'winged', width: 2.3, height: 0.3, thickness: 0.36, color: '#e6f5ff', material: 'Metal' },
        grip: { length: 1.1, radius: 0.19, color: '#2c4a6b', material: 'Fabric', wrap: true, wrapColor: '#142a42' },
        pommel: { style: 'ball', size: 0.5, color: '#e6f5ff', material: 'Metal' },
        gem: { where: 'pommel', color: '#52d3ff', size: 0.34 },
        effects: [
          L('glow', { color: '#6fdcff', brightness: 2, range: 16 }),
          L('particles', { style: 'frost', where: 'blade', trigger: 'idle', color1: '#ffffff', color2: '#7fd8ff', density: 1.3 }),
          L('particles', { style: 'frost', where: 'blade', trigger: 'burst', color1: '#ffffff', color2: '#58c9ff', count: 24, speed: 1.8 }),
          L('particles', { style: 'frost', where: 'tip', trigger: 'hit', color1: '#ffffff', color2: '#58c9ff', count: 28, speed: 2 }),
          L('trail', { color1: '#e9fbff', color2: '#34b8ff', life: 0.42, width: 1.1, glow: 0.9 }),
        ],
        combat: { damage: 19, cooldown: 0.45, swing: 'combo', enchants: { freeze: en({ slow: 60, duration: 3, color: '#8fe3ff' }) } },
      },
    },
    {
      id: 'saber', name: 'Plasma Saber', tag: 'Sci-fi',
      blurb: 'An elegant weapon from a more civilised age.',
      cfg: {
        name: 'Plasma Saber',
        blade: { style: 'energy', length: 3.9, width: 0.46, color: '#2f9bff', coreColor: '#ffffff', material: 'Neon' },
        guard: { style: 'none' },
        grip: { length: 1.25, radius: 0.17, color: '#a9b2bd', material: 'Metal', wrap: true, wrapColor: '#2b3036' },
        pommel: { style: 'cap', size: 0.46, color: '#2b3036', material: 'Metal' },
        gem: { where: 'none' },
        effects: [
          L('glow', { color: '#3ea6ff', brightness: 3.2, range: 22, pulse: 0.7 }),
          L('trail', { color1: '#bfe3ff', color2: '#1f6bff', life: 0.38, width: 1.1, glow: 1 }),
          L('particles', { style: 'electric', where: 'tip', trigger: 'hit', color1: '#ffffff', color2: '#33c9ff', count: 24 }),
        ],
        combat: { damage: 22, cooldown: 0.4, swing: 'combo' },
      },
    },
    {
      id: 'crimsonsaber', name: 'Crimson Saber', tag: 'Sci-fi',
      blurb: 'Unstable, crackling and very, very red.',
      cfg: {
        name: 'Crimson Saber',
        blade: { style: 'energy', length: 3.7, width: 0.5, color: '#ff1f2d', coreColor: '#ffe0e0', material: 'Neon' },
        guard: { style: 'winged', width: 1.7, height: 0.2, thickness: 0.3, color: '#23262b', material: 'Metal' },
        grip: { length: 1.2, radius: 0.17, color: '#4a4f57', material: 'Metal', wrap: true, wrapColor: '#14161a' },
        pommel: { style: 'disc', size: 0.4, color: '#14161a', material: 'Metal' },
        effects: [
          L('glow', { color: '#ff2430', brightness: 3.4, range: 22, pulse: 1.5 }),
          L('particles', { style: 'electric', where: 'blade', trigger: 'idle', color1: '#ffffff', color2: '#ff2a3a', density: 0.6 }),
          L('trail', { color1: '#ffb0b0', color2: '#ff0f20', life: 0.4, width: 1.2, glow: 1 }),
        ],
        combat: { damage: 25, cooldown: 0.42, swing: 'combo', enchants: { burn: en({ dps: 4, duration: 3, color: '#ff4020' }) } },
      },
    },
    {
      id: 'shadow', name: 'Shadow Katana', tag: 'Dark',
      blurb: 'Fast, curved and hungry. It drinks a little life with every cut.',
      cfg: {
        name: 'Shadow Katana',
        blade: { style: 'katana', length: 4.0, width: 0.52, thickness: 0.1, tip: 0.7, curve: 9, fuller: 'inlay', color: '#16161f', material: 'Metal', accent: '#8a3cff' },
        guard: { style: 'disc', width: 1.1, height: 0.14, thickness: 0.2, color: '#2a2040', material: 'Metal' },
        grip: { length: 1.25, radius: 0.18, color: '#1b1b24', material: 'Fabric', wrap: true, wrapColor: '#6a2cd1' },
        pommel: { style: 'cap', size: 0.46, color: '#2a2040', material: 'Metal' },
        effects: [
          L('glow', { color: '#8a3cff', brightness: 1.6, range: 14 }),
          L('particles', { style: 'void', where: 'blade', trigger: 'idle', color1: '#8a3cff', color2: '#0a0014', density: 1 }),
          L('particles', { style: 'souls', where: 'tip', trigger: 'hit', color1: '#d5b3ff', color2: '#7a1fff', count: 22 }),
          L('trail', { color1: '#c9a3ff', color2: '#4a0fb0', life: 0.4, width: 1, glow: 0.9 }),
        ],
        combat: { damage: 18, cooldown: 0.33, swing: 'combo', enchants: { lifesteal: en({ pct: 25 }) } },
      },
    },
    {
      id: 'excalibur', name: 'Excalibur', tag: 'Holy',
      blurb: 'The sword of kings. Heals its wielder and throws golden waves.',
      cfg: {
        name: 'Excalibur',
        blade: { style: 'broad', length: 4.1, width: 0.95, thickness: 0.18, tip: 0.95, fuller: 'inlay', color: '#f3f1e6', material: 'Metal', accent: '#ffd45a' },
        guard: { style: 'winged', width: 2.7, height: 0.34, thickness: 0.42, ends: 'ball', color: '#e7b923', material: 'Metal' },
        grip: { length: 1.2, radius: 0.2, color: '#1f3f8f', material: 'Fabric', wrap: true, wrapColor: '#e7b923' },
        pommel: { style: 'ball', size: 0.58, color: '#e7b923', material: 'Metal' },
        gem: { where: 'all', color: '#52b6ff', size: 0.3 },
        effects: [
          L('glow', { color: '#ffe38a', brightness: 2.4, range: 18, pulse: 0.5 }),
          L('particles', { style: 'holy', where: 'blade', trigger: 'idle', color1: '#fff6c2', color2: '#ffc83d', density: 1.2 }),
          L('particles', { style: 'holy', where: 'blade', trigger: 'equip', color1: '#ffffff', color2: '#ffd45a', count: 40, size: 1.4 }),
          L('trail', { color1: '#fff7cf', color2: '#ffbd1f', life: 0.42, width: 1.2, glow: 1 }),
        ],
        combat: {
          damage: 26, cooldown: 0.5, swing: 'combo',
          enchants: { lifesteal: en({ pct: 15 }) },
          wave: { mode: 'finisher', damage: 30, speed: 95, range: 80, size: 7, angle: 90, color: '#ffe38a' },
        },
      },
    },
    {
      id: 'thunder', name: 'Thunder Brand', tag: 'Lightning',
      blurb: 'Crackles with a storm. Calls lightning down on its victims.',
      cfg: {
        name: 'Thunder Brand',
        blade: { style: 'saber', length: 3.7, width: 0.8, thickness: 0.13, tip: 0.85, curve: 14, fuller: 'inlay', color: '#2a3550', material: 'Metal', accent: '#ffe94d' },
        guard: { style: 'crescent', width: 2.2, height: 0.26, thickness: 0.34, color: '#7482a8', material: 'Metal' },
        grip: { length: 1.15, radius: 0.19, color: '#1c2236', material: 'Fabric', wrap: true, wrapColor: '#ffd91f' },
        pommel: { style: 'ball', size: 0.5, color: '#7482a8', material: 'Metal' },
        gem: { where: 'guard', color: '#ffe94d', size: 0.28 },
        effects: [
          L('glow', { color: '#ffe55a', brightness: 2.6, range: 18, pulse: 3.2 }),
          L('arcs', { color: '#8be9ff', count: 3, amp: 1.2, speed: 16 }),
          L('particles', { style: 'electric', where: 'blade', trigger: 'idle', color1: '#ffffff', color2: '#ffe14d', density: 0.8 }),
          L('particles', { style: 'electric', where: 'tip', trigger: 'hit', color1: '#ffffff', color2: '#33c9ff', count: 30, speed: 1.6 }),
          L('trail', { color1: '#fff6a8', color2: '#35c4ff', life: 0.36, width: 1, glow: 1 }),
        ],
        combat: { damage: 21, cooldown: 0.42, swing: 'combo', enchants: { lightning: en({ damage: 14, color: '#9ff0ff' }), stun: en({ duration: 0.6, color: '#ffe14d' }) } },
      },
    },
    {
      id: 'venom', name: 'Venom Fang', tag: 'Poison',
      blurb: 'Serrated and dripping. The poison keeps working long after.',
      cfg: {
        name: 'Venom Fang',
        blade: { style: 'serrated', length: 3.6, width: 0.8, thickness: 0.14, tip: 0.9, serrated: 6, fuller: 'inlay', color: '#46c33a', material: 'Neon', accent: '#d7ff6a' },
        guard: { style: 'crescent', width: 2.0, height: 0.28, thickness: 0.34, color: '#1f2a1f', material: 'Metal' },
        grip: { length: 1.15, radius: 0.2, color: '#1d2b1b', material: 'Fabric', wrap: true, wrapColor: '#5fbe3a' },
        pommel: { style: 'spike', size: 0.5, color: '#1f2a1f', material: 'Metal' },
        gem: { where: 'pommel', color: '#9dff3c', size: 0.3 },
        effects: [
          L('glow', { color: '#6dff3a', brightness: 2, range: 16, pulse: 0.8 }),
          L('particles', { style: 'toxic', where: 'blade', trigger: 'idle', color1: '#a6ff4d', color2: '#1e6b00', density: 1.1 }),
          L('particles', { style: 'toxic', where: 'tip', trigger: 'hit', color1: '#c3ff6a', color2: '#2a8a00', count: 26 }),
          L('trail', { color1: '#c8ff7a', color2: '#1e8a00', life: 0.4, width: 1, glow: 0.8 }),
        ],
        combat: { damage: 17, cooldown: 0.4, swing: 'combo', enchants: { poison: en({ dps: 6, duration: 6, color: '#7be04a' }) } },
      },
    },
    {
      id: 'crimson', name: 'Crimson Reaper', tag: 'Vampire',
      blurb: 'Heavy, hungry and red. Heals big on every hit.',
      cfg: {
        name: 'Crimson Reaper',
        blade: { style: 'cleaver', length: 3.4, width: 1.15, thickness: 0.2, tip: 1.0, fuller: 'inlay', color: '#2a0d12', material: 'Metal', accent: '#ff1f3d' },
        guard: { style: 'crescent', width: 2.4, height: 0.32, thickness: 0.4, color: '#121014', material: 'Metal' },
        grip: { length: 1.2, radius: 0.21, color: '#16090c', material: 'Fabric', wrap: true, wrapColor: '#a0102a' },
        pommel: { style: 'ball', size: 0.56, color: '#a0102a', material: 'Neon' },
        effects: [
          L('glow', { color: '#ff1f3d', brightness: 2.2, range: 16, pulse: 1.1 }),
          L('particles', { style: 'blood', where: 'blade', trigger: 'idle', color1: '#ff2a44', color2: '#3a0008', density: 1 }),
          L('particles', { style: 'blood', where: 'tip', trigger: 'hit', color1: '#ff3a52', color2: '#5a0010', count: 26 }),
          L('trail', { color1: '#ff6a7e', color2: '#7a0018', life: 0.4, width: 1.3, glow: 0.7 }),
        ],
        combat: { damage: 28, cooldown: 0.6, swing: 'combo', finisher: 1.7, enchants: { lifesteal: en({ pct: 35 }), knockback: en({ power: 28 }) } },
      },
    },
    {
      id: 'rainbow', name: 'Prism Blade', tag: 'Fun',
      blurb: 'Every color, all the time. Pure party.',
      cfg: {
        name: 'Prism Blade',
        blade: { style: 'leaf', length: 3.8, width: 0.95, thickness: 0.15, tip: 1.0, fuller: 'inlay', color: '#ffffff', material: 'Neon', accent: '#ffffff', transparency: 0.1 },
        guard: { style: 'winged', width: 2.2, height: 0.28, thickness: 0.36, ends: 'ball', color: '#f5f5ff', material: 'SmoothPlastic' },
        grip: { length: 1.15, radius: 0.2, color: '#2a2a3a', material: 'Fabric', wrap: true, wrapColor: '#f5f5ff' },
        pommel: { style: 'ball', size: 0.54, color: '#f5f5ff', material: 'SmoothPlastic' },
        gem: { where: 'all', color: '#ffffff', size: 0.3 },
        effects: [
          L('rainbow', { speed: 0.7 }),
          L('aura', { color: '#ffffff', size: 0.16, transparency: 0.6, pulse: 1.2 }),
          L('glow', { color: '#ffffff', brightness: 2.4, range: 18 }),
          L('particles', { style: 'rainbow', where: 'blade', trigger: 'idle', density: 1.3 }),
          L('particles', { style: 'rainbow', where: 'blade', trigger: 'burst', count: 30, speed: 1.6 }),
          L('trail', { color1: '#ffffff', color2: '#ffffff', life: 0.5, width: 1.3, glow: 1 }),
        ],
        combat: { damage: 16, cooldown: 0.4, swing: 'combo', enchants: { knockback: en({ power: 22 }) } },
      },
    },
    {
      id: 'titan', name: 'Titan Greatsword', tag: 'Heavy',
      blurb: 'Slow, enormous and devastating. Hits go boom.',
      cfg: {
        name: 'Titan Greatsword',
        scale: 1.25,
        blade: { style: 'claymore', length: 5.4, width: 1.1, thickness: 0.22, tip: 1.2, fuller: 'groove', color: '#7d8794', material: 'DiamondPlate', accent: '#454c57' },
        guard: { style: 'cross', width: 3.2, height: 0.42, thickness: 0.55, ends: 'ball', color: '#3a3f48', material: 'Metal' },
        grip: { length: 1.7, radius: 0.24, color: '#2b2118', material: 'Fabric', wrap: true, wrapColor: '#58452e' },
        pommel: { style: 'disc', size: 0.7, color: '#3a3f48', material: 'Metal' },
        effects: [
          L('particles', { style: 'smoke', where: 'blade', trigger: 'swing', color1: '#9a9a9a', color2: '#2f2f2f', density: 1.4, size: 1.2 }),
          L('particles', { style: 'embers', where: 'tip', trigger: 'hit', color1: '#ffd9a0', color2: '#ff7a1a', count: 36, speed: 1.8 }),
          L('trail', { color1: '#ffffff', color2: '#8a94a3', life: 0.5, width: 1.4, glow: 0.3 }),
        ],
        combat: {
          damage: 42, cooldown: 0.85, swing: 'combo', finisher: 1.8, dash: 12,
          enchants: { knockback: en({ power: 60 }), explosion: en({ damage: 14, size: 7 }) },
          wave: { mode: 'finisher', damage: 35, speed: 70, range: 60, size: 9, angle: 90, color: '#ffcf8a' },
        },
      },
    },
    {
      id: 'void', name: 'Void Reaver', tag: 'Dark',
      blurb: 'Cut from the space between stars. Fires waves of nothing.',
      cfg: {
        name: 'Void Reaver',
        blade: { style: 'wavy', length: 4.3, width: 0.9, thickness: 0.15, tip: 1.0, fuller: 'inlay', color: '#0c0614', material: 'SmoothPlastic', accent: '#e23bff' },
        guard: { style: 'horned', width: 2.4, height: 0.3, thickness: 0.4, color: '#1a0f26', material: 'Metal' },
        grip: { length: 1.2, radius: 0.2, color: '#12081c', material: 'Fabric', wrap: true, wrapColor: '#7a1fff' },
        pommel: { style: 'ball', size: 0.52, color: '#e23bff', material: 'Neon' },
        gem: { where: 'guard', color: '#e23bff', size: 0.3 },
        effects: [
          L('aura', { color: '#9b2cff', size: 0.13, transparency: 0.62, pulse: 1.1 }),
          L('outline', { color: '#e23bff', fill: '#7a1fff', fillT: 0.9, outlineT: 0.15 }),
          L('glow', { color: '#b13cff', brightness: 2.4, range: 18, pulse: 0.9 }),
          L('particles', { style: 'void', where: 'blade', trigger: 'idle', color1: '#9b2cff', color2: '#05000a', density: 1.2 }),
          L('particles', { style: 'souls', where: 'blade', trigger: 'idle', color1: '#f0c7ff', color2: '#b13cff', density: 0.6 }),
          L('arcs', { color: '#e9a3ff', count: 2, amp: 1, speed: 12 }),
          L('trail', { color1: '#f0c7ff', color2: '#5a0fb0', life: 0.5, width: 1.2, glow: 1 }),
        ],
        combat: {
          damage: 27, cooldown: 0.46, swing: 'combo',
          enchants: { stun: en({ duration: 0.5, color: '#e9a3ff' }) },
          wave: { mode: 'finisher', damage: 32, speed: 85, range: 75, size: 7, angle: 90, color: '#b13cff' },
        },
      },
    },
    {
      id: 'dagger', name: 'Assassin\'s Fang', tag: 'Fast',
      blurb: 'Tiny, quick and poisonous. Swing it like crazy.',
      cfg: {
        name: 'Assassin\'s Fang',
        blade: { style: 'dagger', length: 2.0, width: 0.5, thickness: 0.11, tip: 0.75, fuller: 'groove', color: '#aeb7c2', material: 'Metal', accent: '#444c58' },
        guard: { style: 'drooped', width: 1.4, height: 0.2, thickness: 0.28, color: '#2a2e35', material: 'Metal' },
        grip: { length: 0.9, radius: 0.17, color: '#2a1d2e', material: 'Fabric', wrap: true, wrapColor: '#1a1020' },
        pommel: { style: 'ball', size: 0.4, color: '#2a2e35', material: 'Metal' },
        effects: [L('trail', { color1: '#d7ffd0', color2: '#3ec44a', life: 0.25, width: 0.9, glow: 0.8 })],
        combat: { damage: 11, cooldown: 0.22, swing: 'slash', enchants: { poison: en({ dps: 3, duration: 4, color: '#7be04a' }) } },
      },
    },
  ];

  /* the moves that suit each sword: [idle stance, equip flourish, speed, ...swings] */
  const MOVES = {
    classic: ['ready', 'draw', 1, 'diag', 'slash_b', 'chop'],
    flame: ['flow', 'twirl', 1, 'slash_h', 'rising', 'smash'],
    frost: ['guard', 'salute', 1.05, 'slash_h', 'cross', 'thrust'],
    saber: ['two_hand', 'twirl', 1.25, 'diag', 'slash_b', 'spin'],
    crimsonsaber: ['ready', 'twirl', 1.2, 'slash_h', 'rising', 'cross'],
    shadow: ['low', 'draw', 1.1, 'iaido', 'slash_b', 'cross'],
    excalibur: ['guard', 'salute', 0.95, 'chop', 'diag', 'smash'],
    thunder: ['flow', 'stomp', 1.15, 'diag', 'slash_h', 'spin'],
    venom: ['ready', 'draw', 1.2, 'jab', 'slash_b', 'thrust'],
    crimson: ['rest', 'stomp', 1, 'rising', 'slash_h', 'whirl'],
    rainbow: ['flow', 'twirl', 1.1, 'flurry', 'spin', 'cross'],
    titan: ['two_hand', 'stomp', 0.85, 'chop', 'slash_h', 'smash'],
    void: ['low', 'stomp', 1, 'slash_b', 'whirl', 'thrust'],
    dagger: ['ready', 'draw', 1.5, 'jab', 'flurry', 'jab'],
  };
  presets.forEach((p) => {
    const m = MOVES[p.id];
    if (m) p.cfg.anim = { on: true, idle: m[0], equip: m[1], speed: m[2], swings: m.slice(3) };
  });

  SF.PRESETS = presets.map((p) => Object.assign({}, p, { cfg: SF.normalize(p.cfg) }));
  SF.presetById = (id) => SF.PRESETS.find((p) => p.id === id);
})((globalThis.SF = globalThis.SF || {}));
