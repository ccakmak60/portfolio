import { L, LEAD, N, PIN_BEAD, PIN_R, PIN_TIP, PIN_Y, PX, PY, RI, RO } from "./mercury";
import { BEZEL, DIAL, GLOW, LAMP_Y, LENS } from "./dial";
const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);
const BAND = 9;
const BOSS = 62;
const SIG = 10.35;
const ISO = 0.55;
export const FW = Math.ceil(L + RI) + 4;
export const FH = Math.ceil(RI) + 4;
const SX = -250;
const SY = -80;
export const SW = 263;
export const SH = 80;
const HEAD = `#version 300 es
precision highp float;
in vec2 vL;
in vec2 vP;
out vec4 o;
// the capsule's turn: its cosine and sine
uniform vec2 uTurn;
uniform float uDpr;

const float L = ${f(L)};
const float RO = ${f(RO)};
const float RI = ${f(RI)};
const vec2 PIV = vec2(${f(PX)}, ${f(PY)});
const float BAND = ${f(BAND)};
const float BOSS = ${f(BOSS)};
// the dial and its bezel, the pilot lamp and how far its light reaches
const float RD = ${f(DIAL)};
const float RB = ${f(BEZEL)};
const vec2 LAMP = vec2(${f(PX)}, ${f(PY + LAMP_Y)});
const float LENS = ${f(LENS)};
const float GLOW = ${f(GLOW)};
// tungsten, and the blue of the evening in the window
const vec3 WARM = vec3(1.0, 0.80, 0.56);
const vec3 COOL = vec3(0.56, 0.76, 1.0);
// toward the lamp's long shade, and its two axes; the same for the window
const vec3 KEY = normalize(vec3(-0.34, -0.80, 0.50));
const vec3 KU = normalize(cross(vec3(0.0, 1.0, 0.0), KEY));
const vec3 KV = cross(KEY, KU);
const vec3 WIN = normalize(vec3(0.84, -0.12, 0.52));
const vec3 WU = normalize(cross(vec3(0.0, 1.0, 0.0), WIN));
const vec3 WV = cross(WIN, WU);

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// What colour the room's light is in a direction: the window's is cool, all
// the rest is the lamp's.
vec3 tint(vec3 d) {
  return mix(WARM, COOL, clamp((0.28 * dot(d, WIN) - abs(dot(d, WU))) * 8.0, 0.0, 1.0));
}

// The room, as brightness: a lamp with a long shade, overhead and to the
// left; a tall strip of window off to the right, with one glazing bar; the
// ceiling the lamp lights, the wall the thermostat hangs on, and the dim far
// side of the room.
float room(vec3 d) {
  float k = dot(d, KEY);
  vec2 q = vec2(dot(d, KU), dot(d, KV)) / max(k, 1e-3);
  float along = k > 0.0 ? smoothstep(0.0, 0.12, 1.3 - abs(q.x)) : 0.0;
  float core = smoothstep(0.0, 0.07, 0.20 - abs(q.y));
  float spill = smoothstep(0.0, 0.3, 0.6 - abs(q.y));
  float c = along * (5.6 * core + 0.24 * spill);
  float wk = dot(d, WIN);
  if (wk > 0.0) {
    vec2 w = vec2(dot(d, WU), dot(d, WV)) / wk;
    c += 1.7 * smoothstep(0.0, 0.012, 0.06 - abs(w.x)) * smoothstep(0.0, 0.03, 0.66 - abs(w.y)) * smoothstep(0.012, 0.026, abs(w.y + 0.12));
  }
  c += 0.05 + 0.34 * smoothstep(0.1, -0.8, d.y) * smoothstep(-0.7, 0.5, d.z) + 0.09 * smoothstep(0.6, 1.0, d.z) + 0.20 * smoothstep(0.1, -0.6, d.z);
  return c;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// Tone-map, encode, and grain: strongest in the mid-tones, none in black.
vec3 finish(vec3 lin) {
  // the 2.2 curve, by square roots
  vec3 s1 = sqrt(aces(lin)), s2 = sqrt(s1), s3 = sqrt(s2);
  vec3 c = 0.585122381 * s1 + 0.783140355 * s2 - 0.368262736 * s3;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec2 px = floor(gl_FragCoord.xy);
  float g = hash(px) + hash(px + 71.7) - 1.0;
  float amp = smoothstep(0.0, 0.05, l) * (0.010 + 0.11 * l * (1.0 - l));
  return c + g * amp;
}

// From the capsule's frame to the picture's, and back.
vec2 out2(vec2 p) {
  return vec2(uTurn.x * p.x - uTurn.y * p.y, uTurn.y * p.x + uTurn.x * p.y);
}
vec2 in2(vec2 p) {
  return vec2(uTurn.x * p.x + uTurn.y * p.y, uTurn.x * p.y - uTurn.y * p.x);
}

// Near enough exp(-u²), and cheap.
float bell(float u) {
  float t = max(1.0 - 0.25 * u * u, 0.0);
  t *= t;
  return t * t;
}

float capsule(vec2 p, float r) {
  return length(vec2(max(abs(p.x) - L, 0.0), p.y)) - r;
}

`;
export const ROOM = `${HEAD}
void main() {
  vec2 f = vec2(vL.x / 270.0 - 1.0, 1.0 - vL.y / 270.0);
  vec3 d = vec3(f, 1.0 - abs(f.x) - abs(f.y));
  if (d.z < 0.0) d.xy = (1.0 - abs(d.yx)) * vec2(d.x < 0.0 ? -1.0 : 1.0, d.y < 0.0 ? -1.0 : 1.0);
  d = normalize(d);
  o = vec4(room(d) * tint(d), 1.0);
}
`;
const LIQUID = `
uniform sampler2D uField;

// The liquid at a point of the capsule's frame: how much, and which way it
// thins out.
vec3 field(vec2 l) {
  return textureLod(uField, vec2(0.5 + l.x / ${f(2 * FW)}, 0.5 - l.y / ${f(2 * FH)}), 0.0).xyz;
}
`;
export const SHADE = `${HEAD}${LIQUID}
// How much of the strip's light reaches the wall behind a point l of the
// capsule's frame, and how much more the tube gathers there.
vec2 shade(vec2 l, float pen) {
  float dO = capsule(l, RO);
  vec2 sc = vec2(1.0, 0.0);
  if (dO < pen + ${f(LEAD)}) {
  float inside = smoothstep(pen, -pen * 0.4, dO);
  float edge = bell((dO + 2.5) / (pen * 0.42));
  float s = 1.0 - 0.10 * inside - 0.32 * edge;
  // the mercury and the clip stop the light altogether
  float merc = 0.0;
  if (dO < 0.0) merc = smoothstep(0.1, 0.8, field(l).x);
  s *= 1.0 - 0.92 * merc;
  float band = smoothstep(BAND + pen * 0.55, BAND - pen * 0.4, abs(l.x)) * smoothstep(RO + 2.0 + pen * 0.55, RO + 2.0 - pen * 0.4, abs(l.y));
  s *= 1.0 - 0.9 * band;
  vec2 pa = vec2(max(abs(l.x - (L + RO + ${f(LEAD / 2)})) - ${f(LEAD / 2)}, 0.0), abs(abs(l.y) - ${f(PIN_Y)}));
  s *= 1.0 - 0.6 * smoothstep(pen * 0.5, 0.0, length(pa) - ${f(PIN_R)});
  // the tube is a lens: it gathers the light that passes it into a line
  float ca = bell((l.y - 4.0) / (pen * 0.3)) * smoothstep(L + 26.0, L - 16.0, abs(l.x)) * (1.0 - merc) * (1.0 - band);
  sc = vec2(s, ca);
  }
  return sc;
}
void main() {
  vec2 l = vec2(${f(SX)}, ${f(SY)}) + 2.0 * gl_FragCoord.xy;
  vec2 a = shade(l, 20.0), b = shade(l, 15.0);
  o = vec4(a.x + 1.1 * a.y, b.x + 1.5 * b.y, 0.25 + 0.75 * shade(l, 7.0).x, 1.0);
}
`;
const SCENE = `${LIQUID}
uniform sampler2D uShade;
uniform sampler2D uWall;
uniform sampler2D uRoom;
// the pilot lamp's light: its colour times its strength
uniform vec3 uGlow;

vec3 env(vec3 d) {
  d /= abs(d.x) + abs(d.y) + abs(d.z);
  vec2 f = d.z >= 0.0 ? d.xy : (1.0 - abs(d.yx)) * vec2(d.x < 0.0 ? -1.0 : 1.0, d.y < 0.0 ? -1.0 : 1.0);
  return textureLod(uRoom, f * 0.5 + 0.5, 0.0).rgb;
}

// The capsule's shadow at a point l of its frame: on the wall, the dial and
// the boss.
vec3 shadow(vec2 l) {
  // (past its edges the picture is all light)
  return textureLod(uShade, (l - vec2(${f(SX)}, ${f(SY)})) / vec2(${f(2 * SW)}, ${f(2 * SH)}), 0.0).rgb;
}

// The pilot lamp at a point of the frame: the jewel lit from within, and its
// light on what is round it (w is what is there, as the room lights it).
vec3 lamp(vec3 w, vec2 p) {
  vec2 dl = p - LAMP;
  float d2 = dot(dl, dl);
  vec3 c = vec3(0.0);
  if (d2 < GLOW * GLOW) {
    float lens = 0.0;
    if (d2 < (LENS + 1.0) * (LENS + 1.0)) {
      float d = sqrt(d2);
      lens = clamp((LENS - d) * uDpr + 0.5, 0.0, 1.0);
      float rib = 0.5 + 0.5 * cos(d * 2.4);
      // (the filament is behind its middle)
      c = uGlow * lens * (0.55 + 0.4 * rib + 1.1 * exp(-d2 / 30.0)) * (1.0 - 0.55 * d2 / (LENS * LENS));
    }
    float fall = 1.0 / (1.0 + d2 / (20.0 * 20.0)) - ${f(1 / (1 + (GLOW * GLOW) / 400))};
    c += w * uGlow * 2.6 * fall * (1.0 - lens);
  }
  return c;
}

// The wall, the dial and the boss at a point of the frame, with the capsule's
// shadow on them. The dial's face is 46 px behind the capsule's axis and the
// wall 16 px behind that; the lamp is up and to the left, so shadows fall to
// the lower right, further off the further back; the boss is nearer. Only
// the window's light reaches into a shadow. The texture's alpha says which
// it is: 0 the wall, 0.5 the dial, 1 the boss.
const vec3 SHADOW = vec3(0.20, 0.25, 0.34);
vec3 lit(vec4 w, vec2 p) {
  vec2 b = p - PIV;
  // (one look: where the shadow would be for what is there, and its kind)
  vec3 kind = w.a < 0.25 ? vec3(1.0, 0.0, 0.0) : w.a < 0.75 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec2 off = w.a < 0.25 ? vec2(21.6, 51.2) : w.a < 0.75 ? vec2(16.0, 38.0) : vec2(6.0, 14.0);
  float k = dot(shadow(in2(b - off)), kind);
  vec3 c = w.rgb * (SHADOW + (1.0 - SHADOW) * k);
  if (uGlow.r > 0.0) c += lamp(w.rgb, p);
  return c;
}
vec3 wall(vec2 p) {
  return lit(textureLod(uWall, vec2(p.x, 540.0 - p.y) / 540.0, 0.0), p);
}
`;
export const STATIC = `${HEAD}
// the dial's printing: ticks and numerals
uniform sampler2D uInk;
// where the lamp is, from the frame's corner, in pixels
const vec3 LPOS = vec3(24.0, -278.0, 524.0);
const vec3 BRASS = vec3(0.78, 0.55, 0.25);
const vec2 DOWN = vec2(0.388, 0.922);

float vnoise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p, int n) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < n; k++) {
    s += a * vnoise(p);
    p = p * 2.03 + 17.3;
    a *= 0.5;
  }
  return s;
}

// Plaster, floated by hand: long low sweeps of the trowel, the grit in it,
// and a fine tooth.
float plaster(vec2 p) {
  vec2 q = vec2(0.82 * p.x + 0.57 * p.y, -0.57 * p.x + 0.82 * p.y);
  return 3.2 * fbm(q * vec2(0.009, 0.026), 4) + 0.8 * fbm(p * 0.075, 4) + 0.16 * fbm(p * 0.31, 2);
}

// How much of the lamp's light falls on a point with normal n.
float key(vec3 P, vec3 n) {
  vec3 l = LPOS - P;
  float d2 = dot(l, l);
  return 7.0e5 * max(dot(n, l), 0.0) / (d2 * sqrt(d2));
}

vec3 roomc(vec3 d) {
  return room(d) * tint(d);
}

// Brass, spun: it mirrors the room, smeared along t.
vec3 brass(vec3 n, vec3 t, float smear) {
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 c = vec3(0.0);
  for (int k = -3; k <= 3; k++) c += roomc(normalize(r + smear * float(k) * t));
  return BRASS * (min(c / 7.0, vec3(1.7)) + 0.02) + BRASS * WARM * 0.07 * max(dot(n, KEY), 0.0);
}

void main() {
  vec2 p = vP;
  vec2 b = p - PIV;
  float r = length(b);
  vec2 rad = b / max(r, 1e-3);

  // the wall
  float h0 = plaster(p);
  vec3 nw = normalize(vec3(h0 - plaster(p + vec2(0.7, 0.0)), h0 - plaster(p + vec2(0.0, 0.7)), 0.7));
  vec3 paint = vec3(0.017, 0.098, 0.142) * (0.90 + 0.2 * fbm(p * 0.011 + 40.0, 3));
  // (the dial stands 16 px off the wall: its shadow, and the dark it keeps
  // under its edge)
  float shadow = smoothstep(9.0, -9.0, length(b - vec2(6.2, 14.8)) - RB);
  float under = exp(-max(r - RB, 0.0) / 7.0);
  vec3 col = paint * (WARM * key(vec3(p, 0.0), nw) * (1.0 - 0.88 * shadow) + (COOL * (0.075 + 0.03 * nw.x) + WARM * 0.03) * (1.0 - 0.6 * under));

  float dial = clamp((RB - r) * uDpr + 0.5, 0.0, 1.0);
  float boss = clamp((BOSS - r) * uDpr + 0.5, 0.0, 1.0);
  if (dial > 0.0) {
    vec3 dc;
    if (r > RD) {
      // the bezel: a half-round ring of brass
      float u = clamp((r - 0.5 * (RD + RB)) / (0.5 * (RB - RD)), -0.97, 0.97);
      vec3 n = normalize(vec3(rad * u, sqrt(1.0 - u * u)));
      dc = brass(n, vec3(-rad.y, rad.x, 0.0), 0.05);
      // handled for years: duller in patches, bright where fingers go
      dc *= 0.82 + 0.36 * fbm(vec2(atan(b.y, b.x) * 9.0, r * 0.4), 3);
    } else {
      // the face: ivory Bakelite, all but flat, rolled over at the shoulder
      float sh = smoothstep(RD - 15.0, RD, r);
      vec3 n = normalize(vec3(rad * (0.025 * r / RD + 0.62 * sh * sh), 1.0));
      vec3 ivory = vec3(0.74, 0.65, 0.49);
      // the flow of the moulding, faint
      ivory *= 0.955 + 0.09 * fbm(p * 0.016 + 2.2 * fbm(p * 0.007, 2), 4);
      // the bezel's shadow on it, and the boss's
      float sb = smoothstep(7.0, 0.5, RD - r) * max(-dot(rad, DOWN), 0.0);
      sb = max(sb, 0.8 * smoothstep(9.0, -7.0, length(b - vec2(4.5, 10.5)) - BOSS));
      float gap = smoothstep(2.5, 0.0, RD - r);
      dc = ivory * (WARM * key(vec3(p, 16.0), n) * (1.0 - 0.75 * sb) + (COOL * 0.085 + WARM * 0.04) * (1.0 - 0.5 * gap));
      // it is polished: the lamp shows on the shoulder
      dc += 0.035 * roomc(reflect(vec3(0.0, 0.0, -1.0), n)) * (1.0 - sb);
      // the printing, in a brown-black ink
      float ink = texture(uInk, vec2(p.x, 540.0 - p.y) / 540.0).r;
      dc = mix(dc, dc * vec3(0.085, 0.065, 0.055), ink * 0.94);

      // the pilot lamp: an amber jewel in a brass ring
      vec2 dl = p - LAMP;
      float rl = length(dl);
      if (rl < 30.0) {
        float RL = LENS + 6.0;
        dc *= 1.0 - 0.5 * smoothstep(7.0, -3.0, length(dl - vec2(2.2, 5.2)) - RL);
        float ring = clamp((RL - rl) * uDpr + 0.5, 0.0, 1.0);
        if (ring > 0.0) {
          vec2 e = dl / max(rl, 1e-3);
          vec3 lc;
          if (rl > LENS) {
            float u = clamp((rl - 0.5 * (LENS + RL)) / (0.5 * (RL - LENS)), -0.97, 0.97);
            lc = brass(normalize(vec3(e * u, sqrt(1.0 - u * u))), vec3(-e.y, e.x, 0.0), 0.08);
          } else {
            // a dome of pressed glass with rings moulded in it; unlit, the
            // room's light gathers in it on the side away from the lamp
            float u = rl / LENS;
            vec3 n = normalize(vec3(e * u * 0.9, sqrt(1.0 - 0.8 * u * u)));
            float rib = 0.5 + 0.5 * cos(rl * 2.4);
            float through = pow(max(dot(e, DOWN), 0.0), 1.5) * u;
            lc = vec3(0.30, 0.070, 0.006) * (0.30 + 0.35 * rib + 1.5 * through);
            lc += (0.05 + 0.5 * pow(1.0 - n.z, 3.0)) * roomc(reflect(vec3(0.0, 0.0, -1.0), n));
            lc *= 1.0 - 0.6 * smoothstep(2.0, 0.0, LENS - rl);
          }
          dc = mix(dc, lc, ring);
        }
      }
    }
    if (boss > 0.0) {
      // the boss: turned brass, seen face on
      vec2 t = vec2(-rad.y, rad.x);
      vec3 h = normalize(KEY + vec3(0.0, 0.0, 1.0));
      float th = dot(t, h.xy);
      // lathe marks: rings, finer than a pixel in places
      float ring = 0.78 + 0.22 * hash(vec2(floor(r * 2.6), 3.0)) + 0.10 * hash(vec2(floor(r * 0.9), 9.0));
      float g = max(1.0 - th * th, 0.0);
      float spec = pow(g, 46.0) + 0.35 * pow(g, 9.0) + 0.10 * g;
      // the far wedge is the weaker one
      float side = 0.62 + 0.38 * smoothstep(0.6, -0.6, dot(rad, normalize(h.xy)));
      vec3 face = BRASS * (0.045 + WARM * 0.62 * spec * ring * side);
      // a chamfer round the rim, and a turned step inside it
      float rim = smoothstep(BOSS - 3.2, BOSS - 2.4, r);
      vec3 nr = normalize(vec3(rad * 0.75, 0.66));
      face = mix(face, BRASS * (roomc(reflect(vec3(0.0, 0.0, -1.0), nr)) + 0.03), rim);
      face *= 1.0 - 0.5 * exp(-pow((r - (BOSS - 3.4)) / 0.7, 2.0));
      dc = mix(dc, face, boss);
    }
    col = mix(col, dc, dial);
  }
  o = vec4(col, 0.5 * (dial + boss));
}
`;
export const FIELD = `#version 300 es
precision highp float;
in vec2 vL;
out vec4 o;
uniform vec2 uPts[${N}];
// how wet each pin's tip is: the mercury runs onto it
uniform vec2 uWet;
void main() {
  vec2 q = (vL / 270.0 - 1.0) * vec2(${f(FW)}, ${f(FH)});
  float F = 0.0;
  vec2 G = vec2(0.0);
  for (int i = 0; i < ${N}; i++) {
    vec2 d = q - uPts[i];
    float g = exp(-dot(d, d) * ${f(1 / (2 * SIG * SIG))});
    F += g;
    G += d * g;
  }
  for (int k = 0; k < 2; k++) {
    vec2 d = q - vec2(${f(PIN_TIP)}, k == 0 ? -${f(PIN_Y)} : ${f(PIN_Y)});
    float g = 0.5 * (k == 0 ? uWet.x : uWet.y) * exp(-dot(d, d) * ${f(1 / (2 * SIG * SIG))});
    F += g;
    G += d * g;
  }
  o = vec4(F, G * ${f(1 / (SIG * SIG))}, 1.0);
}
`;
export const BACKDROP = `${HEAD}${SCENE}
void main() {
  // (not where the glass will be drawn over it)
  if (capsule(in2(vP - PIV), RO - 1.5) < 0.0) discard;
  else o = vec4(finish(lit(texelFetch(uWall, ivec2(gl_FragCoord.xy), 0), vP)), 1.0);
}
`;
export const CAPSULE = `${HEAD}${SCENE}
const float IOR = 1.5;
const vec3 TINT = vec3(0.965, 0.985, 0.975);

vec3 dir3(vec2 e, vec2 d) {
  return vec3(out2(e * d.x), d.y);
}

bool refr(vec2 I, vec2 N, float eta, out vec2 T) {
  float c = dot(N, I);
  float k = 1.0 - eta * eta * (1.0 - c * c);
  if (k < 0.0) return false;
  T = eta * I - (eta * c + sqrt(k)) * N;
  return true;
}

float fres(float c) {
  float x = 1.0 - clamp(c, 0.0, 1.0);
  float x2 = x * x;
  return 0.04 + 0.96 * x2 * x2 * x;
}

vec3 back(vec2 l) {
  return wall(PIV + out2(l));
}

// The pilot lamp as a mirror at l (in the capsule's frame) shows it, looking
// along r: a small bright patch, and its glow on the dial round it.
vec3 glint(vec3 r, vec2 l) {
  vec3 c = vec3(0.0);
  if (uGlow.r > 0.0) {
    float d = max(dot(r, normalize(vec3(LAMP - PIV - out2(l), -46.0))), 0.0);
    float d2 = d * d, d4 = d2 * d2, d16 = d4 * d4 * d4 * d4;
    c = uGlow * (0.9 * d16 * d16 + 0.10 * d4);
  }
  return c;
}

// A drawn nickel-iron wire: a rod of radius r about the nearest point c.
vec3 wire(vec2 q, vec2 c, float r0) {
  vec2 n = (q - c) / r0;
  float nz = sqrt(max(1.0 - dot(n, n), 0.0));
  vec3 nn = vec3(out2(n), nz);
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), nn);
  vec3 ax = vec3(uTurn, 0.0);
  vec3 c3 = (env(r) + env(normalize(r + 0.22 * ax)) + env(normalize(r - 0.22 * ax))) / 3.0;
  // (drawn wire is satin, not a mirror: it takes some light from the box)
  return (c3 + 0.16 * max(dot(nn, KEY), 0.0)) * vec3(0.74, 0.71, 0.66);
}

// Where the pins are at q: coverage in a, colour in rgb. With a bead, each
// ends in the welded bead that makes the contact.
vec4 pins(vec2 q, float from, float to, float bead) {
  float y = q.y < 0.0 ? -${f(PIN_Y)} : ${f(PIN_Y)};
  vec2 c = vec2(clamp(q.x, from, to), y);
  float r0 = ${f(PIN_R)};
  vec2 tip = vec2(from, y);
  if (length(q - tip) < bead) {
    c = tip;
    r0 = bead;
  }
  float d = length(q - c) - r0;
  float a = clamp(0.5 - d * uDpr, 0.0, 1.0);
  vec4 w = vec4(0.0);
  if (a > 0.0) w = vec4(wire(q, c, r0), a);
  return w;
}

// The mercury at q (a point of the cavity, at signed distance rq from the
// axis along e): coverage in a, colour in rgb.
vec4 mercury(vec2 q, vec2 e, float rq, vec3 view) {
  vec3 fg = field(q);
  float F = fg.x;
  vec2 G = -fg.yz;
  float a = F < ${f(ISO * 0.5)} ? 0.0 : clamp((F - ${f(ISO)}) / max(length(G), 1e-4) * uDpr + 0.5, 0.0, 1.0);
  vec4 hg = vec4(0.0);
  if (a > 0.0) {
  // The free surface rounds over; where there is enough liquid to fill the
  // tube it lies against the glass and takes its curve.
  vec2 n2 = -G * 12.1 * (1.0 - 0.8 * smoothstep(${f(ISO)}, 2.2, F));
  float full = smoothstep(1.0, 2.5, F);
  n2 += e * (rq / RI) * full;
  float m = length(n2);
  if (m > 0.985) n2 *= 0.985 / m;
  vec3 n = vec3(out2(n2), sqrt(1.0 - dot(n2, n2)));
  vec3 r = reflect(view, n);
  // a mirror: what it shows is the room, and the pilot lamp below it
  vec3 c = (env(r) + glint(r, q)) * vec3(0.80, 0.82, 0.85);
  // where it meets the glass there is no light between the two, and its own
  // edge turns away from everything
  float ec = RI - abs(rq);
  c *= 0.2 + 0.8 * smoothstep(0.0, 3.5, ec);
  c *= 0.22 + 0.78 * smoothstep(0.0, 2.6, (F - ${f(ISO)}) / max(length(G), 1e-4));
  hg = vec4(c, a);
  }
  return hg;
}

void main() {
  vec2 p = vL;
  vec3 view = vec3(0.0, 0.0, -1.0);
  float ax = clamp(p.x, -L, L);
  vec2 radial = p - vec2(ax, 0.0);
  float r = length(radial);
  vec2 e = r > 1e-4 ? radial / r : vec2(0.0, 1.0);
  float cover = clamp(0.5 - (r - RO) * uDpr, 0.0, 1.0);

  vec3 col = vec3(0.0);
  if (cover < 1.0) {
    col = back(p);
    // the leads, outside the glass
    vec4 lead = pins(p, L + RO - 3.0, L + RO + ${f(LEAD)}, 0.0);
    col = mix(col, lead.rgb, lead.a);
  }

  if (cover > 0.0) {
    float rr = min(r, RO - 1e-3);
    vec2 P0 = vec2(rr, sqrt(RO * RO - rr * rr));
    vec2 N0 = P0 / RO;
    vec2 I = vec2(0.0, -1.0);
    float F0 = fres(N0.y);
    // (the cavity's near face mirrors nearly the same of the room: one look
    // serves both)
    vec3 near = env(dir3(e, reflect(I, N0)));
    vec3 glass = F0 * near;
    vec2 T1;
    refr(I, N0, 1.0 / IOR, T1);
    float b = dot(P0, T1);
    float disc = b * b - (RO * RO - RI * RI);
    // Where the ray ends: on the backdrop, rb along e (and how much of it
    // gets out to there), or else in the room, along "away". A software
    // renderer works every branch for every pixel, so each branch only finds
    // the way and the looking is done once, after.
    float rb = 0.0, gets = 0.0;
    vec2 away = vec2(0.0, 1.0);
    // 0: only glass on this ray; 1: it goes round in the wall; 2: through
    // the cavity
    int way = 0;
    vec4 hg = vec4(0.0);
    vec2 q = p;
    float F1 = 0.0, F3 = 0.0;
    vec2 mirror = vec2(0.0, 1.0);
    if (disc > 0.0) {
      vec2 P1 = P0 + (-b - sqrt(disc)) * T1;
      vec2 N1 = P1 / RI;
      vec2 T2;
      if (refr(T1, N1, IOR, T2)) {
        way = 2;
        F1 = fres(-dot(T2, N1));
        // what is in the cavity, where the ray crosses its middle plane
        float rq = P1.x + T2.x * (P1.y / -T2.y);
        q = vec2(ax, 0.0) + e * rq;
        hg = mercury(q, e, rq, dir3(e, T2));
        // the far side of the cavity, the far wall, and out to the backdrop
        float bb = dot(P1, T2);
        vec2 P3 = P1 - 2.0 * bb * T2;
        vec2 N3 = P3 / RI;
        F3 = fres(dot(T2, N3));
        mirror = reflect(T2, -N3);
        vec2 T3;
        refr(T2, -N3, 1.0 / IOR, T3);
        float b4 = dot(P3, T3);
        vec2 P4 = P3 + (-b4 + sqrt(b4 * b4 + RO * RO - RI * RI)) * T3;
        vec2 N4 = P4 / RO;
        vec2 T4;
        if (refr(T3, -N4, IOR, T4) && T4.y < -0.05) {
          rb = P4.x + T4.x * (P4.y + 46.0) / -T4.y;
          gets = 1.0 - fres(dot(T4, N4));
        } else {
          away = reflect(T3, -N4);
        }
      } else {
        // the ray cannot leave the wall into the cavity: it goes round in it
        way = 1;
        vec2 Tr = reflect(T1, N1);
        float b2 = dot(P1, Tr);
        vec2 P2 = P1 + (-b2 + sqrt(b2 * b2 + RO * RO - RI * RI)) * Tr;
        vec2 N2 = P2 / RO;
        vec2 T3;
        if (!refr(Tr, -N2, IOR, T3)) T3 = reflect(Tr, -N2);
        if (T3.y < -0.05) {
          rb = P2.x + T3.x * (P2.y + 46.0) / -T3.y;
          gets = 0.8;
        } else {
          away = T3;
        }
      }
    } else {
      // only glass on this ray: across the wall and out the far side
      vec2 P2 = P0 - 2.0 * b * T1;
      vec2 N2 = P2 / RO;
      vec2 T3;
      if (refr(T1, -N2, IOR, T3)) {
        if (T3.y < -0.05) {
          rb = P2.x + T3.x * (P2.y + 46.0) / -T3.y;
          gets = 1.0 - fres(dot(T3, N2));
        } else {
          away = T3;
        }
      } else {
        away = reflect(T1, -N2);
      }
    }
    vec3 inner = (gets > 0.0 ? back(vec2(ax, 0.0) + e * rb) * gets : env(dir3(e, away))) * TINT;
    // the pins: in the cavity, or sealed through the end
    vec4 pn = vec4(0.0);
    if (way != 1) pn = pins(way == 2 ? q : p, way == 2 ? ${f(PIN_TIP)} : L + RI - 6.0, L + RO, way == 2 ? ${f(PIN_BEAD)} : 0.0);
    if (way == 2) {
      // (the far face is seen through the near one, and counts for less)
      inner *= 1.0 - F3;
      if (F3 > 0.05) inner += 0.4 * F3 * env(dir3(e, mirror));
      inner = mix(inner, pn.rgb, pn.a);
      inner = mix(inner, hg.rgb, hg.a);
      inner = inner * (1.0 - F1) + F1 * near * 0.6;
    } else {
      inner *= TINT;
      inner = mix(inner, pn.rgb, pn.a * 0.9);
    }
    glass += (1.0 - F0) * inner;
    col = mix(col, glass, cover);
  }

  // the clip: a band of spring steel round the tube, and the pivot screw
  float RC = RO + 1.8;
  float bandCover = clamp(0.5 - (abs(p.x) - BAND) * uDpr, 0.0, 1.0) * clamp(0.5 - (abs(p.y) - RC) * uDpr, 0.0, 1.0);
  if (bandCover > 0.0) {
    float ny = clamp(p.y / RC, -1.0, 1.0);
    // its edges are broken, not sharp
    float ex = smoothstep(BAND - 1.2, BAND, abs(p.x)) * sign(p.x) * 0.55;
    vec3 n = normalize(vec3(out2(vec2(ex, ny)), sqrt(max(1.0 - ny * ny, 0.0)) + 1e-3));
    vec3 rd = reflect(view, n);
    vec3 axs = vec3(uTurn, 0.0);
    vec3 c = vec3(0.0);
    for (int k = -1; k <= 1; k++) c += env(normalize(rd + 0.26 * float(k) * axs));
    // (the band is brass)
    c = c * 0.333 * vec3(0.84, 0.60, 0.27) + vec3(0.016, 0.011, 0.004);
    // the grain of the strip runs round the tube
    c *= 0.90 + 0.2 * hash(vec2(floor(p.x * 3.0), 1.0));
    // the screw: a pan head with a hex socket
    float rs = length(p);
    float head = clamp(0.5 - (rs - 5.6) * uDpr, 0.0, 1.0);
    if (head > 0.0) {
      vec2 hn = p / 5.6 * 0.72 * smoothstep(1.5, 5.6, rs);
      vec3 n3 = normalize(vec3(out2(hn), sqrt(max(1.0 - dot(hn, hn), 0.0))));
      vec3 hc = env(reflect(view, n3)) * vec3(0.62, 0.60, 0.56) + 0.012;
      vec2 hp = abs(p);
      float hex = max(hp.x * 0.866 + hp.y * 0.5, hp.y) - 2.5;
      hc = mix(hc, vec3(0.006), clamp(0.5 - hex * uDpr, 0.0, 1.0));
      // a line of shadow round the head
      c *= 1.0 - 0.55 * bell((rs - 5.9) / 0.8) * (1.0 - head);
      c = mix(c, hc, head);
    } else {
      c *= 1.0 - 0.5 * bell((rs - 6.2) / 0.9);
    }
    col = mix(col, c, bandCover);
  }
  o = vec4(finish(col), 1.0);
}
`;
