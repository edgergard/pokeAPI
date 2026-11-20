<h1 align="center">Trainer Studio</h1>

<p align="center">Build your Pokémon squad of four — powered by <a href="https://pokeapi.co/">PokeAPI</a>.</p>

- [Live demo](https://edgergard.github.io/pokeAPI/)

## Features

- Trainer registration with live validation (any alphabet, hyphens and apostrophes allowed)
- Accessible multi-select autocomplete over the full Pokédex — keyboard navigation, ranked results, sprites
- Review dialog with types, key stats and combined base stats
- Team cards coloured by type, with animated stat bars
- Saved team persists across reloads (localStorage); reorder it by dragging a card's grip or with Alt + arrow keys
- Responsive from 375px phones to wide desktops; motion follows the OS setting or an in-app Auto / On / Off toggle

## Stack

React 19 · TypeScript (strict) · Vite 6 · Tailwind CSS v4 · TanStack Query 5 · React Hook Form + Zod · GSAP 3 (+ @gsap/react) · Vitest

## Architecture

Feature-Sliced–style layering; each layer may import only from layers below it.

```
src/
├─ app/                 # entry point, providers, global styles & design tokens
├─ pages/home/          # page composition
├─ widgets/
│  └─ team-showcase/    # trainer header + 4 team slots
├─ features/
│  ├─ team-builder/     # form, combobox, confirm dialog, zod schema
│  └─ motion-toggle/    # Auto / On / Off animation switch
├─ entities/
│  ├─ pokemon/          # API, query hooks, DTO → domain mappers, search, cards
│  └─ trainer/          # trainer model, pure swapSlots(), persisted storage hook
└─ shared/              # http client, UI kit, motion + GSAP setup (lib/gsap.ts), utils
```

Key decisions:

- **Server state lives in TanStack Query** — the Pokédex index is fetched once and cached forever; each Pokémon is cached by name, so the review dialog and the team cards share requests.
- **DTOs are mapped to a small domain model** (`toPokemon`) — the UI never touches raw API shapes; stats are matched by name instead of array position.
- **Native `<dialog>`** handles focus trapping, Esc and the top layer — no portal code.

## Motion

- **One switch for everything.** `shared/lib/motion.ts` resolves the OS `prefers-reduced-motion` setting together with the in-app **Auto / On / Off** toggle and mirrors the result to `<html data-motion="full|reduced">` (set before first paint in `index.html`). CSS keys off that attribute, never the media query; JS reads `usePrefersReducedMotion()`.
- **CSS / WAAPI** handle the curtain-up load-in, card internals (stat bars, holo tilt, glints), placeholders and the lock-in burst.
- **GSAP** (`shared/lib/gsap.ts` registers ScrollTrigger and SplitText for first paint; Draggable, Flip and ScrambleText live in `shared/lib/gsap-interactive.ts`, loaded on demand via `useGsapInteractive()` once a team exists, so they stay off the critical path) handles:
  - the hero heading — SplitText chars rise out of a mask, screen readers get the original text, re-split after web fonts load;
  - scroll storytelling — the hero lifts and dims, the aurora parallaxes, the showcase scrubs in (transform / opacity only, refreshed when the page height changes);
  - the trainer name scrambling in on save (assistive tech only ever gets the final name);
  - slot reordering — drag a card by its **grip handle** (only the handle captures touch, so the page still scrolls on phones) onto another slot, or focus a slot and press **Alt + arrow keys**; Flip glides the cards and an `aria-live` region announces the move;
  - the cursor spotlight on the form card (`gsap.quickTo` on CSS variables, fine pointers only).
- Every GSAP effect lives in `useGSAP` with the reduced flag as a dependency (`revertOnUpdate`), so flipping the toggle reverts it to the static end state and re-arms it when switched back. Reordering still works with motion off — just without the glide.

## Scripts

```bash
npm install
npm run dev        # start dev server
npm test           # unit tests
npm run build      # typecheck + production build
npm run deploy     # publish dist/ to GitHub Pages
npm run movesets   # regenerate src/entities/battle/data/movesets.json from PokeAPI (rarely needed, ~2,000 requests)
```
