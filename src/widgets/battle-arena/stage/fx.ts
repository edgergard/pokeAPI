import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  type IUniform,
  Mesh,
  PlaneGeometry,
  Points,
  type Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { createRng, type MoveType } from '@/entities/battle';
import { gsap } from '@/shared/lib/gsap';
import type { Tier } from '../model/director';

/*
 * Type FX. The 18 types share eight visual families; every family is the same pooled `Points`
 * system whose particles are placed entirely in the vertex shader from a single `uProgress`
 * (0 → 1) and a per-particle random seed — no CPU work per particle, no allocation per hit, and
 * any progress can be rendered exactly, so timelines can be time-scaled or seeked freely.
 *
 * A shot has two phases: travel (attacker → target) up to FX_HIT, then a burst at the target.
 * The director splits them across beats (travel inside `lunge`, burst inside `impact`) by
 * tweening `FxShot.progress`; `FxPool.play` runs both back to back.
 * Each emitter also owns a soft additive light pool on the floor that follows the effect, so
 * every move tints the stage in its type colour for a moment.
 */

export type FxFamily =
  'fire' | 'water' | 'electric' | 'nature' | 'mystic' | 'impact' | 'toxic' | 'air';

const FAMILY_OF: Record<MoveType, FxFamily> = {
  fire: 'fire',
  dragon: 'fire',
  water: 'water',
  ice: 'water',
  electric: 'electric',
  grass: 'nature',
  bug: 'nature',
  psychic: 'mystic',
  fairy: 'mystic',
  ghost: 'mystic',
  fighting: 'impact',
  normal: 'impact',
  rock: 'impact',
  ground: 'impact',
  steel: 'impact',
  typeless: 'impact',
  poison: 'toxic',
  dark: 'toxic',
  flying: 'air',
};

export const fxFamily = (type: MoveType): FxFamily => FAMILY_OF[type] ?? 'impact';

const FAMILY_INDEX: Record<FxFamily, number> = {
  fire: 0,
  water: 1,
  electric: 2,
  nature: 3,
  mystic: 4,
  impact: 5,
  toxic: 6,
  air: 7,
};

/** Progress at which the travel phase reaches the target (the hit). */
export const FX_HIT = 0.62;
/** Seconds for travel and burst at 1×, per tier. */
export const FX_SECONDS: Record<Tier, { travel: number; burst: number }> = {
  full: { travel: 0.36, burst: 0.45 },
  short: { travel: 0.24, burst: 0.3 },
};

const PARTICLES = 128;
const EMITTERS = 3;

