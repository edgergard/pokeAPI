# Team Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a spectator team-vs-team battle to Trainer Studio: pick two teams, press Fight, watch a relay 1v1 battle of 3D Pokémon cards (three.js) choreographed with GSAP.

**Architecture:** Three independent layers — a pure, seeded **simulation** (`entities/battle`) that outputs `BattleEvent[]`; a **choreographer** that turns events into one master GSAP timeline by calling a `StageDirector` interface; and a plain-three.js **BattleStage** that implements that interface. React renders only DOM UI (setup, HUD, log, controls, result). The battle page is hash-routed and lazy-loaded so three.js never touches the home bundle.

**Tech Stack:** React 19, TypeScript strict, Vite 6, Tailwind v4, TanStack Query 5, zod, GSAP 3.15 (+ `@gsap/react`), three.js (new), Vitest (node env), vite-node (already installed with Vitest) for the build-time script.

**Spec:** `docs/superpowers/specs/2026-11-20-team-battle-design.md` — read it alongside this plan.

## Global Constraints

- Feature-Sliced layering: `app → pages → widgets → features → entities → shared`; a layer never imports a higher one. Other layers import an entity/feature only through its `index.ts`.
- TypeScript strict, no `any`. Every task ends with `npm run typecheck`, `npm test` and (for UI tasks) `npx vite build` passing; delete `dist/` afterwards.
- GSAP is imported only from `@/shared/lib/gsap` (or `@/shared/lib/gsap-interactive` via `useGsapInteractive`). Never `import 'gsap'` elsewhere.
- Motion: every animated path reads `prefersReducedMotion()` / `usePrefersReducedMotion()` from `@/shared/lib/motion` (OS setting + Auto/On/Off toggle). Reduced motion = same events and outcome, cuts/fades instead of camera moves, no shake/flash, no flashing > 3 Hz.
- Level 50 for every fighter; IV 31, EV 0, no natures.
- Damage: `floor(floor(floor(2·L/5 + 2) · Power · A/D) / 50) + 2`, × STAB 1.5, × effectiveness ∈ {0, 0.25, 0.5, 1, 2, 4}, × crit 1.5 (chance 1/24), × random ∈ [0.85, 1.0]; final `max(1, floor(...))` unless effectiveness is 0. Physical → Atk/Def, special → SpA/SpD.
- Battle length target: ≤ ~90 s at 1×; short-tier hit never below 0.35 s.
- Indicative beat timings @1×: deal-in ~0.9 s, anticipation ~0.4 s, lunge+FX ~0.5 s, impact ~0.6 s, shatter ~1.2 s; short tier ~0.7 s total.
- Preset trainers use original names (no franchise characters). Visual language is Trainer Studio's own — never a copy of the official games' battle UI.
- Random rival / presets only use default forms (Pokédex id < 10000).
- Storage keys: roster `trainer-studio:roster:v1`; legacy `trainer-studio:trainer:v1` (migrate, then remove).
- Routes: `#/` (home) and `#/battle`. Battle page + three.js lazy-loaded; home `index-*.js` chunk must not grow by more than ~5 kB gzip versus `main` (currently 128.6 kB gzip).
- three.js renderer: DPR capped at 2; pause rendering when `document.hidden`; dispose all geometries/materials/textures/renderer on unmount.

## Review Focus

1. **Corrupted or old-shape localStorage** (hand-edited roster, legacy single trainer, non-JSON) → app loads, invalid entries are dropped, legacy trainer is imported once. *Test in Task 4.*
2. **A Pokémon with no damaging level-up move, or missing from `movesets.json`** (e.g. newer species) → it fights with the fallback strike instead of crashing or stalling. *Tests in Tasks 2 and 3.*
3. **Mutual immunity / stalemate** (e.g. only-Normal-moves fighter vs a Ghost, and vice versa) → battle ends at the turn cap with a winner by remaining HP %, never an infinite loop. *Test in Task 2.*
4. **The same species on both teams** (Pikachu vs Pikachu) → fighters stay distinct (ids by side+slot), events and HUD never mix them up. *Test in Task 2.*
5. **Missing artwork or a failed texture load** (offline, 404) → the card renders a placeholder face and the battle still starts. *Test in Task 8.*

---

### Task 1: Battle fundamentals — PRNG, type chart, level-50 stats

**Files:**
- Create: `src/entities/battle/model/types.ts`, `src/entities/battle/model/rng.ts`, `src/entities/battle/model/typeChart.ts`, `src/entities/battle/model/stats.ts`, `src/entities/battle/index.ts`
- Test: `src/entities/battle/model/fundamentals.test.ts`

**Interfaces:**
- Consumes: `PokemonType`, `Pokemon['stats']` shape (`hp, attack, defense, specialAttack, specialDefense, speed`) from `@/entities/pokemon`.
- Produces (exported from `@/entities/battle`):
  - `type Side = 'red' | 'blue'`
  - `type MoveType = PokemonType | 'typeless'`
  - `type Move = { name: string; type: MoveType; power: number; accuracy: number | null; damageClass: 'physical' | 'special' }`
  - `type BattleStats = { hp: number; attack: number; defense: number; specialAttack: number; specialDefense: number; speed: number }`
  - `type Fighter = { id: string; side: Side; slot: number; name: string; pokemonId: number; types: PokemonType[]; artwork: string | null; stats: BattleStats; moves: Move[] }` — `id` is `` `${side}-${slot}` ``
  - `type BattleTeam = { side: Side; trainerName: string; fighters: Fighter[] }`
  - `type Effectiveness = 0 | 0.25 | 0.5 | 1 | 2 | 4`
  - `createRng(seed: number): () => number` (mulberry32, returns [0,1))
  - `effectiveness(moveType: MoveType, defender: readonly PokemonType[]): Effectiveness` (`'typeless'` → 1)
  - `statsAtLevel(base: BattleStats, level?: number): BattleStats` (default 50)
  - `BATTLE_LEVEL = 50`

