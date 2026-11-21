import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Swords } from 'lucide-react';
import type { BattleTeam, Fighter, Side } from '@/entities/battle';
import { cn } from '@/shared/lib/cn';
import { formatName } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import type { HudPopup, HudState, PopupTone } from '../model/hudState';
import type { Projection } from '../model/useBattlePlayback';

type Props = {
  red: BattleTeam;
  blue: BattleTeam;
  hud: HudState;
  ready: boolean;
  speed: 1 | 2;
  onSpeed(s: 1 | 2): void;
  onReplay(): void;
  onNewBattle(): void;
  project(fighterId: string): Projection | null;
};

const SIDE_TEXT: Record<Side, string> = { red: 'text-side-red', blue: 'text-side-blue' };
const SIDE_BG: Record<Side, string> = { red: 'bg-side-red', blue: 'bg-side-blue' };
const SIDE_RING: Record<Side, string> = { red: 'ring-side-red', blue: 'ring-side-blue' };

/** The DOM layer over the canvas: real, readable text for everything the stage shows. */
export function Hud({ red, blue, hud, ready, speed, onSpeed, onReplay, onNewBattle, project }: Props) {
  const fighters = [...red.fighters, ...blue.fighters];
  const started = hud.active.red !== null || hud.active.blue !== null;
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <TeamBar team={red} hud={hud} />
        <TeamBar team={blue} hud={hud} />
      </div>

      {ready && !started && <TitleCard red={red} blue={blue} />}
      {hud.lastMove && !hud.result && <MoveBanner move={hud.lastMove} side={sideOf(hud.lastMove.attackerId)} />}

      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        {hud.popups.map((p) => (
          <Popup key={p.id} popup={p} speed={speed} project={project} fighter={fighters.find((f) => f.id === p.fighterId)} />
        ))}
      </div>

      <div className="pointer-events-auto relative flex items-center justify-center gap-2" role="group" aria-label="Battle controls">
        <Button
          variant="outline"
          size="md"
          aria-pressed={speed === 2}
          onClick={() => onSpeed(speed === 2 ? 1 : 2)}
          className={cn('bg-ink-950/75 font-mono tabular-nums', speed === 2 && 'border-accent/70 text-accent')}
          disabled={!ready}
        >
          <span aria-hidden>×2</span>
          <span className="sr-only">Double speed</span>
        </Button>
        <Button variant="outline" onClick={onReplay} disabled={!ready} className="bg-ink-950/75">
          <RotateCcw className="size-4" aria-hidden />
          Replay
        </Button>
        <Button variant="outline" onClick={onNewBattle} className="bg-ink-950/75">
          <Swords className="size-4" aria-hidden />
          New battle
        </Button>
      </div>
    </div>
  );
}

const sideOf = (fighterId: string): Side => (fighterId.startsWith('red') ? 'red' : 'blue');

function TeamBar({ team, hud }: { team: BattleTeam; hud: HudState }) {
  const activeId = hud.active[team.side];
  const active = team.fighters.find((f) => f.id === activeId) ?? null;
  const hp = activeId ? hud.hp[activeId] : undefined;
  const fraction = hp && hp.max > 0 ? hp.current / hp.max : 0;
  const mirrored = team.side === 'blue';
  const remaining = team.fighters.filter((f) => !hud.ko.has(f.id)).length;

  return (
    <section
      aria-label={`${team.trainerName}, ${team.side} corner`}
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-2xl border border-white/10 bg-ink-950/75 px-2.5 py-2 sm:gap-2 sm:px-3.5 sm:py-3',
        mirrored && 'items-end text-right',
      )}
    >
      <div className={cn('flex w-full min-w-0 items-center gap-2', mirrored && 'flex-row-reverse')}>
        <span className={cn('size-2 shrink-0 rounded-full', SIDE_BG[team.side])} aria-hidden />
        <h2 className="truncate font-display text-sm font-bold sm:text-base">{team.trainerName}</h2>
        <span className="sr-only">{remaining} of {team.fighters.length} fighters left.</span>
      </div>

      <ul className={cn('flex gap-1 sm:gap-1.5', mirrored && 'flex-row-reverse')} aria-label="Team">
        {team.fighters.map((f) => (
          <Pip key={f.id} fighter={f} ko={hud.ko.has(f.id)} active={f.id === activeId} />
        ))}
      </ul>

      <div className="flex w-full flex-col gap-1">
        <div className={cn('flex items-baseline justify-between gap-2 text-xs sm:text-sm', mirrored && 'flex-row-reverse')}>
          <span className="truncate font-semibold text-ink-100">{active ? formatName(active.name) : 'Waiting…'}</span>
          {hp && (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-300 sm:text-xs">
              {hp.current}<span className="text-ink-400">/{hp.max}</span> HP
            </span>
          )}
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 sm:h-2"
          role="meter"
          aria-label={active ? `${formatName(active.name)} HP` : 'HP'}
          aria-valuemin={0}
          aria-valuemax={hp?.max ?? 0}
          aria-valuenow={hp?.current ?? 0}
        >
          <div
            className={cn(
              'h-full w-full transition-transform duration-500 ease-[var(--ease-standard)]',
              mirrored ? 'origin-right' : 'origin-left',
              fraction <= 0.25 ? 'bg-danger' : SIDE_BG[team.side],
            )}
            style={{ transform: `scaleX(${fraction})` }}
          />
        </div>
      </div>
    </section>
  );
}

