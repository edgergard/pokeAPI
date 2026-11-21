import { formatName } from '@/shared/lib/format';
import type { Trainer } from './roster';

const fullName = (t: Trainer) => `${t.firstName} ${t.lastName}`.trim().replace(/\s+/g, ' ');
const key = (label: string) => label.toLowerCase();

/**
 * Labels for a trainer `<select>`: the plain name, plus the lead Pokémon when two trainers share a
 * name, plus a running number when even that collides. Keyed by trainer id.
 */
export function trainerOptionLabels(trainers: readonly Trainer[]): Map<string, string> {
  const unique = [...new Map(trainers.map((t) => [t.id, t])).values()];
  const count = (labels: string[]) => {
    const n = new Map<string, number>();
    for (const l of labels) n.set(key(l), (n.get(key(l)) ?? 0) + 1);
    return n;
  };

  const names = unique.map(fullName);
  const nameCount = count(names);
  const withLead = unique.map((t, i) => {
    const name = names[i] ?? '';
    const lead = t.team[0];
    return (nameCount.get(key(name)) ?? 0) > 1 && lead ? `${name} · ${formatName(lead)}` : name;
  });
  const leadCount = count(withLead);
  const seen = new Map<string, number>();

  const out = new Map<string, string>();
  unique.forEach((t, i) => {
    const label = withLead[i] ?? '';
    if ((leadCount.get(key(label)) ?? 0) > 1) {
      const n = (seen.get(key(label)) ?? 0) + 1;
      seen.set(key(label), n);
      out.set(t.id, `${label} (${n})`);
    } else {
      out.set(t.id, label);
    }
  });
  return out;
}
