import { useEffect, useId, useState } from 'react';
import { FALLBACK_MOVE, loadMovesets, movesFor, type Move } from '@/entities/battle';
import type { Species } from '@/entities/pokemon';
import { formatName } from '@/shared/lib/format';

type State = { status: 'loading' } | { status: 'ready'; moves: Move[] } | { status: 'error' };

/**
 * The battle moveset (the same `movesFor` lookup the fighters use). The baked movesets load lazily;
 * mount it keyed by species so a new species starts from `loading`.
 */
export function Moves({ species }: { species: Species }) {
  const headingId = useId();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadMovesets().then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', moves: movesFor(data, species.slug) });
      },
      () => {
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [species.slug, attempt]);

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={state.status === 'loading'}
      className="flex flex-col gap-3 rounded-3xl p-4 glass"
    >
      <h2
        id={headingId}
        className="font-mono text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase"
      >
        Moves
      </h2>
      {state.status === 'loading' && (
        <div aria-hidden className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="shimmer relative h-8 w-24 overflow-hidden rounded-xl bg-muted"
            />
          ))}
        </div>
      )}
      {state.status === 'error' && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          Moves couldn&apos;t load.
          <button
            type="button"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((a) => a + 1);
            }}
            className="tap-target cursor-pointer font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Try again
          </button>
        </p>
      )}
      {state.status === 'ready' &&
        (state.moves.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {state.moves.map((move) => (
              <li key={move.name} className="rounded-xl bg-secondary px-2.5 py-1.5 text-sm">
                {formatName(move.name)}{' '}
                <span className="text-muted-foreground">
                  · {formatName(move.type)} · {move.power}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No moveset: fights with {formatName(FALLBACK_MOVE.name)} · {FALLBACK_MOVE.power}
          </p>
        ))}
    </section>
  );
}
