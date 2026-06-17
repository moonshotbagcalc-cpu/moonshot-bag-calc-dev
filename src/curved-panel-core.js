/* =====================================================================
   GEOMETRY CORE — keep this block portable; it is what we lift into the
   Moonshot JSX later. All units are inches. SVG-style coords (y down).
   Winding is clockwise: top → right → bottom → left.
   ===================================================================== */

const FEEL_ALPHA = { gentle: 0.32, balanced: 0.40, defined: 0.48 };
const EDGE_SAMPLES = 160;
const CORNER_SAMPLES = 64;

function dist(a, b){ return Math.hypot(b.x - a.x, b.y - a.y); }

/* Crowned edge as a symmetric cubic. Midpoint bulge == h exactly
   (normal offset of controls = 4h/3 → curve midpoint = 0.75 · 4h/3 = h). */
function sampleEdge(A, B, h, alpha, side){
  const dx = B.x - A.x, dy = B.y - A.y;
  const len = Math.hypot(dx, dy);
  const ux = dx/len, uy = dy/len;
  const nx = uy, ny = -ux;            // outward normal (clockwise, y-down)
  const pts = [];
  if (h <= 1e-6){
    for (let i = 0; i <= EDGE_SAMPLES; i++){
      const t = i / EDGE_SAMPLES;
      pts.push({ x: A.x + dx*t, y: A.y + dy*t, side });
    }
    return pts;
  }
  const beta = (4/3) * h;
  const c1 = { x: A.x + dx*alpha + nx*beta, y: A.y + dy*alpha + ny*beta };
  const c2 = { x: B.x - dx*alpha + nx*beta, y: B.y - dy*alpha + ny*beta };
  for (let i = 0; i <= EDGE_SAMPLES; i++){
    const t = i / EDGE_SAMPLES, m = 1 - t;
    pts.push({
      x: m*m*m*A.x + 3*m*m*t*c1.x + 3*m*t*t*c2.x + t*t*t*B.x,
      y: m*m*m*A.y + 3*m*m*t*c1.y + 3*m*t*t*c2.y + t*t*t*B.y,
      side
    });
  }
  return pts;
}

function polylineLength(pts, closed){
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i-1], pts[i]);
  if (closed) L += dist(pts[pts.length-1], pts[0]);
  return L;
}

/* Trim a polyline by arc length from each end; returns points + end tangents. */
function trimPolyline(pts, dStart, dEnd){
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i-1] + dist(pts[i-1], pts[i]));
  const total = cum[cum.length - 1];
  dStart = Math.max(0, Math.min(dStart, total * 0.49));
  dEnd   = Math.max(0, Math.min(dEnd,   total * 0.49));
  const tA = dStart, tB = total - dEnd;

  function pointAt(s){
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i-1] || 1e-9;
    const f = (s - cum[i-1]) / seg;
    const a = pts[i-1], b = pts[i];
    return { p: { x: a.x + (b.x-a.x)*f, y: a.y + (b.y-a.y)*f, side: a.side }, i };
  }
  const A = pointAt(tA), B = pointAt(tB);
  let out = [A.p];
  for (let i = A.i; i < B.i; i++) out.push(pts[i]);
  out.push(B.p);
  out = dedupe(out, false);     // exact-on-sample trims create duplicates

  const n = out.length;
  const tanStart = unit(out[1].x - out[0].x, out[1].y - out[0].y);
  const tanEnd = unit(out[n-1].x - out[n-2].x, out[n-1].y - out[n-2].y);
  return { pts: out, tanStart, tanEnd };
}

function unit(x, y){
  const l = Math.hypot(x, y) || 1e-9;
  return { x: x/l, y: y/l };
}

/* Fair tangent corner blend: a cubic that meets both trimmed edge ends with
   matching tangents, with handle lengths chosen to approximate a circular
   arc of the corner's turn angle (G1, near-G2 in practice). */
function cornerBlend(P, tP, Q, tQ, sideA, sideB){
  const chord = dist(P, Q);
  const cosT = Math.max(-1, Math.min(1, tP.x*tQ.x + tP.y*tQ.y));
  const turn = Math.acos(cosT);
  let L;
  if (turn > 1e-3 && Math.sin(turn/2) > 1e-6){
    const R = chord / (2 * Math.sin(turn/2));
    L = (4/3) * Math.tan(turn/4) * R;
  } else {
    L = chord * 0.39;
  }
  L = Math.min(L, chord * 0.6);
  const c1 = { x: P.x + tP.x*L, y: P.y + tP.y*L };
  const c2 = { x: Q.x - tQ.x*L, y: Q.y - tQ.y*L };
  const pts = [];
  for (let i = 1; i < CORNER_SAMPLES; i++){
    const t = i / CORNER_SAMPLES, m = 1 - t;
    pts.push({
      x: m*m*m*P.x + 3*m*m*t*c1.x + 3*m*t*t*c2.x + t*t*t*Q.x,
      y: m*m*m*P.y + 3*m*m*t*c1.y + 3*m*t*t*c2.y + t*t*t*Q.y,
      side: (t < 0.5 ? sideA : sideB)
    });
  }
  return pts;
}

/* Remove near-duplicate consecutive points (protects offset math). */
function dedupe(pts, closed = true){
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++){
    if (dist(out[out.length-1], pts[i]) > 1e-6) out.push(pts[i]);
  }
  if (closed){
    while (out.length > 1 && dist(out[0], out[out.length-1]) < 1e-6) out.pop();
  }
  return out;
}

/* Inward offset of a closed clockwise polyline, with miter joins so sharp
   corners land exactly at the intersection of the adjacent offset edges.
   Inward normal for a clockwise (y-down) segment direction u is (-u.y, u.x). */
function offsetInward(pts, d){
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++){
    const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
    const u1 = unit(pts[i].x - prev.x, pts[i].y - prev.y);
    const u2 = unit(next.x - pts[i].x, next.y - pts[i].y);
    const n1 = { x: -u1.y, y: u1.x };
    const n2 = { x: -u2.y, y: u2.x };
    const m = unit(n1.x + n2.x, n1.y + n2.y);
    const cosHalf = Math.max(0.35, m.x*n1.x + m.y*n1.y);  // miter limit
    const len = d / cosHalf;
    out.push({ x: pts[i].x + m.x*len, y: pts[i].y + m.y*len, side: pts[i].side });
  }
  return out;
}

