'use client';

import { useRef, useState } from 'react';
import { claimQuest, questBoard, type ClaimQuestResult } from '@/entities/quest';
import { updateSave, type Save } from '@/entities/save';
import { QuestList } from '@/widgets/quest-list';
import { claimAnnouncement } from '../model/quests';
import { panel } from './styles';

/** Daily quests on the hub: the board at `now` and Claim (committed with its level-ups in one update). */
export function HubQuests({
  save,
  now,
}: {
  save: Pick<Save, 'quests' | 'trainer' | 'meta'>;
  /** `Date.now()` of this render. */
  now: number;
}) {
  const board = questBoard(save, now);
  const [message, setMessage] = useState({ id: 0, text: '' });
  const headingRef = useRef<HTMLHeadingElement>(null);

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
    // TODO(2-play): open widgets/level-up on levelsGained
    setMessage((m) => ({ id: m.id + 1, text: claimAnnouncement(result) }));
    // The Claim button is gone with the claimed row: keep keyboard focus in the section.
    headingRef.current?.focus({ preventScroll: true });
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
      <p role="status" className="text-sm font-semibold text-rarity-uncommon empty:hidden">
        {message.text && <span key={message.id}>{message.text}</span>}
      </p>
    </section>
  );
}
