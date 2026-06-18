/* =====================================================================
   printRenderers.js — print-output functions for CurvedPanel
   Extracted from src/tabs/CurvedPanel.jsx (Pass 11).
   All functions produce tiled physical-scale SVG patterns via window.open.
   ===================================================================== */
import {
  CP_TILE_W, CP_TILE_H,
  cpTilePlan, cpRowLabel, cpTestSquareSVG, cpRegistrationMarks,
} from './utils/print-utils.js';
import { C_SEW, C_CENTER, C_STAB, C_EASING } from './diagramTokens.js';
import {
  cpSquareMark, cpDiamondMark, cpTriangleMark, cpPerpTick,
  cpTriangleH, cpTriangleV,
} from './diagramMarks.js';
import { cpStabilizerPoints, cpPtsBB } from './stabilizer.js';
import {
  ptsToPath as cpPtsToPath,
  markDetails as cpMarkDetails,
  fmtIn as cpFmtIn,
  fmtDec as cpFmtDec,
} from './curved-panel-core.js';
import { isMetric, fmtCm } from './utils/formatting.js';

/* Local color constants (matching CurvedPanel.jsx values) */
const CP_MAROON = "#5a2da0";
const C_CUT     = CP_MAROON;
const C_BORDER  = "#000000";
const C_PIECE_CENTER = C_CENTER;
const C_NOTCH   = C_EASING;

/* Unit-aware formatters (same logic as CurvedPanel.jsx cpFmt/cpFmtD) */
function cpFmt(v){ return isMetric() ? fmtCm(v) : cpFmtIn(v); }
function cpFmtD(v){ return isMetric() ? fmtCm(v) : cpFmtDec(v); }

