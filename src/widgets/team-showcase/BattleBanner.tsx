import { useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { Swords } from 'lucide-react';
import { PokemonSprite, type Pokemon } from '@/entities/pokemon';
import { TEAM_SIZE } from '@/entities/trainer';
import { href } from '@/shared/lib/router';
import { useInView } from '@/shared/lib/useInView';

type Props = {
  trainerId: string;
  fullName: string;
  /** The shown team, slot by slot (undefined while loading or on error). */
  team: (Pokemon | undefined)[];
};

const slots = Array.from({ length: TEAM_SIZE }, (_, i) => i);

/** The call to battle under the team: the team lines up facing four unknown rivals. */
export function BattleBanner({ trainerId, fullName, team }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);

  return (
    <div
      ref={ref}
      data-inview={inView || undefined}
      className="battle-banner relative isolate mt-4 rounded-[2rem] p-px"
    >
      {/* Gradient border + glow; the sweep moves on its own layer. */}
      <div
        aria-hidden
        className="battle-banner-border absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
      />

      <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[calc(2rem-1px)] bg-ink-900/95 px-5 py-10 text-center sm:gap-7 sm:px-10 sm:py-14">
        <div
          aria-hidden
          className="battle-banner-glows pointer-events-none absolute inset-0 -z-10"
        />

        {/* Decorative face-off: the team (mirrored to face right) against the unknown. */}
        <div
          aria-hidden
          className="banner-reveal flex items-center justify-center gap-3 sm:gap-6"
          style={{ '--i': 0 } as CSSProperties}
        >
          <div className="flex items-end gap-1 sm:gap-2">
            {slots.map((slot) => {
              const p = team[slot];
              return (
                <span
                  key={slot}
                  className="banner-hop relative grid size-10 place-items-center sm:size-16"
                  style={{ '--i': slot } as CSSProperties}
                >
                  <span className="banner-hop-shadow absolute bottom-0 left-1/2 h-1.5 w-3/5 -translate-x-1/2 rounded-[50%] bg-black/60 blur-[2px]" />
                  <span className="banner-hop-body grid size-full place-items-center">
                    {p ? (
                      <PokemonSprite id={p.id} mirrored size={64} className="size-full" />
                    ) : (
                      <span className="size-6 rounded-full bg-white/8 sm:size-9" />
                    )}
                  </span>
                </span>
              );
            })}
          </div>

          <span className="banner-vs grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-ink-950 font-display text-sm font-extrabold tracking-tight text-white sm:size-14 sm:text-lg">
            VS
          </span>

          <div className="flex items-end gap-1 sm:gap-2">
            {slots.map((slot) => (
              <span
                key={slot}
                // One rival on phones keeps the row inside 375px; all four from sm up.
                className={`grid size-10 place-items-center rounded-full border border-dashed border-white/12 bg-white/[0.03] font-display text-lg font-bold text-ink-600 sm:size-16 sm:text-2xl ${slot > 0 ? 'max-sm:hidden' : ''}`}
              >
                ?
              </span>
            ))}
          </div>
        </div>

        <div
          className="banner-reveal flex flex-col items-center gap-2"
          style={{ '--i': 1 } as CSSProperties}
        >
          <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-ink-400 uppercase">
            Arena
          </span>
          <h3 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Ready to battle?
          </h3>
          <p className="max-w-md text-base text-ink-300 sm:text-lg">
            Take {fullName}’s team into the arena.
          </p>
        </div>

        <Link
          // The battle page starts with this team in the Red corner.
          href={href('/battle', { red: trainerId })}
          className="banner-reveal battle-cta group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-accent px-8 text-lg font-bold text-ink-950 shadow-glow transition-[background-color,scale] duration-150 hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:scale-[0.98] sm:h-16 sm:w-auto sm:px-10 sm:text-xl"
          style={{ '--i': 2 } as CSSProperties}
        >
          <Swords className="size-5 sm:size-6" aria-hidden />
          Battle with this team
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
