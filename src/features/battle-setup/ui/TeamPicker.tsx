import { useId, useRef, type AnimationEvent, type CSSProperties, type PointerEvent } from 'react';
import { Dices } from 'lucide-react';
import { PokemonSprite, TypeBadge, typeColor, usePokemonList } from '@/entities/pokemon';
import { PRESET_TRAINERS, trainerOptionLabels, type Trainer } from '@/entities/trainer';
import { Button } from '@/shared/ui/Button';
import { controlClass } from '@/shared/ui/Field';
import { cn } from '@/shared/lib/cn';
import { formatName } from '@/shared/lib/format';
import { GSAP_EASE, gsap, useGSAP } from '@/shared/lib/gsap';
import { usePrefersReducedMotion } from '@/shared/lib/motion';

export const trainerName = (t: Trainer) => `${t.firstName} ${t.lastName}`.trim();

type Props = {
  side: 'red' | 'blue';
  trainer: Trainer;
  own: readonly Trainer[];
  onChange: (trainer: Trainer) => void;
  onRandom: () => void;
  /** Random rivals need the Pokémon index; disabled until it has loaded. */
  randomReady: boolean;
  disabled?: boolean;
};

const ACCENT: Record<Props['side'], string> = { red: 'var(--color-side-red)', blue: 'var(--color-side-blue)' };

/** Team entrance: four cards spring in, 70ms apart (≤ 0.6s in all). */
const ENTRANCE = { duration: 0.38, stagger: 0.07 } as const;

export function TeamPicker({ side, trainer, own, onChange, onRandom, randomReady, disabled }: Props) {
  const selectId = useId();
  const team = usePokemonList(trainer.team);
  const label = side === 'red' ? 'Red corner' : 'Blue corner';
  const isRival = trainer.id.startsWith('rival-');
  const reduced = usePrefersReducedMotion();
  const listRef = useRef<HTMLUListElement>(null);
  /** A new trainer or a new team (select, 🎲) replays the entrance; so does the first mount. */
  const teamKey = `${trainer.id}:${trainer.team.join(',')}`;
  /** The entrance waits for the team data, so it springs the real cards, not the placeholders. */
  const ready = !team.isPending;

  useGSAP(
    () => {
      const list = listRef.current;
      if (reduced || !ready || !list) return;
      gsap.from(list.children, {
        opacity: 0,
        y: 18,
        scale: 0.82,
        duration: ENTRANCE.duration,
        stagger: ENTRANCE.stagger,
        ease: GSAP_EASE.spring,
        clearProps: 'opacity,transform',
      });
    },
    { scope: listRef, dependencies: [teamKey, ready, reduced], revertOnUpdate: true },
  );

  // Hover bounce: started on mouse enter and left to finish on its own (leaving early must not snap it back).
  const bounce = (e: PointerEvent<HTMLLIElement>) => {
    if (reduced || e.pointerType !== 'mouse') return;
    e.currentTarget.querySelector<HTMLElement>('.fighter-bounce')?.setAttribute('data-bounce', '');
  };
  const bounceDone = (e: AnimationEvent<HTMLSpanElement>) => {
    if (e.target === e.currentTarget) e.currentTarget.removeAttribute('data-bounce');
  };

  const all = [...own, ...PRESET_TRAINERS, trainer];
  const byId = new Map<string, Trainer>(all.map((t) => [t.id, t]));
  // Two trainers with the same name get a hint (their lead Pokémon) so the options stay distinct.
  const labels = trainerOptionLabels(all);
  const optionLabel = (t: Trainer) => labels.get(t.id) ?? trainerName(t);

  return (
    <section
      aria-label={label}
      style={{ '--side': ACCENT[side] } as CSSProperties}
      className="flex min-w-0 flex-col gap-4 rounded-3xl border border-(--side)/30 bg-ink-900/85 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 font-mono text-[12px] font-semibold tracking-[0.12em] text-(--side) uppercase">
        <span className="size-2 rounded-full bg-(--side)" aria-hidden />
        {label}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label htmlFor={selectId} className="text-[12px] font-semibold tracking-[0.08em] text-ink-300 uppercase">
            Trainer
          </label>
          <div className={cn(controlClass(false), 'h-12')}>
            <select
              id={selectId}
              value={trainer.id}
              disabled={disabled}
              onChange={(e) => {
                const next = byId.get(e.target.value);
                if (next) onChange(next);
              }}
              className="h-full w-full min-w-0 bg-transparent text-[15px] text-white outline-none"
            >
              {own.length > 0 && (
                <optgroup label="Your trainers">
                  {own.map((t) => (
                    <option key={t.id} value={t.id} className="bg-ink-900">
                      {optionLabel(t)}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Presets">
                {PRESET_TRAINERS.map((t) => (
                  <option key={t.id} value={t.id} className="bg-ink-900">
                    {optionLabel(t)}
                  </option>
                ))}
              </optgroup>
              {isRival && (
                <optgroup label="Random rival">
                  <option value={trainer.id} className="bg-ink-900">
                    {optionLabel(trainer)}
                  </option>
                </optgroup>
              )}
            </select>
          </div>
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={onRandom}
          disabled={disabled || !randomReady}
          aria-label={`Random rival for ${label}`}
          className="h-12"
        >
          <Dices className="size-4" aria-hidden />
          <span className="hidden sm:inline">Random rival</span>
          <span aria-hidden className="sm:hidden">
            🎲
          </span>
        </Button>
      </div>

      <ul ref={listRef} className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={`Team of ${trainerName(trainer)}`}>
        {trainer.team.map((name, i) => {
          const p = team.data[i];
          return (
            <li
              key={`${name}-${i}`}
              style={{ '--i': i, '--type': typeColor(p?.types[0]) } as CSSProperties}
              onPointerEnter={bounce}
              className="fighter-card flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-ink-850/80 p-2"
            >
              <span className="relative grid size-16 place-items-center" aria-hidden>
                <span className="fighter-shadow absolute bottom-0.5 left-1/2 h-2 w-3/5 -translate-x-1/2 rounded-[50%] bg-black/70 blur-[2px]" />
                <span className="fighter-hop grid size-full place-items-center">
                  <span
                    className="fighter-bounce grid size-full place-items-center"
                    onAnimationEnd={bounceDone}
                  >
                    {p ? (
                      // Front sprites face left: the Red corner (on the left from md up) turns to face Blue.
                      <PokemonSprite id={p.id} mirrored={side === 'red'} size={64} className="size-16" />
                    ) : (
                      <span className="size-12 animate-pulse rounded-full bg-white/5" />
                    )}
                  </span>
                </span>
              </span>
              <span className="w-full truncate text-center text-[13px] font-semibold text-ink-100">{formatName(name)}</span>
              <span className="flex min-h-6 flex-wrap justify-center gap-1">
                {p?.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
