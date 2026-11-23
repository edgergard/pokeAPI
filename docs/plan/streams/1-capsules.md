# Stream 1-capsules: capsules, reveal, dust and craft

You are one of several agents building Trainer Studio in parallel. Each agent works in its own git worktree and branch. The orchestrator reviews your branch and merges it into `dev`.

## Your branch

`stream/1-capsules` (already checked out in this worktree, based on `dev`).
Mode: GitHub remote `origin` (repo `edgergard/trainer-studio`).
Your dev-server port: 3103.

## Setup (do first)

1. `npm ci` (never `npm install`). If package-lock.json then shows as modified, `git checkout -- package-lock.json`.
2. Run `npm run check` once to confirm a green baseline. If it is red before you changed anything, report `STATUS: escalation`.
   Run `npm ci` again whenever integrating `dev` changes package-lock.json.

## Task

Build Must #3 (capsules): the player opens capsules earned in play, sees honest odds and pity, turns duplicates into stars or dust, and buys a specific unowned Pokémon with dust. Four layers, bottom-up:

1. **Pure domain — `src/entities/capsule`** (no React, no store access; everything injected so tests stay deterministic).
   - `rollCapsule(save, tier, now) → { save, result, events }`. Throw (or return an error result) when `save.capsules[tier]` is 0.
     - Seed: `hashSeed(save.meta.seed, 'pull', save.meta.pullIndex)` then `meta.pullIndex + 1`; one `createRng(seed)` stream per pull feeds rarity, species, IVs and nature in a fixed order (both from `src/shared/lib/rng.ts`). Never `Math.random()`.
     - Rarity: weighted by `economy.capsules.odds[tier]` (percent). Floors, highest wins: pity — when this open is the `economy.capsules.pity[tier].opens`-th since the pity rarity (`save.pity[tier] >= opens − 1`), the rarity is at least `economy.capsules.pity[tier].rarity`; first capsule ever (`save.capsulesOpened === 0`) — at least `economy.capsules.firstCapsuleMinRarity`. A roll below a floor is raised to the floor. Rarity order is `RARITIES` in economy.ts.
     - Pity counter: `save.pity[tier]` resets to 0 when the dropped rarity is the tier's pity rarity or better, otherwise +1.
     - Species: uniform pick from `speciesOfRarity(rarity)` (`src/entities/pokemon`).
     - New species → add `OwnedPokemon` to `save.collection[String(id)]`: level 1, xp 0, stars 1, dupes 0, IVs 0–`IV_MAX` per stat and nature from `NATURES` (both drawn from the same rng stream), talents `[]`, `obtainedAt: now`.
     - Duplicate → `dupes + 1`; when `dupes` reaches `economy.pokemon.dupesForNextStar[stars]` and `stars < economy.pokemon.maxStars` → `stars + 1`, `dupes 0` ("★ up"). At max stars → `+economy.dust.fromDuplicate[rarity]` dust instead (dupes unchanged).
     - Decrement `save.capsules[tier]`, increment `save.capsulesOpened`.
     - `events`: one `{ kind: 'capsuleOpened', tier, rarity, speciesId, duplicate }` (`GameEvent` in `src/entities/save/model/events.ts`). The domain does NOT apply them; callers run `applyGameEvents` inside `updateSave`.
     - `result` (your type, export it): tier, rarity, speciesId, outcome `'new' | 'starUp' | 'dupe' | 'dust'`, stars after, dust gained, pity value after and whether it reset — everything the reveal needs, so the widget never recomputes.
     - Does not touch `onboarding`, `team` or `trainer` (onboarding/team logic belongs to other streams).
   - `openMany(save, tier, count, now)` → folds `rollCapsule` `count` times; returns the final save, all results (in roll order) and all events. Used for "Open all".
   - `craftSpecies(save, speciesId, now)` → for an unowned species: costs `economy.dust.craftPrice[rarity]`, adds it as a new `OwnedPokemon` (IVs/nature seeded with `hashSeed(save.meta.seed, 'craft', speciesId)`); returns a typed failure for owned / unknown species / not enough dust (with the missing amount for "Need N more dust"). Crafting emits no `GameEvent`.
   - Helpers for the UI, also pure: pity progress per tier (`opens − save.pity[tier]` left), rarity of a species, craft price, whether a tier is unlocked (`great` needs `trainer.level >= economy.trainer.unlocks.greatCapsules`).
   - Reload-safe: the result is computed and committed to the save before any animation; reopening the page after a reload never re-rolls (the pull index already advanced).
