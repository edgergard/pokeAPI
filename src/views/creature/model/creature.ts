import { getSpecies, SPECIES_COUNT, type Species, type StatKey } from '@/entities/pokemon';
import {
  STAT_KEYS,
  TALENT_BRANCHES,
  getPokemonTalent,
  pokemonTalentNodeState,
  pokemonTalentsOfBranch,
  statBreakdown,
  teamSlots,
  type TalentBranch,
} from '@/entities/progression';
import type { OwnedPokemon, Save } from '@/entities/save';
import { formatName } from '@/shared/lib/format';
import type { TalentGroupView, TalentNodeView } from '@/widgets/talent-tree';

/** Longest raw `?id` echoed back in "No Pokémon #<id>". */
const MAX_ID_ECHO = 12;

export type CreatureQuery =
  { kind: 'species'; species: Species } | { kind: 'invalid'; raw: string } | { kind: 'missing' };

/** Reads `?id=`: a dex number of a baked species, or why it isn't one. */
export function parseCreatureId(raw: string | null): CreatureQuery {
  if (raw === null || raw.trim() === '') return { kind: 'missing' };
  const text = raw.trim();
  const species = /^\d+$/.test(text) ? getSpecies(Number(text)) : undefined;
  if (species) return { kind: 'species', species };
  return {
    kind: 'invalid',
    raw: text.length > MAX_ID_ECHO ? `${text.slice(0, MAX_ID_ECHO)}…` : text,
  };
}

/** Previous / next species by dex number, wrapping at the ends. */
export function neighbours(id: number): { prev: Species | undefined; next: Species | undefined } {
  const prevId = id <= 1 ? SPECIES_COUNT : id - 1;
  const nextId = id >= SPECIES_COUNT ? 1 : id + 1;
  return { prev: getSpecies(prevId), next: getSpecies(nextId) };
}

export const creatureHref = (id: number) => `/creature/?id=${id}`;

export const STAT_LABEL: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  specialAttack: 'Sp. Atk',
  specialDefense: 'Sp. Def',
  speed: 'Speed',
};

/** "Attack 54 → 60" for every stat that differs between two talent sets (empty when none). */
export function statChanges(
  species: Pick<Species, 'stats'>,
  owned: OwnedPokemon,
  before: readonly string[],
  after: readonly string[],
): string[] {
  const from = statBreakdown(species, owned, before);
  const to = statBreakdown(species, owned, after);
  return STAT_KEYS.flatMap((stat) =>
    from[stat].current === to[stat].current
      ? []
      : [`${STAT_LABEL[stat]} ${from[stat].current} → ${to[stat].current}`],
  );
}

export const BRANCH_GROUPS: readonly TalentGroupView[] = TALENT_BRANCHES.map(
  (branch: TalentBranch) => ({ id: branch, label: formatName(branch) }),
);

/** Copy for a locked Pokémon talent (see the JSDoc of `PokemonTalentBlock`). */
function lockedReason(
  owned: Pick<OwnedPokemon, 'level' | 'talents'>,
  state: ReturnType<typeof pokemonTalentNodeState>,
): string | undefined {
  if (state.state !== 'locked') return undefined;
  switch (state.reason) {
    case 'requiresTier':
      return `Requires: ${getPokemonTalent(state.requires)?.name ?? state.requires}`;
    case 'noPoints':
      return talentPointNote(owned, state.nextPointAt);
    case 'unknownTalent':
      return 'Unknown talent';
  }
}

/** "First talent point at Lv 5" (no talents yet) / "Next point at Lv 10" / no more points. */
export function talentPointNote(
  owned: Pick<OwnedPokemon, 'talents'>,
  nextPointAt: number | null,
): string {
  if (nextPointAt === null) return 'No more talent points';
  return owned.talents.length === 0
    ? `First talent point at Lv ${nextPointAt}`
    : `Next point at Lv ${nextPointAt}`;
}

/** The 3 × 4 Pokémon tree as TalentTree nodes, states from `pokemonTalentNodeState`. */
export function pokemonTalentNodes(
  owned: Pick<OwnedPokemon, 'level' | 'talents'>,
): TalentNodeView[] {
  return TALENT_BRANCHES.flatMap((branch) =>
    pokemonTalentsOfBranch(branch).map((talent, i, list) => {
      const state = pokemonTalentNodeState(owned, talent.id);
      const previous = list[i - 1];
      return {
        id: talent.id,
        name: talent.name,
        description: talent.description,
        group: branch,
        tier: talent.tier,
        requires: previous ? [previous.name] : [],
        state: state.state,
        reason: lockedReason(owned, state),
      };
    }),
  );
}

export type TeamStatus = { kind: 'inTeam' } | { kind: 'canAdd' } | { kind: 'full'; slots: number };

export function teamStatus(save: Pick<Save, 'team' | 'trainer'>, speciesId: number): TeamStatus {
  if (save.team.includes(speciesId)) return { kind: 'inTeam' };
  const slots = teamSlots(save.trainer.level);
  return save.team.length < slots ? { kind: 'canAdd' } : { kind: 'full', slots };
}

/** Adds an owned Pokémon to the team while a slot is free (same save when it can't). */
export function addToTeam(save: Save, speciesId: number): Save {
  if (save.collection[String(speciesId)] === undefined) return save;
  if (teamStatus(save, speciesId).kind !== 'canAdd') return save;
  return { ...save, team: [...save.team, speciesId] };
}

/** Writes an updated owned Pokémon back into the collection, immutably. */
export function withOwned(save: Save, owned: OwnedPokemon): Save {
  return { ...save, collection: { ...save.collection, [String(owned.speciesId)]: owned } };
}
