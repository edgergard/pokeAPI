# Stream 2-play: ladder, battle loop, team and level-up

You are one of several agents building Trainer Studio in parallel. Each agent works in its own git worktree and branch. The orchestrator reviews your branch and merges it into `dev`.

## Your branch

`stream/2-play` (already checked out in this worktree, based on `dev`).
Mode: GitHub remote `origin` (repo `edgergard/trainer-studio`).
Your dev-server port: 3202.

## Setup (do first)

1. `npm ci` (never `npm install`). If package-lock.json then shows as modified, `git checkout -- package-lock.json`.
2. Run `npm run check` once to confirm a green baseline. If it is red before you changed anything, report `STATUS: escalation`.
   Run `npm ci` again whenever integrating `dev` changes package-lock.json.

## Task

Build the core play loop (idea.md Must #1 battle part, #5 team gates, #6 ladder): the player picks a ladder stage, sees the rival, fights with their own collection (N×N, 1–4 by trainer level), gets rewards committed once, levels up, and goes to the next stage in two clicks. The onboarding intro battle (`/battle/?stage=intro`) ends with the first capsule and the first Pokémon in the team. Five parts, bottom-up:

1. **Pure domain — `src/entities/ladder`** (no React, no store access).
   - `economy.battle.ladderStages` (25) stages, generated deterministically with no runtime randomness: each stage's draws come from one `createRng(hashSeed('ladder', stage))` stream (`src/shared/lib/rng.ts`) — the ladder is the same for every player and every reload. Never `Math.random()`.
   - Rival team size grows with the stage the same way the player's team slots grow (1 early → 4 late, like `economy.trainer.teamSlots`). Rival level per stage from `economy.battle.rivalLevel` (`start + perStage × (stage − 1)`), clamped to `economy.pokemon.maxLevel`. Species drawn (`speciesOfRarity`, `src/entities/pokemon`) from rarities that scale with the stage (commons early, epic/legendary only late), no duplicate species within one rival team.
   - Use `economy.battle.rivalTeamSize` and `economy.battle.rivalRarities` (added on dev before launch; lookup rule: the last entry whose `fromStage <= stage`). Escalate only if you need different values.
   - ORIGINAL rival names (an invented first + last name list inside the slice, e.g. "Juniper Vale" from design.md); no canon characters (no Ash, Misty, Gary, gym leaders, Champions, etc.). Names picked from the same seeded stream.
   - First-clear reward preview per stage from `economy.battle.firstClear` (capsules + dust) and the win XP from `economy.battle.trainerXp` / `economy.battle.pokemonXp` (same formula `applyBattleResult` uses).
   - API (export from `src/entities/ladder/index.ts`): `stageInfo(stage)` (stage number, rival name, rival members `{ speciesId, level, stars }`, first-clear reward, XP preview; throws `RangeError` outside 1..ladderStages), `allStages()`, a stage status helper from the save (`cleared` / `current` / `locked`, from `save.ladder.cleared`), a "next stage to fight" helper (`ladder.cleared + 1` capped at `ladderStages`), and a pure team-power helper used for "Recommended power vs yours" (e.g. sum of battle stats; same function for rival and player).
   - Rival fighter stats: rivals are not owned, so use `statsAtLevel(species.stats, level)` from `@/entities/battle` (IV 31, no nature) or `computeStats` with a fixed neutral `OwnedPokemon`-like input — pick one and use it everywhere.
   - Unit tests incl. determinism (same stage → same rival across calls), team size never decreasing with the stage, sizes within 1..4, levels follow `economy.battle.rivalLevel`, rarities respect the stage table, names never empty and not canon.
2. **Ladder page — `src/views/ladder`** (replace the stub `LadderPage`; design.md screen `ladder`, component `LadderPath`). Renders its own `<main id="content">` with one `h1` "Ladder".
   - "Stage 7 / 25 cleared"; vertical node path as a list of real `<button>`s: cleared (✓), current (`aria-current="step"`, glowing), locked (`aria-disabled="true"` with "Clear stage 6 first"); arrow keys move between nodes. Selecting a cleared node is allowed (replay for XP).
   - Selected-node panel: rival name, rival team (art via `CreatureArt` from `@/widgets/capsule-reveal` — a view may import widgets — or `getCreatureArt`), Lv, ★; recommended power vs yours; first-clear reward (or "Cleared · replay for XP" + replay streak `ladder.replayWins / economy.battle.replayCapsuleEveryWins`).
   - Primary "Fight" → `next/link` to `/battle/?stage=N` (literal path with trailing slash; `href()` in `src/shared/lib/router.ts` only knows `/` and `/battle`, so `href('/battle', { stage: String(n) })` works too). When the team has fewer Pokémon than `teamSlots(trainer.level)` and the collection has more to add, primary becomes "Fill team" (opens the TeamDialog). Secondary "Edit team".
   - States, copy verbatim: loading skeleton (`useSaveStatus().status === 'loading'`), error "Couldn't load stages. Reload", locked node "Clear stage 6 first", all cleared "Ladder complete. Replay any stage for XP and capsules.", empty slots → "Fill team".
   - Battle redirects here for a locked/invalid stage. There is no toast component in `src/shared/ui`: redirect with `router.replace('/ladder/?locked=N')` (or `?invalid=1`) and show "Stage locked" in a `role="status"` region on the ladder (read the param with `useSearchParams` inside a component rendered after `useHydrated()`).
   - Before onboarding is done (`save.onboarding.step !== 'done'`) → `router.replace('/')`.
3. **Battle page — `src/views/battle`** (`/battle/?stage=N` | `?stage=intro`; design.md screen `battle`, flows `first-visit` steps 3–5 and `loop`). Rewrite `BattlePage.tsx`; keep it a default export named `BattlePage` (`app/battle/page.tsx` imports `@/views/battle/BattlePage` and is not yours). It renders its own `<main id="content">` with one `h1` (the stage title, e.g. "Stage 7 · Rival Juniper Vale", "First battle" for the intro). Keep and reuse `BattleAmbient` / `ambient.ts`.
   - Read `?stage` with `useSearchParams` only in a child component rendered after `useHydrated()` is true — never `<Suspense>` for this. Before hydration render a same-size placeholder. Validate: integer 1..`economy.battle.ladderStages` and ≤ `save.ladder.cleared + 1`, or `intro`; otherwise redirect to the ladder as above. Deep links before onboarding is done → `/` (except `?stage=intro` while the step is `dealt`, `fought` or `capsule`).
   - **Phase 1 — preview:** "Back to ladder", stage title, your N vs rival N cards (N = rival team size for the rival, your `save.team` for you) with Lv / ★ / talent icons via `FighterBadges` (`@/widgets/battle-arena`), "Fight" focused on mount, Enter starts. Secondary "Edit team" (TeamDialog). If `save.team` is empty, primary is "Fill team".
   - **Fighters from the save:** for each team species, `getSpecies(id)` + `save.collection[String(id)]`; stats via `computeStats(species, owned)`, modifiers via `talentModifiers(owned, save.trainer.talents)` mapped `critChance → critChanceBonus`, `firstStrike → firstStrike`; badges `{ stars: owned.stars, talentIcons: learnedTalentBranches(owned.talents) }`; moves via `buildTeam` / `buildFighter` with `await loadMovesets()` (`@/entities/battle`). Rival side from `stageInfo(stage)`. The two teams may differ in size if the engine allows it — check `assertTeamSizes` / `MIN_TEAM_SIZE` / `MAX_TEAM_SIZE` in `@/entities/battle`; if the engine requires equal sizes, follow it and say so in the report.
   - Seed: `hashSeed(save.meta.seed, 'battle', save.meta.battleIndex)` computed once when the battle starts (same seed for Replay). No `Math.random()` (the old page used it — remove).
   - **Phase 2 — arena:** lazy `BattleArena` from `@/widgets/battle-arena` (keep the existing `lazy()` + `ErrorBoundary` + "Preparing arena" fallback pattern). Props: `red`, `blue`, `seed`, `intro` (only for `stage=intro`), `onFinished`, `renderResult`, `resultMessage` (e.g. "Victory. 1 capsule earned."). Do not pass `onNewBattle` (legacy).
   - `onFinished(result)` commits rewards ONCE: inside one `updateSave((s) => …)` call `applyBattleResult(s, { stage, won: result.winner === 'red', damageDealt: result.redDamageDealt, teamIds, now: Date.now() })` and return its `save`; capture the `summary` for the UI. `applyBattleResult` already runs `applyGameEvents` on its events — do NOT apply `summary.events` a second time. Guard with a ref so Replay/Motion rebuilds/StrictMode never commit twice; leaving mid-battle commits nothing (design.md loop step 2). It throws `RangeError` on a locked stage: validate before the battle instead.
   - **Phase 3 — result** (`renderResult`, an `absolute inset-0` overlay inside the arena that focuses its primary button on mount; visual reference `docs/product/prototype/battle.dc.html`): outcome "Victory · First-clear bonus" / "Victory" / "Defeated. Try a stronger lineup."; trainer XP bar; XP bar per team Pokémon (`summary.pokemon`, from/to level and XP, "Lv up", "+1 talent point", "Level cap" when `atCap`), bench share line; capsules and dust granted; quest ticks (diff `questRows` before/after the commit, or read the `battleWon`/`stageCleared`/`damageDealt` progress from the save; any `questBoard` call gets a fresh `Date.now()` at call time); replay streak for replays. Primary: "Next stage" (win, links to the next stage preview; on the last stage "Back to ladder"), "Retry" (loss) with ONE suggestion: a bench Pokémon higher level than a team member → "<Name> is Lv 12 on the bench → Put in team" (opens TeamDialog) or unspent Pokémon talent points (`talentPointsAvailable`) → "Spend 1 talent point" (link `/creature/?id=N`); secondaries "Edit team", "Open capsules (n)" (`/capsules/`), "Ladder". Announce the result in one phrase via `resultMessage`.
   - **Level-up:** when `summary.trainer.levelsGained > 0`, open the LevelUp dialog over the result (part 5).
   - **Intro (`?stage=intro`):** loaner = `save.onboarding.loanerSpeciesId`, rival = `save.onboarding.rivalSpeciesId` (both set by stream 2-home on the deal step; if either is null → `/`). Build both sides exactly as 2-home's deal step does (the two streams share only these save fields, never code): `buildTeam` with levels `economy.onboarding.loanerLevel` / `economy.onboarding.rivalLevel`, stats via `statsAtLevel(species.stats, level)`, badges `{ stars: 1, talentIcons: [] }`, no talents. Seed via `findIntroSeed(red, blue)`; on `IntroSeedError` deterministically re-pick the rival with the same k-loop as 2-home: candidates = `speciesOfRarity('common')` with `movesFor(movesets, s.slug).length > 0` and `bst <= loaner.bst` (in `speciesOfRarity` order), for k = 0, 1, 2, … up to a local `RIVAL_PICK_LIMIT` take `candidates[Math.floor(createRng(hashSeed(save.meta.seed, 'rival', k))() * candidates.length)]` until `findIntroSeed` succeeds, then write that id back to `save.onboarding.rivalSpeciesId` with `updateSave` (none found → show the arena error state with a link to `/`). `onFinished` on the win: in one `updateSave`, only when `s.onboarding.step === 'dealt'`, apply `applyBattleResult(s, { stage: 'intro', … })` (grants `economy.onboarding.introReward`) and set `onboarding.step = 'fought'` — a reload never pays twice. Result primary "Open capsule" → `useOpenCapsule().openOne('basic')` (`@/features/open-capsule`) then `CapsuleReveal` (`@/widgets/capsule-reveal`, `primaryLabel="Add to team"`) and, right after `openOne` returns `ok` (it commits the pull itself), set step `capsule` in a second `updateSave`; open error → "Couldn't open. Try again". "Add to team" → one `updateSave`: `team = [that species]` (the loaner leaves) and step `done`; then `requestPersist()` (`@/entities/save`, from this click) and `router.push('/')`. Reload resume: step `fought` shows the result with "Open capsule" without re-fighting (if `save.capsules.basic === 0` and the collection is not empty, treat it as `capsule`); step `capsule` shows the first owned Pokémon (the collection entry with the lowest `obtainedAt`) with "Add to team" — the same rules 2-home's Home uses for these steps. No WebGL → the arena's text fallback runs the same flow.
4. **`src/widgets/team-dialog`** — `TeamDialog` (design.md screen `team`, component `TeamDialog`) on `src/shared/ui/Dialog`, title "Team". Props: `open`, `onClose`, optional `highlightSlot` (newly unlocked slot pulses), `onSaved`.
   - "2 / 3" counter; `teamSlots(save.trainer.level)` open slots, locked slots show "Unlocks at Trainer Lv 5" (`teamSlotUnlockLevel`) and are labelled "Slot 3, unlocks at Trainer level 5"; empty slot "Tap a Pokémon below"; team power; list of owned Pokémon (art via `getCreatureArt` — not the `CreatureArt` widget —, name, Lv, ★, filter `<input>` with a label, sort by level) — tap adds to the first empty slot; Remove from slot.
   - Reorder: click-swap and keyboard Alt+ArrowLeft/Right with a live announcement, like `useSlotReorder` in `src/widgets/team-showcase/useSlotReorder.ts` — read it and copy the idea into this widget; don't import it (another stream owns team-showcase, widgets don't import widgets).
   - "Auto-fill strongest" (team power helper from `@/entities/ladder`), primary "Save team" → `updateSave((s) => ({ ...s, team }))` with 1..slots ids; only 1 owned → "Open capsules to grow your roster"; write failure → "Couldn't save the team. Try again" keeping the selection. Focus returns to the opener on close.
   - Export `TeamDialog` from `src/widgets/team-dialog/index.ts` (home and creature may reuse it later).
