/* =====================================================================
   geometryOffset.js — curve-aware per-side path offset
   Relocated from curved-panel-core.js (Pass 11).

   Self-contained (no imports from curved-panel-core.js) to avoid
   circular dependencies. Small primitive helpers are defined locally;
   they are intentionally NOT the same instances as the core's copies.
   ===================================================================== */

const _SIDE_ORDER = ["top", "right", "bottom", "left"];

function _dist(a, b){ return Math.hypot(b.x - a.x, b.y - a.y); }
function _unit(x, y){ const l = Math.hypot(x, y) || 1e-9; return { x: x/l, y: y/l }; }
const _crossZ = (d, p, o) => d.x*(p.y - o.y) - d.y*(p.x - o.x);

function _lineIntersect(p1, d1, p2, d2){
  const den = d1.x*d2.y - d1.y*d2.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p2.x - p1.x)*d2.y - (p2.y - p1.y)*d2.x) / den;
  return { x: p1.x + d1.x*t, y: p1.y + d1.y*t };
}

function _dedupe(pts, closed = true){
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++){
    if (_dist(out[out.length - 1], pts[i]) > 1e-6) out.push(pts[i]);
  }
  if (closed){
    while (out.length > 1 && _dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
  }
  return out;
}

function _offsetOpen(pts, d){
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++){
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const u = _unit(b.x - a.x, b.y - a.y);
    out.push({ x: pts[i].x - u.y*d, y: pts[i].y + u.x*d, side: pts[i].side });
  }
  return out;
}

/* Returns true only for proper interior crossings — no endpoint coincidences. */
function _segsProperCross(a, b, c, d){
  const d1x = b.x - a.x, d1y = b.y - a.y;
  const d2x = d.x - c.x, d2y = d.y - c.y;
  const cross = d1x*d2y - d1y*d2x;
  if (Math.abs(cross) < 1e-12) return false;
  const t = ((c.x - a.x)*d2y - (c.y - a.y)*d2x) / cross;
  const u = ((c.x - a.x)*d1y - (c.y - a.y)*d1x) / cross;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}

/* Collapse self-crossings within a forward window of 5 segments.
   Handles fold artifacts from step-size ratio jumps at arc/edge junctions
   (e.g. the 50× step-size drop where trimPolyline lands close to a sample). */
function _removeLocalLoops(pts){
  const out = [...pts];
  let i = 0;
  while (i < out.length - 3){
    let fixed = false;
    for (let j = i + 2; j <= Math.min(i + 5, out.length - 2); j++){
      if (!_segsProperCross(out[i], out[i + 1], out[j], out[j + 1])) continue;
      const ta = _unit(out[i + 1].x - out[i].x, out[i + 1].y - out[i].y);
      const tb = _unit(out[j + 1].x - out[j].x, out[j + 1].y - out[j].y);
      const X = _lineIntersect(out[i], ta, out[j], tb);
      if (!X || !isFinite(X.x) || !isFinite(X.y)) break;
      out.splice(i + 1, j - i, { x: X.x, y: X.y, side: out[i + 1].side });
      fixed = true;
      break;
    }
    if (!fixed) i++;
  }
  return out;
}

function _joinOffsetPair(A, B){
  if (A.length < 2 || B.length < 2) return;
  const a0 = A[A.length - 1], b0 = B[0];
  const ta = _unit(a0.x - A[A.length - 2].x, a0.y - A[A.length - 2].y);
  const tb = _unit(B[1].x - b0.x, B[1].y - b0.y);
  const den = ta.x*tb.y - ta.y*tb.x;
  if (Math.abs(den) < 1e-5 && ta.x*tb.x + ta.y*tb.y > 0.98){
    const M = { x: (a0.x + b0.x)/2, y: (a0.y + b0.y)/2 };
    A[A.length - 1] = { ...M, side: A[A.length - 1].side };
    B[0] = { ...M, side: B[0].side };
    return;
  }
  const X = _lineIntersect(a0, ta, b0, tb);
  if (!X) return;
  const refA = Math.sign(_crossZ(tb, A[Math.floor(A.length/2)], b0)) || 1;
  while (A.length > 2 && Math.sign(_crossZ(tb, A[A.length - 1], b0)) !== refA) A.pop();
  const refB = Math.sign(_crossZ(ta, B[Math.floor(B.length/2)], a0)) || 1;
  while (B.length > 2 && Math.sign(_crossZ(ta, B[0], a0)) !== refB) B.shift();
  if (_dist(A[A.length - 1], X) > 1e-7) A.push({ ...X, side: A[A.length - 1].side });
  else A[A.length - 1] = { ...X, side: A[A.length - 1].side };
  if (_dist(B[0], X) > 1e-7) B.unshift({ ...X, side: B[0].side });
  else B[0] = { ...X, side: B[0].side };
}

/* Per-side curve-aware inward offset with miter joins at corners.
   This is the same algorithm curved-panel-core.js uses for the sewline.
   Pass any positive inset distance — not limited to SA. */
export function offsetSidePaths(sidePaths, inset){
  const out = {};
  for (const side of _SIDE_ORDER){
    let pts = _offsetOpen(sidePaths[side] || [], inset);
    pts = _removeLocalLoops(pts);
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

/* Join all four sides into one closed (or open) point array. */
export function joinAllSides(sidePaths, closed = true){
  const out = [];
  for (const side of _SIDE_ORDER){
    const path = sidePaths[side] || [];
    for (let i = 0; i < path.length; i++){
      if (out.length && i === 0 && _dist(out[out.length - 1], path[i]) < 1e-7) continue;
      out.push({ ...path[i], side });
    }
  }
  if (closed && out.length > 1 && _dist(out[0], out[out.length - 1]) < 1e-7) out.pop();
  return out;
}
