import { useState } from "react";
import {
  buildCurvedPanelModel,
  fmtIn as cpFmtIn, fmtDec as cpFmtDec, ptsToPath as cpPtsToPath,
  markDetails as cpMarkDetails,
} from "../curved-panel-core.js";
import { isMetric, fmtCm, setCurrentUnit } from "../utils/formatting.js";
import { DEFAULT_SA } from "../utils/constants.js";
import {
  CP_TILE_W, CP_TILE_H,
  cpTilePlan, cpTileLabel, cpRowLabel, cpTestSquareSVG, cpRegistrationMarks,
} from "../utils/print-utils.js";
import PrintButton from "../components/PrintButton.jsx";
import FracInput from "../components/FracInput.jsx";
import {
  CAT_BAG_STRUCTURES,
  C_SEW, C_CENTER, C_EASING, C_STAB, C_MIDPOINT,
  W_CUT, W_SEW, W_STAB, W_CENTER, W_MIDPOINT,
  W_EASING_CLIP, W_EASING_NOTCH,
  DASH_SEW, DASH_STAB, DASH_CENTER,
  MIDPOINT_R, TRIANGLE_BASE, TRIANGLE_HEIGHT,
  GHOST_OPACITY, GHOST_WEIGHT, GHOST_OFFSET,
  FILL_OPACITY_SCREEN, STRIP_PAD,
} from "../diagramTokens.js";

// ══════════════════════════════════════════════════════════════════════════════
// ── CURVED PANEL — fair-curve calculator (replaces the old Advanced tab) ──────
// Geometry core lives in ./curved-panel-core.js (pure JS, shared with the
// standalone curved-panel-prototype.html). This section is UI + print only.
// ══════════════════════════════════════════════════════════════════════════════

// ── Curved Panel theme tokens (purple family) ─────────────────────────────────
const CP = {
  maroon:"#5a2da0", maroonDark:"#3c2068", rose:"#8f55d6",
  pinkBg:"#f4f0fd", pinkSoft:"#ede8f8", pinkLine:"#c4b0e8", ink:"#241550",
  muted:"#7a608e", green:"#1d6b45",
  amberBg:"#fdf3e0", amberInk:"#8a5a10", amberLine:"#e8c98a",
};

// Unit-aware display formatting: cm in metric mode, fractional inches otherwise.
// (Pattern tiles are 1:1 physical drawings and unaffected; only labels change.)
function cpFmt(v){ return isMetric() ? fmtCm(v) : cpFmtIn(v); }
function cpFmtD(v){ return isMetric() ? fmtCm(v) : cpFmtDec(v); }

/* =====================================================================
   TILED PRINT ENGINE — 7" × 10" tiles, Letter and A4 safe at 100%.
   Kept as-is from the standalone prototype: pure DOM generation.
   ===================================================================== */
/* Print colors — C_SEW, C_CENTER, C_STAB come from diagramTokens import */
const C_CUT    = CP.maroon;
const C_BORDER = "#000000";
const C_PIECE_CENTER = C_CENTER;  // alias: was wrong pink, now correct cyan from diagramTokens
const C_MARK   = CP.maroon;
const C_NOTCH  = C_EASING;        // alias: was wrong blue, now correct easing dark-cyan

