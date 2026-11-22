// @vitest-environment jsdom
// Typed jest-dom matchers (vitest.setup.ts registers them at runtime but is outside tsconfig).
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testSave } from '@/entities/capsule/model/testSave';
import { initSave, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { RARITY_LABEL } from '@/entities/capsule';
import { economy, RARITIES } from '@/shared/config/economy';
import { formatPercent, OddsPity } from './OddsPity';
import { polyfillDom } from './testDom';

beforeAll(polyfillDom);

async function load(save: Save) {
  await initSave(
    { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
    () => save,
  );
}

describe('OddsPity', () => {
  beforeEach(() => __resetSaveStoreForTests());

  it('shows the odds of every tier as a real table with headers', async () => {
    await load(testSave());
    render(<OddsPity />);
    const table = screen.getByRole('table', { name: 'Drop odds per capsule tier' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual(['Rarity', 'Basic', 'Great']);
    for (const rarity of RARITIES) {
      const row = within(table).getByRole('row', { name: new RegExp(`^${RARITY_LABEL[rarity]}`) });
      expect(row).toHaveTextContent(formatPercent(economy.capsules.odds.basic[rarity]));
      expect(row).toHaveTextContent(formatPercent(economy.capsules.odds.great[rarity]));
    }
  });

  it('shows a pity progressbar with a text value per unlocked tier, and the reason for a locked one', async () => {
    const { opens } = economy.capsules.pity.basic;
    await load(testSave({ pity: { basic: 1, great: 0 } }));
    render(<OddsPity />);
    const meter = screen.getByRole('progressbar');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', String(opens));
    expect(meter).toHaveAttribute('aria-valuenow', '1');
    expect(meter).toHaveAccessibleName('Basic capsule pity');
    expect(meter).toHaveAttribute('aria-valuetext', `Rare guaranteed within ${opens - 1} opens`);
    expect(
      screen.getByText(
        `Great capsules unlock at Trainer Lv ${economy.trainer.unlocks.greatCapsules}`,
      ),
    ).toBeInTheDocument();
  });

  it('shows both meters once Great capsules are unlocked', async () => {
    const { opens } = economy.capsules.pity.great;
    await load(
      testSave({
        trainer: { level: economy.trainer.unlocks.greatCapsules },
        pity: { basic: 0, great: 2 },
      }),
    );
    render(<OddsPity />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(screen.getByText(`Epic guaranteed within ${opens - 2} opens`)).toBeInTheDocument();
  });

  it('keeps the odds visible while the save loads', () => {
    render(<OddsPity />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
