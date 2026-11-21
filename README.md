<h1 align="center">Trainer Studio</h1>

<p align="center">Build your Pokémon squad of four, then watch it battle on a 3D card arena — powered by <a href="https://pokeapi.co/">PokeAPI</a>.</p>

- [Live demo](https://edgergard.github.io/pokeAPI/)

## Features

- Trainer roster: register as many trainers as you like (live validation, any alphabet, hyphens and apostrophes allowed), switch between them or remove one; a pre-roster saved trainer is migrated automatically
- Accessible multi-select autocomplete over the full Pokédex — keyboard navigation, ranked results, sprites
- Review dialog with types, key stats and combined base stats
- Team cards coloured by type, with animated stat bars
- Saved teams persist across reloads (localStorage); reorder a team by dragging a card's grip or with Alt + arrow keys
- **Team battle** (`/battle`): pick two teams — your trainers, preset trainers or a 🎲 random rival — press **Fight** and watch a deterministic relay battle play out on a three.js arena of 3D cards, choreographed with GSAP
- Responsive from 375px phones to wide desktops; motion follows the OS setting or an in-app Auto / On / Off toggle

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript (strict) · Tailwind CSS v4 · TanStack Query 5 · React Hook Form + Zod · GSAP 3 (+ @gsap/react) · three.js · Vitest

## Architecture

Next.js routes live in the root `app/`; everything else keeps Feature-Sliced–style layering, where each layer may import only from layers below it. (The FSD *pages* layer is called `views/`, because Next reserves `src/pages/` for its Pages Router.)

```
app/                    # Next.js App Router: root layout (fonts, metadata, pre-paint motion script), routes
├─ page.tsx             # / — prerendered home
├─ battle/page.tsx      # /battle/ — prerendered battle page
└─ not-found.tsx        # 404
src/
├─ app/                 # providers (TanStack Query), legacy #/ link redirect, global styles & design tokens
├─ views/
│  ├─ home/             # team builder + roster showcase (/)
│  └─ battle/           # setup → arena, three.js loaded only when a battle starts (/battle/)
├─ widgets/
│  ├─ team-showcase/    # trainer header, switcher + 4 team slots
│  └─ battle-arena/     # choreographer, three.js stage + director, HUD, log, result screen
├─ features/
│  ├─ team-builder/     # form, combobox, confirm dialog, zod schema
│  ├─ battle-setup/     # team pickers, presets, random rival, Fight
│  └─ motion-toggle/    # Auto / On / Off animation switch
├─ entities/
│  ├─ pokemon/          # API, query hooks, DTO → domain mappers, search, cards
│  ├─ trainer/          # roster model + storage, presets, random rival, pure swapSlots()
│  └─ battle/           # seeded RNG, type chart, level-50 stats, damage, simulateBattle(), movesets
└─ shared/              # http client, route hrefs, storage store, UI kit, motion + GSAP setup (lib/gsap.ts), utils
```

Key decisions:

- **Static export, prerendered HTML.** `next build` (`output: 'export'`) renders both routes to plain HTML at build time, so the page arrives with its content and styles instead of an empty `<div id="root">`; GitHub Pages serves it as static files under `basePath: '/pokeAPI'` with `trailingSlash` so `/battle/` maps to `battle/index.html`.
- **Hydration-safe browser storage.** The roster, the selected trainer and the motion preference are read through `useSyncExternalStore` stores (`shared/lib/storageStore.ts`): prerendered HTML and the hydrating render agree, and the stored values swap in before paint — no hydration mismatch. The roster also stays in sync across tabs.
- **Self-hosted fonts** via `next/font` — no render-blocking Google Fonts stylesheet, size-adjusted fallbacks against layout shift.
- **Real URLs.** `/battle/?red=<trainer id>` replaced hash routing; client-side navigation goes through `next/link` (prefetched), and old `#/battle?red=…` links are redirected on load.

- **Server state lives in TanStack Query** — the Pokédex index is fetched once and cached forever; each Pokémon is cached by name, so the review dialog and the team cards share requests.
- **DTOs are mapped to a small domain model** (`toPokemon`) — the UI never touches raw API shapes; stats are matched by name instead of array position.
- **Native `<dialog>`** handles focus trapping, Esc and the top layer — no portal code.

## Motion

- **One switch for everything.** `shared/lib/motion.ts` resolves the OS `prefers-reduced-motion` setting together with the in-app **Auto / On / Off** toggle and mirrors the result to `<html data-motion="full|reduced">` (set before first paint by an inline script from `src/app/motionScript.ts`). CSS keys off that attribute, never the media query; JS reads `usePrefersReducedMotion()`.
- **CSS / WAAPI** handle the curtain-up load-in, card internals (stat bars, holo tilt, glints), placeholders and the lock-in burst.
- **GSAP** (`shared/lib/gsap.ts` registers ScrollTrigger and SplitText for first paint; Draggable, Flip and ScrambleText live in `shared/lib/gsap-interactive.ts`, loaded on demand via `useGsapInteractive()` once a team exists, so they stay off the critical path) handles:
  - the hero heading — SplitText chars rise out of a mask, screen readers get the original text, re-split after web fonts load;
  - scroll storytelling — the hero lifts and dims, the aurora parallaxes, the showcase scrubs in (transform / opacity only, refreshed when the page height changes);
  - the trainer name scrambling in on save (assistive tech only ever gets the final name);
  - slot reordering — drag a card by its **grip handle** (only the handle captures touch, so the page still scrolls on phones) onto another slot, or focus a slot and press **Alt + arrow keys**; Flip glides the cards and an `aria-live` region announces the move;
  - the cursor spotlight on the form card (`gsap.quickTo` on CSS variables, fine pointers only).
- Every GSAP effect lives in `useGSAP` with the reduced flag as a dependency (`revertOnUpdate`), so flipping the toggle reverts it to the static end state and re-arms it when switched back. Reordering still works with motion off — just without the glide.

## Battle

Open **Battle** from the nav (or **Battle with this team →** under a saved team, which puts that team in the Red corner via `/battle/?red=<trainer id>`). Red and Blue each pick a trainer — your own, one of the presets, or 🎲 **Random rival** (a fresh random team on every click) — and **Fight** starts the battle. On a first visit both corners are pre-filled with presets, so a battle is one click away.

```
 teams + seed ──► simulateBattle()  ──► BattleEvent[]  ──► choreograph()  ──► GSAP master timeline ──► StageDirector
                  entities/battle        enter · move ·      widgets/battle-arena   one beat per event,     ├─ director3d → BattleStage (three.js)
                  pure, deterministic    hit · miss · ko ·   /model                 compressed to ≤ 90 s    └─ nullDirector (no WebGL: log only)
                                         end                                         │
                                                                                     └─ onEvent ──► HUD state + battle log (DOM, aria-live)
```

- **Simulation** (`entities/battle`) — a pure, seeded relay 1v1: level 50, real PokeAPI base stats, types and up to four damaging moves per Pokémon; the classic damage formula with STAB, type effectiveness, crits and a random roll. Same teams + seed → same events, so **Replay** is exact and the rules are unit-tested.
- **Choreographer** (`widgets/battle-arena/model/choreograph.ts`) — knows every event up front and turns them into one paused GSAP timeline: deal-in → anticipation → lunge + type FX → impact → shatter. Ordinary hits use a short tier; first attacks, super-effective hits and crits get the full beat. If the battle would run past ~90 s at 1× it compresses short beats first (never below 0.35 s). Each event reaches the HUD exactly once, at the moment its beat lands.
- **Stage** (`widgets/battle-arena/stage`) — a framework-free `BattleStage` class: renderer (DPR ≤ 2, paused while the tab is hidden), camera rig, lights, 3D cards with a holo shader and canvas-drawn faces, fractured-card shatter. `director3d` tweens those objects directly. Everything is disposed on unmount. three.js and the stage live in lazy chunks, so the home page never downloads them.
- **Fallbacks** — no WebGL, a failed three.js/stage chunk or a lost context → a notice, and the battle keeps going through the log; blocked artwork → placeholder card faces. If the battle page or arena chunk itself fails (offline, or a stale tab after a redeploy renamed the hashed chunks), an error boundary shows “couldn’t load” with **Retry** (a reload for a chunk failure) and a link home instead of a blank page.

**Controls:** **×2** (double speed), **Replay** (the identical battle from the start), **New battle** (back to setup, picks kept). The result screen lists each fighter's KOs and damage. Everything is keyboard-reachable; the log announces turns. With motion **Off** (or the OS "reduce motion" setting on **Auto**) camera moves become cuts and beats become quick fades — same events, same winner.

**Movesets** come from a build-time file, `src/entities/battle/data/movesets.json` (up to four damaging moves per Pokémon, picked by `selectMoves()`), so a battle needs no extra API calls. To regenerate it from PokeAPI (rarely needed — ~2,000 requests):

```bash
npm run movesets
```

## Scripts

```bash
npm install
npm run dev        # Next.js dev server at http://localhost:3000
npm test           # unit tests (Vitest)
npm run typecheck  # route types + tsc
npm run build      # typecheck + static export to out/
npm run deploy     # publish out/ to GitHub Pages (with .nojekyll, so _next/ is served)
npm run movesets   # regenerate src/entities/battle/data/movesets.json from PokeAPI (rarely needed, ~2,000 requests)
```
