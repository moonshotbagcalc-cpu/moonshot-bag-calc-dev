# Pass History — Moonshot Bag Calculator

Archived from CLAUDE.md. These sections are historical records of completed
work — not instructions for future sessions. Kept for reference when
debugging behavior or understanding why the code is shaped the way it is.

---

## Refactor History (Passes 1–6 Complete)

Pass 1 -- Extract utilities (done)
Pass 2 -- Extract CSS (done)
Pass 3 -- Extract shared components (done)
Pass 4 -- Split tabs (done)
Pass 5 -- nav-config + thin App.jsx (done)
Pass 6 -- Theming system (done)

---

## Nav Visual Design System (Pass 7 spec — implemented)

This was the authoritative design spec for NavBar.jsx, MobileNav.jsx,
and Footer.jsx. Implemented in Pass 7. The component files are now the
source of truth — consult them directly for current implementation details.

Key implementation note: the final NavBar props are `{ page, setPage,
activeGroup, onGroupClick }`. The Imperial/Metric unit toggle was NOT
kept in NavBar — it was moved into CurvedPanel.jsx and is passed as
props `{ unitMode, setUnitMode }` from App.jsx only to CurvedPanel.
NavBar instead has an About modal button ("i") that was added during
implementation and is not in the spec below.

Font used throughout: Nunito (already loaded). Weights: 700, 800, 900.

---

### Desktop Header (>=768px)

OUTER SHELL -- full viewport width:

  background:
    radial-gradient(ellipse 90% 180% at 50% -55%, rgba(140,108,210,0.16) 0%, transparent 62%),
    radial-gradient(ellipse 50% 100% at 13% 65%,  rgba(152,128,216,0.09) 0%, transparent 55%),
    #1e1040;
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  box-shadow: 0 4px 22px rgba(0,0,0,0.55);

The two radial gradients create a subtle moonlight-from-above glow.
Very low opacity -- luminosity only, not visible color.

INNER CONTENT CONTAINER -- constrained to 1400px:

  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  height: 100px;          /* collapses to 50px on scroll */
  transition: height 0.26s ease;
  box-sizing: border-box;

LEFT SIDE -- wordmark + tagline:

  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-shrink: 0;

  Wordmark: "Moonshot " white + "Bag Calculator" in #9880d8 (via span)
    font: Nunito 900, clamp(22px, 3.6vw, 42px), letter-spacing -0.048em, line-height 0.95

  Tagline: "Houston, we have the math."
    font: Nunito 800, clamp(11px, 1.05vw, 15px), italic
    color: rgba(255,255,255,0.44), letter-spacing 0.01em, margin-top 9px
    On scroll -- opacity 0, max-height 0, margin-top 0 (transition 0.24s)

RIGHT SIDE -- tools + primary nav:

  display: flex;
  flex-direction: column;  /* NEVER CHANGES -- stays column always */
  align-items: flex-end;
  justify-content: space-between;  /* changes to center on scroll */
  padding: 14px 0 0;               /* changes to 0 on scroll */
  transition: justify-content 0.01s, padding 0.26s;

  IMPORTANT: flex-direction stays column in both expanded and scrolled states.
  Only justify-content and padding-top change. This keeps tools right-aligned
  without a layout jump during the transition.

TOOLS ROW (always visible -- never hides on scroll):

  display: flex; align-items: center; gap: 7px; flex-shrink: 0;

  Thread & Needle Guide button:
    background: #d8d1e8; border: 1.5px solid #bfb5d5; color: #321052;
    font: Nunito 900, 11.5px; border-radius: 999px; padding: 5px 14px;
    Opens public/thread-needle.html in new tab.

  Imperial/Metric toggle -- pill pair:
    Container: border 1.5px solid rgba(152,128,216,0.5); border-radius 999px;
               overflow hidden; background rgba(255,255,255,0.05)
    Active btn: background #c8b8f0; color #1e1040; border none; padding 5px 12px
    Inactive btn: background transparent; color rgba(255,255,255,0.68)
    Both: font Nunito 900, 11.5px, padding 5px 12px, line-height 1.5

PRIMARY NAV -- group tabs (hides on scroll):

  display: flex; align-items: flex-end; gap: 0;
  On scroll: opacity 0, max-height 0, pointer-events none (transition 0.22s)

  Each group tab button:
    font: Nunito 900, clamp(12px, 1.5vw, 15px), letter-spacing -0.01em
    height: 40px; padding: 0 clamp(8px, 1.1vw, 14px)
    border: none; border-radius: 10px 10px 0 0
    background: ALWAYS transparent -- background NEVER changes, not even when active
    cursor: pointer; white-space: nowrap; flex-shrink: 0
    display: flex; align-items: center
    transition: color 0.14s, background 0.14s

  States:
    Inactive:        color rgba(255,255,255,0.55), background transparent
    Hover (inactive only): color rgba(255,255,255,0.86), background = group hover tint
    Active:          color = group active text color, background transparent (NO change)

  ACTIVE STATE IS TEXT COLOR ONLY. No background, no border, no shape. Just text color.

  Group color values for primary nav:
    Bag Structures:      hover rgba(196,160,240,0.11)   active text #C4A0F0
    Trim & Pockets:      hover rgba(245,169,108,0.11)   active text #F5A96C
    Handles & Hardware:  hover rgba(139,188,216,0.11)   active text #8BBCD8
    Basic Bags:          hover rgba(154,204,120,0.11)   active text #9ACC78

