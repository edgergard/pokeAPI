# Stream 3-glue: close the acceptance gaps

You are the last stream of the Trainer Studio build. You work in your own git worktree and branch; the orchestrator reviews your PR and merges it into `dev`. No other stream runs in parallel.

## Your branch

`stream/3-glue` (create it from `origin/dev` in your worktree). Mode: GitHub remote `origin` (repo edgergard/trainer-studio). Dev-server port: 3301.

## Setup (do first)

1. `npm ci` (never `npm install`). If package-lock.json then shows as modified, `git checkout -- package-lock.json`.
2. Run `npm run check` once to confirm a green baseline. If it is red before you changed anything, stop and report `STATUS: escalation`.

## Task

The acceptance check found these gaps. Fix all of them:

1. **Level-up after a quest claim (major, Must #5).** `src/views/home/ui/HubQuests.tsx` (`TODO(2-play)`): when `claimQuest` returns trainer levels gained, open `LevelUpDialog` from `@/widgets/level-up` exactly like the battle result does (`src/views/battle/ui/StageBattle.tsx` / `StageResult.tsx` show how). Its "Fill slot N" action must open `TeamDialog` from `@/widgets/team-dialog` on Home with the new slot pulsing; "See quests" focuses the quest list; "Learn talent" goes to `/trainer/`. Compose both widgets in the home view (widgets never import widgets).
2. **Edit team on Home (minor).** `src/views/home/ui/HubSections.tsx` (`TODO(2-play)` ~158): "Edit team" opens `TeamDialog` on Home instead of linking to `/ladder/`.
3. **Rival preview on the next-stage card (minor).** `HubSections.tsx` (`TODO(2-play)` ~117): show the next stage's rival name, team mini-sprites (via `getCreatureArt`) and first-clear reward from `@/entities/ladder` (`stageInfo`, `nextStageToFight`, `isLadderComplete`); all-cleared state per design.md ladder copy.
4. **One next-stage helper (minor).** Replace the local `min(cleared + 1, ladderStages)` in `src/views/home/model/hub.ts` and `src/widgets/app-nav/model/nav.ts` with `nextStageToFight` / `isLadderComplete` from `@/entities/ladder`; remove the `TODO(2-play)` comments.
5. **Persist for players who skipped onboarding (minor).** Call `requestPersist()` (from `@/entities/save`, once per page load already) after a successful Import and after Export in `src/views/settings/ui/SaveSection.tsx`, and once on the Home hub mount when onboarding is `done` (covers v1/imported players).
6. **Every ladder stage is winnable (major, Must #6 "done when all stages are passable").** Add `src/entities/ladder/model/passability.test.ts`: build the strongest team a dedicated player can reach for each stage — Pokémon at the level cap a reasonable star count allows by then (document the assumption: e.g. stars 1→5 spread over the ladder, trainer level from cumulative economy rewards, best species of the rarities the player can own), learned talents — and simulate it against `stageInfo(stage)` over several seeds with the real engine (`simulateBattle`, fighters built like `src/views/battle/model/fighters.ts`). Require a win rate ≥ 50% on every stage. If a stage fails, tune `economy.battle.rivalLevel` and/or `economy.battle.rivalRarities` in `src/shared/config/economy.ts` (you own only those two keys for this stream) until it passes, and keep stage 1 fair for a fresh Lv 1 Pokémon (≥ 50% too). Report the final win rates per stage.

## Context

- Read first: `CLAUDE.md`, `docs/plan/PLAN.md` (contracts, log), `docs/product/design.md` (screens home, ladder, level-up, team).
- Contracts are read-only except the two economy keys named in task 6. Numbers from `economy.ts`; randomness only via `hashSeed`/`createRng`; save only via `useSave`/`updateSave` (apply returned GameEvents with `applyGameEvents` in the same update).
- Tests sit beside the code; component tests start with `// @vitest-environment jsdom`.
- Browser check: `npm run build`, then `npm run preview -- 3301`, drive with the playwright-cli skill (`.claude/skills/playwright-cli`); stop the preview and its child node process by port when done (L-050/L-051).

## You own (edit ONLY these paths)

- `src/views/home/**`, `src/widgets/app-nav/**`, `src/views/settings/ui/SaveSection.tsx` (+ its tests), `src/entities/ladder/**`
- `src/shared/config/economy.ts` — only `battle.rivalLevel` and `battle.rivalRarities`

## Known pitfalls

- Never pipe `npm run check` before a commit; test its exit code, commit only on 0 (L-024).
- Persisted keys are fixed by the save schema; you can't add keys (L-027).
- Expose state with `aria-*` and check it in the real DOM, not only jsdom (L-007).
- `prettier --write` the files you edit; format:check is part of `npm run check` (L-014).

## You must NOT

- Edit files outside your ownership (package.json, lockfile, app/**, src/app/**, contracts, CI, `.claude/`, `docs/plan/`).
- Add dependencies; merge into `dev`; force-push; `git reset --hard`.

## Acceptance criteria

- [ ] A quest claim that levels the trainer opens the level-up dialog; "Fill slot N" opens the team dialog on Home with the new slot pulsing (tested).
- [ ] "Edit team" on Home opens the team dialog (tested).
- [ ] The next-stage card shows rival name, mini-sprites and first-clear reward; all-cleared state (tested).
- [ ] No `TODO(2-play)` left; home and nav use `nextStageToFight`.
- [ ] `requestPersist()` after import/export and on hub mount when onboarding is done (tested).
- [ ] `passability.test.ts` proves ≥ 50% wins on all 25 stages and stage 1 with a fresh Lv 1 Pokémon; economy tuned if needed.
- [ ] `npm run check` passes.

## Definition of done

1. Acceptance criteria met; `npm run check` passes.
2. Conventional commits, only files in your ownership.
3. `git push -u origin stream/3-glue`, then `GH_TOKEN="$(gh auth token --user edgergard)" gh pr create --repo edgergard/trainer-studio --base dev --head stream/3-glue` with what changed / how to verify. Do NOT merge it. Never run `gh auth switch`.
4. Finish with the report below.

## Report format (your final message)

STATUS: done | partial | escalation
BRANCH: stream/3-glue PR: <url or none> HEAD: <short sha>
ESCALATION: <need + why — only when STATUS is escalation>
DONE: <bullets, incl. per-stage win rates>
NOT DONE / KNOWN ISSUES: <bullets>
CHECKS: <command → result>
FILES CHANGED OUTSIDE OWNERSHIP: none | <list with reason>
