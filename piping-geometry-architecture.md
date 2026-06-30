# Piping Geometry — Architecture & Open Questions

> Design note for the Moonshot Bag Calculator piping system.
> Captures *why* the piping lines are derived the way they are, so future
> work (human or Claude Code) doesn't "helpfully" unify them and reintroduce
> solved bugs.
> Last updated: failed-corner strip-length fix + shared-geometry extraction session.

---

## 1. Derivation roots — SETTLED

Two different physical relationships, each rooted where its behavior originates.
**This is intentional. Do not unify them.**

- **Stabilizer ← derived from the CUT EDGE.**
  It is a flat panel of interfacing sitting inside the fabric piece. Its job is
  purely "be X inches in from the raw edge." A geometric inset. Cut-rooted.

- **Piping (cord line + fold line) ← derived from the SEWLINE.**
  Piping is a *construction* element; it lives in relation to where you stitch
  and how the seam allowance behaves — including running straight up an **open
  top** edge. Deriving piping from the sewline means it inherits all of the
  sewline's edge-case handling (open-top, crowns, tapers) for free. Re-rooting
  it to the cut edge would force us to re-implement that handling and risk an
  open-top regression.

**Code comment (near the piping offset calls):**
```
// Piping (cord + fold) derives from the SEWLINE, not the cut edge, so it
// inherits SA edge-case behavior like the open-top run. Stabilizer derives
// from the cut edge as a flat geometric inset. These two roots are
// intentional and must not be unified.
```

---

## 2. The nested line chain

All piping lines are siblings/descendants off the sewline, each a parallel
inset path, so they stay nested and never produce failing crossovers.

```
CUT LINE                         (raw edges of strip + panel align here)
  └─ SEWLINE   = cut inset by SA (where stitching lands)
        ├─ CORD LINE  = sewline inset by (cordDia/2 + stayaway)
        └─ FOLD LINE  = the folded edge of the strip  ← strip-related length

STABILIZER  = cut inset by stabilizer offset   (separate root — see §1)
```

---

## 3. Cord line — VALIDATED against real-world

```
cordLength = sewlinePerimeter − 2π × (cordDia/2)
```

The cord centerline rides ~one cord-radius inside the seam (sewline). Checked
against the left reference panel (real bag, sewn many times):

```
sewline = 29.7672   (= cut 32.1248 − 2π×0.375, confirmed)
cord    = 29.7672 − 2π(0.046875) = 29.47"   ✓  real-world cord = 29 1/2"
```

**SHIPPED — cord centerline fix:** the cord offset must NOT include the vinyl
wrap thickness. `geoCordLen` in `cpPipingClosedLoop` now subtracts
`2π(cordDia/2)` only — the wrap thickness moves the FOLD, not the cord center.
This brought the closed-loop cord from ~29 1/4" to the correct ~29 1/2" on the
reference panel. The comment block above the `geoCordLen` assignment records why
`vinylThick` is deliberately excluded; do not re-add it.

---

## 4. Strip cut length — CLOSED LOOP — VALIDATED: SewLine + 2×SA

```
stripCutLength = sewlinePerimeter + 2×SA    (closed loop only)
```

The strip rides at the **seam line** (= sewline, where it's basted to the
panel); the **+2×SA** is the two join allowances to close it into a loop.

