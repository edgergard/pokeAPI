import { describe, expect, it } from 'vitest';
import { allSpecies } from '@/entities/pokemon';
import { ownedPokemonSchema, saveSchema } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { craftSpecies } from './craftSpecies';
import { owned, testSave } from './testSave';

const NOW = 1_700_000_000_000;
const common = allSpecies.find((s) => s.rarity === 'common');
const legendary = allSpecies.find((s) => s.rarity === 'legendary');
if (!common || !legendary) throw new Error('species data is missing rarities');

describe('craftSpecies', () => {
  it('charges economy.dust.craftPrice[rarity] and adds the species at ★1', () => {
    const price = economy.dust.craftPrice.common;
    const save = testSave({ dust: price + 15 });
    const out = craftSpecies(save, common.id, NOW);
    if (!out.ok) throw new Error(`craft failed: ${out.reason}`);

    expect(out.save.dust).toBe(15);
    const pokemon = out.save.collection[String(common.id)];
    expect(() => ownedPokemonSchema.parse(pokemon)).not.toThrow();
    expect(pokemon).toMatchObject({ level: 1, stars: 1, dupes: 0, obtainedAt: NOW, talents: [] });
    expect(out.result).toMatchObject({
      kind: 'craft',
      speciesId: common.id,
      rarity: 'common',
      outcome: 'new',
      price,
    });
    expect(() => saveSchema.parse(out.save)).not.toThrow();
  });

  it('seeds IVs and nature from (save seed, species) and never touches the pull index', () => {
    const save = testSave({ dust: 10_000 });
    const a = craftSpecies(save, common.id, NOW);
    const b = craftSpecies(save, common.id, NOW + 5);
    if (!a.ok || !b.ok) throw new Error('craft failed');
    const pa = a.save.collection[String(common.id)];
    const pb = b.save.collection[String(common.id)];
    expect(pa?.ivs).toEqual(pb?.ivs);
    expect(pa?.nature).toBe(pb?.nature);
    expect(a.save.meta).toEqual(save.meta);
    expect(a.save.capsulesOpened).toBe(save.capsulesOpened);
  });

  it('refuses a species the player already owns', () => {
    const save = testSave({ dust: 10_000, collection: { [String(common.id)]: owned(common.id) } });
    expect(craftSpecies(save, common.id, NOW)).toEqual({ ok: false, reason: 'owned' });
  });

  it('refuses an unknown species', () => {
    expect(craftSpecies(testSave({ dust: 10_000 }), 999_999, NOW)).toEqual({
      ok: false,
      reason: 'unknownSpecies',
    });
  });

  it('refuses when dust is short and says how much is missing', () => {
    const price = economy.dust.craftPrice.legendary;
    const save = testSave({ dust: price - 40 });
    expect(craftSpecies(save, legendary.id, NOW)).toEqual({
      ok: false,
      reason: 'notEnoughDust',
      price,
      missing: 40,
    });
  });
});
