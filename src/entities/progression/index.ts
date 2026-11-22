// Public API of the progression entity: Pokémon levels/stats/talents, trainer level/talents, battle rewards.
export {
  POKEMON_TALENTS,
  TRAINER_TALENTS,
  type PokemonTalent,
  type TrainerTalent,
  type TalentBranch,
  type TalentEffect,
} from './model/talents';
export {
  TALENT_BRANCHES,
  getPokemonTalent,
  getTrainerTalent,
  pokemonTalentsOfBranch,
  learnedTalentBranches,
  trainerBonuses,
  talentModifiers,
  type TrainerBonuses,
  type TalentModifiers,
} from './model/talentCatalog';
export {
  xpToNextLevel,
  levelCap,
  isAtLevelCap,
  addPokemonXp,
  pokemonTalentPointsAt,
  talentPointsAvailable,
  nextPokemonTalentPointLevel,
  type PokemonXpResult,
} from './model/pokemonLevel';
export {
  STAT_KEYS,
  NATURE_EFFECTS,
  computeStats,
  statBreakdown,
  talentStatPercents,
  type NatureStat,
  type StatLine,
} from './model/stats';
export {
  learnPokemonTalent,
  resetPokemonTalents,
  pokemonTalentNodeState,
  learnTrainerTalent,
  resetTrainerTalents,
  trainerTalentNodeState,
  type PokemonTalentBlock,
  type LearnPokemonTalentResult,
  type TrainerTalentBlock,
  type LearnTrainerTalentResult,
  type TalentNodeState,
} from './model/talentRules';
export {
  xpToNextTrainerLevel,
  addTrainerXp,
  teamSlots,
  teamSlotUnlockLevel,
  trainerTalentPointsAt,
  unlocksAt,
  trainerTimeline,
  nextUnlock,
  nextTrainerTalentPointLevel,
  type TrainerUnlock,
  type TrainerXpResult,
} from './model/trainerLevel';
export {
  grantReward,
  effectiveReward,
  emptyReward,
  sumRewards,
  type GrantedReward,
} from './model/rewards';
export {
  applyBattleResult,
  type BattleInput,
  type BattleResult,
  type BattleSummary,
  type PokemonBattleResult,
  type TrainerBattleResult,
} from './model/battleResult';
