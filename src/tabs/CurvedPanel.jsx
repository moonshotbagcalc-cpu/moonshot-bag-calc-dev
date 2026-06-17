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
import {
  cpStabilizerPoints, cpOffsetInwardMiter, cpInsetClosedPoints,
  cpHasSelfCross, cpPtsBB, stabSVGElement,
} from "../stabilizer.js";
import {
  cpSquareMark, cpDiamondMark, cpTriangleMark, cpPerpTick,
  cpTriangleH, cpTriangleV,
} from "../diagramMarks.js";
import {
  cpPrintDoc, cpPrintPanel, cpPrintStabilizer, cpPrintSides, cpPrintGusset,
  cpDrawStrip, cpDrawTaperedStrip, cpPiecePrintWidth,
} from "../printRenderers.js";

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
/* Print functions (cpPrintDoc, cpPrintPanel, cpPrintStabilizer, cpPrintSides,
   cpPrintGusset, cpDrawStrip, cpDrawTaperedStrip, cpPiecePrintWidth) relocated to
   src/printRenderers.js (Pass 11) — imported at top of file. */

/* C_PIECE_CENTER alias kept for screen diagram functions (cpGussetMapHTML uses it) */
const C_PIECE_CENTER = C_CENTER;

/* ── Geometry helpers used by screen diagram rendering (stay in this file) ─── */
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
function cpDist(a,b){return Math.hypot((b?.x||0)-(a?.x||0),(b?.y||0)-(a?.y||0));}
function cpUnit(x,y){const l=Math.hypot(x,y)||1e-9;return {x:x/l,y:y/l};}
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
  if(stabPts)svg+=stabSVGElement('path',`d="${cpPtsToPath(map(stabPts),true)}"`);
  return svg;
}


function cpSvgPts(pts){
  return (pts||[]).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
function cpMiniSvgStyle(svgW,svgH){
  return `width:auto;height:${svgH.toFixed(1)}px;max-height:230px;max-width:165px;display:block;margin:0 auto;overflow:visible`;
}
function cpMiniShell(svg){
  return `<div class="cp-mini" style="flex:0 0 auto;display:flex;align-items:flex-start;justify-content:center;max-width:170px;margin:0">${svg}</div>`;
}
function cpInsetScreenPolygon(pts,inset){
  if(!pts?.length||pts.length<3||!(inset>0))return null;
  const c=cpCentroid(pts),lines=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[i],b=pts[(i+1)%pts.length];
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    if(len<1e-7)return null;
    let nx=-dy/len,ny=dx/len;
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    if((c.x-mx)*nx+(c.y-my)*ny<0){nx=-nx;ny=-ny;}
    lines.push({a:{x:a.x+nx*inset,y:a.y+ny*inset},b:{x:b.x+nx*inset,y:b.y+ny*inset},nx,ny,src:a});
  }
  const out=[];
  for(let i=0;i<lines.length;i++){
    const prev=lines[(i-1+lines.length)%lines.length],next=lines[i];
    let q=cpLineIntersect(prev.a,prev.b,next.a,next.b);
    if(!q||!Number.isFinite(q.x)||!Number.isFinite(q.y)){
      const nx=prev.nx+next.nx,ny=prev.ny+next.ny,nl=Math.hypot(nx,ny)||1;
      q={x:next.src.x+(nx/nl)*inset,y:next.src.y+(ny/nl)*inset};
    }
    out.push(q);
  }
  return out.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))?out:null;
}

/* Mini strip diagram (on-screen). Returns an HTML string.
   Vertical orientation: length = height axis, width/depth = horizontal axis. */
