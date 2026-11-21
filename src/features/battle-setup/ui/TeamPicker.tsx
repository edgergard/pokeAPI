import { useId, type CSSProperties } from 'react';
import { Dices } from 'lucide-react';
import { TypeBadge, spriteUrl, usePokemonList } from '@/entities/pokemon';
import { PRESET_TRAINERS, type Trainer } from '@/entities/trainer';
import { Button } from '@/shared/ui/Button';
import { controlClass } from '@/shared/ui/Field';
import { cn } from '@/shared/lib/cn';
import { formatName } from '@/shared/lib/format';

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

export function TeamPicker({ side, trainer, own, onChange, onRandom, randomReady, disabled }: Props) {
  const selectId = useId();
  const team = usePokemonList(trainer.team);
  const label = side === 'red' ? 'Red corner' : 'Blue corner';
  const isRival = trainer.id.startsWith('rival-');

  const byId = new Map<string, Trainer>([...own, ...PRESET_TRAINERS, trainer].map((t) => [t.id, t]));

  return (
    <section
      aria-label={label}
      style={{ '--side': ACCENT[side] } as CSSProperties}
      className="flex min-w-0 flex-col gap-4 rounded-3xl border border-(--side)/30 bg-ink-900/70 p-4 backdrop-blur sm:p-5"
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
                      {trainerName(t)}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Presets">
                {PRESET_TRAINERS.map((t) => (
                  <option key={t.id} value={t.id} className="bg-ink-900">
                    {trainerName(t)}
                  </option>
                ))}
              </optgroup>
              {isRival && (
                <optgroup label="Random rival">
                  <option value={trainer.id} className="bg-ink-900">
                    {trainerName(trainer)}
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

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={`Team of ${trainerName(trainer)}`}>
        {trainer.team.map((name, i) => {
          const p = team.data[i];
          return (
            <li
              key={`${name}-${i}`}
              className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-ink-850/80 p-2"
            >
              {p ? (
                <img
                  src={spriteUrl(p.id)}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  className="size-16 object-contain"
                  // Blocked sprite host: keep the empty slot instead of a broken-image icon.
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
              ) : (
                <span className="size-16 animate-pulse rounded-full bg-white/5" aria-hidden />
              )}
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
