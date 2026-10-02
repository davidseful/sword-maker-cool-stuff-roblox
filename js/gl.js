/* ==========================================================================
   Sword Forge - gl.js
   A tiny dependency-free WebGL1 renderer used by the 3D preview:
   lit meshes (box / wedge / cylinder / sphere), translucent parts, ribbons
   (trails), billboard particles and a bloom post-process.
   ========================================================================== */
(function (SF) {
  'use strict';

  /* ---------------------------------------------------------------- vec / mat */
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function lookAt(eye, center, up) {
    const z = V.norm(V.sub(eye, center));
    const x = V.norm(V.cross(up, z));
    const y = V.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1]);
  }
  function mul4(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }
  /* row-major 3x3 (like model.js) -> column-major for uniformMatrix3fv */
  const toCol3 = (R) => new Float32Array([R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]);

  /* ------------------------------------------------------------------- meshes */
  function MeshBuilder() { this.pos = []; this.nrm = []; this.idx = []; }
  MeshBuilder.prototype.vert = function (p, n) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    return this.pos.length / 3 - 1;
  };
  // flat triangle, wound so the geometric normal agrees with n
  MeshBuilder.prototype.tri = function (a, b, c, n) {
    if (V.dot(V.cross(V.sub(b, a), V.sub(c, a)), n) < 0) { const t = b; b = c; c = t; }
    this.idx.push(this.vert(a, n), this.vert(b, n), this.vert(c, n));
  };
  MeshBuilder.prototype.quad = function (a, b, c, d, n) { this.tri(a, b, c, n); this.tri(a, c, d, n); };
  // smooth triangle with per-vertex normals
  MeshBuilder.prototype.tris = function (pa, na, pb, nb, pc, nc) {
    const n = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]];
    if (V.dot(V.cross(V.sub(pb, pa), V.sub(pc, pa)), n) < 0) { let t = pb; pb = pc; pc = t; t = nb; nb = nc; nc = t; }
    this.idx.push(this.vert(pa, na), this.vert(pb, nb), this.vert(pc, nc));
  };
  MeshBuilder.prototype.done = function () {
    return { pos: new Float32Array(this.pos), nrm: new Float32Array(this.nrm), idx: new Uint16Array(this.idx) };
  };

  function boxMesh() {
    const m = new MeshBuilder();
    const h = 0.5;
    const faces = [
      [[1, 0, 0], [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]]],
      [[-1, 0, 0], [[-h, -h, -h], [-h, h, -h], [-h, h, h], [-h, -h, h]]],
      [[0, 1, 0], [[-h, h, -h], [h, h, -h], [h, h, h], [-h, h, h]]],
      [[0, -1, 0], [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]]],
      [[0, 0, 1], [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]]],
      [[0, 0, -1], [[-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h]]],
    ];
    faces.forEach(([n, q]) => m.quad(q[0], q[1], q[2], q[3], n));
    return m.done();
  }

  /* Roblox WedgePart: triangle in the Y/Z plane (extruded along X):
     front-bottom (-Y,-Z), back-bottom (-Y,+Z), back-top (+Y,+Z). `flip` mirrors it (see "Flip wedges"). */
  function wedgeMesh(flip) {
    const m = new MeshBuilder();
    const h = 0.5;
    const s = flip ? -1 : 1;                       // mirror Z
    const FB = (x) => [x, -h, -h * s], BB = (x) => [x, -h, h * s], BT = (x) => [x, h, h * s];
    m.quad(FB(-h), FB(h), BB(h), BB(-h), [0, -1, 0]);                   // bottom
    m.quad(BB(-h), BB(h), BT(h), BT(-h), [0, 0, s]);                    // back (vertical face)
    const slope = V.norm([0, 1, -s]);
    m.quad(FB(-h), FB(h), BT(h), BT(-h), slope);                        // slope
    m.tri(FB(-h), BB(-h), BT(-h), [-1, 0, 0]);                          // sides
    m.tri(FB(h), BB(h), BT(h), [1, 0, 0]);
    return m.done();
  }

  /* cylinder along X, radius 0.5 (Roblox cylinder), length 1 */
  function cylinderMesh(seg) {
    const m = new MeshBuilder();
    const h = 0.5;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const n0 = [0, c0, s0], n1 = [0, c1, s1];
      const p00 = [-h, 0.5 * c0, 0.5 * s0], p01 = [h, 0.5 * c0, 0.5 * s0], p10 = [-h, 0.5 * c1, 0.5 * s1], p11 = [h, 0.5 * c1, 0.5 * s1];
      m.tris(p00, n0, p01, n0, p11, n1);
      m.tris(p00, n0, p11, n1, p10, n1);
      m.tri([h, 0, 0], p01, p11, [1, 0, 0]);
      m.tri([-h, 0, 0], p00, p10, [-1, 0, 0]);
    }
    return m.done();
  }

  function sphereMesh(lat, lon) {
    const m = new MeshBuilder();
    const P = (i, j) => {
      const th = (i / lat) * Math.PI, ph = (j / lon) * Math.PI * 2;
      const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      return [[n[0] * 0.5, n[1] * 0.5, n[2] * 0.5], n];
    };
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
        if (i > 0) m.tris(a[0], a[1], b[0], b[1], d[0], d[1]);
        if (i < lat - 1) m.tris(b[0], b[1], c[0], c[1], d[0], d[1]);
      }
    }
    return m.done();
  }

  /* ------------------------------------------------------------------ shaders */
  const PREC = 'precision highp float;\n';
  const SRC = {};

  SRC.meshVS = `
attribute vec3 aPos; attribute vec3 aNrm;
uniform mat4 uVP; uniform vec3 uPos; uniform mat3 uRot; uniform vec3 uSize;
varying vec3 vN; varying vec3 vP;
void main() {
  vec3 wp = uPos + uRot * (aPos * uSize);
  vN = normalize(uRot * (aNrm / uSize));
  vP = wp;
  gl_Position = uVP * vec4(wp, 1.0);
}`;
  SRC.meshFS = PREC + `
varying vec3 vN; varying vec3 vP;
uniform vec3 uCam, uLightDir, uLightCol, uSky, uGround, uColor, uPLPos, uPLCol;
uniform float uSpec, uShin, uMetal, uEmit, uAlpha, uRim, uPLRange, uFlat, uFlash;
void main() {
  if (uFlat > 0.5) { gl_FragColor = vec4(uColor, uAlpha); return; }
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vP);
  vec3 L = normalize(uLightDir);
  float ndl = max(dot(N, L), 0.0);
  vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
  vec3 L2 = normalize(vec3(0.7, 0.15, 0.7));
  float ndl2 = max(dot(N, L2), 0.0);
  vec3 base = uColor;
  vec3 diffuse = base * (hemi + uLightCol * ndl + vec3(0.55, 0.62, 0.8) * ndl2 * 0.38);
  vec3 toL = uPLPos - vP;
  float d = length(toL);
  float att = clamp(1.0 - d / max(uPLRange, 0.01), 0.0, 1.0);
  att *= att;
  diffuse += base * uPLCol * att * max(dot(N, toL / max(d, 0.001)), 0.0) * 1.4;
  vec3 H = normalize(L + V);
  float sp = pow(max(dot(N, H), 0.0), uShin) * uSpec;
  vec3 specCol = mix(vec3(1.0), base, uMetal);
  vec3 R = reflect(-V, N);
  float horizon = pow(1.0 - abs(R.y), 4.0);
  vec3 env = mix(uGround * 0.9, uSky * 1.7 + vec3(0.16), clamp(R.y * 0.5 + 0.5, 0.0, 1.0)) + vec3(0.5, 0.56, 0.66) * horizon * 0.7;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 lit = diffuse * (1.0 - 0.4 * uMetal)
           + uLightCol * sp * specCol * 1.3
           + env * specCol * uSpec * (0.3 + 0.6 * uMetal) * (0.6 + fres)
           + fres * uRim * (uSky + vec3(0.15));
  lit += uPLCol * att * sp * 0.6;
  vec3 col = mix(lit, base * 1.02 + vec3(0.02), uEmit);
  col += vec3(uFlash);
  gl_FragColor = vec4(col, uAlpha);
}`;

  SRC.particleVS = `
attribute vec3 aCenter; attribute vec2 aCorner; attribute vec2 aSizeRot; attribute vec4 aColor; attribute vec2 aEmitTex;
uniform mat4 uVP; uniform vec3 uRight; uniform vec3 uUp;
varying vec2 vUV; varying vec4 vColor; varying float vEmit;
void main() {
  float cr = cos(aSizeRot.y), sr = sin(aSizeRot.y);
  vec2 c = vec2(cr * aCorner.x - sr * aCorner.y, sr * aCorner.x + cr * aCorner.y);
  vec3 wp = aCenter + (uRight * c.x + uUp * c.y) * aSizeRot.x * 0.5;
  vUV = vec2((aCorner.x * 0.5 + 0.5 + aEmitTex.y) / 4.0, 1.0 - (aCorner.y * 0.5 + 0.5));
  vColor = aColor;
  vEmit = aEmitTex.x;
  gl_Position = uVP * vec4(wp, 1.0);
}`;
  SRC.particleFS = PREC + `
varying vec2 vUV; varying vec4 vColor; varying float vEmit;
uniform sampler2D uAtlas;
void main() {
  vec4 t = texture2D(uAtlas, vUV);
  float a = t.a * vColor.a;
  gl_FragColor = vec4(vColor.rgb * a, a * (1.0 - vEmit));
}`;

  SRC.ribbonVS = `
attribute vec3 aPos; attribute vec4 aCol;
uniform mat4 uVP;
varying vec4 vCol;
void main() { vCol = aCol; gl_Position = uVP * vec4(aPos, 1.0); }`;
  SRC.ribbonFS = PREC + `
varying vec4 vCol; uniform float uEmit;
void main() { gl_FragColor = vec4(vCol.rgb * vCol.a, vCol.a * (1.0 - uEmit)); }`;

  SRC.quadVS = `
attribute vec2 aPos; varying vec2 vUV;
void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  SRC.bgFS = PREC + `
varying vec2 vUV;
uniform vec3 uTop, uBottom, uGlow; uniform vec2 uGlowPos; uniform float uGlowAmt, uAspect;
void main() {
  vec3 c = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUV.y));
  vec2 d = (vUV - uGlowPos) * vec2(uAspect, 1.0);
  float g = exp(-dot(d, d) * 7.0);
  c += uGlow * g * uGlowAmt;
  float v = distance(vUV, vec2(0.5, 0.55));
  c *= 1.0 - smoothstep(0.35, 0.95, v) * 0.5;
  gl_FragColor = vec4(c, 1.0);
}`;
  SRC.brightFS = PREC + `
