/* =====================================================================
   measurementsTable.js — HTML-string table row and block builders
   Extracted from src/tabs/CurvedPanel.jsx (Pass 11).
   Used by cpSidesHTML and cpGussetHTML for on-screen piece preview tables.
   ===================================================================== */

/* One measurement row: label | cut value | sewline value */
export function cpProw(label, cutVal, sewVal){
  return `<div class="cp-prow"><div class="pl">${label}</div><div class="pc">${cutVal}</div><div class="ps">Sewline: ${sewVal}</div></div>`;
}

/* One piece block: quantity pill + rows array + optional note */
export function cpPieceBlock(pill, rows, note){
  return `<span class="cp-pill">${pill}</span>` + rows.join("") + (note ? `<p class="cp-pnote">${note}</p>` : "");
}
