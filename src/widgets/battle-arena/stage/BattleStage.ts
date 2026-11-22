import {
  CircleGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  type IUniform,
  type Material,
  Mesh,
  NeutralToneMapping,
  type Object3D,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  UniformsLib,
  UniformsUtils,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { BattleTeam, Fighter, Side } from '@/entities/battle';
import { typeColor } from '@/entities/pokemon';
import { CameraRig } from './cameraRig';
import {
  type CardGeometries,
  type CardHandle,
  type CardParts,
  createCard,
  createCardGeometries,
} from './cardMesh';
import {
  ensureFonts,
  loadImage,
  paintCardBack,
  paintCardFace,
  paintContactShadow,
  resolveArtwork,
  SIDE_COLOR,
  toTexture,
} from './cardTexture';
import { createHoloShared, type HoloShared } from './holoMaterial';
import { CARD_HEIGHT, CARD_HOVER, type SlotRole, slotPosition, slotYaw } from './layout';

export type { CardHandle } from './cardMesh';
export type { ShotName, Shot } from './cameraRig';
export { CameraRig } from './cameraRig';
export type { SlotRole } from './layout';

/** Trainer Studio ink-950: page background, fog and the floor's far edge all match it. */
const INK_950 = '#07080b';
const INK_800 = '#1b1f2a';
const KEY_NEUTRAL = new Color('#fff3e0');

/** The key light's colour for a given tint: neutral warm white blended towards `color`. */
export function keyTintColor(color: string, amount: number, out: Color): Color {
  return out.copy(KEY_NEUTRAL).lerp(_tint.set(color), Math.min(1, Math.max(0, amount)));
}
const _tint = new Color();

export type StageLights = {
  /** Warm key from front-right; the director tints it towards the active fighter's type. */
  key: DirectionalLight;
  /** Coral rim from behind Red's corner. */
  rimRed: DirectionalLight;
  /** Azure rim from behind Blue's corner. */
  rimBlue: DirectionalLight;
  fill: HemisphereLight;
};

type CardEntry = CardParts & { role: SlotRole | null; faceDown: boolean };

/**
 * The arena's three.js stage: renderer, scene, lights, floor, eight 3D cards and the camera rig.
 * It owns the render loop and every GPU resource; it does not choreograph anything — the
 * director (Task 9) moves `card(id).group`, tweens `camera.position/target`, tints lights.
 */
export class BattleStage {
  readonly scene = new Scene();
  readonly camera: CameraRig;
  readonly lights: StageLights;
  /** Called when the browser drops the WebGL context (GPU reset, too many contexts, …). */
  onContextLost?: () => void;
  /** Called when the browser gives the WebGL context back; rendering has already resumed. */
  onContextRestored?: () => void;

  private readonly renderer: WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly reducedMotion: boolean;
  private readonly shared: HoloShared = createHoloShared();
  private readonly fog = new Fog(INK_950, 20, 50);
  private readonly floor: Mesh<CircleGeometry, ShaderMaterial>;
  private readonly floorRadius: IUniform<number> = { value: 18 };
  private readonly cards = new Map<string, CardEntry>();
  /** Textures created by the stage (faces, backs, shadow) — disposed explicitly. */
  private readonly textures = new Set<Texture>();
  private geometries: CardGeometries | null = null;
  private aspect = 16 / 9;
  private running = false;
  private contextLost = false;
  private disposed = false;
  private lastNow: number | null = null;
  private elapsed = 0;
  private loadToken = 0;

  /** Probes for WebGL2 (three r163+ requires it) without keeping a context alive. */
  static isSupported(): boolean {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return false;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    } catch {
      return false;
    }
  }

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
    this.canvas = canvas;
    this.reducedMotion = opts.reducedMotion;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    // Neutral keeps base colours (the cards' type palette) faithful while taming highlights.
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setClearColor(INK_950, 1);

    this.scene.background = new Color(INK_950);
    this.scene.fog = this.fog;

    this.lights = this.createLights();
    this.floor = this.createFloor();
    this.scene.add(this.floor);

    const width = canvas.clientWidth || canvas.width || 1;
    const height = canvas.clientHeight || canvas.height || 1;
    this.camera = new CameraRig(width / height, { reducedMotion: this.reducedMotion });
    this.resize(width, height);

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  // ------------------------------------------------------------------------------------------
  // Content

  /**
   * Paints and builds all cards. Artwork and fonts load in parallel; a failed image gives that
   * card its placeholder face. Calling `load` again replaces the previous cards. Safe to dispose
   * the stage while this is pending.
   */
  async load(red: BattleTeam, blue: BattleTeam): Promise<void> {
    const token = ++this.loadToken;
    const fighters = [...red.fighters, ...blue.fighters];
    const [images] = await Promise.all([
      Promise.all(fighters.map((f) => resolveArtwork(f.artwork, loadImage))),
      ensureFonts(),
    ]);
    if (this.disposed || token !== this.loadToken) return;

    this.clearCards();
    const geometries = (this.geometries ??= createCardGeometries());
    const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const backs: Record<Side, Texture> = {
      red: this.track(toTexture(paintCardBack('red'), anisotropy)),
      blue: this.track(toTexture(paintCardBack('blue'), anisotropy)),
    };
    const shadow = this.track(toTexture(paintContactShadow(), 1));

    fighters.forEach((fighter, i) => {
      const face = this.track(toTexture(paintCardFace(fighter, images[i] ?? null), anisotropy));
      const parts = createCard(
        fighter,
        geometries,
        { face, back: backs[fighter.side], shadow },
        SIDE_COLOR[fighter.side],
        this.shared,
      );
      const entry: CardEntry = { ...parts, role: defaultRole(fighter), faceDown: false };
      this.cards.set(fighter.id, entry);
      this.scene.add(parts.handle.group, parts.shadow);
      this.place(entry);
    });

    const leadType = red.fighters[0]?.types[0];
    this.setKeyTint(typeColor(leadType), leadType ? 0.3 : 0);
  }

  /** Every loaded fighter, Red's team then Blue's, each in slot order. */
  get fighters(): Fighter[] {
    return [...this.cards.values()].map((entry) => entry.handle.fighter);
  }

  /** The director's handle on one card. Throws for unknown ids (a director bug, not a user state). */
  card(fighterId: string): CardHandle {
    const entry = this.cards.get(fighterId);
    if (!entry) throw new Error(`BattleStage: no card for fighter "${fighterId}"`);
    return entry.handle;
  }

  /**
   * Records where a card belongs (`null` = off the board, e.g. after a KO, or in flight) and
   * whether it rests face-down (turned half a turn). The stage snaps cards to their role on
   * resize; the director tweens to `home()` when it moves one.
   */
  setRole(fighterId: string, role: SlotRole | null, faceDown = false): void {
    const entry = this.cards.get(fighterId);
    if (!entry) return;
    entry.role = role;
    entry.faceDown = faceDown;
  }

  /** Resting transform for a card's current role at the current aspect. */
  home(fighterId: string): { position: Vector3; rotationY: number } | null {
    const entry = this.cards.get(fighterId);
    if (!entry?.role) return null;
    return {
      position: this.slot(entry, entry.role),
      rotationY: this.restYaw(entry, entry.role, entry.faceDown),
    };
  }

  /** Where a card would rest in `role` (whatever its current role), at the current aspect. */
  slotFor(
    fighterId: string,
    role: SlotRole,
    faceDown = false,
  ): { position: Vector3; rotationY: number } | null {
    const entry = this.cards.get(fighterId);
    if (!entry) return null;
    return { position: this.slot(entry, role), rotationY: this.restYaw(entry, role, faceDown) };
  }

  /** The stage-owned idle-float pivot inside a card's group. Its x/z offset and x/y rotation are free for shakes. */
  pivot(fighterId: string): Object3D {
    const entry = this.cards.get(fighterId);
    if (!entry) throw new Error(`BattleStage: no card for fighter "${fighterId}"`);
    return entry.pivot;
  }

  /** Current aspect ratio (width / height) of the canvas. */
  get aspectRatio(): number {
    return this.aspect;
  }

  /** Tints the key light (and the cards' print lighting) from neutral towards `color`. No allocation. */
  setKeyTint(color: string, amount: number): void {
    keyTintColor(color, amount, this.lights.key.color);
  }

  // ------------------------------------------------------------------------------------------
  // Lifecycle

  /** CSS size of the canvas, in pixels. Re-reads the DPR so monitor changes stay sharp. */
  resize(width: number, height: number): void {
    if (this.disposed || width <= 0 || height <= 0) return;
    this.aspect = width / height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.camera.setAspect(this.aspect);

    const wide = this.camera.wideDistance;
    this.fog.near = wide * 0.9;
    this.fog.far = wide * 2.3;
    this.floorRadius.value = wide * 1.2;

    for (const entry of this.cards.values()) this.place(entry);
  }

  /**
   * Compiles every shader in the scene up front — including the hidden FX emitters, floor glows
   * and shard sets, which would otherwise compile on the first effect or KO and stall that beat.
   * Call it once the director has added its objects (and built its timeline). Hidden objects are
   * shown only for the synchronous part of the compile, so no frame ever renders them. Never
   * rejects: a failure just leaves compilation to the first render, as before.
   */
  async prewarm(): Promise<void> {
    if (this.disposed || this.contextLost) return;
    const hidden: Object3D[] = [];
    this.scene.traverse((obj) => {
      if (!obj.visible) hidden.push(obj);
    });
    let pending: Promise<unknown>;
    try {
      for (const obj of hidden) obj.visible = true;
      pending = this.renderer.compileAsync(this.scene, this.camera.camera);
    } catch {
      return;
    } finally {
      for (const obj of hidden) obj.visible = false;
    }
    await pending.catch(() => undefined);
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.syncLoop();
  }

  stop(): void {
    this.running = false;
    this.syncLoop();
  }

  /** Releases every GPU resource and listener. The stage is unusable afterwards. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    document.removeEventListener('visibilitychange', this.handleVisibility);

    this.scene.traverse(disposeObject);
    this.scene.clear();
    for (const texture of this.textures) texture.dispose();
    this.textures.clear();
    this.cards.clear();
    this.geometries = null;

    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    // Free the context now rather than at GC: remounting the arena would otherwise stack
    // contexts until the browser starts evicting them. (After dispose(), so three's own
    // "context lost" handler is already detached and nothing is logged.)
    this.renderer.forceContextLoss();
    this.onContextLost = undefined;
    this.onContextRestored = undefined;
  }

  // ------------------------------------------------------------------------------------------
  // Internals

  private track<T extends Texture>(texture: T): T {
    this.textures.add(texture);
    return texture;
  }

  private slot(entry: CardEntry, role: SlotRole): Vector3 {
    return slotPosition(entry.handle.fighter.side, role, this.aspect);
  }

  /** Face-down cards turn half a turn towards the centre line, so the two sides mirror. */
  private restYaw(entry: CardEntry, role: SlotRole, faceDown: boolean): number {
    const { side } = entry.handle.fighter;
    return slotYaw(side, role) + (faceDown ? (side === 'red' ? Math.PI : -Math.PI) : 0);
  }

  private place(entry: CardEntry): void {
    if (!entry.role) return;
    entry.handle.group.position.copy(this.slot(entry, entry.role));
    entry.handle.group.rotation.set(0, this.restYaw(entry, entry.role, entry.faceDown), 0);
  }

  private clearCards(): void {
    for (const { handle, shadow } of this.cards.values()) {
      handle.group.traverse((obj) => {
        if (obj instanceof Mesh) disposeMaterial(obj.material); // geometries are shared, kept
      });
      shadow.material.dispose();
      this.scene.remove(handle.group, shadow);
    }
    this.cards.clear();
    for (const texture of this.textures) texture.dispose();
    this.textures.clear();
  }

  private createLights(): StageLights {
    const fill = new HemisphereLight('#cdd2de', INK_950, 0.55);
    const key = new DirectionalLight(KEY_NEUTRAL, 1.7);
    key.position.set(5, 9, 8);
    const rimRed = new DirectionalLight(SIDE_COLOR.red, 1.3);
    rimRed.position.set(-9, 5, -7);
    const rimBlue = new DirectionalLight(SIDE_COLOR.blue, 1.3);
    rimBlue.position.set(9, 5, -7);
    // Directional lights aim at their target (origin by default) — no need to add targets.
    this.scene.add(fill, key, rimRed, rimBlue);
    return { key, rimRed, rimBlue, fill };
  }

  /**
   * Dark stage floor: a radial ink gradient that melts into the fog, faint side washes in the
   * corner colours, a pool of the key light's tint at centre, and the 2D site's dot grid
   * engraved into it, anti-aliased with screen-space derivatives.
   */
  private createFloor(): Mesh<CircleGeometry, ShaderMaterial> {
    const geometry = new CircleGeometry(80, 64);
    geometry.rotateX(-Math.PI / 2);
    const material = new ShaderMaterial({
      fog: true,
      uniforms: {
        ...UniformsUtils.clone(UniformsLib.fog),
        uKeyColor: this.shared.uKeyColor,
        uCenter: { value: new Color(INK_800) },
        uEdge: { value: new Color(INK_950) },
        uRed: { value: new Color(SIDE_COLOR.red) },
        uBlue: { value: new Color(SIDE_COLOR.blue) },
        uRadius: this.floorRadius,
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        #include <common>
        #include <fog_pars_vertex>
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uKeyColor;
        uniform vec3 uCenter;
        uniform vec3 uEdge;
        uniform vec3 uRed;
        uniform vec3 uBlue;
        uniform float uRadius;
        varying vec3 vWorldPos;
        #include <common>
        #include <fog_pars_fragment>

        float pool(vec2 p, vec2 c, float falloff) { vec2 d = p - c; return exp(-dot(d, d) * falloff); }

        void main() {
          vec2 p = vWorldPos.xz;
          float r = length(p * vec2(0.75, 1.0)) / uRadius;
          vec3 color = mix(uCenter, uEdge, smoothstep(0.0, 1.0, r));

          color += uRed * 0.05 * pool(p, vec2(-4.5, -2.5), 0.045);
          color += uBlue * 0.05 * pool(p, vec2(4.5, -2.5), 0.045);
          color += uKeyColor * 0.035 * pool(p, vec2(0.0, 0.5), 0.07);

          vec2 cell = fract(p / 0.55) - 0.5;
          float d = length(cell);
          float aa = fwidth(d);
          float dots = 1.0 - smoothstep(0.04 - aa, 0.04 + aa, d);
          // Fade out where dots would shrink below a pixel and shimmer.
          float near = 1.0 - smoothstep(0.15, 0.6, r);
          color += dots * 0.03 * near * (1.0 - smoothstep(0.05, 0.25, aa));

          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });
    // Exact ink values, so the floor's far edge matches the fog/background with no seam.
    material.toneMapped = false;
    const floor = new Mesh(geometry, material);
    floor.name = 'floor';
    floor.renderOrder = -2;
    return floor;
  }

  /** Runs the loop only while started, visible and with a live context. */
  private syncLoop(): void {
    const shouldRun = this.running && !this.disposed && !this.contextLost && !document.hidden;
    if (shouldRun) {
      this.lastNow = null; // no time jump after a pause
      this.renderer.setAnimationLoop(this.frame);
    } else {
      this.renderer.setAnimationLoop(null);
    }
  }

  private readonly frame = (now: number): void => {
    const dt = this.lastNow === null ? 0 : Math.min((now - this.lastNow) / 1000, 0.1);
    this.lastNow = now;
    this.elapsed += dt;
    this.update(this.elapsed);
    this.renderer.render(this.scene, this.camera.camera);
  };

  private readonly keyDir = new Vector3();

  private update(time: number): void {
    const { key } = this.lights;
    this.shared.uKeyColor.value.copy(key.color);
    this.shared.uKeyDir.value.copy(
      this.keyDir.subVectors(key.position, key.target.position).normalize(),
    );
    // Reduced motion: no ambient drift — the foil still answers to card and camera angles.
    if (!this.reducedMotion) this.shared.uTime.value = time;
    this.camera.update(time);

    for (const { handle, pivot, shadow } of this.cards.values()) {
      const { group } = handle;
      if (!this.reducedMotion) {
        const phase = handle.fighter.slot * 1.7 + (handle.fighter.side === 'red' ? 0 : 0.9);
        pivot.position.y = Math.sin(time * 0.9 + phase) * 0.05;
        pivot.rotation.z = Math.sin(time * 0.6 + phase) * 0.006;
      }
      // Contact shadow follows the card on the floor, softer and wider as it lifts.
      const lift = Math.max(
        0,
        group.position.y - (CARD_HEIGHT / 2 + CARD_HOVER) + pivot.position.y,
      );
      shadow.visible = group.visible;
      shadow.position.set(group.position.x, 0.004, group.position.z);
      shadow.rotation.y = group.rotation.y;
      shadow.scale.setScalar(group.scale.x * (1 + lift * 0.12));
      shadow.material.opacity = 0.75 * Math.max(0, 1 - lift / 4);
    }
  }

  private readonly handleVisibility = (): void => this.syncLoop();

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault(); // allow the browser to restore it
    this.contextLost = true;
    this.syncLoop();
    this.onContextLost?.();
  };

  private readonly handleContextRestored = (): void => {
    // three re-initialises its GL state; textures re-upload from their canvases on next use.
    this.contextLost = false;
    this.syncLoop();
    this.onContextRestored?.();
  };
}

function defaultRole(fighter: Fighter): SlotRole {
  return fighter.slot === 0 ? 'active' : { bench: fighter.slot - 1 };
}

function disposeMaterial(material: Material | Material[]): void {
  for (const m of Array.isArray(material) ? material : [material]) {
    // Textures referenced by uniforms/maps that the stage didn't create would leak otherwise.
    if (m instanceof ShaderMaterial) {
      for (const uniform of Object.values(m.uniforms)) {
        const value: unknown = uniform.value;
        if (value && typeof value === 'object' && 'isTexture' in value)
          (value as Texture).dispose();
      }
    } else {
      for (const value of Object.values(m)) {
        if (value && typeof value === 'object' && 'isTexture' in value)
          (value as Texture).dispose();
      }
    }
    m.dispose();
  }
}

function disposeObject(obj: Object3D): void {
  if (obj instanceof Mesh || obj instanceof Points) {
    obj.geometry.dispose();
    disposeMaterial(obj.material);
  }
}
