# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

---

## Project

Moonshot Bag Calculator — a single-page React + Vite app providing sewing-pattern
calculators for bag makers (panels, bottoms, gussets, pockets, piping, hardware,
etc.). Deployed to GitHub Pages at `/moonshot-bag-calc/`.

---

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint over `**/*.{js,jsx}`
- `npm run preview` — preview the production build
- `npm run deploy` — publish `dist/` to GitHub Pages via `gh-pages`

No test suite is configured.

---

## Current Architecture (post-Passes 1–6)

The monolithic App.jsx (~4500 lines) has been fully decomposed. Current structure:

```
src/
  App.jsx                  ← nav shell only (~400 lines)
  moonshot.css             ← ALL CSS; custom properties; color families
  nav-config.js            ← data-driven nav; adding a tab = one entry here
  curved-panel-core.js     ← geometry/model for CurvedPanel (pure JS, no React)
  boxed-corner-core.js     ← geometry/model for BoxedCorner (pure JS, no React)

  components/
    NavBar.jsx             ← renders from nav-config; no tab logic
    MobileNav.jsx          ← hamburger/slide-away mobile nav
    FracInput.jsx          ← unified fraction/decimal input
    PrintButton.jsx        ← unified print trigger + validation lock
    TrustBadge.jsx         ← validation warnings + print-blocking display
    ComingSoon.jsx         ← branded coming-soon with rocket SVG
    TileSystem.jsx         ← tiling, registration marks, test squares

  tabs/
    CurvedPanel.jsx        ← EXISTS — full calculator
    Gusset.jsx             ← EXISTS — full calculator
    Piping.jsx             ← EXISTS — full calculator
    AccordionPocket.jsx    ← EXISTS — full calculator
    BoxedBottoms.jsx       ← EXISTS — renamed from BoxedCorner.jsx
    ShapedBottoms.jsx      ← EXISTS — renamed from LidBottom.jsx (content stub)
    WeltPocket.jsx         ← EXISTS — coming soon stub
    ZipperPocket.jsx       ← EXISTS — coming soon stub
    TaperedPanel.jsx       ← EXISTS — coming soon stub
    SimpleBottom.jsx       ← EXISTS — coming soon stub
    RectangularPanel.jsx   ← EXISTS — coming soon stub
    TissuePocket.jsx       ← EXISTS — coming soon stub
    ZipperOverlays.jsx     ← EXISTS — coming soon stub
    Handles.jsx            ← EXISTS — coming soon stub
    CrossbodyStrap.jsx     ← EXISTS — coming soon stub
    PurseFeetGuide.jsx     ← EXISTS — coming soon stub
    RivetGuide.jsx         ← EXISTS — coming soon stub
    FlatZipperPouch.jsx    ← EXISTS — coming soon stub
    ShoppingBag.jsx        ← EXISTS — coming soon stub

  utils/
    formatting.js          ← fmtInch, fmtCm, fmtInch32, roundTo8th, etc.
    validation.js          ← geometry validation helpers
    print-utils.js         ← page counting, rotation, tiling math
    constants.js           ← default SA values, unit labels, breakpoints
```

### Core Modules

`curved-panel-core.js` and `boxed-corner-core.js` export geometry primitives
(vector ops, offsetting, intersection tests), pattern-piece builders, and their
own formatting helpers (`cpFmt`, `bcFmt`). Do not modify these unless explicitly
asked.

### Units

Unit mode is module-level mutable state: `let CURRENT_UNIT` in App.jsx, set once
per render from `unitMode` React state. `isMetric()` reads this global throughout
formatting helpers and core modules. Do not memoize formatting calls across
unit-mode changes.

### Print Output

Several tabs generate standalone printable HTML/SVG documents opened via
`window.open`/print (not rendered inline). Examples: `cpPrintDoc`, `cpPrintPanel`,
`cpPrintSides`, `cpPrintGusset` (Curved Panel); `bcPrintDoc`, `bcPrintPanel`,
`bcPrintStabilizer` (Boxed Bottoms).

### Static Reference Tools

`public/curved-panel.html` and `public/thread-needle.html` are standalone HTML
tools served as static assets — not part of the React build. Do not modify them
unless specifically asked.

### Stale Files (do not edit)

