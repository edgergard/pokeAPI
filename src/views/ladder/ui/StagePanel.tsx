import Link from 'next/link';
import { Package, Sparkles, Swords, Users } from 'lucide-react';
import { RARITY_LABEL, RARITY_TEXT_CLASS } from '@/entities/capsule';
import type { StageInfo, StageStatus } from '@/entities/ladder';
import { getSpecies, typeColor } from '@/entities/pokemon';
import { CAPSULE_TIERS, economy } from '@/shared/config/economy';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { CreatureArt } from '@/widgets/capsule-reveal';

const formatPower = (n: number) => n.toLocaleString('en-US');

export const fightLinkClass =
  'inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

type Props = {
  info: StageInfo;
  status: Exclude<StageStatus, 'locked'>;
  yourPower: number;
  replayWins: number;
  /** Open team slots are empty and the collection has more: the primary becomes "Fill team". */
  fillTeam: boolean;
  onEditTeam: () => void;
};

/**
 * The selected stage (design.md `ladder` panel): the rival's team (art, rarity, Lv, ★), recommended
 * power vs yours, the first-clear reward — or, when cleared, "Cleared · replay for XP" with the
 * replay streak — and Fight (→ `/battle/?stage=N`) or Fill team, plus Edit team.
 */
export function StagePanel({ info, status, yourPower, replayWins, fillTeam, onEditTeam }: Props) {
  const capsules = CAPSULE_TIERS.reduce(
    (n, tier) => n + (info.firstClear.capsules?.[tier] ?? 0),
    0,
  );
  const weaker = yourPower < info.power;
  return (
    <section
      aria-labelledby="stage-panel-heading"
      data-stage={info.stage}
      className="flex flex-col gap-5 rounded-3xl p-5 glass sm:p-6"
    >
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          {status === 'cleared' ? 'Cleared' : 'Next stage'}
        </p>
        <h2 id="stage-panel-heading" className="font-display text-2xl font-bold tracking-tight">
          Stage {info.stage} · Rival {info.rivalName}
        </h2>
      </header>

      <ul aria-label="Rival team" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {info.rival.map((member) => {
          const species = getSpecies(member.speciesId);
          if (!species) return null;
          return (
            <li
              key={member.speciesId}
              className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-card p-2 text-center"
            >
              <CreatureArt
                speciesId={species.id}
                name={species.name}
                color={typeColor(species.types[0])}
                className="size-16"
              />
              <span className="w-full truncate text-sm font-semibold">{species.name}</span>
              <span className={cn('text-xs', RARITY_TEXT_CLASS[species.rarity])}>
                {RARITY_LABEL[species.rarity]}
              </span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                Lv {member.level}{' '}
                <span aria-hidden className="text-primary">
                  ★{member.stars}
                </span>
                <span className="sr-only">
                  , {member.stars} star{member.stars === 1 ? '' : 's'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-muted px-3 py-2">
          <dt className="text-xs text-muted-foreground">Recommended power</dt>
          <dd className="font-mono text-lg font-bold tabular-nums">{formatPower(info.power)}</dd>
        </div>
        <div className="rounded-2xl bg-muted px-3 py-2">
          <dt className="text-xs text-muted-foreground">Your team</dt>
          <dd
            className={cn(
              'font-mono text-lg font-bold tabular-nums',
              weaker ? 'text-foreground' : 'text-rarity-uncommon',
            )}
          >
            {formatPower(yourPower)}
            <span className="sr-only">
              {weaker ? ', below recommended' : ', at or above recommended'}
            </span>
          </dd>
        </div>
      </dl>

      {status === 'current' ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">First clear</h3>
          <ul className="flex flex-wrap gap-2 text-sm">
            {capsules > 0 && (
              <li className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-secondary px-3 py-1 font-semibold">
                <Package className="size-4 text-primary" aria-hidden />+{capsules} Capsule
                {capsules === 1 ? '' : 's'}
              </li>
            )}
            {(info.firstClear.dust ?? 0) > 0 && (
              <li className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-secondary px-3 py-1 font-semibold">
                <Sparkles className="size-4 text-rarity-epic" aria-hidden />+{info.firstClear.dust}{' '}
                dust
              </li>
            )}
          </ul>
          <p className="font-mono text-xs text-muted-foreground">
            Win: +{info.winXp.trainer} trainer XP · +{info.winXp.pokemon} XP per Pokémon
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold">Cleared · replay for XP</p>
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            Replay streak {replayWins} / {economy.battle.replayCapsuleEveryWins} · a capsule every{' '}
            {economy.battle.replayCapsuleEveryWins} replay wins
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {fillTeam ? (
          <Button size="lg" onClick={onEditTeam} className="cursor-pointer">
            <Users className="size-4" aria-hidden />
            Fill team
          </Button>
        ) : (
          <Link href={`/battle/?stage=${info.stage}`} className={fightLinkClass}>
            <Swords className="size-4" aria-hidden />
            Fight
          </Link>
        )}
        <Button size="lg" variant="outline" onClick={onEditTeam} className="cursor-pointer">
          Edit team
        </Button>
      </div>
    </section>
  );
}
