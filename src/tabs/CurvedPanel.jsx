import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
import FracInput, { VINYL_FRACS } from "../components/FracInput.jsx";
import {
  CAT_BAG_STRUCTURES,
  C_SEW, C_CENTER, C_EASING, C_STAB, C_MIDPOINT, C_PIPING, C_CORD,
  W_CUT, W_SEW, W_STAB, W_CENTER, W_MIDPOINT, W_PIPING,
  W_EASING_CLIP, W_EASING_NOTCH,
  DASH_SEW, DASH_STAB, DASH_CENTER,
  MIDPOINT_R, TRIANGLE_BASE, TRIANGLE_HEIGHT,
  GHOST_OPACITY, GHOST_WEIGHT, GHOST_OFFSET,
  FILL_OPACITY_SCREEN, STRIP_PAD,
} from "../diagramTokens.js";
import { offsetSidePaths, joinAllSides } from "../geometryOffset.js";
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

/* 1/16" precision formatter — used only in the perimeter block.
   Curves/tapers are the only context where sub-1/8" differences matter,
   and that's also the only context where this block appears.
   Uses FM32 fraction entries that land on even 32nds (= 1/16" boundaries). */
const _FM16={0:"",0.0625:"1/16",0.125:"1/8",0.1875:"3/16",0.25:"1/4",
  0.3125:"5/16",0.375:"3/8",0.4375:"7/16",0.5:"1/2",0.5625:"9/16",
  0.625:"5/8",0.6875:"11/16",0.75:"3/4",0.8125:"13/16",0.875:"7/8",0.9375:"15/16"};
function cpFmtPerim(v){
  if(isMetric())return fmtCm(v);
  if(!v||v<=0)return "—";
  const r=Math.round(v*16)/16,w=Math.floor(r),fr=Math.round((r-w)*16)/16;
  const wh=fr>=1?w+1:w,fv=fr>=1?0:fr;
  const fs=_FM16[Math.round(fv*16)/16]??"";
  if(wh===0&&fs)return `${fs}"`;
  if(!fs)return `${wh}"`;
  return `${wh}-${fs}"`;
}

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
function cpPathLen(pts){let l=0;for(let i=1;i<(pts?.length||0);i++)l+=cpDist(pts[i-1],pts[i]);return l;}
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

/* Main panel diagram — returns inner SVG markup for a 760×520 viewBox.
   pipOpts: { on, cord, vinyl, corners, allCornersPass } — optional piping overlay */
