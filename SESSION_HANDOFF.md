# Session Handoff — _offsetOpen Geometry Bug

**Written:** end of session, June 19 2026  
**Status:** RESOLVED — June 25 2026

### Fixed — _offsetOpen fold in geometryOffset.js

Resolved June 25 2026. See git history (commit c1be3d9) for full details.
`_removeLocalLoops()` added to `offsetSidePaths()` in `src/geometryOffset.js`.
All 7 test cases pass (`repro_test_7cases.mjs`). Visually confirmed in browser.

---

*Original handoff (investigation notes, repro output, and proposed fix) preserved below for reference.*

---

## 1. The Bug, Precisely Stated

**Error message:** "The seam allowance causes the sewline to cross itself."

**Exact repro that fails:**
```
Top width:     9"
Bottom width:  10"
Height:        10"
SA:            3/8" (default)
Top corners:   1"  (topSoft = 1.0)
Bottom corners: 0" (default, crisp)
Side curve:    0 (matching sides on)
Feel:          Gentle
Top mode:      4-sided enclosed
```

**Exact repro that passes (everything identical except):**
```
Top corners:   2"  (topSoft = 2.0)
```

**Also confirmed failing:**
```
Same as above but SA = 1/4" (topSoft = 1", sa = 0.25)
```

**Original logged finding (from last session, instrumented via validateClosedOffset):**

Self-intersection confirmed as a proper cross (verified via orientation values — not a touch/endpoint coincidence) at:

```
Segment pair: [221, 222] × [223, 224]   (in sewPts[], zero-indexed)

pts[221] = (9.17434761, 1.00049445)   side=right
pts[222] = (9.17564981, 1.02185296)   side=right
pts[223] = (9.17546787, 1.01872661)   side=right
pts[224] = (9.17859287, 1.08122661)   side=right
```

Symmetric crossing on the left side at indices [646,647]×[648,649] (mirror image by panel symmetry).

The fold: path goes y=1.000 → y=1.022 → **y=1.019 (reversal)** → y=1.081. The reversal of 0.003" between pts[222] and pts[223] causes segment [221,222] to cross segment [223,224].

---

## 2. What This Session Found

### Part A — The G1-Continuity Argument (Initial, Incorrect)

Early in this session, before the repro was re-run, I argued:

1. `cutSides` is constructed by `joinPathParts([arc_half, edge, arc_half], side_label)` — which force-relabels ALL points, so no arc point ever straddles a side boundary.
2. `sampleCornerBlend` ensures the arc ends at the edge's `tanStart` direction — making every arc-to-edge junction G1 (tangent-continuous).
3. Therefore `_offsetOpen`'s tangent averaging sees no sharp direction changes within a side's path, and `_joinOffsetPair` handles between-side corners.
4. Conclusion: no fold possible.

This was wrong. G1 continuity guarantees the tangent *direction* is continuous, but `_offsetOpen` does not compute the tangent — it computes the chord direction `unit(pts[i+1] - pts[i-1])`, which is sensitive to **step-size ratios**, not just direction. The G1 argument was irrelevant to the actual failure mode.

### Part B — Contradiction Resolved: What Actually Generates sewPts

The repro was re-run and **exactly reproduced** (identical coordinates). The contradiction between the G1 proof and the logged repro was resolved by tracing the actual code path:

**Live sewPts code path for the 4-sided enclosed case:**
```
buildCurvedPanelModel(params)
  → offsetSidePaths(cutSides, sa)      [geometryOffset.js]
      → _offsetOpen(cutSides.right, sa)  ← FOLD ORIGINATES HERE
  → sewSides
  → combineSidePaths(sewSides, SIDE_ORDER, true)
  → dedupe(...)
  → sewPts
```

`buildOpenSewline` (at line 245 of `curved-panel-core.js`) — the older function that uses the local `offsetOpen` — is **dead code**: exported but never imported anywhere. `buildOpenTopSewline` (line 704, used for the 3-sided open case) reuses the already-computed `sewSides` and doesn't call `_offsetOpen` at all.

### Part C — The Actual Root Cause

`trimPolyline(eRight, ts=1.0, bs=0)` creates `R.pts[0]` at exactly 1" from TR along the right edge. For this specific panel (TR at x=9.5, right edge going to BR at x=10, y=10), that trim point lands **0.00125"** in y from the nearest original edge sample `eRight[16]`.

This creates the following step-size sequence in `cutSides.right`:

```
cutRight[29→30]: dy = 0.02576"   (arc sample step)
cutRight[30→31]: dy = 0.02595"   (arc sample step)
cutRight[31→32]: dy = 0.02614"   (arc sample step)
cutRight[32→33]: dy = 0.00125"   ← 50× SMALLER (trim point nearly coincides with eRight[16])
cutRight[33→34]: dy = 0.06250"   (uniform edge steps resume — 50× the prev step)
cutRight[34→35]: dy = 0.06250"
cutRight[35→36]: dy = 0.06250"
```

