import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './style.css';

import gsap from 'gsap';
import Lenis from 'lenis';
import * as THREE from 'three';
import { World } from './gl/world';
import { LOGO_TONES, LOGO_TRIS, SILO_NAMES, siloCentres, type Layout } from './gl/shapes';
import { clamp, easeInOutCubic, smooth } from './gl/math';
import { Story, STOP_INDEX, STOPS } from './story';
import { splitChars, splitReading, splitWords } from './ui/split';

const $ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s)!;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(s));

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;
const layoutFor = (): Layout => (window.innerWidth < 900 ? 'tall' : 'wide');
let layout = layoutFor();

// ---------------------------------------------------------------------------
// viewport unit that ignores the mobile address bar
// ---------------------------------------------------------------------------
let lastW = window.innerWidth;
let lastH = window.innerHeight;
const setVh = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
setVh();

// ---------------------------------------------------------------------------
// logo mark (the same shards the particles assemble into)
// ---------------------------------------------------------------------------
const logoSvg = () =>
  `<svg viewBox="0 0 100 100">${LOGO_TRIS.map(
    (t) => `<polygon points="${t.p.map(([x, y]) => `${((x + 1) * 50).toFixed(2)},${((1 - y) * 50).toFixed(2)}`).join(' ')}" fill="${LOGO_TONES[t.tone]}"/>`,
  ).join('')}</svg>`;
$$('[data-logo]').forEach((el) => (el.innerHTML = logoSvg()));

function shatterLogo(el: HTMLElement, amount = 1) {
  const polys = $$('polygon', el);
  gsap.killTweensOf(polys);
  gsap.fromTo(
    polys,
    { x: () => gsap.utils.random(-14, 14) * amount, y: () => gsap.utils.random(-14, 14) * amount, rotate: () => gsap.utils.random(-50, 50) * amount },
    { x: 0, y: 0, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: 0.02 },
  );
}
$$('.nav__logo').forEach((a) => a.addEventListener('mouseenter', () => shatterLogo($('[data-logo]', a), 0.8)));

// ---------------------------------------------------------------------------
// world + scroll
// ---------------------------------------------------------------------------
const canvas = $<HTMLCanvasElement>('#gl');
let world: World | null = null;
try {
  world = new World(canvas, layout);
} catch (err) {
  console.warn('WebGL unavailable, continuing without the particle system', err);
  document.documentElement.classList.add('no-gl');
}

const story = new Story();

const lenis = new Lenis({
  lerp: 0.085,
  wheelMultiplier: 0.9,
  smoothWheel: !reduced,
  syncTouch: false,
});
lenis.stop();
window.scrollTo(0, 0);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ---------------------------------------------------------------------------
// chapter text: word masks that rise in, plus figure/eyebrow reveals
// ---------------------------------------------------------------------------
interface ChapterUI {
  el: HTMLElement;
  words: HTMLElement[];
  soft: HTMLElement[];
  reveals: HTMLElement[];
  shown: boolean;
  tl?: gsap.core.Timeline;
}

const chaptersUI: ChapterUI[] = $$('.chapter').map((el) => {
  const words: HTMLElement[] = [];
  const soft: HTMLElement[] = [];
  $$('[data-split]', el).forEach((s) => {
    const w = splitWords(s);
    (s.dataset.split === 'soft' ? soft : words).push(...w);
  });
  const reveals = $$('[data-reveal]', el);
  if (words.length) gsap.set(words, { yPercent: 118, rotate: 5 });
  if (soft.length) gsap.set(soft, { yPercent: 105, opacity: 0 });
  if (reveals.length) gsap.set(reveals, { autoAlpha: 0, y: 26 });
  return { el, words, soft, reveals, shown: false };
});

