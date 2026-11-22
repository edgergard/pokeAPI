# Trainer Studio — build plan

Status: wave-1 running
Orchestrator launch mode: CLI
Merge method: GitHub PR into dev
Repo: C:\Projects\pokeAPI (folder rename to trainer-studio after the build) Remote: https://github.com/edgergard/pokeAPI → renamed to edgergard/trainer-studio in the foundation Visibility: public (GitHub Pages)

## Goal

Turn the existing Trainer Studio web app (v1: trainer cards, local roster, watch-only 3D battle) into a free, single-player collection auto-battler for auto-battler fans and portfolio reviewers. Players open capsules, level up Pokémon and their trainer, and send their own collection into deterministic 3D card battles on a PvE ladder. No money, no accounts, no server; progress lives in IndexedDB and moves between browsers as an exported file. Spec: `docs/product/idea.md` (Must 1–7), `docs/product/design.md` (11 screens), `docs/product/prototype.md` (variant A, references in `docs/product/prototype/`).

## Scope

- In: Must #1 onboarding + scripted demo battle, #2 IndexedDB save + export/import, #3 capsules (odds, pity, dupes → stars/dust, craft), #4 collection + Pokémon levels/stars, #5 trainer level + team size 1→4 + trainer talents, #6 PvE ladder (~25 stages) + 3 daily quests, #7 Pokémon talents.
- Out (non-goals, idea.md Later/Never): run mode with shop, type synergies, ghosts, weekly quests, achievements, collection-level track, Wonder Pick, offline chest, shinies, economy simulation in CI, money of any kind, accounts/server/PvP, other languages, anti-cheat. Deploy changes (Vercel project rename, domain) belong to `/product-launch`.

## Assumptions

- Brownfield: no `/project-new`. The foundation adopts the `template-nextjs-pet` config (`C:\Projects\_templates\nextjs-pet` @ 89fdc7b) into this repo and writes `.github/template.json` by hand so `/project-sync` works later.
- Static export stays (`output: 'export'`, GitHub Pages + Vercel). Routes stay in root `app/`, code in FSD `src/` (CLAUDE.md is rewritten for this layout).
- GitHub repo renamed `pokeAPI` → `trainer-studio` (GitHub redirects the old URL); Pages basePath becomes `/trainer-studio`. The local folder keeps its name until the build ends (this session runs in it).
- Vitest stays (node env by default; component tests opt into jsdom per file with `// @vitest-environment jsdom`). No Playwright test suite; browser checks use the template's playwright-cli skill.
- All game numbers live in `src/shared/config/economy.ts` (foundation-owned; streams escalate to change values). Starting values are assumptions to tune later.
- v1 players: the save migration imports the v1 localStorage roster's Pokémon as owned Lv 1 and skips onboarding.
- Stream agents: Claude via Paseo, mode `auto`.

## Stack

Next.js 16.4 (App Router, static export, Turbopack), React 19, TypeScript strict, Tailwind v4 (CSS config in `src/app/styles.css`), TanStack Query 5 (only where PokeAPI is still fetched at runtime — none planned after baking), GSAP 3, three.js 0.187 (lazy chunk), zod 3, Vitest 3. Added in the foundation: `idb-keyval` (IndexedDB), dev `fake-indexeddb`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, ESLint 9 flat config (`eslint-config-next`, typescript-eslint, `eslint-config-prettier`), Prettier 3 + `prettier-plugin-tailwindcss`. Versions verified against current docs during the foundation.

## Services & env

| Service                                            | Env vars (names only)                                                                                                         | Public / secret | Where the value lives | Who sets it up |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------- | -------------- |
| PokéAPI                                            | none (data baked at build time by `scripts/bake-species.ts`; sprites/artwork from raw.githubusercontent via `getCreatureArt`) | —               | —                     | nobody         |
| Vercel (existing project `pokeapi-trainer-studio`) | `VERCEL`, `VERCEL_PROJECT_PRODUCTION_URL` (set by Vercel)                                                                     | —               | Vercel                | already linked |

No keys are needed: streams and CI run with no `.env`.

## Contracts (created in foundation, owned by orchestrator)

