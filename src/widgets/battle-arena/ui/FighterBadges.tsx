import { Shield, Swords, Zap, type LucideIcon } from 'lucide-react';
import type { Fighter } from '@/entities/battle';
import type { TalentBranch } from '@/entities/progression';
import { cn } from '@/shared/lib/cn';
import { talentTally } from '../model/badges';

const TALENT: Record<TalentBranch, { Icon: LucideIcon; label: string }> = {
  offense: { Icon: Swords, label: 'offense' },
  defense: { Icon: Shield, label: 'defense' },
  tempo: { Icon: Zap, label: 'tempo' },
};

/** "2 offense talents" / "1 tempo talent". */
const talentText = (branch: TalentBranch, n: number) =>
  `${n} ${TALENT[branch].label} talent${n === 1 ? '' : 's'}`;

/**
 * A fighter's badges (Must #7): "Lv 5", "★3" and one icon per talent branch with its count. Every
 * badge has a text alternative; stars only show when the fighter has any.
 */
export function FighterBadges({
  fighter,
  className,
}: {
  fighter: Pick<Fighter, 'level' | 'badges'>;
  className?: string;
}) {
  const { stars, talentIcons } = fighter.badges;
  const talents = talentTally(talentIcons);
  return (
    <span
      className={cn(
        'inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-xs text-ink-300 tabular-nums',
        className,
      )}
    >
      <span>Lv {fighter.level}</span>
      {stars > 0 && (
        <span className="text-primary">
          <span aria-hidden>★{stars}</span>
          <span className="sr-only">
            , {stars} star{stars === 1 ? '' : 's'}
          </span>
        </span>
      )}
      {talents.map(([branch, n]) => {
        const { Icon } = TALENT[branch];
        return (
          <span key={branch} className="inline-flex items-center gap-0.5 text-ink-200">
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {n > 1 && <span aria-hidden>{n}</span>}
            <span className="sr-only">, {talentText(branch, n)}</span>
          </span>
        );
      })}
    </span>
  );
}
