'use client';

import { useState, type RefObject } from 'react';
import type { TrainerUnlock } from '@/entities/progression';
import { claimQuest, questBoard, type ClaimQuestResult } from '@/entities/quest';
import { updateSave, type Save } from '@/entities/save';
import { QuestList } from '@/widgets/quest-list';
import { claimAnnouncement } from '../model/quests';
import { panel } from './styles';

/**
 * Daily quests on the hub: the board at `now` and Claim (committed with its level-ups in one update).
 * The claim result is spoken by the page's live region (`announce`), which exists from the first paint;
 * the line under the list only repeats it for sighted players. A claim that levels the trainer up
 * hands the new level and its unlocks to `onLevelUp`; the hub opens the level-up dialog a moment
 * later, once the announcement has been spoken (a modal makes the live region inert).
 */
export function HubQuests({
  save,
  now,
  announce,
  headingRef,
  onLevelUp,
}: {
  save: Pick<Save, 'quests' | 'trainer' | 'meta'>;
  /** `Date.now()` of this render. */
  now: number;
  announce: (text: string) => void;
  /** The section heading: focused after a claim and by the level-up's "See quests". */
  headingRef: RefObject<HTMLHeadingElement | null>;
  onLevelUp: (levelUp: { toLevel: number; unlocks: TrainerUnlock[] }) => void;
}) {
  const board = questBoard(save, now);
  const [message, setMessage] = useState({ id: 0, text: '' });

  const claim = (id: string, day: string) => {
    const out: { result?: ClaimQuestResult } = {};
    updateSave((s) => {
      const result = claimQuest(s, id, day);
      out.result = result;
      // claimQuest already folded its trainerLeveled events in: commit its save as is.
      return result.ok ? result.save : s;
    });
    const { result } = out;
    if (!result?.ok) return;
    const text = claimAnnouncement(result);
    setMessage((m) => ({ id: m.id + 1, text }));
    announce(text);
    // The Claim button is gone with the claimed row: keep keyboard focus in the section.
    headingRef.current?.focus({ preventScroll: true });
    if (result.levelsGained > 0) {
      onLevelUp({ toLevel: result.save.trainer.level, unlocks: result.unlocks });
    }
  };

  return (
    <section aria-labelledby="quests-title" className={panel}>
      <h2
        id="quests-title"
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-xl font-bold tracking-tight outline-none"
      >
        Daily quests
      </h2>
      <QuestList board={board} now={now} onClaim={claim} playHref="/ladder/" />
      {message.text && (
        <p
          key={message.id}
          aria-hidden
          data-testid="quest-claim-result"
          className="text-sm font-semibold text-rarity-uncommon"
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
