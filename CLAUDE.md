# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

---

## Project

Moonshot Bag Calculator — a single-page React + Vite app providing sewing-pattern
calculators for bag makers (panels, bottoms, gussets, pockets, piping, hardware,
etc.). Deployed to GitHub Pages at /moonshot-bag-calc/.

---

## Commands

- npm run dev — start Vite dev server
- npm run build — production build to dist/
- npm run lint — ESLint over **/*.{js,jsx}
- npm run preview — preview the production build
- npm run deploy — publish dist/ to GitHub Pages via gh-pages

No test suite is configured.

---

## Current Architecture

The monolithic App.jsx has been fully decomposed. Current structure:

src/
  App.jsx                  <- nav shell only (179 lines)
  moonshot.css             <- ALL CSS; custom properties; color families
  nav-config.js            <- data-driven nav; adding a tab = one entry here
  curved-panel-core.js     <- geometry/model for CurvedPanel (pure JS, no React)
  boxed-corner-core.js     <- geometry/model for BoxedCorner (pure JS, no React)
  geometryOffset.js        <- curve-aware per-side path offset; extracted from curved-panel-core.js in Pass 11
  diagramTokens.js         <- centralized color/spec constants for SVG diagram standard
  stabilizer.js            <- stabilizer geometry + shared draw helper; extracted in Pass 11
  measurementsTable.js     <- HTML table row/block builders (cpProw, cpPieceBlock); extracted in Pass 11
  diagramMarks.js          <- shared SVG mark builders for print diagrams; extracted in Pass 11
  printRenderers.js        <- all print-output functions for CurvedPanel; extracted in Pass 11

  components/
    NavBar.jsx             <- desktop nav; props: page, setPage, activeGroup, onGroupClick
    MobileNav.jsx          <- mobile hamburger nav; props: page, setPage, activeGroup
    Footer.jsx             <- full-width footer
    FracInput.jsx          <- unified fraction/decimal input
    PrintButton.jsx        <- unified print trigger + validation lock
    TrustBadge.jsx         <- validation warnings + print-blocking display
    ComingSoon.jsx         <- branded coming-soon with rocket SVG
    SharedUI.jsx           <- reusable card/header/seam-allowance UI components
    AboutModal.jsx         <- about modal triggered from NavBar

  tabs/
    CurvedPanel.jsx        <- EXISTS -- full calculator
    CurvedPanel.jsx.tmp    <- orphaned tmp file; safe to delete in a future cleanup pass
    Gusset.jsx             <- EXISTS -- full calculator
    Piping.jsx             <- EXISTS -- full calculator
    AccordionPocket.jsx    <- EXISTS -- full calculator
    BoxedBottoms.jsx       <- EXISTS -- full calculator
    WeltPocket.jsx         <- EXISTS -- coming soon stub
    ZipperPocket.jsx       <- EXISTS -- coming soon stub
    TaperedPanel.jsx       <- EXISTS -- coming soon stub
    SimpleBottom.jsx       <- EXISTS -- coming soon stub
    RectangularPanel.jsx   <- EXISTS -- coming soon stub
    TissuePocket.jsx       <- EXISTS -- coming soon stub
    ZipperOverlays.jsx     <- EXISTS -- coming soon stub
    Handles.jsx            <- EXISTS -- coming soon stub
    CrossbodyStrap.jsx     <- EXISTS -- coming soon stub
    PurseFeetGuide.jsx     <- EXISTS -- coming soon stub
    RivetGuide.jsx         <- EXISTS -- coming soon stub
    FlatZipperPouch.jsx    <- EXISTS -- coming soon stub
    ShoppingBag.jsx        <- EXISTS -- coming soon stub

  utils/
    formatting.js          <- fmtInch, fmtCm, fmtInch32, roundTo8th, setCurrentUnit, isMetric, etc.
    print-utils.js         <- page counting, rotation, tiling math
    constants.js           <- PI, GA_MEASUREMENT_ID, DEFAULT_SA, CORDS
    geometry.js            <- ellipse and rounded-rect perimeter math
    theme.js               <- color token objects used by non-CurvedPanel tabs

### Core Modules

curved-panel-core.js and boxed-corner-core.js export geometry primitives
(vector ops, offsetting, intersection tests), pattern-piece builders, and their
own formatting helpers (cpFmt, bcFmt). Do not modify these unless explicitly asked.

geometryOffset.js holds the curve-aware per-side path offset function
(offsetSidePaths, joinAllSides) shared by the sewline and stabilizer paths.
It was relocated from curved-panel-core.js in Pass 11 and is self-contained.

### Units

Unit mode is module-level mutable state: `let CURRENT_UNIT` in
`src/utils/formatting.js`, exported via `setCurrentUnit()`. App.jsx calls
`setCurrentUnit(unitMode)` on each render. `isMetric()` reads this global
throughout formatting helpers and core modules. Do not memoize formatting
calls across unit-mode changes.

The Imperial/Metric unit toggle is NOT in the nav bar. It lives inside
CurvedPanel.jsx and is passed as props `{ unitMode, setUnitMode }` from
App.jsx only to CurvedPanel. Other tabs currently ignore unit mode.

### Print Output

Several tabs generate standalone printable HTML/SVG documents opened via
window.open/print (not rendered inline).

CurvedPanel print functions (cpPrintDoc, cpPrintPanel, cpPrintSides,
cpPrintGusset, cpPrintStabilizer) live in src/printRenderers.js.

BoxedBottoms print functions (bcPrintDoc, bcPrintPanel, bcPrintStabilizer)
still live inside src/tabs/BoxedBottoms.jsx.

### Static Reference Tools

public/curved-panel.html and public/thread-needle.html are standalone HTML
tools served as static assets -- not part of the React build. Do not modify them
unless specifically asked.

### Stale Files (do not edit)

- src/App(backup).jsx -- pre-refactor snapshot, not imported anywhere
- BottlePocketPage.jsx (repo root) -- early draft, superseded

---

## Navigation Structure

Four primary nav groups. Each group has a color family (see Color System below).

Note: moonshot-palette.html in the project root is the confirmed color
system reference. Read it before any theming work. Reference only --
do not import or deploy it.

### Group 1 -- Bag Structures (--sp-)

Sub-nav bar color: #8B5CC8
Active sub-tab bg: #5A2DA0
Active primary tab text: #C4A0F0
Primary tab hover tint: rgba(196,160,240,0.11)
Page bg: #F0ECFC

Tab Label         | id                 | File                  | Status
Simple Bottom     | simple-bottom      | SimpleBottom.jsx      | COMING SOON
Rectangular Panel | rectangular-panel  | RectangularPanel.jsx  | COMING SOON
Curved Panel      | curved-panel       | CurvedPanel.jsx       | EXISTS
Tapered Panel     | tapered-panel      | TaperedPanel.jsx      | COMING SOON
Boxed Bottom      | boxed-bottom       | BoxedBottoms.jsx      | EXISTS
Gussets           | gussets            | Gusset.jsx            | EXISTS

### Group 2 -- Trim & Pockets (--bc-)

Sub-nav bar color: #D97830
Active sub-tab bg: #A84F14
Active primary tab text: #F5A96C
Primary tab hover tint: rgba(245,169,108,0.11)
Page bg: #FFFAF6

Tab Label         | id                 | File                  | Status
Accordion Pocket  | accordion          | AccordionPocket.jsx   | EXISTS
Zipper Pocket     | zipper-pocket      | ZipperPocket.jsx      | COMING SOON
Welt Pocket       | welt-pocket        | WeltPocket.jsx        | COMING SOON
Tissue Pocket     | tissue-pocket      | TissuePocket.jsx      | COMING SOON
Piping            | piping             | Piping.jsx            | EXISTS
Zipper Overlays   | zipper-overlays    | ZipperOverlays.jsx    | COMING SOON

Note: Accordion Pocket internal wiring still uses id "bottle" in places.
Update all references to "accordion" when touching this tab.

### Group 3 -- Handles & Hardware (--hh-)

Sub-nav bar color: #567296
Active sub-tab bg: #3A5E8A
Active primary tab text: #8BBCD8
Primary tab hover tint: rgba(139,188,216,0.11)
Page bg: #F5F7FB

Tab Label         | id                 | File                  | Status
Handles           | handles            | Handles.jsx           | COMING SOON
Crossbody Strap   | crossbody-strap    | CrossbodyStrap.jsx    | COMING SOON
Purse Feet Guide  | purse-feet         | PurseFeetGuide.jsx    | COMING SOON
Rivet Guide       | rivet-guide        | RivetGuide.jsx        | COMING SOON

### Group 4 -- Basic Bags (--tp-)

Sub-nav bar color: #789070
Active sub-tab bg: #56703A
Active primary tab text: #9ACC78
Primary tab hover tint: rgba(154,204,120,0.11)
Page bg: #F6FAF3

Tab Label         | id                 | File                  | Status
Flat Zipper Pouch | flat-zipper-pouch  | FlatZipperPouch.jsx   | COMING SOON
Shopping Bag      | shopping-bag       | ShoppingBag.jsx       | COMING SOON

### Global Nav Elements

- Thread & Needle Guide -- NavBar opens the deployed GitHub Pages URL in a
  new tab (https://moonshotbagcalc-cpu.github.io/moonshot-bag-calc/thread-needle.html),
  not a relative path to public/. The local public/ asset is still used in production.
- PDF Patterns -- future store tab, not yet implemented; render as disabled or hidden
- Nav burger -- mobile only; collapses to hamburger at <768px

For the visual design spec of NavBar, MobileNav, and Footer, see
docs/PASS_HISTORY.md (implemented in Pass 7; component files are now the source
of truth for current implementation).

---

## Color System

### Token Naming Note

The CSS custom property prefixes (--sp-, --bc-, --tp-, --hh-) were
established under the old 5-group nav and have been reassigned to the new
4-group nav. The prefixes no longer match their group names but the hex values
are correct. A token rename pass is deferred -- do not rename prefixes unless
explicitly asked.

Group to token mapping:
- Bag Structures    -> --sp- (purple)
- Trim & Pockets   -> --bc- (orange/amber -- was "Bottoms")
- Handles & Hardware -> --hh- (blue -- unchanged)
- Basic Bags       -> --tp- (green -- was "Trims & Pockets")
- Reserved         -> --cb- (maroon -- see Reserved section)

### Bag Structures -- --sp-

/* Tab accents */
--sp-violet:   #5c3a9a;
--sp-plum:     #5a2da0;   /* active sub-tab bg */
--sp-lavender: #9470c8;

