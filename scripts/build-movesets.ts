// Generates src/entities/battle/data/movesets.json from PokeAPI.
// Run with `npm run movesets` (one-time, ~2,000 requests).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectMoves } from '@/entities/battle/model/selectMoves';
import type { Move, MoveType } from '@/entities/battle/model/types';
import type { MovesetData } from '@/entities/battle/model/prepare';
import type { PokemonType } from '@/entities/pokemon';

const BASE = 'https://pokeapi.co/api/v2';
const CONCURRENCY = 8;
const OUT = fileURLToPath(new URL('../src/entities/battle/data/movesets.json', import.meta.url));
const MOVE_TYPES = new Set<string>([
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
]);

type Named = { name: string; url: string };
type PokemonDto = {
  id: number;
  name: string;
  types: { type: Named }[];
  moves: { move: Named; version_group_details: { move_learn_method: Named }[] }[];
};
type MoveDto = {
  name: string;
  type: Named;
  power: number | null;
  accuracy: number | null;
  damage_class: Named;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'trainer-studio-build' } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      lastError = e;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError;
}

async function mapPool<T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i] as T);
      }
    }),
  );
  return out;
}

async function main() {
  const list = await getJson<{ results: Named[] }>(`${BASE}/pokemon?limit=100000`);
  const idOf = (u: string) => Number(/\/(\d+)\/?$/.exec(u)?.[1]);
  const defaults = list.results.filter((r) => idOf(r.url) < 10000);
  console.log(`default-form Pokemon: ${defaults.length}`);

  let done = 0;
  const pokemon = await mapPool(defaults, async (r) => {
    const p = await getJson<PokemonDto>(`${BASE}/pokemon/${idOf(r.url)}`);
    if (++done % 200 === 0) console.log(`  pokemon ${done}/${defaults.length}`);
    return p;
  });

  const learned = pokemon.map((p) =>
    p.moves
      .filter((m) => m.version_group_details.some((d) => d.move_learn_method.name === 'level-up'))
      .map((m) => m.move.name),
  );
  const uniqueMoves = [...new Set(learned.flat())].sort();
  console.log(`unique level-up moves: ${uniqueMoves.length}`);

  done = 0;
  const moveByName = new Map<string, Move>();
  await mapPool(uniqueMoves, async (name) => {
    const d = await getJson<MoveDto>(`${BASE}/move/${name}`);
    const cls = d.damage_class.name;
    if (
      d.power &&
      d.power > 0 &&
      MOVE_TYPES.has(d.type.name) &&
      (cls === 'physical' || cls === 'special')
    ) {
      moveByName.set(name, {
        name,
        type: d.type.name as MoveType,
        power: d.power,
        accuracy: d.accuracy,
        damageClass: cls,
      });
    }
    if (++done % 200 === 0) console.log(`  moves ${done}/${uniqueMoves.length}`);
  });

  const moves: MovesetData['moves'] = {};
  const sets: MovesetData['sets'] = {};
  pokemon.forEach((p, i) => {
    const candidates = (learned[i] ?? []).flatMap((n) => moveByName.get(n) ?? []);
    const picked = selectMoves(
      candidates,
      p.types.map((t) => t.type.name as PokemonType),
    );
    if (picked.length === 0) return;
    sets[p.name] = picked.map((m) => m.name);
    for (const m of picked) moves[m.name] = [m.type, m.power, m.accuracy, m.damageClass];
  });

  const sortKeys = <V>(o: Record<string, V>) =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  const json = JSON.stringify({ moves: sortKeys(moves), sets: sortKeys(sets) });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, json);
  console.log(
    `wrote ${Object.keys(sets).length} Pokemon, ${Object.keys(moves).length} moves, ${json.length} bytes`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