- `src/App(backup).jsx` — pre-refactor snapshot, not imported anywhere
- `BottlePocketPage.jsx` (repo root) — early draft, superseded

---

## Navigation Structure

Four primary nav groups. Each group has a color family (see Color System below).

> Note: moonshot-palette.html in the project root is the confirmed color
> system reference. Read it before any theming work. Reference only —
> do not import or deploy it.

### Group 1 — Bag Structures (`--sp-`)

Sub-nav bar color: `#CCC8D8` · Active tab: `#5A2DA0` · Page bg: `#F0ECFC`

| Tab Label | id | File | Status |
|---|---|---|---|
| Simple Bottom | `simple-bottom` | SimpleBottom.jsx | COMING SOON |
| Rectangular Panel | `rectangular-panel` | RectangularPanel.jsx | COMING SOON |
| Curved Panel | `curved-panel` | CurvedPanel.jsx | EXISTS |
| Tapered Panel | `tapered-panel` | TaperedPanel.jsx | COMING SOON |
| Boxed Bottom | `boxed-bottom` | BoxedBottoms.jsx | EXISTS |
| Gussets | `gussets` | Gusset.jsx | EXISTS |

### Group 2 — Trim & Pockets (`--bc-`)

Sub-nav bar color: `#CA6B27` · Active tab: `#A84F14` · Page bg: `#FFFAF6`

| Tab Label | id | File | Status |
|---|---|---|---|
| Accordion Pocket | `accordion` | AccordionPocket.jsx | EXISTS |
| Zipper Pocket | `zipper-pocket` | ZipperPocket.jsx | COMING SOON |
| Welt Pocket | `welt-pocket` | WeltPocket.jsx | COMING SOON |
| Tissue Pocket | `tissue-pocket` | TissuePocket.jsx | COMING SOON |
| Piping | `piping` | Piping.jsx | EXISTS |
| Zipper Overlays | `zipper-overlays` | ZipperOverlays.jsx | COMING SOON |

> Note: Accordion Pocket internal wiring still uses id "bottle" in places.
> Update all references to "accordion" when touching this tab.

### Group 3 — Handles & Hardware (`--hh-`)

Sub-nav bar color: `#567296` · Active tab: `#3A5E8A` · Page bg: `#F5F7FB`

| Tab Label | id | File | Status |
|---|---|---|---|
| Handles | `handles` | Handles.jsx | COMING SOON |
| Crossbody Strap | `crossbody-strap` | CrossbodyStrap.jsx | COMING SOON |
| Purse Feet Guide | `purse-feet` | PurseFeetGuide.jsx | COMING SOON |
| Rivet Guide | `rivet-guide` | RivetGuide.jsx | COMING SOON |

### Group 4 — Basic Bags (`--tp-`)

Sub-nav bar color: `#789070` · Active tab: `#56703A` · Page bg: `#F6FAF3`

| Tab Label | id | File | Status |
|---|---|---|---|
| Flat Zipper Pouch | `flat-zipper-pouch` | FlatZipperPouch.jsx | COMING SOON |
| Shopping Bag | `shopping-bag` | ShoppingBag.jsx | COMING SOON |

### Global Nav Elements (always visible)

- **Thread & Needle Guide** — links to `public/thread-needle.html` (external tab)
- **Imperial / Metric toggle** — top right, controls `unitMode` global
- **PDF Patterns** — future store tab, not yet implemented; render as disabled or hidden
- **Nav burger** — mobile only; collapses to hamburger at <768px

---

## Color System

### Token Naming Note

The CSS custom property prefixes (`--sp-`, `--bc-`, `--tp-`, `--hh-`) were
established under the old 5-group nav and have been reassigned to the new
4-group nav. The prefixes no longer match their group names but the hex values
are correct. A token rename pass is deferred — do not rename prefixes unless
explicitly asked.

Group→token mapping:
- Bag Structures → `--sp-` (purple)
- Trim & Pockets → `--bc-` (orange/amber — was "Bottoms")
- Handles & Hardware → `--hh-` (blue — unchanged)
- Basic Bags → `--tp-` (green — was "Trims & Pockets")
- Reserved → `--cb-` (maroon — see Reserved section)

### Bag Structures — `--sp-`