function cpPrintDoc(title, geom, spanW, spanH, detailRows, legendLine, allowRotate=true){
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
      if(nbLeft)inner+=`<text x="${(vx+0.08).toFixed(3)}" y="${(vy+CP_TILE_H/2).toFixed(3)}" font-size="0.12" font-weight="700" font-family="Nunito,sans-serif" fill="#777">\u2190 ${nbLeft}</text>`;
      if(nbRight)inner+=`<text x="${(vx+CP_TILE_W-0.08).toFixed(3)}" y="${(vy+CP_TILE_H/2).toFixed(3)}" font-size="0.12" font-weight="700" font-family="Nunito,sans-serif" fill="#777" text-anchor="end">${nbRight} \u2192</text>`;
      if(nbUp)inner+=`<text x="${(vx+CP_TILE_W/2).toFixed(3)}" y="${(vy+0.15).toFixed(3)}" font-size="0.12" font-weight="700" font-family="Nunito,sans-serif" fill="#777" text-anchor="middle">\u2191 ${nbUp}</text>`;
      if(nbDown)inner+=`<text x="${(vx+CP_TILE_W/2).toFixed(3)}" y="${(vy+CP_TILE_H-0.08).toFixed(3)}" font-size="0.12" font-weight="700" font-family="Nunito,sans-serif" fill="#777" text-anchor="middle">\u2193 ${nbDown}</text>`;
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
    h1{font-size:15pt;margin:0 0 3pt;color:${CP.maroon}}h2{font-size:10pt;margin:0 0 8pt;color:#555}
    table{border-collapse:collapse;width:100%;font-size:10pt}td{border:1px solid #ddd;padding:4pt 7pt}td:first-child{font-weight:700;width:38%}
    .note{font-size:11pt;font-weight:800;color:#000;margin-top:9pt;line-height:1.5}.legend{font-size:7.5pt;color:#444;margin-top:5pt}
  </style></head><body>
    <div class="page"><h1>${title}</h1>
      <h2>MoonShot Bag Calculator \u00B7 ${plan.pages} pattern page${plan.pages===1?"":"s"} \u00B7 ${plan.rows} row(s) \u00D7 ${plan.cols} column(s) \u00B7 7\u2033 \u00D7 9.68\u2033 printable tiles${plan.rotated?" \u00B7 auto-rotated to use fewer pages":""}</h2>
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

/* symbol helpers */
function cpSquareMark(x, y){ const s = 0.055; return `<rect x="${(x-s).toFixed(4)}" y="${(y-s).toFixed(4)}" width="${(2*s).toFixed(4)}" height="${(2*s).toFixed(4)}" fill="none" stroke="${C_BORDER}" stroke-width="0.018" rx="0.01"/>`; }
function cpDiamondMark(x, y){ const d = 0.07; return `<polygon points="${x},${y-d} ${x+d},${y} ${x},${y+d} ${x-d},${y}" fill="none" stroke="${C_SEW}" stroke-width="0.018"/>`; }

/* Inward-pointing skinny triangle at point (px,py) on the cut line. */
function cpTriangleMark(px, py, nx, ny, tang_x, tang_y, scale = 1){
  const base = 0.16 * scale, height = 0.26 * scale;  // 2× — center fold/match marks; arc-blend marks at 50%
  const b1x = px - tang_x * base/2, b1y = py - tang_y * base/2;
  const b2x = px + tang_x * base/2, b2y = py + tang_y * base/2;
  const apx = px + nx * height,     apy = py + ny * height;
  return `<polygon points="${b1x.toFixed(4)},${b1y.toFixed(4)} ${b2x.toFixed(4)},${b2y.toFixed(4)} ${apx.toFixed(4)},${apy.toFixed(4)}" fill="${C_MARK}" stroke="none"/>`;
}

/* Perpendicular tick at point (px,py), direction inward (nx,ny). */
function cpPerpTick(px, py, nx, ny){
  const len = 0.14;
  return `<line x1="${px.toFixed(4)}" y1="${py.toFixed(4)}" x2="${(px + nx*len).toFixed(4)}" y2="${(py + ny*len).toFixed(4)}" stroke="${C_MARK}" stroke-width="0.025"/>`;
}

/* Inward-pointing triangle on a HORIZONTAL strip edge. */
function cpTriangleH(px, py, inward){
  const base = 0.16, ht = 0.22;
  const bL = px - base/2, bR = px + base/2;
  const apex = py + inward * ht;
  return `<polygon points="${bL.toFixed(4)},${py.toFixed(4)} ${bR.toFixed(4)},${py.toFixed(4)} ${px.toFixed(4)},${apex.toFixed(4)}" fill="${C_MARK}" stroke="none"/>`;
}
function cpTriangleV(px, py, inward){
  const base = 0.16, ht = 0.22;
  const bT = py - base/2, bB = py + base/2;
  const apex = px + inward * ht;
  return `<polygon points="${px.toFixed(4)},${bT.toFixed(4)} ${px.toFixed(4)},${bB.toFixed(4)} ${apex.toFixed(4)},${py.toFixed(4)}" fill="${C_MARK}" stroke="none"/>`;
}

function cpCleanClosedPts(pts){
  const out=[];
  for(const p of pts||[]){
    if(!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const last=out[out.length-1];
    if(!last || Math.hypot(last.x-p.x,last.y-p.y)>1e-3) out.push({x:p.x,y:p.y,side:p.side});
  }
  if(out.length>2 && Math.hypot(out[0].x-out[out.length-1].x,out[0].y-out[out.length-1].y)<1e-3) out.pop();
  return out;
}

function cpSimplifyCollinearClosedPts(pts){
  const p=cpCleanClosedPts(pts);
  if(p.length<4)return p;
  const out=[];
  const n=p.length;
  for(let i=0;i<n;i++){
    const a=p[(i-1+n)%n],b=p[i],c=p[(i+1)%n];
    const abx=b.x-a.x,aby=b.y-a.y,bcx=c.x-b.x,bcy=c.y-b.y;
    const ab=Math.hypot(abx,aby),bc=Math.hypot(bcx,bcy);
    if(ab<1e-8||bc<1e-8)continue;
    const cross=Math.abs(abx*bcy-aby*bcx)/(ab*bc);
    const dot=(abx*bcx+aby*bcy)/(ab*bc);
    // Dense straight-edge samples make the inset path collapse/backtrack at crisp corners.
    // Drop only truly collinear same-direction points; curved samples are preserved.
    if(cross<1e-7&&dot>0.999999)continue;
    out.push(b);
  }
  return out.length>=3?out:p;
}

function cpCentroid(pts){
  if(!pts.length)return {x:0,y:0};
  let x=0,y=0;
  for(const p of pts){x+=p.x;y+=p.y;}
  return {x:x/pts.length,y:y/pts.length};
}

function cpLineIntersect(a1,a2,b1,b2){
  const x1=a1.x,y1=a1.y,x2=a2.x,y2=a2.y,x3=b1.x,y3=b1.y,x4=b2.x,y4=b2.y;
  const den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
  if(Math.abs(den)<1e-9)return null;
  const px=((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4))/den;
  const py=((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4))/den;
  if(!Number.isFinite(px)||!Number.isFinite(py))return null;
  return {x:px,y:py};
}

/* Approximate inset path used only for stabilizer guides/print pieces.
   The true panel geometry still comes from curved-panel-core.js. */
function cpSegmentsIntersect(p1,p2,p3,p4){
  const d1x=p2.x-p1.x,d1y=p2.y-p1.y,d2x=p4.x-p3.x,d2y=p4.y-p3.y;
  const cross=d1x*d2y-d1y*d2x;
  if(Math.abs(cross)<1e-10)return false;
  const t=((p3.x-p1.x)*d2y-(p3.y-p1.y)*d2x)/cross;
  const u=((p3.x-p1.x)*d1y-(p3.y-p1.y)*d1x)/cross;
  return t>1e-9&&t<1-1e-9&&u>1e-9&&u<1-1e-9;
}

function cpDist(a,b){return Math.hypot((b?.x||0)-(a?.x||0),(b?.y||0)-(a?.y||0));}
function cpUnit(x,y){const l=Math.hypot(x,y)||1e-9;return {x:x/l,y:y/l};}
function cpCrossZ(d,p,o){return d.x*(p.y-o.y)-d.y*(p.x-o.x);}
function cpLineDirIntersect(p1,d1,p2,d2){
  const den=d1.x*d2.y-d1.y*d2.x;
  if(Math.abs(den)<1e-9)return null;
  const t=((p2.x-p1.x)*d2.y-(p2.y-p1.y)*d2.x)/den;
  return {x:p1.x+d1.x*t,y:p1.y+d1.y*t};
}
function cpDedupePath(pts,closed=false){
  const out=[];
  for(const p of pts||[]){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    if(!out.length||cpDist(out[out.length-1],p)>1e-7)out.push({...p});
  }
  if(closed&&out.length>2&&cpDist(out[0],out[out.length-1])<1e-7)out.pop();
  return out;
}
function cpOffsetOpenPath(pts,d){
  const p=cpDedupePath(pts,false);
  const n=p.length,out=[];
  for(let i=0;i<n;i++){
    const a=p[Math.max(0,i-1)],b=p[Math.min(n-1,i+1)];
    const u=cpUnit(b.x-a.x,b.y-a.y);
    out.push({x:p[i].x-u.y*d,y:p[i].y+u.x*d,side:p[i].side});
  }
  return out;
}
function cpJoinOffsetPair(A,B){
  if(A.length<2||B.length<2)return;
  const a0=A[A.length-1],b0=B[0];
  const ta=cpUnit(a0.x-A[A.length-2].x,a0.y-A[A.length-2].y);
  const tb=cpUnit(B[1].x-b0.x,B[1].y-b0.y);
  const den=ta.x*tb.y-ta.y*tb.x;
  if(Math.abs(den)<1e-5&&ta.x*tb.x+ta.y*tb.y>0.98){
    const M={x:(a0.x+b0.x)/2,y:(a0.y+b0.y)/2};
    A[A.length-1]={...M,side:A[A.length-1].side};
    B[0]={...M,side:B[0].side};
    return;
  }
  const X=cpLineDirIntersect(a0,ta,b0,tb);
  if(!X)return;
  const refA=Math.sign(cpCrossZ(tb,A[Math.floor(A.length/2)],b0))||1;
  while(A.length>2&&Math.sign(cpCrossZ(tb,A[A.length-1],b0))!==refA)A.pop();
  const refB=Math.sign(cpCrossZ(ta,B[Math.floor(B.length/2)],a0))||1;
  while(B.length>2&&Math.sign(cpCrossZ(ta,B[0],a0))!==refB)B.shift();
  if(cpDist(A[A.length-1],X)>1e-7)A.push({...X,side:A[A.length-1].side});
  else A[A.length-1]={...X,side:A[A.length-1].side};
  if(cpDist(B[0],X)>1e-7)B.unshift({...X,side:B[0].side});
  else B[0]={...X,side:B[0].side};
}
function cpOffsetSidePaths(sidePaths,inset){
  const out={};
  for(const side of ["top","right","bottom","left"])out[side]=cpOffsetOpenPath(sidePaths[side]||[],inset).map(q=>({...q,side}));
  cpJoinOffsetPair(out.top,out.right);
  cpJoinOffsetPair(out.right,out.bottom);
  cpJoinOffsetPair(out.bottom,out.left);
  cpJoinOffsetPair(out.left,out.top);
  for(const side of ["top","right","bottom","left"])out[side]=cpDedupePath(out[side],false).map(q=>({...q,side}));
  return out;
}
function cpCombineSidePaths(sidePaths,closed=true){
  const out=[];
  for(const side of ["top","right","bottom","left"]){
    const path=sidePaths[side]||[];
    for(let i=0;i<path.length;i++){
      if(out.length&&i===0&&cpDist(out[out.length-1],path[i])<1e-7)continue;
      out.push({...path[i],side});
    }
  }
  if(closed&&out.length>2&&cpDist(out[0],out[out.length-1])<1e-7)out.pop();
  return out;
}
function cpHasSelfCross(pts){
  const n=pts?.length||0;
  if(n<4)return false;
  for(let i=0;i<n;i++){
    for(let j=i+2;j<n;j++){
      if(i===0&&j===n-1)continue;
      if(cpSegmentsIntersect(pts[i],pts[(i+1)%n],pts[j],pts[(j+1)%n]))return true;
    }
  }
  return false;
}

function cpInsetClosedPoints(pts, inset){
  const p=cpSimplifyCollinearClosedPts(pts);
  if(p.length<3||!inset)return null;
  function build(ins){
    const c=cpCentroid(p),segs=[];
    for(let i=0;i<p.length;i++){
      const a=p[i],b=p[(i+1)%p.length];
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      // skip segments shorter than 1/32" — degenerate, produces garbage normals
      if(len<0.03125) continue;
      let nx=-dy/len,ny=dx/len;
      const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      if((c.x-mx)*nx+(c.y-my)*ny<0){nx=-nx;ny=-ny;}
      segs.push({a:{x:a.x+nx*ins,y:a.y+ny*ins},b:{x:b.x+nx*ins,y:b.y+ny*ins},nx,ny,srcIdx:i});
    }
    if(segs.length<3) return null;
    const out=[];
    for(let i=0;i<segs.length;i++){
      const prev=segs[(i-1+segs.length)%segs.length],next=segs[i];
      const si=next.srcIdx;
      let q=cpLineIntersect(prev.a,prev.b,next.a,next.b);
      if(!q||Math.hypot(q.x-p[si].x,q.y-p[si].y)>Math.max(2,ins*4)){
        const nx=prev.nx+next.nx,ny=prev.ny+next.ny,nl=Math.hypot(nx,ny)||1;
        q={x:p[si].x+(nx/nl)*ins,y:p[si].y+(ny/nl)*ins};
      }
      out.push(q);
    }
    return out;
  }
  function hasCross(out){
    if(!out) return true;
    const n=out.length;
    for(let i=0;i<n;i++){
      for(let j=i+2;j<n;j++){
        if(i===0&&j===n-1)continue;
        if(cpSegmentsIntersect(out[i],out[(i+1)%n],out[j],out[(j+1)%n]))return true;
      }
    }
    return false;
  }
  const r=build(inset);
  if(!hasCross(r))return r;
  const r2=build(inset*0.8);
  return hasCross(r2)?null:r2;
}

function cpStabilizerPoints(m,p){
  if(!p?.stabilizerOn||!(p.stabilizerInset>0)||!m?.cutPts?.length||!m?.cutBB)return null;
  const maxInset=Math.min(
    p.stabilizerInset,
    m.cutBB.w/2-p.sa-0.125,
    m.cutBB.h/2-p.sa-0.125
  );
  const inset=Math.max(0,maxInset);
  if(!(inset>0))return null;

  // Prefer side-aware offsetting so crisp, zero-radius corners do not collapse the guide.
  if(m.cutSides?.top&&m.cutSides?.right&&m.cutSides?.bottom&&m.cutSides?.left){
    const sidePaths=cpOffsetSidePaths(m.cutSides,inset);
    const pts=cpCombineSidePaths(sidePaths,true);
    if(pts.length>=3&&!cpHasSelfCross(pts))return pts;
  }

  return cpInsetClosedPoints(m.cutPts,inset);
}

function cpPtsBB(pts){
  if(!pts?.length)return null;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of pts){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  return {minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY};
}

/* Z-order in cpDrawStrip: notches → center line → sewline → landmarks → center triangles → cut rect */
function cpDrawStrip(pc){
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

/* ---- PRINT: MAIN PANEL ---- */
function cpPrintPanel(m,p){
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
    ["Cut size",cpFmt(m.cutBB.w)+" W \u00D7 "+cpFmt(m.cutBB.h)+" H"],
    [open?"Open sewline size":"Sewline size",cpFmt(active.bb.w)+" W \u00D7 "+cpFmt(active.bb.h)+" H"],
    ["Cut perimeter",cpFmt(m.cutPerim)+"  ("+cpFmtD(m.cutPerim)+")"],
    [open?"Three-sided sewline length":"Sewline perimeter",cpFmt(active.total)+"  ("+cpFmtD(active.total)+")"],
    ["Seam allowance",cpFmt(p.sa)],
    ...(p.stabilizerOn ? [["Stabilizer inset",cpFmt(p.stabilizerInset)+(p.stabilizerSeparate?" · printed separately":" · guide shown on main panel")]] : []),
    ["Fullness / crown","Left "+cpFmt(m.crowns.hL)+" \u00B7 Right "+cpFmt(m.crowns.hR)+" \u00B7 Top "+cpFmt(m.crowns.hTop)+" \u00B7 Bottom "+cpFmt(m.crowns.hBot)+" \u00B7 feel: "+p.feel],
    ["Corner softness","top "+cpFmt(m.softness.ts)+" \u00B7 bottom "+cpFmt(m.softness.bs)+" (0 = crisp)"],
    ["Construction",open?"3-sided open top":"4-sided enclosed"],
    ["Sewline side runs",open
      ?("Right "+cpFmt(r.right)+" \u00B7 Bottom "+cpFmt(r.bottom)+" \u00B7 Left "+cpFmt(r.left)+" \u00B7 Top open")
      :("Top "+cpFmt(r.top)+" \u00B7 Right "+cpFmt(r.right)+" \u00B7 Bottom "+cpFmt(r.bottom)+" \u00B7 Left "+cpFmt(r.left))]
  ];
  cpPrintDoc("Curved Panel \u2014 Main Panel",geom,spanW,spanH,detailRows,
    "Purple = cut line \u00B7 grey dashed = sewline \u00B7 lavender dotted = stabilizer guide \u00B7 cyan dashed = center fold line. \u25B2 = center/fold mark \u00B7 \u25A1 = side junction \u00B7 \u25C7 = side midpoint.");
}
/* ---- PRINT: STABILIZER ---- */
function cpPrintStabilizer(m,p){
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
function cpPrintSides(m,p){
  if(!m.valid||!m.displaySidePieces?.length)return;
  const PADIN=.4,GAP=.55;
  const pieces=m.displaySidePieces,w=p.sideDepth+2*p.sa;
  let geom="",y=PADIN,maxL=0;
  const detailRows=[["Strip width (all)",cpFmt(w)+" cut \u00B7 "+cpFmt(p.sideDepth)+" finished"],["Seam allowance",cpFmt(p.sa)]];
  for(const pc of pieces){
    geom+=cpDrawStrip({x0:PADIN,y0:y,cutL:pc.cutLength,w,sa:p.sa,flushStart:pc.flushStart,flushEnd:pc.flushEnd,
      runLen:pc.runLength,plan:pc.plan,landmarks:pc.landmarks,label:pc.label});
    detailRows.push([pc.label,"cut "+cpFmt(pc.cutLength)+" \u00D7 "+cpFmt(w)+" \u00B7 sewline run "+cpFmt(pc.runLength)]);
    maxL=Math.max(maxL,pc.cutLength);y+=w+GAP;
  }
  cpPrintDoc("Curved Panel \u2014 Side Panels",geom,maxL+PADIN*2,y-GAP+PADIN,detailRows,
    "Maroon = cut \u00B7 grey dashed = sewline \u00B7 cyan = piece midpoint. Blue marks are suggested clipping/notching positions; stop before the sewline. Open-top left/right pieces have one raw-top end with no lengthwise seam allowance.");
}

/* ---- PRINT: GUSSET ---- */
function cpPrintGusset(m,p){
  const pc=m.gussetPiece;
  if(!m.valid||!pc)return;
  const sa=p.sa,w=pc.cutWidth,cutL=pc.cutLength,run=pc.runLength,PADIN=.4;
  const sy=PADIN+pc.startAllowance,ey=sy+run;
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
  d+=` M ${(PADIN+sa).toFixed(4)} ${sy.toFixed(4)} H ${(PADIN+w-sa).toFixed(4)} M ${(PADIN+sa).toFixed(4)} ${ey.toFixed(4)} H ${(PADIN+w-sa).toFixed(4)}`;
  geom+=`<path d="${d}" fill="none" stroke="${C_SEW}" stroke-width="0.022" stroke-dasharray="0.15 0.1"/>`;
  for(const L of pc.landmarks){
    const ty=sy+L.s;
    if(L.kind==="junction"){geom+=cpSquareMark(PADIN+sa,ty)+cpSquareMark(PADIN+w-sa,ty);}
    else{geom+=cpDiamondMark(PADIN+sa,ty)+cpDiamondMark(PADIN+w-sa,ty);}
  }
  let acc=0;
  for(const z of pc.zones.slice(0,-1)){
    acc+=z.length;
    const ty=sy+acc;
    geom+=`<line x1="${PADIN}" y1="${ty.toFixed(4)}" x2="${(PADIN+w).toFixed(4)}" y2="${ty.toFixed(4)}" stroke="${C_PIECE_CENTER}" stroke-width="0.012" stroke-dasharray="0.08 0.08" opacity=".75"/>`;
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

/* =====================================================================
   ON-SCREEN DIAGRAM + PIECE RENDERERS (ported from prototype render())
   ===================================================================== */

/* Main panel diagram — returns inner SVG markup for a 760×520 viewBox. */
function cpPanelDiagramSVG(model,params){
  const VW=760,VH=490,PAD_X=28,PAD_TOP=28,PAD_BOT=48,bb=model.cutBB;
  const scale=Math.min((VW-PAD_X*2)/bb.w,(VH-PAD_TOP-PAD_BOT)/bb.h);
  const ox=(VW-bb.w*scale)/2-bb.minX*scale;
  const oy=PAD_TOP+(VH-PAD_TOP-PAD_BOT-bb.h*scale)/2-bb.minY*scale;
  const X=v=>v*scale+ox,Y=v=>v*scale+oy,map=pts=>pts.map(p=>({x:X(p.x),y:Y(p.y)}));
  const active=model.activeSew;
  let svg="";
  const fr=model.frame,midX=(fr[0].x+fr[1].x)/2;
  svg+=`<line x1="${X(midX).toFixed(1)}" y1="${Y(bb.minY).toFixed(1)}" x2="${X(midX).toFixed(1)}" y2="${Y(bb.maxY).toFixed(1)}" stroke="#00bcd4" stroke-width="1.2" stroke-dasharray="4 6" opacity="0.6"/>`;
  svg+=`<path d="${cpPtsToPath(map(active.pts),active.closed)}" fill="none" stroke="#8a8a8a" stroke-width="2" stroke-dasharray="9 7"/>`;
  const MIN=14;
  function dedup(pts){const kept=[];for(const p of pts){const sx=X(p.x),sy=Y(p.y);if(kept.every(k=>Math.hypot(k.sx-sx,k.sy-sy)>=MIN))kept.push({p,sx,sy});}return kept.map(k=>k.p);}
  const junctions=dedup(active.junctions||[]),midpoints=dedup(active.midpoints||[]);
  for(const j of junctions){const cx=X(j.x),cy=Y(j.y),q=3.8;svg+=`<rect x="${(cx-q).toFixed(1)}" y="${(cy-q).toFixed(1)}" width="${(2*q).toFixed(1)}" height="${(2*q).toFixed(1)}" fill="#fff" stroke="${CP.maroon}" stroke-width="1.8" rx="1"/>`;}
  for(const m of midpoints){const cx=X(m.x),cy=Y(m.y),d=5;svg+=`<polygon points="${cx.toFixed(1)},${(cy-d).toFixed(1)} ${(cx+d).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${(cy+d).toFixed(1)} ${(cx-d).toFixed(1)},${cy.toFixed(1)}" fill="#fff" stroke="#8a8a8a" stroke-width="1.8"/>`;}
  const mds=cpMarkDetails(model.cutPts,model.marks,0,0);
  mds.forEach((md,mi)=>{
    const isEdge=!model.marks[mi]||model.marks[mi].kind!=="blend",px=X(md.x),py=Y(md.y),base=isEdge?7:3.8,ht=isEdge?11:6;
    const b1x=px-md.tx*base/2,b1y=py-md.ty*base/2,b2x=px+md.tx*base/2,b2y=py+md.ty*base/2,ax=px+md.nx*ht,ay=py+md.ny*ht;
    svg+=`<polygon points="${b1x.toFixed(1)},${b1y.toFixed(1)} ${b2x.toFixed(1)},${b2y.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}" fill="${CP.maroon}"/>`;
    if(isEdge)svg+=`<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${(px+md.nx*11).toFixed(1)}" y2="${(py+md.ny*11).toFixed(1)}" stroke="${CP.maroon}" stroke-width="2"/>`;
  });
  const stabPts=cpStabilizerPoints(model,params);
  svg+=`<path d="${cpPtsToPath(map(model.cutPts),true)}" fill="#f6edff" stroke="${CP.maroon}" stroke-width="3.5" stroke-linejoin="round" fill-opacity="0.48"/>`;
  if(stabPts)svg+=`<path d="${cpPtsToPath(map(stabPts),true)}" fill="none" stroke="${C_STAB}" stroke-width="2" stroke-dasharray="4 5" opacity="0.95"/>`;
  return svg;
}

/* Mini strip diagram (on-screen). Returns an HTML string.
   Vertical orientation: length = height axis, width/depth = horizontal axis. */
function cpMiniStrip(cutL, cutW, label, dims, opts){
  const o=opts||{};
  const PAD=STRIP_PAD,MAX_H=190,MAX_W=120;
  const CAT=CAT_BAG_STRUCTURES;
  const scale=o.fitScale||Math.min(MAX_H/Math.max(cutL,1e-9),MAX_W/Math.max(cutW,1e-9));
  const drawL=cutL*scale,drawW=cutW*scale;
  const goOff=o.ghost?GHOST_OFFSET:0;
  const svgW=drawW+2*PAD+goOff,svgH=drawL+2*PAD+goOff;
  const x0=PAD,xRight=x0+drawW,yTop=PAD,yBottom=yTop+drawL;
  const midX=x0+drawW/2,midY=yTop+drawL/2;
  const saPx=(o.sa||0)*scale;
  const sy=o.flushStart?yTop:yTop+saPx,ey=o.flushEnd?yBottom:yBottom-saPx;
  const sewL=x0+saPx,sewR=xRight-saPx;
  let s=`<svg viewBox="0 0 ${svgW.toFixed(1)} ${svgH.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">`;
  // ghost — 20px right+down from primary piece, outline-only, 18% opacity
  if(o.ghost){
    s+=`<rect x="${(x0+GHOST_OFFSET).toFixed(1)}" y="${(yTop+GHOST_OFFSET).toFixed(1)}" width="${drawW.toFixed(1)}" height="${drawL.toFixed(1)}" fill="none" stroke="${CAT.color}" stroke-width="${GHOST_WEIGHT}" stroke-opacity="${GHOST_OPACITY}"/>`;
  }
  // fill tint
  s+=`<rect x="${x0.toFixed(1)}" y="${yTop.toFixed(1)}" width="${drawW.toFixed(1)}" height="${drawL.toFixed(1)}" fill="${CAT.fillTint}" fill-opacity="${FILL_OPACITY_SCREEN}" stroke="none"/>`;
  // easing marks — horizontal ticks from cut edges inward (never cross sewline)
  if(o.plan&&o.plan.marks.length){
    for(const mk of o.plan.marks){
      const ty=yTop+(o.flushStart?0:saPx)+mk.s*scale;
      const tl=mk.kind==="clip"?saPx*0.8:saPx*0.6;
      const wg=mk.kind==="clip"?W_EASING_CLIP:W_EASING_NOTCH;
      s+=`<line x1="${x0.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${(x0+tl).toFixed(1)}" y2="${ty.toFixed(1)}" stroke="${C_EASING}" stroke-width="${wg}"/>`;
      s+=`<line x1="${xRight.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${(xRight-tl).toFixed(1)}" y2="${ty.toFixed(1)}" stroke="${C_EASING}" stroke-width="${wg}"/>`;
    }
  }
  // sewline — vertical long sides + optional horizontal end caps
  if(saPx>0&&drawW>2*saPx){
    let d=`M ${sewL.toFixed(1)} ${sy.toFixed(1)} V ${ey.toFixed(1)} M ${sewR.toFixed(1)} ${sy.toFixed(1)} V ${ey.toFixed(1)}`;
    if(!o.flushStart) d+=` M ${sewL.toFixed(1)} ${sy.toFixed(1)} H ${sewR.toFixed(1)}`;
    if(!o.flushEnd)   d+=` M ${sewL.toFixed(1)} ${ey.toFixed(1)} H ${sewR.toFixed(1)}`;
    s+=`<path d="${d}" fill="none" stroke="${C_SEW}" stroke-width="${W_SEW}" stroke-dasharray="${DASH_SEW}"/>`;
  }
  // center lines (crosshair)
  s+=`<line x1="${midX.toFixed(1)}" y1="${yTop.toFixed(1)}" x2="${midX.toFixed(1)}" y2="${yBottom.toFixed(1)}" stroke="${C_CENTER}" stroke-width="${W_CENTER}" stroke-dasharray="${DASH_CENTER}"/>`;
  s+=`<line x1="${x0.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${xRight.toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${C_CENTER}" stroke-width="${W_CENTER}" stroke-dasharray="${DASH_CENTER}"/>`;
  // midpoint marks — red open circles on sewline at mid-length (long left + right sides)
  if(saPx>0){
    s+=`<circle cx="${sewL.toFixed(1)}" cy="${midY.toFixed(1)}" r="${MIDPOINT_R}" fill="#ffffff" stroke="${C_MIDPOINT}" stroke-width="${W_MIDPOINT}"/>`;
    s+=`<circle cx="${sewR.toFixed(1)}" cy="${midY.toFixed(1)}" r="${MIDPOINT_R}" fill="#ffffff" stroke="${C_MIDPOINT}" stroke-width="${W_MIDPOINT}"/>`;
  }
  // center match triangles — solid red, on cut line, pointing inward
  const tb=TRIANGLE_BASE,th=TRIANGLE_HEIGHT;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${yTop.toFixed(1)} ${(midX+tb/2).toFixed(1)},${yTop.toFixed(1)} ${midX.toFixed(1)},${(yTop+th).toFixed(1)}" fill="${C_MIDPOINT}"/>`;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${yBottom.toFixed(1)} ${(midX+tb/2).toFixed(1)},${yBottom.toFixed(1)} ${midX.toFixed(1)},${(yBottom-th).toFixed(1)}" fill="${C_MIDPOINT}"/>`;
  s+=`<polygon points="${x0.toFixed(1)},${(midY-tb/2).toFixed(1)} ${x0.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(x0+th).toFixed(1)},${midY.toFixed(1)}" fill="${C_MIDPOINT}"/>`;
  s+=`<polygon points="${xRight.toFixed(1)},${(midY-tb/2).toFixed(1)} ${xRight.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(xRight-th).toFixed(1)},${midY.toFixed(1)}" fill="${C_MIDPOINT}"/>`;
  // stabilizer — inset from all four sides
  if(o.stabInset>0){
    const stPx=o.stabInset*scale;
    const stabX=sewL+stPx,stabXR=sewR-stPx,stabY=sy+stPx,stabYB=ey-stPx;
    const stabW=Math.max(0,stabXR-stabX),stabH=Math.max(0,stabYB-stabY);
    if(stabW>0&&stabH>0){
      s+=`<rect x="${stabX.toFixed(1)}" y="${stabY.toFixed(1)}" width="${stabW.toFixed(1)}" height="${stabH.toFixed(1)}" fill="none" stroke="${C_STAB}" stroke-width="${W_STAB}" stroke-dasharray="${DASH_STAB}" stroke-linecap="round"/>`;
    }
  }
  // TOP label — indicates flush/raw open edge
  if(o.topLabel){
    const ty=o.flushStart?yTop+14:yBottom-4;
    s+=`<text x="${midX.toFixed(1)}" y="${ty.toFixed(1)}" font-size="11" font-weight="800" font-family="Nunito,sans-serif" fill="${C_SEW}" text-anchor="middle">TOP</text>`;
  }
  // cut line — topmost layer
  s+=`<rect x="${x0.toFixed(1)}" y="${yTop.toFixed(1)}" width="${drawW.toFixed(1)}" height="${drawL.toFixed(1)}" fill="none" stroke="${CAT.color}" stroke-width="${W_CUT}" stroke-linejoin="round"/>`;
  s+=`</svg>`;
  return `<div class="cp-mini">${s}</div>`;
}

/* Trapezoid mini diagram for tapered left/right pieces.
   Vertical orientation: length = height, depth = width.
   Wider end is always at the bottom regardless of which side is physically "top". */
function cpMiniTrapezoid(pc, opts){
  const o=opts||{};
  const PAD=22;
  // Preserve the actual top/bottom taper. Do not flip the wider end downward.
  const depthTop    = pc.cutWidthTop;
  const depthBottom = pc.cutWidthBottom;
  const cutLength   = pc.cutLength;
  const maxDepth    = Math.max(depthTop, depthBottom);

  // scale to fit within a vertical drawing area (length = height axis)
  const MAX_H=190, MAX_W=120;
  const scale = o.fitScale||Math.min(MAX_H/Math.max(cutLength,1e-9), MAX_W/Math.max(maxDepth,1e-9));

  const drawLength      = cutLength   * scale;
  const drawDepthTop    = depthTop    * scale;
  const drawDepthBottom = depthBottom * scale;
  const drawDepthMax    = maxDepth    * scale;

  // viewBox sized exactly to content + padding
  const svgW = drawDepthMax + 2*PAD;
  const svgH = drawLength      + 2*PAD;

  const x0          = PAD;
  const topRight    = PAD + drawDepthTop;
  const bottomRight = PAD + drawDepthBottom;
  const yTop        = PAD;
  const yBottom     = PAD + drawLength;

  const saPx = (o.sa||0)*scale;
  const STROKE = CP.maroon;

  const points = [
    `${x0},${yTop}`,
    `${topRight.toFixed(1)},${yTop}`,
    `${bottomRight.toFixed(1)},${yBottom.toFixed(1)}`,
    `${x0},${yBottom.toFixed(1)}`
  ].join(' ');

  let s=`<svg viewBox="0 0 ${svgW.toFixed(1)} ${svgH.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">`;

  // ghost — matching trapezoid polygon, offset 6px right+down
  if(o.ghost){
    const gPts=[
      `${x0+6},${yTop-6}`,
      `${(topRight+6).toFixed(1)},${yTop-6}`,
      `${(bottomRight+6).toFixed(1)},${(yBottom-6).toFixed(1)}`,
      `${x0+6},${(yBottom-6).toFixed(1)}`
    ].join(' ');
    s+=`<polygon points="${gPts}" fill="none" stroke="${CP.pinkLine}" stroke-width="1.5" opacity="0.5"/>`;
  }

  // fill
  s+=`<polygon points="${points}" fill="#ede8f8" fill-opacity=".72" stroke="none"/>`;

  // sewline — inset trapezoid
  if(saPx>0 && drawLength>2*saPx){
    const sewPoints=[
      `${(x0+saPx).toFixed(1)},${(yTop+saPx).toFixed(1)}`,
      `${(topRight-saPx).toFixed(1)},${(yTop+saPx).toFixed(1)}`,
      `${(bottomRight-saPx).toFixed(1)},${(yBottom-saPx).toFixed(1)}`,
      `${(x0+saPx).toFixed(1)},${(yBottom-saPx).toFixed(1)}`
    ].join(' ');
    s+=`<polygon points="${sewPoints}" fill="none" stroke="#808080" stroke-width="1.5" stroke-dasharray="9 7"/>`;
  }

  // center crosshair — vertical through trapezoid midpoint, horizontal at mid-height
  const midX = x0 + (drawDepthTop+drawDepthBottom)/4;
  const midY = yTop + drawLength/2;
  s+=`<line x1="${midX.toFixed(1)}" y1="${yTop}" x2="${midX.toFixed(1)}" y2="${yBottom.toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="5 5"/>`;
  s+=`<line x1="${x0}" y1="${midY.toFixed(1)}" x2="${bottomRight.toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="5 5"/>`;

  // center match triangles
  const tb=8,th=11;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${yTop} ${(midX+tb/2).toFixed(1)},${yTop} ${midX.toFixed(1)},${(yTop+th).toFixed(1)}" fill="${STROKE}"/>`;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${yBottom.toFixed(1)} ${(midX+tb/2).toFixed(1)},${yBottom.toFixed(1)} ${midX.toFixed(1)},${(yBottom-th).toFixed(1)}" fill="${STROKE}"/>`;
  s+=`<polygon points="${x0},${(midY-tb/2).toFixed(1)} ${x0},${(midY+tb/2).toFixed(1)} ${(x0+th).toFixed(1)},${midY.toFixed(1)}" fill="${STROKE}"/>`;
  // right-edge marker at the angled mid-edge interpolated position
  const rEdgeMidX = x0 + (drawDepthTop+drawDepthBottom)/2;
  s+=`<polygon points="${rEdgeMidX.toFixed(1)},${(midY-tb/2).toFixed(1)} ${rEdgeMidX.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(rEdgeMidX-th).toFixed(1)},${midY.toFixed(1)}" fill="${STROKE}"/>`;

  // stabilizer rect — inset from all four sides of the sewline trapezoid
  // width uses narrower sewline end so it stays within the tapered area
  if(o.stabInset>0 && saPx>0){
    const stPx=o.stabInset*scale;
    const sewW=drawDepthTop-2*saPx;
    const stabW=Math.max(0,sewW-2*stPx);
    const stabLen=Math.max(0,drawLength-2*saPx-2*stPx);  // inset from length ends too
    if(stabW>0&&stabLen>0){
      s+=`<rect x="${(x0+saPx).toFixed(1)}" y="${(yTop+saPx+stPx).toFixed(1)}" width="${stabW.toFixed(1)}" height="${stabLen.toFixed(1)}" fill="none" stroke="${C_STAB}" stroke-width="1.5" stroke-dasharray="4 5"/>`;
    }
  }

  // cut line — topmost layer
  s+=`<polygon points="${points}" fill="none" stroke="${STROKE}" stroke-width="2.5" stroke-linejoin="round"/>`;
  s+=`</svg>`;
  return `<div class="cp-mini">${s}</div>`;
}

/* Piece-table builders */
function cpProw(label, cutVal, sewVal){
  return `<div class="cp-prow"><div class="pl">${label}</div><div class="pc">${cutVal}</div><div class="ps">Sewline: ${sewVal}</div></div>`;
}
function cpPieceBlock(pill, rows, note){
  return `<span class="cp-pill">${pill}</span>` + rows.join("") + (note ? `<p class="cp-pnote">${note}</p>` : "");
}
// cpStripRows retained for future use
// function cpStripRows(cutL, sewL, cutW, sewW){ ... }

/* Sides minis + tables */
function cpSidesHTML(m,p){
  const pieces=m.displaySidePieces||[];
  if(!pieces.length)return {minis:"",tables:""};
  const maxW=Math.max(...pieces.map(x=>x.cutWidthTop!==undefined?Math.max(x.cutWidthTop,x.cutWidthBottom):x.cutWidth));
  const maxL=Math.max(...pieces.map(x=>x.cutLength));
  // vertical orientation: length = height axis (max 190px), width = horizontal axis (max 120px)
  const fitScale=Math.min(190/Math.max(maxL,1e-9),120/Math.max(maxW,1e-9));
  const stabInset=(p.stabilizerOn&&p.stabilizerInset>0)?p.stabilizerInset:0;
  let minis="",tables="";
  for(const pc of pieces){
    const isTaper=pc.cutWidthTop!==undefined&&Math.abs(pc.cutWidthTop-pc.cutWidthBottom)>1e-9;
    if(isTaper){
      minis+=cpMiniTrapezoid(pc,{ghost:pc.quantity===2,sa:p.sa,stabInset,fitScale});
      const widthRow=cpProw("Width — cut",`${cpFmt(pc.cutWidthTop)} top / ${cpFmt(pc.cutWidthBottom)} btm`,`${cpFmt(pc.finishedWidthTop)} / ${cpFmt(pc.finishedWidthBottom)}`);
      tables+=cpPieceBlock(pc.label,[cpProw("Length — cut",cpFmt(pc.cutLength),cpFmt(pc.runLength)),widthRow],"Tapered: top and bottom widths differ.");
    } else {
      minis+=cpMiniStrip(pc.cutLength,pc.cutWidth,pc.label,"",{ghost:pc.quantity===2,sa:p.sa,plan:pc.plan,flushStart:pc.flushStart,flushEnd:pc.flushEnd,runLen:pc.runLength,topLabel:pc.flushStart||pc.flushEnd,fitScale,stabInset});
      const note=pc.flushStart||pc.flushEnd?"Raw-top end is flush; the opposite end includes the joining seam allowance.":(pc.quantity===2?"Verified mirrored pair; one template can be used for both sides.":"");
      tables+=cpPieceBlock(pc.label,[cpProw("Length — cut",cpFmt(pc.cutLength),cpFmt(pc.runLength)),cpProw("Width — cut",cpFmt(pc.cutWidth),cpFmt(pc.finishedWidth))],note);
    }
  }
  return {minis:`<div class="cp-miniWrap">${minis}</div>`,tables};
}

function cpGussetMapHTML(pc, stabInset){
  if(!pc)return "";
  const VW=760,PADX=28,PADY=34,MAX_DRAW_H=210;
  const scale=Math.min((VW-2*PADX)/Math.max(pc.cutLength,1e-9),MAX_DRAW_H/Math.max(pc.cutWidth,1e-9));
  const drawL=pc.cutLength*scale,drawW=pc.cutWidth*scale,x0=(VW-drawL)/2,y0=PADY,H=drawW+PADY+56;
  const saPx=(pc.cutWidth-pc.finishedWidth)/2*scale,sewStart=x0+pc.startAllowance*scale,sewEnd=sewStart+pc.runLength*scale,midX=x0+drawL/2,midY=y0+drawW/2;
  let s=`<svg class="cp-zoneMap" viewBox="0 0 ${VW} ${H.toFixed(1)}" xmlns="http://www.w3.org/2000/svg">`;
  s+=`<rect x="${x0.toFixed(1)}" y="${y0}" width="${drawL.toFixed(1)}" height="${drawW.toFixed(1)}" rx="4" fill="#fbecef" fill-opacity=".75" stroke="none"/>`;
  s+=`<line x1="${midX.toFixed(1)}" y1="${y0}" x2="${midX.toFixed(1)}" y2="${(y0+drawW).toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="5 5"/><line x1="${x0.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${(x0+drawL).toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="5 5"/>`;
  if(saPx>0&&drawW>2*saPx){const yTop=y0+saPx,yBot=y0+drawW-saPx,d=`M ${sewStart.toFixed(1)} ${yTop.toFixed(1)} H ${sewEnd.toFixed(1)} M ${sewStart.toFixed(1)} ${yBot.toFixed(1)} H ${sewEnd.toFixed(1)} M ${sewStart.toFixed(1)} ${yTop.toFixed(1)} V ${yBot.toFixed(1)} M ${sewEnd.toFixed(1)} ${yTop.toFixed(1)} V ${yBot.toFixed(1)}`;s+=`<path d="${d}" fill="none" stroke="#8f8f8f" stroke-width="1.5" stroke-dasharray="7 5"/>`;}
  if(stabInset>0){
    const stPx=stabInset*scale,sewH=drawW-2*saPx;
    const stabH=Math.max(0,sewH-2*stPx);
    if(stabH>0){
      s+=`<rect x="${sewStart.toFixed(1)}" y="${(y0+saPx+stPx).toFixed(1)}" width="${(sewEnd-sewStart).toFixed(1)}" height="${stabH.toFixed(1)}" fill="none" stroke="${C_STAB}" stroke-width="1.5" stroke-dasharray="4 5"/>`;
    }
  }
  let acc=0;for(let i=0;i<pc.zones.length;i++){const z=pc.zones[i],x1=sewStart+acc*scale,x2=x1+z.length*scale;if(i>0)s+=`<line x1="${x1.toFixed(1)}" y1="${y0}" x2="${x1.toFixed(1)}" y2="${(y0+drawW).toFixed(1)}" stroke="${CP.maroon}" stroke-width="1.4" opacity=".65"/>`;if(x2-x1>54)s+=`<text x="${((x1+x2)/2).toFixed(1)}" y="${(midY+5).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="800" font-family="Nunito,sans-serif" fill="${CP.maroon}">${z.side.toUpperCase()}</text>`;acc+=z.length;}
  const tb=8,th=11;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${y0} ${(midX+tb/2).toFixed(1)},${y0} ${midX.toFixed(1)},${(y0+th).toFixed(1)}" fill="${CP.maroon}"/><polygon points="${(midX-tb/2).toFixed(1)},${(y0+drawW).toFixed(1)} ${(midX+tb/2).toFixed(1)},${(y0+drawW).toFixed(1)} ${midX.toFixed(1)},${(y0+drawW-th).toFixed(1)}" fill="${CP.maroon}"/><polygon points="${x0.toFixed(1)},${(midY-tb/2).toFixed(1)} ${x0.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(x0+th).toFixed(1)},${midY.toFixed(1)}" fill="${CP.maroon}"/><polygon points="${(x0+drawL).toFixed(1)},${(midY-tb/2).toFixed(1)} ${(x0+drawL).toFixed(1)},${(midY+tb/2).toFixed(1)} ${(x0+drawL-th).toFixed(1)},${midY.toFixed(1)}" fill="${CP.maroon}"/>`;
  s+=`<rect x="${x0.toFixed(1)}" y="${y0}" width="${drawL.toFixed(1)}" height="${drawW.toFixed(1)}" rx="4" fill="none" stroke="${CP.maroon}" stroke-width="2.2"/>`;
  s+=`<text x="${x0.toFixed(1)}" y="${(y0-10).toFixed(1)}" font-size="12.5" font-weight="800" font-family="Nunito,sans-serif" fill="${CP.muted}">END SA ${cpFmt(pc.startAllowance)}</text><text x="${(x0+drawL).toFixed(1)}" y="${(y0-10).toFixed(1)}" text-anchor="end" font-size="12.5" font-weight="800" font-family="Nunito,sans-serif" fill="${CP.muted}">END SA ${cpFmt(pc.endAllowance)}</text></svg>`;
  return s;
}

/* Gusset mini + table */
function cpGussetHTML(m, p){
  const pc=m.gussetPiece;
  if(!pc)return {minis:"",tables:""};
  const stabInset=(p?.stabilizerOn&&p?.stabilizerInset>0)?p.stabilizerInset:0;
  const minis=`<div class="cp-miniWrap">${cpGussetMapHTML(pc,stabInset)}</div>`;
  let rows=[
    cpProw("Length — cut",cpFmt(pc.cutLength),cpFmt(pc.runLength)),
    cpProw("Width — cut",cpFmt(pc.cutWidth),cpFmt(pc.finishedWidth))
  ];
  const tables=cpPieceBlock(pc.label,rows,"");
  return {minis,tables};
}

// cpStat retained for future use
// function cpStat(k, v, d){ ... }

/* ── Hyphen-fraction format for cutting list ──────────────────────────────── */
function cpFmtHyphen(v){
  if(isMetric())return fmtCm(v);
  if(!v||v<=0)return "—";
  const r=Math.round(v*8)/8,w=Math.floor(r),fr=Math.round((r-w)*8)/8;
  const wh=fr>=1?w+1:w,fv=fr>=1?0:fr;
  const FM={0:"",0.125:"1/8",0.25:"1/4",0.375:"3/8",0.5:"1/2",0.625:"5/8",0.75:"3/4",0.875:"7/8"};
  const fs=FM[fv]??"";
  if(wh===0&&fs)return `${fs}"`;
  if(!fs)return `${wh}"`;
  return `${wh}-${fs}"`;
}

/* ── Small React helpers ──────────────────────────────────────────────────── */
function PillToggle({options,value,onChange}){
  return(
    <div className="cp-pill-toggle">
      {options.map(o=>(
        <button key={o.v} className={value===o.v?"active":""} onClick={()=>onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

function StageSeg({options,value,set}){
  return(
    <div className="cp-stage-seg">
      {options.map(o=>(
        <button key={String(o.v)} className={`${value===o.v?"on":""}${o.disabled?" seg-disabled":""}`} disabled={!!o.disabled} onClick={()=>!o.disabled&&set(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

function StageHeader({num,title,summary,open,onToggle,optional}){
  const nc=optional?"optional":(open?"active":"neutral");
  return(
    <div className="cp-stage-header" onClick={onToggle}>
      <div className={`cp-stage-num ${nc}`}>{num}</div>
      <div className="cp-stage-title">{title}</div>
      {!open&&summary&&<div className="cp-stage-summary">{summary}</div>}
      <div className="cp-stage-chevron" style={{transform:open?"rotate(180deg)":"rotate(0deg)"}}>▼</div>
    </div>
  );
}

function cpSidePrintSpan(m){
  const pcs=m.displaySidePieces||[];
  if(!pcs.length)return null;
  const gap=.55,pad=.4;
  return{w:Math.max(...pcs.map(x=>x.cutLength))+pad*2,h:pcs.reduce((a,x)=>a+x.cutWidth,0)+gap*(pcs.length-1)+pad*2};
}
function cpGussetPrintSpan(m){
  const pc=m.gussetPiece;
  return pc?{w:pc.cutWidth+.8,h:pc.cutLength+.8}:null;
}

// ── CURVED PANEL PAGE ─────────────────────────────────────────────────────────
export default function CurvedPanelPage({unitMode="imperial",setUnitMode=()=>{}}){
  // Dimensions
  const [tWW,setTWW]=useState(0),[tWF,setTWF]=useState(0);
  const [bWW,setBWW]=useState(0),[bWF,setBWF]=useState(0);
  const [hWW,setHWW]=useState(0),[hWF,setHWF]=useState(0);
  // SA + input modes
  const [saW,setSaW]=useState(0),[saF,setSaF]=useState(DEFAULT_SA);
  const [decMode,setDecMode]=useState(false);
  // Edge shape
  const [lfW,setLfW]=useState(0),[lfF,setLfF]=useState(0);
  const [rfW,setRfW]=useState(0),[rfF,setRfF]=useState(0);
  const [tcW,setTcW]=useState(0),[tcF,setTcF]=useState(0);
  const [bcW,setBcW]=useState(0),[bcF,setBcF]=useState(0);
  const [matchingSides,setMatchingSides]=useState(true);
  const [feel,setFeel]=useState("gentle");
  // Corner rounding
  const [tsW,setTsW]=useState(0),[tsF,setTsF]=useState(0);
  const [bsW,setBsW]=useState(0),[bsF,setBsF]=useState(0);
  // Construction
  const [topMode,setTopMode]=useState("4side");
  const [pieceStyle,setPieceStyle]=useState("sides");
  const [sdW,setSdW]=useState(0),[sdF,setSdF]=useState(0);
  const [sideTaper,setSideTaper]=useState(false);
  const [dtW,setDtW]=useState(0),[dtF,setDtF]=useState(0);
  const [dbW,setDbW]=useState(0),[dbF,setDbF]=useState(0);
  // Stabilizer
  const [stabOn,setStabOn]=useState(false);
  const [stabW,setStabW]=useState(0),[stabF,setStabF]=useState(0.625);
  const [stabSeparate,setStabSeparate]=useState(false);
  // UI state
  const [stageOpen,setStageOpen]=useState([true,true,true,true,false]);
  const [checkedRows,setCheckedRows]=useState({});

  // Derived values
  const lf=Math.max(0,lfW+lfF);
  const rf=matchingSides?lf:Math.max(0,rfW+rfF);
  const sa=Math.max(0,saW+saF);
  const sideDepth=Math.max(0,sdW+sdF);
  const taperDepthTop=Math.max(0,dtW+dtF);
  const taperDepthBottom=Math.max(0,dbW+dbF);
  const depthTop=sideTaper?taperDepthTop:sideDepth;
  const depthBottom=sideTaper?taperDepthBottom:sideDepth;
  const modelSideDepth=sideTaper?Math.max(depthTop,depthBottom):sideDepth;

  const params={
    topW:Math.max(1,tWW+tWF),botW:Math.max(1,bWW+bWF),height:Math.max(1,hWW+hWF),
    sa,topCrown:Math.max(0,tcW+tcF),botCrown:Math.max(0,bcW+bcF),
    leftFull:lf,rightFull:rf,matchingSides,feel,topMode,
    topSoft:Math.max(0,tsW+tsF),botSoft:Math.max(0,bsW+bsF),
    sideDepth:modelSideDepth,
    stabilizerOn:stabOn,stabilizerInset:Math.max(0,stabW+stabF),stabilizerSeparate:stabSeparate,
    sideTaper,depthTop,depthBottom,
  };

  const ready=(tWW+tWF)>0&&(bWW+bWF)>0&&(hWW+hWF)>0;
  const model=buildCurvedPanelModel(params);
  const hasDepth=sideTaper?(depthTop>0&&depthBottom>0):sideDepth>0;
  const hasGusset=pieceStyle==="gusset"&&sideDepth>0;
  const sides=cpSidesHTML(model,params),gusset=cpGussetHTML(model,params);
  const active=model.activeSew;

  const panelPlan=ready&&model.valid?cpTilePlan(model.cutBB.w+.8,model.cutBB.h+.8):null;
  const sideSpan=cpSidePrintSpan(model),sidePlan=sideSpan?cpTilePlan(sideSpan.w,sideSpan.h):null;
  const gusSpan=cpGussetPrintSpan(model),gusPlan=gusSpan?cpTilePlan(gusSpan.w,gusSpan.h):null;
  const stabPts=cpStabilizerPoints(model,params),stabBB=cpPtsBB(stabPts);
  const stabPlan=stabBB?cpTilePlan(stabBB.w+.8,stabBB.h+.8):null;

  const taperAngle=sideTaper&&model.valid&&model.activeSew.runs.left
    ?Math.atan(Math.abs(depthBottom-depthTop)/model.activeSew.runs.left)*(180/Math.PI):0;

  // Dynamic title
  const panelTitle=pieceStyle==="gusset"
    ?"Front & back panel — gusset"
    :topMode==="4side"
    ?"Front & back panel — fully enclosed"
    :"Front & back panel — sides & bottom";

  // Stage summaries
  const s1sum=ready?`${cpFmt(params.topW)} / ${cpFmt(params.botW)} / ${cpFmt(params.height)}`:"";
  const s2sum=lf>0||(tcW+tcF)>0?`side ${cpFmt(lf)}, top ${cpFmt(tcW+tcF)}`:"";
  const s3sum=(tsW+tsF)>0||(bsW+bsF)>0?`top ${cpFmt(tsW+tsF)}, btm ${cpFmt(bsW+bsF)}`:"";
  const s4sum=`${topMode==="3side"?"Open":"Enclosed"} · ${pieceStyle==="gusset"?"gusset":"sides"} · depth ${sideTaper?`${cpFmt(depthTop)}/${cpFmt(depthBottom)}`:cpFmt(sideDepth)}`;

  // Cutting list row keys
  const sideKeys=pieceStyle==="sides"&&hasDepth&&model.valid&&model.displaySidePieces
    ?model.displaySidePieces.flatMap(pc=>{const rk=pc.label.toLowerCase().replace(/[\s&]+/g,"-");return stabOn?[rk,"stab-"+rk]:[rk];}):[];
  const gussetKeys=pieceStyle==="gusset"&&hasGusset&&model.valid&&model.gussetPiece
    ?(stabOn?["gusset","stab-gusset"]:["gusset"]):[];
  const allRowKeys=["panel",...(stabOn?["stab"]:[]),...sideKeys,...gussetKeys];
  const checkedCount=allRowKeys.filter(k=>checkedRows[k]).length;

  function toggleStage(i){setStageOpen(prev=>prev.map((v,idx)=>idx===i?!v:v));}
  function toggleRow(k){setCheckedRows(prev=>({...prev,[k]:!prev[k]}));}
  function handleUnitToggle(mod){
    setCurrentUnit(mod);
    setUnitMode(mod);
  }

  const cuttingMeta=ready
    ?`Curved panel · ${cpFmt(params.topW)} × ${cpFmt(params.height)} · SA ${cpFmt(sa)}`
    :"Curved panel";

  return(
    <div className="cp-new-shell">

      {/* Title bar */}
      <div className="cp-title-bar">
        <h2>{panelTitle}</h2>
        <p>Design your front panel. Side and bottom pieces are calculated from it automatically. Use when your bag has a shaped front face with separate side and bottom strips.</p>
      </div>

      {/* Mission-critical bar */}
      <div className="cp-mission-bar">
        <span className="cp-mission-sa-label">Seam&nbsp;Allowance <span className="cp-mission-sa-abbr">(SA)</span></span>
        <div className="cp-mission-sa-wrap">
          <FracInput variant="cp" label="" decMode={decMode} whole={saW} frac={saF} onWhole={setSaW} onFrac={setSaF}/>
        </div>
        <div className="cp-mission-toggles">
          {!isMetric()&&(
            <PillToggle
              options={[{v:false,label:"Fractions"},{v:true,label:"Decimal"}]}
              value={decMode}
              onChange={setDecMode}
            />
          )}
          <PillToggle
            options={[{v:"imperial",label:"Imperial"},{v:"metric",label:"Metric"}]}
            value={unitMode}
            onChange={handleUnitToggle}
          />
        </div>
      </div>

      {/* Body: two columns */}
      <div className="cp-body">

        {/* LEFT COLUMN: sticky diagram + measurements */}
        <div className="cp-left-col">

          {/* Panel diagram */}
          <div className="cp-left-panel-diag">
            <div className="cp-left-section-label">Front &amp; back panel</div>
            <div className="cp-left-diag-wrap">
              {ready&&model.valid
                ?<svg viewBox="0 0 760 490" style={{width:"100%",height:"auto",display:"block"}}
                    dangerouslySetInnerHTML={{__html:cpPanelDiagramSVG(model,params)}}/>
                :<div className="cp-diag-placeholder">
                  {ready?"Fix geometry to see the diagram.":"Enter top width, bottom width, and height to begin."}
                </div>
              }
              {/* Geometry status overlay — pinned to bottom of diagram box */}
              {ready&&model.valid&&model.errors.length===0&&(
                <div className="cp-diag-status cp-diag-status--ok">✓ Geometry verified</div>
              )}
              {ready&&(!model.valid||model.errors.length>0)&&(
                <div className="cp-diag-status cp-diag-status--warn">
                  <span>⚠ Pattern output locked</span>
                  {model.errors.length>0&&(
                    <span className="cp-diag-status-errors">
                      {model.errors.join(" · ")}
                    </span>
                  )}
                  {model.notes.length>0&&(
                    <span className="cp-diag-status-notes">
                      {model.notes.join(" · ")}
                    </span>
                  )}
                </div>
              )}
            </div>
            {ready&&model.valid&&(
              <div className="cp-diag-meta">
                <p className="cp-diag-legend">
                  ▲ center · ○ midpoints · solid = cut · dashed = sewline{stabOn?" · dotted = stabilizer":""}
                </p>
                <p className={`cp-symline ${model.symmetry?"yes":"no"}`}>
                  Fold-friendly symmetry: {model.symmetry?"yes":"no"}
                </p>
              </div>
            )}
          </div>

          {/* Sides / Gusset diagram */}
          <div className="cp-left-sg-diag">
            <div className="cp-left-section-label">Side pieces</div>
            {pieceStyle==="sides"?(
              <>
                {ready&&model.valid&&hasDepth
                  ?<div className="cp-left-sides-thumbs" dangerouslySetInnerHTML={{__html:sides.minis}}/>
                  :<div className="cp-diag-placeholder">
                    {ready&&model.valid?"Enter a finished side depth in Stage 4 to preview pieces.":"Complete panel dimensions first."}
                  </div>
                }
                <p className="cp-diag-legend" style={{marginTop:6}}>Ghost = cut 2 · bottom width may differ from sides</p>
              </>
            ):(
              <>
                {ready&&model.valid&&hasGusset
                  ?<div className="cp-left-gusset-wrap" dangerouslySetInnerHTML={{__html:gusset.minis}}/>
                  :<div className="cp-diag-placeholder">
                    {ready&&model.valid?"Enter a depth in Stage 4 to preview the gusset strip.":"Complete panel dimensions first."}
                  </div>
                }
                <p className="cp-diag-legend" style={{marginTop:6}}>Zone map · end allowances shown at each end</p>
              </>
            )}
          </div>

        </div>{/* end left col */}

        {/* RIGHT COLUMN: cascade stages */}
        <div className="cp-right-col">
          <div className="cp-stages">

            {/* Stage 1: Dimensions */}
            <div className="cp-stage">
              <StageHeader num={1} title="Dimensions" summary={s1sum} open={stageOpen[0]} onToggle={()=>toggleStage(0)}/>
              {stageOpen[0]&&(
                <div className="cp-stage-body">
                  <div className="cp-row3">
                    <FracInput variant="cp" label="Top width" decMode={decMode} whole={tWW} frac={tWF} onWhole={setTWW} onFrac={setTWF}/>
                    <FracInput variant="cp" label="Bottom width" decMode={decMode} whole={bWW} frac={bWF} onWhole={setBWW} onFrac={setBWF}/>
                    <FracInput variant="cp" label="Height" decMode={decMode} whole={hWW} frac={hWF} onWhole={setHWW} onFrac={setHWF}/>
                  </div>
                  <p className="cp-stage-hint">Design intent — actual cut sizes shown in measurements.</p>
                </div>
              )}
            </div>

            {/* Stage 2: Edge shape */}
            <div className="cp-stage">
              <StageHeader num={2} title="Edge shape" summary={s2sum} open={stageOpen[1]} onToggle={()=>toggleStage(1)}/>
              {stageOpen[1]&&(
                <div className="cp-stage-body">
                  <label className="cp-check" style={{marginBottom:10,display:"inline-flex",alignItems:"center",gap:6}}>
                    <input type="checkbox" checked={matchingSides} onChange={e=>setMatchingSides(e.target.checked)}/>
                    Matching sides
                  </label>
                  {matchingSides?(
                    <FracInput variant="cp" label="Side curve" decMode={decMode} whole={lfW} frac={lfF} onWhole={setLfW} onFrac={setLfF}/>
                  ):(
                    <div className="cp-row2" style={{marginBottom:4}}>
                      <FracInput variant="cp" label="Left curve" decMode={decMode} whole={lfW} frac={lfF} onWhole={setLfW} onFrac={setLfF}/>
                      <FracInput variant="cp" label="Right curve" decMode={decMode} whole={rfW} frac={rfF} onWhole={setRfW} onFrac={setRfF}/>
                    </div>
                  )}
                  <div className="cp-arc-feel-row">
                    <div className="cp-arc-block">
                      <div className="cp-arc-block-row">
                        <div className="cp-arc-row-label">▲ Top curve</div>
                        <FracInput variant="cp" label="" decMode={decMode} whole={tcW} frac={tcF} onWhole={setTcW} onFrac={setTcF}/>
                      </div>
                      <div className="cp-arc-block-row">
                        <div className="cp-arc-row-label">▼ Bottom curve</div>
                        <FracInput variant="cp" label="" decMode={decMode} whole={bcW} frac={bcF} onWhole={setBcW} onFrac={setBcF}/>
                      </div>
                    </div>
                    <div className="cp-feel-block">
                      <div className="cp-feel-label">Curve feel</div>
                      <div className="cp-feel-btns">
                        {["gentle","balanced","defined"].map(f=>(
                          <button key={f} className={feel===f?"on":""} onClick={()=>setFeel(f)}>
                            {f.charAt(0).toUpperCase()+f.slice(1)}
                          </button>
                        ))}
                      </div>
                      <p className="cp-stage-hint">How the curve eases, not the depth.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stage 3: Corner rounding */}
            <div className="cp-stage">
              <StageHeader num={3} title="Corner rounding" summary={s3sum} open={stageOpen[2]} onToggle={()=>toggleStage(2)}/>
              {stageOpen[2]&&(
                <div className="cp-stage-body">
                  <div className="cp-row2">
                    <FracInput variant="cp" label="Top corners" decMode={decMode} whole={tsW} frac={tsF} onWhole={setTsW} onFrac={setTsF}/>
                    <FracInput variant="cp" label="Bottom corners" decMode={decMode} whole={bsW} frac={bsF} onWhole={setBsW} onFrac={setBsF}/>
                  </div>
                  <p className="cp-stage-hint">0 = crisp corner. Value = how far back the blend begins.</p>
                </div>
              )}
            </div>

            {/* Stage 4: Side depth & opening */}
            <div className="cp-stage">
              <StageHeader num={4} title="Side depth & opening" summary={s4sum} open={stageOpen[3]} onToggle={()=>toggleStage(3)}/>
              {stageOpen[3]&&(
                <div className="cp-stage-body">
                  <div className="cp-stage-input-group">
                    <div className="cp-stage-input-label">Top opening</div>
                    <StageSeg options={[{v:"3side",label:"Open"},{v:"4side",label:"Enclosed"}]} value={topMode} set={setTopMode}/>
                  </div>
                  <div className="cp-stage-input-group">
                    <div className="cp-stage-input-label">Piece style</div>
                    <StageSeg
                      options={[{v:"sides",label:"Side panels"},{v:"gusset",label:"Gusset",disabled:sideTaper}]}
                      value={pieceStyle}
                      set={setPieceStyle}
                    />
                    {sideTaper&&<p className="cp-stage-hint" style={{marginTop:5,color:"var(--sp-muted)"}}>Tapered gussets aren't supported yet.</p>}
                  </div>
                  <div className="cp-stage-input-group">
                    <div className="cp-stage-input-label">Side profile</div>
                    <StageSeg options={[{v:false,label:"Straight"},{v:true,label:"Tapered"}]} value={sideTaper} set={v=>{setSideTaper(v);if(v&&pieceStyle==="gusset")setPieceStyle("sides");}}/>
                  </div>
                  <div style={{marginTop:8}}>
                    {!sideTaper?(
                      <FracInput variant="cp" label="Finished depth" decMode={decMode} whole={sdW} frac={sdF} onWhole={setSdW} onFrac={setSdF}/>
                    ):(
                      <div className="cp-row2">
                        <FracInput variant="cp" label="Depth at top" decMode={decMode} whole={dtW} frac={dtF} onWhole={setDtW} onFrac={setDtF}/>
                        <FracInput variant="cp" label="Depth at bottom" decMode={decMode} whole={dbW} frac={dbF} onWhole={setDbW} onFrac={setDbF}/>
                      </div>
                    )}
                    {sideTaper&&taperAngle>30&&(
                      <div className="cp-taper-warn">Steep taper — consider reducing the depth difference.</div>
                    )}
                    <p className="cp-stage-hint">{pieceStyle==="gusset"?"Depth drives gusset width — no separate input needed.":"Side panels and bottom strip each use their depth edge."}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stage 5: Stabilizer (optional) */}
            <div className="cp-stage">
              <StageHeader num={5} title="Stabilizer" summary={stabOn?`Inset ${cpFmt(params.stabilizerInset)}`:"Off"} open={stageOpen[4]} onToggle={()=>toggleStage(4)} optional={true}/>
              {stageOpen[4]&&(
                <div className="cp-stage-body">
                  <label className="cp-check" style={{marginBottom:10}}>
                    <input type="checkbox" checked={stabOn} onChange={e=>setStabOn(e.target.checked)}/>
                    Stabilizer / interfacing
                  </label>
                  <div style={{opacity:stabOn?1:0.35,pointerEvents:stabOn?"auto":"none"}}>
                    <FracInput variant="cp" label="Inset" decMode={decMode} ghost={!stabOn} whole={stabW} frac={stabF} onWhole={setStabW} onFrac={setStabF}/>
                    <div className="cp-stage-input-label" style={{margin:"8px 0 5px"}}>Print</div>
                    <StageSeg
                      options={[{v:false,label:"With panel"},{v:true,label:"Separately"}]}
                      value={stabSeparate}
                      set={setStabSeparate}
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>{/* end right col */}

      </div>{/* end body */}

      {/* Cutting list */}
      <div className="cp-cutting-list">
        <div className="cp-cutting-header">
          <h2>Cutting list</h2>
          <div className="cp-cutting-header-right">
            <span className="cp-cutting-meta">{cuttingMeta}</span>
          </div>
        </div>

        {/* Column headers */}
        <div className="cp-cutting-col-headers">
          <span className="cp-col-cb"/>
          <span className="cp-col-name">Piece</span>
          <span className="cp-col-dim">Cut Length</span>
          <span className="cp-col-dim">Cut Width</span>
          <span className="cp-col-qty">Quantity</span>
        </div>

        <div className="cp-cutting-body">
          {/* Main panels group */}
          <div className="cp-group-header">Main panels</div>

          {/* Panel row */}
          <div className={`cp-cutting-row ${checkedRows.panel?"checked":""}`}>
            <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows.panel} onChange={()=>toggleRow("panel")}/></div>
            <div className="cp-row-name">
              Front &amp; back
              {ready&&model.valid&&<div className="cp-row-sewsub">{`sewline: ${cpFmtHyphen(active.bb.w)} × ${cpFmtHyphen(active.bb.h)}`}</div>}
            </div>
            <div className="cp-row-cut">{ready&&model.valid?cpFmtHyphen(model.cutBB.w):"—"}</div>
            <div className="cp-row-cut">{ready&&model.valid?cpFmtHyphen(model.cutBB.h):"—"}</div>
            <div className="cp-row-qty"><span className="cp-row-badge cut2">Cut 2</span></div>
          </div>

          {/* Stabilizer row */}
          {stabOn&&(
            <div className={`cp-cutting-row stab-row ${checkedRows.stab?"checked":""}`}>
              <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows.stab} onChange={()=>toggleRow("stab")}/></div>
              <div className="cp-row-name">Stabilizer</div>
              <div className="cp-row-cut">{stabBB?cpFmtHyphen(stabBB.w):"—"}</div>
              <div className="cp-row-cut">{stabBB?cpFmtHyphen(stabBB.h):"—"}</div>
              <div className="cp-row-qty"><span className="cp-row-badge cut2">Cut 2</span></div>
            </div>
          )}

          {/* Side/gusset group */}
          <div className="cp-group-header">Side &amp; bottom strips</div>

          {pieceStyle==="sides"?(
            ready&&model.valid&&hasDepth&&(model.displaySidePieces||[]).flatMap((pc,i)=>{
              const rk=pc.label.toLowerCase().replace(/[\s&]+/g,"-");
              const isMirror=pc.label.toLowerCase().includes("right")&&pc.quantity===1;
              const taper=pc.cutWidthTop!==undefined&&Math.abs(pc.cutWidthTop-pc.cutWidthBottom)>1e-9;
              const pieceRow=(
                <div key={i} className={`cp-cutting-row ${checkedRows[rk]?"checked":""}`}>
                  <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows[rk]} onChange={()=>toggleRow(rk)}/></div>
                  <div className="cp-row-name">
                    {pc.label}
                    <div className="cp-row-sewsub">
                      {taper
                        ?`sewline: ${cpFmtHyphen(pc.runLength)} × ${cpFmtHyphen(pc.finishedWidthTop)}–${cpFmtHyphen(pc.finishedWidthBottom)}`
                        :`sewline: ${cpFmtHyphen(pc.runLength)} × ${cpFmtHyphen(pc.finishedWidth)}`
                      }
                    </div>
                  </div>
                  <div className="cp-row-cut">{cpFmtHyphen(pc.cutLength)}</div>
                  <div className="cp-row-cut">
                    {taper?`${cpFmtHyphen(pc.cutWidthTop)}–${cpFmtHyphen(pc.cutWidthBottom)}`:cpFmtHyphen(pc.cutWidth)}
                  </div>
                  <div className="cp-row-qty">
                    {isMirror?<span className="cp-row-badge mirror">Mirror</span>
                    :pc.quantity===2?<span className="cp-row-badge cut2">Cut 2</span>
                    :<span className="cp-row-badge cut1">Cut 1</span>}
                  </div>
                </div>
              );
              if(!stabOn)return[pieceRow];
              const srk="stab-"+rk;
              const stabCutW=taper
                ?`${cpFmtHyphen(Math.max(0,pc.cutWidthTop-2*params.stabilizerInset))}–${cpFmtHyphen(Math.max(0,pc.cutWidthBottom-2*params.stabilizerInset))}`
                :cpFmtHyphen(Math.max(0,pc.cutWidth-2*params.stabilizerInset));
              const stabRow=(
                <div key={"s"+i} className={`cp-cutting-row stab-row ${checkedRows[srk]?"checked":""}`}>
                  <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows[srk]} onChange={()=>toggleRow(srk)}/></div>
                  <div className="cp-row-name">Stabilizer</div>
                  <div className="cp-row-cut">{cpFmtHyphen(pc.cutLength)}</div>
                  <div className="cp-row-cut">{stabCutW}</div>
                  <div className="cp-row-qty">
                    {isMirror?<span className="cp-row-badge mirror">Mirror</span>
                    :pc.quantity===2?<span className="cp-row-badge cut2">Cut 2</span>
                    :<span className="cp-row-badge cut1">Cut 1</span>}
                  </div>
                </div>
              );
              return[pieceRow,stabRow];
            })
          ):(
            ready&&model.valid&&hasGusset&&model.gussetPiece&&[
              <div key="gusset" className={`cp-cutting-row ${checkedRows.gusset?"checked":""}`}>
                <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows.gusset} onChange={()=>toggleRow("gusset")}/></div>
                <div className="cp-row-name">
                  Gusset
                  <div className="cp-row-sewsub">sewline: {cpFmtHyphen(model.gussetPiece.runLength)} × {cpFmtHyphen(model.gussetPiece.finishedWidth)}</div>
                </div>
                <div className="cp-row-cut">{cpFmtHyphen(model.gussetPiece.cutLength)}</div>
                <div className="cp-row-cut">{cpFmtHyphen(model.gussetPiece.cutWidth)}</div>
                <div className="cp-row-qty"><span className="cp-row-badge cut1">Cut 1</span></div>
              </div>,
              stabOn&&(
                <div key="stab-gusset" className={`cp-cutting-row stab-row ${checkedRows["stab-gusset"]?"checked":""}`}>
                  <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows["stab-gusset"]} onChange={()=>toggleRow("stab-gusset")}/></div>
                  <div className="cp-row-name">Stabilizer</div>
                  <div className="cp-row-cut">{cpFmtHyphen(model.gussetPiece.cutLength)}</div>
                  <div className="cp-row-cut">{cpFmtHyphen(Math.max(0,model.gussetPiece.cutWidth-2*params.stabilizerInset))}</div>
                  <div className="cp-row-qty"><span className="cp-row-badge cut1">Cut 1</span></div>
                </div>
              ),
            ]
          )}

          {/* Placeholder when no depth/gusset yet */}
          {ready&&model.valid&&pieceStyle==="sides"&&!hasDepth&&(
            <div className="cp-cutting-row" style={{opacity:0.5}}>
              <div className="cp-row-cb"/>
              <div className="cp-row-name" style={{color:"var(--sp-muted)",fontWeight:600,fontSize:13}}>Enter a finished side depth in Stage 4</div>
            </div>
          )}
          {ready&&model.valid&&pieceStyle==="gusset"&&!hasGusset&&(
            <div className="cp-cutting-row" style={{opacity:0.5}}>
              <div className="cp-row-cb"/>
              <div className="cp-row-name" style={{color:"var(--sp-muted)",fontWeight:600,fontSize:13}}>Enter a finished depth in Stage 4</div>
            </div>
          )}

          {/* Lining disclaimer */}
          <p className="cp-lining-note">
            Lining: cut pieces to match exterior dimensions. Sew at a slightly larger SA, tapering to your chosen SA where lining meets exterior. Finish with bind or birth method.
          </p>
        </div>

        {/* Cutting list footer — progress only */}
        <div className="cp-cutting-footer">
          <div className="cp-progress-wrap">
            <div className="cp-progress-bar">
              <div className="cp-progress-fill" style={{width:allRowKeys.length?`${(checkedCount/allRowKeys.length)*100}%`:"0%"}}/>
            </div>
            <span className="cp-progress-text">{checkedCount} of {allRowKeys.length} cut</span>
          </div>
        </div>
      </div>

      {/* Print bar */}
      {ready&&(
        <div className="cp-print-bar">
          <div className="cp-print-bar-title">Print patterns</div>
          <div className="cp-print-grid-new">
            <div className="cp-print-card-new">
              <div className="cp-print-card-title">Main panel</div>
              <div className="cp-print-card-meta">{panelPlan?cpTileLabel(panelPlan):"Add dimensions"}</div>
              <PrintButton tone="cp" small label="Print main panel" meta={panelPlan?cpTileLabel(panelPlan):"—"} disabled={!model.valid} onClick={()=>cpPrintPanel(model,params)}/>
            </div>
            {pieceStyle==="sides"&&(
              <div className="cp-print-card-new">
                <div className="cp-print-card-title">Sides &amp; bottom</div>
                <div className="cp-print-card-meta">{sidePlan?cpTileLabel(sidePlan):"Add finished side depth"}</div>
                <PrintButton tone="cp" small label="Print sides & bottom" meta={sidePlan?cpTileLabel(sidePlan):"—"} disabled={!model.valid||!hasDepth||!sidePlan} onClick={()=>cpPrintSides(model,params)}/>
              </div>
            )}
            {pieceStyle==="gusset"&&(
              <div className="cp-print-card-new">
                <div className="cp-print-card-title">Gusset</div>
                <div className="cp-print-card-meta">{gusPlan?cpTileLabel(gusPlan):"Add a depth in Stage 4"}</div>
                <PrintButton tone="cp" small label="Print gusset" meta={gusPlan?cpTileLabel(gusPlan):"—"} disabled={!model.valid||!hasGusset||!gusPlan} onClick={()=>cpPrintGusset(model,params)}/>
              </div>
            )}
            {stabOn&&(
              <div className="cp-print-card-new">
                <div className="cp-print-card-title">Stabilizer</div>
                <div className="cp-print-card-meta">{stabPlan?cpTileLabel(stabPlan):"Add stabilizer inset"}</div>
                <PrintButton tone="cp" small label="Print stabilizer" meta={stabPlan?cpTileLabel(stabPlan):"—"} disabled={!model.valid||!stabPlan} onClick={()=>cpPrintStabilizer(model,params)}/>
              </div>
            )}
            <div className="cp-print-card-new">
              <div className="cp-print-card-title">Cutting list</div>
              <div className="cp-print-card-meta">All pieces &amp; dimensions</div>
              <PrintButton tone="cp" small label="Print cutting list" onClick={()=>window.print()}/>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
