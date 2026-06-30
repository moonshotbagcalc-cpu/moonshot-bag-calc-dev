// tailEasingGeometry.js
// Easing-tail geometry for piping (and future eased trim/components).
// Solves the 55° fold-away tail at a FAILED corner: the fold-exit point Fi, the
// arc center B, arc endpoints A1/A2, tail tip Tf, end-cap Tr, and the cord end C.
// Ported verbatim from CurvedPanel.jsx's computeExitTail so the cut-list and the
// diagram can share ONE source of truth. Pure geometry, inches-space, no SVG/React.
//
// The four geometry inputs (Fi, cutTanTowardCorner, nIn, cordPath) are prepared by
// the CALLER, exactly as drawStripRun did. The scalars that were diagram closures
// (arc radius, tail fold width, exit angle, overshoot) are now passed via `opts`,
// so the cut-list caller can supply AUTHORITATIVE values (stripWidth-based radius)
// while the diagram may still supply its visible-width radius. Same function, the
// caller decides the basis — this is the §9 cut-vs-visible-width harmonization.

import {
  add, sub, mul, dot, perp, len, unitV,
  pathLen, runPath, tangentAt, straightTangentAt,
  linePathIntersectInfo, closestPathPointToLineInfo,
} from "./pathGeometry.js";

// Fi                 = folded-edge exit point ON the panel cut edge
//                      (trim point at 1.5×SA + easeOff from the failed corner)
// cutTanTowardCorner = unit tangent along the cut edge pointing TOWARD the failed corner
// nIn                = inward normal at Fi, toward panel center
// cordPath           = owning side's cord centerline path (cordSides[side])
// opts = { R, tailFoldWidth, exitAngleRad, exitOvershoot, D }
//   R             = arc radius for B→A2 and B→A1 (cut-list: stripWidth/2 basis;
//                   diagram: installed/visible folded width)
//   tailFoldWidth = short end-cap width after the 55° transition (cut: stripWidth/2)
//   exitAngleRad  = EXIT_ANGLE_DEG in radians (55°)
//   exitOvershoot = strip tail extension past Fi (¼" imperial / 5mm metric)
//   D             = cord diameter (used only by the C fallback)
//
// Returns: { Fi, Tf, B, A2, A1, Tr, C, cordDist, R_arc, sweep_natural,
//            notchBack, tangentAway, dirA2, dirA1 }
export function computeExitTail(Fi, cutTanTowardCorner, nIn, cordPath, opts) {
  const { R, tailFoldWidth, exitAngleRad, exitOvershoot, D } = opts;

  const tangentAway = mul(cutTanTowardCorner, -1); // along the cut edge, back into the run
  const sin55 = Math.sin(exitAngleRad);
  const cos55 = Math.cos(exitAngleRad);

  // B must be placed so the 55° radius endpoint A1 lands on a tangent line that
  // continues cleanly through Fi. Using only R here creates a 90° corner.
  const notchBack = Math.max(R, R / Math.max(sin55, 1e-9));
  const B = add(Fi, mul(tangentAway, notchBack));

  // A2: start of folded-edge easing arc, radius R from B along the inward normal.
  const dirA2 = unitV(nIn);
  const A2 = add(B, mul(dirA2, R));

  // A1: end of folded-edge easing arc. Rotate B→A2 by 55° TOWARD the failed corner.
  const turnSign = (dirA2.x * cutTanTowardCorner.y - dirA2.y * cutTanTowardCorner.x) >= 0 ? 1 : -1;
  const dirA1 = unitV({
    x: dirA2.x * cos55 - turnSign * dirA2.y * sin55,
    y: turnSign * dirA2.x * sin55 + dirA2.y * cos55,
  });
  const A1 = add(B, mul(dirA1, R));

  // Folded edge leaves A1 as a straight tangent segment through Fi and then Tf.
  const exitDir = unitV(sub(Fi, A1));
  const Tf = add(Fi, mul(exitDir, exitOvershoot));

  // Short trim edge Tr→Tf is the physical half-cut-strip-width edge, perpendicular
  // to the exiting long strip edges and parallel to the B→A1 radius line.
  const Tr = add(Tf, mul(dirA1, -tailFoldWidth));

  // C: cord endpoint. Inline with the B→A2 construction/radius line (perpendicular
  // to the local cut edge at B). The cord stays on its own centerline path; C is
  // NOT on the folded-edge arc and must never pull the cord onto the folded path.
  const dirBtoC = dirA2;
  let cInfo = null;
  if (cordPath && cordPath.length >= 2) {
    cInfo = linePathIntersectInfo(B, dirBtoC, cordPath, R + 1e-6);
    if (!cInfo) cInfo = closestPathPointToLineInfo(B, dirBtoC, cordPath);
  }
  const C = cInfo?.point || add(B, mul(dirBtoC, Math.max(0, R - D / 2)));
  const cordDist = Number.isFinite(cInfo?.dist) ? cInfo.dist : null;

  const R_arc = R;
  const sweep_natural = turnSign > 0 ? 1 : 0;

  return { Fi, Tf, B, A2, A1, Tr, C, cordDist, R_arc, sweep_natural,
           notchBack, tangentAway, dirA2, dirA1 };
}

