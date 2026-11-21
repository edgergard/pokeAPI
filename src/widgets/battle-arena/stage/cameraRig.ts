import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { CARD_HEIGHT, CARD_WIDTH, layoutSpread, slotPosition } from './layout';

export type ShotName = 'wide' | 'redClose' | 'blueClose' | 'impact' | 'victory';
export type Shot = { position: Vector3; target: Vector3 };

const FOV = 38;
const NEAR = 0.1;
const FAR = 120;

const _offset = new Vector3();
const _axisY = new Vector3(0, 1, 0);
const _look = new Vector3();

/** Distance at which a box of half-size (halfW × halfH) fills the frame, with a small margin. */
function fitDistance(halfW: number, halfH: number, aspect: number, margin = 1.08): number {
  const tanV = Math.tan(MathUtils.degToRad(FOV / 2));
  return Math.max(halfH / tanV, halfW / (tanV * aspect)) * margin;
}

/**
 * Closest distance (along the shot's direction) at which both card rows fit across the frame and
 * the cards fit vertically. Rows further back appear smaller, so each row is fitted at its own
 * depth instead of using one flat half-width — on portrait screens that halves the distance.
 */
function wideDistance(aspect: number, target: Vector3, pitch: number, margin = 1.06): number {
  const tanV = Math.tan(MathUtils.degToRad(FOV / 2));
  const tanH = tanV * aspect;
  const rows = [slotPosition('blue', 'active', aspect), slotPosition('blue', { bench: 2 }, aspect)];
  const across = Math.max(
    ...rows.map((row) => ((row.x + CARD_WIDTH / 2) * margin) / tanH - (target.z - row.z)),
  );
  const tall = ((CARD_HEIGHT * 0.95) / tanV) * margin;
  return Math.max(across, tall) / Math.cos(pitch);
}

/** Unit direction from the target towards the camera, from a yaw (about +y) and a pitch (above the floor). */
function direction(yaw: number, pitch: number): Vector3 {
  return new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
}

/**
 * The arena camera. The director tweens `position` and `target` (plain vectors, GSAP-friendly)
 * towards the named shots; `update()` applies them every frame, adding a very slow idle drift
 * so held shots never feel frozen. The drift lives only in the rendered camera, never in
 * `position`, so tweens and drift cannot fight.
 */
export class CameraRig {
  readonly camera = new PerspectiveCamera(FOV, 16 / 9, NEAR, FAR);
  /** Where the camera sits, before idle drift. Tween this. */
  readonly position = new Vector3();
  /** What the camera looks at. Tween this. */
  readonly target = new Vector3();
  /** Idle drift amount (0 = locked off). Forced to 0 under reduced motion. */
  drift: number;
  /**
   * The shot the camera is resting on, re-framed automatically when the aspect changes.
   * `cut()` sets it; a director clears it while tweening and sets it again when a move lands.
   */
  held: { name: ShotName; orbit: number } | null = null;
  /**
   * Transient offset added to both the rendered position and the look-at point (a camera shake
   * that never fights a position tween). The director animates it and returns it to zero.
   */
  readonly shake = new Vector3();

  private aspect = 16 / 9;

  constructor(aspect: number, opts: { reducedMotion: boolean }) {
    this.drift = opts.reducedMotion ? 0 : 1;
    this.setAspect(aspect);
    this.cut('wide');
  }

  setAspect(aspect: number): void {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    if (this.held) this.cut(this.held.name, this.held.orbit);
  }

  /** Distance of the wide shot for the current aspect — the stage scales its fog from it. */
  get wideDistance(): number {
    const { position, target } = this.shot('wide');
    return position.distanceTo(target);
  }

  /**
   * A named framing for the current aspect. `orbit` swings the camera about the target's
   * vertical axis (radians) — the victory orbit is a tween of this value.
   * Portrait aspects sit higher and look down more, so the benches stack visibly behind.
   */
  shot(name: ShotName, orbit = 0): Shot {
    const aspect = this.aspect;
    const portrait = 1 - layoutSpread(aspect);
    let shot: Shot;

    switch (name) {
      case 'wide': {
        const target = new Vector3(0, MathUtils.lerp(1.9, 2.3, portrait), MathUtils.lerp(-1.3, -2.2, portrait));
        const pitch = MathUtils.degToRad(MathUtils.lerp(13, 24, portrait));
        const distance = wideDistance(aspect, target, pitch);
        shot = { target, position: target.clone().addScaledVector(direction(0, pitch), distance) };
        break;
      }
      case 'redClose':
      case 'blueClose': {
        const side = name === 'redClose' ? 'red' : 'blue';
        const sign = side === 'red' ? -1 : 1;
        // Shot from the arena's centre line, angled out towards the fighter's own corner: the face
        // stays readable (~20° off its normal), its bench fills the background, and the opponent
        // sits behind the camera — out of frame.
        const target = slotPosition(side, 'active', aspect).add(new Vector3(sign * 0.25, 0.1, 0));
        const dir = direction(-sign * MathUtils.degToRad(34), MathUtils.degToRad(8));
        const distance = fitDistance(CARD_WIDTH * 1.05, CARD_HEIGHT * 0.62, aspect);
        shot = { target, position: target.clone().addScaledVector(dir, distance) };
        break;
      }
      case 'impact': {
        // Low and centred, both actives in frame — the camera looks slightly up for weight.
        const halfW = slotPosition('blue', 'active', aspect).x + CARD_WIDTH * 0.75;
        const target = new Vector3(0, CARD_HEIGHT * 0.62, 0);
        const distance = fitDistance(halfW, CARD_HEIGHT * 0.75, aspect, 1.02);
        shot = { target, position: target.clone().addScaledVector(direction(0, MathUtils.degToRad(-3)), distance) };
        break;
      }
      case 'victory': {
        const wide = this.shot('wide');
        const target = new Vector3(0, CARD_HEIGHT * 0.7, -0.8);
        const distance = wide.position.distanceTo(wide.target) * 0.78;
        const dir = direction(MathUtils.degToRad(28), MathUtils.degToRad(20));
        shot = { target, position: target.clone().addScaledVector(dir, distance) };
        break;
      }
    }

    if (orbit !== 0) {
      _offset.subVectors(shot.position, shot.target).applyAxisAngle(_axisY, orbit);
      shot.position.copy(shot.target).add(_offset);
    }
    return shot;
  }

  /** Jump straight to a shot (also the reduced-motion path: cuts instead of moves). */
  cut(name: ShotName, orbit = 0): void {
    const { position, target } = this.shot(name, orbit);
    this.position.copy(position);
    this.target.copy(target);
    this.held = { name, orbit };
  }

  /** Apply position/target (+ idle drift) to the camera. `time` in seconds. */
  update(time: number): void {
    const d = this.drift;
    const s = this.shake;
    this.camera.position.set(
      this.position.x + s.x + Math.sin(time * 0.11) * 0.16 * d,
      this.position.y + s.y + Math.sin(time * 0.17 + 1.3) * 0.07 * d,
      this.position.z + s.z + Math.sin(time * 0.07 + 0.4) * 0.12 * d,
    );
    this.camera.lookAt(_look.addVectors(this.target, s));
  }
}