const vertexShader = /* glsl */ `
  attribute vec4 aRand;
  uniform vec3 uFrom;
  uniform vec3 uTo;
  uniform vec3 uColor;
  uniform float uProgress;
  uniform float uFamily;
  uniform float uDensity;
  uniform float uSize;
  uniform float uViewport;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vCore;

  const float HIT = ${FX_HIT.toFixed(3)};

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float easeOut(float t) { return 1.0 - pow(1.0 - t, 3.0); }

  void main() {
    vec3 dir = uTo - uFrom;
    float len = max(length(dir), 1e-3);
    vec3 fwd = dir / len;
    vec3 side = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(side, fwd);

    float travel = clamp(uProgress / HIT, 0.0, 1.0);
    float burst = clamp((uProgress - HIT) / (1.0 - HIT), 0.0, 1.0);
    bool isBurst = aRand.w < 0.42;
    float f = uFamily;

    vec3 pos = uTo;
    float alpha = 0.0;
    float size = 1.0;
    float core = 0.0;
    vec3 color = uColor;

    if (!isBurst) {
      // Travel: each particle trails the head by its own lag; the arc lifts mid-flight.
      float lag = aRand.x * 0.55;
      float t = clamp(travel * 1.55 - lag, 0.0, 1.0);
      float alive = step(0.001, t) * step(t, 0.999) * (1.0 - burst);
      float lift = 0.35;
      vec3 offset = vec3(0.0);

      if (f < 0.5) {            // fire — embers that drift upward and cool as they trail
        lift = 0.55;
        offset = (side * (aRand.y - 0.5) + up * (aRand.z - 0.5)) * 0.32 + up * lag * 0.5;
        size = mix(1.9, 0.7, lag / 0.55);
        color = mix(vec3(1.0, 0.92, 0.7), uColor, smoothstep(0.0, 0.35, lag));
        core = 0.6;
      } else if (f < 1.5) {     // water — a rolling ribbon
        lift = 0.3;
        offset = up * sin(t * 11.0 + aRand.y * 6.2832) * 0.22 + side * (aRand.z - 0.5) * 0.5;
        color = mix(uColor, vec3(1.0), 0.35 * aRand.y);
        size = 1.15;
      } else if (f < 2.5) {     // electric — a jagged arc that grows from attacker to target
        lift = 0.12;
        t = aRand.x;
        float head = clamp(travel * 1.3, 0.0, 1.0);
        alive = step(t, head) * (1.0 - burst);
        float epoch = floor(uProgress * 2.0) * 13.1; // re-routes once per shot: far below 3 Hz
        float seg = floor(t * 13.0);
        float fr = fract(t * 13.0);
        float n1 = mix(hash(seg + epoch), hash(seg + 1.0 + epoch), fr);
        float n2 = mix(hash(seg + 31.0 + epoch), hash(seg + 32.0 + epoch), fr);
        float env = sin(3.14159 * t);
        offset = (side * (n1 - 0.5) * 1.1 + up * (n2 - 0.5) * 0.8) * env + (aRand.yzy - 0.5) * 0.04;
        size = 0.55;
        color = mix(uColor, vec3(1.0), 0.45);
        core = 1.0;
      } else if (f < 3.5) {     // nature — leaves on a helix
        lift = 0.5;
        float a = t * 13.0 + aRand.y * 6.2832;
        offset = (side * cos(a) + up * sin(a)) * (0.18 + 0.2 * aRand.z);
        size = 1.0;
        color = mix(uColor, vec3(0.92, 1.0, 0.75), 0.25 * aRand.z);
      } else if (f < 4.5) {     // mystic — rings travelling along the path
        lift = 0.4;
        float ring = floor(aRand.x * 4.0);
        t = clamp(travel * 1.35 - ring * 0.12, 0.0, 1.0);
        alive = step(0.001, t) * step(t, 0.999) * (1.0 - burst);
        float a = aRand.y * 6.2832;
        offset = (side * cos(a) + up * sin(a)) * (0.22 + 0.28 * t);
        size = 0.7;
        color = mix(uColor, vec3(1.0), 0.3);
        core = 0.4;
      } else if (f < 5.5) {     // impact — a tight, accelerating cluster
        lift = 0.1;
        t = clamp(travel * travel * 1.25 - lag * 0.3, 0.0, 1.0);
        alive = step(0.001, t) * step(t, 0.999) * (1.0 - burst);
        offset = (side * (aRand.y - 0.5) + up * (aRand.z - 0.5)) * 0.2;
        size = 1.0;
        color = mix(uColor, vec3(1.0), 0.5);
        core = 0.5;
      } else if (f < 6.5) {     // toxic — slow, wobbling blobs
        lift = 0.7;
        offset = up * sin(t * 9.0 + aRand.y * 20.0) * 0.18 + side * (aRand.z - 0.5) * 0.45;
        size = 2.1 * (0.6 + 0.4 * aRand.z);
        color = uColor * 0.9;
      } else {                  // air — thin streaks spiralling in a gust
        lift = 0.25;
        float a = t * 8.0 + aRand.y * 6.2832;
        offset = (side * cos(a) + up * sin(a)) * (0.5 * (1.0 - t) + 0.12);
        size = 0.6;
        color = mix(uColor, vec3(1.0), 0.55);
      }

      pos = mix(uFrom, uTo, t) + vec3(0.0, sin(3.14159 * t) * lift, 0.0) + offset;
      alpha = alive * 0.85;
    } else {
      // Burst at the target: a family-specific spray, fading out as it expands.
      float b = clamp(burst * (1.0 + aRand.x * 0.25), 0.0, 1.0);
      float e = easeOut(b);
      vec3 rnd = normalize(vec3(aRand.y - 0.5, aRand.z - 0.5, aRand.x - 0.5) + 1e-4);
      float a = aRand.y * 6.2832;
      vec3 ring = side * cos(a) + up * sin(a);
      vec3 offset;

      if (f < 0.5) {            // fire — flare outward, embers rise
        offset = rnd * 1.3 * e + vec3(0.0, 0.7 * b, 0.0);
        size = 1.6 * (1.0 - 0.6 * b);
        color = mix(vec3(1.0, 0.9, 0.65), uColor, b);
        core = 0.5;
      } else if (f < 1.5) {     // water — a splash of droplets that fall back
        offset = vec3(rnd.x * 1.1, abs(rnd.y) * 1.6, rnd.z * 0.6) * e - vec3(0.0, 2.2 * b * b, 0.0);
        size = 0.9;
        color = mix(uColor, vec3(1.0), 0.4);
      } else if (f < 2.5) {     // electric — fast radial sparks
        offset = rnd * 1.6 * e;
        size = 0.5;
        color = mix(uColor, vec3(1.0), 0.5);
        core = 1.0;
      } else if (f < 3.5) {     // nature — petals drifting out and down
        offset = rnd * 1.0 * e - vec3(0.0, 0.5 * b, 0.0) + side * sin(b * 6.0 + aRand.z * 6.0) * 0.12;
        size = 1.0;
      } else if (f < 4.5) {     // mystic — an expanding ring
        offset = ring * (0.25 + 1.3 * e);
        size = 0.75;
        color = mix(uColor, vec3(1.0), 0.3);
        core = 0.4;
      } else if (f < 5.5) {     // impact — shockwave ring plus dust
        offset = aRand.z < 0.6 ? ring * (0.2 + 1.7 * e) : rnd * 0.8 * e;
        size = aRand.z < 0.6 ? 0.8 : 1.3;
        color = mix(uColor, vec3(1.0), 0.45);
        core = 0.4;
      } else if (f < 6.5) {     // toxic — bubbles rising and thinning out
        offset = rnd * 0.6 * e + vec3(0.0, 1.1 * b, 0.0) + side * sin(b * 8.0 + aRand.z * 9.0) * 0.1;
        size = 1.6 * (0.5 + aRand.z) * (1.0 - 0.4 * b);
        color = uColor * 0.95;
      } else {                  // air — a swirl
        float sa = a + b * 3.5;
        offset = (side * cos(sa) + up * sin(sa)) * (0.35 + 0.9 * e);
        size = 0.6;
        color = mix(uColor, vec3(1.0), 0.5);
      }

      pos = uTo + offset;
      alpha = step(0.001, burst) * pow(1.0 - b, 1.5) * 0.9;
    }

    // Short tier: fewer particles (the rest collapse to nothing).
    float keep = step(fract(aRand.x * 7.13 + aRand.y * 3.71), uDensity);
    alpha *= keep;

    vec4 mv = viewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = uSize * size * (0.7 + 0.6 * aRand.z) * projectionMatrix[1][1] * 0.5 * uViewport / max(-mv.z, 0.1);
    gl_PointSize = alpha > 0.0 ? clamp(px, 0.0, 96.0) : 0.0;
    vColor = color;
    vAlpha = alpha;
    vCore = core;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vCore;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float disc = 1.0 - smoothstep(0.0, 1.0, d);
    float hot = 1.0 - smoothstep(0.0, 0.4, d);
    vec3 color = mix(vColor, vec3(1.0), hot * vCore * 0.7);
    gl_FragColor = vec4(color * disc * disc * vAlpha, 1.0);
  }
`;

