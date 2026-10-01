import { createNoise3D, gauss, mulberry32, unitVec, type Rand } from './math';

/**
 * Every shape is a list of N target positions (xyz) + a colour hint (w).
 * w < 0  -> particle keeps its own colour
 * w >= 0 -> palette index to tint towards while this shape is formed
 */

export const SHAPE = {
  BRAIN: 0,
  FIELD: 1,
  SILOS: 2,
  VORTEX: 3,
  QMARK: 4,
  RIBBON: 5,
  SPHERE: 6,
  VAULT: 7,
  HELIX: 8,
  KNOT: 9,
  LOGO: 10,
} as const;

export const SHAPE_COUNT = 11;

export type Layout = 'wide' | 'tall';

type Out = Float32Array;

const set = (o: Out, i: number, x: number, y: number, z: number, w = -1) => {
  o[i * 4] = x;
  o[i * 4 + 1] = y;
  o[i * 4 + 2] = z;
  o[i * 4 + 3] = w;
};

// ---------------------------------------------------------------------------
// Logo: a "V" broken into shards + one amber spark. Shared with the SVG mark.
// Coordinates live in [-1, 1], y up.
// ---------------------------------------------------------------------------
type V2 = [number, number];
export type Tri = { p: [V2, V2, V2]; tone: number };

function armTris(o0: V2, i0: V2, i1: V2, o1: V2, cut: number, tones: number[]): Tri[] {
  const L = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const oc = L(o0, o1, cut);
  const ic = L(i0, i1, cut * 1.15);
  return [
    { p: [o0, i0, oc], tone: tones[0] },
    { p: [i0, ic, oc], tone: tones[1] },
    { p: [oc, ic, o1], tone: tones[2] },
    { p: [ic, i1, o1], tone: tones[3] },
  ];
}

function shrink(t: Tri, k: number): Tri {
  const cx = (t.p[0][0] + t.p[1][0] + t.p[2][0]) / 3;
  const cy = (t.p[0][1] + t.p[1][1] + t.p[2][1]) / 3;
  return {
    tone: t.tone,
    p: t.p.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]) as [V2, V2, V2],
  };
}

export const LOGO_TRIS: Tri[] = [
  ...armTris([-0.94, 0.84], [-0.5, 0.84], [0.0, -0.2], [-0.02, -0.92], 0.42, [0, 1, 2, 0]),
  ...armTris([0.94, 0.84], [0.56, 0.84], [0.06, -0.12], [0.02, -0.92], 0.38, [2, 0, 1, 2]),
  { p: [[-0.1, 0.84], [0.12, 0.84], [0.01, 0.56]], tone: 3 } as Tri,
].map((t) => shrink(t, 0.88));

export const LOGO_TONES = ['#8052ff', '#a993ff', '#5b33f0', '#ffb829'];
const LOGO_PALETTE = [0, 1, 2, 3];

// ---------------------------------------------------------------------------
// Silo cluster centres (also used by the DOM labels)
// ---------------------------------------------------------------------------
export const SILO_NAMES = ['Docs', 'Threads', 'Inbox', 'Tickets', 'Drive', 'Wiki', 'CRM'];

