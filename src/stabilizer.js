/* =====================================================================
   stabilizer.js — stabilizer geometry and shared SVG draw helper
   Extracted from src/tabs/CurvedPanel.jsx (Pass 11).

   Generic helpers (cpDist, cpUnit, etc.) that are also used by diagram
   rendering code in CurvedPanel.jsx stay there per project rules;
   stabilizer.js carries private copies of the ones it needs.
   ===================================================================== */
import { offsetSidePaths, joinAllSides } from './geometryOffset.js';
import { C_STAB, W_STAB, DASH_STAB } from './diagramTokens.js';

/* ── Private helpers (local copies — do not export) ─────────────────── */
function _dist(a,b){ return Math.hypot((b?.x||0)-(a?.x||0),(b?.y||0)-(a?.y||0)); }
function _unit(x,y){ const l=Math.hypot(x,y)||1e-9; return {x:x/l,y:y/l}; }
function _crossZ(d,p,o){ return d.x*(p.y-o.y)-d.y*(p.x-o.x); }
function _lineDirIntersect(p1,d1,p2,d2){
  const den=d1.x*d2.y-d1.y*d2.x;
  if(Math.abs(den)<1e-9)return null;
  const t=((p2.x-p1.x)*d2.y-(p2.y-p1.y)*d2.x)/den;
  return {x:p1.x+d1.x*t,y:p1.y+d1.y*t};
}
function _lineIntersect(a1,a2,b1,b2){
  const x1=a1.x,y1=a1.y,x2=a2.x,y2=a2.y,x3=b1.x,y3=b1.y,x4=b2.x,y4=b2.y;
  const den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
  if(Math.abs(den)<1e-9)return null;
  const px=((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4))/den;
  const py=((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4))/den;
  if(!Number.isFinite(px)||!Number.isFinite(py))return null;
  return {x:px,y:py};
}
function _segmentsIntersect(p1,p2,p3,p4){
  const d1x=p2.x-p1.x,d1y=p2.y-p1.y,d2x=p4.x-p3.x,d2y=p4.y-p3.y;
  const cross=d1x*d2y-d1y*d2x;
  if(Math.abs(cross)<1e-10)return false;
  const t=((p3.x-p1.x)*d2y-(p3.y-p1.y)*d2x)/cross;
  const u=((p3.x-p1.x)*d1y-(p3.y-p1.y)*d1x)/cross;
  return t>1e-9&&t<1-1e-9&&u>1e-9&&u<1-1e-9;
}
function _dedupePath(pts,closed=false){
  const out=[];
  for(const p of pts||[]){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    if(!out.length||_dist(out[out.length-1],p)>1e-7)out.push({...p});
  }
  if(closed&&out.length>2&&_dist(out[0],out[out.length-1])<1e-7)out.pop();
  return out;
}
function _centroid(pts){
  if(!pts.length)return {x:0,y:0};
  let x=0,y=0;
  for(const p of pts){x+=p.x;y+=p.y;}
  return {x:x/pts.length,y:y/pts.length};
}
function _cleanClosedPts(pts){
  const out=[];
  for(const p of pts||[]){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    const last=out[out.length-1];
    if(!last||Math.hypot(last.x-p.x,last.y-p.y)>1e-3)out.push({x:p.x,y:p.y,side:p.side});
  }
  if(out.length>2&&Math.hypot(out[0].x-out[out.length-1].x,out[0].y-out[out.length-1].y)<1e-3)out.pop();
  return out;
}
function _simplifyCollinear(pts){
  const p=_cleanClosedPts(pts);
  if(p.length<4)return p;
  const out=[],n=p.length;
  for(let i=0;i<n;i++){
    const a=p[(i-1+n)%n],b=p[i],c=p[(i+1)%n];
    const abx=b.x-a.x,aby=b.y-a.y,bcx=c.x-b.x,bcy=c.y-b.y;
    const ab=Math.hypot(abx,aby),bc=Math.hypot(bcx,bcy);
    if(ab<1e-8||bc<1e-8)continue;
    const cross=Math.abs(abx*bcy-aby*bcx)/(ab*bc);
    const dot=(abx*bcx+aby*bcy)/(ab*bc);
    if(cross<1e-7&&dot>0.999999)continue;
    out.push(b);
  }
  return out.length>=3?out:p;
}
function _offsetOpenPath(pts,d){
  const p=_dedupePath(pts,false),n=p.length,out=[];
  for(let i=0;i<n;i++){
    const a=p[Math.max(0,i-1)],b=p[Math.min(n-1,i+1)];
    const u=_unit(b.x-a.x,b.y-a.y);
    out.push({x:p[i].x-u.y*d,y:p[i].y+u.x*d,side:p[i].side});
  }
  return out;
}
function _joinOffsetPair(A,B){
  if(A.length<2||B.length<2)return;
  const a0=A[A.length-1],b0=B[0];
  const ta=_unit(a0.x-A[A.length-2].x,a0.y-A[A.length-2].y);
  const tb=_unit(B[1].x-b0.x,B[1].y-b0.y);
  const den=ta.x*tb.y-ta.y*tb.x;
  if(Math.abs(den)<1e-5&&ta.x*tb.x+ta.y*tb.y>0.98){
    const M={x:(a0.x+b0.x)/2,y:(a0.y+b0.y)/2};
    A[A.length-1]={...M,side:A[A.length-1].side};
    B[0]={...M,side:B[0].side};
    return;
  }
  const X=_lineDirIntersect(a0,ta,b0,tb);
  if(!X)return;
  const refA=Math.sign(_crossZ(tb,A[Math.floor(A.length/2)],b0))||1;
  while(A.length>2&&Math.sign(_crossZ(tb,A[A.length-1],b0))!==refA)A.pop();
  const refB=Math.sign(_crossZ(ta,B[Math.floor(B.length/2)],a0))||1;
  while(B.length>2&&Math.sign(_crossZ(ta,B[0],a0))!==refB)B.shift();
  if(_dist(A[A.length-1],X)>1e-7)A.push({...X,side:A[A.length-1].side});
  else A[A.length-1]={...X,side:A[A.length-1].side};
  if(_dist(B[0],X)>1e-7)B.unshift({...X,side:B[0].side});
  else B[0]={...X,side:B[0].side};
}
function _cpOffsetSidePaths(sidePaths,inset){
  const out={};
  for(const side of ["top","right","bottom","left"])out[side]=_offsetOpenPath(sidePaths[side]||[],inset).map(q=>({...q,side}));
  _joinOffsetPair(out.top,out.right);
  _joinOffsetPair(out.right,out.bottom);
  _joinOffsetPair(out.bottom,out.left);
  _joinOffsetPair(out.left,out.top);
  for(const side of ["top","right","bottom","left"])out[side]=_dedupePath(out[side],false).map(q=>({...q,side}));
  return out;
}
function _cpCombineSidePaths(sidePaths,closed=true){
  const out=[];
  for(const side of ["top","right","bottom","left"]){
    const path=sidePaths[side]||[];
    for(let i=0;i<path.length;i++){
      if(out.length&&i===0&&_dist(out[out.length-1],path[i])<1e-7)continue;
      out.push({...path[i],side});
    }
  }
  if(closed&&out.length>1&&_dist(out[0],out[out.length-1])<1e-7)out.pop();
  return out;
}

