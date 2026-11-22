// Bakes species data from PokeAPI into src/entities/pokemon/data/ (CLAUDE.md: no runtime game-data calls).
// Run with `npm run species` (one-time, ~2,100 requests; PokeAPI fair use asks clients to cache — this is the cache).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://pokeapi.co/api/v2';
const CONCURRENCY = 8;
const OUT_DIR = fileURLToPath(new URL('../src/entities/pokemon/data/', import.meta.url));

type Named = { name: string; url: string };
type SpeciesDto = {
  id: number;
  name: string;
  is_legendary: boolean;
  is_mythical: boolean;
  is_baby: boolean;
  generation: Named;
  growth_rate: Named;
  evolves_from_species: Named | null;
  names: { language: Named; name: string }[];
  varieties: { is_default: boolean; pokemon: Named }[];
};
type PokemonDto = {
  id: number;
  name: string;
  types: { slot: number; type: Named }[];
  stats: { base_stat: number; stat: Named }[];
};
type GrowthRateDto = { name: string; levels: { level: number; experience: number }[] };

const STAT_KEYS: Record<string, string> = {
  hp: 'hp',
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'specialAttack',
  'special-defense': 'specialDefense',
  speed: 'speed',
};
const ROMAN: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
};

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return getJson<T>(url, attempt + 1);
    }
    throw new Error(`${res.status} ${url}`);
  }
  return (await res.json()) as T;
}

async function mapPool<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i] as T);
        if (i % 100 === 0) console.log(`  ${i}/${items.length}`);
      }
    }),
  );
  return out;
}

function rarityOf(s: SpeciesDto, bst: number): string {
  if (s.is_legendary || s.is_mythical) return 'legendary';
  if (bst >= 530) return 'epic'; // fully evolved strong lines and pseudo-legendaries
  if (bst >= 480) return 'rare';
  if (bst >= 360) return 'uncommon';
  return 'common';
}

async function main() {
  const list = await getJson<{ results: Named[] }>(`${BASE}/pokemon-species?limit=2000`);
  console.log(`species: ${list.results.length}`);
  const rows = await mapPool(list.results, async (named) => {
    const s = await getJson<SpeciesDto>(named.url);
    const variety = s.varieties.find((v) => v.is_default) ?? s.varieties[0];
    if (!variety) throw new Error(`no variety for ${s.name}`);
    const p = await getJson<PokemonDto>(variety.pokemon.url);
    const stats = Object.fromEntries(
      p.stats.map((st) => [STAT_KEYS[st.stat.name] ?? st.stat.name, st.base_stat]),
    );
    const bst = p.stats.reduce((sum, st) => sum + st.base_stat, 0);
    return {
      id: s.id,
      slug: p.name,
      name: s.names.find((n) => n.language.name === 'en')?.name ?? s.name,
      types: [...p.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
      stats,
      bst,
      generation: ROMAN[s.generation.name.replace('generation-', '')] ?? 0,
      growthRate: s.growth_rate.name,
      legendary: s.is_legendary || s.is_mythical,
      baby: s.is_baby,
      evolvesFrom: s.evolves_from_species
        ? Number(s.evolves_from_species.url.split('/').filter(Boolean).pop())
        : null,
      rarity: rarityOf(s, bst),
    };
  });
  rows.sort((a, b) => a.id - b.id);

  const rates = await getJson<{ results: Named[] }>(`${BASE}/growth-rate`);
  const growth = Object.fromEntries(
    await Promise.all(
      rates.results.map(async (r) => {
        const g = await getJson<GrowthRateDto>(r.url);
        const levels = [...g.levels].sort((a, b) => a.level - b.level).map((l) => l.experience);
        return [g.name, levels] as const;
      }),
    ),
  );

  mkdirSync(dirname(`${OUT_DIR}x`), { recursive: true });
  writeFileSync(`${OUT_DIR}species.json`, JSON.stringify(rows));
  writeFileSync(`${OUT_DIR}growth-rates.json`, JSON.stringify(growth));
  const byRarity = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.rarity] = (acc[r.rarity] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`wrote ${rows.length} species`, byRarity);
}

void main();
