import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BattleResult, BattleTeam } from '@/entities/battle';
import { cn } from '@/shared/lib/cn';
import { usePrefersReducedMotion } from '@/shared/lib/motion';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { describeResult, type HudState } from '../model/hudState';
import { useBattlePlayback, type StageNotice } from '../model/useBattlePlayback';
import { useSkipCountdown } from '../model/useSkipCountdown';
import { BattleLog } from './BattleLog';
import { Hud } from './Hud';
import { ResultOverlay } from './ResultOverlay';

/** What a custom result screen can do with the arena. */
export type ResultActions = {
  /** Plays the same battle again (same seed); focus moves to the HUD's Replay control. */
  replay(): void;
};

export type BattleArenaProps = {
  /** The player's side. Both teams hold the same number of fighters, 1–4 (N×N). */
  red: BattleTeam;
  blue: BattleTeam;
  /** Same teams + seed = the same battle, every time (Replay, a reload, another browser). */
  seed: number;
  /**
   * The onboarding battle (Must #1): Skip unlocks after 5 s, and every exchange plays its full beat
   * so the short battle is paced as a showcase.
   */
  intro?: boolean;
  /**
   * Called once per battle when its playback first ends, or on Skip (the result screen shows at the
   * same moment). Replays and Motion rebuilds don't call it again: record rewards here.
   */
  onFinished?: (result: BattleResult) => void;
  /**
   * Renders the result screen in place of the default overlay (rewards, quest ticks, hints). It is
   * rendered inside the arena box (`position: relative`; the HUD below is inert meanwhile): use an
   * `absolute inset-0` overlay or similar, and move focus to its main button on mount.
   */
  renderResult?: (result: BattleResult, actions: ResultActions) => ReactNode;
  /**
   * The one phrase the arena's status region announces when the result screen appears
   * (e.g. "Victory. 1 capsule earned."). Default: "<Trainer> wins by knockout."
   */
  resultMessage?: (result: BattleResult) => string;
  /** Legacy watch-only battle: a "New battle" button back to the team picker. */
  onNewBattle?: () => void;
};

const NOTICE: Record<Exclude<StageNotice, null>, string> = {
  unsupported: '3D isn’t available on this device — showing the battle log.',
  error: 'The 3D stage couldn’t load — showing the battle log.',
  lost: 'Graphics paused while the browser recovers the 3D view. The battle log keeps going.',
};

/** The battle: 3D stage (or text fallback), HUD, controls, battle log and result screen. */
export function BattleArena({
  red,
  blue,
  seed,
  intro = false,
  onFinished,
  renderResult,
  resultMessage,
  onNewBattle,
}: BattleArenaProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const playback = useBattlePlayback({
    red,
    blue,
    seed,
    canvas,
    reducedMotion,
    intro,
    onFinished,
  });
  const { hud, log, webgl, ready, notice, result } = playback;
  const showResult = hud.result !== null && playback.finished;
  const skipIn = useSkipCountdown(intro, ready);
  const trainers = useMemo(() => ({ red: red.trainerName, blue: blue.trainerName }), [red, blue]);
  const announcement = showResult
    ? (resultMessage?.(result) ?? describeResult(result, trainers))
    : '';

  // The result screen's Replay unmounts the screen while it holds focus: hand focus to the HUD's
  // Replay control (or the arena itself while the stage rebuilds) instead of dropping it to <body>.
  const arenaRef = useRef<HTMLDivElement>(null);
  const hudReplayRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const replayFromResult = () => {
    refocus.current = true;
    playback.replay();
  };
  useEffect(() => {
    if (showResult || !refocus.current) return;
    refocus.current = false;
    const button = hudReplayRef.current;
    (button && !button.disabled ? button : arenaRef.current)?.focus({ preventScroll: true });
  }, [showResult]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={arenaRef}
        tabIndex={-1}
        aria-label="Arena"
        data-phase={!ready ? 'loading' : showResult ? 'result' : 'playing'}
        className="relative isolate aspect-[4/5] w-full overflow-hidden rounded-3xl border border-white/10 bg-ink-950 focus:outline-none min-[480px]:aspect-[4/3] md:aspect-video"
      >
        {/* A disposed stage force-loses its context, so every stage gets a new canvas (Motion flips, Retry). */}
        <canvas
          key={`${seed}:${reducedMotion ? 'reduced' : 'full'}:${playback.stageAttempt}`}
          ref={setCanvas}
          aria-hidden="true"
          className={cn('absolute inset-0 block size-full', !webgl && 'hidden')}
        />

        {!ready && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-3 text-sm text-ink-300">
              <Spinner className="size-7" label="Preparing arena" />
              Preparing arena
            </div>
          </div>
        )}

        <Hud
          red={red}
          blue={blue}
          hud={hud}
          ready={ready}
          speed={playback.speed}
          onSpeed={playback.setSpeed}
          onReplay={playback.replay}
          onSkip={playback.skip}
          canSkip={ready && !playback.finished}
          skipIn={skipIn}
          onNewBattle={onNewBattle}
          project={playback.project}
          inert={showResult}
          replayRef={hudReplayRef}
        >
          {!webgl && ready && <LogStage red={red} blue={blue} hud={hud} lines={log} />}
        </Hud>

        {notice && (
          <div className="absolute inset-x-3 bottom-16 z-[5] mx-auto flex w-fit max-w-sm flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-white/12 bg-ink-900/90 px-3 py-2 text-center">
            <p role="status" className="text-xs text-ink-200">
              {NOTICE[notice]}
            </p>
            {notice === 'error' && (
              <Button
                variant="outline"
                size="md"
                onClick={playback.retryStage}
                className="cursor-pointer"
              >
                Retry
              </Button>
            )}
          </div>
        )}

        {showResult &&
          (renderResult ? (
            <CustomResult render={renderResult} result={result} onReplay={replayFromResult} />
          ) : (
            <ResultOverlay
              result={result}
              red={red}
              blue={blue}
              onReplay={replayFromResult}
              onNewBattle={onNewBattle}
            />
          ))}

        {/* Always mounted, so the result is reliably announced in one phrase when it appears. */}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </div>

      <BattleLog lines={log} quiet={playback.skipped} />
    </div>
  );
}

