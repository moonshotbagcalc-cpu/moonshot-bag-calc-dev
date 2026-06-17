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

## Current Architecture (post-Passes 1-6)

The monolithic App.jsx (~4500 lines) has been fully decomposed. Current structure:

src/
  App.jsx                  <- nav shell only (~400 lines)
  moonshot.css             <- ALL CSS; custom properties; color families
  nav-config.js            <- data-driven nav; adding a tab = one entry here
  curved-panel-core.js     <- geometry/model for CurvedPanel (pure JS, no React)
  boxed-corner-core.js     <- geometry/model for BoxedCorner (pure JS, no React)

  components/
    NavBar.jsx             <- renders from nav-config; no tab logic -- FULL REDESIGN in Pass 7
    MobileNav.jsx          <- hamburger/slide-away mobile nav -- FULL REDESIGN in Pass 7
    Footer.jsx             <- does not exist yet -- CREATE in Pass 7
    FracInput.jsx          <- unified fraction/decimal input
    PrintButton.jsx        <- unified print trigger + validation lock
    TrustBadge.jsx         <- validation warnings + print-blocking display
    ComingSoon.jsx         <- branded coming-soon with rocket SVG
    TileSystem.jsx         <- tiling, registration marks, test squares

  tabs/
    CurvedPanel.jsx        <- EXISTS -- full calculator
    Gusset.jsx             <- EXISTS -- full calculator
    Piping.jsx             <- EXISTS -- full calculator
    AccordionPocket.jsx    <- EXISTS -- full calculator
    BoxedBottoms.jsx       <- EXISTS -- renamed from BoxedCorner.jsx
    ShapedBottoms.jsx      <- EXISTS -- renamed from LidBottom.jsx (content stub)
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
    formatting.js          <- fmtInch, fmtCm, fmtInch32, roundTo8th, etc.
    validation.js          <- geometry validation helpers
    print-utils.js         <- page counting, rotation, tiling math
    constants.js           <- default SA values, unit labels, breakpoints

### Core Modules

curved-panel-core.js and boxed-corner-core.js export geometry primitives
(vector ops, offsetting, intersection tests), pattern-piece builders, and their
own formatting helpers (cpFmt, bcFmt). Do not modify these unless explicitly asked.

### Units

Unit mode is module-level mutable state: let CURRENT_UNIT in App.jsx, set once
per render from unitMode React state. isMetric() reads this global throughout
formatting helpers and core modules. Do not memoize formatting calls across
unit-mode changes.

### Print Output

Several tabs generate standalone printable HTML/SVG documents opened via
window.open/print (not rendered inline). Examples: cpPrintDoc, cpPrintPanel,
cpPrintSides, cpPrintGusset (Curved Panel); bcPrintDoc, bcPrintPanel,
bcPrintStabilizer (Boxed Bottoms).

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

### Global Nav Elements (always visible)

- Thread & Needle Guide -- links to public/thread-needle.html (opens new tab)
- PDF Patterns -- future store tab, not yet implemented; render as disabled or hidden
- Nav burger -- mobile only; collapses to hamburger at <768px

---

## Nav Visual Design System

This section is the authoritative design spec for NavBar.jsx, MobileNav.jsx,
and Footer.jsx. Implemented in Pass 7. Do not guess or improvise visual
details -- follow these specifications exactly.

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
  SVG character (see Flagged for Later).

COPYRIGHT STRIP -- full width:

  margin-top: 36px;
  border-top: 1px solid rgba(255,255,255,0.09);
  padding: 14px 32px; text-align: center;

  Text: "© Moonshot · made with love for the bag-making community"
  font: Nunito 700, 12px; color rgba(255,255,255,0.30); letter-spacing 0.01em

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
--sp-bar:      #8B5CC8;   /* sub-nav bar bg -- UPDATED from old #CCC8D8 (was a design error) */

/* Nav text (new tokens -- add these) */
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

/* Nav structural (new token -- add this) */
--bc-bar:      #D97830;   /* sub-nav bar bg */

/* Nav text (new tokens -- add these) */
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

/* Nav text (new tokens -- add these) */
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

/* Nav text (new tokens -- add these) */
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

### Background Patterns (per group)

