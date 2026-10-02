/* ==========================================================================
   Sword Forge - model.js
   Turns a sword config into a list of Roblox parts (the single source of truth
   used by BOTH the 3D preview and the Luau generator), plus resolved effects.

   Roblox conventions used here (design space == Tool Handle space):
     * +Y runs along the blade (tip up), Z is the blade WIDTH (front edge = -Z),
       X is the blade THICKNESS. With Tool.Grip = identity the sword is held
       blade-up with its edge facing forward.
     * WedgePart: triangle in the local Y/Z plane (extruded along X) with the
       vertices front-bottom (-Y,-Z), back-bottom (-Y,+Z), back-top (+Y,+Z).
     * Cylinder parts have their axis along local X.
     * Rotations are Euler degrees applied like CFrame.Angles(rx, ry, rz) = Rx*Ry*Rz.
   ========================================================================== */
(function (SF) {
  'use strict';
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;

  /* ----------------------------------------------------------- 3x3 matrices */
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  function mul3(A, B) {
    const o = new Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
      }
    }
    return o;
  }
  function mulV(R, v) {
    return [
      R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
      R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
      R[6] * v[0] + R[7] * v[1] + R[8] * v[2],
    ];
  }
  /* CFrame.Angles(rx, ry, rz) (degrees in) */
  function eulerToMat(e) {
    return mul3(mul3(rotX(e[0] * D2R), rotY(e[1] * D2R)), rotZ(e[2] * D2R));
  }
  /* inverse of the above (CFrame:ToEulerAnglesXYZ) -> degrees */
  function matToEuler(R) {
    const sb = Math.max(-1, Math.min(1, R[2]));
    const b = Math.asin(sb);
    let a, c;
    if (Math.abs(sb) < 1 - 1e-10) {
      a = Math.atan2(-R[5], R[8]);
      c = Math.atan2(-R[1], R[0]);
    } else {
      c = 0;
      a = Math.atan2(R[3] / sb, R[4]);
    }
    // the same rotation can be written two ways; prefer the one with the smaller angles
    // (so a half-turn about Y reads [0,180,0] instead of [-180,0,-180])
    const wrap = (d) => { d = ((d + 180) % 360 + 360) % 360 - 180; return d === -180 ? 180 : d; };
    const first = [wrap(a * R2D), b * R2D, wrap(c * R2D)];
    const second = [wrap(a * R2D + 180), wrap(180 - b * R2D), wrap(c * R2D + 180)];
    const cost = (e) => Math.abs(e[0]) + Math.abs(e[1]) + Math.abs(e[2]);
    return cost(second) + 1e-6 < cost(first) ? second : first;
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const r2 = (v) => { const x = Math.round(v * 100) / 100; return x === 0 ? 0 : x; };
  SF.math = { I3, rotX, rotY, rotZ, mul3, mulV, eulerToMat, matToEuler, D2R, R2D };

  /* ------------------------------------------------------------ blade helpers */
  function bladeStations(b) {
    const style = SF.BLADE_STYLES[b.style];
    const L = b.length;
    const tipLen = b.style === 'energy' ? 0 : Math.min(b.tip, L - 0.3);
    const Lb = L - tipLen;
    const sts = [];
    style.body.forEach(([fs, fw]) => {
      const s = fs * Lb;
      const w = fw * b.width * (1 - b.taper * (s / L));
      sts.push({ s, zn: w / 2, zp: w / 2 });
    });
    if (tipLen > 0.001) {
      const last = sts[sts.length - 1];
      if (style.tip === 'clip') {
        sts.push({ s: Lb + tipLen * 0.7, zn: last.zn * 0.32, zp: last.zp * 0.9 });
      }
      sts.push({ s: L, zn: 0, zp: 0 });
    }
    return sts;
  }

  /* Centerline of the blade: angle grows linearly with arc length. */
  function makePath(L, curveDeg, baseY) {
    const th = curveDeg * D2R;
    const k = Math.abs(th) > 1e-6 ? th / L : 0;
    return {
      L, k, baseY,
      theta: (s) => k * s,
      pos: (s) => {
        if (!k) return [0, baseY + s, 0];
        return [0, baseY + Math.sin(k * s) / k, (1 - Math.cos(k * s)) / k];
      },
    };
  }

  /* Pieces (in the segment's local frame: origin at segment center, +Y along the
     segment, +Z across, +X thickness) that fill a trapezoid with independent
     front (zn) and back (zp) half-widths at both ends. */
  function segPieces(len, zn0, zn1, zp0, zp1, t) {
    const out = [];
    const coreN = Math.min(zn0, zn1);
    const coreP = Math.min(zp0, zp1);
    const coreW = coreN + coreP;
    if (coreW > 0.012) out.push({ shape: 'Block', size: [t, len, coreW], pos: [0, 0, (coreP - coreN) / 2], R: I3, kind: 'core' });
    const dn = zn1 - zn0;
    if (Math.abs(dn) > 0.006) {
      out.push({
        shape: 'Wedge', size: [t, len, Math.abs(dn)], pos: [0, 0, -(zn0 + zn1) / 2],
        R: dn < 0 ? I3 : rotZ(Math.PI), kind: 'edge',
      });
    }
    const dp = zp1 - zp0;
    if (Math.abs(dp) > 0.006) {
      out.push({
        shape: 'Wedge', size: [t, len, Math.abs(dp)], pos: [0, 0, (zp0 + zp1) / 2],
        R: dp < 0 ? rotY(Math.PI) : rotX(Math.PI), kind: 'edge',
      });
    }
    return out;
  }

  /* ------------------------------------------------------------ the builder */
  SF.buildModel = function (cfgIn) {
    const cfg = SF.normalize(cfgIn);
    const sc = cfg.scale;
    const parts = [];

    function add(p) {
      const part = {
        n: p.n, s: p.s, sz: p.sz.slice(), p: p.p.slice(),
        R: p.R || I3,
        c: p.c, m: p.m || 'Plastic', t: p.t || 0, rf: p.rf || 0,
        role: p.role || 'misc',
      };
      if (p.main) part.main = true;
      if (p.rainbow) part.rainbow = true;
      if (p.noAura) part.noAura = true;
      parts.push(part);
      return part;
    }
    /* add a piece defined in a local frame, placed with rotation Q at translation T */
    function addXf(piece, Q, T, extra) {
      const p = mulV(Q, piece.pos);
      return add(Object.assign({
        sz: piece.size, s: piece.shape, p: [T[0] + p[0], T[1] + p[1], T[2] + p[2]], R: mul3(Q, piece.R || I3),
      }, extra));
    }

    const g = cfg.grip.length;
    const gripTop = g / 2;
    const gripBot = -g / 2;
    const noGuard = cfg.guard.style === 'none';
    const guardH = noGuard ? 0 : cfg.guard.height;
    const guardY = gripTop + guardH / 2 - 0.02;
    const bladeBase = noGuard ? gripTop - 0.02 : gripTop + guardH - 0.04;
    const b = cfg.blade;
    const L = b.length;
    const path = makePath(L, b.style === 'energy' ? 0 : b.curve, bladeBase);
    const bladeParts = [];
    let growBlade = null;

    /* ============================== BLADE ============================== */
    if (b.style === 'energy') {
      // plasma beam: white core + colored glowing shell + rounded cap
      const d = b.width;
      const coreD = Math.max(0.08, d * 0.5);
      const cy = bladeBase + L / 2;
      const shell = add({ n: 'Blade', s: 'Cylinder', sz: [L, d, d], p: [0, cy, 0], R: eulerToMat([0, 0, 90]), c: b.color, m: 'Neon', t: Math.max(b.transparency, 0.28), role: 'blade', main: true, rainbow: true });
      bladeParts.push(shell);
      bladeParts.push(add({ n: 'BladeCap', s: 'Ball', sz: [d, d, d], p: [0, bladeBase + L, 0], c: b.color, m: 'Neon', t: Math.max(b.transparency, 0.28), role: 'blade', rainbow: true }));
      bladeParts.push(add({ n: 'BladeCore', s: 'Cylinder', sz: [L, coreD, coreD], p: [0, cy, 0], R: eulerToMat([0, 0, 90]), c: b.coreColor, m: 'Neon', t: 0, role: 'blade', noAura: true }));
      bladeParts.push(add({ n: 'BladeCoreCap', s: 'Ball', sz: [coreD, coreD, coreD], p: [0, bladeBase + L, 0], c: b.coreColor, m: 'Neon', t: 0, role: 'blade', noAura: true }));
      // emitter ring at the base of the beam
      add({ n: 'Emitter', s: 'Cylinder', sz: [0.16, d * 1.35, d * 1.35], p: [0, bladeBase + 0.05, 0], R: eulerToMat([0, 0, 90]), c: '#3a3f4a', m: 'Metal', role: 'guard' });
    } else {
      const sts = bladeStations(b);
      const maxSeg = Math.abs(path.k) > 1e-6 ? Math.max(0.22, (3 * D2R) / Math.abs(path.k)) : Infinity;
      const t = b.thickness;
      const extend = Math.abs(path.k) > 1e-6 ? (b.width * 0.5 * 3 * D2R) : 0; // hide wedge-shaped gaps when bent

      // stations -> trapezoid segments (subdivided so bends stay smooth)
      const makeSegs = (stations) => {
        const out = [];
        for (let i = 0; i < stations.length - 1; i++) {
          const A = stations[i], B = stations[i + 1];
          const n = Math.max(1, Math.ceil((B.s - A.s) / maxSeg));
          for (let j = 0; j < n; j++) {
            const f0 = j / n, f1 = (j + 1) / n;
            out.push({
              s0: A.s + (B.s - A.s) * f0, s1: A.s + (B.s - A.s) * f1,
              zn0: A.zn + (B.zn - A.zn) * f0, zn1: A.zn + (B.zn - A.zn) * f1,
              zp0: A.zp + (B.zp - A.zp) * f0, zp1: A.zp + (B.zp - A.zp) * f1,
            });
          }
        }
        return out;
      };
      // segments -> parts (blocks + wedges); returns [{part, isCore}]
      const emitSegs = (segList, th, label, props) => {
        const made = [];
        segList.forEach((sg) => {
          const len = sg.s1 - sg.s0 + extend;
          const smid = (sg.s0 + sg.s1) / 2;
          const Q = rotX(path.theta(smid));
          const T = path.pos(smid);
          segPieces(len, sg.zn0, sg.zn1, sg.zp0, sg.zp1, th).forEach((pc) => {
            const isCore = pc.kind === 'core';
            made.push({ part: addXf(pc, Q, T, Object.assign({ n: isCore ? label : label + 'Edge' }, props)), isCore });
          });
        });
        return made;
      };

      let mainPiece = null, mainVol = -1;
      emitSegs(makeSegs(sts), t, 'Blade', { c: b.color, m: b.material, t: b.transparency, role: 'blade', rainbow: true }).forEach(({ part, isCore }) => {
        bladeParts.push(part);
        const vol = part.sz[0] * part.sz[1] * part.sz[2];
        if (isCore && vol > mainVol) { mainVol = vol; mainPiece = part; }
      });
      if (!mainPiece) mainPiece = bladeParts[0];
      if (mainPiece) mainPiece.main = true;

      // the energy aura is the same blade, inflated: no overlapping pieces, so no banding
      growBlade = (gap, layer) => {
        const grown = sts.map((st, i) => (i > 0 && st.zn === 0 && st.zp === 0
          ? { s: st.s + gap * 1.3, zn: 0, zp: 0 }
          : { s: st.s, zn: st.zn + gap, zp: st.zp + gap }));
        emitSegs(makeSegs(grown), t + gap * 2, 'Aura', { c: layer.color, m: 'Neon', t: layer.transparency, role: 'aura', rainbow: true }).forEach(({ part }) => {
          part.auraPulse = layer.pulse;
        });
      };

      const widthAt = (s) => {
        for (let i = 0; i < sts.length - 1; i++) {
          if (s <= sts[i + 1].s + 1e-9) {
            const f = (s - sts[i].s) / Math.max(1e-6, sts[i + 1].s - sts[i].s);
            const zn = sts[i].zn + (sts[i + 1].zn - sts[i].zn) * f;
            const zp = sts[i].zp + (sts[i + 1].zp - sts[i].zp) * f;
            return { zn, zp };
          }
        }
        return { zn: 0, zp: 0 };
      };

      // fuller (groove / glowing inlay)
      if (b.fuller !== 'none') {
        const Lb = L - Math.min(b.tip, L - 0.3);
        const wideStart = b.style === 'crystal' || b.style === 'leaf' ? 0.3 : 0.1;
        const f0 = wideStart * Lb, f1 = 0.9 * Lb;
        const maxFull = Math.min(1.1, maxSeg);
        const n = Math.max(1, Math.ceil((f1 - f0) / maxFull));
        for (let i = 0; i < n; i++) {
          const s0 = f0 + ((f1 - f0) * i) / n, s1 = f0 + ((f1 - f0) * (i + 1)) / n;
          const sm = (s0 + s1) / 2;
          const w = widthAt(sm);
          const fw = Math.max(0.05, Math.min(0.34, (w.zn + w.zp) * 0.2));
          const Q = rotX(path.theta(sm));
          const T = path.pos(sm);
          const cz = (w.zp - w.zn) * 0.0;
          const inlay = b.fuller === 'inlay';
          addXf({ shape: 'Block', size: [t + 0.03, s1 - s0 + extend, fw], pos: [0, 0, cz], R: I3 }, Q, T, {
            n: inlay ? 'Inlay' : 'Fuller', c: b.accent, m: inlay ? 'Neon' : b.material, t: 0, role: inlay ? 'inlay' : 'fuller', rainbow: inlay,
          });
        }
      }

      // serrated teeth on the front edge
      if (b.serrated > 0) {
        const Lb = L - Math.min(b.tip, L - 0.3);
        const s0 = 0.14 * Lb, s1 = 0.96 * Lb;
        const p = (s1 - s0) / b.serrated;
        const depth = Math.max(0.07, Math.min(0.26, b.width * 0.16));
        for (let i = 0; i < b.serrated; i++) {
          const sm = s0 + p * (i + 0.5);
          const w = widthAt(sm);
          const Q = rotX(path.theta(sm));
          const T = path.pos(sm);
          bladeParts.push(addXf({ shape: 'Wedge', size: [t * 0.8, p, depth], pos: [0, 0, -(w.zn + depth / 2 - 0.01)], R: I3 }, Q, T, {
            n: 'Tooth', c: b.color, m: b.material, t: b.transparency, role: 'blade', rainbow: true,
          }));
        }
      }
    }

    /* ============================== GUARD ============================== */
    const G = cfg.guard;
    const gy = guardY;
    const gcol = G.color, gmat = G.material;
    const gpart = (o) => add(Object.assign({ c: gcol, m: gmat, role: 'guard' }, o));
    if (G.style === 'cross' || G.style === 'horned') {
      gpart({ n: 'Guard', s: 'Block', sz: [G.thickness, G.height, G.width], p: [0, gy, 0] });
      if (G.ends === 'ball') {
        const d = Math.max(G.height * 1.35, 0.3);
        [-1, 1].forEach((sd) => gpart({ n: 'GuardEnd', s: 'Ball', sz: [d, d, d], p: [0, gy, sd * G.width / 2] }));
      }
      if (G.style === 'horned') {
        const hh = Math.max(0.35, G.width * 0.2), bl = Math.max(0.35, G.width * 0.22);
        [1, -1].forEach((sd) => {
          gpart({
            n: 'GuardHorn', s: 'Wedge', sz: [G.thickness * 0.8, hh, bl],
            p: [0, gy + G.height / 2 + hh / 2 - 0.01, sd * (G.width / 2 - bl / 2)],
            R: sd > 0 ? I3 : rotY(Math.PI),
          });
        });
      }
    } else if (G.style === 'winged' || G.style === 'drooped') {
      const dir = G.style === 'winged' ? 1 : -1;
      const ang = 26 * D2R;
      const cw = G.width * 0.28;
      gpart({ n: 'Guard', s: 'Block', sz: [G.thickness, G.height, cw], p: [0, gy, 0] });
      const run = (G.width - cw) / 2;                 // horizontal reach of one wing
      const lw = run / Math.cos(ang);
      [1, -1].forEach((sd) => {
        gpart({
          n: 'GuardWing', s: 'Block', sz: [G.thickness, G.height, lw],
          p: [0, gy + dir * (lw / 2) * Math.sin(ang), sd * (cw / 2 + (lw / 2) * Math.cos(ang))],
          R: eulerToMat([-sd * dir * ang * R2D, 0, 0]),
        });
      });
      if (G.ends === 'ball') {
        const d = Math.max(G.height * 1.35, 0.3);
        [1, -1].forEach((sd) => gpart({ n: 'GuardEnd', s: 'Ball', sz: [d, d, d], p: [0, gy + dir * run * Math.tan(ang), sd * G.width / 2] }));
      }
    } else if (G.style === 'crescent') {
      const cw = G.width * 0.22;
      gpart({ n: 'Guard', s: 'Block', sz: [G.thickness, G.height, cw], p: [0, gy, 0] });
      const angs = [14, 38, 62].map((a) => a * D2R);
      const rawRun = angs.reduce((acc, a) => acc + Math.cos(a), 0);
      const k = ((G.width - cw) / 2) / rawRun;       // segment length so the span matches width
      [1, -1].forEach((sd) => {
        let z = cw / 2, y = gy;
        angs.forEach((a, i) => {
          const len = k;
          const cz = z + (len / 2) * Math.cos(a), cy = y + (len / 2) * Math.sin(a);
          gpart({ n: 'GuardArc', s: 'Block', sz: [G.thickness, G.height * (1 - i * 0.12), len + 0.04], p: [0, cy, sd * cz], R: eulerToMat([-sd * a * R2D, 0, 0]) });
          z += len * Math.cos(a);
          y += len * Math.sin(a);
        });
      });
    } else if (G.style === 'disc') {
      const d = Math.max(0.6, G.width);
      gpart({ n: 'Guard', s: 'Cylinder', sz: [G.height, d, d], p: [0, gy, 0], R: eulerToMat([0, 0, 90]) });
    }

    /* ============================== GRIP ============================== */
    const Gr = cfg.grip;
    add({ n: 'Grip', s: 'Cylinder', sz: [g, Gr.radius * 2, Gr.radius * 2], p: [0, 0, 0], R: eulerToMat([0, 0, 90]), c: Gr.color, m: Gr.material, role: 'grip' });
    if (Gr.wrap) {
      const n = Math.max(2, Math.floor(g / 0.24));
      for (let i = 0; i < n; i++) {
        const y = -g / 2 + (g * (i + 0.5)) / n;
        add({ n: 'GripWrap', s: 'Cylinder', sz: [0.07, Gr.radius * 2 + 0.05, Gr.radius * 2 + 0.05], p: [0, y, 0], R: eulerToMat([0, 0, 90]), c: Gr.wrapColor, m: Gr.material, role: 'grip' });
      }
    }

    /* ============================== POMMEL ============================== */
    const Pm = cfg.pommel;
    let pommelBottom = gripBot;
    if (Pm.style === 'ball') {
      const y = gripBot - Pm.size / 2 + 0.07;
      add({ n: 'Pommel', s: 'Ball', sz: [Pm.size, Pm.size, Pm.size], p: [0, y, 0], c: Pm.color, m: Pm.material, role: 'pommel' });
      pommelBottom = y - Pm.size / 2;
    } else if (Pm.style === 'disc') {
      const th = 0.2;
      const y = gripBot - th / 2 + 0.03;
      add({ n: 'Pommel', s: 'Cylinder', sz: [th, Pm.size * 1.25, Pm.size * 1.25], p: [0, y, 0], R: eulerToMat([0, 0, 90]), c: Pm.color, m: Pm.material, role: 'pommel' });
      pommelBottom = y - th / 2;
    } else if (Pm.style === 'cap') {
      const th = Pm.size * 0.7;
      const y = gripBot - th / 2 + 0.03;
      add({ n: 'Pommel', s: 'Cylinder', sz: [th, Pm.size * 1.15, Pm.size * 1.15], p: [0, y, 0], R: eulerToMat([0, 0, 90]), c: Pm.color, m: Pm.material, role: 'pommel' });
      pommelBottom = y - th / 2;
    } else if (Pm.style === 'spike') {
      const ln = Pm.size * 1.5;
      const y = gripBot - ln / 2 + 0.03;
      const tt = Math.max(0.14, Pm.size * 0.45);
      const Q = rotZ(Math.PI);                    // flip so the point faces down
      segPieces(ln, Pm.size / 2, 0, Pm.size / 2, 0, tt).forEach((pc) => {
        addXf(pc, Q, [0, y, 0], { n: 'Pommel', c: Pm.color, m: Pm.material, role: 'pommel' });
      });
      pommelBottom = y - ln / 2;
    }

    /* ============================== GEMS ============================== */
    const Ge = cfg.gem;
    const gemPlates = (y, depthX) => {
      const s = Ge.size;
      [1, -1].forEach((sd) => {
        add({ n: 'Gem', s: 'Block', sz: [0.12, s, s], p: [sd * depthX, y, 0], R: eulerToMat([45, 0, 0]), c: Ge.color, m: 'Neon', role: 'gem', rainbow: false });
      });
    };
    if ((Ge.where === 'guard' || Ge.where === 'all') && !noGuard) gemPlates(gy, G.style === 'disc' ? 0.12 : G.thickness / 2 + 0.01);
    if (Ge.where === 'blade' || Ge.where === 'all') gemPlates(bladeBase + Math.min(0.55 + Ge.size / 2, L * 0.4), b.thickness / 2 + 0.04);
    if (Ge.where === 'pommel' || Ge.where === 'all') {
      const s = Ge.size;
      add({ n: 'Gem', s: 'Ball', sz: [s, s, s], p: [0, pommelBottom - s * 0.1, 0], c: Ge.color, m: 'Neon', role: 'gem' });
    }

    /* ======================= ENERGY AURA (effect layer) ======================= */
    const auraLayers = cfg.effects.filter((e) => e.kind === 'aura' && e.on);
    auraLayers.forEach((layer) => {
      if (growBlade) { growBlade(layer.size, layer); return; }
      // energy blade: a bigger copy of the colored shell and its cap
      bladeParts.filter((bp) => !bp.noAura).forEach((bp) => {
        const grow = layer.size * 2;
        const sz = bp.s === 'Ball' ? [bp.sz[0] + grow, bp.sz[1] + grow, bp.sz[2] + grow] : [bp.sz[0] + grow * 0.7, bp.sz[1] + grow, bp.sz[2] + grow];
        const part = add({
          n: 'Aura', s: bp.s, sz, p: bp.p, R: bp.R, c: layer.color, m: 'Neon', t: layer.transparency, role: 'aura', rainbow: true,
        });
        part.auraPulse = layer.pulse;
      });
    });

    /* ====================== finish: scale, round, euler ====================== */
    const clampS = (v) => Math.max(0.05, v);
    const out = parts.map((p) => {
      const sz = p.sz.map((v) => r3(clampS(v * sc)));
      if (p.s === 'Ball') { const m = Math.max(sz[0], sz[1], sz[2]); sz[0] = sz[1] = sz[2] = m; }
      // "Flip wedges": if a Roblox version draws WedgeParts mirrored, a half-turn about Y puts them right again
      const R = p.s === 'Wedge' && cfg.wedgeFlip ? mul3(p.R, rotY(Math.PI)) : p.R;
      const e = matToEuler(R).map(r2);
      const o = { n: p.n, s: p.s, sz, p: p.p.map((v) => r3(v * sc)), r: e, c: p.c, m: p.m, t: r2(p.t), rf: r2(p.rf), role: p.role };
      if (p.main) o.main = true;
      if (p.rainbow) o.rainbow = true;
      if (p.auraPulse) o.auraPulse = p.auraPulse;
      return o;
    });

    /* ============================ derived geometry ============================ */
    function aabb(part) {
      const R = eulerToMat(part.r);
      const h = part.sz.map((v) => v / 2);
      const ext = [0, 1, 2].map((i) => Math.abs(R[i * 3]) * h[0] + Math.abs(R[i * 3 + 1]) * h[1] + Math.abs(R[i * 3 + 2]) * h[2]);
      return { min: part.p.map((v, i) => v - ext[i]), max: part.p.map((v, i) => v + ext[i]) };
    }
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    out.filter((p) => p.role === 'blade').forEach((p) => {
      const a = aabb(p);
      for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], a.min[i]); mx[i] = Math.max(mx[i], a.max[i]); }
    });
    const reach = cfg.combat.reach;
    const hbSize = [
      Math.max(mx[0] - mn[0], 0.3) + 0.9 * sc,
      (mx[1] - mn[1] + 0.5 * sc) * reach,
      (mx[2] - mn[2] + 0.8 * sc) * reach,
    ];
    const hbPos = [0, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];

    const baseP = path.pos(0), tipP = path.pos(L);
    const trail = {
      a: [0, r3((baseP[1] + 0.15) * sc), 0],
      b: [0, r3(tipP[1] * sc), r3(tipP[2] * sc)],
    };
    const midP = path.pos(L * 0.55);
    const sample = {
      // random point inside the blade volume (for preview particles)
      blade: (rnd) => {
        const s = rnd() * L;
        const p = path.pos(s);
        const th = path.theta(s);
        const wz = (rnd() - 0.5) * b.width * 0.8;
        return [(rnd() - 0.5) * b.thickness * sc, (p[1] - Math.sin(th) * wz) * sc, (p[2] + Math.cos(th) * wz) * sc];
      },
      tip: [0, tipP[1] * sc, tipP[2] * sc],
      hilt: [0, guardY * sc, 0],
    };

    const stats = {
      parts: out.length,
      length: r3((bladeBase + L - pommelBottom) * sc),
      bladeLength: r3(L * sc),
    };

    return {
      cfg, parts: out, trail,
      layout: { guardY: r3(guardY * sc), gripTop: r3(gripTop * sc), bladeBase: r3(bladeBase * sc), pommelBottom: r3(pommelBottom * sc) },
      hitbox: { size: hbSize.map(r3), pos: hbPos.map(r3) },
      tip: sample.tip, mid: [0, r3(midP[1] * sc), r3(midP[2] * sc)], hilt: sample.hilt,
      sample, stats, scale: sc,
      effects: SF.resolveEffects(cfg),
      path: { L, curve: b.curve, bladeBase },
    };
  };

  /* ------------------------------------------------------ effect resolution */
  const rgb = SF.hex2rgb;
  function seq(list, mul) {
    return list.map(([t, v]) => [t, SF.clamp(v * (mul || 1), 0, 100)]);
  }
  function colorSeq(c1, c2, rainbow) {
    if (rainbow) {
      const stops = SF.RAINBOW_STOPS;
      return stops.map((h, i) => [i / (stops.length - 1), rgb(h)]);
    }
    return [[0, rgb(c1)], [1, rgb(c2)]];
  }

  SF.resolveEffects = function (cfgIn) {
    const cfg = SF.normalize(cfgIn);
    const sc = cfg.scale;
    const out = [];
    cfg.effects.forEach((l) => {
      if (!l.on) return;
      if (l.kind === 'glow') {
        out.push({ kind: 'glow', color: rgb(l.color), brightness: l.brightness, range: Math.round(l.range * Math.sqrt(sc) * 10) / 10, pulse: l.pulse });
      } else if (l.kind === 'particles') {
        const st = SF.PARTICLE_STYLES[l.style] || SF.PARTICLE_STYLES.flames;
        const burst = l.trigger === 'burst' || l.trigger === 'hit' || l.trigger === 'equip';
        const sizeMul = l.size * Math.sqrt(sc);
        const spd = l.speed;
        out.push({
          kind: 'particles', name: st.label.replace(/[^A-Za-z0-9]/g, ''), style: l.style, where: l.where, trigger: l.trigger,
          texture: SF.TEXTURES[st.tex],
          color: colorSeq(l.color1, l.color2, st.rainbow),
          size: seq(st.size, sizeMul).map(([t, v]) => [t, Math.round(v * 1000) / 1000]),
          transparency: st.trans.map(([t, v]) => [t, v]),
          lifetime: st.life.slice(),
          speed: [Math.round(st.speed[0] * spd * 100) / 100, Math.round(st.speed[1] * spd * 100) / 100],
          spread: [st.spread, st.spread],
          accel: st.accel.slice(),
          drag: st.drag,
          rate: burst ? 0 : Math.max(1, Math.round(st.rate * l.density * Math.sqrt(sc))),
          count: burst ? Math.round(l.count) : 0,
          rot: st.rot.slice(), rotSpeed: st.rotSpeed.slice(),
          emission: st.emission, locked: !!st.locked,
        });
      } else if (l.kind === 'trail') {
        out.push({
          kind: 'trail', color: [[0, rgb(l.color1)], [1, rgb(l.color2)]],
          transparency: [[0, 0.28], [0.5, 0.72], [1, 1]],
          width: [[0, Math.round(l.width * 100) / 100], [1, Math.round(l.width * 8) / 100]],
          life: l.life, glow: l.glow, always: l.always,
        });
      } else if (l.kind === 'aura') {
        out.push({ kind: 'aura', color: rgb(l.color), pulse: l.pulse, transparency: l.transparency });
      } else if (l.kind === 'outline') {
        out.push({ kind: 'outline', color: rgb(l.color), fill: rgb(l.fill), fillT: l.fillT, outlineT: l.outlineT });
      } else if (l.kind === 'rainbow') {
        out.push({ kind: 'rainbow', speed: l.speed });
      } else if (l.kind === 'arcs') {
        out.push({ kind: 'arcs', color: rgb(l.color), count: Math.round(l.count), amp: l.amp, speed: l.speed });
      }
    });
    return out;
  };

  SF.matToEuler = matToEuler;
  SF.eulerToMat = eulerToMat;
})((globalThis.SF = globalThis.SF || {}));
