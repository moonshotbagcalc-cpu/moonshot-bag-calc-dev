// pathGeometry.js
// General 2D polyline + vector geometry toolkit (pure, inches-space, no SVG/React).
// Extracted from CurvedPanel.jsx so cut-list math and the diagram can share ONE
// implementation. Everything here is a pure function over its arguments — no scale,
// no DOM, no module state. Safe to reuse for any component that walks paths or
// eases material along an edge.

// ── Vector ops ──────────────────────────────────────────────────────────────
export const add  = (a,b)=>({x:a.x+b.x,y:a.y+b.y});
export const sub  = (a,b)=>({x:a.x-b.x,y:a.y-b.y});
export const mul  = (a,k)=>({x:a.x*k,y:a.y*k});
export const dot  = (a,b)=>a.x*b.x+a.y*b.y;
export const perp = v=>({x:-v.y,y:v.x});
export const len  = v=>Math.hypot(v.x,v.y);
export const unitV= v=>{const l=len(v)||1e-9;return{x:v.x/l,y:v.y/l};};

// ── Distance + path cleanup ─────────────────────────────────────────────────
export function cpDist(a,b){return Math.hypot((b?.x||0)-(a?.x||0),(b?.y||0)-(a?.y||0));}

export function cpDedupePath(pts,closed=false){
  const out=[];
  for(const p of pts||[]){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    if(!out.length||cpDist(out[out.length-1],p)>1e-7)out.push({...p});
  }
  if(closed&&out.length>2&&cpDist(out[0],out[out.length-1])<1e-7)out.pop();
  return out;
}

// ── Polyline length + slicing ───────────────────────────────────────────────
export function pathLen(path){let l=0;for(let i=1;i<path.length;i++)l+=cpDist(path[i-1],path[i]);return l;}

export function pathSegModel(path,dS=0,dE=null){
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
    if(a.dist<dS&&b.dist>dS){const t=(dS-a.dist)/seg;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,side:a.side,corner:a.corner});}
    if(a.dist>=dS&&a.dist<=dE)out.push({x:a.x,y:a.y,side:a.side,corner:a.corner});
    if(a.dist<dE&&b.dist>dE){const t=(dE-a.dist)/seg;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,side:b.side,corner:b.corner});}
  }
  const last=ann[ann.length-1];
  if(last.dist>=dS&&last.dist<=dE)out.push({x:last.x,y:last.y,side:last.side,corner:last.corner});
  return cpDedupePath(out,false);
}

export function concatSegs(segments){
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

export function runPath(sidePaths,sides,startTrim,endTrim){
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

export function tangentAt(pts,atStart){
  if(!pts||pts.length<2)return {x:1,y:0};
  const a=atStart?pts[0]:pts[pts.length-2];
  const b=atStart?pts[1]:pts[pts.length-1];
  return unitV(sub(b,a));
}

// ── Ray / line vs polyline ──────────────────────────────────────────────────
export function linePathIntersectInfo(origin,dir,path,maxT=null){
  // Returns a point guaranteed to lie on the supplied polyline plus its distance
  // along that polyline. Used for the cord end C so the cord keeps following its
  // own centerline instead of bending toward the folded-edge A1/A2 geometry.
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

export function closestPathPointToLineInfo(origin,dir,path){
  // Fallback only: choose the point on the cord path nearest the B→A1 construction
  // line. Keeps C on the cord path, unlike an older fallback that placed C near A2.
  if(!path||path.length<2)return null;
  const u=unitV(dir);
  const n=perp(u);
  let best=null,bestD=Infinity,walk=0;
  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1];
    const ab=sub(b,a),L=len(ab);
    if(L<1e-9){continue;}
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
