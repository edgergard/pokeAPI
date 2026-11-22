# Trainer Studio (pokeAPI): as-is brief

## 1. What it is and who it seems for
Trainer Studio is a static, client-only Next.js 16 web app built on PokeAPI. You create "trainer cards" (a name plus a team of exactly 4 Pokémon), keep a local roster of trainers, and send any two teams into a fully automatic 3D battle that you watch rather than play. There are no accounts, no backend and nothing stored server-side. It reads as a portfolio or pet showcase for motion design and 3D: heavy GSAP and three.js polish, careful accessibility and reduced-motion handling. It seems aimed at Pokémon fans and at people reviewing frontend craft, not at competitive players: the battle engine is deliberately simplified. Live on GitHub Pages (`/pokeAPI` basePath) and Vercel (`pokeapi-trainer-studio`).

## 2. Features today, by screen
**Global**
- Motion toggle (Auto / On / Off). The choice is applied before first paint and respected by CSS, GSAP and the 3D stage. Stored in localStorage `trainer-studio:motion`.
- Old `/#/battle?red=` links redirect to `/battle/?red=`. 404 page: "This page fled the battle".
- If storage is blocked, the app silently keeps data in memory.
- SEO: title template `%s · Trainer Studio`, description and openGraph (Battle overrides them), favicon `app/icon.svg`. No OG image, robots or sitemap.

**Home `/`**
- Nav: logo, Motion toggle, Battle link, GitHub "Source" link. Decorative hero with a 3-step list and parallax.
- **New trainer form:**
  - First and last name: letters from any alphabet, 2–20 chars, with inline errors.
  - "Your team" ARIA combobox over the full PokeAPI index (~1300 entries, alternate forms included): prefix-then-substring search, sprites, full keyboard support, chips, 4 progress slots, plus loading, error-with-Retry and empty states.
  - "Review team" stays disabled until the form is valid. It opens a confirm dialog with per-Pokémon rows and a count-up "Combined base stats" total, then "Save team".
- **Team showcase** (the selected trainer, or the newest one):
  - Trainer `<select>` when there are 2 or more trainers. **Remove** deletes immediately, with no confirm or undo.
  - 4 holo cards: artwork, types, HP/Atk/Def/Spd bars, pointer tilt. A failed card has no retry.
  - Swap slots by dragging or with Alt+arrows; the change is saved.
  - After a save, a celebration plays (name scramble, cards dealt in, burst).
  - Empty state: "Unknown trainer" with 4 placeholders.
- **Battle banner:** CTA "Battle with this team", linking to `/battle/?red=<id>`. Shown only when a trainer exists.
- **Persistence:**
  - Roster in localStorage `trainer-studio:roster:v1`: zod-validated, synced across tabs, legacy single-trainer key migrated.
  - Selected trainer in **sessionStorage** `trainer-studio:selected:v1`.
  - Only Pokémon slugs are stored. Details are re-fetched each session.

**Battle `/battle/`**
- **Setup:**
  - Red and Blue corners, each with a trainer select: Your trainers / 4 local presets / Random rival.
  - A dice button builds a random rival (4 default-form Pokémon and a random name).
  - Team preview with animated sprites.
  - Defaults: Red is `?red`, else your newest trainer, else a preset. Blue is the first preset that isn't Red.
  - The same trainer can be picked on both sides.
  - "Fight" fetches 8 Pokémon and loads a moveset file generated at build time (1016 Pokémon, 391 moves). Fetch failures show one of five specific errors with Retry.
  - Picks are lost on reload, except `?red`.
- **Arena:**
  - Simulated up front and deterministic from a seed: level 50, type chart, STAB, crits, accuracy, speed order, a 40-turn cap.
  - Watch-only, played as about 90 s of 3D holo cards with camera moves, effects and KO shatter.
  - HUD: HP bars and pips, a move banner, damage popups.
  - Controls: ×2, Replay (same seed) and New battle. There is no pause, skip or scrubbing.
  - Collapsible battle log with a screen-reader live region. Result overlay with the winner, the reason and a per-fighter stats table.
  - Fallbacks: a text-log stage without WebGL2, notices for load errors and a lost GPU context, an ErrorBoundary, and a pause while the tab is hidden.
- Battles are not saved: no history, and the seed is neither shown nor shareable. There is no `?blue=` or seed param.

