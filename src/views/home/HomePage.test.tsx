// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMovesets } from '@/entities/battle';
import { stageInfo } from '@/entities/ladder';
import { getSpecies, SPECIES_COUNT } from '@/entities/pokemon';
import { teamSlotUnlockLevel, xpToNextTrainerLevel } from '@/entities/progression';
import { questDay } from '@/entities/quest';
import { getSave, initSave, requestPersist, updateSave, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { __resetPersistForTests } from '@/entities/save/persistence/persist';
import { encodeSaveFile, TRANSFER_COPY } from '@/features/save-transfer';
import { economy } from '@/shared/config/economy';
import { setMotionPreference } from '@/shared/lib/motion';
import { FOOTER_TEXT, HomePage } from './HomePage';
import { dealOnboarding } from './model/dealOnboarding';
import { __resetHomeSessionForTests } from './model/session';
import { __resetNowForTests } from './model/useNow';
import { LEVEL_UP_DELAY_MS } from './ui/Hub';
import { collectionOf, homeSave, hubSave, ownedMon, polyfillHomeDom } from './testing';

// GSAP (hero heading) reads matchMedia at import time: stub it before any import runs.
vi.hoisted(() => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
});

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => {
  const router = { push, replace: vi.fn() };
  return { useRouter: () => router, usePathname: () => '/' };
});
// The dealt step warms the 3D arena chunk; three.js has no business in jsdom.
vi.mock('@/widgets/battle-arena', () => ({}));

const movesetFailure = vi.hoisted(() => ({ fail: false }));
vi.mock('@/entities/battle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/battle')>();
  return {
    ...actual,
    loadMovesets: () =>
      movesetFailure.fail ? Promise.reject(new Error('offline')) : actual.loadMovesets(),
  };
});

beforeAll(polyfillHomeDom);

const persistSpy = vi.fn(async () => true);

function stubStorage(granted: boolean) {
  persistSpy.mockImplementation(async () => granted);
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { persist: persistSpy, persisted: async () => false },
  });
}

async function load(save: Save, { durable = true } = {}) {
  await act(() =>
    initSave(
      { durable, load: async () => ({ kind: 'loaded', save }), write: async () => true },
      () => save,
    ),
  );
}

async function loadError(reason: string) {
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'error', reason }), write: async () => true },
      () => homeSave(),
    ),
  );
}

const announcer = () => screen.getByTestId('home-announcer');
const step = () => getSave()?.onboarding.step;

