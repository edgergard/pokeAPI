import type { TeamMemberSpec } from '@/entities/battle';
import { RARITY_LABEL, RARITY_TEXT_CLASS } from '@/entities/capsule';
import { typeColor } from '@/entities/pokemon';
import { cn } from '@/shared/lib/cn';
import { FighterBadges } from '@/widgets/battle-arena';
import { CreatureArt } from '@/widgets/capsule-reveal';

/** A preview card: art, name, rarity (text + colour), Lv / ★ / talent icons. */
export function FighterCard({
  member,
  side,
  note,
}: {
  member: Pick<TeamMemberSpec, 'species' | 'level' | 'badges'>;
  side: 'red' | 'blue';
  /** Extra line, e.g. "Loaner". */
  note?: string;
}) {
  const { species } = member;
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-2xl border bg-card/90 p-2 pr-3',
        side === 'red' ? 'border-side-red/35' : 'border-side-blue/35',
      )}
    >
      <CreatureArt
        speciesId={species.id}
        name={species.name}
        color={typeColor(species.types[0])}
        className="size-16 shrink-0"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-semibold">{species.name}</span>
        <span className={cn('text-xs', RARITY_TEXT_CLASS[species.rarity])}>
          {RARITY_LABEL[species.rarity]}
          {note && <span className="text-muted-foreground"> · {note}</span>}
        </span>
        <FighterBadges fighter={member} />
      </div>
    </li>
  );
}
