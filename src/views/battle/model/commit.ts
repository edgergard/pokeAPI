import type { BattleResult } from '@/entities/battle';
import { applyBattleResult, type BattleSummary } from '@/entities/progression';
import { questRows, type QuestRow } from '@/entities/quest';
import { updateSave, type Save } from '@/entities/save';

/** A daily quest this battle moved forward. */
export type QuestTick = Pick<QuestRow, 'id' | 'day' | 'kind' | 'progress' | 'target'> & {
  /** Finished by this battle. */
  completed: boolean;
};

/** Quests whose progress grew between two saves (same quest id and day). */
export function questTicks(before: Pick<Save, 'quests'>, after: Pick<Save, 'quests'>): QuestTick[] {
  const previous = new Map(questRows(before).map((row) => [`${row.id}@${row.day}`, row]));
  return questRows(after).flatMap((row) => {
    const old = previous.get(`${row.id}@${row.day}`);
    if (!old || row.progress <= old.progress) return [];
    return [
      {
        id: row.id,
        day: row.day,
        kind: row.kind,
        progress: row.progress,
        target: row.target,
        completed: row.finished && !old.finished,
      },
    ];
  });
}

export type StageOutcome = { summary: BattleSummary; quests: QuestTick[] };

/**
 * Records a finished ladder battle: one `updateSave` running `applyBattleResult` (which already
 * folds its game events into the save — they are not applied again). Returns what the result
 * screen shows, or null when nothing was recorded (save not loaded, or the stage is no longer
 * unlocked in it). The caller guards against calling it twice for one battle.
 */
export function commitStageBattle(input: {
  stage: number;
  result: BattleResult;
  teamIds: readonly number[];
}): StageOutcome | null {
  let outcome: StageOutcome | null = null;
  try {
    updateSave((save) => {
      const applied = applyBattleResult(save, {
        stage: input.stage,
        won: input.result.winner === 'red',
        damageDealt: input.result.redDamageDealt,
        teamIds: input.teamIds,
        now: Date.now(),
      });
      outcome = { summary: applied.summary, quests: questTicks(save, applied.save) };
      return applied.save;
    });
  } catch {
    // applyBattleResult throws on a stage the save no longer unlocks: nothing was written.
    return null;
  }
  return outcome;
}

/**
 * Records the onboarding win once: only while the step is still `dealt` does it apply the intro
 * reward (`applyBattleResult`, stage `intro`) and move the step to `fought` — a reload or a
 * second call never pays twice. Returns the summary, or null when nothing was recorded.
 */
export function commitIntroWin(result: BattleResult): BattleSummary | null {
  let summary: BattleSummary | null = null;
  updateSave((save) => {
    if (save.onboarding.step !== 'dealt' || result.winner !== 'red') return save;
    const applied = applyBattleResult(save, {
      stage: 'intro',
      won: true,
      damageDealt: result.redDamageDealt,
      teamIds: [],
      now: Date.now(),
    });
    summary = applied.summary;
    return { ...applied.save, onboarding: { ...applied.save.onboarding, step: 'fought' } };
  });
  return summary;
}

/** The first capsule was opened (and committed by `openOne`): onboarding step `fought` → `capsule`. */
export function markCapsuleOpened(): void {
  updateSave((save) =>
    save.onboarding.step === 'fought'
      ? { ...save, onboarding: { ...save.onboarding, step: 'capsule' } }
      : save,
  );
}

/** "Add to team": the first Pokémon replaces the loaner as the whole team; onboarding is done. */
export function finishOnboarding(speciesId: number): boolean {
  let done = false;
  updateSave((save) => {
    if (save.onboarding.step === 'done' || !save.collection[String(speciesId)]) return save;
    done = true;
    return { ...save, team: [speciesId], onboarding: { ...save.onboarding, step: 'done' } };
  });
  return done;
}

/** Writes a re-picked intro rival back to the save (only while the intro is still to be fought). */
export function storeIntroRival(rivalId: number): void {
  updateSave((save) =>
    save.onboarding.step === 'dealt' && save.onboarding.rivalSpeciesId !== rivalId
      ? { ...save, onboarding: { ...save.onboarding, rivalSpeciesId: rivalId } }
      : save,
  );
}
