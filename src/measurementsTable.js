/* =====================================================================
   measurementsTable.js — HTML-string table row and block builders
   Extracted from src/tabs/CurvedPanel.jsx (Pass 11).
   Used by cpSidesHTML and cpGussetHTML for on-screen piece preview tables.
   ===================================================================== */

/* One measurement row: label | cut value | secondary value.
   opts.secondaryLabel — prefix shown before sewVal (default "Sewline:")
   opts.cls            — CSS class names; all default to CurvedPanel values */
export function cpProw(label, cutVal, sewVal, {
  secondaryLabel = "Sewline:",
  cls = {},
} = {}){
  const c = { row: "cp-prow", label: "pl", cut: "pc", secondary: "ps", ...cls };
  return `<div class="${c.row}"><div class="${c.label}">${label}</div><div class="${c.cut}">${cutVal}</div><div class="${c.secondary}">${secondaryLabel} ${sewVal}</div></div>`;
}

/* One piece block: quantity pill + rows array + optional note.
   opts.cls — CSS class names; all default to CurvedPanel values */
export function cpPieceBlock(pill, rows, note, {
  cls = {},
} = {}){
  const c = { pill: "cp-pill", note: "cp-pnote", ...cls };
  return `<span class="${c.pill}">${pill}</span>` + rows.join("") + (note ? `<p class="${c.note}">${note}</p>` : "");
}