/* ── Exported stabilizer functions ──────────────────────────────────── */

export function cpHasSelfCross(pts,eps=0.01){
  const n=pts?.length||0;
  if(n<4)return false;
  for(let i=0;i<n;i++){
    const a=pts[i],b=pts[(i+1)%n];
    if(_dist(a,b)<eps)continue;
    for(let j=i+2;j<n;j++){
      if(i===0&&j===n-1)continue;
      const c=pts[j],d=pts[(j+1)%n];
      if(_dist(c,d)<eps)continue;
      if(!_segmentsIntersect(a,b,c,d))continue;
      const near=Math.min(_dist(a,c),_dist(a,d),_dist(b,c),_dist(b,d));
      if(near<eps*6)continue;
      return true;
    }
  }
  return false;
}

export function cpOffsetInwardMiter(pts,inset){
  const p=_dedupePath(pts,true);
  const n=p.length;
  if(n<3||!(inset>0))return null;
  const out=[];
  for(let i=0;i<n;i++){
    const prev=p[(i-1+n)%n],cur=p[i],next=p[(i+1)%n];
    if(_dist(prev,cur)<1e-8||_dist(cur,next)<1e-8)continue;
    const u1=_unit(cur.x-prev.x,cur.y-prev.y);
    const u2=_unit(next.x-cur.x,next.y-cur.y);
    const n1={x:-u1.y,y:u1.x},n2={x:-u2.y,y:u2.x};
    let m={x:n1.x+n2.x,y:n1.y+n2.y};
    const ml=Math.hypot(m.x,m.y);
    if(ml<1e-8){out.push({x:cur.x+n1.x*inset,y:cur.y+n1.y*inset,side:cur.side});continue;}
    m={x:m.x/ml,y:m.y/ml};
    const cosHalf=Math.max(0.35,m.x*n1.x+m.y*n1.y);
    const len=Math.min(inset/cosHalf,inset*4);
    out.push({x:cur.x+m.x*len,y:cur.y+m.y*len,side:cur.side});
  }
  const clean=_dedupePath(out,true);
  return clean.length>=3?clean:null;
}

