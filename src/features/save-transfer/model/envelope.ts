import { z } from 'zod';
import { SAVE_VERSION, migrateSave, type Save } from '@/entities/save';
import { packText, sha256Hex, unpackText } from './codec';

export const SAVE_FILE_FORMAT = 'trainer-studio-save';

/** What a save file holds once base64 and gzip are peeled off. */
export type SaveEnvelope = {
  format: typeof SAVE_FILE_FORMAT;
  schemaVersion: number;
  gameVersion: string;
  /** When the file was made (ms since epoch). */
  createdAt: number;
  /** SHA-256 hex of `JSON.stringify(data)`. */
  checksum: string;
  data: unknown;
};

const envelopeSchema = z
  .object({
    format: z.literal(SAVE_FILE_FORMAT),
    schemaVersion: z.number().int().min(1),
    gameVersion: z.string(),
    createdAt: z.number(),
    checksum: z.string(),
    data: z.unknown(),
  })
  .refine((envelope) => envelope.data !== undefined);

export type DecodeResult =
  | {
      ok: true;
      save: Save;
      /** Version the file was upgraded from, or null. */ migratedFrom: number | null;
    }
  | { ok: false; error: 'damaged' | 'newer' };

/** Builds the file text for any document version (exported for tests and future formats). */
export async function encodeEnvelope({
  schemaVersion,
  data,
  gameVersion,
  createdAt,
}: Omit<SaveEnvelope, 'format' | 'checksum'>): Promise<string> {
  const envelope: SaveEnvelope = {
    format: SAVE_FILE_FORMAT,
    schemaVersion,
    gameVersion,
    createdAt,
    checksum: await sha256Hex(JSON.stringify(data)),
    data,
  };
  return packText(envelope);
}

/** The text of an exported save file: envelope → JSON → gzip → base64. */
export function encodeSaveFile(
  save: Save,
  { now, gameVersion }: { now: number; gameVersion: string },
): Promise<string> {
  return encodeEnvelope({ schemaVersion: SAVE_VERSION, data: save, gameVersion, createdAt: now });
}

/**
 * Reads a save file back: base64 → gunzip → envelope checks → migration chain → schema.
 * A file from a newer game is reported as `newer`; anything malformed, tampered or invalid as `damaged`.
 * Never throws.
 */
export async function decodeSaveFile(
  text: string,
  { now }: { now: number },
): Promise<DecodeResult> {
  let raw: unknown;
  try {
    raw = await unpackText(text);
  } catch {
    return { ok: false, error: 'damaged' };
  }
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return { ok: false, error: 'damaged' };
  const { schemaVersion, checksum, data } = envelope.data;
  // Checked before the checksum: a later game may checksum its data differently.
  if (schemaVersion > SAVE_VERSION) return { ok: false, error: 'newer' };

  let actual: string;
  try {
    actual = await sha256Hex(JSON.stringify(data));
  } catch {
    return { ok: false, error: 'damaged' };
  }
  if (actual !== checksum) return { ok: false, error: 'damaged' };

  const result = await migrateSave(schemaVersion, data, { now });
  if (!result.ok) return { ok: false, error: result.reason === 'newer' ? 'newer' : 'damaged' };
  return { ok: true, save: result.save, migratedFrom: result.migratedFrom };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `trainer-studio-YYYY-MM-DD.txt` in the player's local date. */
export function exportFileName(now: number): string {
  const date = new Date(now);
  return `trainer-studio-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.txt`;
}