```css
/* Tab accents */
--sp-violet:   #5c3a9a;
--sp-plum:     #5a2da0;   /* ← active tab color */
--sp-lavender: #9470c8;

/* Nav / structural */
--sp-bar:      #CCC8D8;   /* sub-nav bar background — new token */

/* Group tokens */
--sp-cream:    #faf7ff;
--sp-soft:     #ece5f8;
--sp-line:     #c4aee0;
--sp-ink:      #241550;
--sp-muted:    #7a608e;
--sp-bg:       #F0ECFC;   /* page background */
```

### Trim & Pockets — `--bc-`

```css
/* Tab accents */
--bc-pumpkin:  #a84f14;   /* ← active tab color */
--bc-amber:    #ca6b27;   /* ← sub-nav bar color */
--bc-ochre:    #b8841e;
--bc-sienna:   #7a4828;

/* Group tokens */
--bc-cream:    #fffaf6;   /* ← page background */
--bc-soft:     #f6e3d4;
--bc-line:     #e6b88f;
--bc-ink:      #4d2a15;
--bc-muted:    #9a6b4e;
```

### Handles & Hardware — `--hh-`

```css
/* Tab accents */
--hh-slate:    #567296;   /* ← sub-nav bar color */
--hh-denim:    #3a5e8a;   /* ← active tab color */
--hh-indigo:   #1c385c;

/* Group tokens */
--hh-cream:    #f5f7fb;   /* ← page background */
--hh-soft:     #d9e3ee;
--hh-line:     #a4b9ce;
--hh-ink:      #0e2033;
--hh-muted:    #546c82;
```

### Basic Bags — `--tp-`

```css
/* Tab accents */
--tp-sage:     #789070;   /* ← sub-nav bar color */
--tp-moss:     #56703a;   /* ← active tab color */
--tp-forest:   #2e5022;

/* Group tokens */
--tp-cream:    #f6faf3;   /* ← page background */
--tp-soft:     #dfe9d6;
--tp-line:     #b0c89c;
--tp-ink:      #192e11;
--tp-muted:    #657e58;
```

### Reserved — `--cb-` (maroon)

Not assigned to any nav group. Reserved for future use: store page,
PDF patterns page, guide pages. Do not remove or repurpose without instruction.

```css
--cb-maroon:   #8a1a2c;
--cb-burgundy: #691424;
--cb-wine:     #a4203c;
--cb-cream:    #fdf7f8;
--cb-soft:     #f0dde2;
--cb-line:     #d2a0ac;
--cb-ink:      #380c18;
--cb-muted:    #8a4e5c;
```

### Background Patterns (per group)

Each nav group gets a distinct repeating background pattern. Existing pattern
assets are in the app already — assign one per group:

- **Bag Structures** → diagonal lines
- **Trim & Pockets** → dots
- **Handles & Hardware** → grid marks
- **Basic Bags** → waving lines

Pattern should appear on the page background area, subtly — not on input
or diagram zones.

---

## Page Layout System

This is the standard layout all calculator tabs follow. Established in Pass 8.

### Container

- Max content width: **1400px**, centered with auto side margins
- Breathing room (negative space) visible on both sides at ≤1240px (iPad landscape)
- No fixed heights on the container — page scrolls naturally

### Breakpoints

```css
/* Two-column layout */
@media (min-width: 1024px) { ... }

/* Stacked single column — tablet portrait, landscape phone */
@media (max-width: 1023px) and (min-width: 768px) { ... }

/* Tight single column — mobile */
@media (max-width: 767px) { ... }
```

### Page Zones (top to bottom)

```
┌─────────────────────────────────────────────────┐
│  INTRO CARD  (full content width)               │
├──────────────────────┬──────────────────────────┤
│                      │                          │
│   INPUT COLUMN       │   DIAGRAM                │
│   (flex 1)           │   (flex 1, min 600px)    │
│   min 600px tall     │                          │
│                      ├──────────────────────────┤
│                      │                          │
│                      │   MEASUREMENTS TABLE     │
│                      │                          │
├──────────────────────┴──────────────────────────┤
│  SIDES / GUSSET SECTION  (full width, optional) │
├─────────────────────────────────────────────────┤
│  PRINT CARDS  (full width)                      │
├─────────────────────────────────────────────────┤
│  FOOTER                                         │
└─────────────────────────────────────────────────┘
```

### Intro Card