function cpPanelDiagramSVG(model,params,pipOpts){
  const VW=760,VH=490,PAD_X=28,PAD_TOP=28,PAD_BOT=48,bb=model.cutBB;
  const scale=Math.min((VW-PAD_X*2)/bb.w,(VH-PAD_TOP-PAD_BOT)/bb.h);
  const ox=(VW-bb.w*scale)/2-bb.minX*scale;
  const oy=PAD_TOP+(VH-PAD_TOP-PAD_BOT-bb.h*scale)/2-bb.minY*scale;
  const X=v=>v*scale+ox,Y=v=>v*scale+oy,map=pts=>pts.map(p=>({x:X(p.x),y:Y(p.y)}));
  const active=model.activeSew;
  let svg="";
  const fr=model.frame,midX=(fr[0].x+fr[1].x)/2;
  const MIN=14;
  function dedup(pts){const kept=[];for(const p of pts){const sx=X(p.x),sy=Y(p.y);if(kept.every(k=>Math.hypot(k.sx-sx,k.sy-sy)>=MIN))kept.push({p,sx,sy});}return kept.map(k=>k.p);}
  const junctions=dedup(active.junctions||[]),midpoints=dedup(active.midpoints||[]);
  const mds=cpMarkDetails(model.cutPts,model.marks,0,0);
  const stabPts=cpStabilizerPoints(model,params);

  // Z-order: fill → stabilizer → sewline → center → junctions → midpoints → triangles → cut stroke
  // 1. fill tint (bottommost — drawn before all strokes)
  svg+=`<path d="${cpPtsToPath(map(model.cutPts),true)}" fill="${CAT_BAG_STRUCTURES.fillTint}" fill-opacity="${FILL_OPACITY_SCREEN}" stroke="none"/>`;
  // 2. stabilizer (above fill, below sewline per spec)
  if(stabPts)svg+=stabSVGElement('path',`d="${cpPtsToPath(map(stabPts),true)}"`);
  // 3. sewline
  svg+=`<path d="${cpPtsToPath(map(active.pts),active.closed)}" fill="none" stroke="${C_SEW}" stroke-width="${W_SEW}" stroke-dasharray="${DASH_SEW}"/>`;
  // 4. center fold line
  svg+=`<line x1="${X(midX).toFixed(1)}" y1="${Y(bb.minY).toFixed(1)}" x2="${X(midX).toFixed(1)}" y2="${Y(bb.maxY).toFixed(1)}" stroke="${C_CENTER}" stroke-width="${W_CENTER}" stroke-dasharray="${DASH_CENTER}"/>`;
  // 5. junction squares — category color (open square, 7×7px per spec)
  for(const j of junctions){const cx=X(j.x),cy=Y(j.y),q=3.5;svg+=`<rect x="${(cx-q).toFixed(1)}" y="${(cy-q).toFixed(1)}" width="${(2*q).toFixed(1)}" height="${(2*q).toFixed(1)}" fill="#fff" stroke="${CAT_BAG_STRUCTURES.color}" stroke-width="${W_MIDPOINT}" rx="1"/>`;}
  // 6. midpoint circles — red open circle per spec (C_MIDPOINT, MIDPOINT_R)
  for(const m of midpoints){const cx=X(m.x),cy=Y(m.y);svg+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MIDPOINT_R}" fill="#fff" stroke="${C_MIDPOINT}" stroke-width="${W_MIDPOINT}"/>`;}
  // 7. center match triangles + perp ticks (blend marks at 50% scale — intentional)
  mds.forEach((md,mi)=>{
    const isEdge=!model.marks[mi]||model.marks[mi].kind!=="blend";
    const base=isEdge?TRIANGLE_BASE:TRIANGLE_BASE*0.5,ht=isEdge?TRIANGLE_HEIGHT:TRIANGLE_HEIGHT*0.5;
    const px=X(md.x),py=Y(md.y);
    const b1x=px-md.tx*base/2,b1y=py-md.ty*base/2,b2x=px+md.tx*base/2,b2y=py+md.ty*base/2,ax=px+md.nx*ht,ay=py+md.ny*ht;
    svg+=`<polygon points="${b1x.toFixed(1)},${b1y.toFixed(1)} ${b2x.toFixed(1)},${b2y.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}" fill="${C_MIDPOINT}"/>`;
    if(isEdge)svg+=`<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${(px+md.nx*TRIANGLE_HEIGHT).toFixed(1)}" y2="${(py+md.ny*TRIANGLE_HEIGHT).toFixed(1)}" stroke="${C_MIDPOINT}" stroke-width="${W_MIDPOINT}"/>`;
  });
  // 8. cut line stroke (topmost line layer)
  svg+=`<path d="${cpPtsToPath(map(model.cutPts),true)}" fill="none" stroke="${CAT_BAG_STRUCTURES.color}" stroke-width="${W_CUT}" stroke-linejoin="round"/>`;

  // 9. Piping overlay — rule-driven physical strip runs + separate cord strokes
  if(pipOpts?.on && pipOpts.cord>1e-9 && pipOpts.corners && model.cutSides?.top){
    const D=pipOpts.cord, SA=params.sa;
    const easeOff=Math.max(0,pipOpts.easeOff||0);
    const cordOffset=D/2+CORD_STAY_AWAY; // cord centerline inset from sewline (inward)

    /* Trust/accuracy: the diagram starts from the SAME recommended cut-strip
       width shown in the Piping dropdown, then converts that flat cut width into
       the installed/folded width that is actually visible on the panel. */
    const stripCutWidth=Math.max(
      SA+D+2*CORD_STAY_AWAY,
      pipOpts.stripWidth || cpPipingStripWidth(D,pipOpts.vinyl||0,SA).recommended
    );
    // The on-panel folded-edge offset is the installed/visible folded-strip width.
    // This accounts for cord wrap/bulk and keeps the diagram visually realistic.
    const stripVisibleWidth=cpPipingInstalledFoldWidth(stripCutWidth,D,pipOpts.vinyl||0,SA);

    const innerSides=offsetSidePaths(model.cutSides,stripVisibleWidth); // folded/inner edge, installed to-scale from cut edge
    const cordSides=offsetSidePaths(model.sewSides,cordOffset);         // cord centerline, from sewline

    const SIDE_ORDER_CLOSED=['top','right','bottom','left'];
    const SIDE_ORDER_OPEN=['right','bottom','left'];
    const JOINT_BEFORE={top:3,right:0,bottom:1,left:2};
    const JOINT_AFTER ={top:0,right:1,bottom:2,left:3};
    const cornerFails=idx=>!!pipOpts.corners?.[idx]&&!pipOpts.corners[idx].allowed;
    const sc=p=>({x:X(p.x),y:Y(p.y)});
    const pt=q=>`${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
    const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
    const mul=(a,k)=>({x:a.x*k,y:a.y*k});
    const dot=(a,b)=>a.x*b.x+a.y*b.y;
    const perp=v=>({x:-v.y,y:v.x});
    const len=v=>Math.hypot(v.x,v.y);
    const unitV=v=>{const l=len(v)||1e-9;return{x:v.x/l,y:v.y/l};};
    const cordW=Math.max(1.0,D*scale).toFixed(2);
    const stripStroke=Math.max(1.0,Math.min(2.2,stripVisibleWidth*scale*0.055)).toFixed(2);
    let pipingPieceSerial=0;
    const pipingClipMarkPoints=[];

    // ── Exit-tail geometry constants ─────────────────────────────────────────
    const EXIT_OVERSHOOT_IN = 0.25;  // strip extension past fold-exit point (imperial, inches)
    const EXIT_OVERSHOOT_MM = 5;     // same, metric mm — converted to inches below
    const EXIT_ANGLE_DEG    = 55;    // fold-edge exit angle from cut-edge tangent (degrees)
    const EXIT_ANGLE_RAD    = EXIT_ANGLE_DEG * Math.PI / 180;
    // All model geometry is stored in inches; convert mm at use-time so the math stays consistent.
    const EXIT_OVERSHOOT    = isMetric() ? EXIT_OVERSHOOT_MM / 25.4 : EXIT_OVERSHOOT_IN;
    // easeArcRadius: installed/visible folded-strip width, used for the normal on-panel
    // folded-edge offset and the 55° failed-corner easing radius.
    const easeArcRadius = stripVisibleWidth;
    // tailFoldWidth: physical half of the flat cut strip, used only after the 55°
    // transition for the short easing tail/end-cap width.
    const tailFoldWidth = stripCutWidth / 2;

    function pathLen(path){let l=0;for(let i=1;i<path.length;i++)l+=cpDist(path[i-1],path[i]);return l;}
    function pathSegModel(path,dS=0,dE=null){
      if(!path||path.length<2)return[];
      const total=pathLen(path);
      dS=Math.max(0,Math.min(dS,total));
      dE=dE==null?total:Math.max(0,Math.min(dE,total));
      if(dE<=dS+1e-7)return[];
      const ann=[{dist:0,...path[0]}];
      for(let i=1;i<path.length;i++)ann.push({dist:ann[i-1].dist+cpDist(path[i-1],path[i]),...path[i]});
      const out=[];
      for(let i=0;i<ann.length-1;i++){
        const a=ann[i],b=ann[i+1],seg=b.dist-a.dist||1e-9;
        if(a.dist<dS&&b.dist>dS){const t=(dS-a.dist)/seg;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,side:a.side});}
        if(a.dist>=dS&&a.dist<=dE)out.push({x:a.x,y:a.y,side:a.side});
        if(a.dist<dE&&b.dist>dE){const t=(dE-a.dist)/seg;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,side:b.side});}
      }
      const last=ann[ann.length-1];
      if(last.dist>=dS&&last.dist<=dE)out.push({x:last.x,y:last.y,side:last.side});
      return cpDedupePath(out,false);
    }
    function concatSegs(segments){
      const out=[];
      for(const seg of segments){
        for(let i=0;i<seg.length;i++){
          const p=seg[i];
          if(out.length&&i===0&&cpDist(out[out.length-1],p)<1e-7)continue;
          out.push({...p});
        }
      }
      return cpDedupePath(out,false);
    }
    function runPath(sidePaths,sides,startTrim,endTrim){
      const segs=[];
      for(let i=0;i<sides.length;i++){
        const side=sides[i],path=sidePaths[side]||[],L=pathLen(path);
        const dS=i===0?Math.min(startTrim,L*0.45):0;
        const dE=i===sides.length-1?Math.max(0,L-Math.min(endTrim,L*0.45)):L;
        const seg=pathSegModel(path,dS,dE);
        if(seg.length)segs.push(seg);
      }
      return concatSegs(segs);
    }
    function tangentAt(pts,atStart){
      if(!pts||pts.length<2)return {x:1,y:0};
      const a=atStart?pts[0]:pts[pts.length-2];
      const b=atStart?pts[1]:pts[pts.length-1];
      return unitV(sub(b,a));
    }
    function nearestCutFrame(point){
      const pts=model.cutPts||[];
      if(pts.length<2){
        const inward=unitV(sub({x:(bb.minX+bb.maxX)/2,y:(bb.minY+bb.maxY)/2},point));
        return{point,tangent:{x:1,y:0},inward};
      }
      let best=null,bestD=Infinity;
      for(let i=0;i<pts.length;i++){
        const a=pts[i],b=pts[(i+1)%pts.length],ab=sub(b,a);
        const ab2=dot(ab,ab)||1e-9;
        const t=Math.max(0,Math.min(1,dot(sub(point,a),ab)/ab2));
        const q=add(a,mul(ab,t));
        const d=cpDist(point,q);
        if(d<bestD){bestD=d;best={point:q,tangent:unitV(ab),a,b};}
      }
      const center={x:(bb.minX+bb.maxX)/2,y:(bb.minY+bb.maxY)/2};
      best.inward=unitV(sub(center,best.point));
      return best;
    }
    function cutFrameOnPath(point,path){
      // Project a model-space point to a specific cut-edge path so the mark cannot
      // snap to an adjacent side at crisp/tight corners.
      const pts=path||[];
      if(pts.length<2)return nearestCutFrame(point);
      let best=null,bestD=Infinity;
      for(let i=0;i<pts.length-1;i++){
        const a=pts[i],b=pts[i+1],ab=sub(b,a),ab2=dot(ab,ab)||1e-9;
        const t=Math.max(0,Math.min(1,dot(sub(point,a),ab)/ab2));
        const q=add(a,mul(ab,t));
        const d=cpDist(point,q);
        if(d<bestD){bestD=d;best={point:q,tangent:unitV(ab),a,b};}
      }
      const center={x:(bb.minX+bb.maxX)/2,y:(bb.minY+bb.maxY)/2};
      best.inward=unitV(sub(center,best.point));
      return best;
    }
    function drawPipingEaseAwayNotch(exitPt,owningPath=null,shiftAwayDir=null){
      // Ease-away / strip-bend notch: outline triangle rendered at the raw-edge bend B.
      // When shiftAwayDir is supplied, B becomes the OUTSIDE/base edge of the notch
      // instead of the triangle center. This keeps the drawn notch from overlapping
      // the little exit tail and better matches the physical cut: the notch starts at B
      // and extends back into the normal strip.
      const cordEnd=exitPt; // alias for local vector helpers that still reference cordEnd
      const f=owningPath?cutFrameOnPath(cordEnd,owningPath):nearestCutFrame(cordEnd);
      let t=unitV(f.tangent);
      const center={x:(bb.minX+bb.maxX)/2,y:(bb.minY+bb.maxY)/2};
      let inward=unitV(perp(t));
      if(dot(inward,sub(center,cordEnd))<0)inward=mul(inward,-1);
      const base=TRIANGLE_BASE*0.85,ht=TRIANGLE_HEIGHT*0.75;

      let markCenter=cordEnd;
      if(shiftAwayDir){
        const sd=unitV(shiftAwayDir);
        if(dot(t,sd)<0)t=mul(t,-1);
        markCenter=add(cordEnd,mul(sd,(base/2+1.0)/scale));
      }

      const p=sc(markCenter);
      const b1={x:p.x-t.x*base/2,y:p.y-t.y*base/2};
      const b2={x:p.x+t.x*base/2,y:p.y+t.y*base/2};
      const apex={x:p.x+inward.x*ht,y:p.y+inward.y*ht};
      svg+=`<polygon points="${pt(b1)} ${pt(b2)} ${pt(apex)}" fill="none" stroke="${C_CORD}" stroke-width="1.4" stroke-linejoin="round"/>`;
    }
    function drawPipingClipMark(point,owningPath=null){
      // Curve clipping marks: short line notches that begin on the cut edge,
      // run perpendicular inward, and stop short of the sewline.
      // Rule: notch occupies 60% of SA and keeps 40% stay-away from the stitch line.
      const f=owningPath?cutFrameOnPath(point,owningPath):nearestCutFrame(point);
      const markKey=f.point;
      for(const prev of pipingClipMarkPoints){
        if(cpDist(prev,markKey)<Math.max(0.10,SA*0.42))return; // prevent double marks at corner/side joins
      }
      pipingClipMarkPoints.push({...markKey});
      const p=sc(f.point),t=unitV(f.tangent);
      const center={x:(bb.minX+bb.maxX)/2,y:(bb.minY+bb.maxY)/2};
      let n=unitV(perp(t));
      if(dot(n,sub(center,f.point))<0)n=mul(n,-1);
      const notchLen=Math.max(5,SA*scale*0.60);
      const p2={x:p.x+n.x*notchLen,y:p.y+n.y*notchLen};
      svg+=`<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${C_CORD}" stroke-width="${(W_EASING_NOTCH*1.2).toFixed(2)}" stroke-linecap="round"/>`;
    }
    function pointOnPath(path,distAlong){
      if(!path||path.length<2)return null;
      let r=distAlong;
      for(let i=0;i<path.length-1;i++){
        const a=path[i],b=path[i+1],L=cpDist(a,b);
        if(r<=L){
          const t=L>1e-9?r/L:0;
          return{point:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},tangent:unitV(sub(b,a))};
        }
        r-=L;
      }
      const n=path.length;
      return{point:path[n-1],tangent:unitV(sub(path[n-1],path[n-2]))};
    }
    function localTurnAtDistance(path,d,delta=0.18){
      if(!path||path.length<4)return 0;
      const a=pointOnPath(path,Math.max(0,d-delta));
      const b=pointOnPath(path,Math.min(pathLen(path),d+delta));
      if(!a||!b)return 0;
      const c=Math.max(-1,Math.min(1,dot(a.tangent,b.tangent)));
      return Math.acos(c);
    }
    function sideCurveClipSpacing(path,curveAmt){
      const L=pathLen(path||[]);
      const h=Math.max(0,curveAmt||0);
      if(!(L>0.75)||h<1/32)return null;
      // Radius estimate from sagitta/chord: R = L²/(8h) + h/2.
      // This keeps gentle side curves around the 1″ spacing end-state.
      const r=(L*L)/(8*h)+h/2;
      return cpPipingNotchSpacing(r);
    }
    function cornerClipPath(corner){
      const pts=model.cutPts||[],n=pts.length;
      if(n<4||!corner)return[];
      let j=-1;
      for(let i=0;i<n;i++){
        if(pts[i].side===corner.sideA&&pts[(i+1)%n].side===corner.sideB){j=i;break;}
      }
      if(j<0)return[];
      const W=28; // only the curved blend window; avoids spilling clip marks onto straight adjacent edges
      const out=[];
      for(let k=-W;k<=W;k++)out.push(pts[(j+k+n)%n]);
      return cpDedupePath(out,false);
    }
    function drawPipingCornerClipMarks(){
      if(!pipOpts?.corners)return;
      for(const corner of pipOpts.corners){
        if(!corner?.allowed||!(corner.notchSpacing>0))continue;
        const path=cornerClipPath(corner),L=pathLen(path);
        if(path.length<2||L<=corner.notchSpacing*1.25)continue;
        // Only mark the actual curved portion of the corner window. This prevents
        // clip marks from marching onto straight side/bottom runs.
        const spacing=corner.notchSpacing;
        for(let d=spacing*0.5;d<L-spacing*0.35;d+=spacing){
          if(localTurnAtDistance(path,d,Math.min(0.22,spacing*0.45))<0.006)continue;
          const m=pointOnPath(path,d);
          if(m)drawPipingClipMark(m.point,path);
        }
      }
    }
    function sideCurveAmount(side){
      if(side==="top")return params.topCrown||0;
      if(side==="bottom")return params.botCrown||0;
      if(side==="left")return params.leftFull||0;
      if(side==="right")return params.rightFull||0;
      return 0;
    }
    function drawPipingSideCurveClipMarks(){
      const activeSides=active.closed?SIDE_ORDER_CLOSED:SIDE_ORDER_OPEN;
      for(const side of activeSides){
        const curveAmt=sideCurveAmount(side);
        if(curveAmt<1/32)continue; // true straight edges do not need clipping
        const path=model.cutSides?.[side]||[],L=pathLen(path);
        if(path.length<3||L<0.75)continue;
        // Use the user-entered curve amount as the primary signal, because cutSides
        // can include adjacent corner blends that make a straight side look curved.
        const spacing=sideCurveClipSpacing(path,curveAmt);
        if(!(spacing>0))continue;
        // Keep side-curve notches away from corner notch windows so corners don't double-mark.
        const margin=Math.min(Math.max(spacing*1.15,easeOff+SA,0.45),L*0.36);
        for(let d=margin+spacing;d<L-margin;d+=spacing){
          const m=pointOnPath(path,d);
          if(m)drawPipingClipMark(m.point,path);
        }
      }
    }
    function drawCordPath(pts,pieceId){
      const cordPts=cpDedupePath(pts,false).map(sc);
      if(cordPts.length<2)return;
      let cd=`M ${pt(cordPts[0])}`;
      for(let i=1;i<cordPts.length;i++)cd+=` L ${pt(cordPts[i])}`;
      svg+=`<path class="cp-piping-cord" data-piece="${pieceId}" d="${cd}" fill="none" stroke="${C_CORD}" stroke-width="${cordW}" opacity="0.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    function rayPathIntersect(origin,dir,path){
      // Returns the point where the ray (origin + t*dir, t > 0) first intersects the polyline,
      // or null if no positive-t intersection exists.
      let best=null,bestT=Infinity;
      for(let i=0;i<path.length-1;i++){
        const a=path[i],b=path[i+1];
        const ex=b.x-a.x,ey=b.y-a.y;
        const denom=dir.x*ey-dir.y*ex;
        if(Math.abs(denom)<1e-10)continue; // parallel
        const fx=origin.x-a.x,fy=origin.y-a.y;
        const t=(fx*ey-fy*ex)/denom;
        const s=(fx*dir.y-fy*dir.x)/denom;
        if(t>1e-6&&s>=-1e-6&&s<=1+1e-6&&t<bestT){bestT=t;best={x:a.x+s*ex,y:a.y+s*ey};}
      }
      return best;
    }
    function linePathIntersectInfo(origin,dir,path,maxT=null){
      // Same intersection idea as rayPathIntersect(), but returns a point that is
      // guaranteed to lie on the supplied polyline plus its distance along that polyline.
      // Used for C so the cord keeps following its own centerline instead of bending
      // toward the folded-edge A1/A2 geometry.
      if(!path||path.length<2)return null;
      const u=unitV(dir);
      let best=null,bestScore=Infinity,walk=0;
      for(let i=0;i<path.length-1;i++){
        const a=path[i],b=path[i+1];
        const ex=b.x-a.x,ey=b.y-a.y,L=Math.hypot(ex,ey);
        if(L<1e-9){continue;}
        const denom=u.x*ey-u.y*ex;
        if(Math.abs(denom)>1e-10){
          const fx=origin.x-a.x,fy=origin.y-a.y;
          const t=(fx*ey-fy*ex)/denom;
          const segS=(fx*u.y-fy*u.x)/denom;
          if(t>=-1e-6 && (maxT==null||t<=maxT+1e-6) && segS>=-1e-6 && segS<=1+1e-6){
            const q={x:a.x+segS*ex,y:a.y+segS*ey};
            const score=Math.abs(t-(maxT==null?t:Math.min(maxT,t)));
            if(score<bestScore){bestScore=score;best={point:q,dist:walk+segS*L,t};}
          }
        }
        walk+=L;
      }
      return best;
    }
    function closestPathPointToLineInfo(origin,dir,path){
      // Fallback only: choose the point on the cord path nearest the B→A1 construction line.
      // This still keeps C on the cord path, unlike the old fallback that placed C near A2.
      if(!path||path.length<2)return null;
      const u=unitV(dir);
      const n=perp(u);
      let best=null,bestD=Infinity,walk=0;
      for(let i=0;i<path.length-1;i++){
        const a=path[i],b=path[i+1];
        const ab=sub(b,a),L=len(ab);
        if(L<1e-9){continue;}
        // Minimize signed distance to the infinite line origin + t*u over this segment.
        const da=dot(sub(a,origin),n),db=dot(sub(b,origin),n);
        let s=0;
        if(Math.abs(da-db)>1e-10)s=Math.max(0,Math.min(1,da/(da-db)));
        else s=0;
        const q=add(a,mul(ab,s));
        const d=Math.abs(dot(sub(q,origin),n));
        if(d<bestD){bestD=d;best={point:q,dist:walk+s*L};}
        walk+=L;
      }
      return best;
    }
    function computeExitTail(Fi,cutTanTowardCorner,nIn,cordPath){
      // Exit-tail geometry. All coords in inches.
      //
      // Fi                 = folded-edge exit point ON the panel cut edge
      //                      (trim point at 1.5×SA + easeOff from the failed corner)
      // cutTanTowardCorner = unit tangent along the cut edge pointing TOWARD the failed corner
      // nIn                = inward normal at Fi, toward panel center
      // cordPath           = owning side's cord centerline path (cordSides[side])
      //
      // Critical geometry:
      //   B is the notch/bend point ON the cut edge.
      //   A2 is the start of the folded-edge easing arc.
      //   A1 is the end of that folded-edge easing arc.
      //   B→A2 and B→A1 are both exactly the installed/visible folded-strip width.
      //   The folded-edge arc A2→A1 is exactly 55°, centered at B.
      //   After that transition, the short tail/end cap uses tailFoldWidth = 1/2 cut strip width.
      //   C is the cord endpoint on the B→A2 construction line, but C stays on the cord centerline.
      //   C is NOT on the folded-edge arc and must never pull the cord onto the folded-edge path.
      //
      // Returns: { Fi, Tf, B, A2, A1, Tr, C, cordDist, R_arc, sweep_natural }

      const R=easeArcRadius; // installed/visible folded-strip width; radius for B→A2 and B→A1
      const tangentAway=mul(cutTanTowardCorner,-1); // along the cut edge, back into the normal run
      const sin55=Math.sin(EXIT_ANGLE_RAD);
      const cos55=Math.cos(EXIT_ANGLE_RAD);

      // B must be placed so the 55° radius endpoint A1 lands on a tangent line
      // that continues cleanly through Fi.  Using only R here creates a 90° corner.
      const notchBack=Math.max(R, R / Math.max(sin55,1e-9));
      const B=add(Fi,mul(tangentAway,notchBack));

      // A2: start of folded-edge easing arc, on the half-strip-width radius from B.
      const dirA2=unitV(nIn);
      const A2=add(B,mul(dirA2,R));

      // A1: end of folded-edge easing arc. Rotate B→A2 by 55° TOWARD the failed corner.
      const turnSign=(dirA2.x*cutTanTowardCorner.y-dirA2.y*cutTanTowardCorner.x)>=0?1:-1;
      const dirA1=unitV({
        x:dirA2.x*cos55-turnSign*dirA2.y*sin55,
        y:turnSign*dirA2.x*sin55+dirA2.y*cos55,
      });
      const A1=add(B,mul(dirA1,R));

      // Folded edge leaves A1 as a straight tangent segment through Fi and then Tf.
      const exitDir=unitV(sub(Fi,A1));
      const Tf=add(Fi,mul(exitDir,EXIT_OVERSHOOT));

      // Se / end cap styling rule:
      // The short trim edge Tr→Tf is the physical half-cut-strip-width edge. It should be
      // perpendicular to the exiting long strip edges and parallel to the B→A1 radius line.
      // Anchor Tf on the folded-edge overshoot, then place Tr exactly tailFoldWidth away
      // along -B→A1. The 55° transition uses R=easeArcRadius; the tail uses tailFoldWidth.
      const Tr=add(Tf,mul(dirA1,-tailFoldWidth));

      // C: cord endpoint. It is inline with the B→A2 construction/radius line,
      // which is perpendicular to the local panel cut edge at B. This matches the
      // notch rule: the outside corner of the strip notch determines the cord end
      // by projecting inward from B, while the cord itself stays on its own path.
      // A1 belongs to the folded-strip easing arc; C does not.
      const dirBtoC=dirA2;
      let cInfo=null;
      if(cordPath&&cordPath.length>=2){
        cInfo=linePathIntersectInfo(B,dirBtoC,cordPath,R+1e-6);
        if(!cInfo)cInfo=closestPathPointToLineInfo(B,dirBtoC,cordPath);
      }
      const C=cInfo?.point || add(B,mul(dirBtoC,Math.max(0,R-D/2)));
      const cordDist=Number.isFinite(cInfo?.dist)?cInfo.dist:null;

      const R_arc=R; // model-space radius; converted to screen units by Arc()
      const sweep_natural=turnSign>0?1:0;

      return{Fi,Tf,B,A2,A1,Tr,C,cordDist,R_arc,sweep_natural,notchBack,tangentAway,dirA2,dirA1};
    }

    function drawStripRun(sides,startFail,endFail){
      const pieceId=++pipingPieceSerial;
      const exitOffset=1.5*SA+easeOff;
      const trimStart=startFail?exitOffset:0;
      const trimEnd=endFail?exitOffset:0;

      // First solve the fold-exit point Fi at the required 1.5×SA+easeOff position.
      // Fi is not the raw-edge notch point B; B sits farther back into the normal run.
      const outerAtFi=runPath(model.cutSides,sides,trimStart,trimEnd);
      if(outerAtFi.length<2)return;

      const startTan=tangentAt(outerAtFi,true),endTan=tangentAt(outerAtFi,false);
      const startSide=sides[0],endSide=sides[sides.length-1];
      const center={x:(bb.minX+bb.maxX)/2,y:(bb.minY+bb.maxY)/2};
      const inwardNormal=(tangent,point)=>{
        let n=unitV(perp(tangent));
        if(dot(n,sub(center,point))<0)n=mul(n,-1);
        return n;
      };

      // Compute exit-tail geometry from Fi.
      // At start: cutTanTowardCorner = -startTan (startTan points into the run).
      // At end:   cutTanTowardCorner = endTan (already points toward the failed corner).
      let tailS=null,tailE=null;
      if(startFail){
        const nIn=inwardNormal(startTan,outerAtFi[0]);
        tailS=computeExitTail(outerAtFi[0],mul(startTan,-1),nIn,cordSides[startSide]);
      }
      if(endFail){
        const nIn=inwardNormal(endTan,outerAtFi[outerAtFi.length-1]);
        tailE=computeExitTail(outerAtFi[outerAtFi.length-1],endTan,nIn,cordSides[endSide]);
      }

      // The visible/raw cut-edge side of the strip stops at B, not at Fi.
      // The folded edge stops at the B/A2 station. The cord is handled separately below
      // so it can stop at C while staying on its own centerline.
      const rawStartTrim=startFail?exitOffset+(tailS?.notchBack||0):0;
      const rawEndTrim=endFail?exitOffset+(tailE?.notchBack||0):0;
      const outer=runPath(model.cutSides,sides,rawStartTrim,rawEndTrim);
      const inner=runPath(innerSides,sides,rawStartTrim,rawEndTrim);

      // Cord stays on its own cord centerline. Its failed endpoint is C, so trim the
      // cord path to C's distance along the owning cord side instead of trimming it
      // to the strip notch B. C is on the B→A2/perpendicular construction line, not A1.
      const startCordTrim=(startFail&&tailS&&tailS.cordDist!=null)?tailS.cordDist:rawStartTrim;
      const endCordSideLen=endFail?pathLen(cordSides[endSide]||[]):0;
      const endCordTrim=(endFail&&tailE&&tailE.cordDist!=null)?Math.max(0,endCordSideLen-tailE.cordDist):rawEndTrim;
      const cord=runPath(cordSides,sides,startCordTrim,endCordTrim);
      if(outer.length<2||inner.length<2)return;

      if(startFail&&tailS)inner[0]=tailS.A2; // pin folded-edge start to the 55° arc start
      if(endFail&&tailE)inner[inner.length-1]=tailE.A2;

      const cpt=p=>pt(sc(p));
      const Lp=p=>` L ${cpt(p)}`;
      // SVG arc uses screen-space coordinates, so the model-space radius must be scaled too.
      // Without this, the browser rescales the tiny inch-radius to the endpoint chord,
      // which makes the easing arc look huge and chord-driven instead of 55°/half-strip-width-driven.
      const Arc=(R,sf,p)=>{
        const rr=Math.max(0.01,R*scale);
        return ` A ${rr.toFixed(2)} ${rr.toFixed(2)} 0 0 ${sf} ${cpt(p)}`;
      };

      // ── Build polygon ──────────────────────────────────────────────────────
      // Walk: cut-edge side (with tail extension) → fold-edge side reversed (with arc exit)
      let d='';

      // Cut-edge side: start at Tr (if failing) else Fi
      d+=startFail?`M ${cpt(tailS.Tr)}`:`M ${cpt(outer[0])}`;
      if(startFail){
        d+=Lp(tailS.B);      // Tr → B: short end cap Se (at start, Se closes via Z)
        d+=Lp(outer[0]);     // B → Fi: along cut edge toward normal run
      }
      for(let i=1;i<outer.length;i++)d+=Lp(outer[i]);  // normal cut-edge run

      if(endFail){
        // Fi_end → B → Tr → Tf → Fi_end → A1 → arc reversed (A1→A2)
        d+=Lp(tailE.B);                                        // Fi_end → B
        d+=Lp(tailE.Tr);                                       // B → Tr (outward)
        d+=Lp(tailE.Tf);                                       // Se: Tr → Tf, parallel to B→A1
        d+=Lp(tailE.Fi);                                       // Tf → Fi (back to cut edge)
        d+=Lp(tailE.A1);                                       // Fi → A1 (same pt for straight edge)
        d+=Arc(tailE.R_arc,1-tailE.sweep_natural,tailE.A2);   // reversed arc A1→A2
      }else{
        d+=Lp(inner[inner.length-1]);  // straight close at non-failing end
      }

      // Fold-edge side: reversed inner path (end → start), ending at A2 for failing start
      for(let i=inner.length-2;i>=0;i--)d+=Lp(inner[i]);

      if(startFail){
        d+=Arc(tailS.R_arc,tailS.sweep_natural,tailS.A1);  // arc A2→A1
        d+=Lp(tailS.Fi);                                    // A1→Fi (same pt for straight edge)
        d+=Lp(tailS.Tf);                                    // Fi→Tf (past cut edge)
        // Z closes Se: Tf→Tr
      }
      d+=' Z';

      svg+=`<g class="cp-piping-piece" data-piece="${pieceId}"><path d="${d}" fill="${C_PIPING}" fill-opacity="0.20" stroke="${C_PIPING}" stroke-width="${stripStroke}" stroke-opacity="0.70" stroke-linejoin="round" stroke-linecap="round"/></g>`;

      // Cord path: terminate at C, but keep every segment on the cord centerline.
      // C is on the B→A2/perpendicular construction line and also on the cord path.
      const cordPts=[...cord];
      if(startFail&&tailS&&cordPts.length>0)cordPts[0]=tailS.C;
      if(endFail&&tailE&&cordPts.length>0)cordPts[cordPts.length-1]=tailE.C;
      drawCordPath(cordPts,pieceId);

      // Ease-away notch triangle at B. Shift the drawn triangle slightly back into
      // the normal strip so B is the outside/base edge of the simulated notch cut,
      // not the center of the marker.
      if(startFail)drawPipingEaseAwayNotch(tailS.B,model.cutSides[startSide],tailS.tangentAway);
      if(endFail)drawPipingEaseAwayNotch(tailE.B,model.cutSides[endSide],tailE.tangentAway);

    }

    if(active.closed&&pipOpts.allCornersPass){
      // All corners pass: draw one unbroken, fully closed strip and cord.
      const innerPts=map(joinAllSides(innerSides,true));
      svg+=`<path d="${cpPtsToPath(map(model.cutPts),true)} ${cpPtsToPath(innerPts,true)}" fill="${C_PIPING}" fill-opacity="0.20" fill-rule="evenodd" stroke="${C_PIPING}" stroke-width="${stripStroke}" stroke-opacity="0.70"/>`;
      const cpFull=map(joinAllSides(cordSides,true));
      svg+=`<path d="${cpPtsToPath(cpFull,true)}" fill="none" stroke="${C_CORD}" stroke-width="${cordW}" opacity="0.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      const mx=X(midX),by=Y(bb.maxY);
      svg+=`<line x1="${(mx-8).toFixed(1)}" y1="${by.toFixed(1)}" x2="${(mx+8).toFixed(1)}" y2="${by.toFixed(1)}" stroke="${C_PIPING}" stroke-width="2.5" stroke-linecap="round"/>`;
      svg+=`<line x1="${mx.toFixed(1)}" y1="${(by-5).toFixed(1)}" x2="${mx.toFixed(1)}" y2="${(by+5).toFixed(1)}" stroke="${C_PIPING}" stroke-width="2.5" stroke-linecap="round"/>`;
    }else{
      // Any failing corner breaks the physical piping into independent runs.
      const baseOrder=active.closed?SIDE_ORDER_CLOSED:SIDE_ORDER_OPEN;
      let ordered=[...baseOrder];
      if(active.closed){
        const breakIdx=baseOrder.findIndex(s=>cornerFails(JOINT_AFTER[s]));
        if(breakIdx>=0)ordered=[...baseOrder.slice(breakIdx+1),...baseOrder.slice(0,breakIdx+1)];
      }
      let run=[];
      for(let i=0;i<ordered.length;i++){
        const side=ordered[i];
        run.push(side);
        const exitFail=cornerFails(JOINT_AFTER[side]);
        const isLast=i===ordered.length-1;
        if(exitFail||isLast){
          const first=run[0],last=run[run.length-1];
          const startFail=cornerFails(JOINT_BEFORE[first]);
          const endFail=cornerFails(JOINT_AFTER[last]);
          drawStripRun([...run],startFail,endFail);
          run=[];
        }
      }
    }
    // Piping clipping/easing marks from the dropdown curvature rules.
    drawPipingCornerClipMarks();
    drawPipingSideCurveClipMarks();
  }

  return svg;
}


