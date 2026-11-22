// Public API of the battle-arena widget. Pages lazy-load it: the stage (three.js) is a further
// dynamic import inside, fetched only once a battle is on screen.
export { BattleArena, type BattleArenaProps, type ResultActions } from './ui/BattleArena';
export { ResultOverlay } from './ui/ResultOverlay';
export { FighterBadges } from './ui/FighterBadges';
export { describeResult } from './model/hudState';
export { INTRO_SKIP_DELAY_SECONDS } from './model/useSkipCountdown';
