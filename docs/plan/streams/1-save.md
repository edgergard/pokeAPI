# Stream 1-save: IndexedDB save, v1 migration, export/import and Settings

You are one of several agents building Trainer Studio in parallel. Each agent works in its own git worktree and branch. The orchestrator reviews your branch and merges it into `dev`.

## Your branch

`stream/1-save` (already checked out in this worktree, based on `dev`).
Mode: GitHub remote `origin` (repo `edgergard/trainer-studio`).
Your dev-server port: 3101.

## Setup (do first)

1. `npm ci` (never `npm install`). If package-lock.json then shows as modified, `git checkout -- package-lock.json`.
2. Run `npm run check` once to confirm a green baseline. If it is red before you changed anything, report `STATUS: escalation`.
   Run `npm ci` again whenever integrating `dev` changes package-lock.json.

## Task

Make the player's progress durable and portable (idea.md Must #2; design.md screen `settings`, flow `save-transfer`). When you are done, progress survives reloads in IndexedDB, v1 players get their old Pokémon imported, a save exported in one browser is fully restored by importing it in another, a damaged or newer file gives a clear error and changes nothing, an older file is migrated, and the Settings screen gives the player full control.

1. **IndexedDB persistence** — `src/entities/save/persistence/index.ts`. Replace the in-memory placeholder body of `createDefaultPersistence()` with a real `SavePersistence` (interface in `src/entities/save/model/store.ts`). Keep the exported name and a zero-argument call working, so `src/app/providers/SaveProvider.tsx` needs no change; an optional options argument for tests (clock, `localStorage` stand-in, idb store) is fine.
   - Use `idb-keyval` (already a dependency) with `createStore('trainer-studio', 'keyval')`: main key `save:v2`, backup key `save:backup`. These are the only IndexedDB keys you may use (PLAN.md "Persisted keys").
   - Debounce writes (coalesce bursts of `updateSave`, last value wins) and flush the pending write on `pagehide` / `visibilitychange` → hidden. `write()` resolves `true` once stored, `false` when it could not write.
   - If IndexedDB is unavailable or blocked (open throws, private mode, quota): `durable` reads `false`, every write resolves `false`, `load()` returns `{ kind: 'empty' }` (or the v1 migration below, which reads localStorage), and the app keeps working in memory. Never throw out of `load()`/`write()`.
   - Split the file into modules under `persistence/` as you like (e.g. `idb.ts`, `migrations.ts`, `v1.ts`, `backup.ts`); `persistence/index.ts` is its public face.
