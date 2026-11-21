# Team Battle — design

Date: 2026-11-20 · Status: ready for approval · Repo: `edgergard/pokeAPI` (Trainer Studio)

## 1. Intent

Trainer Studio today lets a visitor register one trainer and pick a team of four Pokémon. This feature turns it into a **spectator battle**: pick two teams, press **Fight**, and watch them battle on a 3D arena of Pokémon cards.

**Why:** the project is a portfolio piece for a job application. Its job is to show confident, tasteful use of **GSAP** (timelines, choreography, timing control) and **three.js** (scene, camera, lighting, shaders, geometry). The battle is the vehicle for that showcase — the recruiter should be able to reach a running battle within ~5 seconds of landing and watch it to the end.

## 2. Decisions made with the owner

| Topic | Decision |
|---|---|
| Interaction | **Spectator auto-battle.** Pick two teams, press Fight, the battle plays itself. No move selection by the user. |
| Battle format | **Relay 1v1.** One active fighter per side in the centre; the rest wait on a bench. A KO'd fighter leaves and the next one from that team's bench steps in. A team loses when all four are KO'd. |
| 3D content | **No 3D Pokémon models.** Fighters are **3D cards** (official artwork from PokeAPI on card meshes) in a three.js scene. |
| Choreography | The 5-beat exchange below (deal-in → anticipation → lunge + FX → impact → shatter). |
| Visual style | **"Premium / cinematic"** — slow camera moves, soft light, depth, restrained effects, precise easing. Stronger accents (brief shake/flash, bolder text) are reserved for *Super effective* hits, critical hits and KOs. Must stay consistent with the existing Trainer Studio dark theme. |
| Team sources | **Trainer roster** (the existing form now *adds* trainers instead of replacing the single one), **preset trainers** available on first visit, and a **🎲 Random rival** that generates a team instantly. |
| Battle controls | **×2 speed**, **Replay** (identical battle), **New battle**. |
| Result | Winner screen with a summary (who KO'd whom, damage dealt). |
| Build approach | **Approach A: plain three.js inside React** (see §5). |

## 3. Goals, non-goals, anti-goals

**Goals**
- Landing → Fight in ≤ 2 clicks using presets/random rival.
- A full battle reads clearly and lasts ~45–90 s at 1×.
- The battle outcome comes from real PokeAPI data (stats, types, moves), not invented numbers.
- Deterministic: the same two teams + seed always produce the same battle, so Replay is exact and the logic is unit-testable.
- Smooth on a mid-range laptop and a modern phone (target 60 fps, never janky stutters during hits).
- The existing home page (team builder, motion toggle, GSAP intro) keeps working and does not get heavier: three.js loads only on the battle page.

**Non-goals**
- User-controlled turns, AI opponents with strategy, online multiplayer.
- Abilities, held items, status conditions, stat stages, switching strategy, PP tracking, multi-hit/charging move mechanics.
- 3D Pokémon models of any kind.
- Sound (may be a later addition; not in this scope).
- Persisting battle history.

**Anti-goals** (failure even if it technically works)
- Looking like a copy of the official Pokémon games' battle UI or any specific game's look. The visual language is Trainer Studio's own.
- Ripped / unlicensed 3D assets.
- A battle a recruiter abandons: too long, unclear who is winning, or effects so busy that the timing craft is lost.
- Animations that jank, leave cards stuck invisible, or ignore the motion setting.

## 4. Constraints from the existing project

- Stack: React 19, TypeScript strict, Vite 6, Tailwind v4, TanStack Query, react-hook-form + zod, GSAP 3.15 + `@gsap/react`, Vitest. Feature-Sliced layers (`app / pages / widgets / features / entities / shared`), lower layers never import higher ones.
- GSAP is registered once in `src/shared/lib/gsap.ts` (heavy plugins lazily via `useGsapInteractive`); everything imports from there.
- Motion gating: `src/shared/lib/motion.ts` (`prefersReducedMotion()`, `usePrefersReducedMotion()`) resolves the OS setting plus the in-app **Auto / On / Off** toggle and mirrors it to `<html data-motion>`. The battle must honour it.
- Pokémon data: `src/entities/pokemon` (index + per-Pokémon queries, `toPokemon` mapper, `typeColor`). Trainer persistence: `src/entities/trainer` (`useTrainer`, localStorage key `trainer-studio:trainer:v1`, `swapSlots`).
- Deployed to GitHub Pages under `/pokeAPI/` (static hosting, no server rewrites).

## 5. Approaches considered

**A. Plain three.js inside React — chosen.** React renders only the DOM UI (setup page, HUD, controls, result). The 3D arena is a framework-free `BattleStage` class owning renderer, scene, camera, lights and card objects. GSAP tweens three.js object properties directly. Shows raw three.js skill (custom shaders, fractured geometry, camera work) — exactly what the vacancy asks for — and avoids render-loop conflicts with GSAP. Cost: a bit more lifecycle code (resize, dispose, context loss).

**B. React Three Fiber + drei.** Declarative scene as React components, many ready helpers. Rejected: hides three.js behind an abstraction in a portfolio meant to show three.js, and R3F's frame loop needs careful coordination with GSAP timelines.

**C. CSS 3D transforms + GSAP only.** Rejected: three.js is an explicit requirement.

## 6. Architecture

The battle is split into three independent layers. Each is testable or replaceable on its own.

```
Team A + Team B + seed
        │
        ▼
 ┌──────────────┐   BattleEvent[]   ┌──────────────┐   gsap.timeline   ┌──────────────┐
 │  Simulation  │ ────────────────▶ │ Choreographer│ ────────────────▶ │  BattleStage │ (three.js)
 │  pure TS     │                   │  GSAP        │                   │  + DOM HUD   │
 └──────────────┘                   └──────────────┘                   └──────────────┘
```

1. **Simulation** — pure, synchronous TypeScript. Input: two prepared teams (fighters with stats, types, moves) and a numeric seed. Output: an ordered list of `BattleEvent`s plus the result. No DOM, no randomness outside a seeded PRNG.
2. **Choreographer** — turns `BattleEvent[]` into one master `gsap.timeline()` made of per-event sub-timelines (labels per turn). Because the whole battle is one timeline: **×2** = `timeScale(2)`, pause/resume are free, Replay = rebuild from the same events.
3. **BattleStage** — three.js scene + a thin DOM HUD layered over the canvas. Exposes imperative handles (card objects, camera rig, FX emitters) that the choreographer animates.

### 6.1 Where code lives (Feature-Sliced)

- `entities/battle/` — simulation (`simulate.ts`), PRNG, damage formula, type chart, move selection, `BattleEvent` types. Pure, fully unit-tested.
- `entities/trainer/` — extended to a **roster** (see §7).
- `entities/pokemon/` — add move fetching (`/move/{name}`) and a "battle-ready fighter" preparation step.
- `features/battle-setup/` — Red/Blue team pickers (roster dropdown, presets, 🎲 Random rival), Fight button.
- `widgets/battle-arena/` — `BattleStage` (three.js), choreographer, HUD, controls, result overlay.
- `pages/battle/` — composes setup → arena → result.
- `shared/lib/three/` — small generic three.js helpers (renderer setup, resize/dispose, texture loading) if they are not battle-specific.

### 6.2 Routing

Two views: **Home** (existing) and **Battle**. GitHub Pages has no SPA rewrites, so use **hash routing** (`#/` and `#/battle`). A tiny hand-rolled hash router is sufficient (builder may use a library if it stays small). The Battle page and three.js are **lazy-loaded** (`React.lazy` + dynamic import) so the home page bundle does not grow. Home gets a clear "Battle" entry point (nav link + CTA on the saved-team showcase).

## 7. Teams and data

### 7.1 Trainer roster
- `entities/trainer` changes from one trainer to a list: `Trainer { id, firstName, lastName, team: string[4], savedAt, preset?: boolean }`.
- New storage key (e.g. `trainer-studio:roster:v1`). **Migration:** on first load, if the old `trainer-studio:trainer:v1` exists, import it as the first roster entry.
- The existing home form **adds** a trainer to the roster.
- **Home page and the roster** *(decided by the owner: presets stay off the home page)*:
  - The home showcase lists **only the visitor's own trainers**. A first visit looks exactly as today: empty showcase, and the lock-in moment happens when the visitor saves their first team.
  - It shows the most recently saved trainer. When the visitor has more than one, a small **trainer switcher** appears in the showcase header to pick which one is shown.
  - **Reorder** (`swapSlots`, drag/Alt+arrows) persists per trainer.
  - **Reset** becomes "remove this trainer" (with the same button placement); the showcase then shows the next most recent trainer, or the empty state.
  - Home gets a clear **Battle** entry (nav link + CTA in the showcase) so a visitor reaches a fight in one click.
- Stored data must be validated on read (zod); invalid entries are dropped, never crash the app.

### 7.2 Presets and random rival
- **3–4 preset trainers** with original names (not franchise characters) and balanced, visually varied teams (mixed types so FX variety shows). They are **code constants, not stored in the roster**: they appear only in the battle setup pickers (grouped as "Presets"), are read-only, and can never be lost.
- **🎲 Random rival** generates a trainer with 4 random distinct Pokémon from the Pokédex index. Restrict to default forms with official artwork (exclude ids ≥ 10000 mega/regional/cosmetic forms) so cards always have art. Random rivals are not saved unless the user chooses to (builder's call whether to offer "save rival").

### 7.3 Battle-ready fighters (my calls, adjustable by the builder)
- **Level 50** for everyone; HP and stats from base stats with the standard formula at IV 31 / EV 0 (no natures).
- **Moves:** each fighter gets up to **4 damaging moves** (power > 0, `damage_class` physical/special) learned by **level-up**, chosen deterministically: prefer same-type (STAB) moves, then highest power, ties by name. If a Pokémon has no damaging level-up move, fall back to a typeless 40-power strike (name it something original).
- **Movesets are precomputed at build time** *(my call, after the builder check)*. Picking moves live would need one `/move/{name}` request per candidate move — roughly 150–300 requests for 8 fighters, and the same again for every fresh Random rival — which breaks the "Fight within ~5 s" goal. Instead, a script (`scripts/build-movesets.ts`, run manually and committed like the type chart) fetches PokeAPI once and writes a compact static JSON: for every default-form Pokémon, its 4 chosen moves `{ name, type, power, accuracy, damageClass }`. The JSON is lazy-loaded with the battle chunk. It is still real PokeAPI data, just fetched ahead of time. Stats, types and artwork keep coming from the existing live `/pokemon/{name}` queries (already cached), so a battle needs at most 8 such requests — and usually 0 for saved teams. README documents how to regenerate the file.
- **Type chart:** bundled as a static 18×18 table in `entities/battle` (stable data; saves 18 requests). Covered by tests against a few known matchups.

## 8. Battle rules (simulation)

- Each **turn**: both active fighters act, faster first (ties broken by seeded coin flip). Each picks a move with a seeded weighted choice favouring higher expected damage against the current target (so fights feel purposeful, not random).
- **Damage:** standard simplified formula — `((2·L/5 + 2) · Power · A/D) / 50 + 2`, × STAB 1.5, × type effectiveness (0, ¼, ½, 1, 2, 4), × critical 1.5 (≈ 1/24 chance), × random 0.85–1.0. Physical uses Atk/Def, special uses SpA/SpD. Accuracy roll per move (misses produce a "miss" event).
- **KO:** HP ≤ 0 → KO event; the next bench fighter of that team enters at the start of the next turn (entry event). Immunity (0×) produces a "no effect" event.
- **End:** when one team has no fighters left → result event with winner and per-fighter summary (KOs, damage dealt, damage taken).
- **Guardrails:** hard cap on turns (e.g. 60) → decided by remaining HP % to avoid endless stalemates (e.g. two immune fighters).
- **Determinism:** seeded PRNG (e.g. mulberry32). The seed is generated per battle and kept for Replay.

`BattleEvent` (indicative): `enter`, `turnStart`, `move` (attacker, target, move, type), `miss`, `hit` (damage, effectiveness, crit, hpBefore/After), `noEffect`, `ko`, `end`.

## 9. Choreography (approved 5-beat exchange, "premium" style)

| Beat | What happens | Indicative timing @1× |
|---|---|---|
| 01 Deal-in | Card flies from its team's deck along an arc, flips face-up, lands with a soft spring; key light tints to its type colour. | ~0.9 s |
| 02 Anticipation | Attacker leans back and tilts; camera dollies slightly toward it; move name appears letter by letter. | ~0.4 s |
| 03 Lunge + FX | Attacker lunges toward the target; type-based effect travels (fire sparks, water wave, electric arc, psychic rings…). | ~0.5 s |
| 04 Impact | Target recoils and shakes, brief flash; damage number pops; HP bar drains; "Super effective!" / "Not very effective…" / "Critical!" when relevant. | ~0.6 s |
| 05 Shatter (KO) | Card cracks and breaks into shards that fall to the floor; the next bench fighter deals in. | ~1.2 s |

**Keeping battles watchable — timing tiers** *(my call, after the builder check).* The simulation keeps the real formula; the choreography absorbs long battles instead. Beats come in tiers:
- **Full** (all five beats as above): super-effective hits, critical hits, KOs, and each fighter's first attack.
- **Short** (~0.7 s total, no camera dolly, compact FX): plain neutral or not-very-effective hits and misses.
- **Auto-compression:** the choreographer knows the total battle length up front (it has all events). If the battle would exceed ~90 s at 1×, it scales the short tier down further, and then everything except KOs and the finale, until it fits — never below a readable minimum (~0.35 s per short hit).
- The turn cap (builder picks the value, e.g. 40) remains a last-resort guard against stalemates such as mutual immunities.
The choreographer's duration test covers these tiers and the ~90 s ceiling.

Additional choreography (my proposals): an **intro** (both decks slide in, team names, camera sweep, "Fight" title, ~2 s), bench cards visibly dim/flip when KO'd, and a **victory** sequence (winning team's surviving cards rise and line up, camera orbit, summary panel slides in). Accents (shake/flash/bigger text) only on super-effective, crits and KOs.

**FX families:** group the 18 types into ~6–8 visual families (e.g. fire/dragon; water/ice; electric; grass/bug; psychic/fairy/ghost; fighting/normal/rock/ground/steel; poison/dark; flying) so each looks distinct without 18 bespoke systems. Colours come from the existing `typeColor`.

## 10. The 3D arena (BattleStage)

- **Cards:** rounded-rect card meshes with a front face showing artwork, name and type (rendered to a texture, e.g. via an offscreen canvas), a branded back face, and a subtle holographic sheen shader tinted by type colour (echoing the home page's holo cards).
- **Scene:** dark stage floor with soft reflections or a gradient, rim/key lights tinted per active fighter, gentle fog for depth. Camera rig with named shots (wide, attacker close-up, impact, victory orbit) that the choreographer tweens between.
- **Shatter:** pre-fractured card geometry (shards generated once per card, e.g. triangulated/voronoi-like pieces) with physics-like fall animated by GSAP — no physics engine.
- **Particles:** GPU-friendly `Points`/instanced meshes per FX family, pooled and reused.
- **HUD (DOM, over the canvas):** team bars with fighter portraits and HP, current move name, damage numbers (projected from 3D positions), speed and replay controls. HP and names must be readable as real text (accessible), not only drawn into the canvas.
- **Lifecycle:** handles resize and DPR (cap at 2), pauses rendering when the tab is hidden, disposes all GPU resources on unmount, recovers or shows a message on WebGL context loss / no WebGL support.

## 11. Accessibility and motion setting

- **Motion Off / reduced:** the battle still works. Camera moves become cuts, beats are shortened to quick fades, no shake/flash, shatter becomes a fade-out. The same events, so the outcome is identical.
- A **text battle log** (visually collapsible, always available to screen readers via an `aria-live="polite"` region with throttled announcements) describes each turn ("Charizard used Flamethrower — super effective! Pikachu has 12 HP left").
- All controls keyboard-operable with visible focus; the canvas is `aria-hidden` with the HUD/log carrying the information.
- No flashing faster than 3 times per second.

## 12. Performance and quality bar

- three.js + battle code lazy-loaded; home page bundle unchanged (verify in build output).
- Textures: artwork loaded once per fighter, cached; total GPU memory modest (≤ 8 cards + shards + particles).
- 60 fps target on a mid-range laptop; acceptable on modern phones (portrait layout with adjusted camera framing).
- Unit tests: PRNG determinism, type chart, damage formula, move selection, full-battle determinism (same seed → same events), turn cap, roster migration/validation.
- Choreographer test: given a small event list, produces a timeline with the expected labels and total duration.
- Manual check: full battle at 1× and ×2, Replay identical, Motion Off path, resize mid-battle, mobile portrait.

## 13. Left to the builder

- Exact shader code, card texture layout, shard generation algorithm, particle look per FX family (within the "premium" style).
- Exact durations/eases within the indicative timings, and camera shot composition.
- Router implementation (hand-rolled vs small library), file-level structure inside the layers above.
- Whether to offer "save rival", and preset trainer names/teams (original names, varied types).
- Move-choice weighting details and the turn-cap tiebreak rule, as long as determinism holds.
- Visual design of the battle setup page, HUD and result screen — consistent with the existing Trainer Studio design language.
