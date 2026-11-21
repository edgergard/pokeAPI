import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

type Variant = 'primary' | 'ghost' | 'outline';
type Size = 'md' | 'lg' | 'icon';

type Props = ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
};

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-ink-950 hover:bg-accent-strong shadow-glow disabled:shadow-none',
  ghost: 'text-ink-200 hover:bg-white/6 hover:text-white',
  outline: 'border border-white/12 text-ink-100 hover:border-white/25 hover:bg-white/5',
};

const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-[15px] gap-2.5',
  icon: 'size-9 justify-center',
};

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center rounded-xl font-semibold transition-all duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