2. **Load = read → detect version → migration chain → `saveSchema.parse`** (`src/entities/save/model/schema.ts`, `SAVE_VERSION = 2`).
   - Stored doc with `version === 2` → `safeParse`; failure → `{ kind: 'error', reason }`. Unknown/garbage or `version > SAVE_VERSION` → `{ kind: 'error', reason }` (the home screen owns the error UI). Write the chain as a version-keyed map of pure step functions so a future v3 slots in; the same chain is reused by import (task 4).
   - **Migration step 0 (from v1):** when there is no `save:v2` and localStorage `trainer-studio:roster:v1` (or the older single-trainer key `trainer-studio:trainer:v1`) holds trainers, build a fresh v2 save: start from `createNewSave({ seed, now, name })` (seed derived deterministically, e.g. `hashSeed('v1', <raw roster JSON>)`; name = first trainer's "firstName lastName", trimmed to the schema's 1–24 chars, fallback "Trainer"), then `collection` = every distinct v1 Pokémon slug mapped with `getSpeciesBySlug` (skip slugs it doesn't know) as Lv 1, 1 star, `xp 0`, `dupes 0`, `talents []`, IVs (0..`IV_MAX` from economy.ts) and nature (`NATURES` from schema.ts) rolled with `createRng(hashSeed(seed, 'v1', speciesId))`; `team` = the first trainer's first mapped Pokémon (team size 1); `onboarding.step = 'done'`; `meta.migratedFromV1 = true`. Return it as `loaded` (the store then writes it). If no slug maps, treat as empty. **Never delete or rewrite the v1 keys.**
   - The v1 shapes and keys live in `src/entities/trainer/model/roster.ts` (`ROSTER_KEY`, `LEGACY_TRAINER_KEY`, `trainerSchema`, `migrateLegacy`, `loadRoster`). Read it, but copy the minimal zod shape into your own `persistence/v1.ts` instead of importing it: stream 2-home retires `entities/trainer`, and its `rosterStore` read path calls `persistRoster`, which writes and removes keys. Read-only access through a small `getItem` wrapper in try/catch.
3. **`requestPersist()`** — exported from `persistence/index.ts`: calls `navigator.storage.persist()` once (later calls return the cached promise), resolves `true`/`false` (`false` when the API is missing). Stream 2-home calls it after onboarding reaches `done`. Also export a way for Settings to read the current state (`navigator.storage.persisted()` plus the cached result) for the status line.
4. **Export / import** — `src/features/save-transfer/` (FSD feature with its own `index.ts`; `model/` for pure logic, `ui/` if you split components).
   - File envelope: `{ format: 'trainer-studio-save', schemaVersion, gameVersion, createdAt, checksum, data }`. `gameVersion` = `version` from `package.json` (JSON import), `checksum` = SHA-256 hex of `JSON.stringify(data)` via `crypto.subtle.digest`. Encode: JSON → gzip with `CompressionStream('gzip')` → base64 → download as `trainer-studio-YYYY-MM-DD.txt` (local date; `Blob` + temporary `<a download>`; static export, no server).
   - Import reverses it (base64 → `DecompressionStream` → JSON). Any decode/parse failure, wrong `format` or checksum mismatch → "This file is damaged or not a Trainer Studio save". `schemaVersion > SAVE_VERSION` → "Made by a newer version. Update the page and try again". `schemaVersion < SAVE_VERSION` → run the migration chain from task 2 (schemaVersion 1 = `data` is a v1 roster array, migrated by step 0) and report "Upgraded from v1". Then `saveSchema.safeParse`; failure → the damaged-file message. Nothing changes on any error.
   - Before `replaceSave(imported)` the current save (`getSave()`, if not null) goes to the backup slot `save:backup` (store it with a timestamp so Settings can show its date). `restoreBackup()` swaps: the backup becomes the current save via `replaceSave`, and the current save becomes the backup, so a second restore undoes the first.
   - A successful export sets `meta.lastExportAt = now` and `meta.battlesSinceExport = 0` via `updateSave`.
   - Keep encode/decode/validate as pure async functions that take/return values (no DOM), so they are unit-tested in node; Node's global `CompressionStream` and `crypto.subtle` work there.
5. **`isBackupDue(save, now)`** — pure, exported from `src/features/save-transfer/index.ts`: true when `economy.save.backupReminder.battles` battles have passed since the last export (`meta.battlesSinceExport`), or `economy.save.backupReminder.days` days have passed since `meta.lastExportAt` (or since `meta.createdAt` when never exported). Stream 2-home shows the "Back up your progress" banner from it.
6. **Settings view** — replace the stub `src/views/settings/SettingsPage.tsx` (route `app/settings/page.tsx` already renders it; keep the `SettingsPage` named export and `index.ts`). Implement design.md screen `settings` exactly, copy verbatim (ui-language en):
   - `<main id="content">` with one `<h1>` "Settings". Gate save-dependent UI on `useSaveStatus()` / `useHydrated()` (`src/shared/lib/useHydrated.ts`) so prerendered HTML doesn't show a wrong guess.
   - Storage status: "Saved on this device · persistent" or "Browser may clear data. Export often." (use `useSaveStatus().atRisk` and the persist state from task 3).
   - Last export date (from `meta.lastExportAt`; "Exported just now" right after an export).
   - **"Export save"** — primary `Button` (`src/shared/ui/Button.tsx`).
   - Import: "Import save" opens a file picker (`.txt`), shows "Importing…" while decoding, then a confirm `Dialog` (`src/shared/ui/Dialog.tsx`) "Replace current progress? Your current save moves to the backup slot." with "Replace"; then result "Save imported" (or "Upgraded from v1" / the error messages above) and a link to Home. There is no global toast component; don't build one — announce in the page's live region.
   - "Restore backup" with the backup's date; when there is none, "No backup yet" (disabled).
   - The existing motion toggle: render `MotionToggle` from `src/features/motion-toggle/MotionToggle.tsx` unchanged.
   - "Reset progress" with type-to-confirm: a labelled field (use `TextField` from `src/shared/ui/Field.tsx`); the confirm button is enabled only when the input is exactly "RESET"; then move the current save to the backup slot and `replaceSave(createNewSave({ seed, now: Date.now(), name }))` with a seed from `crypto.getRandomValues` and the same default name pattern as `SaveProvider.tsx`.
   - About: the disclaimer "Unofficial fan project, not affiliated with Nintendo, Game Freak or The Pokémon Company", the PokéAPI credit, and a source link to https://github.com/edgergard/trainer-studio.
   - Storage blocked (persistence not durable): only Export is available; Import, Restore and Reset are disabled with a short reason.
   - All results (export, import, restore, reset, errors) go to one `role="status"` live region.

## Context

- Project goal: turn Trainer Studio into a free, single-player collection auto-battler (capsules, levels, deterministic 3D battles on a PvE ladder). No accounts, no server: progress lives in IndexedDB and moves between browsers as an exported file.
- Read first: `CLAUDE.md`, `docs/plan/PLAN.md` (contracts + who owns what), `docs/product/idea.md` (Must #2), `docs/product/design.md` (screen `settings`, flow `save-transfer`, flow `first-visit` "Игрок v1" note, Accessibility), `src/entities/save/**`, `src/app/providers/SaveProvider.tsx`, `src/entities/trainer/model/roster.ts`, `src/shared/lib/storageStore.ts` (how the v1 code guards storage access), `src/features/motion-toggle/MotionToggle.tsx`, `src/shared/ui/Dialog.tsx`, `src/shared/ui/Button.tsx`, `src/shared/ui/Field.tsx`.
- Contracts you build against (do NOT modify): `src/entities/save/model/schema.ts` (`saveSchema`, `SAVE_VERSION`, `NATURES`, `createNewSave`), `src/entities/save/model/store.ts` (`SavePersistence`, `LoadResult`, `getSave`, `updateSave`, `replaceSave`, `useSave`, `useSaveStatus`, `isStorageAtRisk`), `src/entities/save/model/events.ts`, `src/entities/save/index.ts` (public API), `src/shared/config/economy.ts` (`IV_MAX`, `economy.save.backupReminder`), `src/shared/lib/rng.ts` (`createRng`, `hashSeed`), `src/entities/pokemon/model/species.ts` (`getSpeciesBySlug`, via `@/entities/pokemon`), `src/app/providers/SaveProvider.tsx`, `app/layout.tsx` (skip link; your view renders its own `<main id="content">`), `src/shared/ui/**`.
- Stubs prepared for you: `src/entities/save/persistence/index.ts` (in-memory placeholder), `src/views/settings/SettingsPage.tsx` + `index.ts`, route `app/settings/page.tsx`.
- Contract gap you will hit: `src/entities/save/index.ts` re-exports only `createDefaultPersistence` from `./persistence`, and other layers may import the save entity only through that index. `requestPersist`, the persist-state reader, and the backup read/restore functions must be re-exported there for `features/save-transfer`, `views/settings` and 2-home. Put them in `persistence/index.ts`, then escalate with the exact export line to add (`ESCALATION: add export { … } from './persistence' to src/entities/save/index.ts`) as soon as the names are settled — don't import `@/entities/save/persistence` from other layers as a workaround.
- Rules: game numbers only from `economy.ts`; randomness only via `hashSeed`/`createRng` (seed generation for a brand-new save with `crypto.getRandomValues` is not game logic, as in `SaveProvider.tsx`); art only via `getCreatureArt` (you need none); UI reads/writes the save only via `useSave`/`updateSave`/`replaceSave` — IndexedDB and localStorage are touched only inside `src/entities/save/persistence/**`. Query params, if any, via `useSearchParams` only after `useHydrated()` — never `<Suspense>`.
- Design (if `docs/product/design.md` exists): implement screens `settings` and flows `save-transfer` exactly as specified there — every listed state, copy verbatim (in its `ui-language`), per-screen accessibility notes, components from its Components table. Visual reference: there is no `docs/product/prototype/settings.dc.html`; follow the existing app's look (tokens in `src/app/styles.css`, glass panels, `shared/ui` primitives).

## You own (edit ONLY these paths)

- `src/entities/save/persistence/**` — including tests beside the code, e.g. `src/entities/save/persistence/index.test.ts`, `src/entities/save/persistence/migrations.test.ts`, `src/entities/save/persistence/v1.test.ts`
- `src/features/save-transfer/**` — including tests beside the code, e.g. `src/features/save-transfer/model/envelope.test.ts`, `src/features/save-transfer/model/isBackupDue.test.ts`
- `src/views/settings/**` — including `src/views/settings/SettingsPage.test.tsx`
- Tests sit next to the file they test (Next.js layout per CLAUDE.md). Component tests start with `// @vitest-environment jsdom`; IndexedDB tests import `fake-indexeddb/auto`; Vitest globals are off (import `describe`, `it`, `expect`).

## Environment notes

- GitHub: if `gh` says the repo is not found, the active gh account is a different one. Run that one command with the owner's token: `GH_TOKEN="$(gh auth token --user edgergard)" gh pr create --repo edgergard/trainer-studio ...`. Never run `gh auth switch`.
- Env: no env file — use mocks/defaults (the app needs no keys). In the report, say whether you exercised the real services or mocks.
- Browser checks (web): `npm run dev` may return 500 from background shells on Windows (Turbopack CSS worker). Use `npm run build` then `npx next start --port 3101`, and drive it with the project's Playwright CLI: `npx playwright cli open http://localhost:3101`, then `snapshot` / `click` / `screenshot` (see `.claude/skills/playwright-cli`; it uses the installed Chrome — don't install browsers). Close only your own browser with `npx playwright cli close` and stop the `next start` you launched when done; never `kill-all` or `close-all` (they hit other streams' browsers). Don't install global tools; if the browser can't run, say so in the report — the orchestrator smoke-tests in Phase 5.

## Known pitfalls

- Never chain checks through a pipe before commit: run `npm run check`, test its exit code, commit only on 0 (L-024).
- Every persisted key is declared in the save schema contract; you can't add keys — escalate (L-027).
- jsdom tests can pass while the real DOM misses state: expose state with aria-* and check it in the browser (L-007).
- Run `prettier --write` on files you edit before committing; `format:check` is part of `npm run check` (L-014).

## You must NOT

- Edit files outside your ownership — including package.json, lockfile, root layout, route registry, env schema, contracts, CI, `.claude/`, `docs/plan/`.
- Add dependencies (escalate instead).
- Merge into `dev`, force-push, `git reset --hard`, or touch other `stream/*` branches.
- Rebase after your branch has been pushed (use `git merge` instead).

## Escalation

If you need a contract change, a shared-file edit, a new dependency, or you are blocked: stop, commit what you have, push (GitHub mode), and finish your turn with the standard report using `STATUS: escalation` and an `ESCALATION:` line saying exactly what you need and why. Do not work around it. The orchestrator will change `dev` and tell you to integrate it.

## Acceptance criteria

- [ ] Progress survives a reload: after `updateSave` and a reload, the same save loads from IndexedDB `trainer-studio` / `save:v2`; bursts of updates produce debounced writes; a pending write is flushed on `pagehide`.
- [ ] With IndexedDB unavailable, the app loads and plays in memory, `durable` is false, writes resolve false, and Settings shows "Browser may clear data. Export often." with only Export enabled.
- [ ] A corrupt or newer stored save loads as `{ kind: 'error' }`; nothing is overwritten.
- [ ] With only the v1 roster in localStorage, the first load yields a v2 save with every distinct mapped v1 Pokémon at Lv 1 / 1★, team of 1 (first trainer's first Pokémon), `onboarding.step 'done'`, `meta.migratedFromV1 true`, the same IVs/nature on every run; the v1 keys are still there afterwards.
- [ ] `requestPersist()` calls `navigator.storage.persist()` at most once and its result shows in the Settings status line.
- [ ] Export downloads `trainer-studio-YYYY-MM-DD.txt` and sets `meta.lastExportAt` / resets `meta.battlesSinceExport`; importing that file (other browser profile) restores the identical save after the confirm dialog, the previous save sits in the backup slot, and "Restore backup" swaps it back.
- [ ] A truncated/edited file, a non-save file and a wrong checksum show "This file is damaged or not a Trainer Studio save"; a higher `schemaVersion` shows "Made by a newer version. Update the page and try again"; a schemaVersion 1 file migrates with "Upgraded from v1"; nothing changes on errors.
- [ ] Reset progress is enabled only after typing "RESET" in a labelled field and starts a fresh save (onboarding `hero`).
- [ ] `isBackupDue` is exported from `src/features/save-transfer/index.ts` and uses only `economy.save.backupReminder`.
- [ ] Tests cover: idb round-trip and debounce (`fake-indexeddb/auto`), blocked-storage fallback, version detection + migration chain, v1 migration (determinism, unknown slugs, legacy key, keys untouched), envelope encode/decode round-trip, checksum/format/newer/older errors, backup swap, `isBackupDue` edges, and the Settings view states (jsdom: storage status, no backup, import confirm, RESET gating, live-region messages).
- [ ] `npm run check` passes in this worktree
- [ ] UI (if any): uses design tokens, `cursor: pointer` / accessibility labels, visible focus, works at mobile and desktop widths (web) or light/dark (Expo)
- [ ] If you run a dev server, use your port: `npm run dev -- --port 3101` (web). Stop it when done.

## Definition of done

1. All acceptance criteria met; `npm run check` passes.
2. Get the latest `dev`:
   - before your first push: `git fetch origin && git rebase origin/dev`;
   - after your branch has been pushed: `git fetch origin && git merge origin/dev` (never rebase).
     Then `npm ci` if package-lock.json changed, and re-run `npm run check`.
3. Conventional commits, only files in your ownership.
4. GitHub mode: `git push -u origin stream/1-save`, then `gh pr create --base dev` (body: what changed / how to verify). Do NOT merge it. Later pushes: plain `git push`.
5. Finish your turn with the report below. If the orchestrator later sends feedback, fix it, re-run checks, push, and report again in the same format.

## Report format (your final message)

STATUS: done | partial | escalation
BRANCH: stream/1-save PR: <url or none> HEAD: <short sha>
ESCALATION: <need + why — only when STATUS is escalation>
DONE: <bullets>
NOT DONE / KNOWN ISSUES: <bullets>
CHECKS: <command → result>
FILES CHANGED OUTSIDE OWNERSHIP: none | <list with reason>