function cpSvgPts(pts){
  return (pts||[]).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
function cpMiniSvgStyle(svgW,svgH){
  return `width:${svgW.toFixed(1)}px;height:${svgH.toFixed(1)}px;display:block;margin:0 auto;overflow:visible`;
}
function cpMiniShell(svg){
  return `<div class="cp-mini" style="flex:1;min-width:0;display:flex;align-items:flex-start;justify-content:center;margin:0">${svg}</div>`;
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
    s+=`<polygon points="${cpSvgPts(gPts)}" fill="none" stroke="${CAT_BAG_STRUCTURES.color}" stroke-width="${GHOST_WEIGHT}" stroke-opacity="${GHOST_OPACITY}"/>`;
  }
  s+=`<polygon points="${cpSvgPts(cutPts)}" fill="${CAT_BAG_STRUCTURES.fillTint}" fill-opacity="${FILL_OPACITY_SCREEN}" stroke="none"/>`;

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

  s+=`<line x1="${midX.toFixed(1)}" y1="${yTop.toFixed(1)}" x2="${midX.toFixed(1)}" y2="${yBottom.toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="${DASH_CENTER}"/>`;
  s+=`<line x1="${leftMidX.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${rightMidX.toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="${DASH_CENTER}"/>`;
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
    return `${cpFmt(pc.cutLength)} L × ${cpFmt(pc.cutWidthTop)}–${cpFmt(pc.cutWidthBottom)} W`;
  }
  return `${cpFmt(pc.cutLength)} L × ${cpFmt(pc.cutWidth)} W`;
}

