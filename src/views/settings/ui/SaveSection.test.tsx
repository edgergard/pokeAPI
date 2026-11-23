// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear, createStore } from 'idb-keyval';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewSave, getSave, initSave, type Save } from '@/entities/save';
import { __resetPersistForTests } from '@/entities/save/persistence/persist';
import { encodeSaveFile } from '@/features/save-transfer';
import { SettingsPage } from '../SettingsPage';

const mine: Save = createNewSave({ seed: 1, now: 100, name: 'Mine' });
const theirs: Save = {
  ...createNewSave({ seed: 2, now: 200, name: 'Theirs' }),
  onboarding: { step: 'done', loanerSpeciesId: null, rivalSpeciesId: null },
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const persist = vi.fn(async () => true);

async function renderWith(save: Save) {
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
      () => save,
    ),
  );
  const view = render(<SettingsPage />);
  await screen.findByRole('button', { name: /export save/i });
  return view;
}

describe('SaveSection: persistent storage for players who skipped onboarding', () => {
  beforeEach(async () => {
    await clear(createStore('trainer-studio', 'keyval'));
    __resetPersistForTests();
    persist.mockClear();
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: { persisted: async () => false, persist },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks for persistent storage after a successful import', async () => {
    const user = userEvent.setup();
    const { container } = await renderWith(mine);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('no file input');
    const text = await encodeSaveFile(theirs, { now: 1, gameVersion: 'x' });
    await user.upload(input, new File([text], 'save.txt', { type: 'text/plain' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace current progress?' });
    expect(persist).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(getSave()).toEqual(theirs));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('asks for persistent storage after an export', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:save'), revokeObjectURL: vi.fn() }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await renderWith(mine);
    expect(persist).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /export save/i }));
    await waitFor(() => expect(getSave()?.meta.lastExportAt).toEqual(expect.any(Number)));
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