Every tab gets an intro card. Full content width, rounded corners.
Background: group family color (e.g. `--sp-bg` deepened or the group accent).

Contents:
- Left: outline thumbnail SVG — simple shape icon identifying the calculator type
- Right: tab title (large, bold) + 2–4 sentence description

Thumbnail SVGs are provided by the designer — use placeholder box if not yet
supplied. Do not generate your own thumbnail art.

### Two-Column Body

At ≥1024px: two equal flex columns side by side.
At <1024px: columns stack (inputs → diagram → measurements).

**Input column (left):**
- Minimum height: 600px
- No interior scrolling — ever. Page scrolls; columns do not.
- Contains: input groups (labeled clusters of FracInput/select fields)

**Right column:**
- Minimum height: 600px per zone (diagram zone + measurements zone stacked)
- If input column grows taller than 600px, right column extends with
  negative space below diagram — diagram does not stretch to fill
- Diagram zone: SVG preview, full right-column width
- Measurements zone: results table below diagram

If either column needs to be taller than 600px, both columns extend
together — right column gains negative space below the diagram.

### Input Groups

Fields are clustered into labeled sections:

```jsx
<div className="input-group">
  <div className="input-group-label">DIMENSIONS</div>
  <div className="input-group-fields">
    <FracInput ... />
    <FracInput ... />
  </div>
</div>
```

### Measurements Table

Three columns: PANEL · CUT · SEWLINE

Row groups have a sub-header row (e.g. "LEFT & RIGHT", "TOP", "BOTTOM").
Each group sub-header shows a pill badge indicating cut quantity (e.g. "CUT 2").

**Stabilizer rows:** When stabilizer is active, each piece gets a sub-row
below its CUT/SEWLINE row. The sub-row:
- Shows STABILIZER CUT value only (no SEWLINE entry)
- Is visually lighter — smaller text, muted color, slight indent
- Is NOT a third column — it is a separate row within the group

### Sides / Gusset Section

Appears below the two-column body. Full content width. Only renders when
construction mode includes side panels or a gusset.

**Side Panels mode:** Three diagrams in a row (LEFT & RIGHT · TOP · BOTTOM)
on the left; matching measurements table on the right. Same two-column
proportions as the main body.

**Gusset mode:** Single gusset diagram replaces the three-panel row.
Gusset diagram supports **pan and drag** — user grabs and drags to
explore the long strip. Not truncated, not scroll-locked. Right side
shows gusset measurements table.

**Neither active:** Section hidden entirely.

### Print Cards Section

Full width below the Sides section. Cards scale to what's printable:
- **Multiple cards:** displayed in a row (e.g. Main Panel · Side Panels · Gusset)
- **Single card:** centered, max-width ~400px — does not stretch to full width
- Each card: title, brief description of what prints, PrintButton

---

## Stabilizer Feature (Active — Curved Panel)

The stabilizer/interfacing feature is active in CurvedPanel. When the
Stabilizer toggle is on, a Stabilizer Inset FracInput appears inline.

Reference implementation: BoxedBottoms.jsx already has a complete
stabilizer implementation (toggle state, inset input, cut calculation,
bcPrintStabilizer print output). Model the CurvedPanel stabilizer
directly on this pattern — port and adapt rather than build from scratch.
The geometry math will differ but state shape, toggle behavior, inset
input, and print card structure should follow BoxedBottoms exactly.

Construction toggle layout:
```
[ 4-Sided Enclosed ]  [ 3-Sided Open Top ]
[ Side Panels      ]  [ Gusset           ]
[ Stabilizer                             ]  ← full-width button
  Stabilizer Inset: [FracInput]             ← appears when active
```

Measurements table adds a stabilizer sub-row (see Measurements Table above).

Print output: stabilizer generates its own separate print card (not combined
with the main panel print).

---

## Refactor History (Passes 1–6 Complete)

**Pass 1 — Extract utilities** ✓
Formatting helpers, constants, validation logic moved to `src/utils/`.

**Pass 2 — Extract CSS** ✓
All inline styles and style blocks moved to `src/moonshot.css`.
CSS custom properties established for colors, spacing, typography.

**Pass 3 — Extract shared components** ✓
FracInput, PrintButton, TileSystem, TrustBadge, ComingSoon extracted
to `src/components/`.

