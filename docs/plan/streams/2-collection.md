# Stream 2-collection: collection, creature and trainer screens

You are one of several agents building Trainer Studio in parallel. Each agent works in its own git worktree and branch. The orchestrator reviews your branch and merges it into `dev`.

## Your branch

`stream/2-collection` (already checked out in this worktree, based on `dev`).
Mode: GitHub remote `origin` (repo `edgergard/trainer-studio`).
Your dev-server port: 3201.

## Setup (do first)

1. `npm ci` (never `npm install`). If package-lock.json then shows as modified, `git checkout -- package-lock.json`.
2. Run `npm run check` once to confirm a green baseline. If it is red before you changed anything, report `STATUS: escalation`.
   Run `npm ci` again whenever integrating `dev` changes package-lock.json.

## Task

Build the screens where the player looks at and grows what they own: design.md screens `collection`, `creature` and `trainer` (Must #4 collection + Pokémon levels/stars, #5 trainer level + trainer talents, #7 Pokémon talents, #3 craft entry). Wave 1 already merged the domain: you write UI over existing pure functions, not new game rules. Five pieces:

1. **`src/features/pokemon-search`** — `PokemonSearch`, a reusable accessible combobox/filter over `allSpecies` (`@/entities/pokemon`) following the WAI-ARIA combobox pattern, with a mode `'owned' | 'unowned' | 'all'` (owned = key present in `save.collection`; check with `isOwned` from `@/entities/capsule`). Base it on `src/features/team-builder/ui/PokemonCombobox.tsx`: copy what you need (keyboard handling, `aria-activedescendant`, listbox, `FieldShell`/`controlClass` from `src/shared/ui/Field.tsx`, `formatName`/`formatDexNumber` from `src/shared/lib/format.ts`). Search the baked `allSpecies` (no `usePokemonIndex` / runtime PokeAPI calls). Don't edit or import `src/features/team-builder` — stream 2-home deletes it. A filter mode (controlled query string the collection grid filters by) and a pick mode (`onSelect(speciesId)`) so capsules/team can reuse it later. Export from `src/features/pokemon-search/index.ts`.
2. **`src/widgets/talent-tree`** — `TalentTree` (design.md component `TalentTree`), self-contained and presentational: takes nodes (id, name, description, branch/group, tier or position, prerequisite names, state `learned | available | locked` + reason text), points available, `onLearn(id)`, `onReset()`, and a variant `'pokemon'` (3 branches × 4 nodes, `TALENT_BRANCHES` / `pokemonTalentsOfBranch`) or `'trainer'` (~15 nodes from `TRAINER_TALENTS` with dependency lines). Each node is a real `<button>` with `aria-pressed` (learned) and `aria-disabled` + the reason in text (never only colour); the tree is a list of groups (`role="group"` + label) and dependencies are repeated as text ("Requires: Quick Draw"). Header "N points available" and a Reset button. It must not import any other widget; it may import `@/entities/progression` and `@/shared/*`. Views map domain state to its props.
3. **`src/views/collection`** — replace the stub `CollectionPage`, rendering its own `<main id="content">` with one `h1` "Collection":
   - "Collection N / `SPECIES_COUNT`" with a progress bar (`role="progressbar"`, `aria-valuenow/min/max`); dust chip (`save.dust`).
   - Filters as native controls: owned / missing / all, type (18 types from the species data), rarity (`RARITIES`, labels `RARITY_LABEL`), generation; sort by level / rarity (`rarityRank`) / dex number; search via `PokemonSearch` in filter mode.
   - Grid: owned → holo mini-card (art, name, `Lv N`, ★ count, a dot when `talentPointsAvailable(owned) > 0`), missing → type-coloured silhouette with "Craft · `craftPrice(rarity)` dust". Compose the card in your view from `CreatureArt` (`@/widgets/capsule-reveal`) and `RARITY_FRAME` / `RARITY_LABEL` (`@/entities/capsule`); rarity always has a text label. Each tile is a `next/link` to `/creature/?id=<id>` (literal path with trailing slash) whose accessible name is "Pikachu, level 12, 2 stars" or "Missing: Mewtwo" — the grid is a list of links.
   - 1025 entries must stay fast: paginate ("Show more" button, page size a local UI constant, not a game number) or virtualise; don't render 1025 artwork images at once (lazy images, `loading="lazy"` via `CreatureArt` props if it supports it, otherwise only mount visible pages). Memoise filtering/sorting.
   - States, copy verbatim: loading shimmer while `useSaveStatus().status === 'loading'`; empty filter "No Pokémon match these filters" + button "Clear filters"; sprite error → silhouette with retry (`CreatureArt` already does it).
   - Persisting filter choice is optional and only via URL query params read per the rule below (no new storage keys).
4. **`src/views/creature`** — replace the stub `CreaturePage` (route `/creature/?id=N`; reference `docs/product/prototype/creature.dc.html`). Read `id` with `useSearchParams` in a child rendered only after `useHydrated()`. One `h1` = the Pokémon's name.
   - Large holo card with tilt (`usePointerTilt` from `src/shared/lib/usePointerTilt.ts`, which already respects reduced motion) and type badges; art via `CreatureArt`, rarity frame + label.
   - `Lv x / levelCap(stars)`, XP bar to `xpToNextLevel(species, level)` (`role="progressbar"`); at the cap (`isAtLevelCap`): "Level cap 20. Earn ★3 to raise it." (numbers computed); stars ★★☆☆☆ with "2 more duplicates to ★3" from `dupesForNextStar(stars)` − `dupes` (hide at `economy.pokemon.maxStars`).
   - Stats base → current from `statBreakdown(species, owned)` (base, formula, talent bonus, nature up/down); when a talent change alters a stat, announce it in a `role="status"` region ("Attack 54 → 60").
   - TalentTree (`variant="pokemon"`): node state from `pokemonTalentNodeState(owned, id)` (reason copy in the JSDoc of `src/entities/progression/model/talentRules.ts`: "First talent point at Lv 5" when no talents yet, "Next point at Lv 10", "Requires: <name>"), points from `talentPointsAvailable`; learn with `updateSave((s) => …learnPokemonTalent(s.collection[key], id)…)`, free Reset with `resetPokemonTalents`. Write the owned Pokémon back into `collection` immutably inside the same `updateSave`.
   - Moves (as in the prototype): show the battle moveset if it is cheap with `@/entities/battle` (`loadMovesets` + `movesFor`/`selectMoves` — read their signatures); otherwise omit the section and say so in the report.
   - Primary "Add to team" / "In team ✓": add with `updateSave` only while `save.team.length < teamSlots(save.trainer.level)` and the id is not already there; full team → disabled button with the reason and the text "Team is full. Edit your team on the Ladder to swap." plus a link to `/ladder/` (the Home team strip is read-only; the team dialog belongs to 2-play — don't build one).
   - Unowned: silhouette, rarity label, "Craft for `craftPrice` dust" via `useCraft().craft(speciesId)` from `@/features/open-capsule` (returns `CraftCommit`; it saves before returning), or disabled (`aria-disabled` + reason) "Need N more dust" (`dustMissing`). After a successful craft show `CapsuleReveal` (`@/widgets/capsule-reveal`) with `results={[result]}`, `primaryLabel="Done"`; on `reason: 'notLoaded' | 'failed'` show "Couldn't craft. Try again".
   - Invalid / unknown id (`getSpecies` returns nothing, non-numeric, out of range): "No Pokémon #<id>" + link to `/collection/`. Loading: skeleton.
   - Prev / next links (`/creature/?id=N±1`, wrapping or disabled at the ends, by dex number).
5. **`src/views/trainer`** — replace the stub `TrainerPage`, one `h1` "Trainer":
   - Inline rename of `trainer.name`: a labelled field, Enter saves (trimmed, 1–24 chars like the schema; invalid → inline error, nothing saved), Esc cancels and restores focus to the name button.
   - Level + XP bar (`xpToNextTrainerLevel`), unlock timeline from `trainerTimeline()` (render each `TrainerUnlock` with a readable label; mark reached ones by `trainer.level`, `aria-current` on the next one from `nextUnlock`).
   - Trainer TalentTree (`variant="trainer"`): node state from `trainerTalentNodeState(save, id)` (copy: "Requires Trainer Lv 6", "Requires: Quick Draw" with names via `getTrainerTalent`, "Next point at Lv 9" from `nextPointAt`), points `trainer.talentPoints`; primary "Learn talent" calls `updateSave((s) => { const r = learnTrainerTalent(s, id); return r.ok ? r.save : s; })`; "Reset tree" asks for confirmation (`src/shared/ui/Dialog`) then `resetTrainerTalents`.
   - Loading skeleton; errors fall to the existing error boundary.

## Context

- Project goal: turn Trainer Studio into a free, single-player collection auto-battler — open capsules, level up Pokémon and the trainer, fight a PvE ladder in 3D; no money, no accounts, no server, progress in IndexedDB.
- Read first: `CLAUDE.md`, `docs/plan/PLAN.md` (contracts + who owns what), `docs/product/idea.md` (Must #4, #5, #7), `docs/product/design.md` (screens `collection`, `creature`, `trainer`, Components `HoloCard` / `TalentTree` / `PokemonSearch`, Tokens, Accessibility), `docs/product/prototype/creature.dc.html`, `src/shared/ui/*` (Button, Dialog, Field, Spinner, ErrorBoundary), `src/shared/lib/{usePointerTilt,motion,useHydrated,format}.ts`, `src/views/battle/BattlePage.tsx` (`SetupWithQuery` pattern), `src/views/capsules/**` (read only: how a wave-1 view composes `CreatureArt`, `CapsuleReveal`, `useCraft`), `src/features/team-builder/ui/PokemonCombobox.tsx` (read only).
- Contracts and merged APIs you build against (do NOT modify):
  - `src/entities/save/index.ts` (import only from here): `useSave`, `useSaveStatus`, `getSave`, `updateSave`, `applyGameEvents`, `Save`, `OwnedPokemon`. Tests reset the store with `__resetSaveStoreForTests` from `@/entities/save/model/store` and build saves with `createNewSave`. `src/entities/save/model/{schema,store,events}.ts` and `src/entities/save/persistence/**` are read-only.
  - `src/entities/progression/index.ts`: `levelCap`, `isAtLevelCap`, `xpToNextLevel`, `talentPointsAvailable`, `nextPokemonTalentPointLevel`, `computeStats`, `statBreakdown`, `STAT_KEYS`, `TALENT_BRANCHES`, `pokemonTalentsOfBranch`, `getPokemonTalent`, `getTrainerTalent`, `POKEMON_TALENTS`, `TRAINER_TALENTS`, `learnPokemonTalent`, `resetPokemonTalents`, `pokemonTalentNodeState`, `learnTrainerTalent`, `resetTrainerTalents`, `trainerTalentNodeState`, `teamSlots`, `teamSlotUnlockLevel`, `xpToNextTrainerLevel`, `trainerTimeline`, `unlocksAt`, `nextUnlock`, `nextTrainerTalentPointLevel`.
  - `src/entities/capsule/index.ts`: `craftPrice`, `dustMissing`, `dupesForNextStar`, `isOwned`, `speciesRarity`, `RARITY_FRAME`, `RARITY_LABEL`, `RARITY_TEXT_CLASS`, `rarityRank`, `RevealResult`; `src/features/open-capsule/index.ts`: `useCraft` (returns `{ craft }`; `craft(speciesId)` returns `CraftCommit`); `src/widgets/capsule-reveal/index.ts`: `CapsuleReveal`, `CreatureArt` (compose them in views only).
  - `src/entities/pokemon/index.ts`: `allSpecies`, `getSpecies`, `SPECIES_COUNT`, `Species` (id, name, types, stats, generation, rarity), `getCreatureArt`, `typeColor`, `TypeBadge`.
  - `src/entities/battle/index.ts` (optional, moves only): `loadMovesets`, `movesFor`, `selectMoves`.
  - `src/shared/config/economy.ts` (`economy.pokemon.maxStars`, `RARITIES`, everything numeric), `src/shared/lib/rng.ts` (`hashSeed`, `createRng` — you should not need randomness).
  - `app/layout.tsx` (skip link, AppNav, providers), `src/app/providers/SaveProvider.tsx`, `app/{collection,creature,trainer}/page.tsx` (already render your views).
- Stubs prepared for you: `src/views/collection/{CollectionPage.tsx,index.ts}`, `src/views/creature/{CreaturePage.tsx,index.ts}`, `src/views/trainer/{TrainerPage.tsx,index.ts}`.
- Rules for every file you write:
  - Contracts are read-only; if one is missing something, escalate.
  - Every game number comes from `economy.ts` or the progression/capsule helpers; no magic numbers (UI constants like page size are fine).
  - Randomness only via `hashSeed`/`createRng`; never `Math.random()`.
  - Art only via `getCreatureArt` / `CreatureArt`.
  - Save only via `useSave` / `updateSave`; if a domain call returns `GameEvent`s, apply them with `applyGameEvents` inside the same `updateSave`.
  - Each view renders its own `<main id="content">` with exactly one `h1`.
  - Query params via `useSearchParams` only inside a component rendered after `useHydrated()` is true — never `<Suspense>`.
  - Widgets never import other widgets: compose `CreatureArt`, `CapsuleReveal` and `TalentTree` in views.
  - If you show quests, call `refreshQuests`/`questBoard` with a fresh `Date.now()` at call time (not memoised).
- Design (`docs/product/design.md`, `ui-language: en`): implement screens `collection`, `creature` and `trainer` exactly as specified there — every listed state, copy verbatim (in its `ui-language`), per-screen accessibility notes, components from its Components table. Visual reference: `docs/product/prototype/creature.dc.html` for `creature` (collection and trainer were not prototyped: build them in the same style) — match its layout and hierarchy with the template's primitives and theme; design.md wins where they differ; don't copy the HTML into the app.

## You own (edit ONLY these paths)

- `src/views/collection/**` (incl. `src/views/collection/**/*.test.tsx`)
- `src/views/creature/**` (incl. `src/views/creature/**/*.test.tsx`)
- `src/views/trainer/**` (incl. `src/views/trainer/**/*.test.tsx`)
- `src/widgets/talent-tree/**` (incl. `src/widgets/talent-tree/**/*.test.tsx`)
- `src/features/pokemon-search/**` (incl. `src/features/pokemon-search/**/*.test.ts(x)`)
- Tests sit next to the file they test (`CollectionPage.test.tsx` beside `CollectionPage.tsx`). Vitest globals are off (import `describe`, `it`, `expect`); component tests start with `// @vitest-environment jsdom`.

## Environment notes

- GitHub: if `gh` says the repo is not found, the active gh account is a different one. Run that one command with the owner's token: `GH_TOKEN="$(gh auth token --user edgergard)" gh pr create --repo edgergard/trainer-studio ...`. Never run `gh auth switch`.
- Env: no env file — use mocks/defaults. In the report, say whether you exercised the real services or mocks.
- Browser checks (web): `npm run dev` may return 500 from background shells on Windows (Turbopack CSS worker), and `next start` does not work with static export. Use `npm run build` then `npm run preview -- 3201`, and drive it with the project's Playwright CLI: `npx playwright cli open http://localhost:3201`, then `snapshot` / `click` / `screenshot` (see `.claude/skills/playwright-cli`; it uses the installed Chrome — don't install browsers). Close only your own browser with `npx playwright cli close` and stop the preview you launched when done; never `kill-all` or `close-all` (they hit other streams' browsers). On Windows stopping the background `npm run preview` leaves its child `node scripts/serve-out.mjs 3201` listening: find it with `Get-NetTCPConnection -LocalPort 3201` and stop that PID (L-050/L-051). Don't install global tools; if the browser can't run, say so in the report — the orchestrator smoke-tests in Phase 5. A fresh save owns little: to see owned/talent states in the browser, seed a save temporarily (e.g. import a save file in Settings), never commit seeding code.

## Known pitfalls

- Never chain checks through a pipe before commit: run `npm run check`, test its exit code, commit only on 0 (L-024).
- Persisted keys are fixed by the save schema contract; you can't add keys (no saved filters, no "seen" flags) — escalate (L-027).
- jsdom tests can pass while the real DOM misses state: expose state with aria-* (talent `aria-pressed`/`aria-disabled`, progressbar values, disabled craft/Add to team) and check it in the browser (L-007).
- Run `prettier --write` on files you edit before committing; `format:check` is part of `npm run check` (L-014).
- jsdom lacks `<dialog>.showModal` and `matchMedia`: copy the idea of `polyfillDom` from `src/widgets/capsule-reveal/ui/testDom.ts` into your own test helper — don't import it across slices (L-047).

## You must NOT

- Edit files outside your ownership — including package.json, lockfile, root layout, route registry, env schema, contracts, CI, `.claude/`, `docs/plan/`.
- Add dependencies (escalate instead).
- Merge into `dev`, force-push, `git reset --hard`, or touch other `stream/*` branches.
- Rebase after your branch has been pushed (use `git merge` instead).

## Escalation

If you need a contract change, a shared-file edit, a new dependency, or you are blocked: stop, commit what you have, push (GitHub mode), and finish your turn with the standard report using `STATUS: escalation` and an `ESCALATION:` line saying exactly what you need and why. Do not work around it. The orchestrator will change `dev` and tell you to integrate it.

## Acceptance criteria

- [ ] Collection shows "Collection N / `SPECIES_COUNT`" with a progressbar, owned mini-cards (Lv, ★, talent-point dot) and missing silhouettes with the craft price; owned/missing, type, rarity, generation filters, level/rarity/dex sort and search all narrow/reorder the grid; "No Pokémon match these filters" + "Clear filters" resets them; tiles are links named "Pikachu, level 12, 2 stars" / "Missing: Mewtwo".
- [ ] All 1025 entries reachable without rendering 1025 images at once (pagination or virtualisation); filtering stays responsive.
- [ ] Creature page for an owned Pokémon: tilt card, Lv x/cap + XP bar, stars + dupes to next star, cap message at the cap, stats base → current matching `statBreakdown`, talent learn/reset via `learnPokemonTalent`/`resetPokemonTalents` with node states from `pokemonTalentNodeState` and the stat change announced; Add to team respects `teamSlots(trainer.level)`, "In team ✓" when present, full-team message with a link to the Ladder.
- [ ] Creature page for an unowned species crafts via `useCraft` (reveal shown with `CapsuleReveal`) or shows disabled "Need N more dust"; invalid id shows "No Pokémon #<id>" + Collection link; prev/next work; `?id` read only after `useHydrated()`.
- [ ] Trainer page: rename (Enter saves 1–24 chars, Esc cancels), level + XP, unlock timeline from `trainerTimeline()`, trainer tree with locked/available/learned + reasons, Learn talent spends a point, Reset tree asks for confirmation and refunds.
- [ ] `PokemonSearch` is an accessible combobox over `allSpecies` with owned/unowned/all modes, keyboard-operable (arrows, Enter, Esc), used by the collection; `TalentTree` imports no other widget.
- [ ] Tests cover collection filtering/sorting/search and empty state, creature talent learn/reset + team add + full team + craft paths + invalid id, trainer rename/learn/reset, `PokemonSearch` modes and keyboard, `TalentTree` states.
- [ ] `npm run check` passes in this worktree
- [ ] UI (if any): uses design tokens, `cursor: pointer` / accessibility labels, visible focus, works at mobile and desktop widths (web)
- [ ] If you run a server, use your port: `npm run preview -- 3201` after `npm run build` (web). Stop it (and its child node process) when done.

## Definition of done

1. All acceptance criteria met; `npm run check` passes.
2. Get the latest `dev`:
   - before your first push: `git fetch origin && git rebase origin/dev`;
   - after your branch has been pushed: `git fetch origin && git merge origin/dev` (never rebase).
     Then `npm ci` if package-lock.json changed, and re-run `npm run check`.
3. Conventional commits, only files in your ownership.
4. GitHub mode: `git push -u origin stream/2-collection`, then `gh pr create --base dev` (body: what changed / how to verify). Do NOT merge it. Later pushes: plain `git push`.
5. Finish your turn with the report below. If the orchestrator later sends feedback, fix it, re-run checks, push, and report again in the same format.

## Report format (your final message)

STATUS: done | partial | escalation
BRANCH: stream/2-collection PR: <url or none> HEAD: <short sha>
ESCALATION: <need + why — only when STATUS is escalation>
DONE: <bullets>
NOT DONE / KNOWN ISSUES: <bullets>
CHECKS: <command → result>
FILES CHANGED OUTSIDE OWNERSHIP: none | <list with reason>
