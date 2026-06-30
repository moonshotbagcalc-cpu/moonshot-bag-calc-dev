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
  add, sub, mul, dot, unitV,
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
