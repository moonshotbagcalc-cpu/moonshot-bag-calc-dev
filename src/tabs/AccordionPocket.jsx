import { useState } from "react";
import { PI, DEFAULT_SA } from "../utils/constants.js";
import { roundTo8th, smartRound, fmtInch } from "../utils/formatting.js";
import { T } from "../utils/theme.js";
import { Card, CardTitle, RRow, InfoBox, SubTabs, Divider, SABar } from "../components/SharedUI.jsx";
import FracInput from "../components/FracInput.jsx";

// ── Accordion SVG diagram ─────────────────────────────────────────────────────
function AccordionSVG({ segs, cutWidth, isDouble, sa, buffer }) {
  const W=600, H=286;
  const mL=16, mR=16, mT=78, mB=70;  // mT=78 gives plenty of space above panels for cut width + dimension line
  const drawW = W - mL - mR;
  const px = drawW / cutWidth;
  const pH = H - mT - mB;
  const frontTop=mT, frontBot=mT+pH;
  const lift = pH*0.28;
  const backTop=frontTop-lift, backBot=frontBot-lift;
  const fillC   = { outer:"#7a5010", flap:"#2a5c1a", pf:"#1a5080", gap:"#6a1010" };
  const strokeC = { outer:"#c8900a", flap:"#60b830", pf:"#40b0e0", gap:"#d04040" };
  const segTotalW = segs.reduce((sum, s) => sum + s.w, 0);
  const centeredStartX = mL + Math.max(0, (drawW - segTotalW * px) / 2);
  let xs=[centeredStartX];
  segs.forEach(s=>xs.push(xs[xs.length-1]+s.w*px));
  function planeFor(i){ const l=i>0?segs[i-1].t:null; const r=i<segs.length?segs[i].t:null; return (l==="pf"||r==="pf")?"front":"back"; }
  function tY(p){return p==="front"?frontTop:backTop;}
  function bY(p){return p==="front"?frontBot:backBot;}
  const polys=segs.map((seg,i)=>{ const x1=xs[i],x2=xs[i+1]; const pL=planeFor(i),pR=planeFor(i+1); return { x1,x2,tL:tY(pL),bL:bY(pL),tR:tY(pR),bR:bY(pR), fill:fillC[seg.t],stroke:strokeC[seg.t],label:seg.label,t:seg.t,w:x2-x1,lx:(x1+x2)/2, sewOffset:seg.sewOffset }; });
  const fitLabelSize = (p) => Math.max(7.5, Math.min(13, (p.w - 8) / Math.max(2.4, p.label.length * 0.62)));
  const order=["outer","gap","flap","pf"];
  const sorted=[...polys].sort((a,b)=>order.indexOf(a.t)-order.indexOf(b.t));
  const leftRawX = xs[0];
  const rightRawX = xs[xs.length - 1];
  const saPx = Math.max(0, sa * px);
  const bufferPx = Math.max(0, buffer * px);
  // The side attachment buffer is extra fabric outside the seam allowance.
  // Raw edge → buffer guide → sewline.
  const leftBufferX = leftRawX + bufferPx;
  const rightBufferX = rightRawX - bufferPx;
  const leftSewX = leftRawX + bufferPx + saPx;
  const rightSewX = rightRawX - bufferPx - saPx;
  const guideTop = backTop;
  const guideBottom = backBot;
  const sewGuideC = "rgba(255,255,255,0.58)";
  const bufferGuideC = "rgba(200,144,10,0.82)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block",margin:"0 auto"}} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="bpArrR" markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto"><polyline points="0,0.5 5,3.5 0,6.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"/></marker>
        <marker id="bpArrL" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polyline points="7,0.5 2,3.5 7,6.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"/></marker>
        <filter id="bpSh" x="-4%" y="-4%" width="112%" height="112%"><feDropShadow dx="1" dy="1.5" stdDeviation="1.8" floodColor="rgba(0,0,0,0.55)"/></filter>
      </defs>

      {/* Cut width dimension line — top */}
      <line x1={mL+3} y1={backTop-16} x2={W-mR-3} y2={backTop-16} stroke="rgba(255,255,255,0.25)" strokeWidth="1" markerStart="url(#bpArrL)" markerEnd="url(#bpArrR)"/>
      <text x={W/2} y={backTop-22} textAnchor="middle" fontFamily="DM Mono,monospace" fontSize="11" fill="rgba(255,255,255,0.45)">cut width: {fmtInch(cutWidth)}</text>

      {/* Panels */}
      {sorted.map((p,i)=>(
        <g key={i}>
          <polygon points={`${p.x1},${p.tL} ${p.x2},${p.tR} ${p.x2},${p.bR} ${p.x1},${p.bL}`} fill={p.fill} stroke={p.stroke} strokeWidth="1.3" filter="url(#bpSh)"/>
          {p.t==="gap" && (
            <>
              <line x1={p.sewOffset != null ? p.x1 + p.sewOffset * px : p.lx} y1={p.tL+8} x2={p.sewOffset != null ? p.x1 + p.sewOffset * px : p.lx} y2={p.bL-8} stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeDasharray="4,3"/>
              {/* sew / rivet label — inside the gap panel, aligned to the actual stitch/rivet position */}
              <text x={p.sewOffset != null ? p.x1 + p.sewOffset * px : p.lx} y={(p.tL+p.bL)/2} textAnchor="middle" dominantBaseline="middle" fontFamily="Nunito,sans-serif" fontSize="11" fontWeight="700" fill="rgba(255,200,120,0.95)">sew /</text>
              <text x={p.sewOffset != null ? p.x1 + p.sewOffset * px : p.lx} y={(p.tL+p.bL)/2+14} textAnchor="middle" dominantBaseline="middle" fontFamily="Nunito,sans-serif" fontSize="11" fontWeight="700" fill="rgba(255,200,120,0.95)">rivet</text>
            </>
          )}
        </g>
      ))}

      {/* Side attachment guides — drawn on top of the outer panels */}
      {bufferPx > 1 && (
        <>
          <line x1={leftBufferX} y1={guideTop} x2={leftBufferX} y2={guideBottom} stroke={bufferGuideC} strokeWidth="1.3" strokeDasharray="4,4" opacity="0.86" />
          <line x1={rightBufferX} y1={guideTop} x2={rightBufferX} y2={guideBottom} stroke={bufferGuideC} strokeWidth="1.3" strokeDasharray="4,4" opacity="0.86" />
        </>
      )}
      {saPx > 1 && (
        <>
          <line x1={leftSewX} y1={guideTop} x2={leftSewX} y2={guideBottom} stroke={sewGuideC} strokeWidth="1.3" strokeDasharray="5,4" opacity="0.92" />
          <line x1={rightSewX} y1={guideTop} x2={rightSewX} y2={guideBottom} stroke={sewGuideC} strokeWidth="1.3" strokeDasharray="5,4" opacity="0.92" />
        </>
      )}

      {/* Panel labels */}
      {polys.map((p,i)=>( p.w>14 && p.t!=="gap" && <text key={i} x={p.lx} y={(p.tL+p.bL)/2} textAnchor="middle" dominantBaseline="middle" fontFamily="DM Mono,monospace" fontSize={fitLabelSize(p)} fontWeight="600" fill="rgba(255,255,255,0.93)">{p.label}</text> ))}

      {/* Open bottom line + label */}
      <line x1={mL} y1={frontBot+4} x2={W-mR} y2={frontBot+4} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="5,4"/>
      <text x={W/2} y={frontBot+18} textAnchor="middle" fontFamily="Nunito,sans-serif" fontSize="10" fontWeight="600" fill="rgba(255,255,255,0.35)" letterSpacing="0.06em">Pockets Open to Bottom of Bag</text>

      {/* Mini legend */}
      <g transform={`translate(${W/2 - 145}, ${frontBot + 35})`}>
        <line x1="0" y1="0" x2="34" y2="0" stroke={sewGuideC} strokeWidth="1.5" strokeDasharray="5,4" />
        <text x="42" y="0" dominantBaseline="middle" fontFamily="Nunito,sans-serif" fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.56)">stitch line / sewline</text>
        <line x1="164" y1="0" x2="198" y2="0" stroke={bufferGuideC} strokeWidth="1.5" strokeDasharray="4,4" />
        <text x="206" y="0" dominantBaseline="middle" fontFamily="Nunito,sans-serif" fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.56)">buffer edge / SA starts</text>
      </g>
    </svg>
  );
}