/* Nav structural */
--sp-bar:      #8B5CC8;   /* sub-nav bar bg */

/* Nav text */
--sp-nav-active-text:  #C4A0F0;
--sp-nav-hover-tint:   rgba(196,160,240,0.11);

/* Group tokens */
--sp-cream:    #faf7ff;
--sp-soft:     #ece5f8;
--sp-line:     #c4aee0;
--sp-ink:      #241550;
--sp-muted:    #7a608e;
--sp-bg:       #F0ECFC;

### Trim & Pockets -- --bc-

/* Tab accents */
--bc-pumpkin:  #a84f14;   /* active sub-tab bg */
--bc-amber:    #ca6b27;
--bc-ochre:    #b8841e;
--bc-sienna:   #7a4828;

/* Nav structural */
--bc-bar:      #D97830;   /* sub-nav bar bg */

/* Nav text */
--bc-nav-active-text:  #F5A96C;
--bc-nav-hover-tint:   rgba(245,169,108,0.11);

/* Group tokens */
--bc-cream:    #fffaf6;
--bc-soft:     #f6e3d4;
--bc-line:     #e6b88f;
--bc-ink:      #4d2a15;
--bc-muted:    #9a6b4e;

### Handles & Hardware -- --hh-

/* Tab accents */
--hh-slate:    #567296;   /* sub-nav bar color */
--hh-denim:    #3a5e8a;   /* active sub-tab bg */
--hh-indigo:   #1c385c;

