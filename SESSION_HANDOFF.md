# Session Handoff — Purse Feet Phase 1

**Written:** end of session, June 28 2026
**Status:** COMPLETE — Phase 1 fully implemented and building clean.

---

## What Was Built

Phase 1 of the purse feet placement feature for CurvedPanel. Covers
symmetric grid placement, screen diagram marks, and print output.

---

## Files Touched (4)

### 1. `src/purseFeet.js` — CREATED

Pure calculation module. No JSX, no side effects.

Exports:
- `FOOT_RADIUS_IN = 0.25` — 1/4" radius for diagram marks
- `STAY_AWAY_BASE = 0.75` — 3/4" fixed stay-away component
- `MIN_FOOT_SPACING = 1` — minimum center-to-center distance
- `stayAwayFor(SA)` — returns `r8(0.75 + SA)`
- `calcPurseFeet(L, W, SA, footCount, centerFoot, insetNudge)`

Grid config: `{ 2:[1,2], 4:[2,2], 6:[2,3], 8:[2,4] }` — [rows along short axis, cols along long axis].

Long axis: `L >= W`; square panels tie-break to `longIsL = true`.

`insetNudge` increases effective stay-away (moves feet inward), never decreases it.

Returns `{ feet: [{x,y}], stayAway, error }` — all error paths return `feet: []`, never null.

Post-placement all-pairs spacing check catches center-foot collisions.

---

### 2. `src/diagramMarks.js` — MODIFIED

Added:
- `import { FOOT_RADIUS_IN } from './purseFeet.js'`
- `W_SEW` added to diagramTokens import
- `drawPurseFeetMarks(ctx, feet, scale)` exported at end of file

Mark spec:
- Circle: `FOOT_RADIUS_IN * scale.value` radius, `C_SEW` stroke, transparent fill
- Crosshair: ±r×1.25 horizontally and vertically (extends slightly past circle edge)
- `scale = { value, mode: 'screen'|'print' }` — `mode` selects stroke weight
  (`mode === 'print'` → 0.022in; otherwise → `W_SEW` = 1.5px)

Coordinate mapping via `ctx`:
- `ctx.x0`, `ctx.y0` — SVG origin of panel top-left cut corner
- `ctx.xIsW = true` — for cpMiniStrip (vertical strip: L→SVG-y, W→SVG-x)
- `ctx.xIsW = false` (default) — for print strips (horizontal: L→SVG-x, W→SVG-y)

---

### 3. `src/tabs/CurvedPanel.jsx` — MODIFIED

**Imports added:**
```js
import { ..., drawPurseFeetMarks } from "../diagramMarks.js";
import { calcPurseFeet } from "../purseFeet.js";
```

**State variables** (after `vinylInfoOpen`):
```js
const [pfOn,setPfOn]=useState(false);
const [pfCount,setPfCount]=useState(4);
const [pfCenter,setPfCenter]=useState(false);
const [pfNudge,setPfNudge]=useState(0);
```

**`stageOpen`** extended to 7 entries: `useState([true,true,true,true,false,false,false])`

**Render body** (before `sides` computation):
```js
const hasPfBottom = pieceStyle==="sides" && ready && model.valid && hasDepth
  && !!(model.displaySidePieces||[]).find(pc=>pc.side==="bottom");
const pfBottomPc = hasPfBottom
  ? (model.displaySidePieces||[]).find(pc=>pc.side==="bottom")
  : null;
const pfResult = pfBottomPc && pfOn
  ? calcPurseFeet(pfBottomPc.cutLength, pfBottomPc.cutWidth, sa, pfCount, pfCenter, pfNudge)
  : null;
const pfFeet = pfResult && !pfResult.error ? pfResult.feet : [];
const sides = cpSidesHTML(model, params, pfOn ? pfFeet : null), gusset = cpGussetHTML(model, params);
```

Note: `pfBottomPc` is NOT gated on `pfOn` — it's always set when the stage is visible.

**`cpSidesHTML` signature**: `function cpSidesHTML(m, p, pfFeet)`

**`cpMiniStrip`** — after stabilizer block, before topLabel:
```js
if(o.purseFeet && o.purseFeet.length){
  s += drawPurseFeetMarks({x0, y0:yTop, xIsW:true}, o.purseFeet, {value:scale, mode:'screen'});
}
```

**Stage 7** — renders only when `hasPfBottom` is true (real render gate, not dimming).
Uses `stageOpen[6]` / `toggleStage(6)`. Controls:
- `cp-check` toggle for on/off
- `cp-fi` + `select` for foot count (2/4/6/8)
- `cp-check` for center foot
- `cp-fi` + `select` for nudge (0–1" in 1/8" steps)
- `cp-stage-hint` error display (red, bold)
- Position list (`pfFeet.map(...)` → `cp-stage-hint` per foot)
- Instructional note (italic `cp-stage-hint`)

**Print call updated**: `onClick={()=>cpPrintSides(model, params, pfFeet)}`

---

### 4. `src/printRenderers.js` — MODIFIED

- Added `drawPurseFeetMarks` to diagramMarks.js import
- `cpPrintSides` signature: `export function cpPrintSides(m, p, pfFeet = [])`
- After `geom += cpDrawStrip(...)` inside loop, for the bottom piece only:
  ```js
  if(pfFeet && pfFeet.length && pc.side === "bottom"){
    geom += drawPurseFeetMarks({x0:PADIN, y0:y, xIsW:false}, pfFeet, {value:1, mode:'print'});
  }
  ```
  `xIsW:false` (print strips are horizontal), `value:1` (print-inch coordinates).

---

## Deferred — Stabilizer Print Wiring

When purse feet are enabled, the stabilizer bottom print card should also show
purse feet marks. The brief specifies same coordinates derived from panel dimensions.

**Not yet implemented.** `cpPrintStabilizer` in `src/printRenderers.js` would need:
1. A `pfFeet` parameter (default `[]`)
2. The same `drawPurseFeetMarks` call for the bottom stabilizer piece
3. The `CurvedPanel.jsx` call to `cpPrintStabilizer` updated to pass `pfFeet`

Do this as a follow-up to Phase 1, before Phase 2.

---

## Pending — Phase 2 and Phase 3

### Phase 2 — Asymmetry Controls

Separate inset nudge per axis (long/short), or individual foot inset overrides.
No implementation yet. Design to be determined.

### Phase 3 — Adjustable Foot Size and Stay-Away

- Adjustable foot radius (currently fixed at 1/4")
- Adjustable stay-away distance (currently fixed at 3/4" + SA)

No implementation yet.

---

## Key Architectural Decisions

- **`feet: []` on all error paths** — `drawPurseFeetMarks` guards with
  `!feet || !feet.length` and returns `''` safely. Never returns null.
- **`xIsW` coordinate flag** — cleanly handles the 90° rotation between
  vertical screen strips (cpMiniStrip) and horizontal print strips without
  two separate functions.
- **`{ value, mode }` scale object** — `mode` selects stroke weight;
  `value` is the coordinate multiplier. Avoids a heuristic px-threshold check.
- **Stage 7 render gate** — `hasPfBottom` must be true for Stage 7 to render
  at all. Not just dimmed — absent unless Side Panels mode with a bottom piece.
- **`pfBottomPc` independence from `pfOn`** — stage is visible and shows
  controls regardless of whether pfOn is true. Only `pfResult`/`pfFeet`
  are gated on `pfOn` to avoid unnecessary computation.
