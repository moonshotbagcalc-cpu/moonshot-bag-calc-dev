// src/pipingCore.js — pure piping math; no React, no formatting imports.

/*
 * ─────────────────────────────────────────────────────────────────────────
 * PIPING LENGTH MODEL — why the strip = sewline, and the cord is its own length
 * (A note to future us, in Abby's own words, for when we forget this again.)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * "The strip length MUST be calculated exactly at the sewline because we can't
 *  ease past that to make it fit. The material compresses around the corners
 *  with the cord inside, so the actual length of the strip MUST work with the
 *  sewline."
 *
 * The principle: you can take up slack, but you can't add length you don't have.
 *   - The strip can't be shorter than the sewline (it wouldn't reach), and it
 *     rides at the seam so it isn't longer. Therefore:  STRIP = sewline + 2*SA
 *     (the 2*SA is the two join allowances to close the strip into a loop.)
 *   - Bag-makers take up the slack by NOTCHING/CLIPPING the strip's raw edge
 *     BEFORE sewing (not easing while sewing, as garment-makers do). Tight
 *     curves need heavy notching to seat snugly.
 *
 * "The cord is its own length because it DOES live inside the sewline and
 *  cannot be eased."
 *   - Therefore:  CORD = sewline inset by ~one cord radius (it sits just inside
 *     the seam). The wrap/vinyl thickness moves the FOLD, not the cord center,
 *     so it is NOT part of the cord offset.
 *
 * SELF-CHECK INVARIANT: a sewn closed loop = strip - 2*SA = the sewline
 * perimeter, always. If a displayed "loop when sewn" value ever differs from the
 * sewline, the strip math has drifted — surface it, don't ship it.
 *
 * DO NOT derive strip or cord cut-length from the inner fold-crease POSITION.
 * That inner path is ~1" shorter and exists for DRAWING the diagram only.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const MIN_PIPING_RADIUS    = 1;
export const CORD_STAY_AWAY       = 1/64;
export const CLOSED_LOOP_STRIP_PCT = 0.950;
export const CLOSED_LOOP_CORD_PCT  = 0.915;
export const EXIT_ANGLE_DEG        = 55;

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
    const ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y),ca=Math.hypot(a.x-c.x,a.y-c.y);
    const area2=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x));
    if(area2>1e-12){const R=(ab*bc*ca)/(2*area2);if(R<minR)minR=R;}
  }
  return minR;
}

/* Notch spacing for piping strip at a curved corner.
   Returns spacing in inches, or null (no notches / piping not allowed). */
export function cpPipingNotchSpacing(radius){
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
   around the cord. Returns { raw (exact), recommended (rounded to nearest 1/8") }.
   NOTE: formula is geometrically derived and untested on physical builds with thick
   materials — test-wrap with foam-backed vinyl or similar before relying on it. */
export function cpPipingStripWidth(cordDia, vinylThick, sa){
  const raw = 2*sa + Math.PI*(cordDia + vinylThick) + 2*CORD_STAY_AWAY;
  const recommended = Math.round(raw * 8) / 8;
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
export function cpPipingInstalledFoldWidth(cutStripWidth, cordDia, vinylThick, sa){
  const wrapDia = Math.max(0, cordDia + vinylThick);
  const halfWrapArc = Math.PI * wrapDia / 2;
  const projectedWrapSpan = wrapDia;
  const wrapLoss = Math.max(0, halfWrapArc - projectedWrapSpan);
  const minToContainCord = sa + CORD_STAY_AWAY + cordDia + vinylThick;
  return Math.max(minToContainCord, cutStripWidth/2 - wrapLoss);
}

/* Per-corner piping eligibility.  topMode "3side" marks top corners as n/a. */
export function cpPipingCornerRules(cutPts,softTs,softBs,topMode){
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
export function cpPipingStraightStrips(activeRuns,cordRuns,sa,cordDia,vinylThick,easeOff,cornerResults){
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
  const exitTailBack=(stripWidth/2)/Math.sin(EXIT_ANGLE_DEG*Math.PI/180);
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

/* Closed-loop piping — activated when all four corners pass the radius check.
   Two calculation methods: geometric (sewline-based) and snug-fit (empirical).
   Snug-fit percentages derived from Piping.jsx anchor calibration data. */
export function cpPipingClosedLoop(cutPerim, sewPerim, sa, cordDia, vinylThick){
  const geoStripLen  = sewPerim + 2*sa;
  // Cord centerline rides one cord-radius inside the sewline. vinylThick is
  // deliberately excluded here: wrap thickness moves the FOLD, not the cord center.
  const geoCordLen   = Math.max(0, sewPerim - 2*Math.PI*(cordDia/2));
  const snugStripLen = cutPerim * CLOSED_LOOP_STRIP_PCT;
  const snugCordLen  = cutPerim * CLOSED_LOOP_CORD_PCT;
  return {geoStripLen, geoCordLen, snugStripLen, snugCordLen};
}
