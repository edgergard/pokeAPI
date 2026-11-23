import { useEffect, useId, useRef, type ReactNode } from 'react';
import { DocumentLink } from '@/shared/ui/DocumentLink';
import Link from 'next/link';
import { Check, Package, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import type { BattleResult } from '@/entities/battle';
import { getSpecies, typeColor } from '@/entities/pokemon';
import {
  xpToNextLevel,
  xpToNextTrainerLevel,
  type BattleSummary,
  type PokemonBattleResult,
} from '@/entities/progression';
import { useSave } from '@/entities/save';
import { CAPSULE_TIERS, economy } from '@/shared/config/economy';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { CreatureArt } from '@/widgets/capsule-reveal';
import type { QuestTick, StageOutcome } from '../model/commit';
import { stageHref } from '../model/route';
import { lossSuggestion, questLabel, trainerLabel } from '../model/suggestion';
import { XpBar } from './XpBar';

export const primaryLinkClass =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-sm:h-11';
export const secondaryLinkClass =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 px-4 text-sm font-semibold text-foreground transition-colors hover:border-white/25 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-sm:h-11';

type Props = {
  stage: number;
  result: BattleResult;
  /** What was recorded; null while the commit is pending or when nothing could be recorded. */
  outcome: StageOutcome | null;
  /** The commit ran and recorded nothing. */
  failed: boolean;
  trainerName: string;
  onRetry: () => void;
  onEditTeam: () => void;
  onReplay: () => void;
};

/**
 * The ladder battle's result screen (design.md `battle` result; prototype `battle.dc.html`), shown
 * inside the arena: outcome, trainer XP, each team member's XP, bench share, loot, quest ticks,
 * replay streak, and the next step — "Next stage" after a win (two clicks to the next battle),
 * "Retry" plus one hint after a defeat. Focus lands on the primary button.
 */
export function StageResult({
  stage,
  result,
  outcome,
  failed,
  trainerName,
  onRetry,
  onEditTeam,
  onReplay,
}: Props) {
  const won = result.winner === 'red';
  const summary = outcome?.summary ?? null;
  const headingId = useId();
  const primaryRef = useRef<HTMLElement | null>(null);
  const setPrimary = (el: HTMLElement | null) => {
    primaryRef.current = el;
  };
  const unopened = useSave((s) => CAPSULE_TIERS.reduce((n, tier) => n + s.capsules[tier], 0));
  const suggestion = useSave((s) => (won ? null : lossSuggestion(s)));

  // Focus without scrolling: on a phone the overlay scrolls, and the outcome and rewards at its
  // top must stay in view (the primary button may sit below them).
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, []);

  const last = stage >= economy.battle.ladderStages;
  const title = won
    ? summary?.firstClear
      ? 'Victory · First-clear bonus'
      : 'Victory'
    : 'Defeated. Try a stronger lineup.';
  const eyebrow = `Stage ${stage} · ${won ? (summary && !summary.firstClear ? 'Replay' : 'Cleared') : 'Lost'}`;

  return (
    <section
      aria-labelledby={headingId}
      data-outcome={won ? 'won' : 'lost'}
      className="absolute inset-0 z-10 flex animate-[fade-in_400ms_var(--ease-standard)_backwards] overflow-y-auto bg-linear-to-t from-background/95 via-background/75 to-background/40 p-3 sm:p-6"
    >
      <div className="m-auto flex w-full max-w-lg animate-[rise_600ms_var(--ease-out-expo)_120ms_backwards] flex-col gap-4 rounded-3xl border border-white/12 bg-card/95 p-4 shadow-2xl sm:p-6">
        <header>
          <p className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            <Trophy
              className={cn('size-3.5', won ? 'text-primary' : 'text-muted-foreground')}
              aria-hidden
            />
            {eyebrow}
          </p>
          <h2
            id={headingId}
            className={cn(
              'mt-1 font-display font-extrabold tracking-tight',
              won ? 'text-3xl text-primary sm:text-4xl' : 'text-2xl sm:text-3xl',
            )}
          >
            {title}
          </h2>
        </header>

        {summary ? (
          <Rewards summary={summary} quests={outcome?.quests ?? []} trainerName={trainerName} />
        ) : failed ? (
          <p role="alert" className="text-sm text-foreground">
            This battle couldn&apos;t be recorded. Your progress is unchanged.
          </p>
        ) : null}

        {!won && suggestion && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            {suggestion.kind === 'bench' ? (
              <>
                <span>
                  {suggestion.name} is Lv {suggestion.level} on the bench
                </span>
                <Button size="md" variant="outline" onClick={onEditTeam} className="cursor-pointer">
                  <span aria-hidden>→</span> Put in team
                </Button>
              </>
            ) : (
              <Link href={`/creature/?id=${suggestion.speciesId}`} className={secondaryLinkClass}>
                Spend {suggestion.points} talent point{suggestion.points === 1 ? '' : 's'}
                <span className="sr-only"> on {suggestion.name}</span>
              </Link>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {won ? (
            last ? (
              <Link ref={setPrimary} href="/ladder/" className={primaryLinkClass}>
                Back to ladder
              </Link>
            ) : (
              <DocumentLink
                ref={setPrimary}
                href={stageHref(stage + 1)}
                className={primaryLinkClass}
              >
                Next stage
              </DocumentLink>
            )
          ) : (
            <Button ref={setPrimary} onClick={onRetry} className="cursor-pointer">
              <RotateCcw className="size-4" aria-hidden />
              Retry
            </Button>
          )}
          <Button variant="outline" onClick={onEditTeam} className="cursor-pointer">
            Edit team
          </Button>
          <Link href="/capsules/" className={secondaryLinkClass}>
            <Package className="size-4" aria-hidden />
            Open capsules ({unopened ?? 0})
          </Link>
          {!(won && last) && (
            <Link href="/ladder/" className={secondaryLinkClass}>
              Ladder
            </Link>
          )}
          <Button variant="ghost" onClick={onReplay} className="cursor-pointer">
            Replay
          </Button>
        </div>
      </div>
    </section>
  );
}

function Rewards({
  summary,
  quests,
  trainerName,
}: {
  summary: BattleSummary;
  quests: QuestTick[];
  trainerName: string;
}) {
  const { trainer } = summary;
  const need = xpToNextTrainerLevel(trainer.toLevel);
  const team = summary.pokemon.filter((p) => !p.bench);
  const benchCount = summary.pokemon.length - team.length;
  const capsules = CAPSULE_TIERS.reduce((n, tier) => n + summary.capsules[tier], 0);
  const streak = summary.outcome === 'won' && !summary.firstClear ? summary.replay : null;
  const loot =
    capsules > 0 ||
    summary.dust > 0 ||
    summary.firstClear ||
    summary.bonusCapsule ||
    streak !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold">
            {trainerLabel(trainerName)} · Lv {trainer.toLevel}
            {trainer.levelsGained > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                Lv up
              </span>
            )}
          </span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {trainer.atMax ? 'Max level' : `${trainer.toXp} / ${need} XP`}
          </span>
        </div>
        <XpBar
          tone="trainer"
          label={`Trainer level ${trainer.toLevel} XP`}
          value={trainer.atMax ? need : trainer.toXp}
          max={need}
        />
        <p className="font-mono text-xs text-muted-foreground">
          +{trainer.xp} XP
          {trainer.talentPointsGained > 0 &&
            ` · +${trainer.talentPointsGained} trainer talent point${trainer.talentPointsGained === 1 ? '' : 's'}`}
        </p>
      </div>

      {team.length > 0 && (
        <ul aria-label="Team XP" className="flex flex-col gap-2">
          {team.map((p) => (
            <PokemonXpRow key={p.speciesId} result={p} />
          ))}
        </ul>
      )}
      {benchCount > 0 && summary.benchXp > 0 && (
        <p className="text-xs text-muted-foreground">
          Bench: +{summary.benchXp} XP each for {benchCount} Pokémon
        </p>
      )}

      {loot && (
        <ul aria-label="Loot" className="flex flex-wrap gap-2 text-sm">
          {capsules > 0 && (
            <Chip icon={<Package className="size-4 text-primary" aria-hidden />}>
              +{capsules} Capsule{capsules === 1 ? '' : 's'}
            </Chip>
          )}
          {summary.dust > 0 && (
            <Chip icon={<Sparkles className="size-4 text-rarity-epic" aria-hidden />}>
              +{summary.dust} dust
            </Chip>
          )}
          {summary.firstClear && <Chip>First-clear bonus</Chip>}
          {summary.bonusCapsule && <Chip>Bonus capsule</Chip>}
          {streak && (
            <Chip>
              {streak.capsuleEarned
                ? 'Replay streak complete · +1 capsule'
                : `Replay streak ${streak.wins} / ${streak.every}`}
            </Chip>
          )}
        </ul>
      )}

      {quests.length > 0 && (
        <ul aria-label="Daily quests" className="flex flex-col gap-1 text-sm">
          {quests.map((q) => (
            <li key={`${q.id}@${q.day}`} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Check
                  className={cn(
                    'size-4',
                    q.completed ? 'text-rarity-uncommon' : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                {questLabel(q.kind, q.target)}
              </span>
              <span className="font-mono text-xs tabular-nums">
                {q.completed ? 'Done' : `${Math.min(q.progress, q.target)} / ${q.target}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PokemonXpRow({ result }: { result: PokemonBattleResult }) {
  const species = getSpecies(result.speciesId);
  const name = species?.name ?? `#${result.speciesId}`;
  const need = species ? xpToNextLevel(species, result.toLevel) : 1;
  return (
    <li className="flex items-center gap-3">
      <CreatureArt
        speciesId={result.speciesId}
        name={name}
        color={typeColor(species?.types[0])}
        kind="sprite"
        className="size-10 shrink-0 [image-rendering:pixelated]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="truncate font-semibold">
            {name} · Lv {result.fromLevel}
            {result.toLevel > result.fromLevel && ` → ${result.toLevel}`}
          </span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            +{result.xp} XP
          </span>
        </div>
        <XpBar
          tone="pokemon"
          label={`${name} level ${result.toLevel} XP`}
          value={result.atCap ? need : result.toXp}
          max={need}
        />
        {(result.levelsGained > 0 || result.talentPointsGained > 0 || result.atCap) && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {result.levelsGained > 0 && <Tag>Lv up</Tag>}
            {result.talentPointsGained > 0 && (
              <Tag>
                +{result.talentPointsGained} talent point
                {result.talentPointsGained === 1 ? '' : 's'}
              </Tag>
            )}
            {result.atCap && <Tag muted>Level cap</Tag>}
          </div>
        )}
      </div>
    </li>
  );
}

function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-secondary px-3 py-1 font-semibold">
      {icon}
      {children}
    </li>
  );
}

function Tag({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 font-semibold',
        muted ? 'bg-secondary text-muted-foreground' : 'bg-rarity-rare/15 text-rarity-rare',
      )}
    >
      {children}
    </span>
  );
}