**Pass 4 — Split tabs** ✓
Page components extracted one at a time to `src/tabs/`.

**Pass 5 — nav-config + thin App.jsx** ✓
Data-driven nav from nav-config.js. App.jsx is now nav shell only.
File renames: LidBottom→ShapedBottoms, BoxedCorner→BoxedBottoms,
FoldTuck→deprecated, ZipperedPocket→ZipperPocket. Nav ids updated.

**Pass 6 — Theming system** ✓
Color families defined in moonshot.css. Nav colors implemented.
Per-tab theme objects (T, CP, BC, etc.) reference CSS tokens.
Individual tab UI color updates deferred to layout pass.

---

## Active Work

### Pass 7 — Nav Restructure

Update nav from 5-group to 4-group structure. Color token reassignments.
Background patterns per group. No layout changes.

**Instructions for Claude Code:**

1. Update `nav-config.js` with the 4-group structure defined in this file.
   Exact group names, tab labels, ids, and file mappings are in the
   Navigation Structure section above.

2. Update `moonshot.css`:
   - Add `--sp-bar: #CCC8D8` to the `--sp-` token block
   - Add `--sp-bg: #F0ECFC` if not already present
   - Add `--tp-bg: #F6FAF3` to the `--tp-` token block
   - Confirm all other group nav colors match the hex values in the
     Color System section above

3. Apply background patterns to group page backgrounds. One pattern per group:
   - Bag Structures → diagonal lines
   - Trim & Pockets → dots
   - Handles & Hardware → grid marks
   - Basic Bags → waving lines
   Patterns should be subtle — background texture, not foreground art.

4. Create any missing stub tab files listed in the Navigation Structure
   section as COMING SOON. Use the ComingSoon component pattern.

5. Confirm `npm run build` and `npm run lint` pass with no errors.

6. Do not touch any calculator content, layout, or CSS beyond nav colors
   and background patterns.

### Pass 8 — Layout Shell (after Pass 7 confirmed)

Establish the CSS layout system defined in the Page Layout System section.
This is structure only — no tab content changes yet.

**Instructions for Claude Code:**

1. Add all layout CSS classes to `moonshot.css`:
   `.tab-page`, `.tab-intro-card`, `.tab-body`, `.tab-inputs`,
   `.input-group`, `.input-group-label`, `.input-group-fields`,
   `.tab-right`, `.tab-diagram`, `.tab-results`, `.result-table`,
   `.result-group`, `.result-group-header`, `.result-row`,
   `.result-row.stabilizer`, `.tab-sides`, `.tab-print`, `.print-cards`

2. Implement the two-column grid with all three breakpoints.

3. Implement the intro card container (background and typography only —
   no thumbnail SVGs yet, use placeholder box).

4. Implement the measurements table structure with stabilizer sub-row styling.

5. Implement print cards zone — single card centering and multi-card row.

6. Do not apply layout to any tab yet — CSS only, no JSX changes.

7. Confirm `npm run build` passes.

### Pass 9 — Curved Panel First Implementation (after Pass 8 confirmed)

Apply the new layout system to CurvedPanel.jsx as the reference implementation.

**Instructions for Claude Code:**

1. Wrap CurvedPanel content in the layout zones defined in Pass 8.

2. Wire the stabilizer toggle and Stabilizer Inset FracInput per the
   Stabilizer Feature section above.

3. Add stabilizer sub-rows to the measurements table.

4. Apply sides/gusset section toggle behavior:
   - Side Panels active → three-diagram row + measurements
   - Gusset active → single draggable diagram + measurements
   - Neither → section hidden

5. Add print cards for Main Panel, Side Panels, and Gusset (third card
   disabled/greyed when Gusset Depth not set).

6. Apply `--sp-` color family to all accent elements within the tab.

7. Confirm `npm run build` passes and review in browser before declaring done.

### Pass 10+ — Remaining Tabs

Apply layout one tab at a time in this order:
Gusset → BoxedBottoms → Piping → AccordionPocket → (stubs as placeholders)

---

## Working Rules

- Always confirm `npm run build` passes after each change before moving on.
- One pass at a time. Do not begin the next pass until the current one is
  confirmed complete.
- Do not modify `curved-panel-core.js` or `boxed-corner-core.js` unless
  specifically asked.
