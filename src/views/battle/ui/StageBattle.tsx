import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Swords, Users } from 'lucide-react';
import { loadMovesets, type BattleResult, type BattleTeam } from '@/entities/battle';
import { collectionTeamPower, stageInfo, stageStatus } from '@/entities/ladder';
import { getSave, useSave } from '@/entities/save';
import { CAPSULE_TIERS } from '@/shared/config/economy';
import { Button } from '@/shared/ui/Button';
import { LevelUpDialog } from '@/widgets/level-up';
import { TeamDialog } from '@/widgets/team-dialog';
import { commitStageBattle, type StageOutcome } from '../model/commit';
import { battleSeed, buildStageTeams, rivalMember, stageLineups } from '../model/fighters';
import { resultPhrase } from '../model/suggestion';
import { Arena, preloadArena } from './Arena';
import { FighterCard } from './FighterCard';
import { StageResult } from './StageResult';

type Phase =
  | { kind: 'preview' }
  | { kind: 'arena'; red: BattleTeam; blue: BattleTeam; seed: number; teamIds: number[] };

const formatPower = (n: number) => n.toLocaleString('en-US');

/** After a dialog's exit (Dialog's 300 ms fallback), so its native focus restore has happened. */
const DIALOG_EXIT_MS = 350;

/**
 * One ladder battle (design.md `battle`, flow `loop`): preview (your N vs the rival's N, Fight
 * focused) → arena → result. Rewards are committed once when the battle first finishes; leaving
 * mid-battle records nothing. Remounted (keyed) for every new attempt or stage.
 */