`_offsetOpen` at index 32 (arc endpoint, `R.pts[0]`):
```
chord = unit(pts[33] - pts[31]) = unit(0.00169, 0.02738)
normal_y = 0.0616   →   off_y = 0.99875 + 0.0616×0.375 = 1.02185
```

`_offsetOpen` at index 33 (first edge sample, `eRight[16]`):
```
chord = unit(pts[34] - pts[32]) = unit(0.00319, 0.06375)
normal_y = 0.0499   →   off_y = 1.00000 + 0.0499×0.375 = 1.01873
```

`sewRight[32].y = 1.02185 > sewRight[33].y = 1.01873` → 0.003" reversal → self-intersection.

The 50x step-size ratio makes the chord direction jump abruptly between index 32 and 33, even though the true tangent is continuous. This is the complete root cause.

**Why ts=2" passes:** At ts=2", the trim point is ~0.003" from the nearest edge sample (vs 0.00125" for ts=1"). The fold that exists is smaller and appears to fall below the effective detection threshold of `segmentsIntersect`.

**Why the miter-normal approach also doesn't fully fix it:** With the miter approach (using per-segment tangents instead of chord), the fold reduces from 0.003" to 0.001" but is NOT eliminated. At index 32, n1 (from arc segment) and n2 (from tiny arc step) give miter_n_y = 0.056; at index 33, n1 (from tiny arc step) and n2 (from edge step) give miter_n_y = 0.050. Since 0.056 > 0.050, right[32].y still exceeds right[33].y. The 0.001" fold is still a proper crossing detected by `segmentsIntersect`.

---

## 3. repro_test.mjs — Full Output

Both scripts are at `C:/AI/moonshot-bag-calc-dev/repro_test.mjs` and `repro_test2.mjs`.

**repro_test.mjs — actual terminal output (ran fully, no truncation):**

```
errors: [ 'The seam allowance causes the sewline to cross itself.' ]
sewPts length: 680
selfIntersections count: 2

Cross at segments [221,222] × [223,224]:
   pts[221]=(9.17434760648, 1.00049445149) side=right
   pts[222]=(9.17564981166, 1.02185296259) side=right
   pts[223]=(9.17546787292, 1.01872660635) side=right
   pts[224]=(9.17859287292, 1.08122660635) side=right

Cross at segments [646,647] × [648,649]:
   pts[646]=(0.82140712708, 1.08122660635) side=left
   pts[647]=(0.82453212708, 1.01872660635) side=left
   pts[648]=(0.82435018834, 1.02185296259) side=left
   pts[649]=(0.82565239352, 1.00049445149) side=left

--- inspecting sewSides.right and sewSides.top near junction ---
sewSides.top length=191, last 4 pts:
  top[187]=(8.93069188, 0.52987012)
  top[188]=(8.94273239, 0.54006490)
  top[189]=(8.95453300, 0.55053487)
  top[190]=(8.96607435, 0.56128892)
sewSides.right length=172, first 10 pts:
  right[0]=(8.96607435, 0.56128892)
  right[1]=(8.97739133, 0.57227884)
  right[2]=(8.98843754, 0.58354189)
  right[3]=(8.99922087, 0.59505827)
  right[4]=(9.00973574, 0.60682242)
  right[5]=(9.01997666, 0.61882875)
  right[6]=(9.02993824, 0.63107172)
  right[7]=(9.03961519, 0.64354578)
  right[8]=(9.04900235, 0.65624546)
  right[9]=(9.05809466, 0.66916534)

--- y-reversals in sewSides.right ---
  reversal at right[33]: y went from 1.02185296 DOWN to 1.01872661
    right[30]=(9.17288664, 0.98368772)
    right[31]=(9.17434761, 1.00049445)
    right[32]=(9.17564981, 1.02185296)
    right[33]=(9.17546787, 1.01872661)
    right[34]=(9.17859287, 1.08122661)
    right[35]=(9.18171787, 1.14372661)
    right[36]=(9.18484287, 1.20622661)

--- cutSides.right first 40 pts ---
cutSides.right length=178
  cutRight[0]=(9.22454731, 0.28956942)
  cutRight[1]=(9.24206657, 0.30662489)
  [... arc samples ...]
  cutRight[29]=(9.54317873, 0.92090012)
  cutRight[30]=(9.54605435, 0.94666259)
  cutRight[31]=(9.54830988, 0.97261576)
  cutRight[32]=(9.54993762, 0.99875234)
  cutRight[33]=(9.55000000, 1.00000000)
  cutRight[34]=(9.55312500, 1.06250000)
  cutRight[35]=(9.55625000, 1.12500000)
  cutRight[36]=(9.55937500, 1.18750000)
  cutRight[37]=(9.56250000, 1.25000000)
  cutRight[38]=(9.56562500, 1.31250000)
  cutRight[39]=(9.56875000, 1.37500000)
```