/* ---- TILED PRINT DOCUMENT ---- */
export function cpPrintDoc(title, geom, spanW, spanH, detailRows, legendLine, allowRotate=true, headingColor=CP_MAROON){
  const plan=cpTilePlan(spanW,spanH,allowRotate);
  let draw=geom;
  if(plan.rotated)draw=`<g transform="translate(${spanH.toFixed(4)} 0) rotate(90)">${geom}</g>`;
  let tiles="";
  for(let r=0;r<plan.rows;r++){
    for(let c=0;c<plan.cols;c++){
      const vx=c*CP_TILE_W,vy=r*CP_TILE_H;
      const label=cpRowLabel(r)+(c+1);
      const isLast=r===plan.rows-1&&c===plan.cols-1;
      let inner=draw;
      inner+=`<rect x="${vx}" y="${vy}" width="${CP_TILE_W}" height="${CP_TILE_H}" fill="none" stroke="${C_BORDER}" stroke-width="0.025"/>`;
      inner+=cpRegistrationMarks(vx,vy,CP_TILE_W,CP_TILE_H);
      const nbLeft=c>0?cpRowLabel(r)+c:null;
      const nbRight=c<plan.cols-1?cpRowLabel(r)+(c+2):null;
      const nbUp=r>0?cpRowLabel(r-1)+(c+1):null;
      const nbDown=r<plan.rows-1?cpRowLabel(r+1)+(c+1):null;
      if(nbLeft)inner+=`<text x="${(vx+0.08).toFixed(3)}" y="${(vy+CP_TILE_H/2).toFixed(3)}" font-size="0.12" font-weight="700" font-family="Nunito,sans-serif" fill="#777">← ${nbLeft}</text>`;
      if(nbRight)inner+=`<text x="${(vx+CP_TILE_W-0.08).toFixed(3)}" y="${(vy+CP_TILE_H/2).toFixed(3)}" font-size="0.12" font-weight="700" font-family="Nunito,sans-serif" fill="#777" text-anchor="end">${nbRight} →</text>`;
      if(nbUp)inner+=`<text x="${(vx+CP_TILE_W/2).toFixed(3)}" y="${(vy+0.15).toFixed(3)}" font-size="0.12" font-weight="700" font-family="Nunito,sans-serif" fill="#777" text-anchor="middle">↑ ${nbUp}</text>`;
      if(nbDown)inner+=`<text x="${(vx+CP_TILE_W/2).toFixed(3)}" y="${(vy+CP_TILE_H-0.08).toFixed(3)}" font-size="0.12" font-weight="700" font-family="Nunito,sans-serif" fill="#777" text-anchor="middle">↓ ${nbDown}</text>`;
      tiles+=`<div class="${isLast?"tile last":"tile"}"><div class="tlabel">${title} &mdash; ${label}</div>`+
        `<svg width="${CP_TILE_W}in" height="${CP_TILE_H}in" viewBox="${vx} ${vy} ${CP_TILE_W} ${CP_TILE_H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg></div>`;
    }
  }
  const details=detailRows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("");
  const w=window.open("","_blank");
  if(!w){window.alert("The print window was blocked. Allow pop-ups for this site, then try again.");return false;}
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
    @page{margin:0.5in}
    body{font-family:Nunito,system-ui,sans-serif;margin:0;color:#222}
    .page{page-break-after:always}.tile{page-break-after:always;text-align:center}.tile.last{page-break-after:auto}
    .tlabel{margin:0;padding:3pt 0 0;font-size:7pt;font-weight:700;text-align:center;line-height:1.2}.tile svg{display:block;margin:0 auto}
    h1{font-size:15pt;margin:0 0 3pt;color:${headingColor}}h2{font-size:10pt;margin:0 0 8pt;color:#555}
    table{border-collapse:collapse;width:100%;font-size:10pt}td{border:1px solid #ddd;padding:4pt 7pt}td:first-child{font-weight:700;width:38%}
    .note{font-size:11pt;font-weight:800;color:#000;margin-top:9pt;line-height:1.5}.legend{font-size:7.5pt;color:#444;margin-top:5pt}
  </style></head><body>
    <div class="page"><h1>${title}</h1>
      <h2>MoonShot Bag Calculator · ${plan.pages} pattern page${plan.pages===1?"":"s"} · ${plan.rows} row(s) × ${plan.cols} column(s) · 7″ × 9.68″ printable tiles${plan.rotated?" · auto-rotated to use fewer pages":""}</h2>
      <p style="font-size:9pt;font-weight:700;color:#555;margin:0 0 2pt">Verify both test squares before cutting fabric:</p>
      ${cpTestSquareSVG()}<table>${details}</table>
      ${legendLine?`<p class="legend">${legendLine}</p>`:""}
      <p class="note">Print at 100% or Actual Size. Turn off Fit to Page, scaling, and browser headers/footers. Verify both test squares. Assemble matching tile edges using the page labels and registration crosses.</p>
    </div>${tiles}
  </body></html>`);
  w.document.close();
  const fire=()=>{const ready=w.document.fonts&&w.document.fonts.ready?w.document.fonts.ready:Promise.resolve();ready.then(()=>setTimeout(()=>w.print(),80));};
  if(w.document.readyState==="complete")fire();else w.addEventListener("load",fire,{once:true});
  return true;
}

/* ---- STRIP PRINT RENDERERS ---- */

/* Z-order: notches → center line → sewline → landmarks → center triangles → cut rect */
export function cpDrawStrip(pc){
  const { x0, y0, cutL, w, sa } = pc;
  const sewStart = pc.flushStart ? x0 : x0 + sa;
  const sx = pc.flushStart ? x0 : x0 + sa;
  const ex = pc.flushEnd ? x0 + cutL : x0 + cutL - sa;
  const midX = x0 + cutL/2;
  const midY = y0 + w/2;
  let g = "";
  g += `<rect x="${x0}" y="${y0}" width="${cutL.toFixed(4)}" height="${w.toFixed(4)}" fill="#fbecef" fill-opacity="0.55" stroke="none"/>`;
  if (pc.plan){
    for (const mk of pc.plan.marks){
      const tx = sewStart + mk.s;
      const len = mk.kind === "clip" ? sa * 0.75 : sa * 0.55;
      const wgt = mk.kind === "clip" ? 0.022 : 0.016;
      g += `<line x1="${tx.toFixed(4)}" y1="${y0}" x2="${tx.toFixed(4)}" y2="${(y0+len).toFixed(4)}" stroke="${C_NOTCH}" stroke-width="${wgt}"/>`;
      g += `<line x1="${tx.toFixed(4)}" y1="${(y0+w).toFixed(4)}" x2="${tx.toFixed(4)}" y2="${(y0+w-len).toFixed(4)}" stroke="${C_NOTCH}" stroke-width="${wgt}"/>`;
    }
  }
  g += `<line x1="${midX.toFixed(4)}" y1="${y0}" x2="${midX.toFixed(4)}" y2="${(y0+w).toFixed(4)}" stroke="${C_PIECE_CENTER}" stroke-width="0.016" stroke-dasharray="0.18 0.12"/>`;
  g += `<line x1="${x0}" y1="${midY.toFixed(4)}" x2="${(x0+cutL).toFixed(4)}" y2="${midY.toFixed(4)}" stroke="${C_PIECE_CENTER}" stroke-width="0.016" stroke-dasharray="0.18 0.12"/>`;
  let d = `M ${sx.toFixed(4)} ${(y0+sa).toFixed(4)} H ${ex.toFixed(4)} M ${sx.toFixed(4)} ${(y0+w-sa).toFixed(4)} H ${ex.toFixed(4)}`;
  if (!pc.flushStart) d += ` M ${sx.toFixed(4)} ${(y0+sa).toFixed(4)} V ${(y0+w-sa).toFixed(4)}`;
  if (!pc.flushEnd) d += ` M ${ex.toFixed(4)} ${(y0+sa).toFixed(4)} V ${(y0+w-sa).toFixed(4)}`;
  g += `<path d="${d}" fill="none" stroke="${C_SEW}" stroke-width="0.02" stroke-dasharray="0.15 0.1"/>`;
  if (pc.landmarks){
    for (const L of pc.landmarks){
      const tx = sewStart + L.s;
      if (L.kind === "junction"){ g += cpSquareMark(tx, y0 + sa); g += cpSquareMark(tx, y0 + w - sa); }
      else { g += cpDiamondMark(tx, y0 + sa); g += cpDiamondMark(tx, y0 + w - sa); }
    }
  }
  g += cpTriangleH(midX, y0, +1);
  g += cpTriangleH(midX, y0+w, -1);
  g += cpTriangleV(x0, midY, +1);
  g += cpTriangleV(x0+cutL, midY, -1);
  g += `<rect x="${x0}" y="${y0}" width="${cutL.toFixed(4)}" height="${w.toFixed(4)}" fill="none" stroke="${C_CUT}" stroke-width="0.035"/>`;
  if (pc.flushStart) g += `<text x="${(x0+0.08).toFixed(4)}" y="${(y0+w-0.08).toFixed(4)}" font-size="0.12" font-weight="800" font-family="Nunito,sans-serif" fill="${C_CUT}">RAW TOP</text>`;
  if (pc.flushEnd) g += `<text x="${(x0+cutL-0.08).toFixed(4)}" y="${(y0+w-0.08).toFixed(4)}" font-size="0.12" font-weight="800" font-family="Nunito,sans-serif" fill="${C_CUT}" text-anchor="end">RAW TOP</text>`;
  g += `<text x="${(x0 + 0.12).toFixed(4)}" y="${(y0 + w/2 + 0.07).toFixed(4)}" font-size="0.18" font-family="Nunito, sans-serif" fill="#333">${pc.label}</text>`;
  return g;
}

export function cpPiecePrintWidth(pc){
  return pc.cutWidthTop!==undefined ? Math.max(pc.cutWidthTop, pc.cutWidthBottom) : pc.cutWidth;
}

export function cpDrawTaperedStrip(pc){
  const { x0, y0, cutL, sa } = pc;
  const wTop=pc.cutWidthTop,wBot=pc.cutWidthBottom,maxW=Math.max(wTop,wBot);
  const yC=y0+maxW/2,x1=x0+cutL;
  const yTopAt=x=>{const t=cutL>1e-9?(x-x0)/cutL:0;return yC-(wTop+(wBot-wTop)*t)/2;};
  const yBotAt=x=>{const t=cutL>1e-9?(x-x0)/cutL:0;return yC+(wTop+(wBot-wTop)*t)/2;};
  const yTL=yTopAt(x0),yBL=yBotAt(x0),yTR=yTopAt(x1),yBR=yBotAt(x1);
  const cutPts=`${x0.toFixed(4)},${yTL.toFixed(4)} ${x1.toFixed(4)},${yTR.toFixed(4)} ${x1.toFixed(4)},${yBR.toFixed(4)} ${x0.toFixed(4)},${yBL.toFixed(4)}`;
  const sewStart=pc.flushStart?x0:x0+sa,sewEnd=pc.flushEnd?x1:x1-sa,midX=x0+cutL/2,midTop=yTopAt(midX),midBot=yBotAt(midX);
  let g=`<polygon points="${cutPts}" fill="#fbecef" fill-opacity="0.55" stroke="none"/>`;
  if(pc.plan){
    for(const mk of pc.plan.marks){
      const tx=sewStart+mk.s;
      if(tx<x0-1e-9||tx>x1+1e-9)continue;
      const len=mk.kind==="clip"?sa*.75:sa*.55,wgt=mk.kind==="clip"?.022:.016,yt=yTopAt(tx),yb=yBotAt(tx);
      g+=`<line x1="${tx.toFixed(4)}" y1="${yt.toFixed(4)}" x2="${tx.toFixed(4)}" y2="${(yt+len).toFixed(4)}" stroke="${C_NOTCH}" stroke-width="${wgt}"/>`;
      g+=`<line x1="${tx.toFixed(4)}" y1="${yb.toFixed(4)}" x2="${tx.toFixed(4)}" y2="${(yb-len).toFixed(4)}" stroke="${C_NOTCH}" stroke-width="${wgt}"/>`;
    }
  }
  g+=`<line x1="${midX.toFixed(4)}" y1="${midTop.toFixed(4)}" x2="${midX.toFixed(4)}" y2="${midBot.toFixed(4)}" stroke="${C_PIECE_CENTER}" stroke-width="0.016" stroke-dasharray="0.18 0.12"/>`;
  g+=`<line x1="${x0.toFixed(4)}" y1="${yC.toFixed(4)}" x2="${x1.toFixed(4)}" y2="${yC.toFixed(4)}" stroke="${C_PIECE_CENTER}" stroke-width="0.016" stroke-dasharray="0.18 0.12"/>`;
  if(sewEnd>sewStart){
    const stTop=yTopAt(sewStart)+sa,stBot=yBotAt(sewStart)-sa,enTop=yTopAt(sewEnd)+sa,enBot=yBotAt(sewEnd)-sa;
    const sewPts=`${sewStart.toFixed(4)},${stTop.toFixed(4)} ${sewEnd.toFixed(4)},${enTop.toFixed(4)} ${sewEnd.toFixed(4)},${enBot.toFixed(4)} ${sewStart.toFixed(4)},${stBot.toFixed(4)}`;
    g+=`<polygon points="${sewPts}" fill="none" stroke="${C_SEW}" stroke-width="0.02" stroke-dasharray="0.15 0.1"/>`;
  }
  if(pc.landmarks){
    for(const L of pc.landmarks){
      const tx=sewStart+L.s;
      if(tx<x0-1e-9||tx>x1+1e-9)continue;
      const yt=yTopAt(tx)+sa,yb=yBotAt(tx)-sa;
      if(L.kind==="junction"){g+=cpSquareMark(tx,yt)+cpSquareMark(tx,yb);}else{g+=cpDiamondMark(tx,yt)+cpDiamondMark(tx,yb);}
    }
  }
  g+=cpTriangleH(midX,midTop,+1)+cpTriangleH(midX,midBot,-1)+cpTriangleV(x0,yC,+1)+cpTriangleV(x1,yC,-1);
  g+=`<polygon points="${cutPts}" fill="none" stroke="${C_CUT}" stroke-width="0.035" stroke-linejoin="round"/>`;
  if(pc.flushStart)g+=`<text x="${(x0+0.08).toFixed(4)}" y="${(yBL-0.08).toFixed(4)}" font-size="0.12" font-weight="800" font-family="Nunito,sans-serif" fill="${C_CUT}">RAW TOP</text>`;
  if(pc.flushEnd)g+=`<text x="${(x1-0.08).toFixed(4)}" y="${(yBR-0.08).toFixed(4)}" font-size="0.12" font-weight="800" font-family="Nunito,sans-serif" fill="${C_CUT}" text-anchor="end">RAW TOP</text>`;
  g+=`<text x="${(x0+0.12).toFixed(4)}" y="${(yC+0.07).toFixed(4)}" font-size="0.18" font-family="Nunito, sans-serif" fill="#333">${pc.label}</text>`;
  return g;
}

/* ---- PRINT: MAIN PANEL ---- */
export function cpPrintPanel(m,p){
  if(!m.valid)return;
  const PADIN=0.4;
  const originX=m.cutBB.minX-PADIN,originY=m.cutBB.minY-PADIN;
  const spanW=m.cutBB.w+PADIN*2,spanH=m.cutBB.h+PADIN*2;
  const shift=pts=>pts.map(q=>({x:q.x-originX,y:q.y-originY,side:q.side}));
  const active=m.activeSew;
  let geom="";
  geom+=`<path d="${cpPtsToPath(shift(active.pts),active.closed)}" fill="none" stroke="${C_SEW}" stroke-width="0.022" stroke-dasharray="0.15 0.1"/>`;
  const stabPts=(!p.stabilizerSeparate ? cpStabilizerPoints(m,p) : null);
  if(stabPts)geom+=`<path d="${cpPtsToPath(shift(stabPts),true)}" fill="none" stroke="${C_STAB}" stroke-width="0.026" stroke-dasharray="0.10 0.08"/>`;
  const midX=(m.frame[0].x+m.frame[1].x)/2-originX;
  geom+=`<line x1="${midX.toFixed(4)}" y1="${(m.cutBB.minY-originY-0.05).toFixed(4)}" x2="${midX.toFixed(4)}" y2="${(m.cutBB.maxY-originY+0.05).toFixed(4)}" stroke="${C_CENTER}" stroke-width="0.018" stroke-dasharray="0.25 0.15"/>`;
  geom+=`<path d="${cpPtsToPath(shift(m.cutPts),true)}" fill="none" stroke="${C_CUT}" stroke-width="0.04"/>`;
  shift(active.junctions||[]).forEach(j=>geom+=cpSquareMark(j.x,j.y));
  shift(active.midpoints||[]).forEach(mp=>geom+=cpDiamondMark(mp.x,mp.y));
  const mds=cpMarkDetails(m.cutPts,m.marks,originX,originY);
  mds.forEach((md,mi)=>{
    const mark=m.marks[mi],isEdge=!mark||mark.kind!=="blend";
    geom+=cpTriangleMark(md.x,md.y,md.nx,md.ny,md.tx,md.ty,isEdge?1:.5);
    if(isEdge)geom+=cpPerpTick(md.x,md.y,md.nx,md.ny);
  });
  const open=p.topMode==="3side";
  const r=active.runs;
  const detailRows=[
    ["Cut size",cpFmt(m.cutBB.w)+" W × "+cpFmt(m.cutBB.h)+" H"],
    [open?"Open sewline size":"Sewline size",cpFmt(active.bb.w)+" W × "+cpFmt(active.bb.h)+" H"],
    ["Cut perimeter",cpFmt(m.cutPerim)+"  ("+cpFmtD(m.cutPerim)+")"],
    [open?"Three-sided sewline length":"Sewline perimeter",cpFmt(active.total)+"  ("+cpFmtD(active.total)+")"],
    ["Seam allowance",cpFmt(p.sa)],
    ...(p.stabilizerOn ? [["Stabilizer inset",cpFmt(p.stabilizerInset)+(p.stabilizerSeparate?" · printed separately":" · guide shown on main panel")]] : []),
    ["Fullness / crown","Left "+cpFmt(m.crowns.hL)+" · Right "+cpFmt(m.crowns.hR)+" · Top "+cpFmt(m.crowns.hTop)+" · Bottom "+cpFmt(m.crowns.hBot)+" · feel: "+p.feel],
    ["Corner softness","top "+cpFmt(m.softness.ts)+" · bottom "+cpFmt(m.softness.bs)+" (0 = crisp)"],
    ["Construction",open?"3-sided open top":"4-sided enclosed"],
    ["Sewline side runs",open
      ?("Right "+cpFmt(r.right)+" · Bottom "+cpFmt(r.bottom)+" · Left "+cpFmt(r.left)+" · Top open")
      :("Top "+cpFmt(r.top)+" · Right "+cpFmt(r.right)+" · Bottom "+cpFmt(r.bottom)+" · Left "+cpFmt(r.left))]
  ];
  cpPrintDoc("Curved Panel — Main Panel",geom,spanW,spanH,detailRows,
    "Purple = cut line · grey dashed = sewline · lavender dotted = stabilizer guide · cyan dashed = center fold line. ▲ = center/fold mark · □ = side junction · ◇ = side midpoint.");
}

/* ---- PRINT: STABILIZER ---- */
export function cpPrintStabilizer(m,p){
  if(!m.valid)return;
  const pts=cpStabilizerPoints(m,p);
  if(!pts?.length)return;
  const bb=cpPtsBB(pts),PADIN=0.4;
  const originX=bb.minX-PADIN,originY=bb.minY-PADIN;
  const shift=qpts=>qpts.map(q=>({x:q.x-originX,y:q.y-originY,side:q.side}));
  const spanW=bb.w+PADIN*2,spanH=bb.h+PADIN*2;
  const midX=(m.frame[0].x+m.frame[1].x)/2-originX;
  let geom="";
  geom+=`<line x1="${midX.toFixed(4)}" y1="0.05" x2="${midX.toFixed(4)}" y2="${(spanH-0.05).toFixed(4)}" stroke="${C_CENTER}" stroke-width="0.018" stroke-dasharray="0.25 0.15"/>`;
  geom+=`<path d="${cpPtsToPath(shift(pts),true)}" fill="none" stroke="${C_STAB}" stroke-width="0.04"/>`;
  const detailRows=[
    ["Stabilizer size",cpFmt(bb.w)+" W × "+cpFmt(bb.h)+" H"],
    ["Inset from panel cut line",cpFmt(p.stabilizerInset)],
    ["Use with","Curved Panel — Main Panel"]
  ];
  cpPrintDoc("Curved Panel — Stabilizer",geom,spanW,spanH,detailRows,
    "Lavender = stabilizer cut line · cyan dashed = center fold line. Print at 100% / Actual Size.");
}

/* ---- PRINT: SIDE PANELS ---- */
export function cpPrintSides(m,p){
  if(!m.valid||!m.displaySidePieces?.length)return;
  const PADIN=.4,GAP=.55;
  const pieces=m.displaySidePieces;
  const isTapered=pieces.some(pc=>pc.cutWidthTop!==undefined&&Math.abs(pc.cutWidthTop-pc.cutWidthBottom)>1e-9);
  let geom="",y=PADIN,maxL=0;
  const detailRows=[
    [isTapered?"Side depth / taper":"Strip width (all)",isTapered?`top ${cpFmt(p.depthTop)} · bottom ${cpFmt(p.depthBottom)} finished`:`${cpFmt(p.sideDepth+2*p.sa)} cut · ${cpFmt(p.sideDepth)} finished`],
    ["Seam allowance",cpFmt(p.sa)]
  ];
  for(const pc of pieces){
    const pieceW=cpPiecePrintWidth(pc);
    const taper=pc.cutWidthTop!==undefined&&Math.abs(pc.cutWidthTop-pc.cutWidthBottom)>1e-9;
    if(taper){
      geom+=cpDrawTaperedStrip({x0:PADIN,y0:y,cutL:pc.cutLength,sa:p.sa,flushStart:pc.flushStart,flushEnd:pc.flushEnd,runLen:pc.runLength,plan:pc.plan,landmarks:pc.landmarks,label:pc.label,cutWidthTop:pc.cutWidthTop,cutWidthBottom:pc.cutWidthBottom});
      detailRows.push([pc.label,`cut ${cpFmt(pc.cutLength)} × ${cpFmt(pc.cutWidthTop)} top / ${cpFmt(pc.cutWidthBottom)} bottom · sewline run ${cpFmt(pc.runLength)}`]);
    }else{
      geom+=cpDrawStrip({x0:PADIN,y0:y,cutL:pc.cutLength,w:pieceW,sa:p.sa,flushStart:pc.flushStart,flushEnd:pc.flushEnd,runLen:pc.runLength,plan:pc.plan,landmarks:pc.landmarks,label:pc.label});
      detailRows.push([pc.label,`cut ${cpFmt(pc.cutLength)} × ${cpFmt(pieceW)} · sewline run ${cpFmt(pc.runLength)}`]);
    }
    maxL=Math.max(maxL,pc.cutLength);y+=pieceW+GAP;
  }
  cpPrintDoc("Curved Panel — Side Panels",geom,maxL+PADIN*2,y-GAP+PADIN,detailRows,"Maroon = cut · grey dashed = sewline · cyan = piece midpoint. Blue marks are suggested clipping/notching positions; stop before the sewline. Tapered side pieces preserve the top and bottom depths shown in the cutting list.");
}

/* ---- PRINT: GUSSET ---- */
export function cpPrintGusset(m,p){
  const pc=m.gussetPiece;
  if(!m.valid||!pc)return;
  const sa=p.sa,w=pc.cutWidth,cutL=pc.cutLength,run=pc.runLength,PADIN=.4;
  const sy=pc.open?PADIN:PADIN+pc.startAllowance;
  const ey=pc.open?PADIN+cutL:sy+run;
  const midY=PADIN+cutL/2,midX=PADIN+w/2;
  let geom=`<rect x="${PADIN}" y="${PADIN}" width="${w.toFixed(4)}" height="${cutL.toFixed(4)}" fill="#fbecef" fill-opacity="0.55" stroke="none"/>`;
  for(const mk of pc.plan.marks){
    const ty=sy+mk.s,len=mk.kind==="clip"?sa*.75:sa*.55,wgt=mk.kind==="clip"?.022:.016;
    geom+=`<line x1="${PADIN}" y1="${ty.toFixed(4)}" x2="${(PADIN+len).toFixed(4)}" y2="${ty.toFixed(4)}" stroke="${C_NOTCH}" stroke-width="${wgt}"/>`;
    geom+=`<line x1="${(PADIN+w).toFixed(4)}" y1="${ty.toFixed(4)}" x2="${(PADIN+w-len).toFixed(4)}" y2="${ty.toFixed(4)}" stroke="${C_NOTCH}" stroke-width="${wgt}"/>`;
  }
  geom+=`<line x1="${midX.toFixed(4)}" y1="${PADIN}" x2="${midX.toFixed(4)}" y2="${(PADIN+cutL).toFixed(4)}" stroke="${C_PIECE_CENTER}" stroke-width="0.018" stroke-dasharray="0.22 0.14"/>`;
  geom+=`<line x1="${PADIN}" y1="${midY.toFixed(4)}" x2="${(PADIN+w).toFixed(4)}" y2="${midY.toFixed(4)}" stroke="${C_PIECE_CENTER}" stroke-width="0.018" stroke-dasharray="0.22 0.14"/>`;
  let d=`M ${(PADIN+sa).toFixed(4)} ${sy.toFixed(4)} V ${ey.toFixed(4)} M ${(PADIN+w-sa).toFixed(4)} ${sy.toFixed(4)} V ${ey.toFixed(4)}`;
  if(!pc.open) d+=` M ${(PADIN+sa).toFixed(4)} ${sy.toFixed(4)} H ${(PADIN+w-sa).toFixed(4)} M ${(PADIN+sa).toFixed(4)} ${ey.toFixed(4)} H ${(PADIN+w-sa).toFixed(4)}`;
  geom+=`<path d="${d}" fill="none" stroke="${C_SEW}" stroke-width="0.022" stroke-dasharray="0.15 0.1"/>`;
  for(const L of pc.landmarks){
    const ty=sy+L.s;
    if(L.kind==="junction"){geom+=cpSquareMark(PADIN+sa,ty)+cpSquareMark(PADIN+w-sa,ty);}
    else{geom+=cpDiamondMark(PADIN+sa,ty)+cpDiamondMark(PADIN+w-sa,ty);}
  }
  geom+=cpTriangleH(midX,PADIN,+1)+cpTriangleH(midX,PADIN+cutL,-1);
  geom+=cpTriangleV(PADIN,midY,+1)+cpTriangleV(PADIN+w,midY,-1);
  geom+=`<rect x="${PADIN}" y="${PADIN}" width="${w.toFixed(4)}" height="${cutL.toFixed(4)}" fill="none" stroke="${C_CUT}" stroke-width="0.04"/>`;
  const detailRows=[
    ["Gusset strip","cut "+cpFmt(cutL)+" × "+cpFmt(w)+" · finished width "+cpFmt(pc.finishedWidth)],
    ["Sewline run",cpFmt(run)],
    ["Seam allowance",cpFmt(p.sa)],
    ["Construction",pc.open?"3-sided open top":"4-sided enclosed"]
  ];
  cpPrintDoc("Curved Panel — Gusset",geom,w+PADIN*2,cutL+PADIN*2,detailRows,
    "Maroon = cut · grey dashed = sewline/end allowance guides · pale dashed = horizontal and vertical centerlines. Triangles mark the midpoint of all four cut edges. Blue marks are suggested clipping/notching positions; stop before the sewline.");
}
