# Stream 1-progression: progression, rewards and daily quests (domain logic)

You are one of several agents building Trainer Studio in parallel. Each agent works in its own git worktree and branch. The orchestrator reviews your branch and merges it into `dev`.

## Your branch

`stream/1-progression` (already checked out in this worktree, based on `dev`).
Mode: GitHub remote `origin` (repo `edgergard/trainer-studio`).
Your dev-server port: 3104.

## Setup (do first)

1. `npm ci` (never `npm install`). If package-lock.json then shows as modified, `git checkout -- package-lock.json`.
2. Run `npm run check` once to confirm a green baseline. If it is red before you changed anything, report `STATUS: escalation`.
   Run `npm ci` again whenever integrating `dev` changes package-lock.json.

## Task

Write the pure domain logic for Must #4 (Pokémon levels, stars cap, stats), #5 (trainer level, team size, trainer talents), #6 (battle rewards and daily quests) and #7 (Pokémon talents). **No UI.** Every function is pure (`Save`/`OwnedPokemon` in, new object out, no mutation, no `Date.now()` — `now` is a parameter), takes every number from `economy` in `src/shared/config/economy.ts`, and is exported through `src/entities/progression/index.ts` or `src/entities/quest/index.ts`. Wave-2 streams (collection, play, home) build their screens only on what you export, so name things clearly and export the result types.

Dependency direction: `quest` may import `@/entities/progression` (for `addTrainerXp`, `grantReward`); `progression` must never import `quest`. Import other slices only through their `index.ts` (`@/entities/save`, `@/entities/pokemon`), shared code through `@/shared/...`.

### 1. Pokémon levels and stats (`src/entities/progression/model/`)

