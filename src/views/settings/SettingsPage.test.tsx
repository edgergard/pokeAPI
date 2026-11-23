// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear, createStore } from 'idb-keyval';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOAD_ERROR_DAMAGED,
  LOAD_ERROR_NEWER,
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
  // jsdom has no modal dialogs: enough of the API for shared/ui/Dialog, including the native
  // behaviour of returning focus to the element that had it when the dialog opened.
  const opener = new WeakMap<HTMLDialogElement, Element | null>();
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    opener.set(this, document.activeElement);
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    const previous = opener.get(this);
    if (previous instanceof HTMLElement) previous.focus();
  };
});

function stubPersisted(persisted: boolean) {
  vi.stubGlobal('navigator', {
    ...navigator,
    storage: { persisted: async () => persisted, persist: async () => persisted },
  });
}

/** Renders Settings over an in-memory store holding `save`, or in the load-error state `loadError`. */
async function renderWith(
  save: Save | null,
  {
    durable = true,
    loadError = LOAD_ERROR_DAMAGED,
  }: { durable?: boolean; loadError?: string } = {},
) {
  await act(() =>
    initSave(
      {
        durable,
        load: async () => (save ? { kind: 'loaded', save } : { kind: 'error', reason: loadError }),
        write: async () => durable,
      },
      () => createNewSave({ seed: 9, now: 9, name: 'Unused' }),
    ),
  );
  const view = render(<SettingsPage />);
  await screen.findByRole('button', { name: /export save/i });
  return view;
}

const status = () => screen.getByRole('status');
const button = (name: RegExp | string) => screen.getByRole('button', { name });
function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('no file input');
  return input;
}
const saveFile = (text: string) => new File([text], 'save.txt', { type: 'text/plain' });
const exportFile = async (save: Save) =>
  saveFile(await encodeSaveFile(save, { now: 1, gameVersion: 'x' }));

