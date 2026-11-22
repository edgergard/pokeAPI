import { dupesForNextStar } from '@/entities/capsule';
import type { Species } from '@/entities/pokemon';
import { isAtLevelCap, levelCap, xpToNextLevel } from '@/entities/progression';
import type { OwnedPokemon } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { StarRow } from './HoloCard';
import { Meter } from './Meter';

/** "Level cap 20. Earn ★3 to raise it." — or the max level once every star is earned. */
export function capMessage(owned: Pick<OwnedPokemon, 'stars'>): string {
  const cap = levelCap(owned.stars);
  if (owned.stars >= economy.pokemon.maxStars) return `Max level ${cap} reached.`;
  return `Level cap ${cap}. Earn ★${owned.stars + 1} to raise it.`;
}

/** "2 more duplicates to ★3" (null at max stars). */
export function dupesMessage(owned: Pick<OwnedPokemon, 'stars' | 'dupes'>): string | null {
  if (owned.stars >= economy.pokemon.maxStars) return null;
  const left = Math.max(0, dupesForNextStar(owned.stars) - owned.dupes);
  return `${left} more ${left === 1 ? 'duplicate' : 'duplicates'} to ★${owned.stars + 1}`;
}

/** Level / cap with the XP bar, and stars with the duplicates still needed. */
export function LevelPanel({ species, owned }: { species: Species; owned: OwnedPokemon }) {
  const cap = levelCap(owned.stars);
  const atCap = isAtLevelCap(owned);
  const need = xpToNextLevel(species, owned.level);
  const maxStars = owned.stars >= economy.pokemon.maxStars;
  const dupesNeed = dupesForNextStar(owned.stars);
  const dupes = dupesMessage(owned);

  return (
    <section
      aria-label="Level and stars"
      className="flex flex-wrap gap-x-8 gap-y-5 rounded-3xl p-4 glass sm:p-5"
    >
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-2xl font-extrabold">
            Lv {owned.level} <span className="font-semibold text-muted-foreground">/ {cap}</span>
          </p>
          {!atCap && (
            <span className="font-mono text-xs text-muted-foreground">
              {owned.xp} / {need} XP
            </span>
          )}
        </div>
        {atCap ? (
          <p className="text-sm text-foreground" data-testid="cap-message">
            {capMessage(owned)}
          </p>
        ) : (
          <Meter
            label={`${species.name} XP to level ${owned.level + 1}`}
            value={owned.xp}
            max={need}
            valueText={`${owned.xp} of ${need} XP`}
          />
        )}
      </div>

      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <StarRow stars={owned.stars} />
          {!maxStars && (
            <span className="font-mono text-xs text-muted-foreground">
              {owned.dupes} / {dupesNeed} duplicates
            </span>
          )}
        </div>
        {dupes ? (
          <>
            <Meter
              label={`Duplicates to ${owned.stars + 1} stars`}
              value={owned.dupes}
              max={dupesNeed}
              valueText={`${owned.dupes} of ${dupesNeed} duplicates`}
              fillClass="bg-primary"
            />
            <p className="text-sm text-foreground">{dupes}</p>
          </>
        ) : (
          <p className="text-sm text-foreground">All {economy.pokemon.maxStars} stars earned.</p>
        )}
      </div>
    </section>
  );
}
