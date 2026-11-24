export const L = 172;
export const RO = 55;
export const RI = 50;
export const PX = 252;
export const PY = 224;
export const PIN_Y = 10;
export const PIN_TIP = L - 26;
export const PIN_R = 2.4;
export const PIN_BEAD = 4.2;
export const LEAD = 34;
export const REST = (16 * Math.PI) / 180;
const OVER = 70;
const OVER_W = 0.045;
const PIVOT_DRAG = 5;
const STOP_K = 2600;
const STOP_D = 10;
const CLACK = 0.42;
const SEAT = REST - OVER / STOP_K;
const GIVE = 0.05;
const KICK = 1.2e-6;
const BLOW = 60;
const HAND_K = 1700, HAND_D = 62;
const KEY_K = 260, KEY_D = 19;
export const N = 50;
const SPACE = 14.4;
const REACH = 27.6;
const RV = 10.9;
const WALL = 9.8;
const P = { G: 4830, PUSH: 12000, PULL: 8050, VISC: 5, AIR: 0.25, GRIP: 2.2, BOUNCE: 0.4 };
const FAST = 2760;
const WET = RV + PIN_R;
const LOOK = 0.2;
type Mode = "free" | "held" | "key";
export type Sim = {
  th: number;
  om: number;
  mode: Mode;
  want: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  seated: boolean;
  kick: number;
  since: number;
  closed: boolean;
  wet: Float32Array;
  contacts: [boolean, boolean];
  still: number;
  look: number;
  ox: Float32Array;
  oy: Float32Array;
};
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export function createSim(on: boolean): Sim {
  const st: Sim = {
    th: on ? REST : -REST, om: 0, mode: "free", want: 0, seated: true, kick: 0,
    x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N),
    since: 0, closed: on, wet: new Float32Array(2), contacts: [false, false], still: 0, look: 0, ox: new Float32Array(N), oy: new Float32Array(N),
  };
  const side = on ? 1 : -1;
  for (let i = 0; i < N; i++) {
    const col = i % 10, row = Math.floor(i / 10);
    st.x[i] = side * (L - 6 - col * SPACE - (row % 2) * SPACE * 0.5);
    st.y[i] = RI - WALL - 1 - row * SPACE * 0.87;
  }
  for (let k = 0; k < 1400; k++)
    step(st, 1 / 480);
  for (let i = 0; i < N; i++)
    st.vx[i] = st.vy[i] = 0;
  st.closed = bridged(st);
  st.wet.fill(st.closed ? 1 : 0);
  st.since = 0;
  st.still = 1;
  return st;
}
function bridged(st: Sim) {
  let a = false, b = false;
  for (let i = 0; i < N; i++) {
    const x = st.x[i];
    if (x < PIN_TIP - WET)
      continue;
    const dx = x < PIN_TIP ? PIN_TIP - x : 0;
    const ya = st.y[i] + PIN_Y, yb = st.y[i] - PIN_Y;
    if (dx * dx + ya * ya < WET * WET)
      a = true;
    if (dx * dx + yb * yb < WET * WET)
      b = true;
  }
  st.contacts[0] = a;
  st.contacts[1] = b;
  return a && b;
}
export function step(st: Sim, h: number) {
  const before = st.om;
  st.om += st.kick;
  let acc: number;
  if (st.mode === "free")
    acc = OVER * Math.tanh(st.th / OVER_W) - PIVOT_DRAG * st.om;
  else {
    const k = st.mode === "held" ? HAND_K : KEY_K, d = st.mode === "held" ? HAND_D : KEY_D;
    acc = k * (st.want - st.th) - d * st.om;
  }
  const side = Math.sign(st.th);
  const into = Math.abs(st.th) - SEAT;
  if (into > 0) {
    if (!st.seated && st.om * side > 0)
      st.om *= CLACK;
    st.seated = true;
    if (st.mode === "key" && st.want * side > 0)
      st.mode = "free";
    acc -= STOP_K * into * side + STOP_D * st.om;
  }
  else
    st.seated = false;
  st.om += acc * h;
  st.th += st.om * h;
  if (Math.abs(st.th) > REST + GIVE) {
    const s = Math.sign(st.th);
    st.th = s * (REST + GIVE);
    if (st.om * s > 0)
      st.om = 0;
  }
  if (st.mode === "free" && st.seated && Math.abs(st.om) < 0.02 && Math.abs(Math.abs(st.th) - REST) < 0.0008 && Math.abs(acc) < 4) {
    st.th = Math.sign(st.th) * REST;
    st.om = 0;
  }
  if (!Number.isFinite(st.th) || !Number.isFinite(st.om)) {
    st.th = st.closed ? REST : -REST;
    st.om = 0;
    st.mode = "free";
  }
  const om = st.om, dom = om - before;
  const gx = P.G * Math.sin(st.th), gy = P.G * Math.cos(st.th);
  const { x, y, vx, vy } = st;
  for (let i = 0; i < N; i++) {
    vx[i] += dom * y[i];
    vy[i] -= dom * x[i];
    const ax = gx + om * om * x[i] + 2 * om * vy[i] - P.AIR * vx[i];
    const ay = gy + om * om * y[i] - 2 * om * vx[i] - P.AIR * vy[i];
    vx[i] += ax * h;
    vy[i] += ay * h;
  }
  const span = REACH - SPACE;
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = x[j] - x[i], dy = y[j] - y[i];
      const d2 = dx * dx + dy * dy;
      if (d2 >= REACH * REACH)
        continue;
      const d = Math.sqrt(d2) || 1e-3;
      const nx = dx / d, ny = dy / d;
      let f: number;
      if (d < SPACE)
        f = -P.PUSH * (SPACE - d);
      else
        f = (P.PULL * 4 * (d - SPACE) * (REACH - d)) / (span * span);
      const w = P.VISC * (1 - d / REACH);
      const rvx = vx[j] - vx[i], rvy = vy[j] - vy[i];
      const ix = (f * nx + w * rvx) * h, iy = (f * ny + w * rvy) * h;
      vx[i] += ix;
      vy[i] += iy;
      vx[j] -= ix;
      vy[j] -= iy;
    }
  }
  const lim = RI - WALL;
  let blow = 0;
  for (let i = 0; i < N; i++) {
    x[i] += vx[i] * h;
    y[i] += vy[i] * h;
    const cx = clamp(x[i], -L, L);
    const rx = x[i] - cx, ry = y[i];
    const r = Math.hypot(rx, ry);
    if (r > lim) {
      const nx = rx / r, ny = ry / r;
      x[i] = cx + nx * lim;
      y[i] = ny * lim;
      const vn = vx[i] * nx + vy[i] * ny;
      if (vn > 0) {
        vx[i] -= (1 + P.BOUNCE) * vn * nx;
        vy[i] -= (1 + P.BOUNCE) * vn * ny;
        if (vn > BLOW)
          blow += (1 + P.BOUNCE) * vn * (x[i] * ny - y[i] * nx);
      }
      const tx = -ny, ty = nx;
      const vt = vx[i] * tx + vy[i] * ty;
      const cut = vt * Math.min(1, P.GRIP * h);
      vx[i] -= cut * tx;
      vy[i] -= cut * ty;
    }
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i]) || !Number.isFinite(vx[i]) || !Number.isFinite(vy[i])) {
      x[i] = (i - N / 2) * 2;
      y[i] = lim;
      vx[i] = vy[i] = 0;
    }
    const v2 = vx[i] * vx[i] + vy[i] * vy[i];
    if (v2 > FAST * FAST) {
      const s = FAST / Math.sqrt(v2);
      vx[i] *= s;
      vy[i] *= s;
    }
  }
  st.kick = st.mode === "free" ? clamp(KICK * blow, -1.5, 1.5) : 0;
  if (bridged(st) !== st.closed) {
    st.since += h;
    if (st.since > (st.closed ? 0.06 : 0.03)) {
      st.closed = !st.closed;
      st.since = 0;
    }
  }
  else
    st.since = 0;
  for (let k = 0; k < 2; k++)
    st.wet[k] += ((st.contacts[k] ? 1 : 0) - st.wet[k]) * Math.min(1, 45 * h);
  if (st.mode !== "free" || st.om !== 0)
    st.still = 0;
  st.look += h;
  if (st.look >= LOOK) {
    let far = 0;
    for (let i = 0; i < N; i++) {
      far = Math.max(far, Math.abs(x[i] - st.ox[i]), Math.abs(y[i] - st.oy[i]));
      st.ox[i] = x[i];
      st.oy[i] = y[i];
    }
    st.still = far < 0.35 && st.mode === "free" && st.om === 0 ? st.still + st.look : 0;
    st.look = 0;
  }
}
