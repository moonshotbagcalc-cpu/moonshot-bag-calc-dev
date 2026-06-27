/**
 * Moonshot Diagram Standard — centralized color and spec constants.
 * All diagram SVG code must reference these exports. No hardcoded hex values in diagram components.
 */

// ── Category color families ────────────────────────────────────────────────────
// color: used for cut line + corner junctions only
// fillTint: used for fill polygon at FILL_OPACITY_SCREEN / FILL_OPACITY_PRINT

export const CAT_BAG_STRUCTURES = { color: "#5340b8", fillTint: "#ede8f8", name: "Bag Structures" };
export const CAT_TRIM_POCKETS   = { color: "#c45e1a", fillTint: "#fdf0e6", name: "Trim & Pockets" };
export const CAT_HANDLES_HW     = { color: "#1565c0", fillTint: "#e3edf8", name: "Handles & Hardware" };
export const CAT_BASIC_BAGS     = { color: "#2e7d32", fillTint: "#e6f4e8", name: "Basic Bags" };

// ── Universal mark colors — fixed, never vary by category ─────────────────────
export const C_SEW      = "#808080";  // sewline (mid-grey)
export const C_CENTER   = "#00bcd4";  // center / crosshair lines (cyan)
export const C_FOLD     = "#2e7d32";  // fold lines (green)
export const C_STAB     = "#bf5630";  // stabilizer (rust)
export const C_MIDPOINT = "#d32f2f";  // midpoint marks + center match triangles (red)
export const C_EASING   = "#0097a7";  // easing marks — distinct dark cyan, never reuse C_CENTER
export const C_PIPING   = "#1AA3A3";  // piping band overlay (teal-aqua)
export const C_CORD     = "#2e7d32";  // piping cord fill — dark green, distinct from band
export const W_PIPING   = 1.5;

// ── Screen stroke weights (px) ────────────────────────────────────────────────
export const W_CUT          = 2.5;
export const W_SEW          = 1.5;
export const W_STAB         = 1.5;
export const W_CENTER       = 1.2;
export const W_MIDPOINT     = 1.5;  // midpoint circle stroke
export const W_EASING_CLIP  = 1.3;
export const W_EASING_NOTCH = 0.9;

// ── Screen dash patterns (stroke-dasharray) ───────────────────────────────────
export const DASH_SEW    = "9 7";   // sewline
export const DASH_STAB   = "4 5";   // stabilizer (dotted round — pair with stroke-linecap:round)
export const DASH_CENTER = "4 6";   // center / crosshair / fold lines

// ── Midpoint mark geometry ────────────────────────────────────────────────────
export const MIDPOINT_R = 5;   // radius px

// ── Center match triangle geometry ───────────────────────────────────────────
export const TRIANGLE_BASE   = 8;   // px base
export const TRIANGLE_HEIGHT = 11;  // px height

// ── Ghost shape spec ──────────────────────────────────────────────────────────
export const GHOST_OPACITY = 0.18;   // applied as stroke-opacity
export const GHOST_WEIGHT  = 1.5;    // px
export const GHOST_OFFSET  = 20;     // px right AND down from primary piece origin

// ── Fill tint opacity ─────────────────────────────────────────────────────────
export const FILL_OPACITY_SCREEN = 0.48;
export const FILL_OPACITY_PRINT  = 0.22;

// ── Minimum padding inside any strip SVG ─────────────────────────────────────
export const STRIP_PAD = 22;  // px — must be >= 12 (spec) and >= GHOST_OFFSET/2 + content