function cpMiniStrip(cutL, cutW, label, dims, opts){
  const o=opts||{};
  const PAD=18,MAX_H=180,MAX_W=108;
  const CAT=CAT_BAG_STRUCTURES;
  const scale=o.fitScale||Math.min(MAX_H/Math.max(cutL,1e-9),MAX_W/Math.max(cutW,1e-9));
  const drawL=cutL*scale,drawW=cutW*scale;
  const goOff=o.ghost?10:0;
  const svgW=drawW+2*PAD+goOff,svgH=drawL+2*PAD+goOff;
  const x0=PAD,xRight=x0+drawW,yTop=PAD,yBottom=yTop+drawL;
  const midX=x0+drawW/2,midY=yTop+drawL/2;
  const saPx=(o.sa||0)*scale;
  const sy=o.flushStart?yTop:yTop+saPx,ey=o.flushEnd?yBottom:yBottom-saPx;
  const sewL=x0+saPx,sewR=xRight-saPx;
  let s=`<svg width="${svgW.toFixed(1)}" height="${svgH.toFixed(1)}" viewBox="0 0 ${svgW.toFixed(1)} ${svgH.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" style="${cpMiniSvgStyle(svgW,svgH)}">`;
  if(o.ghost){
    s+=`<rect x="${(x0+10).toFixed(1)}" y="${(yTop-10).toFixed(1)}" width="${drawW.toFixed(1)}" height="${drawL.toFixed(1)}" fill="none" stroke="${CAT.color}" stroke-width="${GHOST_WEIGHT}" stroke-opacity="${GHOST_OPACITY}"/>`;
  }
  s+=`<rect x="${x0.toFixed(1)}" y="${yTop.toFixed(1)}" width="${drawW.toFixed(1)}" height="${drawL.toFixed(1)}" fill="${CAT.fillTint}" fill-opacity="${FILL_OPACITY_SCREEN}" stroke="none"/>`;
  if(o.plan&&o.plan.marks.length){
    for(const mk of o.plan.marks){
      const ty=yTop+(o.flushStart?0:saPx)+mk.s*scale;
      const tl=mk.kind==="clip"?saPx*0.8:saPx*0.6;
      const wg=mk.kind==="clip"?W_EASING_CLIP:W_EASING_NOTCH;
      s+=`<line x1="${x0.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${(x0+tl).toFixed(1)}" y2="${ty.toFixed(1)}" stroke="${C_EASING}" stroke-width="${wg}"/>`;
      s+=`<line x1="${xRight.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${(xRight-tl).toFixed(1)}" y2="${ty.toFixed(1)}" stroke="${C_EASING}" stroke-width="${wg}"/>`;
    }
  }
  if(saPx>0&&drawW>2*saPx){
    let d=`M ${sewL.toFixed(1)} ${sy.toFixed(1)} V ${ey.toFixed(1)} M ${sewR.toFixed(1)} ${sy.toFixed(1)} V ${ey.toFixed(1)}`;
    if(!o.flushStart) d+=` M ${sewL.toFixed(1)} ${sy.toFixed(1)} H ${sewR.toFixed(1)}`;
    if(!o.flushEnd)   d+=` M ${sewL.toFixed(1)} ${ey.toFixed(1)} H ${sewR.toFixed(1)}`;
    s+=`<path d="${d}" fill="none" stroke="${C_SEW}" stroke-width="${W_SEW}" stroke-dasharray="${DASH_SEW}"/>`;
  }
  s+=`<line x1="${midX.toFixed(1)}" y1="${yTop.toFixed(1)}" x2="${midX.toFixed(1)}" y2="${yBottom.toFixed(1)}" stroke="${C_CENTER}" stroke-width="${W_CENTER}" stroke-dasharray="${DASH_CENTER}"/>`;
  s+=`<line x1="${x0.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${xRight.toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${C_CENTER}" stroke-width="${W_CENTER}" stroke-dasharray="${DASH_CENTER}"/>`;
  if(saPx>0){
    s+=`<circle cx="${sewL.toFixed(1)}" cy="${midY.toFixed(1)}" r="${MIDPOINT_R}" fill="#ffffff" stroke="${C_MIDPOINT}" stroke-width="${W_MIDPOINT}"/>`;
    s+=`<circle cx="${sewR.toFixed(1)}" cy="${midY.toFixed(1)}" r="${MIDPOINT_R}" fill="#ffffff" stroke="${C_MIDPOINT}" stroke-width="${W_MIDPOINT}"/>`;
  }
  const tb=TRIANGLE_BASE,th=TRIANGLE_HEIGHT;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${yTop.toFixed(1)} ${(midX+tb/2).toFixed(1)},${yTop.toFixed(1)} ${midX.toFixed(1)},${(yTop+th).toFixed(1)}" fill="${C_MIDPOINT}"/>`;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${yBottom.toFixed(1)} ${(midX+tb/2).toFixed(1)},${yBottom.toFixed(1)} ${midX.toFixed(1)},${(yBottom-th).toFixed(1)}" fill="${C_MIDPOINT}"/>`;
  s+=`<polygon points="${x0.toFixed(1)},${(midY-tb/2).toFixed(1)} ${x0.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(x0+th).toFixed(1)},${midY.toFixed(1)}" fill="${C_MIDPOINT}"/>`;
  s+=`<polygon points="${xRight.toFixed(1)},${(midY-tb/2).toFixed(1)} ${xRight.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(xRight-th).toFixed(1)},${midY.toFixed(1)}" fill="${C_MIDPOINT}"/>`;
  if(o.stabInset>0){
    const stPx=o.stabInset*scale;
    const stabX=x0+stPx,stabY=yTop+stPx,stabW=drawW-2*stPx,stabH=drawL-2*stPx;
    if(stabW>0&&stabH>0){
      s+=stabSVGElement('rect',`x="${stabX.toFixed(1)}" y="${stabY.toFixed(1)}" width="${stabW.toFixed(1)}" height="${stabH.toFixed(1)}"`);
    }
  }
  if(o.topLabel){
    const ty=o.flushStart?yTop+14:yBottom-4;
    s+=`<text x="${midX.toFixed(1)}" y="${ty.toFixed(1)}" font-size="11" font-weight="800" font-family="Nunito,sans-serif" fill="${C_SEW}" text-anchor="middle">TOP</text>`;
  }
  s+=`<rect x="${x0.toFixed(1)}" y="${yTop.toFixed(1)}" width="${drawW.toFixed(1)}" height="${drawL.toFixed(1)}" fill="none" stroke="${CAT.color}" stroke-width="${W_CUT}" stroke-linejoin="round"/>`;
  s+=`</svg>`;
  return cpMiniShell(s);
}

/* Trapezoid mini diagram for tapered left/right pieces.
   Vertical orientation: length = height, depth = width.
   Wider end is always at the bottom regardless of which side is physically "top". */
function cpMiniTrapezoid(pc, opts){
  const o=opts||{};
  const PAD=18;
  const depthTop=pc.cutWidthTop;
  const depthBottom=pc.cutWidthBottom;
  const cutLength=pc.cutLength;
  const maxDepth=Math.max(depthTop,depthBottom);
  const MAX_H=180,MAX_W=108;
  const scale=o.fitScale||Math.min(MAX_H/Math.max(cutLength,1e-9),MAX_W/Math.max(maxDepth,1e-9));
  const drawLength=cutLength*scale;
  const drawTop=depthTop*scale;
  const drawBottom=depthBottom*scale;
  const drawMax=maxDepth*scale;
  const svgW=drawMax+2*PAD+(o.ghost?10:0);
  const svgH=drawLength+2*PAD+(o.ghost?10:0);
  const yTop=PAD,yBottom=PAD+drawLength;
  const topLeft=PAD+(drawMax-drawTop)/2,topRight=topLeft+drawTop;
  const bottomLeft=PAD+(drawMax-drawBottom)/2,bottomRight=bottomLeft+drawBottom;
  const cutPts=[{x:topLeft,y:yTop},{x:topRight,y:yTop},{x:bottomRight,y:yBottom},{x:bottomLeft,y:yBottom}];
  const midX=(topLeft+topRight+bottomLeft+bottomRight)/4;
  const midY=yTop+drawLength/2;
  const leftMidX=(topLeft+bottomLeft)/2;
  const rightMidX=(topRight+bottomRight)/2;
  const saPx=(o.sa||0)*scale;
  const marker=C_MIDPOINT;
  const openTop=o.flushStart;

  function offsetEdge(a,b,d){
    const c=cpCentroid(cutPts);
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1e-9;
    let nx=-dy/len,ny=dx/len;
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    if((c.x-mx)*nx+(c.y-my)*ny<0){nx=-nx;ny=-ny;}
    return {a:{x:a.x+nx*d,y:a.y+ny*d},b:{x:b.x+nx*d,y:b.y+ny*d}};
  }
  function lineFrom(seg){return {p:seg.a,d:{x:seg.b.x-seg.a.x,y:seg.b.y-seg.a.y}};}
  function intersectLines(A,B){return cpLineDirIntersect(A.p,A.d,B.p,B.d);}

  let s=`<svg width="${svgW.toFixed(1)}" height="${svgH.toFixed(1)}" viewBox="0 0 ${svgW.toFixed(1)} ${svgH.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" style="${cpMiniSvgStyle(svgW,svgH)}">`;
  if(o.ghost){
    const gPts=cutPts.map(p=>({x:p.x+10,y:p.y-10}));
    s+=`<polygon points="${cpSvgPts(gPts)}" fill="none" stroke="${CP.pinkLine}" stroke-width="1.5" opacity="0.5"/>`;
  }
  s+=`<polygon points="${cpSvgPts(cutPts)}" fill="#ede8f8" fill-opacity=".72" stroke="none"/>`;

  let sewPts=null;
  if(saPx>0){
    if(openTop){
      const topLine={p:cutPts[0],d:{x:cutPts[1].x-cutPts[0].x,y:cutPts[1].y-cutPts[0].y}};
      const rightLine=lineFrom(offsetEdge(cutPts[1],cutPts[2],saPx));
      const bottomLine=lineFrom(offsetEdge(cutPts[2],cutPts[3],saPx));
      const leftLine=lineFrom(offsetEdge(cutPts[3],cutPts[0],saPx));
      const L0=intersectLines(leftLine,topLine);
      const L1=intersectLines(leftLine,bottomLine);
      const R1=intersectLines(rightLine,bottomLine);
      const R0=intersectLines(rightLine,topLine);
      if(L0&&L1&&R1&&R0){
        sewPts=[L0,L1,R1,R0];
        s+=`<path d="M ${L0.x.toFixed(1)} ${L0.y.toFixed(1)} L ${L1.x.toFixed(1)} ${L1.y.toFixed(1)} L ${R1.x.toFixed(1)} ${R1.y.toFixed(1)} L ${R0.x.toFixed(1)} ${R0.y.toFixed(1)}" fill="none" stroke="${C_SEW}" stroke-width="${W_SEW}" stroke-dasharray="${DASH_SEW}"/>`;
      }
    } else {
      sewPts=cpInsetScreenPolygon(cutPts,saPx);
      if(sewPts?.length){
        s+=`<polygon points="${cpSvgPts(sewPts)}" fill="none" stroke="${C_SEW}" stroke-width="${W_SEW}" stroke-dasharray="${DASH_SEW}"/>`;
      }
    }
  }

  s+=`<line x1="${midX.toFixed(1)}" y1="${yTop.toFixed(1)}" x2="${midX.toFixed(1)}" y2="${yBottom.toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="5 5"/>`;
  s+=`<line x1="${leftMidX.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${rightMidX.toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="5 5"/>`;
  if(sewPts?.length){
    const leftMid={x:(sewPts[0].x+sewPts[1].x)/2,y:(sewPts[0].y+sewPts[1].y)/2};
    const rightMid={x:(sewPts[2].x+sewPts[3].x)/2,y:(sewPts[2].y+sewPts[3].y)/2};
    s+=`<circle cx="${leftMid.x.toFixed(1)}" cy="${leftMid.y.toFixed(1)}" r="${MIDPOINT_R}" fill="#ffffff" stroke="${C_MIDPOINT}" stroke-width="${W_MIDPOINT}"/>`;
    s+=`<circle cx="${rightMid.x.toFixed(1)}" cy="${rightMid.y.toFixed(1)}" r="${MIDPOINT_R}" fill="#ffffff" stroke="${C_MIDPOINT}" stroke-width="${W_MIDPOINT}"/>`;
  }
  const tb=TRIANGLE_BASE,th=TRIANGLE_HEIGHT;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${yTop.toFixed(1)} ${(midX+tb/2).toFixed(1)},${yTop.toFixed(1)} ${midX.toFixed(1)},${(yTop+th).toFixed(1)}" fill="${marker}"/>`;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${yBottom.toFixed(1)} ${(midX+tb/2).toFixed(1)},${yBottom.toFixed(1)} ${midX.toFixed(1)},${(yBottom-th).toFixed(1)}" fill="${marker}"/>`;
  s+=`<polygon points="${leftMidX.toFixed(1)},${(midY-tb/2).toFixed(1)} ${leftMidX.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(leftMidX+th).toFixed(1)},${midY.toFixed(1)}" fill="${marker}"/>`;
  s+=`<polygon points="${rightMidX.toFixed(1)},${(midY-tb/2).toFixed(1)} ${rightMidX.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(rightMidX-th).toFixed(1)},${midY.toFixed(1)}" fill="${marker}"/>`;
  if(o.stabInset>0){
    const stPx=o.stabInset*scale;
    const stabPts=cpInsetScreenPolygon(cutPts,stPx);
    if(stabPts?.length){
      s+=stabSVGElement('polygon',`points="${cpSvgPts(stabPts)}"`);
    }
  }
  s+=`<polygon points="${cpSvgPts(cutPts)}" fill="none" stroke="${CP.maroon}" stroke-width="2.5" stroke-linejoin="round"/>`;
  s+=`</svg>`;
  return cpMiniShell(s);
}

/* cpProw and cpPieceBlock relocated to src/measurementsTable.js (Pass 11) — imported below. */
import { cpProw, cpPieceBlock } from "../measurementsTable.js";

/* Sides minis + tables */
function cpPiecePreviewTitle(pc){
  if(pc.sides?.includes("left")&&pc.sides?.includes("right"))return "Sides";
  if(pc.side==="right")return "Right side";
  if(pc.side==="left")return "Left side";
  if(pc.side==="top")return "Top";
  if(pc.side==="bottom")return "Bottom";
  return pc.label?.replace(/\s+—\s+CUT\s+\d+/i,"")||"Piece";
}
function cpPiecePreviewOrder(pc){
  if(pc.sides?.includes("left")&&pc.sides?.includes("right"))return 0;
  if(pc.side==="right")return 0;
  if(pc.side==="left")return 1;
  if(pc.side==="top")return 2;
  if(pc.side==="bottom")return 3;
  return 9;
}
function cpPiecePreviewDims(pc){
  if(pc.cutWidthTop!==undefined){
    return `${cpFmt(pc.cutLength)} × ${cpFmt(pc.cutWidthTop)} top / ${cpFmt(pc.cutWidthBottom)} bottom`;
  }
  return `${cpFmt(pc.cutLength)} × ${cpFmt(pc.cutWidth)}`;
}

/* Sides minis + tables */
function cpSidesHTML(m,p){
  const pieces=[...(m.displaySidePieces||[])].sort((a,b)=>cpPiecePreviewOrder(a)-cpPiecePreviewOrder(b));
  if(!pieces.length)return {minis:"",tables:""};
  const maxW=Math.max(...pieces.map(x=>x.cutWidthTop!==undefined?Math.max(x.cutWidthTop,x.cutWidthBottom):x.cutWidth));
  const maxL=Math.max(...pieces.map(x=>x.cutLength));
  // Shared preview scale keeps all piece drawings readable without letting one SVG grow huge.
  const fitScale=Math.min(170/Math.max(maxL,1e-9),96/Math.max(maxW,1e-9));
  const stabInset=(p.stabilizerOn&&p.stabilizerInset>0)?p.stabilizerInset:0;
  const cards=[];
  let tables="";
  for(const pc of pieces){
    const isTaper=pc.cutWidthTop!==undefined&&Math.abs(pc.cutWidthTop-pc.cutWidthBottom)>1e-9;
    const svg=isTaper
      ?cpMiniTrapezoid(pc,{ghost:pc.quantity===2,sa:p.sa,stabInset,fitScale,flushStart:pc.flushStart,flushEnd:pc.flushEnd})
      :cpMiniStrip(pc.cutLength,pc.cutWidth,pc.label,"",{ghost:pc.quantity===2,sa:p.sa,plan:pc.plan,flushStart:pc.flushStart,flushEnd:pc.flushEnd,runLen:pc.runLength,topLabel:pc.flushStart||pc.flushEnd,fitScale,stabInset});
    cards.push({title:cpPiecePreviewTitle(pc),dims:cpPiecePreviewDims(pc),svg});
    if(isTaper){
      const widthRow=cpProw("Width — cut",`${cpFmt(pc.cutWidthTop)} top / ${cpFmt(pc.cutWidthBottom)} btm`,`${cpFmt(pc.finishedWidthTop)} / ${cpFmt(pc.finishedWidthBottom)}`);
      tables+=cpPieceBlock(pc.label,[cpProw("Length — cut",cpFmt(pc.cutLength),cpFmt(pc.runLength)),widthRow],"Tapered: top and bottom widths differ.");
    } else {
      const note=pc.flushStart||pc.flushEnd?"Raw-top end is flush; the opposite end includes the joining seam allowance.":(pc.quantity===2?"Verified mirrored pair; one template can be used for both sides.":"");
      tables+=cpPieceBlock(pc.label,[cpProw("Length — cut",cpFmt(pc.cutLength),cpFmt(pc.runLength)),cpProw("Width — cut",cpFmt(pc.cutWidth),cpFmt(pc.finishedWidth))],note);
    }
  }
  const cols=`repeat(${cards.length}, minmax(112px, 1fr))`;
  const heads=cards.map(c=>`<div class="cp-pieceHead" style="min-width:0;text-align:center"><div style="font-weight:900;color:${CP.ink};line-height:1.05">${c.title}</div><div style="font-size:12px;font-weight:800;color:${CP.muted};line-height:1.2;margin-top:3px">${c.dims}</div></div>`).join("");
  const svgs=cards.map(c=>`<div class="cp-pieceSvg" style="min-width:0;display:flex;align-items:flex-start;justify-content:center">${c.svg}</div>`).join("");
  const minis=`<div class="cp-pieceGrid" style="display:grid;grid-template-columns:${cols};column-gap:14px;row-gap:8px;align-items:start;width:100%;max-width:100%;overflow-x:auto;padding:4px 2px 0">${heads}${svgs}</div>`;
  return {minis,tables};
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
    const stPx=stabInset*scale;
    const stabX=x0+stPx,stabY=y0+stPx,stabW=drawL-2*stPx,stabH=drawW-2*stPx;
    if(stabW>0&&stabH>0){
      s+=stabSVGElement('rect',`x="${stabX.toFixed(1)}" y="${stabY.toFixed(1)}" width="${stabW.toFixed(1)}" height="${stabH.toFixed(1)}"`);
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
  return{w:Math.max(...pcs.map(x=>x.cutLength))+pad*2,h:pcs.reduce((a,x)=>a+cpPiecePrintWidth(x),0)+gap*(pcs.length-1)+pad*2};
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
