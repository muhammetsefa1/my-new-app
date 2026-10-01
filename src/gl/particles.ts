import * as THREE from 'three';
import { buildShapes, TEX_W, type Layout } from './shapes';
import { mulberry32 } from './math';

export const PALETTE_HEX = [
  '#8052ff', // 0 electric iris
  '#a993ff', // 1 lilac
  '#4a2ae0', // 2 deep iris
  '#ffb829', // 3 amber
  '#ff7e3d', // 4 ember
  '#ff6fae', // 5 rose
  '#6fc3ff', // 6 sky
  '#e4ddff', // 7 bone
];
// weights for each particle's "own" colour
const WEIGHTS = [0.27, 0.15, 0.12, 0.14, 0.07, 0.07, 0.11, 0.07];

const vertex = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uShapes;
uniform int uRows;
uniform int uShapeA;
uniform int uShapeB;
uniform float uMix;
uniform float uTime;
uniform float uBurst;
uniform float uIntro;
uniform float uSize;
uniform float uScatter;
uniform vec3 uPalette[8];
uniform vec2 uMouse;
uniform float uMouseForce;
uniform float uAspect;
uniform float uFocus;
uniform float uDof;
uniform float uPulse;
uniform float uSwirl;

attribute float aIndex;
attribute vec4 aRand;
attribute float aColor;

varying vec3 vColor;

const float PI = 3.14159265;

mat3 rotAxis(vec3 axis, float a) {
  float s = sin(a), c = cos(a), oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y + axis.z * s,  oc * axis.z * axis.x - axis.y * s,
    oc * axis.x * axis.y - axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z + axis.x * s,
    oc * axis.z * axis.x + axis.y * s,  oc * axis.y * axis.z - axis.x * s,  oc * axis.z * axis.z + c
  );
}

