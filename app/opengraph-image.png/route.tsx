import { ImageResponse } from 'next/og';
import { OG_IMAGE } from '@/shared/config/site';

// Static export: rendered once at build time into out/opengraph-image.png.
// A route handler rather than the `opengraph-image.tsx` convention: that one is exported without a file
// extension (out/opengraph-image), which static hosts serve as application/octet-stream.
export const dynamic = 'force-static';

const BACKGROUND = '#07080b'; // --color-ink-950
const ACCENT = '#ffd23f'; // --color-accent
const FOREGROUND = '#e7e9ef'; // --color-ink-100
const MUTED = '#aab1c2'; // --color-ink-300

/** Open Graph card: the game's capsule glyph and name. No Pokémon art, no external fetches. */
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 72,
        padding: '0 96px',
        background: BACKGROUND,
        backgroundImage:
          'radial-gradient(circle at 18% 30%, rgba(255, 210, 63, 0.18), transparent 55%)',
        color: FOREGROUND,
      }}
    >
      {/* Same shape as src/shared/ui/CapsuleGlyph.tsx, scaled up. */}
      <svg width="280" height="280" viewBox="0 0 64 64" fill="none">
        <rect x="6" y="6" width="52" height="52" rx="16" stroke={ACCENT} strokeWidth="4" />
        <path d="M6 32h52" stroke={ACCENT} strokeWidth="4" />
        <rect x="24" y="24" width="16" height="16" rx="5" stroke={ACCENT} strokeWidth="4" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Only the bundled regular font is available offline: a stroke in the text colour makes it bold. */}
        <div
          style={{
            fontSize: 112,
            lineHeight: 1,
            letterSpacing: -2,
            WebkitTextStroke: `4px ${FOREGROUND}`,
          }}
        >
          Trainer Studio
        </div>
        <div style={{ fontSize: 44, color: ACCENT, WebkitTextStroke: `1px ${ACCENT}` }}>
          Collect · Level up · Auto-battle
        </div>
        <div style={{ fontSize: 28, color: MUTED }}>Free browser game · Unofficial fan project</div>
      </div>
    </div>,
    { width: OG_IMAGE.width, height: OG_IMAGE.height },
  );
}