---

### Category Bar + Sub-Tabs

CRITICAL DOM STRUCTURE: The color bar and sub-tabs are DOM siblings
inside a wrapper -- NOT parent and child. This is required to prevent
overflow clipping of the sub-tab drop shadows. Do not nest the sub-tabs
inside the color bar element.

  <div class="ms-subnav-wrapper">        /* wrapper -- controls layout */
    <div class="ms-subnav-bar" />        /* color bar -- owns shadow */
    <div class="ms-subnav-tabs">         /* sub-tabs -- absolutely positioned */
      ...tabs
    </div>
  </div>

WRAPPER (.ms-subnav-wrapper):

  position: relative;
  height: 30px;
  overflow: visible;
  z-index: 9;
  transition: height 0.26s ease, opacity 0.24s ease;
  /* On scroll: height 0, opacity 0, pointer-events none */

COLOR BAR (.ms-subnav-bar) -- absolutely positioned inside wrapper:

  position: absolute;
  top: 0; left: 0; right: 0;
  height: 30px;
  /* background: group bar color, changes per active group */
  box-shadow: 0 16px 36px rgba(0,0,0,0.22), 0 5px 10px rgba(0,0,0,0.14);
  transition: background 0.2s;

  The bar has NO children. Shadow comes from this element alone.
  No box-shadow on individual sub-tab buttons.

SUB-TABS CONTAINER (.ms-subnav-tabs) -- absolutely positioned inside wrapper:

  position: absolute;
  top: 0; left: 0; right: 0;
  display: flex;
  justify-content: center;
  padding: 0 20px;
  box-sizing: border-box;
  height: 45px;          /* tabs overflow 15px below the 30px bar */
  overflow: visible;     /* MUST be visible -- never auto or hidden */

INDIVIDUAL SUB-TAB BUTTONS:

  font: Nunito 900, clamp(11px, 1.1vw, 14px), letter-spacing -0.01em
  flex: 1 1 0; max-width: 160px; min-width: 80px; flex-shrink: 0
  border: none; border-radius: 0 0 5px 5px; color: #fff; cursor: pointer
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis
  display: flex; align-items: flex-start; justify-content: center
  padding-top: 13px; box-sizing: border-box    /* text stays fixed vertically */
  transition: filter 0.13s, background 0.13s, height 0.13s

  States:
    Inactive:  height 40px, background = group bar color
    Hover:     filter brightness(1.13)  (no height or bg change)
    Active:    height 45px, background = group dark/active color

  The active tab is 5px taller. padding-top: 13px on both keeps
  text at the same Y position -- only the bottom edge extends lower.

---

### Sticky / Scrolled State

Trigger: window.scrollY > 0 adds a scrolled class or boolean state.

On scroll (50px sticky strip):
  - Header inner: height 100px -> 50px
  - Tagline: hidden (opacity 0, max-height 0, margin-top 0)
  - Primary nav: hidden (opacity 0, max-height 0, pointer-events none)
  - Header right: justify-content space-between -> center, padding 14px -> 0
  - Subnav wrapper: height 30px -> 0, opacity 1 -> 0, pointer-events none
  - Result: 50px strip with wordmark left + tools right, same baseline

The flex-direction on header-right stays column throughout.
justify-content center vertically centers the tools row in the 50px strip.
align-items flex-end keeps everything right-aligned. No layout jump.

---

### Top / Back-to-Top Button

Appears when scrolled, hides when at top. Fixed position.

  position: fixed;
  bottom: 80px;    /* above mobile bottom bar */
  right: 20px;
  z-index: 20;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 3px;
  background: #fff; border-radius: 999px;
  padding: 9px 15px 7px;
  box-shadow: 0 4px 18px rgba(0,0,0,0.16), 0 1px 4px rgba(0,0,0,0.08);
  cursor: pointer; border: 1px solid rgba(0,0,0,0.07);

Contents (top to bottom):
  1. SVG upward chevron: path "M1 8L6.5 1.5L12 8", stroke #5a2da0,
     strokeWidth 2.2, strokeLinecap round, strokeLinejoin round
  2. "TOP" text: Nunito 900, 10px, color #5a2da0, letter-spacing 0.06em

---

### Mobile Nav (<768px)

