# CLAUDE.md

@AGENTS.md

Rules for this repository that are not obvious from the code. Keep this file short. Product spec: `docs/product/` (idea, design, prototype); build plan and contracts: `docs/plan/PLAN.md`.

## Stack

- Next.js 16.4 App Router, **static export** (`output: 'export'`, `trailingSlash`, no server at runtime), React 19.3, TypeScript strict (+ `noUncheckedIndexedAccess`)
- Tailwind CSS 4.3 via `@tailwindcss/postcss`, configured in CSS only: `src/app/styles.css` (tokens, utilities, motion)
- GSAP 3 for UI motion, three.js for the 3D battle (lazy chunk), zod 3, idb-keyval (IndexedDB save)
- Vitest 5 + Testing Library + jsdom, ESLint 9 (flat config) + Prettier 3 (single quotes, width 100)
- Node.js 26 (`.nvmrc`), npm only
- Deploys: Vercel (domain root) and GitHub Pages (basePath `/trainer-studio`), picked in `src/shared/config/site.ts`

## Documentation sources, in this order

1. Next.js and React topics: the `vercel` plugin skills (`vercel:nextjs`, `vercel:react-best-practices`, …), then the version-matched docs in `node_modules/next/dist/docs/` (see AGENTS.md).
2. Every other library (zod, Vitest, Testing Library, GSAP, three.js, idb-keyval, Tailwind, lucide): Context7.

Look an API up before adding or changing a call to it; do not rely on memory.

## Architecture: Feature-Sliced Design

```text
app/              routes only (Next.js file conventions); each page renders one view from src/views
src/app/          providers, global styles, root-level client bits
src/views/        one folder per screen (design.md screen-id)
src/widgets/      composite UI blocks (battle-arena, app-nav, capsule-reveal, …)
src/features/     user actions (open-capsule, save-transfer, …)
src/entities/     domain: save, pokemon, battle, progression, capsule, quest, ladder
src/shared/       config (economy.ts, site.ts), lib, ui kit, api
```

- Imports go only downward (`views → widgets → features → entities → shared`), never sideways between slices of the same layer except through a slice's `index.ts`.
- **Static export rules:** no Server Actions, no route handlers, no `cookies()`/`headers()`, no dynamic `[id]` segments for open-ended ids — use query params (`/creature/?id=25`). Read them with `useSearchParams` only inside a component rendered after `useHydrated()` is true (see `src/views/battle/BattlePage.tsx`); never wrap in `<Suspense>` for this — it broke hydration in `next dev`.
- Browser state lives in the save store (`src/entities/save`): `useSave(selector)` to read, `updateSave(fn)` to write. Never read or write IndexedDB/localStorage directly from UI code.
- All game numbers come from `src/shared/config/economy.ts`. No magic numbers in features.
- Randomness only through the seeded RNG (`src/shared/lib/rng.ts`); never `Math.random()` in game logic.
- Sprite and artwork URLs only through `getCreatureArt()` (`src/entities/pokemon`).
- Species data is baked: `npm run species` regenerates `src/entities/pokemon/data/species.json`; no runtime calls to PokeAPI for game data.

## Code style

- Components and types: PascalCase files and names (`HoloCard.tsx`); hooks, functions, variables: camelCase (`useSave.ts`). Route folders: kebab-case.
- Named exports only, except where Next.js requires a default export (`page`, `layout`, `not-found`, `next.config.ts`).
- No `any`: use `unknown` and narrow (type guards, zod). Handle `undefined` from `noUncheckedIndexedAccess` instead of `!`.
- Import through `@/`. Prettier owns formatting.
- Tests sit next to the code (`*.test.ts` / `*.test.tsx`). Vitest globals are off: import `describe`, `it`, `expect`. Tests run in node by default; a component test starts with `// @vitest-environment jsdom`. IndexedDB tests use `fake-indexeddb/auto`.

## Commands

```bash
npm run dev               # dev server on http://localhost:3000
npm run lint              # ESLint; lint:fix to autofix
npm run typecheck         # next typegen && tsc --noEmit
npm run test              # Vitest once; test:watch for watch mode
npm run format            # Prettier write; format:check only verifies
npm run check             # lint, format:check, typecheck, test, build in sequence (CI runs the same)
npm run preview -- 3101   # serve out/ after a build (next start does not work with static export)
npm run species           # re-bake species data from PokeAPI (one-time, network)
```

Before every commit, run `npm run check` and make sure it passes.

## Accessibility (required)

- Semantic HTML: landmarks, one `h1` per page, real `<button>`/`<a>`, labelled fields; skip link and `<main id="content">` come from `app/layout.tsx`.
- Visible `:focus-visible` on everything interactive (`ring-ring`), targets ≥ 44px (`tap-target`).
- Contrast WCAG AA with the theme tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `bg-primary`, `text-rarity-*`); no text smaller than `text-xs`.
- Rarity never by colour alone: always a text label too.
- Announce results (rewards, reveals, imports) with `role="status"` / live regions; respect the motion setting (`data-motion` on `<html>`) and reduced motion.

## Workflow

- Outside a `product-build` stream, use the global `ship-pr` skill. Inside a stream (branch `stream/*`), follow the stream brief: PRs target `dev`, never merge, never push to `main`.
