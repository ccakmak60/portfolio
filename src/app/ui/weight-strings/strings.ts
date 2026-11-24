export const strings = [
  { name: "Thin", weight: 100, gauge: 1, frequency: 9.6, damping: 3.6 },
  { name: "Light", weight: 300, gauge: 1.7, frequency: 8.8, damping: 3.3 },
  { name: "Regular", weight: 400, gauge: 2.4, frequency: 8, damping: 3 },
  { name: "Medium", weight: 500, gauge: 3.1, frequency: 7.2, damping: 2.8 },
  { name: "Bold", weight: 700, gauge: 4.5, frequency: 6.3, damping: 2.5 },
  { name: "Black", weight: 900, gauge: 6.2, frequency: 5.4, damping: 2.2 },
];

export const INITIAL_STRING = 2;
export const BOARD_SIZE = 540;
export const TIME_STEP = 1 / 1000;
export const X0 = 194;
export const X1 = 500;
export const SPAN = X1 - X0;
export const TOP = 214;
export const PITCH = 53;
const MODES = 24;
const SAMPLES = 72;
const TREBLE = 0.08;
const MUTE = 42;
const HOLD = 16;
const EDGE = 0.03;
const REACH = 24;
const V_MAX = 1400;
const STRONG = 7;
const STRIKE = 18;
const SOFT = 5;
const FOLLOW = 150;
const SETTLE = 34;
const REST = 0.12;
type Wire = {
  y: number;
  w: number;
  q: Float64Array;
  v: Float64Array;
  held: boolean;
  a: number;
  h: number;
  side: -1 | 0 | 1;
  asleep: boolean;
  free: Float64Array;
  mute: Float64Array;
};
type State = {
  wires: Wire[];
  finger: {
    down: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    tx: number;
    ty: number;
  };
  pick: number;
  wght: number;
  wv: number;
  asleep: boolean;
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
// Each mode describes a standing wave with both endpoints fixed.
const SIN = Array.from({ length: MODES }, (_, n) => Float64Array.from({ length: SAMPLES + 1 }, (_, k) => Math.sin(((n + 1) * Math.PI * k) / SAMPLES)));
function carry(w: number, g: number, h: number): [
  number,
  number,
  number,
  number
] {
  const e = Math.exp(-g * h);
  const d = w * w - g * g;
  let c: number;
  let s: number;
  if (d > 1e-9) {
    const wd = Math.sqrt(d);
    c = Math.cos(wd * h);
    s = Math.sin(wd * h) / wd;
  }
  else if (d < -1e-9) {
    const wd = Math.sqrt(-d);
    c = Math.cosh(wd * h);
    s = Math.sinh(wd * h) / wd;
  }
  else {
    c = 1;
    s = h;
  }
  return [e * (c + g * s), e * s, -e * w * w * s, e * (c - g * s)];
}
function table(w: number, damping: number, held: boolean): Float64Array {
  const t = new Float64Array(MODES * 4);
  for (let n = 1; n <= MODES; n++) {
    const g = damping * (1 + TREBLE * (n * n - 1)) + (held ? MUTE : 0);
    t.set(carry(n * w, g, TIME_STEP), (n - 1) * 4);
  }
  return t;
}
export function create(pick: number): State {
  return {
    wires: strings.map(({ frequency, damping }, i) => {
      const w = 2 * Math.PI * frequency;
      return {
        y: TOP + PITCH * i,
        w,
        q: new Float64Array(MODES),
        v: new Float64Array(MODES),
        held: false,
        a: 0.5,
        h: 0,
        side: 0,
        asleep: true,
        free: table(w, damping, false),
        mute: table(w, damping, true),
      };
    }),
    finger: { down: false, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 },
    pick,
    wght: strings[pick].weight,
    wv: 0,
    asleep: true,
  };
}
const tri = (n: number, a: number, h: number) => ((2 * h) / (n * n * Math.PI * Math.PI * a * (1 - a))) * Math.sin(n * Math.PI * a);
function ring(s: Wire, a: number): number {
  let u = 0;
  for (let n = 1; n <= MODES; n++)
    u += s.q[n - 1] * Math.sin(n * Math.PI * a);
  return u;
}
const grip = (a: number) => HOLD * 4 * a * (1 - a);
function limit(s: Wire) {
  let e = 0;
  for (let n = 1; n <= MODES; n++) {
    const q = s.q[n - 1];
    const v = s.v[n - 1] / (n * s.w);
    e += q * q + v * v;
  }
  if (!Number.isFinite(e)) {
    s.q.fill(0);
    s.v.fill(0);
    return;
  }
  const amp = Math.sqrt(e);
  if (amp > REACH) {
    const k = REACH / amp;
    for (let n = 0; n < MODES; n++) {
      s.q[n] *= k;
      s.v[n] *= k;
    }
  }
}
function take(s: Wire, a: number, h: number) {
  s.held = true;
  s.a = a;
  s.h = h;
  for (let n = 1; n <= MODES; n++)
    s.q[n - 1] -= tri(n, a, h);
  s.asleep = false;
}
function release(st: State, i: number, vy: number) {
  const s = st.wires[i];
  const v = Number.isFinite(vy) ? clamp(vy, -V_MAX, V_MAX) : 0;
  for (let n = 1; n <= MODES; n++) {
    s.q[n - 1] += tri(n, s.a, s.h);
    s.v[n - 1] += tri(n, s.a, v);
  }
  s.held = false;
  s.side = s.h > 0 ? 1 : -1;
  limit(s);
  if (Math.hypot(s.h, v / s.w) >= STRONG)
    st.pick = i;
  s.h = 0;
  s.asleep = false;
  st.asleep = false;
}
function strike(st: State, i: number, a = 0.3) {
  const s = st.wires[i];
  if (!s)
    return;
  const at = clamp(Number.isFinite(a) ? a : 0.3, 0.12, 0.88);
  for (let n = 1; n <= MODES; n++)
    s.v[n - 1] += STRIKE * s.w * Math.sin(n * Math.PI * at) * Math.exp(-((n / SOFT) ** 2));
  limit(s);
  s.asleep = false;
  st.asleep = false;
}
export function choose(st: State, i: number, a?: number) {
  if (!st.wires[i])
    return;
  st.pick = i;
  strike(st, i, a);
}
export function touch(st: State, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y))
    return;
  const f = st.finger;
  f.down = true;
  f.x = f.tx = x;
  f.y = f.ty = y;
  f.vx = f.vy = 0;
  const position = (x - X0) / SPAN;
  for (const wire of st.wires) {
    wire.side = 0;
    if (position <= EDGE || position >= 1 - EDGE) continue;
    const distance = y - wire.y;
    const offset = distance - ring(wire, position);
    wire.side = offset >= 0 ? 1 : -1;
    if (Math.abs(offset) <= 2 && Math.abs(distance) <= grip(position)) {
      take(wire, position, distance);
    }
  }
  st.asleep = false;
}
export function aim(st: State, x: number, y: number) {
  if (!st.finger.down || !Number.isFinite(x) || !Number.isFinite(y))
    return;
  st.finger.tx = x;
  st.finger.ty = y;
  st.asleep = false;
}
export function lift(st: State) {
  const f = st.finger;
  if (!f.down)
    return;
  const dx = f.tx - f.x;
  const dy = f.ty - f.y;
  // Process the remaining pointer travel before releasing a fast swipe.
  const n = Math.min(600, Math.ceil(Math.hypot(dx, dy) / 2));
  for (let k = 1; k <= n; k++) {
    f.x += dx / n;
    f.y += dy / n;
    for (let i = 0; i < strings.length; i++)
      feel(st, i);
  }
  st.wires.forEach((s, i) => {
    if (s.held)
      release(st, i, f.vy);
    s.side = 0;
  });
  f.down = false;
  st.asleep = false;
}
function feel(st: State, i: number) {
  const s = st.wires[i];
  const f = st.finger;
  const a = (f.x - X0) / SPAN;
  if (s.held) {
    if (a < 0 || a > 1) {
      release(st, i, f.vy);
      s.side = 0;
    }
    else {
      s.a = clamp(a, EDGE, 1 - EDGE);
      const h = f.y - s.y;
      const max = grip(s.a);
      if (Math.abs(h) > max) {
        s.h = clamp(h, -max, max);
        release(st, i, f.vy);
      }
      else
        s.h = h;
    }
  }
  else if (!(a >= 0 && a <= 1))
    s.side = 0;
  else {
    const h = f.y - s.y;
    const side = h - ring(s, a) >= 0 ? 1 : -1;
    if (s.side !== 0 && side !== s.side && Math.abs(h) <= grip(clamp(a, EDGE, 1 - EDGE)))
      take(s, clamp(a, EDGE, 1 - EDGE), h);
    s.side = side;
  }
}
function stepWire(st: State, i: number) {
  const s = st.wires[i];
  if (st.finger.down)
    feel(st, i);
  if (s.asleep)
    return;
  const t = s.held ? s.mute : s.free;
  let e = 0;
  for (let n = 0; n < MODES; n++) {
    const q = s.q[n];
    const v = s.v[n];
    const k = n * 4;
    const nq = t[k] * q + t[k + 1] * v;
    const nv = t[k + 2] * q + t[k + 3] * v;
    s.q[n] = nq;
    s.v[n] = nv;
    const u = nv / ((n + 1) * s.w);
    e += nq * nq + u * u;
  }
  if (!Number.isFinite(e)) {
    s.q.fill(0);
    s.v.fill(0);
    s.held = false;
    s.h = 0;
    e = 0;
  }
  if (e < REST * REST) {
    s.q.fill(0);
    s.v.fill(0);
    if (!s.held)
      s.asleep = true;
  }
}
export function step(st: State) {
  const h = TIME_STEP;
  const f = st.finger;
  if (f.down) {
    f.vx += (FOLLOW * FOLLOW * (f.tx - f.x) - 2 * FOLLOW * f.vx) * h;
    f.vy += (FOLLOW * FOLLOW * (f.ty - f.y) - 2 * FOLLOW * f.vy) * h;
    f.x += f.vx * h;
    f.y += f.vy * h;
    if (!Number.isFinite(f.x + f.y + f.vx + f.vy)) {
      f.x = f.tx;
      f.y = f.ty;
      f.vx = f.vy = 0;
    }
  }
  for (let i = 0; i < strings.length; i++)
    stepWire(st, i);
  const to = strings[st.pick].weight;
  st.wv += (SETTLE * SETTLE * (to - st.wght) - 2 * SETTLE * st.wv) * h;
  st.wght += st.wv * h;
  if (!Number.isFinite(st.wght + st.wv) || (Math.abs(to - st.wght) < 0.05 && Math.abs(st.wv) < 1)) {
    st.wght = to;
    st.wv = 0;
  }
  const still = Math.abs(f.tx - f.x) + Math.abs(f.ty - f.y) < 0.01 && Math.abs(f.vx) + Math.abs(f.vy) < 0.5;
  st.asleep = st.wght === to && (!f.down || still) && st.wires.every((s) => s.asleep || (s.held && f.down && still && s.q.every((q) => q === 0)));
}
export function trace(s: Wire): string {
  if (s.asleep && !s.held)
    return `M${X0} ${s.y}H${X1}`;
  let d = `M${X0} ${s.y}`;
  const apex = s.held ? s.a * SAMPLES : -1;
  for (let k = 1; k < SAMPLES; k++) {
    let u = 0;
    for (let n = 0; n < MODES; n++)
      u += s.q[n] * SIN[n][k];
    if (s.held) {
      const a = k / SAMPLES;
      u += a <= s.a ? (s.h * a) / s.a : (s.h * (1 - a)) / (1 - s.a);
      if (apex > k - 1 && apex < k)
        d += `L${(X0 + s.a * SPAN).toFixed(2)} ${(s.y + s.h + ring(s, s.a)).toFixed(2)}`;
    }
    d += `L${(X0 + (k / SAMPLES) * SPAN).toFixed(2)} ${(s.y + u).toFixed(2)}`;
  }
  if (apex > SAMPLES - 1 && apex < SAMPLES)
    d += `L${(X0 + s.a * SPAN).toFixed(2)} ${(s.y + s.h + ring(s, s.a)).toFixed(2)}`;
  return d + `L${X1} ${s.y}`;
}
