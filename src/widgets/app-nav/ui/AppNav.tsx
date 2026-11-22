'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  House,
  LayoutGrid,
  Milestone,
  PackageOpen,
  Settings,
  Swords,
  UserRound,
  type LucideProps,
} from 'lucide-react';
import { CapsuleArt } from '@/entities/capsule';
import { xpToNextTrainerLevel } from '@/entities/progression';
import { useSave, useSaveStatus, type OnboardingStep } from '@/entities/save';
import { MotionToggle } from '@/features/motion-toggle/MotionToggle';
import { cn } from '@/shared/lib/cn';
import { DUR, EASE, usePrefersReducedMotion } from '@/shared/lib/motion';
import { useHydrated } from '@/shared/lib/useHydrated';
import {
  NAV_LINKS,
  SETTINGS_HREF,
  fightStage,
  isCurrent,
  redirectDuringOnboarding,
  unopenedCapsules,
  type NavKey,
} from '../model/nav';

const ICONS: Record<NavKey, ComponentType<LucideProps>> = {
  home: House,
  ladder: Milestone,
  collection: LayoutGrid,
  capsules: PackageOpen,
  trainer: UserRound,
};

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** One-shot pulse of the Fight CTA when onboarding ends while the nav is mounted (WAAPI, transform only). */
const PULSE: Keyframe[] = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.12)', offset: 0.35 },
  { transform: 'scale(0.98)', offset: 0.7 },
  { transform: 'scale(1)' },
];

type NavData = {
  step: OnboardingStep;
  level: number;
  xp: number;
  capsules: number;
  talentPoints: number;
  stage: number;
};

/**
 * The app navigation (design.md Navigation), rendered by the root layout above every view's `<main>`.
 * Desktop: sticky top bar with sections, Lv pill + XP, "Fight · Stage N", Motion and Settings.
 * Below `lg`: a top row (logo · Lv · Fight · gear) and a fixed bottom tab bar.
 * Before the save is ready and during onboarding only the logo and Motion show; onboarding deep links
 * (other than the intro battle and Settings) go back to `/`.
 */
