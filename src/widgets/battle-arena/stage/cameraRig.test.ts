import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { Side } from '@/entities/battle';
import { CameraRig, type ShotName } from './cameraRig';
import { CARD_HEIGHT, CARD_WIDTH, type SlotRole, slotPosition } from './layout';

const ROLES: SlotRole[] = ['active', { bench: 0 }, { bench: 1 }, { bench: 2 }];
const SIDES: Side[] = ['red', 'blue'];

/** Projects the four corners of every card (ignoring yaw) through the rig's camera at `shot`. */
function projectedCorners(
  rig: CameraRig,
  aspect: number,
  shot: ShotName,
  sides = SIDES,
  roles = ROLES,
) {
  rig.cut(shot);
  rig.drift = 0;
  rig.update(0);
  rig.camera.updateMatrixWorld();
  return sides.flatMap((side) =>
    roles.flatMap((role) => {
      const c = slotPosition(side, role, aspect);
      return [-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) =>
          new Vector3(c.x + (sx * CARD_WIDTH) / 2, c.y + (sy * CARD_HEIGHT) / 2, c.z).project(
            rig.camera,
          ),
        ),
      );
    }),
  );
}

describe('CameraRig', () => {
  it.each([1, 2, 3, 4])(
    'keeps every card of a %i×%i battle in the wide shot, portrait and landscape',
    (size) => {
      for (const aspect of [16 / 9, 9 / 16, 375 / 469]) {
        const rig = new CameraRig(aspect, { reducedMotion: true });
        rig.setTeamSize(size);
        const roles = ROLES.slice(0, Math.max(2, size));
        for (const p of projectedCorners(rig, aspect, 'wide', SIDES, roles)) {
          expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
        }
      }
    },
  );

  it('frames smaller teams closer, so 1×1 cards read larger on a phone', () => {
    const distance = (size: number) => {
      const rig = new CameraRig(375 / 469, { reducedMotion: true });
      rig.setTeamSize(size);
      return rig.wideDistance;
    };
    expect(distance(1)).toBeLessThan(distance(3));
    expect(distance(3)).toBeLessThan(distance(4));
    expect(distance(1)).toBe(distance(2));
  });

  it('re-frames a held wide shot when the team size changes', () => {
    const rig = new CameraRig(16 / 9, { reducedMotion: true });
    const far = rig.position.clone();
    rig.setTeamSize(1);
    expect(rig.position.distanceTo(rig.target)).toBeLessThan(far.distanceTo(rig.target));
  });

  it.each([16 / 9, 4 / 3, 1, 4 / 5, 9 / 16])(
    'keeps all eight cards in the wide shot at aspect %d',
    (aspect) => {
      const rig = new CameraRig(aspect, { reducedMotion: true });
      for (const p of projectedCorners(rig, aspect, 'wide')) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
      }
    },
  );

  it('keeps the attacker in its close-up and the opponent out of it (landscape)', () => {
    const rig = new CameraRig(16 / 9, { reducedMotion: true });
    for (const p of projectedCorners(rig, 16 / 9, 'redClose', ['red'], ['active'])) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
    }
    const opponent = projectedCorners(rig, 16 / 9, 'redClose', ['blue'], ['active']);
    expect(opponent.every((p) => Math.abs(p.x) > 1 || p.z > 1)).toBe(true);
  });

  it('raises the wide framing on portrait screens', () => {
    const pitch = (aspect: number) => {
      const { position, target } = new CameraRig(aspect, { reducedMotion: true }).shot('wide');
      const d = position.clone().sub(target);
      return Math.atan2(d.y, Math.hypot(d.x, d.z));
    };
    expect(pitch(9 / 16)).toBeGreaterThan(pitch(16 / 9));
  });

  it('returns fresh vectors and orbits around the target', () => {
    const rig = new CameraRig(16 / 9, { reducedMotion: true });
    const a = rig.shot('victory');
    a.position.set(0, 0, 0);
    const b = rig.shot('victory');
    const orbited = rig.shot('victory', Math.PI / 2);
    expect(b.position.length()).toBeGreaterThan(0);
    expect(orbited.position.distanceTo(orbited.target)).toBeCloseTo(
      b.position.distanceTo(b.target),
    );
    expect(orbited.target.equals(b.target)).toBe(true);
  });

  it('re-frames the held shot on resize, but leaves a camera in motion alone', () => {
    const rig = new CameraRig(16 / 9, { reducedMotion: true });
    rig.setAspect(9 / 16);
    expect(rig.position.equals(rig.shot('wide').position)).toBe(true);

    rig.held = null; // a director tween is in flight
    rig.position.set(1, 2, 3);
    rig.setAspect(16 / 9);
    expect(rig.position.toArray()).toEqual([1, 2, 3]);
  });
});