- [ ] **Step 1: Write the failing tests**

```ts
describe('createRng', () => {
  it('is deterministic per seed and in [0,1)', () => {
    const a = createRng(42), b = createRng(42);
    const xs = Array.from({ length: 5 }, a), ys = Array.from({ length: 5 }, b);
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(createRng(43)()).not.toBe(xs[0]);
  });
});
describe('effectiveness', () => {
  it.each([
    ['fire', ['grass'], 2], ['water', ['fire'], 2], ['fire', ['water'], 0.5],
    ['electric', ['ground'], 0], ['normal', ['ghost'], 0], ['ground', ['flying'], 0],
    ['ice', ['grass', 'flying'], 4], ['fire', ['water', 'rock'], 0.25],
    ['fighting', ['normal'], 2], ['typeless', ['ghost'], 1],
  ])('%s vs %j = %s', (m, d, e) => expect(effectiveness(m as MoveType, d as PokemonType[])).toBe(e));
});
describe('statsAtLevel', () => {
  it('uses the level-50 formula with IV 31, EV 0', () => {
    // Pikachu base 35/55/40/50/50/90
    expect(statsAtLevel({ hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 }))
      .toEqual({ hp: 110, attack: 75, defense: 60, specialAttack: 70, specialDefense: 70, speed: 110 });
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/entities/battle` — expect FAIL (modules missing).
- [ ] **Step 3: Implement.** `typeChart.ts` is a static 18×18 record (Gen 6+ chart) keyed `[attacker][defender]`, only non-1 entries stored; multiply across the defender's types. Stats: HP `floor((2B+31)·L/100) + L + 10`, others `floor((2B+31)·L/100) + 5`.
- [ ] **Step 4:** Run the tests — expect PASS. Run `npm run typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "feat(battle): seeded rng, type chart and level-50 stats"`

---

### Task 2: Simulation — damage, move choice, relay battle events

**Files:**
- Create: `src/entities/battle/model/damage.ts`, `src/entities/battle/model/simulate.ts`, `src/entities/battle/model/events.ts`
- Modify: `src/entities/battle/index.ts` (export new API)
- Test: `src/entities/battle/model/simulate.test.ts` (+ a `makeFighter()` test helper in `src/entities/battle/model/testFighters.ts`)

**Interfaces:**
- Consumes: Task 1 types, `createRng`, `effectiveness`.
- Produces:
  - `FALLBACK_MOVE: Move` = `{ name: 'desperate-strike', type: 'typeless', power: 40, accuracy: 100, damageClass: 'physical' }` (shown as "Desperate Strike" via the existing `formatName`)
  - `calcDamage(attacker: Fighter, defender: Fighter, move: Move, rng: () => number): { damage: number; effectiveness: Effectiveness; critical: boolean }`
  - `chooseMove(attacker: Fighter, defender: Fighter, rng: () => number): Move` — weighted by expected damage (power × STAB × effectiveness × accuracy%); weight 0 moves are excluded unless all are 0; empty `moves` → `FALLBACK_MOVE`
  - `type BattleEvent` =
    `{ kind: 'enter'; turn: number; fighterId: string }` |
    `{ kind: 'turnStart'; turn: number }` |
    `{ kind: 'move'; turn: number; attackerId: string; targetId: string; move: Move }` |
    `{ kind: 'miss'; turn: number; attackerId: string; targetId: string }` |
    `{ kind: 'noEffect'; turn: number; attackerId: string; targetId: string }` |
    `{ kind: 'hit'; turn: number; attackerId: string; targetId: string; damage: number; effectiveness: Effectiveness; critical: boolean; hpBefore: number; hpAfter: number }` |
    `{ kind: 'ko'; turn: number; fighterId: string }` |
    `{ kind: 'end'; turn: number; winner: Side; reason: 'knockout' | 'turnCap'; summary: FighterSummary[] }`
  - `type FighterSummary = { fighterId: string; kos: number; damageDealt: number; damageTaken: number; survived: boolean }`
  - `simulateBattle(red: BattleTeam, blue: BattleTeam, seed: number, opts?: { turnCap?: number }): { events: BattleEvent[]; winner: Side }` — `turnCap` default **40**

Rules (from spec §8): both sides open with `enter` for slot 0; each turn: `turnStart`, faster active acts first (speed tie → seeded coin flip), each action emits `move` then exactly one of `miss` / `noEffect` / `hit`, then `ko` if `hpAfter === 0`; a KO'd fighter's side sends the next slot with `enter` **at the start of the next turn** (after `turnStart`); the second attacker does not act if it was KO'd. Accuracy `null` never misses. At the cap: winner = higher total remaining HP % across the team (tie → `red`), `reason: 'turnCap'`.

- [ ] **Step 1: Write the failing tests**

