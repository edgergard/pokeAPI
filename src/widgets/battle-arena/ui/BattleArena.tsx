import { useEffect, useRef, useState } from 'react';
import type { BattleTeam } from '@/entities/battle';
import { cn } from '@/shared/lib/cn';
import { usePrefersReducedMotion } from '@/shared/lib/motion';
import { Spinner } from '@/shared/ui/Spinner';
import { useBattlePlayback, type StageNotice } from '../model/useBattlePlayback';
import { BattleLog } from './BattleLog';
import { Hud } from './Hud';
import { ResultOverlay } from './ResultOverlay';

export type BattleArenaProps = {
  red: BattleTeam;
  blue: BattleTeam;
  seed: number;
  onNewBattle(): void;
};

const NOTICE: Record<Exclude<StageNotice, null>, string> = {
  unsupported: '3D isn’t available on this device — showing the battle log.',
  error: 'The 3D stage couldn’t load — showing the battle log.',
  lost: 'Graphics paused while the browser recovers the 3D view. The battle log keeps going.',
};

/** The battle: 3D stage (or log fallback), HUD, controls, battle log and result screen. */
export function BattleArena({ red, blue, seed, onNewBattle }: BattleArenaProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const playback = useBattlePlayback({ red, blue, seed, canvas, reducedMotion });
  const { hud, log, webgl, ready, notice } = playback;
  const showResult = hud.result !== null && playback.finished;

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
        className="relative isolate aspect-[4/5] w-full overflow-hidden rounded-3xl border border-white/10 bg-ink-950 focus:outline-none min-[480px]:aspect-[4/3] md:aspect-video"
      >
        {/* A disposed stage force-loses its context, so every stage gets a new canvas (Motion flips rebuild). */}
        <canvas
          key={`${seed}:${reducedMotion ? 'reduced' : 'full'}`}
          ref={setCanvas}
          aria-hidden="true"
          className={cn('absolute inset-0 block size-full', !webgl && 'hidden')}
        />

        {!webgl && ready && <LogStage lines={log} />}

        {!ready && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-3 text-sm text-ink-300">
              <Spinner className="size-7" label="Setting the stage" />
              Setting the stage…
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
          onNewBattle={onNewBattle}
          project={playback.project}
          inert={showResult}
          replayRef={hudReplayRef}
        />

        {notice && (
          <p
            role="status"
            className="absolute inset-x-3 bottom-16 z-[5] mx-auto w-fit max-w-sm rounded-xl border border-white/12 bg-ink-900/90 px-3 py-2 text-center text-xs text-ink-200"
          >
            {NOTICE[notice]}
          </p>
        )}

        {showResult && hud.result && (
          <ResultOverlay
            result={hud.result}
            red={red}
            blue={blue}
            onReplay={replayFromResult}
            onNewBattle={onNewBattle}
          />
        )}
      </div>

      <BattleLog lines={log} />
    </div>
  );
}

/** Without the 3D stage the arena itself reads out the latest log lines (the live region announces them). */
function LogStage({ lines }: { lines: string[] }) {
  const recent = lines.slice(-3);
  return (
    <div
      className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1.5 px-6 text-center"
      aria-hidden
    >
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
  );
}
