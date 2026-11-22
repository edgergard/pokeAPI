/**
 * Byte plumbing for save files: gzip (CompressionStream), base64 and SHA-256 (Web Crypto).
 * No DOM: runs in browsers and in Node (tests).
 */

/** A decompressed file larger than this is not a save (guards against gzip bombs). */
const MAX_UNPACKED_BYTES = 20 * 1024 * 1024;
/** btoa/String.fromCharCode take arguments on the stack: encode in slices. */
const BASE64_CHUNK = 0x8000;

async function pipe(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
  limit = Infinity,
): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = source.pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error('File too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

/** Throws on anything that isn't base64 (whitespace and line breaks are ignored). */
export function fromBase64(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Lowercase hex SHA-256 of the UTF-8 text. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** value → JSON → gzip → base64. */
export async function packText(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  return toBase64(await pipe(json, new CompressionStream('gzip')));
}

/** base64 → gunzip → JSON. Throws on any malformed step. */
export async function unpackText(text: string): Promise<unknown> {
  const bytes = await pipe(fromBase64(text), new DecompressionStream('gzip'), MAX_UNPACKED_BYTES);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
