import { Color, Vector3 } from 'three';
import { createRng, type Move, type Side } from '@/entities/battle';
import { typeColor } from '@/entities/pokemon';
import { gsap, GSAP_EASE } from '@/shared/lib/gsap';
import type { ImpactInfo, StageDirector, Tier } from '../model/director';
import { type BattleStage, keyTintColor } from './BattleStage';
import type { Shot, ShotName } from './cameraRig';
import { SIDE_COLOR } from './cardTexture';
import { FX_HIT, FX_SECONDS, FxPool, type FxShot, fxFamily } from './fx';
import { HoloMaterial } from './holoMaterial';
import { CARD_HEIGHT, CARD_HOVER, CARD_WIDTH, type SlotRole, slotPosition } from './layout';
import { resetShards, ShatterCache } from './shatter';

/*
 * The 3D stage director: turns each choreography beat into a self-contained GSAP timeline that
 * moves cards, camera, key light and FX on the BattleStage.
 *
 * Rules every beat follows:
 * - Timelines are built up front (the choreographer calls every beat before playback starts),
 *   so nothing reads live scene state at build time. State changes happen in `call()`s, and
 *   tween targets are function-based or captured in `onStart`, i.e. resolved at play time —
 *   a resize between build and play still lands every card on its current slot.
 * - A small build-time model (who is on deck, on the bench, active or out) mirrors the event
 *   order, so each beat knows which cards to touch without inspecting the scene.
 * - Each beat's length is pinned with a spacer, so the choreographer's pacing is exact; no
 *   timers outside GSAP, so time-scaling a beat (short-tier compression, ×2) scales everything.
 * - Card roles stay current through `stage.setRole` (in flight = null, so a resize never snaps a
 *   moving card), and `camera.held` is cleared while the camera moves and set when it settles.
 *
 * Style: "premium / cinematic" — slow camera, soft light, restrained effects, precise easing.
 * Accents (camera shake, white flash) only on super-effective hits, critical hits and KOs.
 * Reduced motion: every beat is ≤ 0.3 s of fades (tint to the stage's ink colour) and cuts,
 * with no shake and no flash; a KO fades out instead of shattering.
 * Flash rate: impact tint pulses share a wall-clock budget (a pulse within FLASH_GAP_MS of the
 * previous one is skipped), so x2 speed or compressed beats never exceed 3 flashes per second.
 */

type Timeline = gsap.core.Timeline;

const INK = '#07080b';
const TAU = Math.PI * 2;
/** Minimum wall-clock gap between two impact flashes/pulses (fewer than 3 per second). */
export const FLASH_GAP_MS = 350;
const AXIS_Y = new Vector3(0, 1, 0);

/** Beat lengths at 1× (see Global Constraints). Short tier: lunge + impact ≈ 0.7 s. */
const BEAT = {
  intro: 2,
  dealIn: 0.9,
  anticipate: 0.4,
  lunge: { full: 0.5, short: 0.3 },
  impact: { full: 0.6, short: 0.4 },
  knockOut: 1.2,
  victory: 2.6,
} as const;

/** Reduced-motion beats: fades and cuts only, never longer than this. */
const REDUCED = { beat: 0.3, exchange: 0.2, impact: 0.25 } as const;

type Status = 'deck' | 'bench' | 'active' | 'out';
type Entry = { id: string; side: Side; slot: number; status: Status };
type Pose = { position: Vector3; rotationY: number };

export type StageDirector3D = StageDirector & {
  /** Removes and frees this director's FX emitters and shard groups from the stage's scene. */
  dispose(): void;
};

export type StageDirectorOptions = {
  reducedMotion: boolean;
  /** Wall clock in ms for the flash-rate cap (default `performance.now`); injectable for tests. */
  now?: () => number;
};

/**
 * Creates the director for one stage.
 *
 * Lifecycle contract:
 * - Create it after `stage.load()` has resolved: `intro()` reads `stage.fighters`.
 * - One director may serve several battles on the same stage, including after another
 *   `stage.load()`: each `intro()` re-reads the fighters, and a card's shards are re-cut when the
 *   stage has replaced that card (same fighter id, new handle and textures).
 * - Kill the previous battle's timeline before choreographing a new one.
 * - When the motion setting flips, create a new director and call the old one's `dispose()`:
 *   its FX emitters and shard groups otherwise stay in the scene. (`stage.dispose()` frees
 *   them too, on unmount.)
 */