function showChapter(c: ChapterUI, on: boolean, delay = 0) {
  if (c.shown === on) return;
  c.shown = on;
  c.tl?.kill();
  const tl = gsap.timeline({ delay });
  const add = (els: HTMLElement[], vars: gsap.TweenVars, at: number) => els.length && tl.to(els, vars, at);
  if (on) {
    add(c.words, { yPercent: 0, rotate: 0, duration: 1.5, ease: 'expo.out', stagger: 0.045 }, 0);
    add(c.soft, { yPercent: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.012 }, 0.25);
    add(c.reveals, { autoAlpha: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.09 }, 0.35);
  } else {
    add(c.words, { yPercent: 118, rotate: 5, duration: 0.6, ease: 'power3.in', stagger: 0.015 }, 0);
    add(c.soft, { yPercent: 105, opacity: 0, duration: 0.5, ease: 'power3.in' }, 0);
    add(c.reveals, { autoAlpha: 0, y: 26, duration: 0.5, ease: 'power3.in' }, 0);
  }
  c.tl = tl;
}

// --- 02 scatter word: letters drift apart like the shards behind them
const scatterEl = $('[data-scatter]');
const scatterChars = splitChars(scatterEl).map((el, i) => ({
  el,
  x: (Math.sin(i * 12.9898) * 0.5 + (i % 2 ? 0.4 : -0.2)) * 1.0,
  y: Math.cos(i * 78.233) * 0.9,
  z: Math.sin(i * 3.7) * 60,
}));

// --- 03 silo labels tracked to cluster centres
const labelsRoot = $('[data-labels]');
const labels = SILO_NAMES.map((name, i) => {
  const el = document.createElement('div');
  el.className = 'label mono';
  el.innerHTML = `<i></i><span>0${i + 1}</span><b>${name}</b>`;
  labelsRoot.appendChild(el);
  return { el, name, v: new THREE.Vector3(), shown: false, b: el.querySelector('b')! };
});
const projOut = { x: 0, y: 0, z: 0 };

const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&/+=';
function scramble(el: HTMLElement, text: string) {
  const o = { t: 0 };
  gsap.to(o, {
    t: 1,
    duration: 0.9,
    ease: 'power2.out',
    onUpdate: () => {
      const n = Math.floor(o.t * text.length);
      let s = text.slice(0, n);
      for (let i = n; i < text.length; i++) s += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
      el.textContent = s;
    },
  });
}

// --- 04 ring text tracked to the vortex
const ring = $('[data-ring]');
const ringSvg = $('svg', ring) as unknown as SVGElement;
const vC = new THREE.Vector3();
const vX = new THREE.Vector3();
const vZ = new THREE.Vector3();

// --- 05 typed question
const QUESTION = 'Why did we move the Lisbon launch to May?';
const queryText = $('[data-query-text]');
let typed = -1;
let questionPulsed = false;

// --- 06 reading highlight
const readWords = splitReading($('[data-read]'));

// --- 07 stats
const stats = $$('[data-count-to]').map((el) => ({
  el,
  to: parseFloat(el.dataset.countTo || '0'),
  from: parseFloat(el.dataset.from || '0'),
  dec: parseInt(el.dataset.decimals || '0', 10),
  suf: el.dataset.suffix ?? '',
}));

// --- 08 principles track
const track = $('[data-track]');
const panels = $$('.panel', track);
const dots = $$('[data-dot]');

// --- 09 wordmark
const wordLetters = $$('span', $('[data-wordmark]'));
let markPulsed = false;

// --- hud
const hudNum = $('[data-hud-num]');
const hudName = $('[data-hud-name]');
const hudRail = $('[data-hud-rail]');
const hudHint = $('[data-hud-hint]');
const hud = $('.hud');
let hudChapter = -1;

function chapterLocal(i: number, scroll: number) {
  const c = story.chapters[i];
  if (!c) return 0;
  const span = Math.max(1, c.height - window.innerHeight);
  return (scroll - c.top) / span;
}

function chapterIndexOf(id: string) {
  return story.chapters.findIndex((c) => c.el.id === id);
}
let CH: Record<string, number> = {};

function measure() {
  story.measure();
  CH = Object.fromEntries(story.chapters.map((c, i) => [c.el.id, i]));
}

// ---------------------------------------------------------------------------
// per-frame overlay choreography, all derived from scroll + the story coord
// ---------------------------------------------------------------------------
let introDone = false;