// ── Cut-list length measurement ─────────────────────────────────────────────
// Computes per-side STRIP and CORD cut lengths for the failed-corner (open-tail)
// case, by measuring the real exit-tail geometry instead of guessing offsets.
//
// This mirrors how drawStripRun sets up computeExitTail (same runPath trim, same
// tangent/inward-normal derivation), then MEASURES the result into scalars:
//
//   strip length = side sew run + at each FAILED end a longitudinal tail of
//                  (notchBack + exitOvershoot) past the sewline endpoint.
//                  notchBack = R/sin(55°) is the B→Fi distance; Tf overshoots Fi
//                  by exitOvershoot. Together they are how much LONGER the strip
//                  runs at a failed end so it can fold away and be trimmed.
//   cord length  = side cord run, trimmed at each FAILED end to where C lands
//                  (cordDist = arc-length along the cord path to C). The cord stops
//                  at C on its own centerline; it does NOT tail past like the strip.
//
// Inputs:
//   sides        = array of side keys for this run, e.g. ['top'] or ['left','top']
//   cutSides     = {top,right,bottom,left} cut-edge polylines (inch space)
//   cordSides    = {top,right,bottom,left} cord-centerline polylines (inch space)
//   sewRun       = scalar sewline length for this run (sum of activeRuns over sides)
//   cordRun      = scalar cord length for this run (sum of cordRuns over sides)
//   startFail    = boolean, does the corner BEFORE this run fail?
//   endFail      = boolean, does the corner AFTER this run fail?
//   center       = panel center {x,y} (from model.cutBB) for inward-normal sign
//   opts         = { sa, easeOff, R, tailFoldWidth, exitAngleRad, exitOvershoot, D }
//
// Returns: { stripLen, cordLen, measureBackStart, measureBackEnd, tailS, tailE }
//   measureBackStart/measureBackEnd = folded-path length at each eased end
//        (straight A1→Tf + the 55° arc A1→A2); feeds the "measure back X from
//        the short end" tip. 0 at an end with no tail.
//   tailS/tailE       = the full computeExitTail result at each failed end (for
//                       diagram reuse / "measure down X from the end" tips)
export function measureStripRun(sides, cutSides, cordSides, sewRun, cordRun,
                                startFail, endFail, center, opts) {
  const { sa, easeOff, R, tailFoldWidth, exitAngleRad, exitOvershoot, D } = opts;
  const exitOffset = 1.5 * sa + easeOff;

  // Walk the cut edge for this run, trimmed by exitOffset at each FAILED end, to
  // land Fi exactly where drawStripRun does.
  const trimStart = startFail ? exitOffset : 0;
  const trimEnd   = endFail   ? exitOffset : 0;
  const outerAtFi = runPath(cutSides, sides, trimStart, trimEnd);
  if (outerAtFi.length < 2) {
    // Degenerate run; fall back to the bare sew run + seam allowances.
    return { stripLen: sewRun + 2 * sa, cordLen: cordRun,
             measureBackStart: 0, measureBackEnd: 0, tailS: null, tailE: null };
  }

  const startTan = straightTangentAt(outerAtFi, true);
  const endTan   = straightTangentAt(outerAtFi, false);
  const startSide = sides[0], endSide = sides[sides.length - 1];

  const inwardNormal = (tangent, point) => {
    let n = unitV(perp(tangent));
    if (dot(n, sub(center, point)) < 0) n = mul(n, -1);
    return n;
  };

  const exitOpts = { R, tailFoldWidth, exitAngleRad, exitOvershoot, D };

  let tailS = null, tailE = null;
  let cordTrimStart = 0, cordTrimEnd = 0;

  // Guards stay on purpose. For every strip that actually gets built, both ends
  // ease: 4-side runs are rotated to start/end at a failing joint, and open-top
  // "3side" forces the top corners allowed:false so they bookend the linear run.
  // The false-branch is only reachable by a degenerate partial-subset run (e.g. a
  // lone middle side with passing neighbors), where skipping the tail is correct.
  // Do NOT remove these assuming "two ends always ease" — true for the real
  // configs, but not structurally enforced at the call site.
  if (startFail) {
    const nIn = inwardNormal(startTan, outerAtFi[0]);
    tailS = computeExitTail(outerAtFi[0], mul(startTan, -1), nIn, cordSides[startSide], exitOpts);
    // Cord stops at C: trim the cord run by how far C sits from the run start.
    const startCordSideLen = pathLen(cordSides[startSide] || []);
    cordTrimStart = (tailS.cordDist != null)
      ? Math.max(0, tailS.cordDist)
      : exitOffset;
    // (cordDist is measured from the start of cordSides[startSide]; for the start
    //  end that is the distance to trim off the front.)
  }

  if (endFail) {
    const nIn = inwardNormal(endTan, outerAtFi[outerAtFi.length - 1]);
    tailE = computeExitTail(outerAtFi[outerAtFi.length - 1], endTan, nIn, cordSides[endSide], exitOpts);
    const endCordSideLen = pathLen(cordSides[endSide] || []);
    cordTrimEnd = (tailE.cordDist != null)
      ? Math.max(0, endCordSideLen - tailE.cordDist)
      : exitOffset;
  }

  // Cord: trimmed at each failed end to where C lands on its own centerline path.
  const rawCordLen = Math.max(0, cordRun - cordTrimStart - cordTrimEnd);

  // Strip = cord (middle) + at each end the straight exit segment A1→Tf plus the
  // 55° easing arc A1→A2. Both ends always ease (a strip only terminates at failed
  // corners). Measures the actual folded path — not sewRun + tails, which wrongly
  // counts the fold-back geometry as additive longitudinal length.
  const segLen = (t) => {
    if (!t) return 0;
    const arc = t.R_arc * exitAngleRad;       // arc length A1→A2 = R × 55°
    const straight = len(sub(t.Tf, t.A1));     // straight exit segment A1→Tf
    return straight + arc;
  };
  const stripLen = rawCordLen + segLen(tailS) + segLen(tailE);
  const measureBackStart = segLen(tailS);
  const measureBackEnd   = segLen(tailE);

  // Guard: cordLen can never exceed stripLen (always true since stripLen = rawCord + segs).
  const cordLen = Math.min(rawCordLen, stripLen);

  return { stripLen, cordLen, measureBackStart, measureBackEnd, tailS, tailE };
}