- Do not edit `App(backup).jsx` or the root `BottlePocketPage.jsx`.
- Do not add features, fix cosmetic issues, or make improvements outside the
  current pass scope. Flag them as notes for later instead.
- Deploy command: `npm run build; npm run deploy` (semicolon-chained in PowerShell)

---

## Flagged for Later (Do Not Implement Now)

- **Token prefix rename** — `--bc-` now serves Trim & Pockets (was Bottoms);
  `--tp-` now serves Basic Bags (was Trims & Pockets). Prefixes don't match
  group names. A rename pass is low priority but should happen before the
  codebase grows much larger.

- **Intro card thumbnail SVGs** — Simple outline SVGs for each tab's intro card.
  Designer-authored. Do not generate — await asset delivery.

- **SVG diagram design system** — A shared `src/utils/diagram-standards.js`
  defining all visual conventions (line types, weights, colors, notch symbols,
  midpoint marks, dimension callouts, legend layout, match marks, registration
  marks, test squares, SA shading). All SVG components should reference it.
  Layered approach:
  - Layer 1: universal primitives (no diagram redefines these)
  - Layer 2: each diagram owns its spatial layout and unique callouts
  - Layer 3: promote shared callout types to design system when reused
  Rule: if two or more diagrams share it, it belongs in the design system.

- **Shaped Bottoms rework** — ShapedBottoms.jsx (was LidBottom.jsx) needs full
  rework: rectangle, rounded rectangle, oval shapes; 2-side vs 4-side panel count;
  optional tapered sides. Significant new calculator.

- **Tapered Panels calculator** — Side/gusset panels that taper as bag grows in
  height. 2 or 4 panels, straight or curved taper. Connects mathematically to
  Shaped Bottoms.

- **Stabilizer feature — all tabs** — CurvedPanel gets it first (Pass 9).
  Apply consistently to all calculator tabs after layout system is established.
  Modeled after CurvedPanel implementation.
  The stabilizer/interfacing feature is active in CurvedPanel. When the
Stabilizer toggle is on, a Stabilizer Inset FracInput appears inline.
Reference implementation: BoxedBottoms.jsx already has a complete
stabilizer implementation (toggle state, inset input, cut calculation,
bcPrintStabilizer print output). Model the CurvedPanel stabilizer
directly on this pattern — port and adapt rather than build from scratch.
The geometry math will differ but state shape, toggle behavior, inset
input, and print card structure should follow BoxedBottoms exactly.

- **Gusset pan/drag interaction** — The gusset diagram canvas supports grab-and-drag
  to explore long strips. Implement when Gusset tab gets its Pass 10 layout treatment.

- **Print paper size options** — `print-utils.js` should support Letter, A4,
  Tabloid/11×17. Implement after layout pass is complete.

- **Bag Project / Design Cart** — Persistent session layer; saves measurements
  across tabs; import panel dimensions into pocket calculators. Requires shared
  state architecture. Implement after all individual calculators are stable.

- **Yardage Calculator** — Takes completed pattern piece dimensions, calculates
  fabric yardage. Supports multiple fabric types. Placement TBD.

- **CSS custom property audit script** — Node.js script (`scripts/check-css-vars.js`)
  that reads moonshot.css, finds every `var(--something)` reference, confirms each
  has a matching `:root` definition. Run as `npm run check-vars`.

- **`--cb-` maroon family** — Reserved. Not assigned to any nav group.
  Future use: store page, PDF patterns page, guide pages.

- **Mascot character** — Space-themed bag-maker character. Token palette:
  fur `#b870d8`, highlight `#e0a8f4`, shadow `#7838a0`, skin `#f0c090`,
  eyes `#f0c030`, suit `#4890d0`, glow `#f05880`, star `#fff4d0`.
  SVG format. Use cases: Coming Soon, empty states, error pages, loading.

- **Shopping Bag calculator** — Complete bag calculator (was Grocery Tote).

- **`moonshot-consolidated-reference.css`** — Designer style reference in project
  root. Read before making visual changes to moonshot.css. Reference only —
  do not import or deploy.

## Clean up Later
  TaperedPanels.jsx, FoldedBottoms.jsx, ShapedBottoms.jsx,
  HandlesStraps.jsx, PurseFeet.jsx, RivetGuides.jsx,
  ZipperPouch.jsx, GroceryTote.jsx
