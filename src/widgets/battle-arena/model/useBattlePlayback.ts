import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { simulateBattle, type BattleEvent, type BattleTeam, type Fighter } from '@/entities/battle';
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
};

export type BattlePlayback = {
  hud: HudState;
  log: string[];
  speed: Speed;
  setSpeed(s: Speed): void;
  replay(): void;
  /** False once the arena knows it is running without the 3D stage. */
  webgl: boolean;
  ready: boolean;
  /** The timeline has played to its end (the victory beat is over): time for the result screen. */
  finished: boolean;
  notice: StageNotice;
  /** Screen position of a fighter's card face right now (null without a 3D stage). */
  project(fighterId: string): Projection | null;
};

// The stage pulls in three.js: load it only once a battle is on screen, in its own chunk.
const loadStage = () => Promise.all([import('../stage/BattleStage'), import('../stage/director3d')]);

/**
 * A disposed stage force-loses its canvas's context, so a canvas can host one stage only.
 * The arena gives every new stage a fresh <canvas> (keyed); this guards against reuse anyway.
 */
const spentCanvases = new WeakSet<HTMLCanvasElement>();

/**
 * Plays one simulated battle: builds the stage (or the null director without WebGL),
 * choreographs the events, feeds the HUD and the log, and owns every timeline and GPU resource.
 */
export function useBattlePlayback({ red, blue, seed, canvas, reducedMotion }: Args): BattlePlayback {
  const events = useMemo(() => simulateBattle(red, blue, seed).events, [red, blue, seed]);
  const fighters = useMemo<Record<string, Fighter>>(
    () => Object.fromEntries([...red.fighters, ...blue.fighters].map((f) => [f.id, f])),
    [red, blue],
  );
  const indexOf = useMemo(() => new Map<BattleEvent, number>(events.map((e, i) => [e, i])), [events]);
  const trainers = useMemo(() => ({ red: red.trainerName, blue: blue.trainerName }), [red, blue]);

  const [hud, setHud] = useState(() => initialHud(red, blue));
  const [log, setLog] = useState<string[]>([]);
  const [speed, setSpeedState] = useState<Speed>(1);
  const [webgl, setWebgl] = useState(true);
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState<StageNotice>(null);

  const timelineRef = useRef<Timeline | null>(null);
  const directorRef = useRef<StageDirector | null>(null);
  const stageRef = useRef<BattleStage | null>(null);
  const speedRef = useRef<Speed>(1);
  /** How many events (a prefix of `events`) the HUD and log already show. */
  const deliveredRef = useRef(0);
  const deliveredForRef = useRef(events);

  // A new battle (teams or seed) starts from scratch; a motion rebuild of the same one resumes.
  if (deliveredForRef.current !== events) {
    deliveredForRef.current = events;
    deliveredRef.current = 0;
  }

  const onEvent = useCallback((event: BattleEvent) => {
    const index = indexOf.get(event) ?? -1;
    // A rebuilt timeline re-runs earlier beats on its way to the resume point: already shown.
    if (index < deliveredRef.current) return;
    deliveredRef.current = index + 1;
    setHud((s) => reduceHud(s, event));
    const line = describeEvent(event, fighters, trainers);
    if (line) setLog((l) => [...l, line]);
  }, [indexOf, fighters, trainers]);

  /** (Re)builds the timeline on the current director and plays it from event `from` onward. */
  const play = useCallback((director: StageDirector, from: number) => {
    timelineRef.current?.kill();
    const { timeline } = choreograph(events, director, { onEvent });
    timeline.timeScale(speedRef.current);
    timeline.eventCallback('onComplete', () => setFinished(true));
    timelineRef.current = timeline;
    const plan = resumePlan(from, events.length);
    if (plan.kind === 'finished') {
      // Rebuilt after the battle ended (motion flip): land on the end state without replaying
      // the victory beat, and leave the result screen where it is.
      timeline.progress(1, false);
      setFinished(true);
      return;
    }
    setFinished(false);
    // Re-run the earlier beats instantly (scene state catches up), then play from the beat that
    // reported the last shown event.
    if (plan.kind === 'resume') timeline.seek(resumeTime(timeline, plan.from - 1), false);
    if (!document.hidden) timeline.play();
  }, [events, onEvent]);

  // One session per (battle, canvas, motion setting): stage + director + timeline.
  useEffect(() => {
    let cancelled = false;
    let stage: BattleStage | null = null;
    let director: (StageDirector & { dispose?(): void }) | null = null;
    let observer: ResizeObserver | null = null;
    setReady(false);

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
      setReady(true);
      play(director, deliveredRef.current);
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
  }, [events, canvas, reducedMotion, red, blue, play]);

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

  const setSpeed = useCallback((s: Speed) => {
    speedRef.current = s;
    setSpeedState(s);
    timelineRef.current?.timeScale(s);
  }, []);

  /** Never a no-op: mid-rebuild (no director yet) the reset stands and the new session starts from the intro. */
  const replay = useCallback(() => {
    deliveredRef.current = 0;
    setHud(initialHud(red, blue));
    setLog([]);
    setFinished(false);
    const director = directorRef.current;
    if (director) play(director, 0); // same events (same seed): the intro beat resets the scene
  }, [red, blue, play]);

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

  return { hud, log, speed, setSpeed, replay, webgl, ready, finished, notice, project };
}
