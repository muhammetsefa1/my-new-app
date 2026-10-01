import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Particles, pickCount } from './particles';
import type { Layout } from './shapes';

export type Vec3 = [number, number, number];

export interface FrameState {
  shapeA: number;
  shapeB: number;
  mix: number;
  burst: number;
  swirl: number;
  size: number;
  scatter: number;
  pos: Vec3;
  rot: Vec3;
  scale: number;
  cam: Vec3;
  look: Vec3;
  focus: number;
  dof: number;
  mouse: number;
  bloom: number;
}

const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.06 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      float vig = smoothstep(0.95, 0.25, length(q * vec2(1.0, 1.15)));
      c.rgb *= mix(0.55, 1.0, vig);
      float g = hash(vUv * 1000.0 + fract(uTime * 7.0) * 100.0) - 0.5;
      float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += g * uGrain * (0.25 + lum);
      gl_FragColor = c;
    }
  `,
};

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  particles: Particles;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grain: ShaderPass;
  mouse = new THREE.Vector2(9, 9);
  mouseTarget = new THREE.Vector2(9, 9);
  mouseForce = 0;
  parallax = new THREE.Vector2();
  look = new THREE.Vector3();
  intro = 0;
  pulse = 0;
  time = 0;
  layout: Layout;
  private lowPower: boolean;

  constructor(canvas: HTMLCanvasElement, layout: Layout) {
    this.layout = layout;
    this.lowPower = window.innerWidth < 700;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowPower ? 1.75 : 1.5));

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 60);
    this.camera.position.set(0, 0, 5.2);

    this.particles = new Particles(pickCount(), layout);
    this.scene.add(this.particles.mesh);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.4, 0.4, 0.5);
    this.composer.addPass(this.bloom);
    // the smallest devices skip bloom entirely
    if (this.particles.count < 8000) this.bloom.enabled = false;
    this.composer.addPass(new OutputPass());
    this.grain = new ShaderPass(GrainShader);
    this.composer.addPass(this.grain);

    this.resize();
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    // bloom at reduced resolution keeps the fill-rate sane
    this.bloom.resolution.set(w * 0.5, h * 0.5);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.particles.u.uAspect.value = w / h;
  }

  setLayout(layout: Layout) {
    if (layout === this.layout) return;
    this.layout = layout;
    this.particles.rebuild(layout);
  }

  private holding = false;

  setPointer(nx: number, ny: number, active: boolean) {
    this.mouseTarget.set(nx, ny);
    this.mouseForce = active ? 1 : 0;
  }

  /** press and hold: the formation is drawn towards the cursor */
  press() {
    this.holding = true;
  }

  /** release: everything gathered is flung back out */
  release(strength = 3.2) {
    if (!this.holding && strength <= 0) return;
    this.holding = false;
    this.particles.u.uMouseForce.value = strength;
    this.pulse = 1;
  }

  apply(s: FrameState, dt: number) {
    const u = this.particles.u;
    const m = this.particles.mesh;
    u.uShapeA.value = s.shapeA;
    u.uShapeB.value = s.shapeB;
    u.uMix.value = s.mix;
    u.uBurst.value = s.burst;
    u.uSwirl.value = s.swirl;
    u.uSize.value = s.size;
    u.uScatter.value = s.scatter;
    u.uFocus.value = s.focus;
    u.uDof.value = s.dof;

    m.position.set(s.pos[0], s.pos[1], s.pos[2]);
    m.rotation.set(s.rot[0] + this.parallax.y * 0.08, s.rot[1] + this.parallax.x * 0.14, s.rot[2]);
    m.scale.setScalar(s.scale);

    const k = 1 - Math.exp(-dt * 5);
    this.mouse.lerp(this.mouseTarget, 1 - Math.exp(-dt * 12));
    this.parallax.lerp(this.mouseTarget.x > 5 ? new THREE.Vector2() : this.mouseTarget, k * 0.4);
    u.uMouse.value.copy(this.mouse);
    const targetForce = this.holding ? -1.6 : this.mouseForce * s.mouse;
    u.uMouseForce.value += (targetForce - u.uMouseForce.value) * (this.holding ? k * 0.35 : k * 0.6);

    this.camera.position.set(s.cam[0] + this.parallax.x * 0.12, s.cam[1] + this.parallax.y * 0.08, s.cam[2]);
    this.look.set(s.look[0], s.look[1], s.look[2]);
    this.camera.lookAt(this.look);

    this.bloom.strength = s.bloom;
  }

  render(dt: number) {
    this.time += dt;
    const u = this.particles.u;
    u.uTime.value = this.time;
    u.uIntro.value = this.intro;
    this.pulse *= Math.exp(-dt * 3);
    u.uPulse.value = this.pulse;
    this.grain.uniforms.uTime.value = this.time;
    this.composer.render(dt);
  }

  /** world -> screen pixels for a point given in the particle mesh's local space */
  project(local: THREE.Vector3, out: { x: number; y: number; z: number }) {
    const v = local.clone().applyMatrix4(this.particles.mesh.matrixWorld).project(this.camera);
    const c = this.renderer.domElement;
    out.x = (v.x * 0.5 + 0.5) * c.clientWidth;
    out.y = (-v.y * 0.5 + 0.5) * c.clientHeight;
    out.z = v.z;
    return out;
  }
}
