# Stream 1-engine: N×N battle engine and 3D arena

You are one of several agents building Trainer Studio in parallel. Each agent works in its own git worktree and branch. The orchestrator reviews your branch and merges it into `dev`.

## Your branch

`stream/1-engine` (already checked out in this worktree, based on `dev`).
Mode: GitHub remote `origin` (repo `edgergard/trainer-studio`).
Your dev-server port: 3102.

## Setup (do first)

1. `npm ci` (never `npm install`). If package-lock.json then shows as modified, `git checkout -- package-lock.json`.
2. Run `npm run check` once to confirm a green baseline. If it is red before you changed anything, report `STATUS: escalation`.
   Run `npm ci` again whenever integrating `dev` changes package-lock.json.

## Task

Turn the existing watch-only battle (fetched Pokémon, fixed level 50) into the game's battle engine and arena for Must #1 (scripted onboarding win) and Must #6 (PvE ladder battles): design.md screen `battle`, flow `first-visit` steps 3–4 and flow `loop` steps 1–2. Wave 2 (stream 2-play) builds the battle route, preview, rewards and ladder on top of your API, so the API must be clean, typed and exported from `src/entities/battle/index.ts` and `src/widgets/battle-arena/index.ts`.

1. **N×N teams, 1–4 fighters per side.** `simulateBattle` (`src/entities/battle/model/simulate.ts`) already plays a team as active + bench in order; make it explicitly support 1×1 … 4×4. Require equal team sizes (throw a clear error on unequal or empty teams, or more than 4) and document the rule in a JSDoc on the function.
2. **Fighters from baked species, no fetching.** Add a builder in `src/entities/battle/model/` (e.g. `buildFighter.ts`) taking `{ species, level, stats, moves source, side, slot, badges: { stars, talentIcons } }` and returning a `Fighter`:
   - `species` is `Species` from `@/entities/pokemon` (`src/entities/pokemon/model/species.ts`); moves come from movesets.json by `species.slug` via the existing `movesFor(data, slug)` in `src/entities/battle/model/prepare.ts`. Pass the `MovesetData` in (callers get it from `loadMovesets()` in `src/entities/battle/api/movesets.ts`) so the JSON stays a lazy chunk. A species with no moveset still fights (existing `FALLBACK_MOVE` in `damage.ts`).
   - `stats: BattleStats` are already computed by the caller (stream 1-progression owns the level/IV/nature/talent formula); the builder must not recompute them. `statsAtLevel` stays exported for the old setup path and tests.
   - `artwork` via `getCreatureArt(species.id, 'artwork')` from `@/entities/pokemon` — never build URLs.
   - Extend `Fighter` (`src/entities/battle/model/types.ts`) with `level: number`, `badges: { stars: number; talentIcons: TalentBranch[] }` (`TalentBranch` type-only from `@/entities/progression`, matching the talent branches offense / defense / tempo in `src/entities/progression/model/talents.ts`), and optional talent modifiers the engine honours: `critChanceBonus?: number` (percent points added to the base crit chance in `damage.ts`) and `firstStrike?: boolean` (acts first in its first turn on the field, regardless of speed; if both actives have it, fall back to the normal speed order). These mirror `TalentEffect` kinds `critChance` and `firstStrike`; the caller folds talents into these fields, the engine only reads them (stream 1-progression's `talentModifiers()` returns `{ critChance, firstStrike }` and its `computeStats()` returns `Record<StatKey, number>`, the same shape as `BattleStats`; wave 2 maps them onto the builder — don't import `@/entities/progression` at runtime, type-only imports of contract types only).
   - Keep `toFighter` / `prepareTeam` working (or adapt them minimally) until wave 2 deletes `src/features/battle-setup`.
