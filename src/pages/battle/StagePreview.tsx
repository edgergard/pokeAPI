// TEMPORARY (Task 8 manual check) — replaced by the battle-arena widget in Task 10. Delete then.
import { useEffect, useRef, useState } from 'react';
import type { BattleTeam } from '@/entities/battle';
import { prefersReducedMotion } from '@/shared/lib/motion';

/** Mounts the bare three.js stage (cards in their relay layout, no choreography). */
export function StagePreview({ red, blue }: { red: BattleTeam; blue: BattleTeam }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported' | 'lost'>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let cleanup = () => {};

    // Dynamic import keeps three.js in its own chunk, fetched only once a battle starts.
    void import('@/widgets/battle-arena/stage/BattleStage').then(({ BattleStage }) => {
      if (cancelled) return;
      if (!BattleStage.isSupported()) return setStatus('unsupported');
      const stage = new BattleStage(canvas, { reducedMotion: prefersReducedMotion() });
      stage.onContextLost = () => setStatus('lost');
      const observer = new ResizeObserver(([entry]) => {
        if (entry) stage.resize(entry.contentRect.width, entry.contentRect.height);
      });
      observer.observe(canvas);
      stage.start();
      void stage.load(red, blue).then(() => !cancelled && setStatus('ready'));
      cleanup = () => {
        observer.disconnect();
        stage.dispose();
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [red, blue]);

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-ink-950 sm:aspect-video">
      <canvas ref={canvasRef} aria-hidden className="block size-full" />
      {status !== 'ready' && (
        <p className="absolute inset-0 grid place-items-center text-sm text-ink-300">
          {status === 'loading' ? 'Setting the stage…' : status === 'lost' ? 'Graphics context lost.' : 'WebGL 2 is not available.'}
        </p>
      )}
    </div>
  );
}