MOBILE HEADER (replaces desktop header):

  height: 44px;
  background: [same radial gradient + #1e1040 as desktop];
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 18px;
  position: sticky; top: 0; z-index: 20;

  Left: "Moonshot Bag Calculator" wordmark, 18px, same two-tone style, no tagline
  Right: hamburger button

  Hamburger button:
    background: rgba(255,255,255,0.08); border: none; color: #fff;
    padding: 5px 7px; border-radius: 7px; cursor: pointer;
    Icon: Tabler ti-menu-2 at 22px -- changes to ti-x when drawer open

ACTIVE GROUP COLOR STRIPE -- immediately below mobile header:

  height: 3px; width: 100%;
  background: [active group bar color];
  transition: background 0.22s;

  This is the only active-group indicator on mobile.

MOBILE NAV DRAWER:

  position: absolute; top: 47px; left: 0; right: 0; z-index: 15;
  background: #1e1040;
  max-height: 0;                  /* -> 460px when open */
  overflow: hidden;
  transition: max-height 0.3s ease;
  box-shadow: 0 10px 28px rgba(0,0,0,0.38);

  ACCORDION STRUCTURE -- four group sections, one expands at a time.
  Tapping an open group closes it.

  Group header button:
    width: 100%; min-height: 50px; padding: 0 20px;
    background: transparent (collapsed) or rgba(barColor, 0.14) (expanded);
    border: none; display: flex; align-items: center;
    justify-content: space-between; cursor: pointer; box-sizing: border-box;

    Label text: Nunito 900, 16px
      Collapsed: color rgba(255,255,255,0.70)
      Expanded:  color = group active text (e.g. #C4A0F0 for Bag Structures)

    Chevron icon (Tabler):
      Collapsed: ti-chevron-right, color rgba(255,255,255,0.28)
      Expanded:  ti-chevron-down,  color = group bar color

  Sub-items panel (only when group expanded):
    background: [group bar color]  -- solid fill, same as desktop sub-nav bar

    Individual page button inside panel:
      width: 100%; height: 44px;
      padding: 0 20px 0 52px;   /* 52px left indent */
      background: transparent (shows panel color through)
      border: none; display: flex; align-items: center; cursor: pointer;
      font: Nunito 700, 14px; color: #fff; opacity: 0.85;
      box-sizing: border-box;
      transition: background 0.12s, opacity 0.12s

      Active page (current calculator):
        background: [group dark/active color]; font-weight 900; opacity 1

      Hover (inactive only): background rgba(0,0,0,0.15); opacity 1

  Dividers between groups: height 1px, background rgba(255,255,255,0.07)

  Tapping a page button navigates and closes the drawer.

MOBILE BOTTOM UTILITY BAR -- fixed at bottom of viewport:

  position: fixed; bottom: 0; left: 0; right: 0;
  height: 46px; z-index: 20;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 0 16px;
  background: [subtle radial glow + #1e1040];
  border-top: 1px solid rgba(255,255,255,0.08);

  Contains: Thread & Needle Guide button + Imperial/Metric toggle
  Same button styles as desktop tools row.
  Always visible on mobile regardless of scroll or drawer state.

  Body needs padding-bottom: 46px on mobile to avoid content hiding behind bar.
  Top button on mobile: bottom 60px (above bottom bar).

---

### Footer

A single full-width component (Footer.jsx) placed at the bottom of App.jsx,
outside the tab content area. Rendered on all pages.

OUTER SHELL -- full viewport width:

  background:
    radial-gradient(ellipse 85% 200% at 50% 120%, rgba(140,108,210,0.14) 0%, transparent 60%),
    radial-gradient(ellipse 45% 100% at 88%  40%, rgba(152,128,216,0.07) 0%, transparent 55%),
    #1e1040;
  width: 100%; box-sizing: border-box;

  The glow beams upward from below -- mirroring the header glow downward.
  Top and bottom of the page feel like bookends of the same light source.

INNER CONTENT -- constrained to 1400px:

  max-width: 1400px; margin: 0 auto;
  padding: 44px 32px 0;
  display: grid; grid-template-columns: 2fr 1fr;
  gap: 0; align-items: start; box-sizing: border-box;

LEFT COLUMN (2fr):

  display: flex; flex-direction: column; gap: 26px; padding-right: 36px;

  Row 1 -- Brand mark:
    Wordmark same two-tone style as header, smaller:
      font-size: clamp(18px, 2.6vw, 28px); font-weight 900; color #fff;
      letter-spacing -0.046em; line-height 0.95;
      "Bag Calculator" span: color #9880d8
    Tagline below: same style as header tagline.

  Row 2 -- Manifesto paragraph (exact copy, do not alter):
    "This calculator is for drafting your own designs and tweaking your
    projects -- it's a math tool, not a pattern. Pattern designers do far
    more than geometry: construction, fit, instructions, and style are the
    real craft. If you love a designer's work, buy their patterns. This
    exists to support that world, not shortcut it."

    font: Nunito 700, 15px; color rgba(255,255,255,0.68); line-height 1.74; margin 0

RIGHT COLUMN (1fr):

  border-left: 1px solid rgba(255,255,255,0.1);
  padding-left: 36px;
  display: flex; flex-direction: column; justify-content: flex-start;
  /* top-aligned -- shares top edge with the wordmark in left column */

  Heading: "Got thoughts? I'm genuinely all ears."
    font: Nunito 900, 16px; color #fff; letter-spacing -0.012em;
    line-height 1.25; margin-bottom 8px

  Sub-text: "Questions, feedback, spotted a bug -- whatever's on your mind."
    font: Nunito 700, 12.5px; color rgba(255,255,255,0.44);
    line-height 1.55; margin-bottom 18px

  "Show contact email" button -- same pill style as Thread & Needle Guide:
    background rgba(255,255,255,0.08); border 1.5px solid rgba(255,255,255,0.18);
    color rgba(255,255,255,0.82); border-radius 999px; padding 7px 18px;
    font: Nunito 900, 12px
    On click: hides button, shows email address
    Email: use placeholder [your email here] -- do not invent an address
    Email display: color #c8b8f0, font Nunito 900, 13.5px

  IMPORTANT: The space below the contact content in the right column is
  intentionally empty. Do not fill it. It is reserved for the mascot
  SVG character (see Flagged for Later in CLAUDE.md).

COPYRIGHT STRIP -- full width:

  margin-top: 36px;
  border-top: 1px solid rgba(255,255,255,0.09);
  padding: 14px 32px; text-align: center;

  Text: "© Moonshot · made with love for the bag-making community"
  font: Nunito 700, 12px; color rgba(255,255,255,0.30); letter-spacing 0.01em

---

## Active Work — Pass 7 (done)

### Pass 7 -- Nav & Footer Visual Redesign (done)

Full replacement of NavBar.jsx, MobileNav.jsx, and creation of Footer.jsx.
See Nav Visual Design System section above for the spec that was implemented.

BEFORE STARTING:
1. Read the Nav Visual Design System section in full.
2. Read current NavBar.jsx and MobileNav.jsx to understand existing props
   and wiring (unitMode, page, setPage, nav-config data). Preserve all
   functional wiring -- only replace the visual implementation.
3. Read moonshot.css nav sections to understand what currently exists.

INSTRUCTIONS:

1. Update moonshot.css -- CSS tokens:
   - Change --sp-bar from #CCC8D8 to #8B5CC8
   - Add --bc-bar: #D97830 to the --bc- block
   - Add --sp-nav-active-text: #C4A0F0
   - Add --bc-nav-active-text: #F5A96C
   - Add --hh-nav-active-text: #8BBCD8
   - Add --tp-nav-active-text: #9ACC78
   - Add --sp-nav-hover-tint: rgba(196,160,240,0.11)
   - Add --bc-nav-hover-tint: rgba(245,169,108,0.11)
   - Add --hh-nav-hover-tint: rgba(139,188,216,0.11)
   - Add --tp-nav-hover-tint: rgba(154,204,120,0.11)

2. Update moonshot.css -- nav CSS classes:
   Replace all existing .ms-site-header, .ms-header-inner, .ms-primary-tab,
   .ms-subnav-bar, .ms-sub-tab, and related mobile nav classes with the
   new design specs from the Nav Visual Design System section.
   Remove old nav CSS -- do not leave orphaned rules.
   Add new classes: .ms-subnav-wrapper, .ms-subnav-bar, .ms-subnav-tabs,
   .ms-mobile-stripe, .ms-top-btn, .ms-mobile-bottom-bar,
   .ms-accordion-group, .ms-accordion-panel, .ms-accordion-item.
   Add footer classes: .ms-footer, .ms-footer-inner, .ms-footer-left,
   .ms-footer-right, .ms-footer-copy, .ms-footer-strip.

3. Rewrite NavBar.jsx per desktop header spec:
   - Preserve props: page, setPage, unitMode, setUnitMode
   - Preserve Thread & Needle Guide link to public/thread-needle.html
   - Implement scroll detection (window.scrollY > 0) for sticky state
   - Implement subnav wrapper DOM structure (color bar + sub-tabs as
     siblings -- critical for shadow rendering, see Nav Visual Design System)
   - Implement Top button (hidden until scrolled)

4. Rewrite MobileNav.jsx per mobile spec:
   - Preserve same props as NavBar.jsx
   - Implement color stripe below mobile header
   - Implement accordion drawer with colored panels
   - Implement mobile bottom utility bar (fixed)
   - Top button appears when scrolled

5. Create Footer.jsx:
   - No props required
   - Implement contact email reveal toggle
   - Use placeholder text "[your email here]" for email address
   - Leave bottom-right of right column empty (reserved for mascot)

6. Wire Footer.jsx into App.jsx:
   - Place Footer after tab content area, before closing tags
   - No props needed

7. Confirm npm run build and npm run lint pass with no errors.
8. Review in browser at desktop and mobile widths before declaring done.

Do not touch calculator content, layout, or CSS beyond nav, footer,
and the token values listed above.

---

## Active Work — Pass 8 (done)

### Pass 8 -- Layout Shell (done)

Establish the CSS layout system defined in the Page Layout System section.
CSS only -- no tab content changes yet.

Instructions:
1. Add layout CSS classes to moonshot.css:
   .tab-page, .tab-intro-card, .tab-body, .tab-inputs,
   .input-group, .input-group-label, .input-group-fields,
   .tab-right, .tab-diagram, .tab-results, .result-table,
   .result-group, .result-group-header, .result-row,
   .result-row.stabilizer, .tab-sides, .tab-print, .print-cards
2. Implement two-column grid with all three breakpoints.
3. Implement intro card container (placeholder box for thumbnails).
4. Implement measurements table with stabilizer sub-row styling.
5. Implement print cards zone.
6. Do not apply layout to any tab -- CSS only, no JSX changes.
7. Confirm npm run build passes.

---

## Pass 8 Layout Spec (reference — implemented)

This is the full page layout spec established in Pass 8. All calculator tabs follow it.
The compact summary lives in CLAUDE.md → "Page Layout System."

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

## Active Work — Pass 9 (done)

### Pass 9 -- Curved Panel First Implementation (done)

Apply layout system to CurvedPanel.jsx as reference implementation.

Instructions:
1. Wrap CurvedPanel content in layout zones from Pass 8.
2. Wire stabilizer toggle and FracInput per Stabilizer Feature section.
3. Add stabilizer sub-rows to measurements table.
4. Apply sides/gusset section toggle behavior.
5. Add print cards for Main Panel, Side Panels, Gusset.
6. Apply --sp- color family to accent elements.
7. Confirm build and review in browser.

---

## Active Work — Pass 10 (done)

### Pass 10 -- Tapered Sides Architecture Fix + UI Cleanup (done)

Prerequisite: current build confirmed passing.

---

#### 1. Tapered sides — architecture fix (highest priority)

Tapered sides are a fundamentally different construction than straight sides and must
be treated as a separate code path. Do not patch taper behavior onto the straight-side
state or geometry pipeline. If the current implementation shares state between straight
and tapered modes, separate them cleanly.

**State**

When Side Profile is set to Tapered, the relevant state values are:
- `depthTop` — the finished depth of the side panel at its narrow (top) end
- `depthBottom` — the finished depth of the side panel at its wide (bottom) end

When Side Profile is Straight, only the single `sideDepth` value is used.
These are independent. Switching between Straight and Tapered must NOT carry
values from one state into the other. Each mode reads only its own state.

**Gate condition**

The side piece preview must render as soon as BOTH `depthTop` > 0 AND `depthBottom` > 0.
Do not gate on any straight-mode depth field. Do not gate on the main panel dimensions.
If the current preview gate checks for a straight-mode value when taper is active, that
is the primary bug -- fix it first.

**Derived panel dimensions (Enclosed / 4-sided bags)**

When Top Opening is Enclosed and Side Profile is Tapered:
- The top panel width (the short dimension across the bag top) equals `depthTop`
  -- this is derived automatically, not entered by the user.
- The bottom panel width (the short dimension across the bag bottom) equals `depthBottom`
  -- also derived automatically.
- Do NOT show separate input fields for top panel depth or bottom panel width when taper
  is active. Remove or hide them if they exist. The side taper inputs are the source of
  truth for those dimensions and there must be only one place to enter them.
- Propagate these derived values into the cutting list and measurements table correctly.

When Top Opening is Open and Side Profile is Tapered:
- Only `depthBottom` drives the bottom panel width. `depthTop` drives the open edge.
- Same rule: no separate bottom panel width input when taper is active.

**Geometry**

Tapered side strips must render as `<polygon>` trapezoids -- wider end at bottom,
narrower end at top. Never render a tapered strip as a `<rect>`. The ghost shape
must also be a trapezoid (see Diagram Standard in CLAUDE.md).

The viewBox for each tapered strip must be calculated from the actual trapezoid
dimensions, not from a rectangle bounding box approximation.

Do not use the straight-side geometry pipeline (cpMiniStrip or equivalent rect-based
path) for tapered strips. If necessary, add a dedicated taper strip renderer.

**Cutting list rows when tapered**

Left Side and Right Side strips are Cut 1 each (they are mirror images, not identical).
Label them accordingly. If the current cutting list marks them Cut 2, that is wrong for
tapered mode -- a Cut 2 would produce two identical trapezoids, not a matched pair.

---

#### 2. Disable Gusset when Tapered is selected

When Side Profile is set to Tapered, the Gusset option in the Piece Style toggle must
be disabled -- visually greyed out and non-clickable.

- If Gusset is currently selected and the user switches to Tapered, automatically switch
  Piece Style to Side panels and show a note: "Tapered gussets aren't supported yet."
- The note should appear inline near the Piece Style toggle, not as a modal or alert.
- This matches the existing roadmap (tapered gusset is parked -- do not implement it here).

---

#### 3. Sticky SA bar -- fix top offset

The Seam Allowance / Fractions / Imperial sticky bar must dock directly below the sticky
top navigation bar. The top nav bar is 50px tall.

Change the sticky bar's CSS from:
  top: 0;
To:
  top: 50px;

Confirm visually that the bar no longer slides behind or overlaps the nav bar when
scrolling.


---

#### 4. Cutting list -- standalone card, improved readability

The cutting list is a primary work surface. A person stands at a cutting table and reads
from it. It must be readable at a glance and visually prominent.

**Card treatment**

- Pull the cutting list out of the main two-column layout.
- Render it as its own full-width card below the main layout.
- Max-width: 800px. Center the card horizontally (margin: 0 auto).
- Apply consistent card styling: background, border-radius, padding, box-shadow --
  match the visual weight of the input stage cards, not a bare table.

**Typography and spacing**

- Piece name: increase font size. Minimum 15px, prefer 16px. Bold or semi-bold weight.
- Piece measurements (cut length x cut width): render on the same row as the piece name
  or immediately below with minimal gap -- no more than 4px separation. They belong
  together visually.
- Sewline sub-line (italic, muted): directly below piece measurements, tight leading.
- Column headers (PIECE, CUT LENGTH, CUT WIDTH, QTY): 11px, uppercase, letter-spaced,
  muted color. Headers should be visually subordinate to the data rows.
- Row padding: increase vertical padding per row. Minimum 10px top/bottom per row.
  Rows must not feel cramped.

**Stabilizer sub-rows**

- Stabilizer sub-row remains indented under its parent piece.
- Stabilizer only appears when stabOn is true.
- Stabilizer is always Cut 2 for panels; matches parent quantity for strips.

**Progress and print controls**

- Progress bar and "X of Y cut" counter stay at the top of the cutting list card.
- Print cutting list button stays at the bottom of the card or in the print bar --
  do not move it elsewhere.

---

#### Confirm before closing this pass

- [ ] Tapered side preview renders as soon as depthTop > 0 AND depthBottom > 0,
      with no dependency on straight-mode state
- [ ] Tapered strips render as trapezoid polygons, not rectangles
- [ ] Ghost shape on tapered strips is also a trapezoid
- [ ] Derived top/bottom panel widths are correct in the cutting list
- [ ] Tapered Left/Right strips are Cut 1 each, not Cut 2
- [ ] Gusset option is greyed out and non-functional when Tapered is active
- [ ] Switching Piece Style to Tapered while Gusset is selected auto-reverts to Side panels
- [ ] Sticky SA bar docks at top: 50px and does not overlap nav
- [ ] No measurement captions remain under any diagram
- [ ] Cutting list renders as a standalone centered card, max-width 800px
- [ ] Piece name is larger and legible; measurements are adjacent, not separated
- [ ] npm run build passes with no new errors

---

## Active Work — Pass 11 (done)

### Pass 11 — Module Extraction (Stabilizer, Measurements, Diagram Marks, Print) + Formatting Punch List

**Status: DONE** — all four modules created and confirmed. Perimeter feature
(Phase 2 first item) implemented. One item NOT yet implemented: `_removeLocalLoops`
geometry fix in `src/geometryOffset.js`. See Active Work in CLAUDE.md for that item.

Prerequisite: Pass 10 confirmed, and the CurvedPanel.side-grid-stab-fix.jsx patch
(miter-offset stabilizer fix) visually confirmed correct on the main panel with
mixed corner types before extraction begins.

---

### Ground rule for this entire pass

This is a RELOCATION pass, not a rewrite. The goal is to move existing, working
logic out of CurvedPanel.jsx into dedicated module files -- not to improve,
simplify, or change behavior while moving it. Visual output before and after
each extraction must be identical. If you notice something that looks like a
bug or improvement opportunity while extracting, do NOT fix it inline -- note it
and ask, then keep moving.

After each of the four extractions below, confirm `npm run build` passes AND do
a visual check before moving to the next extraction. Do not batch all four
extractions before the first visual check.

---

### Extraction 1 — Stabilizer module

Created: `src/stabilizer.js`

Exports: cpStabilizerPoints, cpOffsetInwardMiter, cpInsetClosedPoints,
cpHasSelfCross, cpPtsBB, stabSVGElement.

Uses offsetSidePaths / joinAllSides from geometryOffset.js (the shared
curve-aware offset function) rather than maintaining a separate offset
algorithm. This is the correct path that was proven to fix the
stabilizer self-crossing on the main panel with mixed corner types.

Note from investigation: `buildOpenSewline` (curved-panel-core.js line ~245)
is dead code -- exported but never imported. `_cpOffsetSidePaths` and
`_offsetOpenPath` (stabilizer.js lines ~80-121) are also dead -- private
helpers, never called, superseded. Both sets flagged for cleanup later.

---

### Extraction 2 — Measurements / dimensions table module

Created: `src/measurementsTable.js`

Exports: cpProw, cpPieceBlock.

Used by cpSidesHTML and cpGussetHTML for on-screen piece preview tables.

---

### Extraction 3 — Shared diagram mark primitives module

Created: `src/diagramMarks.js`

Exports: cpSquareMark, cpMidpointMark, cpTriangleMark, cpPerpTick,
cpTriangleH, cpTriangleV, cpDiamondMark.

Imports color/style constants from diagramTokens.js.

Note from implementation: inline center-line, sewline, and cut-line SVG in
the four screen diagram functions were NOT extracted here -- they each use
different coordinate systems and would require new wrappers (beyond pure
relocation). Flagged for a future pass.

---

### Extraction 4 — Print functions module

Created: `src/printRenderers.js`

Exports: cpPrintDoc, cpPrintPanel, cpPrintStabilizer, cpPrintSides,
cpPrintGusset, cpDrawStrip, cpDrawTaperedStrip, cpPiecePrintWidth.

---

### Layout fix — side piece preview sizing (done)

Root cause: .cp-mini wrapper had inline max-width:170px; SVG had inline
max-width:165px / max-height:230px. Fixed by removing hardcoded caps and
driving sizing from fitScale so diagrams fill available column width.

---

### Formatting punch list (done)

- 20px padding on left and right of main calculator cards; 5px at mobile
- cp-stage-num active state wired to stabilizer toggle
- ms-tagline 30% larger at desktop breakpoint
- Sub-tab text 20% larger at desktop/tablet, capped to avoid overflow
- cp-mission-sa-label white; font size increased up to 20% in title bar
- "How the curve eases, not the depth." reworded to "Curve easing amount."
- Side depth helper text removed
- Zone map feature removed from gusset diagrams
- 8px vertical clearance on cp-diag-status box enforced
- Pattern piece names, measurements, quantity type enlarged
- Title Case for all cutting list piece names
- Stabilizer rows include piece name prefix and ruler/pattern note
- "Use Pattern" rule: curves and tapers require pattern; straight 90° pieces use ruler
- Mark formatting removed from CurvedPanel.jsx (was overwriting diagramMarks.js)
- Legend type size increased to 12px
- Center-point circle mark removed from side-piece diagrams only
- "Ghost = cut 2 · bottom width may differ from sides" text removed
- "Cut 2" badge added to Sides header when sides match and are ghosted
- Mobile: cp-right-col on top, diagrams underneath
- cp-body as card: white bg, 10px corners
- cp-cutting-list as card: 10px corners, max-width 800px, centered
- 20px vertical spacing between cp-body and cp-cutting-list cards
- cp-print-bar card treatment: 10px corners, padding
- cp-left-col internal scroll removed
- cp-mission-bar and cp-title-bar capped at max-width 1400px
- cp-title-bar: rounded corners top only (10px 10px 0 0)
- cp-mission-bar: rounded corners bottom only (0 0 10px 10px)

---

### Phase 2 items (from Pass 11)

- **Perimeter chart** -- DONE: cut perimeter and sewline perimeter displayed
  below the legend, with toggle for edge-by-edge lengths. See cp-perim
  classes in CurvedPanel.jsx and moonshot.css.

- **Diagram styles audit** -- pending. Goal: confirm all diagram styles
  live in the appropriate stylesheets rather than individual calculator tabs.
  Flag findings before moving anything.

---

### Confirm before closing this pass

- [x] All four extractions confirmed per their checklists above
- [x] Formatting punch list items confirmed visually
- [x] `npm run build` passes with no new errors
- [x] git commit + push to backup before closing the session

---

## Piping Exit Tail Geometry (CurvedPanel) — archived from CLAUDE.md

Geometry is approved and implemented. Moved here to keep CLAUDE.md under 40k.
Do not redesign, re-derive, or simplify without explicit instruction.

Implemented in `computeExitTail()` and `drawStripRun()` inside `cpPanelDiagramSVG()`
in `src/tabs/CurvedPanel.jsx`.

### Variable glossary

- **`easeArcRadius`** — set to `stripVisibleWidth` (installed folded-edge offset, accounting
  for cord wrap). Used for: the on-panel folded-edge offset (`innerSides`), the B→A2 radius,
  the B→A1 radius, the 55° arc radius, and the `stripStroke` visual width. This is `R` inside
  `computeExitTail`. Do NOT revert to `stripCutWidth / 2` for these.
- **`tailFoldWidth`** — set to `stripCutWidth / 2`. Used ONLY for the physical end-cap edge
  Se (Tr→Tf). Do not use this for the arc geometry or the visible strip width.
- **`Fi`** — folded-edge exit point, ON the panel cut edge, at exactly `1.5×SA + easeOff`
  arc-distance from the failed corner. This is the anchor for all other points.
- **`B`** — notch / bend point, ON the panel cut edge, placed `notchBack = R / sin(55°)`
  behind Fi toward the normal run. B is the center of the 55° folded-edge ease arc.
  The physical strip notch marker is placed at or near B.
- **`A2`** — arc start; `B + nIn × R` (one radius inward from B, on the folded-edge path).
- **`A1`** — arc end; `B + rotate(nIn, 55° TOWARD corner) × R`. The arc sweeps 55° from
  A2 toward the failed corner. `turnSign` is derived from `cross(dirA2, cutTanTowardCorner)`.
- **`exitDir`** — `unitV(Fi − A1)`; the folded-edge exit direction from the arc into the tail.
- **`Tf`** — folded-edge tail tip; `Fi + exitDir × EXIT_OVERSHOOT` (past the cut edge).
- **`Tr`** — raw-edge tail tip; `Tf + (−dirA1) × tailFoldWidth`. Tr→Tf is parallel to B→A1
  and exactly `tailFoldWidth` (`stripCutWidth / 2`) long. This is the short end cap Se.
- **`C`** — cord endpoint only; found by `linePathIntersectInfo(B, dirA2, cordPath)` —
  a ray from B in the B→A2 direction (= nIn) intersected with the cord centerline path.
  Fallback: `closestPathPointToLineInfo`. C is NOT on the folded-edge arc and must
  never be placed on the folded-edge path.
- **`Se`** — short end cap edge: Tr → Tf. Parallel to B→A1. Exactly `tailFoldWidth` long.

### Geometry rules (binding — do not change without instruction)

1. **Width split** — two named values govern different parts of the geometry:
   - `easeArcRadius = stripVisibleWidth` — visible piping strip offset, 55° arc radius, B→A2,
     B→A1. Uses the installed/folded-edge width so the on-panel strip reflects the real
     installed appearance and the arc geometry is consistent with it.
   - `tailFoldWidth = stripCutWidth / 2` — physical half-width of the flat cut strip, used
     ONLY for the Se end cap: `Tr = Tf + (−dirA1) × tailFoldWidth`.
   Do NOT revert `easeArcRadius` or `stripStroke` to `stripCutWidth / 2`.
2. **B placement** — `notchBack = R / sin(55°)`, not just R. This ensures A1 lands
   on a tangent line that passes cleanly through Fi.
3. **Arc** — true circular arc A2 → A1, center B, radius R. SVG `A` command with
   radius scaled to screen pixels (`R * scale`), not model inches. Arc is always ≤ 90°
   so large-arc flag is always 0.
4. **Arc direction** — 55° TOWARD the failed corner (`turnSign` from `dirA2 × cutTanTowardCorner`).
5. **Tf and Tr** — both use `exitDir = unitV(Fi − A1)`, not `nOut`. The tail follows
   the actual A1→Fi exit angle, not a perpendicular outward direction.
6. **Se (Tr→Tf)** — parallel to B→A1, length `tailFoldWidth` (`stripCutWidth / 2`). Se is
   the strip's short end edge and must always be visible in the SVG.
7. **Cord** — the cord stays on its own cord centerline path. C is found by intersecting
   the B→A2 construction line with `cordSides[side]`. C is the cord endpoint only;
   the cord never routes through A1, A2, Tf, or any point on the folded-edge arc.
8. **Two-pass trim in `drawStripRun`** — first trim to Fi (`exitOffset = 1.5×SA + easeOff`)
   to locate the fold-exit point; then trim further by `notchBack` to get the B station
   where the raw and folded edges terminate in the diagram. The cord uses a separate
   trim distance (`cordDist`) returned by `computeExitTail`.
9. **`cpPipingStraightStrips` trim** — the displayed cut length subtracts `exitTailBack =
   (stripWidth/2) / sin(55°)` per failing end (in addition to `1.5×SA + easeOff`) so the
   diagram cut length and the measurements table agree.
10. **easeOff default** — 0. Base exit = 1.5×SA. Total exit offset = 1.5×SA + easeOff.

### Folded-edge path (per strip run)

```
normal folded-edge run → A2 → [55° arc centered at B] → A1 → exitDir → Fi → Tf
```

### Polygon walk

**startFail:** `M Tr → L B → L outer[0](Fi) → [cut-edge run] → [close/endFail] →
[reversed inner run] → Arc(A2→A1) → L Fi → L Tf → Z`
(Z closes Se: Tf → Tr)

**endFail:** `[cut-edge run] → L B → L Tr → L Tf → L Fi → L A1 →
Arc reversed(A1→A2) → [reversed inner run] → Z`
- [ ] _removeLocalLoops fix (see Active Work in CLAUDE.md) -- NOT YET DONE