/* Nav text */
--hh-nav-active-text:  #8BBCD8;
--hh-nav-hover-tint:   rgba(139,188,216,0.11);

/* Group tokens */
--hh-cream:    #f5f7fb;
--hh-soft:     #d9e3ee;
--hh-line:     #a4b9ce;
--hh-ink:      #0e2033;
--hh-muted:    #546c82;

### Basic Bags -- --tp-

/* Tab accents */
--tp-sage:     #789070;   /* sub-nav bar color */
--tp-moss:     #56703a;   /* active sub-tab bg */
--tp-forest:   #2e5022;

/* Nav text */
--tp-nav-active-text:  #9ACC78;
--tp-nav-hover-tint:   rgba(154,204,120,0.11);

/* Group tokens */
--tp-cream:    #f6faf3;
--tp-soft:     #dfe9d6;
--tp-line:     #b0c89c;
--tp-ink:      #192e11;
--tp-muted:    #657e58;

### Reserved -- --cb- (maroon)

Not assigned to any nav group. Reserved for future use: store page,
PDF patterns page, guide pages. Do not remove or repurpose without instruction.

--cb-maroon:   #8a1a2c;
--cb-burgundy: #691424;
--cb-wine:     #a4203c;
--cb-cream:    #fdf7f8;
--cb-soft:     #f0dde2;
--cb-line:     #d2a0ac;
--cb-ink:      #380c18;
--cb-muted:    #8a4e5c;