export function StageBattle({
  stage,
  onRetry,
  onArena,
}: {
  stage: number;
  /** "Retry": a fresh attempt from the preview. */
  onRetry: () => void;
  /** Tells the page when the arena is on screen (the backdrop pauses). */
  onArena: (active: boolean) => void;
}) {
  const save = useSave((s) => s);
  const info = stageInfo(stage);
  const [phase, setPhase] = useState<Phase>({ kind: 'preview' });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<StageOutcome | null>(null);
  const [commitFailed, setCommitFailed] = useState(false);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [team, setTeam] = useState<{ open: boolean; highlight: number | null }>({
    open: false,
    highlight: null,
  });
  /** One commit per battle, whatever the arena, StrictMode or a Replay does. */
  const committed = useRef(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const arenaRef = useRef<HTMLElement>(null);
  const teamTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(teamTimer.current), []);

  // Warm the arena chunk and the movesets while the player looks at the preview.
  useEffect(() => {
    preloadArena();
    void loadMovesets().catch(() => {});
  }, []);

  useEffect(() => {
    if (phase.kind === 'preview') primaryRef.current?.focus({ preventScroll: true });
    else arenaRef.current?.focus({ preventScroll: true });
    onArena(phase.kind === 'arena');
  }, [phase.kind, onArena]);
  useEffect(() => () => onArena(false), [onArena]);

  if (!save) return null;

  const lineups = stageLineups(save, stage);
  const status = stageStatus(save, stage);
  const yourPower = collectionTeamPower(save.collection, save.team);
  const openTeam = (highlight: number | null = null) => setTeam({ open: true, highlight });

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const movesets = await loadMovesets();
      const current = getSave();
      if (!current) throw new Error('save not loaded');
      const fresh = stageLineups(current, stage);
      if (fresh.size === 0) {
        openTeam();
        return;
      }
      const teams = buildStageTeams(fresh, current.trainer.name, movesets);
      // Fixed when the battle starts: Replay plays the same seed, the next battle gets a new one.
      setPhase({ kind: 'arena', ...teams, seed: battleSeed(current), teamIds: fresh.red.ids });
    } catch {
      setError('Couldn’t prepare the battle. Check your connection and try again.');
    } finally {
      setStarting(false);
    }
  };

  const onFinished = (result: BattleResult) => {
    if (committed.current || phase.kind !== 'arena') return;
    committed.current = true;
    const recorded = commitStageBattle({ stage, result, teamIds: phase.teamIds });
    setOutcome(recorded);
    setCommitFailed(recorded === null);
    if (recorded && recorded.summary.trainer.levelsGained > 0) setLevelUpOpen(true);
  };

  const resultMessage = (result: BattleResult) => {
    const won = result.winner === 'red';
    if (outcome) {
      const { summary } = outcome;
      return resultPhrase({
        won,
        capsules: CAPSULE_TIERS.reduce((n, tier) => n + summary.capsules[tier], 0),
        trainerLevel: summary.trainer.levelsGained > 0 ? summary.trainer.toLevel : null,
      });
    }
    return commitFailed ? resultPhrase({ won, capsules: 0, trainerLevel: null }) : '';
  };

  const empty = lineups.size === 0;
  const rivalCards = empty
    ? info.rival.flatMap((m) => {
        const spec = rivalMember(m);
        return spec ? [spec] : [];
      })
    : lineups.blue.members;

  return (
    <>
      <header className="flex flex-col gap-3">
        <Link
          href="/ladder/"
          className="tap-target -ml-3 inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to ladder
        </Link>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Stage {stage} · Rival {info.rivalName}
        </h1>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          Recommended power {formatPower(info.power)} · Yours {formatPower(yourPower)}
          {status !== 'cleared' && (
            <>
              {' '}
              · First clear: +{info.firstClear.capsules?.basic ?? 0} Capsule · +
              {info.firstClear.dust ?? 0} dust
            </>
          )}
        </p>
      </header>

      {phase.kind === 'preview' ? (
        <section aria-label="Lineups" data-phase="preview" className="flex flex-col gap-5">
          <div className="grid items-start gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-side-red">
                Your team{!empty && ` · ${lineups.size}`}
              </h2>
              {empty ? (
                <p className="rounded-2xl border border-dashed border-input p-4 text-sm text-muted-foreground">
                  Your team is empty. Pick who fights first.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lineups.red.members.map((m) => (
                    <FighterCard key={m.species.id} member={m} side="red" />
                  ))}
                </ul>
              )}
            </div>
            <span
              aria-hidden
              className="self-center justify-self-center font-display text-2xl font-extrabold text-muted-foreground"
            >
              VS
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-side-blue">
                Rival {info.rivalName} · {rivalCards.length}
              </h2>
              <ul className="flex flex-col gap-2">
                {rivalCards.map((m) => (
                  <FighterCard key={m.species.id} member={m} side="blue" />
                ))}
              </ul>
            </div>
          </div>

          {lineups.trimmed && (
            <p className="text-sm text-muted-foreground">
              {lineups.size} vs {lineups.size}: both sides field their first {lineups.size} Pokémon
              (the rival brings {info.rival.length}, your team has {save.team.length}).
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {empty ? (
              <Button
                ref={primaryRef}
                size="lg"
                onClick={() => openTeam()}
                className="cursor-pointer"
              >
                <Users className="size-4" aria-hidden />
                Fill team
              </Button>
            ) : (
              <Button
                ref={primaryRef}
                size="lg"
                onClick={() => void start()}
                aria-busy={starting || undefined}
                className="cursor-pointer"
              >
                <Swords className="size-4" aria-hidden />
                Fight
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              onClick={() => openTeam()}
              className="cursor-pointer"
            >
              Edit team
            </Button>
          </div>
        </section>
      ) : (
        <section
          ref={arenaRef}
          tabIndex={-1}
          aria-label="Battle"
          data-phase="arena"
          className="focus:outline-none"
        >
          <Arena
            red={phase.red}
            blue={phase.blue}
            seed={phase.seed}
            onFinished={onFinished}
            resultMessage={resultMessage}
            renderResult={(result, actions) => (
              <StageResult
                stage={stage}
                result={result}
                outcome={outcome}
                failed={commitFailed}
                trainerName={save.trainer.name}
                onRetry={onRetry}
                onEditTeam={() => openTeam()}
                onReplay={actions.replay}
              />
            )}
          />
        </section>
      )}

      <TeamDialog
        open={team.open}
        highlightSlot={team.highlight}
        onClose={() => setTeam((t) => ({ ...t, open: false }))}
      />
      {outcome && outcome.summary.trainer.levelsGained > 0 && (
        <LevelUpDialog
          result={outcome.summary.trainer}
          open={levelUpOpen}
          onClose={() => setLevelUpOpen(false)}
          onFillSlot={(slot) => {
            setLevelUpOpen(false);
            // After the level-up has closed and handed focus back to the result: the team dialog
            // then returns focus there too.
            clearTimeout(teamTimer.current);
            teamTimer.current = setTimeout(() => openTeam(slot), DIALOG_EXIT_MS);
          }}
        />
      )}
    </>
  );
}
