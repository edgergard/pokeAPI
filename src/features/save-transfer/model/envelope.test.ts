import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, createNewSave } from '@/entities/save';
import { packText, sha256Hex, unpackText } from './codec';
import {
  SAVE_FILE_FORMAT,
  decodeSaveFile,
  encodeEnvelope,
  encodeSaveFile,
  exportFileName,
} from './envelope';

const now = Date.UTC(2026, 10, 22, 12);
const save = {
  ...createNewSave({ seed: 42, now: 1000, name: 'Rowan' }),
  dust: 120,
  team: [25],
  collection: {
    '25': {
      speciesId: 25,
      level: 7,
      xp: 3,
      stars: 2,
      dupes: 1,
      ivs: { hp: 1, attack: 2, defense: 3, specialAttack: 4, specialDefense: 5, speed: 31 },
      nature: 'brave' as const,
      talents: ['t1'],
      obtainedAt: 2000,
    },
  },
};
const opts = { now, gameVersion: '4.0.0-test' };

describe('save file envelope', () => {
  it('round-trips a save exactly', async () => {
    const text = await encodeSaveFile(save, opts);
    expect(text).toMatch(/^[A-Za-z0-9+/]+=*$/);
    await expect(decodeSaveFile(text, { now })).resolves.toEqual({
      ok: true,
      save,
      migratedFrom: null,
    });
  });

  it('writes the documented envelope', async () => {
    const envelope = await unpackText(await encodeSaveFile(save, opts));
    expect(envelope).toEqual({
      format: SAVE_FILE_FORMAT,
      schemaVersion: SAVE_VERSION,
      gameVersion: '4.0.0-test',
      createdAt: now,
      checksum: await sha256Hex(JSON.stringify(save)),
      data: save,
    });
  });

  it('tolerates line breaks around the base64 text', async () => {
    const text = await encodeSaveFile(save, opts);
    const wrapped = `\n${text.replace(/(.{60})/g, '$1\n')}\n`;
    await expect(decodeSaveFile(wrapped, { now })).resolves.toMatchObject({ ok: true, save });
  });

  describe('damaged or foreign files', () => {
    it.each([
      ['empty text', ''],
      ['plain text', 'hello, I am not a save'],
      ['raw JSON', JSON.stringify(save)],
      ['base64 of non-gzip', btoa('not gzip at all')],
    ])('rejects %s', async (_label, text) => {
      await expect(decodeSaveFile(text, { now })).resolves.toEqual({ ok: false, error: 'damaged' });
    });

    it('rejects a truncated file', async () => {
      const text = await encodeSaveFile(save, opts);
      const truncated = text.slice(0, Math.floor(text.length / 2));
      await expect(decodeSaveFile(truncated, { now })).resolves.toEqual({
        ok: false,
        error: 'damaged',
      });
    });

    it('rejects an edited file', async () => {
      const text = await encodeSaveFile(save, opts);
      const middle = Math.floor(text.length / 2);
      const flipped = text[middle] === 'A' ? 'B' : 'A';
      const edited = `${text.slice(0, middle)}${flipped}${text.slice(middle + 1)}`;
      await expect(decodeSaveFile(edited, { now })).resolves.toEqual({
        ok: false,
        error: 'damaged',
      });
    });

    it('rejects a wrong checksum', async () => {
      const tampered = await packText({
        format: SAVE_FILE_FORMAT,
        schemaVersion: SAVE_VERSION,
        gameVersion: 'x',
        createdAt: now,
        checksum: await sha256Hex(JSON.stringify(save)),
        data: { ...save, dust: 999_999 },
      });
      await expect(decodeSaveFile(tampered, { now })).resolves.toEqual({
        ok: false,
        error: 'damaged',
      });
    });

    it('rejects another format', async () => {
      const other = await packText({
        format: 'some-other-game',
        schemaVersion: SAVE_VERSION,
        gameVersion: 'x',
        createdAt: now,
        checksum: await sha256Hex(JSON.stringify(save)),
        data: save,
      });
      await expect(decodeSaveFile(other, { now })).resolves.toEqual({
        ok: false,
        error: 'damaged',
      });
    });

    it('rejects valid packaging around an invalid save', async () => {
      const text = await encodeEnvelope({
        schemaVersion: SAVE_VERSION,
        data: { ...save, dust: -5 },
        gameVersion: 'x',
        createdAt: now,
      });
      await expect(decodeSaveFile(text, { now })).resolves.toEqual({
        ok: false,
        error: 'damaged',
      });
    });
  });

  it('reports a file from a newer version', async () => {
    const text = await encodeEnvelope({
      schemaVersion: SAVE_VERSION + 1,
      data: { anything: true },
      gameVersion: '9.0.0',
      createdAt: now,
    });
    await expect(decodeSaveFile(text, { now })).resolves.toEqual({ ok: false, error: 'newer' });
  });

  it('migrates a schemaVersion 1 file (a v1 roster)', async () => {
    const roster = [
      { id: 'a', firstName: 'Ash', lastName: 'K', team: ['pikachu', 'eevee'], savedAt: 'x' },
    ];
    const text = await encodeEnvelope({
      schemaVersion: 1,
      data: roster,
      gameVersion: '3.0.0',
      createdAt: now,
    });
    const result = await decodeSaveFile(text, { now });
    expect(result).toMatchObject({ ok: true, migratedFrom: 1 });
    if (!result.ok) return;
    expect(result.save.meta.migratedFromV1).toBe(true);
    expect(result.save.team).toEqual([25]);
  });

  it('rejects a v1 file with nothing to import', async () => {
    const text = await encodeEnvelope({
      schemaVersion: 1,
      data: [],
      gameVersion: '3.0.0',
      createdAt: now,
    });
    await expect(decodeSaveFile(text, { now })).resolves.toEqual({ ok: false, error: 'damaged' });
  });
});

describe('exportFileName', () => {
  it('uses the local date', () => {
    expect(exportFileName(new Date(2026, 0, 5, 23, 59).getTime())).toBe(
      'trainer-studio-2026-01-05.txt',
    );
    expect(exportFileName(new Date(2026, 10, 22, 0, 1).getTime())).toBe(
      'trainer-studio-2026-11-22.txt',
    );
  });
});
