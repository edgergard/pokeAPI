import { describe, expect, it } from 'vitest';
import { teamBuilderSchema } from './schema';

const valid = { firstName: 'Ash', lastName: 'Ketchum', team: ['pikachu', 'bulbasaur', 'charmander', 'squirtle'] };

describe('teamBuilderSchema', () => {
  it('accepts a complete trainer', () => {
    expect(teamBuilderSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts non-latin and hyphenated names', () => {
    expect(teamBuilderSchema.safeParse({ ...valid, firstName: 'Олена', lastName: "O'Neil-Smith" }).success).toBe(true);
  });

  it.each(['A', 'Ash1', 'Ash Ketchum', '--'])('rejects first name %j', (firstName) => {
    expect(teamBuilderSchema.safeParse({ ...valid, firstName }).success).toBe(false);
  });

  it('requires exactly four unique Pokémon', () => {
    expect(teamBuilderSchema.safeParse({ ...valid, team: valid.team.slice(0, 3) }).success).toBe(false);
    expect(teamBuilderSchema.safeParse({ ...valid, team: ['a', 'a', 'b', 'c'] }).success).toBe(false);
  });
});
