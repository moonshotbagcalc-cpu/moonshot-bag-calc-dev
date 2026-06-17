/* =====================================================================
   diagramMarks.js — shared SVG mark builders for print diagrams
   Extracted from src/tabs/CurvedPanel.jsx (Pass 11).
   These functions produce SVG markup strings in print-inch coordinate units.

   Inline center-line, sewline, and cut-line SVG in the four screen diagram
   functions were not extracted here — they each use different coordinate
   systems and would require new wrappers (beyond pure relocation).
   Flagged for a future pass.
   ===================================================================== */
import { C_SEW } from './diagramTokens.js';

/* C_BORDER and C_MARK are print-diagram-specific color constants defined
   in CurvedPanel.jsx near the top. They reference CP theme values. */
const C_BORDER_MARK = "#000000";   // matches C_BORDER in CurvedPanel.jsx
const C_CUT_MARK    = "#5a2da0";   // matches C_MARK  in CurvedPanel.jsx (CP.maroon)

/* Corner junction square mark (print inches). */
export function cpSquareMark(x, y){
  const s = 0.055;
  return `<rect x="${(x-s).toFixed(4)}" y="${(y-s).toFixed(4)}" width="${(2*s).toFixed(4)}" height="${(2*s).toFixed(4)}" fill="none" stroke="${C_BORDER_MARK}" stroke-width="0.018" rx="0.01"/>`;
}

/* Side midpoint diamond mark (print inches). */
export function cpDiamondMark(x, y){
  const d = 0.07;
  return `<polygon points="${x},${y-d} ${x+d},${y} ${x},${y+d} ${x-d},${y}" fill="none" stroke="${C_SEW}" stroke-width="0.018"/>`;
}

/* Inward-pointing center match triangle on the cut line (print inches). */
export function cpTriangleMark(px, py, nx, ny, tang_x, tang_y, scale = 1){
  const base = 0.16 * scale, height = 0.26 * scale;
  const b1x = px - tang_x * base/2, b1y = py - tang_y * base/2;
  const b2x = px + tang_x * base/2, b2y = py + tang_y * base/2;
  const apx = px + nx * height,     apy = py + ny * height;
  return `<polygon points="${b1x.toFixed(4)},${b1y.toFixed(4)} ${b2x.toFixed(4)},${b2y.toFixed(4)} ${apx.toFixed(4)},${apy.toFixed(4)}" fill="${C_CUT_MARK}" stroke="none"/>`;
}

/* Perpendicular tick at (px,py) pointing inward (print inches). */
export function cpPerpTick(px, py, nx, ny){
  const len = 0.14;
  return `<line x1="${px.toFixed(4)}" y1="${py.toFixed(4)}" x2="${(px + nx*len).toFixed(4)}" y2="${(py + ny*len).toFixed(4)}" stroke="${C_CUT_MARK}" stroke-width="0.025"/>`;
}

/* Inward-pointing triangle on a HORIZONTAL strip edge (print inches). */
export function cpTriangleH(px, py, inward){
  const base = 0.16, ht = 0.22;
  const bL = px - base/2, bR = px + base/2;
  const apex = py + inward * ht;
  return `<polygon points="${bL.toFixed(4)},${py.toFixed(4)} ${bR.toFixed(4)},${py.toFixed(4)} ${px.toFixed(4)},${apex.toFixed(4)}" fill="${C_CUT_MARK}" stroke="none"/>`;
}

/* Inward-pointing triangle on a VERTICAL strip edge (print inches). */
export function cpTriangleV(px, py, inward){
  const base = 0.16, ht = 0.22;
  const bT = py - base/2, bB = py + base/2;
  const apex = px + inward * ht;
  return `<polygon points="${px.toFixed(4)},${bT.toFixed(4)} ${px.toFixed(4)},${bB.toFixed(4)} ${apex.toFixed(4)},${py.toFixed(4)}" fill="${C_CUT_MARK}" stroke="none"/>`;
}