## 3. Look & feel and design tokens
- **Overall:** dark only (`color-scheme: dark`, theme color `#0b0c10`) with a "premium arcade holo" feel. Glass panels, a yellow glow accent, an aurora and dot-grid backdrop, foil cards. The motion is heavy and layered.
- **Where tokens live:** Tailwind v4, configured in CSS only, in `src/app/styles.css` (1760 lines, no tailwind.config).
- **Colours:**
  - Ink scale `ink-950 #07080b` … `ink-100 #e7e9ef`.
  - `accent #ffd23f`, `accent-strong #ffe27a`, `danger #ff6b6b`.
  - `side-red #ff7a66`, `side-blue #5eb0ff`, `--shadow-glow`.
  - 18 Pokémon type colours, applied through a `--type` variable.
- **Fonts:** Inter (sans), Bricolage Grotesque (display) and JetBrains Mono (eyebrows, numbers), all self-hosted via next/font.
- **Motion tokens:** 5 easings, durations `--dur-xs…2xl` (120–900 ms) and `--stagger: 60ms`, mirrored in JS. A global reduced-motion kill switch sits at the end of the CSS.
- **Utilities:** `glass`, `text-gradient`, `tap-target` (44 px), `aurora`, `dot-grid`, `shimmer`.
- **Not tokenised:**
  - Radii (xl, 2xl, 3xl, `[2rem]`, `[10px]`).
  - Type sizes (arbitrary 10–15 px).
  - `ink-400` and `ink-500` are nearly identical.
  - One `backdrop-blur` contradicts the no-backdrop-filter `glass` rule.
  - Some links copy the Button styles inline.
- **Hand-made UI kit:** `src/shared/ui` (Button, Dialog, Field, Spinner, Spotlight, ErrorBoundary). No shadcn.
- **Responsive:** 1/2/4-column grids. The arena aspect goes 4/5 → 4/3 → 16/9, and the 3D layout re-frames for portrait.
- **Accessibility:**
  - Strong: native dialog, ARIA combobox, live regions, deliberate focus management, `inert`, sr-only copies.
  - Gaps: no `<main>` on Home (Battle and 404 have one), no skip link, several icon buttons without focus-visible styles, focused headings with no outline, no `aria-current`.

## 4. Architecture & quality (short)
- **Stack:** Next 16 static export (`output: 'export'`, `trailingSlash`), React 19, TanStack Query (memory cache only, `retry: 2`), react-hook-form + zod 3, GSAP, three.js (lazy chunk), Tailwind v4 via PostCSS. No global state library.
- **Layout:** Feature-Sliced Design in `src/` (app / views / widgets / features / entities / shared). Routes live in the root `app/`. No upward imports.
  - Minor FSD drift: `motion-toggle`, `team-showcase` and the views lack `index.ts`. `entities/pokemon` re-exports `Pokeball`. No `@x` for cross-entity types.
- **Data:** a thin `getJson<T>` with no runtime validation (responses are cast). The moveset JSON is cast too. The index (`limit=100000`) is refetched on every visit.
- **Tests:** Vitest in node mode, 25 files and about 140–150 cases, all logic (engine, choreography, stage math, roster, storage). There are no component, hook, API or E2E tests. The large imperative 3D files (`director3d` 809 lines, `BattleStage` 531, `fx` 485) are mostly untested.
- **Tooling:** TS strict and then some. **No CI, no ESLint/Prettier, no `.nvmrc`/`engines`.**
- **Fragile spots:**
  - `postbuild` flatten-RSC script relies on Next internals.
  - basePath is env-driven: any non-Vercel production build gets `/pokeAPI`.
  - `movesets` depends on an undeclared `vite-node`.
  - Both deploys are manual.
- **Docs:**
  - The README wrongly says `build` includes typecheck (typegen runs only in `npm run typecheck`).
  - The plan doc has 51 unchecked boxes for a feature that has shipped. Its spec puts sound and battle history out of scope.
  - There is no `docs/product/` or `docs/plan/PLAN.md`.
- **Working tree:** the untracked paths `pokeAPI/` (a nested project copy), `measure.mjs` and `live/` (an old Vite build) could be committed by accident.