### Background Patterns (per page)

Implemented in App.jsx as PAGE_PATTERNS -- a map keyed per individual page ID,
not per nav group. Each entry provides a background color and a repeating SVG
pattern string. Applied to document.body; not on input or diagram zones.

---

## Page Layout System

This is the standard layout all calculator tabs follow. Established in Pass 8.

### Container

- Max content width: 1400px, centered with auto side margins
- Breathing room visible on both sides at <=1240px (iPad landscape)
- No fixed heights on the container -- page scrolls naturally

### Breakpoints

/* Two-column layout */
@media (min-width: 1024px) { ... }

/* Stacked single column -- tablet portrait, landscape phone */
@media (max-width: 1023px) and (min-width: 768px) { ... }

/* Tight single column -- mobile */
@media (max-width: 767px) { ... }

### Page Zones (top to bottom)

  INTRO CARD          (full content width)
  INPUT COLUMN        DIAGRAM
  (flex 1)            (flex 1)
  min 600px           MEASUREMENTS TABLE
  SIDES / GUSSET SECTION  (full width, optional)
  PRINT CARDS         (full width)
  FOOTER

### Intro Card

Every tab gets an intro card. Full content width, rounded corners.
Background: group family color.

Contents:
- Left: outline thumbnail SVG -- placeholder box if not yet supplied
- Right: tab title (large, bold) + 2-4 sentence description

Do not generate thumbnail art -- await designer delivery.

### Two-Column Body

At >=1024px: two equal flex columns side by side.
At <1024px: columns stack (inputs -> diagram -> measurements).

Input column (left):
- Minimum height: 600px
- No interior scrolling ever. Page scrolls; columns do not.
- Contains: input groups (labeled clusters of FracInput/select fields)

Right column:
- Minimum height: 600px per zone (diagram + measurements stacked)
- Diagram zone: SVG preview, full right-column width
- Measurements zone: results table below diagram

### Measurements Table

Three columns: PANEL / CUT / SEWLINE

Row groups have a sub-header row. Each shows a cut quantity pill (e.g. CUT 2).

