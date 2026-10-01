import { SHAPE, type Layout } from './gl/shapes';
import type { FrameState, Vec3 } from './gl/world';
import { clamp, easeInOutCubic, lerp } from './gl/math';

interface Pose {
  pos: Vec3;
  rot: Vec3;
  scale: number;
  cam: Vec3;
  look: Vec3;
}

interface Stop {
  key: string;
  shape: number;
  d: Pose;
  m?: Partial<Pose>;
  size: number;
  burst: number;
  scatter: number;
  focus?: number;
  dof: number;
  mouse: number;
  bloom: number;
}

const P = (pos: Vec3, rot: Vec3, scale: number, cam: Vec3 = [0, 0, 5.4], look: Vec3 = [0, 0, 0]): Pose => ({ pos, rot, scale, cam, look });

/**
 * The whole story as a list of formations. Scroll position maps to a
 * continuous coordinate over this list; holds sit on integers, morphs between.
 */
export const STOPS: Stop[] = [
  {
    key: 'hero', shape: SHAPE.BRAIN,
    d: P([1.32, -0.04, 0], [0.12, -0.6, 0.06], 0.9, [0, 0, 5.2]),
    m: { pos: [0, 0.9, 0], scale: 0.5, cam: [0, 0, 5.6] },
    size: 0.024, burst: 0.0, scatter: 0, dof: 3.2, mouse: 1, bloom: 0.36,
  },
  {
    key: 'scatter', shape: SHAPE.FIELD,
    d: P([0, 0, 0], [0, 0, 0], 1, [0, 0, 3.1]),
    m: { cam: [0, 0, 3.4] },
    size: 0.032, burst: 1.05, scatter: 0.12, focus: 3.1, dof: 2.8, mouse: 0.7, bloom: 0.46,
  },
  {
    key: 'silos', shape: SHAPE.SILOS,
    d: P([0, 0, 0], [0.04, 0, 0], 1, [0, 0, 6.5]),
    m: { cam: [0, 0, 7.8] },
    size: 0.024, burst: 0.68, scatter: 0, dof: 4.5, mouse: 1, bloom: 0.33,
  },
  {
    key: 'vortex', shape: SHAPE.VORTEX,
    d: P([0.2, 0.32, 0], [1.05, 0, 0.18], 0.72, [0, 0, 5.6]),
    m: { pos: [0, 1.05, 0], scale: 0.48, cam: [0, 0, 6] },
    size: 0.021, burst: 0.56, scatter: 0, dof: 3.6, mouse: 0.8, bloom: 0.49,
  },
  {
    key: 'query', shape: SHAPE.QMARK,
    d: P([0, 0.52, 0], [0, -0.3, 0], 0.7, [0, 0, 5.6]),
    m: { pos: [0, 0.9, 0], scale: 0.6 },
    size: 0.023, burst: 0.62, scatter: 0, dof: 3.5, mouse: 1, bloom: 0.41,
  },
  {
    key: 'answer', shape: SHAPE.RIBBON,
    d: P([0, -0.85, 0], [0.32, -0.18, 0.04], 1, [0, 0, 5.6]),
    m: { pos: [0, -1.35, 0], scale: 0.85 },
    size: 0.02, burst: 0.68, scatter: 0, dof: 4, mouse: 1, bloom: 0.41,
  },
  {
    key: 'network', shape: SHAPE.SPHERE,
    d: P([-1.2, 0, 0], [0.35, 0.2, 0], 1, [0, 0, 5.4]),
    m: { pos: [0, 0.98, 0], scale: 0.46 },
    size: 0.02, burst: 0.56, scatter: 0, dof: 3.4, mouse: 1, bloom: 0.4,
  },
  {
    key: 'vault', shape: SHAPE.VAULT,
    d: P([1.25, 0, 0], [0.5, 0.65, 0], 0.95, [0, 0, 5.4]),
    m: { pos: [0, 0.92, 0], scale: 0.48 },
    size: 0.021, burst: 0.62, scatter: 0, dof: 3.4, mouse: 1, bloom: 0.4,
  },
  {
    key: 'helix', shape: SHAPE.HELIX,
    d: P([1.05, 0, 0], [0.2, 0.1, 0.42], 0.78, [0, 0, 5.4]),
    m: { pos: [0, 0.95, 0], rot: [0.1, 0, 1.45], scale: 0.48 },
    size: 0.021, burst: 0.62, scatter: 0, dof: 3.4, mouse: 1, bloom: 0.4,
  },
  {
    key: 'knot', shape: SHAPE.KNOT,
    d: P([1.25, 0, 0], [0.4, 0.3, 0], 1, [0, 0, 5.4]),
    m: { pos: [0, 0.95, 0], scale: 0.6 },
    size: 0.021, burst: 0.62, scatter: 0, dof: 3.4, mouse: 1, bloom: 0.4,
  },
  {
    key: 'mark', shape: SHAPE.LOGO,
    d: P([0.25, 0.3, 0], [0, 0, 0], 0.78, [0, 0, 5.4]),
    m: { pos: [0, 0.75, 0], scale: 0.6 },
    size: 0.02, burst: 0.81, scatter: 0, dof: 3.4, mouse: 0.7, bloom: 0.46,
  },
  {
    key: 'finale', shape: SHAPE.BRAIN,
    d: P([1.45, 0.05, 0], [0.16, 0.75, 0.02], 0.8, [0, 0, 5.4]),
    m: { pos: [0, 0.95, 0], scale: 0.5 },
    size: 0.025, burst: 0.62, scatter: 0, dof: 3.4, mouse: 1, bloom: 0.36,
  },
];

