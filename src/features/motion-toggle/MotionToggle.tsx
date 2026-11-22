import { Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import {
  setMotionPreference,
  useMotionPreference,
  usePrefersReducedMotion,
  type MotionPreference,
} from '@/shared/lib/motion';

const OPTIONS: { value: MotionPreference; label: string; title: string }[] = [
  { value: 'system', label: 'Auto', title: 'Follow the system “reduce motion” setting' },
  { value: 'on', label: 'On', title: 'Always animate' },
  { value: 'off', label: 'Off', title: 'Never animate' },
];

/** Segmented control: Auto / On / Off. Native radios keep arrow-key navigation and screen-reader semantics. */
export function MotionToggle() {
  const preference = useMotionPreference();
  const reduced = usePrefersReducedMotion();

  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">Animations</legend>
      <span className="hidden items-center gap-1.5 text-xs text-ink-400 md:flex" aria-hidden>
        <Sparkles
          className={cn('size-3.5 transition-colors', reduced ? 'text-ink-600' : 'text-accent')}
        />
        Motion
      </span>
      <div className="relative flex rounded-xl border border-white/10 bg-ink-900/70 p-0.5">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            title={option.title}
            className={cn(
              'tap-target cursor-pointer rounded-[10px] px-2.5 py-1 text-xs font-semibold transition-colors',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
              preference === option.value
                ? 'bg-white/10 text-white'
                : 'text-ink-400 hover:text-ink-200',
            )}
          >
            <input
              type="radio"
              name="motion-preference"
              value={option.value}
              checked={preference === option.value}
              onChange={() => setMotionPreference(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
