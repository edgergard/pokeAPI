import { BufferGeometry, Float32BufferAttribute } from 'three';
import { createRng } from '@/entities/battle';

/*
 * Pre-fractured card: a jittered grid over the card rectangle. Every cell is a convex quad
 * (triangle fan from its first corner); some cells are split along a random diagonal into two
 * triangular shards, so the pieces read as broken glass rather than tiles and the total comes
 * out at exactly `count`. Neighbouring cells share their jittered corners, so the shards tile
 * the card with no gaps or overlaps.
 *
 * Shards are flat (z = 0) in card space: x ∈ [−w/2, w/2], y ∈ [−h/2, h/2], UVs mapped to the
 * card face exactly like the card mesh. Each geometry's `userData.centroid` holds its centre
 * ({ x, y }) so the director can recentre it and spin it about its own middle.
 */

/** Interior corners move at most this fraction of a cell: below ~0.25 every quad stays convex. */
const JITTER = 0.22;

type Pt = { x: number; y: number };

/** Grid whose cell count is in [count/2, count] (each split adds one shard), close to 70 % of it. */
function gridFor(width: number, height: number, count: number): { cols: number; rows: number } {
  let best: { cols: number; rows: number; score: number } | null = null;
  const ideal = count * 0.7;
  for (let cols = 1; cols <= count; cols++) {
    const exact = (cols * height) / width;
    for (const rows of new Set([Math.max(1, Math.floor(exact)), Math.max(1, Math.ceil(exact))])) {
      const cells = cols * rows;
      if (cells > count || cells * 2 < count) continue;
      const score = Math.abs(cells - ideal) - cells * 1e-6; // ties → more cells
      if (!best || score < best.score) best = { cols, rows, score };
    }
  }
  return best ?? { cols: 1, rows: Math.ceil(count / 2) };
}

function shardGeometry(triangles: Pt[][], width: number, height: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  let cx = 0;
  let cy = 0;
  let total = 0;
  for (const [a, b, c] of triangles) {
    if (!a || !b || !c) continue;
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, 0);
      normals.push(0, 0, 1);
      uvs.push(p.x / width + 0.5, p.y / height + 0.5);
    }
    const area = ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
    cx += ((a.x + b.x + c.x) / 3) * area;
    cy += ((a.y + b.y + c.y) / 3) * area;
    total += area;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.userData.centroid = { x: cx / total, y: cy / total };
  return geometry;
}

/** Deterministic shards for a `width × height` card: same seed, same fracture. */
export function createShards(
  width: number,
  height: number,
  count: number,
  seed: number,
): BufferGeometry[] {
  const n = Math.max(1, Math.floor(count));
  const rand = createRng(seed);
  const { cols, rows } = gridFor(width, height, n);
  const cw = width / cols;
  const ch = height / rows;
  const jitter = () => (rand() * 2 - 1) * JITTER;

  // Grid corners: interior ones jitter freely, edge ones only slide along their edge, corners stay.
  const grid: Pt[][] = [];
  for (let j = 0; j <= rows; j++) {
    const row: Pt[] = [];
    for (let i = 0; i <= cols; i++) {
      const edgeX = i === 0 || i === cols;
      const edgeY = j === 0 || j === rows;
      row.push({
        x: -width / 2 + (i + (edgeX ? 0 : jitter())) * cw,
        y: -height / 2 + (j + (edgeY ? 0 : jitter())) * ch,
      });
    }
    grid.push(row);
  }
  const at = (i: number, j: number): Pt => grid[j]?.[i] ?? { x: 0, y: 0 };

  // Pick which cells split (seeded Fisher–Yates over cell indices).
  const order = Array.from({ length: cols * rows }, (_, k) => k);
  for (let k = order.length - 1; k > 0; k--) {
    const r = Math.floor(rand() * (k + 1));
    [order[k], order[r]] = [order[r] ?? 0, order[k] ?? 0];
  }
  const split = new Set(order.slice(0, n - cols * rows));

  const shards: BufferGeometry[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      // Counter-clockwise: bottom-left, bottom-right, top-right, top-left.
      const a = at(i, j),
        b = at(i + 1, j),
        c = at(i + 1, j + 1),
        d = at(i, j + 1);
      if (split.has(j * cols + i)) {
        const tris =
          rand() < 0.5
            ? [
                [a, b, c],
                [a, c, d],
              ]
            : [
                [a, b, d],
                [b, c, d],
              ];
        for (const tri of tris) shards.push(shardGeometry([tri], width, height));
      } else {
        shards.push(
          shardGeometry(
            [
              [a, b, c],
              [a, c, d],
            ],
            width,
            height,
          ),
        );
      }
    }
  }
  return shards;
}
