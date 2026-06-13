# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Moonshot Bag Calculator — a single-page React + Vite app providing a set of sewing-pattern calculators (bag lids/bottoms, gussets, piping, bottle/accordion pockets, curved panels, boxed corners, etc.). Deployed to GitHub Pages.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint over `**/*.{js,jsx}`
- `npm run preview` — preview the production build
- `npm run deploy` — publish `dist/` to GitHub Pages via `gh-pages` (base path is `/moonshot-bag-calc/`, set in `vite.config.js`)

There is no test suite/runner configured.

## Architecture

### Monolithic App.jsx

Nearly the entire UI lives in `src/App.jsx` (~4500 lines). It contains, in roughly this order:
- One-time side effects run at module load (outside any component): injects Google Analytics (GA4), a `theme-color` meta tag, Google Fonts `<link>`, and a global responsive `<style>` block directly into `document.head`.
- Math/formatting helpers (`fmtInch`, `fmtInch32`, `fmtCm`, `roundTo8th`, perimeter/ellipse helpers, etc.)
- Shared small UI components: `FracInput`/`CpFracInput`/`BcFracInput` (whole+fraction length inputs with metric/imperial modes), `Card`, `CardTitle`, `RRow`, `InfoBox`, `NoteBox`, `SubTabs`, `Nudge`, `Divider`, `SABar`.
- SVG diagram builders — some as JSX components (`PanelDiagram`, `GussetDiagram`, `RoundOvalGussetDiagram`, `AccordionSVG`), others built imperatively via DOM (`buildDiagramSVG` using the `dse`/`dap` helpers).
- One top-level page component per calculator tab: `LidPage`, `GussetPage`, `PipingPage`, `BottlePocketPage`, `CurvedPanelPage`, `BoxedCornerPage`, plus `ComingSoon` for unimplemented tabs.
- `MoonshotBagCalc` (default export) — the app shell: header, unit toggle, two-level nav, and renders every page component simultaneously, toggling visibility with inline `display:none` so each page's local state/scroll position persists across tab switches.

### Extracted "core" modules

Geometry/model-building logic for the two most complex pages is factored out of `App.jsx` into pure (non-React) modules, imported and consumed by their respective page components:
- `src/curved-panel-core.js` → `CurvedPanelPage` (via `buildCurvedPanelModel` and friends)
- `src/boxed-corner-core.js` → `BoxedCornerPage` (via `buildBoxedCornerModel` and friends)

These export geometry primitives (vector ops, offsetting, intersection tests), pattern-piece builders, and their own `fmtIn`/`fmtDec`/`ptsToPath` formatting helpers — separate from the ones defined in `App.jsx`.

### Units (imperial/metric)

Unit mode is module-level mutable state: `let CURRENT_UNIT` in `App.jsx`, set once per render from the `unitMode` React state in `MoonshotBagCalc` (`CURRENT_UNIT = unitMode`). `isMetric()` reads this global and is checked throughout formatting/rounding helpers (`fmtInch`, `fmtCm`, `fmtInch32`, `roundTo8th`, etc.) and in the core modules' own `cpFmt`/`bcFmt` wrappers. Because this is a shared global rather than passed-down state, formatting helpers must be called during/after render (not memoized across unit-mode changes in ways that bypass it).

### Theming

Each major section has its own color/theme object passed as a `th` prop into shared components: `T` (per-tab themes for Lid/Gusset/Piping/Bottle Pocket), `DT` (SVG diagram color tokens), `CP` (Curved Panel "maroon" palette), `BC`/`BC_THEME` (Boxed Corner "pumpkin" palette).

### Navigation

`NAV_GROUPS` (near the bottom of `App.jsx`) defines the two-level nav: groups (Basic, Advanced, Pockets, Trims & Straps) each containing pages with `id`/`label`/`color`, with `coming:true` for placeholder tabs rendered via `ComingSoon`. `navGroupForPage` maps a page id back to its group. `MoonshotBagCalc` remembers the last-visited page per group (`lastPageByGroup`) and per-tab scroll position (`scrollPositions`), and has separate mobile-collapse behavior for the sticky header (`isPhoneNav`/`mobileNavCollapsed`).

### Print/pattern output

Several pages generate standalone printable pattern documents as HTML/SVG strings (e.g. `cpPrintDoc`/`cpPrintPanel`/`cpPrintSides`/`cpPrintGusset` for Curved Panel, `bcPrintDoc`/`bcPrintPanel`/`bcPrintStabilizer` for Boxed Corner). These build full-scale, tiled SVG pattern pieces with registration marks for print-at-home use, opened via `window.open`/print rather than rendered inline.

### Static reference tools

`public/curved-panel.html` and `public/thread-needle.html` are standalone HTML reference tools served as static assets (linked from the app, e.g. the "Thread & Needle Guide" button) — they are not part of the React build.

### Stale/scratch files (not part of the build)

- `src/App(backup).jsx` — backup snapshot, not imported anywhere.
- `BottlePocketPage.jsx` (repo root) — an early draft with manual integration instructions in comments; superseded by the `BottlePocketPage` function already inside `src/App.jsx`.

Avoid editing these unless specifically asked to reconcile/remove them.
## Refactor Plan (Active — Do Not Skip)

This project is undergoing a structured refactor. Work through it in order.
Do not make visual tweaks, add features, or chase improvements outside the
current pass unless explicitly asked.

### Target Architecture

