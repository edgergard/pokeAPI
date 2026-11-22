import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from 'react';
import {
  simulateBattle,
  type BattleEvent,
  type BattleResult,
  type BattleTeam,
  type Fighter,
} from '@/entities/battle';
import type { gsap } from '@/shared/lib/gsap';
import type { BattleStage } from '../stage/BattleStage';
import { choreograph, resumeTime } from './choreograph';
import type { StageDirector } from './director';
import { describeEvent, initialHud, reduceHud, type HudState } from './hudState';
import { createNullDirector } from './nullDirector';
import { fallbackNotice, resumePlan, type StageNotice } from './session';

type Timeline = ReturnType<typeof gsap.timeline>;
type Speed = 1 | 2;

export type { StageNotice } from './session';

/** Canvas position on a fighter's card face, as fractions of the canvas (0..1, y down). */
export type Projection = { x: number; y: number };

type Args = {
  red: BattleTeam;
  blue: BattleTeam;
  seed: number;
  canvas: HTMLCanvasElement | null;
  reducedMotion: boolean;
  /** The onboarding battle: every exchange plays its full beat (showcase pacing). */
  intro?: boolean;
  /**
   * Called once per battle (teams + seed) when its playback first ends, or on Skip. Replays and
   * motion rebuilds don't call it again, so callers can record rewards here.
   */
  onFinished?(result: BattleResult): void;
};

export type BattlePlayback = {
  hud: HudState;
  log: string[];
  /** The simulated outcome (known before playback starts). */
  result: BattleResult;
  speed: Speed;
  setSpeed(s: Speed): void;
  replay(): void;
  /**
   * Jumps to the end state: the remaining events are delivered at once, the stage lands on its
   * victory pose, the result screen shows and `onFinished` fires (once per battle).
   */
  skip(): void;
  /** True from a Skip until Replay: the jumped-over log lines are not read out. */
  skipped: boolean;
  /** False once the arena knows it is running without the 3D stage. */
  webgl: boolean;
  ready: boolean;
  /** The timeline has played to its end (the victory beat is over): time for the result screen. */
  finished: boolean;
  notice: StageNotice;
  /** Builds the 3D stage again after a load error, on a fresh canvas; the battle resumes where it is. */
  retryStage(): void;
  /** Bumped by `retryStage`: part of the canvas key, so every attempt gets a fresh canvas. */
  stageAttempt: number;
  /** Screen position of a fighter's card face right now (null without a 3D stage). */
  project(fighterId: string): Projection | null;
};

// The stage pulls in three.js: load it only once a battle is on screen, in its own chunk.
const loadStage = () =>
  Promise.all([import('../stage/BattleStage'), import('../stage/director3d')]);

/**
 * A disposed stage force-loses its canvas's context, so a canvas can host one stage only.
 * The arena gives every new stage a fresh <canvas> (keyed); this guards against reuse anyway.
 */
const spentCanvases = new WeakSet<HTMLCanvasElement>();

/** State that belongs to one battle: a new battle (teams or seed) reads as the initial value. */
type PerBattle<T> = { events: BattleEvent[]; value: T };

/** One stage session: a battle on a canvas with a motion setting. */
type Session = { events: BattleEvent[]; canvas: HTMLCanvasElement | null; reducedMotion: boolean };

const sameSession = (a: Session | null, b: Session) =>
  a !== null &&
  a.events === b.events &&
  a.canvas === b.canvas &&
  a.reducedMotion === b.reducedMotion;

/**
 * Plays one simulated battle: builds the stage (or the null director without WebGL),
 * choreographs the events, feeds the HUD and the log, and owns every timeline and GPU resource.
 */
