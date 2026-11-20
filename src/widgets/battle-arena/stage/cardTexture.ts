import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Fighter, Side } from '@/entities/battle';
import { typeColor } from '@/entities/pokemon';
import { formatDexNumber, formatName } from '@/shared/lib/format';
import { CARD_HEIGHT, CARD_RADIUS, CARD_WIDTH } from './layout';

/*
 * Card faces are painted once on an offscreen canvas and uploaded as textures — the same
 * composition as the home page's PokemonCard (artwork on a type-tinted radial glow, dex number,
 * display-font name, type pills, stat bars), in Trainer Studio's ink palette.
 *
 * Everything is laid out in a 320 × 448 "CSS pixel" box and drawn at TEXTURE_SCALE.
 */

const BOX_W = 320;
const BOX_H = Math.round((BOX_W * CARD_HEIGHT) / CARD_WIDTH); // 448
const TEXTURE_SCALE = 2; // 640 × 896 texels: crisp at close-up, ~3 MB with mips
const RADIUS = (CARD_RADIUS / CARD_WIDTH) * BOX_W;
const ART_H = 256; // 5:4 artwork stage, as on the 2D card

const INK_950 = '#07080b';
const INK_900 = '#0f1117';
const INK_850 = '#151821';
const INK_500 = '#818a9e';
const ACCENT = '#ffd23f';
export const SIDE_COLOR: Record<Side, string> = { red: '#ff7a66', blue: '#5eb0ff' };

const DISPLAY = '"Bricolage Grotesque", Inter, ui-sans-serif, sans-serif';
const SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

// ---------------------------------------------------------------------------------------------
// Artwork loading (pure part is unit-tested)

/** `null` URL or any load failure → `null`, so the card draws its placeholder face instead. */
export async function resolveArtwork(
  url: string | null,
  load: (url: string) => Promise<HTMLImageElement>,
): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    return await load(url);
  } catch {
    return null;
  }
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** CORS-enabled image load (WebGL refuses tainted pixels), cached per URL across battles. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
  const pending = img.decode().then(() => img);
  pending.catch(() => imageCache.delete(url)); // let a later battle retry
  imageCache.set(url, pending);
  return pending;
}

/**
 * Card text uses the page's webfonts. `document.fonts.load` also fetches faces no DOM text has
 * used yet; the timeout keeps a slow font CDN from holding the arena back (system fallbacks then).
 */