/* Detect local collapse: an offset segment reversing direction vs. source. */
function offsetCollapsed(src, off){
  const n = src.length;
  for (let i = 0; i < n; i++){
    const j = (i + 1) % n;
    const sx = src[j].x - src[i].x, sy = src[j].y - src[i].y;
    if (sx*sx + sy*sy < 1e-4) continue; // skip degenerate junction segments (< 0.01")
    const ox = off[j].x - off[i].x, oy = off[j].y - off[i].y;
    if (sx*ox + sy*oy < 0) return true;
  }
  return false;
}

/* Inward offset of an OPEN polyline (one edge), one-sided tangents at ends. */
function offsetOpen(pts, d){
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++){
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const u = unit(b.x - a.x, b.y - a.y);
    out.push({ x: pts[i].x - u.y*d, y: pts[i].y + u.x*d, side: pts[i].side });
  }
  return out;
}

function lineIntersect(p1, d1, p2, d2){
  const den = d1.x*d2.y - d1.y*d2.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p2.x - p1.x)*d2.y - (p2.y - p1.y)*d2.x) / den;
  return { x: p1.x + d1.x*t, y: p1.y + d1.y*t };
}

const crossZ = (d, p, o) => d.x*(p.y - o.y) - d.y*(p.x - o.x);

/* Miter-join two inward-offset edge polylines at a convex corner:
   clip the overlap past each other's line, insert the exact intersection. */
function joinMiter(A, B){
  const endTan = unit(A[A.length-1].x - A[A.length-2].x, A[A.length-1].y - A[A.length-2].y);
  const startTan = unit(B[1].x - B[0].x, B[1].y - B[0].y);
  const aEnd0 = A[A.length-1], bStart0 = B[0];
  const X = lineIntersect(aEnd0, endTan, bStart0, startTan);
  if (!X) return;                                  // collinear — nothing to trim
  // valid side reference taken mid-edge, away from the corner
  const refA = Math.sign(crossZ(startTan, A[Math.floor(A.length/2)], bStart0)) || 1;
  while (A.length > 2 && Math.sign(crossZ(startTan, A[A.length-1], bStart0)) !== refA) A.pop();
  const refB = Math.sign(crossZ(endTan, B[Math.floor(B.length/2)], aEnd0)) || 1;
  while (B.length > 2 && Math.sign(crossZ(endTan, B[0], aEnd0)) !== refB) B.shift();
  A.push({ x: X.x, y: X.y, side: aEnd0.side });
}

