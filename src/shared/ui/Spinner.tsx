import { cn } from '@/shared/lib/cn';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-block size-5', className)}>
      <span className="block size-full animate-spin rounded-full border-2 border-white/15 border-t-accent" />
    </span>
  );
}