5. **`src/widgets/level-up`** — `LevelUpDialog` (design.md screen `level-up`) on `Dialog`, title "Trainer Lv 3" (`aria-labelledby` comes from Dialog). Props: the `TrainerBattleResult` (or `toLevel` + `unlocks`), `open`, `onClose`, `onFillSlot(slot)`.
   - Unlock list from `summary.trainer.unlocks` (`unlocksAt` per level): "Team slot 2 · Daily quests · 1 talent point"; a level with no unlocks shows "+1 talent point"; a celebratory burst of your own (respect reduced motion via `usePrefersReducedMotion()`; don't import `LockInBurst`).
   - Contextual primary, focused on open: "Fill slot N" (team slot unlocked → `onFillSlot(N)`; the battle view then opens TeamDialog with that slot pulsing) / "See quests" (daily quests unlocked → `/`) / "Learn talent" (talent point → `/trainer/`); secondary "Later".
   - Widgets never import other widgets: the battle view composes BattleArena, TeamDialog, LevelUpDialog and CapsuleReveal.
6. **Delete `src/features/battle-setup/**`** once the new battle page no longer uses it (old Red/Blue setup, presets, dice rival, `?red` param, `usePrepareBattle`), plus the old BattlePage parts only it needed (`SetupWithQuery`, `SetupPlaceholder`). Grep for other importers first; `legacyHashTarget` in `src/shared/lib/router.ts` may still forward `?red` — not yours, leave it.

## Context

- Project goal: turn Trainer Studio into a free, single-player collection auto-battler — open capsules, level up Pokémon and the trainer, fight a PvE ladder in 3D; no money, no accounts, no server, progress in IndexedDB.
- Read first: `CLAUDE.md`, `docs/plan/PLAN.md` (contracts + who owns what), `docs/product/idea.md` (Must #1, #5, #6), `docs/product/design.md` (screens `ladder`, `battle`, `team`, `level-up`; flows `first-visit` steps 3–5 and `loop`; Components `LadderPath`, `BattleArena`, `TeamDialog`, `HoloCard`; Tokens; Accessibility), `docs/product/prototype.md`, `src/shared/ui/*` (Button, Dialog, ErrorBoundary, Field, Spinner, Spotlight), `src/shared/lib/motion.ts`, `src/shared/lib/useHydrated.ts`, `src/widgets/team-showcase/**` (read only), `src/widgets/battle-arena/ui/BattleArena.tsx` (props doc), the current `src/views/battle/BattlePage.tsx` and `src/features/battle-setup/**`.
- Contracts you build against (do NOT modify):
  - `src/entities/save/index.ts` (import only from here): `useSave`, `useSaveStatus`, `getSave`, `updateSave`, `replaceSave`, `applyGameEvents`, `isStorageAtRisk`, `useSaveConflict`, `requestPersist`, `usePersistState`, `createNewSave` (test saves), types `Save`, `OwnedPokemon`, `OnboardingStep`, `GameEvent`. Schema `src/entities/save/model/schema.ts` (`onboarding.step` hero/dealt/fought/capsule/done, `loanerSpeciesId`, `rivalSpeciesId`; `team` ≤ 4; `ladder.cleared`, `ladder.replayWins`; `meta.seed`, `meta.battleIndex`). Tests reset the store with `__resetSaveStoreForTests` from `@/entities/save/model/store`.
  - `src/entities/progression/index.ts`: `applyBattleResult`, `BattleSummary`, `TrainerBattleResult`, `PokemonBattleResult`, `computeStats`, `talentModifiers`, `learnedTalentBranches`, `teamSlots`, `teamSlotUnlockLevel`, `unlocksAt`, `TrainerUnlock`, `addTrainerXp`, `xpToNextTrainerLevel`, `xpToNextLevel`, `levelCap`, `talentPointsAvailable`.
  - `src/entities/quest/index.ts`: `questRows`, `questBoard(save, now)`, `refreshQuests(save, now)`.
  - `src/entities/capsule/index.ts` (`RARITY_LABEL`, `RARITY_TEXT_CLASS`, `rarityRank`), `src/features/open-capsule/index.ts` (`useOpenCapsule` → `openOne(tier)` returns `OpenCommit`), `src/widgets/capsule-reveal/index.ts` (`CapsuleReveal` with `results`, `open`, `onClose`, `primaryLabel`, `onPrimary`; `CreatureArt`).
  - `src/entities/battle/index.ts`: `buildFighter`, `buildTeam`, `TeamMemberSpec`, `loadMovesets`, `movesFor`, `simulateBattle`, `assertTeamSizes`, `MIN_TEAM_SIZE`, `MAX_TEAM_SIZE`, `statsAtLevel`, `findIntroSeed`, `IntroSeedError`, types `BattleTeam`, `BattleResult`, `Fighter`, `FighterBadges`. `src/widgets/battle-arena/index.ts`: `BattleArena` (props `red`, `blue`, `seed`, `intro`, `onFinished`, `renderResult`, `resultMessage`), `FighterBadges`, `INTRO_SKIP_DELAY_SECONDS`.
  - `src/entities/pokemon/index.ts`: `getSpecies`, `allSpecies`, `speciesOfRarity`, `Species` (`bst`, `rarity`, `slug`), `getCreatureArt`.
  - `src/shared/config/economy.ts`: `economy.battle.*` (ladderStages, rivalLevel, firstClear, trainerXp, pokemonXp, replayCapsuleEveryWins), `economy.onboarding.*`, `economy.trainer.teamSlots`, `economy.pokemon.maxLevel`, `RARITIES`. `src/shared/lib/rng.ts` (`createRng`, `hashSeed`). `src/shared/lib/router.ts` (`href`).
  - `app/layout.tsx` (skip link; AppNav), `app/battle/page.tsx`, `app/ladder/page.tsx` (render your views; metadata there is not yours — if `app/battle/page.tsx`'s old "Pick two Pokémon teams" description needs updating, list it in the report), `src/app/providers/SaveProvider.tsx`.
- Stubs prepared for you: `src/views/ladder/LadderPage.tsx`, `src/views/ladder/index.ts`; existing `src/views/battle/BattlePage.tsx` to rewrite.
- Other wave-2 streams in parallel: 2-home (home, app-nav, team-showcase, sets `onboarding.step` hero → dealt with loaner/rival ids and links to `/battle/?stage=intro`), 2-collection (collection, creature, trainer). Don't edit their paths; to test the intro locally, seed `onboarding` from a test or a temporary uncommitted path.
- Design (`docs/product/design.md`, `ui-language: en`): implement screens `ladder`, `battle`, `team`, `level-up` and flows `first-visit` steps 3–5 and `loop` exactly as specified there — every listed state, copy verbatim (in its `ui-language`), per-screen accessibility notes, components from its Components table. Visual reference: `docs/product/prototype/battle.dc.html` for the battle result — match its layout and hierarchy with the template's primitives and theme; design.md wins where they differ; don't copy the HTML into the app. Ladder, team and level-up were not prototyped: build them in the same style.

### Rules (all streams)

- Contracts are read-only: if one blocks you, escalate.
- Every game number comes from `src/shared/config/economy.ts`; no magic numbers.
- Randomness only via `hashSeed` / `createRng`; never `Math.random()`.
- Art only via `getCreatureArt` / `CreatureArt`.
- Save only via `useSave` / `updateSave`; apply returned `GameEvent`s with `applyGameEvents` inside the same `updateSave` (exception: `applyBattleResult` already applies its own events — don't apply them again).
- Each view renders its own `<main id="content">` with exactly one `h1`.
- Query params via `useSearchParams` only inside a component rendered after `useHydrated()` — never `<Suspense>`.
- Widgets never import other widgets; compose them in views.
- Tests beside the code; component tests start with `// @vitest-environment jsdom`.
- `refreshQuests` / `questBoard` always get a fresh `now` (`Date.now()` at call time), never a value captured at mount.

## You own (edit ONLY these paths)

- `src/views/battle/**` (incl. `src/views/battle/**/*.test.ts(x)`)
- `src/views/ladder/**` (incl. `src/views/ladder/**/*.test.tsx`)
- `src/entities/ladder/**` (incl. `src/entities/ladder/**/*.test.ts`)
- `src/widgets/team-dialog/**` (incl. `src/widgets/team-dialog/**/*.test.tsx`)
- `src/widgets/level-up/**` (incl. `src/widgets/level-up/**/*.test.tsx`)
- `src/features/battle-setup/**` (delete it, with its tests, once unused)
- Tests sit next to the file they test (`stages.test.ts` beside `stages.ts`). Vitest globals are off (import `describe`, `it`, `expect`); component tests start with `// @vitest-environment jsdom`.

## Environment notes

- GitHub: if `gh` says the repo is not found, the active gh account is a different one. Run that one command with the owner's token: `GH_TOKEN="$(gh auth token --user edgergard)" gh pr create --repo edgergard/trainer-studio ...`. Never run `gh auth switch`.
- Env: no env file — use mocks/defaults. In the report, say whether you exercised the real services or mocks.
- Browser checks (web): `npm run dev` may return 500 from background shells on Windows (Turbopack CSS worker), and `next start` does not work with static export. Use `npm run build` then `npm run preview -- 3202` (it runs `node scripts/serve-out.mjs 3202`; you may run that directly), and drive it with the project's Playwright CLI: `npx playwright cli open http://localhost:3202`, then `snapshot` / `click` / `screenshot` (see `.claude/skills/playwright-cli`; it uses the installed Chrome — don't install browsers). Close only your own browser with `npx playwright cli close` and stop the preview you launched when done; never `kill-all` or `close-all` (they hit other streams' browsers). On Windows stopping the npm task leaves the child `node scripts/serve-out.mjs 3202` listening: find it with `Get-NetTCPConnection -LocalPort 3202` and stop only that PID, then confirm the port is free (L-050/L-051). Don't install global tools; if the browser can't run, say so in the report — the orchestrator smoke-tests in Phase 5.

## Known pitfalls

- Never chain checks through a pipe before commit: run `npm run check`, test its exit code, commit only on 0 (L-024).
- Persisted keys are fixed by the save schema contract; you can't add keys (e.g. no "last battle summary" or "seen level-up" flag) — escalate (L-027).
- jsdom tests can pass while the real DOM misses state: expose state with aria-* (`aria-current="step"`, `aria-disabled` locked nodes/slots, battle phase `data-phase`) and check it in the real DOM (L-007).
- Run `prettier --write` on files you edit before committing; `format:check` is part of `npm run check` (L-014).
- jsdom lacks `<dialog>.showModal` and `window.matchMedia`: copy the idea of `polyfillDom` from `src/widgets/capsule-reveal/ui/testDom.ts` into your own test helper — don't import it across slices (L-047).

## You must NOT

- Edit files outside your ownership — including package.json, lockfile, root layout, route registry, env schema, contracts, CI, `.claude/`, `docs/plan/`.
- Add dependencies (escalate instead).
- Merge into `dev`, force-push, `git reset --hard`, or touch other `stream/*` branches.
- Rebase after your branch has been pushed (use `git merge` instead).

## Escalation

If you need a contract change, a shared-file edit, a new dependency, or you are blocked: stop, commit what you have, push (GitHub mode), and finish your turn with the standard report using `STATUS: escalation` and an `ESCALATION:` line saying exactly what you need and why. Do not work around it. The orchestrator will change `dev` and tell you to integrate it.

## Acceptance criteria

- [ ] `stageInfo` / `allStages` return 25 deterministic stages (seeded by `hashSeed('ladder', stage)`), rival team size 1 → 4 non-decreasing, rival level from `economy.battle.rivalLevel`, rarities scaling by stage from economy keys, original rival names, first-clear reward preview; no `Math.random()` anywhere in your code.
- [ ] Ladder shows cleared / current / locked nodes (`aria-current="step"`, `aria-disabled` + "Clear stage N first"), arrow-key navigation, selected-node panel (rival team, recommended power vs yours, first-clear reward), "Fight" → `/battle/?stage=N`, "Fill team" when open slots are empty, the all-cleared copy, and "Stage locked" after a redirect.
- [ ] Battle runs preview → arena → result for `?stage=N`: fighters built from the save (`computeStats` + `talentModifiers` → `critChanceBonus`, badges via `FighterBadges`), rewards committed exactly once via `applyBattleResult` inside `updateSave` with `damageDealt` from the result (Replay/rebuild/StrictMode don't double-commit; events not applied twice), result shows XP bars, level-ups, talent points, capsules, dust, quest ticks; "Next stage" (win) / "Retry" + one suggestion (loss).
- [ ] Locked/invalid `?stage` redirects to the ladder with "Stage locked"; any deep link before onboarding is done goes to `/`.
- [ ] Intro: loaner vs rival from `save.onboarding`, levels from `economy.onboarding`, seed from `findIntroSeed` with the deterministic rival re-pick on `IntroSeedError` written back to the save; the win grants the intro reward once and sets step `fought`; "Open capsule" → reveal → step `capsule` → "Add to team" sets `team = [species]`, step `done`, navigates to `/`; a reload at `fought` or `capsule` resumes without re-fighting or re-granting.
- [ ] TeamDialog: 1..`teamSlots(level)` slots, locked slots with level, Alt+arrow swaps announced, Auto-fill strongest, Save team, copy and states from design.md `team`.
- [ ] LevelUpDialog appears on the result when trainer levels were gained, lists unlocks (`unlocksAt`), contextual primary (Fill slot N → TeamDialog with that slot pulsing / See quests / Learn talent → `/trainer/`), "Later", focus on the primary.
- [ ] `src/features/battle-setup` is deleted and nothing imports it; the battle page has its own `<main id="content">` and one `h1`.
- [ ] Tests cover the ladder generator (determinism, sizes, levels), stage validation/redirect logic, fighter building from a save, the single reward commit, the intro step machine (dealt → fought → capsule → done, reload resume, rival re-pick), TeamDialog (slots, locked, swap, save) and LevelUpDialog (unlock list, contextual primary).
- [ ] `npm run check` passes in this worktree
- [ ] UI (if any): uses design tokens, `cursor: pointer` / accessibility labels, visible focus, works at mobile and desktop widths (web)
- [ ] If you run a server, use your port: `npm run preview -- 3202` after `npm run build` (web). Stop it when done and check the port is free.

## Definition of done

1. All acceptance criteria met; `npm run check` passes.
2. Get the latest `dev`:
   - before your first push: `git fetch origin && git rebase origin/dev`;
   - after your branch has been pushed: `git fetch origin && git merge origin/dev` (never rebase).
     Then `npm ci` if package-lock.json changed, and re-run `npm run check`.
3. Conventional commits, only files in your ownership.
4. GitHub mode: `git push -u origin stream/2-play`, then `gh pr create --base dev` (body: what changed / how to verify). Do NOT merge it. Later pushes: plain `git push`.
5. Finish your turn with the report below. If the orchestrator later sends feedback, fix it, re-run checks, push, and report again in the same format.

## Report format (your final message)

STATUS: done | partial | escalation
BRANCH: stream/2-play PR: <url or none> HEAD: <short sha>
ESCALATION: <need + why — only when STATUS is escalation>
DONE: <bullets>
NOT DONE / KNOWN ISSUES: <bullets>
CHECKS: <command → result>
FILES CHANGED OUTSIDE OWNERSHIP: none | <list with reason>