export function useBattlePlayback({
  red,
  blue,
  seed,
  canvas,
  reducedMotion,
  intro = false,
  onFinished,
}: Args): BattlePlayback {
  const { events, result } = useMemo(() => simulateBattle(red, blue, seed), [red, blue, seed]);
  const fighters = useMemo<Record<string, Fighter>>(
    () => Object.fromEntries([...red.fighters, ...blue.fighters].map((f) => [f.id, f])),
    [red, blue],
  );
  const indexOf = useMemo(
    () => new Map<BattleEvent, number>(events.map((e, i) => [e, i])),
    [events],
  );
  const trainers = useMemo(() => ({ red: red.trainerName, blue: blue.trainerName }), [red, blue]);
  const freshHud = useMemo(() => initialHud(red, blue), [red, blue]);

  const [hudState, setHudState] = useState<PerBattle<HudState>>(() => ({
    events,
    value: freshHud,
  }));
  const [logState, setLogState] = useState<PerBattle<string[]>>(() => ({ events, value: [] }));
  const [finishedFor, setFinishedFor] = useState<BattleEvent[] | null>(null);
  const [skippedFor, setSkippedFor] = useState<BattleEvent[] | null>(null);
  const [readyFor, setReadyFor] = useState<Session | null>(null);
  const [speed, setSpeedState] = useState<Speed>(1);
  const [webgl, setWebgl] = useState(true);
  const [notice, setNotice] = useState<StageNotice>(null);
  const [stageAttempt, setStageAttempt] = useState(0);

  const hud = hudState.events === events ? hudState.value : freshHud;
  const log = useMemo(() => (logState.events === events ? logState.value : []), [logState, events]);
  const finished = finishedFor === events;
  const skipped = skippedFor === events;
  const ready = sameSession(readyFor, { events, canvas, reducedMotion });

  /** Updates this battle's HUD (a previous battle's state counts as the initial one). */
  const setHud = useCallback(
    (update: SetStateAction<HudState>) =>
      setHudState((s) => {
        const current = s.events === events ? s.value : freshHud;
        return { events, value: typeof update === 'function' ? update(current) : update };
      }),
    [events, freshHud],
  );
  const setLog = useCallback(
    (update: (lines: string[]) => string[]) =>
      setLogState((s) => ({ events, value: update(s.events === events ? s.value : []) })),
    [events],
  );

  const timelineRef = useRef<Timeline | null>(null);
  const directorRef = useRef<StageDirector | null>(null);
  const stageRef = useRef<BattleStage | null>(null);
  const speedRef = useRef<Speed>(1);
  /** How many events (a prefix of `events`) the HUD and log already show, for this battle. */
  const deliveredRef = useRef<{ events: BattleEvent[]; count: number }>({ events, count: 0 });
  /** The battle `onFinished` was last called for. */
  const reportedRef = useRef<BattleResult | null>(null);

  /** Events of this battle already shown; a new battle (teams or seed) starts from scratch. */
  const deliveredCount = useCallback(
    () => (deliveredRef.current.events === events ? deliveredRef.current.count : 0),
    [events],
  );

  const onEvent = useCallback(
    (event: BattleEvent) => {
      const index = indexOf.get(event) ?? -1;
      // A rebuilt timeline re-runs earlier beats on its way to the resume point: already shown.
      if (index < deliveredCount()) return;
      deliveredRef.current = { events, count: index + 1 };
      setHud((s) => reduceHud(s, event));
      const line = describeEvent(event, fighters, trainers);
      if (line) setLog((l) => [...l, line]);
    },
    [events, indexOf, fighters, trainers, deliveredCount, setHud, setLog],
  );

  const markFinished = useCallback(() => setFinishedFor(events), [events]);

  /** (Re)builds the timeline on the current director and plays it from event `from` onward. */
  const play = useCallback(
    (director: StageDirector, from: number) => {
      timelineRef.current?.kill();
      const { timeline } = choreograph(events, director, { onEvent, fullExchanges: intro });
      timeline.timeScale(speedRef.current);
      timeline.eventCallback('onComplete', markFinished);
      timelineRef.current = timeline;
      const plan = resumePlan(from, events.length);
      if (plan.kind === 'finished') {
        // Rebuilt after the battle ended (motion flip): land on the end state without replaying
        // the victory beat, and leave the result screen where it is.
        timeline.progress(1, false);
        markFinished();
        return;
      }
      setFinishedFor(null);
      // Re-run the earlier beats instantly (scene state catches up), then play from the beat that
      // reported the last shown event.
      if (plan.kind === 'resume') timeline.seek(resumeTime(timeline, plan.from - 1), false);
      if (!document.hidden) timeline.play();
    },
    [events, onEvent, intro, markFinished],
  );

  // One session per (battle, canvas, motion setting): stage + director + timeline.
  useEffect(() => {
    let cancelled = false;
    let stage: BattleStage | null = null;
    let director: (StageDirector & { dispose?(): void }) | null = null;
    let observer: ResizeObserver | null = null;
    const session: Session = { events, canvas, reducedMotion };

    void (async () => {
      let mods: Awaited<ReturnType<typeof loadStage>> | null = null;
      try {
        mods = await loadStage();
      } catch {
        mods = null; // chunk failed to load (offline): the log still tells the battle
      }
      if (cancelled) return;

      if (mods && mods[0].BattleStage.isSupported()) {
        // Wait for a fresh canvas; the arena mounts a new one for every stage.
        if (!canvas || spentCanvases.has(canvas) || !canvas.isConnected) return;
        spentCanvases.add(canvas);
        const { BattleStage: Stage } = mods[0];
        try {
          const created = new Stage(canvas, { reducedMotion });
          stage = created;
          stageRef.current = created;
          created.onContextLost = () => setNotice('lost');
          created.onContextRestored = () => setNotice(null);
          observer = new ResizeObserver(([entry]) => {
            if (entry) created.resize(entry.contentRect.width, entry.contentRect.height);
          });
          observer.observe(canvas);
          created.start();
          await created.load(red, blue);
          if (cancelled) return;
          director = mods[1].createStageDirector(created, { reducedMotion });
          setWebgl(true);
          setNotice(null);
        } catch {
          // No context, a failed load or a director error: tell the battle through the log instead.
          if (cancelled) return;
          observer?.disconnect();
          observer = null;
          stage?.dispose();
          stage = null;
          stageRef.current = null;
          setWebgl(false);
          setNotice('error');
        }
      } else {
        setWebgl(false);
        setNotice(fallbackNotice({ chunkLoaded: mods !== null, supported: false }));
      }

      director ??= createNullDirector();
      directorRef.current = director;
      setReadyFor(session);
      play(director, deliveredCount());
      // The timeline is built (shard sets cut, FX emitters in the scene): compile their shaders now,
      // during the intro, rather than on the first effect / KO. Fire-and-forget; never blocks play.
      if (stage) void stage.prewarm();
    })();

    return () => {
      cancelled = true;
      timelineRef.current?.kill();
      timelineRef.current = null;
      directorRef.current = null;
      observer?.disconnect();
      director?.dispose?.();
      stage?.dispose();
      if (stageRef.current === stage) stageRef.current = null;
    };
  }, [events, canvas, reducedMotion, red, blue, play, deliveredCount]);

  // Hidden tab: hold the battle where it is (the stage pauses its own render loop).
  useEffect(() => {
    const onVisibility = () => {
      const timeline = timelineRef.current;
      if (!timeline) return;
      if (document.hidden) timeline.pause();
      else if (timeline.progress() < 1) timeline.play();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // The battle's playback ended (or was skipped): report it once per battle, never on a replay.
  const reportFinished = useEffectEvent((r: BattleResult) => onFinished?.(r));
  useEffect(() => {
    if (!finished || reportedRef.current === result) return;
    reportedRef.current = result;
    reportFinished(result);
  }, [finished, result]);

  const setSpeed = useCallback((s: Speed) => {
    speedRef.current = s;
    setSpeedState(s);
    timelineRef.current?.timeScale(s);
  }, []);

  /** Never a no-op: mid-rebuild (no director yet) the reset stands and the new session starts from the intro. */
  const replay = useCallback(() => {
    deliveredRef.current = { events, count: 0 };
    setHud(freshHud);
    setLog(() => []);
    setFinishedFor(null);
    setSkippedFor(null);
    const director = directorRef.current;
    if (director) play(director, 0); // same events (same seed): the intro beat resets the scene
  }, [events, freshHud, setHud, setLog, play]);

  const skip = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline || timeline.progress() >= 1) return;
    setSkippedFor(events);
    // Crossing every remaining beat delivers its events in order and leaves each tween at its end
    // state, so the HUD, the log and the stage all land exactly where a full playback would.
    timeline.progress(1, false);
    setHud((s) => ({ ...s, popups: [] }));
    markFinished();
  }, [events, setHud, markFinished]);

  const retryStage = useCallback(() => setStageAttempt((n) => n + 1), []);

  const project = useCallback((fighterId: string): Projection | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    try {
      const group = stage.card(fighterId).group;
      const point = group.position.clone();
      point.y += 0.9; // upper half of the card face (cards are 3.5 tall, centred on the group)
      point.project(stage.camera.camera);
      if (point.z > 1) return null; // behind the camera
      return { x: (point.x + 1) / 2, y: (1 - point.y) / 2 };
    } catch {
      return null; // cards not loaded yet
    }
  }, []);

  return {
    hud,
    log,
    result,
    speed,
    setSpeed,
    replay,
    skip,
    skipped,
    webgl,
    ready,
    finished,
    notice,
    retryStage,
    stageAttempt,
    project,
  };
}
