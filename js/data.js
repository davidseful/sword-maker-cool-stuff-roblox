/* ==========================================================================
   Sword Forge - data.js
   Constants, option lists, effect/enchant schemas, defaults and normalising.
   Pure data + tiny helpers: no DOM access, so it also loads in Node (tests).
   ========================================================================== */
(function (SF) {
  'use strict';

  SF.VERSION = 1;

  /* ------------------------------------------------------------------ colors */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  SF.clamp = clamp;

  function hex2rgb(hex) {
    let h = String(hex || '#000000').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '000000';
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgb2hex(rgb) {
    return '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function mixHex(a, b, t) {
    return rgb2hex(mixRgb(hex2rgb(a), hex2rgb(b), t));
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  function hsl2hex(h, s, l) {
    return rgb2hex(hsl2rgb(h, s, l));
  }
  function rgb2hsl(rgb) {
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function lighten(hex, amt) {
    return mixHex(hex, '#ffffff', amt);
  }
  function darken(hex, amt) {
    return mixHex(hex, '#000000', amt);
  }
  Object.assign(SF, { hex2rgb, rgb2hex, mixRgb, mixHex, hsl2rgb, hsl2hex, rgb2hsl, lighten, darken });

  /* --------------------------------------------------------------- materials */
  // Every value is a real Enum.Material name (the Luau engine also falls back to Plastic if one is missing).
  SF.MATERIALS = [
    ['SmoothPlastic', 'Smooth Plastic'],
    ['Plastic', 'Plastic'],
    ['Metal', 'Metal'],
    ['DiamondPlate', 'Diamond Plate'],
    ['Foil', 'Foil'],
    ['CorrodedMetal', 'Corroded Metal'],
    ['Wood', 'Wood'],
    ['WoodPlanks', 'Wood Planks'],
    ['Fabric', 'Fabric'],
    ['Marble', 'Marble'],
    ['Granite', 'Granite'],
    ['Slate', 'Slate'],
    ['Basalt', 'Basalt'],
    ['Ice', 'Ice'],
    ['Glacier', 'Glacier'],
    ['Glass', 'Glass'],
    ['CrackedLava', 'Cracked Lava'],
    ['Neon', 'Neon (glows)'],
    ['ForceField', 'Force Field'],
  ];
  SF.MATERIAL_IDS = SF.MATERIALS.map((m) => m[0]);

  /* Look used by the preview renderer: [specular, shininess, metalTint, emissive, alphaDefault]. */
  SF.MATERIAL_LOOK = {
    SmoothPlastic: { spec: 0.35, shin: 40, metal: 0, emit: 0 },
    Plastic: { spec: 0.18, shin: 18, metal: 0, emit: 0 },
    Metal: { spec: 1.0, shin: 70, metal: 0.8, emit: 0 },
    DiamondPlate: { spec: 0.85, shin: 50, metal: 0.7, emit: 0 },
    Foil: { spec: 1.1, shin: 90, metal: 0.9, emit: 0 },
    CorrodedMetal: { spec: 0.35, shin: 18, metal: 0.4, emit: 0 },
    Wood: { spec: 0.05, shin: 8, metal: 0, emit: 0 },
    WoodPlanks: { spec: 0.05, shin: 8, metal: 0, emit: 0 },
    Fabric: { spec: 0.0, shin: 4, metal: 0, emit: 0 },
    Marble: { spec: 0.5, shin: 40, metal: 0, emit: 0 },
    Granite: { spec: 0.15, shin: 14, metal: 0, emit: 0 },
    Slate: { spec: 0.15, shin: 14, metal: 0, emit: 0 },
    Basalt: { spec: 0.12, shin: 12, metal: 0, emit: 0 },
    Ice: { spec: 0.9, shin: 60, metal: 0.1, emit: 0.08 },
    Glacier: { spec: 0.7, shin: 50, metal: 0.1, emit: 0.05 },
    Glass: { spec: 1.0, shin: 90, metal: 0.2, emit: 0.0 },
    CrackedLava: { spec: 0.1, shin: 10, metal: 0, emit: 0.55 },
    Neon: { spec: 0.0, shin: 1, metal: 0, emit: 1.0 },
    ForceField: { spec: 0.4, shin: 30, metal: 0, emit: 0.85 },
  };

  /* ------------------------------------------------------------ small option lists */
  SF.GUARD_STYLES = [
    ['cross', 'Crossguard'],
    ['winged', 'Winged'],
    ['drooped', 'Drooped'],
    ['crescent', 'Crescent'],
    ['horned', 'Horned'],
    ['disc', 'Disc (tsuba)'],
    ['none', 'None'],
  ];
  SF.POMMEL_STYLES = [
    ['ball', 'Ball'],
    ['disc', 'Disc'],
    ['cap', 'Cap'],
    ['spike', 'Spike'],
    ['none', 'None'],
  ];
  SF.GEM_PLACES = [
    ['none', 'No gem'],
    ['guard', 'Guard'],
    ['pommel', 'Pommel'],
    ['blade', 'Blade'],
    ['all', 'Everywhere'],
  ];
  SF.FULLER_STYLES = [
    ['none', 'None'],
    ['groove', 'Groove (two-tone)'],
    ['inlay', 'Glowing inlay'],
  ];
  SF.SWING_STYLES = [
    ['combo', '3-hit combo'],
    ['slash', 'Slash'],
    ['lunge', 'Lunge'],
  ];

  /* ------------------------------------------------------------- blade styles
     body : [[fractionAlongBody, widthFraction], ...]      (width fraction of blade.width)
     tip  : 'point' (symmetric) | 'clip' (one-sided clipped point)
     The "defaults" are applied when the user picks the style in the UI.      */
  SF.BLADE_STYLES = {
    straight: {
      label: 'Longsword', desc: 'Classic double-edged blade.',
      body: [[0, 1], [1, 1]], tip: 'point',
      defaults: { length: 3.6, width: 0.72, thickness: 0.14, tip: 0.95, curve: 0, taper: 0, serrated: 0 },
    },
    broad: {
      label: 'Broadsword', desc: 'Wide, heavy and proud.',
      body: [[0, 1], [1, 0.92]], tip: 'point',
      defaults: { length: 3.4, width: 1.15, thickness: 0.2, tip: 0.8, curve: 0, taper: 0, serrated: 0 },
    },
    leaf: {
      label: 'Leaf blade', desc: 'Bulges in the middle, like a leaf.',
      body: [[0, 0.5], [0.42, 1], [1, 0.84]], tip: 'point',
      defaults: { length: 3.5, width: 0.95, thickness: 0.14, tip: 1.0, curve: 0, taper: 0, serrated: 0 },
    },
    katana: {
      label: 'Katana', desc: 'Slim, slightly curved, one clipped edge.',
      body: [[0, 1], [1, 0.88]], tip: 'clip',
      defaults: { length: 3.9, width: 0.5, thickness: 0.1, tip: 0.7, curve: 8, taper: 0, serrated: 0 },
    },
    saber: {
      label: 'Scimitar', desc: 'Curved with a belly toward the tip.',
      body: [[0, 0.78], [0.65, 1], [1, 0.96]], tip: 'clip',
      defaults: { length: 3.6, width: 0.78, thickness: 0.12, tip: 0.8, curve: 18, taper: 0, serrated: 0 },
    },
    rapier: {
      label: 'Rapier', desc: 'Long, needle-thin duelling blade.',
      body: [[0, 1], [1, 0.75]], tip: 'point',
      defaults: { length: 4.5, width: 0.34, thickness: 0.1, tip: 1.3, curve: 0, taper: 0, serrated: 0 },
    },
    wavy: {
      label: 'Flamberge', desc: 'Wavy, flame-shaped edges.',
      body: [[0, 0.82], [0.17, 1], [0.34, 0.7], [0.5, 1], [0.67, 0.7], [0.84, 1], [1, 0.8]], tip: 'point',
      defaults: { length: 4.1, width: 0.82, thickness: 0.14, tip: 0.95, curve: 0, taper: 0, serrated: 0 },
    },
    claymore: {
      label: 'Greatsword', desc: 'Huge two-handed slab of steel.',
      body: [[0, 1], [1, 0.9]], tip: 'point',
      defaults: { length: 5.6, width: 1.05, thickness: 0.2, tip: 1.2, curve: 0, taper: 0, serrated: 0 },
    },
    cleaver: {
      label: 'Cleaver', desc: 'Chunky and wide with a clipped tip.',
      body: [[0, 1], [1, 1]], tip: 'clip',
      defaults: { length: 3.0, width: 1.2, thickness: 0.18, tip: 0.9, curve: 0, taper: 0, serrated: 0 },
    },
    dagger: {
      label: 'Dagger', desc: 'Short and sneaky.',
      body: [[0, 1], [1, 0.9]], tip: 'point',
      defaults: { length: 1.9, width: 0.5, thickness: 0.11, tip: 0.7, curve: 0, taper: 0, serrated: 0 },
    },
    crystal: {
      label: 'Crystal shard', desc: 'Diamond-shaped, tapered at both ends.',
      body: [[0, 0.16], [0.3, 1], [0.72, 0.92], [1, 0.7]], tip: 'point',
      defaults: { length: 3.8, width: 0.95, thickness: 0.2, tip: 1.1, curve: 0, taper: 0, serrated: 0 },
    },
    serrated: {
      label: 'Serrated', desc: 'Saw teeth along one edge.',
      body: [[0, 1], [1, 0.95]], tip: 'point',
      defaults: { length: 3.6, width: 0.78, thickness: 0.15, tip: 0.9, curve: 0, taper: 0, serrated: 6 },
    },
    energy: {
      label: 'Energy blade', desc: 'A glowing plasma beam (lightsaber).',
      body: [[0, 1], [1, 1]], tip: 'point',
      defaults: { length: 3.8, width: 0.42, thickness: 0.2, tip: 0, curve: 0, taper: 0, serrated: 0 },
    },
  };
  SF.BLADE_STYLE_IDS = Object.keys(SF.BLADE_STYLES);

  /* -------------------------------------------------------- particle styles ---
     Shared by the Luau generator and the 3D preview, so what you see is what you get. */
  SF.TEXTURES = {
    sparkle: 'rbxasset://textures/particles/sparkles_main.dds',
    smoke: 'rbxasset://textures/particles/smoke_main.dds',
    fire: 'rbxasset://textures/particles/fire_main.dds',
  };
  SF.PARTICLE_STYLES = {
    flames: {
      label: 'Flames', tex: 'fire', rate: 26, life: [0.4, 0.85], speed: [1, 3], spread: 25, accel: [0, 7, 0], drag: 0.3,
      size: [[0, 0.5], [0.3, 1.0], [1, 0.1]], trans: [[0, 0.1], [0.6, 0.45], [1, 1]], emission: 1,
      rot: [0, 360], rotSpeed: [-60, 60], locked: false, c1: '#ffd24a', c2: '#ff3b00',
    },
    embers: {
      label: 'Embers', tex: 'sparkle', rate: 18, life: [0.8, 1.6], speed: [2, 5], spread: 70, accel: [0, 3, 0], drag: 1,
      size: [[0, 0.18], [1, 0.03]], trans: [[0, 0], [0.75, 0.25], [1, 1]], emission: 1,
      rot: [0, 360], rotSpeed: [-90, 90], locked: false, c1: '#ffb347', c2: '#ff2a00',
    },
    magic: {
      label: 'Magic sparkles', tex: 'sparkle', rate: 14, life: [0.9, 1.6], speed: [0.4, 1.8], spread: 180, accel: [0, 0.6, 0], drag: 0.5,
      size: [[0, 0], [0.25, 0.4], [1, 0]], trans: [[0, 0], [0.8, 0.2], [1, 1]], emission: 0.9,
      rot: [0, 360], rotSpeed: [-120, 120], locked: false, c1: '#9ad7ff', c2: '#d7a6ff',
    },
    holy: {
      label: 'Holy light', tex: 'sparkle', rate: 20, life: [1.0, 1.7], speed: [0.4, 1.6], spread: 40, accel: [0, 1.6, 0], drag: 0.5,
      size: [[0, 0], [0.2, 0.36], [1, 0]], trans: [[0, 0], [0.85, 0.2], [1, 1]], emission: 1,
      rot: [0, 360], rotSpeed: [-100, 100], locked: false, c1: '#fff3b0', c2: '#ffc83d',
    },
    frost: {
      label: 'Frost', tex: 'sparkle', rate: 16, life: [1.0, 1.8], speed: [0.3, 1.2], spread: 180, accel: [0, -2.5, 0], drag: 0.8,
      size: [[0, 0], [0.2, 0.3], [1, 0.1]], trans: [[0, 0.05], [0.8, 0.3], [1, 1]], emission: 0.7,
      rot: [0, 360], rotSpeed: [-60, 60], locked: false, c1: '#e8fbff', c2: '#7fd8ff',
    },
    electric: {
      label: 'Electric sparks', tex: 'sparkle', rate: 40, life: [0.1, 0.28], speed: [5, 12], spread: 180, accel: [0, 0, 0], drag: 2,
      size: [[0, 0.5], [1, 0]], trans: [[0, 0], [1, 1]], emission: 1,
      rot: [0, 360], rotSpeed: [-300, 300], locked: true, c1: '#ffffff', c2: '#33c9ff',
    },
    souls: {
      label: 'Soul wisps', tex: 'smoke', rate: 12, life: [1.1, 2.0], speed: [0.6, 1.6], spread: 30, accel: [0, 2.2, 0], drag: 0.6,
      size: [[0, 0.3], [0.4, 0.6], [1, 0.1]], trans: [[0, 0.35], [0.6, 0.5], [1, 1]], emission: 1,
      rot: [0, 360], rotSpeed: [-40, 40], locked: false, c1: '#aaffd6', c2: '#2fa1ff',
    },
    smoke: {
      label: 'Smoke', tex: 'smoke', rate: 8, life: [1.0, 1.9], speed: [0.4, 1.4], spread: 40, accel: [0, 1.4, 0], drag: 1,
      size: [[0, 0.45], [1, 1.8]], trans: [[0, 0.5], [0.5, 0.7], [1, 1]], emission: 0,
      rot: [0, 360], rotSpeed: [-25, 25], locked: false, c1: '#8a8a8a', c2: '#2b2b2b',
    },
    void: {
      label: 'Void mist', tex: 'smoke', rate: 12, life: [1.0, 1.8], speed: [0.5, 1.5], spread: 60, accel: [0, 0.8, 0], drag: 1,
      size: [[0, 0.35], [1, 1.6]], trans: [[0, 0.35], [0.6, 0.65], [1, 1]], emission: 0,
      rot: [0, 360], rotSpeed: [-30, 30], locked: false, c1: '#7a1fff', c2: '#0a0014',
    },
    toxic: {
      label: 'Toxic fumes', tex: 'smoke', rate: 12, life: [0.9, 1.7], speed: [0.8, 2], spread: 35, accel: [0, 2.2, 0], drag: 0.8,
      size: [[0, 0.25], [0.5, 0.7], [1, 1.2]], trans: [[0, 0.3], [0.7, 0.6], [1, 1]], emission: 0.5,
      rot: [0, 360], rotSpeed: [-40, 40], locked: false, c1: '#9dff3c', c2: '#1e6b00',
    },
    blood: {
      label: 'Crimson mist', tex: 'smoke', rate: 10, life: [0.8, 1.5], speed: [0.4, 1.2], spread: 40, accel: [0, -1, 0], drag: 0.8,
      size: [[0, 0.25], [0.5, 0.55], [1, 0.9]], trans: [[0, 0.25], [0.6, 0.55], [1, 1]], emission: 0.15,
      rot: [0, 360], rotSpeed: [-40, 40], locked: false, c1: '#e0132b', c2: '#3a0008',
    },
    rainbow: {
      label: 'Rainbow stars', tex: 'sparkle', rate: 22, life: [0.9, 1.6], speed: [0.8, 2.5], spread: 180, accel: [0, 0.6, 0], drag: 0.5,
      size: [[0, 0], [0.25, 0.4], [1, 0]], trans: [[0, 0], [0.8, 0.2], [1, 1]], emission: 1,
      rot: [0, 360], rotSpeed: [-150, 150], locked: false, c1: '#ff4d4d', c2: '#a24dff', rainbow: true,
    },
  };
  SF.PARTICLE_STYLE_IDS = Object.keys(SF.PARTICLE_STYLES);
  SF.RAINBOW_STOPS = ['#ff3b3b', '#ff9a2e', '#ffe53b', '#4cf06a', '#3bd1ff', '#6b6bff', '#d04cff'];

  /* ----------------------------------------------------------- effect layers
     Every layer is {id, kind, on, ...params}. Param spec:
       k key, t type (range|color|select|bool), label, def, min/max/step, options [[value,label]...],
       show(layer) optional predicate, hint optional.                                              */
  const P = {
    range: (k, label, min, max, step, def, extra) => Object.assign({ k, t: 'range', label, min, max, step, def }, extra),
    color: (k, label, def, extra) => Object.assign({ k, t: 'color', label, def }, extra),
    select: (k, label, options, def, extra) => Object.assign({ k, t: 'select', label, options, def }, extra),
    bool: (k, label, def, extra) => Object.assign({ k, t: 'bool', label, def }, extra),
  };
  SF.P = P;

  const burstish = (l) => l.trigger === 'burst' || l.trigger === 'hit' || l.trigger === 'equip';

  SF.FX_KINDS = {
    glow: {
      label: 'Glow light', icon: 'glow', short: 'Lights up the area', blurb: 'A colored point light, so the sword lights up the area around it.',
      params: [
        P.color('color', 'Color', '#ffa63d'),
        P.range('brightness', 'Brightness', 0.2, 8, 0.1, 2.2),
        P.range('range', 'Range (studs)', 4, 40, 1, 14),
        P.range('pulse', 'Pulse speed (0 = steady)', 0, 6, 0.1, 0),
      ],
    },
    particles: {
      label: 'Particles', icon: 'sparkle', short: 'Flames, sparkles, smoke', blurb: 'Flames, sparkles, smoke, frost... pick a style and when it should appear.',
      params: [
        P.select('style', 'Style', SF.PARTICLE_STYLE_IDS.map((id) => [id, SF.PARTICLE_STYLES[id].label]), 'flames'),
        P.select('where', 'Comes from', [['blade', 'The whole blade'], ['tip', 'The tip'], ['hilt', 'The hilt']], 'blade'),
        P.select('trigger', 'When', [
          ['idle', 'Always (while held)'],
          ['swing', 'While swinging'],
          ['burst', 'Burst on each swing'],
          ['hit', 'Burst on the target when you hit'],
          ['equip', 'Burst when equipped'],
        ], 'idle'),
        P.color('color1', 'Start color', '#ffd24a'),
        P.color('color2', 'End color', '#ff3b00'),
        P.range('density', 'Amount', 0.2, 3, 0.1, 1, { show: (l) => !burstish(l) }),
        P.range('count', 'Burst size', 4, 80, 1, 22, { show: burstish }),
        P.range('size', 'Particle size', 0.3, 3, 0.1, 1),
        P.range('speed', 'Speed', 0.3, 3, 0.1, 1),
      ],
    },
    trail: {
      label: 'Swing trail', icon: 'trail', short: 'Ribbon behind the blade', blurb: 'A glowing ribbon that follows the blade when you swing.',
      params: [
        P.color('color1', 'Start color', '#ffd58a'),
        P.color('color2', 'End color', '#ff4d00'),
        P.range('life', 'Length (seconds)', 0.1, 1.4, 0.05, 0.4),
        P.range('width', 'Width', 0.3, 2.5, 0.05, 1),
        P.range('glow', 'Glow', 0, 1, 0.05, 1),
        P.bool('always', 'Always visible (not only when swinging)', false),
      ],
    },
    aura: {
      label: 'Energy aura', icon: 'aura', short: 'Glowing shell', blurb: 'A translucent glowing shell wrapped around the blade.',
      params: [
        P.color('color', 'Color', '#4cc9ff'),
        P.range('size', 'Thickness', 0.04, 0.6, 0.01, 0.14),
        P.range('transparency', 'Transparency', 0.2, 0.95, 0.01, 0.55),
        P.range('pulse', 'Pulse speed (0 = steady)', 0, 6, 0.1, 0),
      ],
    },
    outline: {
      label: 'Glow outline', icon: 'outline', short: 'Bright outline', blurb: 'A bright outline around the whole sword (Highlight). Roblox allows 31 at once.',
      params: [
        P.color('color', 'Outline color', '#ffffff'),
        P.color('fill', 'Fill color', '#4cc9ff'),
        P.range('fillT', 'Fill transparency', 0.3, 1, 0.01, 0.85),
        P.range('outlineT', 'Outline transparency', 0, 1, 0.01, 0.1),
      ],
    },
    rainbow: {
      label: 'Rainbow cycle', icon: 'rainbow', short: 'Cycles every color', blurb: 'The blade, aura and glow smoothly cycle through every color.',
      params: [P.range('speed', 'Speed', 0.1, 3, 0.05, 0.6)],
    },
    arcs: {
      label: 'Lightning arcs', icon: 'arcs', short: 'Crackling electricity', blurb: 'Crackling electric arcs that jump along the blade.',
      params: [
        P.color('color', 'Color', '#8be9ff'),
        P.range('count', 'Arcs', 1, 5, 1, 3),
        P.range('amp', 'Wildness', 0.2, 2.5, 0.05, 1),
        P.range('speed', 'Flicker speed', 4, 30, 1, 14),
      ],
    },
  };
  SF.FX_KIND_IDS = Object.keys(SF.FX_KINDS);

  /* ------------------------------------------------------------- enchantments */
  SF.ENCHANTS = {
    burn: {
      label: 'Burn', icon: 'flame', blurb: 'Sets targets on fire: damage over time.',
      params: [P.range('dps', 'Damage per second', 1, 60, 1, 6), P.range('duration', 'Duration (s)', 1, 12, 0.5, 4), P.color('color', 'Flame color', '#ff7a1a')],
    },
    poison: {
      label: 'Poison', icon: 'skull', blurb: 'Targets take damage over time and drip toxic fumes.',
      params: [P.range('dps', 'Damage per second', 1, 60, 1, 5), P.range('duration', 'Duration (s)', 1, 14, 0.5, 5), P.color('color', 'Fume color', '#7be04a')],
    },
    freeze: {
      label: 'Freeze', icon: 'snow', blurb: 'Slows targets down with a burst of frost.',
      params: [P.range('slow', 'Slow amount (%)', 10, 95, 1, 55), P.range('duration', 'Duration (s)', 0.5, 8, 0.5, 3), P.color('color', 'Frost color', '#8fe3ff')],
    },
    stun: {
      label: 'Shock stun', icon: 'shock', blurb: 'Targets freeze in place for a moment.',
      params: [P.range('duration', 'Stun time (s)', 0.2, 3, 0.1, 0.8), P.color('color', 'Spark color', '#ffe14d')],
    },
    lifesteal: {
      label: 'Life steal', icon: 'heart', blurb: 'You heal for a share of the damage you deal.',
      params: [P.range('pct', 'Heal amount (% of damage)', 5, 100, 1, 25)],
    },
    knockback: {
      label: 'Knockback', icon: 'impact', blurb: 'Hits shove targets away from you.',
      params: [P.range('power', 'Power', 5, 120, 1, 35)],
    },
    lightning: {
      label: 'Lightning strike', icon: 'bolt', blurb: 'A bolt of lightning crashes down on every target you hit.',
      params: [P.range('damage', 'Bonus damage', 1, 100, 1, 12), P.color('color', 'Bolt color', '#7cf3ff')],
    },
    explosion: {
      label: 'Explosive hits', icon: 'burst', blurb: 'Hits go boom (visual explosion + bonus damage to the target).',
      params: [P.range('damage', 'Bonus damage', 1, 100, 1, 10), P.range('size', 'Blast size', 2, 14, 0.5, 6)],
    },
  };
  SF.ENCHANT_IDS = Object.keys(SF.ENCHANTS);

  SF.WAVE_PARAMS = [
    P.select('mode', 'Fires a wave', [['off', 'Never'], ['finisher', 'On the 3rd combo hit (finisher)'], ['every', 'On every swing']], 'off'),
    P.range('damage', 'Wave damage', 1, 250, 1, 25, { show: (w) => w.mode !== 'off' }),
    P.range('speed', 'Speed (studs/s)', 30, 220, 5, 90, { show: (w) => w.mode !== 'off' }),
    P.range('range', 'Range (studs)', 20, 220, 5, 70, { show: (w) => w.mode !== 'off' }),
    P.range('size', 'Size', 2, 16, 0.5, 6, { show: (w) => w.mode !== 'off' }),
    P.range('angle', 'Slash angle (0 flat - 90 upright)', 0, 90, 5, 90, { show: (w) => w.mode !== 'off' }),
    P.color('color', 'Color', '#7cf3ff', { show: (w) => w.mode !== 'off' }),
  ];

  SF.COMBAT_PARAMS = [
    P.range('damage', 'Damage per hit', 1, 500, 1, 20),
    P.range('cooldown', 'Swing cooldown (s)', 0.1, 3, 0.05, 0.45),
    P.select('swing', 'Swing style', SF.SWING_STYLES, 'combo'),
    P.range('reach', 'Reach (hitbox size x)', 0.5, 2.5, 0.05, 1),
    P.range('finisher', 'Finisher damage x (3rd hit / lunge)', 1, 4, 0.1, 1.5, { show: (c) => c.swing !== 'slash' }),
    P.range('dash', 'Lunge dash (studs/s, 0 = off)', 0, 60, 1, 18, { show: (c) => c.swing !== 'slash' }),
    P.bool('friendlyFire', 'Hurt teammates too', false),
  ];

  /* ---------------------------------------------------------------- defaults */
  function newId() {
    return 'fx' + Math.random().toString(36).slice(2, 8);
  }
  SF.newId = newId;

  function defaultsFor(specs) {
    const o = {};
    specs.forEach((p) => { o[p.k] = p.def; });
    return o;
  }
  SF.defaultsFor = defaultsFor;

  SF.makeLayer = function (kind, overrides) {
    const spec = SF.FX_KINDS[kind];
    if (!spec) return null;
    return Object.assign({ id: newId(), kind, on: true }, defaultsFor(spec.params), overrides || {});
  };

  SF.defaultConfig = function () {
    const enchants = {};
    SF.ENCHANT_IDS.forEach((id) => {
      enchants[id] = Object.assign({ on: false }, defaultsFor(SF.ENCHANTS[id].params));
    });
    return {
      v: SF.VERSION,
      name: 'My Sword',
      scale: 1,
      wedgeFlip: false,
      hold: { tilt: 0 },
      blade: Object.assign(
        {
          style: 'straight', fuller: 'groove',
          color: '#c8d1dc', material: 'Metal', accent: '#8392a4', transparency: 0,
          coreColor: '#ffffff',
        },
        SF.BLADE_STYLES.straight.defaults
      ),
      guard: { style: 'cross', width: 2.1, height: 0.3, thickness: 0.4, ends: 'none', color: '#c9a227', material: 'Metal' },
      grip: { length: 1.15, radius: 0.2, color: '#4a3322', material: 'Fabric', wrap: true, wrapColor: '#24160d' },
      pommel: { style: 'ball', size: 0.52, color: '#c9a227', material: 'Metal' },
      gem: { where: 'none', color: '#ff3355', size: 0.3 },
      effects: [],
      combat: Object.assign(defaultsFor(SF.COMBAT_PARAMS), {
        enchants,
        wave: defaultsFor(SF.WAVE_PARAMS),
      }),
      sounds: { swing: true, equip: true, hit: '' },
      anim: SF.defaultAnim(),
    };
  };

  /* ---------------------------------------------------------------- normalize
     Accepts any (possibly partial / older / hand-edited) config and returns a
     complete, clamped, safe one. Never throws.                                  */
  function num(v, def, min, max) {
    v = Number(v);
    if (!isFinite(v)) v = def;
    return clamp(v, min, max);
  }
  function pickOpt(v, list, def) {
    const ids = list.map((o) => (Array.isArray(o) ? o[0] : o));
    return ids.includes(v) ? v : def;
  }
  function col(v, def) {
    return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : def;
  }
  function cleanName(s) {
    s = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
    if (s.length > 32) s = s.slice(0, 32).trim();
    return s || 'My Sword';
  }
  function normParams(specs, src, out) {
    specs.forEach((p) => {
      const v = src ? src[p.k] : undefined;
      if (p.t === 'range') {
        // snap to the slider's step so saved / shared / hand-edited values stay tidy (24, not 23.99999)
        const x = num(v, p.def, p.min, p.max);
        const dec = (String(p.step).split('.')[1] || '').length;
        out[p.k] = clamp(Number((Math.round((x - p.min) / p.step) * p.step + p.min).toFixed(dec)), p.min, p.max);
      }
      else if (p.t === 'color') out[p.k] = col(v, p.def);
      else if (p.t === 'select') out[p.k] = pickOpt(v, p.options, p.def);
      else if (p.t === 'bool') out[p.k] = typeof v === 'boolean' ? v : !!p.def;
    });
    return out;
  }
  SF.normParams = normParams;

  SF.normalize = function (input) {
    const d = SF.defaultConfig();
    const s = input && typeof input === 'object' ? input : {};
    const out = { v: SF.VERSION };
    out.name = cleanName(s.name != null ? s.name : d.name);
    out.scale = num(s.scale, 1, 0.4, 3);
    out.wedgeFlip = s.wedgeFlip === true; // advanced: mirror every WedgePart (see README > Troubleshooting)
    out.hold = { tilt: num(s.hold && s.hold.tilt, 0, -60, 60) };

    // blade
    const sb = s.blade || {};
    const style = pickOpt(sb.style, SF.BLADE_STYLE_IDS, 'straight');
    const sd = SF.BLADE_STYLES[style].defaults;
    const b = {};
    b.style = style;
    b.length = num(sb.length, sd.length, 1.2, 10);
    b.width = num(sb.width, sd.width, 0.15, 3.5);
    b.thickness = num(sb.thickness, sd.thickness, 0.05, 0.8);
    b.tip = num(sb.tip, sd.tip, 0, 4);
    b.tip = Math.min(b.tip, b.length - 0.3);
    if (style === 'energy') b.tip = 0;
    b.curve = num(sb.curve, sd.curve, -35, 45);
    b.taper = num(sb.taper, sd.taper, 0, 0.85);
    b.serrated = Math.round(num(sb.serrated, sd.serrated, 0, 14));
    b.fuller = pickOpt(sb.fuller, SF.FULLER_STYLES, 'none');
    b.color = col(sb.color, d.blade.color);
    b.material = pickOpt(sb.material, SF.MATERIAL_IDS, 'Metal');
    b.accent = col(sb.accent, d.blade.accent);
    b.coreColor = col(sb.coreColor, d.blade.coreColor);
    b.transparency = num(sb.transparency, 0, 0, 0.9);
    out.blade = b;

    // guard
    const sg = s.guard || {};
    out.guard = {
      style: pickOpt(sg.style, SF.GUARD_STYLES, 'cross'),
      width: num(sg.width, d.guard.width, 0.5, 6),
      height: num(sg.height, d.guard.height, 0.1, 1.2),
      thickness: num(sg.thickness, d.guard.thickness, 0.1, 1.4),
      ends: pickOpt(sg.ends, ['none', 'ball'], 'none'),
      color: col(sg.color, d.guard.color),
      material: pickOpt(sg.material, SF.MATERIAL_IDS, 'Metal'),
    };

    // grip
    const sr = s.grip || {};
    out.grip = {
      length: num(sr.length, d.grip.length, 0.5, 3),
      radius: num(sr.radius, d.grip.radius, 0.08, 0.6),
      color: col(sr.color, d.grip.color),
      material: pickOpt(sr.material, SF.MATERIAL_IDS, 'Fabric'),
      wrap: typeof sr.wrap === 'boolean' ? sr.wrap : d.grip.wrap,
      wrapColor: col(sr.wrapColor, d.grip.wrapColor),
    };

    // pommel
    const sp = s.pommel || {};
    out.pommel = {
      style: pickOpt(sp.style, SF.POMMEL_STYLES, 'ball'),
      size: num(sp.size, d.pommel.size, 0.2, 1.6),
      color: col(sp.color, d.pommel.color),
      material: pickOpt(sp.material, SF.MATERIAL_IDS, 'Metal'),
    };

    // gem
    const sm = s.gem || {};
    out.gem = {
      where: pickOpt(sm.where, SF.GEM_PLACES, 'none'),
      color: col(sm.color, d.gem.color),
      size: num(sm.size, d.gem.size, 0.12, 0.9),
    };

    // effects
    out.effects = [];
    (Array.isArray(s.effects) ? s.effects : []).slice(0, 14).forEach((l) => {
      if (!l || typeof l !== 'object' || !SF.FX_KINDS[l.kind]) return;
      const layer = { id: typeof l.id === 'string' && l.id ? l.id.slice(0, 16) : newId(), kind: l.kind, on: l.on !== false };
      normParams(SF.FX_KINDS[l.kind].params, l, layer);
      out.effects.push(layer);
    });

    // combat
    const sc = s.combat || {};
    const c = normParams(SF.COMBAT_PARAMS, sc, {});
    c.enchants = {};
    SF.ENCHANT_IDS.forEach((id) => {
      const se = (sc.enchants && sc.enchants[id]) || {};
      c.enchants[id] = normParams(SF.ENCHANTS[id].params, se, { on: se.on === true });
    });
    c.wave = normParams(SF.WAVE_PARAMS, sc.wave || {}, {});
    out.combat = c;

    // sounds
    const ss = s.sounds || {};
    const hit = String(ss.hit == null ? '' : ss.hit).replace(/[^0-9]/g, '').slice(0, 20);
    out.sounds = { swing: ss.swing !== false, equip: ss.equip !== false, hit };

    // animations (the move library lives in anims.js)
    out.anim = SF.normAnim(s.anim, d.anim);

    return out;
  };

  SF.clone = function (o) {
    return JSON.parse(JSON.stringify(o));
  };

  /* Apply a blade style's recommended proportions (keeps colors / materials). */
  SF.applyBladeStyle = function (cfg, style) {
    const st = SF.BLADE_STYLES[style];
    if (!st) return cfg;
    cfg.blade.style = style;
    Object.assign(cfg.blade, st.defaults);
    if (style === 'energy') {
      cfg.blade.fuller = 'none';
      cfg.blade.material = 'Neon';
    }
    return SF.normalize(cfg);
  };
})((globalThis.SF = globalThis.SF || {}));