export function AppNav() {
  const hydrated = useHydrated();
  const { status } = useSaveStatus();
  const pathname = usePathname();
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const data = useSave<NavData>((s) => ({
    step: s.onboarding.step,
    level: s.trainer.level,
    xp: s.trainer.xp,
    capsules: unopenedCapsules(s),
    talentPoints: s.trainer.talentPoints,
    stage: fightStage(s),
  }));
  const step = hydrated ? data?.step : undefined;
  const ready = hydrated && status === 'ready' && data !== undefined;
  const full = ready && step === 'done';

  // Onboarding is a soft gate: until the first Pokémon joins, other pages send the player home.
  useEffect(() => {
    if (!ready || step === 'done') return;
    if (redirectDuringOnboarding(pathname)) router.replace('/');
  }, [ready, step, pathname, router]);

  // Onboarding finishing while mounted → the Fight CTA pulses once (never on a reload).
  const [seenStep, setSeenStep] = useState(step);
  const [pulse, setPulse] = useState(0);
  if (step !== seenStep) {
    if (seenStep !== undefined && seenStep !== 'done' && step === 'done') setPulse((p) => p + 1);
    setSeenStep(step);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/8 bg-background/92">
        <nav
          aria-label="Main"
          className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8"
        >
          <Link
            href="/"
            aria-label="Trainer Studio, home"
            aria-current={isCurrent(pathname, '/') ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl py-1 pr-2 font-display text-lg font-extrabold tracking-tight',
              focusRing,
            )}
          >
            <CapsuleArt tier="basic" className="size-7" />
            <span className={cn(full && 'max-sm:sr-only')}>Trainer Studio</span>
          </Link>

          {full && data && (
            <ul className="ml-4 hidden items-center gap-1 lg:flex">
              {NAV_LINKS.filter((l) => l.key !== 'home').map((link) => (
                <li key={link.key}>
                  <SectionLink
                    linkKey={link.key}
                    href={link.href}
                    label={link.label}
                    current={isCurrent(pathname, link.href)}
                    capsules={data.capsules}
                    talentPoints={data.talentPoints}
                    layout="bar"
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {full && data && <LevelPill level={data.level} xp={data.xp} />}
            {full && data && (
              <FightCta stage={data.stage} pulse={reduced ? 0 : pulse} reduced={reduced} />
            )}
            <div className={cn(full && 'hidden lg:block')}>
              <MotionToggle />
            </div>
            {(full || (hydrated && status === 'error')) && (
              <Link
                href={SETTINGS_HREF}
                aria-label="Settings"
                aria-current={isCurrent(pathname, SETTINGS_HREF) ? 'page' : undefined}
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground aria-[current=page]:text-primary',
                  focusRing,
                )}
              >
                <Settings aria-hidden className="size-5" />
              </Link>
            )}
          </div>
        </nav>
      </header>

      {full && data && (
        <nav
          aria-label="Sections"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-background/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="mx-auto grid max-w-xl grid-cols-5">
            {NAV_LINKS.map((link) => (
              <li key={link.key}>
                <SectionLink
                  linkKey={link.key}
                  href={link.href}
                  label={link.label}
                  current={isCurrent(pathname, link.href)}
                  capsules={data.capsules}
                  talentPoints={data.talentPoints}
                  layout="tab"
                />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}

function SectionLink({
  linkKey,
  href,
  label,
  current,
  capsules,
  talentPoints,
  layout,
}: {
  linkKey: NavKey;
  href: string;
  label: string;
  current: boolean;
  capsules: number;
  talentPoints: number;
  layout: 'bar' | 'tab';
}) {
  const Icon = ICONS[linkKey];
  const badge = linkKey === 'capsules' && capsules > 0 ? capsules : null;
  const dot = linkKey === 'trainer' && talentPoints > 0;
  // Badges are visual; the link's name says the same in words.
  const name =
    badge !== null
      ? `${label}, ${badge} unopened`
      : dot
        ? `${label}, unspent talent points`
        : undefined;

  if (layout === 'tab') {
    return (
      <Link
        href={href}
        aria-label={name}
        aria-current={current ? 'page' : undefined}
        data-nav={linkKey}
        className={cn(
          'relative flex min-h-11 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-primary',
          focusRing,
          'focus-visible:outline-offset-[-2px]',
        )}
      >
        <span className="relative">
          <Icon aria-hidden className="size-5" />
          {badge !== null && <Badge count={badge} className="absolute -top-1.5 -right-3" />}
          {dot && <Dot className="absolute -top-0.5 -right-1" />}
        </span>
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-label={name}
      aria-current={current ? 'page' : undefined}
      data-nav={linkKey}
      className={cn(
        'relative flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-foreground',
        focusRing,
      )}
    >
      {label}
      {badge !== null && <Badge count={badge} />}
      {dot && <Dot />}
    </Link>
  );
}

function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-hidden
      data-badge="capsules"
      className={cn(
        'grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 font-mono text-xs font-bold text-primary-foreground',
        className,
      )}
    >
      {count}
    </span>
  );
}

function Dot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-badge="talents"
      className={cn('size-2 rounded-full bg-primary ring-2 ring-background', className)}
    />
  );
}

function LevelPill({ level, xp }: { level: number; xp: number }) {
  const max = xpToNextTrainerLevel(level);
  const value = Math.min(xp, max);
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-muted px-3 py-1.5">
      <span className="font-mono text-xs font-bold text-foreground">Lv {level}</span>
      <div
        role="progressbar"
        aria-label="Trainer XP"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={`${value} of ${max} XP`}
        className="h-1.5 w-10 overflow-hidden rounded-full bg-background sm:w-20"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        />
      </div>
      <span aria-hidden className="hidden font-mono text-xs text-muted-foreground xl:inline">
        {value}/{max}
      </span>
    </div>
  );
}

function FightCta({ stage, pulse, reduced }: { stage: number; pulse: number; reduced: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (pulse === 0 || reduced || !el || typeof el.animate !== 'function') return;
    const animation = el.animate(PULSE, { duration: DUR.xxl, easing: EASE.spring });
    return () => animation.cancel();
  }, [pulse, reduced]);

  return (
    <Link
      ref={ref}
      href={`/battle/?stage=${stage}`}
      aria-label={`Fight · Stage ${stage}`}
      data-pulse={pulse > 0 ? pulse : undefined}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary-hover',
        focusRing,
      )}
    >
      <Swords aria-hidden className="size-4" />
      Fight<span className="hidden sm:inline"> · Stage {stage}</span>
    </Link>
  );
}