**repro_test2.mjs — actual terminal output (ran fully):**

```
--- cutRight at arc-edge junction ---
  cutRight[29]=(9.54317873, 0.92090012)  dy_fwd=0.02576247
  cutRight[30]=(9.54605435, 0.94666259)  dy_fwd=0.02595318
  cutRight[31]=(9.54830988, 0.97261576)  dy_fwd=0.02613658
  cutRight[32]=(9.54993762, 0.99875234)  dy_fwd=0.00124766
  cutRight[33]=(9.55000000, 1.00000000)  dy_fwd=0.06250000
  cutRight[34]=(9.55312500, 1.06250000)  dy_fwd=0.06250000
  cutRight[35]=(9.55625000, 1.12500000)  dy_fwd=0.06250000
  cutRight[36]=(9.55937500, 1.18750000)  dy_fwd=0.06250000

--- sewRight (offsetSidePaths output) at same indices ---
  sewRight[29]=(9.17102814, 0.96704055)
  sewRight[30]=(9.17288664, 0.98368772)
  sewRight[31]=(9.17434761, 1.00049445)
  sewRight[32]=(9.17564981, 1.02185296)
  sewRight[33]=(9.17546787, 1.01872661)
  sewRight[34]=(9.17859287, 1.08122661)
  sewRight[35]=(9.18171787, 1.14372661)
  sewRight[36]=(9.18484287, 1.20622661)

--- manual _offsetOpen chord u at critical indices ---
  i=31: chord_u=(0.074343,0.997233) normal_y=0.074343 -> off_y=1.00049445
  i=32: chord_u=(0.061602,0.998101) normal_y=0.061602 -> off_y=1.02185296
  i=33: chord_u=(0.049938,0.998752) normal_y=0.049938 -> off_y=1.01872661
  i=34: chord_u=(0.049938,0.998752) normal_y=0.049938 -> off_y=1.08122661

--- miter-normal approach at same indices ---
  i=31: miter_n=(-0.997230,0.074375) cosH=0.999925 -> off_y=1.00050848
  i=32: miter_n=(-0.998428,0.056049) cosH=0.999981 -> off_y=1.01977103
  i=33: miter_n=(-0.998752,0.049938) cosH=1.000000 -> off_y=1.01872661
  i=34: miter_n=(-0.998752,0.049938) cosH=1.000000 -> off_y=1.08122661

--- ts=2" errors: []
--- ts=1", sa=0.25" errors: [ 'The seam allowance causes the sewline to cross itself.' ]
  fold at right3[33]: 1.01415275 -> 1.01248440
```

---

## 4. Proposed Fix

### Why not the miter-normal approach

Miter reduces the fold from 0.003" to 0.001" but does not eliminate it. The self-intersection still fires. The miter bisects n1 (arc-incoming, slightly more curved) and n2 (nearly-edge-tangent tiny step). At the arc endpoint (index 32), the bisector gives miter_n_y = 0.056 vs 0.050 at index 33 — still reversed. The miter approach cannot fix a fold that arises from the asymmetric step-size context at these two adjacent points.

### The fix: `_removeLocalLoops` in `offsetSidePaths`

After `_offsetOpen` computes each side's offset path, check for self-crossings within a small forward window (5 segments ahead). When found, find the intersection of the crossing segments and collapse the reversal loop — exactly what `_joinOffsetPair` does between sides, but applied within a single side.

**Location:** `src/geometryOffset.js`

**New private helper:**
```js
function _segsProperCross(a, b, c, d) {
  // Returns true only for proper interior crossings (no endpoint coincidences).
  const d1x = b.x-a.x, d1y = b.y-a.y;
  const d2x = d.x-c.x, d2y = d.y-c.y;
  const cross = d1x*d2y - d1y*d2x;
  if (Math.abs(cross) < 1e-12) return false;
  const t = ((c.x-a.x)*d2y - (c.y-a.y)*d2x) / cross;
  const u = ((c.x-a.x)*d1y - (c.y-a.y)*d1x) / cross;
  return t > 1e-9 && t < 1-1e-9 && u > 1e-9 && u < 1-1e-9;
}

function _removeLocalLoops(pts) {
  // Collapse self-crossings within a forward window of 5 segments.
  // Handles fold artifacts from step-size ratio jumps at arc/edge junctions.
  const out = [...pts];
  let i = 0;
  while (i < out.length - 3) {
    let fixed = false;
    for (let j = i + 2; j <= Math.min(i + 5, out.length - 2); j++) {
      if (!_segsProperCross(out[i], out[i+1], out[j], out[j+1])) continue;
      const ta = _unit(out[i+1].x - out[i].x, out[i+1].y - out[i].y);
      const tb = _unit(out[j+1].x - out[j].x, out[j+1].y - out[j].y);
      const X = _lineIntersect(out[i], ta, out[j], tb);
      if (!X || !isFinite(X.x) || !isFinite(X.y)) break;
      // Collapse: replace out[i+1..j] with the intersection point
      out.splice(i + 1, j - i, { x: X.x, y: X.y, side: out[i + 1].side });
      fixed = true;
      break;
    }
    if (!fixed) i++;
  }
  return out;
}
```