export const STOP_INDEX: Record<string, number> = Object.fromEntries(STOPS.map((s, i) => [s.key, i]));

interface Anchor {
  start: number;
  end: number;
}

export class Story {
  anchors: Anchor[] = [];
  chapters: { el: HTMLElement; top: number; height: number; first: number; count: number }[] = [];
  p = 0;
  target = 0;

  measure() {
    const vh = window.innerHeight;
    this.anchors = [];
    this.chapters = [];
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-stops]'));
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    sections.forEach((el) => {
      const keys = (el.dataset.stops || '').split(',');
      const top = el.offsetTop;
      const height = el.offsetHeight;
      const span = Math.max(1, height - vh);
      const first = this.anchors.length;
      keys.forEach((_, j) => {
        const slot = span / keys.length;
        const isMulti = keys.length > 1;
        // single-stop chapters hold through most of their pinned span; multi-stop
        // chapters split it into slots, holding in the middle of each slot
        const a = isMulti ? (j === 0 ? 0.08 : 0.3) : 0.08;
        const b = isMulti ? (j === keys.length - 1 ? 0.75 : 0.62) : 0.62;
        this.anchors.push({ start: Math.min(maxScroll, top + slot * j + slot * a), end: Math.min(maxScroll, top + slot * j + slot * b) });
      });
      this.chapters.push({ el, top, height, first, count: keys.length });
    });
    if (this.anchors.length) {
      this.anchors[0].start = 0;
      const last = this.anchors[this.anchors.length - 1];
      last.end = Math.max(last.end, maxScroll);
      last.start = Math.min(last.start, maxScroll - vh * 0.25);
    }
  }

  /** scroll px -> continuous stop coordinate */
  coord(scroll: number) {
    const a = this.anchors;
    if (!a.length) return 0;
    if (scroll <= a[0].end) return 0;
    for (let i = 0; i < a.length - 1; i++) {
      if (scroll <= a[i + 1].start) {
        if (scroll <= a[i].end) return i;
        return i + (scroll - a[i].end) / Math.max(1, a[i + 1].start - a[i].end);
      }
      if (scroll <= a[i + 1].end) return i + 1;
    }
    return a.length - 1;
  }

  /** scroll position at which a stop is fully formed (for nav jumps) */
  scrollFor(i: number) {
    const a = this.anchors[clamp(i, 0, this.anchors.length - 1)];
    return a ? (a.start + a.end) / 2 : 0;
  }

  update(scroll: number, dt: number) {
    this.target = this.coord(scroll);
    // slight inertia gives the formation weight without drifting from the text
    const k = 1 - Math.exp(-dt * 7.5);
    this.p += (this.target - this.p) * k;
    if (Math.abs(this.target - this.p) < 1e-4) this.p = this.target;
    return this.p;
  }

  frame(layout: Layout): FrameState {
    const p = clamp(this.p, 0, STOPS.length - 1);
    const i = Math.min(Math.floor(p), STOPS.length - 2);
    const mix = clamp(p - i, 0, 1);
    const A = STOPS[i];
    const B = STOPS[i + 1];
    const pa = pose(A, layout);
    const pb = pose(B, layout);
    const e = easeInOutCubic(mix);
    const L3 = (x: Vec3, y: Vec3): Vec3 => [lerp(x[0], y[0], e), lerp(x[1], y[1], e), lerp(x[2], y[2], e)];
    // focus follows camera distance unless a stop pins it
    const fa = A.focus ?? pa.cam[2];
    const fb = B.focus ?? pb.cam[2];
    // mid-morph the formation is in flight: soften the fog so the burst reads
    const flight = Math.sin(Math.PI * e);
    return {
      shapeA: A.shape,
      shapeB: B.shape,
      mix,
      burst: B.burst,
      // alternate the direction of the sweep from one formation to the next
      swirl: (i % 2 ? -1 : 1) * 1.25,
      size: lerp(A.size, B.size, e),
      scatter: lerp(A.scatter, B.scatter, e),
      pos: L3(pa.pos, pb.pos),
      rot: L3(pa.rot, pb.rot),
      scale: lerp(pa.scale, pb.scale, e),
      cam: L3(pa.cam, pb.cam),
      look: L3(pa.look, pb.look),
      focus: lerp(fa, fb, e),
      dof: lerp(A.dof, B.dof, e) + flight * 1.5,
      mouse: lerp(A.mouse, B.mouse, e),
      bloom: lerp(A.bloom, B.bloom, e) + flight * 0.16,
    };
  }
}

function pose(s: Stop, layout: Layout): Pose {
  if (layout === 'tall' && s.m) return { ...s.d, ...s.m };
  return s.d;
}