3. **Intro seed.** Simulation stays deterministic and seeded (`createRng` from `./rng`, seeds from `hashSeed` in `src/shared/lib/rng.ts`; never `Math.random()`). Add `findIntroSeed(red, blue)` (name may differ, export it): deterministic search over `hashSeed('intro', n)` for n = 0, 1, 2, … up to a documented search bound (a constant in the battle model, not a game number), returning the first seed for which red wins by knockout. If none wins within the bound, throw a typed error; say in the report which kinds of matchups can fail so 2-play/2-home pick the loaner (`economy.onboarding.loanerLevel`) and rival (`economy.onboarding.rivalLevel`) sensibly. The onboarding battle (1×1) must play about 25 s at 1× (flow `first-visit` step 3); if the chosen seed's playback is far off, prefer the first winning seed whose turn count lands near that target and document the rule.
4. **Result object.** `simulateBattle` returns (in addition to `events`) a result with `winner`, `turns`, `reason`, `redDamageDealt` (total damage dealt by red — wave 2 feeds it into the `damageDealt` game event, `src/entities/save/model/events.ts`, for the `deal-damage` quest in `economy.quests.pool`) and per-fighter damage (the existing `FighterSummary` in `src/entities/battle/model/events.ts` is fine to reuse). Update all callers inside your ownership.
5. **Arena widget** (`src/widgets/battle-arena/**`, component table row `BattleArena` in design.md):
   - N×N layout for 1–4 cards per side in the 3D stage (`stage/layout.ts` `slotPosition` / `slotYaw`, `stage/BattleStage.ts`, `stage/director3d.ts`, `stage/cameraRig.ts`) and in the text fallback (`LogStage` in `ui/BattleArena.tsx`, `ui/BattleLog.tsx`), readable in portrait (375 px) and landscape.
   - Keep ×2 and Replay (same seed) in `ui/Hud.tsx`; add **Skip to result** as a real labelled `<button>`: in intro mode available after 5 s (disabled with visible reason or hidden until then), always available otherwise. Skip jumps the playback to the end state and fires `onFinished` once.
   - Badges on HUD cards: `Lv N`, ★ count (as text, e.g. "★3", with an accessible label), and a row of talent icons (lucide icons with `aria-label`/sr-only text per branch). Same badges available on the 3D card texture if cheap (`stage/cardTexture.ts`); HUD is required.
   - Result slot: the arena takes a render prop or children for the result overlay (e.g. `renderResult(result, { replay })`), so wave 2 renders rewards, quest ticks and hints. Keep the current `ResultOverlay` as the default when no render prop is given. Add `onFinished(result)` called once when the battle's playback ends (or on Skip). Add an `intro?: boolean` prop (Skip delay) and drop or make optional `onNewBattle`.
   - Keep: the three error notices (`NOTICE` in `ui/BattleArena.tsx`, `model/session.ts`), the WebGL2 fallback to the text battle, GPU context-loss handling and resume, pause-when-hidden, the live region and the collapsible log, reduced-motion behaviour.
6. **Lint:** fix every `react-hooks/*` warning in `src/widgets/battle-arena` (`npx eslint src/widgets/battle-arena` shows 10 today: `react-hooks/refs`, `react-hooks/set-state-in-effect`, `react-hooks/exhaustive-deps`, e.g. the ref read during render in `Hud.tsx` around line 233 and the `speed` dependency around line 303) without behaviour changes. You may not edit `eslint.config.mjs`; say in the report that the orchestrator can remove the `TODO(stream 1-engine)` override there.
7. **Compile-only adaptations:** if your API changes break `src/views/battle/**` or `src/features/battle-setup/**`, prefer keeping the old call signatures working; otherwise make the minimal edits that keep them compiling and the current page working (no redesign — wave-2 stream 2-play owns and rewrites both; no wave-1 stream touches them) and list every such file under `FILES CHANGED OUTSIDE OWNERSHIP` in the report.

## Context

