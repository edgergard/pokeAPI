import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GripHorizontal, RotateCcw } from 'lucide-react';
import { PokemonCard, PokemonCardPlaceholder, typeColor, usePokemonList, type Pokemon } from '@/entities/pokemon';
import { TEAM_SIZE, type Trainer } from '@/entities/trainer';
import { cn } from '@/shared/lib/cn';
import { formatName } from '@/shared/lib/format';
import { GSAP_EASE, gsap, useGSAP } from '@/shared/lib/gsap';
import { prefersReducedMotion, usePrefersReducedMotion } from '@/shared/lib/motion';
import { useGsapInteractive } from '@/shared/lib/useGsapInteractive';
import { useInView } from '@/shared/lib/useInView';
import { Button } from '@/shared/ui/Button';
import { LockInBurst } from './LockInBurst';
import { useSlotReorder } from './useSlotReorder';

type Props = {
  trainer: Trainer | null;
  onReset: () => void;
  /** Swaps two team slots (drag & drop or Alt + arrows). */
  onSwap: (from: number, to: number) => void;
  /** Number of saves in this session; a bump plays the lock-in sequence. */
  celebration?: number;
};

/** Time for the confirm dialog's exit before scrolling to the showcase. */
const DIALOG_EXIT_MS = 180;
/** After the dialog's exit fallback (300ms) so its own focus restoration can't override ours. */
const FOCUS_AFTER_SAVE_MS = 350;
/** Only letters, spaces, hyphens and apostrophes are scrambled (ScrambleText writes innerHTML). */
const SCRAMBLE_SAFE = /^[\p{L}\p{M}\s'’-]+$/u;
/** Lines the name scramble up with the cards being dealt (.card-deal starts at 350ms). */
const SCRAMBLE_DELAY = 0.35;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const randomLetter = () => LETTERS[Math.floor(Math.random() * LETTERS.length)] ?? 'x';

export function TeamShowcase({ trainer, onReset, onSwap, celebration = 0 }: Props) {
  const team = trainer?.team ?? [];
  const { data, statuses } = usePokemonList(team);
  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => i);
  const reduced = usePrefersReducedMotion();

  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const scrambledFor = useRef(0);
  const inView = useInView(sectionRef);

  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  const announce = (text: string) => setAnnouncement((prev) => ({ id: prev.id + 1, text }));

  const fresh = celebration > 0 && trainer !== null;
  // ScrambleText arrives with the on-demand GSAP chunk (shared with the slot reorder).
  const fx = useGsapInteractive(fresh && !reduced);
  // GSAP owns the section-level reveal (below), so cards skip their own rise; their inner cascade stays CSS.
  const entrance = fresh ? 'swap' : 'none';
  const fullName = trainer ? `${trainer.firstName} ${trainer.lastName}` : '';
  const burstColors = [
    ...data.filter((p): p is Pokemon => Boolean(p)).map((p) => typeColor(p.types[0])),
    '#ffd23f',
  ];

  const { onSlotKeyDown, settled } = useSlotReorder({
    gridRef,
    team,
    version: trainer?.savedAt ?? 'none',
    enabled: trainer !== null,
    onSwap,
    announce,
  });

  // Bring the freshly saved team into view.
  useEffect(() => {
    if (celebration === 0) return;
    const scroll = setTimeout(() => {
      const section = sectionRef.current;
      if (!section) return;
      const { top } = section.getBoundingClientRect();
      if (top > window.innerHeight * 0.5 || top < 0) {
        section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    }, DIALOG_EXIT_MS);
    // The dialog's "Save team" button goes inert and the form's submit button is disabled after reset,
    // so focus would fall to <body>. Once the dialog has fully closed, land it on the trainer heading.
    const focus = setTimeout(() => {
      const active = document.activeElement;
      const lost = !active || active === document.body || (active as HTMLButtonElement).disabled === true;
      if (lost) headingRef.current?.focus({ preventScroll: true });
    }, FOCUS_AFTER_SAVE_MS);
    return () => {
      clearTimeout(scroll);
      clearTimeout(focus);
    };
  }, [celebration]);

  // Section reveal, scrubbed by scroll: the header and the card stage drift up into place.
  useGSAP(
    () => {
      const section = sectionRef.current;
      const header = headerRef.current;
      const stage = stageRef.current;
      if (reduced || !section || !header || !stage) return;
      // clamp() keeps the end reachable on very tall screens, so the reveal always completes.
      gsap
        .timeline({ scrollTrigger: { trigger: section, start: 'top bottom', end: 'clamp(top 65%)', scrub: 0.8 } })
        .fromTo(header, { y: 32, opacity: 0.3 }, { y: 0, opacity: 1, ease: 'none' }, 0)
        .fromTo(stage, { y: 64, opacity: 0.25 }, { y: 0, opacity: 1, ease: 'none' }, 0);
    },
    { scope: sectionRef, dependencies: [reduced], revertOnUpdate: true },
  );

  // A save scrambles the trainer name in, at most once per save. Only the aria-hidden copy changes; the
  // heading's accessible name comes from the sr-only copy, so assistive tech only ever gets the final name.
  useGSAP(
    () => {
      const el = nameRef.current;
      if (!el || !fresh || scrambledFor.current === celebration) return;
      // A save made with motion off counts as shown: turning motion on later must not replay it.
      if (reduced) {
        scrambledFor.current = celebration;
        return;
      }
      // Wait (without marking the save) for the section to be reached, like the paused CSS deal it runs
      // alongside, and for the ScrambleText plugin to arrive.
      if (!inView || !fx) return;
      scrambledFor.current = celebration; // re-arming after a motion toggle must not replay it
      if (!SCRAMBLE_SAFE.test(fullName)) return;
      // Start from noise, not the final name: ScrambleText shows its starting text until the delay ends.
      // (The span is keyed by the name, so React never writes this text node again.)
      el.textContent = Array.from(fullName, (c) => (/\s/.test(c) ? c : randomLetter())).join('');
      gsap.to(el, {
        duration: 0.8,
        delay: SCRAMBLE_DELAY,
        ease: GSAP_EASE.standard,
        scrambleText: { text: fullName, chars: 'upperAndLowerCase', revealDelay: 0.25, speed: 0.6, tweenLength: false },
      });
      // Context cleanups run after its tweens revert (which restores the noise): land on the real name.
      return () => {
        el.textContent = fullName;
      };
    },
    { scope: sectionRef, dependencies: [celebration, reduced, inView, fx], revertOnUpdate: true },
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="trainer-heading"
      data-inview={inView || undefined}
      className="showcase flex scroll-mt-6 flex-col gap-6"
    >
      <header ref={headerRef} className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow-in font-mono text-[11px] font-bold tracking-[0.2em] text-ink-500 uppercase">
            Trainer
          </span>
          <h2
            id="trainer-heading"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-4xl font-extrabold tracking-tight outline-none sm:text-5xl"
          >
            {trainer ? (
              <span key={fullName} className={cn('inline-block', !fresh && 'name-stamp')}>
                <span className="sr-only">{fullName}</span>
                <span ref={nameRef} aria-hidden>
                  {fullName}
                </span>
              </span>
            ) : (
              <span key="unknown" className="name-fade inline-block text-ink-400">
                Unknown trainer
              </span>
            )}
          </h2>
          {trainer && (
            <p id="reorder-hint" className="text-xs text-ink-500">
              Drag a card by its <GripHorizontal className="inline size-3.5 align-[-2px]" aria-hidden />
              <span className="sr-only">grip</span> handle, or focus it and press Alt + arrow keys, to reorder.
            </p>
          )}
        </div>

        {trainer && (
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
        )}
      </header>

      {/* Stable wrapper: it carries the scroll reveal while the grid inside is re-keyed per save. */}
      <div ref={stageRef}>
        {/* Re-keyed per save so the slots remount (and deal) even when the same team is saved again. */}
        <div
          key={trainer?.savedAt ?? 'none'}
          ref={gridRef}
          role={trainer ? 'list' : undefined}
          aria-label={trainer ? 'Team slots' : undefined}
          data-settled={settled || undefined}
          className="team-grid relative grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {slots.map((slot) => {
            const name = team[slot];
            const pokemon = data[slot];

            let content;
            if (!name) content = <PokemonCardPlaceholder key={`empty-${slot}`} slot={slot} variant="empty" entrance={entrance} />;
            else if (pokemon) content = <PokemonCard key={name} pokemon={pokemon} slot={slot} entrance={entrance} />;
            else if (statuses[slot] === 'error')
              content = <PokemonCardPlaceholder key={`error-${name}`} slot={slot} variant="error" />;
            else content = <PokemonCardPlaceholder key={`loading-${name}`} slot={slot} variant="loading" entrance={entrance} />;

            // Keyed by Pokémon, so a reorder moves the slot (card state, tilt listeners and all) instead of
            // remounting it; the wrapper also persists while a loading placeholder swaps to the card.
            return (
              <div
                key={name ?? `empty-${slot}`}
                data-slot={name ? slot : undefined}
                data-flip-id={name}
                role={name ? 'listitem' : undefined}
                tabIndex={name ? 0 : undefined}
                aria-label={name ? `${formatName(name)}, slot ${slot + 1} of ${TEAM_SIZE}` : undefined}
                aria-describedby={name ? 'reorder-hint' : undefined}
                onKeyDown={name ? onSlotKeyDown(slot) : undefined}
                className={cn('team-slot relative isolate flex rounded-3xl', fresh && 'card-deal')}
                style={{ '--i': slot } as CSSProperties}
              >
                {content}
                {name && (
                  <span
                    data-drag-handle
                    aria-hidden
                    title="Drag to reorder"
                    className="drag-handle absolute top-3 left-1/2 z-20 grid h-7 w-11 -translate-x-1/2 place-items-center rounded-full border border-white/10 bg-ink-950/60 text-ink-300"
                  >
                    <GripHorizontal className="size-4" />
                  </span>
                )}
              </div>
            );
          })}

          {fresh && <LockInBurst key={trainer.savedAt} colors={burstColors} />}
        </div>
      </div>

      {/* Keyed per save: a fresh node is an addition, so saving again under the same name is announced too. */}
      <p className="sr-only" aria-live="polite">
        {fresh && (
          <span key={trainer.savedAt}>
            Team saved for {fullName}: {team.map(formatName).join(', ')}
          </span>
        )}
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement.text && <span key={announcement.id}>{announcement.text}</span>}
      </p>
    </section>
  );
}