src/
  App.jsx              ← nav shell only; imports tabs; mounts active tab
  moonshot.css         ← ALL CSS and custom properties (extracted from App.jsx)
  nav-config.js        ← data-driven nav; adding a tab = one entry here

  components/
    NavBar.jsx         ← renders from nav-config; no tab logic
    MobileNav.jsx      ← slide-away mobile behavior
    FracInput.jsx      ← unified fraction/decimal input (replaces FracInput/CpFracInput/BcFracInput)
    PrintButton.jsx    ← unified print trigger + validation lock
    TileSystem.jsx     ← all tiling, registration marks, test squares, page counting
    TrustBadge.jsx     ← validation warnings + print blocking display
    ComingSoon.jsx     ← branded coming-soon with rocket SVG

  tabs/
    LidBottom.jsx
    Gusset.jsx
    Piping.jsx
    CurvedPanel.jsx
    BoxedCorner.jsx
    FoldTuck.jsx
    AccordionPocket.jsx
    ZipperedPocket.jsx
    WeltPocket.jsx
    TrimsStraps.jsx

  utils/
    formatting.js      ← fmtInch, fmtCm, fmtInch32, roundTo8th, fraction parsing
    validation.js      ← geometry validation helpers
    print-utils.js     ← page counting, rotation logic, tiling math
    constants.js       ← default SA values, unit labels, breakpoints

> Note: TileSystem.jsx is deferred. src/utils/print-utils.js fulfills the
> TileSystem role for now (pure tiling math, labels, test squares, registration
> marks). A thin TileSystem.jsx wrapper component should be created in Pass 4
> when tab components begin needing print UI rendering.

### Refactor Passes (in order)

**Pass 1 — Extract utilities**
Move formatting helpers, constants, and validation logic from App.jsx into
src/utils/. No visual changes. No component moves. Confirm build passes.

**Pass 2 — Extract CSS**
Move all inline styles and style blocks from App.jsx into src/moonshot.css.
Establish CSS custom properties for all colors, spacing, and typography.
Document layout rules as comments. Confirm build passes.

**Pass 3 — Extract shared components**
Formalize FracInput, PrintButton, TileSystem, TrustBadge, ComingSoon as
standalone files in src/components/. Confirm build passes.

**Pass 4 — Split tabs**
Extract page components one at a time into src/tabs/, starting with the
simplest (Piping or Gusset). Confirm each one builds before moving to next.

**Pass 5 — nav-config + thin App.jsx**
Wire up data-driven nav from nav-config.js. App.jsx becomes nav shell only.

### Working Rules

- Always confirm the build passes after each change before moving on.
- One pass at a time. Do not begin the next pass until the current one is complete.
- Do not modify curved-panel-core.js or boxed-corner-core.js during this refactor
  unless specifically asked.
- Do not edit App(backup).jsx or the root BottlePocketPage.jsx.
- Do not add features, fix cosmetic issues, or make improvements outside the
  current pass scope. Flag them as notes for later instead.

## Flagged for Later (Do Not Implement Now)

These are confirmed future features to add after the refactor is complete.

- **Print paper size options** — print-utils.js should support selectable paper
  sizes (Letter, A4, Tabloid/11×17, etc.) so users with larger-format printers
  can reduce page tiling. Do not implement during the refactor passes.

- **Stabilizer/Interfacing pattern output** — All calculator tabs should support
  an optional stabilizer/interfacing inset (separate from SA, user-defined).
  Output options: include stabilizer piece in the main printout, or generate it
  as a separate printout. Modeled after the existing Boxed Corner stabilizer
  implementation. Apply consistently across all tabs once refactor is complete.

- **SVG diagram design system** — Create a shared diagram standards module
  (e.g. src/utils/diagram-standards.js) that defines all visual conventions
  used across live-preview and print SVG diagrams. Should include:

  - Bounding box and viewBox rules (padding, aspect ratio behavior, min/max size)
  - Color tokens for cut lines, sewlines, fold lines, grainlines, centerlines
  - Line weight standards per line type
  - Dash/dot patterns for non-solid lines (sewline, foldline, etc.)
  - Notch symbol style and sizing
  - Midpoint mark style and sizing  
  - Corner and curve indicator conventions
  - Dimension callout style (arrow style, font, size, offset from edge)
  - Legend layout rules (position, order, what always appears vs. conditional)
  - Label and annotation typography
  - Match mark style
  - Registration mark style (print only)
  - Test square style and placement (print only)
  - Seam allowance shading/hatching conventions

  All SVG diagram components should reference this module rather than
  defining their own colors, weights, or symbols inline. Standardize
  existing diagrams against it after refactor is complete.
    
    **Layered approach — how to apply the design system:**
  
  - Layer 1 (design system): universal primitives only — line types, weights,
    colors, dimension callout style, notch symbols, midpoint marks, match marks,
    registration marks, test squares, legend layout. No diagram redefines these.
  
  - Layer 2 (component): each diagram owns its own spatial layout, named zones,
    and unique callout logic. Example: AccordionSVG manages face/flap labels,
    center gap indicators, and overage zone shading internally — but references
    design system primitives for all visual styling.
  
  - Layer 3 (growth): when a unique callout type appears in one diagram and
    later becomes useful in another, promote it to the design system at that
    point. The system grows intentionally, not speculatively.
  
  Rule of thumb: if two or more diagrams share it, it belongs in the design
  system. If only one diagram uses it, it lives in that component but still
  references design system primitives for color, weight, and typography.

  - **CSS custom property audit script** — Add a small Node.js script
  (e.g. scripts/check-css-vars.js) that reads moonshot.css, finds every
  var(--something) reference, and confirms each one has a matching :root
  definition. Flag any orphaned references. Should run as part of the lint
  step or as a standalone npm script (e.g. npm run check-vars). Implement
  after Pass 2 is complete and the full :root token set is established.