'use client';

import { useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Pokeball } from '@/entities/pokemon';
import { useRoster } from '@/entities/trainer';
import { MotionToggle } from '@/features/motion-toggle/MotionToggle';
import { TeamBuilderForm } from '@/features/team-builder';
import { gsap, useGSAP } from '@/shared/lib/gsap';
import { usePrefersReducedMotion } from '@/shared/lib/motion';
import { href } from '@/shared/lib/router';
import { createStorageStore } from '@/shared/lib/storageStore';
import { useScrollTriggerRefresh } from '@/shared/lib/useScrollTriggerRefresh';
import { Spotlight } from '@/shared/ui/Spotlight';
import { TeamShowcase } from '@/widgets/team-showcase/TeamShowcase';
import { HeroHeading } from './HeroHeading';

/** Aurora layers drift down at different rates as the page scrolls (px over the aurora's height). */
const AURORA_LAYERS = [
  { blob: 'aurora-blob-a', shift: 140 },
  { blob: 'aurora-blob-b', shift: 240 },
  { blob: 'aurora-blob-c', shift: 80 },
] as const;

/** The showcased trainer survives Home → Battle → back within the tab (not across sessions). */
const SELECTED_KEY = 'trainer-studio:selected:v1';

const selectedStore = createStorageStore<string | null>({
  read: () => {
    try {
      return window.sessionStorage.getItem(SELECTED_KEY);
    } catch {
      return null;
    }
  },
  write: (id) => {
    try {
      if (id) window.sessionStorage.setItem(SELECTED_KEY, id);
      else window.sessionStorage.removeItem(SELECTED_KEY);
      return true;
    } catch {
      return false; // storage blocked: the selection lives in memory only
    }
  },
  serverValue: null,
});

export function HomePage() {
  const { trainers, add, remove, swap } = useRoster();
  const selectedId = selectedStore.useValue();
  const setSelectedId = selectedStore.set;
  /** Counts saves made in this session — drives the showcase lock-in sequence (never on reload). */
  const [celebration, setCelebration] = useState(0);
  /** The trainer the lock-in belongs to; picking another trainer ends it, so switching never replays it. */
  const [celebratedId, setCelebratedId] = useState<string | null>(null);
  const shownId = trainers.find((t) => t.id === selectedId)?.id ?? trainers[0]?.id ?? null;

  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const auroraRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  // Scroll storytelling: transforms + opacity only, scrubbed with a little smoothing.
  useGSAP(
    () => {
      const hero = heroRef.current;
      const aurora = auroraRef.current;
      if (reduced || !hero || !aurora) return;

      // The copy column lifts and dims as it leaves the top of the viewport.
      gsap.to(hero, {
        y: -60,
        opacity: 0.4,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
      });

      // The glows lag behind the content, each at its own depth.
      aurora.querySelectorAll<HTMLElement>('[data-aurora-shift]').forEach((layer) => {
        gsap.to(layer, {
          y: Number(layer.dataset.auroraShift),
          ease: 'none',
          scrollTrigger: { trigger: aurora, start: 'top top', end: 'bottom top', scrub: 1 },
        });
      });
    },
    { scope: pageRef, dependencies: [reduced], revertOnUpdate: true },
  );

  // The team loading in, the chips row growing or a reset all move everything below: re-measure.
  useScrollTriggerRefresh(contentRef, !reduced);

  return (
    <div ref={pageRef} className="relative min-h-dvh overflow-x-clip">
      <div ref={auroraRef} className="aurora pointer-events-none absolute inset-x-0 top-0 h-[44rem]" aria-hidden>
        {AURORA_LAYERS.map(({ blob, shift }) => (
          // The layer takes the scroll parallax; the blob inside keeps its CSS drift — no shared transform.
          <span key={blob} data-aurora-shift={shift} className="absolute inset-0">
            <span className={`aurora-blob ${blob}`} />
          </span>
        ))}
      </div>

      <div ref={contentRef} className="relative mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-20 sm:px-6 lg:px-8">
        <nav className="reveal-down flex h-20 items-center justify-between" style={stagger(0)}>
          <Link href={href('/')} className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
            <Pokeball className="size-7 text-accent" />
            Trainer Studio
          </Link>
          <div className="flex items-center gap-2">
            <MotionToggle />
            <Link
              href={href('/battle')}
              className="tap-target flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink-100 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
            >
              Battle
            </Link>
            <a
              href="https://github.com/edgergard/pokeAPI"
              target="_blank"
              rel="noreferrer"
              className="tap-target flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
                <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
              </svg>
              <span className="hidden sm:inline">Source</span>
            </a>
          </div>
        </nav>

        <section className="grid items-start gap-10 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-16">
          <div ref={heroRef} className="flex flex-col gap-6 lg:pt-10">
            <span
              style={stagger(1)}
              className="reveal-pop w-fit rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[11px] font-bold tracking-[0.18em] text-accent uppercase"
            >
              Powered by PokeAPI
            </span>
            <HeroHeading />
            <p style={stagger(4)} className="reveal-up max-w-md text-lg leading-relaxed text-ink-300">
              Register as a trainer, search across more than a thousand Pokémon and lock in the team you’d take
              into battle.
            </p>
            <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-400">
              {['Introduce yourself', 'Pick four partners', 'Review & save'].map((step, i) => (
                <li key={step} style={stagger(5 + i * 0.5)} className="reveal-up flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full border border-white/12 font-mono text-[11px] text-ink-200">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div style={stagger(3)} className="reveal-card glass relative isolate rounded-3xl p-6 sm:p-7">
            <Spotlight />
            <h2 className="mb-6 font-display text-xl font-bold tracking-tight">New trainer card</h2>
            <TeamBuilderForm
              onSave={(values) => {
                const saved = add(values);
                setSelectedId(saved.id);
                setCelebratedId(saved.id);
                setCelebration((count) => count + 1);
              }}
            />
          </div>
        </section>

        <TeamShowcase
          trainers={trainers}
          selectedId={shownId}
          onSelect={(id) => {
            setSelectedId(id);
            setCelebratedId(null);
          }}
          onRemove={(id) => {
            remove(id);
            if (id === celebratedId) setCelebratedId(null);
          }}
          onSwap={swap}
          celebration={shownId !== null && shownId === celebratedId ? celebration : 0}
        />
      </div>
    </div>
  );
}

/** Curtain-up order: each step adds one --stagger to the reveal delay. */
const stagger = (i: number) => ({ '--i': i }) as CSSProperties;