/** Unavailable but still focusable: `aria-disabled`, never `disabled`. */
function expectOff(element: HTMLElement) {
  expect(element).toHaveAttribute('aria-disabled', 'true');
  expect(element).not.toBeDisabled();
}
function expectOn(element: HTMLElement) {
  expect(element).not.toHaveAttribute('aria-disabled');
  expect(element).not.toBeDisabled();
}

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
    expectOn(button(/import save/i));
  });

  it('offers only Export when storage is blocked', async () => {
    stubPersisted(true);
    await renderWith(mine, { durable: false });
    expect(screen.getByText('Browser may clear data. Export often.')).toBeInTheDocument();
    expect(screen.getAllByText(/only Export works/).length).toBeGreaterThan(0);
    expectOn(button(/export save/i));
    expectOff(button(/import save/i));
    expectOff(button(/restore backup/i));
    expectOff(button(/reset progress/i));
    expect(button(/import save/i)).toHaveAccessibleDescription(/only Export works/);
    expect(screen.getByLabelText(/type reset to confirm/i)).toBeDisabled();
  });

  it('shows "No backup yet" with Restore unavailable', async () => {
    await renderWith(mine);
    expect(await screen.findByText('No backup yet')).toBeInTheDocument();
    expectOff(button(/restore backup/i));
  });

  it('imports a file after the confirm dialog and keeps the old save as backup', async () => {
    const user = userEvent.setup();
    const { container } = await renderWith(mine);

    await user.upload(fileInput(container), await exportFile(theirs));
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
    expectOn(button(/restore backup/i));
  });

  it('changes nothing when the import is cancelled', async () => {
    const user = userEvent.setup();
    const { container } = await renderWith(mine);
    await user.upload(fileInput(container), await exportFile(theirs));
    const dialog = await screen.findByRole('dialog', { name: 'Replace current progress?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(getSave()).toEqual(mine);
    await expect(readBackup()).resolves.toBeNull();
  });

  it('ignores Cancel, Esc and the close button while the replace is running', async () => {
    const { container } = await renderWith(mine);
    await userEvent.setup().upload(fileInput(container), await exportFile(theirs));
    const dialog = await screen.findByRole('dialog', { name: 'Replace current progress?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace' }));
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    expectOff(cancel);
    fireEvent.click(cancel);
    fireEvent(dialog, new Event('cancel', { cancelable: true })); // Esc
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    expect(dialog).toHaveAttribute('open');

    await waitFor(() => expect(status()).toHaveTextContent('Save imported'));
    expect(getSave()).toEqual(theirs);
    await expect(readBackup()).resolves.toMatchObject({ save: mine });
  });

  it('returns focus to Import after the confirm dialog closes', async () => {
    const user = userEvent.setup();
    const { container } = await renderWith(mine);
    const importButton = button(/import save/i);
    importButton.focus();
    await user.upload(fileInput(container), await exportFile(theirs));
    const dialog = await screen.findByRole('dialog', { name: 'Replace current progress?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(status()).toHaveTextContent('Save imported'));
    await waitFor(() => expect(importButton).toHaveFocus());
    expectOn(importButton);
  });

  it.each([
    ['Export', /export save/i],
    ['Restore', /restore backup/i],
  ])('keeps focus on %s while it works', async (_label, name) => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await writeBackup(theirs, 1);
    await renderWith(mine);
    const target = button(name);
    await waitFor(() => expectOn(target));
    target.focus();

    fireEvent.click(target);
    expectOff(target); // busy: unavailable, yet still focused and focusable
    expect(target).toHaveFocus();
    await waitFor(() => expect(button(/export save/i)).not.toHaveAttribute('aria-disabled'));
    expect(target).toHaveFocus();
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
    await user.upload(fileInput(container), saveFile(await makeText()));
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
    await user.upload(fileInput(container), saveFile(text));
    // The v1 path lazy-loads the migration chain and species data: allow for a cold import under load.
    const dialog = await screen.findByRole(
      'dialog',
      { name: 'Replace current progress?' },
      { timeout: 5000 },
    );
    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(status()).toHaveTextContent('Upgraded from v1'), { timeout: 5000 });
    expect(getSave()?.meta.migratedFromV1).toBe(true);
  });

  it('arms Reset only for exactly "RESET" and starts a fresh save', async () => {
    const user = userEvent.setup();
    await renderWith({ ...mine, onboarding: { ...mine.onboarding, step: 'done' } });
    const field = screen.getByLabelText(/type reset to confirm/i);
    const reset = button(/reset progress/i);

    expectOff(reset);
    await user.type(field, 'reset');
    expectOff(reset);
    await user.click(reset); // unarmed: ignored
    expect(getSave()?.trainer.name).toBe('Mine');
    await user.clear(field);
    await user.type(field, 'RESET');
    expectOn(reset);

    await user.click(reset);
    await waitFor(() => expect(status()).toHaveTextContent('Progress reset'));
    expect(getSave()?.onboarding.step).toBe('hero');
    expect(getSave()?.trainer.name).toMatch(/^Trainer \d{4}$/);
    expect(field).toHaveValue('');
    await expect(readBackup()).resolves.toMatchObject({ save: { trainer: { name: 'Mine' } } });
    expect(button(/export save/i)).toHaveFocus();
  });

  it('exports the save and records it', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:save');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await renderWith({ ...mine, meta: { ...mine.meta, battlesSinceExport: 11 } });
    expect(screen.getByText('Not exported yet')).toBeInTheDocument();

    await user.click(button(/export save/i));
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
    const restore = button(/restore backup/i);
    await waitFor(() => expectOn(restore));
    await user.click(restore);
    await waitFor(() => expect(status()).toHaveTextContent('Backup restored'));
    expect(getSave()).toEqual(theirs);
    await expect(readBackup()).resolves.toMatchObject({ save: mine });
  });

  describe('when the stored save can’t be loaded', () => {
    it('locks Import, Restore and Reset for a save made by a newer version', async () => {
      const user = userEvent.setup();
      await writeBackup(theirs, 1);
      const { container } = await renderWith(null, { loadError: LOAD_ERROR_NEWER });

      expect(
        screen.getAllByText('Made by a newer version. Update the page and try again').length,
      ).toBeGreaterThan(0);
      await screen.findByText(/^Backup from /);
      expectOff(button(/export save/i)); // nothing loaded to export
      expectOff(button(/import save/i));
      expectOff(button(/restore backup/i));
      expectOff(button(/reset progress/i));
      expect(button(/import save/i)).toHaveAccessibleDescription(/Made by a newer version/);
      expect(screen.getByLabelText(/type reset to confirm/i)).toBeDisabled();

      await user.click(button(/restore backup/i));
      await user.upload(fileInput(container), await exportFile(theirs));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(getSave()).toBeNull();
      await expect(readBackup()).resolves.toMatchObject({ save: theirs });
    });

    it('says a damaged save is replaced without a backup', async () => {
      const user = userEvent.setup();
      const { container } = await renderWith(null, { loadError: LOAD_ERROR_DAMAGED });
      expect(screen.getByText(LOAD_ERROR_DAMAGED)).toBeInTheDocument();
      expect(
        screen.getByText(/can’t be read, so it will be replaced without a backup/),
      ).toBeInTheDocument();

      await user.upload(fileInput(container), await exportFile(theirs));
      const dialog = await screen.findByRole('dialog', { name: 'Replace current progress?' });
      expect(
        within(dialog).getByText(
          'Your current save can’t be read, so it will be replaced and can’t be kept as a backup.',
        ),
      ).toBeInTheDocument();
      expect(within(dialog).queryByText(/moves to the backup slot/)).not.toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Replace' }));
      await waitFor(() => expect(status()).toHaveTextContent('Save imported'));
      expect(getSave()).toEqual(theirs);
      await expect(readBackup()).resolves.toBeNull();
    });
  });
});
