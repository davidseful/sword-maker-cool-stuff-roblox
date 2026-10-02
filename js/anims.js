/* ==========================================================================
   Sword Forge - anims.js
   The move library (swings, idle stances, equip flourishes) and the pose math.

   A move is a handful of keyframes. Each key says "at this moment (0..1 of the
   move) these body parts are rotated by this much". Angles are degrees, applied
   on top of the normal "holding a tool" pose, in the torso's frame, exactly like
   CFrame.Angles(rx, ry, rz). The same data drives the 3D preview and the Luau
   animator, so what you see is what Studio plays.

   channels (all degrees except dy / dz, which are studs)
     ra  right arm   [x, y, z]   x + raises the arm up / back, x - lowers it, y + sweeps it to the left
     wr  wrist       [x, y, z]   turns the sword in the hand. x - swings the blade forward (-90 = blade in line with the arm)
     la  left arm    [x, y, z]   (hangs by default; z - swings it out to the left)
     to  torso       [x, y, z]   y = twist, x + = lean forward
     he  head        [x, y, z]
     rl  right leg   [x, y, z]   x + steps forward
     ll  left leg    [x, y, z]
     dy  body height   dz  body forward (- is forward)
   ========================================================================== */
(function (SF) {
  'use strict';

  const CH3 = ['ra', 'wr', 'la', 'to', 'he', 'rl', 'll'];
  const CH1 = ['dy', 'dz'];
  SF.ANIM_CH3 = CH3;
  SF.ANIM_CH1 = CH1;

  /* ------------------------------------------------------------- the library */
  // k(time, channels, ease): ease belongs to the stretch that ENDS at this key ('io' smooth, 'in', 'out', 'lin')
  const REST = { ra: [0, 0, 0], wr: [0, 0, 0], la: [0, 0, 0], to: [0, 0, 0], he: [0, 0, 0], rl: [0, 0, 0], ll: [0, 0, 0], dy: 0, dz: 0 };   // back to the plain tool-holding pose
  const k = (t, c, e) => Object.assign({ t, e: e || 'io' }, { c: c || {} });

  const MOVES = {};
  const def = (id, kind, label, blurb, o, keys) => { MOVES[id] = Object.assign({ id, kind, label, blurb, keys }, o); };

  /* ---- swings ----
     wr x -90 puts the blade in line with the arm (so the arm "aims" the sword); wr y +-90 turns the edge to lead a sideways cut */
  def('chop', 'swing', 'Overhead chop', 'Up high, then straight down with your weight behind it.', { dur: 0.8, hit: [0.4, 0.58] }, [
    k(0),
    k(0.24, { ra: [118, -8, 0], wr: [-78, 0, 0], la: [24, 0, -14], to: [-14, 0, 0], he: [-8, 0, 0], dy: 0.1 }, 'out'),
    k(0.46, { ra: [-38, 0, 0], wr: [-74, 0, 0], la: [-18, 0, -8], to: [30, 0, 0], he: [12, 0, 0], dy: -0.4, rl: [14, 0, 0], ll: [-10, 0, 0] }, 'in'),
    k(0.62, { ra: [-52, 0, 0], wr: [-64, 0, 0], to: [32, 0, 0], dy: -0.45 }, 'out'),
    k(1, REST, 'io'),
  ]);
  def('slash_h', 'swing', 'Side slash', 'Wind up to the right, sweep across to the left.', { dur: 0.66, hit: [0.3, 0.5] }, [
    k(0),
    k(0.24, { ra: [8, -82, 0], wr: [-90, 90, 0], la: [0, 0, -10], to: [0, -40, 0], he: [0, -14, 0], rl: [-8, 0, 0], ll: [10, 0, 0] }, 'out'),
    k(0.44, { ra: [-6, 72, 0], la: [0, 0, -16], to: [3, 44, 0], he: [0, 16, 0], rl: [8, 0, 0], ll: [-8, 0, 0] }, 'in'),
    k(0.56, { ra: [-10, 88, 0], to: [3, 50, 0] }, 'out'),
    k(1, REST, 'io'),
  ]);
  def('slash_b', 'swing', 'Backhand slash', 'Starts across the body and snaps back out to the right.', { dur: 0.66, hit: [0.3, 0.5] }, [
    k(0),
    k(0.24, { ra: [8, 82, 0], wr: [-90, -90, 0], la: [0, 0, -16], to: [0, 42, 0], he: [0, 14, 0], rl: [8, 0, 0], ll: [-8, 0, 0] }, 'out'),
    k(0.44, { ra: [-6, -76, 0], la: [0, 0, -8], to: [3, -46, 0], he: [0, -16, 0], rl: [-8, 0, 0], ll: [8, 0, 0] }, 'in'),
    k(0.56, { ra: [-10, -92, 0], to: [3, -52, 0] }, 'out'),
    k(1, REST, 'io'),
  ]);
  def('diag', 'swing', 'Diagonal cut', 'High on the right, down and across to the left.', { dur: 0.72, hit: [0.34, 0.54] }, [
    k(0),
    k(0.28, { ra: [100, -42, 0], wr: [-84, 40, 0], la: [10, 0, -12], to: [-6, -34, 0], he: [-6, -14, 0], dy: 0.05 }, 'out'),
    k(0.46, { ra: [-46, 56, 0], wr: [-84, 70, 0], la: [-8, 0, -14], to: [22, 40, 0], he: [8, 16, 0], dy: -0.28, rl: [10, 0, 0], ll: [-8, 0, 0] }, 'in'),
    k(0.6, { ra: [-58, 68, 0], to: [26, 44, 0], dy: -0.3 }, 'out'),
    k(1, REST, 'io'),
  ]);
  def('rising', 'swing', 'Rising cut', 'Crouch low, then carve upward in a big arc.', { dur: 0.72, hit: [0.34, 0.52] }, [
    k(0),
    k(0.26, { ra: [-52, 44, 0], wr: [-84, 40, 0], la: [-6, 0, -8], to: [16, 32, 0], he: [8, 12, 0], dy: -0.34, rl: [-12, 0, 6], ll: [16, 0, -6] }, 'out'),
    k(0.46, { ra: [104, -50, 0], wr: [-84, 20, 0], la: [14, 0, -14], to: [-12, -38, 0], he: [-8, -14, 0], dy: 0.08 }, 'in'),
    k(0.6, { ra: [126, -60, 0], to: [-16, -42, 0], dy: 0.12 }, 'out'),
    k(1, REST, 'io'),
  ]);
  def('thrust', 'swing', 'Lunge thrust', 'Coil back, then drive the point forward in a deep step.', { dur: 0.72, hit: [0.3, 0.52] }, [
    k(0),
    k(0.26, { ra: [10, -24, 0], wr: [-90, 0, 0], la: [-6, 0, -12], to: [0, -32, 0], he: [0, -10, 0], dz: 0.4, rl: [-16, 0, 2], ll: [20, 0, -2] }, 'out'),
    k(0.44, { ra: [2, 10, 0], wr: [-90, 0, 0], la: [-10, 0, -20], to: [14, 26, 0], he: [6, 14, 0], dz: -1.3, dy: -0.35, rl: [-30, 0, 6], ll: [48, 0, -6] }, 'in'),
    k(0.62, { ra: [2, 12, 0], to: [14, 26, 0], dz: -1.3, dy: -0.35 }, 'out'),
    k(1, REST, 'io'),
  ]);
  def('spin', 'swing', 'Spin slash', 'A full turn with the blade held out.', { dur: 0.86, hit: [0.2, 0.7] }, [
    k(0),
    k(0.16, { ra: [0, -34, 0], wr: [-90, 90, 0], la: [0, 0, -50], to: [0, -46, 0], dy: -0.2, he: [0, -10, 0] }, 'out'),
    k(0.74, { ra: [-4, 24, 0], la: [0, 0, -70], to: [4, 310, 0], dy: -0.2, he: [0, 20, 0] }, 'io'),
    k(0.88, { ra: [-8, 30, 0], to: [4, 360, 0], dy: -0.1 }, 'out'),
    k(1, Object.assign({}, REST, { to: [0, 360, 0] }), 'io'),
  ]);
  def('smash', 'swing', 'Heavy smash', 'A slow, huge overhead blow that lands with a thud.', { dur: 1.05, hit: [0.5, 0.66] }, [
    k(0),
    k(0.42, { ra: [150, -8, 0], wr: [-70, 0, 0], la: [34, 0, -14], to: [-20, 0, 0], he: [-14, 0, 0], dy: 0.15 }, 'out'),
    k(0.52, { ra: [146, -8, 0], to: [-22, 0, 0] }, 'lin'),
    k(0.62, { ra: [-62, 0, 0], wr: [-84, 0, 0], la: [-20, 0, -10], to: [38, 0, 0], he: [16, 0, 0], dy: -0.65, rl: [12, 0, 4], ll: [12, 0, -4] }, 'in'),
    k(0.74, { ra: [-68, 0, 0], to: [40, 0, 0], dy: -0.7 }, 'out'),
    k(1, REST, 'io'),
  ]);
  def('cross', 'swing', 'Cross slash', 'Two quick cuts that make an X.', { dur: 1.0, hit: [0.22, 0.78] }, [
    k(0),
    k(0.14, { ra: [96, -36, 0], wr: [-84, 40, 0], la: [10, 0, -12], to: [-6, -30, 0], he: [-6, -12, 0] }, 'out'),
    k(0.3, { ra: [-42, 60, 0], wr: [-84, 70, 0], la: [-8, 0, -14], to: [20, 38, 0], he: [8, 14, 0], dy: -0.25, rl: [8, 0, 0], ll: [-6, 0, 0] }, 'in'),
    k(0.4, { ra: [-46, 70, 0], to: [22, 42, 0] }, 'out'),
    k(0.54, { ra: [100, 44, 0], wr: [-84, -40, 0], la: [10, 0, -12], to: [-6, 32, 0], he: [-6, 14, 0], dy: 0 }, 'io'),
    k(0.7, { ra: [-46, -64, 0], wr: [-84, -70, 0], la: [-8, 0, -14], to: [22, -40, 0], he: [8, -14, 0], dy: -0.25, rl: [-6, 0, 0], ll: [8, 0, 0] }, 'in'),
    k(0.82, { ra: [-50, -74, 0], to: [24, -44, 0] }, 'out'),
    k(1, REST, 'io'),
  ]);
  def('flurry', 'swing', 'Flurry', 'Three blindingly fast slashes.', { dur: 0.78, hit: [0.1, 0.84] }, [
    k(0),
    k(0.12, { ra: [8, -60, 0], wr: [-90, 90, 0], to: [0, -26, 0], he: [0, -10, 0] }, 'out'),
    k(0.24, { ra: [-8, 58, 0], to: [4, 28, 0], he: [0, 10, 0] }, 'in'),
    k(0.36, { ra: [14, -60, 0], wr: [-90, -90, 0], to: [0, -28, 0], he: [0, -10, 0] }, 'io'),
    k(0.48, { ra: [-12, 62, 0], to: [4, 30, 0], he: [0, 10, 0] }, 'in'),
    k(0.6, { ra: [96, -20, 0], wr: [-80, 0, 0], to: [-8, -14, 0], he: [-8, 0, 0], dy: 0.05 }, 'io'),
    k(0.7, { ra: [-56, 6, 0], wr: [-70, 0, 0], to: [26, 6, 0], he: [10, 0, 0], dy: -0.3, rl: [10, 0, 0] }, 'in'),
    k(1, REST, 'io'),
  ]);
  def('iaido', 'swing', 'Draw cut', 'Crouch, hold your breath, then one lightning cut.', { dur: 0.98, hit: [0.46, 0.58] }, [
    k(0),
    k(0.42, { ra: [-30, -62, 0], wr: [88, 0, 0], la: [0, 0, -14], to: [0, -48, 0], he: [0, -16, 0], dy: -0.5, rl: [-18, 0, 8], ll: [26, 0, -8] }, 'out'),
    k(0.52, { ra: [-4, 98, 0], wr: [-90, 90, 0], la: [0, 0, -20], to: [3, 56, 0], he: [0, 20, 0], dy: -0.42 }, 'in'),
    k(0.7, { ra: [-8, 104, 0], to: [3, 58, 0], dy: -0.4 }, 'out'),
    k(1, REST, 'io'),
  ]);
  def('whirl', 'swing', 'Whirlwind', 'Two full spins with arms flung wide.', { dur: 1.25, hit: [0.14, 0.86] }, [
    k(0),
    k(0.12, { ra: [0, -30, 0], wr: [-90, 90, 0], la: [0, 0, -60], to: [0, -30, 0], dy: -0.2 }, 'out'),
    k(0.88, { ra: [-6, 20, 0], la: [0, 0, -80], to: [4, 690, 0], dy: -0.25 }, 'lin'),
    k(1, Object.assign({}, REST, { ra: [0, 10, 0], la: [0, 0, -30], to: [0, 720, 0], dy: -0.1 }), 'out'),
  ]);
  def('jab', 'swing', 'Quick slash', 'A short, snappy cut. Easy to chain.', { dur: 0.46, hit: [0.2, 0.38] }, [
    k(0),
    k(0.16, { ra: [14, -50, 0], wr: [-80, 80, 0], to: [0, -22, 0], he: [0, -8, 0] }, 'out'),
    k(0.3, { ra: [-14, 54, 0], to: [5, 26, 0], he: [0, 10, 0] }, 'in'),
    k(1, REST, 'io'),
  ]);

  /* ---- idle stances (loop) ---- */
  def('ready', 'idle', 'Ready stance', 'Sword low and forward, weight on the back foot.', { dur: 2.6, loop: true }, [
    k(0, { ra: [-18, -10, 0], wr: [-34, 0, 0], la: [10, 0, -10], to: [0, -14, 0], he: [0, 10, 0], rl: [10, 0, 2], ll: [-8, 0, -2], dy: -0.08 }),
    k(0.5, { ra: [-16, -10, 0], wr: [-32, 0, 0], la: [8, 0, -12], to: [3, -14, 0], he: [2, 10, 0], dy: -0.16 }),
    k(1, { ra: [-18, -10, 0], wr: [-34, 0, 0], la: [10, 0, -10], to: [0, -14, 0], he: [0, 10, 0], dy: -0.08 }),
  ]);
  def('guard', 'idle', 'High guard', 'Hilt by the cheek, blade up, eyes on the target.', { dur: 2.8, loop: true }, [
    k(0, { ra: [58, -16, 8], wr: [-50, 0, 0], la: [66, 0, -10], to: [0, -20, 0], he: [0, 14, 0], rl: [8, 0, 2], ll: [-8, 0, -2], dy: -0.06 }),
    k(0.5, { ra: [56, -16, 8], wr: [-48, 0, 0], la: [64, 0, -12], to: [3, -20, 0], he: [2, 14, 0], dy: -0.12 }),
    k(1, { ra: [58, -16, 8], wr: [-50, 0, 0], la: [66, 0, -10], to: [0, -20, 0], he: [0, 14, 0], dy: -0.06 }),
  ]);
  def('rest', 'idle', 'On the shoulder', 'Relaxed. The blade rests over your shoulder.', { dur: 3.2, loop: true }, [
    k(0, { ra: [72, -34, -18], wr: [10, 0, 0], la: [0, 0, -6], to: [0, -10, 6], he: [-4, -10, 6], rl: [0, 0, 3], ll: [0, 0, -3], dy: -0.04 }),
    k(0.5, { ra: [70, -34, -18], wr: [8, 0, 0], la: [0, 0, -8], to: [-2, -10, 7], he: [-5, -10, 7], dy: -0.1 }),
    k(1, { ra: [72, -34, -18], wr: [10, 0, 0], la: [0, 0, -6], to: [0, -10, 6], he: [-4, -10, 6], dy: -0.04 }),
  ]);
  def('low', 'idle', 'Low and loose', 'Blade hanging at your side. Calm before the storm.', { dur: 3.4, loop: true }, [
    k(0, { ra: [-62, -16, 0], wr: [-52, 0, 0], la: [-4, 0, -12], to: [4, -18, 0], he: [0, 12, 0], rl: [6, 0, 2], ll: [-6, 0, -2], dy: -0.04 }),
    k(0.5, { ra: [-60, -14, 0], wr: [-50, 0, 0], la: [-4, 0, -14], to: [2, -18, 0], he: [2, 12, 0], dy: -0.1 }),
    k(1, { ra: [-62, -16, 0], wr: [-52, 0, 0], la: [-4, 0, -12], to: [4, -18, 0], he: [0, 12, 0], dy: -0.04 }),
  ]);
  def('two_hand', 'idle', 'Two-handed grip', 'Both hands on the hilt, ready for something heavy.', { dur: 2.8, loop: true }, [
    k(0, { ra: [14, -10, 0], wr: [-20, 0, 0], la: [0, -150, -92], to: [6, -12, 0], he: [4, 8, 0], rl: [10, 0, 3], ll: [-10, 0, -3], dy: -0.1 }),
    k(0.5, { ra: [12, -10, 0], wr: [-18, 0, 0], to: [8, -12, 0], he: [6, 8, 0], dy: -0.17 }),
    k(1, { ra: [14, -10, 0], wr: [-20, 0, 0], to: [6, -12, 0], he: [4, 8, 0], dy: -0.1 }),
  ]);
  def('flow', 'idle', 'Flowing blade', 'The sword drifts in slow figure eights.', { dur: 3.0, loop: true }, [
    k(0, { ra: [-12, -22, 0], wr: [-40, 0, 0], la: [8, 0, -14], to: [0, -12, 0], he: [0, 8, 0], rl: [6, 0, 2], ll: [-6, 0, -2], dy: -0.06 }),
    k(0.25, { ra: [10, -4, 10], wr: [-28, 0, 14], la: [10, 0, -10], to: [2, -4, 0], he: [0, 2, 0], dy: -0.1 }),
    k(0.5, { ra: [-8, 14, 0], wr: [-44, 0, 0], la: [8, 0, -14], to: [0, 6, 0], he: [0, -4, 0], dy: -0.06 }),
    k(0.75, { ra: [12, -4, -10], wr: [-28, 0, -14], la: [10, 0, -10], to: [2, -4, 0], he: [0, 2, 0], dy: -0.1 }),
    k(1, { ra: [-12, -22, 0], wr: [-40, 0, 0], la: [8, 0, -14], to: [0, -12, 0], he: [0, 8, 0], dy: -0.06 }),
  ]);

  /* ---- equip flourishes ---- */
  def('draw', 'equip', 'Quick draw', 'Whip the sword out of nowhere and settle.', { dur: 0.8 }, [
    k(0, { ra: [-60, -50, 0], wr: [88, 0, 0], to: [0, -18, 0], dy: -0.15 }),
    k(0.4, { ra: [96, -30, 12], wr: [-70, 0, 0], to: [-6, -26, 0], he: [-6, 0, 0], dy: 0.04 }, 'out'),
    k(0.7, { ra: [-14, -10, 0], wr: [-20, 0, 0], to: [4, -10, 0], dy: -0.1 }, 'io'),
    k(1, REST, 'io'),
  ]);
  def('twirl', 'equip', 'Blade twirl', 'Spin the sword around your hand before you settle.', { dur: 1.1 }, [
    k(0, { ra: [-20, -10, 0] }),
    k(0.18, { ra: [10, -10, 0], wr: [-60, 0, 0], to: [0, -10, 0] }, 'out'),
    k(0.7, { ra: [10, -10, 0], wr: [-780, 0, 0], to: [0, 10, 0] }, 'lin'),
    k(0.86, { ra: [-14, -6, 0], wr: [-740, 0, 0], to: [0, 0, 0] }, 'out'),
    k(1, Object.assign({}, REST, { wr: [-720, 0, 0] }), 'io'),
  ]);
  def('salute', 'equip', 'Salute', 'Raise the blade overhead, then lower it with a nod.', { dur: 1.1 }, [
    k(0),
    k(0.4, { ra: [138, -6, 0], wr: [-84, 0, 0], he: [-14, 0, 0], to: [-8, 0, 0], dy: 0.05 }, 'out'),
    k(0.6, { ra: [138, -6, 0] }, 'lin'),
    k(0.82, { ra: [-20, -6, 0], wr: [-30, 0, 0], he: [14, 0, 0], to: [10, 0, 0], dy: -0.1 }, 'io'),
    k(1, REST, 'io'),
  ]);
  def('stomp', 'equip', 'Plant and glare', 'Slam the point down and loom over it.', { dur: 1.0 }, [
    k(0, { ra: [100, 0, 0], wr: [-80, 0, 0], dy: 0.1 }),
    k(0.32, { ra: [-66, 0, 0], wr: [-114, 0, 0], to: [20, 0, 0], he: [10, 0, 0], dy: -0.5 }, 'in'),
    k(0.5, { to: [22, 0, 0] }, 'out'),
    k(1, REST, 'io'),
  ]);

  SF.MOVES = MOVES;
  SF.MOVE_IDS = Object.keys(MOVES);
  SF.MOVE_KINDS = ['swing', 'idle', 'equip'];
  SF.movesOf = (kind) => SF.MOVE_IDS.filter((id) => MOVES[id].kind === kind);

  /* -------------------------------------------------------------- pose math */
  const zero3 = () => [0, 0, 0];
  const zeroPose = () => ({ ra: zero3(), wr: zero3(), la: zero3(), to: zero3(), he: zero3(), rl: zero3(), ll: zero3(), dy: 0, dz: 0 });
  SF.zeroPose = zeroPose;

  function ease(e, u) {
    if (e === 'lin') return u;
    if (e === 'in') return u * u;
    if (e === 'out') return 1 - (1 - u) * (1 - u);
    return u * u * (3 - 2 * u);
  }

  /* every key gets a complete pose: a channel a key does not mention keeps its previous value */
  const resolved = {};
  function resolve(id) {
    if (resolved[id]) return resolved[id];
    const m = MOVES[id];
    if (!m) return null;
    let cur = zeroPose();
    const keys = m.keys.map((kf) => {
      const nx = zeroPose();
      CH3.forEach((ch) => { nx[ch] = (kf.c[ch] || cur[ch]).slice(); });
      CH1.forEach((ch) => { nx[ch] = kf.c[ch] != null ? kf.c[ch] : cur[ch]; });
      cur = nx;
      return { t: kf.t, e: kf.e, pose: nx };
    });
    resolved[id] = { id, kind: m.kind, dur: m.dur, hit: m.hit, loop: !!m.loop, keys };
    return resolved[id];
  }
  SF.resolveMove = resolve;

  /* pose of a resolved move at u (0..1 of the move) */
  function poseAt(r, u, out) {
    out = out || zeroPose();
    const keys = r.keys;
    u = Math.min(1, Math.max(0, u));
    let i = 1;
    while (i < keys.length - 1 && u > keys[i].t) i++;
    const a = keys[i - 1], b = keys[i];
    const span = Math.max(1e-6, b.t - a.t);
    const f = ease(b.e, Math.min(1, Math.max(0, (u - a.t) / span)));
    CH3.forEach((ch) => {
      for (let n = 0; n < 3; n++) out[ch][n] = a.pose[ch][n] + (b.pose[ch][n] - a.pose[ch][n]) * f;
    });
    CH1.forEach((ch) => { out[ch] = a.pose[ch] + (b.pose[ch] - a.pose[ch]) * f; });
    return out;
  }
  SF.poseAt = poseAt;

  /* cross-fade two poses; angles take the short way round so a finished 360 degree spin does not unwind */
  const wrap180 = (d) => ((d + 180) % 360 + 360) % 360 - 180;
  function blendPose(a, b, w, out) {
    out = out || zeroPose();
    CH3.forEach((ch) => {
      for (let n = 0; n < 3; n++) out[ch][n] = a[ch][n] + wrap180(b[ch][n] - a[ch][n]) * w;
    });
    CH1.forEach((ch) => { out[ch] = a[ch] + (b[ch] - a[ch]) * w; });
    return out;
  }
  SF.blendPose = blendPose;

  /* -------------------------------------------------------------- the schema */
  SF.ANIM_SPEED = { min: 0.5, max: 1.8, step: 0.05, def: 1 };
  SF.ANIM_MAX_SWINGS = 6;

  SF.defaultAnim = () => ({ on: true, speed: 1, idle: 'ready', equip: 'draw', swings: ['diag', 'slash_b', 'chop'] });

  SF.normAnim = function (src, fallback) {
    const d = fallback || SF.defaultAnim();
    const s = src && typeof src === 'object' ? src : {};
    const pick = (v, kind, def) => (v === 'none' || (MOVES[v] && MOVES[v].kind === kind) ? v : def);
    let swings = Array.isArray(s.swings) ? s.swings : s.swings === undefined ? d.swings : [];
    swings = swings.filter((id) => MOVES[id] && MOVES[id].kind === 'swing').slice(0, SF.ANIM_MAX_SWINGS);
    const sp = SF.ANIM_SPEED;
    let speed = Number(s.speed);
    if (!isFinite(speed)) speed = d.speed;
    speed = Math.min(sp.max, Math.max(sp.min, Math.round(speed / sp.step) * sp.step));
    return {
      on: typeof s.on === 'boolean' ? s.on : d.on,
      speed: Number(speed.toFixed(2)),
      idle: pick(s.idle, 'idle', d.idle),
      equip: pick(s.equip, 'equip', d.equip),
      swings,
    };
  };

  /* what the generator needs: the moves a sword uses, as plain data (null if it plays none) */
  SF.animData = function (anim) {
    if (!anim || !anim.on) return null;
    const used = {};
    const add = (id) => {
      if (!id || id === 'none' || !MOVES[id]) return;
      const m = MOVES[id];
      const r = {};
      r.dur = m.dur;
      if (m.hit) r.hit = m.hit.slice();
      if (m.loop) r.loop = true;
      r.keys = m.keys.map((kf) => {
        const o = { t: Math.round(kf.t * 1000) / 1000 };
        if (kf.e !== 'io') o.e = kf.e;
        Object.keys(kf.c).forEach((ch) => { o[ch] = kf.c[ch]; });
        return o;
      });
      used[id] = r;
    };
    anim.swings.forEach(add);
    add(anim.idle);
    add(anim.equip);
    const ids = Object.keys(used);
    if (!ids.length) return null;
    return {
      moves: used,
      swings: anim.swings.slice(),
      idle: anim.idle !== 'none' ? anim.idle : '',
      equip: anim.equip !== 'none' ? anim.equip : '',
      speed: anim.speed,
    };
  };
})((globalThis.SF = globalThis.SF || {}));