const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float g = 1.0 - smoothstep(0.0, 1.0, d);
    gl_FragColor = vec4(uColor * g * g * uStrength, 1.0);
  }
`;

type FxUniforms = {
  uFrom: IUniform<Vector3>;
  uTo: IUniform<Vector3>;
  uColor: IUniform<Color>;
  uProgress: IUniform<number>;
  uFamily: IUniform<number>;
  uDensity: IUniform<number>;
  uSize: IUniform<number>;
  uViewport: IUniform<number>;
};

type Emitter = {
  points: Points<BufferGeometry, ShaderMaterial>;
  uniforms: FxUniforms;
  glow: Mesh<PlaneGeometry, ShaderMaterial>;
  glowUniforms: { uColor: IUniform<Color>; uStrength: IUniform<number> };
  owner: FxShot | null;
};

/**
 * One effect between two points. Tween `progress` (0 → FX_HIT travel, FX_HIT → 1 burst); the
 * shot borrows an emitter from the pool the moment progress leaves 0 and returns it at 1 (or
 * back at 0). `from`/`to` are read when it starts, so a director can fill them in at play time.
 */
export class FxShot {
  private value = 0;
  private emitter: Emitter | null = null;

  constructor(
    private readonly pool: FxPool,
    readonly family: FxFamily,
    readonly from: Vector3,
    readonly to: Vector3,
    readonly color: string,
    readonly tier: Tier,
  ) {}

  get progress(): number {
    return this.value;
  }

  set progress(p: number) {
    this.value = p;
    if (p <= 0 || p >= 1) {
      if (this.emitter) this.pool.release(this.emitter, this);
      this.emitter = null;
      return;
    }
    this.emitter ??= this.pool.acquire(this);
    if (this.emitter) this.pool.render(this.emitter, this, p);
  }

  /** Called by the pool when it hands this shot's emitter to a newer shot. */
  evict(): void {
    this.emitter = null;
  }
}

export class FxPool {
  private readonly scene: Scene;
  private readonly emitters: Emitter[] = [];
  private readonly geometry: BufferGeometry;
  private readonly glowGeometry: PlaneGeometry;
  private readonly drawingBuffer = new Vector2();
  private next = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.geometry = createParticleGeometry();
    this.glowGeometry = new PlaneGeometry(1, 1);
    this.glowGeometry.rotateX(-Math.PI / 2);

    for (let i = 0; i < EMITTERS; i++) {
      const uniforms: FxUniforms = {
        uFrom: { value: new Vector3() },
        uTo: { value: new Vector3() },
        uColor: { value: new Color() },
        uProgress: { value: 0 },
        uFamily: { value: 0 },
        uDensity: { value: 1 },
        uSize: { value: 0.2 },
        uViewport: { value: 800 },
      };
      const material = new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      material.toneMapped = false;
      const points = new Points(this.geometry, material);
      points.name = `fx-${i}`;
      points.frustumCulled = false; // positions come from the shader
      points.visible = false;
      points.renderOrder = 5;
      points.onBeforeRender = (renderer: WebGLRenderer) => {
        uniforms.uViewport.value = renderer.getDrawingBufferSize(this.drawingBuffer).y;
      };

      const glowUniforms = { uColor: { value: new Color() }, uStrength: { value: 0 } };
      const glowMaterial = new ShaderMaterial({
        uniforms: glowUniforms,
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      glowMaterial.toneMapped = false;
      const glow = new Mesh(this.glowGeometry, glowMaterial);
      glow.name = `fx-glow-${i}`;
      glow.visible = false;
      glow.renderOrder = -1;

      this.emitters.push({ points, uniforms, glow, glowUniforms, owner: null });
      scene.add(points, glow);
    }
  }

  /** A shot to drive yourself (see FxShot). Allocates only this small handle, no GPU objects. */
  shot(family: FxFamily, from: Vector3, to: Vector3, color: string, tier: Tier): FxShot {
    return new FxShot(this, family, from, to, color, tier);
  }

  /** Travel then burst, back to back. */
  play(
    family: FxFamily,
    from: Vector3,
    to: Vector3,
    color: string,
    tier: Tier,
  ): gsap.core.Timeline {
    const shot = this.shot(family, from, to, color, tier);
    const { travel, burst } = FX_SECONDS[tier];
    return gsap
      .timeline()
      .to(shot, { progress: FX_HIT, duration: travel, ease: 'none' })
      .to(shot, { progress: 1, duration: burst, ease: 'none' });
  }

  /** Hides every effect (a fresh battle / replay starts clean). */
  reset(): void {
    for (const e of this.emitters) {
      e.owner?.evict();
      e.owner = null;
      e.points.visible = false;
      e.glow.visible = false;
    }
  }

  dispose(): void {
    for (const e of this.emitters) {
      this.scene.remove(e.points, e.glow);
      e.points.material.dispose();
      e.glow.material.dispose();
    }
    this.emitters.length = 0;
    this.geometry.dispose();
    this.glowGeometry.dispose();
  }

  /** @internal Null once disposed: a timeline still running after unmount just draws nothing. */
  acquire(shot: FxShot): Emitter | null {
    const free = this.emitters.find((e) => e.owner === null);
    const emitter = free ?? this.emitters[this.next++ % this.emitters.length];
    if (!emitter) return null;
    emitter.owner?.evict();
    emitter.owner = shot;
    const u = emitter.uniforms;
    u.uFrom.value.copy(shot.from);
    u.uTo.value.copy(shot.to);
    u.uColor.value.set(shot.color);
    u.uFamily.value = FAMILY_INDEX[shot.family];
    u.uDensity.value = shot.tier === 'short' ? 0.55 : 1;
    u.uSize.value = shot.tier === 'short' ? 0.16 : 0.2;
    emitter.glowUniforms.uColor.value.set(shot.color);
    emitter.points.visible = true;
    emitter.glow.visible = true;
    return emitter;
  }

  /** @internal */
  release(emitter: Emitter, shot: FxShot): void {
    if (emitter.owner !== shot) return;
    emitter.owner = null;
    emitter.points.visible = false;
    emitter.glow.visible = false;
    emitter.uniforms.uProgress.value = 0;
  }

  /** @internal Applies progress: one uniform, plus the floor glow following the effect's head. */
  render(emitter: Emitter, shot: FxShot, p: number): void {
    if (emitter.owner !== shot) return;
    emitter.uniforms.uProgress.value = p;
    const { uFrom, uTo } = emitter.uniforms;
    const travel = Math.min(1, p / FX_HIT);
    const burst = Math.max(0, (p - FX_HIT) / (1 - FX_HIT));
    const head = Math.min(1, travel * 1.2);
    emitter.glow.position.set(
      uFrom.value.x + (uTo.value.x - uFrom.value.x) * head,
      0.015,
      uFrom.value.z + (uTo.value.z - uFrom.value.z) * head,
    );
    const scale = 3.2 + burst * 1.6;
    emitter.glow.scale.set(scale, 1, scale);
    const rise = Math.min(1, travel * 2.5);
    emitter.glowUniforms.uStrength.value =
      burst > 0 ? 0.5 * (1 - burst) ** 1.4 : 0.22 + 0.28 * rise * travel;
  }
}

/** Static per-particle seeds; positions are computed in the shader. */
function createParticleGeometry(): BufferGeometry {
  const rand = createRng(0x5eed);
  const seeds = new Float32Array(PARTICLES * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(PARTICLES * 3), 3));
  geometry.setAttribute('aRand', new Float32BufferAttribute(seeds, 4));
  return geometry;
}
