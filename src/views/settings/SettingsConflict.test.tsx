// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createDefaultPersistence,
  createNewSave,
  getSave,
  initSave,
  type PersistenceOptions,
} from '@/entities/save';
import { SettingsPage } from './SettingsPage';

/** One browser's storage, shared by two tabs. */
function sharedKv(): NonNullable<PersistenceOptions['kv']> {
  const data = new Map<string, unknown>();
  return {
    get: async (key) => data.get(key),
    set: async (key, value) => {
      data.set(key, value);
    },
    setMany: async (entries) => {
      for (const [key, value] of entries) data.set(key, value);
    },
  };
}

describe('Settings with the save open in two tabs', () => {
  const opened: { dispose(): void }[] = [];
  afterEach(() => {
    for (const adapter of opened.splice(0)) adapter.dispose();
  });

  it('asks this tab to reload once another tab saves newer progress', async () => {
    const kv = sharedKv();
    const tab = (): ReturnType<typeof createDefaultPersistence> => {
      const adapter = createDefaultPersistence({
        kv,
        channel: 'trainer-studio-save-settings-test',
        window: null,
        document: null,
        localStorage: null,
        debounceMs: 0,
      });
      opened.push(adapter);
      return adapter;
    };
    const save = createNewSave({ seed: 1, now: 1, name: 'Here' });
    const here = tab();
    await act(() => initSave(here, () => save));
    render(<SettingsPage />);
    await screen.findByRole('button', { name: /export save/i });
    expect(screen.queryByText(/changed in another tab/)).not.toBeInTheDocument();

    const other = tab();
    await other.load();
    await other.write({ ...save, dust: 999 });

    const reason = 'Your progress changed in another tab. Reload this page to keep playing here.';
    expect((await screen.findAllByText(reason)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /import save/i })).toHaveAccessibleDescription(
      reason,
    );
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import save/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: /reset progress/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    // This tab no longer writes: the other tab's progress stays.
    await expect(here.write({ ...save, dust: 1 })).resolves.toBe(false);
    expect(await kv.get('save:v2')).toMatchObject({ dust: 999 });
    expect(getSave()?.dust).toBe(0);
  });
});
