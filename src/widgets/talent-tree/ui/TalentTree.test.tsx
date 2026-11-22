// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TalentTree, type TalentGroupView, type TalentNodeView } from './TalentTree';

const groups: TalentGroupView[] = [
  { id: 'offense', label: 'Offense' },
  { id: 'tempo', label: 'Tempo', description: 'Speed and turn order' },
];

const nodes: TalentNodeView[] = [
  {
    id: 'o1',
    name: 'Honed Strikes',
    description: '+8% Attack.',
    group: 'offense',
    tier: 1,
    requires: [],
    state: 'learned',
  },
  {
    id: 'o2',
    name: 'Focused Mind',
    description: '+8% Sp. Atk.',
    group: 'offense',
    tier: 2,
    requires: ['Honed Strikes'],
    state: 'available',
  },
  {
    id: 'o3',
    name: 'Keen Eye',
    description: '+5% critical hit chance.',
    group: 'offense',
    tier: 3,
    requires: ['Focused Mind'],
    state: 'locked',
    reason: 'Requires: Focused Mind',
  },
  {
    id: 't1',
    name: 'Light Step',
    description: '+6% Speed.',
    group: 'tempo',
    tier: 1,
    requires: [],
    state: 'locked',
    reason: 'Next point at Lv 10',
    tag: 'Lv 6',
  },
];

function renderTree(overrides: Partial<Parameters<typeof TalentTree>[0]> = {}) {
  const onLearn = vi.fn();
  const onReset = vi.fn();
  render(
    <TalentTree
      variant="pokemon"
      title="Talents"
      groups={groups}
      nodes={nodes}
      pointsAvailable={1}
      onLearn={onLearn}
      onReset={onReset}
      resetLabel="Reset talents · free"
      {...overrides}
    />,
  );
  return { onLearn, onReset };
}

describe('TalentTree', () => {
  it('is a list of labelled groups with the nodes in tier order', () => {
    renderTree();
    const offense = screen.getByRole('group', { name: 'Offense' });
    expect(
      within(offense)
        .getAllByRole('button')
        .map((b) => b.getAttribute('data-state')),
    ).toEqual(['learned', 'available', 'locked']);
    expect(within(offense).getAllByRole('button')[0]).toHaveAccessibleName('Honed Strikes');
    const tempo = screen.getByRole('group', { name: 'Tempo' });
    expect(tempo).toHaveAccessibleDescription('Speed and turn order');
    expect(screen.getByRole('heading', { level: 2, name: 'Talents' })).toBeInTheDocument();
  });

  it('exposes learned / available / locked with aria-pressed, aria-disabled and reason text', () => {
    renderTree();
    const learned = screen.getByRole('button', { name: 'Honed Strikes' });
    expect(learned).toHaveAttribute('aria-pressed', 'true');
    expect(learned).not.toHaveAttribute('aria-disabled');
    expect(learned).toHaveAccessibleDescription(/Learned/);

    const available = screen.getByRole('button', { name: 'Focused Mind' });
    expect(available).toHaveAttribute('aria-pressed', 'false');
    expect(available).not.toHaveAttribute('aria-disabled');
    expect(available).toHaveAccessibleDescription(/Requires: Honed Strikes.*Learn talent/);

    const locked = screen.getByRole('button', { name: 'Keen Eye' });
    expect(locked).toHaveAttribute('aria-pressed', 'false');
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    // The reason repeats the prerequisite: said once.
    expect(locked.textContent?.match(/Requires: Focused Mind/g)).toHaveLength(1);

    const noPoints = screen.getByRole('button', { name: 'Light Step' });
    expect(noPoints).toHaveAccessibleDescription(/Next point at Lv 10/);
    expect(noPoints).toHaveTextContent('Lv 6');
  });

  it('learns only available nodes', async () => {
    const user = userEvent.setup();
    const { onLearn } = renderTree();
    await user.click(screen.getByRole('button', { name: 'Keen Eye' }));
    await user.click(screen.getByRole('button', { name: 'Honed Strikes' }));
    expect(onLearn).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Focused Mind' }));
    expect(onLearn).toHaveBeenCalledWith('o2');
  });

  it('shows the points available and the next-point note when none are left', () => {
    renderTree({ pointsAvailable: 2 });
    expect(screen.getByText('2 points available')).toBeInTheDocument();
  });

  it('shows the note at zero points', () => {
    renderTree({ pointsAvailable: 0, pointsNote: 'First talent point at Lv 5' });
    expect(screen.getByText('0 points available')).toBeInTheDocument();
    expect(screen.getByText('First talent point at Lv 5')).toBeInTheDocument();
  });

  it('resets when something is learned, and explains why it cannot otherwise', async () => {
    const user = userEvent.setup();
    const { onReset } = renderTree();
    await user.click(screen.getByRole('button', { name: 'Reset talents · free' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('keeps Reset focusable but inert with nothing learned', async () => {
    const user = userEvent.setup();
    const { onReset } = renderTree({
      nodes: nodes.map((n) => (n.state === 'learned' ? { ...n, state: 'available' } : n)),
    });
    const reset = screen.getByRole('button', { name: 'Reset talents · free' });
    expect(reset).toHaveAttribute('aria-disabled', 'true');
    expect(reset).toHaveAccessibleDescription('No talents learned yet');
    await user.click(reset);
    expect(onReset).not.toHaveBeenCalled();
  });

  it('links a node to the one above only when it depends on it', () => {
    renderTree();
    const offense = screen.getByRole('group', { name: 'Offense' });
    expect(offense.querySelectorAll('[data-linked]')).toHaveLength(2);
  });
});