/* Sides minis + tables */
function cpSidesHTML(m,p){
  const pieces=[...(m.displaySidePieces||[])].sort((a,b)=>cpPiecePreviewOrder(a)-cpPiecePreviewOrder(b));
  if(!pieces.length)return {minis:"",tables:""};
  const maxW=Math.max(...pieces.map(x=>x.cutWidthTop!==undefined?Math.max(x.cutWidthTop,x.cutWidthBottom):x.cutWidth));
  const maxL=Math.max(...pieces.map(x=>x.cutLength));
  // Shared preview scale keeps all piece drawings readable without letting one SVG grow huge.
  const fitScale=Math.min(300/Math.max(maxL,1e-9),120/Math.max(maxW,1e-9));
  const stabInset=(p.stabilizerOn&&p.stabilizerInset>0)?p.stabilizerInset:0;
  const cards=[];
  let tables="";
  for(const pc of pieces){
    const isTaper=pc.cutWidthTop!==undefined&&Math.abs(pc.cutWidthTop-pc.cutWidthBottom)>1e-9;
    const svg=isTaper
      ?cpMiniTrapezoid(pc,{ghost:pc.quantity===2,sa:p.sa,stabInset,fitScale,flushStart:pc.flushStart,flushEnd:pc.flushEnd})
      :cpMiniStrip(pc.cutLength,pc.cutWidth,pc.label,"",{ghost:pc.quantity===2,sa:p.sa,plan:pc.plan,flushStart:pc.flushStart,flushEnd:pc.flushEnd,runLen:pc.runLength,topLabel:pc.flushStart||pc.flushEnd,fitScale,stabInset});
    cards.push({title:cpPiecePreviewTitle(pc),dims:cpPiecePreviewDims(pc),svg,cut2:pc.quantity===2});
    if(isTaper){
      const widthRow=cpProw("Width — cut",`${cpFmt(pc.cutWidthTop)} top / ${cpFmt(pc.cutWidthBottom)} btm`,`${cpFmt(pc.finishedWidthTop)} / ${cpFmt(pc.finishedWidthBottom)}`);
      tables+=cpPieceBlock(pc.label,[cpProw("Length — cut",cpFmt(pc.cutLength),cpFmt(pc.runLength)),widthRow],"Tapered: top and bottom widths differ.");
    } else {
      const note=pc.flushStart||pc.flushEnd?"Raw-top end is flush; the opposite end includes the joining seam allowance.":(pc.quantity===2?"Verified mirrored pair; one template can be used for both sides.":"");
      tables+=cpPieceBlock(pc.label,[cpProw("Length — cut",cpFmt(pc.cutLength),cpFmt(pc.runLength)),cpProw("Width — cut",cpFmt(pc.cutWidth),cpFmt(pc.finishedWidth))],note);
    }
  }
  const cols=`repeat(${cards.length}, minmax(112px, 1fr))`;
  const heads=cards.map(c=>`<div class="cp-pieceHead" style="min-width:0;text-align:center"><div style="font-weight:900;color:${CP.ink};line-height:1.05">${c.title}${c.cut2?` <span class="cp-row-badge cut2" style="vertical-align:middle">Cut 2</span>`:""}</div><div style="font-size:12px;font-weight:800;color:${CP.muted};line-height:1.2;margin-top:3px">${c.dims}</div></div>`).join("");
  const svgs=cards.map(c=>`<div class="cp-pieceSvg" style="min-width:0;display:flex;align-items:flex-start;justify-content:center">${c.svg}</div>`).join("");
  const minis=`<div class="cp-pieceGrid" style="display:grid;grid-template-columns:${cols};column-gap:14px;row-gap:8px;align-items:start;width:100%;max-width:100%;overflow-x:auto;padding:4px 2px 0">${heads}${svgs}</div>`;
  return {minis,tables};
}

function cpGussetMapHTML(pc, stabInset){
  if(!pc)return "";
  const VW=760,PADX=28,PADY=34,MAX_DRAW_H=210;
  const scale=Math.min((VW-2*PADX)/Math.max(pc.cutLength,1e-9),MAX_DRAW_H/Math.max(pc.cutWidth,1e-9));
  const drawL=pc.cutLength*scale,drawW=pc.cutWidth*scale,x0=(VW-drawL)/2,y0=PADY,H=drawW+PADY+56;
  const saPx=(pc.cutWidth-pc.finishedWidth)/2*scale;
  const sewStart=pc.open?x0:x0+pc.startAllowance*scale;
  const sewEnd=pc.open?x0+drawL:sewStart+pc.runLength*scale;
  const midX=x0+drawL/2,midY=y0+drawW/2;
  let s=`<svg class="cp-zoneMap" viewBox="0 0 ${VW} ${H.toFixed(1)}" xmlns="http://www.w3.org/2000/svg">`;
  s+=`<rect x="${x0.toFixed(1)}" y="${y0}" width="${drawL.toFixed(1)}" height="${drawW.toFixed(1)}" rx="4" fill="${CAT_BAG_STRUCTURES.fillTint}" fill-opacity="${FILL_OPACITY_SCREEN}" stroke="none"/>`;
  s+=`<line x1="${midX.toFixed(1)}" y1="${y0}" x2="${midX.toFixed(1)}" y2="${(y0+drawW).toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="${DASH_CENTER}"/><line x1="${x0.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${(x0+drawL).toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="${DASH_CENTER}"/>`;
  if(saPx>0&&drawW>2*saPx){
    const yTop=y0+saPx,yBot=y0+drawW-saPx;
    let d=`M ${sewStart.toFixed(1)} ${yTop.toFixed(1)} H ${sewEnd.toFixed(1)} M ${sewStart.toFixed(1)} ${yBot.toFixed(1)} H ${sewEnd.toFixed(1)}`;
    if(!pc.open) d+=` M ${sewStart.toFixed(1)} ${yTop.toFixed(1)} V ${yBot.toFixed(1)} M ${sewEnd.toFixed(1)} ${yTop.toFixed(1)} V ${yBot.toFixed(1)}`;
    s+=`<path d="${d}" fill="none" stroke="${C_SEW}" stroke-width="${W_SEW}" stroke-dasharray="${DASH_SEW}"/>`;
  }
  if(stabInset>0){
    const stPx=stabInset*scale;
    const stabX=x0+stPx,stabY=y0+stPx,stabW=drawL-2*stPx,stabH=drawW-2*stPx;
    if(stabW>0&&stabH>0){
      s+=stabSVGElement('rect',`x="${stabX.toFixed(1)}" y="${stabY.toFixed(1)}" width="${stabW.toFixed(1)}" height="${stabH.toFixed(1)}"`);
    }
  }
  const tb=TRIANGLE_BASE,th=TRIANGLE_HEIGHT;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${y0} ${(midX+tb/2).toFixed(1)},${y0} ${midX.toFixed(1)},${(y0+th).toFixed(1)}" fill="${C_MIDPOINT}"/><polygon points="${(midX-tb/2).toFixed(1)},${(y0+drawW).toFixed(1)} ${(midX+tb/2).toFixed(1)},${(y0+drawW).toFixed(1)} ${midX.toFixed(1)},${(y0+drawW-th).toFixed(1)}" fill="${C_MIDPOINT}"/><polygon points="${x0.toFixed(1)},${(midY-tb/2).toFixed(1)} ${x0.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(x0+th).toFixed(1)},${midY.toFixed(1)}" fill="${C_MIDPOINT}"/><polygon points="${(x0+drawL).toFixed(1)},${(midY-tb/2).toFixed(1)} ${(x0+drawL).toFixed(1)},${(midY+tb/2).toFixed(1)} ${(x0+drawL-th).toFixed(1)},${midY.toFixed(1)}" fill="${C_MIDPOINT}"/>`;
  s+=`<rect x="${x0.toFixed(1)}" y="${y0}" width="${drawL.toFixed(1)}" height="${drawW.toFixed(1)}" rx="4" fill="none" stroke="${CAT_BAG_STRUCTURES.color}" stroke-width="${W_CUT}"/>`;
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

/* ── Piping rules engine (Phase 1 — calculation only, no diagram changes) ─── */

// Minimum corner blend radius (inches) required for piping — change here only.
const MIN_PIPING_RADIUS = 1;
// Needle stay-away clearance added to each side of the cord channel.
const CORD_STAY_AWAY = 1/64;

/* Discrete curvature at a corner junction: same circumradius technique as
   notchPlan() in curved-panel-core.js.  Examines a window of cut-path points
   centered on the side-tag transition sideA → sideB. */
function cpCornerMinRadius(cutPts, sideA, sideB){
  if(!cutPts||cutPts.length<3)return Infinity;
  const n=cutPts.length;
  let jIdx=-1;
  for(let i=0;i<n;i++){
    if(cutPts[i].side===sideA&&cutPts[(i+1)%n].side===sideB){jIdx=i;break;}
  }
  if(jIdx<0)return Infinity;
  const W=40; // covers the full corner blend (CORNER_SAMPLES=64, split 32+32 each side)
  let minR=Infinity;
  for(let k=-W;k<=W-2;k++){
    const a=cutPts[(jIdx+k+n)%n],b=cutPts[(jIdx+k+1+n)%n],c=cutPts[(jIdx+k+2+n)%n];
    const ab=cpDist(a,b),bc=cpDist(b,c),ca=cpDist(c,a);
    const area2=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x));
    if(area2>1e-12){const R=(ab*bc*ca)/(2*area2);if(R<minR)minR=R;}
  }
  return minR;
}

/* Notch spacing for piping strip at a curved corner.
   Returns spacing in inches, or null (no notches / piping not allowed). */