varying vec2 vUV; uniform sampler2D uTex; uniform float uThreshold;
void main() {
  vec3 c = texture2D(uTex, vUV).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.25, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;
  SRC.blurFS = PREC + `
varying vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir;
void main() {
  vec3 s = texture2D(uTex, vUV).rgb * 0.2270270270;
  s += (texture2D(uTex, vUV + uDir * 1.3846153846).rgb + texture2D(uTex, vUV - uDir * 1.3846153846).rgb) * 0.3162162162;
  s += (texture2D(uTex, vUV + uDir * 3.2307692308).rgb + texture2D(uTex, vUV - uDir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(s, 1.0);
}`;
  SRC.compositeFS = PREC + `
varying vec2 vUV; uniform sampler2D uScene, uBloom; uniform float uBloomAmt, uGrain;
void main() {
  vec3 c = texture2D(uScene, vUV).rgb;
  vec3 b = texture2D(uBloom, vUV).rgb;
  c += b * uBloomAmt;
  c = c / (1.0 + max(c - 1.0, 0.0) * 0.55);
  c += (fract(sin(dot(vUV * 913.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * uGrain;
  gl_FragColor = vec4(c, 1.0);
}`;
  SRC.groundVS = `
attribute vec2 aPos; uniform mat4 uVP; uniform float uSize; varying vec2 vW;
void main() { vec2 w = aPos * uSize; vW = w; gl_Position = uVP * vec4(w.x, 0.0, w.y, 1.0); }`;
  SRC.groundFS = PREC + `
varying vec2 vW; uniform vec3 uTint; uniform vec3 uShadow; uniform float uRadius;
void main() {
  float r = length(vW);
  float disc = 1.0 - smoothstep(uRadius - 1.5, uRadius, r);
  vec2 g = abs(fract(vW / 2.0 + 0.5) - 0.5) / fwidth(vW / 2.0);
  float line = 1.0 - clamp(min(g.x, g.y), 0.0, 1.0);
  float ring = (1.0 - smoothstep(0.0, 0.07, abs(r - uRadius + 0.7))) * 0.8;
  float ring2 = (1.0 - smoothstep(0.0, 0.05, abs(r - uRadius * 0.55))) * 0.35;
  float sh = 1.0 - smoothstep(0.0, 1.0, length((vW - uShadow.xy) / vec2(uShadow.z, uShadow.z * 0.7)));
  vec3 base = uTint * (0.5 + 0.5 * (1.0 - r / uRadius));
  vec3 col = base + uTint * (line * 0.22 + ring + ring2);
  col *= 1.0 - sh * 0.75;
  float a = disc * (0.78 + 0.1 * line + 0.2 * ring);
  gl_FragColor = vec4(col, a);
}`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }
  function program(gl, vs, fs, attribs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program link failed: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u, attribs };
  }

  /* ------------------------------------------------------ particle sprite atlas */
  function makeAtlas() {
    const T = 128;
    const c = document.createElement('canvas');
    c.width = T * 4; c.height = T;
    const g = c.getContext('2d');
    const rg = (x, y, r, stops) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`));
      return gr;
    };
    // 0: sparkle (4-point star)
    {
      const ox = 0, cx = ox + T / 2, cy = T / 2;
      g.fillStyle = rg(cx, cy, T * 0.42, [[0, 0.95], [0.18, 0.55], [0.5, 0.14], [1, 0]]);
      g.fillRect(ox, 0, T, T);
      [[1, 0], [0, 1]].forEach(([dx, dy]) => {
        const a = T * 0.48, w = 4.5;
        const gr = g.createLinearGradient(cx - dx * a, cy - dy * a, cx + dx * a, cy + dy * a);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.save();
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(cx - dx * a, cy - dy * a);
        g.lineTo(cx + dy * w, cy + dx * w);
        g.lineTo(cx + dx * a, cy + dy * a);
        g.lineTo(cx - dy * w, cy - dx * w);
        g.closePath();
        g.fill();
        g.restore();
      });
    }
    // 1: smoke puff
    {
      const ox = T, rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
      g.save(); g.beginPath(); g.rect(ox, 0, T, T); g.clip();
      for (let i = 0; i < 16; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * T * 0.2;
        const x = ox + T / 2 + Math.cos(a) * d, y = T / 2 + Math.sin(a) * d, r = T * (0.2 + rnd() * 0.18);
        g.fillStyle = rg(x, y, r, [[0, 0.32], [0.6, 0.14], [1, 0]]);
        g.fillRect(ox, 0, T, T);
      }
      g.restore();
    }
    // 2: flame
    {
      const ox = T * 2;
      g.save(); g.beginPath(); g.rect(ox, 0, T, T); g.clip();
      g.fillStyle = rg(ox + T / 2, T * 0.62, T * 0.4, [[0, 0.95], [0.5, 0.5], [1, 0]]);
      g.fillRect(ox, 0, T, T);
      g.beginPath();
      g.moveTo(ox + T * 0.5, T * 0.04);
      g.bezierCurveTo(ox + T * 0.78, T * 0.36, ox + T * 0.86, T * 0.62, ox + T * 0.5, T * 0.92);
      g.bezierCurveTo(ox + T * 0.14, T * 0.62, ox + T * 0.22, T * 0.36, ox + T * 0.5, T * 0.04);
      g.closePath();
      g.fillStyle = rg(ox + T / 2, T * 0.64, T * 0.44, [[0, 0.9], [0.55, 0.45], [1, 0]]);
      g.fill();
      g.restore();
    }
    // 3: soft dot
    {
      const ox = T * 3;
      g.fillStyle = rg(ox + T / 2, T / 2, T * 0.5, [[0, 1], [0.25, 0.7], [0.6, 0.18], [1, 0]]);
      g.fillRect(ox, 0, T, T);
    }
    return c;
  }

  /* ------------------------------------------------------------------ Renderer */
  class Renderer {
    constructor(canvas, opts) {
      opts = opts || {};
      const attrs = { antialias: false, alpha: false, depth: true, stencil: false, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' };
      const gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
      if (!gl) throw new Error('WebGL is not available');
      this.gl = gl;
      this.canvas = canvas;
      this.ext = gl.getExtension('OES_standard_derivatives');
      this.maxParticles = 3600;
      this.flipWedge = false;
      this.init();
    }

    init() {
      const gl = this.gl;
      this.progs = {
        mesh: program(gl, SRC.meshVS, SRC.meshFS, ['aPos', 'aNrm']),
        particle: program(gl, SRC.particleVS, SRC.particleFS, ['aCenter', 'aCorner', 'aSizeRot', 'aColor', 'aEmitTex']),
        ribbon: program(gl, SRC.ribbonVS, SRC.ribbonFS, ['aPos', 'aCol']),
        bg: program(gl, SRC.quadVS, SRC.bgFS, ['aPos']),
        bright: program(gl, SRC.quadVS, SRC.brightFS, ['aPos']),
        blur: program(gl, SRC.quadVS, SRC.blurFS, ['aPos']),
        composite: program(gl, SRC.quadVS, SRC.compositeFS, ['aPos']),
      };
      // the ground uses fwidth() for crisp grid lines when the extension exists
      const gfs = (this.ext ? '#extension GL_OES_standard_derivatives : enable\n' : '') + SRC.groundFS.replace(/fwidth\(vW \/ 2\.0\)/, this.ext ? 'fwidth(vW / 2.0)' : 'vec2(0.03)');
      this.progs.ground = program(gl, SRC.groundVS, gfs, ['aPos']);

      const upload = (data) => {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return b;
      };
      const meshBuf = (m) => {
        const ib = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
        return { pos: upload(m.pos), nrm: upload(m.nrm), idx: ib, count: m.idx.length };
      };
      this.meshes = {
        box: meshBuf(boxMesh()),
        wedge: meshBuf(wedgeMesh(false)),
        wedgeFlip: meshBuf(wedgeMesh(true)),
        cyl: meshBuf(cylinderMesh(32)),
        sphere: meshBuf(sphereMesh(16, 28)),
      };
      this.quad = upload(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));

      // particles: dynamic quad buffer
      this.pData = new Float32Array(this.maxParticles * 4 * 13);
      this.pBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.pData.byteLength, gl.DYNAMIC_DRAW);
      const idx = new Uint16Array(this.maxParticles * 6);
      for (let i = 0; i < this.maxParticles; i++) {
        idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
      }
      this.pIdx = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.pIdx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

      // ribbons
      this.rData = new Float32Array(2400 * 7);
      this.rBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.rBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.rData.byteLength, gl.DYNAMIC_DRAW);

      // atlas
      this.atlas = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.atlas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeAtlas());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.w = 0; this.h = 0;
      this.targets = {};
    }

    /* (re)create render targets for a canvas size in device pixels */
    resize(w, h) {
      w = Math.max(2, Math.floor(w)); h = Math.max(2, Math.floor(h));
      if (w === this.w && h === this.h) return;
      this.w = w; this.h = h;
      this.canvas.width = w; this.canvas.height = h;
      const gl = this.gl;
      Object.values(this.targets).forEach((t) => { gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.tex); if (t.rb) gl.deleteRenderbuffer(t.rb); });
      const mk = (tw, th, depth) => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        let rb = null;
        if (depth) {
          rb = gl.createRenderbuffer();
          gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
          gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, tw, th);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
        }
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer incomplete');
        return { fb, tex, rb, w: tw, h: th };
      };
      const bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
      this.targets = { scene: mk(w, h, true), bloomA: mk(bw, bh, false), bloomB: mk(bw, bh, false) };
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    use(prog) {
      const gl = this.gl;
      if (this.cur === prog) return;
      this.cur = prog;
      gl.useProgram(prog.p);
      for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    }

    drawQuad(prog) {
      const gl = this.gl;
      this.use(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    tex(unit, texture) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    /* ----------------------------------------------------------------- frame */
    render(f) {
      const gl = this.gl;
      const T = this.targets;
      const P = this.progs;
      const light = f.light;
      this.cur = null;
      this.flipWedge = !!f.flipWedge;

      /* ---- scene pass */
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.scene.fb);
      gl.viewport(0, 0, T.scene.w, T.scene.h);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // background
      this.use(P.bg);
      gl.uniform3fv(P.bg.u.uTop, f.bg.top);
      gl.uniform3fv(P.bg.u.uBottom, f.bg.bottom);
      gl.uniform3fv(P.bg.u.uGlow, f.bg.glow);
      gl.uniform2fv(P.bg.u.uGlowPos, f.bg.glowPos);
      gl.uniform1f(P.bg.u.uGlowAmt, f.bg.glowAmt);
      gl.uniform1f(P.bg.u.uAspect, T.scene.w / T.scene.h);
      this.drawQuad(P.bg);

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      // ground
      if (f.ground) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        this.use(P.ground);
        gl.uniformMatrix4fv(P.ground.u.uVP, false, f.vp);
        gl.uniform1f(P.ground.u.uSize, f.ground.radius * 2.2);
        gl.uniform1f(P.ground.u.uRadius, f.ground.radius);
        gl.uniform3fv(P.ground.u.uTint, f.ground.tint);
        gl.uniform3fv(P.ground.u.uShadow, f.ground.shadow);
        this.drawQuad(P.ground);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }

      // opaque parts
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      this.use(P.mesh);
      const U = P.mesh.u;
      gl.uniformMatrix4fv(U.uVP, false, f.vp);
      gl.uniform3fv(U.uCam, f.eye);
      gl.uniform3fv(U.uLightDir, light.dir);
      gl.uniform3fv(U.uLightCol, light.col);
      gl.uniform3fv(U.uSky, light.sky);
      gl.uniform3fv(U.uGround, light.ground);
      const pl = f.point || { pos: [0, 0, 0], col: [0, 0, 0], range: 1 };
      gl.uniform3fv(U.uPLPos, pl.pos);
      gl.uniform3fv(U.uPLCol, pl.col);
      gl.uniform1f(U.uPLRange, pl.range);
      gl.uniform1f(U.uFlash, f.flash || 0);
      const opaque = [], clear = [];
      f.parts.forEach((p) => (p.alpha >= 0.999 ? opaque : clear).push(p));
      gl.uniform1f(U.uFlat, 0);
      opaque.forEach((p) => this.drawPart(p, false));

      // outline (inverted hull)
      if (f.outline) {
        gl.cullFace(gl.FRONT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.uniform1f(U.uFlat, 1);
        f.parts.forEach((p) => { if (p.outline) this.drawPart(p, true, f.outline); });
        gl.uniform1f(U.uFlat, 0);
        gl.depthMask(true);
        gl.cullFace(gl.BACK);
      }

      // translucent parts, far to near
      if (clear.length) {
        clear.sort((a, b) => b.depth - a.depth);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        clear.forEach((p) => this.drawPart(p, false));
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
      gl.disable(gl.CULL_FACE);

      // ribbons (trails)
      if (f.ribbons && f.ribbons.length) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        this.use(P.ribbon);
        gl.uniformMatrix4fv(P.ribbon.u.uVP, false, f.vp);
        f.ribbons.forEach((r) => {
          if (r.count < 4) return;
          gl.uniform1f(P.ribbon.u.uEmit, r.emit);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.rBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, r.data.subarray(0, r.count * 7));
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
          gl.enableVertexAttribArray(1);
          gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, r.count);
        });
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }

      // particles
      if (f.particleCount > 0) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        this.use(P.particle);
        gl.uniformMatrix4fv(P.particle.u.uVP, false, f.vp);
        gl.uniform3fv(P.particle.u.uRight, f.right);
        gl.uniform3fv(P.particle.u.uUp, f.up);
        this.tex(0, this.atlas);
        gl.uniform1i(P.particle.u.uAtlas, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.pBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, f.particleData.subarray(0, f.particleCount * 4 * 13));
        const S = 13 * 4;
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, S, 12);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, S, 20);
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, S, 28);
        gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, S, 44);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.pIdx);
        gl.drawElements(gl.TRIANGLES, f.particleCount * 6, gl.UNSIGNED_SHORT, 0);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
      gl.disable(gl.DEPTH_TEST);

      /* ---- bloom */
      const bloom = f.bloom == null ? 1 : f.bloom;
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.bloomA.fb);
      gl.viewport(0, 0, T.bloomA.w, T.bloomA.h);
      this.use(P.bright);
      this.tex(0, T.scene.tex);
      gl.uniform1i(P.bright.u.uTex, 0);
      gl.uniform1f(P.bright.u.uThreshold, 0.76);
      this.drawQuad(P.bright);
      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, T.bloomB.fb);
        this.use(P.blur);
        this.tex(0, T.bloomA.tex);
        gl.uniform1i(P.blur.u.uTex, 0);
        gl.uniform2f(P.blur.u.uDir, (1.6 + i) / T.bloomA.w, 0);
        this.drawQuad(P.blur);
        gl.bindFramebuffer(gl.FRAMEBUFFER, T.bloomA.fb);
        this.tex(0, T.bloomB.tex);
        gl.uniform2f(P.blur.u.uDir, 0, (1.6 + i) / T.bloomA.h);
        this.drawQuad(P.blur);
      }

      /* ---- composite to the canvas */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.w, this.h);
      this.use(P.composite);
      this.tex(0, T.scene.tex);
      this.tex(1, T.bloomA.tex);
      gl.uniform1i(P.composite.u.uScene, 0);
      gl.uniform1i(P.composite.u.uBloom, 1);
      gl.uniform1f(P.composite.u.uBloomAmt, 0.85 * bloom);
      gl.uniform1f(P.composite.u.uGrain, 0.012);
      this.drawQuad(P.composite);
    }

    drawPart(p, hull, hullInfo) {
      const gl = this.gl;
      const U = this.progs.mesh.u;
      const mesh = p.mesh === 'wedge' && this.flipWedge ? this.meshes.wedgeFlip : this.meshes[p.mesh];
      gl.uniform3fv(U.uPos, p.pos);
      gl.uniformMatrix3fv(U.uRot, false, p.rotCol);
      if (hull) {
        const g = hullInfo.grow;
        gl.uniform3f(U.uSize, p.size[0] + g, p.size[1] + g, p.size[2] + g);
        gl.uniform3fv(U.uColor, hullInfo.color);
        gl.uniform1f(U.uAlpha, hullInfo.alpha);
      } else {
        gl.uniform3fv(U.uSize, p.size);
        gl.uniform3fv(U.uColor, p.color);
        gl.uniform1f(U.uSpec, p.spec);
        gl.uniform1f(U.uShin, p.shin);
        gl.uniform1f(U.uMetal, p.metal);
        gl.uniform1f(U.uEmit, p.emit);
        gl.uniform1f(U.uAlpha, p.alpha);
        gl.uniform1f(U.uRim, p.rim);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nrm);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idx);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }
  }

  SF.GL = { V, perspective, lookAt, mul4, toCol3, Renderer };
})((globalThis.SF = globalThis.SF || {}));
