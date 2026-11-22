// Test-only stand-in for the lazy BattleArena (no WebGL, no playback): it shows the teams and seed
// it was given, and two buttons that end the battle the way the real arena reports it.
import { useState } from 'react';
import type { BattleResult } from '@/entities/battle';
import type { BattleArenaProps } from '@/widgets/battle-arena';

export const fakeResult = (winner: 'red' | 'blue'): BattleResult => ({
  winner,
  reason: 'knockout',
  turns: 3,
  redDamageDealt: 150,
  blueDamageDealt: 60,
  fighters: [],
});

export function FakeArena({
  red,
  blue,
  seed,
  intro,
  onFinished,
  renderResult,
  resultMessage,
}: BattleArenaProps) {
  const [result, setResult] = useState<BattleResult | null>(null);
  const finish = (winner: 'red' | 'blue') => {
    const r = fakeResult(winner);
    setResult(r);
    // The arena promises one call per battle; call twice to prove the page guards anyway.
    onFinished?.(r);
    onFinished?.(r);
  };
  return (
    <div
      data-testid="arena"
      data-seed={seed}
      data-intro={intro ? 'true' : 'false'}
      data-red={red.fighters.map((f) => `${f.name}:${f.level}`).join(',')}
      data-blue={blue.fighters.map((f) => `${f.name}:${f.level}`).join(',')}
    >
      <button type="button" onClick={() => finish('red')}>
        Finish: Red wins
      </button>
      <button type="button" onClick={() => finish('blue')}>
        Finish: Blue wins
      </button>
      {result && renderResult?.(result, { replay: () => setResult(null) })}
      <p data-testid="arena-status">{result ? (resultMessage?.(result) ?? '') : ''}</p>
    </div>
  );
}