export function createStageDirector(stage: BattleStage, opts: StageDirectorOptions): StageDirector3D {
  const reduced = opts.reducedMotion;
  const now = opts.now ?? (() => performance.now());
  const rig = stage.camera;
  const pool = new FxPool(stage.scene);
  const shatter = new ShatterCache(stage.scene, stage.lights.key.color);
  let lastFlash = Number.NEGATIVE_INFINITY;
  const tints = new Map<string, { color: string; amount: number }>();
  const model = new Map<string, Entry>();
  /** The exchange in flight: set by lunge(), consumed by the impact() that follows it. */
  let pending: { attackerId: string; shot: FxShot | null; tier: Tier } | null = null;

  // ---------------------------------------------------------------------------------------------
  // Build-time model

  const resetModel = () => {
    model.clear();
    for (const f of stage.fighters) {
      model.set(f.id, { id: f.id, side: f.side, slot: f.slot, status: f.slot === 0 ? 'deck' : 'bench' });
    }
  };
  const entry = (id: string): Entry => {
    if (model.size === 0) resetModel();
    const e = model.get(id);
    if (!e) throw new Error(`StageDirector: unknown fighter "${id}"`);
    return e;
  };
  /** Waiting fighters of a side in slot order — their index is their bench slot. */
  const benchOf = (side: Side) =>
    [...model.values()].filter((e) => e.side === side && (e.status === 'bench' || e.status === 'deck'))
      .sort((a, b) => a.slot - b.slot);

  // ---------------------------------------------------------------------------------------------
  // Small helpers

  const timeline = (seconds: number): Timeline => gsap.timeline().to({}, { duration: seconds }, 0);
  const sign = (side: Side) => (side === 'red' ? 1 : -1); // towards the opponent along x
  const moveColor = (move: Move) => typeColor(move.type === 'typeless' ? undefined : move.type);
  const fighterColor = (id: string) => typeColor(stage.card(id).fighter.types[0]);

  /** Shortest turn to `target`, except a face flip (≈ half a turn), which always spins towards the centre line. */
  const spinTo = (current: number, target: number, side: Side): number => {
    let d = target - current;
    d = ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
    if (Math.abs(d) > Math.PI / 2) d = side === 'red' ? (d > 0 ? d - TAU : d) : (d < 0 ? d + TAU : d);
    return current + d;
  };

  const restPose = (id: string, role: SlotRole, faceDown = false): Pose => {
    const pose = stage.slotFor(id, role, faceDown);
    if (!pose) throw new Error(`StageDirector: unknown fighter "${id}"`);
    return pose;
  };

  /** Where a fighter waits after the intro: the lead on top of its deck (just in front of bench 0). */
  const introPose = (e: Entry): Pose => {
    if (e.slot === 0) {
      const pose = restPose(e.id, { bench: 0 }, true);
      pose.position.z += 0.16;
      pose.position.x -= sign(e.side) * 0.12;
      return pose;
    }
    return restPose(e.id, { bench: e.slot - 1 }, true);
  };

  /** Tween a card's group to a pose resolved at play time (position + yaw, tilt back to level). */
  const poseTo = (t: Timeline, id: string, pose: () => Pose, vars: gsap.TweenVars, at: number) => {
    const { group, fighter } = stage.card(id);
    let memo: Pose | null = null;
    const get = () => (memo ??= pose());
    t.to(group.position, { x: () => get().position.x, y: () => get().position.y, z: () => get().position.z, ...vars }, at);
    t.to(group.rotation, { x: 0, z: 0, y: () => spinTo(group.rotation.y, get().rotationY, fighter.side), ...vars }, at);
  };

  const snapTo = (id: string, pose: Pose) => {
    const { group } = stage.card(id);
    group.position.copy(pose.position);
    group.rotation.set(0, pose.rotationY, 0);
  };

  const tintState = (id: string) => {
    let s = tints.get(id);
    if (!s) tints.set(id, (s = { color: '#ffffff', amount: 0 }));
    return s;
  };

  /** Blend a card towards `color` (fades use the stage ink; flashes white). */
  const tintTo = (t: Timeline, id: string, color: string, amount: number, duration: number, ease: string, at: number) => {
    const s = tintState(id);
    const apply = () => stage.card(id).setTint(s.color, s.amount);
    t.to(s, { amount, duration, ease, onStart: () => { s.color = color; apply(); }, onUpdate: apply }, at);
  };

  const setTintNow = (id: string, color: string, amount: number) => {
    const s = tintState(id);
    s.color = color;
    s.amount = amount;
    stage.card(id).setTint(color, amount);
  };

  const riseEase = gsap.parseEase('power2.out');
  const fallEase = gsap.parseEase('sine.inOut');
  /**
   * One tint pulse on a card: up to `peak` over `rise` s, back to 0 over `fall` s. Pulses share a
   * wall-clock budget: one starting within FLASH_GAP_MS of the previous is skipped entirely.
   */
  const pulse = (t: Timeline, id: string, color: string, peak: number, rise: number, fall: number, at: number) => {
    const s = tintState(id);
    const k = { v: 0 };
    let on = false;
    const apply = (amount: number) => {
      s.amount = amount;
      stage.card(id).setTint(s.color, amount);
    };
    t.to(k, {
      v: rise + fall,
      duration: rise + fall,
      ease: 'none',
      onStart: () => {
        const time = now();
        on = time - lastFlash >= FLASH_GAP_MS;
        if (!on) return;
        lastFlash = time;
        s.color = color;
      },
      onUpdate: () => {
        if (!on) return;
        apply(k.v < rise ? peak * riseEase(k.v / rise) : peak * (1 - fallEase((k.v - rise) / fall)));
      },
      onComplete: () => {
        if (on) apply(0);
      },
    }, at);
  };

  const keyTo = (t: Timeline, color: string, amount: number, duration: number, at: number) => {
    const target = keyTintColor(color, amount, new Color());
    t.to(stage.lights.key.color, { r: target.r, g: target.g, b: target.b, duration, ease: 'sine.inOut' }, at);
  };

  /** Brief foil glint on a card's face (the holo sheen swells and settles). */
  const glint = (t: Timeline, id: string, peak: number, duration: number, at: number) => {
    const material = stage.card(id).face.material;
    if (!(material instanceof HoloMaterial)) return;
    const sheen = material.uniforms.uSheen;
    t.to(sheen, { value: peak, duration: duration * 0.45, ease: 'sine.out' }, at);
    t.to(sheen, { value: 1, duration: duration * 0.55, ease: 'sine.inOut' }, at + duration * 0.45);
  };

  /** Damped oscillation written each frame by `apply(offset)`; ends exactly at rest. */
  const shake = (
    t: Timeline,
    amplitude: number,
    cycles: number,
    duration: number,
    at: number,
    apply: (x: number, y: number) => void,
  ) => {
    const k = { v: 0 };
    t.to(k, {
      v: 1,
      duration,
      ease: 'none',
      onUpdate: () => {
        const decay = (1 - k.v) ** 2 * amplitude;
        apply(Math.sin(k.v * TAU * cycles) * decay, Math.sin(k.v * TAU * cycles * 1.3 + 1.1) * decay * 0.55);
      },
      onComplete: () => apply(0, 0),
    }, at);
  };

  const cameraShake = (t: Timeline, amplitude: number, duration: number, at: number) =>
    shake(t, amplitude, 5, duration, at, (x, y) => rig.shake.set(x, y, 0));

  const cardShake = (t: Timeline, id: string, amplitude: number, duration: number, at: number) => {
    const pivot = stage.pivot(id);
    shake(t, amplitude, 4, duration, at, (x, y) => {
      pivot.position.x = x;
      pivot.rotation.y = y * 0.6;
    });
  };

  // ---------------------------------------------------------------------------------------------
  // Camera

  const lerpShot = (a: Shot, b: Shot, amount: number): Shot => ({
    position: a.position.lerp(b.position, amount),
    target: a.target.lerp(b.target, amount),
  });
  /** A framing `amount` of the way from the wide shot towards `name` — a gentle dolly. */
  const towards = (name: ShotName, amount: number) => () => lerpShot(rig.shot('wide'), rig.shot(name), amount);

  /** Glide the camera to a shot resolved when the move starts; `hold` re-arms resize framing at the end. */
  const cameraTo = (
    t: Timeline,
    shot: () => Shot,
    duration: number,
    ease: string,
    at: number,
    hold?: { name: ShotName; orbit?: number },
  ) => {
    const fromP = new Vector3();
    const fromT = new Vector3();
    let to: Shot | null = null;
    const k = { v: 0 };
    t.to(k, {
      v: 1,
      duration,
      ease,
      onStart: () => {
        rig.held = null;
        fromP.copy(rig.position);
        fromT.copy(rig.target);
        to = shot();
      },
      onUpdate: () => {
        if (!to) return;
        rig.position.lerpVectors(fromP, to.position, k.v);
        rig.target.lerpVectors(fromT, to.target, k.v);
      },
      onComplete: () => {
        if (hold) rig.cut(hold.name, hold.orbit ?? 0);
      },
    }, at);
  };

  /** Establishing framing for the intro: the wide shot swung to one side, higher and further out. */
  const establishing = (): Shot => {
    const s = rig.shot('wide', -0.42);
    s.position.sub(s.target).multiplyScalar(1.3).add(s.target);
    s.position.y += 2.2;
    return s;
  };

  // ---------------------------------------------------------------------------------------------
  // Shared beat pieces

  /** Finishes an FX shot whose impact never came (a move without a result), so no effect lingers. */
  const flushPending = (t: Timeline) => {
    if (!pending) return;
    const { shot } = pending;
    pending = null;
    if (shot) t.to(shot, { progress: 1, duration: 0.2, ease: 'none' }, 0);
  };

  const resetAll = () => {
    pool.reset();
    rig.shake.set(0, 0, 0);
    stage.setKeyTint('#ffffff', 0);
    shatter.resetAll();
    for (const e of model.values()) {
      const handle = stage.card(e.id);
      handle.group.visible = true;
      handle.group.scale.setScalar(1);
      const pivot = stage.pivot(e.id);
      pivot.position.x = 0;
      pivot.position.z = 0;
      pivot.rotation.x = 0;
      pivot.rotation.y = 0;
      const material = handle.face.material;
      if (material instanceof HoloMaterial) material.uniforms.uSheen.value = 1;
      setTintNow(e.id, INK, 0);
      stage.setRole(e.id, e.slot === 0 ? null : { bench: e.slot - 1 }, true);
      snapTo(e.id, introPose(e));
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Beats

  const intro = (): Timeline => {
    resetModel();
    pending = null;
    const entries = [...model.values()];

    if (reduced) {
      const t = timeline(REDUCED.beat);
      t.call(() => {
        resetAll();
        rig.cut('wide');
        for (const e of entries) setTintNow(e.id, INK, 1);
      }, [], 0);
      for (const e of entries) tintTo(t, e.id, INK, 0, REDUCED.beat, 'sine.out', 0);
      return t;
    }

    const t = timeline(BEAT.intro);
    t.call(() => {
      resetAll();
      // Decks wait off stage, out past each corner.
      for (const e of entries) {
        const { group } = stage.card(e.id);
        group.position.x += -sign(e.side) * 7;
        group.position.z -= 3;
      }
      const s = establishing();
      rig.held = null;
      rig.position.copy(s.position);
      rig.target.copy(s.target);
    }, [], 0);

    // Slow sweep from the establishing angle into the wide shot.
    cameraTo(t, () => rig.shot('wide'), BEAT.intro, 'power2.inOut', 0, { name: 'wide' });
    // Decks slide in, back cards first so the lead lands on top.
    for (const e of entries) {
      const order = (3 - Math.min(e.slot, 3)) * 0.09;
      poseTo(t, e.id, () => introPose(e), { duration: 1.15, ease: GSAP_EASE.outExpo }, 0.3 + order);
    }
    return t;
  };

  const dealIn = (fighterId: string): Timeline => {
    const e = entry(fighterId);
    const wasActive = e.status === 'active';
    e.status = 'active';
    const bench = benchOf(e.side);
    const color = fighterColor(fighterId);

    if (reduced) {
      const t = timeline(REDUCED.beat);
      flushPending(t);
      tintTo(t, fighterId, INK, 1, 0.12, 'sine.in', 0);
      t.call(() => {
        stage.setRole(fighterId, 'active');
        snapTo(fighterId, restPose(fighterId, 'active'));
        bench.forEach((b, j) => {
          stage.setRole(b.id, { bench: j }, true);
          snapTo(b.id, restPose(b.id, { bench: j }, true));
        });
        stage.setKeyTint(color, 0.3);
      }, [], 0.12);
      tintTo(t, fighterId, INK, 0, 0.18, 'sine.out', 0.12);
      return t;
    }

    const t = timeline(BEAT.dealIn);
    flushPending(t);
    if (!wasActive) {
      const { group } = stage.card(fighterId);
      const target = () => restPose(fighterId, 'active');
      let memo: Pose | null = null;
      const home = () => (memo ??= target());
      t.call(() => stage.setRole(fighterId, null), [], 0); // in flight: never snapped by a resize
      // Arc: glide across, rise and settle with a soft spring, flipping face-up on the way.
      t.to(group.position, { x: () => home().position.x, z: () => home().position.z, duration: 0.78, ease: 'power3.inOut' }, 0);
      t.to(group.position, { y: () => home().position.y + 1.25, duration: 0.36, ease: 'power2.out' }, 0);
      t.to(group.position, { y: () => home().position.y, duration: 0.44, ease: GSAP_EASE.spring }, 0.36);
      t.to(group.rotation, {
        y: () => spinTo(group.rotation.y, home().rotationY, e.side),
        duration: 0.56,
        ease: 'power2.inOut',
      }, 0.1);
      t.to(group.rotation, { x: -0.18, z: sign(e.side) * -0.05, duration: 0.3, ease: 'power2.out' }, 0);
      t.to(group.rotation, { x: 0, z: 0, duration: 0.45, ease: GSAP_EASE.standard }, 0.33);
      t.call(() => {
        stage.setRole(fighterId, 'active');
        group.rotation.y = home().rotationY;
      }, [], 0.8);
      glint(t, fighterId, 1.7, 0.5, 0.4);
    }
    // The rest of the bench shuffles forward into the freed slots.
    bench.forEach((b, j) => {
      t.call(() => stage.setRole(b.id, { bench: j }, true), [], 0);
      poseTo(t, b.id, () => restPose(b.id, { bench: j }, true), { duration: 0.55, ease: GSAP_EASE.standard }, 0.25);
    });
    keyTo(t, color, 0.3, 0.6, 0.3);
    // Back to the wide shot if a previous beat left the camera elsewhere (a no-op when it is there).
    cameraTo(t, () => rig.shot('wide'), 0.8, 'power2.inOut', 0, { name: 'wide' });
    return t;
  };

  const anticipate = (attackerId: string, move: Move, tier: Tier): Timeline => {
    const e = entry(attackerId);
    const color = moveColor(move);

    if (reduced) {
      const t = timeline(REDUCED.exchange);
      flushPending(t);
      keyTo(t, color, 0.4, REDUCED.exchange, 0);
      return t;
    }

    const seconds = tier === 'full' ? BEAT.anticipate : BEAT.anticipate / 2;
    const t = timeline(seconds);
    flushPending(t);
    const { group } = stage.card(attackerId);
    const s = sign(e.side);
    let memo: Pose | null = null;
    const home = () => (memo ??= restPose(attackerId, 'active'));
    // Lean back from the target and tilt away, gathering for the strike.
    t.to(group.position, {
      x: () => home().position.x - s * 0.3,
      y: () => home().position.y + 0.14,
      z: () => home().position.z - 0.12,
      duration: seconds,
      ease: GSAP_EASE.standard,
    }, 0);
    t.to(group.rotation, { x: -0.12, z: s * 0.07, duration: seconds, ease: GSAP_EASE.standard }, 0);
    keyTo(t, color, 0.42, seconds, 0);
    glint(t, attackerId, 1.6, seconds, 0);
    if (tier === 'full') {
      cameraTo(t, towards(e.side === 'red' ? 'redClose' : 'blueClose', 0.3), seconds, 'power2.out', 0);
    }
    return t;
  };

  const lunge = (attackerId: string, targetId: string, move: Move, tier: Tier): Timeline => {
    const e = entry(attackerId);
    const color = moveColor(move);

    if (reduced) {
      const t = timeline(REDUCED.exchange);
      flushPending(t);
      tintTo(t, attackerId, color, 0.22, 0.1, 'sine.out', 0);
      tintTo(t, attackerId, color, 0, 0.1, 'sine.in', 0.1);
      pending = { attackerId, shot: null, tier };
      return t;
    }

    const seconds = BEAT.lunge[tier];
    const t = timeline(seconds);
    flushPending(t);
    const { group } = stage.card(attackerId);
    const s = sign(e.side);
    let memo: Pose | null = null;
    const home = () => (memo ??= restPose(attackerId, 'active'));

    // FX endpoints: in front of each card's face, resolved when the lunge starts.
    const from = new Vector3();
    const to = new Vector3();
    t.call(() => {
      facePoint(restPose(attackerId, 'active'), 0.3, from).y += 0.1;
      facePoint(restPose(targetId, 'active'), 0.25, to);
    }, [], 0);
    const shot = pool.shot(fxFamily(move.type), from, to, color, tier);
    const travel = FX_SECONDS[tier].travel;
    t.to(shot, { progress: FX_HIT, duration: travel, ease: 'none' }, seconds - travel);

    if (tier === 'full') {
      // Drive forward hard, then carry a little momentum while the effect flies.
      t.to(group.position, {
        x: () => home().position.x + s * 1.0,
        y: () => home().position.y - 0.04,
        z: () => home().position.z + 0.3,
        duration: 0.22,
        ease: 'power2.in',
      }, 0);
      t.to(group.rotation, { x: 0.1, z: -s * 0.03, duration: 0.22, ease: 'power2.in' }, 0);
      t.to(group.position, { x: () => home().position.x + s * 1.1, duration: seconds - 0.22, ease: 'power1.out' }, 0.22);
      cameraTo(t, towards('impact', 0.55), seconds, 'power2.inOut', 0);
    } else {
      t.to(group.position, {
        x: () => home().position.x + s * 0.45,
        z: () => home().position.z + 0.15,
        duration: 0.14,
        ease: 'power2.out',
      }, 0);
      t.to(group.rotation, { x: 0.05, z: 0, duration: 0.14, ease: 'power2.out' }, 0);
    }
    pending = { attackerId, shot, tier };
    return t;
  };

  const impact = (
    targetId: string,
    result: 'hit' | 'miss' | 'noEffect',
    info: ImpactInfo | null,
    tier: Tier,
  ): Timeline => {
    const exchange = pending;
    pending = null;
    const target = entry(targetId);
    const p = -sign(target.side); // pushed away from the attacker

    if (reduced) {
      const t = timeline(REDUCED.impact);
      if (result === 'hit') {
        pulse(t, targetId, INK, 0.3, 0.1, 0.15, 0);
      }
      return t;
    }

    const seconds = BEAT.impact[tier];
    const t = timeline(seconds);
    if (exchange?.shot) t.to(exchange.shot, { progress: 1, duration: FX_SECONDS[tier].burst, ease: 'none' }, 0);
    if (exchange) {
      const back = tier === 'full' ? 0.5 : 0.32;
      poseTo(t, exchange.attackerId, () => restPose(exchange.attackerId, 'active'), { duration: back, ease: GSAP_EASE.standard }, 0.04);
    }

    const { group } = stage.card(targetId);
    let memo: Pose | null = null;
    const home = () => (memo ??= restPose(targetId, 'active'));
    const settle = () => restPose(targetId, 'active');

    if (result === 'hit' && info) {
      const eff = info.effectiveness;
      const accent = eff > 1 || info.critical;
      const recoil = (0.12 + 0.1 * Math.min(eff, 2)) * (info.critical ? 1.2 : 1);
      t.to(group.position, {
        x: () => home().position.x + p * recoil,
        z: () => home().position.z - 0.08,
        duration: 0.1,
        ease: GSAP_EASE.standard,
      }, 0);
      t.to(group.rotation, {
        y: () => home().rotationY + p * 0.12,
        z: -p * 0.05,
        duration: 0.1,
        ease: GSAP_EASE.standard,
      }, 0);
      poseTo(t, targetId, settle, { duration: seconds - 0.12, ease: GSAP_EASE.spring }, 0.1);
      const amplitude = Math.min(0.12, 0.02 + 0.0225 * eff) + (info.critical ? 0.02 : 0);
      cardShake(t, targetId, amplitude, Math.min(0.34, seconds - 0.04), 0);

      if (accent) {
        // One white flash (never repeated within a beat → far under 3 Hz).
        pulse(t, targetId, '#ffffff', 0.55, 0.05, 0.32, 0);
        const strength = (eff >= 4 ? 0.09 : eff > 1 ? 0.06 : 0) + (info.critical ? 0.04 : 0);
        cameraShake(t, strength, 0.32, 0);
      } else if (eff < 1) {
        pulse(t, targetId, INK, 0.25, 0.06, 0.3, 0);
      } else {
        pulse(t, targetId, '#fff3e0', 0.16, 0.06, 0.28, 0);
      }
    } else if (result === 'miss') {
      // A quick sidestep out of the effect's path, then back.
      t.to(group.position, {
        x: () => home().position.x + p * 0.15,
        z: () => home().position.z + 0.45,
        duration: 0.16,
        ease: 'power2.out',
      }, 0);
      t.to(group.rotation, { z: p * 0.05, duration: 0.16, ease: 'power2.out' }, 0);
      poseTo(t, targetId, settle, { duration: seconds - 0.2, ease: GSAP_EASE.standard }, 0.18);
    } else {
      // No effect: the card barely registers it — a cool, faint shimmer.
      pulse(t, targetId, '#9aa4b8', 0.15, 0.08, 0.3, 0);
    }

    if (tier === 'full') cameraTo(t, () => rig.shot('wide'), seconds - 0.05, 'power2.inOut', 0.05, { name: 'wide' });
    return t;
  };

  const knockOut = (fighterId: string): Timeline => {
    const e = entry(fighterId);
    e.status = 'out';

    if (reduced) {
      const t = timeline(REDUCED.beat);
      flushPending(t);
      tintTo(t, fighterId, INK, 1, REDUCED.beat, 'sine.in', 0);
      t.call(() => {
        stage.setRole(fighterId, null);
        stage.card(fighterId).group.visible = false;
      }, [], REDUCED.beat);
      return t;
    }

    const t = timeline(BEAT.knockOut);
    flushPending(t);
    const set = shatter.get(stage.card(fighterId));
    const { group } = stage.card(fighterId);
    const CRACK = 0.18;

    // The card dims and trembles, then breaks.
    tintTo(t, fighterId, INK, 0.35, CRACK, 'sine.in', 0);
    cardShake(t, fighterId, 0.03, CRACK, 0);
    cameraShake(t, 0.05, 0.3, CRACK);
    t.call(() => {
      stage.setRole(fighterId, null);
      group.visible = false;
      set.group.position.copy(group.position);
      set.group.rotation.set(0, group.rotation.y, 0);
      resetShards(set);
      set.uniforms.uDim.value = 0.35;
      set.group.visible = true;
    }, [], CRACK);

    // Each shard: a hairline crack outward, a gravity fall with a small bounce, scattering forward.
    // A fresh seeded stream per build, so a replay breaks the card exactly the same way.
    const r = createRng(set.seed ^ 0x9e3779b9);
    set.meshes.forEach((mesh, i) => {
      const b = set.base[i] ?? new Vector3();
      const out = Math.hypot(b.x, b.y) || 1;
      const crackX = b.x + (b.x / out) * 0.06;
      const crackY = b.y + (b.y / out) * 0.06;
      const delay = r() * 0.1 + (b.y / CARD_HEIGHT + 0.5) * 0.04; // top pieces let go last
      const fall = 0.45 + r() * 0.1;
      const start = CRACK + 0.12 + delay;
      const floor = () => -set.group.position.y + 0.012 + i * 0.0006;
      const faceUp = r() < 0.7;
      const bounce = 0.05 + r() * 0.03;

      t.to(mesh.position, { x: crackX, y: crackY, z: (r() - 0.5) * 0.06, duration: 0.12, ease: 'power2.out' }, CRACK);
      t.to(mesh.position, { y: floor, duration: fall, ease: 'power2.in' }, start);
      t.to(mesh.position, {
        x: crackX * 1.25 + (r() - 0.5) * 0.8,
        z: 0.3 + r() * 0.9,
        duration: fall + 0.18,
        ease: 'power1.out',
      }, start);
      t.to(mesh.rotation, {
        x: (faceUp ? -1 : 1) * Math.PI / 2 + (r() - 0.5) * 0.1,
        z: (r() - 0.5) * 3,
        duration: fall,
        ease: 'power1.in',
      }, start);
      t.to(mesh.position, { y: () => floor() + bounce, duration: 0.09, ease: 'power2.out' }, start + fall);
      t.to(mesh.position, { y: floor, duration: 0.09, ease: 'power2.in' }, start + fall + 0.09);
    });

    t.to(set.uniforms.uOpacity, { value: 0, duration: 0.32, ease: 'sine.in' }, BEAT.knockOut - 0.32);
    t.call(() => { set.group.visible = false; }, [], BEAT.knockOut);
    return t;
  };

  const victory = (winner: Side): Timeline => {
    const survivors = [...model.values()]
      .filter((e) => e.side === winner && e.status !== 'out')
      .sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : a.slot - b.slot));
    const losers = [...model.values()].filter((e) => e.side !== winner && e.status !== 'out');

    const lineup = (i: number): Pose => {
      const n = survivors.length;
      const aspect = stage.aspectRatio;
      const span = 2 * slotPosition('blue', 'active', aspect).x + CARD_WIDTH * 1.3;
      const spacing = Math.min(2.9, span / Math.max(1, n - 1));
      const offset = i - (n - 1) / 2;
      return {
        position: new Vector3(offset * spacing, CARD_HEIGHT / 2 + CARD_HOVER + 0.5, 0.4 - Math.abs(offset) * 0.35),
        rotationY: 0.38 - offset * 0.06,
      };
    };

    if (reduced) {
      const t = timeline(REDUCED.beat);
      flushPending(t);
      for (const e of survivors) tintTo(t, e.id, INK, 1, 0.12, 'sine.in', 0);
      t.call(() => {
        survivors.forEach((e, i) => {
          stage.setRole(e.id, null);
          snapTo(e.id, lineup(i));
        });
        for (const e of losers) setTintNow(e.id, INK, 0.5);
        stage.setKeyTint(SIDE_COLOR[winner], 0.35);
        rig.cut('victory');
      }, [], 0.12);
      for (const e of survivors) tintTo(t, e.id, INK, 0, 0.18, 'sine.out', 0.12);
      return t;
    }

    const t = timeline(BEAT.victory);
    flushPending(t);
    survivors.forEach((e, i) => {
      t.call(() => stage.setRole(e.id, null), [], 0);
      poseTo(t, e.id, () => lineup(i), { duration: 1.1, ease: GSAP_EASE.outExpo }, 0.15 + i * 0.1);
      glint(t, e.id, 1.6, 0.8, 0.9 + i * 0.1);
    });
    for (const e of losers) {
      tintTo(t, e.id, INK, 0.5, 0.6, 'sine.inOut', 0.2);
      const { group } = stage.card(e.id);
      t.to(group.position, { z: `-=${0.6}`, duration: 1, ease: GSAP_EASE.standard }, 0.2);
    }
    keyTo(t, SIDE_COLOR[winner], 0.35, 1, 0);

    // Glide to the victory framing, then a slow orbit that settles and holds.
    const ORBIT = 0.38;
    cameraTo(t, () => rig.shot('victory'), 1.1, 'power2.inOut', 0);
    // The framing is resolved once when the orbit starts; each frame only rotates a stored
    // offset about the target (no allocation, no shot maths per frame).
    const k = { v: 0 };
    const centre = new Vector3();
    const offset = new Vector3();
    t.to(k, {
      v: ORBIT,
      duration: BEAT.victory - 1.1,
      ease: 'sine.inOut',
      onStart: () => {
        const shot = rig.shot('victory');
        centre.copy(shot.target);
        offset.subVectors(shot.position, shot.target);
      },
      onUpdate: () => {
        rig.position.copy(offset).applyAxisAngle(AXIS_Y, k.v).add(centre);
        rig.target.copy(centre);
      },
      onComplete: () => rig.cut('victory', ORBIT),
    }, 1.1);
    return t;
  };

  return {
    intro,
    dealIn,
    anticipate,
    lunge,
    impact,
    knockOut,
    victory,
    dispose() {
      pool.dispose();
      shatter.dispose();
    },
  };
}

/** A point `distance` in front of a card's face (along its yaw-facing normal). */
function facePoint(pose: Pose, distance: number, out: Vector3): Vector3 {
  return out.set(Math.sin(pose.rotationY), 0, Math.cos(pose.rotationY)).multiplyScalar(distance).add(pose.position);
}
