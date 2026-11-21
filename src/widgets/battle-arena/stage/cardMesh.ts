import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  type Texture,
} from 'three';
import type { Fighter } from '@/entities/battle';
import { typeColor } from '@/entities/pokemon';
import { HoloMaterial, type HoloShared } from './holoMaterial';
import { CARD_DEPTH, CARD_HEIGHT, CARD_RADIUS, CARD_WIDTH } from './layout';

/*
 * A card is three meshes under one group: a printed front, a branded back and a thin foil edge.
 * All eight cards share the same three geometries; only materials and textures are per card.
 *
 *   group  — the director's handle: position / rotation / scale are tweened by the beats
 *   └ pivot — owned by the stage: the gentle idle float, so it never fights a tween
 *     ├ face  (z = +depth/2)
 *     ├ back  (z = −depth/2, turned 180°)
 *     └ edge  (ribbon around the outline)
 */

export type CardHandle = {
  group: Group;
  face: Mesh;
  fighter: Fighter;
  setTint(color: string, intensity: number): void;
};

export type CardGeometries = { face: ShapeGeometry; edge: BufferGeometry; shadow: PlaneGeometry };

const CURVE_SEGMENTS = 8;

/** Counter-clockwise rounded rectangle centred on the origin. */
function cardShape(): Shape {
  const w = CARD_WIDTH / 2;
  const h = CARD_HEIGHT / 2;
  const r = CARD_RADIUS;
  const s = new Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  return s;
}

/** ShapeGeometry emits raw x/y as UVs; remap them so the texture spans the card exactly. */
function faceGeometry(shape: Shape): ShapeGeometry {
  const geometry = new ShapeGeometry(shape, CURVE_SEGMENTS);
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, pos.getX(i) / CARD_WIDTH + 0.5, pos.getY(i) / CARD_HEIGHT + 0.5);
  }
  uv.needsUpdate = true;
  return geometry;
}

/** The card's thickness: one quad per outline segment, normals facing outward. */
function edgeGeometry(shape: Shape): BufferGeometry {
  const pts = shape.getPoints(CURVE_SEGMENTS);
  const half = CARD_DEPTH / 2;
  const positions: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % pts.length];
    if (!p0 || !p1) continue;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue; // closing point duplicates the first
    const nx = dy / len;
    const ny = -dx / len;
    // Two triangles: (p0−, p1−, p1+) and (p0−, p1+, p0+) — CCW seen from outside.
    positions.push(
      p0.x, p0.y, -half, p1.x, p1.y, -half, p1.x, p1.y, half,
      p0.x, p0.y, -half, p1.x, p1.y, half, p0.x, p0.y, half,
    );
    for (let k = 0; k < 6; k++) normals.push(nx, ny, 0);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return geometry;
}

export function createCardGeometries(): CardGeometries {
  const shape = cardShape();
  const shadow = new PlaneGeometry(CARD_WIDTH * 1.5, CARD_WIDTH * 0.9);
  shadow.rotateX(-Math.PI / 2);
  return { face: faceGeometry(shape), edge: edgeGeometry(shape), shadow };
}

export type CardParts = {
  handle: CardHandle;
  /** Idle-float pivot inside the group (stage-owned). */
  pivot: Group;
  /** Soft contact shadow on the floor — lives in the scene, not the group, so it stays grounded. */
  shadow: Mesh<PlaneGeometry, MeshBasicMaterial>;
};

export function createCard(
  fighter: Fighter,
  geometries: CardGeometries,
  textures: { face: Texture; back: Texture; shadow: Texture },
  backColor: string,
  shared: HoloShared,
): CardParts {
  const color = typeColor(fighter.types[0]);
  const phase = fighter.slot * 0.37 + (fighter.side === 'red' ? 0 : 0.19);

  const faceMaterial = new HoloMaterial({ map: textures.face, color, shared, phase });
  const backMaterial = new HoloMaterial({ map: textures.back, color: backColor, shared, phase, sheen: 0.6 });
  const edgeMaterial = new MeshStandardMaterial({
    color: new Color(color).multiplyScalar(0.55),
    emissive: new Color(color),
    emissiveIntensity: 0.18,
    metalness: 0.45,
    roughness: 0.38,
  });

  const face = new Mesh(geometries.face, faceMaterial);
  face.position.z = CARD_DEPTH / 2;
  face.name = 'face';

  const back = new Mesh(geometries.face, backMaterial);
  back.position.z = -CARD_DEPTH / 2;
  back.rotation.y = Math.PI;
  back.name = 'back';

  const edge = new Mesh(geometries.edge, edgeMaterial);
  edge.name = 'edge';

  const pivot = new Group();
  pivot.add(face, back, edge);

  const group = new Group();
  group.name = fighter.id;
  group.add(pivot);

  const shadow = new Mesh(
    geometries.shadow,
    new MeshBasicMaterial({ map: textures.shadow, color: 0x000000, transparent: true, depthWrite: false, opacity: 0.7 }),
  );
  shadow.name = `${fighter.id}-shadow`;
  shadow.renderOrder = -1; // under the cards, over the floor

  const handle: CardHandle = {
    group,
    face,
    fighter,
    setTint(tint, intensity) {
      faceMaterial.setTint(tint, intensity);
      backMaterial.setTint(tint, intensity);
    },
  };

  return { handle, pivot, shadow };
}