function Pip({ fighter, ko, active }: { fighter: Fighter; ko: boolean; active: boolean }) {
  const name = formatName(fighter.name);
  return (
    <li
      className={cn(
        'relative grid size-6 place-items-center overflow-hidden rounded-full bg-white/8 ring-1 ring-white/12 sm:size-8',
        active && !ko && cn('ring-2', SIDE_RING[fighter.side]),
        ko && 'opacity-45 grayscale',
      )}
      title={name}
    >
      {fighter.artwork ? (
        <img src={fighter.artwork} alt="" className="size-full object-contain p-0.5" decoding="async" />
      ) : (
        <span className="text-[10px] font-bold text-ink-300" aria-hidden>{name.charAt(0)}</span>
      )}
      {ko && <span className="absolute inset-x-0 top-1/2 h-px -rotate-45 bg-ink-100" aria-hidden />}
      <span className="sr-only">{name}{ko ? ', knocked out' : active ? ', in battle' : ''}</span>
    </li>
  );
}

function TitleCard({ red, blue }: { red: BattleTeam; blue: BattleTeam }) {
  return (
    <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 text-center animate-[rise_500ms_var(--ease-out-expo)_backwards]">
      <p className="font-display text-xl font-extrabold tracking-tight drop-shadow sm:text-3xl">
        <span className={SIDE_TEXT.red}>{red.trainerName}</span>
        <span className="mx-2 text-ink-300 sm:mx-3">vs</span>
        <span className={SIDE_TEXT.blue}>{blue.trainerName}</span>
      </p>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent sm:text-sm">Fight</p>
    </div>
  );
}

/** Each new move gets a fresh key so its letters type in again, even for a repeated move. */
function useSequence(value: object): number {
  const seq = useRef({ value, n: 0 });
  if (seq.current.value !== value) seq.current = { value, n: seq.current.n + 1 };
  return seq.current.n;
}

function MoveBanner({ move, side }: { move: NonNullable<HudState['lastMove']>; side: Side }) {
  const key = useSequence(move);
  return (
    <div className="absolute inset-x-0 top-[34%] flex justify-center px-4 sm:top-[30%]">
      <p
        key={key}
        className={cn(
          'rounded-full border border-white/12 bg-ink-950/80 px-4 py-1.5 font-display text-base font-bold tracking-tight sm:text-xl',
          SIDE_TEXT[side],
        )}
      >
        <span className="sr-only">{move.name}</span>
        <span aria-hidden>
          {[...move.name].map((ch, i) => (
            <span
              // Letters fade in one by one (the anticipation beat); reduced motion shows them at once.
              key={i}
              className="animate-[fade-in_160ms_linear_backwards]"
              style={{ animationDelay: `${i * 22}ms` }}
            >
              {ch}
            </span>
          ))}
        </span>
      </p>
    </div>
  );
}

const TONE: Record<PopupTone, { text: string; caption?: string }> = {
  damage: { text: 'text-ink-100 text-xl sm:text-2xl' },
  super: { text: 'text-accent text-2xl sm:text-3xl', caption: 'Super effective' },
  crit: { text: 'text-danger text-2xl sm:text-3xl', caption: 'Critical!' },
  weak: { text: 'text-ink-300 text-lg sm:text-xl', caption: 'Not very effective' },
  miss: { text: 'text-ink-200 text-lg italic sm:text-xl' },
  immune: { text: 'text-ink-300 text-lg sm:text-xl' },
};

/** Where popups sit without a 3D stage: above each side's half of the arena. */
const FALLBACK: Record<Side, Projection> = { red: { x: 0.28, y: 0.42 }, blue: { x: 0.72, y: 0.42 } };

/** Popup lifetime at 1× (ms): it rises in, holds, then is removed (a cut under reduced motion). */
const POPUP_MS = 1100;

function Popup({ popup, speed, project, fighter }: {
  popup: HudPopup;
  speed: 1 | 2;
  project(fighterId: string): Projection | null;
  fighter: Fighter | undefined;
}) {
  // Positioned once, at spawn, from the target card's screen position — no per-frame renders.
  const [pos] = useState(() => project(popup.fighterId) ?? FALLBACK[fighter?.side ?? sideOf(popup.fighterId)]);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setGone(true), POPUP_MS / speed);
    return () => window.clearTimeout(timer);
  }, []); // lifetime is fixed at spawn; a later speed change does not restart it
  if (gone) return null;
  const tone = TONE[popup.tone];
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
      style={{ left: `${(pos.x * 100).toFixed(2)}%`, top: `${(pos.y * 100).toFixed(2)}%` }}
    >
      <div className="battle-popup flex flex-col items-center" style={{ animationDuration: `${POPUP_MS / speed}ms` }}>
        {tone.caption && (
          <span className="rounded-full bg-ink-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-200 sm:text-xs">
            {tone.caption}
          </span>
        )}
        <span className={cn('font-display font-extrabold tabular-nums [text-shadow:0_2px_12px_rgb(7_8_11/0.9)]', tone.text)}>
          {popup.text}
        </span>
      </div>
    </div>
  );
}
