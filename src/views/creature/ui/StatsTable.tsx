import { useId } from 'react';
import type { Species } from '@/entities/pokemon';
import { NATURE_EFFECTS, STAT_KEYS, statBreakdown } from '@/entities/progression';
import type { OwnedPokemon } from '@/entities/save';
import { cn } from '@/shared/lib/cn';
import { formatName } from '@/shared/lib/format';
import { STAT_LABEL } from '../model/creature';

const cell = 'py-2 text-right font-mono tabular-nums';

/** "Brave (+Attack, −Speed)" / "Neutral". */
function natureText(owned: OwnedPokemon): string {
  const effect = NATURE_EFFECTS[owned.nature];
  const name = formatName(owned.nature);
  if (!effect) return name;
  return `${name} (+${STAT_LABEL[effect.up]}, −${STAT_LABEL[effect.down]})`;
}

/**
 * Stats base → current from `statBreakdown`: base stat, the level/IV/nature formula, the talent bonus and
 * the battle value. Without `owned` (a species not in the collection) only base stats are shown.
 */
export function StatsTable({ species, owned }: { species: Species; owned?: OwnedPokemon }) {
  const headingId = useId();
  const lines = owned ? statBreakdown(species, owned) : null;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 rounded-3xl p-4 glass sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id={headingId}
          className="font-mono text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase"
        >
          Stats
        </h2>
        {owned && (
          <p className="text-xs text-muted-foreground">
            Nature: <span className="text-foreground">{natureText(owned)}</span>
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {owned
              ? `${species.name} stats: base, level and nature, talent bonus, current`
              : `${species.name} base stats`}
          </caption>
          <thead>
            <tr className="font-mono text-xs text-muted-foreground">
              <th scope="col" className="py-2 text-left font-medium">
                Stat
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Base
              </th>
              {lines && (
                <>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">
                    Lv + nature
                  </th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">
                    Talents
                  </th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">
                    Current
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {STAT_KEYS.map((stat) => {
              const line = lines?.[stat];
              return (
                <tr key={stat} data-stat={stat} className="border-t border-white/6">
                  <th scope="row" className="py-2 text-left font-medium text-foreground">
                    {STAT_LABEL[stat]}
                    {line?.nature && (
                      <span
                        className={cn(
                          'ml-1.5 text-xs',
                          line.nature === 'up' ? 'text-rarity-uncommon' : 'text-destructive',
                        )}
                      >
                        <span aria-hidden>{line.nature === 'up' ? '▲' : '▼'}</span>
                        <span className="sr-only">
                          {line.nature === 'up' ? ' raised by nature' : ' lowered by nature'}
                        </span>
                      </span>
                    )}
                  </th>
                  <td className={cn(cell, 'text-muted-foreground')}>{species.stats[stat]}</td>
                  {line && (
                    <>
                      <td className={cn(cell, 'pl-3 text-muted-foreground')}>{line.formula}</td>
                      <td
                        className={cn(
                          cell,
                          'pl-3',
                          line.talentBonus > 0 ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {line.talentBonus > 0 ? `+${line.talentBonus}` : '—'}
                      </td>
                      <td className={cn(cell, 'pl-3 font-bold text-foreground')}>
                        <span aria-hidden className="text-muted-foreground">
                          →{' '}
                        </span>
                        {line.current}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
