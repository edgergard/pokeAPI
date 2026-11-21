import { describe, expect, it } from 'vitest';
import { DirectionalLight, Group, Mesh, PlaneGeometry, Points, Scene, ShaderMaterial, Texture } from 'three';
import type { BattleEvent, Fighter, Move, Side } from '@/entities/battle';
import { choreograph } from '../model/choreograph';
import type { StageDirector } from '../model/director';
import type { BattleStage } from './BattleStage';
import { CameraRig } from './cameraRig';
import { createStageDirector } from './director3d';
import { createHoloShared, HoloMaterial } from './holoMaterial';
import { type SlotRole, slotPosition, slotYaw } from './layout';

/*
 * The director against a stand-in stage: real scene graph, camera rig and holo materials,
 * everything renderer-bound left out. Playback is stepped at 60 fps like the real ticker.
 */

const ember: Move = { name: 'ember', type: 'fire', power: 40, accuracy: 100, damageClass: 'special' };
const bubble: Move = { name: 'bubble', type: 'water', power: 40, accuracy: 100, damageClass: 'special' };

function fighter(side: Side, slot: number): Fighter {
  return {
    id: `${side}-${slot}`, side, slot, name: `${side} ${slot}`, pokemonId: 1, types: ['fire'], artwork: null,
    stats: { hp: 100, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 }, moves: [],
  };
}

function fakeStage(perSide = 3) {
  const scene = new Scene();
  const camera = new CameraRig(16 / 9, { reducedMotion: false });
  const key = new DirectionalLight('#fff3e0');
  const shared = createHoloShared();
  const fighters = (['red', 'blue'] as const).flatMap((side) => Array.from({ length: perSide }, (_, i) => fighter(side, i)));
  const roles = new Map<string, { role: SlotRole | null; faceDown: boolean }>();
  const tints = new Map<string, number>();
  /** Highest tint each card reached since the last `peaks.clear()`. */
  const peaks = new Map<string, number>();
  const makeCards = () => new Map(fighters.map((f) => {
    const pivot = new Group();
    const face = new Mesh(new PlaneGeometry(), new HoloMaterial({ map: new Texture(), color: '#ff6a3d', shared, phase: 0 }));
    const back = new Mesh(new PlaneGeometry(), new HoloMaterial({ map: new Texture(), color: '#ff7a66', shared, phase: 0 }));
    back.name = 'back';
    pivot.add(face, back);
    const group = new Group();
    group.add(pivot);
    scene.add(group);
    const setTint = (_c: string, amount: number) => {
      tints.set(f.id, amount);
      peaks.set(f.id, Math.max(peaks.get(f.id) ?? 0, amount));
    };
    return [f.id, { group, pivot, face, fighter: f, setTint }];
  }));
  let cards = makeCards();
  /** Like `BattleStage.load()` again: the old cards (and their textures) are replaced. */
  const reload = () => {
    for (const c of cards.values()) scene.remove(c.group);
    cards = makeCards();
  };
  const card = (id: string) => {
    const c = cards.get(id);
    if (!c) throw new Error(id);
    return c;
  };
  /** Mutable like the real canvas: `resize(aspect)` mimics a window resize mid-beat. */
  let aspect = 16 / 9;
  const resize = (next: number) => { aspect = next; };
  const slotFor = (id: string, role: SlotRole, faceDown = false) => {
    const { side } = card(id).fighter;
    return {
      position: slotPosition(side, role, aspect),
      rotationY: slotYaw(side, role) + (faceDown ? (side === 'red' ? Math.PI : -Math.PI) : 0),
    };
  };
  const stage = {
    scene,
    camera,
    lights: { key },
    fighters,
    aspectRatio: 16 / 9,
    card,
    pivot: (id: string) => card(id).pivot,
    slotFor,
    home: (id: string) => {
      const r = roles.get(id);
      return r?.role ? slotFor(id, r.role, r.faceDown) : null;
    },
    setRole: (id: string, role: SlotRole | null, faceDown = false) => void roles.set(id, { role, faceDown }),
    setKeyTint: () => {},
  };
  return { stage: stage as unknown as BattleStage, card, roles, tints, peaks, scene, camera, reload, resize };
}