Each nav group gets a distinct repeating background pattern.
Assign one per group:
- Bag Structures    -> diagonal lines
- Trim & Pockets   -> dots
- Handles & Hardware -> grid marks
- Basic Bags       -> waving lines

Pattern appears on page background only, subtly. Not on input or diagram zones.

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

## Stabilizer Feature (Active -- Curved Panel)

The stabilizer/interfacing feature is active in CurvedPanel.

Reference implementation: BoxedBottoms.jsx already has a complete
stabilizer implementation (toggle state, inset input, cut calculation,
bcPrintStabilizer print output). Model the CurvedPanel stabilizer
directly on this pattern.

Construction toggle layout:
  [ 4-Sided Enclosed ]  [ 3-Sided Open Top ]
  [ Side Panels      ]  [ Gusset           ]
  [ Stabilizer                             ]  <- full-width button
    Stabilizer Inset: [FracInput]             <- appears when active

Print output: stabilizer generates its own separate print card.

---

## Refactor History (Passes 1-6 Complete)

Pass 1 -- Extract utilities (done)
Pass 2 -- Extract CSS (done)
Pass 3 -- Extract shared components (done)
Pass 4 -- Split tabs (done)
Pass 5 -- nav-config + thin App.jsx (done)
Pass 6 -- Theming system (done)

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

## Active Work

### Pass 7 -- Nav & Footer Visual Redesign (done)

Full replacement of NavBar.jsx, MobileNav.jsx, and creation of Footer.jsx.
All visual specifications are in the Nav Visual Design System section above.
Read that section completely before writing any code.

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
is the primary bug — fix it first.

**Derived panel dimensions (Enclosed / 4-sided bags)**

When Top Opening is Enclosed and Side Profile is Tapered:
- The top panel width (the short dimension across the bag top) equals `depthTop`
  — this is derived automatically, not entered by the user.
- The bottom panel width (the short dimension across the bag bottom) equals `depthBottom`
  — also derived automatically.
- Do NOT show separate input fields for top panel depth or bottom panel width when taper
  is active. Remove or hide them if they exist. The side taper inputs are the source of
  truth for those dimensions and there must be only one place to enter them.
- Propagate these derived values into the cutting list and measurements table correctly.

When Top Opening is Open and Side Profile is Tapered:
- Only `depthBottom` drives the bottom panel width. `depthTop` drives the open edge.
- Same rule: no separate bottom panel width input when taper is active.

**Geometry**

Tapered side strips must render as `<polygon>` trapezoids — wider end at bottom,
narrower end at top. Never render a tapered strip as a `<rect>`. The ghost shape
must also be a trapezoid (see Diagram Standard in this file).

The viewBox for each tapered strip must be calculated from the actual trapezoid
dimensions, not from a rectangle bounding box approximation.

Do not use the straight-side geometry pipeline (cpMiniStrip or equivalent rect-based
path) for tapered strips. If necessary, add a dedicated taper strip renderer.

**Cutting list rows when tapered**

Left Side and Right Side strips are Cut 1 each (they are mirror images, not identical).
Label them accordingly. If the current cutting list marks them Cut 2, that is wrong for
tapered mode — a Cut 2 would produce two identical trapezoids, not a matched pair.

---

#### 2. Disable Gusset when Tapered is selected

When Side Profile is set to Tapered, the Gusset option in the Piece Style toggle must
be disabled — visually greyed out and non-clickable.

- If Gusset is currently selected and the user switches to Tapered, automatically switch
  Piece Style to Side panels and show a note: "Tapered gussets aren't supported yet."
- The note should appear inline near the Piece Style toggle, not as a modal or alert.
- This matches the existing roadmap (tapered gusset is parked — do not implement it here).

---

#### 3. Sticky SA bar — fix top offset

The Seam Allowance / Fractions / Imperial sticky bar must dock directly below the sticky
top navigation bar. The top nav bar is 50px tall.

Change the sticky bar's CSS from:
  top: 0;
To:
  top: 50px;

Confirm visually that the bar no longer slides behind or overlaps the nav bar when
scrolling.


---

#### 4. Cutting list — standalone card, improved readability

The cutting list is a primary work surface. A person stands at a cutting table and reads
from it. It must be readable at a glance and visually prominent.

**Card treatment**