/** The caller's result screen, called from its own component (not during the arena's render). */
function CustomResult({
  render,
  result,
  onReplay,
}: {
  render: NonNullable<BattleArenaProps['renderResult']>;
  result: BattleResult;
  onReplay(): void;
}) {
  return render(result, { replay: onReplay });
}

const SIDE_RING = { red: 'ring-side-red/70', blue: 'ring-side-blue/70' } as const;

/**
 * Without the 3D stage the arena tells the battle in text: both lineups (1–4 per side, who is in,
 * on the bench or out) and the latest log lines. Decorative for assistive tech: the HUD and the
 * live region carry the same information.
 */
function LogStage({
  red,
  blue,
  hud,
  lines,
}: {
  red: BattleTeam;
  blue: BattleTeam;
  hud: HudState;
  lines: string[];
}) {
  const recent = lines.slice(-3);
  return (
    <div
      className="flex h-full min-h-0 flex-col items-center justify-center gap-3 px-1 sm:gap-4 sm:px-6"
      aria-hidden
    >
      <div className="grid w-full max-w-xl grid-cols-2 gap-2 sm:gap-6">
        {[red, blue].map((team) => (
          <ol
            key={team.side}
            className={cn('flex min-w-0 flex-col gap-1', team.side === 'blue' && 'text-right')}
          >
            {team.fighters.map((f) => {
              const ko = hud.ko.has(f.id);
              const active = hud.active[team.side] === f.id;
              const hp = hud.hp[f.id];
              return (
                <li
                  key={f.id}
                  className={cn(
                    'flex min-w-0 items-baseline justify-between gap-2 rounded-lg bg-ink-950/60 px-2 py-1 text-xs sm:text-sm',
                    team.side === 'blue' && 'flex-row-reverse',
                    active && !ko && cn('ring-1', SIDE_RING[team.side]),
                    ko && 'text-ink-400',
                  )}
                >
                  <span className={cn('truncate font-semibold', ko && 'line-through')}>
                    {f.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-ink-300 tabular-nums">
                    {ko ? (
                      'KO'
                    ) : (
                      <>
                        <span className="max-sm:hidden">Lv {f.level} · </span>
                        {hp?.current ?? f.stats.hp} HP
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        {recent.map((line, i) => (
          <p
            key={lines.length - recent.length + i}
            className={cn(
              'max-w-xl text-sm sm:text-base',
              i === recent.length - 1 ? 'font-semibold text-ink-100' : 'text-ink-400',
            )}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