describe('HomePage', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
    __resetPersistForTests();
    __resetHomeSessionForTests();
    __resetNowForTests();
    stubStorage(true);
    persistSpy.mockClear();
    push.mockReset();
    movesetFailure.fail = false;
    setMotionPreference('off');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    setMotionPreference('system');
  });

  describe('loading', () => {
    it('renders the h1, the hero headline and a skeleton instead of the hero button', () => {
      render(<HomePage />);
      expect(screen.getByRole('main')).toHaveAttribute('id', 'content');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Trainer Studio');
      expect(screen.getByRole('heading', { name: /Your collection fights for you/ })).toBeVisible();
      expect(screen.getByTestId('home-skeleton')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Fill my team/ })).not.toBeInTheDocument();
      expect(screen.getByText(FOOTER_TEXT)).toBeInTheDocument();
    });
  });

  describe('onboarding', () => {
    it('hero: one click deals the loaner and the rival and commits step dealt', async () => {
      const save = homeSave();
      render(<HomePage />);
      await load(save);
      const expected = dealOnboarding(save, await loadMovesets());

      fireEvent.click(screen.getByRole('button', { name: 'Fill my team with random Pokémon' }));
      const fight = await screen.findByRole('link', { name: 'Fight' });

      expect(getSave()?.onboarding).toEqual({
        step: 'dealt',
        loanerSpeciesId: expected.loanerSpeciesId,
        rivalSpeciesId: expected.rivalSpeciesId,
      });
      const loaner = getSpecies(expected.loanerSpeciesId)?.name ?? '';
      const rival = getSpecies(expected.rivalSpeciesId)?.name ?? '';
      expect(fight).toHaveAttribute('href', '/battle/?stage=intro');
      expect(fight).toHaveFocus();
      expect(
        screen.getByRole('img', {
          name: new RegExp(`^${loaner}, loaner, level ${economy.onboarding.loanerLevel}`),
        }),
      ).toHaveTextContent('Loaner');
      expect(
        screen.getByRole('img', {
          name: new RegExp(`^${rival}, rival, level ${economy.onboarding.rivalLevel}`),
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('VS')).toBeInTheDocument();
      expect(announcer()).toHaveTextContent(`Loaner ${loaner} joined your team`);
      // Announced once: by the dealt step, not also by the deal click.
      expect(announcer()).toHaveAttribute('data-announcements', '1');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('hero: shows a retry message when the battle data can’t load', async () => {
      movesetFailure.fail = true;
      render(<HomePage />);
      await load(homeSave());
      fireEvent.click(screen.getByRole('button', { name: 'Fill my team with random Pokémon' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn’t deal your cards/);
      expect(step()).toBe('hero');

      movesetFailure.fail = false;
      fireEvent.click(screen.getByRole('button', { name: 'Fill my team with random Pokémon' }));
      await screen.findByRole('link', { name: 'Fight' });
      expect(step()).toBe('dealt');
    });

    it('dealt: a reload resumes with the same cards (no re-deal)', async () => {
      const save = homeSave({
        onboarding: { step: 'dealt', loanerSpeciesId: 25, rivalSpeciesId: 19 },
      });
      render(<HomePage />);
      await load(save);
      expect(screen.getByRole('link', { name: 'Fight' })).toHaveFocus();
      expect(screen.getByRole('img', { name: /^Pikachu, loaner/ })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /^Rattata, rival/ })).toBeInTheDocument();
      expect(getSave()?.onboarding).toEqual(save.onboarding);
      expect(announcer()).toHaveTextContent('Loaner Pikachu joined your team');
      expect(announcer()).toHaveAttribute('data-announcements', '1');
    });

    it('fought: opens the capsule (committed before the reveal), steps to capsule, then Add to team ends onboarding', async () => {
      render(<HomePage />);
      await load(
        homeSave({
          onboarding: { step: 'fought', loanerSpeciesId: 25, rivalSpeciesId: 19 },
          capsules: { basic: 1, great: 0 },
        }),
      );
      const open = screen.getByRole('button', { name: 'Open your capsule' });
      expect(open).toHaveFocus();
      fireEvent.click(open);

      // Committed: the capsule is gone, the Pokémon owned and the step moved on before any animation.
      const saved = getSave();
      expect(saved?.capsules.basic).toBe(0);
      const owned = Object.values(saved?.collection ?? {});
      expect(owned).toHaveLength(1);
      expect(saved?.onboarding.step).toBe('capsule');

      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /^Skip/ }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add to team' }));

      expect(getSave()?.team).toEqual([owned[0]?.speciesId]);
      expect(step()).toBe('done');
      expect(persistSpy).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole('heading', { name: 'Stage 1 is ready' })).toBeInTheDocument();
    });

    it('fought: an open error says so and keeps the step', async () => {
      render(<HomePage />);
      // Nothing to open: the commit fails.
      await load(homeSave({ onboarding: { step: 'fought' }, capsules: { basic: 0, great: 0 } }));
      fireEvent.click(screen.getByRole('button', { name: 'Open your capsule' }));
      expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t open. Try again');
      expect(step()).toBe('fought');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('fought with the capsule already opened shows the Add-to-team prompt', async () => {
      render(<HomePage />);
      await load(
        homeSave({
          onboarding: { step: 'fought' },
          capsules: { basic: 0, great: 0 },
          collection: collectionOf(ownedMon(133)),
        }),
      );
      expect(
        screen.getByRole('heading', { name: 'Eevee joined your collection.' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open your capsule' })).not.toBeInTheDocument();
    });

    it('capsule: a reload shows the first owned Pokémon; Add to team → team [id], step done, persist once', async () => {
      render(<HomePage />);
      await load(
        homeSave({
          onboarding: { step: 'capsule', loanerSpeciesId: 25, rivalSpeciesId: 19 },
          collection: collectionOf(
            ownedMon(7, { obtainedAt: 20 }),
            ownedMon(4, { obtainedAt: 10 }),
          ),
        }),
      );
      expect(screen.getByRole('img', { name: /^Charmander, level 1, 1 star/ })).toBeInTheDocument();
      const add = screen.getByRole('button', { name: 'Add to team' });
      expect(add).toHaveFocus();
      fireEvent.click(add);
      expect(getSave()?.team).toEqual([4]);
      expect(step()).toBe('done');
      expect(persistSpy).toHaveBeenCalledTimes(1);
      await act(() => requestPersist());
      expect(persistSpy).toHaveBeenCalledTimes(1);

      // The hub takes over; Fight is focused right after onboarding.
      const fight = await screen.findByRole('link', { name: 'Fight · Stage 1' });
      expect(screen.getByRole('heading', { name: 'Stage 1 is ready' })).toBeInTheDocument();
      expect(fight).toHaveFocus();
      expect(announcer()).toHaveTextContent('Charmander joined your team');
    });
  });

  describe('v1 players', () => {
    const v1 = () =>
      homeSave({
        meta: { migratedFromV1: true },
        onboarding: { step: 'done' },
        collection: collectionOf(ownedMon(1), ownedMon(4), ownedMon(7)),
        team: [1],
      });

    it('welcomes a fresh v1 import once per page load until dismissed, without a capsule', async () => {
      const { unmount } = render(<HomePage />);
      await load(v1());
      expect(
        screen.getByText('Your v1 trainers were imported: 3 Pokémon added.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /welcome capsule/i })).not.toBeInTheDocument();
      // The hub asks for persistent storage on mount; dismissing the welcome adds no request.
      await waitFor(() => expect(persistSpy).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss welcome message' }));
      expect(screen.queryByText(/v1 trainers were imported/)).not.toBeInTheDocument();
      await act(async () => {});
      expect(persistSpy).toHaveBeenCalledTimes(1);
      expect(getSave()?.capsules).toEqual({ basic: 0, great: 0 });

      // Leaving and coming back in the same page load keeps it dismissed.
      unmount();
      render(<HomePage />);
      expect(screen.queryByText(/v1 trainers were imported/)).not.toBeInTheDocument();
    });

    it('does not welcome a v1 save that already has v2 progress', async () => {
      render(<HomePage />);
      await load({ ...v1(), capsulesOpened: 2 });
      expect(screen.queryByText(/v1 trainers were imported/)).not.toBeInTheDocument();
    });
  });

  describe('hub', () => {
    it('shows the trainer strip, next stage, team, quests, capsules and collection from the save', async () => {
      const level = 3;
      render(<HomePage />);
      await load(
        hubSave({
          trainer: { name: 'Rowan', level, xp: 150 },
          ladder: { cleared: 4, replayWins: 0 },
          collection: collectionOf(ownedMon(25, { level: 6 }), ownedMon(1)),
        }),
      );
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { name: /^Rowan Lv 3$/ })).toBeInTheDocument();
      const xp = screen.getByRole('progressbar', { name: 'Trainer XP to level 4' });
      expect(xp).toHaveAttribute('aria-valuenow', '150');
      expect(xp).toHaveAttribute('aria-valuemax', String(xpToNextTrainerLevel(level)));
      expect(screen.getByTestId('next-unlock')).toHaveTextContent(/^Next: Lv 5 · team slot 3$/);

      expect(screen.getByRole('heading', { name: 'Stage 5' })).toBeInTheDocument();
      const info = stageInfo(5);
      expect(screen.getByTestId('next-stage-rival')).toHaveTextContent(`Rival ${info.rivalName}`);
      const rivalTeam = screen.getByRole('list', { name: `Rival ${info.rivalName}'s team` });
      const rivalCards = within(rivalTeam).getAllByRole('listitem');
      expect(rivalCards).toHaveLength(info.rival.length);
      info.rival.forEach((m, i) => {
        const name = getSpecies(m.speciesId)?.name ?? '';
        expect(rivalCards[i]).toHaveTextContent(`${name}, Lv ${m.level}`);
        expect(rivalCards[i]?.querySelector('img')).toHaveAttribute(
          'src',
          expect.stringContaining(`/${m.speciesId}.png`),
        );
      });
      expect(screen.getByText('+1 Basic capsule · +20 dust')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Fight · Stage 5' })).toHaveAttribute(
        'href',
        '/battle/?stage=5',
      );

      const team = screen.getByRole('region', { name: /^Team/ });
      expect(within(team).getByRole('link', { name: /^Pikachu, level 6, 1 star/ })).toHaveAttribute(
        'href',
        '/creature/?id=25',
      );
      expect(within(team).getByRole('group', { name: 'Slot 2, empty' })).toBeInTheDocument();
      expect(
        within(team).getByText(`Unlocks at Trainer Lv ${teamSlotUnlockLevel(3)}`),
      ).toBeInTheDocument();
      expect(
        within(team).getByText(`Unlocks at Trainer Lv ${teamSlotUnlockLevel(4)}`),
      ).toBeInTheDocument();
      expect(within(team).getByRole('button', { name: 'Edit team' })).toBeInTheDocument();

      expect(screen.getByRole('region', { name: 'Daily quests' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Capsules' })).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: `Collection, 2 of ${SPECIES_COUNT} caught` }),
      ).toHaveAttribute('href', '/collection/');
      expect(screen.getByText(FOOTER_TEXT)).toBeInTheDocument();
    });

    it('shows a talent-point dot on team cards with unspent points', async () => {
      render(<HomePage />);
      await load(
        hubSave({
          collection: collectionOf(ownedMon(25, { level: economy.pokemon.talentPointEveryLevels })),
        }),
      );
      expect(
        screen.getByRole('link', { name: /^Pikachu, .*1 talent point available$/ }),
      ).toBeInTheDocument();
    });

    it('says the ladder is complete once every stage is cleared and links to replays', async () => {
      const last = economy.battle.ladderStages;
      render(<HomePage />);
      await load(hubSave({ ladder: { cleared: last, replayWins: 0 } }));
      expect(screen.getByRole('heading', { name: 'Ladder complete' })).toBeInTheDocument();
      expect(screen.getByText('Replay any stage for XP and capsules.')).toBeInTheDocument();
      expect(screen.queryByTestId('next-stage-rival')).not.toBeInTheDocument();
      expect(screen.queryByText(/^First clear:/)).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Replay a stage' })).toHaveAttribute(
        'href',
        '/ladder/',
      );
    });

    it('"Edit team" opens the team dialog on Home', async () => {
      render(<HomePage />);
      await load(hubSave());
      expect(screen.queryByRole('dialog', { name: 'Team' })).not.toBeInTheDocument();
      const team = screen.getByRole('region', { name: /^Team/ });
      fireEvent.click(within(team).getByRole('button', { name: 'Edit team' }));
      const dialog = screen.getByRole('dialog', { name: 'Team' });
      expect(dialog).toHaveAttribute('open');
      expect(dialog.querySelector('[data-highlight]')).toBeNull();
      expect(push).not.toHaveBeenCalled();
    });

    it('asks for persistent storage on mount for players past onboarding (v1, imported)', async () => {
      render(<HomePage />);
      await load(hubSave());
      await waitFor(() => expect(persistSpy).toHaveBeenCalledTimes(1));
    });

    it('does not pulse or steal focus on a reload with onboarding already done', async () => {
      setMotionPreference('on');
      render(<HomePage />);
      await load(hubSave());
      expect(screen.getByRole('heading', { name: 'Stage 1 is ready' })).toBeInTheDocument();
      const fight = screen.getByRole('link', { name: 'Fight · Stage 1' });
      expect(fight).not.toHaveAttribute('data-pulse');
      expect(fight).not.toHaveFocus();
    });

    it('pulses Fight right after onboarding when motion is on', async () => {
      setMotionPreference('on');
      render(<HomePage />);
      await load(
        homeSave({ onboarding: { step: 'capsule' }, collection: collectionOf(ownedMon(4)) }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add to team' }));
      expect(await screen.findByRole('link', { name: 'Fight · Stage 1' })).toHaveAttribute(
        'data-pulse',
      );
    });

    describe('banners', () => {
      it('storage at risk: asks for an export with a link to Settings', async () => {
        render(<HomePage />);
        await load(hubSave(), { durable: false });
        const banner = screen.getByText(
          'Progress isn’t being saved in this browser. Export your save to keep it.',
        );
        expect(
          within(banner.closest('[data-banner]') as HTMLElement).getByRole('link', {
            name: 'Export save',
          }),
        ).toHaveAttribute('href', '/settings/');
      });

      it('persistent storage denied: shown, dismissible for this page load', async () => {
        stubStorage(false);
        await requestPersist();
        const { unmount } = render(<HomePage />);
        await load(hubSave());
        expect(
          await screen.findByText('Browser may clear data. Export often.'),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss storage notice' }));
        expect(screen.queryByText('Browser may clear data. Export often.')).not.toBeInTheDocument();
        unmount();
        render(<HomePage />);
        expect(screen.queryByText('Browser may clear data. Export often.')).not.toBeInTheDocument();
      });

      it('backup due: "Back up your progress" with Export save', async () => {
        render(<HomePage />);
        await load(hubSave({ meta: { battlesSinceExport: economy.save.backupReminder.battles } }));
        const banner = screen
          .getByText('Back up your progress')
          .closest('[data-banner]') as HTMLElement;
        expect(within(banner).getByRole('link', { name: 'Export save' })).toHaveAttribute(
          'href',
          '/settings/',
        );
      });

      it('shows no banners for a healthy, recently exported save', async () => {
        render(<HomePage />);
        await load(hubSave({ meta: { lastExportAt: Date.now() } }, Date.now()));
        expect(screen.queryByRole('region', { name: 'Notices' })).not.toBeInTheDocument();
      });
    });

    describe('daily quests', () => {
      it('are locked below the unlock level', async () => {
        render(<HomePage />);
        await load(hubSave({ trainer: { level: 1 } }));
        expect(
          screen.getByText(
            `Daily quests unlock at Trainer Lv ${economy.trainer.unlocks.dailyQuests}`,
          ),
        ).toBeInTheDocument();
      });

      it('refresh on mount with the current time and claim with an announcement', async () => {
        const now = new Date(2026, 10, 22, 12, 0).getTime();
        vi.useFakeTimers({ toFake: ['Date'], now });
        render(<HomePage />);
        await load(hubSave({ trainer: { level: 2, xp: 0 } }, now - 1000));
        const quests = screen.getByRole('region', { name: 'Daily quests' });
        expect(within(quests).getAllByRole('listitem')).toHaveLength(economy.quests.dailyCount);
        expect(getSave()?.quests.lastIssuedDay).toBe(questDay(now));

        // Finish the first quest, then claim it.
        const first = getSave()?.quests.active[0];
        if (!first) throw new Error('no quest');
        act(() =>
          updateSave((s) => ({
            ...s,
            quests: {
              ...s.quests,
              active: s.quests.active.map((q, i) => (i === 0 ? { ...q, progress: q.target } : q)),
            },
          })),
        );
        // The live region is in the page (and the accessibility tree) before anything is claimed.
        const region = announcer();
        expect(region).toBeEmptyDOMElement();
        expect(region).not.toHaveClass('hidden');
        expect(within(quests).queryByRole('status')).not.toBeInTheDocument();

        fireEvent.click(within(quests).getByRole('button', { name: /^Claim / }));
        const claimed = getSave()?.quests.active[0];
        expect(claimed?.claimed).toBe(true);
        const spoken = new RegExp(`\\+${economy.quests.trainerXp} Trainer XP$`);
        expect(announcer()).toBe(region);
        expect(region).toHaveTextContent(spoken);
        expect(region).toHaveAttribute('data-announcements', '1');
        // Sighted players see the same line; it is hidden from assistive tech so it isn't read twice.
        const visible = within(quests).getByTestId('quest-claim-result');
        expect(visible).toHaveTextContent(spoken);
        expect(visible).toHaveAttribute('aria-hidden', 'true');
      });

      it('announces the new trainer level when a claim levels up', async () => {
        const now = new Date(2026, 10, 22, 12, 0).getTime();
        vi.useFakeTimers({ toFake: ['Date'], now });
        render(<HomePage />);
        await load(hubSave({ trainer: { level: 2, xp: xpToNextTrainerLevel(2) - 1 } }, now - 1000));
        act(() =>
          updateSave((s) => ({
            ...s,
            quests: {
              ...s.quests,
              active: s.quests.active.map((q, i) => (i === 0 ? { ...q, progress: q.target } : q)),
            },
          })),
        );
        fireEvent.click(screen.getByRole('button', { name: /^Claim / }));
        expect(getSave()?.trainer.level).toBe(3);
        expect(announcer()).toHaveTextContent(/· Trainer Lv 3$/);
        // The announcement is committed before the modal opens (showModal() would make it inert).
        expect(screen.queryByRole('dialog', { name: /^Trainer Lv/ })).not.toBeInTheDocument();

        // The level-up opens with the new slot; "Fill slot 2" opens the team dialog on Home.
        const levelUp = await screen.findByRole('dialog', { name: 'Trainer Lv 3' });
        expect(announcer()).toHaveTextContent(/· Trainer Lv 3$/);
        expect(within(levelUp).getByText('Team slot 2')).toBeInTheDocument();
        fireEvent.click(within(levelUp).getByRole('button', { name: 'Fill slot 2' }));
        const team = await screen.findByRole('dialog', { name: 'Team' });
        await waitFor(() => expect(team).toHaveAttribute('open'));
        const pulsing = team.querySelectorAll('[data-highlight]');
        expect(pulsing).toHaveLength(1);
        expect(pulsing[0]).toHaveAttribute('data-slot-state', 'empty');
        expect(push).not.toHaveBeenCalled();
      });

      it('a claim level-up without a new slot offers "Learn talent"', async () => {
        const now = new Date(2026, 10, 22, 12, 0).getTime();
        vi.useFakeTimers({ toFake: ['Date'], now });
        render(<HomePage />);
        await load(hubSave({ trainer: { level: 3, xp: xpToNextTrainerLevel(3) - 1 } }, now - 1000));
        act(() =>
          updateSave((s) => ({
            ...s,
            quests: {
              ...s.quests,
              active: s.quests.active.map((q, i) => (i === 0 ? { ...q, progress: q.target } : q)),
            },
          })),
        );
        fireEvent.click(screen.getByRole('button', { name: /^Claim / }));
        const levelUp = await screen.findByRole('dialog', { name: 'Trainer Lv 4' });
        expect(within(levelUp).getByRole('link', { name: 'Learn talent' })).toHaveAttribute(
          'href',
          '/trainer/',
        );
      });

      it('a claim without a level-up opens no dialog', async () => {
        const now = new Date(2026, 10, 22, 12, 0).getTime();
        vi.useFakeTimers({ toFake: ['Date'], now });
        render(<HomePage />);
        await load(hubSave({ trainer: { level: 2, xp: 0 } }, now - 1000));
        act(() =>
          updateSave((s) => ({
            ...s,
            quests: {
              ...s.quests,
              active: s.quests.active.map((q, i) => (i === 0 ? { ...q, progress: q.target } : q)),
            },
          })),
        );
        fireEvent.click(screen.getByRole('button', { name: /^Claim / }));
        expect(getSave()?.trainer.level).toBe(2);
        await act(() => new Promise((resolve) => setTimeout(resolve, LEVEL_UP_DELAY_MS + 50)));
        expect(screen.queryByRole('dialog', { name: /^Trainer Lv/ })).not.toBeInTheDocument();
      });

      it('refresh again with a fresh time when the tab becomes visible', async () => {
        const day1 = new Date(2026, 10, 22, 12, 0).getTime();
        vi.useFakeTimers({ toFake: ['Date'], now: day1 });
        render(<HomePage />);
        await load(hubSave({ trainer: { level: 2 } }, day1 - 1000));
        expect(getSave()?.quests.lastIssuedDay).toBe(questDay(day1));

        const day2 = day1 + 24 * 3_600_000;
        vi.setSystemTime(day2);
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        });
        act(() => {
          document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(getSave()?.quests.lastIssuedDay).toBe(questDay(day2));
        expect(getSave()?.meta.maxSeenTime).toBe(day2);
      });
    });

    describe('capsule tray', () => {
      it('lists unopened capsules with pity and opens one into the reveal', async () => {
        render(<HomePage />);
        await load(hubSave({ capsules: { basic: 2, great: 0 }, dust: 140 }));
        const tray = screen.getByRole('region', { name: 'Capsules' });
        expect(within(tray).getByText('×2')).toBeInTheDocument();
        expect(within(tray).getByText(/^Rare guaranteed within/)).toBeInTheDocument();
        expect(within(tray).getByRole('progressbar')).toBeInTheDocument();

        fireEvent.click(within(tray).getByRole('button', { name: 'Open 1 Basic capsule' }));
        expect(getSave()?.capsules.basic).toBe(1);
        const dialog = screen.getByRole('dialog');
        fireEvent.click(within(dialog).getByRole('button', { name: /^Skip/ }));
        const result = getSave()?.collection;
        const isNew = Object.keys(result ?? {}).length > 1;
        expect(
          within(dialog).getByRole('button', { name: isNew ? 'View new' : 'Done' }),
        ).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /Open next/ })).toBeInTheDocument();
      });

      it('links to Capsules when there is nothing to open', async () => {
        render(<HomePage />);
        await load(hubSave());
        const tray = screen.getByRole('region', { name: 'Capsules' });
        expect(within(tray).getByRole('link', { name: 'Open capsules' })).toHaveAttribute(
          'href',
          '/capsules/',
        );
      });
    });
  });

  describe('save error', () => {
    it('offers Restore backup, Import file and Start fresh (after a confirmation)', async () => {
      render(<HomePage />);
      await loadError('Your saved progress is damaged and can’t be read.');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(
        screen.getByText('Your saved progress is damaged and can’t be read.'),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Restore backup' }));
      await waitFor(() => expect(announcer()).toHaveTextContent('No backup yet'));

      expect(screen.getByRole('button', { name: 'Import file' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
      expect(screen.getByText(/^Start over from the first card\?/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
      fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
      expect(
        await screen.findByRole('button', { name: 'Fill my team with random Pokémon' }),
      ).toBeInTheDocument();
      expect(step()).toBe('hero');
    });

    it('imports a save file and announces it', async () => {
      render(<HomePage />);
      await loadError('Your saved progress is damaged and can’t be read.');
      const text = await encodeSaveFile(hubSave(), { now: 0, gameVersion: 'test' });
      const input = screen.getByLabelText('Save file to import');
      await act(async () => {
        fireEvent.change(input, {
          target: { files: [new File([text], 'save.txt', { type: 'text/plain' })] },
        });
      });
      await waitFor(() => expect(announcer()).toHaveTextContent(TRANSFER_COPY.imported));
      expect(step()).toBe('done');
    });
  });
});