Stabilizer rows: when stabilizer active, each piece gets a sub-row.
- Shows STABILIZER CUT value only (no SEWLINE)
- Visually lighter -- smaller text, muted color, slight indent
- Separate row, not a third column

### Sides / Gusset Section

Below two-column body. Full content width. Only renders when construction
mode includes side panels or gusset.

Side Panels mode: three diagrams in a row + matching measurements table.
Gusset mode: single draggable gusset diagram + measurements table.
Neither active: section hidden entirely.

### Print Cards Section

Full width below Sides section.
Multiple cards: displayed in a row.
Single card: centered, max-width ~400px.
Each card: title, description, PrintButton.

---

## Stabilizer Feature (Active -- CurvedPanel and BoxedBottoms)

The stabilizer/interfacing feature is active in CurvedPanel (geometry in
stabilizer.js) and BoxedBottoms (self-contained in BoxedBottoms.jsx).
Extending to remaining calculator tabs is in Flagged for Later.

Construction toggle layout (CurvedPanel):
  [ 4-Sided Enclosed ]  [ 3-Sided Open Top ]
  [ Side Panels      ]  [ Gusset           ]
  [ Stabilizer                             ]  <- full-width button
    Stabilizer Inset: [FracInput]             <- appears when active

Print output: stabilizer generates its own separate print card.

---

## SVG Diagram Standard — ALWAYS ACTIVE (applies regardless of current pass)

These rules govern every SVG diagram in this project — screen and print, every category, every calculator tab. They are not reference material to consult when convenient. They are binding rules to apply every time you write, modify, or touch any SVG rendering function, component, path calculation, or style value.

**Trigger condition:** if you are writing or editing any code that produces an SVG element, path, stroke, fill, or legend — these rules apply. This includes `cpPanelDiagramSVG()`, `cpMiniStrip()`, `cpMiniTrapezoid()`, any new diagram component, and any future diagram code added in later passes.

**Do not approximate.** Every color, weight, and spacing value below is exact. Do not round, do not eyeball, do not substitute a "close enough" value from an existing component. If you are unsure which value applies, stop and ask rather than guess.

**Do not hardcode.** Never write a literal hex value directly into a diagram component. Always reference the category color and mark color constants defined for this standard. If those constants don't exist yet in the codebase, create them centrally (e.g. in a shared `diagramTokens.js` or equivalent) rather than repeating literals across files.

**Tier check first.** Before writing any diagram code, determine which tier it belongs to:
- **Tier 1 — pattern piece diagrams** (panels, strips, gussets, bottoms): the full standard below applies in total — every layer, every mark, every spec.
- **Tier 2 — instructional/construction diagrams** (accordion pocket steps, zipper diagrams, assembly illustrations): ONLY category colors, fonts, and fill tints apply. Do NOT apply the mark layer system, geometry pipeline, or legend token set to Tier 2 diagrams. Never route a Tier 2 diagram through `cpPanelDiagramSVG()` or `cpMiniStrip()` — those functions are Tier 1 only and must stay that way.

If you write a Tier 1 diagram that skips a mark layer, omits the legend, or uses a color outside this spec, that is a bug — fix it before considering the pass complete.

---

### Category color families

Every diagram belongs to one of four categories. Use the category's color for cut lines, corner junctions, and fill tint. Never mix category colors within one diagram.

| Category | Color | Hex | Fill tint |
|---|---|---|---|
| Bag Structures | Purple | `#5340b8` | `#ede8f8` |
| Trim & Pockets | Orange | `#c45e1a` | `#fdf0e6` |
| Handles & Hardware | Blue | `#1565c0` | `#e3edf8` |
| Basic Bags | Green | `#2e7d32` | `#e6f4e8` |

Fill tint opacity: 48% on screen, 20–25% on print. Always apply this opacity range — never render the fill tint at full opacity.

---

### Z-order — MUST render in this exact stacking order, bottom to top

Render layers in this order without exception. If a diagram component renders marks out of order (e.g. cut line before sewline), that is a bug.

