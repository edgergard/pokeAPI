import { useEffect, useId, useRef } from 'react';
import { RotateCcw, Swords, Trophy } from 'lucide-react';
import type { BattleResult, BattleTeam, Fighter, Side } from '@/entities/battle';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';

type Props = {
  result: BattleResult;
  red: BattleTeam;
  blue: BattleTeam;
  onReplay(): void;
  /** Legacy watch-only battle: back to the team picker. No button without it. */
  onNewBattle?: () => void;
};

const SIDE_TEXT: Record<Side, string> = { red: 'text-side-red', blue: 'text-side-blue' };
const SIDE_BG: Record<Side, string> = { red: 'bg-side-red', blue: 'bg-side-blue' };
const SIDE_NAME: Record<Side, string> = { red: 'Red', blue: 'Blue' };

/**
 * The default result screen, shown once the victory beat has played: winner, reason and each
 * fighter's numbers. Focus moves to its main button (Replay). Callers with their own result screen
 * pass `renderResult` to the arena instead.
 */
export function ResultOverlay({ result, red, blue, onReplay, onNewBattle }: Props) {
  const mainRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const winner = result.winner === 'red' ? red : blue;
  const fighters: Record<string, Fighter> = Object.fromEntries(
    [...red.fighters, ...blue.fighters].map((f) => [f.id, f]),
  );
  // Winner's team first, each team in slot order.
  const rows = [...result.fighters].sort((a, b) => {
    const fa = fighters[a.fighterId];
    const fb = fighters[b.fighterId];
    const rank = (f: Fighter | undefined) => (f?.side === result.winner ? 0 : 1);
    return rank(fa) - rank(fb) || (fa?.slot ?? 0) - (fb?.slot ?? 0);
  });

  useEffect(() => {
    const main = mainRef.current;
    main?.focus({ preventScroll: true });
    // A 4×4 table can push the button below the fold on a phone: bring it into view (minimal scroll).
    main?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  return (
    <section
      aria-labelledby={headingId}
      className="absolute inset-0 z-10 flex animate-[fade-in_400ms_var(--ease-standard)_backwards] overflow-y-auto bg-linear-to-t from-ink-950/90 via-ink-950/55 to-ink-950/10 p-3 sm:items-center sm:p-6"
    >
      <div className="m-auto w-full max-w-md animate-[rise_600ms_var(--ease-out-expo)_120ms_backwards] rounded-3xl border border-white/12 bg-ink-900/92 p-4 shadow-2xl sm:p-6">
        <p className="flex items-center gap-2 font-mono text-xs tracking-[0.25em] text-ink-300 uppercase">
          <Trophy className="size-3.5 text-accent" aria-hidden />
          {result.reason === 'knockout' ? 'Knockout' : 'Turn limit reached'}
        </p>
        <h2
          id={headingId}
          className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl"
        >
          <span className={SIDE_TEXT[result.winner]}>{winner.trainerName}</span> wins!
        </h2>
        <p className="mt-1 text-sm text-ink-300">
          {result.reason === 'knockout'
            ? 'Every rival card is down.'
            : 'Neither side fell in time — the higher share of remaining HP takes it.'}
        </p>

        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Fighter results</caption>
          <thead>
            <tr className="text-left text-xs tracking-wider text-ink-400 uppercase">
              <th scope="col" className="pb-1.5 font-semibold">
                Fighter
              </th>
              <th scope="col" className="pb-1.5 text-right font-semibold">
                KOs
              </th>
              <th scope="col" className="pb-1.5 text-right font-semibold">
                Dealt
              </th>
              <th scope="col" className="pb-1.5 text-right font-semibold">
                Taken
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => {
              const f = fighters[row.fighterId];
              return (
                <tr key={row.fighterId} className="border-t border-white/6">
                  <th scope="row" className="py-1.5 pr-2 text-left font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          f ? SIDE_BG[f.side] : 'bg-ink-400',
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'truncate',
                          !row.survived && 'text-ink-400 line-through decoration-ink-500',
                        )}
                      >
                        {f ? f.name : row.fighterId}
                      </span>
                      {/* The coloured dot is decorative: say whose fighter it is (same species can be on both sides). */}
                      {f && (
                        <span className="sr-only">{` (${SIDE_NAME[f.side]}, ${(f.side === 'red' ? red : blue).trainerName})`}</span>
                      )}
                      <span className="sr-only">
                        {row.survived ? ' (still standing)' : ' (knocked out)'}
                      </span>
                    </span>
                  </th>
                  <td className="py-1.5 text-right font-mono text-ink-100">{row.kos}</td>
                  <td className="py-1.5 text-right font-mono text-ink-200">{row.damageDealt}</td>
                  <td className="py-1.5 text-right font-mono text-ink-300">{row.damageTaken}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button ref={mainRef} onClick={onReplay} className="cursor-pointer">
            <RotateCcw className="size-4" aria-hidden />
            Replay
          </Button>
          {onNewBattle && (
            <Button variant="outline" onClick={onNewBattle} className="cursor-pointer">
              <Swords className="size-4" aria-hidden />
              New battle
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