function overlays(p: number, scroll: number, time: number) {
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  // reveal chapters as they come in; hide again when scrolled back above
  if (introDone) {
    story.chapters.forEach((c, i) => {
      const ui = chaptersUI[i];
      if (!ui) return;
      const enter = i === 0 ? -Infinity : c.top - vh * 0.42;
      showChapter(ui, scroll >= enter);
    });
  }

  // 02 scatter
  {
    const lp = chapterLocal(CH.entropy, scroll);
    const s = smooth((lp - 0.2) / 0.8);
    const e = s * s;
    for (const c of scatterChars) {
      c.el.style.transform = `translate3d(${c.x * e * vw * 0.22}px, ${c.y * e * vh * 0.28}px, 0) rotate(${c.z * e}deg)`;
      c.el.style.opacity = String(1 - e * 0.75);
    }
  }

  // 03 labels
  {
    const si = STOP_INDEX.silos;
    const vis = clamp(1 - Math.abs(p - si) * 2.4);
    const centres = siloCentres(layout);
    const k = layout === 'tall' ? 0.72 : 1;
    labels.forEach((l, i) => {
      const show = vis > 0.6;
      if (show && !l.shown) scramble(l.b, l.name);
      l.shown = show;
      if (vis <= 0.001 || !world) {
        l.el.style.opacity = '0';
        return;
      }
      const c = centres[i];
      // on narrow screens, clusters on the right carry their label on the left
      const flip = layout === 'tall' ? c[0] > 0 : c[0] > 2.3;
      l.v.set(c[0] + (flip ? -0.5 : 0.5) * k, c[1] + 0.1 * k, c[2]);
      world.project(l.v, projOut);
      const delay = clamp(vis * 1.6 - i * 0.08);
      l.el.classList.toggle('is-left', flip);
      l.el.style.opacity = String(delay);
      l.el.style.transform = `translate3d(${projOut.x}px, ${projOut.y - 6}px, 0)${flip ? ' translateX(-100%)' : ''}`;
    });
  }

  // 04 ring
  if (world) {
    const vi = STOP_INDEX.vortex;
    const vis = clamp(1 - Math.abs(p - vi) * 1.7);
    ring.style.opacity = String(vis);
    if (vis > 0.001) {
      const R = 2.25;
      vC.set(0, 0, 0);
      vX.set(R, 0, 0);
      vZ.set(0, 0, R);
      const c = world.project(vC, { x: 0, y: 0, z: 0 });
      const x = world.project(vX, { x: 0, y: 0, z: 0 });
      const z = world.project(vZ, { x: 0, y: 0, z: 0 });
      const a = (x.x - c.x) / 170, b = (x.y - c.y) / 170;
      const cc = (z.x - c.x) / 170, d = (z.y - c.y) / 170;
      ring.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) matrix(${a}, ${b}, ${cc}, ${d}, 0, 0)`;
      ringSvg.style.transform = `rotate(${-time * 9 - (p - vi) * 90}deg)`;
    }
  }

  // 05 typing
  {
    const lp = chapterLocal(CH.question, scroll);
    const t = smooth((lp + 0.22) / 0.52);
    const n = Math.round(t * QUESTION.length);
    if (n !== typed) {
      typed = n;
      queryText.textContent = QUESTION.slice(0, n);
    }
    if (n === QUESTION.length && !questionPulsed) {
      questionPulsed = true;
      if (world) world.pulse = 0.8;
    } else if (n < QUESTION.length - 3) questionPulsed = false;
  }

  // 06 reading
  {
    const lp = chapterLocal(CH.answer, scroll);
    const t = clamp((lp + 0.32) / 0.6);
    const on = Math.floor(t * (readWords.length + 1));
    readWords.forEach((w, i) => w.classList.toggle('on', i < on));
  }

  // 07 stats
  {
    const lp = chapterLocal(CH.hive, scroll);
    const t = easeInOutCubic(clamp((lp + 0.3) / 0.5));
    for (const s of stats) {
      const v = s.from + (s.to - s.from) * t;
      s.el.textContent = v.toFixed(s.dec) + s.suf;
    }
  }

  // 08 principles: the track is locked to the same coordinate as the shapes
  {
    const base = STOP_INDEX.vault;
    const raw = clamp(p - base, 0, 2);
    const i = Math.min(Math.floor(raw), 1);
    const f = easeInOutCubic(raw - i);
    const pos = i + f;
    track.style.transform = `translate3d(${-pos * vw}px, 0, 0)`;
    panels.forEach((el, k) => {
      const d = Math.abs(pos - k);
      el.style.opacity = String(clamp(1 - d * 1.15));
    });
    dots.forEach((d, k) => d.style.setProperty('--f', String(clamp(1 - Math.abs(pos - k)))));
  }

  // 09 wordmark letters rise with scroll
  {
    const lp = chapterLocal(CH.mark, scroll);
    wordLetters.forEach((el, i) => {
      const t = easeInOutCubic(clamp((lp + 0.55 - i * 0.07) / 0.55));
      el.style.transform = `translate3d(0, ${(1 - t) * 105}%, 0)`;
    });
    const near = Math.abs(p - STOP_INDEX.mark) < 0.02;
    if (near && !markPulsed) {
      markPulsed = true;
      $$('.nav [data-logo]').forEach((l) => shatterLogo(l, 1.2));
      if (world) world.pulse = 0.7;
    } else if (!near && Math.abs(p - STOP_INDEX.mark) > 0.3) markPulsed = false;
  }

  // hud
  {
    const si = Math.round(p);
    const ci = story.chapters.findIndex((c) => si >= c.first && si < c.first + c.count);
    if (ci !== hudChapter && ci >= 0) {
      hudChapter = ci;
      const name = story.chapters[ci].el.dataset.name || '';
      hudNum.textContent = String(ci + 1).padStart(2, '0');
      scramble(hudName, name);
    }
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    hudRail.style.transform = `scaleY(${clamp(scroll / max)})`;
    hud.classList.toggle('is-end', scroll > max - 220);
    hudHint.classList.toggle('is-on', introDone && finePointer && p < 0.25 && !heldOnce);
  }
}

// ---------------------------------------------------------------------------
// pointer: hover repels, press gathers, release flings
// ---------------------------------------------------------------------------
const cursor = $('[data-cursor]');
const cur = { x: -100, y: -100, tx: -100, ty: -100 };
let heldOnce = false;

window.addEventListener('pointermove', (e) => {
  cur.tx = e.clientX;
  cur.ty = e.clientY;
  if (!world) return;
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = -(e.clientY / window.innerHeight) * 2 + 1;
  world.setPointer(nx, ny, e.pointerType === 'mouse' || e.buttons > 0);
});
window.addEventListener('pointerleave', () => world?.setPointer(9, 9, false));
document.addEventListener('mouseleave', () => world?.setPointer(9, 9, false));
window.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse') world?.setPointer(9, 9, false);
});

const isInteractive = (t: EventTarget | null) => t instanceof Element && !!t.closest('a, button, input, label, form');
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || e.button !== 0 || isInteractive(e.target) || !world) return;
  world.press();
  heldOnce = true;
  cursor.classList.add('is-hold');
});
window.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse' || !world) return;
  if (cursor.classList.contains('is-hold')) world.release();
  cursor.classList.remove('is-hold');
});

document.addEventListener('pointerover', (e) => cursor.classList.toggle('is-hover', isInteractive(e.target)));

// magnetic buttons
$$('[data-magnetic]').forEach((el) => {
  if (!finePointer) return;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.6, ease: 'power3.out' });
  });
  el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.45)' }));
});

// ---------------------------------------------------------------------------
// navigation
// ---------------------------------------------------------------------------
const body = document.body;
const burger = $('[data-burger]');
const menu = $('[data-menu]');
const setMenu = (on: boolean) => {
  body.classList.toggle('is-menu', on);
  burger.setAttribute('aria-expanded', String(on));
  menu.setAttribute('aria-hidden', String(!on));
  if (on) {
    lenis.stop();
    gsap.fromTo($$('.menu__links a'), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.06, delay: 0.25 });
  } else lenis.start();
};
burger.addEventListener('click', () => setMenu(!body.classList.contains('is-menu')));

$$<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')!.slice(1);
    e.preventDefault();
    if (body.classList.contains('is-menu')) setMenu(false);
    let y = 0;
    if (id !== 'top') {
      const ci = chapterIndexOf(id);
      if (ci >= 0) y = story.scrollFor(story.chapters[ci].first);
    }
    const dist = Math.abs(y - window.scrollY) / window.innerHeight;
    lenis.scrollTo(y, { duration: clamp(1.2 + dist * 0.12, 1.4, 3.6), easing: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2) });
  });
});

// access form
const form = $<HTMLFormElement>('[data-form]');
const note = $('[data-form-note]');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = form.querySelector('input')!;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
  note.classList.toggle('is-ok', ok);
  note.classList.toggle('is-err', !ok);
  if (ok) {
    scramble(note, "You're on the list. We'll be in touch soon.");
    input.value = '';
    world?.release(4);
    $$('[data-logo]').forEach((l) => shatterLogo(l, 1.4));
  } else {
    scramble(note, 'That does not look like a work email.');
  }
});

// ---------------------------------------------------------------------------
// resize
// ---------------------------------------------------------------------------
let resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = window.setTimeout(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w !== lastW || Math.abs(h - lastH) > 160) {
      setVh();
      lastW = w;
      lastH = h;
    }
    // remember where we are in the story, not the pixel offset
    const y0 = window.scrollY;
    const ci = Math.max(0, story.chapters.findIndex((c) => y0 >= c.top && y0 < c.top + c.height));
    const ch = story.chapters[ci];
    const rel = ch ? (y0 - ch.top) / Math.max(1, ch.height) : 0;
    layout = layoutFor();
    world?.setLayout(layout);
    world?.resize();
    measure();
    const nc = story.chapters[ci];
    if (nc) lenis.scrollTo(nc.top + rel * nc.height, { immediate: true, force: true });
    story.p = story.coord(window.scrollY);
  }, 120);
});

// ---------------------------------------------------------------------------
// loop
// ---------------------------------------------------------------------------
measure();
let clock = 0;
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time, deltaMs) => {
  lenis.raf(time * 1000);
  const dt = Math.min(deltaMs / 1000, 1 / 20);
  clock += dt;
  const scroll = window.scrollY;
  const p = story.update(scroll, dt);

  cur.x += (cur.tx - cur.x) * 0.22;
  cur.y += (cur.ty - cur.y) * 0.22;
  cursor.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;

  if (world) {
    world.apply(story.frame(layout), dt);
    world.render(dt);
  }
  overlays(p, scroll, clock);
});

// ---------------------------------------------------------------------------
// loader -> intro
// ---------------------------------------------------------------------------
const loader = $('[data-loader]');
const countEl = $('[data-count]');
const bar = $('[data-bar]');
body.classList.add('is-loading');

if (world) world.renderer.compile(world.scene, world.camera);

const progress = { v: 0 };
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
const minTime = new Promise((r) => setTimeout(r, reduced ? 200 : 1500));

gsap.to(progress, {
  v: 0.86,
  duration: 1.4,
  ease: 'power2.out',
  onUpdate: () => {
    countEl.textContent = String(Math.round(progress.v * 100)).padStart(3, '0');
    bar.style.transform = `scaleX(${progress.v})`;
  },
});

Promise.all([fontsReady, minTime]).then(() => {
  measure();
  const tl = gsap.timeline();
  tl.to(progress, {
    v: 1,
    duration: 0.5,
    ease: 'power2.inOut',
    onUpdate: () => {
      countEl.textContent = String(Math.round(progress.v * 100)).padStart(3, '0');
      bar.style.transform = `scaleX(${progress.v})`;
    },
  })
    .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'expo.inOut' }, '+=0.1')
    .add(() => {
      if (world) gsap.to(world, { intro: 1, duration: reduced ? 0.3 : 3.2, ease: 'power2.out' });
    }, '-=0.75')
    .add(() => {
      introDone = true;
      showChapter(chaptersUI[0], true);
      body.classList.remove('is-loading');
      lenis.start();
      gsap.fromTo('.nav > *', { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.07 });
      gsap.fromTo('.hud', { opacity: 0 }, { opacity: 1, duration: 1.2 });
    }, '-=0.35')
    .add(() => loader.remove());
});

// keep the loop honest about which stops exist
if (import.meta.env.DEV) (window as unknown as { __story: unknown }).__story = { story, STOPS, lenis };
