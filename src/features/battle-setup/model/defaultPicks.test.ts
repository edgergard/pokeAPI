import { describe, expect, it } from 'vitest';
import { PRESET_TRAINERS, type Trainer } from '@/entities/trainer';
import { defaultPicks } from './defaultPicks';

const own = (id: string): Trainer => ({ id, firstName: 'A', lastName: id, team: ['pikachu', 'eevee', 'mew', 'snorlax'], savedAt: '' });

describe('defaultPicks', () => {
  it('falls back to presets when there is no own trainer', () => {
    const { red, blue } = defaultPicks([]);
    expect(red.id).toBe(PRESET_TRAINERS[0]?.id);
    expect(blue.id).not.toBe(red.id);
  });

  it('uses the latest own trainer as Red and a preset as Blue', () => {
    const latest = own('t-1');
    const { red, blue } = defaultPicks([latest, own('t-0')]);
    expect(red).toBe(latest);
    expect(blue.id.startsWith('preset-')).toBe(true);
  });

  it('never gives the same trainer to both sides', () => {
    const preset = PRESET_TRAINERS[0] as Trainer;
    expect(defaultPicks([preset]).blue.id).not.toBe(preset.id);
  });

  it('puts the preferred trainer in Red when it exists', () => {
    const older = own('t-0');
    expect(defaultPicks([own('t-1'), older], 't-0').red).toBe(older);
  });

  it('accepts a preset as the preferred trainer', () => {
    const preset = PRESET_TRAINERS[1] as Trainer;
    const { red, blue } = defaultPicks([own('t-1')], preset.id);
    expect(red).toBe(preset);
    expect(blue.id).not.toBe(preset.id);
  });

  it('ignores an unknown or missing preferred id', () => {
    const latest = own('t-1');
    expect(defaultPicks([latest], 'nope').red).toBe(latest);
    expect(defaultPicks([latest], null).red).toBe(latest);
    expect(defaultPicks([latest], '').red).toBe(latest);
  });
});
