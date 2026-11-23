import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, createNewSave } from '../model/schema';
import { detectVersion, migrateSave } from './migrate';
import { MIGRATIONS, runMigrations } from './migrations';

const ctx = { now: 1_700_000_000_000 };
const save = createNewSave({ seed: 7, now: 0, name: 'Rowan' });
const v1Roster = [
  { id: 'a', firstName: 'Ash', lastName: 'Ketchum', team: ['pikachu', 'eevee'], savedAt: 'x' },
];

describe('detectVersion', () => {
  it('reads an integer version ≥ 1', () => {
    expect(detectVersion(save)).toBe(SAVE_VERSION);
    expect(detectVersion({ version: 9 })).toBe(9);
  });

  it('rejects anything else', () => {
    for (const doc of [
      null,
      undefined,
      'save',
      42,
      [],
      {},
      { version: '2' },
      { version: 0 },
      { version: 1.5 },
    ]) {
      expect(detectVersion(doc)).toBeNull();
    }
  });
});

describe('migration chain', () => {
  it('has a step for every version below the current one', () => {
    for (let v = 1; v < SAVE_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function');
  });

  it('validates a current document without migrating it', () => {
    expect(runMigrations(SAVE_VERSION, save, ctx)).toEqual({ ok: true, save, migratedFrom: null });
  });

  it('rejects a current document that fails the schema', () => {
    expect(runMigrations(SAVE_VERSION, { ...save, dust: -1 }, ctx)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('rejects newer and nonsense versions', () => {
    expect(runMigrations(SAVE_VERSION + 1, save, ctx)).toEqual({ ok: false, reason: 'newer' });
    expect(runMigrations(0, save, ctx)).toEqual({ ok: false, reason: 'invalid' });
    expect(runMigrations(Number.NaN, save, ctx)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('upgrades a v1 roster to a valid current save', () => {
    const result = runMigrations(1, v1Roster, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFrom).toBe(1);
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.team).toEqual([25]);
    expect(result.save.meta.createdAt).toBe(ctx.now);
  });

  it('reports an old document with nothing to import as empty', () => {
    expect(runMigrations(1, [], ctx)).toEqual({ ok: false, reason: 'empty' });
    expect(runMigrations(1, { not: 'a roster' }, ctx)).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('migrateSave', () => {
  it('takes the fast path for current documents', async () => {
    await expect(migrateSave(SAVE_VERSION, save, ctx)).resolves.toEqual({
      ok: true,
      save,
      migratedFrom: null,
    });
    await expect(migrateSave(SAVE_VERSION, { version: 2 }, ctx)).resolves.toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('flags newer documents without loading the chain', async () => {
    await expect(migrateSave(SAVE_VERSION + 1, {}, ctx)).resolves.toEqual({
      ok: false,
      reason: 'newer',
    });
  });

  it('runs the chain for older documents', async () => {
    const result = await migrateSave(1, v1Roster, ctx);
    expect(result).toMatchObject({ ok: true, migratedFrom: 1 });
  });
});