- Pull the cutting list out of the main two-column layout.
- Render it as its own full-width card below the main layout.
- Max-width: 800px. Center the card horizontally (margin: 0 auto).
- Apply consistent card styling: background, border-radius, padding, box-shadow —
  match the visual weight of the input stage cards, not a bare table.

**Typography and spacing**

- Piece name: increase font size. Minimum 15px, prefer 16px. Bold or semi-bold weight.
- Piece measurements (cut length × cut width): render on the same row as the piece name
  or immediately below with minimal gap — no more than 4px separation. They belong
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
- Print cutting list button stays at the bottom of the card or in the print bar —
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

### Pass 11 — Module Extraction (Stabilizer, Measurements, Diagram Marks, Print) + Formatting Punch List

**Status: CURRENT — do not begin Pass 12 until this pass is confirmed**
Prerequisite: Pass 10 confirmed, and the CurvedPanel.side-grid-stab-fix.jsx patch
(miter-offset stabilizer fix) visually confirmed correct on the main panel with
mixed corner types before extraction begins.

---

## Ground rule for this entire pass

This is a RELOCATION pass, not a rewrite. The goal is to move existing, working
logic out of CurvedPanel.jsx into dedicated module files — not to improve,
simplify, or change behavior while moving it. Visual output before and after
each extraction must be identical. If you notice something that looks like a
bug or improvement opportunity while extracting, do NOT fix it inline — note it
and ask, then keep moving.

After each of the four extractions below, confirm `npm run build` passes AND do
a visual check before moving to the next extraction. Do not batch all four
extractions before the first visual check.

---

## Extraction 1 — Stabilizer module