```ts
it('is fully deterministic for the same teams and seed', () => {
  const [r, b] = sampleTeams();
  expect(simulateBattle(r, b, 7)).toEqual(simulateBattle(r, b, 7));
  expect(simulateBattle(r, b, 7).events).not.toEqual(simulateBattle(r, b, 8).events);
});
it('produces a well-formed relay: starts with two enters, ends with one end event', () => {
  const { events, winner } = simulateBattle(...sampleTeams(), 1);
  expect(events.slice(0, 2).map((e) => e.kind)).toEqual(['enter', 'enter']);
  expect(events.at(-1)).toMatchObject({ kind: 'end', winner, reason: 'knockout' });
  expect(events.filter((e) => e.kind === 'ko' && e.fighterId.startsWith(winner === 'red' ? 'blue' : 'red'))).toHaveLength(4);
});
it('hit events keep hp consistent and never below 0', () => {
  for (const e of simulateBattle(...sampleTeams(), 3).events)
    if (e.kind === 'hit') expect(e.hpAfter).toBe(Math.max(0, e.hpBefore - e.damage));
});
it('immunity yields noEffect, not damage', () => { /* normal-only attacker vs ghost defender: every attacker action → noEffect */ });
it('ends a mutual-immunity stalemate at the turn cap by remaining HP %', () => {
  // red: Normal-only moves vs blue Ghost with Ghost-only moves vs Normal red → both immune
  const { events } = simulateBattle(normalTeam, ghostTeam, 5, { turnCap: 10 });
  expect(events.at(-1)).toMatchObject({ kind: 'end', reason: 'turnCap' });
  expect(events.filter((e) => e.kind === 'turnStart')).toHaveLength(10);
});
it('a fighter with no moves uses the fallback strike', () => {
  const moveless = makeFighter({ moves: [] });
  expect(chooseMove(moveless, makeFighter(), createRng(1))).toBe(FALLBACK_MOVE);
});
it('keeps same-species fighters distinct by side and slot', () => {
  const ids = new Set(simulateBattle(pikachuTeam('red'), pikachuTeam('blue'), 2).events
    .flatMap((e) => ('fighterId' in e ? [e.fighterId] : 'attackerId' in e ? [e.attackerId, e.targetId] : [])));
  expect([...ids].every((id) => /^(red|blue)-[0-3]$/.test(id))).toBe(true);
});
it('calcDamage matches the formula for a fixed roll', () => { /* rng stub returning 0.99 then 0.0 → no crit, random 0.85; assert exact number */ });
it('summary totals equal the hit events', () => { /* sum damageDealt === sum of hit.damage */ });
```

- [ ] **Step 2:** Run `npx vitest run src/entities/battle` — expect FAIL.
- [ ] **Step 3: Implement** `damage.ts` (formula from Global Constraints; rng order per hit: accuracy → crit → random factor), `simulate.ts` (state per side: index of active fighter, current HP map), `events.ts` (types only).
- [ ] **Step 4:** Run tests — PASS. `npm run typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "feat(battle): deterministic relay battle simulation"`

---

### Task 3: Movesets — build-time data, selection rule, fighter preparation

**Files:**
- Create: `src/entities/battle/model/selectMoves.ts`, `src/entities/battle/model/prepare.ts`, `src/entities/battle/data/movesets.json` (generated), `src/entities/battle/api/movesets.ts`, `scripts/build-movesets.ts`
- Modify: `package.json` (script `"movesets": "vite-node scripts/build-movesets.ts"`), `src/entities/battle/index.ts`, `src/entities/pokemon/index.ts` (export `pokemonQuery`), `README.md` (how to regenerate movesets)
- Test: `src/entities/battle/model/movesets.test.ts`

**Interfaces:**
- Consumes: `Move`, `Fighter`, `BattleTeam`, `statsAtLevel`, `FALLBACK_MOVE`; `Pokemon` from `@/entities/pokemon`.
- Produces:
  - `selectMoves(candidates: readonly Move[], pokemonTypes: readonly PokemonType[], max?: number): Move[]` — damaging only (power > 0), STAB first, then power desc, then name asc; max 4
  - JSON shape `MovesetData = { moves: Record<string, [type: MoveType, power: number, accuracy: number | null, damageClass: 'physical' | 'special']>; sets: Record<string /* pokemon slug */, string[] /* move names */> }` (moves deduplicated to keep the file small)
  - `loadMovesets(): Promise<MovesetData>` (dynamic `import('../data/movesets.json')`, memoised)
  - `movesFor(data: MovesetData, pokemonName: string): Move[]` (unknown name → `[]`)
  - `toFighter(pokemon: Pokemon, moves: Move[], side: Side, slot: number): Fighter`
  - `prepareTeam(choice: TeamChoice, side: Side, fetchPokemon: (name: string) => Promise<Pokemon>, data: MovesetData): Promise<BattleTeam>`
  - `type TeamChoice = { trainerName: string; team: string[] }`
  - from `@/entities/pokemon`: `pokemonQuery(name: string)` (already defined in `api/queries.ts`, just export it)

- [ ] **Step 1: Write the failing tests**

```ts
it('selectMoves prefers STAB, then power, then name, damaging only, max 4', () => {
  const m = (name: string, type: MoveType, power: number) => ({ name, type, power, accuracy: 100, damageClass: 'special' as const });
  const picked = selectMoves([m('growl', 'normal', 0), m('surf', 'water', 90), m('thunderbolt', 'electric', 90),
    m('thunder', 'electric', 110), m('quick-attack', 'normal', 40), m('spark', 'electric', 65), m('slam', 'normal', 80)], ['electric']);
  expect(picked.map((x) => x.name)).toEqual(['thunder', 'thunderbolt', 'spark', 'surf']);
});
it('movesFor returns [] for unknown species and decodes tuples', () => {
  const data = { moves: { surf: ['water', 90, 100, 'special'] }, sets: { lapras: ['surf'] } } as MovesetData;
  expect(movesFor(data, 'lapras')).toEqual([{ name: 'surf', type: 'water', power: 90, accuracy: 100, damageClass: 'special' }]);
  expect(movesFor(data, 'brand-new-mon')).toEqual([]);
});
it('toFighter builds level-50 stats and side/slot id', () => { /* id 'blue-2', stats via statsAtLevel */ });
it('the committed movesets.json covers every default-form Pokémon with ≤ 4 moves', async () => {
  const data = await loadMovesets();
  expect(Object.keys(data.sets).length).toBeGreaterThanOrEqual(1000);
  expect(Object.values(data.sets).every((s) => s.length <= 4 && s.every((n) => n in data.moves))).toBe(true);
});
```