export function siloCentres(layout: Layout): [number, number, number][] {
  if (layout === 'tall') {
    return [
      [-0.5, 2.15, -0.4],
      [0.62, 1.72, 0.1],
      [-0.62, 1.22, 0.3],
      [0.55, 0.72, -0.5],
      [-0.5, 0.25, 0.2],
      [0.62, -0.18, -0.2],
      [-0.25, -0.52, -0.6],
    ];
  }
  // a loose ring around an empty centre, where the headline sits
  const zs = [-0.9, 0.2, -0.4, 0.3, -0.6, 0.1, -1.0];
  return zs.map((z, k) => {
    const a = Math.PI / 2 + (k * Math.PI * 2) / 7;
    return [Math.cos(a) * 2.65, Math.sin(a) * 1.5 - 0.05, z] as [number, number, number];
  });
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------
function brain(o: Out, n: number, r: Rand) {
  const noise = createNoise3D(11);
  const S = 0.92;
  let i = 0;
  while (i < n) {
    const u = r();
    if (u < 0.82) {
      const [dx, dy, dz] = unitVec(r);
      const side = dz >= 0 ? 1 : -1;
      let x = dx * 1.22;
      let y = dy * 0.86;
      const z = dz * 0.52;
      if (y < -0.22) y = -0.22 + (y + 0.22) * 0.5;
      // temporal lobe: swell the lower front a little
      const temporal = Math.exp(-((x - 0.35) ** 2) * 4 - ((y + 0.3) ** 2) * 10);
      x += temporal * 0.08;
      const pz = z + side * 0.5;
      const ridge = 1 - Math.abs(noise(x * 2.4, y * 2.4, pz * 2.4));
      const fine = 1 - Math.abs(noise(x * 5 + 9, y * 5, pz * 5));
      const groove = ridge < 0.2;
      if (groove && r() > 0.22) continue;
      const disp = 1 + 0.09 * ridge * ridge + 0.035 * fine * fine - (groove ? 0.07 : 0);
      const shell = u < 0.7 ? 0.965 + 0.035 * r() : 0.35 + 0.6 * Math.pow(r(), 0.5);
      const k = disp * shell;
      // longitudinal fissure: pull the inner wall of each hemisphere away from the midline
      set(o, i, x * k * S, (y * k + 0.12) * S, (z * k + side * 0.5) * S);
      i++;
    } else if (u < 0.94) {
      const [dx, dy, dz] = unitVec(r);
      const y = dy * 0.3;
      const stri = Math.sin(y * 46) > 0.55 && r() > 0.3;
      const k = (stri ? 0.9 : 1) * (0.92 + 0.08 * r());
      set(o, i, (-0.82 + dx * 0.5 * k) * S, (-0.5 + y * k) * S, dz * 0.74 * k * S);
      i++;
    } else {
      const t = r();
      const a = r() * Math.PI * 2;
      const rad = 0.13 * Math.sqrt(r());
      set(o, i, (-0.3 - t * 0.2 + Math.cos(a) * rad) * S, (-0.42 - t * 0.78) * S, Math.sin(a) * rad * S);
      i++;
    }
  }
}

function field(o: Out, n: number, r: Rand, layout: Layout) {
  const w = layout === 'tall' ? 3.2 : 7;
  for (let i = 0; i < n; i++) {
    const z = 3.4 - Math.pow(r(), 0.8) * 13;
    const spread = 1 + Math.max(0, -z) * 0.16;
    set(o, i, (r() * 2 - 1) * w * spread, (r() * 2 - 1) * 3.6 * spread, z);
  }
}

function silos(o: Out, n: number, r: Rand, layout: Layout) {
  const centres = siloCentres(layout);
  const k = layout === 'tall' ? 0.72 : 1;
  const cols = [0, 3, 6, 5, 1, 4, 2];
  for (let i = 0; i < n; i++) {
    const c = i % 7;
    const [cx, cy, cz] = centres[c];
    const R = 0.42 * k;
    let x = 0, y = 0, z = 0;
    const u = r();
    switch (c) {
      case 0: { // sphere shell
        const [a, b, d] = unitVec(r);
        const s = R * (0.94 + 0.06 * r());
        x = a * s; y = b * s; z = d * s;
        break;
      }
      case 1: { // cube surface
        const f = Math.floor(r() * 6);
        const a = (r() * 2 - 1) * R * 0.8, b = (r() * 2 - 1) * R * 0.8, s = R * 0.8 * (f % 2 ? 1 : -1);
        if (f < 2) { x = s; y = a; z = b; } else if (f < 4) { x = a; y = s; z = b; } else { x = a; y = b; z = s; }
        break;
      }
      case 2: { // torus
        const a = r() * Math.PI * 2, b = r() * Math.PI * 2;
        const rr = R * 0.28 * Math.sqrt(r());
        x = (R * 0.85 + rr * Math.cos(b)) * Math.cos(a);
        z = (R * 0.85 + rr * Math.cos(b)) * Math.sin(a);
        y = rr * Math.sin(b);
        break;
      }
      case 3: { // stacked discs
        const layer = Math.floor(r() * 4);
        const a = r() * Math.PI * 2, rr = R * Math.sqrt(r());
        x = Math.cos(a) * rr; z = Math.sin(a) * rr; y = (layer - 1.5) * R * 0.38;
        break;
      }
      case 4: { // pyramid surface
        const t = Math.sqrt(r());
        const a = (r() * 2 - 1) * t, side = Math.floor(r() * 4);
        const yy = R * (1 - 2 * t);
        const e = t * R;
        if (side === 0) { x = a * R; z = e; } else if (side === 1) { x = a * R; z = -e; } else if (side === 2) { x = e; z = a * R; } else { x = -e; z = a * R; }
        y = yy;
        break;
      }
      case 5: { // ring of rings / cylinder
        const a = r() * Math.PI * 2;
        x = Math.cos(a) * R * 0.75; z = Math.sin(a) * R * 0.75; y = (r() * 2 - 1) * R * 0.9;
        if (u < 0.3) { x *= 0.4; z *= 0.4; }
        break;
      }
      default: { // dotted grid plane
        const gx = Math.floor(r() * 9), gy = Math.floor(r() * 9);
        x = (gx / 8 - 0.5) * R * 1.9 + gauss(r) * 0.012;
        y = (gy / 8 - 0.5) * R * 1.9 + gauss(r) * 0.012;
        z = gauss(r) * 0.03;
      }
    }
    set(o, i, cx + x, cy + y, cz + z, u < 0.82 ? cols[c] : -1);
  }
}

function vortex(o: Out, n: number, r: Rand) {
  for (let i = 0; i < n; i++) {
    const u = r();
    if (u < 0.06) {
      const [a, b, c] = unitVec(r);
      const s = 0.26 * Math.pow(r(), 0.5);
      set(o, i, a * s, b * s * 0.6, c * s, r() < 0.6 ? 3 : -1);
      continue;
    }
    const arm = Math.floor(r() * 4);
    const rr = 0.32 + 2.4 * Math.pow(r(), 0.85);
    const theta = arm * (Math.PI / 2) + rr * 1.9 + gauss(r) * (0.16 + rr * 0.05);
    const y = gauss(r) * 0.07 / (0.5 + rr * 0.6);
    set(o, i, Math.cos(theta) * rr, y, Math.sin(theta) * rr);
  }
}

function qmark(o: Out, n: number, r: Rand) {
  // A sculpted question mark built from a tube + a sphere.
  const hookR = 0.58;
  const hookC: [number, number] = [0, 0.62];
  const a0 = Math.PI * 0.95; // start, left side
  const a1 = -Math.PI * 0.42; // end, lower right
  const hookLen = hookR * (a0 - a1);
  const stemTop: [number, number] = [hookC[0] + Math.cos(a1) * hookR, hookC[1] + Math.sin(a1) * hookR];
  const stemBot: [number, number] = [0.02, -0.38];
  const stemLen = Math.hypot(stemTop[0] - stemBot[0], stemTop[1] - stemBot[1]);
  const total = hookLen + stemLen;
  for (let i = 0; i < n; i++) {
    const u = r();
    if (u < 0.16) {
      const [a, b, c] = unitVec(r);
      const s = 0.17 * Math.pow(r(), 0.35);
      set(o, i, 0.02 + a * s, -0.86 + b * s, c * s, 3);
      continue;
    }
    const d = r() * total;
    let cx: number, cy: number, tx: number, ty: number;
    if (d < hookLen) {
      const a = a0 - d / hookR;
      cx = hookC[0] + Math.cos(a) * hookR;
      cy = hookC[1] + Math.sin(a) * hookR;
      tx = Math.sin(a);
      ty = -Math.cos(a);
    } else {
      const t = (d - hookLen) / stemLen;
      cx = stemTop[0] + (stemBot[0] - stemTop[0]) * t;
      cy = stemTop[1] + (stemBot[1] - stemTop[1]) * t;
      tx = stemBot[0] - stemTop[0];
      ty = stemBot[1] - stemTop[1];
      const l = Math.hypot(tx, ty);
      tx /= l;
      ty /= l;
    }
    // ring around the tangent
    const nx = -ty, ny = tx;
    const a = r() * Math.PI * 2;
    const rad = 0.13 * (0.82 + 0.18 * r());
    const off = Math.cos(a) * rad;
    set(o, i, cx + nx * off, cy + ny * off, Math.sin(a) * rad);
  }
}

function ribbon(o: Out, n: number, r: Rand, layout: Layout) {
  const len = layout === 'tall' ? 5.4 : 8;
  for (let i = 0; i < n; i++) {
    const strand = i % 3;
    const t = r();
    const x = (t - 0.5) * len;
    const v = (r() * 2 - 1);
    const width = 0.34 + 0.12 * Math.sin(x * 0.9 + strand);
    const tw = x * 0.55 + strand * 2.1;
    const cy = Math.sin(x * 0.7 + strand * 2.0) * 0.32 + (strand - 1) * 0.18;
    const cz = Math.cos(x * 0.5 + strand * 1.3) * 0.45;
    set(o, i, x, cy + Math.cos(tw) * v * width, cz + Math.sin(tw) * v * width, strand === 1 ? (r() < 0.5 ? 3 : -1) : -1);
  }
}

function sphere(o: Out, n: number, r: Rand) {
  const R = 1.22;
  const nodes: [number, number, number][] = [];
  const NN = 84;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < NN; k++) {
    const y = 1 - (k / (NN - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = ga * k;
    const j = 0.12;
    const p: [number, number, number] = [Math.cos(th) * rad + gauss(r) * j, y + gauss(r) * j, Math.sin(th) * rad + gauss(r) * j];
    const l = Math.hypot(...p);
    nodes.push([p[0] / l, p[1] / l, p[2] / l]);
  }
  const edges: [number, number][] = [];
  for (let a = 0; a < NN; a++) {
    const d = nodes
      .map((p, b) => ({ b, d: (p[0] - nodes[a][0]) ** 2 + (p[1] - nodes[a][1]) ** 2 + (p[2] - nodes[a][2]) ** 2 }))
      .filter((e) => e.b !== a)
      .sort((x, y) => x.d - y.d);
    for (let k = 0; k < 3; k++) if (d[k].b > a) edges.push([a, d[k].b]);
  }
  for (let i = 0; i < n; i++) {
    const u = r();
    if (u < 0.42) {
      const nd = nodes[Math.floor(r() * NN)];
      const s = Math.abs(gauss(r)) * 0.045;
      const [a, b, c] = unitVec(r);
      set(o, i, nd[0] * R + a * s, nd[1] * R + b * s, nd[2] * R + c * s, r() < 0.25 ? 3 : -1);
    } else if (u < 0.88) {
      const [ea, eb] = edges[Math.floor(r() * edges.length)];
      const t = r();
      const A = nodes[ea], B = nodes[eb];
      const x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t, z = A[2] + (B[2] - A[2]) * t;
      const l = Math.hypot(x, y, z);
      const k = (R / l) * (1 + Math.sin(t * Math.PI) * 0.03);
      set(o, i, x * k, y * k, z * k, r() < 0.7 ? 1 : 6);
    } else {
      const [a, b, c] = unitVec(r);
      const s = R * (0.25 + 0.5 * Math.pow(r(), 0.5));
      set(o, i, a * s, b * s, c * s, 0);
    }
  }
}

function vault(o: Out, n: number, r: Rand) {
  const edge = (h: number, rot: number) => {
    const e = Math.floor(r() * 12);
    const t = r() * 2 - 1;
    const axis = Math.floor(e / 4);
    const s1 = e & 1 ? 1 : -1;
    const s2 = e & 2 ? 1 : -1;
    let p: [number, number, number];
    if (axis === 0) p = [t * h, s1 * h, s2 * h];
    else if (axis === 1) p = [s1 * h, t * h, s2 * h];
    else p = [s1 * h, s2 * h, t * h];
    const c = Math.cos(rot), s = Math.sin(rot);
    return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c] as [number, number, number];
  };
  for (let i = 0; i < n; i++) {
    const u = r();
    if (u < 0.42) {
      const p = edge(0.9, 0);
      const j = 0.022;
      set(o, i, p[0] + gauss(r) * j, p[1] + gauss(r) * j, p[2] + gauss(r) * j, r() < 0.75 ? 1 : 6);
    } else if (u < 0.66) {
      const p = edge(0.46, Math.PI / 4);
      const j = 0.018;
      set(o, i, p[0] + gauss(r) * j, p[1] + gauss(r) * j, p[2] + gauss(r) * j, 0);
    } else if (u < 0.8) {
      const [a, b, c] = unitVec(r);
      const s = 0.18 * Math.pow(r(), 0.4);
      set(o, i, a * s, b * s, c * s, 3);
    } else {
      // dotted faces of the outer cube
      const f = Math.floor(r() * 6);
      const g = 10;
      const a = (Math.floor(r() * (g + 1)) / g) * 1.8 - 0.9;
      const b = (Math.floor(r() * (g + 1)) / g) * 1.8 - 0.9;
      const s = 0.9 * (f % 2 ? 1 : -1);
      let p: [number, number, number];
      if (f < 2) p = [s, a, b]; else if (f < 4) p = [a, s, b]; else p = [a, b, s];
      set(o, i, p[0], p[1], p[2], -1);
    }
  }
}

function helix(o: Out, n: number, r: Rand) {
  const L = 4.6, R = 0.55, turns = 2.6;
  for (let i = 0; i < n; i++) {
    const u = r();
    const t = r();
    const x = (t - 0.5) * L;
    const a = t * turns * Math.PI * 2;
    if (u < 0.72) {
      const strand = u < 0.36 ? 0 : Math.PI;
      const [jx, jy, jz] = unitVec(r);
      const s = 0.07 * Math.sqrt(r());
      set(o, i, x + jx * s, Math.cos(a + strand) * R + jy * s, Math.sin(a + strand) * R + jz * s, strand ? 0 : -1);
    } else {
      const rung = Math.round(t * 44) / 44;
      const ra = rung * turns * Math.PI * 2;
      const rx = (rung - 0.5) * L;
      const k = r() * 2 - 1;
      set(o, i, rx + gauss(r) * 0.01, Math.cos(ra) * R * k, Math.sin(ra) * R * k, Math.abs(k) < 0.25 ? 3 : 7);
    }
  }
}

function knot(o: Out, n: number, r: Rand) {
  const p = 2, q = 3, R = 0.78, rr = 0.34;
  const curve = (t: number) => {
    const c = R + rr * Math.cos(q * t);
    return [c * Math.cos(p * t), c * Math.sin(p * t), rr * Math.sin(q * t) * 1.4] as const;
  };
  for (let i = 0; i < n; i++) {
    const t = r() * Math.PI * 2;
    const c0 = curve(t);
    const c1 = curve(t + 0.001);
    let tx = c1[0] - c0[0], ty = c1[1] - c0[1], tz = c1[2] - c0[2];
    const tl = Math.hypot(tx, ty, tz);
    tx /= tl; ty /= tl; tz /= tl;
    // any perpendicular frame
    let nx = -ty, ny = tx, nz = 0;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
    const a = r() * Math.PI * 2;
    const s = 0.13 * (0.75 + 0.25 * r());
    const ca = Math.cos(a) * s, sa = Math.sin(a) * s;
    set(o, i, c0[0] + nx * ca + bx * sa, c0[1] + ny * ca + by * sa, c0[2] + nz * ca + bz * sa, r() < 0.12 ? 3 : -1);
  }
}

function logo(o: Out, n: number, r: Rand) {
  const tris = LOGO_TRIS;
  const areas = tris.map(({ p }) => Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1])) / 2);
  // give the spark a bit more density than its area deserves
  areas[areas.length - 1] *= 2.2;
  const total = areas.reduce((a, b) => a + b, 0);
  const cdf: number[] = [];
  let acc = 0;
  for (const a of areas) cdf.push((acc += a) / total);
  const S = 1.35;
  for (let i = 0; i < n; i++) {
    const u = r();
    let k = 0;
    while (cdf[k] < u) k++;
    const { p, tone } = tris[k];
    let a = r(), b = r();
    if (a + b > 1) { a = 1 - a; b = 1 - b; }
    const x = p[0][0] + (p[1][0] - p[0][0]) * a + (p[2][0] - p[0][0]) * b;
    const y = p[0][1] + (p[1][1] - p[0][1]) * a + (p[2][1] - p[0][1]) * b;
    const z = (r() * 2 - 1) * 0.07 + (k % 3) * 0.05 - 0.05;
    set(o, i, x * S, y * S, z * S, LOGO_PALETTE[tone]);
  }
}

export function buildShapes(n: number, layout: Layout) {
  const rows = Math.ceil(n / TEX_W);
  const data = new Float32Array(TEX_W * rows * SHAPE_COUNT * 4);
  const gens: ((o: Out, n: number, r: Rand) => void)[] = [
    brain,
    (o, c, r) => field(o, c, r, layout),
    (o, c, r) => silos(o, c, r, layout),
    vortex,
    qmark,
    (o, c, r) => ribbon(o, c, r, layout),
    sphere,
    vault,
    helix,
    knot,
    logo,
  ];
  gens.forEach((g, s) => {
    const o = new Float32Array(TEX_W * rows * 4);
    g(o, n, mulberry32(1000 + s * 77));
    // shuffle-free: indices are already random per generator
    data.set(o, s * TEX_W * rows * 4);
  });
  return { data, rows };
}

export const TEX_W = 128;