- `xpToNextLevel(species, level)` = `Math.round((growthTotalXp(species.growthRate, level + 1) − growthTotalXp(species.growthRate, level)) / economy.pokemon.xpCurveDivisor)`, at least 1. `growthTotalXp` and the `Species` type come from `@/entities/pokemon` (`src/entities/pokemon/model/species.ts`; curve data shape: `src/entities/pokemon/data/growth-rates.json`, rate name → total XP per level, index 0 = level 1).
- `levelCap(stars)` from `economy.pokemon.levelCapByStars[stars]`, never above `economy.pokemon.maxLevel`.
- `addPokemonXp(owned, species, amount)` → `{ owned, levelsGained }`. `owned.xp` is XP towards the next level (not total). Carry overflow across several levels; at the cap the level stops and `xp` stays 0 (XP is lost at the cap, not banked). A later star-up (capsule stream) simply lets XP flow again.
- `computeStats(species, owned, talents = owned.talents)` → `Record<StatKey, number>` (`StatKey` from `@/entities/pokemon`). Gen III formula, no EVs: other stats `floor((2·Base + IV)·Level/100) + 5`, HP `floor((2·Base + IV)·Level/100) + Level + 10`. Then nature: define a nature → `{ up, down }` stat table for every entry of `NATURES` in `src/entities/save/model/schema.ts` (real Gen III pairs: brave +attack −speed, modest +specialAttack −attack, bold +defense −attack, calm +specialDefense −attack, timid +speed −attack, adamant +attack −specialAttack, neutral none), multiply by `NATURE_MULTIPLIER.up/down` and floor; HP is never affected. Then talents: sum the `statPercent` effects per stat and apply `floor(stat × (1 + sum/100))`. With IV 31, neutral, no talents it must equal `statsAtLevel` in `src/entities/battle/model/stats.ts` (read it for consistency; don't import it from production code).
- `statBreakdown` is optional, but the creature screen shows "base → current (formula, talent contribution)", so returning the pre-talent and post-talent values (e.g. `computeStats(...)` plus `computeStats(..., [])`) must be possible.
- `talentPointsAvailable(owned)` = `floor(owned.level / economy.pokemon.talentPointEveryLevels) − owned.talents.length` (never negative).

### 2. Talent content and learning (`src/entities/progression/model/talents.ts` + a logic file)

- Fill `POKEMON_TALENTS`: 3 branches (`offense`, `defense`, `tempo`) × 4 tiers = 12 nodes, generic for every species, effects only from the existing `TalentEffect` union (e.g. offense: attack/specialAttack %, critChance; defense: hp/defense/specialDefense %; tempo: speed %, tier 4 `firstStrike`). Each node costs 1 point. Ids stable and readable (`offense-1` …).
- Fill `TRAINER_TALENTS`: about 15 nodes with `requiresLevel` (spread over trainer levels 2–30) and `requires` (dependency lines), effects that change rules — `xpPercent` (Pokémon battle XP), `dustPercent` (dust from rewards), `benchXpPercent` (adds to the bench share), `capsuleChance` (chance of a bonus basic capsule on a battle win), `critChance` (team-wide) — no plain stat bloat. Each node costs 1 trainer talent point. The `description` states the exact rule (it is shown on the trainer screen).
- Talent effect percents are talent content and live in `talents.ts` (your file), not in `economy.ts`. The exported types in `talents.ts` are the contract: keep them unchanged (escalate if you need a new effect kind).
- `learnPokemonTalent(owned, talentId)`, `resetPokemonTalents(owned)` (free, clears the list), `learnTrainerTalent(save, talentId)`, `resetTrainerTalents(save)` (free, refunds `trainer.talents.length` points). Learning validates: id exists, not already learned, a free point, tier N needs tier N−1 of the same branch (Pokémon), `requiresLevel` and every `requires` id (trainer). Return a discriminated result `{ ok: true, owned | save } | { ok: false, reason }` with a reason code the UI can turn into the design copy ("First talent point at Lv 5", "Requires Trainer Lv 6", "Requires: Quick Draw", "Next point at Lv 9").
- `talentModifiers(owned, trainerTalents: string[] = [])` → `{ critChance: number; firstStrike: boolean }` for the battle engine (Pokémon `critChance` + team-wide trainer `critChance`, in percent).

### 3. Trainer level (`src/entities/progression/model/`)

- `xpToNextTrainerLevel(level)` = `economy.trainer.xpToNext.base + economy.trainer.xpToNext.perLevel × (level − 1)`.
- `addTrainerXp(save, amount)` → `{ save, levelsGained, unlocks }`: carries overflow, stops at `economy.trainer.maxLevel` (xp 0 there), adds 1 to `trainer.talentPoints` for every level reached that is ≥ `economy.trainer.talentPointsFromLevel`. `unlocks` = concatenated `unlocksAt(level)` of every level gained.
- `teamSlots(level)` from `economy.trainer.teamSlots` (first entry, sorted desc, whose `level` ≤ trainer level).
- `unlocksAt(level)` → a typed list for the level-up dialog and the trainer timeline, e.g. `{ kind: 'teamSlot'; slots } | { kind: 'dailyQuests' } | { kind: 'greatCapsules' } | { kind: 'talentPoint'; count } | { kind: 'trainerTalent'; id }` — derived only from `economy.trainer` and `TRAINER_TALENTS[].requiresLevel`. The dialog lists "Team slot 2 · Daily quests · 1 talent point"; a level with nothing else still yields the talent point.

### 4. Battle rewards (`src/entities/progression/model/`)

- `grantReward(save, reward: Reward)` (`Reward` from economy.ts): adds capsules per tier and dust; dust gets the trainer `dustPercent` bonus (floor).
- `applyBattleResult(save, { stage: number | 'intro', won, damageDealt, teamIds, now })` → `{ save, summary }`:
  - **Numbered stage, win:** trainer XP `economy.battle.trainerXp.base + perStage × stage`; each owned team member gets `economy.battle.pokemonXp.base + perStage × stage` (+ trainer `xpPercent`); every other owned Pokémon (bench) gets `floor(teamXp × (economy.pokemon.benchXpShare + benchXpPercent/100))`. Loss: both XP values × their `lossShare` (floor), no stage rewards. Ids in `teamIds` that are not in `save.collection` get nothing.
  - **First clear** (`stage === ladder.cleared + 1`): `economy.battle.firstClear` via `grantReward`, `ladder.cleared = stage`, `stageCleared` event. **Replay win** (`stage ≤ ladder.cleared`): `ladder.replayWins + 1`; at `economy.battle.replayCapsuleEveryWins` give 1 basic capsule and reset to 0. A stage above `cleared + 1` or outside `1..economy.battle.ladderStages` is a programming error: throw.
  - **Bonus capsule** (trainer `capsuleChance`, wins only): roll once with `createRng(hashSeed(save.meta.seed, 'battle-bonus', save.meta.battleIndex))()` — never `Math.random()`.
  - **`'intro'`:** grant `economy.onboarding.introReward` only (no XP, the loaner isn't owned). Don't touch `save.onboarding` (owned by the wave-2 streams).
  - Always: `meta.battleIndex + 1`, `meta.battlesSinceExport + 1`; Pokémon level-ups via `addPokemonXp`, trainer via `addTrainerXp`.
  - Events: `battleWon`/`battleLost`, `stageCleared` (first clear), `damageDealt { amount }` (when > 0), one `pokemonLeveled` per level gained, one `trainerLeveled` per level gained; apply them with `applyGameEvents` from `@/entities/save` before returning (it runs whatever reducers SaveProvider registered — none in your unit tests unless you register `questEventReducer` yourself).
  - `summary` (export its type, e.g. `BattleSummary`) holds everything the result overlay and level-up dialog show: outcome, stage, first clear yes/no, trainer XP / from → to level / talent points gained / unlocks, per Pokémon (speciesId, XP, from → to level, bench flag, at-cap flag, talent points gained), capsules per tier, dust, replay progress (`replayWins` of `replayCapsuleEveryWins`), and the events.

### 5. Daily quests (`src/entities/quest/`)

- `questDay(now)` → `YYYY-MM-DD` of the local date of `now − economy.quests.refreshHour` hours. `nextRefreshAt(now)` → ms of the next local `refreshHour`. In tests build times with the local `new Date(y, m, d, h)` constructor so they pass in any time zone.
- `refreshQuests(save, now)`:
  - Clock guard: if `now < save.meta.maxSeenTime`, return the save unchanged (no punishment, no error); otherwise set `meta.maxSeenTime = now`.
  - Locked while `trainer.level < economy.trainer.unlocks.dailyQuests`: issue nothing.
  - For each quest day after `quests.lastIssuedDay` up to today — but at most the last `economy.quests.maxStockDays` days — issue `economy.quests.dailyCount` distinct quests from `economy.quests.pool`, picked with `createRng(hashSeed(save.meta.seed, 'quests', day))` (`progress 0`, `target` from the pool, `day`, `claimed false`), and set `lastIssuedDay`.
  - Drop quests that are claimed from earlier days or whose `day` is `maxStockDays` or more days before today (so at most `dailyCount × maxStockDays` live quests).
  - Same `now` twice → same result (idempotent).
- `questEventReducer(save, event)`: the `GameEventReducer` (type in `src/entities/save/model/events.ts`) that SaveProvider will register — **export it as `questEventReducer`; do not register it yourself** (the orchestrator wires it after merge). It advances every unclaimed, unfinished active quest whose pool entry's `kind` equals `event.kind`: `damageDealt` by `amount`, everything else by 1, clamped at `target`. Return the same object when nothing changed.
- `claimQuest(save, questId, day)` (the schema has no unique quest key: identify a quest by pool `id` + `day`) → `{ ok: true, save, reward, trainerXp, levelsGained, unlocks } | { ok: false, reason }`: only finished, unclaimed quests; grants the pool reward via `grantReward` plus `economy.quests.trainerXp` via `addTrainerXp`, marks it claimed, and applies `trainerLeveled` events with `applyGameEvents`.
- Small selectors for the home screen are welcome (e.g. quest view rows with pool data, "quests locked", "all claimed").

### 6. Tests (next to the code, node environment)

XP curves (a known growth rate, rounding, ≥ 1), level cap per star and XP stopping at the cap, multi-level overflow, stat formula against a known Pokémon (Pikachu #25 Lv 50, IV 31, neutral → HP 110, Attack 75, Speed 110; adamant → Attack 82, Sp. Atk 63; matches `statsAtLevel`), talents (tier order, points, reset refunds, trainer level/prerequisite rejections), trainer XP and team slots at Lv 1/3/5/10, rewards for first clear vs replay (capsule on the Nth replay win) vs loss vs intro, bench share with and without the talent, events emitted, quest issuing (count, determinism per seed/day), stocking cap after days away, refresh hour boundary, clock going backwards (nothing changes), reducer progress, claim (reward + trainer XP, double claim rejected).

## Context

- Project goal: turn Trainer Studio into a free single-player collection auto-battler: capsules, Pokémon and trainer levels, deterministic 3D card battles on a PvE ladder; progress lives in IndexedDB, no server, no money.
- Read first: `CLAUDE.md`, `docs/plan/PLAN.md` (contracts + who owns what), `docs/product/idea.md` (Must #4–#7), `docs/product/design.md`, `src/entities/battle/model/stats.ts`.
- Contracts you build against (do NOT modify): `src/entities/save/model/schema.ts` (`Save`, `OwnedPokemon`, `Quest`, `NATURES`), `src/entities/save/model/store.ts`, `src/entities/save/model/events.ts` (`GameEvent`, `GameEventReducer`, `registerGameEventReducer`, `applyGameEvents`), `src/entities/save/index.ts` (`src/entities/save/persistence/**` belongs to stream 1-save — don't edit or import it), `src/shared/config/economy.ts` (`economy`, `NATURE_MULTIPLIER`, `IV_MAX`, `Reward`, `QuestKind`, `CapsuleTier`), `src/shared/lib/rng.ts` (`createRng`, `hashSeed`), `src/entities/pokemon/model/species.ts` + `art.ts` + `src/entities/pokemon/index.ts` (`getSpecies`, `growthTotalXp`, `Species`, `StatKey`), the exported types in `src/entities/progression/model/talents.ts`, `src/app/providers/SaveProvider.tsx` (registers reducers after merge), `app/layout.tsx`. Save access in app code goes through `useSave`/`updateSave`/`replaceSave`; your functions are the pure `fn` passed to `updateSave`.
- Stubs prepared for you: `src/entities/progression/index.ts`, `src/entities/progression/model/talents.ts` (empty `POKEMON_TALENTS` / `TRAINER_TALENTS` to fill). `src/entities/quest/` does not exist yet: create it with `index.ts` as its public API.
- Design (if `docs/product/design.md` exists): this stream implements no screens, but your data feeds screens `battle` (result overlay), `level-up`, `trainer`, `creature`, `home` (trainer strip, quests, "Daily quests unlock at Trainer Lv 2", "New quests in 5 h", "Quests refill at 06:00") and flow `loop` — read them so what you return covers every element and state listed there.

## You own (edit ONLY these paths)

- `src/entities/progression/**` (including `src/entities/progression/model/*.test.ts` beside the code)
- `src/entities/quest/**` (including `src/entities/quest/model/*.test.ts` beside the code)
- Tests for what you own, where the project's CLAUDE.md puts tests: Next.js — next to the file (e.g. `src/entities/progression/model/rewards.test.ts` beside `rewards.ts`)

## Environment notes

- GitHub: if `gh` says the repo is not found, the active gh account is a different one. Run that one command with the owner's token: `GH_TOKEN="$(gh auth token --user edgergard)" gh pr create --repo edgergard/trainer-studio ...`. Never run `gh auth switch`.
- Env: no env file — use mocks/defaults. In the report, say whether you exercised the real services or mocks.
- Browser checks (web): `npm run dev` may return 500 from background shells on Windows (Turbopack CSS worker). Use `npm run build` then `npx next start --port 3104`, and drive it with the project's Playwright CLI: `npx playwright cli open http://localhost:3104`, then `snapshot` / `click` / `screenshot` (see `.claude/skills/playwright-cli`; it uses the installed Chrome — don't install browsers). Close only your own browser with `npx playwright cli close` and stop the `next start` you launched when done; never `kill-all` or `close-all` (they hit other streams' browsers). Don't install global tools; if the browser can't run, say so in the report — the orchestrator smoke-tests in Phase 5.

## Known pitfalls

- Never chain checks through a pipe before commit: run `npm run check`, test its exit code, commit only on 0 (L-024)
- Every persisted key is declared in the save schema contract; you can't add keys — escalate (L-027)
- Run `prettier --write` on files you edit before committing; `format:check` is part of `npm run check` (L-014)

## You must NOT

- Edit files outside your ownership — including package.json, lockfile, root layout, route registry, env schema, contracts, CI, `.claude/`, `docs/plan/`.
- Add dependencies (escalate instead).
- Merge into `dev`, force-push, `git reset --hard`, or touch other `stream/*` branches.
- Rebase after your branch has been pushed (use `git merge` instead).

## Escalation

If you need a contract change, a shared-file edit, a new dependency, or you are blocked: stop, commit what you have, push (GitHub mode), and finish your turn with the standard report using `STATUS: escalation` and an `ESCALATION:` line saying exactly what you need and why. Do not work around it. The orchestrator will change `dev` and tell you to integrate it.

## Acceptance criteria

- [ ] `src/entities/progression/index.ts` exports `xpToNextLevel`, `levelCap`, `addPokemonXp`, `computeStats`, `talentPointsAvailable`, `POKEMON_TALENTS` (12 nodes), `TRAINER_TALENTS` (~15 nodes), `learnPokemonTalent`, `resetPokemonTalents`, `learnTrainerTalent`, `resetTrainerTalents`, `talentModifiers`, `xpToNextTrainerLevel`, `addTrainerXp`, `teamSlots`, `unlocksAt`, `applyBattleResult`, `grantReward` and their result types
- [ ] `src/entities/quest/index.ts` exports `questDay`, `refreshQuests`, `questEventReducer`, `claimQuest`, `nextRefreshAt` and their result types
- [ ] All functions are pure, take every number from `economy.ts`, roll only through `hashSeed`/`createRng`, and never write keys outside the save schema
- [ ] Stats equal the Gen III formula (Pikachu Lv 50 check) and change with level, nature and talents; XP stops at the star level cap
- [ ] First clear, replay, loss and intro give exactly the economy.ts rewards, and the summary lists every value the result screen shows
- [ ] Daily quests unlock at trainer Lv 2, stock up to `maxStockDays`, and a clock moved back changes nothing
- [ ] Tests cover XP curves, caps, stat formula, talent validation, battle rewards, quest stocking and the clock guard
- [ ] `npm run check` passes in this worktree
- [ ] UI (if any): uses design tokens, `cursor: pointer` / accessibility labels, visible focus, works at mobile and desktop widths (web) or light/dark (Expo)
- [ ] If you run a dev server, use your port: `npm run dev -- --port 3104` (web). Stop it when done.

## Definition of done

1. All acceptance criteria met; `npm run check` passes.
2. Get the latest `dev`:
   - before your first push: `git fetch origin && git rebase origin/dev`;
   - after your branch has been pushed: `git fetch origin && git merge origin/dev` (never rebase).
     Then `npm ci` if package-lock.json changed, and re-run `npm run check`.
3. Conventional commits, only files in your ownership.
4. GitHub mode: `git push -u origin stream/1-progression`, then `gh pr create --base dev` (body: what changed / how to verify). Do NOT merge it. Later pushes: plain `git push`.
5. Finish your turn with the report below. If the orchestrator later sends feedback, fix it, re-run checks, push, and report again in the same format.

## Report format (your final message)

STATUS: done | partial | escalation
BRANCH: stream/1-progression PR: <url or none> HEAD: <short sha>
ESCALATION: <need + why — only when STATUS is escalation>
DONE: <bullets>
NOT DONE / KNOWN ISSUES: <bullets>
CHECKS: <command → result>
FILES CHANGED OUTSIDE OWNERSHIP: none | <list with reason>
