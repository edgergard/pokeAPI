import { MathUtils, Vector3 } from 'three';
import type { Side } from '@/entities/battle';

/*
 * Arena layout — pure, so it runs in node tests and drives both the stage and the camera rig.
 *
 * World axes: +x towards Blue's corner, −x towards Red's, +y up, +z towards the viewer.
 * Actives stand either side of the centre line; each side's bench fans out behind and outward,
 * so the two decks read as a V opening towards the camera.
 */

/** Card proportions follow a real trading card (2.5 : 3.5), in world units. */
export const CARD_WIDTH = 2.5;
export const CARD_HEIGHT = 3.5;
export const CARD_DEPTH = 0.035;
export const CARD_RADIUS = 0.18;

/** Cards hover a little above the floor so their contact shadows read as depth. */
export const CARD_HOVER = 0.28;

export type SlotRole = 'active' | { bench: number };

/**
 * 0 on narrow portrait screens, 1 on wide landscape ones. Portrait layouts trade horizontal
 * spread for depth: benches tuck in closer and stack further back.
 */
export const layoutSpread = (aspect: number) => MathUtils.clamp((aspect - 0.6) / (1.6 - 0.6), 0, 1);

const lerp = MathUtils.lerp;

/** Centre of the card (its group origin) for a given side and role. Returns a new vector. */
export function slotPosition(side: Side, role: SlotRole, aspect: number): Vector3 {
  const t = layoutSpread(aspect);
  const sign = side === 'red' ? -1 : 1;
  const activeX = lerp(1.75, 2.4, t);
  const y = CARD_HEIGHT / 2 + CARD_HOVER;

  if (role === 'active') return new Vector3(sign * activeX, y, 0);

  const i = role.bench;
  const x = activeX + lerp(0.95, 2.3, t) + i * lerp(0.7, 1.35, t);
  const z = -lerp(2.8, 1.9, t) - i * lerp(1.7, 1.35, t);
  return new Vector3(sign * x, y, z);
}

/**
 * Yaw (rotation about +y) for a card in its slot: actives turn slightly towards each other,
 * benches turn a little more so their faces stay readable from the wide shot.
 */
export function slotYaw(side: Side, role: SlotRole): number {
  const sign = side === 'red' ? 1 : -1;
  return sign * (role === 'active' ? 0.22 : 0.32);
}