2. **`src/features/open-capsule`** — `useOpenCapsule()` (open 1 / open all of a tier) and `useCraft()` hooks. Each calls `updateSave((s) => { const r = rollCapsule/openMany/craftSpecies(...); return applyGameEvents(r.save, r.events); })` with `Date.now()` passed in, and returns the results to the caller for the reveal. Capture the results inside the updater (or compute from `getSave()` then commit the same save) so the UI shows exactly what was saved. If the save is not loaded or the roll fails, return an error the view turns into "Couldn't open. Try again".
3. **`src/widgets/capsule-reveal`** — `CapsuleReveal` dialog (design.md screen `capsule-reveal`, component `CapsuleReveal`):
   - Built on `src/shared/ui/Dialog` (native `<dialog>`) or a fullscreen equivalent of it; title "Capsule".
   - Per card: shake → rarity flash (`--color-rarity-*` / `text-rarity-*`) → flip to a holo card. Multi: rarest card revealed last, then a summary grid with labels New / ★ up / +N dust. Pity footer ticks or resets ("Pity reset · Epic within 20" — numbers from the results, not hard-coded).
   - Skip button (a real `<button>`) and Esc skip the animation, never the result. `Dialog` maps Esc (`cancel`) to `onClose`, so while animating your `onClose` handler must skip to the summary instead of closing.
   - Reduced motion (`usePrefersReducedMotion()` from `src/shared/lib/motion.ts`, which honours the `data-motion` setting): crossfade and instant flip, no shake/flash.
   - Each reveal is announced in a `role="status"` live region ("Rare: Eevee, new"); single new card copy "New! <name> joined your collection." Rarity always has a text label next to the colour.
   - Props: `results`, `open`, `onClose`, `primaryLabel` (`'Add to team'` first Pokémon ever / `'View new'` / `'Done'`), `onPrimary`, optional `onOpenNext` (secondary "Open next").
   - Card: your own HoloCard-style card inside this widget (art via `getCreatureArt(id)`, type-coloured silhouette + retry on image error, rarity frame, ★ count). Read `src/widgets/team-showcase/TeamShowcase.tsx` and `LockInBurst.tsx` for the look and the `.holo` styles in `src/app/styles.css`; do not import from or edit `src/widgets/team-showcase` (another stream owns it, and widgets don't import each other) — build your own burst if you want one.
   - Also export `OddsPity` from the widget's `index.ts`: the odds per tier as a real `<table>` with headers (rarity label + percent from `economy.capsules.odds`), and a pity meter per tier with `role="progressbar"`, `aria-valuenow/min/max` and a text value ("Epic guaranteed within 18 opens"); a locked tier shows its reason. Home will reuse it.
4. **`src/views/capsules`** — replace the stub `CapsulesPage` (design.md screen `capsules`), rendering its own `<main id="content">` with one `h1` "Capsules":
   - Tier stacks with counts; "Open" (and "Open all" when the tier has 2 or more) opening the reveal; Great tier locked until trainer level `economy.trainer.unlocks.greatCapsules` with "Great capsules unlock at Trainer Lv 8" (number from economy).
   - `OddsPity` always visible; dust balance.
   - "Buy a specific Pokémon": a simple searchable list of unowned species (filter `<input>` with a label + list, each row with name, rarity label and `economy.dust.craftPrice[rarity]`, "Craft with dust" button). Keep it inside `src/views/capsules` (the shared PokemonSearch belongs to stream 2-collection). Not enough dust: button disabled (`aria-disabled` + reason) with "Need 40 more dust" (computed). A crafted Pokémon is shown with the reveal (single card, "New!").
   - States, copy verbatim: loading (skeleton while `useSaveStatus().status === 'loading'`), empty "No capsules. Win battles and finish daily quests to earn them." + "Fight" link to `/battle/?stage=<ladder.cleared + 1, capped at economy.battle.ladderStages>` via `next/link` (literal path with trailing slash; `href()` in `src/shared/lib/router.ts` only knows `/` and `/battle`), error "Couldn't open. Try again".
   - Reveal primary action from the view: "View new" (link to `/creature/?id=<first new id>`) when anything was new, else "Done".
   - If you ever read query params here, do it with `useSearchParams` only in a component rendered after `useHydrated()` (`src/shared/lib/useHydrated.ts`, pattern in `src/views/battle/BattlePage.tsx`) — never `<Suspense>`.

## Context

- Project goal: turn Trainer Studio into a free, single-player collection auto-battler — open capsules, level up Pokémon and the trainer, fight a PvE ladder in 3D; no money, no accounts, no server, progress in IndexedDB.
- Read first: `CLAUDE.md`, `docs/plan/PLAN.md` (contracts + who owns what), `docs/product/idea.md` (Must #3), `docs/product/design.md` (screens `capsules`, `capsule-reveal`, flow `first-visit` step 5, Components `CapsuleReveal` / `OddsPity` / `HoloCard`, Tokens, Accessibility), `src/shared/ui/*` (Button, Dialog, Field, Spinner), `src/shared/lib/motion.ts`, `src/widgets/team-showcase/**` (read only), `docs/product/prototype/capsule-reveal.dc.html`.
- Contracts you build against (do NOT modify):
  - `src/entities/save/model/schema.ts` (`Save`, `OwnedPokemon`, `NATURES`, `createNewSave` — use it to build test saves), `src/entities/save/model/store.ts` (`useSave`, `useSaveStatus`, `getSave`, `updateSave`, `replaceSave`; `__resetSaveStoreForTests` for tests — not re-exported by `index.ts`, so tests import it from `@/entities/save/model/store`), `src/entities/save/model/events.ts` (`GameEvent`, `applyGameEvents`, `registerGameEventReducer`), `src/entities/save/index.ts` (import only from here). `src/entities/save/persistence/**` belongs to stream 1-save — don't edit or import it.
  - `src/shared/config/economy.ts` — keys `economy.capsules.odds`, `economy.capsules.pity`, `economy.capsules.firstCapsuleMinRarity`, `economy.pokemon.dupesForNextStar`, `economy.pokemon.maxStars`, `economy.dust.fromDuplicate`, `economy.dust.craftPrice`, `economy.trainer.unlocks.greatCapsules`, `economy.battle.ladderStages`, `RARITIES`, `CAPSULE_TIERS`, `IV_MAX`.
  - `src/shared/lib/rng.ts` (`createRng`, `hashSeed`).
  - `src/entities/pokemon/model/species.ts` (`getSpecies`, `allSpecies`, `speciesOfRarity`, `Species.rarity`), `src/entities/pokemon/model/art.ts` (`getCreatureArt`), `src/entities/pokemon/index.ts` (import only from here).
  - `src/entities/progression/model/talents.ts` (shape only; talent effects like `dustPercent`/`capsuleChance` are not applied by this stream).
  - `src/app/providers/SaveProvider.tsx`, `app/layout.tsx` (skip link lives there; `app/capsules/page.tsx` already renders `CapsulesPage`).
- Stubs prepared for you: `src/views/capsules/CapsulesPage.tsx`, `src/views/capsules/index.ts`.
- Design (`docs/product/design.md`, `ui-language: en`): implement screens `capsules` and `capsule-reveal` and flow `first-visit` step 5 exactly as specified there — every listed state, copy verbatim (in its `ui-language`), per-screen accessibility notes, components from its Components table. Visual reference: `docs/product/prototype/capsule-reveal.dc.html` — match its layout and hierarchy with the template's primitives and theme; design.md wins where they differ; don't copy the HTML into the app.

## You own (edit ONLY these paths)

- `src/entities/capsule/**` (incl. `src/entities/capsule/**/*.test.ts`)
- `src/features/open-capsule/**` (incl. `src/features/open-capsule/**/*.test.ts(x)`)
- `src/widgets/capsule-reveal/**` (incl. `src/widgets/capsule-reveal/**/*.test.tsx`)
- `src/views/capsules/**` (incl. `src/views/capsules/**/*.test.tsx`)
- Tests sit next to the file they test (`rollCapsule.test.ts` beside `rollCapsule.ts`). Vitest globals are off (import `describe`, `it`, `expect`); component tests start with `// @vitest-environment jsdom`; IndexedDB tests use `fake-indexeddb/auto`.

## Environment notes

- GitHub: if `gh` says the repo is not found, the active gh account is a different one. Run that one command with the owner's token: `GH_TOKEN="$(gh auth token --user edgergard)" gh pr create --repo edgergard/trainer-studio ...`. Never run `gh auth switch`.
- Env: no env file — use mocks/defaults. In the report, say whether you exercised the real services or mocks.
- Browser checks (web): `npm run dev` may return 500 from background shells on Windows (Turbopack CSS worker). Use `npm run build` then `npx next start --port 3103`, and drive it with the project's Playwright CLI: `npx playwright cli open http://localhost:3103`, then `snapshot` / `click` / `screenshot` (see `.claude/skills/playwright-cli`; it uses the installed Chrome — don't install browsers). Close only your own browser with `npx playwright cli close` and stop the `next start` you launched when done; never `kill-all` or `close-all` (they hit other streams' browsers). Don't install global tools; if the browser can't run, say so in the report — the orchestrator smoke-tests in Phase 5. Note: until stream 1-save lands, the save is in-memory only and a fresh save has 0 capsules — to see content states in the browser, seed capsules temporarily from a test-only path, never commit it.

## Known pitfalls

- Never chain checks through a pipe before commit: run `npm run check`, test its exit code, commit only on 0 (L-024).
- Every persisted key is declared in the save schema contract; you can't add keys (e.g. no "seen reveals" flag) — escalate (L-027).
- jsdom tests can pass while the real DOM misses state: expose state with aria-* (reveal phase, disabled craft, pity progressbar values) and check it in the browser (L-007).
- Run `prettier --write` on files you edit before committing; `format:check` is part of `npm run check` (L-014).

## You must NOT

- Edit files outside your ownership — including package.json, lockfile, root layout, route registry, env schema, contracts, CI, `.claude/`, `docs/plan/`.
- Add dependencies (escalate instead).
- Merge into `dev`, force-push, `git reset --hard`, or touch other `stream/*` branches.
- Rebase after your branch has been pushed (use `git merge` instead).

## Escalation

If you need a contract change, a shared-file edit, a new dependency, or you are blocked: stop, commit what you have, push (GitHub mode), and finish your turn with the standard report using `STATUS: escalation` and an `ESCALATION:` line saying exactly what you need and why. Do not work around it. The orchestrator will change `dev` and tell you to integrate it.

## Acceptance criteria

- [ ] `rollCapsule` is deterministic: the same save + tier gives the same result; `meta.pullIndex` advances by 1 per open; no `Math.random()` anywhere in your code.
- [ ] Odds match `economy.capsules.odds` (statistical test over many seeded rolls per tier within a tolerance), pity guarantees `economy.capsules.pity[tier].rarity` or better on the N-th open and resets the counter, the first capsule ever is at least `economy.capsules.firstCapsuleMinRarity` (idea.md Must #3: "odds and pity match economy.ts, verified by a test").
- [ ] Duplicates: dupes → ★ up at `economy.pokemon.dupesForNextStar[stars]`, dust at max stars from `economy.dust.fromDuplicate`; every duplicate yields something.
- [ ] `craftSpecies` charges `economy.dust.craftPrice[rarity]`, refuses owned species and insufficient dust (with the missing amount).
- [ ] Opening commits the result (and `capsuleOpened` events via `applyGameEvents`) to the save before the reveal animates; Esc/Skip skip only the animation.
- [ ] Capsules view shows every design.md `capsules` state with verbatim copy; Great tier locked below trainer level `economy.trainer.unlocks.greatCapsules`; odds `<table>` and pity `role="progressbar"` present; "Open all" at 2+.
- [ ] CapsuleReveal: single and multi (rarest last), summary New / ★ up / +dust, pity footer, live-region announcements, reduced-motion crossfade, primary label from props; `OddsPity` exported for reuse.
- [ ] Tests cover rarity roll + floors, pity counter, dupes/stars/dust, craft, `openMany`, the hooks committing to the store, and the reveal/view components (Skip/Esc, disabled craft, empty state).
- [ ] `npm run check` passes in this worktree
- [ ] UI (if any): uses design tokens, `cursor: pointer` / accessibility labels, visible focus, works at mobile and desktop widths (web)
- [ ] If you run a dev server, use your port: `npm run dev -- --port 3103` (web). Stop it when done.

## Definition of done

1. All acceptance criteria met; `npm run check` passes.
2. Get the latest `dev`:
   - before your first push: `git fetch origin && git rebase origin/dev`;
   - after your branch has been pushed: `git fetch origin && git merge origin/dev` (never rebase).
     Then `npm ci` if package-lock.json changed, and re-run `npm run check`.
3. Conventional commits, only files in your ownership.
4. GitHub mode: `git push -u origin stream/1-capsules`, then `gh pr create --base dev` (body: what changed / how to verify). Do NOT merge it. Later pushes: plain `git push`.
5. Finish your turn with the report below. If the orchestrator later sends feedback, fix it, re-run checks, push, and report again in the same format.

## Report format (your final message)

STATUS: done | partial | escalation
BRANCH: stream/1-capsules PR: <url or none> HEAD: <short sha>
ESCALATION: <need + why — only when STATUS is escalation>
DONE: <bullets>
NOT DONE / KNOWN ISSUES: <bullets>
CHECKS: <command → result>
FILES CHANGED OUTSIDE OWNERSHIP: none | <list with reason>