const BATTLE: BattleEvent[] = [
  { kind: 'enter', turn: 0, fighterId: 'red-0' },
  { kind: 'enter', turn: 0, fighterId: 'blue-0' },
  { kind: 'turnStart', turn: 1 },
  { kind: 'move', turn: 1, attackerId: 'red-0', targetId: 'blue-0', move: ember },
  { kind: 'hit', turn: 1, attackerId: 'red-0', targetId: 'blue-0', damage: 90, effectiveness: 2, critical: true, hpBefore: 90, hpAfter: 0 },
  { kind: 'ko', turn: 1, fighterId: 'blue-0' },
  { kind: 'enter', turn: 2, fighterId: 'blue-1' },
  { kind: 'turnStart', turn: 2 },
  { kind: 'move', turn: 2, attackerId: 'blue-1', targetId: 'red-0', move: bubble },
  { kind: 'miss', turn: 2, attackerId: 'blue-1', targetId: 'red-0' },
  { kind: 'move', turn: 2, attackerId: 'red-0', targetId: 'blue-1', move: ember },
  { kind: 'hit', turn: 2, attackerId: 'red-0', targetId: 'blue-1', damage: 5, effectiveness: 0.5, critical: false, hpBefore: 90, hpAfter: 85 },
  { kind: 'move', turn: 3, attackerId: 'red-0', targetId: 'blue-1', move: ember },
  { kind: 'noEffect', turn: 3, attackerId: 'red-0', targetId: 'blue-1' },
  { kind: 'end', turn: 3, winner: 'red', reason: 'turnCap', summary: [] },
];

function run(events: BattleEvent[], director: StageDirector) {
  const { timeline, seconds } = choreograph(events, director, { onEvent: () => {} });
  for (let t = 0; t <= seconds + 1 / 60; t += 1 / 60) timeline.time(Math.min(t, seconds));
  return { timeline, seconds };
}

function play(events: BattleEvent[], reducedMotion = false) {
  const fake = fakeStage();
  const director = createStageDirector(fake.stage, { reducedMotion });
  return { ...fake, director, ...run(events, director) };
}

/** Plays one beat to its end at 60 fps, outside any choreography. */
function step(beat: gsap.core.Timeline) {
  beat.pause(0);
  for (let t = 0; t <= beat.duration() + 1 / 60; t += 1 / 60) beat.time(Math.min(t, beat.duration()));
  beat.kill();
}

const visibleFx = (scene: Scene) => scene.children.filter((c) => c instanceof Points && c.visible).length;