function cpPipingNotchSpacing(radius){
  if(radius<MIN_PIPING_RADIUS)return null; // piping disallowed below minimum bend radius
  if(radius<=1)return 3/8;
  if(radius>=2.5)return 1;
  // Smooth transition from 3/8″ at 1″ radius to 1″ at 2.5″ radius.
  // Rounded to the nearest 1/8″ so the diagram and labels stay sewist-friendly.
  const raw=3/8 + ((radius-1)/(2.5-1))*(1-3/8);
  return Math.max(3/8,Math.min(1,Math.round(raw*8)/8));
}

/* Strip width — thickness-aware geometric model.
   W = 2×SA + π×(D + T) + 2×C
   D = cord diameter, T = wrap material thickness, C = cord stay-away clearance.
   π×(D+T) is the circumference of the wrap material's own centerline as it bends
   around the cord. Returns { raw (exact), recommended (rounded up to nearest 1/8") }.
   NOTE: formula is geometrically derived and untested on physical builds with thick
   materials — test-wrap with foam-backed vinyl or similar before relying on it. */
function cpPipingStripWidth(cordDia, vinylThick, sa){
  const raw = 2*sa + Math.PI*(cordDia + vinylThick) + 2*CORD_STAY_AWAY;
  const recommended = Math.ceil(raw * 8) / 8;
  return {raw, recommended};
}

/* Installed folded-strip visual width for the panel diagram.
   The dropdown's cut-strip width is the flat piece before it wraps around the
   cord.  Once installed, the diagram should show the folded band from the
   panel cut edge to the folded/inner edge, not the full flat strip width.

   Effective installed width = half the cut strip minus the arc-length that is
   consumed wrapping around the cord instead of lying flat on the panel.

   The wrap loss uses the same material-centerline diameter as the strip-width
   formula: cord diameter + estimated wrap material thickness. */
function cpPipingInstalledFoldWidth(cutStripWidth, cordDia, vinylThick, sa){
  const wrapDia = Math.max(0, cordDia + vinylThick);
  const halfWrapArc = Math.PI * wrapDia / 2;
  const projectedWrapSpan = wrapDia;
  const wrapLoss = Math.max(0, halfWrapArc - projectedWrapSpan);
  const minToContainCord = sa + CORD_STAY_AWAY + cordDia + vinylThick;
  return Math.max(minToContainCord, cutStripWidth/2 - wrapLoss);
}

/* Per-corner piping eligibility.  topMode "3side" marks top corners as n/a. */
function cpPipingCornerRules(cutPts,softTs,softBs,topMode){
  const corners=[
    {name:"Top-right",   sideA:"top",   sideB:"right",  soft:softTs,openTop:topMode==="3side"},
    {name:"Bottom-right",sideA:"right", sideB:"bottom", soft:softBs,openTop:false},
    {name:"Bottom-left", sideA:"bottom",sideB:"left",   soft:softBs,openTop:false},
    {name:"Top-left",    sideA:"left",  sideB:"top",    soft:softTs,openTop:topMode==="3side"},
  ];
  return corners.map(c=>{
    if(c.openTop)return{...c,crisp:false,allowed:false,minRadius:null,notchSpacing:null};
    if(c.soft<1e-9)return{...c,crisp:true,allowed:false,minRadius:null,notchSpacing:null};
    const minR=cpCornerMinRadius(cutPts,c.sideA,c.sideB);
    const allowed=minR>=MIN_PIPING_RADIUS;
    const spacing=allowed?cpPipingNotchSpacing(minR):null;
    return{...c,crisp:false,allowed,minRadius:minR,notchSpacing:spacing};
  });
}

/* Piping strip assembly — merges consecutive sides across any corner that passes.
   A passing corner means piping runs continuously through it (no break, no SA at that joint).
   A failing corner (or the open-top end) is a break point: the current run closes and a new
   one starts. Each resulting strip represents one physical cut piece.

   Corner index → position in panel:
     [0]=Top-right  [1]=Bottom-right  [2]=Bottom-left  [3]=Top-left
   Corner BEFORE each side:  top→3, right→0, bottom→1, left→2
   Corner AFTER  each side:  top→0, right→1, bottom→2, left→3            */
function cpPipingStraightStrips(activeRuns,cordRuns,sa,cordDia,vinylThick,easeOff,cornerResults){
  const JOINT_BEFORE={top:3,right:0,bottom:1,left:2};
  const JOINT_AFTER ={top:0,right:1,bottom:2,left:3};
  const ALL_SIDES   =['top','right','bottom','left'];
  const fails=c=>!!(c&&!c.allowed);

  const activeSides=ALL_SIDES.filter(s=>(activeRuns?.[s]||0)>1e-9);
  if(!activeSides.length)return[];

  const n=activeSides.length;
  const isCircular=n===4; // 4-side mode; open-top mode has n<4 (linear)

  /* For circular traversal, rotate the sequence so it starts with the side
     immediately after a known failing joint, guaranteeing the last side in
     the sequence always ends at that same break point. */
  let orderedSides=activeSides;
  if(isCircular){
    const breakIdx=activeSides.findIndex(s=>fails(cornerResults?.[JOINT_AFTER[s]]));
    if(breakIdx<0)return[]; // all pass — caller should have used closedLoop instead
    orderedSides=[...activeSides.slice(breakIdx+1),...activeSides.slice(0,breakIdx+1)];
  }

  const strips=[];
  const stripWidth=cpPipingStripWidth(cordDia,vinylThick,sa).recommended;
  const exitTailBack=(stripWidth/2)/Math.sin(55*Math.PI/180); // B is this far behind Fi along the cut edge
  let runSides=[],totalLen=0,totalCordLen=0;

  for(let i=0;i<orderedSides.length;i++){
    const side=orderedSides[i];
    runSides.push(side);
    totalLen+=activeRuns[side];
    totalCordLen+=(cordRuns?.[side]??activeRuns[side]);

    const isLast=i===orderedSides.length-1;
    const exitFails=fails(cornerResults?.[JOINT_AFTER[side]]);

    if(isLast||exitFails){
      const firstSide=runSides[0],lastSide=runSides[runSides.length-1];
      const startTrim=fails(cornerResults?.[JOINT_BEFORE[firstSide]])?1.5*sa+easeOff+exitTailBack:0;
      const endTrim  =exitFails?1.5*sa+easeOff+exitTailBack:0;
      const effective=Math.max(0,totalLen-startTrim-endTrim);
      const cordEffective=Math.max(0,totalCordLen-startTrim-endTrim);
      if(effective>1e-9){
        // Human-readable label: "Right + Bottom + Left" for a 3-side merge
        const label=runSides.map(s=>s[0].toUpperCase()+s.slice(1)).join(' + ');
        strips.push({
          sides:[...runSides],side:label,
          sewRun:totalLen,leftEase:startTrim,rightEase:endTrim,
          effectiveRun:effective,
          cutLength:effective+2*sa,
          cutWidth:stripWidth,
          cordLength:cordEffective,
        });
      }
      runSides=[];totalLen=0;totalCordLen=0;
    }
  }
  return strips;
}

/* Display formatter for small fractions (vinyl/cord thickness).
   Shows in mm in metric mode since 1/32" = 0.8 mm is clearer than 0.08 cm.
   Imperial: lookup table for common 64th-fraction values, fallback to N/64". */
const _FM64={[0]:"0",[1/64]:"1/64",[1/32]:"1/32",[3/64]:"3/64",
  [1/16]:"1/16",[3/32]:"3/32",[1/8]:"1/8",[3/16]:"3/16",[1/4]:"1/4"};
function cpFmtVinyl(v){
  if(isMetric()){const mm=Math.round(v*25.4*10)/10;return `${mm} mm`;}
  if(!v||v<=0)return `0"`;
  for(const[n,s]of Object.entries(_FM64)){if(Math.abs(v-Number(n))<5e-4)return `${s}"`;}
  const r=Math.round(v*64),whole=Math.floor(r/64),rem=r%64;
  if(whole===0)return `${rem}/64"`;
  if(rem===0)return `${whole}"`;
  return `${whole}-${rem}/64"`;
}

/* Closed-loop piping — activated when all four corners pass the radius check.
   Two calculation methods: geometric (sewline-based) and snug-fit (empirical).
   Snug-fit percentages derived from Piping.jsx anchor calibration data. */
