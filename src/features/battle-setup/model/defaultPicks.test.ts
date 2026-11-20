import { describe, expect, it } from 'vitest';
import { PRESET_TRAINERS, type Trainer } from '@/entities/trainer';
import { defaultPicks } from './defaultPicks';

describe('defaultPicks', () => {
  it('falls back to presets when there is no own trainer', () => {
    const { red, blue } = defaultPicks(undefined);
    expect(red.id).toBe(PRESET_TRAINERS[0]?.id);
    expect(blue.id).not.toBe(red.id);
  });

  it('uses the latest own trainer as Red and a preset as Blue', () => {
    const own: Trainer = { id: 't-1', firstName: 'A', lastName: 'B', team: ['pikachu', 'eevee', 'mew', 'snorlax'], savedAt: '' };
    const { red, blue } = defaultPicks(own);
    expect(red).toBe(own);
    expect(blue.id.startsWith('preset-')).toBe(true);
  });

  it('never gives the same trainer to both sides', () => {
    const preset = PRESET_TRAINERS[0] as Trainer;
    expect(defaultPicks(preset).blue.id).not.toBe(preset.id);
  });
});
