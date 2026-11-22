import {
  type BufferGeometry,
  Color,
  DoubleSide,
  Group,
  type IUniform,
  Mesh,
  type Scene,
  ShaderMaterial,
  type Texture,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
} from 'three';
import type { CardHandle } from './cardMesh';
import { HoloMaterial } from './holoMaterial';
import { CARD_HEIGHT, CARD_RADIUS, CARD_WIDTH } from './layout';
import { createShards } from './shards';

/*
 * The shatter subsystem: one pre-fractured shard group per knocked-out card, built lazily the
 * first time that card breaks, and rebuilt whenever the stage has replaced the card
 * (`BattleStage.load()` again: same fighter id, new handle, new textures). The director only
 * animates the shards; this module owns their GPU resources.
 */

const SHARDS_PER_CARD = 24;
const INK = '#07080b';

export type ShardSet = {
  /** The card these shards were cut from — a different handle for the same id means a new battle. */
  handle: CardHandle;
  group: Group;
  meshes: Mesh<BufferGeometry, ShaderMaterial>[];
  /** Resting (unbroken) local positions of each shard. */
  base: Vector3[];
  uniforms: { uOpacity: IUniform<number>; uDim: IUniform<number> };
  material: ShaderMaterial;
  /** Seed for the fall's randomness (stable per fighter id, so replays break identically). */
  seed: number;
};

export const seedOf = (id: string) =>
  [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);

/** Shard sets by fighter id, kept in sync with the stage's current cards. */
export class ShatterCache {
  private readonly sets = new Map<string, ShardSet>();

  constructor(
    private readonly scene: Scene,
    private readonly keyColor: Color,
  ) {}

  /** The shard set for this card, cutting a new one (and freeing a stale one) when needed. */
  get(handle: CardHandle): ShardSet {
    const id = handle.fighter.id;
    const existing = this.sets.get(id);
    if (existing?.handle === handle) return existing;
    if (existing) this.release(existing);
    const set = createShardSet(handle, this.keyColor);
    this.scene.add(set.group);
    this.sets.set(id, set);
    return set;
  }

  /** Hides every set and puts its shards back together (a fresh battle starts clean). */
  resetAll(): void {
    for (const set of this.sets.values()) {
      set.group.visible = false;
      resetShards(set);
    }
  }

  dispose(): void {
    for (const set of this.sets.values()) this.release(set);
    this.sets.clear();
  }

  private release(set: ShardSet): void {
    this.scene.remove(set.group);
    for (const mesh of set.meshes) mesh.geometry.dispose();
    set.material.dispose(); // textures belong to the stage's card; not disposed here
    this.sets.delete(set.handle.fighter.id);
  }
}

/** Shards back in their unbroken places, fully opaque. */
export function resetShards(set: ShardSet): void {
  set.meshes.forEach((mesh, i) => {
    const b = set.base[i];
    if (b) mesh.position.copy(b);
    mesh.rotation.set(0, 0, 0);
  });
  set.uniforms.uOpacity.value = 1;
}

function createShardSet(handle: CardHandle, keyColor: Color): ShardSet {
  const id = handle.fighter.id;
  const faceMaterial = handle.face.material;
  const back = handle.group.getObjectByName('back');
  const backMaterial = back instanceof Mesh ? back.material : null;
  const face = faceMaterial instanceof HoloMaterial ? faceMaterial.uniforms.uMap.value : null;
  const backMap = backMaterial instanceof HoloMaterial ? backMaterial.uniforms.uMap.value : face;
  const { material, uniforms } = createShardMaterial(face, backMap, keyColor);

  const group = new Group();
  group.name = `${id}-shards`;
  group.visible = false;
  const base: Vector3[] = [];
  const meshes = createShards(CARD_WIDTH, CARD_HEIGHT, SHARDS_PER_CARD, seedOf(id)).map(
    (geometry) => {
      const c = geometry.userData.centroid as { x: number; y: number };
      geometry.translate(-c.x, -c.y, 0); // spin about the shard's own centre
      const mesh = new Mesh(geometry, material);
      mesh.position.set(c.x, c.y, 0);
      base.push(new Vector3(c.x, c.y, 0));
      group.add(mesh);
      return mesh;
    },
  );
  return { handle, group, meshes, base, uniforms, material, seed: seedOf(id) };
}

/**
 * Shard surface: the card's face on the front, its back on the reverse (one flat geometry, two
 * textures picked by `gl_FrontFacing`), clipped to the rounded card outline, fading as one.
 */
function createShardMaterial(face: Texture | null, back: Texture | null, keyColor: Color) {
  const uniforms = {
    ...UniformsUtils.clone(UniformsLib.fog),
    uFace: { value: face },
    uBack: { value: back },
    uKey: { value: keyColor }, // the stage's key light colour, by reference
    uDimColor: { value: new Color(INK) },
    uDim: { value: 0 },
    uOpacity: { value: 1 },
    uSize: { value: new Vector2(CARD_WIDTH, CARD_HEIGHT) },
    uRadius: { value: CARD_RADIUS },
  };
  const material = new ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    side: DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uFace;
      uniform sampler2D uBack;
      uniform vec3 uKey;
      uniform vec3 uDimColor;
      uniform float uDim;
      uniform float uOpacity;
      uniform vec2 uSize;
      uniform float uRadius;
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        vec2 p = (vUv - 0.5) * uSize;
        vec2 q = abs(p) - (uSize * 0.5 - uRadius);
        if (length(max(q, 0.0)) - uRadius > 0.0) discard; // rounded card corners
        vec3 albedo = gl_FrontFacing
          ? texture2D(uFace, vUv).rgb
          : texture2D(uBack, vec2(1.0 - vUv.x, vUv.y)).rgb;
        vec3 color = albedo * mix(vec3(1.0), uKey, 0.14) * 0.95;
        color = mix(color, uDimColor, uDim);
        gl_FragColor = vec4(color, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  material.toneMapped = false;
  return { material, uniforms };
}
