/* =====================================================================
   diagramMarks.js — shared SVG mark builders for print diagrams
   Extracted from src/tabs/CurvedPanel.jsx (Pass 11).
   These functions produce SVG markup strings in print-inch coordinate units.

   Inline center-line, sewline, and cut-line SVG in the four screen diagram
   functions were not extracted here — they each use different coordinate
   systems and would require new wrappers (beyond pure relocation).
   Flagged for a future pass.
   ===================================================================== */
import { C_SEW, C_MIDPOINT, W_SEW } from './diagramTokens.js';
import { FOOT_RADIUS_IN } from './purseFeet.js';

/* C_BORDER_MARK is the print-doc tile border; cpSquareMark uses it (pre-existing
   deviation from diagram standard — should be catColor but not changed here). */
const C_BORDER_MARK = "#000000";

/* Corner junction square mark (print inches).
   catColor: pass CAT_BAG_STRUCTURES.color for category-colored junctions; defaults to black. */
export function cpSquareMark(x, y, catColor = C_BORDER_MARK){
  const s = 0.055;
  return `<rect x="${(x-s).toFixed(4)}" y="${(y-s).toFixed(4)}" width="${(2*s).toFixed(4)}" height="${(2*s).toFixed(4)}" fill="none" stroke="${catColor}" stroke-width="0.018" rx="0.01"/>`;
}

/* Midpoint open-circle mark (print inches).
   Spec: 0.07in radius · white fill · C_MIDPOINT stroke · 0.022in weight. */
export function cpMidpointMark(x, y){
  return `<circle cx="${x.toFixed(4)}" cy="${y.toFixed(4)}" r="0.07" fill="#ffffff" stroke="${C_MIDPOINT}" stroke-width="0.022"/>`;
}

/* Side midpoint diamond mark (print inches). */
export function cpDiamondMark(x, y){
  const d = 0.07;
  return `<polygon points="${x},${y-d} ${x+d},${y} ${x},${y+d} ${x-d},${y}" fill="none" stroke="${C_SEW}" stroke-width="0.018"/>`;
}

/* Inward-pointing center match triangle on the cut line (print inches).
   catColor: category cut-line color — defaults to Bag Structures purple. */
export function cpTriangleMark(px, py, nx, ny, tang_x, tang_y, scale = 1, catColor = "#5a2da0"){
  const base = 0.16 * scale, height = 0.26 * scale;
  const b1x = px - tang_x * base/2, b1y = py - tang_y * base/2;
  const b2x = px + tang_x * base/2, b2y = py + tang_y * base/2;
  const apx = px + nx * height,     apy = py + ny * height;
  return `<polygon points="${b1x.toFixed(4)},${b1y.toFixed(4)} ${b2x.toFixed(4)},${b2y.toFixed(4)} ${apx.toFixed(4)},${apy.toFixed(4)}" fill="${catColor}" stroke="none"/>`;
}

/* Perpendicular tick at (px,py) pointing inward (print inches). */
export function cpPerpTick(px, py, nx, ny, catColor = "#5a2da0"){
  const len = 0.14;
  return `<line x1="${px.toFixed(4)}" y1="${py.toFixed(4)}" x2="${(px + nx*len).toFixed(4)}" y2="${(py + ny*len).toFixed(4)}" stroke="${catColor}" stroke-width="0.025"/>`;
}

/* Inward-pointing triangle on a HORIZONTAL strip edge (print inches). */
export function cpTriangleH(px, py, inward, catColor = "#5a2da0"){
  const base = 0.16, ht = 0.22;
  const bL = px - base/2, bR = px + base/2;
  const apex = py + inward * ht;
  return `<polygon points="${bL.toFixed(4)},${py.toFixed(4)} ${bR.toFixed(4)},${py.toFixed(4)} ${px.toFixed(4)},${apex.toFixed(4)}" fill="${catColor}" stroke="none"/>`;
}

/* Inward-pointing triangle on a VERTICAL strip edge (print inches). */
export function cpTriangleV(px, py, inward, catColor = "#5a2da0"){
  const base = 0.16, ht = 0.22;
  const bT = py - base/2, bB = py + base/2;
  const apex = px + inward * ht;
  return `<polygon points="${px.toFixed(4)},${bT.toFixed(4)} ${px.toFixed(4)},${bB.toFixed(4)} ${apex.toFixed(4)},${py.toFixed(4)}" fill="${catColor}" stroke="none"/>`;
}

/**
 * SVG fragment for purse-feet marks overlaid on a panel diagram.
 * Returns a bare SVG string — concatenate into the parent SVG before </svg>.
 *
 * ctx:
 *   x0    — SVG x of the panel's top-left cut corner
 *   y0    — SVG y of the panel's top-left cut corner
 *   xIsW  — when true, panel W maps to SVG x and L maps to SVG y
 *            (use for cpMiniStrip, which renders strips vertically)
 *            default false: L→x, W→y (for horizontal print strips)
 *
 * feet  — [{x, y}] in panel inches, origin at cut-edge top-left
 *
 * scale:
 *   value — coordinate multiplier (px/in for screen, 1.0 for print)
 *   mode  — 'screen' | 'print' — selects stroke weight
 */
export function drawPurseFeetMarks(ctx, feet, scale) {
  if (!feet || !feet.length) return '';
  const { x0 = 0, y0 = 0, xIsW = false } = ctx;
  const { value: sv, mode } = scale;
  const r  = FOOT_RADIUS_IN * sv;
  const sw = mode === 'print' ? 0.022 : W_SEW;
  let s = '';
  for (const f of feet) {
    const cx = x0 + (xIsW ? f.y : f.x) * sv;
    const cy = y0 + (xIsW ? f.x : f.y) * sv;
    s += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="${C_SEW}" stroke-width="${sw}"/>`;
    s += `<line x1="${(cx - r*1.25).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(cx + r*1.25).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${C_SEW}" stroke-width="${sw}"/>`;
    s += `<line x1="${cx.toFixed(2)}" y1="${(cy - r*1.25).toFixed(2)}" x2="${cx.toFixed(2)}" y2="${(cy + r*1.25).toFixed(2)}" stroke="${C_SEW}" stroke-width="${sw}"/>`;
  }
  return s;
}
