import { describe, expect, it } from 'vitest';
import type { Trainer } from './roster';
import { trainerOptionLabels } from './optionLabels';

const t = (id: string, firstName: string, lastName: string, team: string[]): Trainer => ({
  id,
  firstName,
  lastName,
  team,
  savedAt: '',
});

describe('trainerOptionLabels', () => {
  it('uses the plain name when names are unique', () => {
    const labels = trainerOptionLabels([
      t('1', 'Ash', 'K', ['pikachu']),
      t('2', 'Mira', 'S', ['eevee']),
    ]);
    expect(labels.get('1')).toBe('Ash K');
    expect(labels.get('2')).toBe('Mira S');
  });

  it('adds the lead Pokémon when names collide (case and spacing ignored)', () => {
    const labels = trainerOptionLabels([
      t('1', 'Ash', 'K', ['pikachu']),
      t('2', 'ash ', 'k', ['mr-mime']),
      t('3', 'Mira', 'S', ['eevee']),
    ]);
    expect(labels.get('1')).toBe('Ash K · Pikachu');
    expect(labels.get('2')).toBe('ash k · Mr Mime');
    expect(labels.get('3')).toBe('Mira S');
  });

  it('numbers trainers whose name and lead still collide', () => {
    const labels = trainerOptionLabels([
      t('1', 'Ash', 'K', ['pikachu']),
      t('2', 'Ash', 'K', ['pikachu']),
    ]);
    expect(labels.get('1')).toBe('Ash K · Pikachu (1)');
    expect(labels.get('2')).toBe('Ash K · Pikachu (2)');
  });

  it('counts a trainer listed twice (same id) once', () => {
    const a = t('1', 'Ash', 'K', ['pikachu']);
    expect(trainerOptionLabels([a, a]).get('1')).toBe('Ash K');
  });
});