Create a dedicated module (suggest `src/stabilizer.js`, but follow existing
project file-organization conventions if there's an established pattern).

**Before moving anything, investigate this first:** The cut line and sewline
already render correctly on the main panel with mixed corner types (one crisp,
one rounded) — no self-crossing, no looping, confirmed visually. The
stabilizer line is the only one that still loops over itself in this case.
This strongly suggests the sewline/SA offset uses a correct curve-aware offset
algorithm that the stabilizer is NOT using — instead the stabilizer maintains
its own separate algorithm (`cpOffsetInwardMiter` → side-aware fallback →
`cpInsetClosedPoints`), which still produces self-crossing results in this
case.

Find the function that produces the sewline offset for the main panel model
(likely inside `curved-panel-core.js`, possibly producing `model.activeSew` or
similar). Report back: what is it called, and can it be called generically
with an arbitrary offset distance (not just SA) to produce the stabilizer
path? If yes, the stabilizer module should call THIS function with the
stabilizer inset distance, rather than maintaining a separate offset
algorithm. This likely fixes the self-crossing/looping bug directly, since
it reuses curve math already proven correct, instead of patching a second,
inferior implementation.

**If reusing this function requires adding an export to
`curved-panel-core.js`** (exposing an existing internal function without
changing its behavior) — STOP and ask before doing so. That file is normally
off-limits and needs explicit authorization for even a non-behavioral change
like an export.

Only fall back to keeping/improving `cpOffsetInwardMiter` and the existing
fallback chain if the shared sewline-offset function genuinely cannot be
reused for the stabilizer's case — explain why before falling back.

Move into the new module:
- `cpStabilizerPoints()`, `cpOffsetInwardMiter()`, `cpInsetClosedPoints()`,
  `cpOffsetSidePaths()`, `cpCombineSidePaths()`, `cpHasSelfCross()`
- Any stabilizer-specific drawing logic currently duplicated inside
  `cpMiniStrip`, `cpMiniTrapezoid`, `cpGussetMapHTML`, and `cpPanelDiagramSVG`.
  Before extracting, identify whether these four functions each have their own
  separate stabilizer-offset/draw logic (e.g. via `cpInsetScreenPolygon` calls)
  or whether they already share code. Report back what you find, then unify
  into ONE shared stabilizer draw function that all four diagram functions
  call, rather than leaving four separate implementations.
- Stabilizer-specific cutting list row generation logic (Cut 2 for panels,
  matches parent quantity for strips/gusset).

Do not move generic geometry helpers (`cpDist`, `cpUnit`, `cpCentroid`,
`cpSegmentsIntersect`, `cpLineIntersect`, `cpLineDirIntersect`,
`cpDedupePath`, `cpSimplifyCollinearClosedPts`) into this module if they are
used by non-stabilizer code elsewhere in the file — those belong in a shared
geometry utility module instead, or stay where they are if extracting them
risks touching curved-panel-core.js usage. Flag this rather than guessing.

---

## Extraction 2 — Measurements / dimensions table module

Create a dedicated module (suggest `src/measurementsTable.js`).

Move into it:
- `cpProw()`, `cpPieceBlock()`, and the table-assembly logic currently used
  for side pieces in `cpSidesHTML()`.
- Before extracting, check whether the main panel and gusset measurement
  tables already reuse `cpProw`/`cpPieceBlock`, or whether they have their
  own separate, duplicate row-building code. If duplicated, unify into the
  same shared table-builder so panel, strip, and gusset measurement tables
  all go through one function. Report what you find before unifying.

---

## Extraction 3 — Shared diagram mark primitives module

Create a dedicated module (suggest `src/diagramMarks.js`). This module should
import color/style constants from `diagramTokens.js` (created in the prior
Diagram Standard pass) rather than hardcoding values.

Move into it the draw functions for every universal mark currently built as
inline SVG string fragments inside `cpPanelDiagramSVG`, `cpMiniStrip`,
`cpMiniTrapezoid`, and `cpGussetMapHTML`:
- Cut line
- Sewline
- Center / crosshair lines
- Fold lines
- Corner junction marks (open square)
- Midpoint marks (open circle)
- Center match triangles
- Easing marks (clip/notch ticks)
- Stabilizer line styling (the visual stroke/dash itself — the offset
  geometry stays in the stabilizer module from Extraction 1; this module
  only owns how the stabilizer line is drawn once points exist)

Each of the four diagram functions should call these shared primitives
instead of building inline SVG markup for these marks. Before extracting,
list every place each mark type is currently drawn so nothing is missed.

---

## Extraction 4 — Print functions module

Create a dedicated module (suggest `src/printRenderers.js`).

Move into it:
- `cpPrintSides()`, `cpDrawTaperedStrip()`, and the print-rendering functions
  for the main panel, gusset, and stabilizer (find and report the exact
  function names — they were not all directly confirmed before this pass).
- Any print-specific layout/document assembly logic (the print window/document
  construction), if it currently lives inline in CurvedPanel.jsx.

Do not move the print BAR (the row of buttons triggering these functions) —
that UI already lives in its own section. This extraction is for the
rendering logic the buttons call, not the buttons themselves.

---

## After all four extractions

- [ ] `npm run build` passes
- [ ] Stabilizer renders identically to before extraction on: main panel
      (mixed corners), side strips, tapered strips, gusset
- [ ] Measurement tables render identically for panel, strip, gusset
- [ ] All diagram marks (cut line, sewline, center lines, fold lines, corner
      junctions, midpoints, center triangles, easing ticks) render identically
      across all four diagram functions
- [ ] All print outputs (panel, sides, gusset, stabilizer) render identically
      to before extraction
- [ ] No duplicate implementations remain — each mark/table/stabilizer/print
      concern has exactly ONE implementation, called from multiple places
- [ ] CurvedPanel.jsx is meaningfully shorter and now mostly contains state,
      layout/cascade UI, and calls into the new modules

---

## Layout fix — side piece preview sizing

Root cause confirmed (no further investigation needed — go straight to the
fix): the grid container (`cp-pieceGrid`) is correctly set up with
`grid-template-columns: repeat(3, minmax(112px, 1fr))` and `column-gap: 14px`
— so each column CAN stretch to fill available width. But the diagram inside
each column is hardcoded small regardless of that available width:

- `.cp-mini` wrapper has an inline `max-width:170px`
- the `<svg>` itself has an inline style with `max-width:165px;max-height:230px`

Because the diagram is capped at ~165px while its grid column is often 400px+
wide on desktop, and the diagram is centered within that column
(`justify-content:center` on `.cp-pieceSvg`), all the unused column width
shows up as blank space flanking a small diagram — that's the ~150px gap
illusion. The `column-gap` value was never the problem.

**Fix:** Remove the hardcoded `max-width:170px` cap on `.cp-mini` and the
`max-width:165px` / `max-height:230px` caps on the SVG style attribute.
Replace with sizing driven by the actual `fitScale` calculation so the
diagram scales up to fill its available column width (minus reasonable
internal padding), instead of being capped at a fixed pixel ceiling
regardless of how much room it has.

Target: visible gap between diagram edges should be no more than 30–50px on
a standard desktop width. Diagrams should be as large as their column allows
without touching or overlapping each other.

This is layout/sizing only — no geometry math involved, low risk. Confirm
visually at the standard desktop width and at a narrower width to make sure
nothing overlaps or breaks at smaller viewports.

---

## After all four extractions

- [ ] `npm run build` passes
- [ ] Stabilizer renders identically to before extraction on: main panel
      (mixed corners), side strips, tapered strips, gusset
- [ ] Measurement tables render identically for panel, strip, gusset
- [ ] All diagram marks (cut line, sewline, center lines, fold lines, corner
      junctions, midpoints, center triangles, easing ticks) render identically
      across all four diagram functions
- [ ] All print outputs (panel, sides, gusset, stabilizer) render identically
      to before extraction
- [ ] No duplicate implementations remain — each mark/table/stabilizer/print
      concern has exactly ONE implementation, called from multiple places
- [ ] CurvedPanel.jsx is meaningfully shorter and now mostly contains state,
      layout/cascade UI, and calls into the new modules

---

## Formatting punch list (separate, lower-risk — do after extractions are confirmed)

This work is pure CSS/layout and does not require confirm-after-every-step
discipline. Make all changes below, then do one full visual pass at the end.

- add 20 pixel padding on left and right of main calculator cards between browser edge. At mobile size, only 5 pixels padding
- make <div class="cp-stage-num optional">5</div> the active state (<div class="cp-stage-num active">5</div>) when Stabilizer/Interfacing checkbox is checked
- increase the size of <div class="ms-tagline">Houston, we have the math.</div> by 30% for browser window size
- increase sub tab text size by 20% for browser and tablet size windows as long as the type stays within tab borders with 10 pixels spacing on the left and right.
- Make Seam Allowance (SA) in cp-mission-sa-label white. Increase font size by 20% when title bar allows.
- Reword "How the curve eases, not the depth." in Edge Shape to say, "Curve easing amount."
- Remove from Side depth: Side panels and bottom strip each use their depth edge. and Depth drives gusset width — no separate input needed.
- remove "zone map" feature from gusset diagrams.

---

## Confirm before closing this pass

- [ ] All four extractions confirmed per their checklists above
- [ ] Formatting punch list items confirmed visually
- [ ] `npm run build` passes with no new errors
- [ ] git commit + push to backup before closing the session

---

### Pass 12 -- Remaining Tabs

Gusset -> BoxedBottoms -> Piping -> AccordionPocket -> stubs

---

## Working Rules

- Always confirm npm run build passes after each change before moving on.
- One pass at a time. Do not begin the next pass until current is confirmed.
- Do not modify curved-panel-core.js or boxed-corner-core.js unless
  explicitly authorized for a specific change. (Exception granted June 17,
  2026: shared curve-offset function relocated to src/geometryOffset.js,
  core updated to import it — see Pass 11.)
- Do not edit App(backup).jsx or root BottlePocketPage.jsx.
- Do not add features or make improvements outside current pass scope.
  Flag them as notes for later instead.
- Deploy: npm run build; npm run deploy (semicolon-chained in PowerShell)

---

## Flagged for Later (Do Not Implement Now)

- Token prefix rename -- --bc- serves Trim & Pockets (was Bottoms);
  --tp- serves Basic Bags (was Trims & Pockets). Low priority rename pass needed.

- SVG diagram design system -- shared diagram-standards.js with conventions
  for line types, weights, colors, notch symbols, dimension callouts, etc.

- Shaped Bottoms rework -- rectangle/rounded/oval shapes, 2 or 4 sides,
  optional tapered sides. Significant new calculator.

- Tapered Panels calculator -- tapering side panels. Connects to Shaped Bottoms.

- Stabilizer feature -- all tabs. CurvedPanel gets it first (Pass 9).

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

## Clean up Later
  TaperedPanels.jsx, FoldedBottoms.jsx, ShapedBottoms.jsx,
  HandlesStraps.jsx, PurseFeet.jsx, RivetGuides.jsx,
  ZipperPouch.jsx, GroceryTote.jsx