export async function ensureFonts(timeoutMs = 1500): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const specs = [`800 26px ${DISPLAY}`, `600 10px ${SANS}`, `700 12px ${MONO}`, `500 10px ${MONO}`];
  const loaded = Promise.all(specs.map((spec) => document.fonts.load(spec))).then(
    () => undefined,
    () => undefined,
  );
  await Promise.race([loaded, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
}

// ---------------------------------------------------------------------------------------------
// Painting

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = BOX_W * TEXTURE_SCALE;
  canvas.height = BOX_H * TEXTURE_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.scale(TEXTURE_SCALE, TEXTURE_SCALE);
  return [canvas, ctx];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** `letterSpacing` is newer than the rest of the 2D API; skip it where unsupported. */
function setTracking(ctx: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

/** `#rrggbb` + alpha → `rgba()`. */
function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function dotGrid(ctx: CanvasRenderingContext2D, w: number, h: number, step: number, color: (y: number) => string) {
  for (let y = step / 2; y < h; y += step) {
    ctx.fillStyle = color(y);
    for (let x = step / 2; x < w; x += step) ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
  }
}

/** Shrinks the font until `text` fits `maxWidth`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxWidth: number) {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px -= 1;
    ctx.font = `${weight} ${px}px ${family}`;
  }
}

function paintArtwork(ctx: CanvasRenderingContext2D, color: string, img: HTMLImageElement | null) {
  // Type glow rising from the floor of the artwork stage.
  const glow = ctx.createRadialGradient(BOX_W / 2, ART_H, 0, BOX_W / 2, ART_H, BOX_W * 0.85);
  glow.addColorStop(0, alpha(color, 0.42));
  glow.addColorStop(0.65, alpha(color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, BOX_W, ART_H);

  // Dot grid, fading out towards the top like the CSS mask on the 2D card.
  dotGrid(ctx, BOX_W, ART_H, 12, (y) => `rgba(255, 255, 255, ${(0.1 * y) / ART_H})`);

  // Soft elliptical contact shadow (canvas `filter: blur` is not available everywhere).
  ctx.save();
  ctx.translate(BOX_W / 2, ART_H * 0.92);
  ctx.scale(1, 0.18);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, BOX_W * 0.26);
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(-BOX_W / 2, -BOX_W / 2, BOX_W, BOX_W);
  ctx.restore();

  if (img && img.naturalWidth > 0) {
    const box = ART_H * 0.86;
    const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.save();
    // Shadow metrics ignore the context transform, hence the explicit scale.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 22 * TEXTURE_SCALE;
    ctx.shadowOffsetY = 16 * TEXTURE_SCALE;
    ctx.drawImage(img, (BOX_W - w) / 2, (ART_H - h) / 2 + 6, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = `700 96px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', BOX_W / 2, ART_H / 2 + 4);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }
}

function paintStat(ctx: CanvasRenderingContext2D, y: number, label: string, value: number, color: string) {
  ctx.font = `500 10px ${MONO}`;
  ctx.fillStyle = INK_500;
  ctx.fillText(label, 20, y + 4);

  const x = 58;
  const w = 206;
  roundRect(ctx, x, y - 1.5, w, 4, 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.fill();
  roundRect(ctx, x, y - 1.5, Math.max(4, w * Math.min(1, value / 220)), 4, 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = `700 11px ${MONO}`;
  ctx.fillStyle = '#e7e9ef';
  ctx.textAlign = 'right';
  ctx.fillText(String(value), BOX_W - 20, y + 4);
  ctx.textAlign = 'start';
}

/** Front face: artwork, dex number, name, type pills, battle stats. */
export function paintCardFace(fighter: Fighter, img: HTMLImageElement | null): HTMLCanvasElement {
  const [canvas, ctx] = createCanvas();
  const color = typeColor(fighter.types[0]);

  const base = ctx.createLinearGradient(0, 0, 0, BOX_H);
  base.addColorStop(0, INK_900);
  base.addColorStop(1, INK_850);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, BOX_W, BOX_H);

  paintArtwork(ctx, color, img);

  // Corner labels over the artwork.
  ctx.font = `700 12px ${MONO}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.fillText(formatDexNumber(fighter.pokemonId), 18, 28);
  const corner = `${fighter.side.toUpperCase()} · ${fighter.slot + 1}`;
  ctx.font = `700 10px ${MONO}`;
  setTracking(ctx, 1.5);
  ctx.textAlign = 'right';
  ctx.fillText(corner, BOX_W - 18, 27);
  const cornerW = ctx.measureText(corner).width;
  ctx.textAlign = 'start';
  setTracking(ctx, 0);
  ctx.beginPath();
  ctx.arc(BOX_W - 18 - cornerW - 8, 23.5, 3, 0, Math.PI * 2);
  ctx.fillStyle = SIDE_COLOR[fighter.side];
  ctx.fill();

  // Hairline between artwork and info.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fillRect(0, ART_H, BOX_W, 1);

  // Name.
  ctx.fillStyle = '#ffffff';
  fitText(ctx, formatName(fighter.name), 800, 27, DISPLAY, BOX_W - 40);
  ctx.fillText(formatName(fighter.name), 20, ART_H + 38);

  // Type pills.
  let x = 20;
  ctx.font = `600 10px ${SANS}`;
  setTracking(ctx, 0.8);
  for (const type of fighter.types) {
    const tc = typeColor(type);
    const label = type.toUpperCase();
    const w = ctx.measureText(label).width + 30;
    roundRect(ctx, x, ART_H + 52, w, 20, 10);
    ctx.fillStyle = alpha(tc, 0.13);
    ctx.fill();
    ctx.strokeStyle = alpha(tc, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 11, ART_H + 62, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = tc;
    ctx.fill();
    ctx.fillText(label, x + 19, ART_H + 65.5);
    x += w + 6;
  }
  setTracking(ctx, 0);

  // Battle stats (level 50).
  const { hp, attack, defense, speed } = fighter.stats;
  [['HP', hp], ['ATK', attack], ['DEF', defense], ['SPD', speed]].forEach(([label, value], i) => {
    paintStat(ctx, ART_H + 96 + i * 19, String(label), Number(value), color);
  });

  // Footer.
  ctx.font = `500 9px ${MONO}`;
  setTracking(ctx, 1.6);
  ctx.fillStyle = INK_500;
  ctx.fillText('LV 50', 20, BOX_H - 16);
  ctx.textAlign = 'right';
  ctx.fillText('TRAINER STUDIO', BOX_W - 20, BOX_H - 16);
  ctx.textAlign = 'start';
  setTracking(ctx, 0);

  // Hairline border, inset so the rounded mesh edge never clips it.
  roundRect(ctx, 1, 1, BOX_W - 2, BOX_H - 2, RADIUS - 1);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return canvas;
}

/** Back face: Trainer Studio monogram on a side-tinted, finely engraved ground. */
export function paintCardBack(side: Side): HTMLCanvasElement {
  const [canvas, ctx] = createCanvas();
  const tint = SIDE_COLOR[side];
  const cx = BOX_W / 2;
  const cy = BOX_H * 0.46;

  ctx.fillStyle = INK_950;
  ctx.fillRect(0, 0, BOX_W, BOX_H);

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, BOX_H * 0.6);
  glow.addColorStop(0, alpha(tint, 0.34));
  glow.addColorStop(1, alpha(tint, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, BOX_W, BOX_H);

  // Engraved diagonal hatching (the same 115° as the foil on the 2D card).
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((115 * Math.PI) / 180);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  for (let i = -BOX_H; i <= BOX_H; i += 7) {
    ctx.beginPath();
    ctx.moveTo(i, -BOX_H);
    ctx.lineTo(i, BOX_H);
    ctx.stroke();
  }
  ctx.restore();

  // Concentric rings.
  for (let r = 54; r < 200; r += 22) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.09 - (r - 54) * 0.0004})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Monogram tile.
  roundRect(ctx, cx - 38, cy - 38, 76, 76, 20);
  ctx.fillStyle = INK_900;
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.font = `800 32px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TS', cx, cy + 2);

  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 10px ${MONO}`;
  setTracking(ctx, 3.2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('TRAINER STUDIO', cx + 1.6, cy + 76);
  ctx.font = `500 9px ${MONO}`;
  ctx.fillStyle = tint;
  ctx.fillText(`${side.toUpperCase()} CORNER`, cx + 1.6, BOX_H - 30);
  setTracking(ctx, 0);
  ctx.textAlign = 'start';

  // Double frame.
  roundRect(ctx, 12, 12, BOX_W - 24, BOX_H - 24, RADIUS - 8);
  ctx.strokeStyle = alpha(tint, 0.38);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  roundRect(ctx, 1, 1, BOX_W - 2, BOX_H - 2, RADIUS - 1);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return canvas;
}

/** Wraps a painted canvas as an sRGB texture with mipmaps and the requested anisotropy. */
export function toTexture(canvas: HTMLCanvasElement, anisotropy: number): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/** Radial falloff for the cards' floor contact shadows (only the alpha channel is used). */
export function paintContactShadow(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0, 0, 0, 1)');
  g.addColorStop(0.45, 'rgba(0, 0, 0, 0.45)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvas;
}