- [ ] **Step 2:** Run tests — FAIL.
- [ ] **Step 3: Implement** `selectMoves`, `movesFor`, `toFighter`, `prepareTeam`.
- [ ] **Step 4: Implement `scripts/build-movesets.ts`** (runs under vite-node, imports `selectMoves` from `@/entities/battle/model/selectMoves`): read `/pokemon?limit=100000`, keep ids < 10000; for each, fetch `/pokemon/{id}`, collect move names whose `version_group_details` include `move_learn_method.name === 'level-up'`; fetch each unique `/move/{name}` once (concurrency 8, retry ×3, generic `User-Agent: trainer-studio-build`); map to `Move`; `selectMoves`; write deduplicated JSON (sorted keys, no whitespace). Log totals.
- [ ] **Step 5:** Run `npm run movesets` (takes several minutes; ~2,000 requests one-time). Expected log: ≥ 1000 Pokémon written. Check file size `< 120 kB` raw.
- [ ] **Step 6:** Run tests — PASS. `npm run typecheck`.
- [ ] **Step 7: Commit** — `git commit -m "feat(battle): build-time movesets and fighter preparation"`

---

### Task 4: Trainer roster entity, presets and random rival

**Files:**
- Modify: `src/entities/trainer/index.ts` (replace `useTrainer` with `useRoster`), keep `src/entities/trainer/model/swapSlots.ts`
- Create: `src/entities/trainer/model/roster.ts`, `src/entities/trainer/model/presets.ts`, `src/entities/trainer/model/randomRival.ts`
- Test: `src/entities/trainer/model/roster.test.ts`

**Interfaces:**
- Consumes: `swapSlots`, `useLocalStorage` (shared), zod, `PokemonListItem` from `@/entities/pokemon`.
- Produces (from `@/entities/trainer`):
  - `type Trainer = { id: string; firstName: string; lastName: string; team: string[]; savedAt: string }`
  - `ROSTER_KEY = 'trainer-studio:roster:v1'`, `LEGACY_TRAINER_KEY = 'trainer-studio:trainer:v1'`
  - `parseRoster(raw: unknown): Trainer[]` — zod per entry; drops invalid (team must be 4 distinct non-empty strings)
  - `migrateLegacy(raw: unknown): Trainer | null`
  - `loadRoster(storage: Pick<Storage, 'getItem' | 'removeItem'>): Trainer[]` — roster ∪ migrated legacy (once; removes legacy key)
  - `useRoster(): { trainers: Trainer[]; latest: Trainer | null; add(data: { firstName: string; lastName: string; team: string[] }): Trainer; remove(id: string): void; swap(id: string, from: number, to: number): void }` — `trainers` sorted newest first
  - `PRESET_TRAINERS: readonly Trainer[]` — 4 entries, `id` prefixed `preset-`, original names, varied teams (e.g. Mira Vale `charizard, lapras, jolteon, gengar`; Oren Pike `venusaur, machamp, alakazam, gyarados`; Juno Hart `dragonite, ninetales, scizor, vaporeon`; Silas Crane `tyranitar, gardevoir, infernape, starmie`)
  - `randomRival(index: readonly PokemonListItem[], rng?: () => number): Trainer` — 4 distinct ids < 10000, name from a small original name list, `id` prefixed `rival-`
  - `TEAM_SIZE` (unchanged)

- [ ] **Step 1: Write the failing tests**

```ts
it('parseRoster drops invalid entries instead of throwing', () => {
  expect(parseRoster('nope')).toEqual([]);
  expect(parseRoster([{ id: 'a', firstName: 'A', lastName: 'B', team: ['x', 'y'], savedAt: '2026' }, valid])).toEqual([valid]);
});
it('migrates the legacy single trainer once and removes the legacy key', () => {
  const store = fakeStorage({ [LEGACY_TRAINER_KEY]: JSON.stringify(legacy) });
  const roster = loadRoster(store);
  expect(roster).toHaveLength(1);
  expect(roster[0]).toMatchObject({ firstName: legacy.firstName, team: legacy.team });
  expect(store.removeItem).toHaveBeenCalledWith(LEGACY_TRAINER_KEY);
});
it('survives non-JSON in either key', () => {
  expect(loadRoster(fakeStorage({ [ROSTER_KEY]: '{oops', [LEGACY_TRAINER_KEY]: '][' }))).toEqual([]);
});
it('presets are 4 valid trainers with distinct ids and default-form teams', () => {
  expect(parseRoster(PRESET_TRAINERS)).toHaveLength(4);
});
it('randomRival picks 4 distinct default-form Pokémon deterministically for a seeded rng', () => {
  const index = Array.from({ length: 1200 }, (_, i) => ({ id: i < 1025 ? i + 1 : 10001 + i, name: `p${i}` }));
  const a = randomRival(index, createSeq(1)), b = randomRival(index, createSeq(1));
  expect(a.team).toEqual(b.team);
  expect(new Set(a.team).size).toBe(4);
  expect(a.team.every((n) => index.find((p) => p.name === n)!.id < 10000)).toBe(true);
});
```
(`createSeq` = a tiny test-local seeded generator; the entity must not import from `entities/battle`.)

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3: Implement.** `useRoster` reads via `loadRoster(window.localStorage)` in a lazy `useState` initialiser and writes with an effect (same failure tolerance as `useLocalStorage`); ids via `crypto.randomUUID()`.
- [ ] **Step 4:** Run tests — PASS; `npm run typecheck` will now fail in `HomePage.tsx` (uses `useTrainer`) — that is fixed in Task 5; do not commit a broken build: proceed directly to Task 5 and commit both together.

---

### Task 5: Home page on the roster — switcher, remove, Battle entry, hash routing

**Files:**
- Create: `src/shared/lib/router.ts`, `src/pages/battle/BattlePage.tsx` (placeholder shell for now)
- Modify: `src/app/App.tsx`, `src/pages/home/HomePage.tsx`, `src/widgets/team-showcase/TeamShowcase.tsx`
- Test: `src/shared/lib/router.test.ts`