| Contract                                          | Path                                                                                                                                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save schema (zod) + types + `createNewSave(seed)` | `src/entities/save/model/schema.ts`                                                                                                                               | SaveV2 (see the file): `version`, `meta` (seed, pullIndex, battleIndex, maxSeenTime, createdAt, lastExportAt, battlesSinceExport, migratedFromV1), `onboarding` (step hero/dealt/fought/capsule/done, loanerSpeciesId, rivalSpeciesId), `trainer` (name, level, xp, talentPoints, talents[]), `collection` (speciesId → OwnedPokemon: level, xp, stars, dupes, ivs, nature, talents[], obtainedAt), `team` (≤ 4), `capsules` / `pity` (per tier), `capsulesOpened`, `dust`, `ladder` (cleared, replayWins), `quests` (active[], lastIssuedDay). Motion stays in localStorage |
| Save store API                                    | `src/entities/save/model/store.ts`                                                                                                                                | `getSave()`, `updateSave(fn)`, `useSave(selector)`, `subscribe`, `setPersistence(adapter)`; in-memory + no-op persistence until stream 1-save plugs in IndexedDB                                                                                                                                                                                                                                                                                                                                                                                                             |
| Game events                                       | `src/entities/save/model/events.ts`                                                                                                                               | `GameEvent` union (battleWon/Lost, capsuleOpened, damageDealt, …) consumed by quests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Economy config                                    | `src/shared/config/economy.ts`                                                                                                                                    | XP curves scale, trainer unlock table (team slots at Lv 1/3/5/10, quests Lv 2, Great capsules Lv 8), level caps per star, capsule tiers (odds per rarity, pity thresholds), first-capsule guarantee, dupe → star thresholds, dust values and craft prices, battle rewards per stage, quest pool and rewards, talent point cadence                                                                                                                                                                                                                                            |
| Species data (baked)                              | `src/entities/pokemon/data/species.json` + `src/entities/pokemon/model/species.ts`                                                                                | id, name, types, base stats, growth rate, generation, legendary/mythical, rarity (common…legendary by BST + flags); `getSpecies(id)`, `allSpecies`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Art adapter                                       | `src/entities/pokemon/model/art.ts`                                                                                                                               | `getCreatureArt(id, kind)` → URL + fallback; the only place sprite URLs are built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Seeded RNG                                        | `src/entities/battle/model/rng.ts` (exists) re-exported from `src/shared/lib/rng.ts`                                                                              | `hashSeed(...parts)`, `mulberry32`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Talent definitions                                | `src/entities/progression/model/talents.ts` (stub shape)                                                                                                          | ids, branch, tier, effect descriptors; values filled by 1-progression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Route map + stubs                                 | `app/{ladder,capsules,collection,creature,trainer,settings}/page.tsx`, `src/views/*/` stubs, `src/widgets/app-nav/` stub                                          | `?stage`/`?id` read via `useSearchParams` only after `useHydrated()` (design.md Navigation) — never `<Suspense>`                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Design tokens                                     | `src/app/styles.css`                                                                                                                                              | shadcn alias layer + `--color-rarity-*` per design.md Tokens; `--radius: 1rem`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Persisted keys                                    | IndexedDB `trainer-studio` / key `save:v2` and `save:backup`; localStorage `trainer-studio:motion` (kept), v1 `trainer-studio:roster:v1` (read once by migration) | streams can't add keys (L-027)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Dependency graph

- foundation → everything
- 1-save, 1-engine, 1-capsules, 1-progression → independent of each other (contracts only)
- 2-collection → 1-progression (levels, stars, talents), 1-capsules (craft)
- 2-play → 1-engine (N×N battle), 1-progression (rewards, team gates), 1-capsules (reveal widget for the intro reward)
- 2-home → 1-progression (quests, trainer), 1-capsules (reveal), 1-save (backup reminder), 2-play's battle route exists as a foundation stub (the onboarding links to `/battle/?stage=intro`)

## Waves

### Wave 1

| Stream        | Branch               | Owns (only these paths)                                                                                             | Port | Provider/profile · mode | Agent ID | Workspace ID | Status  | PR  |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------- | -------- | ------------ | ------- | --- |
| 1-save        | stream/1-save        | `src/entities/save/persistence/**`, `src/features/save-transfer/**`, `src/views/settings/**` (+ tests beside)       | 3101 | claude · auto           |          |              | pending |     |
| 1-engine      | stream/1-engine      | `src/entities/battle/**` (except `rng.ts`), `src/widgets/battle-arena/**`                                           | 3102 | claude · auto           |          |              | pending |     |
| 1-capsules    | stream/1-capsules    | `src/entities/capsule/**`, `src/features/open-capsule/**`, `src/widgets/capsule-reveal/**`, `src/views/capsules/**` | 3103 | claude · auto           |          |              | pending |     |
| 1-progression | stream/1-progression | `src/entities/progression/**`, `src/entities/quest/**`                                                              | 3104 | claude · auto           |          |              | pending |     |

### Wave 2

| Stream       | Branch              | Owns (only these paths)                                                                                                                                                                                 | Port | Provider/profile · mode | Agent ID | Workspace ID | Status  | PR  |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------- | -------- | ------------ | ------- | --- |
| 2-collection | stream/2-collection | `src/views/collection/**`, `src/views/creature/**`, `src/views/trainer/**`, `src/widgets/talent-tree/**`, `src/features/pokemon-search/**`                                                              | 3201 | claude · auto           |          |              | pending |     |
| 2-play       | stream/2-play       | `src/views/battle/**`, `src/views/ladder/**`, `src/entities/ladder/**`, `src/widgets/team-dialog/**`, `src/widgets/level-up/**`, `src/features/battle-setup/**` (delete)                                | 3202 | claude · auto           |          |              | pending |     |
| 2-home       | stream/2-home       | `src/views/home/**`, `src/widgets/app-nav/**`, `src/widgets/quest-list/**`, `src/widgets/team-showcase/**`, `src/features/team-builder/**` (delete), `src/entities/trainer/**` (v1 roster code retired) | 3203 | claude · auto           |          |              | pending |     |

Status values: pending · running · permission · escalation · done (report in) · in review · fixing · merged · failed

## Metrics

Gate A approved: 2026-11-22 · Gate A rounds: 1
Retries: 0 · Failed streams: 0 · Escalations: 0 · Red dev fixes: 0 · Review findings fixed: 0 · User corrections: 0

## Log

- 2026-11-22 plan drafted
- 2026-11-22 foundation committed on main at c2cd6c5 (template config 4818d5b); repo renamed to edgergard/trainer-studio; dev CI green; fresh worktree check green