- Project goal: a free, single-player collection auto-battler (Next.js static export): open capsules, level up Pokémon and your trainer, send your own collection into deterministic 3D card battles on a PvE ladder. Progress lives in IndexedDB.
- Read first: `CLAUDE.md`, `docs/plan/PLAN.md` (contracts + who owns what), `docs/product/idea.md` (Must #1, #6, #7), `docs/product/design.md` (screen `battle`, flows `first-visit` and `loop`, Components → BattleArena, Accessibility), then the existing code: `src/entities/battle/model/*` (`simulate.ts`, `prepare.ts`, `stats.ts`, `types.ts`, `damage.ts`, `events.ts`), `src/entities/battle/api/movesets.ts`, `src/widgets/battle-arena/**` (`ui/BattleArena.tsx`, `ui/Hud.tsx`, `ui/ResultOverlay.tsx`, `ui/BattleLog.tsx`, `model/useBattlePlayback.ts`, `model/hudState.ts`, `stage/director3d.ts`, `stage/BattleStage.ts`, `stage/layout.ts`), `src/views/battle/BattlePage.tsx`, `src/features/battle-setup/**`.
- Contracts you build against (do NOT modify): `src/entities/save/model/**` + `src/entities/save/index.ts` (`useSave` / `updateSave` / `replaceSave`; `GameEvent`; `src/entities/save/persistence/**` is stream 1-save's), `src/shared/config/economy.ts` (`economy.onboarding.loanerLevel`, `economy.onboarding.rivalLevel`, `economy.battle.rivalLevel`, `economy.quests.pool` `deal-damage`), `src/shared/lib/rng.ts` (`createRng`, `hashSeed`), `src/entities/battle/model/rng.ts` (re-export — don't touch), `src/entities/pokemon/model/species.ts` + `art.ts` + `index.ts` (`Species`, `getSpecies`, `getSpeciesBySlug`, `getCreatureArt`), `src/entities/progression/model/talents.ts` (`TalentBranch`, `TalentEffect`), `src/app/providers/SaveProvider.tsx`, `app/layout.tsx`.
- Stubs prepared for you: none (you extend existing code). Your engine and widget don't touch the save; wave 2 records results.
- Design: implement screen `battle` (arena phase) and flows `first-visit` steps 3–4 and `loop` steps 1–2 exactly as specified in `docs/product/design.md` — every listed state (loading "Preparing arena", error notices + Retry, GPU loss, no-WebGL text battle), copy verbatim in English, per-screen accessibility notes (Skip is a real labelled button; the result is announced in one phrase and focus moves to the main button), components from its Components table. Visual reference: `docs/product/prototype/battle.dc.html` — match its layout and hierarchy with the project's primitives and theme tokens (`src/app/styles.css`); design.md wins where they differ; don't copy the HTML into the app.
- Rules: all game numbers from `economy.ts`; randomness only via `hashSeed`/`createRng`; art only via `getCreatureArt`. Views render their own `<main id="content">` (the layout has the skip link); query params via `useSearchParams` only after `useHydrated()` — never `<Suspense>` for that.

## You own (edit ONLY these paths)

- `src/entities/battle/**` except `src/entities/battle/model/rng.ts` (including tests beside the code, e.g. `src/entities/battle/model/simulate.test.ts`, `src/entities/battle/model/buildFighter.test.ts`, `src/entities/battle/model/intro.test.ts`)
- `src/widgets/battle-arena/**` (including tests beside the code, e.g. `src/widgets/battle-arena/stage/layout.test.ts`, `src/widgets/battle-arena/ui/Hud.test.tsx`, `src/widgets/battle-arena/ui/BattleArena.test.tsx`)
- Not owned (wave-2 stream 2-play's paths), compile-only edits allowed per task step 7 and reported under `FILES CHANGED OUTSIDE OWNERSHIP`: `src/views/battle/**`, `src/features/battle-setup/**`
- Tests sit next to the file they test (`*.test.ts` / `*.test.tsx`); component tests start with `// @vitest-environment jsdom`; Vitest globals are off (import `describe`, `it`, `expect`).

## Environment notes

- GitHub: if `gh` says the repo is not found, the active gh account is a different one. Run that one command with the owner's token: `GH_TOKEN="$(gh auth token --user edgergard)" gh pr create --repo edgergard/trainer-studio ...`. Never run `gh auth switch`.
- Env: no env file — none is needed (species and movesets are baked; art URLs are public). In the report, say whether you exercised the real services or mocks.
- Browser checks (web): `npm run dev` may return 500 from background shells on Windows (Turbopack CSS worker). Use `npm run build` then `npx next start --port 3102`, and drive it with the project's Playwright CLI: `npx playwright cli open http://localhost:3102`, then `snapshot` / `click` / `screenshot` (see `.claude/skills/playwright-cli`; it uses the installed Chrome — don't install browsers). Close only your own browser with `npx playwright cli close` and stop the `next start` you launched when done; never `kill-all` or `close-all` (they hit other streams' browsers). Don't install global tools; if the browser can't run, say so in the report — the orchestrator smoke-tests in Phase 5.

## Known pitfalls

- Never chain checks through a pipe before commit: run `npm run check`, test its exit code, commit only on 0 (L-024).
- jsdom tests can pass while the real DOM misses state: expose state (Skip availability, speed, finished) with `aria-*` and check it in the browser (L-007).
- Run `prettier --write` on files you edit before committing; `format:check` is part of `npm run check` (L-014).

## You must NOT

- Edit files outside your ownership — including package.json, lockfile, root layout, route registry, env schema, contracts, CI, `.claude/`, `docs/plan/`, `eslint.config.mjs`.
- Add dependencies (escalate instead).
- Merge into `dev`, force-push, `git reset --hard`, or touch other `stream/*` branches.
- Rebase after your branch has been pushed (use `git merge` instead).

## Escalation

If you need a contract change, a shared-file edit, a new dependency, or you are blocked: stop, commit what you have, push (GitHub mode), and finish your turn with the standard report using `STATUS: escalation` and an `ESCALATION:` line saying exactly what you need and why. Do not work around it. The orchestrator will change `dev` and tell you to integrate it.

## Acceptance criteria

- [ ] `simulateBattle` runs 1×1, 2×2, 3×3 and 4×4 deterministically (same seed → same events and result); unequal, empty or >4 teams throw a clear error.
- [ ] A fighter can be built from a `Species`, level, caller-computed stats, movesets by `species.slug`, side, slot and badges, with artwork from `getCreatureArt`; no network calls.
- [ ] `critChanceBonus` raises the crit rate and `firstStrike` makes a slower fighter act first in its first turn; both are optional and absent fighters behave exactly as before.
- [ ] `findIntroSeed` deterministically returns a `hashSeed('intro', n)` seed for which red wins; the search bound and failure behaviour are documented.
- [ ] The result exposes `winner`, `turns`, `reason`, red's total damage dealt and per-fighter damage.
- [ ] The arena shows 1–4 cards per side in 3D and in the text fallback, in portrait (375 px) and landscape; HUD cards show Lv, ★ count and talent icons with text alternatives.
- [ ] ×2, Replay and Skip to result work; in intro mode Skip becomes available after 5 s, otherwise always; `onFinished(result)` fires exactly once (end of playback or Skip); a render prop/children replaces the default result overlay.
- [ ] Error notices, WebGL2 fallback, GPU-loss handling, pause-when-hidden, live region and log still work.
- [ ] `npx eslint src/widgets/battle-arena` reports zero `react-hooks/*` warnings, with no behaviour change.
- [ ] Tests cover: simulate for 1×1..4×4, intro seed always wins (across a sample of species pairs at the onboarding levels), modifiers applied, damage totals (red total = sum of red fighters' `damageDealt` = sum of hit damage by red).
- [ ] `npm run check` passes in this worktree
- [ ] UI: uses design tokens, `cursor: pointer` / accessibility labels, visible focus, works at mobile and desktop widths
- [ ] If you run a dev server, use your port: `npm run dev -- --port 3102`. Stop it when done.

## Definition of done

1. All acceptance criteria met; `npm run check` passes.
2. Get the latest `dev`:
   - before your first push: `git fetch origin && git rebase origin/dev`;
   - after your branch has been pushed: `git fetch origin && git merge origin/dev` (never rebase).
     Then `npm ci` if package-lock.json changed, and re-run `npm run check`.
3. Conventional commits, only files in your ownership.
4. GitHub mode: `git push -u origin stream/1-engine`, then `gh pr create --base dev` (body: what changed / how to verify). Do NOT merge it. Later pushes: plain `git push`.
5. Finish your turn with the report below. If the orchestrator later sends feedback, fix it, re-run checks, push, and report again in the same format.

## Report format (your final message)

STATUS: done | partial | escalation
BRANCH: stream/1-engine PR: <url or none> HEAD: <short sha>
ESCALATION: <need + why — only when STATUS is escalation>
DONE: <bullets>
NOT DONE / KNOWN ISSUES: <bullets>
CHECKS: <command → result>
FILES CHANGED OUTSIDE OWNERSHIP: none | <list with reason>
