// Public API of the ladder entity: the 25 fixed PvE stages, ladder progress and team power.
export {
  stageInfo,
  allStages,
  rivalTeamSize,
  rivalRarities,
  rivalLevel,
  starsForLevel,
  stageWinXp,
  type StageInfo,
  type RivalMember,
} from './model/stages';
export {
  stageStatus,
  isStageUnlocked,
  nextStageToFight,
  isLadderComplete,
  type StageStatus,
} from './model/progress';
export {
  statPower,
  teamPower,
  rivalStats,
  ownedStats,
  ownedPower,
  collectionTeamPower,
  strongestTeam,
  type StatBlock,
} from './model/power';
export { RIVAL_FIRST_NAMES, RIVAL_LAST_NAMES } from './model/names';