1. Fill (category tint, semi-transparent)
2. Ghost shape (cut edge only, offset, faint)
3. Stabilizer path (rust dashed)
4. Sewline path (mid-grey dashed)
5. Center / crosshair lines (cyan dashed)
6. Fold lines (green dashed)
7. Corner junction marks (category color, open square)
8. Easing marks (dark cyan ticks)
9. Midpoint marks (red circles)
10. Center match triangles (red solid)
11. Cut line (category color, solid — topmost line layer)
12. Dimension labels (if shown — always rendered above the cut line)

---

### Universal mark colors — NEVER vary by category

These colors are fixed across all four categories. Only the cut line and corner junctions use the category color; every other mark below uses its fixed color regardless of which category is active. Do not let a category's accent color leak into these marks.

| Mark | Color | Notes |
|---|---|---|
| Cut line | category color | varies by category |
| Sewline | `#808080` | mid-grey, 50% |
| Center / crosshair | `#00bcd4` | cyan |
| Fold lines | `#2e7d32` | green |
| Stabilizer | `#bf5630` | rust |
| Midpoint marks | `#d32f2f` | red |
| Center match triangles | `#d32f2f` | red |
| Corner junctions | category color | open square, matches cut line |
| Easing marks | `#0097a7` | dark cyan — distinct from center line cyan, do not reuse `#00bcd4` |

---

### Individual mark specifications — exact values, apply as written

**Cut line**
- Color: category color
- Weight: 2.5px screen · 0.04in print
- Style: solid, round cap, round join

**Sewline**
- Color: `#808080`
- Weight: 1.5px screen · 0.022in print
- Style: dashed — 9px on / 7px off (screen) · 0.15in on / 0.10in off (print)

**Stabilizer line**
- Color: `#bf5630`
- Weight: 1.5px screen · 0.026in print
- Style: dotted, round dots — 4px on / 5px off (screen) · 0.10in on / 0.08in off (print)

**Center / crosshair lines** (symmetry axis on panels; horizontal + vertical midpoint lines on strips)
- Color: `#00bcd4`
- Weight: 1.2px screen · 0.018in print
- Style: long dash — 4px on / 6px off (screen) · 0.25in on / 0.15in off (print)

**Fold lines** (marks the fabric fold edge — distinct from center line, never conflate the two)
- Color: `#2e7d32`
- Weight: 1.2px screen · 0.018in print
- Style: dashed, same dash pattern as center lines

**Midpoint marks** (arc-length midpoint of each sewline edge, placed ON the sewline — one per edge; on strips, one mark per long edge, vertically aligned)
- Shape: circle, 5px radius screen · 0.07in print
- Fill: `#ffffff`
- Stroke: `#d32f2f`, 1.5px weight

**Center match triangles** (inward-pointing solid triangle on the cut line at the midpoint of each edge)
- Color: `#d32f2f`, solid fill, no stroke
- Base: 8px screen · 0.16in print
- Height: 11px screen · 0.26in print
- Position: on cut line, apex pointing inward toward piece center
- On crowned/curved edges, accompany with a perpendicular tick: 11px screen · 0.14in print, `#d32f2f`, 2px weight

**Corner junction marks** (where sewline side tags change — structural reference, NOT decorative)
- Shape: open square, not rotated, 7×7px screen · 0.055in print, 1px corner radius
- Fill: `#ffffff`
- Stroke: category color, 1.5px weight