const CLOSED_LOOP_STRIP_PCT = 0.950;
const CLOSED_LOOP_CORD_PCT  = 0.915;
function cpPipingClosedLoop(cutPerim, sewPerim, sa, cordDia, vinylThick){
  const geoStripLen  = sewPerim + 2*sa;
  const geoCordLen   = Math.max(0, sewPerim - 2*Math.PI*(cordDia/2 + vinylThick));
  const snugStripLen = cutPerim * CLOSED_LOOP_STRIP_PCT;
  const snugCordLen  = cutPerim * CLOSED_LOOP_CORD_PCT;
  return {geoStripLen, geoCordLen, snugStripLen, snugCordLen};
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

const CORD_PRESETS=[["3/32\"",3/32],["1/8\"",1/8],["5/32\"",5/32],["1/4\"",1/4]];

// index must stay stable — vinylPreset state stores the string index
const VINYL_THICKNESS_PRESETS=[
  {v:1/64, label:"Plain quilting cotton",         group:'1/64"'},
  {v:1/64, label:"Lightweight lining fabric",     group:'1/64"'},
  {v:1/32, label:"Standard vinyl / faux leather", group:'1/32"'},
  {v:1/32, label:"Cork, standard backing",        group:'1/32"'},
  {v:1/16, label:"Marine vinyl, standard",        group:'1/16"'},
  {v:1/16, label:"Heavy canvas / duck / denim",   group:'1/16"'},
  {v:1/8,  label:"Foam-backed vinyl",             group:'1/8"'},
  {v:1/8,  label:"Thick neoprene",                group:'1/8"'},
];

/* Cord diameter input: preset dropdown (3/32–1/4") with Custom… fallback to N/D entry.
   Metric mode: single mm field. decMode: single decimal-inch field. */
function CordDiameterInput({whole,onWhole,num,onNum,den,onDen,ghost,decMode}){
  const [customMode,setCustomMode]=useState(false);
  const inches=whole+(den>0?num/den:0);
  const metricMm=Math.round(inches*25.4*10)/10;
  function setFromInches(v){
    const in_=Math.max(0,parseFloat(v)||0);
    const w=Math.floor(in_); onWhole(w);
    onNum(Math.max(0,Math.round((in_-w)*32))); onDen(32);
  }
  const matchIdx=CORD_PRESETS.findIndex(([,v])=>Math.abs(v-inches)<0.0001);
  const isCustom=customMode||matchIdx<0;

  if(isMetric()){
    return(
      <div className={"cp-field"+(ghost?" ghost":"")}>
        <label>Cord diameter</label>
        <div className="cp-fi">
          <input type="number" className="dec" min="0" step="0.1" value={metricMm}
            onChange={e=>setFromInches((parseFloat(e.target.value)||0)/25.4)}
            onFocus={e=>e.target.select()}/>
          <span className="inch">mm</span>
        </div>
      </div>
    );
  }
  if(decMode){
    return(
      <div className={"cp-field"+(ghost?" ghost":"")}>
        <label>Cord diameter</label>
        <div className="cp-fi">
          <input type="number" className="dec" min="0" step="0.0625" value={inches}
            onChange={e=>setFromInches(e.target.value)} onFocus={e=>e.target.select()}/>
          <span className="inch">{"″"}</span>
        </div>
      </div>
    );
  }
  return(
    <div className={"cp-field"+(ghost?" ghost":"")}>
      <label>Cord diameter</label>
      <div className="cp-fi">
        <select value={isCustom?"custom":String(CORD_PRESETS[matchIdx][1])}
          onChange={e=>{
            if(e.target.value==="custom"){setCustomMode(true);}
            else{setCustomMode(false);setFromInches(parseFloat(e.target.value));}
          }}>
          {CORD_PRESETS.map(([lbl,v])=><option key={v} value={String(v)}>{lbl}</option>)}
          <option value="custom">Custom…</option>
        </select>
        <span className="inch">{"″"}</span>
      </div>
      {isCustom&&(
        <div className="cp-fi" style={{marginTop:4}}>
          <input type="number" min="0" step="1" value={whole}
            onChange={e=>onWhole(Math.max(0,parseInt(e.target.value)||0))}
            onFocus={e=>e.target.select()} style={{width:52}}/>
          <input type="number" min="0" step="1" value={num}
            onChange={e=>onNum(Math.max(0,parseInt(e.target.value)||0))}
            onFocus={e=>e.target.select()} style={{width:52}}/>
          <span className="inch">/</span>
          <input type="number" min="1" max="32" step="1" value={den}
            onChange={e=>onDen(Math.max(1,Math.min(32,parseInt(e.target.value)||1)))}
            onFocus={e=>e.target.select()} style={{width:52}}/>
          <span className="inch">{"″"}</span>
        </div>
      )}
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
export default function CurvedPanelPage({unitMode="imperial",setUnitMode=()=>{},isActive=true}){
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
  // Piping
  const [pipingOn,setPipingOn]=useState(false);
  const [pipingCordW,setPipingCordW]=useState(0);
  const [pipingCordN,setPipingCordN]=useState(3),[pipingCordD,setPipingCordD]=useState(32);
  const [pipingEaseW,setPipingEaseW]=useState(0),[pipingEaseF,setPipingEaseF]=useState(0);
  const [vinylThickW,setVinylThickW]=useState(0),[vinylThickF,setVinylThickF]=useState(1/32);
  const [vinylPreset,setVinylPreset]=useState("2"); // "2" = Standard vinyl / faux leather (1/32")
  const [vinylInfoOpen,setVinylInfoOpen]=useState(false);
  // Close vinyl info popover on click outside
  useEffect(()=>{
    if(!vinylInfoOpen)return;
    function close(){setVinylInfoOpen(false);}
    document.addEventListener("mousedown",close);
    return()=>document.removeEventListener("mousedown",close);
  },[vinylInfoOpen]);
  // UI state
  const [stageOpen,setStageOpen]=useState([true,true,true,true,false,false]);
  const [checkedRows,setCheckedRows]=useState({});
  const [showEdges,setShowEdges]=useState(false);

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
    stabilizerOn:stabOn,stabilizerInset:Math.max(0,stabW+stabF),
    sideTaper,depthTop,depthBottom,
  };

  const ready=(tWW+tWF)>0&&(bWW+bWF)>0&&(hWW+hWF)>0;
  const model=buildCurvedPanelModel(params);
  const hasDepth=sideTaper?(depthTop>0&&depthBottom>0):sideDepth>0;
  const hasGusset=pieceStyle==="gusset"&&sideDepth>0;
  const sides=cpSidesHTML(model,params),gusset=cpGussetHTML(model,params);
  const active=model.activeSew;
  // Panel shape has curves/softness → pattern required to cut accurately
  const hasPanelCurves=ready&&model.valid&&(
    model.crowns.hTop>1e-9||model.crowns.hBot>1e-9||
    model.crowns.hL>1e-9||model.crowns.hR>1e-9||
    model.softness.ts>1e-9||model.softness.bs>1e-9
  );

  const panelPlan=ready&&model.valid?cpTilePlan(model.cutBB.w+.8,model.cutBB.h+.8):null;
  const sideSpan=cpSidePrintSpan(model),sidePlan=sideSpan?cpTilePlan(sideSpan.w,sideSpan.h):null;
  const gusSpan=cpGussetPrintSpan(model),gusPlan=gusSpan?cpTilePlan(gusSpan.w,gusSpan.h):null;
  const stabPts=cpStabilizerPoints(model,params),stabBB=cpPtsBB(stabPts);
  const stabPlan=stabBB?cpTilePlan(stabBB.w+.8,stabBB.h+.8):null;

  const taperAngle=sideTaper&&model.valid&&model.activeSew.runs.left
    ?Math.atan(Math.abs(depthBottom-depthTop)/model.activeSew.runs.left)*(180/Math.PI):0;

  // Piping computed values
  const pipingCord=pipingCordW+(pipingCordD>0?pipingCordN/pipingCordD:0);
  const vinylThick=vinylThickW+vinylThickF;
  const pipingEaseOff=(pipingEaseW+pipingEaseF)>1e-9?(pipingEaseW+pipingEaseF):0;
  const pipingStripWidth=pipingOn&&pipingCord>1e-9?cpPipingStripWidth(pipingCord,vinylThick,sa):null;
  const pipingCorners=ready&&model.valid&&pipingOn
    ?cpPipingCornerRules(model.cutPts,model.softness.ts,model.softness.bs,topMode)
    :null;
  const pipingAllCornersPass=!!(pipingCorners&&pipingCorners.every(c=>c.allowed)&&topMode==="4side");
  const pipingCordRuns=ready&&model.valid&&pipingOn&&pipingCord>1e-9
    ?Object.fromEntries(Object.entries(offsetSidePaths(model.sewSides,pipingCord/2+CORD_STAY_AWAY)).map(([side,path])=>[side,cpPathLen(path)]))
    :null;
  const pipingStraightStrips=ready&&model.valid&&pipingOn&&pipingCord>1e-9&&!pipingAllCornersPass
    ?cpPipingStraightStrips(model.activeSew.runs,pipingCordRuns,sa,pipingCord,vinylThick,pipingEaseOff,pipingCorners)
    :[];
  const pipingClosedLoop=pipingAllCornersPass&&pipingCord>1e-9
    ?cpPipingClosedLoop(model.cutPerim,model.activeSew.total,sa,pipingCord,vinylThick)
    :null;

  const pipOpts=pipingOn&&pipingCord>1e-9&&ready&&model.valid&&pipingCorners
    ?{on:true,cord:pipingCord,vinyl:vinylThick,stripWidth:pipingStripWidth?.recommended,corners:pipingCorners,allCornersPass:pipingAllCornersPass,easeOff:pipingEaseOff}
    :null;

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
  const s6sum=pipingOn&&pipingCord>1e-9&&pipingStripWidth?`${cpFmt(pipingCord)} cord · ${cpFmt(pipingStripWidth.recommended)} strip`:"Off";

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

  const cuttingListPortalTarget = document.getElementById('cp-cutting-list-root');

  return(
    <>
    <div>

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
                    dangerouslySetInnerHTML={{__html:cpPanelDiagramSVG(model,params,pipOpts)}}/>
                :<div className="cp-diag-placeholder">
                  {ready?"Fix geometry to see the diagram.":"Enter top width, bottom width, and height to begin."}
                </div>
              }
              {/* Geometry status overlay — pinned to bottom of diagram box */}
              {ready&&model.valid&&model.errors.length===0&&model.notes.length===0&&(
                <div className="cp-diag-status cp-diag-status--ok">✓ Geometry verified</div>
              )}
              {ready&&(!model.valid||model.errors.length>0||model.notes.length>0)&&(
                <div className="cp-diag-status cp-diag-status--warn">
                  <span>{(!model.valid||model.errors.length>0)?"⚠ Pattern output locked":"⚠ Values adjusted"}</span>
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
                <div className="cp-diag-legend" style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"4px 10px"}}>
                  {/* center match triangle */}
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                    <svg width={TRIANGLE_BASE+2} height={TRIANGLE_HEIGHT+2} viewBox={`0 0 ${TRIANGLE_BASE+2} ${TRIANGLE_HEIGHT+2}`} style={{display:"block"}}>
                      <polygon points={`1,${TRIANGLE_HEIGHT+1} ${TRIANGLE_BASE+1},${TRIANGLE_HEIGHT+1} ${(TRIANGLE_BASE/2+1).toFixed(1)},1`} fill={C_MIDPOINT}/>
                    </svg>
                    center mark
                  </span>
                  <span style={{color:"var(--sp-muted)"}}>·</span>
                  {/* midpoint circle */}
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                    <svg width={MIDPOINT_R*2+4} height={MIDPOINT_R*2+4} viewBox={`0 0 ${MIDPOINT_R*2+4} ${MIDPOINT_R*2+4}`} style={{display:"block"}}>
                      <circle cx={MIDPOINT_R+2} cy={MIDPOINT_R+2} r={MIDPOINT_R} fill="#fff" stroke={C_MIDPOINT} strokeWidth={W_MIDPOINT}/>
                    </svg>
                    midpoint
                  </span>
                  <span style={{color:"var(--sp-muted)"}}>·</span>
                  {/* junction square */}
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                    <svg width="9" height="9" viewBox="0 0 9 9" style={{display:"block"}}>
                      <rect x="1" y="1" width="7" height="7" fill="#fff" stroke={CAT_BAG_STRUCTURES.color} strokeWidth="1.5" rx="1"/>
                    </svg>
                    junction
                  </span>
                  <span style={{color:"var(--sp-muted)"}}>·</span>
                  {/* cut line */}
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                    <svg width="20" height="4" viewBox="0 0 20 4" style={{display:"block"}}>
                      <line x1="0" y1="2" x2="20" y2="2" stroke={CAT_BAG_STRUCTURES.color} strokeWidth={W_CUT} strokeLinecap="round"/>
                    </svg>
                    cut
                  </span>
                  <span style={{color:"var(--sp-muted)"}}>·</span>
                  {/* sewline */}
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                    <svg width="20" height="4" viewBox="0 0 20 4" style={{display:"block"}}>
                      <line x1="0" y1="2" x2="20" y2="2" stroke={C_SEW} strokeWidth={W_SEW} strokeDasharray={DASH_SEW} strokeLinecap="round"/>
                    </svg>
                    sewline
                  </span>
                  {stabOn&&(<>
                    <span style={{color:"var(--sp-muted)"}}>·</span>
                    {/* stabilizer */}
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                      <svg width="20" height="4" viewBox="0 0 20 4" style={{display:"block"}}>
                        <line x1="0" y1="2" x2="20" y2="2" stroke={C_STAB} strokeWidth={W_STAB} strokeDasharray={DASH_STAB} strokeLinecap="round"/>
                      </svg>
                      stabilizer
                    </span>
                  </>)}
                  {pipOpts&&(<>
                    <span style={{color:"var(--sp-muted)"}}>·</span>
                    {/* piping band */}
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                      <svg width="20" height="10" viewBox="0 0 20 10" style={{display:"block"}}>
                        <rect x="0" y="0" width="20" height="10" fill={C_PIPING} fillOpacity="0.16"/>
                        <line x1="0" y1="5" x2="20" y2="5" stroke={C_CORD} strokeWidth={W_PIPING} strokeLinecap="round" strokeOpacity="0.5"/>
                      </svg>
                      piping
                    </span>
                  </>)}
                </div>
              </div>
            )}

            {/* Perimeter stats — cut + sewline totals, expandable per-side */}
            {ready&&model.valid&&(
              <div className="cp-perim">
                <div className="cp-perim-row">
                  <span className="cp-perim-label">Cut Perimeter</span>
                  <span className="cp-perim-val">{cpFmtPerim(model.cutPerim)}</span>
                  <button className="cp-perim-expand" onClick={()=>setShowEdges(s=>!s)} aria-label={showEdges?"Hide edge lengths":"Show edge lengths"}>
                    {showEdges?"▲":"▼"}
                  </button>
                </div>
                <div className="cp-perim-row cp-perim-row--last">
                  <span className="cp-perim-label">Sewline Perimeter{topMode==="3side"?" (open)":""}</span>
                  <span className="cp-perim-val">{cpFmtPerim(active.total)}</span>
                  <span/>
                </div>
                {showEdges&&(
                  <div className="cp-perim-edges">
                    <div className="cp-perim-edge-hdr">
                      <div/>
                      <div>Cut</div>
                      <div>Sewline</div>
                    </div>
                    {['top','right','bottom','left'].map(side=>{
                      const cutRun=model.cutRuns?.[side]??0;
                      const sewRun=active.runs?.[side];
                      return(
                        <div className="cp-perim-edge-row" key={side}>
                          <div className="cp-perim-edge-side">{side.charAt(0).toUpperCase()+side.slice(1)}</div>
                          <div className="cp-perim-edge-val">{cpFmtPerim(cutRun)}</div>
                          <div className="cp-perim-edge-val">{sewRun!=null?cpFmtPerim(sewRun):"—"}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                {ready&&model.valid&&hasDepth&&(
                  <div className="cp-diag-legend" style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"4px 10px",marginTop:6}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                      <svg width={TRIANGLE_BASE+2} height={TRIANGLE_HEIGHT+2} viewBox={`0 0 ${TRIANGLE_BASE+2} ${TRIANGLE_HEIGHT+2}`} style={{display:"block"}}>
                        <polygon points={`1,${TRIANGLE_HEIGHT+1} ${TRIANGLE_BASE+1},${TRIANGLE_HEIGHT+1} ${(TRIANGLE_BASE/2+1).toFixed(1)},1`} fill={C_MIDPOINT}/>
                      </svg>
                      center mark
                    </span>
                    <span style={{color:"var(--sp-muted)"}}>·</span>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                      <svg width="20" height="4" viewBox="0 0 20 4" style={{display:"block"}}>
                        <line x1="0" y1="2" x2="20" y2="2" stroke={CAT_BAG_STRUCTURES.color} strokeWidth={W_CUT} strokeLinecap="round"/>
                      </svg>
                      cut
                    </span>
                    <span style={{color:"var(--sp-muted)"}}>·</span>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                      <svg width="20" height="4" viewBox="0 0 20 4" style={{display:"block"}}>
                        <line x1="0" y1="2" x2="20" y2="2" stroke={C_SEW} strokeWidth={W_SEW} strokeDasharray={DASH_SEW} strokeLinecap="round"/>
                      </svg>
                      sewline
                    </span>
                    <span style={{color:"var(--sp-muted)"}}>·</span>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                      <svg width="6" height="14" viewBox="0 0 6 14" style={{display:"block"}}>
                        <line x1="3" y1="0" x2="3" y2="10" stroke={C_EASING} strokeWidth={W_EASING_CLIP} strokeLinecap="round"/>
                      </svg>
                      easing clip
                    </span>
                    {stabOn&&(<>
                      <span style={{color:"var(--sp-muted)"}}>·</span>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                        <svg width="20" height="4" viewBox="0 0 20 4" style={{display:"block"}}>
                          <line x1="0" y1="2" x2="20" y2="2" stroke={C_STAB} strokeWidth={W_STAB} strokeDasharray={DASH_STAB} strokeLinecap="round"/>
                        </svg>
                        stabilizer
                      </span>
                    </>)}
                  </div>
                )}
              </>
            ):(
              <>
                {ready&&model.valid&&hasGusset
                  ?<div className="cp-left-gusset-wrap" dangerouslySetInnerHTML={{__html:gusset.minis}}/>
                  :<div className="cp-diag-placeholder">
                    {ready&&model.valid?"Enter a depth in Stage 4 to preview the gusset strip.":"Complete panel dimensions first."}
                  </div>
                }
                <div className="cp-diag-legend" style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"4px 10px",marginTop:6}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                    <svg width={TRIANGLE_BASE+2} height={TRIANGLE_HEIGHT+2} viewBox={`0 0 ${TRIANGLE_BASE+2} ${TRIANGLE_HEIGHT+2}`} style={{display:"block"}}>
                      <polygon points={`1,${TRIANGLE_HEIGHT+1} ${TRIANGLE_BASE+1},${TRIANGLE_HEIGHT+1} ${(TRIANGLE_BASE/2+1).toFixed(1)},1`} fill={C_MIDPOINT}/>
                    </svg>
                    center mark
                  </span>
                  <span style={{color:"var(--sp-muted)"}}>·</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                    <svg width="20" height="4" viewBox="0 0 20 4" style={{display:"block"}}>
                      <line x1="0" y1="2" x2="20" y2="2" stroke={CAT_BAG_STRUCTURES.color} strokeWidth={W_CUT} strokeLinecap="round"/>
                    </svg>
                    cut
                  </span>
                  <span style={{color:"var(--sp-muted)"}}>·</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                    <svg width="20" height="4" viewBox="0 0 20 4" style={{display:"block"}}>
                      <line x1="0" y1="2" x2="20" y2="2" stroke={C_SEW} strokeWidth={W_SEW} strokeDasharray={DASH_SEW} strokeLinecap="round"/>
                    </svg>
                    sewline
                  </span>
                  <span style={{color:"var(--sp-muted)"}}>·</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,fontStyle:"italic"}}>
                    END SA — end seam allowances
                  </span>
                  {stabOn&&(<>
                    <span style={{color:"var(--sp-muted)"}}>·</span>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                      <svg width="20" height="4" viewBox="0 0 20 4" style={{display:"block"}}>
                        <line x1="0" y1="2" x2="20" y2="2" stroke={C_STAB} strokeWidth={W_STAB} strokeDasharray={DASH_STAB} strokeLinecap="round"/>
                      </svg>
                      stabilizer
                    </span>
                  </>)}
                </div>
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
                      <p className="cp-stage-hint">Curve easing amount.</p>
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
                  </div>
                </div>
              )}
            </div>

            {/* Stage 5: Stabilizer (optional) */}
            <div className="cp-stage">
              <StageHeader num={5} title="Stabilizer" summary={stabOn?`Inset ${cpFmt(params.stabilizerInset)}`:"Off"} open={stageOpen[4]} onToggle={()=>toggleStage(4)} optional={!stabOn}/>
              {stageOpen[4]&&(
                <div className="cp-stage-body">
                  <label className="cp-check" style={{marginBottom:10}}>
                    <input type="checkbox" checked={stabOn} onChange={e=>setStabOn(e.target.checked)}/>
                    Stabilizer / interfacing
                  </label>
                  <div style={{opacity:stabOn?1:0.35,pointerEvents:stabOn?"auto":"none"}}>
                    <FracInput variant="cp" label="Inset" decMode={decMode} ghost={!stabOn} whole={stabW} frac={stabF} onWhole={setStabW} onFrac={setStabF}/>
                  </div>
                </div>
              )}
            </div>

            {/* Stage 6: Piping (optional) */}
            <div className="cp-stage">
              <StageHeader num={6} title="Piping" summary={s6sum} open={stageOpen[5]} onToggle={()=>toggleStage(5)} optional={!pipingOn}/>
              {stageOpen[5]&&(
                <div className="cp-stage-body">
                  <label className="cp-check" style={{marginBottom:10}}>
                    <input type="checkbox" checked={pipingOn} onChange={e=>setPipingOn(e.target.checked)}/>
                    Add piping
                  </label>
                  <div style={{opacity:pipingOn?1:0.35,pointerEvents:pipingOn?"auto":"none"}}>

                    {/* Cord diameter + strip width result */}
                    <CordDiameterInput whole={pipingCordW} onWhole={setPipingCordW}
                      num={pipingCordN} onNum={setPipingCordN}
                      den={pipingCordD} onDen={setPipingCordD}
                      ghost={!pipingOn} decMode={decMode}/>
                    {pipingStripWidth&&(
                      <div style={{margin:"6px 0 10px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span className="cp-stage-input-label">Cord diameter</span>
                          <span style={{fontWeight:900,fontSize:15,color:CP.ink,fontFamily:"DM Mono,monospace"}}>{cpFmt(pipingCord)}</span>
                          <span style={{color:CP.muted}}>·</span>
                          <span className="cp-stage-input-label">Recommended cut strip width</span>
                          <span style={{fontWeight:900,fontSize:15,color:CP.ink,fontFamily:"DM Mono,monospace"}}>{cpFmt(pipingStripWidth.recommended)}</span>
                        </div>
                        <div style={{fontSize:11.5,color:CP.muted,marginTop:2,fontFamily:"Nunito,sans-serif"}}>
                          {isMetric()
                            ?`Calculated minimum strip width: ${(pipingStripWidth.raw*25.4).toFixed(1)} mm`
                            :`Calculated minimum strip width: ${pipingStripWidth.raw.toFixed(3)}"`}
                        </div>
                      </div>
                    )}

                    {/* Wrap material thickness + popover info */}
                    <div style={{position:"relative"}}>
                      <div className={"cp-field"+((!pipingOn)?" ghost":"")}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                          <label style={{marginBottom:0}}>Wrap material thickness</label>
                          <button
                            onMouseDown={e=>e.stopPropagation()}
                            onClick={()=>setVinylInfoOpen(v=>!v)}
                            title="Material wrap thickness guide"
                            aria-label="Material wrap thickness guide"
                            style={{
                              width:20,height:20,borderRadius:"50%",flexShrink:0,
                              background:vinylInfoOpen?CP.maroon:"#ece5f8",
                              color:vinylInfoOpen?"#fff":CP.maroon,
                              border:`1px solid ${CP.maroon}`,
                              fontSize:11,cursor:"pointer",display:"flex",
                              alignItems:"center",justifyContent:"center",fontWeight:900,
                            }}
                          >ⓘ</button>
                        </div>
                        {isMetric()?(
                          <div className="cp-fi">
                            <input type="number" className="dec" min="0" step="0.1"
                              value={Math.round((vinylThickW+vinylThickF)*25.4*10)/10}
                              onChange={e=>{
                                const in_=Math.max(0,parseFloat(e.target.value)||0)/25.4;
                                setVinylThickW(Math.floor(in_));
                                setVinylThickF(Math.max(0,in_-Math.floor(in_)));
                                setVinylPreset("custom");
                              }}
                              onFocus={e=>e.target.select()}/>
                            <span className="inch">mm</span>
                          </div>
                        ):(
                          <>
                            <div className="cp-fi">
                              <select value={vinylPreset}
                                onChange={e=>{
                                  const v=e.target.value;
                                  setVinylPreset(v);
                                  if(v!=="custom"){
                                    setVinylThickW(0);
                                    setVinylThickF(VINYL_THICKNESS_PRESETS[parseInt(v)].v);
                                  }
                                }}>
                                <optgroup label='1/64"'>
                                  <option value="0">Plain quilting cotton</option>
                                  <option value="1">Lightweight lining fabric</option>
                                </optgroup>
                                <optgroup label='1/32"'>
                                  <option value="2">Standard vinyl / faux leather</option>
                                  <option value="3">Cork, standard backing</option>
                                </optgroup>
                                <optgroup label='1/16"'>
                                  <option value="4">Marine vinyl, standard</option>
                                  <option value="5">Heavy canvas / duck / denim</option>
                                </optgroup>
                                <optgroup label='1/8"'>
                                  <option value="6">Foam-backed vinyl</option>
                                  <option value="7">Thick neoprene</option>
                                </optgroup>
                                <option value="custom">Custom — enter my own</option>
                              </select>
                            </div>
                            {vinylPreset==="custom"&&(decMode?(
                              <div className="cp-fi" style={{marginTop:4}}>
                                <input type="number" className="dec" min="0" step="0.015625"
                                  value={vinylThickW+vinylThickF}
                                  onChange={e=>{
                                    const v=Math.max(0,parseFloat(e.target.value)||0);
                                    setVinylThickW(Math.floor(v));
                                    setVinylThickF(Math.max(0,v-Math.floor(v)));
                                  }}
                                  onFocus={e=>e.target.select()}/>
                                <span className="inch">″</span>
                              </div>
                            ):(
                              <div className="cp-fi" style={{marginTop:4}}>
                                <input type="number" min="0" step="1" value={vinylThickW}
                                  onChange={e=>setVinylThickW(Math.max(0,parseInt(e.target.value)||0))}
                                  onFocus={e=>e.target.select()} style={{width:52}}/>
                                <select
                                  value={String(Math.max(0,VINYL_FRACS.findIndex(([,v])=>Math.abs(v-vinylThickF)<0.0001)))}
                                  onChange={e=>setVinylThickF(VINYL_FRACS[parseInt(e.target.value)][1])}>
                                  {VINYL_FRACS.map(([lbl],i)=><option key={i} value={String(i)}>{lbl}</option>)}
                                </select>
                                <span className="inch">″</span>
                              </div>
                            ))}
                          </>
                        )}
                        <p className="cp-stage-hint" style={{marginTop:5,marginBottom:0}}>These presets estimate the effective bulk added by the folded wrap material. Fabric backing, coating, interfacing, compression, and cord firmness can change the result. Test-wrap before cutting your final strip.</p>
                      </div>
                      {vinylInfoOpen&&(
                        <div
                          onMouseDown={e=>e.stopPropagation()}
                          style={{
                            position:"absolute",top:"calc(100% + 4px)",right:0,zIndex:200,
                            width:320,maxHeight:420,overflowY:"auto",
                            background:CP.pinkBg,border:`1px solid ${CP.pinkLine}`,borderRadius:8,
                            padding:"12px 14px",boxShadow:"0 4px 16px rgba(90,45,160,0.14)",
                            fontSize:12.5,fontFamily:"Nunito,sans-serif",
                          }}
                        >
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                            <div style={{fontWeight:700,color:CP.ink,lineHeight:1.4}}>These are starting points — always test-wrap your cord before cutting the full length.</div>
                            <button onClick={()=>setVinylInfoOpen(false)}
                              style={{marginLeft:8,background:"none",border:"none",cursor:"pointer",color:CP.muted,fontSize:14,lineHeight:1,padding:"0 2px",flexShrink:0}}
                              aria-label="Close">✕</button>
                          </div>
                          {[
                            {heading:'Very thin / minimal bulk — 1/64"',items:["Lightweight lining fabric","Plain quilting cotton, not interfaced","Lightweight ripstop, about 1.1 oz","Thin nylon, poly, or technical woven"]},
                            {heading:'Thin / common bag-making bulk — 1/32"',items:["Standard vinyl / faux leather (default)","Standard ripstop, about 1.9–2.2 oz","Quilting cotton, interfaced or laminated","Soft garment leather, lightweight","Cork fabric, thin or standard backing","Light waterproof canvas, waxed canvas, duck, denim, or twill","500D Cordura, packcloth, or coated nylon","Laminated cotton or PUL-style fabric"]},
                            {heading:'Medium / bulky bag-making material — 1/16"',items:["Slightly thicker garment leather","Cork fabric, heavier backing","Heavy waterproof canvas, waxed canvas, duck, denim, or twill","1000D Cordura, packcloth, or coated nylon","Upholstery vinyl or marine vinyl, standard","Thin neoprene or scuba fabric","Lighter veg-tan or tooling leather"]},
                            {heading:'Heavy / padded / low-compression material — 1/8"',items:["Foam-backed or padded upholstery/marine vinyl","Thick neoprene","Heavier veg-tan or tooling leather","Very bulky or stiff wrap material"]},
                          ].map((sec,i)=>(
                            <div key={i} style={{marginTop:i===0?2:8,borderTop:i===0?"none":`1px solid ${CP.pinkLine}`,paddingTop:i===0?0:8}}>
                              <div style={{fontWeight:900,color:CP.maroon,fontSize:11,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3}}>{sec.heading}</div>
                              <ul style={{margin:0,paddingLeft:14,color:CP.ink,lineHeight:1.5,fontSize:12}}>
                                {sec.items.map((item,j)=><li key={j}>{item}</li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* End ease-off — only shown in per-side mode (not closed-loop) */}
                    {!pipingAllCornersPass&&(
                      <div style={{marginTop:8}}>
                        <FracInput variant="cp" label="End ease-off" decMode={decMode} ghost={!pipingOn}
                          whole={pipingEaseW} frac={pipingEaseF} onWhole={setPipingEaseW} onFrac={setPipingEaseF}/>
                        <p className="cp-stage-hint">Additional pullback past the 1.5× SA base exit. Default: 0 (total exit = 1.5× SA + ease-off)</p>
                      </div>
                    )}

                    {/* Corner eligibility */}
                    {pipingCorners&&(
                      <div style={{marginTop:12}}>
                        <div style={{fontWeight:800,fontSize:12,color:CP.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:7}}>Curve Notching for Snug Fit</div>
                        {pipingCorners.map((c,i)=>(
                          <div key={i} style={{fontSize:13,fontFamily:"Nunito,sans-serif",marginBottom:5,lineHeight:1.35}}>
                            <span style={{fontWeight:800,color:CP.ink,display:"inline-block",minWidth:98}}>{c.name}</span>
                            {c.openTop
                              ?<span style={{color:CP.muted}}>open top — n/a</span>
                              :c.crisp
                              ?<><span style={{color:"#a03020"}}>✕ </span><span style={{color:CP.muted}}>sharp corner — cannot ease</span></>
                              :c.allowed
                              ?<>
                                <span style={{color:CP.green}}>✓ </span>
                                <span style={{color:CP.muted}}>{cpFmt(c.minRadius)} radius</span>
                                {c.notchSpacing
                                  ?<span style={{color:CP.muted}}> · notch every {cpFmt(c.notchSpacing)}</span>
                                  :<span style={{color:CP.muted}}> · no notches</span>
                                }
                              </>
                              :<>
                                <span style={{color:"#a03020"}}>✕ </span>
                                <span style={{color:CP.muted}}>{cpFmt(c.minRadius)} radius &lt; {cpFmt(MIN_PIPING_RADIUS)} min</span>
                              </>
                            }
                          </div>
                        ))}
                        <p className="cp-stage-hint" style={{marginTop:6}}>Curved piping areas are automatically notched. Straight edges do not need notches.</p>
                      </div>
                    )}

                    {/* Results: closed-loop OR per-side strips */}
                    {pipingClosedLoop&&(
                      <div style={{marginTop:12}}>
                        <div style={{fontWeight:800,fontSize:12,color:CP.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:7}}>Closed-loop — all corners pass</div>
                        <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr",gap:"4px 10px",fontSize:13,alignItems:"baseline"}}>
                          <div/>
                          <div style={{color:CP.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Geometric</div>
                          <div style={{color:CP.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Snug-fit</div>
                          <div style={{color:CP.ink,fontWeight:700,fontFamily:"Nunito,sans-serif"}}>Strip</div>
                          <div style={{color:CP.ink,fontWeight:900,fontFamily:"DM Mono,monospace"}}>{cpFmt(pipingClosedLoop.geoStripLen)}</div>
                          <div style={{color:CP.ink,fontWeight:900,fontFamily:"DM Mono,monospace"}}>{cpFmt(pipingClosedLoop.snugStripLen)}</div>
                          <div style={{color:CP.ink,fontWeight:700,fontFamily:"Nunito,sans-serif"}}>Cord</div>
                          <div style={{color:CP.ink,fontWeight:900,fontFamily:"DM Mono,monospace"}}>{cpFmt(pipingClosedLoop.geoCordLen)}</div>
                          <div style={{color:CP.ink,fontWeight:900,fontFamily:"DM Mono,monospace"}}>{cpFmt(pipingClosedLoop.snugCordLen)}</div>
                        </div>
                        <p className="cp-stage-hint" style={{marginTop:6}}>Geometric values are from sewline perimeter + seam allowances. Snug-fit is empirically calibrated for real-world ease — start there and ease while sewing.</p>
                      </div>
                    )}
                    {!pipingClosedLoop&&pipingStraightStrips.length>0&&(
                      <div style={{marginTop:12}}>
                        <div style={{fontWeight:800,fontSize:12,color:CP.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:7}}>Cut sizes</div>
                        <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr",gap:"4px 10px",fontSize:13,alignItems:"baseline"}}>
                          <div/>
                          <div style={{color:CP.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Strip</div>
                          <div style={{color:CP.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Cord</div>
                          {pipingStraightStrips.map((s,i)=>(
                            <React.Fragment key={i}>
                              <div style={{fontWeight:800,color:CP.ink,fontFamily:"Nunito,sans-serif"}}>{s.side}</div>
                              <div style={{color:CP.muted,fontFamily:"DM Mono,monospace",fontWeight:800}}>{cpFmt(s.cutLength)} × {cpFmt(s.cutWidth)}</div>
                              <div style={{color:CP.muted,fontFamily:"DM Mono,monospace",fontWeight:800}}>{cpFmt(s.cordLength)}</div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}

                    {pipingOn&&!ready&&(
                      <p className="cp-stage-hint" style={{marginTop:8}}>Enter panel dimensions to see corner analysis and strip sizes.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>{/* end right col */}

      </div>{/* end body */}

    </div>{/* end calculator shell */}

    {/* Cutting list + print bar: portaled below ms-page-card as a sibling card */}
    {isActive && cuttingListPortalTarget && createPortal(
      <div className="cp-cutting-card">
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
          {/* ── EXTERIOR PIECES ── */}
          <div className="cp-group-header">Main panels</div>

          <div className={`cp-cutting-row ${checkedRows.panel?"checked":""}`}>
            <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows.panel} onChange={()=>toggleRow("panel")}/></div>
            <div className="cp-row-name">
              Front &amp; back{hasPanelCurves&&<span className="cp-row-badge use-pattern">Use pattern</span>}
              {ready&&model.valid&&<div className="cp-row-sewsub">{`sewline: ${cpFmtHyphen(active.bb.w)} × ${cpFmtHyphen(active.bb.h)}`}</div>}
            </div>
            <div className="cp-row-cut">{ready&&model.valid?cpFmtHyphen(model.cutBB.w):"—"}</div>
            <div className="cp-row-cut">{ready&&model.valid?cpFmtHyphen(model.cutBB.h):"—"}</div>
            <div className="cp-row-qty"><span className="cp-row-badge cut2">Cut 2</span></div>
          </div>

          <div className="cp-group-header">Side &amp; bottom strips</div>

          {pieceStyle==="sides"?(
            ready&&model.valid&&hasDepth&&(model.displaySidePieces||[]).map((pc,i)=>{
              const rk=pc.label.toLowerCase().replace(/[\s&]+/g,"-");
              const isMirror=pc.label.toLowerCase().includes("right")&&pc.quantity===1;
              const taper=pc.cutWidthTop!==undefined&&Math.abs(pc.cutWidthTop-pc.cutWidthBottom)>1e-9;
              return(
                <div key={i} className={`cp-cutting-row ${checkedRows[rk]?"checked":""}`}>
                  <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows[rk]} onChange={()=>toggleRow(rk)}/></div>
                  <div className="cp-row-name">
                    {cpPiecePreviewTitle(pc)}{taper&&<span className="cp-row-badge use-pattern">Use pattern</span>}
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
            })
          ):(
            ready&&model.valid&&hasGusset&&model.gussetPiece&&(
              <div key="gusset" className={`cp-cutting-row ${checkedRows.gusset?"checked":""}`}>
                <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows.gusset} onChange={()=>toggleRow("gusset")}/></div>
                <div className="cp-row-name">
                  Gusset
                  <div className="cp-row-sewsub">sewline: {cpFmtHyphen(model.gussetPiece.runLength)} × {cpFmtHyphen(model.gussetPiece.finishedWidth)}</div>
                </div>
                <div className="cp-row-cut">{cpFmtHyphen(model.gussetPiece.cutLength)}</div>
                <div className="cp-row-cut">{cpFmtHyphen(model.gussetPiece.cutWidth)}</div>
                <div className="cp-row-qty"><span className="cp-row-badge cut1">Cut 1</span></div>
              </div>
            )
          )}

          {/* ── STABILIZER SECTION — grouped below all exterior pieces ── */}
          {stabOn&&ready&&model.valid&&(
            <>
              <div className="cp-group-header stab-header">Stabilizer</div>

              {/* Panel stabilizer */}
              <div className={`cp-cutting-row stab-row ${checkedRows.stab?"checked":""}`}>
                <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows.stab} onChange={()=>toggleRow("stab")}/></div>
                <div className="cp-row-name">Front &amp; back stabilizer{hasPanelCurves&&<span className="cp-row-badge use-pattern">Use pattern</span>}</div>
                <div className="cp-row-cut">{stabBB?cpFmtHyphen(stabBB.w):"—"}</div>
                <div className="cp-row-cut">{stabBB?cpFmtHyphen(stabBB.h):"—"}</div>
                <div className="cp-row-qty"><span className="cp-row-badge cut2">Cut 2</span></div>
              </div>

              {/* Side stabilizer rows */}
              {pieceStyle==="sides"&&hasDepth&&(model.displaySidePieces||[]).map((pc,i)=>{
                const rk=pc.label.toLowerCase().replace(/[\s&]+/g,"-");
                const srk="stab-"+rk;
                const isMirror=pc.label.toLowerCase().includes("right")&&pc.quantity===1;
                const taper=pc.cutWidthTop!==undefined&&Math.abs(pc.cutWidthTop-pc.cutWidthBottom)>1e-9;
                const stabCutW=taper
                  ?`${cpFmtHyphen(Math.max(0,pc.cutWidthTop-2*params.stabilizerInset))}–${cpFmtHyphen(Math.max(0,pc.cutWidthBottom-2*params.stabilizerInset))}`
                  :cpFmtHyphen(Math.max(0,pc.cutWidth-2*params.stabilizerInset));
                return(
                  <div key={"s"+i} className={`cp-cutting-row stab-row ${checkedRows[srk]?"checked":""}`}>
                    <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows[srk]} onChange={()=>toggleRow(srk)}/></div>
                    <div className="cp-row-name">{cpPiecePreviewTitle(pc)} stabilizer{taper&&<span className="cp-row-badge use-pattern">Use pattern</span>}</div>
                    <div className="cp-row-cut">{cpFmtHyphen(pc.cutLength)}</div>
                    <div className="cp-row-cut">{stabCutW}</div>
                    <div className="cp-row-qty">
                      {isMirror?<span className="cp-row-badge mirror">Mirror</span>
                      :pc.quantity===2?<span className="cp-row-badge cut2">Cut 2</span>
                      :<span className="cp-row-badge cut1">Cut 1</span>}
                    </div>
                  </div>
                );
              })}

              {/* Gusset stabilizer */}
              {pieceStyle==="gusset"&&hasGusset&&model.gussetPiece&&(
                <div key="stab-gusset" className={`cp-cutting-row stab-row ${checkedRows["stab-gusset"]?"checked":""}`}>
                  <div className="cp-row-cb"><input type="checkbox" checked={!!checkedRows["stab-gusset"]} onChange={()=>toggleRow("stab-gusset")}/></div>
                  <div className="cp-row-name">Gusset stabilizer</div>
                  <div className="cp-row-cut">{cpFmtHyphen(model.gussetPiece.cutLength)}</div>
                  <div className="cp-row-cut">{cpFmtHyphen(Math.max(0,model.gussetPiece.cutWidth-2*params.stabilizerInset))}</div>
                  <div className="cp-row-qty"><span className="cp-row-badge cut1">Cut 1</span></div>
                </div>
              )}
            </>
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

      </div>,
      cuttingListPortalTarget
    )}
    </>
  );
}