**Interfaces:**
- Consumes: `useRoster`, `Trainer` (Task 4).
- Produces:
  - `type Route = '/' | '/battle'`; `parseHash(hash: string): Route` (unknown → `'/'`); `useHashRoute(): Route`; `navigate(route: Route): void`; `href(route: Route): string` (`'#/battle'`)
  - `TeamShowcase` props become `{ trainers: Trainer[]; selectedId: string | null; onSelect(id: string): void; onRemove(id: string): void; onSwap(id: string, from: number, to: number): void; celebration?: number }`
  - `BattlePage` default export (lazy target)

Behaviour (spec §7.1, owner decision A): home shows only the visitor's trainers; first visit unchanged; most recent shown by default; a compact **trainer switcher** (native `<select>` styled like the motion toggle, or segmented chips) in the showcase header only when `trainers.length > 1`; the Reset button becomes **Remove** (`aria-label="Remove {name}"`, same placement) and shows the next most recent after removal; nav gets a **Battle** link and the showcase gets a "Battle with this team →" CTA, both `href('/battle')`. Saving a team selects it and plays the existing lock-in. App: `useHashRoute()`; `'/battle'` renders `lazy(() => import('@/pages/battle/BattlePage'))` inside `<Suspense>` with a small spinner.

- [ ] **Step 1: Write the failing test**

```ts
it.each([['', '/'], ['#/', '/'], ['#/battle', '/battle'], ['#/nope', '/'], ['#battle', '/']])('parseHash(%j) = %s', (h, r) =>
  expect(parseHash(h)).toBe(r));
```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3: Implement** router (listens to `hashchange`, `useSyncExternalStore`), wire `App`, update `HomePage`/`TeamShowcase` to the props above; scroll to top on route change.
- [ ] **Step 4:** `npm run typecheck`, `npm test`, `npx vite build` — PASS; confirm a separate `BattlePage-*.js` chunk exists. Manual: `npm run dev` → save two trainers → switcher appears, Remove works, reload keeps both, Battle link goes to `#/battle`, back button returns home.
- [ ] **Step 5: Commit** (Tasks 4+5) — `git commit -m "feat: trainer roster, presets, random rival and battle route"`

---

### Task 6: Battle setup — Red/Blue pickers, Fight, team preparation

**Files:**
- Create: `src/features/battle-setup/ui/BattleSetup.tsx`, `src/features/battle-setup/ui/TeamPicker.tsx`, `src/features/battle-setup/model/usePrepareBattle.ts`, `src/features/battle-setup/index.ts`
- Modify: `src/pages/battle/BattlePage.tsx`

**Interfaces:**
- Consumes: `useRoster`, `PRESET_TRAINERS`, `randomRival` (Task 4); `usePokemonIndex`, `pokemonQuery`, `PokemonCardPlaceholder`/`TypeBadge` (pokemon entity); `loadMovesets`, `prepareTeam`, `TeamChoice`, `BattleTeam` (Task 3).
- Produces:
  - `BattleSetup` props `{ onReady(red: BattleTeam, blue: BattleTeam): void }`
  - `usePrepareBattle(): { prepare(red: TeamChoice, blue: TeamChoice): Promise<{ red: BattleTeam; blue: BattleTeam }>; status: 'idle' | 'loading' | 'error'; error: string | null }` — fetches via `queryClient.fetchQuery(pokemonQuery(name))` (cache-first) and `loadMovesets()` in parallel
  - `BattlePage` state: `{ phase: 'setup' } | { phase: 'battle'; red: BattleTeam; blue: BattleTeam; seed: number }` (seed = `Math.floor(Math.random() * 2 ** 31)` on Fight)

UI: two picker panels (Red / Blue accent) — `<select>` with optgroups **Your trainers** and **Presets**, plus a **🎲 Random rival** button; each panel previews the 4 team sprites + type badges. Defaults so Fight works in ≤ 2 clicks: Red = latest own trainer or first preset; Blue = a different preset. **Fight** disabled until both chosen and while `loading`; on error show message + retry. Uses existing `Button`, `FieldShell` styling and dark theme.

- [ ] **Step 1:** Implement `usePrepareBattle`, `TeamPicker`, `BattleSetup`; BattlePage renders setup and, for now, a placeholder "battle" panel listing fighters (replaced in Task 10).
- [ ] **Step 2:** `npm run typecheck`, `npm test`, `npx vite build` — PASS.
- [ ] **Step 3:** Manual in `npm run dev`: `#/battle` → defaults pre-filled → Fight reaches the placeholder in ≤ 2 clicks; 🎲 changes Blue's team each click; offline (DevTools) → error + retry.
- [ ] **Step 4: Commit** — `git commit -m "feat(battle-setup): team pickers, presets, random rival and Fight"`

---

### Task 7: Choreographer — events → master GSAP timeline with tiers and compression

**Files:**
- Create: `src/widgets/battle-arena/model/director.ts`, `src/widgets/battle-arena/model/choreograph.ts`, `src/widgets/battle-arena/model/nullDirector.ts`
- Test: `src/widgets/battle-arena/model/choreograph.test.ts`