**Why it MUST be the sewline (the key physical principle):** you can take up
slack, but you cannot add length you don't have. The strip can't be shorter
than the sewline (it wouldn't reach) and it rides at the seam so it isn't
longer — therefore strip = sewline + 2×SA, necessarily. The cord cannot be
eased at all; it's a set length living inside the sewline, so it is its own
shorter number.

**Technique note (bag-makers, not garment-makers):** the slack is taken up by
**notching and clipping the strip's raw edge BEFORE sewing**, not by easing
while sewing. Tight curves need **heavy notching** to seat the piping snugly.

**The position-vs-length distinction:** the **length of material you cut**
follows the **seam path**, not the inner fold crease. Never derive cut length
from the inner crease/fold POSITION — use the inner position ONLY for drawing.

---

## 4b. Strip cut length — FAILED CORNER (open strips) — VALIDATED & SHIPPED

**This is the section that resolved the big bug.** When ANY corner fails the
radius check, the piping can no longer run as one continuous loop. The loop is
**cut open at the failed corners**, producing one or more **open strips**.

**The governing rule (do not lose this):**
> A failed corner ALWAYS produces a strip with TWO easing ends. Every open
> strip terminates at failed corners on both ends — even a strip whose run
> passes *through* a passing corner in the middle (sides are grouped into one
> run; a passing corner mid-run does not end a strip). So both ends of every
> open strip always get the easing-tail treatment. There is no "one end eases,
> one doesn't" case for a strip that exists in this path.

**The validated strip-length formula:**
```
stripLen = cordLen + (per end: distance A1→Tf  +  arc length A1→A2)
         = cordLen + 2 × (distance A1→Tf + arc A1→A2)   (both ends always ease)
```
where, per end:
- `arc A1→A2`   = `R × EXIT_ANGLE_RAD`  (R = stripWidth/2; 55° in radians)
- `distance A1→Tf` = straight-line distance between the returned arc-end point
  A1 and the tail-tip point Tf.

Worked example (10×10 panel, SA 3/8, cord 3/32, standard vinyl, all corners
sharp/failing), per side:
```
cordLen     ≈ 7.50"
arc A1→A2   ≈ 0.540"   (= 0.5625 × 0.9599)
dist A1→Tf  ≈ 0.644"
stripLen    = 7.50 + 2×(0.644 + 0.540) ≈ 9.87"   → displays 9 7/8"  ✓
```

**Why the earlier numbers were wrong (both directions):**
- The ORIGINAL code SUBTRACTED `1.5*sa + easeOff + exitTailBack` from the
  sewline run and called that the cut length → produced ~7.5" strips that were
  TOO SHORT to reach. (It treated 2D fold geometry as a 1D subtraction.)
- A first fix attempt ADDED `sewRun + 2*SA + 2*tail` longitudinally → produced
  ~13" strips that were TOO LONG. (It treated the fold-back `notchBack`
  geometry as additive longitudinal length; the fold doubles back, it does not
  extend.)
- The CORRECT measure builds the strip as **cord (middle) + the real folded
  path segments (arc + straight) at each end** — measured from the actual 2D
  points returned by the geometry, not from the sewline run at all.

**Principle (the §4 lesson, restated for failed corners):** the strip length
is the **measured folded path**, not the sewline run ± offsets. Measure between
the real returned points (cord end region, A1, A2, Tf); do not approximate with
longitudinal additions or subtractions.

**Cord length at a failed end — VALIDATED:** the cord terminates at point C
(where a ray from the arc center B, along the B→A2 inward normal, intersects
the cord centerline). The cord stays on its own centerline and does NOT tail
past like the strip. On the 10×10 the cord trims from its full ~9.125" side run
to ~7.50" (trimmed at both ends to where C lands). Confirmed correct in app and
against bench expectation — cord prefers to run slightly long, never short.

**Cut vs visible width — RESOLVED (was the §9 open harmonization):**
- **Cut-list (authoritative):** arc radius R = **stripWidth/2**.
- **Diagram (visual only):** arc radius R = **stripVisibleWidth** (installed
  folded width, accounts for cord-wrap bulk). This is correct for the DRAWING
  because of the visual wrap of the cord — it is a diagram concern only.
- These intentionally differ. Cut-list is authoritative; the diagram keeps its
  visible-width radius for rendering. Do not unify the radius basis.

---

## 5. Module architecture — NEW (the shared-geometry extraction)

The piping geometry was extracted out of the giant `CurvedPanel.jsx` diagram
function into two shared, pure modules so the cut-list and the diagram can
(eventually) share ONE implementation.

```
pathGeometry.js          ← general 2D polyline + vector toolkit (PURE, inches)
  • vector ops: add, sub, mul, dot, perp, len, unitV
  • cpDist, cpDedupePath
  • pathLen, pathSegModel, concatSegs, runPath, tangentAt
  • linePathIntersectInfo, closestPathPointToLineInfo
  No SVG, no React, no scale/DOM. Reusable by ANY component that walks paths or
  eases material along an edge (gussets, bound edges, future trim).

tailEasingGeometry.js    ← easing-specific layer (PURE, inches), imports pathGeometry
  • computeExitTail(Fi, cutTanTowardCorner, nIn, cordPath, opts)
       Solves the 55° fold-away tail at a failed corner: Fi, arc center B,
       arc endpoints A1/A2, tail tip Tf, end-cap Tr, cord end C. Ported
       VERBATIM from the diagram's computeExitTail; the scalars that were
       diagram closures (R, tailFoldWidth, exitAngleRad, exitOvershoot, D) are
       now passed via `opts`, so the cut-list caller supplies the AUTHORITATIVE
       stripWidth/2 radius while the diagram could still pass visible-width.
  • measureStripRun(...)
       NEW (authored, not ported). Walks a run the way drawStripRun did
       (runPath trim → tangent → inward normal → computeExitTail at each end),
       then MEASURES the returned 2D points into scalar strip & cord lengths
       per §4b. This is where the failed-corner cut numbers come from.

pipingCore.js            ← scalar formula layer (PURE math, no React/formatting)
  • cpPipingStraightStrips(...)  — run-GROUPING logic (which sides combine into
       one strip; circular reorder so runs break after the first failing joint).
       Now imports measureStripRun and uses it for the per-strip LENGTH math.
       Grouping preserved; only the length math changed.
  • cpPipingClosedLoop(...)      — the closed-loop path (§3, §4), unchanged.
  • EXIT_ANGLE_DEG = 55, EXIT_OVERSHOOT_IN = 0.25, EXIT_OVERSHOOT_MM = 5 (exported)

CurvedPanel.jsx          ← consumes the above; still has its OWN diagram copy of
  computeExitTail/drawStripRun for now (see §6 Phase 2).
```