**Change to `offsetSidePaths`:**
```js
export function offsetSidePaths(sidePaths, inset){
  const out = {};
  for (const side of _SIDE_ORDER){
    let pts = _offsetOpen(sidePaths[side] || [], inset);
    pts = _removeLocalLoops(pts);          // ← ADD THIS LINE
    out[side] = pts.map(q => ({ ...q, side }));
  }
  _joinOffsetPair(out.top, out.right);
  _joinOffsetPair(out.right, out.bottom);
  _joinOffsetPair(out.bottom, out.left);
  _joinOffsetPair(out.left, out.top);
  for (const side of _SIDE_ORDER){
    out[side] = _dedupe(out[side], false).map(q => ({ ...q, side }));
  }
  return out;
}
```

The window of 5 is sufficient: the observed crossing is always between segments [i, i+1] and [i+2, i+3] (skipping one segment). A window of 5 provides margin for other similar configurations.

### The 7-case test plan (NONE run yet — all to run in next session)

All cases: model built via `buildCurvedPanelModel(params)`, check `model.errors` for the crossing message and `selfIntersections(model.sewPts, true).length === 0`.

| # | Config | Before fix | Expected after fix |
|---|---|---|---|
| 1 | ts=1", 9×10×10, SA=3/8" (primary repro) | FAILS | passes, no crossing |
| 2 | ts=1", 9×10×10, SA=1/4" | FAILS | passes, no crossing |
| 3 | ts=2", 9×10×10, SA=3/8" | passes | still passes, no regression |
| 4 | ts=0 (crisp), 9×10×10, SA=3/8" | passes | still passes; `_removeLocalLoops` must find nothing to remove |
| 5 | ts=1", bs=0.5" (mixed corners), 9×10×10, SA=3/8" | unknown | passes; both TR and BL arcs clean |
| 6 | ts=1", asymmetric (top 7", bottom 13", height 10", SA=3/8") | unknown | passes |
| 7 | ts=1", 9×10×10, SA=0 | passes (no offset) | still passes; identity path through `_removeLocalLoops` |

After all 7 pass: run `npm run build`, commit.

---

## 5. Confirmed-Fixed Items and Git Status

### Stabilizer auto-print separately
**Status: COMPLETE, committed, pushed.**  
The stabilizer has its own dedicated print card in the print bar (lines 1218–1223 of `CurvedPanel.jsx`) calling `cpPrintStabilizer` — separate from main panel, sides/bottom, and gusset. No print-together/separate toggle exists. This was implemented in prior passes, not this session.

### Amber "Values adjusted" warning box
**Status: COMPLETE, committed, pushed.**  
Commit `dfca894` ("Warning box: font size 12px, surface clamped-value notes"), pushed to `origin/master` at end of this session. Changes:
- `cp-diag-status--warn` condition now fires when `model.notes.length > 0` even when `model.valid` is true — clamping notes from `buildPanel()` (crown/fullness/softness reduced to keep curve fair) are now surfaced verbatim
- Shows "Values adjusted" for notes-only; "Pattern output locked" for errors/invalid — mutually exclusive, shared amber background `rgba(138, 90, 16, 0.92)`
- Font sizes bumped to 12px

---

## 6. Explicit Next Action

Re-run `node repro_test.mjs` to confirm output still matches §3 exactly (no intervening changes), then implement `_removeLocalLoops` + the one-line change to `offsetSidePaths` in `src/geometryOffset.js`, then run the 7-case test plan from §4 before declaring the fix done.

---

## Dead Code Note (Do Not Act On Now)

During investigation, three dead functions were identified:
- `buildOpenSewline` (line 245, `curved-panel-core.js`) — exported, never imported. Uses the simpler local `offsetOpen` that would also have this fold issue. Safe to delete later.
- `_cpOffsetSidePaths` and `_offsetOpenPath` (lines 80–121, `stabilizer.js`) — private helpers, never called. Superseded when `cpStabilizerPoints` was updated to call the imported `offsetSidePaths`. Safe to delete later.

Neither affects the current bug. Flag for cleanup pass after this fix is verified.