describe('createStageDirector', () => {
  it('pins every beat to the pacing in the Global Constraints', () => {
    const { stage } = fakeStage();
    const d = createStageDirector(stage, { reducedMotion: false });
    const built: gsap.core.Timeline[] = [];
    const len = (tl: gsap.core.Timeline) => (built.push(tl.pause()), tl.duration());
    expect(len(d.intro())).toBeCloseTo(2);
    expect(len(d.dealIn('red-0'))).toBeCloseTo(0.9);
    expect(len(d.dealIn('blue-0'))).toBeCloseTo(0.9);
    expect(len(d.anticipate('red-0', ember, 'full'))).toBeCloseTo(0.4);
    expect(len(d.lunge('red-0', 'blue-0', ember, 'full'))).toBeCloseTo(0.5);
    expect(len(d.impact('blue-0', 'hit', { damage: 9, effectiveness: 1, critical: false }, 'full'))).toBeCloseTo(0.6);
    const short = len(d.lunge('red-0', 'blue-0', ember, 'short')) + len(d.impact('blue-0', 'miss', null, 'short'));
    expect(short).toBeCloseTo(0.7);
    expect(len(d.knockOut('blue-0'))).toBeCloseTo(1.2);
    expect(len(d.victory('red'))).toBeGreaterThanOrEqual(2);
    for (const tl of built) tl.kill();
    d.dispose();
  });

  it('keeps every reduced-motion beat to a fade or cut of at most 0.3 s', () => {
    const { stage } = fakeStage();
    const d = createStageDirector(stage, { reducedMotion: true });
    const beats = [
      d.intro(), d.dealIn('red-0'), d.dealIn('blue-0'),
      d.anticipate('red-0', ember, 'full'), d.lunge('red-0', 'blue-0', ember, 'full'),
      d.impact('blue-0', 'hit', { damage: 9, effectiveness: 4, critical: true }, 'full'),
      d.knockOut('blue-0'), d.victory('red'),
    ];
    for (const beat of beats) {
      beat.kill();
      expect(beat.duration()).toBeLessThanOrEqual(0.3 + 1e-9);
    }
  });

  it('plays a whole battle to a clean, settled end state', () => {
    const { card, roles, tints, scene, camera } = play(BATTLE);
    // The KO'd card is gone; its shards fell, faded and were hidden.
    expect(card('blue-0').group.visible).toBe(false);
    const shards = scene.getObjectByName('blue-0-shards');
    expect(shards?.visible).toBe(false);
    // Blue's replacement holds the active slot; the rest of Blue's bench moved up, face-down.
    expect(roles.get('blue-1')).toEqual({ role: 'active', faceDown: false });
    expect(roles.get('blue-2')).toEqual({ role: { bench: 0 }, faceDown: true });
    // Red's survivors left their slots for the victory line-up, face-up and lifted.
    for (const id of ['red-0', 'red-1', 'red-2']) {
      expect(roles.get(id)?.role).toBeNull();
      const { group } = card(id);
      expect(Math.abs(group.rotation.y)).toBeLessThan(Math.PI / 2);
      expect(group.position.y).toBeGreaterThan(slotPosition('red', 'active', 16 / 9).y + 0.4);
    }
    expect(tints.get('red-0')).toBeCloseTo(0);
    // Nothing transient is left over: no FX, no shake, no stray tilt; the camera holds the victory orbit.
    expect(visibleFx(scene)).toBe(0);
    expect(camera.shake.length()).toBe(0);
    expect(card('blue-1').pivot.position.x).toBe(0);
    expect(camera.held?.name).toBe('victory');
  });

  it('breaks a card the same way on every run and on a replay', () => {
    const shardState = (scene: Scene) => scene.getObjectByName('blue-0-shards')?.children
      .map((m) => [m.position.x, m.position.y, m.position.z, m.rotation.x, m.rotation.z].map((v) => v.toFixed(5)).join());
    const koOnly = BATTLE.slice(0, 6);
    const a = play(koOnly);
    const b = play(koOnly);
    expect(shardState(a.scene)).toEqual(shardState(b.scene));

    const replay = choreograph(koOnly, a.director, { onEvent: () => {} });
    for (let t = 0; t <= replay.seconds + 1 / 60; t += 1 / 60) replay.timeline.time(Math.min(t, replay.seconds));
    expect(shardState(a.scene)).toEqual(shardState(b.scene));
  });

  it('reaches the same end state with reduced motion (fades instead of shatter)', () => {
    const { card, roles, scene, camera } = play(BATTLE, true);
    expect(card('blue-0').group.visible).toBe(false);
    expect(scene.getObjectByName('blue-0-shards')).toBeUndefined();
    expect(roles.get('blue-1')).toEqual({ role: 'active', faceDown: false });
    expect(roles.get('red-0')?.role).toBeNull();
    expect(visibleFx(scene)).toBe(0);
    expect(camera.held?.name).toBe('victory');
  });

  it('rebuilds shards after the stage reloads, instead of reusing the previous battle cards', () => {
    const fake = fakeStage();
    const director = createStageDirector(fake.stage, { reducedMotion: false });
    const koOnly = BATTLE.slice(0, 6);
    run(koOnly, director);
    fake.reload();
    const face = fake.card('blue-0').face.material;
    if (!(face instanceof HoloMaterial)) throw new Error('face');
    run(koOnly, director);
    const groups = fake.scene.children.filter((c) => c.name === 'blue-0-shards');
    expect(groups).toHaveLength(1);
    const shard = groups[0]?.children[0];
    const material = shard instanceof Mesh ? shard.material : null;
    expect(material).toBeInstanceOf(ShaderMaterial);
    expect((material as ShaderMaterial).uniforms.uFace?.value).toBe(face.uniforms.uMap.value);
    director.dispose();
    expect(fake.scene.children.filter((c) => c.name.endsWith('-shards'))).toHaveLength(0);
  });

  it('lands a dealt-in card and the shuffling bench on their new slots after a resize mid-beat', () => {
    const fake = fakeStage();
    const director = createStageDirector(fake.stage, { reducedMotion: false });
    step(director.intro());
    const beat = director.dealIn('red-0').pause(0);
    for (let t = 0; t <= 0.5; t += 1 / 60) beat.time(t);
    const portrait = 9 / 16; // e.g. a phone rotated mid-battle
    fake.resize(portrait);
    for (let t = 0.5; t <= beat.duration() + 1 / 60; t += 1 / 60) beat.time(Math.min(t, beat.duration()));
    beat.kill();
    const at = (id: string) => fake.card(id).group.position;
    expect(at('red-0').distanceTo(slotPosition('red', 'active', portrait))).toBeLessThan(1e-6);
    expect(at('red-1').distanceTo(slotPosition('red', { bench: 0 }, portrait))).toBeLessThan(1e-6);
    expect(at('red-2').distanceTo(slotPosition('red', { bench: 1 }, portrait))).toBeLessThan(1e-6);
    director.dispose();
  });

  it.each([false, true])('never flashes twice within 350 ms of wall-clock time (reduced motion: %s)', (reducedMotion) => {
    let clock = 1000;
    const fake = fakeStage();
    const director = createStageDirector(fake.stage, { reducedMotion, now: () => clock });
    const accent = { damage: 50, effectiveness: 2 as const, critical: true };
    const flash = () => {
      fake.peaks.clear();
      step(director.impact('blue-0', 'hit', accent, 'full'));
      return fake.peaks.get('blue-0') ?? 0;
    };
    expect(flash()).toBeGreaterThan(0.2);
    clock += 200; // e.g. ×2 speed or compressed beats: the next hit lands too soon
    expect(flash()).toBe(0);
    clock += 200; // 400 ms after the last flash
    expect(flash()).toBeGreaterThan(0.2);
    director.dispose();
  });
});
