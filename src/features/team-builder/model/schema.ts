import { z } from 'zod';
import { TEAM_SIZE } from '@/entities/trainer';

/** Letters from any alphabet, optionally joined by a single hyphen or apostrophe (Anne-Marie, O'Neil). */
const NAME_PATTERN = /^\p{L}+(?:['-]\p{L}+)*$/u;

const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters.`)
    .max(20, `${label} must be at most 20 characters.`)
    .regex(NAME_PATTERN, `${label} can contain letters only.`);

export const teamBuilderSchema = z.object({
  firstName: nameField('First name'),
  lastName: nameField('Last name'),
  team: z
    .array(z.string())
    .length(TEAM_SIZE, `Pick exactly ${TEAM_SIZE} Pokémon.`)
    .refine((team) => new Set(team).size === team.length, 'Each Pokémon can be picked only once.'),
});

export type TeamBuilderValues = z.infer<typeof teamBuilderSchema>;

export const emptyTeamBuilderValues: TeamBuilderValues = {
  firstName: '',
  lastName: '',
  team: [],
};
