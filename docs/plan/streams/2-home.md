# Stream 2-home: home onboarding, hub, app nav and daily quests

You are one of several agents building Trainer Studio in parallel. Each agent works in its own git worktree and branch. The orchestrator reviews your branch and merges it into `dev`.

## Your branch

`stream/2-home` (already checked out in this worktree, based on `dev`).
Mode: GitHub remote `origin` (repo `edgergard/trainer-studio`).
Your dev-server port: 3203.

## Setup (do first)

1. `npm ci` (never `npm install`). If package-lock.json then shows as modified, `git checkout -- package-lock.json`.
2. Run `npm run check` once to confirm a green baseline. If it is red before you changed anything, report `STATUS: escalation`.
   Run `npm ci` again whenever integrating `dev` changes package-lock.json.

## Task

Build design.md screen `home` (onboarding states + hub), the Navigation (`AppNav`) and flow `first-visit` steps 1–2 and 6 — Must #1 (onboarding), #5 (trainer strip, team slots), #6 (daily quests) and the Must #2 backup reminder. A new visitor goes from the home page to a dealt loaner card and the intro battle in one click, comes back to an "Open your capsule" / "Add to team" prompt after the battle, and then lands on a hub that is their daily starting point. Four parts:

1. **Home onboarding — `src/views/home`** (driven by `save.onboarding.step`; every transition is one `updateSave`, so a reload resumes at the same step):
   - **`hero`**: one primary button "Fill my team with random Pokémon". On click:
     - Load the baked movesets with `loadMovesets()` (`@/entities/battle`, lazy chunk; show a busy state, and a retry message if the import fails).
     - Loaner: from `speciesOfRarity('common')` + `speciesOfRarity('uncommon')` (`@/entities/pokemon`) keep species with moves (`movesFor(movesets, species.slug).length > 0`), then pick one with `createRng(hashSeed(save.meta.seed, 'loaner'))` (`@/shared/lib/rng`). Never `Math.random()`.
     - Rival: candidates = `speciesOfRarity('common')` with moves and `bst <= loaner.bst` (in `speciesOfRarity` order); try k = 0, 1, 2, …: `candidates[Math.floor(createRng(hashSeed(save.meta.seed, 'rival', k))() * candidates.length)]`. Make sure the player can win: build both sides with `buildTeam` (loaner at `economy.onboarding.loanerLevel`, rival at `economy.onboarding.rivalLevel`, stats via `statsAtLevel(species.stats, level)` from `@/entities/battle` (IV 31, neutral, no talents — equal to `computeStats` with those inputs), badges `{ stars: 1, talentIcons: [] }`) and call `findIntroSeed(red, blue)`; on `IntroSeedError` go to the next k, up to a small named bound (a local constant `RIVAL_PICK_LIMIT`, not a game number; don't reuse the battle entity's `INTRO_SEED_SEARCH_LIMIT`, which bounds seeds, not rivals). Stream 2-play builds the intro with exactly the same teams and the same k-loop, so both sides agree. Put the pick in a pure, tested function (`src/views/home/model/dealOnboarding.ts` or similar) that takes the save and the movesets. Describe the exact build in the PR body: stream 2-play builds the intro battle from `onboarding.loanerSpeciesId` / `rivalSpeciesId` and the orchestrator aligns the two at merge.
     - Commit `onboarding: { step: 'dealt', loanerSpeciesId, rivalSpeciesId }` with `updateSave`.
   - **`dealt`**: the loaner card face up with a visible "Loaner" tag, "VS", the rival card; primary link "Fight" → `/battle/?stage=intro` (`next/link`, literal path with trailing slash, `prefetch`). On mount, warm the arena chunk with a fire-and-forget `import('@/widgets/battle-arena')` (catch errors). Live region (`role="status"`): "Loaner <name> joined your team"; focus moves to "Fight".
   - **`fought`** (the intro was won but the capsule wasn't opened here, e.g. after a reload; stream 2-play's battle result sets this step and grants `economy.onboarding.introReward`): primary "Open your capsule" → `useOpenCapsule().openOne('basic')` (`@/features/open-capsule`, it commits before returning), show `CapsuleReveal` (`@/widgets/capsule-reveal`) with the results and `primaryLabel="Add to team"`. Right after a successful open, set `onboarding.step` to `'capsule'` in an `updateSave`, so a reload shows the Add-to-team prompt instead of re-rolling. Open error → "Couldn't open. Try again". If the step is `fought` but `save.capsules.basic === 0` and the collection is not empty, treat it as `capsule`.
   - **`capsule`**: the same Add-to-team prompt for the first owned Pokémon (the collection entry with the lowest `obtainedAt`), card + "Add to team".
   - **Add to team** (from the reveal or the `capsule` prompt): one `updateSave` → `team: [speciesId]`, `onboarding.step: 'done'` (the loaner leaves). Then call `requestPersist()` (`@/entities/save`) once — it is memoised per page load, and calling it from this click gives Firefox the user gesture it wants. Then the hub renders.
   - **v1 players** (`save.meta.migratedFromV1` and step `done` on first load, still without progress: `capsulesOpened === 0` and `ladder.cleared === 0`): a one-time dismissible welcome line on the hub "Your v1 trainers were imported: N Pokémon added." (N = number of collection entries). No extra capsule (design.md's "Open welcome capsule" is dropped by the orchestrator). Dismissal lives in component state only — no new save or storage keys. Call `requestPersist()` once when the player dismisses it.
   - Loading: the `h1` "Trainer Studio" and the hero headline render at once (prerender); the action area is a skeleton until `useHydrated()` and `useSaveStatus().status === 'ready'`, so returning players never see the hero button flash.
   - Error (`useSaveStatus().status === 'error'`): "Restore backup" (`restoreBackup`), "Import file" (`readSaveFile` + `applyImport`) and "Start fresh" (`resetProgress`, after a confirmation) from `@/features/save-transfer`, with results announced in `role="status"` (reuse `TRANSFER_COPY` strings).
2. **Hub — `src/views/home`** (step `done`), top to bottom per design.md and `docs/product/prototype/home-hub.dc.html` / `home-hub-mobile.dc.html`:
   - **Banners**: storage at risk (`useSaveStatus().atRisk`): "Progress isn't being saved in this browser. Export your save to keep it." + link to `/settings/`; persistent storage denied (`usePersistState() === 'denied'`): "Browser may clear data. Export often." shown once per page load, dismissible (component state); backup due (`isBackupDue(save, Date.now())` from `@/features/save-transfer`): "Back up your progress" + link "Export save" → `/settings/`.
   - **Trainer strip**: name, "Lv N", XP bar (`role="progressbar"` with `aria-valuenow/min/max`, max `xpToNextTrainerLevel(level)`), next unlock from `nextUnlock(level)` ("Next: Lv 5 · team slot 3"; text built from the returned unlocks, numbers never hard-coded).
   - **Next-stage card**: stage = `min(save.ladder.cleared + 1, economy.battle.ladderStages)`. Stream 2-play builds `src/entities/ladder` in parallel, so show a minimal card: "Stage N", the first-clear reward from `economy.battle.firstClear` ("+1 Basic capsule · +20 dust", built from the config), primary link "Fight" → `/battle/?stage=N`; right after onboarding the card reads "Stage 1 is ready" and "Fight" pulses once (component state, not on reload; no pulse under reduced motion). If `src/entities/ladder` exists on `origin/dev` when you integrate before your PR, show the rival name and mini sprites from its public API; otherwise leave `// TODO(2-play): rival preview from entities/ladder`.
   - **Team strip**: 1–4 holo cards from `save.team` (Lv, ★, a dot when `talentPointsAvailable(owned) > 0`), then locked slots up to 4 with "Unlocks at Trainer Lv N" (`teamSlotUnlockLevel(slot)`, slots open = `teamSlots(trainer.level)`). Read-only: the team dialog belongs to stream 2-play (`src/widgets/team-dialog`), so "Edit team" links to `/ladder/` with `// TODO(2-play): open widgets/team-dialog from the home view`.
   - **Daily quests** via `src/widgets/quest-list` (see 3).
   - **Capsule tray**: unopened count per tier (`CapsuleArt` from `@/entities/capsule`), pity via `PityMeter` (or `OddsPity`) from `@/widgets/capsule-reveal` fed by `pityStatus(save, tier)`, "Open" → `useOpenCapsule().openOne(tier)` + `CapsuleReveal` (primary "View new" → `/creature/?id=<first new id>` when anything is new, else "Done"; `onOpenNext` while capsules remain); empty → "Open capsules" link to `/capsules/`.
   - **Collection tile**: "N / SPECIES_COUNT caught" (`SPECIES_COUNT` from `@/entities/pokemon`, N = collection entries), link to `/collection/`.
   - **Footer** (onboarding and hub): "Unofficial fan project, not affiliated with Nintendo, Game Freak or The Pokémon Company · Data: PokéAPI".
3. **`src/widgets/quest-list`** — `QuestList`, presentational (stream 2-play's battle result can reuse it): props `board: QuestBoard`, `now`, `onClaim(id, day)`, optional `compact`. States from `questBoard`: `locked` → "Daily quests unlock at Trainer Lv 2" (level from the board); `open` → rows "x / y" with a progressbar each and "Claim" (a real `<button>`) on claimable rows, claimed rows marked; `allClaimed` → "No quests right now. New quests in 5 h" (hours from `board.nextRefreshAt − now`, rounded up); `board.clockBehind === true` → "Quests refill at 06:00" (from `board.refreshHour`), no error. Rewards shown from `row.reward`. In the home view:
   - On mount and on `visibilitychange` to visible: `updateSave((s) => refreshQuests(s, Date.now()))` — always a fresh `Date.now()` at call time, never a value captured at render.
   - Board: `questBoard(save, Date.now())` computed at render.
   - Claim: `updateSave((s) => { const r = claimQuest(s, id, day); captured = r; return r.ok ? r.save : s; })`. `claimQuest` already folds its `trainerLeveled` events through `applyGameEvents` — commit `r.save` as is, don't apply them twice. Announce "+30 dust · +80 Trainer XP" (from `r.reward` / `r.trainerXp`) and "Trainer Lv N" when `r.levelsGained > 0` in `role="status"`. The level-up dialog belongs to stream 2-play: leave `// TODO(2-play): open widgets/level-up on levelsGained`.
4. **`src/widgets/app-nav`** — replace the stub `AppNav` (rendered by `app/layout.tsx` on every page, above each view's `<main>`; it renders no `<main>` and no `h1`):
   - Desktop (sticky glass top bar): Logo (`CapsuleArt` or text, never a Poke Ball) → `/`; links Ladder `/ladder/`, Collection `/collection/`, Capsules `/capsules/` with an unopened badge (sum of `save.capsules`), Trainer `/trainer/` with a dot when `save.trainer.talentPoints > 0`; right side: Lv pill + XP bar, CTA "Fight · Stage N" → `/battle/?stage=N` (same N as the hub), `MotionToggle` (`@/features/motion-toggle/MotionToggle`), gear icon link → `/settings/` with `aria-label="Settings"`.
   - 375px: top row logo · Lv pill · Fight · gear; fixed bottom tab bar, 5 × 44px: Home, Ladder, Collection, Capsules, Trainer (lucide `house`, `milestone`, `layout-grid`, `package-open`, `user-round` — check the names exist in the installed lucide-react). Badges keep a text alternative (e.g. "Capsules, 3 unopened").
   - `aria-current="page"` on the active link (`usePathname()`, trailing slash normalised); `next/link` with literal trailing-slash paths (`href()` in `src/shared/lib/router.ts` only knows `/` and `/battle`).
   - Before hydration / while the save loads: only Logo + Motion (no badges, no XP) — nothing heavy. During onboarding (step ≠ `done`): only Logo + Motion; deep links → `/` (`router.replace('/')` once the save is ready and the step isn't `done`), except `/battle/` (the intro) and `/settings/` (save rescue). When the step changes to `done` while mounted, the Fight CTA pulses once (component state; none under reduced motion).
   - The fixed bottom bar covers content in other views: add bottom padding in your own views, and list "other views need bottom padding at 375px" under KNOWN ISSUES (global CSS is not yours).
5. **Retire v1 home code:**
   - Rewrite `src/views/home/HomePage.tsx` (keep the file and export name: `app/page.tsx` imports `@/views/home/HomePage`); remove `TeamBuilderForm`, `ConfirmTeamDialog`, the roster `<select>`/Remove, `BattleBanner`, the in-page nav, the `trainer-studio:selected:v1` session key and every `Pokeball` use in your files. `HeroHeading` may stay for the hero.
   - Delete `src/features/team-builder/**` (stream 2-collection moves `PokemonCombobox` into its own slice from its own snapshot).
   - `src/widgets/team-showcase`: turn it into the hub's read-only holo cards (export a `HoloCard` with large / mini / locked variants, art via `getCreatureArt(id)` with a type-coloured silhouette + retry on error; it must not import `@/widgets/capsule-reveal`). Delete `BattleBanner` and whatever you no longer use.
   - `src/entities/trainer`: `src/entities/save/persistence/v1.ts` imports nothing from it (checked: only a comment mentions it), and the v1 keys there are read by the save migration — never call `useRoster`/`loadRoster`/`persistRoster`/`migrateLegacy` from new code (their read path rewrites storage). `src/features/battle-setup` (deleted by stream 2-play in parallel) still imports `PRESET_TRAINERS`, `Trainer`, `randomRival`, `useRoster`, `trainerOptionLabels`. At your final `git merge origin/dev`: if `src/features/battle-setup` is gone, delete `src/entities/trainer/**` entirely; if it still exists, keep exactly those exports (with their files and tests) and delete the rest, and say which in the report.
   - Query params: none are needed here; if you ever read one, use `useSearchParams` only inside a component rendered after `useHydrated()` (pattern in `src/views/battle/BattlePage.tsx`) — never `<Suspense>`.

## Context

- Project goal: turn Trainer Studio into a free, single-player collection auto-battler — open capsules, level up Pokémon and the trainer, fight a PvE ladder in 3D; no money, no accounts, no server, progress in IndexedDB.
- Read first: `CLAUDE.md`, `docs/plan/PLAN.md` (contracts + who owns what), `docs/product/idea.md` (Must #1, #2, #5, #6), `docs/product/design.md` (screen `home`, Navigation, flow `first-visit`, flow `save-transfer` last line, Components `AppNav` / `HoloCard` / `QuestList` / `OddsPity`, Tokens, Accessibility), `docs/product/prototype.md`, `src/shared/ui/*` (Button, Dialog, Spinner, Spotlight), `src/shared/lib/motion.ts`, `src/shared/lib/useHydrated.ts`, `src/views/capsules/**` (read only: how a view uses `useOpenCapsule` + `CapsuleReveal`), `src/widgets/capsule-reveal/ui/testDom.ts` (read only).
- Contracts you build against (do NOT modify):
  - `src/entities/save/model/schema.ts` (`Save`, `OnboardingStep`, `createNewSave` — use it to build test saves), `src/entities/save/model/store.ts` (`useSave`, `useSaveStatus` → `{ status, error, atRisk }`, `getSave`, `updateSave`, `replaceSave`, `isStorageAtRisk`; `__resetSaveStoreForTests` for tests — not re-exported, so tests import it from `@/entities/save/model/store`), `src/entities/save/model/events.ts` (`GameEvent`, `applyGameEvents`), `src/entities/save/index.ts` (import only from here; it also re-exports `requestPersist`, `usePersistState`, `useSaveConflict` from persistence). `src/entities/save/persistence/**` belongs to stream 1-save (merged) — don't edit it; tests may import `__resetPersistForTests` from `@/entities/save/persistence/persist`.
  - `src/shared/config/economy.ts` — keys `economy.onboarding.loanerLevel`, `economy.onboarding.rivalLevel`, `economy.onboarding.introReward`, `economy.battle.ladderStages`, `economy.battle.firstClear`, `economy.trainer.unlocks.dailyQuests`, `economy.quests.refreshHour`, `economy.save.backupReminder`, `CAPSULE_TIERS`.
  - `src/shared/lib/rng.ts` (`createRng`, `hashSeed`).
  - Merged wave-1 public APIs (import only from each `index.ts`): `@/entities/pokemon` (`speciesOfRarity`, `getSpecies`, `SPECIES_COUNT`, `getCreatureArt`, `typeColor`, `Species.bst` / `.slug`), `@/entities/battle` (`loadMovesets`, `movesFor`, `buildTeam`, `statsAtLevel`, `simulateBattle`, `findIntroSeed`, `IntroSeedError`), `@/entities/progression` (`xpToNextTrainerLevel`, `nextUnlock`, `teamSlots`, `teamSlotUnlockLevel`, `talentPointsAvailable`), `@/entities/quest` (`refreshQuests`, `questBoard`, `questRows`, `claimQuest`, `QuestBoard`, `QuestRow`), `@/entities/capsule` (`pityStatus`, `CapsuleArt`, `TIER_LABEL`, `RARITY_LABEL`), `@/features/open-capsule` (`useOpenCapsule` → `{ openOne, openAll }` returning `OpenCommit`), `@/features/save-transfer` (`isBackupDue`, `restoreBackup`, `readSaveFile`, `applyImport`, `resetProgress`, `TRANSFER_COPY`), `@/widgets/capsule-reveal` (`CapsuleReveal` props `results`, `open`, `onClose`, `primaryLabel`, `onPrimary`, `onOpenNext`; `PityMeter`, `OddsPity`, `CreatureArt`) — views may import widgets; widgets never import other widgets (compose in the view).
  - `app/layout.tsx` (renders `AppNav` and the skip link; each view renders its own `<main id="content">`), `app/page.tsx` (renders `HomePage`), `src/app/providers/SaveProvider.tsx`.
- Stubs prepared for you: `src/widgets/app-nav/ui/AppNav.tsx`, `src/widgets/app-nav/index.ts`.
- Design (`docs/product/design.md`, `ui-language: en`): implement screen `home`, the Navigation section and flow `first-visit` steps 1–2 and 6 exactly as specified there — every listed state, copy verbatim (in its `ui-language`), per-screen accessibility notes, components from its Components table. Where this brief differs (no welcome capsule for v1 players, read-only team strip, minimal stage card), the brief wins. Visual reference: `docs/product/prototype/home.dc.html` (hero, dealt), `home-hub.dc.html`, `home-hub-mobile.dc.html` — match their layout and hierarchy with the template's primitives and theme; design.md wins where they differ; don't copy the HTML into the app.

### Rules (all streams)

- Contracts are read-only: escalate for any change.
- Every game number from `src/shared/config/economy.ts`; no magic numbers.
- Randomness only via `hashSeed` / `createRng`; never `Math.random()`.
- Art only via `getCreatureArt` / `CreatureArt`.
- Save only via `useSave` / `updateSave`; apply returned `GameEvent`s with `applyGameEvents` inside the same `updateSave`.
- Each view renders its own `<main id="content">` with exactly one `h1`.
- Query params via `useSearchParams` only inside a component rendered after `useHydrated()` — never `<Suspense>`.
- Widgets never import other widgets; compose them in views.
- Tests beside the code; component tests start with `// @vitest-environment jsdom`.
- `refreshQuests` / `questBoard` always get a fresh `now` (`Date.now()` at call time).

## You own (edit ONLY these paths)

- `src/views/home/**` (incl. `src/views/home/**/*.test.ts(x)`)
- `src/widgets/app-nav/**` (incl. `src/widgets/app-nav/**/*.test.tsx`)
- `src/widgets/quest-list/**` (incl. `src/widgets/quest-list/**/*.test.tsx`)
- `src/widgets/team-showcase/**` (incl. `src/widgets/team-showcase/**/*.test.tsx`)
- `src/features/team-builder/**` (delete, incl. its tests)
- `src/entities/trainer/**` (retire, incl. its tests; see Task 5)
- Tests sit next to the file they test (`dealOnboarding.test.ts` beside `dealOnboarding.ts`). Vitest globals are off (import `describe`, `it`, `expect`); component tests start with `// @vitest-environment jsdom`; IndexedDB tests use `fake-indexeddb/auto`.

## Environment notes

- GitHub: if `gh` says the repo is not found, the active gh account is a different one. Run that one command with the owner's token: `GH_TOKEN="$(gh auth token --user edgergard)" gh pr create --repo edgergard/trainer-studio ...`. Never run `gh auth switch`.
- Env: no env file — use mocks/defaults. In the report, say whether you exercised the real services or mocks.
- Browser checks (web): `npm run dev` may return 500 from background shells on Windows (Turbopack CSS worker), and `next start` does not work with static export. Use `npm run build` then `npm run preview -- 3203` (serves `out/`), and drive it with the project's Playwright CLI: `npx playwright cli open http://localhost:3203`, then `snapshot` / `click` / `screenshot` (see `.claude/skills/playwright-cli`; it uses the installed Chrome — don't install browsers). Close only your own browser with `npx playwright cli close`; never `kill-all` or `close-all` (they hit other streams' browsers). Stopping the background `npm run preview` on Windows leaves its child `node scripts/serve-out.mjs 3203` listening: also stop the process on your port (PowerShell `Get-NetTCPConnection -LocalPort 3203 -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ }`) and confirm the port is free — only port 3203 (L-050/L-051). Don't install global tools; if the browser can't run, say so in the report — the orchestrator smoke-tests in Phase 5. Note: a fresh save starts at `hero`, and `/battle/?stage=intro` is stream 2-play's (it may still be the old page on your branch); to see `fought` / `capsule` / hub states in the browser, import a crafted save through Settings (build it with `encodeSaveFile` in a scratch script outside the repo) — never commit seeding code.

## Known pitfalls

- Never chain checks through a pipe before commit: run `npm run check`, test its exit code, commit only on 0 (L-024).
- Every persisted key is fixed by the save schema contract; you can't add keys (no "welcome seen" or "banner dismissed" flags) — keep such state in components or escalate (L-027).
- jsdom tests can pass while the real DOM misses state: expose state with aria-* (`aria-current`, progressbar values, `aria-busy` on the deal button, locked slots' reason text) and check it in the browser (L-007).
- Run `prettier --write` on files you edit before committing; `format:check` is part of `npm run check` (L-014).
- jsdom lacks `<dialog>.showModal` and `window.matchMedia`: copy the idea of `polyfillDom()` from `src/widgets/capsule-reveal/ui/testDom.ts` into your own slice's test helper — don't import it across slices (L-047).

## You must NOT

- Edit files outside your ownership — including package.json, lockfile, root layout, route registry, env schema, contracts, CI, `.claude/`, `docs/plan/`.
- Add dependencies (escalate instead).
- Merge into `dev`, force-push, `git reset --hard`, or touch other `stream/*` branches.
- Rebase after your branch has been pushed (use `git merge` instead).

## Escalation

If you need a contract change, a shared-file edit, a new dependency, or you are blocked: stop, commit what you have, push (GitHub mode), and finish your turn with the standard report using `STATUS: escalation` and an `ESCALATION:` line saying exactly what you need and why. Do not work around it. The orchestrator will change `dev` and tell you to integrate it.

## Acceptance criteria

- [ ] Hero: one click on "Fill my team with random Pokémon" deals a loaner (common/uncommon, has moves) and a rival (common, has moves, BST ≤ loaner's, intro winnable via `findIntroSeed`), deterministic for a given `meta.seed`, and commits step `dealt` with both species ids.
- [ ] Dealt: loaner card tagged "Loaner", "VS", rival card, "Fight" → `/battle/?stage=intro`; live region "Loaner <name> joined your team"; focus on "Fight".
- [ ] `fought` → "Open your capsule" opens `CapsuleReveal` (result committed before the animation, step → `capsule`); `capsule` → Add-to-team prompt; Add to team → `team: [id]`, step `done`, `requestPersist()` called once; a reload at any step resumes there without re-rolling.
- [ ] v1 migrated save shows "Your v1 trainers were imported: N Pokémon added." once per page load until dismissed, no capsule granted, no new keys.
- [ ] Hub shows banners (at risk / persist denied / backup due), trainer strip with next unlock, next-stage card (stage = cleared + 1 capped at `economy.battle.ladderStages`), team strip with locked slots "Unlocks at Trainer Lv N", daily quests (locked / open / allClaimed / clockBehind, Claim works and announces the reward), capsule tray with pity and Open → reveal, "N / SPECIES_COUNT caught", footer disclaimer — all numbers from economy.ts / the domain.
- [ ] AppNav: desktop top bar with badges, Lv pill + XP bar, "Fight · Stage N", Motion, gear; 375px top row + 5 × 44px bottom tabs; `aria-current="page"`; only Logo + Motion before the save loads and during onboarding (deep links → `/` except `/battle/` and `/settings/`).
- [ ] `src/features/team-builder` deleted; no `TeamBuilderForm`, `ConfirmTeamDialog`, roster select/Remove, `BattleBanner` or `Pokeball` left in your files; `src/entities/trainer` retired as described in Task 5.
- [ ] Tests cover the loaner/rival pick (determinism, moves filter, BST rule, `IntroSeedError` fallback), every onboarding step transition and the v1 welcome, the hub sections and banners, QuestList states + claim, AppNav (onboarding minimal, badges, `aria-current`, redirect), and team-strip locked slots.
- [ ] `npm run check` passes in this worktree
- [ ] UI (if any): uses design tokens, `cursor: pointer` / accessibility labels, visible focus, works at mobile and desktop widths (web)
- [ ] If you run a server, use your port: `npm run preview -- 3203` after `npm run build` (web). Stop it (and its child node process) when done and check the port is free.

## Definition of done

1. All acceptance criteria met; `npm run check` passes.
2. Get the latest `dev`:
   - before your first push: `git fetch origin && git rebase origin/dev`;
   - after your branch has been pushed: `git fetch origin && git merge origin/dev` (never rebase).
     Then `npm ci` if package-lock.json changed, and re-run `npm run check`.
3. Conventional commits, only files in your ownership.
4. GitHub mode: `git push -u origin stream/2-home`, then `gh pr create --base dev` (body: what changed / how to verify). Do NOT merge it. Later pushes: plain `git push`.
5. Finish your turn with the report below. If the orchestrator later sends feedback, fix it, re-run checks, push, and report again in the same format.

## Report format (your final message)

STATUS: done | partial | escalation
BRANCH: stream/2-home PR: <url or none> HEAD: <short sha>
ESCALATION: <need + why — only when STATUS is escalation>
DONE: <bullets>
NOT DONE / KNOWN ISSUES: <bullets>
CHECKS: <command → result>
FILES CHANGED OUTSIDE OWNERSHIP: none | <list with reason>
