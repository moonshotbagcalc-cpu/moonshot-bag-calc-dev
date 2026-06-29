// purseFeet.js — pure calculation module, no JSX, no side effects
// All coordinates are in inches, origin at top-left of panel cut edge.

// ── Constants (exported for diagram renderer and UI) ────────────────────────
export const FOOT_RADIUS_IN  = 0.25;   // 1/2" diameter mark, drawn to scale
export const STAY_AWAY_BASE  = 0.75;   // 3/4" fixed stay-away component
export const MIN_FOOT_SPACING = 1;     // minimum center-to-center distance between any two feet

// Grid layout: [rows along short axis, cols along long axis]
const GRID_CONFIG = {
  2: [1, 2],
  4: [2, 2],
  6: [2, 3],
  8: [2, 4],
};

// Always rounds to nearest 1/8" in inches (panel coordinates are always imperial internally)
function r8(v) {
  return Math.round(v * 8) / 8;
}

/**
 * Effective stay-away margin from any cut edge, given a seam allowance.
 * 3/4" + SA, rounded to nearest 1/8".
 */
export function stayAwayFor(SA) {
  return r8(STAY_AWAY_BASE + SA);
}

/**
 * Distribute n points evenly over an available span, starting at `start`.
 * n === 1 returns a single point centered in the span.
 * All positions rounded to nearest 1/8".
 */
function evenlySpaced(n, avail, start) {
  if (n === 1) return [r8(start + avail / 2)];
  return Array.from({ length: n }, (_, i) => r8(start + (i * avail) / (n - 1)));
}

/**
 * Calculate purse-feet placement positions on a bottom panel.
 *
 * @param {number}  L          - panel cut length (inches)
 * @param {number}  W          - panel cut width (inches)
 * @param {number}  SA         - seam allowance (inches)
 * @param {number}  footCount  - 2 | 4 | 6 | 8
 * @param {boolean} centerFoot - add one foot at dead panel center
 * @param {number}  insetNudge - additional inward offset in inches, multiples of 1/8" (default 0)
 * @returns {{ feet: Array<{x:number, y:number}>, stayAway: number, error: string|null }}
 */
export function calcPurseFeet(L, W, SA, footCount, centerFoot = false, insetNudge = 0) {
  // ── Input guards ────────────────────────────────────────────────────────────
  if (![2, 4, 6, 8].includes(footCount)) {
    return {
      feet: [], stayAway: 0,
      error: `Foot count must be 2, 4, 6, or 8. Odd counts are not supported — choose an even number.`,
    };
  }

  if (insetNudge < 0) {
    return {
      feet: [], stayAway: 0,
      error: `Inset nudge cannot be negative — use 0 or a positive value to move feet inward.`,
    };
  }

  // ── Margins ─────────────────────────────────────────────────────────────────
  const sa     = stayAwayFor(SA);          // stay-away from any cut edge
  const margin = sa + insetNudge;          // total distance from cut edge to nearest foot

  // ── Long / short axis ───────────────────────────────────────────────────────
  // When L === W (square panel) longIsL is true: 6-foot grid becomes 3 cols × 2 rows as specified.
  const longIsL  = L >= W;
  const longDim  = longIsL ? L : W;
  const shortDim = longIsL ? W : L;

  const availLong  = longDim  - 2 * margin;
  const availShort = shortDim - 2 * margin;

  if (availLong <= 0) {
    return {
      feet: [], stayAway: sa,
      error: `The panel's long axis (${longDim.toFixed(3)}") is too small for the current margin (${margin.toFixed(3)}" per side). Increase the panel size or reduce the inset nudge.`,
    };
  }
  if (availShort <= 0) {
    return {
      feet: [], stayAway: sa,
      error: `The panel's short axis (${shortDim.toFixed(3)}") is too small for the current margin (${margin.toFixed(3)}" per side). Increase the panel size or reduce the inset nudge.`,
    };
  }

  const [numShortRows, numLongCols] = GRID_CONFIG[footCount];

  // ── Spacing pre-check (before rounding, catches impossible configs early) ──
  if (numLongCols > 1) {
    const gap = availLong / (numLongCols - 1);
    if (gap < MIN_FOOT_SPACING) {
      return {
        feet: [], stayAway: sa,
        error: `${numLongCols} feet along the long axis need at least ${MIN_FOOT_SPACING}" between them, but only ${gap.toFixed(3)}" is available. Use a longer panel or fewer feet.`,
      };
    }
  }
  if (numShortRows > 1) {
    const gap = availShort / (numShortRows - 1);
    if (gap < MIN_FOOT_SPACING) {
      return {
        feet: [], stayAway: sa,
        error: `${numShortRows} foot rows along the short axis need at least ${MIN_FOOT_SPACING}" between them, but only ${gap.toFixed(3)}" is available. Use a wider panel or fewer feet.`,
      };
    }
  }

  // ── Place grid ──────────────────────────────────────────────────────────────
  const longPos  = evenlySpaced(numLongCols,  availLong,  margin);
  const shortPos = evenlySpaced(numShortRows, availShort, margin);

  const feet = [];
  for (const sp of shortPos) {
    for (const lp of longPos) {
      feet.push(longIsL ? { x: lp, y: sp } : { x: sp, y: lp });
    }
  }

  // ── Center foot (independent of grid, added at dead panel center) ──────────
  if (centerFoot) {
    feet.push({ x: r8(L / 2), y: r8(W / 2) });
  }

  // ── Post-placement: verify all-pairs minimum spacing ───────────────────────
  for (let i = 0; i < feet.length; i++) {
    for (let j = i + 1; j < feet.length; j++) {
      const dx   = feet[i].x - feet[j].x;
      const dy   = feet[i].y - feet[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MIN_FOOT_SPACING - 1e-6) {
        return {
          feet: [], stayAway: sa,
          error: `Two feet would be only ${dist.toFixed(3)}" apart (minimum is ${MIN_FOOT_SPACING}"). This often means the center foot overlaps a grid foot. Adjust foot count, panel size, or inset nudge.`,
        };
      }
    }
  }

  return { feet, stayAway: sa, error: null };
}