export function cpInsetClosedPoints(pts,inset){
  const p=_simplifyCollinear(pts);
  if(p.length<3||!inset)return null;
  function build(ins){
    const c=_centroid(p),segs=[];
    for(let i=0;i<p.length;i++){
      const a=p[i],b=p[(i+1)%p.length];
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      if(len<0.03125)continue;
      let nx=-dy/len,ny=dx/len;
      const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      if((c.x-mx)*nx+(c.y-my)*ny<0){nx=-nx;ny=-ny;}
      segs.push({a:{x:a.x+nx*ins,y:a.y+ny*ins},b:{x:b.x+nx*ins,y:b.y+ny*ins},nx,ny,srcIdx:i});
    }
    if(segs.length<3)return null;
    const out=[];
    for(let i=0;i<segs.length;i++){
      const prev=segs[(i-1+segs.length)%segs.length],next=segs[i];
      const si=next.srcIdx;
      let q=_lineIntersect(prev.a,prev.b,next.a,next.b);
      if(!q||Math.hypot(q.x-p[si].x,q.y-p[si].y)>Math.max(2,ins*4)){
        const nx=prev.nx+next.nx,ny=prev.ny+next.ny,nl=Math.hypot(nx,ny)||1;
        q={x:p[si].x+(nx/nl)*ins,y:p[si].y+(ny/nl)*ins};
      }
      out.push(q);
    }
    return out;
  }
  const hasCross=out=>!out||cpHasSelfCross(out,0.01);
  const r=build(inset);
  if(!hasCross(r))return r;
  const r2=build(inset*0.8);
  return hasCross(r2)?null:r2;
}

export function cpPtsBB(pts){
  if(!pts?.length)return null;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of pts){
    minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);
  }
  return {minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY};
}

/* Computes the stabilizer path as a closed polygon inset from the cut edge.
   Primary approach: same side-aware miter-join offset used by the sewline —
   proven correct on mixed-corner panels. Falls back to per-vertex miter and
   intersection-based inset only when cut-side paths are unavailable. */
export function cpStabilizerPoints(m,p){
  if(!p?.stabilizerOn||!(p.stabilizerInset>0)||!m?.cutPts?.length||!m?.cutBB)return null;
  const maxInset=Math.min(p.stabilizerInset,m.cutBB.w/2-0.125,m.cutBB.h/2-0.125);
  const inset=Math.max(0,maxInset);
  if(!(inset>0))return null;

  // PRIMARY: side-aware offset — same algorithm as the sewline, no self-crossing
  if(m.cutSides?.top&&m.cutSides?.right&&m.cutSides?.bottom&&m.cutSides?.left){
    const sidePaths=offsetSidePaths(m.cutSides,inset);
    const sidePts=joinAllSides(sidePaths,true);
    if(sidePts.length>=3&&!cpHasSelfCross(sidePts,0.006))return sidePts;
  }

  // Fallback: per-vertex miter inset
  const direct=cpOffsetInwardMiter(m.cutPts,inset);
  if(direct?.length>=3&&!cpHasSelfCross(direct,0.006))return direct;

  // Last resort: intersection-based inset
  const insetPts=cpInsetClosedPoints(m.cutPts,inset);
  if(insetPts?.length&&!cpHasSelfCross(insetPts,0.006))return insetPts;
  return null;
}

/* Shared stabilizer SVG element — one function, consistent stroke across all
   diagram types. Fixes the hardcoded weights in cpMiniTrapezoid and cpGussetMapHTML.
   tagName: 'rect' | 'polygon' | 'path'
   geomAttr: the geometry attribute string (x/y/width/height, points, or d) */
export function stabSVGElement(tagName,geomAttr){
  return `<${tagName} ${geomAttr} fill="none" stroke="${C_STAB}" stroke-width="${W_STAB}" stroke-dasharray="${DASH_STAB}" stroke-linecap="round"/>`;
}