vec2 rot2(vec2 p, float a) {
  float s = sin(a), c = cos(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec4 shapeAt(int s) {
  int id = int(aIndex + 0.5);
  return texelFetch(uShapes, ivec2(id % ${TEX_W}, s * uRows + id / ${TEX_W}), 0);
}

// Each formation keeps living while it is held.
vec3 animate(vec3 p, int s) {
  float t = uTime;
  float ph = aRand.z * 6.2831;
  if (s == 0) {
    p.xz = rot2(p.xz, sin(t * 0.18) * 0.22);
    p *= 1.0 + 0.012 * sin(t * 1.2);
  } else if (s == 1) {
    p += vec3(sin(t * 0.21 + ph), cos(t * 0.17 + ph * 1.3), sin(t * 0.13 + ph * 0.7)) * 0.12;
  } else if (s == 2) {
    p.y += sin(t * 0.7 + ph) * 0.025;
    p.x += cos(t * 0.5 + ph) * 0.015;
  } else if (s == 3) {
    float r = length(p.xz);
    p.xz = rot2(p.xz, -t * 0.42 / (0.3 + r * 0.9));
    p.y += sin(r * 4.0 - t * 1.4) * 0.03;
  } else if (s == 4) {
    p.xz = rot2(p.xz, sin(t * 0.35) * 0.4);
    p.y += sin(t * 0.9) * 0.03;
  } else if (s == 5) {
    p.y += sin(p.x * 1.25 - t * 1.05) * 0.22;
    p.z += cos(p.x * 0.85 - t * 0.75) * 0.2;
  } else if (s == 6) {
    p.xz = rot2(p.xz, t * 0.09);
  } else if (s == 7) {
    p.xz = rot2(p.xz, t * 0.14);
    p.xy = rot2(p.xy, sin(t * 0.3) * 0.12);
  } else if (s == 8) {
    p.yz = rot2(p.yz, t * 0.45);
  } else if (s == 9) {
    p.xy = rot2(p.xy, t * 0.16);
    p.xz = rot2(p.xz, sin(t * 0.25) * 0.5);
  } else if (s == 10) {
    p.z += sin(t * 0.9 + p.x * 2.0 + p.y) * 0.025;
  }
  return p;
}

vec3 tint(vec3 own, float w) {
  if (w < 0.0) return own;
  return mix(own, uPalette[int(w + 0.5)], 0.82);
}

void main() {
  vec4 A = shapeAt(uShapeA);
  vec4 B = shapeAt(uShapeB);
  vec3 pa = animate(A.xyz, uShapeA);
  vec3 pb = animate(B.xyz, uShapeB);

  // staggered, per-particle morph progress: a sweeping front + noise
  float sweep = clamp(0.5 + pa.x * 0.18 + pa.y * 0.07, 0.0, 1.0);
  float delay = aRand.x * 0.24 + sweep * 0.26;
  float t = clamp((uMix - delay) / 0.5, 0.0, 1.0);
  float e = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5;

  vec3 dir = normalize(aRand.yzw * 2.0 - 1.0 + normalize(pa + pb + vec3(0.0001)) * 0.8);
  vec3 pos = mix(pa, pb, e);
  float fl = sin(PI * e);
  // in flight the fragments are carried around the formation's axis, then released
  pos.xz = rot2(pos.xz, fl * uSwirl * (0.45 + aRand.y * 0.9));
  pos.y += fl * (aRand.z - 0.4) * 0.35 * abs(uSwirl);
  pos += dir * fl * uBurst * (0.3 + aRand.w * 0.8);
  // free-floating jitter (used by loose formations)
  pos += vec3(sin(uTime * 0.6 + aRand.y * 40.0), cos(uTime * 0.5 + aRand.z * 40.0), sin(uTime * 0.4 + aRand.w * 40.0)) * uScatter * aRand.x;

  // intro: everything erupts from a single point
  float ti = clamp((uIntro - aRand.x * 0.45) / 0.55, 0.0, 1.0);
  float ie = 1.0 - pow(1.0 - ti, 4.0);
  pos = mix(aRand.yzw * 0.04 - 0.02, pos, ie);

  vec3 own = uPalette[int(aColor + 0.5)];
  vColor = mix(tint(own, A.w), tint(own, B.w), e);

  // instance rotation + scale
  vec3 axis = normalize(aRand.zwy * 2.0 - 1.0 + 0.0001);
  float ang = uTime * (0.25 + aRand.x * 0.9) + aRand.y * 6.2831;
  mat3 R = rotAxis(axis, ang);
  float scl = uSize * (0.5 + aRand.w * 0.95) * ie * (1.0 + sin(PI * e) * 0.35);
  vec3 local = R * (position * scl);
  vec3 nrm = R * normal;

  mat4 mv = viewMatrix * modelMatrix;
  vec4 vc = mv * vec4(pos, 1.0);

  // cursor: carve a soft hole in the formation
  vec4 clip = projectionMatrix * vc;
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uMouse;
  d.x *= uAspect;
  float dist = length(d);
  float f = smoothstep(0.32, 0.0, dist) * uMouseForce;
  vc.xy += normalize(d + 0.0001) * f * 0.09 * -vc.z;
  vc.z += f * 0.25;

  vec3 lv = normalize(mat3(mv) * local);
  vec3 nv = normalize(mat3(mv) * nrm);
  vc.xyz += mat3(mv) * local;

  gl_Position = projectionMatrix * vc;

  // faceted light
  vec3 L = normalize(vec3(0.35, 0.8, 0.55));
  float lam = max(dot(nv, L), 0.0);
  float back = max(dot(nv, normalize(vec3(-0.6, -0.4, 0.3))), 0.0);
  float shade = 0.16 + lam * 0.78 + back * 0.2;
  shade += pow(lam, 14.0) * 0.4;

  // depth: fog far away, fade particles that brush the lens
  float depth = -vc.z;
  float defocus = smoothstep(0.0, uDof, abs(depth - uFocus));
  shade *= 1.0 - defocus * 0.72;
  shade *= smoothstep(0.25, 1.1, depth);
  shade *= 0.88 + 0.24 * sin(uTime * (1.0 + aRand.y * 2.0) + aRand.x * 30.0) * aRand.w;
  shade *= 1.0 + uPulse * 0.6;

  vColor *= shade;
}
`;

const fragment = /* glsl */ `
precision highp float;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
}
`;

export function pickCount(): number {
  const w = window.innerWidth;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (w < 700) return mem < 4 || cores < 6 ? 6500 : 9000;
  if (mem < 4 || cores < 4) return 10000;
  return 17000;
}

export class Particles {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  texture: THREE.DataTexture;
  count: number;
  layout: Layout;

  constructor(count: number, layout: Layout) {
    this.count = count;
    this.layout = layout;

    const tetra = new THREE.TetrahedronGeometry(1, 0);
    tetra.computeVertexNormals();
    // stretch the shards so they read as fragments, not dice
    tetra.scale(0.75, 1.35, 0.75);

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', tetra.getAttribute('position'));
    geo.setAttribute('normal', tetra.getAttribute('normal'));
    geo.instanceCount = count;

    const idx = new Float32Array(count);
    const rnd = new Float32Array(count * 4);
    const col = new Float32Array(count);
    const r = mulberry32(42);
    const cdf: number[] = [];
    let acc = 0;
    for (const w of WEIGHTS) cdf.push((acc += w));
    for (let i = 0; i < count; i++) {
      idx[i] = i;
      for (let k = 0; k < 4; k++) rnd[i * 4 + k] = r();
      const u = r() * acc;
      let c = 0;
      while (cdf[c] < u) c++;
      col[i] = c;
    }
    geo.setAttribute('aIndex', new THREE.InstancedBufferAttribute(idx, 1));
    geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 4));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 1));

    const { data, rows } = buildShapes(count, layout);
    this.texture = new THREE.DataTexture(data, TEX_W, rows * 11, THREE.RGBAFormat, THREE.FloatType);
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uShapes: { value: this.texture },
        uRows: { value: rows },
        uShapeA: { value: 0 },
        uShapeB: { value: 0 },
        uMix: { value: 0 },
        uTime: { value: 0 },
        uBurst: { value: 0 },
        uIntro: { value: 0 },
        uSize: { value: 0.03 },
        uScatter: { value: 0 },
        uPalette: { value: PALETTE_HEX.map((h) => new THREE.Color(h)) },
        uMouse: { value: new THREE.Vector2(9, 9) },
        uMouseForce: { value: 0 },
        uAspect: { value: 1 },
        uFocus: { value: 5 },
        uDof: { value: 4 },
        uPulse: { value: 0 },
        uSwirl: { value: 0 },
      },
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  rebuild(layout: Layout) {
    if (layout === this.layout) return;
    this.layout = layout;
    const { data } = buildShapes(this.count, layout);
    (this.texture.image.data as Float32Array).set(data);
    this.texture.needsUpdate = true;
  }

  get u() {
    return this.material.uniforms;
  }
}
