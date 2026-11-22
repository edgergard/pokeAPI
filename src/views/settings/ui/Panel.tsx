import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/** A glass settings card with its own heading (the page has one h1; sections are h2). */
export function Panel({
  id,
  title,
  description,
  children,
  className,
  busy,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  busy?: boolean;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      aria-busy={busy || undefined}
      className={cn('rounded-3xl p-5 glass sm:p-7', className)}
    >
      <h2 id={`${id}-heading`} className="font-display text-xl font-bold tracking-tight">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
