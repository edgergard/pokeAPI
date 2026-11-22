import { createNewSave, type OwnedPokemon, type Save } from '@/entities/save';

/** Test-only helpers for the home view. */

type SaveOverrides = Partial<Omit<Save, 'meta' | 'trainer' | 'onboarding'>> & {
  meta?: Partial<Save['meta']>;
  trainer?: Partial<Save['trainer']>;
  onboarding?: Partial<Save['onboarding']>;
};

/** A deterministic save (seed 42, created at `now`) with overrides. */
export function homeSave(overrides: SaveOverrides = {}, now = 0): Save {
  const base = createNewSave({ seed: 42, now, name: 'Rowan' });
  const { meta, trainer, onboarding, ...rest } = overrides;
  return {
    ...base,
    ...rest,
    meta: { ...base.meta, ...meta },
    trainer: { ...base.trainer, ...trainer },
    onboarding: { ...base.onboarding, ...onboarding },
  };
}

/** An owned Pokémon. */
export function ownedMon(speciesId: number, fields: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    speciesId,
    level: 1,
    xp: 0,
    stars: 1,
    dupes: 0,
    ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
    nature: 'neutral',
    talents: [],
    obtainedAt: 0,
    ...fields,
  };
}

/** A collection record from owned Pokémon. */
export function collectionOf(...mons: OwnedPokemon[]): Save['collection'] {
  return Object.fromEntries(mons.map((m) => [String(m.speciesId), m]));
}

/** A finished-onboarding save with one Pokémon in the team (the hub). */
export function hubSave(overrides: SaveOverrides = {}, now = 0): Save {
  const first = ownedMon(25, { level: 3 });
  return homeSave(
    {
      collection: collectionOf(first),
      team: [25],
      capsulesOpened: 1,
      ...overrides,
      onboarding: {
        step: 'done',
        loanerSpeciesId: 19,
        rivalSpeciesId: 16,
        ...overrides.onboarding,
      },
    },
    now,
  );
}

/**
 * jsdom lacks `<dialog>.showModal/close` and `window.matchMedia`: minimal stand-ins so components
 * mount (same idea as the capsule-reveal widget's helper; slices don't share test code).
 */
export function polyfillHomeDom(): void {
  const proto = HTMLElement.prototype as HTMLElement & {
    showModal?: () => void;
    close?: () => void;
  };
  const dialogProto = (globalThis.HTMLDialogElement?.prototype ?? proto) as typeof proto;
  if (typeof dialogProto.showModal !== 'function') {
    dialogProto.showModal = function showModal(this: HTMLElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof dialogProto.close !== 'function') {
    dialogProto.close = function close(this: HTMLElement) {
      this.removeAttribute('open');
    };
  }
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
}
