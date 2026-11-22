// Public API of the save entity — other layers import only from here.
export {
  SAVE_VERSION,
  ONBOARDING_STEPS,
  NATURES,
  saveSchema,
  ownedPokemonSchema,
  questSchema,
  createNewSave,
  type Save,
  type OwnedPokemon,
  type Quest,
  type OnboardingStep,
  type Nature,
} from './model/schema';
export {
  useSave,
  useSaveStatus,
  getSave,
  updateSave,
  replaceSave,
  initSave,
  isStorageAtRisk,
  subscribe,
  type SavePersistence,
  type LoadResult,
  type SaveStatus,
} from './model/store';
export {
  registerGameEventReducer,
  applyGameEvents,
  type GameEvent,
  type GameEventKind,
  type GameEventReducer,
} from './model/events';
export { createDefaultPersistence } from './persistence';
