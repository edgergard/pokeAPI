import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

/** Shown at the top of every legal page until a lawyer has reviewed them. */
export const LEGAL_DRAFT_NOTE = 'Draft — not legal advice. Last updated 2026-11-23.';

/** Where players and rights holders reach the operator (no email by design). */
export const CONTACT_URL = 'https://github.com/edgergard/trainer-studio/issues';

/**
 * A long-form legal page (privacy, terms): the page's `main` landmark with one `h1`, the draft note
 * and a readable prose column. Hook-free, so it renders as a Server Component.
 */
export function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="content" className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-4">
        <p className="w-fit rounded-xl border border-accent/40 bg-card px-4 py-2 text-sm font-semibold text-accent">
          {LEGAL_DRAFT_NOTE}
        </p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
      </header>
      <div className="flex max-w-prose flex-col gap-8 text-base leading-relaxed text-foreground/90">
        {children}
      </div>
    </main>
  );
}

/** One titled section of a legal page. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** Bulleted list inside a legal section. */
export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-6 marker:text-muted-foreground">{children}</ul>
  );
}

/** A link to another site, opened in a new tab and announced as such. */
export function OutboundLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded font-semibold text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
      <ExternalLink aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
