// Public API of the battle-arena widget. Pages lazy-load it: the stage (three.js) is a further
// dynamic import inside, fetched only once a battle is on screen.
export { BattleArena, type BattleArenaProps } from './ui/BattleArena';