// ── Fit/validation notice ─────────────────────────────────────────────────────
function AccordionNotice({ type, children, th }) {
  const styles = {
    ok:   { bg:th.ok,   bdr:th.okBdr,   txt:th.okTxt   },
    warn: { bg:th.warn, bdr:th.warnBdr, txt:th.warnTxt },
    info: { bg:th.info, bdr:th.infoBdr, txt:th.infoTxt },
  };
  const s = styles[type] || styles.info;
  return (
    <div style={{ background:s.bg, border:`1.5px solid ${s.bdr}`, borderRadius:8,
      padding:"10px 13px", marginTop:8, fontSize:14, fontWeight:600,
      color:s.txt, fontFamily:"Nunito,sans-serif", lineHeight:1.5 }}>
      {children}
    </div>
  );
}

// ── Diameter illustration icon ────────────────────────────────────────────────
function DiameterIcon({ color }) {
  return (
    <svg viewBox="0 0 52 52" width="58" height="58"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink:0, opacity:0.85 }}>
      {/* Circle — lighter tint */}
      <circle cx="26" cy="26" r="19" fill="none" stroke={color} strokeWidth="2" opacity="0.35"/>
      {/* Dashed diameter line — full color */}
      <line x1="6" y1="26" x2="46" y2="26" stroke={color} strokeWidth="1.5" strokeDasharray="4 3"/>
      {/* Left arrowhead — full color */}
      <polyline points="11,21 6,26 11,31" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Right arrowhead — full color */}
      <polyline points="41,21 46,26 41,31" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* ⌀ symbol */}
      <text x="26" y="20" textAnchor="middle" fontSize="11" fontWeight="800"
        fill={color} fontFamily="Nunito,sans-serif">⌀</text>
    </svg>
  );
}

