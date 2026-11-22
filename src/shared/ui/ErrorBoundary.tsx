'use client';

import Link from 'next/link';
import { Component, createRef, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError } from '@/shared/lib/chunkError';
import { cn } from '@/shared/lib/cn';
import { href } from '@/shared/lib/router';
import { Button } from './Button';

type Props = {
  children: ReactNode;
  /** Heading of the notice, e.g. "The battle arena couldn’t load". */
  title: string;
  className?: string;
};

type State = { error: unknown; hasError: boolean };

/**
 * Catches a render error below it (typically a lazy chunk that failed to load — offline, or a
 * stale tab after a redeploy renamed the hashed chunks) and shows a notice with Retry and a way
 * home, instead of React unmounting the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false };
  private headingRef = createRef<HTMLHeadingElement>();

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[app] render failed', error, info.componentStack);
  }

  componentDidUpdate(_: Props, prev: State) {
    // The control that held focus is gone with the failed subtree: land on the notice.
    if (this.state.hasError && !prev.hasError)
      this.headingRef.current?.focus({ preventScroll: true });
  }

  private retry = () => {
    // React.lazy caches a rejected import, so a failed chunk only comes back with a fresh page load
    // (which also picks up renamed chunks after a redeploy). Other errors get a plain re-render.
    if (isChunkLoadError(this.state.error)) window.location.reload();
    else this.setState({ error: null, hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const chunk = isChunkLoadError(this.state.error);
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-ink-900/70 px-6 py-10 text-center',
          this.props.className,
        )}
      >
        <h2
          ref={this.headingRef}
          tabIndex={-1}
          className="font-display text-xl font-bold tracking-tight focus:outline-none"
        >
          {this.props.title}
        </h2>
        <p className="max-w-sm text-sm text-ink-300">
          {chunk
            ? 'Check your connection and try again — if the site was just updated, retrying loads the latest version.'
            : 'Something went wrong while showing it.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={this.retry}>Retry</Button>
          <Link
            href={href('/')}
            className="inline-flex h-10 items-center rounded-xl border border-white/12 px-4 text-sm font-semibold text-ink-100 transition-colors hover:border-white/25 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-sm:h-11"
          >
            Back to Trainer Studio
          </Link>
        </div>
      </div>
    );
  }
}