## 5. Gaps vs the project template (`nextjs-pet` @ `89fdc7b`, itself from `template-nextjs-commercial@cdf79d3`)
The repo was not created from the template (it was migrated from Vite).

| Template item | Adoption |
|---|---|
| `.nvmrc` (26), `engines >=22`, `.editorconfig`, `.gitattributes`, `.vscode/extensions.json`, `.mcp.json`, `AGENTS.md` | Easy |
| `.claude/settings.json`, typecheck-on-stop hook, playwright-cli skill, `paseo.json` + worktree-setup | Easy (add the `lint`/`format`/`check` scripts first; Playwright needs `@playwright/test`) |
| ESLint flat config (next + ts + prettier) | Easy to add; expect a batch of first-run fixes |
| Prettier + format hook + `.prettierignore` | Adapt: point at `src/app/styles.css`, `tailwindFunctions: ["cn"]`, match the repo's single quotes, and make one large reformat commit |
| Scripts `lint`, `lint:fix`, `format`, `format:check`, `test:watch`, `check` | Easy; keep the repo-only `postbuild`, `movesets` and `deploy` |
| `.github/workflows/ci.yml` | Adapt (needs the scripts above; `postbuild` runs in CI) |
| `.github/dependabot.yml` | Easy. It ignores majors, so the repo's lag behind the template (vitest 3 vs 5, vite 6 vs 8, zod 3 vs 4) stays manual |
| `.github/template.json` | Missing in the template too. Write it by hand (pointing at `89fdc7b`) so `/project-sync` can work |
| `CLAUDE.md` | Adapt: keep the workflow, a11y and docs-order sections; rewrite Stack, Architecture, Structure and Code style for FSD, static export, PascalCase/camelCase naming and both deploys |
| tsconfig | Easy: keep the repo's (stricter) file, optionally add `noImplicitOverride` |
| Vitest jsdom + Testing Library + `vitest.setup.ts` | Adapt: per-file jsdom environment, since the existing tests need node and three.js/GSAP need stubs |
| shadcn semantic tokens (`--background`, `--primary`, `--radius-*`…, light + dark) | Conflict. `accent` means something different. Add an alias layer (`--color-primary: var(--color-accent)` and so on) rather than renaming. Keep the motion tokens |
| shadcn `components.json` / base-ui kit | Adapt under `src/shared/ui`; overlaps Button and Dialog |
| `components/lib/hooks` layout, `src/server/`, `server-only`, `src/env.ts`, `cacheComponents`, `partialPrefetching` | Conflict: don't adopt (FSD + static export, no env vars) |
| `app/error.tsx`, `global-error.tsx`, `public/` | Easy (export-compatible) |
| Turbopack Tailwind loader instead of PostCSS | Optional, adapt |
| Vercel deploy assumption | Compatible; Pages remains an extra manual target |

## 6. Obvious weak spots and opportunities
- **The battle is watch-only:** no player choices, no pause or skip, about 90 s per fight.
- **Battles leave no trace:** no history, records, stats over time or shareable seed. Deep links carry only Red.
- **Alternate forms (megas, regionals) can be picked but fight with a single typeless 40-power fallback move.**
- **The roster can't be edited:** no rename or team change, only slot swaps. Remove has no confirm or undo.
- **Empty first-run state:** no prompt toward the form, and no path to battle from Home without a trainer, even though presets exist.
- **Disabled "Review team" gives no reason** when fields are untouched.
- **A failed showcase card has no retry.** Damage popup timers ignore pause and ×2.
- **Touch issues:** hover lift fires on tap. Phones show a duplicate dice icon plus emoji.
- **Engine bias:** an exact HP tie at the turn cap always goes to Red.
- **Accessibility:** a dark-only theme with no light option. Possibly low-contrast 11 px type badges. Landmark, skip-link and focus-style gaps.
- **Motion is dense by default ("Auto")** for users without an OS preference.
- **Purely local:** no accounts, sync, social or sharing features. No OG image, robots or sitemap, which limits discoverability.
- **Quality safety net is thin:** no CI, no lint, no UI or E2E tests, unvalidated external data, a fragile build workaround, env-driven basePath, stray untracked folders.
- **Performance:** the full PokeAPI index is refetched every visit (no persisted cache).
- **Product docs are absent or stale.** Discovery starts from a blank `docs/product/`.
