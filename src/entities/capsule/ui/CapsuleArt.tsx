import { useId, type CSSProperties } from 'react';
import type { CapsuleTier } from '@/shared/config/economy';

/** Core colour per tier; the shell is the same ink for both. */
const CORE: Record<CapsuleTier, string> = {
  basic: 'var(--primary)',
  great: 'var(--color-side-blue)',
};

type Props = {
  tier: CapsuleTier;
  className?: string;
  style?: CSSProperties;
  /** Tints the core (e.g. the rarity colour during the reveal flash). */
  coreColor?: string;
};

/** The game's own capsule: a faceted hex pod with a glowing core (deliberately not a ball). Decorative. */
export function CapsuleArt({ tier, className, style, coreColor }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const core = coreColor ?? CORE[tier];
  const shell = `capsule-shell-${uid}`;
  const glow = `capsule-glow-${uid}`;

  return (
    <svg viewBox="0 0 120 140" aria-hidden focusable="false" className={className} style={style}>
      <defs>
        <linearGradient id={shell} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#323a4d" />
          <stop offset="0.55" stopColor="#1b1f2a" />
          <stop offset="1" stopColor="#0f1117" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.3" stopColor={core} />
          <stop offset="1" stopColor={core} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Shell */}
      <path
        d="M60 6 L110 35 L110 105 L60 134 L10 105 L10 35 Z"
        fill={`url(#${shell})`}
        stroke={core}
        strokeOpacity="0.85"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Facets */}
      <path
        d="M60 6 L60 30 M110 35 L88 47 M110 105 L88 93 M60 134 L60 110 M10 105 L32 93 M10 35 L32 47"
        stroke="#ffffff"
        strokeOpacity="0.14"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Window */}
      <path
        d="M60 30 L88 47 L88 93 L60 110 L32 93 L32 47 Z"
        fill="#07080b"
        stroke={core}
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Core */}
      <circle cx="60" cy="70" r="30" fill={`url(#${glow})`} />
      <path d="M60 54 L69 70 L60 86 L51 70 Z" fill="#ffffff" fillOpacity="0.9" />
      {/* Highlight */}
      <path
        d="M22 40 L50 24"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