**Interfaces:**
- Consumes: `BattleEvent`, `Move`, `Side`, `Effectiveness` (Task 2); `gsap` from `@/shared/lib/gsap`.
- Produces:
  - `type Tier = 'full' | 'short'`
  - `interface StageDirector { intro(): gsap.core.Timeline; dealIn(fighterId: string): gsap.core.Timeline; anticipate(attackerId: string, move: Move, tier: Tier): gsap.core.Timeline; lunge(attackerId: string, targetId: string, move: Move, tier: Tier): gsap.core.Timeline; impact(targetId: string, result: 'hit' | 'miss' | 'noEffect', info: { damage: number; effectiveness: Effectiveness; critical: boolean } | null, tier: Tier): gsap.core.Timeline; knockOut(fighterId: string): gsap.core.Timeline; victory(winner: Side): gsap.core.Timeline }`
  - `tierFor(event: Extract<BattleEvent, { kind: 'hit' | 'miss' | 'noEffect' }>, isFirstAttack: boolean): Tier` — full for effectiveness > 1, critical, or first attack of that attacker; KOs always use `knockOut` (full)
  - `choreograph(events: BattleEvent[], director: StageDirector, opts: { onEvent(event: BattleEvent): void; targetSeconds?: number /* 90 */; minShortSeconds?: number /* 0.35 */ }): { timeline: gsap.core.Timeline; seconds: number }` — returned timeline is **paused**; each event's `onEvent` fires via `timeline.call` exactly when its beat lands (hit → at impact start; ko → at shatter start)
  - `createNullDirector(durations?: Partial<Record<keyof StageDirector, number>>): StageDirector` — every method returns `gsap.timeline().to({}, { duration })`; used by tests and as the no-WebGL fallback

Compression: build once, measure `timeline.duration()`; if > `targetSeconds`, set `timeScale` on every short-tier sub-timeline so total fits, clamped so a short beat is never shorter than `minShortSeconds`; if still too long, apply the same to full-tier hits (never to `knockOut`, `intro`, `victory`).

- [ ] **Step 1: Write the failing tests**

