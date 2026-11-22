// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestBoard, QuestRow } from '@/entities/quest';
import { economy } from '@/shared/config/economy';
import { QuestList } from './QuestList';

const HOUR = 3_600_000;
const NOW = new Date(2026, 10, 22, 13, 0).getTime();

const row = (over: Partial<QuestRow> = {}): QuestRow => ({
  id: 'win-battles',
  day: '2026-11-22',
  kind: 'battleWon',
  progress: 1,
  target: 3,
  reward: { capsules: { basic: 1 } },
  finished: false,
  claimed: false,
  claimable: false,
  ...over,
});

const open = (rows: QuestRow[], over: Partial<Exclude<QuestBoard, { state: 'locked' }>> = {}) =>
  ({
    state: 'open',
    rows,
    claimable: rows.filter((r) => r.claimable).length,
    today: '2026-11-22',
    nextRefreshAt: NOW + 5 * HOUR - 10 * 60_000,
    clockBehind: false,
    refreshHour: economy.quests.refreshHour,
    ...over,
  }) satisfies QuestBoard;

describe('QuestList', () => {
  beforeEach(() => vi.stubEnv('__NEXT_TRAILING_SLASH', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('locked: names the unlock level from the board', () => {
    render(<QuestList board={{ state: 'locked', unlockLevel: 2 }} now={NOW} onClaim={vi.fn()} />);
    expect(screen.getByText('Daily quests unlock at Trainer Lv 2')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('open: rows with x / y, a progressbar each, the reward and the refresh countdown', () => {
    render(
      <QuestList
        board={open([
          row(),
          row({
            id: 'open-capsules',
            kind: 'capsuleOpened',
            progress: 0,
            target: 2,
            reward: { dust: 30 },
          }),
        ])}
        now={NOW}
        onClaim={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const bar = screen.getByRole('progressbar', { name: 'Win 3 battles' });
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('+1 Basic capsule')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Open 2 capsules' })).toBeInTheDocument();
    expect(screen.getByText('+30 dust')).toBeInTheDocument();
    // 4 h 50 min rounds up to 5 h.
    expect(screen.getByText('New quests in 5 h')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Claim/ })).not.toBeInTheDocument();
  });

  it('shows Claim on claimable rows and marks claimed rows', () => {
    const onClaim = vi.fn();
    render(
      <QuestList
        board={open([
          row({ progress: 3, finished: true, claimable: true }),
          row({
            id: 'deal-damage',
            kind: 'damageDealt',
            target: 500,
            progress: 500,
            finished: true,
            claimed: true,
            reward: { dust: 20 },
          }),
        ])}
        now={NOW}
        onClaim={onClaim}
      />,
    );
    const claim = screen.getByRole('button', { name: 'Claim Win 3 battles: +1 Basic capsule' });
    expect(claim).toHaveTextContent('Claim');
    fireEvent.click(claim);
    expect(onClaim).toHaveBeenCalledWith('win-battles', '2026-11-22');
    expect(screen.getByText('Claimed')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('marks quests carried over from an earlier day', () => {
    render(<QuestList board={open([row({ day: '2026-11-21' })])} now={NOW} onClaim={vi.fn()} />);
    expect(screen.getByText('Carried over')).toBeInTheDocument();
  });

  it('allClaimed: "No quests right now" with the hours until the refill, rounded up', () => {
    const board = {
      ...open([row({ claimed: true, finished: true })]),
      state: 'allClaimed' as const,
    };
    render(
      <QuestList
        board={{ ...board, nextRefreshAt: NOW + 4 * HOUR + 1 }}
        now={NOW}
        onClaim={vi.fn()}
      />,
    );
    expect(screen.getByText('No quests right now. New quests in 5 h')).toBeInTheDocument();
  });

  it('clock moved back: shows the refill hour instead of a countdown, no error', () => {
    render(
      <QuestList
        board={open([row()], { clockBehind: true, refreshHour: 6 })}
        now={NOW}
        onClaim={vi.fn()}
      />,
    );
    expect(screen.getByText('Quests refill at 06:00')).toBeInTheDocument();
    expect(screen.queryByText(/New quests in/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('links unfinished quest titles when playHref is given', () => {
    render(
      <QuestList
        board={open([
          row(),
          row({
            id: 'clear-stage',
            kind: 'stageCleared',
            target: 1,
            progress: 1,
            finished: true,
            claimable: true,
          }),
        ])}
        now={NOW}
        onClaim={vi.fn()}
        playHref="/ladder/"
      />,
    );
    expect(screen.getByRole('link', { name: 'Win 3 battles' })).toHaveAttribute('href', '/ladder/');
    expect(screen.queryByRole('link', { name: 'Clear 1 ladder stage' })).not.toBeInTheDocument();
  });
});