function bbox(pts){
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const p of pts){
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function sideRuns(pts){
  const runs = { top: 0, right: 0, bottom: 0, left: 0 };
  const n = pts.length;
  for (let i = 0; i < n; i++){
    const j = (i + 1) % n;
    const d = dist(pts[i], pts[j]);
    if (pts[i].side === pts[j].side){
      runs[pts[i].side] += d;
    } else {
      // segment bridges a side transition — half to each side
      runs[pts[i].side] += d / 2;
      runs[pts[j].side] += d / 2;
    }
  }
  return runs;
}

/* Ray (origin, dir) vs polyline: nearest forward intersection or null. */
function rayPolylineHit(origin, dir, poly){
  let best = null, bestT = Infinity;
  for (let i = 0; i < poly.length - 1; i++){
    const a = poly[i], b = poly[i+1];
    const sx = b.x - a.x, sy = b.y - a.y;
    const den = dir.x * sy - dir.y * sx;
    if (Math.abs(den) < 1e-12) continue;
    const qx = a.x - origin.x, qy = a.y - origin.y;
    const t = (qx * sy - qy * sx) / den;          // along ray
    const u = (qx * dir.y - qy * dir.x) / den;    // along segment
    if (t >= -1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && t < bestT){
      bestT = t;
      best = { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
    }
  }
  return best;
}

/* Open-top sewline: offset the right→bottom→left run of the cut path
   inward by SA, then extend both ends along their tangents until they
   intersect the TOP cut edge (the raw edge). This is how seams terminate
   at an open edge — the stitch line runs out to the raw cut edge.
   Returns { pts, runs:{left,bottom,right}, total }. */
function buildOpenSewline(cutPts, sa, botCrisp){
  const n = cutPts.length;

  // contiguous top run (wrap-safe)
  let topStart = -1;
  for (let i = 0; i < n; i++){
    if (cutPts[i].side === "top" && cutPts[(i - 1 + n) % n].side !== "top"){ topStart = i; break; }
  }
  if (topStart < 0) return null;
  const topPts = [];
  for (let k = 0; k < n; k++){
    const idx = (topStart + k) % n;
    if (cutPts[idx].side !== "top") break;
    topPts.push(cutPts[idx]);
  }

  // non-top run: right → bottom → left, contiguous after the top run
  const rest = [];
  for (let k = 0; k < n - topPts.length; k++){
    rest.push(cutPts[(topStart + topPts.length + k) % n]);
  }

  let off;
  if (botCrisp){
    // per-edge offset + miter joins at the crisp bottom corners
    const groups = [];
    let cur = [rest[0]];
    for (let i = 1; i < rest.length; i++){
      if (rest[i].side === cur[0].side) cur.push(rest[i]);
      else { groups.push(cur); cur = [rest[i]]; }
    }
    groups.push(cur);
    const offs = groups.map(g => offsetOpen(g, sa));
    off = offs[0];
    for (let i = 1; i < offs.length; i++){
      joinMiter(off, offs[i]);
      off = off.concat(offs[i]);
    }
  } else {
    off = offsetOpen(rest, sa); // smooth everywhere — single-pass offset is fair
  }
  off = dedupe(off, false);

  // extend start (top of right side) up to the raw top edge
  const t0 = unit(off[1].x - off[0].x, off[1].y - off[0].y);
  const hitS = rayPolylineHit(off[0], { x: -t0.x, y: -t0.y }, topPts);
  if (hitS) off.unshift({ x: hitS.x, y: hitS.y, side: off[0].side });

  // extend end (top of left side) up to the raw top edge
  const m = off.length;
  const tE = unit(off[m-1].x - off[m-2].x, off[m-1].y - off[m-2].y);
  const hitE = rayPolylineHit(off[m-1], tE, topPts);
  if (hitE) off.push({ x: hitE.x, y: hitE.y, side: off[m-1].side });

  // per-side runs on the open polyline (extensions count toward L/R);
  // segments bridging a side transition split half to each side
  const runs = { right: 0, bottom: 0, left: 0 };
  for (let i = 0; i < off.length - 1; i++){
    const d = dist(off[i], off[i+1]);
    const sA = off[i].side, sB = off[i+1].side;
    if (sA === sB){
      if (runs[sA] !== undefined) runs[sA] += d;
    } else {
      if (runs[sA] !== undefined) runs[sA] += d / 2;
      if (runs[sB] !== undefined) runs[sB] += d / 2;
    }
  }
  return { pts: off, runs, total: runs.left + runs.bottom + runs.right };
}

/* Return corner junctions (where side tag changes) and edge midpoints
   (arc-length midpoint within each side) on the sewline.
   
   The sewline is a closed polygon. The top side (and potentially others)
   wraps around the end/start of the array, so we must handle that. */
function sewLandmarks(pts){
  const n = pts.length;
  const sides = ['top','right','bottom','left'];
  const junctions = [];
  const midpoints = [];

  // junction = first point of each new side (where tag changes)
  for (let i = 0; i < n; i++){
    if (pts[i].side !== pts[(i - 1 + n) % n].side) junctions.push(pts[i]);
  }

  for (const side of sides){
    // find start index: first point tagged to this side after a transition from another
    let startIdx = -1;
    for (let i = 0; i < n; i++){
      if (pts[i].side === side && pts[(i - 1 + n) % n].side !== side){
        startIdx = i; break;
      }
    }
    if (startIdx < 0) continue; // side not present

    // walk forward collecting consecutive points tagged to this side (wrap-safe)
    const sidePts = [];
    for (let k = 0; k < n; k++){
      const idx = (startIdx + k) % n;
      if (pts[idx].side !== side) break;
      sidePts.push(pts[idx]);
    }
    if (sidePts.length < 2) continue;

    // arc-length midpoint
    let cumL = 0;
    const segs = [];
    for (let k = 0; k < sidePts.length - 1; k++){
      const d = dist(sidePts[k], sidePts[k+1]);
      segs.push({ a: sidePts[k], b: sidePts[k+1], d, cum: cumL });
      cumL += d;
    }
    if (!segs.length || cumL < 1e-9) continue;
    const half = cumL / 2;
    for (const s of segs){
      if (s.cum + s.d >= half - 1e-9){
        const f = s.d > 1e-9 ? Math.min(1, (half - s.cum) / s.d) : 0;
        midpoints.push({ x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f });
        break;
      }
    }
  }

  return { junctions, midpoints };
}

/* Extract one side's contiguous run from a tagged polyline.
   For OPEN polylines (open sewline) pass closed=false. */
function extractSideRun(pts, side, closed){
  const n = pts.length;
  if (closed){
    let start = -1;
    for (let i = 0; i < n; i++){
      if (pts[i].side === side && pts[(i - 1 + n) % n].side !== side){ start = i; break; }
    }
    if (start < 0) return [];
    const run = [];
    for (let k = 0; k < n; k++){
      const idx = (start + k) % n;
      if (pts[idx].side !== side) break;
      run.push(pts[idx]);
    }
    return run;
  }
  return pts.filter(q => q.side === side);
}

/* Notch/clip positions for a strip matching one sewline run.
   Options protect seam ends and match marks from collisions:
   { keepOutStart, keepOutEnd, reserved:[arc positions], reserveRadius, maxMarks }.
   Returns { marks:[{s,kind}], len }. */
function notchPlan(run, options = {}){
  const n = run.length;
  if (n < 3) return { marks: [], len: n > 1 ? polylineLength(run, false) : 0 };
  const s = [0];
  for (let i = 1; i < n; i++) s.push(s[i-1] + dist(run[i-1], run[i]));
  const len = s[n-1];
  const radius = new Array(n).fill(Infinity);
  for (let i = 1; i < n - 1; i++){
    const a = run[i-1], b = run[i], c = run[i+1];
    const ab = dist(a,b), bc = dist(b,c), ca = dist(c,a);
    const area2 = Math.abs((b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x));
    if (area2 > 1e-12) radius[i] = (ab*bc*ca) / (2*area2);
  }
  function spacing(r){
    if (r >= 50)  return Infinity;
    if (r <= 1.5) return 0.375;
    if (r >= 10)  return 2.0;
    return 0.375 + (r - 1.5) / 8.5 * 1.625;
  }
  const keepStart = Math.max(0, options.keepOutStart || 0);
  const keepEnd = Math.max(0, options.keepOutEnd || 0);
  const reserved = Array.isArray(options.reserved) ? options.reserved : [];
  const reserveRadius = Math.max(0.2, options.reserveRadius || 0.35);
  const maxMarks = Math.max(1, options.maxMarks || 48);
  const candidates = [];
  let lastMark = -Infinity;
  for (let i = 1; i < n - 1; i++){
    const pos = s[i];
    const sp = spacing(radius[i]);
    if (!isFinite(sp)) continue;
    if (pos < keepStart - 1e-9 || pos > len - keepEnd + 1e-9) continue;
    if (reserved.some(r => Math.abs(pos - r) < reserveRadius)) continue;
    if (pos - lastMark >= sp - 1e-6){
      candidates.push({ s: pos, kind: radius[i] < 1.5 ? "clip" : "notch", radius: radius[i] });
      lastMark = pos;
    }
  }
  if (candidates.length <= maxMarks) return { marks: candidates, len };
  const step = (candidates.length - 1) / (maxMarks - 1);
  const marks = [];
  for (let i = 0; i < maxMarks; i++) marks.push(candidates[Math.round(i * step)]);
  return { marks, len };
}

/* Landmark arc positions along a full sewline path (closed or open):
   corner junctions + per-side midpoints, measured from the path start.
   Used to transfer match points onto the gusset strip. */
function pathLandmarkPositions(pts, closed){
  const n = pts.length;
  const lim = closed ? n : n - 1;
  const s = [0];
  for (let i = 1; i < n; i++) s.push(s[i-1] + dist(pts[i-1], pts[i]));
  const total = closed ? s[n-1] + dist(pts[n-1], pts[0]) : s[n-1];
  const out = [];
  // junctions: where side tag changes
  for (let i = 1; i < n; i++){
    if (pts[i].side !== pts[i-1].side){
      out.push({ s: s[i], kind: "junction", label: pts[i-1].side + "/" + pts[i].side });
    }
  }
  // midpoints: arc midpoint of each side's contiguous span within this path
  let spanStart = 0;
  for (let i = 1; i <= n; i++){
    if (i === n || pts[i].side !== pts[spanStart].side){
      const mid = (s[spanStart] + s[i-1]) / 2;
      if (s[i-1] - s[spanStart] > 0.5) // skip slivers
        out.push({ s: mid, kind: "mid", label: pts[spanStart].side + " midpoint" });
      if (i < n) spanStart = i;
    }
  }
  out.sort((a,b) => a.s - b.s);
  return { landmarks: out, total };
}

/* ============ TRUSTED GEOMETRY MODEL ============ */

const SIDE_ORDER = ["top","right","bottom","left"];

function signedArea(pts){
  let a = 0;
  for (let i = 0; i < pts.length; i++){
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
}

function orientation(a,b,c){
  return (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
}

function onSegment(a,b,p,eps=1e-8){
  return Math.abs(orientation(a,b,p)) <= eps &&
    p.x >= Math.min(a.x,b.x)-eps && p.x <= Math.max(a.x,b.x)+eps &&
    p.y >= Math.min(a.y,b.y)-eps && p.y <= Math.max(a.y,b.y)+eps;
}

function segmentsIntersect(a,b,c,d,includeTouch=true){
  const eps = 1e-9;
  const o1 = orientation(a,b,c), o2 = orientation(a,b,d);
  const o3 = orientation(c,d,a), o4 = orientation(c,d,b);
  if (((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) &&
      ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))) return true;
  if (!includeTouch) return false;
  return (Math.abs(o1)<=eps && onSegment(a,b,c)) ||
         (Math.abs(o2)<=eps && onSegment(a,b,d)) ||
         (Math.abs(o3)<=eps && onSegment(c,d,a)) ||
         (Math.abs(o4)<=eps && onSegment(c,d,b));
}

function selfIntersections(pts, closed=true){
  const hits = [];
  const segCount = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segCount; i++){
    const i2 = (i + 1) % pts.length;
    const a = pts[i], b = pts[i2];
    if (dist(a,b) < 1e-8) continue;
    for (let j = i + 1; j < segCount; j++){
      const j2 = (j + 1) % pts.length;
      if (j === i || j === i + 1) continue;
      if (closed && i === 0 && j2 === 0) continue;
      const c = pts[j], d = pts[j2];
      if (dist(c,d) < 1e-8) continue;
      if (segmentsIntersect(a,b,c,d,true)) hits.push({i,j});
    }
  }
  return hits;
}

function pointInPolygon(p, poly){
  for (let i = 0; i < poly.length; i++){
    if (onSegment(poly[i], poly[(i+1)%poly.length], p, 1e-7)) return true;
  }
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    const crosses = ((a.y > p.y) !== (b.y > p.y)) &&
      (p.x < (b.x-a.x) * (p.y-a.y) / ((b.y-a.y) || 1e-12) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

function finitePolyline(pts){
  return pts.length >= 2 && pts.every(p => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function sampleCornerBlend(P, tP, Q, tQ, sideA, sideB){
  if (dist(P,Q) < 1e-8){
    const p = {x:P.x,y:P.y,side:sideA};
    return { first:[p], second:[{x:Q.x,y:Q.y,side:sideB}], midpoint:p };
  }
  const chord = dist(P, Q);
  const cosT = Math.max(-1, Math.min(1, tP.x*tQ.x + tP.y*tQ.y));
  const turn = Math.acos(cosT);
  let L;
  if (turn > 1e-3 && Math.sin(turn/2) > 1e-6){
    const R = chord / (2 * Math.sin(turn/2));
    L = (4/3) * Math.tan(turn/4) * R;
  } else L = chord * 0.39;
  L = Math.min(L, chord * 0.6);
  const c1 = { x:P.x+tP.x*L, y:P.y+tP.y*L };
  const c2 = { x:Q.x-tQ.x*L, y:Q.y-tQ.y*L };
  const pts = [];
  for (let i = 0; i <= CORNER_SAMPLES; i++){
    const t = i/CORNER_SAMPLES, m = 1-t;
    pts.push({
      x:m*m*m*P.x + 3*m*m*t*c1.x + 3*m*t*t*c2.x + t*t*t*Q.x,
      y:m*m*m*P.y + 3*m*m*t*c1.y + 3*m*t*t*c2.y + t*t*t*Q.y,
      side:t <= 0.5 ? sideA : sideB
    });
  }
  const mid = CORNER_SAMPLES/2;
  return {
    first: pts.slice(0, mid+1).map(p=>({...p,side:sideA})),
    second: pts.slice(mid).map(p=>({...p,side:sideB})),
    midpoint: pts[mid]
  };
}

function joinPathParts(parts, side){
  let out = [];
  for (const part of parts){
    for (const p of part){
      const q = {x:p.x,y:p.y,side};
      if (!out.length || dist(out[out.length-1],q) > 1e-7) out.push(q);
    }
  }
  return out;
}

function buildClosedPathFromSides(sidePaths){
  const pts = [];
  const ranges = {};
  for (let si = 0; si < SIDE_ORDER.length; si++){
    const side = SIDE_ORDER[si];
    const path = sidePaths[side];
    if (!pts.length){
      path.forEach(p=>pts.push({...p,side}));
      ranges[side] = {start:0,end:pts.length-1,wrap:false};
    } else {
      const start = pts.length - 1;
      for (let i = 1; i < path.length; i++) pts.push({...path[i],side});
      ranges[side] = {start,end:pts.length-1,wrap:false};
    }
  }
  if (pts.length > 2 && dist(pts[pts.length-1],pts[0]) < 1e-7){
    pts.pop();
    ranges.left.end = 0;
    ranges.left.wrap = true;
  }
  return { pts:dedupe(pts), ranges };
}

function pathFromRange(pts, range, side){
  let out;
  if (!range.wrap) out = pts.slice(range.start, range.end+1);
  else out = pts.slice(range.start).concat([pts[range.end]]);
  return out.map(p=>({...p,side}));
}

function sidePathMap(pts, ranges){
  const out = {};
  for (const side of SIDE_ORDER) out[side] = pathFromRange(pts,ranges[side],side);
  return out;
}

function sideLengths(sidePaths){
  const out = {};
  for (const side of SIDE_ORDER) out[side] = polylineLength(sidePaths[side], false);
  return out;
}

function joinOffsetPair(A,B){
  if (A.length<2||B.length<2) return;
  const a0=A[A.length-1], b0=B[0];
  const ta=unit(a0.x-A[A.length-2].x,a0.y-A[A.length-2].y);
  const tb=unit(B[1].x-b0.x,B[1].y-b0.y);
  const den=ta.x*tb.y-ta.y*tb.x;
  if (Math.abs(den)<1e-5 && ta.x*tb.x+ta.y*tb.y>0.98){
    const M={x:(a0.x+b0.x)/2,y:(a0.y+b0.y)/2};
    A[A.length-1]={...M,side:A[A.length-1].side};
    B[0]={...M,side:B[0].side};
    return;
  }
  const X=lineIntersect(a0,ta,b0,tb);
  if (!X) return;
  const refA=Math.sign(crossZ(tb,A[Math.floor(A.length/2)],b0))||1;
  while(A.length>2&&Math.sign(crossZ(tb,A[A.length-1],b0))!==refA)A.pop();
  const refB=Math.sign(crossZ(ta,B[Math.floor(B.length/2)],a0))||1;
  while(B.length>2&&Math.sign(crossZ(ta,B[0],a0))!==refB)B.shift();
  if(dist(A[A.length-1],X)>1e-7)A.push({...X,side:A[A.length-1].side});
  else A[A.length-1]={...X,side:A[A.length-1].side};
  if(dist(B[0],X)>1e-7)B.unshift({...X,side:B[0].side});
  else B[0]={...X,side:B[0].side};
}

function offsetSidePaths(cutSides,sa){
  const out={};
  for(const side of SIDE_ORDER)out[side]=offsetOpen(cutSides[side],sa);
  joinOffsetPair(out.top,out.right);
  joinOffsetPair(out.right,out.bottom);
  joinOffsetPair(out.bottom,out.left);
  joinOffsetPair(out.left,out.top);
  for(const side of SIDE_ORDER)out[side]=dedupe(out[side],false).map(q=>({...q,side}));
  return out;
}

function pathPointAt(pts, s){
  if (!pts.length) return null;
  if (s <= 0) return {...pts[0]};
  let acc = 0;
  for (let i = 1; i < pts.length; i++){
    const d = dist(pts[i-1],pts[i]);
    if (acc + d >= s - 1e-9){
      const f = d > 1e-9 ? Math.max(0,Math.min(1,(s-acc)/d)) : 0;
      return {x:pts[i-1].x+(pts[i].x-pts[i-1].x)*f,
              y:pts[i-1].y+(pts[i].y-pts[i-1].y)*f,
              side:pts[i-1].side};
    }
    acc += d;
  }
  return {...pts[pts.length-1]};
}

function combineSidePaths(sidePaths, order, closed=false){
  const out = [];
  for (const side of order){
    const path = sidePaths[side] || [];
    for (let i = 0; i < path.length; i++){
      if (out.length && i === 0 && dist(out[out.length-1],path[i]) < 1e-7) continue;
      out.push({...path[i],side});
    }
  }
  if (closed && out.length > 1 && dist(out[0],out[out.length-1]) < 1e-7) out.pop();
  return out;
}

function landmarksForSidePaths(sidePaths, order, closed){
  const junctions = [], midpoints = [], positions = [];
  let acc = 0;
  if (closed && order.length){
    positions.push({s:0,kind:"junction",label:order[order.length-1]+"/"+order[0]});
  }
  for (let i = 0; i < order.length; i++){
    const side = order[i], path = sidePaths[side];
    const len = polylineLength(path,false);
    const mp = pathPointAt(path,len/2);
    if (mp){
      midpoints.push(mp);
      positions.push({s:acc+len/2,kind:"mid",label:side+" midpoint"});
    }
    acc += len;
    if (i < order.length-1){
      const jp = path[path.length-1];
      junctions.push({...jp});
      positions.push({s:acc,kind:"junction",label:side+"/"+order[i+1]});
    }
  }
  if (closed && order.length){
    const lastPath = sidePaths[order[order.length-1]];
    junctions.push({...lastPath[lastPath.length-1]});
  }
  positions.sort((a,b)=>a.s-b.s);
  return {junctions,midpoints,landmarks:positions,total:acc};
}

function validateClosedOffset(cutPts,sewPts){
  const errors = [];
  if (!finitePolyline(sewPts)) errors.push("The sewline contains invalid points.");
  if (selfIntersections(sewPts,true).length) errors.push("The seam allowance causes the sewline to cross itself.");
  if (signedArea(cutPts) * signedArea(sewPts) <= 0) errors.push("The sewline reversed direction.");
  const outside = sewPts.some(p=>!pointInPolygon(p,cutPts));
  if (outside) errors.push("Part of the sewline falls outside the cut path.");
  const bb = bbox(sewPts);
  if (bb.w < 1e-5 || bb.h < 1e-5) errors.push("The seam allowance collapses the usable panel area.");
  return {valid:errors.length===0,errors};
}

function buildOpenTopSewline(cutSides,sewSides){
  const right = sewSides.right.map(p=>({...p,side:"right"}));
  const bottom = sewSides.bottom.map(p=>({...p,side:"bottom"}));
  const left = sewSides.left.map(p=>({...p,side:"left"}));
  const topCut = cutSides.top;
  const errors = [];
  if (right.length < 2 || bottom.length < 2 || left.length < 2){
    return {pts:[],sidePaths:{right:[],bottom:[],left:[]},runs:{right:0,bottom:0,left:0},total:0,
      bb:{minX:0,minY:0,maxX:0,maxY:0,w:0,h:0},valid:false,errors:["Open-top sewline could not be constructed."]};
  }
  const t0 = unit(right[1].x-right[0].x,right[1].y-right[0].y);
  const hitR = rayPolylineHit(right[0],{x:-t0.x,y:-t0.y},topCut);
  if (hitR) right.unshift({...hitR,side:"right"});
  else errors.push("The right sewline could not reach the raw top edge.");

  const n = left.length;
  const tE = unit(left[n-1].x-left[n-2].x,left[n-1].y-left[n-2].y);
  const hitL = rayPolylineHit(left[n-1],tE,topCut);
  if (hitL) left.push({...hitL,side:"left"});
  else errors.push("The left sewline could not reach the raw top edge.");

  const sidePaths = {right,bottom,left};
  const pts = combineSidePaths(sidePaths,["right","bottom","left"],false);
  if (selfIntersections(pts,false).length) errors.push("The open-top sewline crosses itself.");
  const cutClosed = combineSidePaths(cutSides,SIDE_ORDER,true);
  if (pts.some(p=>!pointInPolygon(p,cutClosed))) errors.push("Part of the open-top sewline falls outside the cut path.");
  const runs = {
    right:polylineLength(right,false),
    bottom:polylineLength(bottom,false),
    left:polylineLength(left,false)
  };
  const lms = landmarksForSidePaths(sidePaths,["right","bottom","left"],false);
  return {
    pts,sidePaths,runs,total:runs.right+runs.bottom+runs.left,
    bb:bbox(pts),valid:errors.length===0,errors,
    junctions:lms.junctions,midpoints:lms.midpoints,landmarks:lms.landmarks
  };
}

function normalizedRunSignature(path, samples=25){
  const len = polylineLength(path,false);
  if (len < 1e-9) return [];
  const a = path[0], b = path[path.length-1];
  const ux = (b.x-a.x)/Math.max(dist(a,b),1e-9);
  const uy = (b.y-a.y)/Math.max(dist(a,b),1e-9);
  const nx = -uy, ny = ux;
  const out = [];
  for (let i = 0; i <= samples; i++){
    const p = pathPointAt(path,len*i/samples);
    const dx=p.x-a.x, dy=p.y-a.y;
    out.push({along:(dx*ux+dy*uy)/len,normal:(dx*nx+dy*ny)/len});
  }
  return out;
}

function runsEquivalent(a,b,tol=0.0025){
  if (Math.abs(polylineLength(a,false)-polylineLength(b,false)) > 1/32) return false;
  const A=normalizedRunSignature(a), B=normalizedRunSignature(b);
  if (A.length!==B.length) return false;
  let direct=0, mirrored=0;
  for (let i=0;i<A.length;i++){
    direct=Math.max(direct,Math.abs(A[i].normal-B[i].normal));
    mirrored=Math.max(mirrored,Math.abs(A[i].normal+B[i].normal));
  }
  return Math.min(direct,mirrored) <= tol;
}

function buildStripPiece(side,path,p,startAllowance,endAllowance,label){
  const runLength = polylineLength(path,false);
  let depth = p.sideDepth;
  let cutWidthTop, cutWidthBottom, finishedWidthTop, finishedWidthBottom;
  if (p.sideTaper) {
    if (side === "top") {
      depth = p.depthTop;
    } else if (side === "bottom") {
      depth = p.depthBottom;
    } else {
      // left and right span the full bag height; both paths run top→bottom after left reversal
      finishedWidthTop = p.depthTop; finishedWidthBottom = p.depthBottom;
      cutWidthTop = p.depthTop + 2*p.sa; cutWidthBottom = p.depthBottom + 2*p.sa;
      depth = Math.max(p.depthTop, p.depthBottom);
    }
  }
  const cutWidth = depth + 2*p.sa;
  const reserved = [runLength/2];
  const keep = Math.max(0.35,p.sa);
  const piece = {
    type:"side",side,label,quantity:1,path,runLength,
    cutLength:runLength+startAllowance+endAllowance,
    cutWidth,finishedWidth:depth,
    startAllowance,endAllowance,
    flushStart:startAllowance<=1e-9,flushEnd:endAllowance<=1e-9,
    plan:notchPlan(path,{keepOutStart:keep,keepOutEnd:keep,reserved,maxMarks:40}),
    landmarks:[{s:runLength/2,kind:"mid",label:side+" midpoint"}],
    topAtStart:(side==="right" || side==="left")
  };
  if (cutWidthTop !== undefined) {
    piece.cutWidthTop = cutWidthTop; piece.cutWidthBottom = cutWidthBottom;
    piece.finishedWidthTop = finishedWidthTop; piece.finishedWidthBottom = finishedWidthBottom;
  }
  return piece;
}

function buildSidePieces(model,p){
  if (!(p.sideDepth>0) || !model.valid) return {pieces:[],displayPieces:[],valid:false};
  const open = p.topMode==="3side";
  const paths = open ? model.openSew.sidePaths : model.sewSides;
  const pieces=[];
  if (open){
    const rightPath=paths.right;
    const leftPath=[...paths.left].reverse().map(q=>({...q,side:"left"}));
    pieces.push(buildStripPiece("right",rightPath,p,0,p.sa,"RIGHT — CUT 1"));
    pieces.push(buildStripPiece("bottom",paths.bottom,p,p.sa,p.sa,"BOTTOM — CUT 1"));
    pieces.push(buildStripPiece("left",leftPath,p,0,p.sa,"LEFT — CUT 1"));
  } else {
    pieces.push(buildStripPiece("top",paths.top,p,p.sa,p.sa,"TOP — CUT 1"));
    pieces.push(buildStripPiece("right",paths.right,p,p.sa,p.sa,"RIGHT — CUT 1"));
    pieces.push(buildStripPiece("bottom",paths.bottom,p,p.sa,p.sa,"BOTTOM — CUT 1"));
    const leftPath=[...paths.left].reverse().map(q=>({...q,side:"left"}));
    pieces.push(buildStripPiece("left",leftPath,p,p.sa,p.sa,"LEFT — CUT 1"));
  }
  const displayPieces=[];
  const left=pieces.find(x=>x.side==="left"), right=pieces.find(x=>x.side==="right");
  const canPair=left&&right&&model.symmetry&&runsEquivalent(left.path,right.path)&&
    Math.abs(left.cutLength-right.cutLength)<1/32;
  if (canPair){
    displayPieces.push({...right,label:"LEFT & RIGHT — CUT 2",quantity:2,sides:["left","right"]});
  } else {
    if (right) displayPieces.push(right);
    if (left) displayPieces.push(left);
  }
  const bottom=pieces.find(x=>x.side==="bottom"), top=pieces.find(x=>x.side==="top");
  if (bottom) displayPieces.push(bottom);
  if (top) displayPieces.push(top);
  return {pieces,displayPieces,valid:true,pairedSides:canPair};
}

function buildGussetPiece(model,p){
  if (!(p.sideDepth>0) || !model.valid) return null;
  const open=p.topMode==="3side";
  const order=open?["right","bottom","left"]:SIDE_ORDER;
  const sidePaths=open?model.openSew.sidePaths:model.sewSides;
  const path=combineSidePaths(sidePaths,order,false);
  const lm=landmarksForSidePaths(sidePaths,order,!open);
  const runLength=polylineLength(path,false)+(open?0:dist(path[path.length-1],path[0]));
  const reserved=lm.landmarks.map(x=>x.s).concat([runLength/2]);
  const keep=Math.max(0.5,p.sa*1.25);
  return {
    type:"gusset",label:"GUSSET — CUT 1",quantity:1,open,order,path,sidePaths,
    runLength,cutLength:runLength+2*p.sa,
    cutWidth:p.sideDepth+2*p.sa,finishedWidth:p.sideDepth,
    startAllowance:p.sa,endAllowance:p.sa,
    flushStart:false,flushEnd:false,
    plan:notchPlan(path,{keepOutStart:keep,keepOutEnd:keep,reserved,maxMarks:48}),
    landmarks:lm.landmarks,zones:order.map(side=>({side,length:polylineLength(sidePaths[side],false)}))
  };
}

/* ============ MAIN BUILD ============ */
function buildPanel(p){
  const notes=[], warnings=[], errors=[];
  const clamp=(val,max,label)=>{
    if (val>max+1e-9){
      notes.push(label+" reduced to "+fmtIn(max)+" to keep the curve fair.");
      return max;
    }
    return Math.max(0,val);
  };
  const topW=Math.max(0.01,p.topW), botW=Math.max(0.01,p.botW), height=Math.max(0.01,p.height);
  const cx=Math.max(topW,botW)/2;
  const TL={x:cx-topW/2,y:0}, TR={x:cx+topW/2,y:0};
  const BR={x:cx+botW/2,y:height}, BL={x:cx-botW/2,y:height};
  const sideLen=dist(TR,BR);
  const hTop=clamp(p.topCrown,Math.min(0.30*topW,0.35*height),"Top crown");
  const hBot=clamp(p.botCrown,Math.min(0.30*botW,0.35*height),"Bottom crown");
  const hL=clamp(p.leftFull,0.55*sideLen,"Left fullness");
  const hR=clamp(p.rightFull,0.55*sideLen,"Right fullness");
  const alpha=FEEL_ALPHA[p.feel] || FEEL_ALPHA.balanced;

  const eTop=sampleEdge(TL,TR,hTop,alpha,"top");
  const eRight=sampleEdge(TR,BR,hR,alpha,"right");
  const eBottom=sampleEdge(BR,BL,hBot,alpha,"bottom");
  const eLeft=sampleEdge(BL,TL,hL,alpha,"left");

  const EPS=1e-6, sa=Math.max(0,p.sa||0);
  let ts=p.topSoft<=EPS?0:clamp(p.topSoft,0.42*Math.min(topW,sideLen),"Top corner softness");
  let bs=p.botSoft<=EPS?0:clamp(p.botSoft,0.42*Math.min(botW,sideLen),"Bottom corner softness");
  const minSoft=sa*1.25;
  if (sa>0&&ts>0&&ts<minSoft-1e-9) errors.push("Top corner softness is too tight for this seam allowance. Use 0 for crisp or at least "+fmtIn(minSoft)+".");
  if (sa>0&&bs>0&&bs<minSoft-1e-9) errors.push("Bottom corner softness is too tight for this seam allowance. Use 0 for crisp or at least "+fmtIn(minSoft)+".");

  function scaledTrims(len,dA,dB,label){
    const tot=dA+dB;
    if (tot>0.75*len){
      const f=(0.75*len)/tot;
      notes.push(label+" trims scaled back to fit the edge length.");
      return [dA*f,dB*f];
    }
    return [dA,dB];
  }
  const [tT1,tT2]=scaledTrims(polylineLength(eTop,false),ts,ts,"Top edge");
  const [tR1,tR2]=scaledTrims(polylineLength(eRight,false),ts,bs,"Right edge");
  const [tB1,tB2]=scaledTrims(polylineLength(eBottom,false),bs,bs,"Bottom edge");
  const [tL1,tL2]=scaledTrims(polylineLength(eLeft,false),bs,ts,"Left edge");
  const T=trimPolyline(eTop,tT1,tT2), R=trimPolyline(eRight,tR1,tR2);
  const B=trimPolyline(eBottom,tB1,tB2), L=trimPolyline(eLeft,tL1,tL2);

  const cTR=ts>0?sampleCornerBlend(T.pts.at(-1),T.tanEnd,R.pts[0],R.tanStart,"top","right"):
    {first:[T.pts.at(-1)],second:[R.pts[0]],midpoint:T.pts.at(-1)};
  const cBR=bs>0?sampleCornerBlend(R.pts.at(-1),R.tanEnd,B.pts[0],B.tanStart,"right","bottom"):
    {first:[R.pts.at(-1)],second:[B.pts[0]],midpoint:R.pts.at(-1)};
  const cBL=bs>0?sampleCornerBlend(B.pts.at(-1),B.tanEnd,L.pts[0],L.tanStart,"bottom","left"):
    {first:[B.pts.at(-1)],second:[L.pts[0]],midpoint:B.pts.at(-1)};
  const cTL=ts>0?sampleCornerBlend(L.pts.at(-1),L.tanEnd,T.pts[0],T.tanStart,"left","top"):
    {first:[L.pts.at(-1)],second:[T.pts[0]],midpoint:L.pts.at(-1)};

  const cutSides={
    top:joinPathParts([cTL.second,T.pts,cTR.first],"top"),
    right:joinPathParts([cTR.second,R.pts,cBR.first],"right"),
    bottom:joinPathParts([cBR.second,B.pts,cBL.first],"bottom"),
    left:joinPathParts([cBL.second,L.pts,cTL.first],"left")
  };
  const built=buildClosedPathFromSides(cutSides);
  const cutPts=built.pts, ranges=built.ranges;
  if (selfIntersections(cutPts,true).length) errors.push("The cut path crosses itself. Reduce fullness or crown.");
  if (Math.abs(signedArea(cutPts))<1e-6) errors.push("The cut path has no usable area.");

  const sewSides=sa<=1e-9
    ? Object.fromEntries(SIDE_ORDER.map(side=>[side,cutSides[side].map(q=>({...q}))]))
    : offsetSidePaths(cutSides,sa);
  let sewPts=combineSidePaths(sewSides,SIDE_ORDER,true);
  sewPts=dedupe(sewPts);
  const sewCheck=validateClosedOffset(cutPts,sewPts);
  errors.push(...sewCheck.errors);
  const cutRuns=sideLengths(cutSides), runs=sideLengths(sewSides);
  const closedLm=landmarksForSidePaths(sewSides,SIDE_ORDER,true);
  const openSew=buildOpenTopSewline(cutSides,sewSides);
  if (p.topMode==="3side"&&!openSew.valid) errors.push(...openSew.errors);

  const cutBB=bbox(cutPts), sewBB=bbox(sewPts);
  const cutPerim=polylineLength(cutPts,true), sewPerim=polylineLength(sewPts,true);
  const tagEdge=pt=>({x:pt.x,y:pt.y,side:pt.side,kind:"edge"});
  const tagBlend=pt=>({x:pt.x,y:pt.y,side:pt.side,kind:"blend"});
  const marks=[
    tagEdge(pathPointAt(cutSides.top,cutRuns.top/2)),
    tagEdge(pathPointAt(cutSides.right,cutRuns.right/2)),
    tagEdge(pathPointAt(cutSides.bottom,cutRuns.bottom/2)),
    tagEdge(pathPointAt(cutSides.left,cutRuns.left/2))
  ].filter(Boolean);
  [cTR,cBR,cBL,cTL].forEach(c=>{if(c&&c.midpoint&&dist(c.first[0],c.second.at(-1))>1e-7)marks.push(tagBlend(c.midpoint));});

  const symmetry=Math.abs(hL-hR)<1e-8;
  const valid=errors.length===0;
  const model={
    frame:[TL,TR,BR,BL],cutPts,sewPts,cutSides,sewSides,ranges,marks,
    notes,warnings,errors,valid,sewValid:sewCheck.valid,
    validation:{valid,errors,warnings},
    cutBB,sewBB,cutPerim,sewPerim,runs,cutRuns,openSew,
    closedLandmarks:closedLm,symmetry,
    crowns:{hTop,hBot,hL,hR},softness:{ts,bs}
  };
  const sideResult=buildSidePieces(model,p);
  model.sidePieces=sideResult.pieces;
  model.displaySidePieces=sideResult.displayPieces;
  model.pairedSides=sideResult.pairedSides;
  model.gussetPiece=buildGussetPiece(model,p);
  model.activeSew=p.topMode==="3side"?{
    pts:openSew.pts,bb:openSew.bb,total:openSew.total,runs:openSew.runs,
    junctions:openSew.junctions,midpoints:openSew.midpoints,closed:false
  }:{
    pts:sewPts,bb:sewBB,total:sewPerim,runs,
    junctions:closedLm.junctions,midpoints:closedLm.midpoints,closed:true
  };
  return model;
}

const buildCurvedPanelModel = buildPanel;

/* Contiguous side groups retained for compatibility with older UI code. */
function sideGroups(pts){
  const out={};
  for (const side of SIDE_ORDER) out[side]=extractSideRun(pts,side,true);
  return out;
}

/* Collapse check for an OPEN polyline pair (src vs offset, same indexing). */
function offsetCollapsedOpen(src,off){
  const n=Math.min(src.length,off.length);
  for(let i=0;i<n-1;i++){
    const sx=src[i+1].x-src[i].x, sy=src[i+1].y-src[i].y;
    if(sx*sx+sy*sy<1e-4)continue;
    const ox=off[i+1].x-off[i].x, oy=off[i+1].y-off[i].y;
    if(sx*ox+sy*oy<0)return true;
  }
  return false;
}


/* =====================================================================
   FORMATTING
   ===================================================================== */
const FR8 = ["", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8"];
function fmtIn(v){
  const neg = v < 0 ? "-" : "";
  v = Math.abs(v);
  let e = Math.round(v * 8);
  let whole = Math.floor(e / 8), rem = e % 8;
  let s;
  if (whole === 0 && rem === 0) s = "0";
  else if (rem === 0) s = String(whole);
  else if (whole === 0) s = FR8[rem];
  else s = whole + " " + FR8[rem];
  return neg + s + "\u2033";
}
function fmtDec(v){ return v.toFixed(2) + "\u2033"; }



function ptsToPath(pts, close){
  let d = "M " + pts.map(p => p.x.toFixed(3) + " " + p.y.toFixed(3)).join(" L ");
  if (close) d += " Z";
  return d;
}


/* For each point in model.marks, find its position + tangent + inward normal
   on the nearest segment of cutPts. Returns { x, y, tx, ty, nx, ny, isCrown }. */
function markDetails(cutPts, marks, originX, originY){
  const n = cutPts.length;
  return marks.map(mk => {
    const mx = mk.x, my = mk.y;
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < n; i++){
      const d = Math.hypot(cutPts[i].x - mx, cutPts[i].y - my);
      if (d < bestD){ bestD = d; bestI = i; }
    }
    const prev = cutPts[(bestI - 1 + n) % n], next = cutPts[(bestI + 1) % n];
    const tx = next.x - prev.x, ty = next.y - prev.y;
    const tl = Math.hypot(tx, ty) || 1;
    const utx = tx/tl, uty = ty/tl;
    // inward normal: clockwise winding = inward is (-ty, tx) for y-down SVG
    const unx = -uty, uny = utx;
    return { x: mx - originX, y: my - originY, tx: utx, ty: uty, nx: unx, ny: uny };
  });
}

/* zone summary */
function zoneSummary(marks){
  if (!marks.length) return "none (straight)";
  const groups = [];
  let g = { kind: marks[0].kind, from: marks[0].s, to: marks[0].s, count: 1 };
  for (let i = 1; i < marks.length; i++){
    const mk = marks[i];
    const gap = mk.kind === "clip" ? 0.6 : 1.6;
    if (mk.kind === g.kind && mk.s - g.to <= gap){ g.to = mk.s; g.count++; }
    else { groups.push(g); g = { kind: mk.kind, from: mk.s, to: mk.s, count: 1 }; }
  }
  groups.push(g);
  return groups.map(z => z.kind + "s " + (z.count > 1 ? (fmtIn(z.from) + "\u2013" + fmtIn(z.to) + " (" + z.count + ")") : ("at " + fmtIn(z.from)))).join(" \u00B7 ");
}
/* ── Module exports ─────────────────────────────────────────────────── */
export {
  FEEL_ALPHA, EDGE_SAMPLES, CORNER_SAMPLES, SIDE_ORDER,
  dist, sampleEdge, polylineLength, trimPolyline, unit, cornerBlend,
  dedupe, offsetInward, offsetCollapsed, offsetOpen, lineIntersect,
  crossZ, joinMiter, bbox, sideRuns, rayPolylineHit, buildOpenSewline,
  sewLandmarks, extractSideRun, notchPlan, pathLandmarkPositions,
  signedArea, segmentsIntersect, selfIntersections, pointInPolygon,
  landmarksForSidePaths, combineSidePaths, runsEquivalent,
  buildSidePieces, buildGussetPiece,
  buildPanel, buildCurvedPanelModel, sideGroups, offsetCollapsedOpen,
  fmtIn, fmtDec, ptsToPath, markDetails, zoneSummary,
};
