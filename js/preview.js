/* ==========================================================================
   Sword Forge - preview.js
   The 3D preview: a small Roblox-style avatar holding the sword, a swing
   animation, particle / trail / light simulation that mirrors the generated
   effects, orbit camera, plus offscreen thumbnails for the gallery.
   ========================================================================== */
(function (SF) {
  'use strict';

  const { V, perspective, lookAt, mul4, toCol3, Renderer } = SF.GL;
  const M = SF.math;
  const D2R = Math.PI / 180;
  const FOV = 34 * D2R;

  // right shoulder and the hand position of the "holding a tool" pose (studs, avatar faces -Z)
  const GRIP0 = [1.5, 3.5, -1.5];

  const rgb01 = (hex) => SF.hex2rgb(hex).map((v) => v / 255);
  const seqAt = (list, u) => {
    if (u <= list[0][0]) return list[0][1];
    for (let i = 1; i < list.length; i++) {
      if (u <= list[i][0]) {
        const a = list[i - 1], b = list[i];
        const f = (u - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * f;
      }
    }
    return list[list.length - 1][1];
  };
  const colAt = (list, u, out) => {
    let a = list[0], b = list[list.length - 1], f = 0;
    if (u <= list[0][0]) { b = a; } else if (u >= list[list.length - 1][0]) { a = b; } else {
      for (let i = 1; i < list.length; i++) {
        if (u <= list[i][0]) { a = list[i - 1]; b = list[i]; f = (u - a[0]) / Math.max(1e-6, b[0] - a[0]); break; }
      }
    }
    out[0] = (a[1][0] + (b[1][0] - a[1][0]) * f) / 255;
    out[1] = (a[1][1] + (b[1][1] - a[1][1]) * f) / 255;
    out[2] = (a[1][2] + (b[1][2] - a[1][2]) * f) / 255;
  };
  const smooth = (x) => x * x * (3 - 2 * x);
  const hsv = (h, s, v) => {
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (((i % 6) + 6) % 6) {
      case 0: return [v, t, p];
      case 1: return [q, v, p];
      case 2: return [p, v, t];
      case 3: return [p, q, v];
      case 4: return [t, p, v];
      default: return [v, p, q];
    }
  };
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  /* the plain "no custom animation" swing: wind up, chop down, follow through, settle (right arm only) */
  const DEFAULT_MOVE = (() => {
    const K = [[0, 0, 'io'], [0.13, 72, 'out'], [0.31, -56, 'io'], [0.43, -58, 'io'], [0.74, 0, 'io']];
    return {
      kind: 'swing', dur: 0.74, hit: [0.135, 0.675], loop: false,
      keys: K.map((kf) => { const pose = SF.zeroPose(); pose.ra[0] = kf[1]; return { t: kf[0] / 0.74, e: kf[2], pose }; }),
    };
  })();

  /* --------------------------------------------------------------- avatar
     A blocky R6-style character. g = which body part a box belongs to. The pivots are the real R6 joint
     positions, so poses written for the Roblox rig look the same here.                                */
  const AVATAR = (() => {
    const c = (h) => rgb01(h);
    const skin = c('#e6c35a'), shirt = c('#3d73bf'), pants = c('#5fa655'), dark = c('#1b1d26');
    const box = (g, pos, size, color) => ({ g, mesh: 'box', pos, size, color, spec: 0.28, shin: 30, rim: 0.12 });
    return [
      box('he', [0, 4.5, 0], [2, 1, 1], skin),
      box('he', [-0.32, 4.62, -0.51], [0.2, 0.24, 0.06], dark),
      box('he', [0.32, 4.62, -0.51], [0.2, 0.24, 0.06], dark),
      box('he', [0, 4.3, -0.51], [0.7, 0.09, 0.06], dark),
      box('to', [0, 3, 0], [2, 2, 1], shirt),
      box('la', [-1.5, 3, 0], [1, 2, 1], skin),
      box('ll', [-0.5, 1, 0], [1, 2, 1], pants),
      box('rl', [0.5, 1, 0], [1, 2, 1], pants),
      box('ra', [1.5, 3, 0], [1, 2, 1], skin),
    ];
  })();
  const PIV = { he: [0, 4, 0], ra: [1, 3.5, 0], la: [-1, 3.5, 0], rl: [0.5, 2, 0], ll: [-0.5, 2, 0] };
  const WAIST = [0, 3, 0];                       // the torso turns about its middle (the R6 root joint)
  const HOLD = M.rotX(90 * D2R);                 // the right arm already points forward when it holds a tool

  /* ------------------------------------------------------------------ Scene */
  class Scene {
    constructor(opts) {
      opts = opts || {};
      this.thumb = !!opts.thumb;
      this.avatar = opts.avatar !== false && !this.thumb;
      this.t = 0;
      this.equipT = 1;
      this.pose = SF.zeroPose();                 // what the body is doing right now
      this.mv = null;                            // the move that is playing: { r, t, kind, fired }
      this.idleR = null;
      this.speed = 1;
      this.combo = 0;
      this.blend = null;                         // cross-fade from the previous pose
      this.gripFwd = false;
      this.swingOn = false;                      // true while the blade is "live" (trail, emitters)
      this.particles = [];
      this.rand = rng(1234567);
      this.emitters = [];
      this.arcs = [];
      this.trail = null;
      this.trailSeg = 0;
      this.trailActive = false;
      this.model = null;
      this.pending = { burst: false, hit: false, equip: false };
      this.xf = { R: M.I3, p: GRIP0.slice() };
      this.accent = [0.6, 0.7, 0.9];
    }

    setModel(model, opts) {
      opts = opts || {};
      this.model = model;
      const cfg = model.cfg;
      const lookOf = (m) => SF.MATERIAL_LOOK[m] || SF.MATERIAL_LOOK.Plastic;
      this.parts = model.parts.map((p) => {
        const look = lookOf(p.m);
        return {
          mesh: p.s === 'Block' ? 'box' : p.s === 'Wedge' ? 'wedge' : p.s === 'Cylinder' ? 'cyl' : 'sphere',
          lp: p.p, Rl: M.eulerToMat(p.r), size: p.sz, color: rgb01(p.c), look, alpha: 1 - p.t,
          role: p.role, rainbow: !!p.rainbow, auraPulse: p.auraPulse || 0,
        };
      });
      this.fx = model.effects;
      this.hasRainbow = this.fx.some((e) => e.kind === 'rainbow');
      this.rainbowSpeed = (this.fx.find((e) => e.kind === 'rainbow') || {}).speed || 0.6;
      this.glow = this.fx.find((e) => e.kind === 'glow') || null;
      this.outline = this.fx.find((e) => e.kind === 'outline') || null;
      this.trailFx = this.fx.find((e) => e.kind === 'trail') || null;
      this.emitters = this.fx.filter((e) => e.kind === 'particles').map((d) => ({
        d, acc: 0, tex: /smoke/.test(d.texture) ? 1 : /fire/.test(d.texture) ? 2 : 0,
      }));
      this.arcs = this.fx.filter((e) => e.kind === 'arcs').map((d) => ({ d, acc: 0 }));
      this.flipWedge = !!cfg.wedgeFlip;
      this.tilt = cfg.hold.tilt;
      this.anim = cfg.anim;
      this.speed = cfg.anim.on ? cfg.anim.speed : 1;
      this.idleR = cfg.anim.on && cfg.anim.idle !== 'none' ? SF.resolveMove(cfg.anim.idle) : null;
      if (this.mv && this.mv.kind === 'swing' && !this.mv.legacy && !cfg.anim.on) this.mv = null;
      // colour that tints the room (used by the background glow)
      const neon = this.parts.find((p) => p.role === 'blade' && p.look.emit >= 0.9);
      this.accent = this.glow ? this.glow.color.map((v) => v / 255)
        : this.trailFx ? this.trailFx.color[0][1].map((v) => v / 255)
          : neon ? neon.color : [0.55, 0.65, 0.85];
      // framing info
      let top = 0;
      model.parts.forEach((p) => { top = Math.max(top, p.p[1] + Math.max(p.sz[0], p.sz[1], p.sz[2]) / 2); });
      this.swordTop = top;
      this.swordBottom = Math.min(0, ...model.parts.map((p) => p.p[1] - Math.max(p.sz[0], p.sz[1], p.sz[2]) / 2));
      if (opts.equip !== false) {
        this.equipT = 0;
        this.pending.equip = true;
        this.combo = 0;
        const eq = cfg.anim.on && cfg.anim.equip !== 'none' ? SF.resolveMove(cfg.anim.equip) : null;
        if (eq && !this.thumb) this.startMove(eq, 'equip');
      }
      this.trail = null;
    }

    startMove(r, kind, legacy) {
      this.blend = { from: SF.zeroPose(), t: 0, dur: kind === 'swing' ? 0.08 : 0.12 };
      this.copyPose(this.pose, this.blend.from);
      this.mv = { r, t: 0, kind, legacy: !!legacy, burst: false, struck: false };
      this.swingOn = false;
    }
    copyPose(a, b) {
      SF.ANIM_CH3.forEach((ch) => { for (let i = 0; i < 3; i++) b[ch][i] = a[ch][i]; });
      b.dy = a.dy; b.dz = a.dz;
    }

    /* the next hit of the combo (or the plain swing when the sword has no moves) */
    swing() {
      const an = this.anim;
      if (this.mv && this.mv.kind === 'swing' && this.mv.t * this.speed / this.mv.r.dur < 0.5) return;
      if (!an || !an.on || !an.swings.length) { this.startMove(DEFAULT_MOVE, 'swing', true); return; }
      const id = an.swings[this.combo % an.swings.length];
      this.combo++;
      this.startMove(SF.resolveMove(id), 'swing');
    }
    playMove(id) {
      const r = SF.resolveMove(id);
      if (!r || r.kind === 'idle') return;
      this.startMove(r, r.kind);
    }

    /* body pose for this frame: the playing move, or the idle stance, cross-faded */
    updatePose(dt) {
      let target;
      const mv = this.mv;
      if (mv) {
        mv.t += dt * this.speed;
        const u = mv.t / mv.r.dur;
        if (u >= 1) { this.mv = null; this.swingOn = false; this.blend = { from: SF.zeroPose(), t: 0, dur: 0.18 }; this.copyPose(this.pose, this.blend.from); }
        else {
          target = SF.poseAt(mv.r, u);
          if (mv.kind === 'swing') {
            const h = mv.r.hit;
            if (!mv.burst && u >= h[0]) { mv.burst = true; this.pending.burst = true; }
            if (!mv.struck && u >= h[0] + (h[1] - h[0]) * 0.35) { mv.struck = true; this.pending.hit = true; }
            this.swingOn = u >= h[0] - 0.04 && u <= h[1] + 0.08;
          }
        }
      }
      if (!target) {
        target = this.idleR ? SF.poseAt(this.idleR, (this.t / this.idleR.dur) % 1) : SF.zeroPose();
        if (!this.idleR) target.ra[0] = Math.sin(this.t * 1.7) * 1.0;   // a tiny hand bob
      }
      const bl = this.blend;
      if (bl && bl.t < bl.dur) {
        bl.t += dt;
        const w = Math.min(1, bl.t / bl.dur);
        SF.blendPose(bl.from, target, w * w * (3 - 2 * w), this.pose);
      } else {
        this.copyPose(target, this.pose);
      }
    }

    /* sword placement in the world (follows the right hand) */
    updateTransform() {
      const tilt = this.tilt * D2R;
      if (this.thumb) {
        this.xf = { R: M.rotX(-tilt), p: [0, -(this.swordTop + this.swordBottom) / 2, 0] };
        return;
      }
      const ps = this.pose;
      const Rt = M.eulerToMat(ps.to), Rd = M.eulerToMat(ps.ra);
      const RtRd = M.mul3(Rt, Rd);
      const sh = this.upper(PIV.ra);
      const off = M.mulV(RtRd, V.sub(GRIP0, PIV.ra));
      const R = M.mul3(RtRd, M.mul3(M.eulerToMat(ps.wr), M.rotX(-tilt)));            // wr: the wrist turns the sword in the hand
      this.xf = { R, p: V.add(sh, off) };
    }
    /* a point on the upper body after the root offset and the torso turn */
    upper(p) {
      const ps = this.pose;
      const Rt = M.eulerToMat(ps.to);
      const q = M.mulV(Rt, V.sub(p, WAIST));
      return [WAIST[0] + q[0], WAIST[1] + q[1] + ps.dy, WAIST[2] + q[2] + ps.dz];
    }

    toWorld(lp, sc) {
      const s = sc == null ? 1 : sc;
      const q = M.mulV(this.xf.R, [lp[0] * s, lp[1] * s, lp[2] * s]);
      return [this.xf.p[0] + q[0], this.xf.p[1] + q[1], this.xf.p[2] + q[2]];
    }

    spawn(e, mode) {
      if (this.particles.length >= 3000) return;
      const d = e.d, r = this.rand;
      let lp;
      if (mode === 'hit') lp = this.model.tip;
      else if (d.where === 'tip') lp = this.model.tip;
      else if (d.where === 'hilt') lp = this.model.hilt;
      else lp = this.model.sample.blade(r);
      if (d.where !== 'blade' || mode === 'hit') lp = [lp[0] + (r() - 0.5) * 0.12, lp[1] + (r() - 0.5) * 0.12, lp[2] + (r() - 0.5) * 0.12];
      // random direction inside a cone around the blade axis
      const spread = (mode === 'hit' ? Math.max(d.spread[0], 140) : d.spread[0]) * D2R;
      const cz = 1 - r() * (1 - Math.cos(Math.min(spread, Math.PI)));
      const sz = Math.sqrt(Math.max(0, 1 - cz * cz)), ph = r() * Math.PI * 2;
      const dirL = [sz * Math.cos(ph), cz, sz * Math.sin(ph)];
      const speed = d.speed[0] + (d.speed[1] - d.speed[0]) * r();
      const life = d.lifetime[0] + (d.lifetime[1] - d.lifetime[0]) * r();
      const p = {
        d, tex: e.tex, age: 0, life, locked: d.locked && mode !== 'hit',
        rot: (d.rot[0] + (d.rot[1] - d.rot[0]) * r()) * D2R, rs: (d.rotSpeed[0] + (d.rotSpeed[1] - d.rotSpeed[0]) * r()) * D2R,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      };
      if (p.locked) {
        p.x = lp[0]; p.y = lp[1]; p.z = lp[2];
        p.vx = dirL[0] * speed; p.vy = dirL[1] * speed; p.vz = dirL[2] * speed;
      } else {
        const w = this.toWorld(lp);
        const v = M.mulV(this.xf.R, dirL);
        p.x = w[0]; p.y = w[1]; p.z = w[2];
        p.vx = v[0] * speed; p.vy = v[1] * speed; p.vz = v[2] * speed;
      }
      this.particles.push(p);
    }

    spawnArc(a) {
      const r = this.rand, d = a.d;
      const A = this.model.trail.a, B = this.model.trail.b;
      const n = 13;
      const side = (r() - 0.5) * 0.3;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const env = Math.sin(f * Math.PI);
        const px = A[0] + (B[0] - A[0]) * f + (r() - 0.5) * 0.5 * d.amp * env;
        const py = A[1] + (B[1] - A[1]) * f;
        const pz = A[2] + (B[2] - A[2]) * f + (r() - 0.5) * 0.6 * d.amp * env + side * env;
        this.particles.push({
          d: ARC_DESC, tex: 3, age: 0, life: 0.07 + r() * 0.05, locked: true, rot: 0, rs: 0,
          x: px, y: py, z: pz, vx: 0, vy: 0, vz: 0, tint: d.color,
        });
      }
    }

    update(dt) {
      if (!this.model) return;
      this.t += dt;
      if (this.equipT < 1) this.equipT = Math.min(1, this.equipT + dt / 0.5);
      this.updatePose(dt);
      this.updateTransform();
      const swinging = this.swingOn;
      const sw = this.swingOn ? 1 : -1;

      // emitters
      this.emitters.forEach((e) => {
        const d = e.d;
        if ((d.trigger === 'idle') || (d.trigger === 'swing' && swinging)) {
          e.acc += d.rate * dt;
          while (e.acc >= 1) { e.acc -= 1; this.spawn(e); }
        }
      });
      if (this.pending.burst) { this.emitters.forEach((e) => { if (e.d.trigger === 'burst') for (let i = 0; i < e.d.count; i++) this.spawn(e); }); }
      if (this.pending.hit) { this.emitters.forEach((e) => { if (e.d.trigger === 'hit') for (let i = 0; i < e.d.count; i++) this.spawn(e, 'hit'); }); }
      if (this.pending.equip) { this.emitters.forEach((e) => { if (e.d.trigger === 'equip') for (let i = 0; i < e.d.count; i++) this.spawn(e); }); }
      this.pending.burst = this.pending.hit = this.pending.equip = false;
      this.arcs.forEach((a) => {
        a.acc += dt * a.d.speed;
        while (a.acc >= 1) { a.acc -= 1; for (let i = 0; i < a.d.count; i++) this.spawnArc(a); }
      });

      // particles
      const list = this.particles;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) { list[i] = list[list.length - 1]; list.pop(); continue; }
        const d = p.d;
        if (!p.locked) { p.vx += d.accel[0] * dt; p.vy += d.accel[1] * dt; p.vz += d.accel[2] * dt; }
        const k = Math.exp(-d.drag * dt);
        p.vx *= k; p.vy *= k; p.vz *= k;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rot += p.rs * dt;
      }

      // trail
      if (this.trailFx) {
        const active = this.trailFx.always || (sw >= 0 && swinging);
        if (active && !this.trailActive) this.trailSeg++;
        this.trailActive = active;
        if (active) {
          if (!this.trail) this.trail = [];
          this.trail.push({ a: this.toWorld(this.model.trail.a), b: this.toWorld(this.model.trail.b), t: this.t, seg: this.trailSeg });
        }
        if (this.trail) {
          const life = this.trailFx.life;
          while (this.trail.length && this.t - this.trail[0].t > life) this.trail.shift();
        }
      }
    }

    /* build everything the renderer needs for this frame */
    frame(cam, aspect) {
      const sc = 0.8 + 0.2 * (1 - Math.pow(1 - this.equipT, 3)) * (1 + 0.12 * Math.sin(this.equipT * Math.PI));
      const parts = [];
      const eye = cam.eye, fwd = V.norm(V.sub(cam.target, eye));
      const R_s = this.xf.R;
      const hue = this.hasRainbow ? hsv((this.t * this.rainbowSpeed) % 1, 0.85, 1) : null;
      const pulseGlow = this.glow && this.glow.pulse > 0 ? 0.7 + 0.3 * Math.sin(this.t * this.glow.pulse * 2 * Math.PI) : 1;

      this.parts.forEach((p) => {
        const R = M.mul3(R_s, p.Rl);
        const q = M.mulV(R_s, [p.lp[0] * sc, p.lp[1] * sc, p.lp[2] * sc]);
        const pos = [this.xf.p[0] + q[0], this.xf.p[1] + q[1], this.xf.p[2] + q[2]];
        let alpha = p.alpha;
        if (p.auraPulse > 0) alpha = Math.min(1, Math.max(0, alpha + 0.18 * Math.sin(this.t * p.auraPulse * 2 * Math.PI)));
        const color = hue && p.rainbow ? hue : p.color;
        parts.push({
          mesh: p.mesh, pos, rotCol: toCol3(R), size: [p.size[0] * sc, p.size[1] * sc, p.size[2] * sc], color,
          spec: p.look.spec, shin: p.look.shin, metal: p.look.metal, emit: Math.max(p.look.emit, 0), alpha,
          rim: 0.12 + 0.3 * p.look.spec, outline: this.outline && p.role !== 'aura',
          depth: V.dot(V.sub(pos, eye), fwd),
        });
      });

      if (this.avatar) {
        const ps = this.pose;
        const Rt = M.eulerToMat(ps.to);
        const R = {
          he: M.mul3(Rt, M.eulerToMat(ps.he)),
          ra: M.mul3(Rt, M.mul3(M.eulerToMat(ps.ra), HOLD)),
          la: M.mul3(Rt, M.eulerToMat(ps.la)),
          rl: M.eulerToMat(ps.rl),                // the legs keep their own turn: the hips cancel the torso
          ll: M.eulerToMat(ps.ll),
          to: Rt,
        };
        AVATAR.forEach((a) => {
          let pos, rot = R[a.g];
          if (a.g === 'to') pos = this.upper(a.pos);
          else {
            const pv = PIV[a.g];
            pos = V.add(this.upper(pv), M.mulV(rot, V.sub(a.pos, pv)));
          }
          parts.push({ mesh: a.mesh, pos, rotCol: toCol3(rot), size: a.size, color: a.color, spec: a.spec, shin: a.shin, metal: 0, emit: 0, alpha: 1, rim: a.rim, depth: V.dot(V.sub(pos, eye), fwd) });
        });
      }

      // glow light
      let point = null;
      if (this.glow) {
        const g = this.glow;
        const mid = this.toWorld(this.model.mid);
        const col = hue || g.color.map((v) => v / 255);
        const k = Math.min(1.1, g.brightness * 0.2) * pulseGlow;
        point = { pos: mid, col: [col[0] * k, col[1] * k, col[2] * k], range: Math.max(5, g.range * 0.55) };
      }

      // particles -> packed quads
      const right = [cam.view[0], cam.view[4], cam.view[8]];
      const up = [cam.view[1], cam.view[5], cam.view[9]];
      const data = cam.particleData;
      let n = 0;
      const tmp = [0, 0, 0];
      const list = this.particles;
      const CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < list.length && n < 3500; i++) {
        const p = list[i], d = p.d;
        const u = p.age / p.life;
        let x = p.x, y = p.y, z = p.z;
        if (p.locked) { const w = this.toWorld([x, y, z], sc); x = w[0]; y = w[1]; z = w[2]; }
        const size = seqAt(d.size, u);
        if (size <= 0.0005) continue;
        let r, g, b;
        if (p.tint) { r = p.tint[0] / 255; g = p.tint[1] / 255; b = p.tint[2] / 255; } else { colAt(d.color, u, tmp); r = tmp[0]; g = tmp[1]; b = tmp[2]; }
        if (hue && !p.tint && d.style === 'rainbow') { /* keep the gradient */ }
        const a = 1 - seqAt(d.transparency, u);
        const rot = p.rot;
        const off = n * 52;
        for (let c = 0; c < 4; c++) {
          const o = off + c * 13;
          data[o] = x; data[o + 1] = y; data[o + 2] = z;
          data[o + 3] = CORN[c][0]; data[o + 4] = CORN[c][1];
          data[o + 5] = size; data[o + 6] = rot;
          data[o + 7] = r; data[o + 8] = g; data[o + 9] = b; data[o + 10] = a;
          data[o + 11] = d.emission; data[o + 12] = p.tex;
        }
        n++;
      }

      // trail ribbons
      const ribbons = [];
      if (this.trailFx && this.trail && this.trail.length > 1) {
        const fx = this.trailFx;
        const bySeg = {};
        this.trail.forEach((pt) => { (bySeg[pt.seg] = bySeg[pt.seg] || []).push(pt); });
        Object.values(bySeg).forEach((pts) => {
          if (pts.length < 2) return;
          const buf = new Float32Array(pts.length * 2 * 7);
          let c = 0;
          const col = [0, 0, 0];
          for (let i = pts.length - 1; i >= 0; i--) {          // newest first
            const pt = pts[i];
            const u = Math.min(1, (this.t - pt.t) / fx.life);
            colAt(fx.color, u, col);
            const cc = hue || col;
            const a = Math.max(0, 1 - seqAt(fx.transparency, u));
            const w = Math.max(0.0, seqAt(fx.width, u));
            const mid = [(pt.a[0] + pt.b[0]) / 2, (pt.a[1] + pt.b[1]) / 2, (pt.a[2] + pt.b[2]) / 2];
            for (let s = 0; s < 2; s++) {
              const e = s === 0 ? pt.a : pt.b;
              buf.set([mid[0] + (e[0] - mid[0]) * w, mid[1] + (e[1] - mid[1]) * w, mid[2] + (e[2] - mid[2]) * w, cc[0], cc[1], cc[2], a], c * 7);
              c++;
            }
          }
          ribbons.push({ data: buf, count: c, emit: fx.glow });
        });
      }

      const L = {
        dir: V.norm([-0.55, 0.85, -0.5]), col: [1.0, 0.95, 0.88], sky: [0.34, 0.4, 0.52], ground: [0.1, 0.1, 0.13],
      };
      return {
        vp: cam.vp, eye, right, up, parts, point, light: L,
        particleData: data, particleCount: n, ribbons, flipWedge: this.flipWedge,
        outline: this.outline ? { color: this.outline.color.map((v) => v / 255), alpha: 1 - this.outline.outlineT, grow: 0.07 } : null,
        flash: (1 - this.equipT) * (1 - this.equipT) * 0.25,
      };
    }
  }

  const ARC_DESC = {
    size: [[0, 0.28], [1, 0.1]], transparency: [[0, 0], [1, 1]], color: [[0, [255, 255, 255]], [1, [255, 255, 255]]],
    accel: [0, 0, 0], drag: 0, emission: 1,
  };

  /* ---------------------------------------------------------------- Preview */
  const THEMES = {
    forge: { top: [0.09, 0.1, 0.14], bottom: [0.03, 0.035, 0.05] },
    dusk: { top: [0.16, 0.12, 0.24], bottom: [0.04, 0.03, 0.08] },
    studio: { top: [0.3, 0.33, 0.38], bottom: [0.12, 0.13, 0.16] },
    daylight: { top: [0.55, 0.7, 0.88], bottom: [0.22, 0.3, 0.4] },
  };

  class Preview {
    static supported() {
      try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
      } catch (e) { return false; }
    }

    constructor(container, opts) {
      opts = opts || {};
      this.el = container;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'stage-canvas';
      this.canvas.setAttribute('aria-label', '3D preview of your sword. Drag to rotate, scroll to zoom, click to swing.');
      this.canvas.tabIndex = 0;
      container.appendChild(this.canvas);
      this.renderer = new Renderer(this.canvas, { preserve: !!opts.preserve });
      this.scene = new Scene({ avatar: opts.avatar !== false });
      this.theme = 'forge';
      this.autoRotate = opts.autoRotate !== false;
      this.cam = {
        yaw: 112 * D2R, pitch: 0.13, dist: 17, target: [0.6, 4.2, -0.4],
        goalDist: 17, goalTarget: [0.6, 4.2, -0.4], particleData: this.renderer.pData,
      };
      this.userT = -10;
      this.running = false;
      this.last = 0;
      this.pointers = new Map();
      this.bindInput();
      // phones drop the GL context when the tab is in the background; rebuild everything when it comes back
      this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
      this.canvas.addEventListener('webglcontextrestored', () => {
        this.renderer.init();
        this.renderer.w = this.renderer.h = 0;
        this.lost = false;
        this.resize();
      });
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(container);
      this.resize();
    }

    setModel(model, opts) {
      this.scene.setModel(model, opts);
      this.frameCamera();
    }

    swing() { this.scene.swing(); }
    playMove(id) { this.scene.playMove(id); }
    setAvatar(on) { this.scene.avatar = on; this.frameCamera(); }
    setAutoRotate(on) { this.autoRotate = on; }
    setTheme(name) { this.theme = THEMES[name] ? name : 'forge'; }

    frameCamera(snap) {
      const s = this.scene;
      if (!s.model) return;
      const cam = this.cam;
      const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
      let cy, span, cx = 0.6, cz = -0.4;
      const swordTop = GRIP0[1] + s.swordTop;
      if (s.avatar) {
        const top = Math.max(5.6, swordTop + 0.6);
        cy = top / 2 - 0.1; span = top * 1.26;
        cx = 0.7; cz = -0.6;
      } else {
        const bottom = GRIP0[1] + s.swordBottom;
        cy = (swordTop + bottom) / 2; span = (swordTop - bottom) * 1.22 + 1.5;
        cx = GRIP0[0]; cz = GRIP0[2];
      }
      const tanF = Math.tan(FOV / 2);
      const dV = span / (2 * tanF);
      const dH = (span * 0.62) / (2 * tanF * Math.max(0.3, aspect));
      cam.goalTarget = [cx, cy, cz];
      cam.goalDist = Math.max(dV, dH, 5);
      if (snap) { cam.target = cam.goalTarget.slice(); cam.dist = cam.goalDist; }
    }

    resetCamera() {
      this.cam.yaw = 112 * D2R;
      this.cam.pitch = 0.13;
      this.frameCamera();
    }

    resize() {
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const k = Math.max(1.5, dpr);
      this.renderer.resize(w * k, h * k);
      this.frameCamera();
    }

    bindInput() {
      const cv = this.canvas;
      let down = null;
      cv.addEventListener('pointerdown', (e) => {
        cv.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
        this.userT = performance.now() / 1000;
      });
      cv.addEventListener('pointermove', (e) => {
        const p = this.pointers.get(e.pointerId);
        if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (this.pointers.size === 1) {
          this.cam.yaw -= dx * 0.008;
          this.cam.pitch = Math.max(-0.35, Math.min(1.25, this.cam.pitch + dy * 0.006));
        } else if (this.pointers.size === 2) {
          const ids = [...this.pointers.keys()];
          const other = this.pointers.get(ids[0] === e.pointerId ? ids[1] : ids[0]);
          const before = Math.hypot(p.x - other.x, p.y - other.y);
          const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
          if (before > 0) this.cam.goalDist = Math.max(3, Math.min(90, this.cam.goalDist * (before / after)));
        }
        if (down) down.moved += Math.abs(dx) + Math.abs(dy);
        p.x = e.clientX; p.y = e.clientY;
        this.userT = performance.now() / 1000;
      });
      const up = (e) => {
        this.pointers.delete(e.pointerId);
        if (down && this.pointers.size === 0 && down.moved < 8 && performance.now() - down.t < 400) this.swing();
        if (this.pointers.size === 0) down = null;
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.cam.goalDist = Math.max(3, Math.min(90, this.cam.goalDist * Math.exp(e.deltaY * 0.0012)));
        this.userT = performance.now() / 1000;
      }, { passive: false });
      cv.addEventListener('dblclick', () => this.resetCamera());
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      const tick = (now) => {
        if (!this.running) return;
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.step(dt);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    stop() { this.running = false; }

    step(dt) {
      const cam = this.cam;
      const now = performance.now() / 1000;
      if (this.autoRotate && now - this.userT > 2.5 && this.pointers.size === 0) cam.yaw += dt * 0.28;
      const k = 1 - Math.exp(-dt * 6);
      cam.dist += (cam.goalDist - cam.dist) * k;
      for (let i = 0; i < 3; i++) cam.target[i] += (cam.goalTarget[i] - cam.target[i]) * k;
      this.scene.update(dt);
      this.draw();
    }

    draw() {
      const cam = this.cam, sc = this.scene;
      if (this.lost || !sc.model || !this.renderer.w) return;
      const aspect = this.renderer.w / this.renderer.h;
      const cp = Math.cos(cam.pitch);
      cam.eye = [cam.target[0] + cam.dist * cp * Math.sin(cam.yaw), cam.target[1] + cam.dist * Math.sin(cam.pitch), cam.target[2] + cam.dist * cp * Math.cos(cam.yaw)];
      cam.view = lookAt(cam.eye, cam.target, [0, 1, 0]);
      cam.vp = mul4(perspective(FOV, aspect, 0.2, 260), cam.view);
      const f = sc.frame(cam, aspect);
      const th = THEMES[this.theme];
      // where the sword is on screen (for the background glow)
      const mid = sc.toWorld(sc.model.mid);
      const vp = cam.vp;
      const cw = vp[3] * mid[0] + vp[7] * mid[1] + vp[11] * mid[2] + vp[15];
      const nx = (vp[0] * mid[0] + vp[4] * mid[1] + vp[8] * mid[2] + vp[12]) / cw;
      const ny = (vp[1] * mid[0] + vp[5] * mid[1] + vp[9] * mid[2] + vp[13]) / cw;
      f.bg = { top: th.top, bottom: th.bottom, glow: sc.accent, glowPos: [nx * 0.5 + 0.5, ny * 0.5 + 0.5], glowAmt: sc.thumb ? 0.28 : 0.2 };
      f.ground = sc.thumb ? null : { radius: 7.5, tint: this.theme === 'daylight' ? [0.5, 0.6, 0.7] : [0.2, 0.24, 0.32], shadow: [0.6, -0.3, 1.6] };
      f.bloom = 1;
      this.renderer.render(f);
    }

    dispose() {
      this.running = false;
      this.ro.disconnect();
      this.canvas.remove();
    }
  }

  /* ------------------------------------------------------------- thumbnails */
  let thumbCtx = null;
  function thumbnail(model, w, h, opts) {
    opts = opts || {};
    if (!thumbCtx) {
      const canvas = document.createElement('canvas');
      thumbCtx = { canvas, renderer: new Renderer(canvas, { preserve: true }) };
    }
    const { canvas, renderer } = thumbCtx;
    renderer.resize(w, h);
    const sc = new Scene({ thumb: true });
    sc.setModel(model, { equip: false });
    sc.equipT = 1;
    const warm = opts.warm == null ? 1.6 : opts.warm;
    sc.update(1 / 60);                         // places the sword (also runs the idle effects once)
    for (let t = 0; t < warm; t += 1 / 30) sc.update(1 / 30);
    const len = sc.swordTop - sc.swordBottom;
    const tanF = Math.tan(FOV / 2);
    const aspect = w / h;
    let span = len * 1.22 + 0.6, ty = 0, minDist = 0;
    if (opts.focus) {                        // zoom on one part of the sword (guard / pommel pickers)
      span = opts.focus.span;
      ty = opts.focus.y - (sc.swordTop + sc.swordBottom) / 2;
    } else {
      minDist = (model.parts.reduce((m, p) => Math.max(m, Math.abs(p.p[2]) + p.sz[2] / 2, 0), 0) * 2 + 1.8) / (2 * tanF * aspect);
    }
    const dist = Math.max(span / (2 * tanF), minDist);
    const yaw = (opts.yaw == null ? 62 : opts.yaw) * D2R, pitch = (opts.pitch == null ? 0.1 : opts.pitch);
    const cam = { target: [0, ty, 0], dist, yaw, pitch, particleData: renderer.pData };
    const cp = Math.cos(pitch);
    cam.eye = [cam.target[0] + dist * cp * Math.sin(yaw), cam.target[1] + dist * Math.sin(pitch), cam.target[2] + dist * cp * Math.cos(yaw)];
    cam.view = lookAt(cam.eye, cam.target, [0, 1, 0]);
    cam.vp = mul4(perspective(FOV, aspect, 0.2, 200), cam.view);
    const f = sc.frame(cam, aspect);
    f.bg = { top: [0.13, 0.15, 0.2], bottom: [0.04, 0.045, 0.065], glow: sc.accent, glowPos: [0.5, 0.5], glowAmt: opts.focus ? 0.12 : 0.34 };
    f.ground = null;
    f.bloom = 1;
    renderer.render(f);
    return canvas;
  }

  SF.Preview = Preview;
  SF.thumbnail = thumbnail;
})((globalThis.SF = globalThis.SF || {}));