```ts
it('fires onEvent for every event, in order, when played', () => {
  const seen: string[] = [];
  const { timeline } = choreograph(events, createNullDirector(), { onEvent: (e) => seen.push(e.kind) });
  timeline.progress(1); // jumps and fires all calls
  expect(seen).toEqual(events.map((e) => e.kind));
});
it('uses full tier for super-effective and crits, short for neutral', () => {
  expect(tierFor(hit({ effectiveness: 2 }), false)).toBe('full');
  expect(tierFor(hit({ critical: true }), false)).toBe('full');
  expect(tierFor(hit({ effectiveness: 1 }), false)).toBe('short');
  expect(tierFor(hit({ effectiveness: 1 }), true)).toBe('full');
});
it('compresses long battles to ≤ targetSeconds but keeps short beats ≥ min', () => {
  const long = longBattleEvents(300); // many neutral hits
  const { seconds } = choreograph(long, createNullDirector(), { onEvent: () => {}, targetSeconds: 90 });
  expect(seconds).toBeLessThanOrEqual(90.5);
});
it('leaves short battles untouched', () => {
  const { seconds } = choreograph(shortEvents, createNullDirector(), { onEvent: () => {} });
  expect(seconds).toBeCloseTo(sumOfNullDurations(shortEvents), 1);
});
it('returns a paused timeline', () => {
  expect(choreograph(shortEvents, createNullDirector(), { onEvent: () => {} }).timeline.paused()).toBe(true);
});
```
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS (GSAP runs fine in Vitest's node env on plain objects).
- [ ] **Step 5: Commit** — `git commit -m "feat(battle-arena): event choreographer with timing tiers"`

---

### Task 8: three.js BattleStage foundation — renderer, scene, camera rig, 3D cards

**Files:**
- Create: `src/widgets/battle-arena/stage/BattleStage.ts`, `src/widgets/battle-arena/stage/cardMesh.ts`, `src/widgets/battle-arena/stage/cardTexture.ts`, `src/widgets/battle-arena/stage/holoMaterial.ts`, `src/widgets/battle-arena/stage/cameraRig.ts`, `src/widgets/battle-arena/stage/layout.ts`
- Modify: `package.json` (`three` + `@types/three`, current 0.x, pinned with `^`)
- Test: `src/widgets/battle-arena/stage/layout.test.ts`, `src/widgets/battle-arena/stage/cardTexture.test.ts`

**Interfaces:**
- Consumes: `BattleTeam`, `Fighter`, `Side` (Task 1); `typeColor` (pokemon entity); `StageDirector` (Task 7, implemented in Task 9).
- Produces:
  - `class BattleStage { constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }); load(red: BattleTeam, blue: BattleTeam): Promise<void>; card(fighterId: string): CardHandle; readonly camera: CameraRig; readonly scene: THREE.Scene; resize(width: number, height: number): void; start(): void; stop(): void; dispose(): void; static isSupported(): boolean }`
  - `type CardHandle = { group: THREE.Group; face: THREE.Mesh; fighter: Fighter; setTint(color: string, intensity: number): void }`
  - `slotPosition(side: Side, role: 'active' | { bench: number }, aspect: number): THREE.Vector3` (pure; portrait aspects pull benches closer and raise camera framing)
  - `resolveArtwork(url: string | null, load: (url: string) => Promise<HTMLImageElement>): Promise<HTMLImageElement | null>` — `null` URL or load failure → `null` (card draws placeholder face)
  - `CameraRig` with named shots `'wide' | 'redClose' | 'blueClose' | 'impact' | 'victory'` and `shot(name): { position: THREE.Vector3; target: THREE.Vector3 }`

Visual (spec §10): rounded-rect card (`ShapeGeometry`/extruded thin) ~ 2.5:3.5; face texture drawn on an offscreen canvas (artwork on type-tinted radial gradient, name, type badges, dex number — Trainer Studio fonts/colours); branded back face; `holoMaterial` = `ShaderMaterial` sheen tinted by type colour, driven by a `uView`/time uniform. Scene: dark floor (subtle gradient/reflection), fog, key light tinted per active fighter, rim lights. Render loop with `renderer.setAnimationLoop`, stopped when `document.hidden`; `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`; `dispose()` traverses and disposes every geometry/material/texture and calls `renderer.dispose()`; listens for `webglcontextlost` and exposes `onContextLost?: () => void`.

- [ ] **Step 1: Write the failing tests**

```ts
it('places actives facing each other and benches behind their side', () => {
  const ra = slotPosition('red', 'active', 16 / 9), ba = slotPosition('blue', 'active', 16 / 9);
  expect(ra.x).toBeLessThan(0); expect(ba.x).toBeGreaterThan(0); expect(ra.x).toBeCloseTo(-ba.x);
  expect(Math.abs(slotPosition('red', { bench: 0 }, 16 / 9).x)).toBeGreaterThan(Math.abs(ra.x));
});
it('pulls benches closer on portrait', () => {
  expect(Math.abs(slotPosition('red', { bench: 0 }, 9 / 16).x)).toBeLessThan(Math.abs(slotPosition('red', { bench: 0 }, 16 / 9).x));
});
it('resolveArtwork returns null on missing url or failed load', async () => {
  expect(await resolveArtwork(null, vi.fn())).toBeNull();
  expect(await resolveArtwork('x.png', () => Promise.reject(new Error('404')))).toBeNull();
});
```
- [ ] **Step 2:** Run — FAIL. **Step 3:** `npm i three @types/three`; implement. **Step 4:** Tests PASS, typecheck PASS.
- [ ] **Step 5:** Temporary manual check: mount `BattleStage` in the BattlePage placeholder after Fight → 8 cards visible in relay layout (actives centre, benches behind), holo sheen moves, resizing works, leaving the page logs no WebGL warnings. `npx vite build`: three.js is only in the BattlePage chunk(s), home `index-*.js` unchanged.
- [ ] **Step 6: Commit** — `git commit -m "feat(battle-arena): three.js stage with 3D cards and camera rig"`

---

### Task 9: Stage director — the five beats, FX families, shatter

**Files:**
- Create: `src/widgets/battle-arena/stage/director3d.ts`, `src/widgets/battle-arena/stage/fx.ts`, `src/widgets/battle-arena/stage/shards.ts`
- Test: `src/widgets/battle-arena/stage/fx.test.ts`, `src/widgets/battle-arena/stage/shards.test.ts`

**Interfaces:**
- Consumes: `BattleStage`, `CardHandle`, `CameraRig` (Task 8); `StageDirector`, `Tier` (Task 7); `gsap`, `GSAP_EASE` (`@/shared/lib/gsap`); `MoveType`.
- Produces:
  - `createStageDirector(stage: BattleStage, opts: { reducedMotion: boolean }): StageDirector`
  - `type FxFamily = 'fire' | 'water' | 'electric' | 'nature' | 'mystic' | 'impact' | 'toxic' | 'air'`
  - `fxFamily(type: MoveType): FxFamily` — fire/dragon→fire; water/ice→water; electric→electric; grass/bug→nature; psychic/fairy/ghost→mystic; fighting/normal/rock/ground/steel/typeless→impact; poison/dark→toxic; flying→air
  - `class FxPool { constructor(scene: THREE.Scene); play(family: FxFamily, from: THREE.Vector3, to: THREE.Vector3, color: string, tier: Tier): gsap.core.Timeline; dispose(): void }` (pooled `Points`/instanced meshes, no per-hit allocation)
  - `createShards(width: number, height: number, count: number, seed: number): THREE.BufferGeometry[]`

Beats (spec §9 table + "premium" style, timings from Global Constraints): `intro` (decks slide in, camera sweep wide, ~2 s); `dealIn` (arc from deck, flip face-up, `GSAP_EASE.spring` landing, key light tint); `anticipate` (lean back/tilt, camera dolly toward attacker — full tier only); `lunge` (motion toward target + `FxPool.play`); `impact` (recoil + shake proportional to effectiveness, brief emissive flash; accents only for super-effective/crit); `knockOut` (swap card for its shard group, shards fall with gravity-like eases and settle on the floor, fade); `victory` (surviving winner cards rise and line up, camera orbit). **Reduced motion:** every method returns short fades/cuts (≤ 0.3 s), camera jumps between shots, no shake/flash, knockOut = fade-out.

- [ ] **Step 1: Write the failing tests**

```ts
it.each([['fire', 'fire'], ['dragon', 'fire'], ['ice', 'water'], ['bug', 'nature'], ['ghost', 'mystic'],
  ['steel', 'impact'], ['typeless', 'impact'], ['dark', 'toxic'], ['flying', 'air']])('fxFamily(%s) = %s', (t, f) =>
  expect(fxFamily(t as MoveType)).toBe(f));
it('createShards is deterministic and covers the card area', () => {
  const a = createShards(2.5, 3.5, 24, 9), b = createShards(2.5, 3.5, 24, 9);
  expect(a).toHaveLength(24);
  expect(a.map(area)).toEqual(b.map(area));
  expect(a.reduce((s, g) => s + area(g), 0)).toBeCloseTo(2.5 * 3.5, 1);
});
```
(`area` = test helper summing triangle areas of a geometry's position attribute.)
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement (shards: jittered grid → triangle fan per cell, seeded with `createRng`-style local PRNG). **Step 4:** PASS + typecheck.
- [ ] **Step 5: Commit** — `git commit -m "feat(battle-arena): 3D director beats, type FX and card shatter"`

---

### Task 10: Battle arena widget — playback, HUD, log, controls, result

**Files:**
- Create: `src/widgets/battle-arena/ui/BattleArena.tsx`, `src/widgets/battle-arena/ui/Hud.tsx`, `src/widgets/battle-arena/ui/BattleLog.tsx`, `src/widgets/battle-arena/ui/ResultOverlay.tsx`, `src/widgets/battle-arena/model/useBattlePlayback.ts`, `src/widgets/battle-arena/model/hudState.ts`, `src/widgets/battle-arena/index.ts`
- Modify: `src/pages/battle/BattlePage.tsx`
- Test: `src/widgets/battle-arena/model/hudState.test.ts`

**Interfaces:**
- Consumes: `simulateBattle`, `BattleTeam`, `BattleEvent`, `FighterSummary` (Tasks 2–3); `choreograph`, `createNullDirector` (Task 7); `BattleStage` (Task 8); `createStageDirector` (Task 9); motion hooks.
- Produces:
  - `BattleArena` props `{ red: BattleTeam; blue: BattleTeam; seed: number; onNewBattle(): void }`
  - `type HudState = { hp: Record<string, { current: number; max: number }>; active: Record<Side, string | null>; ko: Set<string>; lastMove: { attackerId: string; name: string } | null; popups: { id: number; fighterId: string; text: string; tone: 'damage' | 'super' | 'weak' | 'crit' | 'miss' | 'immune' }[]; result: { winner: Side; reason: 'knockout' | 'turnCap'; summary: FighterSummary[] } | null }`
  - `initialHud(red: BattleTeam, blue: BattleTeam): HudState`; `reduceHud(state: HudState, event: BattleEvent): HudState` (pure)
  - `describeEvent(event: BattleEvent, fighters: Record<string, Fighter>): string | null` — log line, e.g. "Charizard used Flamethrower — super effective! Pikachu has 12 HP left."
  - `useBattlePlayback(args: { red; blue; seed; canvas: HTMLCanvasElement | null; reducedMotion: boolean }): { hud: HudState; log: string[]; speed: 1 | 2; setSpeed(s: 1 | 2): void; replay(): void; webgl: boolean; ready: boolean }`

Behaviour: simulate once per (teams, seed); create `BattleStage` + `createStageDirector` when `BattleStage.isSupported()`, else `createNullDirector()` and show a notice ("3D isn't available on this device — showing the battle log"); `choreograph(...)` → play; `speed` maps to `timeline.timeScale`; `replay()` kills the timeline, resets HUD/stage, rebuilds from the **same seed**; on unmount kill timeline + `stage.dispose()`; pause timeline + render loop while `document.hidden`; rebuild director when the motion setting flips (restart from the current label). HUD over the canvas: two team bars (trainer name, 4 portrait pips with KO state, active fighter HP bar with numbers), move name banner, damage popups projected from the target card's screen position, controls (**×2** toggle, **Replay**, **New battle**). `BattleLog` = collapsible panel + `aria-live="polite"` region (append lines; screen readers get each line). Canvas `aria-hidden="true"`. `ResultOverlay` on the `end` event: winner, reason, table of fighters (KOs / dealt / taken), buttons Replay and New battle (focus moves to the overlay heading).

- [ ] **Step 1: Write the failing tests**

```ts
it('reduceHud applies hits, KOs, entries and the result', () => {
  let s = initialHud(red, blue);
  s = reduceHud(s, { kind: 'enter', turn: 0, fighterId: 'red-0' });
  s = reduceHud(s, { kind: 'hit', turn: 1, attackerId: 'blue-0', targetId: 'red-0', damage: 30, effectiveness: 2, critical: false, hpBefore: 110, hpAfter: 80 });
  expect(s.hp['red-0'].current).toBe(80);
  expect(s.popups.at(-1)).toMatchObject({ fighterId: 'red-0', tone: 'super' });
  s = reduceHud(s, { kind: 'ko', turn: 3, fighterId: 'red-0' });
  expect(s.ko.has('red-0')).toBe(true);
});
it('describeEvent writes readable log lines', () => {
  expect(describeEvent(moveEvt, fighters)).toBe('Charizard used Flamethrower!');
  expect(describeEvent(hitEvt /* eff 2, hpAfter 12 */, fighters)).toBe('Super effective! Pikachu has 12 HP left.');
  expect(describeEvent(noEffectEvt, fighters)).toBe('It doesn’t affect Gengar…');
});
```
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement; BattlePage swaps the placeholder for `<BattleArena>`; "New battle" returns to setup with previous picks kept. **Step 4:** Tests PASS, typecheck, build.
- [ ] **Step 5:** Manual: full battle at 1× reads clearly and ends ≤ ~90 s; ×2 halves it; Replay is identical (same KOs in same order); Motion **Off** → cuts/fades, same outcome; leave mid-battle and come back → no console errors, no duplicate audio/timers; resize mid-battle.
- [ ] **Step 6: Commit** — `git commit -m "feat(battle-arena): playback, HUD, battle log, controls and result screen"`

---

### Task 11: Polish, performance and release check

**Files:**
- Modify: `README.md` (features, Battle section: architecture diagram, how to regenerate movesets, controls), `src/app/styles.css` (only if HUD needs shared tokens), any files touched by fixes
- Test: existing suites

- [ ] **Step 1:** `npx vite build` → record chunk sizes; home `index-*.js` within +5 kB gzip of `main`; three.js only in battle chunks. If not, fix imports (no battle/three imports reachable from home).
- [ ] **Step 2:** Mobile 375×812 portrait: setup usable without horizontal scroll; arena framing shows both actives and HUD readable; tap targets ≥ 44 px.
- [ ] **Step 3:** Accessibility pass: keyboard-only from home → Battle → Fight → Replay/New battle; log announces turns; result overlay focus; contrast of HUD text ≥ 4.5:1 (reuse `ink-400`+ tokens).
- [ ] **Step 4:** Robustness: block `raw.githubusercontent.com` in DevTools → cards show placeholder faces, battle runs; simulate `WEBGL_lose_context` → notice + log fallback; open `#/battle` directly on a fresh profile → presets make Fight work.
- [ ] **Step 5:** `npm run typecheck`, `npm test`, `npx vite build` all PASS; delete `dist/`.
- [ ] **Step 6: Commit** — `git commit -m "docs+polish: battle README, mobile and robustness fixes"`
