import {
  TRAINER_TALENTS,
  getTrainerTalent,
  trainerTalentNodeState,
  type TrainerTalent,
  type TrainerUnlock,
} from '@/entities/progression';
import { saveSchema, type Save } from '@/entities/save';
import type { TalentGroupView, TalentNodeView } from '@/widgets/talent-tree';

/** Labels for the talent lines, keyed by the talent that starts each line. */
const LINE_LABEL: Record<string, { label: string; description: string }> = {
  'field-notes': { label: 'Training', description: 'Battle XP and the bench share' },
  'dust-collector': { label: 'Scavenging', description: 'Dust and bonus capsules' },
  'quick-draw': { label: 'Tactics', description: 'Team-wide critical hits' },
};

const CAPSTONES = 'capstones';

type Placement = { group: string; tier: number };

/**
 * Lays the trainer talents out as lines: a talent with no prerequisite starts a line, a talent with one
 * prerequisite continues its line, and talents that join several lines are capstones.
 */
export function trainerTalentLayout(talents: readonly TrainerTalent[] = TRAINER_TALENTS): {
  groups: TalentGroupView[];
  placement: Map<string, Placement>;
} {
  const groups: TalentGroupView[] = [];
  const placement = new Map<string, Placement>();
  const capstones: TrainerTalent[] = [];

  for (const talent of talents) {
    const [only, ...rest] = talent.requires;
    const parent = only !== undefined && rest.length === 0 ? placement.get(only) : undefined;
    if (talent.requires.length === 0) {
      const line = LINE_LABEL[talent.id];
      groups.push({
        id: talent.id,
        label: line?.label ?? `${talent.name} line`,
        description: line?.description,
      });
      placement.set(talent.id, { group: talent.id, tier: 1 });
    } else if (parent) {
      placement.set(talent.id, { group: parent.group, tier: parent.tier + 1 });
    } else {
      capstones.push(talent);
    }
  }

  if (capstones.length > 0) {
    groups.push({ id: CAPSTONES, label: 'Capstones', description: 'Join several lines' });
    capstones.forEach((talent, i) => placement.set(talent.id, { group: CAPSTONES, tier: i + 1 }));
  }
  return { groups, placement };
}

const talentName = (id: string) => getTrainerTalent(id)?.name ?? id;

/** "Next point at Lv 9", or that no more points come. */
export function nextPointText(nextPointAt: number | null): string {
  return nextPointAt === null ? 'No more talent points' : `Next point at Lv ${nextPointAt}`;
}

/** Copy for a locked trainer talent (see the JSDoc of `TrainerTalentBlock`). */
function lockedReason(state: ReturnType<typeof trainerTalentNodeState>): string | undefined {
  if (state.state !== 'locked') return undefined;
  switch (state.reason) {
    case 'requiresLevel':
      return `Requires Trainer Lv ${state.level}`;
    case 'requiresTalents':
      return `Requires: ${state.missing.map(talentName).join(', ')}`;
    case 'noPoints':
      return nextPointText(state.nextPointAt);
    case 'unknownTalent':
      return 'Unknown talent';
  }
}

/** Trainer tree nodes for TalentTree, states from `trainerTalentNodeState`. */
export function trainerTalentNodes(save: Pick<Save, 'trainer'>): TalentNodeView[] {
  const { placement } = trainerTalentLayout();
  return TRAINER_TALENTS.flatMap((talent) => {
    const place = placement.get(talent.id);
    if (!place) return [];
    const state = trainerTalentNodeState(save, talent.id);
    return [
      {
        id: talent.id,
        name: talent.name,
        description: talent.description,
        group: place.group,
        tier: place.tier,
        requires: talent.requires.map(talentName),
        state: state.state,
        reason: lockedReason(state),
        tag: `Lv ${talent.requiresLevel}`,
      },
    ];
  });
}

/** A readable label for one trainer-level unlock. */
export function unlockLabel(unlock: TrainerUnlock): string {
  switch (unlock.kind) {
    case 'teamSlot':
      return `Team slot ${unlock.slots}`;
    case 'dailyQuests':
      return 'Daily quests';
    case 'greatCapsules':
      return 'Great capsules';
    case 'trainerTalent':
      return `Talent: ${talentName(unlock.id)}`;
    case 'talentPoint':
      return `+${unlock.count} talent ${unlock.count === 1 ? 'point' : 'points'}`;
  }
}

/** The save's own rule for a trainer name (1–24 characters), applied to the trimmed input. */
const nameSchema = saveSchema.shape.trainer.shape.name;

export const NAME_ERROR = 'Use 1 to 24 characters.';

/** The trimmed name when valid, or null. */
export function validTrainerName(input: string): string | null {
  const name = input.trim();
  return nameSchema.safeParse(name).success ? name : null;
}