**Easing marks — clips and notches** (STRIPS ONLY — never render on a main panel; if you find yourself adding these to a panel diagram, stop, that's wrong)
- Color: `#0097a7`
- Style: perpendicular lines from cut edge inward — must never touch or cross the sewline
- Clip (radius < 1.5"): 1.3px screen weight, length = 75% of SA depth, spacing every 3/8"
- Notch (radius 1.5"–50"): 0.9px screen weight, length = 55% of SA depth, spacing every 1"
- Straight (radius > 50"): no marks — render nothing

---

### Ghost shape — second piece indicator

When a piece is Cut 2 or a mirrored pair, render a ghost of the cut outline behind the primary piece.

- Shape: cut line path ONLY — no fill, no sewline, no marks of any kind
- Stroke: category color at 18% opacity, 1.5px weight
- Offset: 20px right, 20px down from primary piece origin
- Fill: none
- The primary piece always renders fully opaque. The ghost exists only to signal "a matching piece exists" — never let it compete visually with the primary piece.

When `sideTaper` is true, the ghost shape must also render as a trapezoid — never fall back to a rectangle ghost on a tapered piece.

---

### Legend — MUST appear on every diagram, no exceptions

If a Tier 1 diagram is missing a legend, that is a bug.

- Type size: 12px minimum for all legend text — never render smaller
- Color: `var(--color-text-secondary)`
- Items separated by a middot `·`
- Each item: inline SVG token + label text
- Tokens render at 100% of actual diagram mark size — never scaled down. The user must be able to hold the legend next to the diagram and see an identical mark. Token SVGs are 24px tall; width varies by mark type.
- Only render tokens for marks actually present in the current diagram. Never show a token for a mark type that isn't used on that piece.
- Placement: directly below the diagram box, left-aligned, 6px top margin, full column width. Wraps to two lines on mobile.
- Do NOT include a fold-friendly symmetry line token. This was explicitly removed and should not be reintroduced without a separate explicit instruction.

---

### Strip-specific rules

- **Orientation:** side strips ALWAYS render vertically on screen (taller than wide). Gusset ALWAYS renders horizontally on screen, click-and-drag pannable, no scrollbars, drag cursor on hover. Never swap these orientations.
- **Label row:** sits above the strip SVGs. All labels share the same top baseline regardless of piece height differences — if one piece needs more label lines, labels stay top-aligned as a group; never let labels shift down with a taller piece. Format: piece name (category color) + cut dimensions (muted), 12px type.
- **Layout:** all strip SVGs share the same top edge and grow downward if dimensions differ. 25px gap between strips. Minimum 12px internal padding on all sides — cut lines must never touch or break their container border. SVG group scales proportionally to fill available column width.
- **Open top / 3-sided mode:** when Open is selected in Stage 4, left/right side strips show the sewline running to the top cut edge with no closing sewline across the top. Add a "Top" label, sewline-grey color, 12px above the top cut edge of each affected strip.
- **Taper:** when `sideTaper` is true, render Left/Right strips as `<polygon>` trapezoids, never `<rect>`. Wider end is always at the bottom of the vertical strip.
- **Removed control:** the diagram column header must NOT contain a Sides/Gusset toggle. The Stage 4 Piece Style toggle is the only control that drives this — do not reintroduce a redundant toggle in the diagram area.

---

### Print vs. screen

- Screen diagrams are illustrative: shape, relationships, comfortable pixel sizes.
- Print diagrams are physical patterns: accurate to 1/32", all weights specified in inches per the tables above. Fill opacity drops to 20–25% on print so it never competes with ink or obscures assembled marks.
- Mark colors are identical between screen and print — only weight/size units change (pixel → inch, per the conversions given above). Never introduce a different color for print.

---

### Diagram tiers — recap

| Tier | Applies to | Governed by |
|---|---|---|
| **Tier 1** | All cut piece previews: panels, strips, gussets, bottoms | Full standard above, every layer and mark |
| **Tier 2** | Instructional/construction diagrams: accordion pocket steps, zipper diagrams, assembly illustrations, any multi-step how-to visual | Category colors, fonts, fill tints ONLY — never the mark layer system, geometry pipeline, or legend token set |

Each Tier 2 diagram must have its own self-contained rendering function. Never pass a Tier 2 diagram through `cpPanelDiagramSVG()` or `cpMiniStrip()` — those are Tier 1 only.

---

### Self-check before marking any diagram-related pass complete

Before confirming a build for any pass that touches diagram code, verify:
- [ ] Z-order matches the spec exactly
- [ ] No hardcoded hex values — all colors reference shared constants
- [ ] Category color used only for cut line and corner junctions; all other marks use their fixed universal color
- [ ] Legend present, tokens at 100% size, only showing marks actually in use
- [ ] Tier 1 vs Tier 2 — correct rendering path used, no Tier 2 diagram routed through Tier 1 functions
- [ ] Ghost shape (if Cut 2) is outline-only, correct opacity and offset, trapezoid if tapered

If any box fails, the pass is not done — fix before reporting back.

---

## Active Work

### Pass 12 -- Remaining Tabs

Gusset -> BoxedBottoms -> Piping -> AccordionPocket -> stubs

---

## Working Rules

- Always confirm npm run build passes after each change before moving on.
- One pass at a time. Do not begin the next pass until current is confirmed.
- Do not modify curved-panel-core.js or boxed-corner-core.js unless
  explicitly authorized for a specific change. (In Pass 11, the shared
  curve-offset function was relocated to src/geometryOffset.js and the
  core was updated to import it — that relocation is complete history,
  not an open permission.)
- Do not edit App(backup).jsx or root BottlePocketPage.jsx.
- Do not add features or make improvements outside current pass scope.
  Flag them as notes for later instead.
- Deploy: npm run build; npm run deploy (semicolon-chained in PowerShell)

---

## Flagged for Later (Do Not Implement Now)

- Token prefix rename -- --bc- serves Trim & Pockets (was Bottoms);
  --tp- serves Basic Bags (was Trims & Pockets). Low priority rename pass needed.

- Shaped Bottoms calculator -- rectangle/rounded/oval shapes, 2 or 4 sides,
  optional tapered sides. Significant new calculator; file does not exist yet.

- Tapered Panels calculator -- tapering side panels. Connects to Shaped Bottoms.

- Stabilizer feature -- extend to remaining calculator tabs. Already implemented
  in CurvedPanel and BoxedBottoms; other calculators pending.

- Gusset pan/drag interaction -- grab-and-drag on gusset diagram canvas.

- Print paper size options -- Letter, A4, Tabloid. After layout pass.

- Bag Project / Design Cart -- persistent session across tabs. After all
  calculators are stable.

- Yardage Calculator -- fabric yardage from pattern piece dimensions.

- CSS custom property audit script -- scripts/check-css-vars.js

- --cb- maroon family -- reserved for store/PDF/guide pages.

- Mascot character -- space-themed bag-maker SVG character.
  Token palette: fur #b870d8, highlight #e0a8f4, shadow #7838a0,
  skin #f0c090, eyes #f0c030, suit #4890d0, glow #f05880, star #fff4d0.
  Use cases: Coming Soon, empty states, error pages, loading.
  Footer right column bottom space is reserved for mascot placement.

- Shopping Bag calculator -- was Grocery Tote.

- moonshot-consolidated-reference.css -- designer style reference in project
  root. Read before visual changes to moonshot.css. Reference only.

- Diagram styles audit -- confirm all diagram styles live in appropriate
  stylesheets rather than individual calculator tabs. Flag findings before
  moving anything.

- Dead code cleanup in stabilizer.js and curved-panel-core.js:
  buildOpenSewline (curved-panel-core.js ~line 245) -- exported, never imported.
  _cpOffsetSidePaths and _offsetOpenPath (stabilizer.js ~lines 80-121) --
  private, never called. Both sets safe to delete after _removeLocalLoops fix
  is confirmed.

- CurvedPanel.jsx.tmp (src/tabs/) -- orphaned file, safe to delete.

- Standardized info-button component -- a reusable ⓘ toggle button + popover
  for use across all calculator tabs. Currently CurvedPanel Stage 6 (vinyl
  thickness guide) has a one-off inline implementation. Piping.jsx has a
  different inline-expanding variant. Both should be replaced when a proper
  shared component is built.