**Why two modules, not one:** `pathGeometry` is *generic* (measure any
polyline); `tailEasingGeometry` is *domain* (solve a piping tail). Keeping them
separate means future non-piping work can grab the toolkit without dragging in
piping specifics. Elegant separation, deliberately chosen.

**Extraction was done as faithful, verified steps:** create module unused →
point diagram at it and confirm PIXEL-IDENTICAL render (proves faithful) →
port computeExitTail unused → add measureStripRun unused → wire into pipingCore
+ call site (the behavior change). Each step its own commit; the diagram looking
identical at the swap step was the trust proof.

---

## 6. Open questions / to-do for the next session

**SHIPPED this session (do NOT redo):**
- Cord centerline fix (drop vinylThick from `geoCordLen`). §3.
- Cut-sizes section rebuilt: single unqualified value column (Snug-fit column
  removed), strip width moved in, "Loop when sewn" row + "✓ Matches Sewline"
  self-check pill (computed non-tautologically: displayed strip − 2×SA vs
  `model.activeSew.total`, epsilon < 1/64").
- Caption reworded away from garment "ease while sewing" → bag-maker notch/clip
  before sewing.
- Moonshot Tip box: closed-loop variant (live `sa` + `baste = max(1/8, sa−1/8)`)
  and open-tail variant (live `sa`, `baste`, and the exit-tail measurement).
  Gated on `pipingClosedLoop`.
- `pathGeometry.js` + `tailEasingGeometry.js` extraction. §5.
- **Failed-corner strip length fix** (§4b) — the big one. Strips now read
  correctly (e.g. 9 7/8" on a 10×10, was 7 1/2" then 13").

**STILL OPEN:**
1. **Phase 2 — diagram consumes shared geometry.** The diagram still has its own
   `computeExitTail`/`drawStripRun`. Delete the diagram's copy and have it
   import from `tailEasingGeometry.js` (passing visible-width R for drawing).
   One source of truth. Verify the diagram stays pixel-identical.
2. **`measureStripRun` conditional cleanup.** Now that a failed corner ALWAYS
   yields a strip with two easing ends (§4b rule), the `startFail`/`endFail`
   conditionals in `measureStripRun` (and possibly the now-unused
   `tailStart`/`tailEnd` longitudinal calcs) are redundant for any strip that
   gets built. Simplify — but FIRST confirm no degenerate single-side/open-edge
   run relies on the guard. Its own commit (refactor, not behavior).
3. **Redundant EXIT_OVERSHOOT consts in the diagram.** `EXIT_OVERSHOOT_IN/MM`
   are now exported from `pipingCore.js` and imported; the diagram's old local
   consts still shadow them (harmless, identical values). Remove the locals in
   the Phase 2 / style sweep.
4. **Confirm the open-top edge run** (sewline runs UP an open top rather than
   closing across it). Still a verification, not a code change.
5. **Diagram fold-edge length** should consume the cut-list strip number;
   diagram is the design-aid tier, cut list is authoritative. Lower priority.
6. **"Measure down X from the short end" tip.** Now that the real exit-tail
   geometry is in the cut math (`measureStripRun` returns `tailS`/`tailE`), the
   open-tail tip can show a real measured distance for where to mark the strip.

---

## 7. Math self-check invariant — "loop = sewline" (closed loop)

A built-in trust guard. For a closed-loop piping strip:
```
loopWhenSewn = stripCutLength − 2×SA = sewlinePerimeter   ← must always hold
```
SHIPPED: displayed as the "Loop when sewn" row with a kelly-green "✓ Matches
Sewline" pill. Computed the **non-tautological** way — take the strip value
actually displayed, subtract 2×SA, compare to `model.activeSew.total` with a
small epsilon (< 1/64") on RAW values (not rounded display strings). On mismatch
it shows a warning state instead of a silent pass, so the guard can actually
fire if the strip formula/display ever drifts.

---

## 8. Implementation notes (line numbers are APPROXIMATE — verify before editing)

Line numbers rot fast; this section records WHERE things live by name/structure.
Re-confirm exact lines with a read-only pass before any edit.

- **Closed-loop cord/strip** — `pipingCore.js`, `cpPipingClosedLoop`:
  `geoCordLen = Math.max(0, sewPerim − 2π(cordDia/2))` (vinylThick removed),
  `geoStripLen = sewPerim + 2*sa` (correct, leave it).
- **Failed-corner strips** — `pipingCore.js`, `cpPipingStraightStrips`:
  signature now ends `(…, cornerResults, cutSides, cordSides, center, exitOvershoot)`.
  Run-grouping loop unchanged; per-strip length via `measureStripRun`.
  `measureOpts` uses `R = stripWidth/2` (authoritative).
- **Strip/cord measurement** — `tailEasingGeometry.js`, `measureStripRun`:
  `stripLen = cordLen + segLen(tailS) + segLen(tailE)` where
  `segLen(t) = len(sub(t.Tf, t.A1)) + t.R_arc * exitAngleRad`.
  Cord trimmed to C via `cordDist` at each end. `rawCordLen` computed before
  `stripLen` to avoid a circular reference; `cordLen = min(rawCordLen, stripLen)`.
- **Exit-tail geometry** — `tailEasingGeometry.js`, `computeExitTail`:
  ported verbatim from the diagram; 4 geometry params + `opts` scalars.
- **General path/vector helpers** — `pathGeometry.js` (all exported, pure).
- **Call site** — `CurvedPanel.jsx`: builds `pipingCordSides`, `pipingPanelCenter`,
  `pipingExitOvershoot` (unit-aware ¼"/5mm via `isMetric()`), passes them into
  `cpPipingStraightStrips`.
- **Cut-sizes section + self-check pill + Moonshot Tip box** — `CurvedPanel.jsx`,
  the piping panel JSX.
- **Style debt (deferred):** hardcoded `#5340b8` (~9×), the new pill green
  (`#d8f3df`/`#1a7a3a`), mixed `DM Mono` vs `var(--font-mono)` and `Nunito` vs
  `var(--font-sans)`. Save for a dedicated style pass.

---

## 9. Decisions & nuances log (don't lose these)

- **A failed corner ALWAYS yields a strip with two easing ends.** §4b. This is
  the rule that simplifies the open-strip math and enables the §6.2 cleanup.
- **Strip = measured folded path, never sewline ± offsets.** The bug was
  treating 2D fold geometry as 1D length (first subtractively → too short, then
  additively → too long). Measure between the real returned points. §4b.
- **Real geometry beats the hand drawing.** The Illustrator/SVG reference is
  authoritative for CALLOUTS and METHOD, not exact pixel measurements. When the
  measured-from-code value (9.87") differed from the hand drawing (~9.81") by
  ~0.06" — below 1/8" display rounding — the code value was trusted. Do not
  chase sub-display-resolution differences from the drawing.
- **Cut radius = stripWidth/2; diagram radius = stripVisibleWidth.** Intentional
  split (cut authoritative, visible for the cord-wrap drawing). §4b.
- **Cord prefers to run slightly long, never short.** Can't be eased; if short
  there's a gap, if long you trim. Bias toward not-under.
- **"Precise but forgiving."** Soft goods and human cutting are imprecise; the
  *geometry* stays exact. Forgiveness comes from stay-aways and heavy notching,
  not from fudging the math.
- **Elegant consequence (closed loop):** strip = sewline + 2·SA, so the strip
  sewn into a loop (minus the two join SAs) equals the sewline exactly — what
  the "✓ Matches Sewline" pill celebrates.
- **Extraction discipline that worked:** create-unused → swap-and-prove-identical
  → port-unused → add-unused → wire (behavior). Each its own commit. The
  pixel-identical diagram at the swap step proved the toolkit faithful before
  any cut-list math depended on it.
- **Already shipped earlier (don't redo):** dead-code cleanup (`cpFmtD`,
  `cpUnit`, `cpFmtVinyl`+`_FM64`, `rayPathIntersect`, 18 unused imports),
  Math.round strip-width fix, unified `EXIT_ANGLE_DEG`, pipingCore.js extraction.
- **Housekeeping done:** stale `worktree-purse-feet` worktree + branch removed
  (was fully merged into master; verified via `git branch --merged` and
  `git log master..` showing no unmerged commits).
- **Style pass is deliberately deferred.** Don't scope-creep into it.

---

## 10. Other extraction candidates (low urgency, from the original review)

Still open, low priority:
- `pipingDiagram.js` — the big SVG piping overlay nested in `cpPanelDiagramSVG`
  (largest single chunk; this is also where Phase 2 §6.1 lands).
- `miniDiagrams.js` — `cpMiniStrip`/`cpMiniTrapezoid`/`cpGussetMapHTML` + helpers.
- `cpFormatting.js` — `cpFmt`/`cpFmtPerim`/`cpFmtHyphen`/`_FM16`.
