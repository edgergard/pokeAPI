// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear, createStore } from 'idb-keyval';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAVE_VERSION,
  createNewSave,
  getSave,
  initSave,
  readBackup,
  writeBackup,
  type Save,
} from '@/entities/save';
import { encodeEnvelope, encodeSaveFile } from '@/features/save-transfer';
import { SettingsPage } from './SettingsPage';

const mine: Save = { ...createNewSave({ seed: 1, now: 100, name: 'Mine' }), dust: 10 };
const theirs: Save = {
  ...createNewSave({ seed: 2, now: 200, name: 'Theirs' }),
  dust: 500,
  onboarding: { step: 'done', loanerSpeciesId: null, rivalSpeciesId: null },
};

beforeAll(() => {
  // jsdom has no modal dialogs: enough of the API for shared/ui/Dialog.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

function stubPersisted(persisted: boolean) {
  vi.stubGlobal('navigator', {
    ...navigator,
    storage: { persisted: async () => persisted, persist: async () => persisted },
  });
}

async function renderWith(save: Save, { durable = true } = {}) {
  await act(() =>
    initSave(
      {
        durable,
        load: async () => ({ kind: 'loaded', save }),
        write: async () => durable,
      },
      () => save,
    ),
  );
  const view = render(<SettingsPage />);
  await screen.findByRole('button', { name: /export save/i });
  return view;
}

const status = () => screen.getByRole('status');
const fileInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="file"]')!;
const saveFile = async (text: string) => new File([text], 'save.txt', { type: 'text/plain' });

describe('SettingsPage', () => {
  beforeEach(async () => {
    await clear(createStore('trainer-studio', 'keyval'));
    stubPersisted(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders one h1 inside main#content with the about info', async () => {
    await renderWith(mine);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Settings');
    expect(
      screen.getByText(
        /Unofficial fan project, not affiliated with Nintendo, Game Freak or The Pokémon Company/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /source code on github/i })).toHaveAttribute(
      'href',
      'https://github.com/edgergard/trainer-studio',
    );
    expect(screen.getByRole('link', { name: /pokéapi/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /animations/i })).toBeInTheDocument();
  });

  it('shows the persistent status once storage is persisted', async () => {
    stubPersisted(true);
    await renderWith(mine);
    expect(await screen.findByText('Saved on this device · persistent')).toBeInTheDocument();
  });

  it('warns while storage may be cleared', async () => {
    await renderWith(mine);
    expect(await screen.findByText('Browser may clear data. Export often.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import save/i })).toBeEnabled();
  });

  it('offers only Export when storage is blocked', async () => {
    stubPersisted(true);
    await renderWith(mine, { durable: false });
    expect(screen.getByText('Browser may clear data. Export often.')).toBeInTheDocument();
    expect(screen.getAllByText(/only Export works/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /export save/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /import save/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /restore backup/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /reset progress/i })).toBeDisabled();
    expect(screen.getByLabelText(/type reset to confirm/i)).toBeDisabled();
  });

  it('shows "No backup yet" with Restore disabled', async () => {
    await renderWith(mine);
    expect(await screen.findByText('No backup yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore backup/i })).toBeDisabled();
  });

  it('imports a file after the confirm dialog and keeps the old save as backup', async () => {
    const user = userEvent.setup();
    const { container } = await renderWith(mine);
    const file = await saveFile(await encodeSaveFile(theirs, { now: 1, gameVersion: 'x' }));

    await user.upload(fileInput(container), file);
    const dialog = await screen.findByRole('dialog', { name: 'Replace current progress?' });
    expect(
      within(dialog).getByText('Your current save moves to the backup slot.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Theirs/)).toBeInTheDocument();
    expect(getSave()).toEqual(mine); // nothing changes before confirming

    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(status()).toHaveTextContent('Save imported'));
    expect(getSave()).toEqual(theirs);
    expect(screen.getByRole('link', { name: /go to home/i })).toBeInTheDocument();
    await expect(readBackup()).resolves.toMatchObject({ save: mine });
    expect(await screen.findByText(/^Backup from /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore backup/i })).toBeEnabled();
  });

  it('changes nothing when the import is cancelled', async () => {
    const user = userEvent.setup();
    const { container } = await renderWith(mine);
    const file = await saveFile(await encodeSaveFile(theirs, { now: 1, gameVersion: 'x' }));
    await user.upload(fileInput(container), file);
    const dialog = await screen.findByRole('dialog', { name: 'Replace current progress?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(getSave()).toEqual(mine);
    await expect(readBackup()).resolves.toBeNull();
  });

  it.each([
    [
      'a non-save file',
      async () => 'just some notes',
      'This file is damaged or not a Trainer Studio save',
    ],
    [
      'a truncated save',
      async () => (await encodeSaveFile(theirs, { now: 1, gameVersion: 'x' })).slice(0, 40),
      'This file is damaged or not a Trainer Studio save',
    ],
    [
      'a newer save',
      () =>
        encodeEnvelope({
          schemaVersion: SAVE_VERSION + 1,
          data: {},
          gameVersion: '9.0.0',
          createdAt: 1,
        }),
      'Made by a newer version. Update the page and try again',
    ],
  ])('reports %s and changes nothing', async (_label, makeText, message) => {
    const user = userEvent.setup();
    const { container } = await renderWith(mine);
    await user.upload(fileInput(container), await saveFile(await makeText()));
    await waitFor(() => expect(status()).toHaveTextContent(message));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getSave()).toEqual(mine);
    await expect(readBackup()).resolves.toBeNull();
  });

  it('upgrades a v1 file', async () => {
    const user = userEvent.setup();
    const { container } = await renderWith(mine);
    const text = await encodeEnvelope({
      schemaVersion: 1,
      data: [{ id: 'a', firstName: 'Ash', lastName: 'K', team: ['pikachu'], savedAt: 'x' }],
      gameVersion: '3.0.0',
      createdAt: 1,
    });
    await user.upload(fileInput(container), await saveFile(text));
    const dialog = await screen.findByRole('dialog', { name: 'Replace current progress?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(status()).toHaveTextContent('Upgraded from v1'));
    expect(getSave()?.meta.migratedFromV1).toBe(true);
  });

  it('arms Reset only for exactly "RESET" and starts a fresh save', async () => {
    const user = userEvent.setup();
    await renderWith({ ...mine, onboarding: { ...mine.onboarding, step: 'done' } });
    const field = screen.getByLabelText(/type reset to confirm/i);
    const button = screen.getByRole('button', { name: /reset progress/i });

    expect(button).toBeDisabled();
    await user.type(field, 'reset');
    expect(button).toBeDisabled();
    await user.clear(field);
    await user.type(field, 'RESET');
    expect(button).toBeEnabled();

    await user.click(button);
    await waitFor(() => expect(status()).toHaveTextContent('Progress reset'));
    expect(getSave()?.onboarding.step).toBe('hero');
    expect(getSave()?.trainer.name).toMatch(/^Trainer \d{4}$/);
    expect(field).toHaveValue('');
    await expect(readBackup()).resolves.toMatchObject({ save: { trainer: { name: 'Mine' } } });
    expect(screen.getByRole('button', { name: /export save/i })).toHaveFocus();
  });

  it('exports the save and records it', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:save');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await renderWith({ ...mine, meta: { ...mine.meta, battlesSinceExport: 11 } });
    expect(screen.getByText('Not exported yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /export save/i }));
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        /Exported just now · trainer-studio-\d{4}-\d{2}-\d{2}\.txt/,
      ),
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(getSave()?.meta.battlesSinceExport).toBe(0);
    expect(getSave()?.meta.lastExportAt).toEqual(expect.any(Number));
    expect(screen.getAllByText(/Exported just now/).length).toBe(2);
  });

  it('restores the backup by swapping it with the current save', async () => {
    const user = userEvent.setup();
    await writeBackup(theirs, Date.UTC(2026, 0, 2));
    await renderWith(mine);
    const restore = await screen.findByRole('button', { name: /restore backup/i });
    await waitFor(() => expect(restore).toBeEnabled());
    await user.click(restore);
    await waitFor(() => expect(status()).toHaveTextContent('Backup restored'));
    expect(getSave()).toEqual(theirs);
    await expect(readBackup()).resolves.toMatchObject({ save: mine });
  });
});