export default function AccordionPocketPage() {
  const th = T.blue;
  const [mode, setMode]             = useState("single");
  const [freeDouble, setFreeDouble] = useState(false);
  const [sa,  setSa]                = useState(DEFAULT_SA);
  const [cSa, setCsa]               = useState("");

  // Core inputs
  const [bagW,setBagW]=useState(0); const [bagF,setBagF]=useState(0);
  const [diaW,setDiaW]=useState(0); const [diaF,setDiaF]=useState(0);
  const [htW, setHtW] =useState(0); const [htF, setHtF] =useState(0);
  const [bufW,setBufW]=useState(0); const [bufF,setBufF]=useState(0);

  // Shared flap/pf — used in single, bottle-double, freeform-single
  const [flapW,setFlapW]=useState(0); const [flapF,setFlapF]=useState(0);
  const [pfW,  setPfW] =useState(0);  const [pfF,  setPfF] =useState(0);
  const [flapAuto, setFlapAuto] = useState(true);
  const [pfAuto,   setPfAuto]   = useState(true);

  // Independent flap/pf — freeform double only
  const [flap1W,setFlap1W]=useState(0); const [flap1F,setFlap1F]=useState(0);
  const [flap2W,setFlap2W]=useState(0); const [flap2F,setFlap2F]=useState(0);
  const [pf1W,  setPf1W] =useState(0);  const [pf1F,  setPf1F] =useState(0);
  const [pf2W,  setPf2W] =useState(0);  const [pf2F,  setPf2F] =useState(0);
  const [flap1Auto,setFlap1Auto]=useState(true);
  const [flap2Auto,setFlap2Auto]=useState(true);
  const [pf1Auto,  setPf1Auto]  =useState(true);
  const [pf2Auto,  setPf2Auto]  =useState(true);

  const isDouble        = mode==="double" || (mode==="freeform" && freeDouble);
  const isFreeform      = mode==="freeform";
  const isFreeformDouble= mode==="freeform" && freeDouble;

  const bagWidth   = bagW + bagF;
  const bottleDiam = diaW + diaF;
  const pocketHt   = htW  + htF;
  const buffer     = bufW + bufF;

  // ── Shared flap/pf (all modes except freeform-double) ────────────────────
  const neededCirc = isFreeform ? 0 : Math.ceil(bottleDiam * PI * 8) / 8;
  let flap = flapAuto
    ? (isFreeform ? 1.5 : roundTo8th(bottleDiam/2))
    : roundTo8th(flapW+flapF);
  if (isNaN(flap)||flap<=0) flap = isFreeform ? 1.5 : roundTo8th(bottleDiam/2);

  const minPF = roundTo8th(flap*2 + 0.25);
  let pf = pfAuto
    ? roundTo8th(Math.max(isDouble?(bagWidth-flap*6)/2 : bagWidth-flap*4, minPF))
    : roundTo8th(pfW+pfF);
  if (isNaN(pf)||pf<=0) pf = minPF;

  const stitchLoss = isDouble ? 0.625 : 0.5;
  const actualCirc = roundTo8th(pf*2 + flap*4 - stitchLoss);
  const circumDiff = roundTo8th(actualCirc - neededCirc);

  // ── Freeform-double independent flap/pf ──────────────────────────────────
  let flap1 = flap1Auto ? 1.5 : roundTo8th(flap1W+flap1F);
  if (isNaN(flap1)||flap1<=0) flap1 = 1.5;
  let flap2 = flap2Auto ? 1.5 : roundTo8th(flap2W+flap2F);
  if (isNaN(flap2)||flap2<=0) flap2 = 1.5;

  const outer1   = roundTo8th(flap1 + sa + buffer);
  const outer2   = roundTo8th(flap2 + sa + buffer);
  const gap12    = roundTo8th(flap1 + flap2);
  const minPF1   = roundTo8th(flap1*2 + 0.25);
  const minPF2   = roundTo8th(flap2*2 + 0.25);
  const sc12     = 1.0; // stitch compensation
  const totalForPFs = roundTo8th(bagWidth - 4*flap1 - 4*flap2 - 2*(sa+buffer) - sc12);

  let pf1, pf2;
  if (pf1Auto && pf2Auto) {
    pf1 = pf2 = roundTo8th(Math.max(totalForPFs/2, Math.max(minPF1, minPF2)));
  } else if (pf1Auto) {
    pf2 = roundTo8th(pf2W+pf2F); if(isNaN(pf2)||pf2<=0) pf2=minPF2;
    pf1 = roundTo8th(Math.max(totalForPFs - pf2, minPF1));
  } else if (pf2Auto) {
    pf1 = roundTo8th(pf1W+pf1F); if(isNaN(pf1)||pf1<=0) pf1=minPF1;
    pf2 = roundTo8th(Math.max(totalForPFs - pf1, minPF2));
  } else {
    pf1 = roundTo8th(pf1W+pf1F); if(isNaN(pf1)||pf1<=0) pf1=minPF1;
    pf2 = roundTo8th(pf2W+pf2F); if(isNaN(pf2)||pf2<=0) pf2=minPF2;
  }

  // ── Unified cut dimensions ────────────────────────────────────────────────
  const outerEach  = roundTo8th(flap + sa + buffer);
  const stitchComp = isDouble ? 1.0 : 0.5;
  let cutWidth, finFaceW, segs;

  if (isFreeformDouble) {
    cutWidth  = roundTo8th(outer1+flap1+pf1+flap1+gap12+flap2+pf2+flap2+outer2+sc12);
    finFaceW  = roundTo8th(pf1+pf2);
    segs = [
      {t:"outer",w:outer1,label:"Outer 1"},
      {t:"flap", w:flap1, label:"F1"},
      {t:"pf",   w:pf1,   label:"PF 1"},
      {t:"flap", w:flap1, label:"F1"},
      {t:"gap",  w:gap12, label:"Gap", sewOffset:flap1},
      {t:"flap", w:flap2, label:"F2"},
      {t:"pf",   w:pf2,   label:"PF 2"},
      {t:"flap", w:flap2, label:"F2"},
      {t:"outer",w:outer2,label:"Outer 2"},
    ];
  } else if (isDouble) {
    cutWidth  = roundTo8th(outerEach*2+flap*6+pf*2+stitchComp);
    finFaceW  = roundTo8th(pf*2);
    segs = [
      {t:"outer",w:outerEach,label:"Outer"},
      {t:"flap", w:flap,     label:"F"},
      {t:"pf",   w:pf,       label:"PF 1"},
      {t:"flap", w:flap,     label:"F"},
      {t:"gap",  w:flap*2,   label:"Gap", sewOffset:flap},
      {t:"flap", w:flap,     label:"F"},
      {t:"pf",   w:pf,       label:"PF 2"},
      {t:"flap", w:flap,     label:"F"},
      {t:"outer",w:outerEach,label:"Outer"},
    ];
  } else {
    cutWidth  = roundTo8th(outerEach*2+flap*2+pf+stitchComp);
    finFaceW  = pf;
    segs = [
      {t:"outer",w:outerEach,label:"Outer"},
      {t:"flap", w:flap,     label:"F"},
      {t:"pf",   w:pf,       label:"PF"},
      {t:"flap", w:flap,     label:"F"},
      {t:"outer",w:outerEach,label:"Outer"},
    ];
  }

  const cutHeight  = roundTo8th(pocketHt + 0.5);
  const stabHeight = roundTo8th(pocketHt - 0.25);
  const ready      = bagWidth>0 && pocketHt>0 && (isFreeform||bottleDiam>0);

  // ── Centering: split extra panel width equally between both outer edges ───
  // When bagWidth is set and larger than the raw cut width, the extra space is
  // divided equally so the pocket assembly sits centered within the panel.
  const extraPerSide = (bagWidth>0 && cutWidth<bagWidth)
    ? Math.max(0, roundTo8th((bagWidth - cutWidth) / 2)) : 0;
  const outerEachC = roundTo8th(outerEach + extraPerSide);
  const outer1C    = roundTo8th((isFreeformDouble?outer1:outerEach) + extraPerSide);
  const outer2C    = roundTo8th((isFreeformDouble?outer2:outerEach) + extraPerSide);
  const cutWidthFinal = roundTo8th(cutWidth + 2*extraPerSide);
  const stabWidth     = roundTo8th(cutWidthFinal - sa*2 - 1.0);
  // Patch segs outer widths in-place so marking guide and SVG auto-update
  if (extraPerSide > 0) {
    segs[0] = {...segs[0], w: isFreeformDouble?outer1C:outerEachC};
    segs[segs.length-1] = {...segs[segs.length-1], w: isFreeformDouble?outer2C:outerEachC};
  }

  // ── Fit notice (bottle modes only) ───────────────────────────────────────
  // Ease scales by bottle circumference: about 15–30% extra room is the sweet spot.
  // Example: a 3" bottle is ~9 1/2" around, so 1 1/2"–2 7/8" extra is comfortable.
  const easePct = neededCirc > 0 ? circumDiff / neededCirc : 0;
  const easePctLabel = Math.max(0, Math.round(easePct * 100));
  const targetEaseMin = smartRound(neededCirc * 0.15);
  const targetEaseMax = smartRound(neededCirc * 0.30);
  let fitType="info", fitMsg="";
  if (!isFreeform && ready) {
    if (circumDiff < 0)
      { fitType="warn"; fitMsg="Too tight — the pocket is smaller than the bottle. Increase Pocket Front Width or Flap Width."; }
    else if (easePct < 0.10)
      { fitType="warn"; fitMsg="Very snug — it may be hard to slide the bottle in and out."; }
    else if (easePct < 0.15)
      { fitType="info"; fitMsg="Snug fit — secure, but still tighter than the usual comfort range."; }
    else if (easePct <= 0.30)
      { fitType="ok";   fitMsg="Comfortable fit — enough room to slide in easily without feeling sloppy."; }
    else if (easePct <= 0.35)
      { fitType="info"; fitMsg="Roomy fit — usable, but the bottle may wiggle a bit."; }
    else
      { fitType="warn"; fitMsg="Loose fit — the pocket may feel sloppy unless the item is bulky or soft."; }
  }

  // ── Bag width validation ──────────────────────────────────────────────────
  let bagType="ok", bagMsg="";
  if (ready) {
    if (finFaceW > bagWidth)
      { bagType="warn"; bagMsg="Pocket face (" + fmtInch(finFaceW) + ") exceeds pocket placement width (" + fmtInch(bagWidth) + "). Reduce pocket front width."; }
    else if (bagWidth - finFaceW < 0.25)
      { bagType="info"; bagMsg="Pocket face (" + fmtInch(finFaceW) + ") fits with very little clearance."; }
    else
      { bagType="ok";   bagMsg="Pocket face (" + fmtInch(finFaceW) + ") fits within the pocket placement width (" + fmtInch(bagWidth) + ")."; }
  }

  // ── Cumulative marking guide ──────────────────────────────────────────────
  let cum=0;
  const cumItems = segs.map((s,i)=>{
    cum = roundTo8th(cum+s.w);
    const names={outer:"Outer edge",flap:"Flap",pf:"Pocket Front",gap:"Center Gap"};
    return {cum, name:names[s.t]||s.label, w:s.w, type:s.t, last:i===segs.length-1};
  });

  function resetAutos(){ setFlapAuto(true);setPfAuto(true);setFlap1Auto(true);setFlap2Auto(true);setPf1Auto(true);setPf2Auto(true); }

  const modeTabs = [
    {id:"single",   label:"Single Bottle"},
    {id:"double",   label:"Double Bottle"},
    {id:"freeform", label:"Freeform"},
  ];
  const modeCaption = {
    single:   "Sized for one bottle or object. Pocket face width is auto-calculated to fit your panel.",
    double:   "Two side-by-side pockets on one strip, joined at a shared center gap.",
    freeform: "Set your own flap and pocket front dimensions without a bottle diameter.",
  };

  // ── Auto/custom badge + reset row ────────────────────────────────────────
  function AutoBadge({isAuto, onReset, th}) {
    return (
      <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:12,fontWeight:700,background:isAuto?th.resBg:"#fff3e0",
          color:isAuto?th.resAccent:"#b25a00",padding:"2px 8px",borderRadius:10,fontFamily:"Nunito,sans-serif"}}>
          {isAuto?"auto":"custom"}
        </span>
        {!isAuto && <button onClick={onReset} style={{fontSize:12,fontWeight:800,fontFamily:"Nunito,sans-serif",
          background:"transparent",border:`1px solid ${th.border}`,borderRadius:6,
          padding:"2px 8px",cursor:"pointer",color:th.sub}}>reset</button>}
      </span>
    );
  }

  return (
    <div className="tab-page" data-group="trim-pockets">
      <div className="tab-content-wrap" style={{paddingBottom:80}}>
        <div className="tab-intro-card">
          <div className="tab-intro-card-thumb" />
          <div className="tab-intro-card-text">
            <div className="tab-intro-card-title">Accordion Pocket</div>
            <div className="tab-intro-card-desc">An open-bottomed accordion-fold pocket that expands to fit its contents and collapses flat when empty — ideal for water bottles, sunglass cases, or anything that benefits from a self-adjusting fit.</div>
          </div>
        </div>

        <SABar sa={sa} setSa={setSa} cSa={cSa} setCsa={setCsa} th={th}/>

        <div>

          {/* Explainer */}
          <InfoBox th={th}>
            Unlike a fixed pocket, the open bottom means depth is never constrained — the pocket grows with its contents and folds away when not in use. The accordion fold distributes material evenly on both sides of the pocket face, keeping the profile slim and the construction clean. Single-bottle mode fits one object; Double fits two side by side; Freeform lets you define your own proportions.
          </InfoBox>

          {/* Mode tabs */}
          <div style={{marginTop:14}}>
            <SubTabs th={th} active={mode} set={v=>{setMode(v);resetAutos();}} tabs={modeTabs}/>
            <div style={{fontSize:14,fontWeight:600,color:th.sub,fontFamily:"Nunito,sans-serif",
              fontStyle:"italic",marginBottom:14,marginTop:-6,lineHeight:1.4}}>
              {modeCaption[mode]}
            </div>
          </div>

          {mode==="freeform" && (
            <div style={{marginBottom:14}}>
              <Card th={th} style={{padding:"12px 14px", marginBottom:0}}>
                <CardTitle th={th}>Freeform Pocket Style</CardTitle>
                <SubTabs
                  th={th}
                  active={freeDouble ? "double" : "single"}
                  set={v=>{setFreeDouble(v==="double");resetAutos();}}
                  tabs={[{id:"single",label:"Single Pocket"},{id:"double",label:"Double Pocket"}]}
                />
                <div style={{fontSize:14,fontWeight:600,color:th.sub,fontFamily:"Nunito,sans-serif",fontStyle:"italic",lineHeight:1.4}}>
                  {freeDouble
                    ? "Two independent freeform pockets on one strip. The center stitch/rivet line sits where Flap 1 and Flap 2 meet inside the shared center gap."
                    : "One freeform pocket with your chosen flap and pocket-front dimensions."}
                </div>
              </Card>
            </div>
          )}

          {/* Inputs */}
          <Card th={th}>
            <CardTitle th={th}>Measurements</CardTitle>
            <div style={{marginTop:4}}>
              <FracInput th={th}
                label="Pocket Placement Width"
                sub="Width between the seams where the pocket will be sewn in. For a topstitched pocket, enter your desired pocket width and finish the raw side edges."
                whole={bagW} frac={bagF}
                onWhole={v=>{setBagW(v);resetAutos();}} onFrac={v=>{setBagF(v);resetAutos();}}/>

              {!isFreeform && (
                <FracInput th={th} label="Bottle / Object Diameter" sub={`measure at the widest point, then add ${fmtInch(0.25)} so it slides in and out easily`}
                  whole={diaW} frac={diaF}
                  onWhole={v=>{setDiaW(v);resetAutos();}} onFrac={v=>{setDiaF(v);resetAutos();}}
                  append={<DiameterIcon color={th.label}/>}/>              )}

              <FracInput th={th} label="Finished Pocket Height"
                  whole={htW} frac={htF} onWhole={setHtW} onFrac={setHtF}/>
              <FracInput th={th} label="Side Attachment Buffer (each side)" sub="extra fabric at each side edge for sewing the pocket into the bag seams — trim to your SA when attaching"
                  whole={bufW} frac={bufF} onWhole={setBufW} onFrac={setBufF}/>
            </div>

            <Divider th={th}/>

            {/* ── Freeform-double: independent flap1/pf1 and flap2/pf2 ── */}
            {isFreeformDouble ? (<>
              {/* Pocket 1 */}
              <div style={{background:th.resBg,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:900,letterSpacing:"0.07em",textTransform:"uppercase",
                  color:th.resAccent,marginBottom:8,fontFamily:"Nunito,sans-serif"}}>Pocket 1</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <div style={{fontSize:14,fontWeight:800,color:th.label,fontFamily:"Nunito,sans-serif"}}>Pocket Front Width</div>
                  <AutoBadge isAuto={pf1Auto} onReset={()=>setPf1Auto(true)} th={th}/>
                </div>
                <FracInput th={th} label="" sub={`the visible face of pocket 1 — must be at least twice the flap width plus ${fmtInch(0.25)}`}
                  whole={pf1Auto?Math.floor(pf1):pf1W}
                  frac={pf1Auto?roundTo8th(pf1-Math.floor(pf1)):pf1F}
                  onWhole={v=>{setPf1Auto(false);setPf1W(v);setPf1F(roundTo8th(pf1-Math.floor(pf1)));}}
                  onFrac={v=>{setPf1Auto(false);setPf1F(v);setPf1W(Math.floor(pf1));}}/>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,marginTop:4}}>
                  <div style={{fontSize:14,fontWeight:800,color:th.label,fontFamily:"Nunito,sans-serif"}}>Flap Width</div>
                  <AutoBadge isAuto={flap1Auto} onReset={()=>setFlap1Auto(true)} th={th}/>
                </div>
                <FracInput th={th} label="" sub="how wide each fold is for pocket 1 — controls how much it expands"
                  whole={flap1Auto?Math.floor(flap1):flap1W}
                  frac={flap1Auto?roundTo8th(flap1-Math.floor(flap1)):flap1F}
                  onWhole={v=>{setFlap1Auto(false);setFlap1W(v);setFlap1F(roundTo8th(flap1-Math.floor(flap1)));}}
                  onFrac={v=>{setFlap1Auto(false);setFlap1F(v);setFlap1W(Math.floor(flap1));}}/>
                {ready && pf1 < minPF1 && <AccordionNotice type="warn" th={th}>Pocket front 1 ({fmtInch(pf1)}) must be at least {fmtInch(minPF1)} (flap1 x 2 + {fmtInch(0.25)}).</AccordionNotice>}
              </div>

              {/* Pocket 2 */}
              <div style={{background:th.resBg,borderRadius:8,padding:"10px 12px",marginBottom:4}}>
                <div style={{fontSize:13,fontWeight:900,letterSpacing:"0.07em",textTransform:"uppercase",
                  color:th.resAccent,marginBottom:8,fontFamily:"Nunito,sans-serif"}}>Pocket 2</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <div style={{fontSize:14,fontWeight:800,color:th.label,fontFamily:"Nunito,sans-serif"}}>Pocket Front Width</div>
                  <AutoBadge isAuto={pf2Auto} onReset={()=>setPf2Auto(true)} th={th}/>
                </div>
                <FracInput th={th} label="" sub={`the visible face of pocket 2 — must be at least twice the flap width plus ${fmtInch(0.25)}`}
                  whole={pf2Auto?Math.floor(pf2):pf2W}
                  frac={pf2Auto?roundTo8th(pf2-Math.floor(pf2)):pf2F}
                  onWhole={v=>{setPf2Auto(false);setPf2W(v);setPf2F(roundTo8th(pf2-Math.floor(pf2)));}}
                  onFrac={v=>{setPf2Auto(false);setPf2F(v);setPf2W(Math.floor(pf2));}}/>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,marginTop:4}}>
                  <div style={{fontSize:14,fontWeight:800,color:th.label,fontFamily:"Nunito,sans-serif"}}>Flap Width</div>
                  <AutoBadge isAuto={flap2Auto} onReset={()=>setFlap2Auto(true)} th={th}/>
                </div>
                <FracInput th={th} label="" sub="how wide each fold is for pocket 2 — controls how much it expands"
                  whole={flap2Auto?Math.floor(flap2):flap2W}
                  frac={flap2Auto?roundTo8th(flap2-Math.floor(flap2)):flap2F}
                  onWhole={v=>{setFlap2Auto(false);setFlap2W(v);setFlap2F(roundTo8th(flap2-Math.floor(flap2)));}}
                  onFrac={v=>{setFlap2Auto(false);setFlap2F(v);setFlap2W(Math.floor(flap2));}}/>
                {ready && pf2 < minPF2 && <AccordionNotice type="warn" th={th}>Pocket front 2 ({fmtInch(pf2)}) must be at least {fmtInch(minPF2)} (flap2 x 2 + {fmtInch(0.25)}).</AccordionNotice>}
              </div>

              <div style={{background:th.info,border:`1.5px solid ${th.infoBdr}`,borderRadius:8,
                padding:"8px 12px",marginTop:8,fontSize:14,fontWeight:600,color:th.infoTxt,fontFamily:"Nunito,sans-serif"}}>
                Center gap = Flap 1 ({fmtInch(flap1)}) + Flap 2 ({fmtInch(flap2)}) = <strong>{fmtInch(gap12)}</strong> · this value should stay equal to both flap widths combined.
              </div>
              {ready && <div style={{marginTop:8}}><AccordionNotice type={bagType} th={th}>{bagMsg}</AccordionNotice></div>}
            </>) : (<>
              {/* Shared pf */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{fontSize:14,fontWeight:800,color:th.label,fontFamily:"Nunito,sans-serif"}}>Pocket Front Width</div>
                <AutoBadge isAuto={pfAuto} onReset={()=>setPfAuto(true)} th={th}/>
              </div>
              <FracInput th={th} label=""
                sub="the visible face of the pocket — auto-set to fit your panel width. Tap reset to return to auto."
                whole={pfAuto?Math.floor(pf):pfW}
                frac={pfAuto?roundTo8th(pf-Math.floor(pf)):pfF}
                onWhole={v=>{setPfAuto(false);setPfW(v);setPfF(roundTo8th(pf-Math.floor(pf)));}}
                onFrac={v=>{setPfAuto(false);setPfF(v);setPfW(Math.floor(pf));}}/>
              {ready && pf < minPF && (
                <AccordionNotice type="warn" th={th}>
                  Pocket front ({fmtInch(pf)}) must be at least {fmtInch(minPF)} (flap x 2 + {fmtInch(0.25)}) for accordion construction.
                </AccordionNotice>
              )}

              {/* Shared flap */}
              <div style={{display:"flex",alignItems:"center",gap:8,margin:"12px 0 4px"}}>
                <div style={{fontSize:14,fontWeight:800,color:th.label,fontFamily:"Nunito,sans-serif"}}>Flap Width (each)</div>
                <AutoBadge isAuto={flapAuto} onReset={()=>setFlapAuto(true)} th={th}/>
              </div>
              <FracInput th={th} label=""
                sub={isFreeform?"how wide each fold is — controls how much the pocket expands":"half your bottle diameter — controls how wide the pocket folds open"}
                whole={flapAuto?Math.floor(flap):flapW}
                frac={flapAuto?roundTo8th(flap-Math.floor(flap)):flapF}
                onWhole={v=>{setFlapAuto(false);setFlapW(v);setFlapF(roundTo8th(flap-Math.floor(flap)));}}
                onFrac={v=>{setFlapAuto(false);setFlapF(v);setFlapW(Math.floor(flap));}}/>
              {!isFreeform && ready && fitMsg && (
                <AccordionNotice type={fitType} th={th}>
                  Pocket circumference: {fmtInch(actualCirc)} · Bottle circumference: {fmtInch(neededCirc)} · Extra room: {fmtInch(Math.max(0,circumDiff))} ({easePctLabel}%). Target: {fmtInch(targetEaseMin)}–{fmtInch(targetEaseMax)} extra. {fitMsg}
                </AccordionNotice>
              )}
              {ready && <div style={{marginTop:8}}><AccordionNotice type={bagType} th={th}>{bagMsg}</AccordionNotice></div>}
            </>)}
          </Card>

          {/* Results */}
          {ready && (<>
            <Card th={th}>
              <CardTitle th={th}>Calculated Dimensions · {isFreeformDouble?"Freeform Double":isDouble?"Double":"Single"}</CardTitle>
              <div style={{fontSize:14, fontWeight:600, color:th.sub, fontFamily:"Nunito,sans-serif",
                lineHeight:1.5, marginBottom:10}}>
                Cut <strong style={{color:th.label}}>2 identical pieces</strong> at these dimensions — they'll be placed right-sides-together, sewn along the top and bottom edges, then turned right-side-out to form the pocket.
              </div>
              <div style={{background:th.resBg,borderRadius:8,padding:"12px 14px"}}>
                {[
                  ["Cut Fabric Width",   fmtInch(cutWidthFinal),  true],
                  ["Cut Fabric Height",  fmtInch(cutHeight), true],
                  isFreeformDouble
                    ? ["Finished Pocket Face Width — Pocket 1", fmtInch(pf1), false]
                    : isDouble ? ["Finished Pocket Face Width — Pocket 1", fmtInch(pf), false] : ["Finished Pocket Face Width", fmtInch(finFaceW), false],
                  ...((isFreeformDouble || isDouble) ? [[isFreeformDouble ? "Finished Pocket Face Width — Pocket 2" : "Finished Pocket Face Width — Pocket 2", fmtInch(isFreeformDouble ? pf2 : pf), false]] : []),
                  ...((isFreeformDouble || isDouble) ? [["Combined Finished Pocket Face Width", fmtInch(finFaceW), false]] : []),
                  ["Finished Pocket Height", fmtInch(pocketHt), false],
                  isFreeformDouble
                    ? ["Flap 1 Width", fmtInch(flap1), false]
                    : ["Flap Width (each)", fmtInch(flap), false],
                  ...(isFreeformDouble?[["Flap 2 Width", fmtInch(flap2), false]]:[]),
                  isFreeformDouble
                    ? ["Outer Edge 1", fmtInch(outer1C), false]
                    : ["Outer Edge (each side)", fmtInch(outerEachC), false],
                  ...(isFreeformDouble?[["Outer Edge 2", fmtInch(outer2C), false]]:[]),
                  isFreeformDouble
                    ? ["Center Gap (equal to Flap 1 + Flap 2)", fmtInch(gap12), false]
                    : isDouble?["Center Gap (equal to 2 flaps)", fmtInch(flap*2), false]:null,
                  ["Seam Allowance", fmtInch(sa), false],
                  ["Side Attachment Buffer", fmtInch(buffer), false],
                ].filter(Boolean).map(([lbl,val,big])=>(
                  <RRow key={lbl} th={th} label={lbl} value={val} accent={big} big={big}/>
                ))}
              </div>
              <InfoBox th={th}>
                {isFreeformDouble
                  ? "The outer pocket edges (Outer 1: " + fmtInch(outer1C) + ", Outer 2: " + fmtInch(outer2C) + ") will be unfinished. Baste those raw edges to your desired bag panel and trim any excess."
                  : "The outer pocket edges (" + fmtInch(outerEachC) + " each side) will be unfinished. Baste those raw edges to your desired bag panel and trim any excess."}
              </InfoBox>
            </Card>

            <Card th={th}>
              <CardTitle th={th}>✦ Stabilizer + Optional Cotton Interfacing</CardTitle>
              <div style={{background:th.resBg,borderRadius:8,padding:"12px 14px"}}>
                <RRow th={th} label="Stabilizer Width"  value={fmtInch(stabWidth)} />
                <RRow th={th} label="Stabilizer Height" value={fmtInch(stabHeight)}/>
              </div>
              <InfoBox th={th}>
                Cut the stabilizer above when you want the pocket to feel sturdier, softer, or more protective for glasses, bottles, or fragile items. For quilting cotton, also cut woven fusible interfacing for both fabric pieces before assembly. For vinyl, canvas, or structured fabrics, skip the woven interfacing unless your material needs extra body.
              </InfoBox>
            </Card>

            <div style={{background:"#1a2a3a",borderRadius:10,padding:"4px 10px 10px",marginBottom:12,display:"flex",justifyContent:"center",alignItems:"center",overflow:"hidden"}}>
              <AccordionSVG segs={segs} cutWidth={cutWidthFinal} isDouble={isDouble} sa={sa} buffer={buffer}/>
            </div>

            <Card th={th}>
              <CardTitle th={th}>Fabric Marking Guide — Measure to + Mark</CardTitle>
              <div className="mark-guide-head" style={{color:th.label,fontFamily:"Nunito,sans-serif"}}>
                <div>Measure to</div>
                <div>Mark</div>
                <div>Segment width</div>
              </div>
              {cumItems.map((c,i)=>{
                const segColors = {
                  outer:{bg:"#7a5010",txt:"#8a5b0c"},
                  flap:{bg:"#2a5c1a",txt:"#2f6f1f"},
                  pf:{bg:"#1a5080",txt:"#1a5f9e"},
                  gap:{bg:"#6a1010",txt:"#8f1b1b"},
                };
                const sc = segColors[c.type] || {bg:th.accent,txt:th.accent};
                return (
                  <div key={i} className="mark-guide-row">
                    <div className="mark-guide-measure" style={{color:th.resAccent}}>{fmtInch(c.cum)}</div>
                    <div className="mark-guide-action" style={{color:th.label,fontFamily:"Nunito,sans-serif"}}>
                      {c.last?"end of fabric":"mark line"}
                      <span style={{color:th.sub,fontWeight:600}}> · </span>
                      <span className="mark-seg-pill" style={{background:sc.bg}}>{c.name}</span>
                    </div>
                    <div className="mark-guide-width" style={{color:sc.txt}}>{fmtInch(c.w)}</div>
                  </div>
                );
              })}
            </Card>

            <Card th={th}>
              <CardTitle th={th}>✦ Important Notes</CardTitle>
              {[
                ["Pocket Placement","Position the pocket at least " + fmtInch(0.5) + " above the bag" + "'" + "s bottom seam or any curved angles. Keep clear of seam allowances and curved seam areas."],
                ...(isDouble?[["Attachment at Center Gap", isFreeformDouble
                  ? "The shared center gap equals Flap 1 + Flap 2. Place the stitch/rivet line where those flaps meet: " + fmtInch(flap1) + " from the Pocket 1 side and " + fmtInch(flap2) + " from the Pocket 2 side."
                  : "After attaching outer edges, sew a straight stitch or place rivets through the center gap to secure the pocket to the bag interior."
                ]]:[] ),
                isFreeformDouble
                  ? ["Outer Edges","Outer edge 1 (" + fmtInch(outer1C) + ") and outer edge 2 (" + fmtInch(outer2C) + ") are raw — trim each to your exact SA when attaching to the bag interior."]
                  : ["Side Attachment Buffer","The outer side edges (" + fmtInch(outerEachC) + " each side) include extra fabric for seam attachment. Trim to your exact SA when attaching."],
                ["Fold Direction","All flaps fold away from the pocket front so the pocket collapses flat when empty."],
                ["Stress Points","Backstitch several times at the top and bottom of each " + fmtInch(0.125) + " fold stitch — these points take the most wear."],
              ].map(([title,body])=>(
                <div key={title} style={{padding:"6px 0",borderBottom:`1px solid ${th.border}`}}>
                  <div style={{fontSize:14,fontWeight:800,color:th.label,fontFamily:"Nunito,sans-serif"}}>{title}</div>
                  <div style={{fontSize:14,fontWeight:600,color:th.sub,fontFamily:"Nunito,sans-serif",lineHeight:1.5,marginTop:2}}>{body}</div>
                </div>
              ))}
            </Card>

            <Card th={th}>
              <CardTitle th={th}>Construction Steps</CardTitle>
              {[
                ["Cut", "Cut 2 fabric pieces: " + fmtInch(cutWidthFinal) + " wide x " + fmtInch(cutHeight) + " tall. Cut the stabilizer listed above if you want extra structure or padding. If using quilting cotton, also cut woven fusible interfacing for both fabric pieces."],
                ["Fuse", "Fuse woven interfacing first if using cotton. Then center the stabilizer on the wrong side of one fabric piece, leaving even margins on all sides."],
                ["Sew + turn", "Place fabric right sides together. Sew the top and bottom edges using your selected " + fmtInch(sa) + " seam allowance. Turn right side out and press flat. Add binding to the top edge if desired."],
                ["Mark", "Use the marking guide above to mark each fold line from one raw side edge."],
                ["Stitch folds", "Fold accordion-style, with all flaps folding away from the pocket front(s). Stitch " + fmtInch(0.125) + " from each folded edge and backstitch well at the top and bottom."],
                ["Attach", "Baste the raw side edges into the bag seams and trim any excess. Leave the bottom open." + (isDouble ? (isFreeformDouble ? " Secure the center gap at the Flap 1 + Flap 2 meeting point with a stitch line or rivets." : " Secure the center gap with a stitch line or rivets.") : "") + " If topstitching the pocket onto a flat panel instead, finish the raw side edges first."],
              ].map(([stepTitle,stepBody],i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:`1px solid ${th.border}`}}>
                  <div style={{fontSize:14,fontWeight:900,color:th.accent,fontFamily:"DM Mono,monospace",minWidth:20,flexShrink:0}}>{i+1}.</div>
                  <div style={{fontFamily:"Nunito,sans-serif",lineHeight:1.55}}>
                    <div style={{fontSize:14,fontWeight:900,color:th.label}}>{stepTitle}</div>
                    <div style={{fontSize:14,fontWeight:600,color:th.label}}>{stepBody}</div>
                  </div>
                </div>
              ))}
            </Card>
          </>)}

          {!ready && (
            <div style={{textAlign:"center",padding:"32px 20px",color:th.sub,fontFamily:"Nunito,sans-serif",fontSize:15,fontWeight:600}}>
              Enter the pocket placement width and pocket height{!isFreeform?" and bottle diameter":""} above to calculate.
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom warning banner */}
      {ready && finFaceW > bagWidth && (
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
          width:"100%",maxWidth:520,zIndex:50,background:"#b91c1c",
          borderTop:"3px solid #fca5a5",padding:"14px 20px 22px",
          boxShadow:"0 -4px 24px rgba(185,28,28,0.5)"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
            <div style={{fontSize:22,flexShrink:0}}>⚠️</div>
            <div>
              <div style={{fontSize:14,fontWeight:900,color:"#fff",fontFamily:"Nunito,sans-serif",marginBottom:3}}>
                Pocket too wide for this panel!
              </div>
              <div style={{fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.88)",fontFamily:"Nunito,sans-serif",lineHeight:1.4}}>
                Pocket face ({fmtInch(finFaceW)}) exceeds the pocket placement width ({fmtInch(bagWidth)}). Reduce pocket front width or increase the pocket placement width.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
