import { useState, useRef, useEffect } from "react";
import {
  buildCurvedPanelModel,
  fmtIn as cpFmtIn, fmtDec as cpFmtDec, ptsToPath as cpPtsToPath,
  markDetails as cpMarkDetails,
} from "./curved-panel-core.js";
import {
  buildBoxedCornerModel,
  fmtIn as bcFmtIn, fmtDec as bcFmtDec, ptsToPath as bcPtsToPath,
} from "./boxed-corner-core.js";
import {
  setCurrentUnit, isMetric, inToMm, mmToIn, metricRoundIn,
  roundTo8th, roundTo4th, roundTo32nd, smartRound,
  fmtInch, fmtInch32, fmtCm,
} from "./utils/formatting.js";
import { PI, GA_MEASUREMENT_ID, DEFAULT_SA, CORDS } from "./utils/constants.js";
import {
  CP_TILE_W, CP_TILE_H, CP_CM3,
  cpTilePlan, cpTileLabel, cpRowLabel, cpTestSquareSVG, cpRegistrationMarks,
} from "./utils/print-utils.js";
import "./moonshot.css";
import ComingSoon from "./components/ComingSoon.jsx";
import PrintButton from "./components/PrintButton.jsx";
import TrustBadge from "./components/TrustBadge.jsx";
import FracInput from "./components/FracInput.jsx";

// ── Google Analytics (GA4) ──────────────────────────────────────────────────
// Basic anonymous page tracking only. Do not send user-entered calculator values.

if (typeof window !== "undefined" && typeof document !== "undefined" && GA_MEASUREMENT_ID) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };

  if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`)) {
    const gaScript = document.createElement("script");
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(gaScript);

    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: true,
      anonymize_ip: true,
    });
  }
}

// ── Browser chrome tint (Safari tab bar, Chrome/Edge Android toolbar) ────────
if (typeof document !== "undefined" && !document.querySelector('meta[name="theme-color"]')) {
  const tc = document.createElement("meta");
  tc.name = "theme-color";
  tc.content = "#1e1040";
  document.head.appendChild(tc);
}

// ── Google Fonts ──────────────────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&display=swap";
  document.head.appendChild(link);
}


// ── Math helpers ──────────────────────────────────────────────────────────────
function roundRectPerim(L, W, R) {
  const r = Math.max(0, R);
  return 2*(L+W) + r*(2*PI - 8);
}
function ellipsePerim(W, H) {
  if (!W || !H || W <= 0 || H <= 0) return 0;
  const a = W / 2;
  const b = H / 2;
  const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
  return PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}
// Side panel split for rounded lid/bottom corners.
// Each side panel seam lands at the midpoint of the neighboring corner arcs,
// so each side receives two quarter-arc halves: πR/4 + πR/4 = πR/2.
function arcMidSplit(Ls, Ws, Rs) {
  const straightA = Math.max(0, Ls - 2*Rs);
  const straightB = Math.max(0, Ws - 2*Rs);
  const cornerShare = Rs > 0 ? (PI * Rs) / 2 : 0;
  return {
    sideA_fin: straightA + cornerShare,
    sideB_fin: straightB + cornerShare,
  };
}
// Piping strip width: vinyl-calibrated (anchor: 3/32" + 3/8" SA → 1-1/8")
function pipingStripWidth(dia, sa) { return smartRound(4*dia + 2*sa); }
// Cord length offset: cord curves inside sewline
// offset = 2π × (cord_radius + vinyl_thickness)
function cordOffset(dia, vinylThick) { return 2*PI*(dia/2 + vinylThick); }

// ── Themes ────────────────────────────────────────────────────────────────────
const T = {
  purple:{
    sec:"#ede8f7", hdr:"#5a2da0", hdrTxt:"#fff",
    card:"#faf8ff", border:"#b09ee0",
    label:"#4a1f96", sub:"#8a70c0", accent:"#5a2da0",
    inputBg:"#f3f0fc", inputTxt:"#2e1060",
    resBg:"#e2daf5", resAccent:"#4a1f96", resTxt:"#2e1060",
    btnOn:"#5a2da0", btnOnTxt:"#fff", btnOff:"#e2daf5", btnOffTxt:"#4a1f96",
    info:"#ede8f7", infoBdr:"#9880d0", infoTxt:"#3a1880",
    ok:"#e0f5ea", okBdr:"#5aaa80", okTxt:"#1a5c38",
    warn:"#fdf4e0", warnBdr:"#d4a820", warnTxt:"#6b4400",
    nudgeBg:"#e2daf5", nudgeTxt:"#4a1f96", pageBg:"#f0ecfc",
  },
  green:{
    sec:"#e2f5e8", hdr:"#1a6e3a", hdrTxt:"#fff",
    card:"#f4fbf6", border:"#72c490",
    label:"#165c30", sub:"#3a9e60", accent:"#1a6e3a",
    inputBg:"#eaf7ee", inputTxt:"#0e3d20",
    resBg:"#ceeedd", resAccent:"#165c30", resTxt:"#0e3d20",
    btnOn:"#1a6e3a", btnOnTxt:"#fff", btnOff:"#ceeedd", btnOffTxt:"#165c30",
    info:"#e2f5e8", infoBdr:"#72c490", infoTxt:"#0e3d20",
    warn:"#fdf4e0", warnBdr:"#d4a820", warnTxt:"#6b4400",
    nudgeBg:"#ceeedd", nudgeTxt:"#165c30", pageBg:"#ecf8f0",
  },
  advanced:{
    sec:"#f5eaec", hdr:"#7a1a2e", hdrTxt:"#fff",
    card:"#fdf5f6", border:"#c48090",
    label:"#5c1020", sub:"#a04060", accent:"#7a1a2e",
    inputBg:"#f8eef0", inputTxt:"#3a0818",
    resBg:"#eeccd4", resAccent:"#5c1020", resTxt:"#3a0818",
    btnOn:"#7a1a2e", btnOnTxt:"#fff", btnOff:"#eeccd4", btnOffTxt:"#5c1020",
    info:"#f5eaec", infoBdr:"#b06070", infoTxt:"#3a0818",
    ok:"#e0f5ea", okBdr:"#5aaa80", okTxt:"#1a5c38",
    warn:"#fdf4e0", warnBdr:"#d4a820", warnTxt:"#6b4400",
    nudgeBg:"#eeccd4", nudgeTxt:"#5c1020", pageBg:"#f2e8ea",
  },
  blue:{
    sec:"#e0eaf7", hdr:"#1a4a7a", hdrTxt:"#fff",
    card:"#f4f8ff", border:"#7aaad8",
    label:"#0e3060", sub:"#3a70a8", accent:"#1a4a7a",
    inputBg:"#eaf2fc", inputTxt:"#0a1e40",
    resBg:"#ccdff5", resAccent:"#0e3060", resTxt:"#0a1e40",
    btnOn:"#1a4a7a", btnOnTxt:"#fff", btnOff:"#ccdff5", btnOffTxt:"#0e3060",
    info:"#e0eaf7", infoBdr:"#5a90c8", infoTxt:"#0a1e40",
    ok:"#e0f5ea", okBdr:"#5aaa80", okTxt:"#1a5c38",
    warn:"#fdf4e0", warnBdr:"#d4a820", warnTxt:"#6b4400",
    nudgeBg:"#ccdff5", nudgeTxt:"#0e3060", pageBg:"#eaf2fc",
  },
  magenta:{
    sec:"#f5e2f8", hdr:"#8e1a9e", hdrTxt:"#fff",
    card:"#fdf5ff", border:"#d090e0",
    label:"#741880", sub:"#c060d8", accent:"#8e1a9e",
    inputBg:"#f8eefb", inputTxt:"#4a0a58",
    resBg:"#eecef5", resAccent:"#741880", resTxt:"#4a0a58",
    btnOn:"#8e1a9e", btnOnTxt:"#fff", btnOff:"#eecef5", btnOffTxt:"#741880",
    info:"#f5e2f8", infoBdr:"#c070d8", infoTxt:"#4a0a58",
    warn:"#fdf4e0", warnBdr:"#d4a820", warnTxt:"#6b4400",
    nudgeBg:"#eecef5", nudgeTxt:"#741880", pageBg:"#f8eefb",
  }
};

// ── Shared UI ─────────────────────────────────────────────────────────────────
function SecHeader({ title, sub, th }) {
  return (
    <div style={{ background:th.hdr, borderRadius:"14px 14px 0 0", padding:"18px 22px 14px" }}>
      <div style={{ fontSize:24, fontWeight:900, color:th.hdrTxt, fontFamily:"Nunito,sans-serif", letterSpacing:"-0.01em" }}>{title}</div>
      {sub && <div style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.85)", marginTop:5, fontFamily:"Nunito,sans-serif", lineHeight:1.45 }}>{sub}</div>}
    </div>
  );
}
function Card({ children, th, style:st }) {
  return (
    <div style={{ background:th.card, border:`1.5px solid ${th.border}`, borderRadius:10,
      padding:"16px 18px", marginBottom:12, boxShadow:"0 2px 8px rgba(0,0,0,0.05)", ...st }}>
      {children}
    </div>
  );
}
function CardTitle({ children, th }) {
  return (
    <div style={{ fontSize:13, fontWeight:900, letterSpacing:"0.09em", textTransform:"uppercase",
      color:th.label, marginBottom:12, fontFamily:"Nunito,sans-serif",
      borderBottom:`2px solid ${th.border}`, paddingBottom:8 }}>
      {children}
    </div>
  );
}
function RRow({ label, value, accent, big, th }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline",
      padding:"7px 0", borderBottom:`1px solid ${th.border}` }}>
      <div style={{ fontSize:15, fontWeight:700, color:th.label, fontFamily:"Nunito,sans-serif" }}>{label}</div>
      <div style={{ fontSize:big?24:19, fontFamily:"DM Mono,monospace", fontWeight:500,
        color:accent?th.resAccent:th.resTxt }}>{value}</div>
    </div>
  );
}
function InfoBox({ children, th }) {
  return (
    <div style={{ background:th.info, border:`1.5px solid ${th.infoBdr}`, borderRadius:8,
      padding:"11px 14px", marginTop:10, fontSize:15, fontWeight:600, color:th.infoTxt,
      fontFamily:"Nunito,sans-serif", lineHeight:1.5 }}>
      {children}
    </div>
  );
}
function NoteBox({ children }) {
  return (
    <div style={{ background:"#fdf4e0", border:"1.5px solid #d4a820", borderRadius:8,
      padding:"11px 14px", marginTop:10, fontSize:15, fontWeight:600, color:"#6b4400",
      fontFamily:"Nunito,sans-serif", lineHeight:1.5 }}>
      {children}
    </div>
  );
}
function SubTabs({ tabs, active, set, th }) {
  return (
    <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
      {tabs.map(tab=>(
        <button key={tab.id} onClick={()=>set(tab.id)} style={{
          flex:1, minWidth:80, padding:"10px 6px", fontSize:13, fontWeight:800,
          fontFamily:"Nunito,sans-serif", letterSpacing:"0.04em", textTransform:"uppercase",
          borderRadius:8, border:"none", cursor:"pointer",
          background:active===tab.id?th.btnOn:th.btnOff,
          color:active===tab.id?"#fff":th.btnOffTxt,
          transition:"all 0.15s"
        }}>{tab.label}</button>
      ))}
    </div>
  );
}
function Nudge({ label, onClick, th }) {
  return (
    <button onClick={onClick} style={{ width:"100%", flex:1, fontSize:13, fontWeight:800,
      fontFamily:"DM Mono,monospace", background:th.nudgeBg, color:th.nudgeTxt,
      border:`1.5px solid ${th.border}`, borderRadius:6, cursor:"pointer",
      padding:"4px 2px", lineHeight:1.3 }}>
      {label}
    </button>
  );
}
function Divider({ th }) {
  return <div style={{ borderTop:`2px dashed ${th.border}`, margin:"14px 0", opacity:0.5 }} />;
}
function SABar({ sa, setSa, cSa, setCsa, th }) {
  const imperialPresets=[{l:'1/4"',v:0.25},{l:'3/8"',v:0.375},{l:'1/2"',v:0.5}];
  const metricPresets=[{l:'0.5 cm',v:mmToIn(5)},{l:'1 cm',v:mmToIn(10)},{l:'1.5 cm',v:mmToIn(15)},{l:'2 cm',v:mmToIn(20)}];
  const presets=isMetric()?metricPresets:imperialPresets;
  const isCustom=!presets.some(p=>Math.abs(p.v-sa)<0.0005);
  return (
    <div style={{ background:th.card, border:`1.5px solid ${th.border}`, borderRadius:10,
      padding:"14px 16px", marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize:13, fontWeight:900, letterSpacing:"0.09em", textTransform:"uppercase",
        color:th.label, marginBottom:10, fontFamily:"Nunito,sans-serif",
        borderBottom:`2px solid ${th.border}`, paddingBottom:8 }}>
        Seam Allowance
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        {presets.map(p=>(
          <button key={p.l} onClick={()=>{setSa(p.v);setCsa("");}} style={{
            padding:"10px 14px", fontSize:16, fontFamily:"DM Mono,monospace", fontWeight:500,
            borderRadius:8, cursor:"pointer",
            background:Math.abs(sa-p.v)<0.0005?th.btnOn:th.btnOff,
            color:Math.abs(sa-p.v)<0.0005?"#fff":th.btnOffTxt,
            border:`2px solid ${Math.abs(sa-p.v)<0.0005?th.btnOn:th.border}`,
            transition:"all 0.15s"
          }}>{p.l}</button>
        ))}
        <input type="number" min={isMetric()?"0.1":"0.0625"} max={isMetric()?"10":"1"} step={isMetric()?"0.1":"0.0625"} placeholder={isMetric()?"custom cm":"custom"}
          value={cSa}
          onChange={e=>{setCsa(e.target.value);const v=parseFloat(e.target.value);if(!isNaN(v)&&v>0)setSa(isMetric()?mmToIn(v*10):v);}}
          style={{ width:isMetric()?110:88, padding:"10px 8px", fontSize:14, fontFamily:"DM Mono,monospace",
            fontWeight:500, borderRadius:8, textAlign:"center",
            background:isCustom?"#fef3c7":th.inputBg,
            border:`2px solid ${isCustom?"#c08800":th.border}`,
            color:th.inputTxt, outline:"none" }}
        />
      </div>
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════════════════
// PANEL DIAGRAM — SVG infographic for Lid/Bottom tab
// ══════════════════════════════════════════════════════════════════════════════

const SVG_NS = "http://www.w3.org/2000/svg";

const DT = {
  lidFill:"#ede8f7", lidStroke:"#5a2da0",
  sideFill:"#e2daf5", sideStroke:"#4a1f96",
  sewStroke:"#8a70c0", sewDash:"5 3.5",
  panelName:"#4a1f96", panelSub:"#8a70c0",
  radDot:"#5a2da0", radText:"#4a1f96",
  dimLine:"#5a2da0",
  warnBg:"#fdf4e0", warnBdr:"#d4a820", warnTxt:"#6b4400",
  svgBg:"#ffffff",
  FUI:"Nunito,sans-serif", FMO:"DM Mono,monospace",
};

function diagFmt(v) {
  if (!v || v <= 0) return isMetric() ? '0 mm' : '0"';
  if (isMetric()) return `${Math.round(inToMm(v))} mm`;
  const s = Math.round(v * 8) / 8;
  const w = Math.floor(s);
  const n = Math.round((s - w) * 8);
  const m = {0:"",1:"1/8",2:"1/4",3:"3/8",4:"1/2",5:"5/8",6:"3/4",7:"7/8"};
  const fp = n ? m[n] : "";
  if (w && fp) return `${w} ${fp}"`;
  if (w) return `${w}"`;
  return `${fp}"`;
}

function dse(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function dap(parent, child) { parent.appendChild(child); return child; }

function buildDiagramSVG(svg, lidW_in, lidH_in, bagH_in, sideBW_in, radius_in, sa_in, sAcut_in, sBcut_in) {
  svg.innerHTML = "";
  if (!lidW_in || !lidH_in || !sideBW_in) return "0 0 400 120";

  // ── Step 1: compute panel pixel sizes ────────────────────────────────────
  // S (scale) is based ONLY on horizontal panel widths — height never affects it
  const MAX_W = 480;
  const horizIn = lidW_in + lidW_in + sideBW_in; // three panel widths side by side
  const PAD_H  = 24;
  const GAP    = 36;
  const gapIn  = (PAD_H * 2 + GAP * 2) / 44; // approximate gap allowance in "inches"
  let S = Math.floor(MAX_W / (horizIn + gapIn + 4));
  // Clamp S so no horizontal panel dimension is tiny, but ignore height
  const minHorizDim = Math.min(lidW_in, lidH_in, sideBW_in);
  if (minHorizDim * S < 40) S = Math.ceil(40 / minHorizDim);
  if (S > 44) S = 44;

  const pLW = lidW_in   * S;
  const pLH = lidH_in   * S;
  const pAH = (bagH_in  || lidH_in) * S;
  const pBH = (bagH_in  || lidH_in) * S;
  const pAW = lidW_in   * S;
  const pBW = sideBW_in * S;
  const pR  = Math.max(0, Math.min(radius_in * S, pLW / 2, pLH / 2));
  const pSA = Math.max(0, sa_in * S);
  const SO  = 12;

  // ── Step 2: compute totalW so we can derive font sizes from it ───────────
  const lidX  = PAD_H;
  const aX    = lidX + pLW + GAP;
  const bX    = aX   + pAW + GAP;
  const totalW = bX + pBW + 12 + PAD_H; // 12 = SO shadow offset

  // ── Step 3: font sizes in px — renders at exact screen size always ───────
  const FST = 15;  // panel headers: "Lid / Bottom", "Side A", "Side B"
  const FSS = 12;  // "x 2" label inside panels
  const FSR = 12;  // radius callout "r = 1""
  const FSD = 12;  // dimension strip below panels

  // ── Step 4: layout heights ────────────────────────────────────────────────
  const TITLE_H   = FST + 14 + 8;      // header row height — +8 top breathing room
  const PAD_T     = TITLE_H + 10;      // top padding
  const nameY     = 8 + (TITLE_H - 8) / 2;  // centered within padded header area
  const tallest   = Math.max(pLH, pAH, pBH);
  const lidY      = PAD_T + (tallest - pLH) / 2;
  const aY        = PAD_T + (tallest - pAH) / 2;
  const bY        = PAD_T + (tallest - pBH) / 2;
  const panelBot  = PAD_T + tallest + SO;  // bottom of panels incl shadow

  // Radius leader: dot is inside the panel corner, leader exits below the panel
  // Leader length = enough to clear the panel outline + reach text
  const LL        = Math.max(28, pR * 0.6 + 20);
  // ly2 = dotY + LL*0.707; worst case dotY = lidY + pLH - pR/2
  // We need ly2 + FSR + 4 <= panelBot + RAD_CLEARANCE
  const dotY_max  = lidY + pLH - pR / 2;
  const ly2_max   = dotY_max + LL * 0.707;
  const radTextBottom = ly2_max + FSR + 6;
  const RAD_CLEARANCE = radius_in > 0 ? Math.max(0, radTextBottom - panelBot + 4) : 0;

  // Dim strip: always exactly 20px below max(panelBot, radTextBottom)
  const DIM_GAP   = 20;
  const aboveDims = radius_in > 0 ? Math.max(panelBot, radTextBottom) : panelBot;
  const dimY1     = aboveDims + DIM_GAP;
  const dimY2     = dimY1 + FSD + 4;

  // Bottom padding: 20px below the last dim line
  const BOT_PAD   = 20;
  const totalH    = dimY2 + FSD + BOT_PAD;
  const vb        = `0 0 ${totalW} ${totalH}`;

  // ── Background ────────────────────────────────────────────────────────────
  dap(svg, dse("rect", { x:0, y:0, width:totalW, height:totalH, fill:DT.svgBg }));

  // ── Panel name headers ────────────────────────────────────────────────────
  const makeTxt = (x, y, str, size, weight, fill, anchor, font) => {
    const t = dse("text", { x, y,
      "text-anchor": anchor || "middle", "dominant-baseline": "central",
      "font-size": (typeof size === "number" ? size+"px" : size), "font-weight": weight,
      "font-family": font || DT.FUI, fill });
    t.textContent = str; dap(svg, t); return t;
  };
  makeTxt(lidX + pLW/2, nameY, "Lid / Bottom", FST, "800", DT.panelName);
  makeTxt(aX   + pAW/2, nameY, "Side A",       FST, "800", DT.panelName);
  makeTxt(bX   + pBW/2, nameY, "Side B",       FST, "800", DT.panelName);

  // ── Panel renderer ────────────────────────────────────────────────────────
  const drawPanel = (x, y, w, h, r, fill, stroke, sub, ghost) => {
    if (ghost) dap(svg, dse("rect", { x:x+SO, y:y-SO, width:w, height:h, rx:r,
      fill, stroke, "stroke-width":1.5, opacity:0.28 }));
    dap(svg, dse("rect", { x, y, width:w, height:h, rx:r, fill, stroke:"none" }));
    const sewW = w - pSA*2, sewH = h - pSA*2;
    if (pSA > 2 && sewW > 6 && sewH > 6) {
      const sewR = Math.max(0, r - pSA);
      dap(svg, dse("rect", { x:x+pSA, y:y+pSA, width:sewW, height:sewH, rx:sewR,
        fill:"none", stroke:DT.sewStroke, "stroke-width":1.3,
        "stroke-dasharray":DT.sewDash, opacity:0.85 }));
    }
    dap(svg, dse("rect", { x, y, width:w, height:h, rx:r, fill:"none", stroke, "stroke-width":2 }));
    if (sub) makeTxt(x+w/2, y+h/2, sub, FSS, "700", DT.panelSub);
  };

  drawPanel(lidX, lidY, pLW, pLH, pR, DT.lidFill,  DT.lidStroke,  null,  false);
  drawPanel(aX,   aY,   pAW, pAH, 0,  DT.sideFill, DT.sideStroke, "x 2", true);
  drawPanel(bX,   bY,   pBW, pBH, 0,  DT.sideFill, DT.sideStroke, "x 2", true);

  // ── Radius callout ────────────────────────────────────────────────────────
  // Dot: center of the corner's defining square = (lidX+pR/2, lidY+pLH-pR/2)
  // Leader: long enough to always clear the panel outline
  if (radius_in > 0) {
    const dotX = lidX + pR / 2;
    const dotY = lidY + pLH - pR / 2;
    const lx2  = dotX + LL * 0.707;
    const ly2  = dotY + LL * 0.707;
    dap(svg, dse("circle", { cx:dotX, cy:dotY, r:3, fill:DT.radDot }));
    dap(svg, dse("line", { x1:dotX, y1:dotY, x2:lx2, y2:ly2,
      stroke:DT.radDot, "stroke-width":1, "stroke-dasharray":"3 3" }));
    const rt = dse("text", { x:lx2+4, y:ly2+2,
      "text-anchor":"start", "dominant-baseline":"hanging",
      "font-size":FSR+"px", "font-weight":"700", "font-family":DT.FUI, fill:DT.radText });
    const rk = dse("tspan", { "font-family":DT.FUI, "font-weight":"700", fill:DT.radText });
    rk.textContent = "r = ";
    const rv = dse("tspan", { "font-family":DT.FMO, "font-weight":"500", fill:DT.panelName });
    rv.textContent = diagFmt(radius_in);
    rt.appendChild(rk); rt.appendChild(rv);
    dap(svg, rt);
  }

  // ── Dimension strip ───────────────────────────────────────────────────────
  const putDim = (cx, line1, line2) => {
    const t1 = dse("text", { x:cx, y:dimY1, "text-anchor":"middle",
      "dominant-baseline":"hanging", "font-size":FSD+"px", "font-weight":"600",
      "font-family":DT.FUI, fill:DT.panelSub });
    t1.textContent = line1; dap(svg, t1);
    if (line2) {
      const t2 = dse("text", { x:cx, y:dimY2, "text-anchor":"middle",
        "dominant-baseline":"hanging", "font-size":FSD+"px", "font-weight":"600",
        "font-family":DT.FUI, fill:DT.panelSub });
      t2.textContent = line2; dap(svg, t2);
    }
  };

  putDim(lidX + pLW/2, diagFmt(lidW_in)+" L", diagFmt(lidH_in)+" W");
  if (sAcut_in) putDim(aX+pAW/2, diagFmt(sAcut_in)+" W", bagH_in?diagFmt(bagH_in)+" H":"");
  if (sBcut_in) putDim(bX+pBW/2, diagFmt(sBcut_in)+" W", bagH_in?diagFmt(bagH_in)+" H":"");

  return vb;
}

function MeasRow({ label, cut, sew, th }) {
  const numberStyle = { fontVariantNumeric:"tabular-nums", fontFeatureSettings:'"frac" 0, "numr" 0, "dnom" 0' };
  return (
    <tr style={{ borderBottom:`1px solid ${th.border}` }}>
      <td style={{ padding:"9px 6px", fontSize:16, fontWeight:700,
        color:th.label, fontFamily:"Nunito,sans-serif" }}>{label}</td>
      <td style={{ padding:"9px 6px", fontSize:18, fontWeight:500,
        color:th.accent, fontFamily:"DM Mono,monospace", textAlign:"right", whiteSpace:"nowrap", ...numberStyle }}>{cut}</td>
      <td style={{ padding:"9px 6px", fontSize:16, fontWeight:400,
        color:th.sub, fontFamily:"DM Mono,monospace", textAlign:"right",
        fontStyle:"italic", whiteSpace:"nowrap", ...numberStyle }}>{sew ? `Sewline: ${sew}` : ""}</td>
    </tr>
  );
}

function MeasSection({ title, rows, th }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:15, fontWeight:800, letterSpacing:"0.05em", textTransform:"uppercase",
        color:th.hdr, background:th.sec, padding:"7px 12px", borderRadius:7,
        marginBottom:10, display:"inline-block", fontFamily:"Nunito,sans-serif" }}>
        {title}
      </div>
      <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed" }}>
        <colgroup>
          <col style={{width:"46%"}} />
          <col style={{width:"24%"}} />
          <col style={{width:"30%"}} />
        </colgroup>
        <tbody>
          {rows.map((r,i) => <MeasRow key={i} label={r.label} cut={r.cut} sew={r.sew} th={th} />)}
        </tbody>
      </table>
    </div>
  );
}

function PanelDiagram({ mode, lidL, lidW, rC, sa, sAc, sBc, pH, sLid_Lc, sLid_Wc, s2A, s2B, s2r, lidP, sidesP, delta, sLP }) {
  const th = T.purple;
  const svgRef = useRef(null);
  const [vb, setVb] = useState("0 0 400 120");
  const isLidMode = mode === "lid";
  const lidW_in   = isLidMode ? lidL    : sLid_Lc;
  const lidH_in   = isLidMode ? lidW    : sLid_Wc;
  const bagH_in   = pH;
  const sideBW_in = isLidMode ? lidW    : s2B;
  const radius_in = isLidMode ? rC      : s2r;
  const sa_in     = sa;
  const sAcut_in  = isLidMode ? sAc     : s2A;
  const sBcut_in  = isLidMode ? sBc     : s2B;
  const hasHeight = bagH_in > 0;
  const hasDims   = lidW_in > 0 && lidH_in > 0 && sideBW_in > 0;

  useEffect(() => {
    if (!svgRef.current) return;
    const viewBox = buildDiagramSVG(svgRef.current, lidW_in, lidH_in, bagH_in, sideBW_in, radius_in, sa_in, sAcut_in, sBcut_in);
    setVb(viewBox);
  }, [lidW_in, lidH_in, bagH_in, sideBW_in, radius_in, sa_in]);

  // Perimeter calcs for measurement table
  const lidCutP  = isLidMode ? roundRectPerim(lidL, lidW, rC) : roundRectPerim(sLid_Lc, sLid_Wc, s2r);
  const lidSewP  = isLidMode ? lidP : sLP;
  const sACutP   = 2*(sAcut_in + (hasHeight ? bagH_in : 0));
  const sASewP   = 2*(Math.max(0,sAcut_in-2*sa_in) + (hasHeight ? Math.max(0,bagH_in-2*sa_in) : 0));
  const sBCutP   = 2*(sBcut_in + (hasHeight ? bagH_in : 0));
  const sBSewP   = 2*(Math.max(0,sBcut_in-2*sa_in) + (hasHeight ? Math.max(0,bagH_in-2*sa_in) : 0));

  // Fix: in sides mode, sidesP should use the entered side dimensions, not the auto-split values
  const sidesP_check = isLidMode ? sidesP : 2*(Math.max(0,sAcut_in-2*sa_in) + Math.max(0,sBcut_in-2*sa_in));
  const delta_check  = (isLidMode ? lidP : sLP) - sidesP_check;

  const warns = [];
  if (!hasDims) warns.push("Enter dimensions above to see the diagram.");
  else {
    const dims = [lidW_in, lidH_in, sideBW_in];
    if (hasHeight) dims.push(bagH_in);
    const mx = Math.max(...dims), mn = Math.min(...dims);
    if (mn > 0 && mx/mn > 15) warns.push("Extreme proportions — diagram is approximate.");
    if (radius_in > Math.min(lidW_in, lidH_in)/2) warns.push("Radius clamped to fit panel.");
  }

  const sl = (v) => sa_in > 0 ? diagFmt(Math.max(0, v - 2*sa_in)) : null;
  const sewRad = (r) => diagFmt(Math.max(0, r - sa_in));

  const measSections = [
    {
      title: isLidMode ? "Lid / Bottom" : "Lid / Bottom (derived)",
      rows: [
        { label:"Length — cut",  cut:diagFmt(lidW_in),   sew:sl(lidW_in)   },
        { label:"Width — cut",   cut:diagFmt(lidH_in),   sew:sl(lidH_in)   },
        { label:"Corner radius", cut:diagFmt(radius_in), sew: sa_in > 0 && radius_in > 0 ? sewRad(radius_in) : null },
        { label:"Cut perimeter", cut:diagFmt(lidCutP),   sew:diagFmt(lidSewP) },
      ],
    },
    {
      title:"Side A — Cut 2",
      rows: [
        { label:"Width — cut",   cut:diagFmt(sAcut_in),                        sew:sl(sAcut_in) },
        { label:"Height — cut",  cut:hasHeight?diagFmt(bagH_in):"add height",  sew:hasHeight?sl(bagH_in):null },
        { label:"Cut perimeter", cut:hasHeight?diagFmt(sACutP):"—",            sew:hasHeight?diagFmt(sASewP):null },
      ],
    },
    {
      title:"Side B — Cut 2",
      rows: [
        { label:"Width — cut",   cut:diagFmt(sBcut_in),                        sew:sl(sBcut_in) },
        { label:"Height — cut",  cut:hasHeight?diagFmt(bagH_in):"add height",  sew:hasHeight?sl(bagH_in):null },
        { label:"Cut perimeter", cut:hasHeight?diagFmt(sBCutP):"—",            sew:hasHeight?diagFmt(sBSewP):null },
      ],
    },
  ];

  // Delta check
  const perimToCheck = isLidMode ? lidP : sLP;
  const deltaOk = Math.abs(delta_check) < 0.07;
  const deltaLabel = isLidMode
    ? "✓ Perfect match"
    : "✓ Perimeters compatible";

  return (
    <div style={{ background:th.card, border:`1.5px solid ${th.border}`,
      borderRadius:14, overflow:"hidden", marginTop:4,
      boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>

      {/* Warnings */}
      {warns.length > 0 && (
        <div style={{ background:DT.warnBg, borderBottom:`1.5px solid ${DT.warnBdr}`,
          color:DT.warnTxt, fontSize:13, fontWeight:700,
          padding:"8px 16px", fontFamily:"Nunito,sans-serif" }}>
          {warns.join("  ·  ")}
        </div>
      )}
      {!hasHeight && hasDims && (
        <div style={{ background:th.info, borderBottom:`1px solid ${th.infoBdr}`,
          color:th.infoTxt, fontSize:13, fontWeight:600,
          padding:"8px 16px", fontFamily:"Nunito,sans-serif", fontStyle:"italic" }}>
          Add bag height below to complete the diagram and perimeter totals.
        </div>
      )}

      {/* SVG */}
      <div style={{ background:"#fff" }}>
        <svg ref={svgRef} viewBox={vb} style={{ display:"block", width:"100%" }} />
      </div>

      {/* Measurement table */}
      <div style={{ borderTop:`1.5px solid ${th.border}`, padding:"20px 20px 16px" }}>
        <div style={{ fontSize:13, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase",
          color:th.sub, marginBottom:16, fontFamily:"Nunito,sans-serif" }}>
          Cut Measurements
        </div>
        {measSections.map((sec,i) => (
          <MeasSection key={i} title={sec.title} rows={sec.rows} th={th} />
        ))}
      </div>

      {/* Delta / perimeter match check */}
      {hasDims && (
        <div style={{ margin:"0 20px 20px",
          background: deltaOk ? th.ok : th.warn,
          border:`1.5px solid ${deltaOk ? th.okBdr : th.warnBdr}`,
          borderRadius:8, padding:"11px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline",
            padding:"5px 0", borderBottom:`1px solid ${deltaOk?th.okBdr:th.warnBdr}` }}>
            <div style={{ fontSize:14, fontWeight:700, color:deltaOk?th.okTxt:th.warnTxt, fontFamily:"Nunito,sans-serif" }}>Lid/Bottom sewline perimeter</div>
            <div style={{ fontSize:17, fontFamily:"DM Mono,monospace", fontWeight:500, color:deltaOk?th.okTxt:th.warnTxt }}>{diagFmt(perimToCheck)}</div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline",
            padding:"5px 0", borderBottom:`1px solid ${deltaOk?th.okBdr:th.warnBdr}` }}>
            <div style={{ fontSize:14, fontWeight:700, color:deltaOk?th.okTxt:th.warnTxt, fontFamily:"Nunito,sans-serif" }}>Sides sewline perimeter</div>
            <div style={{ fontSize:17, fontFamily:"DM Mono,monospace", fontWeight:500, color:deltaOk?th.okTxt:th.warnTxt }}>{diagFmt(sidesP_check)}</div>
          </div>
          <div style={{ textAlign:"center", marginTop:8, fontSize:14, fontWeight:800,
            color:deltaOk?th.okTxt:th.warnTxt, fontFamily:"Nunito,sans-serif" }}>
            {deltaOk
              ? (isLidMode ? "✓ Perfect match" : "✓ Perimeters compatible")
              : `Delta ${delta_check>0?"+":"-"}${diagFmt(Math.abs(smartRound(delta_check)))} — ease across the 4 corner seams when sewing`}
          </div>
          {!isLidMode && (
            <div style={{ textAlign:"center", marginTop:6, fontSize:12, fontWeight:600,
              color:deltaOk?th.okTxt:th.warnTxt, fontFamily:"Nunito,sans-serif", fontStyle:"italic" }}>
              Perimeter check — any small gap can be eased across the 4 corner seams.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 1 — LID / BOTTOM
// ══════════════════════════════════════════════════════════════════════════════
function LidPage() {
  const th=T.purple;
  const [sa,setSa]=useState(DEFAULT_SA); const [cSa,setCsa]=useState("");
  const [mode,setMode]=useState("lid");
  const [lLW,setLLW]=useState(0); const [lLF,setLLF]=useState(0);
  const [lWW,setLWW]=useState(0); const [lWF,setLWF]=useState(0);
  const [rCW,setRCW]=useState(0); const [rCF,setRCF]=useState(0);
  const [nudgeA,setNudgeA]=useState(0);
  const [sAW,setSAW]=useState(0); const [sAF,setSAF]=useState(0);
  const [sBW,setSBW]=useState(0); const [sBF,setSBF]=useState(0);
  const [srW,setSrW]=useState(0); const [srF,setSrF]=useState(0);
  const [phW,setPhW]=useState(0); const [phF,setPhF]=useState(0);

  const lidL=lLW+lLF, lidW=lWW+lWF, rC=rCW+rCF;
  const Ls=Math.max(0,lidL-2*sa), Ws=Math.max(0,lidW-2*sa), Rs=Math.max(0,rC-sa);
  const lidP=roundRectPerim(Ls,Ws,Rs);
  const {sideA_fin:autoA,sideB_fin:autoB}=arcMidSplit(Ls,Ws,Rs);
  const sAf=smartRound(autoA+nudgeA), sBf=smartRound(autoB-nudgeA);
  const sAc=sAf+2*sa, sBc=sBf+2*sa;
  const sidesP=2*(sAf+sBf), delta=lidP-sidesP;

  const s2A=sAW+sAF, s2B=sBW+sBF, s2r=srW+srF;
  const s2Af=Math.max(0,s2A-2*sa), s2Bf=Math.max(0,s2B-2*sa), s2Rs=Math.max(0,s2r-sa);

  // In Sides → Lid/Bottom mode, the entered side panel sewline widths already
  // include their half-corner arc shares. Remove that arc share to recover the
  // straight portions of the rounded rectangle, then add 2R back to get the
  // true finished lid dimensions. This keeps lid perimeter and side perimeter
  // aligned instead of double-counting the corner arcs.
  const sCornerShare = s2Rs > 0 ? (PI * s2Rs) / 2 : 0;
  const sStraightA = Math.max(0, s2Af - sCornerShare);
  const sStraightB = Math.max(0, s2Bf - sCornerShare);
  const sLid_Ls = sStraightA + 2*s2Rs;
  const sLid_Ws = sStraightB + 2*s2Rs;
  const sLid_Lc=sLid_Ls+2*sa, sLid_Wc=sLid_Ws+2*sa;
  const sLP=roundRectPerim(sLid_Ls,sLid_Ws,s2Rs);
  const pH=phW+phF;

  const nudgeAmount = isMetric() ? mmToIn(5) : 0.125;

  // Finished bag dimensions — based on lid sewline (the true footprint)
  const finL = mode==="lid" ? Ls : sLid_Ls;
  const finW = mode==="lid" ? Ws : sLid_Ws;
  const finH = Math.max(0, pH - 2*sa);
  const minPracticalSideCut = 2 * sa;
  const sidePanelTooNarrow = mode === "lid" && (
    (sAc > 0 && sAc <= minPracticalSideCut) ||
    (sBc > 0 && sBc <= minPracticalSideCut)
  );

  return (
    <div style={{ minHeight:"100vh", padding:"16px 16px 48px" }}>
      <SABar th={th} sa={sa} setSa={setSa} cSa={cSa} setCsa={setCsa} />
      <div style={{ background:th.sec, borderRadius:14, boxShadow:"0 4px 18px rgba(90,45,160,0.12)" }}>
        <SecHeader th={th} title="Lid & Bottom Panels"
          sub="A 4-sided panel (your bag's bottom or lid) with square or rounded corners, plus the 4 matching side panels that assemble around it. The corner radius applies to the bottom/lid only — side panels are always plain rectangles." />
        <div style={{ padding:"16px 16px 20px" }}>

          {/* Tab switcher + caption */}
          <SubTabs th={th} active={mode} set={v=>{setMode(v);setNudgeA(0);}}
            tabs={[{id:"lid",label:"Lid/Bottom → Sides"},{id:"sides",label:"Sides → Lid/Bottom"}]} />
          <div style={{ fontSize:14, fontWeight:600, color:th.sub, fontFamily:"Nunito,sans-serif",
            fontStyle:"italic", marginBottom:14, marginTop:-6, lineHeight:1.4 }}>
            {mode==="lid"
              ? "Know your Lid/Bottom size? Start here — corner radius determines your side panel lengths."
              : "Know your side lengths? Start here — we'll calculate the Lid/Bottom to match."}
          </div>

          {/* ── Lid → Sides inputs ── */}
          {mode==="lid" && (
            <Card th={th}>
              <CardTitle th={th}>Lid / Bottom — Cut Dimensions</CardTitle>
              <InfoBox th={th}>Enter the cut (pre-sewn) size of your lid or bottom panel. Sewline dimensions are derived by subtracting the seam allowance.</InfoBox>
              <div style={{marginTop:14}}>
                <div className="frac-row">
                  <FracInput th={th} label="Length (cut)" whole={lLW} frac={lLF} onWhole={setLLW} onFrac={setLLF} />
                  <FracInput th={th} label="Width (cut)" whole={lWW} frac={lWF} onWhole={setLWW} onFrac={setLWF} />
                </div>
              </div>
              <Divider th={th} />
              <div style={{ fontSize:13, fontWeight:800, color:th.sub, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6, fontFamily:"Nunito,sans-serif" }}>Corner Radius (lid & bottom)</div>
              {lidL > 0 && lidW > 0 && (
                <div style={{ fontSize:13, fontWeight:600, color:th.accent, fontFamily:"Nunito,sans-serif",
                  fontStyle:"italic", marginBottom:10 }}>
                  Max radius for these dimensions: {fmtInch(smartRound(Math.min(Ls, Ws) / 2))}
                </div>
              )}
              <FracInput th={th} label="Radius at cut edge" sub="— 0 for square corners" whole={rCW} frac={rCF} onWhole={setRCW} onFrac={setRCF} />
              <Divider th={th} />
              <CardTitle th={th}>Side Panels</CardTitle>
              <InfoBox th={th}>4 panels total: 2 pairs of matching rectangles (Sides A and Sides B). Seams default to the midpoint of the lid/bottom corners. Nudge either pair by {fmtInch(nudgeAmount)} — the other pair updates automatically to maintain the correct perimeter.</InfoBox>
              <div style={{marginTop:14}}>
                {[["Side A — Cut 2",sAc,sAf,1],["Side B — Cut 2",sBc,sBf,-1]].map(([lbl,cut,fin,dir])=>(
                  <div key={lbl} style={{marginBottom:14}}>
                    <div style={{ fontSize:14, fontWeight:800, color:th.label, marginBottom:6, fontFamily:"Nunito,sans-serif" }}>{lbl}</div>
                    <div style={{ display:"flex", gap:10, alignItems:"stretch" }}>
                      <div style={{ flex:4, background:th.resBg, border:`2px solid ${th.border}`, borderRadius:8, padding:"10px 14px", textAlign:"center" }}>
                        <div style={{ fontSize:12, fontWeight:900, color:th.label, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2, fontFamily:"Nunito,sans-serif" }}>Cut</div>
                        <div style={{ fontSize:28, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.resAccent }}>{fmtInch(cut)}</div>
                        <div style={{ fontSize:13, color:th.sub, marginTop:2, fontFamily:"Nunito,sans-serif" }}>finished {fmtInch(fin)}</div>
                      </div>
                      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
                        <Nudge th={th} label={`+${fmtInch(nudgeAmount)}`} onClick={()=>setNudgeA(n=>roundTo8th(n+nudgeAmount*dir))} />
                        <Nudge th={th} label={`-${fmtInch(nudgeAmount)}`} onClick={()=>setNudgeA(n=>roundTo8th(n-nudgeAmount*dir))} />
                      </div>
                    </div>
                  </div>
                ))}
                {nudgeA!==0 && <button onClick={()=>setNudgeA(0)} style={{
                  fontSize:13, fontWeight:800, letterSpacing:"0.07em", textTransform:"uppercase",
                  background:th.btnOff, border:`1.5px solid ${th.border}`, borderRadius:6,
                  padding:"6px 14px", cursor:"pointer", color:th.btnOffTxt, marginBottom:12, fontFamily:"Nunito,sans-serif"
                }}>Reset to auto</button>}
                <InfoBox th={th}>
                  <strong>Nudge note:</strong> The default split places the side-panel seam at the midpoint of each rounded corner. Nudging shifts that seam location while keeping the total perimeter matched. Minimum practical cut width: keep each side panel greater than <strong>{fmtInch(minPracticalSideCut)}</strong> ({fmtInch(sa)} × 2 seam allowances).
                </InfoBox>
                {sidePanelTooNarrow && (
                  <NoteBox>
                    One side panel is at or below 2 × seam allowance. Increase that side or reset to auto so there is usable finished width after sewing.
                  </NoteBox>
                )}
                {sAc > 0 && sBc > 0 && Math.abs(sAc - sBc) < 0.01 && (
                  <div style={{background:th.info, border:`1.5px solid ${th.infoBdr}`, borderRadius:8,
                    padding:"10px 13px", marginTop:8, marginBottom:12, fontSize:14, fontWeight:600,
                    color:th.infoTxt, fontFamily:"Nunito,sans-serif", lineHeight:1.5}}>
                    ✓ Sides A and B are the same size — you can cut all 4 panels from one template.
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* ── Sides → Lid inputs ── */}
          {mode==="sides" && <>
            <Card th={th}>
              <CardTitle th={th}>Side Panels — Enter Cut Dimensions</CardTitle>
              <InfoBox th={th}>Enter your cut side panel lengths and the Lid/Bottom corner radius. The required Lid/Bottom cut dimensions will be calculated to match.</InfoBox>
              <div style={{marginTop:14}}>
                <div className="frac-row">
                  <FracInput th={th} label="Side A — width (cut)" whole={sAW} frac={sAF} onWhole={setSAW} onFrac={setSAF} />
                  <FracInput th={th} label="Side B — width (cut)" whole={sBW} frac={sBF} onWhole={setSBW} onFrac={setSBF} />
                </div>
              </div>
              <Divider th={th} />
              <div style={{ fontSize:13, fontWeight:800, color:th.sub, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6, fontFamily:"Nunito,sans-serif" }}>Corner Radius (lid & bottom)</div>
              {s2A > 0 && s2B > 0 && (
                <div style={{ fontSize:13, fontWeight:600, color:th.accent, fontFamily:"Nunito,sans-serif",
                  fontStyle:"italic", marginBottom:10 }}>
                  Max radius for derived Lid/Bottom: {fmtInch(smartRound(Math.min(sLid_Ls, sLid_Ws) / 2))}
                </div>
              )}
              <FracInput th={th} label="Radius at cut edge" sub="— 0 for square corners" whole={srW} frac={srF} onWhole={setSrW} onFrac={setSrF} />
            </Card>
          </>}

          {/* ── Bag Height — optional, outside tabs ── */}
          <div style={{ background:th.card, border:`1.5px dashed ${th.border}`, borderRadius:10,
            padding:"14px 16px", marginBottom:12, marginTop:4 }}>
            <div style={{ fontSize:13, fontWeight:900, letterSpacing:"0.09em", textTransform:"uppercase",
              color:th.sub, marginBottom:4, fontFamily:"Nunito,sans-serif" }}>
              Bag Height
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:th.sub, fontFamily:"Nunito,sans-serif",
              fontStyle:"italic", marginBottom:12 }}>
              Optional — add for diagram, perimeter totals, and finished size.
            </div>
            <FracInput th={th} label="Side panel height — cut" whole={phW} frac={phF} onWhole={setPhW} onFrac={setPhF} />
            {pH > 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline",
                marginTop:4, padding:"6px 10px", background:th.resBg, borderRadius:6 }}>
                <div style={{ fontSize:14, fontWeight:700, color:th.label, fontFamily:"Nunito,sans-serif" }}>
                  Finished height
                </div>
                <div style={{ fontSize:16, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.resAccent }}>
                  {fmtInch(finH)}
                  <span style={{ fontSize:12, fontWeight:600, color:th.sub, fontFamily:"Nunito,sans-serif",
                    marginLeft:6, fontStyle:"italic" }}>
                    (after {fmtInch(sa)} SA top & bottom)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Diagram + measurements + delta ── */}
          <PanelDiagram
            mode={mode}
            lidL={lidL} lidW={lidW} rC={rC} sa={sa}
            sAc={sAc} sBc={sBc} pH={pH}
            sLid_Lc={sLid_Lc} sLid_Wc={sLid_Wc}
            s2A={s2A} s2B={s2B} s2r={s2r}
            lidP={lidP} sidesP={sidesP} delta={delta} sLP={sLP}
          />

          {/* ── Finished Bag Size — very bottom ── */}
          <div style={{ background:"#2a1860", borderRadius:10, padding:"16px 18px", marginTop:12 }}>
            <div style={{ fontSize:13, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase",
              color:"#b8a8e8", marginBottom:10, fontFamily:"Nunito,sans-serif" }}>
              Finished Bag Size
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline",
              padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#b8a8e8", fontFamily:"Nunito,sans-serif" }}>Length</div>
              <div style={{ fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500, color: finL>0?"#e8e0ff":"rgba(255,255,255,0.25)" }}>
                {finL>0 ? fmtInch(finL) : "—"}
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline",
              padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#b8a8e8", fontFamily:"Nunito,sans-serif" }}>Width</div>
              <div style={{ fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500, color: finW>0?"#e8e0ff":"rgba(255,255,255,0.25)" }}>
                {finW>0 ? fmtInch(finW) : "—"}
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline",
              padding:"6px 0" }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#b8a8e8", fontFamily:"Nunito,sans-serif" }}>Height</div>
              <div style={{ fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500,
                color: pH>0 ? "#e8e0ff" : "rgba(255,255,255,0.25)" }}>
                {pH>0 ? fmtInch(finH) : "add height above"}
              </div>
            </div>
            <div style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.35)",
              fontFamily:"Nunito,sans-serif", fontStyle:"italic", marginTop:10, lineHeight:1.4 }}>
              Estimated. Assumes SA taken at top edge to finish the bag opening.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 2 — GUSSET
// ══════════════════════════════════════════════════════════════════════════════

// ── Gusset SVG Diagram ────────────────────────────────────────────────────────
function GussetDiagram({ mode, panelW, panelH, cornerR, gussetCutW, gussetLen, sa }) {
  const th = T.green;
  if (!panelW || !panelH) return null;

  const SVG_W = 640;
  const PANEL_MAX_W = 300;
  const PANEL_MAX_H = 220;
  const PANEL_TOP = 64;
  const STRIP_GAP = 78;
  const STRIP_MIN_H = 14;
  const STRIP_MAX_H = 64;

  const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
  const isThreeSided = mode === "three";

  const S = Math.min(PANEL_MAX_W / panelW, PANEL_MAX_H / panelH, 16);
  const pW = panelW * S;
  const pH = panelH * S;
  const pR = clamp(cornerR * S, 0, Math.min(pW / 2, pH / 2));
  const saP = clamp(sa * S, 0, Math.max(0, Math.min(pW / 2 - 1, pH / 2 - 1)));
  const gW = gussetCutW > 0
    ? clamp(gussetCutW * S, STRIP_MIN_H, STRIP_MAX_H)
    : STRIP_MIN_H;

  const panelX = (SVG_W - pW) / 2;
  const panelY = PANEL_TOP;
  const panelBottom = panelY + pH;

  const stripY = panelBottom + STRIP_GAP;
  const stripLabelY = stripY + gW + 36;
  const SVG_H = stripLabelY + 24;

  const C = {
    fill: "#c8e8d4",
    gussetFill: "#a9dbbb",
    line: th.accent || "#1a6e3a",
    dark: "#165c30",
    text: th.label || "#165c30",
    softText: th.sub || "#3a9e60",
    callout: "#3cab64",
    bg: "#ffffff",
    fade: "#e7f6ed",
  };

  const arrowId = `gDiagramArrow-${mode}-${Math.round(panelW * 64)}-${Math.round(panelH * 64)}-${Math.round(cornerR * 64)}`;
  const fadeLeftId = `gFadeLeft-${mode}-${Math.round(panelW * 32)}-${Math.round(panelH * 32)}`;
  const fadeRightId = `gFadeRight-${mode}-${Math.round(panelW * 32)}-${Math.round(panelH * 32)}`;

  function bottomRoundedPanelPath(x, y, w, h, r) {
    if (r <= 0.01) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    return `
      M ${x} ${y}
      H ${x + w}
      V ${y + h - r}
      A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}
      H ${x + r}
      A ${r} ${r} 0 0 1 ${x} ${y + h - r}
      V ${y}
      Z
    `;
  }

  function roundedPanelPath(x, y, w, h, r) {
    if (r <= 0.01) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    return `
      M ${x + r} ${y}
      H ${x + w - r}
      A ${r} ${r} 0 0 1 ${x + w} ${y + r}
      V ${y + h - r}
      A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}
      H ${x + r}
      A ${r} ${r} 0 0 1 ${x} ${y + h - r}
      V ${y + r}
      A ${r} ${r} 0 0 1 ${x + r} ${y}
      Z
    `;
  }

  function threeSideSewPath(x, y, w, h, r, inset) {
    const left = x + inset;
    const right = x + w - inset;
    const bottom = y + h - inset;

    if (r <= inset + 0.01) {
      return `
        M ${left} ${y}
        V ${bottom}
        H ${right}
        V ${y}
      `;
    }

    const rr = r - inset;
    const cornerCenterY = y + h - r;

    return `
      M ${left} ${y}
      V ${cornerCenterY}
      A ${rr} ${rr} 0 0 0 ${x + r} ${bottom}
      H ${x + w - r}
      A ${rr} ${rr} 0 0 0 ${right} ${cornerCenterY}
      V ${y}
    `;
  }

  function fourSideSewPath(x, y, w, h, r, inset) {
    const left = x + inset;
    const right = x + w - inset;
    const top = y + inset;
    const bottom = y + h - inset;

    if (r <= inset + 0.01) {
      return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`;
    }

    const rr = r - inset;

    return `
      M ${x + r} ${top}
      H ${x + w - r}
      A ${rr} ${rr} 0 0 1 ${right} ${y + r}
      V ${y + h - r}
      A ${rr} ${rr} 0 0 1 ${x + w - r} ${bottom}
      H ${x + r}
      A ${rr} ${rr} 0 0 1 ${left} ${y + h - r}
      V ${y + r}
      A ${rr} ${rr} 0 0 1 ${x + r} ${top}
      Z
    `;
  }

  const panelPath = isThreeSided
    ? bottomRoundedPanelPath(panelX, panelY, pW, pH, pR)
    : roundedPanelPath(panelX, panelY, pW, pH, pR);

  const sewPath = isThreeSided
    ? threeSideSewPath(panelX, panelY, pW, pH, pR, saP)
    : fourSideSewPath(panelX, panelY, pW, pH, pR, saP);

  const widthY = panelY - 34;
  const heightX = panelX + pW + 46;

  const calloutTextX = Math.max(22, panelX - 150);
  const calloutTextY = panelY + pH * 0.33;
  const calloutTargetX = panelX + saP;
  const calloutTargetY = panelY + (isThreeSided ? pH * 0.52 : pH * 0.35);
  const calloutElbowX = panelX - 24;
  const calloutElbowY = calloutTargetY;
  const calloutLabel = isThreeSided ? "(3 Sides)" : "(4 Sides)";
  const notchLabelY = panelBottom + 31;

  const notchTicks = (() => {
    if (pR <= 8) return [];
    const notchCount = cornerR <= 1 ? 3 : 5;
    const insideInset = Math.min(Math.max(1.2, pR * 0.12), Math.max(1.2, saP - 2));
    const outsideExt = Math.max(7, Math.min(10, pR * 0.26));
    const distribute = (startDeg, endDeg, count) => {
      if (count === 1) return [(startDeg + endDeg) / 2];
      const step = (endDeg - startDeg) / (count - 1);
      return Array.from({ length: count }, (_, i) => startDeg + step * i);
    };
    const makeCornerTicks = (cx, cy, startDeg, endDeg) => {
      const angles = distribute(startDeg, endDeg, notchCount).map((d) => d * PI / 180);
      return angles.map((theta) => ({
        x1: cx + Math.cos(theta) * (pR - insideInset),
        y1: cy + Math.sin(theta) * (pR - insideInset),
        x2: cx + Math.cos(theta) * (pR + outsideExt),
        y2: cy + Math.sin(theta) * (pR + outsideExt),
      }));
    };

    const ticks = [
      ...makeCornerTicks(panelX + pR, panelY + pH - pR, 180, 90),           // bottom-left
      ...makeCornerTicks(panelX + pW - pR, panelY + pH - pR, 90, 0),        // bottom-right
    ];

    if (!isThreeSided) {
      ticks.push(
        ...makeCornerTicks(panelX + pR, panelY + pR, 180, 270),             // top-left
        ...makeCornerTicks(panelX + pW - pR, panelY + pR, 270, 360),        // top-right
      );
    }

    return ticks;
  })();

  const stripPieceW = 132;
  const breakGap = 72;
  const stripTotalW = stripPieceW * 2 + breakGap;
  const stripX = (SVG_W - stripTotalW) / 2;
  const stripMidY = stripY + gW / 2;
  const leftStripX = stripX;
  const rightStripX = stripX + stripPieceW + breakGap;
  const breakLeftX = stripX + stripPieceW;
  const breakRightX = rightStripX;
  const breakOvershoot = 10;
  const breakTop = stripY - breakOvershoot;
  const breakBottom = stripY + gW + breakOvershoot;
  const breakMidY = (breakTop + breakBottom) / 2;
  const fadeW = 20;

  const breakLeftPath = `
    M ${breakLeftX + 2} ${breakTop}
    C ${breakLeftX + 12} ${breakTop + (breakBottom - breakTop) * 0.20}, ${breakLeftX + 22} ${breakTop + (breakBottom - breakTop) * 0.34}, ${breakLeftX + 30} ${breakMidY}
    C ${breakLeftX + 39} ${breakTop + (breakBottom - breakTop) * 0.68}, ${breakLeftX + 46} ${breakTop + (breakBottom - breakTop) * 0.82}, ${breakLeftX + 54} ${breakBottom}
  `;
  const breakRightPath = `
    M ${breakRightX - 54} ${breakTop}
    C ${breakRightX - 44} ${breakTop + (breakBottom - breakTop) * 0.20}, ${breakRightX - 34} ${breakTop + (breakBottom - breakTop) * 0.34}, ${breakRightX - 26} ${breakMidY}
    C ${breakRightX - 17} ${breakTop + (breakBottom - breakTop) * 0.68}, ${breakRightX - 10} ${breakTop + (breakBottom - breakTop) * 0.82}, ${breakRightX - 2} ${breakBottom}
  `;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ width:"100%", height:"auto", display:"block" }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Panel and gusset diagram"
    >
      <defs>
        <marker
          id={arrowId}
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto-start-reverse"
        >
          <path
            d="M 1.25 1.25 L 6.75 4 L 1.25 6.75"
            fill="none"
            stroke={C.line}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
        <linearGradient id={fadeLeftId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor={C.fade} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={fadeRightId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={C.fade} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={SVG_W} height={SVG_H} fill={C.bg} />

      <path d={panelPath} fill={C.fill} stroke="none" />
      <path
        d={panelPath}
        fill="none"
        stroke={C.line}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {saP > 2 && (
        <path
          d={sewPath}
          fill="none"
          stroke={C.dark}
          strokeWidth="1.45"
          strokeDasharray="6 5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.78"
        />
      )}

      {saP > 2 && (
        <>
          <path
            d={`M ${calloutTextX + 118} ${calloutTextY + 10} H ${calloutElbowX} L ${calloutTargetX} ${calloutTargetY}`}
            fill="none"
            stroke={C.callout}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={calloutTargetX} cy={calloutTargetY} r="2.8" fill={C.callout} />
          <text
            x={calloutTextX}
            y={calloutTextY}
            textAnchor="start"
            fontSize="13"
            fontWeight="800"
            fontFamily="Nunito,sans-serif"
            fill={C.callout}
          >
            <tspan x={calloutTextX} dy="0">Gusset Placement</tspan>
            <tspan x={calloutTextX} dy="15">{calloutLabel}</tspan>
          </text>
        </>
      )}

      {notchTicks.length > 0 && (
        <>
          {notchTicks.map((n, i) => (
            <g key={i}>
              <line
                x1={n.x1}
                y1={n.y1}
                x2={n.x2}
                y2={n.y2}
                stroke="#ffffff"
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.96"
              />
              <line
                x1={n.x1}
                y1={n.y1}
                x2={n.x2}
                y2={n.y2}
                stroke={C.callout}
                strokeWidth="1.55"
                strokeLinecap="round"
                opacity="0.72"
              />
            </g>
          ))}
          <text
            x={SVG_W / 2}
            y={notchLabelY}
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            fontFamily="Nunito,sans-serif"
            fill={C.callout}
            opacity="0.78"
          >
            Clip/notch for easing in curves
          </text>
        </>
      )}

      <line
        x1={panelX}
        y1={widthY}
        x2={panelX + pW}
        y2={widthY}
        stroke={C.line}
        strokeWidth="1.35"
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
      />
      <text
        x={panelX + pW / 2}
        y={widthY - 11}
        textAnchor="middle"
        fontSize="15"
        fontWeight="800"
        fontFamily="DM Mono,monospace"
        fill={C.text}
      >
        {fmtInch(panelW)} W
      </text>

      {isThreeSided && (
        <text
          x={panelX + pW / 2}
          y={panelY - 12}
          textAnchor="middle"
          fontSize="13"
          fontWeight="800"
          fontFamily="Nunito,sans-serif"
          fill={C.softText}
          letterSpacing="0.12em"
        >
          open top
        </text>
      )}

      <line
        x1={heightX}
        y1={panelY}
        x2={heightX}
        y2={panelY + pH}
        stroke={C.line}
        strokeWidth="1.35"
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
      />
      <text
        x={heightX + 18}
        y={panelY + pH / 2}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize="15"
        fontWeight="800"
        fontFamily="DM Mono,monospace"
        fill={C.text}
      >
        {fmtInch(panelH)} H
      </text>

      {/* Gusset strip with subtle continuation fade */}
      <rect x={leftStripX} y={stripY} width={stripPieceW} height={gW} fill={C.gussetFill} stroke="none" />
      <rect x={rightStripX} y={stripY} width={stripPieceW} height={gW} fill={C.gussetFill} stroke="none" />
      <rect x={leftStripX + stripPieceW - fadeW} y={stripY} width={fadeW} height={gW} fill={`url(#${fadeLeftId})`} />
      <rect x={rightStripX} y={stripY} width={fadeW} height={gW} fill={`url(#${fadeRightId})`} />

      {/* Outer strip outlines only — no dark interior end-caps */}
      <path d={`M ${leftStripX} ${stripY} H ${leftStripX + stripPieceW} M ${leftStripX} ${stripY + gW} H ${leftStripX + stripPieceW} M ${leftStripX} ${stripY} V ${stripY + gW}`} fill="none" stroke={C.line} strokeWidth="2" strokeLinecap="round" />
      <path d={`M ${rightStripX} ${stripY} H ${rightStripX + stripPieceW} M ${rightStripX} ${stripY + gW} H ${rightStripX + stripPieceW} M ${rightStripX + stripPieceW} ${stripY} V ${stripY + gW}`} fill="none" stroke={C.line} strokeWidth="2" strokeLinecap="round" />

      <path d={breakLeftPath} fill="none" stroke={C.callout} strokeWidth="3.2" strokeLinecap="round" />
      <path d={breakRightPath} fill="none" stroke={C.callout} strokeWidth="3.2" strokeLinecap="round" />

      {gussetCutW > 0 && (
        <>
          <line
            x1={stripX - 30}
            y1={stripY}
            x2={stripX - 30}
            y2={stripY + gW}
            stroke={C.line}
            strokeWidth="1.35"
            markerStart={`url(#${arrowId})`}
            markerEnd={`url(#${arrowId})`}
          />
          <text
            x={stripX - 42}
            y={stripMidY}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="15"
            fontWeight="800"
            fontFamily="DM Mono,monospace"
            fill={C.text}
          >
            {fmtInch(gussetCutW)} W
          </text>
        </>
      )}

      <text
        x={SVG_W / 2}
        y={stripLabelY}
        textAnchor="middle"
        fontSize="16"
        fontWeight="800"
        fontFamily="Nunito,sans-serif"
        fill={C.softText}
      >
        {gussetLen > 0
          ? `Strip cut length: ${fmtInch(gussetLen)}`
          : "Enter gusset width to see strip dimensions"}
      </text>
    </svg>
  );
}

function RoundOvalGussetDiagram({ shape, panelW, panelH, gussetCutW, gussetLen, sa }) {
  const th = T.green;
  if (!panelW || !panelH) return null;

  const SVG_W = 640;
  const PANEL_MAX_W = 300;
  const PANEL_MAX_H = 220;
  const PANEL_TOP = 62;
  const STRIP_GAP = 78;
  const STRIP_MIN_H = 14;
  const STRIP_MAX_H = 64;

  const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
  const S = Math.min(PANEL_MAX_W / panelW, PANEL_MAX_H / panelH, 16);
  const pW = panelW * S;
  const pH = panelH * S;
  const saP = clamp(sa * S, 0, Math.max(0, Math.min(pW / 2 - 1, pH / 2 - 1)));
  const gW = gussetCutW > 0 ? clamp(gussetCutW * S, STRIP_MIN_H, STRIP_MAX_H) : STRIP_MIN_H;

  const cx = SVG_W / 2;
  const cy = PANEL_TOP + pH / 2;
  const rx = pW / 2;
  const ry = pH / 2;
  const sewRx = Math.max(0, rx - saP);
  const sewRy = Math.max(0, ry - saP);

  const stripY = PANEL_TOP + pH + STRIP_GAP;
  const stripLabelY = stripY + gW + 36;
  const SVG_H = stripLabelY + 24;

  const C = {
    fill: "#c8e8d4",
    gussetFill: "#a9dbbb",
    line: th.accent || "#1a6e3a",
    dark: "#165c30",
    text: th.label || "#165c30",
    softText: th.sub || "#3a9e60",
    callout: "#3cab64",
    bg: "#ffffff",
    fade: "#e7f6ed",
  };

  const arrowId = `roundGussetArrow-${shape}-${Math.round(panelW * 64)}-${Math.round(panelH * 64)}`;
  const fadeLeftId = `roundGussetFadeLeft-${shape}-${Math.round(panelW * 32)}-${Math.round(panelH * 32)}`;
  const fadeRightId = `roundGussetFadeRight-${shape}-${Math.round(panelW * 32)}-${Math.round(panelH * 32)}`;

  const widthY = PANEL_TOP - 34;
  const heightX = cx + rx + 46;

  const notchCount = Math.max(12, Math.min(20, Math.round(ellipsePerim(panelW, panelH) / 1.25)));
  const notchTicks = Array.from({ length: notchCount }, (_, i) => {
    const theta = (2 * PI * i) / notchCount;
    const x = cx + rx * Math.cos(theta);
    const y = cy + ry * Math.sin(theta);
    const nxRaw = Math.cos(theta) / Math.max(rx, 0.001);
    const nyRaw = Math.sin(theta) / Math.max(ry, 0.001);
    const nLen = Math.sqrt(nxRaw * nxRaw + nyRaw * nyRaw) || 1;
    const nx = nxRaw / nLen;
    const ny = nyRaw / nLen;
    const inner = Math.min(Math.max(1.2, Math.min(rx, ry) * 0.08), Math.max(1.2, saP - 2));
    const outer = 8;
    return {
      x1: x - nx * inner,
      y1: y - ny * inner,
      x2: x + nx * outer,
      y2: y + ny * outer,
    };
  });

  const stripPieceW = 132;
  const breakGap = 72;
  const stripTotalW = stripPieceW * 2 + breakGap;
  const stripX = (SVG_W - stripTotalW) / 2;
  const stripMidY = stripY + gW / 2;
  const leftStripX = stripX;
  const rightStripX = stripX + stripPieceW + breakGap;
  const breakLeftX = stripX + stripPieceW;
  const breakRightX = rightStripX;
  const breakOvershoot = 10;
  const breakTop = stripY - breakOvershoot;
  const breakBottom = stripY + gW + breakOvershoot;
  const breakMidY = (breakTop + breakBottom) / 2;
  const fadeW = 20;

  const breakLeftPath = `
    M ${breakLeftX + 2} ${breakTop}
    C ${breakLeftX + 12} ${breakTop + (breakBottom - breakTop) * 0.20}, ${breakLeftX + 22} ${breakTop + (breakBottom - breakTop) * 0.34}, ${breakLeftX + 30} ${breakMidY}
    C ${breakLeftX + 39} ${breakTop + (breakBottom - breakTop) * 0.68}, ${breakLeftX + 46} ${breakTop + (breakBottom - breakTop) * 0.82}, ${breakLeftX + 54} ${breakBottom}
  `;
  const breakRightPath = `
    M ${breakRightX - 54} ${breakTop}
    C ${breakRightX - 44} ${breakTop + (breakBottom - breakTop) * 0.20}, ${breakRightX - 34} ${breakTop + (breakBottom - breakTop) * 0.34}, ${breakRightX - 26} ${breakMidY}
    C ${breakRightX - 17} ${breakTop + (breakBottom - breakTop) * 0.68}, ${breakRightX - 10} ${breakTop + (breakBottom - breakTop) * 0.82}, ${breakRightX - 2} ${breakBottom}
  `;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ width:"100%", height:"auto", display:"block" }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Round or oval gusset diagram"
    >
      <defs>
        <marker id={arrowId} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
          <path d="M 1.25 1.25 L 6.75 4 L 1.25 6.75" fill="none" stroke={C.line} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <linearGradient id={fadeLeftId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor={C.fade} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={fadeRightId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={C.fade} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={SVG_W} height={SVG_H} fill={C.bg} />

      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={C.fill} stroke={C.line} strokeWidth="2.2" />
      {sewRx > 2 && sewRy > 2 && (
        <ellipse
          cx={cx}
          cy={cy}
          rx={sewRx}
          ry={sewRy}
          fill="none"
          stroke={C.dark}
          strokeWidth="1.45"
          strokeDasharray="6 5"
          opacity="0.78"
        />
      )}

      {notchTicks.map((n, i) => (
        <g key={i}>
          <line x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" opacity="0.96" />
          <line x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={C.callout} strokeWidth="1.55" strokeLinecap="round" opacity="0.62" />
        </g>
      ))}

      <text
        x={SVG_W / 2}
        y={PANEL_TOP + pH + 31}
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fontFamily="Nunito,sans-serif"
        fill={C.callout}
        opacity="0.78"
      >
        Clip/notch for easing around the full curve
      </text>

      <line x1={cx - rx} y1={widthY} x2={cx + rx} y2={widthY} stroke={C.line} strokeWidth="1.35" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
      <text x={cx} y={widthY - 11} textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="DM Mono,monospace" fill={C.text}>{fmtInch(panelW)} W</text>

      <line x1={heightX} y1={cy - ry} x2={heightX} y2={cy + ry} stroke={C.line} strokeWidth="1.35" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
      <text x={heightX + 18} y={cy} textAnchor="start" dominantBaseline="middle" fontSize="15" fontWeight="800" fontFamily="DM Mono,monospace" fill={C.text}>{fmtInch(panelH)} H</text>

      <rect x={leftStripX} y={stripY} width={stripPieceW} height={gW} fill={C.gussetFill} stroke="none" />
      <rect x={rightStripX} y={stripY} width={stripPieceW} height={gW} fill={C.gussetFill} stroke="none" />
      <rect x={leftStripX + stripPieceW - fadeW} y={stripY} width={fadeW} height={gW} fill={`url(#${fadeLeftId})`} />
      <rect x={rightStripX} y={stripY} width={fadeW} height={gW} fill={`url(#${fadeRightId})`} />
      <path d={`M ${leftStripX} ${stripY} H ${leftStripX + stripPieceW} M ${leftStripX} ${stripY + gW} H ${leftStripX + stripPieceW} M ${leftStripX} ${stripY} V ${stripY + gW}`} fill="none" stroke={C.line} strokeWidth="2" strokeLinecap="round" />
      <path d={`M ${rightStripX} ${stripY} H ${rightStripX + stripPieceW} M ${rightStripX} ${stripY + gW} H ${rightStripX + stripPieceW} M ${rightStripX + stripPieceW} ${stripY} V ${stripY + gW}`} fill="none" stroke={C.line} strokeWidth="2" strokeLinecap="round" />
      <path d={breakLeftPath} fill="none" stroke={C.callout} strokeWidth="3.2" strokeLinecap="round" />
      <path d={breakRightPath} fill="none" stroke={C.callout} strokeWidth="3.2" strokeLinecap="round" />

      {gussetCutW > 0 && (
        <>
          <line x1={stripX - 30} y1={stripY} x2={stripX - 30} y2={stripY + gW} stroke={C.line} strokeWidth="1.35" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
          <text x={stripX - 42} y={stripMidY} textAnchor="end" dominantBaseline="middle" fontSize="15" fontWeight="800" fontFamily="DM Mono,monospace" fill={C.text}>{fmtInch(gussetCutW)} W</text>
        </>
      )}

      <text x={SVG_W / 2} y={stripLabelY} textAnchor="middle" fontSize="16" fontWeight="800" fontFamily="Nunito,sans-serif" fill={C.softText}>
        {gussetLen > 0 ? `Strip cut length: ${fmtInch(gussetLen)}` : "Enter gusset width to see strip dimensions"}
      </text>
    </svg>
  );
}

function GussetPage() {
  const th=T.green;
  const [sa,setSa]=useState(DEFAULT_SA); const [cSa,setCsa]=useState("");
  const [mode,setMode]=useState("three");
  const [roundShape,setRoundShape]=useState("circle");

  // rectangular panel inputs
  const [pLW,setPLW]=useState(0); const [pLF,setPLF]=useState(0);
  const [pHW,setPHW]=useState(0); const [pHF,setPHF]=useState(0);
  const [rW,setRW]=useState(0);   const [rF,setRF]=useState(0);

  // round / oval panel inputs
  const [dW,setDW]=useState(0);   const [dF,setDF]=useState(0);
  const [oWW,setOWW]=useState(0); const [oWF,setOWF]=useState(0);
  const [oHW,setOHW]=useState(0); const [oHF,setOHF]=useState(0);

  // shared gusset width input
  const [gWW,setGWW]=useState(0); const [gWF,setGWF]=useState(0);

  const pL=pLW+pLF, pH=pHW+pHF, rC=rW+rF;
  const Rs=Math.max(0,rC-sa);
  const gFin=gWW+gWF, gCut=gFin+2*sa;

  // Sewline dims — top edge NOT reduced by SA for 3-sided rectangular gussets.
  const Ls_open = Math.max(0, pL - 2*sa);
  const Hs_open = Math.max(0, pH - sa);
  const Ls_closed = Math.max(0, pL - 2*sa);
  const Hs_closed = Math.max(0, pH - 2*sa);

  // ── 3-sided rectangle: bottom + 2 sides, 2 corners ───────────────────────
  const bot3 = Math.max(0, Ls_open - 2*Rs);
  const side3 = Math.max(0, Hs_open - Rs);
  const arc3 = PI*Rs;
  const sewLen3 = bot3 + arc3 + 2*side3;

  // ── 4-sided rectangle: full perimeter ────────────────────────────────────
  const sewLen4 = roundRectPerim(Ls_closed, Hs_closed, Rs);
  const stripLen4 = sewLen4 + 2*sa;

  // ── Round / oval: closed-loop perimeter ──────────────────────────────────
  const circleD = dW + dF;
  const ovalW = oWW + oWF;
  const ovalH = oHW + oHF;
  const roundPanelW = roundShape === "circle" ? circleD : ovalW;
  const roundPanelH = roundShape === "circle" ? circleD : ovalH;
  const roundSewW = Math.max(0, roundPanelW - 2*sa);
  const roundSewH = Math.max(0, roundPanelH - 2*sa);
  const roundCutP = ellipsePerim(roundPanelW, roundPanelH);
  const roundSewP = ellipsePerim(roundSewW, roundSewH);
  const roundStripLen = roundSewP + 2*sa;

  const isRoundMode = mode === "round";
  const sewLen = mode==="three" ? sewLen3 : mode==="four" ? stripLen4 : roundStripLen;
  const Ls_disp = mode==="four" ? Ls_closed : Ls_open;
  const Hs_disp = mode==="four" ? Hs_closed : Hs_open;

  const rectangularReady = pL > 0 && pH > 0;
  const roundReady = roundPanelW > 0 && roundPanelH > 0;

  return (
    <div style={{ minHeight:"100vh", padding:"16px 16px 48px" }}>
      <SABar th={th} sa={sa} setSa={setSa} cSa={cSa} setCsa={setCsa} />
      <div style={{ background:th.sec, borderRadius:14, boxShadow:"0 4px 18px rgba(26,110,58,0.12)" }}>
        <SecHeader th={th} title="Gusset Strip"
          sub="Calculates the cut length and width of a gusset strip based on the panel shape and how the strip wraps around it." />
        <div style={{ padding:"16px 16px 20px" }}>
          <SubTabs th={th} active={mode} set={setMode}
            tabs={[{id:"three",label:"3-Sided"},{id:"four",label:"4-Sided"},{id:"round",label:"Round / Oval"}]} />

          {mode==="three" && (
            <InfoBox th={th}>
              <strong>3-Sided:</strong> The strip wraps around 2 bottom corners, covering the bottom and both sides. Both short ends are raw top edges — left unsewn or finished separately. No end seam allowance is added to the strip length. Assumes 2 rounded corners (or 0 for square).
            </InfoBox>
          )}
          {mode==="four" && (
            <InfoBox th={th}>
              <strong>4-Sided:</strong> The strip wraps all 4 sides of the panel, forming a closed loop. Both short ends are sewn together — 2 seam allowances are included in the strip length. Assumes 4 rounded corners (or 0 for square).
            </InfoBox>
          )}
          {mode==="round" && (
            <InfoBox th={th}>
              <strong>Round / Oval:</strong> The strip wraps all the way around a circular or oval panel, like a round bag, train case, bucket bag bottom, or pouch end. The strip length includes 2 seam allowances for joining the short ends into a closed loop.
            </InfoBox>
          )}

          {isRoundMode ? (
            <Card th={th} style={{marginTop:12}}>
              <CardTitle th={th}>Round / Oval Panel — Cut Dimensions</CardTitle>
              <SubTabs th={th} active={roundShape} set={setRoundShape}
                tabs={[{id:"circle",label:"Circle"},{id:"oval",label:"Oval"}]} />
              {roundShape === "circle" ? (
                <FracInput th={th} label="Panel diameter (cut)" whole={dW} frac={dF} onWhole={setDW} onFrac={setDF} />
              ) : (
                <div className="frac-row">
                  <FracInput th={th} label="Panel width (cut)" whole={oWW} frac={oWF} onWhole={setOWW} onFrac={setOWF} />
                  <FracInput th={th} label="Panel height (cut)" whole={oHW} frac={oHF} onWhole={setOHW} onFrac={setOHF} />
                </div>
              )}
              <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px", marginTop:4 }}>
                <RRow th={th} label="Cut edge perimeter" value={fmtInch(roundCutP)} />
                <RRow th={th} label="Sewline perimeter" value={fmtInch(roundSewP)} accent />
              </div>
              <Divider th={th} />
              <div style={{ fontSize:13, fontWeight:800, color:th.sub, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8, fontFamily:"Nunito,sans-serif" }}>
                Sewline Dimensions
              </div>
              <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px" }}>
                <RRow th={th} label={roundShape === "circle" ? "Sewline diameter" : "Panel sewline width"} value={fmtInch(roundSewW)} />
                {roundShape === "oval" && <RRow th={th} label="Panel sewline height" value={fmtInch(roundSewH)} />}
              </div>
              <NoteBox>
                Oval perimeter is estimated using a standard ellipse approximation and rounded for practical cutting. For unusual partial arcs, draft the partial run separately.
              </NoteBox>
            </Card>
          ) : (
            <Card th={th} style={{marginTop:12}}>
              <CardTitle th={th}>Bag Panel — Cut Dimensions</CardTitle>
              <div className="frac-row">
                <FracInput th={th} label="Panel width (cut)" whole={pLW} frac={pLF} onWhole={setPLW} onFrac={setPLF} />
                <FracInput th={th} label="Panel height (cut)" whole={pHW} frac={pHF} onWhole={setPHW} onFrac={setPHF} />
              </div>
              <Divider th={th} />
              <div style={{ fontSize:13, fontWeight:800, color:th.sub, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:10, fontFamily:"Nunito,sans-serif" }}>
                {mode==="three"?"Bottom Corner Radius (2 corners)":"Corner Radius (all 4 corners)"}
              </div>
              <FracInput th={th} label="Radius at cut edge" sub="— 0 for square corners" whole={rW} frac={rF} onWhole={setRW} onFrac={setRF} />
              <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px", marginTop:4 }}>
                {mode!=="four" && <RRow th={th} label="Gusset sewline run" value={fmtInch(sewLen3)} accent />}
                {mode==="four" && <RRow th={th} label="Enclosed sewline perimeter" value={fmtInch(sewLen4)} accent />}
              </div>
              <Divider th={th} />
              <div style={{ fontSize:13, fontWeight:800, color:th.sub, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8, fontFamily:"Nunito,sans-serif" }}>
                Sewline Dimensions
              </div>
              <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px" }}>
                <RRow th={th} label="Panel sewline width" value={fmtInch(Ls_disp)} />
                <RRow th={th} label="Panel sewline height" value={fmtInch(Hs_disp)} />
                <RRow th={th} label="Sewline corner radius" value={fmtInch(Rs)} />
              </div>
              {mode!=="four" && (
                <NoteBox>
                  The panel sewline height reflects SA on the bottom edge only — the top edge is assumed to be the bag opening and is left unsewn at this stage.
                </NoteBox>
              )}
            </Card>
          )}

          <Card th={th}>
            <CardTitle th={th}>Gusset Strip Dimensions</CardTitle>
            <FracInput th={th} label="Gusset finished width" sub="(finished interior depth of bag)" whole={gWW} frac={gWF} onWhole={setGWW} onFrac={setGWF} />
            <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px", marginTop:8 }}>
              <RRow th={th} label="Strip cut length" value={fmtInch(sewLen)} accent big />
              <RRow th={th} label="Strip cut width" value={fmtInch(gCut)} accent big />
              <RRow th={th} label="Strip finished width" value={fmtInch(gFin)} />
            </div>
            {mode==="three" && <NoteBox>Strip length equals the 3-sided sewline run exactly — no end seam allowance added. Both short ends are left raw as the bag's top edges.</NoteBox>}
            {mode==="four" && <NoteBox>Strip length includes 2 seam allowances for joining the short ends into a closed loop. Press the joining seam open before attaching the strip to the panel.</NoteBox>}
            {mode==="round" && <NoteBox>Strip length uses the round/oval sewline perimeter plus 2 seam allowances for joining the short ends into a closed loop. Press the joining seam open before attaching the strip to the panel.</NoteBox>}
            <NoteBox>
              <strong>Easing at curves:</strong> Clip the strip's seam allowance at rounded curves every {fmtInch(0.25)}–{fmtInch(0.375)} (into but not through the seam allowance) so it lies flat around the curve.
            </NoteBox>
          </Card>

          <Card th={th}>
            <CardTitle th={th}>Panel & Gusset Diagram</CardTitle>
            {isRoundMode ? (
              <RoundOvalGussetDiagram
                shape={roundShape}
                panelW={roundPanelW}
                panelH={roundPanelH}
                gussetCutW={gCut}
                gussetLen={sewLen}
                sa={sa}
              />
            ) : (
              <GussetDiagram
                mode={mode}
                panelW={pL}
                panelH={pH}
                cornerR={rC}
                gussetCutW={gCut}
                gussetLen={sewLen}
                sa={sa}
              />
            )}
            {((isRoundMode && !roundReady) || (!isRoundMode && !rectangularReady)) && (
              <div style={{textAlign:"center",padding:"26px 20px",color:th.sub,fontFamily:"Nunito,sans-serif",fontSize:15,fontWeight:600}}>
                Enter panel dimensions above to see the diagram.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 3 — PIPING
// ══════════════════════════════════════════════════════════════════════════════

function PipingPage() {
  const th=T.magenta;
  const [sa,setSa]=useState(DEFAULT_SA); const [cSa,setCsa]=useState("");
  const [shape,setShape]=useState("rect");
  const [cIdx,setCIdx]=useState(0);
  const [vinylThick,setVinylThick]=useState(1/32);

  // Rectangle
  const [rLW,setRLW]=useState(0); const [rLF,setRLF]=useState(0);
  const [rWW,setRWW]=useState(0); const [rWF,setRWF]=useState(0);
  const [rrW,setRrW]=useState(0); const [rrF,setRrF]=useState(0);
  const [rManual,setRManual]=useState(false);
  const [rManW,setRManW]=useState(0); const [rManF,setRManF]=useState(0);

  // Oval
  const [oAW,setOAW]=useState(0); const [oAF,setOAF]=useState(0);
  const [oBW,setOBW]=useState(0); const [oBF,setOBF]=useState(0);
  const [oManual,setOManual]=useState(false);
  const [oManW,setOManW]=useState(0); const [oManF,setOManF]=useState(0);

  // 3-sided
  const [tLW,setTLW]=useState(0); const [tLF,setTLF]=useState(0);
  const [tHW,setTHW]=useState(0); const [tHF,setTHF]=useState(0);
  const [trW,setTrW]=useState(0); const [trF,setTrF]=useState(0);
  const [tDropW,setTDropW]=useState(1); const [tDropF,setTDropF]=useState(0);

  const cord=CORDS[cIdx];
  const sw=pipingStripWidth(cord.d,sa);

  // Cut perimeters — calculated directly from cut dimensions (what you can measure)
  const rL_cut=rLW+rLF, rW2_cut=rWW+rWF, rRs_cut=rrW+rrF;
  const rectPcalc=roundRectPerim(rL_cut, rW2_cut, rRs_cut);
  const rectCutP=rManual?(rManW+rManF):rectPcalc;

  const oA_cut=(oAW+oAF)/2, oB2_cut=(oBW+oBF)/2;
  const hh=(oA_cut+oB2_cut)>0?(oA_cut-oB2_cut)**2/(oA_cut+oB2_cut)**2:0;
  const ovalPcalc=oA_cut+oB2_cut>0?PI*(oA_cut+oB2_cut)*(1+(3*hh)/(10+Math.sqrt(4-3*hh))):0;
  const ovalCutP=oManual?(oManW+oManF):ovalPcalc;

  const tL_cut=tLW+tLF, tH_cut=tHW+tHF, tRs_cut=trW+trF;
  const tEndDrop=Math.max(0,tDropW+tDropF);
  const tBot=Math.max(0,tL_cut-2*tRs_cut);
  const tSide=Math.max(0,tH_cut-tRs_cut-tEndDrop);
  const threeCutP=tBot+2*tSide+PI*tRs_cut;

  const cutP=shape==="rect"?rectCutP:shape==="oval"?ovalCutP:threeCutP;
  // Sewline perimeter = cut perimeter minus SA on all enclosed edges
  const sewP = cutP - (shape==="three" ? (4*sa) : (4*sa));  // all shapes: 2 dims × 2×SA each
  const closed=shape!=="three";

  // ── Geometric values ─────────────────────────────────────────────────────
  // Strip: based on sewline perimeter. Open 3-sided runs add 1" turn-out tail at each end.
  const openTurnTail = 1;
  const stripLen=closed?smartRound(sewP+2*sa):smartRound(sewP+2*openTurnTail);
  // Cord: sewline minus cord-curve offset = 2π × (cord_radius + vinyl_thickness)
  const offset=cordOffset(cord.d, vinylThick);
  const cordLen=smartRound(sewP-offset);

  // ── Empirical / snug-fit values ──────────────────────────────────────────
  // Derived from real-world anchor: 32.25" cut perimeter → 30.625" strip, 29.5" cord
  // (3/32" cord, 1/4" strip SA, 3/8" bag SA — dialed in over 6 builds)
  // Strip = 95.0% of cut perimeter; Cord = 91.5% of cut perimeter
  const STRIP_PCT = 0.950;
  const CORD_PCT  = 0.915;
  const empStripLen = smartRound(cutP * STRIP_PCT);
  const empCordLen  = smartRound(cutP * CORD_PCT);

  const togStyle=(on)=>({
    padding:"6px 14px", fontSize:14, fontWeight:800, fontFamily:"Nunito,sans-serif",
    borderRadius:6, border:`1.5px solid ${th.border}`, cursor:"pointer",
    background:on?th.btnOn:th.btnOff, color:on?"#fff":th.btnOffTxt,
  });

  const vinylPresets=[{l:'1/32"',v:1/32},{l:'1/16"',v:1/16},{l:'3/32"',v:3/32}];

  return (
    <div style={{ minHeight:"100vh", padding:"16px 16px 48px" }}>
      <SABar th={th} sa={sa} setSa={setSa} cSa={cSa} setCsa={setCsa} />
      <div style={{ background:th.sec, borderRadius:14, boxShadow:"0 4px 18px rgba(142,26,158,0.12)" }}>
        <SecHeader th={th} title="Piping"
          sub="Calculates piping cord length and fabric/vinyl strip dimensions. Cord length accounts for the cord curving inside the sewline." />
        <div style={{ padding:"16px 16px 20px" }}>

          <Card th={th}>
            <CardTitle th={th}>Piping Cord Size</CardTitle>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {CORDS.map((c,i)=>(
                <button key={i} onClick={()=>setCIdx(i)} style={{
                  padding:"10px 16px", fontSize:19, fontFamily:"DM Mono,monospace", fontWeight:500,
                  borderRadius:8, cursor:"pointer",
                  background:cIdx===i?th.btnOn:th.btnOff,
                  color:cIdx===i?"#fff":th.btnOffTxt,
                  border:`2px solid ${cIdx===i?th.btnOn:th.border}`,
                  transition:"all 0.15s"
                }}>{fmtInch(c.d)}</button>
              ))}
            </div>
            <div style={{ background:th.resBg, borderRadius:8, padding:"11px 14px", marginTop:12 }}>
              <RRow th={th} label="Fabric/vinyl strip width (cut)" value={fmtInch(sw)} accent big />
            </div>
            <NoteBox>
              <strong>Strip width is calibrated for vinyl/faux leather.</strong> Woven fabric is thinner and more compressible — try a strip {fmtInch(0.125)} narrower and test-wrap your cord before cutting the full length.
            </NoteBox>
          </Card>

          <Card th={th}>
            <CardTitle th={th}>Piping Material Wrap Thickness</CardTitle>
            <div style={{ fontSize:15, fontWeight:700, color:th.label, marginBottom:8, fontFamily:"Nunito,sans-serif" }}>Wrap material thickness</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:8 }}>
              {vinylPresets.map(p=>(
                <button key={p.l} onClick={()=>setVinylThick(p.v)} style={{
                  padding:"8px 14px", fontSize:17, fontFamily:"DM Mono,monospace", fontWeight:500,
                  borderRadius:8, cursor:"pointer",
                  background:Math.abs(vinylThick-p.v)<0.001?th.btnOn:th.btnOff,
                  color:Math.abs(vinylThick-p.v)<0.001?"#fff":th.btnOffTxt,
                  border:`2px solid ${Math.abs(vinylThick-p.v)<0.001?th.btnOn:th.border}`,
                  transition:"all 0.15s"
                }}>{p.l}</button>
              ))}
            </div>
            <InfoBox th={th}>
              Wrap thickness affects cord length because the cord curves slightly inside the sewline. Default is 1/32" for standard vinyl/faux leather. Use 1/16" for heavier upholstery vinyl or cork, then ease as needed while sewing.
            </InfoBox>
          </Card>

          <Card th={th}>
            <CardTitle th={th}>Shape</CardTitle>
            <SubTabs th={th} active={shape} set={setShape}
              tabs={[{id:"rect",label:"Rectangle"},{id:"oval",label:"Round / Oval"},{id:"three",label:"3-Sided"}]} />

            {shape==="rect"&&<>
              <InfoBox th={th}>Enter the cut dimensions of the panel receiving piping around its full perimeter. Use 0 for corner radius on square panels. Or enter the cut perimeter directly — use a flexible tape measure run along the cut edge of your panel.</InfoBox>
              <div style={{ display:"flex", gap:8, margin:"12px 0 4px" }}>
                <button style={togStyle(!rManual)} onClick={()=>setRManual(false)}>Calculate</button>
                <button style={togStyle(rManual)} onClick={()=>setRManual(true)}>Enter perimeter</button>
              </div>
              {!rManual?(
                <div style={{marginTop:10}}>
                  <div className="frac-row">
                    <FracInput th={th} label="Length (cut)" whole={rLW} frac={rLF} onWhole={setRLW} onFrac={setRLF} />
                    <FracInput th={th} label="Width (cut)" whole={rWW} frac={rWF} onWhole={setRWW} onFrac={setRWF} />
                  </div>
                  <FracInput th={th} label="Corner radius" sub="(cut edge — 0 for square)" whole={rrW} frac={rrF} onWhole={setRrW} onFrac={setRrF} />
                </div>
              ):(
                <div style={{marginTop:10}}>
                  <FracInput th={th} label="Cut perimeter (measured)" sub="— run a flexible tape along the cut edge" whole={rManW} frac={rManF} onWhole={setRManW} onFrac={setRManF} />
                </div>
              )}
            </>}

            {shape==="oval"&&<>
              <InfoBox th={th}>Enter the cut dimensions of the oval or circle. For a perfect circle, enter the same value for both axes. Or enter the cut perimeter directly — use a flexible tape measure run along the cut edge of your panel.</InfoBox>
              <div style={{ display:"flex", gap:8, margin:"12px 0 4px" }}>
                <button style={togStyle(!oManual)} onClick={()=>setOManual(false)}>Calculate</button>
                <button style={togStyle(oManual)} onClick={()=>setOManual(true)}>Enter perimeter</button>
              </div>
              {!oManual?(
                <div style={{marginTop:10}}>
                  <div className="frac-row">
                    <FracInput th={th} label="Long axis (cut)" whole={oAW} frac={oAF} onWhole={setOAW} onFrac={setOAF} />
                    <FracInput th={th} label="Short axis (cut)" whole={oBW} frac={oBF} onWhole={setOBW} onFrac={setOBF} />
                  </div>
                </div>
              ):(
                <div style={{marginTop:10}}>
                  <FracInput th={th} label="Cut perimeter (measured)" sub="— run a flexible tape along the cut edge" whole={oManW} frac={oManF} onWhole={setOManW} onFrac={setOManF} />
                </div>
              )}
            </>}

            {shape==="three"&&<>
              <InfoBox th={th}>Piping runs along the bottom and both sides of the panel. The strip has open tails at the top edge and does not form a closed loop.</InfoBox>
              <div style={{marginTop:14}}>
                <div className="frac-row">
                  <FracInput th={th} label="Panel width (cut)" whole={tLW} frac={tLF} onWhole={setTLW} onFrac={setTLF} />
                  <FracInput th={th} label="Panel height (cut)" whole={tHW} frac={tHF} onWhole={setTHW} onFrac={setTHF} />
                </div>
                <FracInput th={th} label="Corner radius" sub="(cut edge — 0 for square)" whole={trW} frac={trF} onWhole={setTrW} onFrac={setTrF} />
                <FracInput th={th}
                  label="Piping end distance from top"
                  sub="how far below the top edge the cord should stop before the wrap angles into the side seam"
                  whole={tDropW} frac={tDropF} onWhole={setTDropW} onFrac={setTDropF} />
              </div>
              <InfoBox th={th}>
                Most bags look cleaner when 3-sided piping stops below the top edge, then the empty wrap angles outward into the side seam. This keeps the cord out of the top seam allowance and reduces bulk.
              </InfoBox>
            </>}
          </Card>

          <Card th={th}>
            <CardTitle th={th}>Cut Lengths</CardTitle>

            {/* Reference perimeters */}
            <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px", marginBottom:12 }}>
              <RRow th={th} label={shape==="three"?"Piping placement run":"Cut edge perimeter"} value={fmtInch(cutP)} />
              <RRow th={th} label="Sewline perimeter" value={fmtInch(sewP)} />
              {shape==="three" && <RRow th={th} label="Cord stops below top" value={fmtInch(tEndDrop)} />}
              <RRow th={th} label="Strip width" value={fmtInch(sw)} />
            </div>

            {/* Results */}
            {shape==="three" ? (
              <div style={{ background:th.info, border:`1.5px solid ${th.infoBdr}`, borderRadius:10, padding:"12px 12px 14px", marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase",
                  color:th.label, marginBottom:10, fontFamily:"Nunito,sans-serif",
                  borderBottom:`1.5px solid ${th.infoBdr}`, paddingBottom:6 }}>
                  3-Sided Open Run
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:th.label, marginBottom:4, fontFamily:"Nunito,sans-serif" }}>Wrap strip length</div>
                <div style={{ fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.resAccent, marginBottom:10 }}>{fmtInch(stripLen)}</div>
                <div style={{ fontSize:13, fontWeight:700, color:th.label, marginBottom:4, fontFamily:"Nunito,sans-serif" }}>Cord length</div>
                <div style={{ fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.resAccent, marginBottom:10 }}>{fmtInch(cordLen)}</div>
                <div style={{ fontSize:13, fontWeight:700, color:th.label, marginBottom:4, fontFamily:"Nunito,sans-serif" }}>Turn-out tail each end</div>
                <div style={{ fontSize:18, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.resAccent }}>{fmtInch(openTurnTail)}</div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                {/* Geometric */}
                <div style={{ background:th.info, border:`1.5px solid ${th.infoBdr}`, borderRadius:10, padding:"12px 12px 14px" }}>
                  <div style={{ fontSize:13, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase",
                    color:th.label, marginBottom:10, fontFamily:"Nunito,sans-serif",
                    borderBottom:`1.5px solid ${th.infoBdr}`, paddingBottom:6 }}>
                    Geometric
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:th.label, marginBottom:4, fontFamily:"Nunito,sans-serif" }}>Strip length</div>
                  <div style={{ fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.resAccent, marginBottom:10 }}>{fmtInch(stripLen)}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:th.label, marginBottom:4, fontFamily:"Nunito,sans-serif" }}>Cord length</div>
                  <div style={{ fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.resAccent }}>{fmtInch(cordLen)}</div>
                </div>

                {/* Empirical */}
                <div style={{ background:th.resBg, border:`2px solid ${th.resAccent}`, borderRadius:10, padding:"12px 12px 14px" }}>
                  <div style={{ fontSize:13, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase",
                    color:th.resAccent, marginBottom:10, fontFamily:"Nunito,sans-serif",
                    borderBottom:`1.5px solid ${th.border}`, paddingBottom:6 }}>
                    Snug Fit
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:th.label, marginBottom:4, fontFamily:"Nunito,sans-serif" }}>Strip length</div>
                  <div style={{ fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.resAccent, marginBottom:10 }}>{fmtInch(empStripLen)}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:th.label, marginBottom:4, fontFamily:"Nunito,sans-serif" }}>Cord length</div>
                  <div style={{ fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.resAccent }}>{fmtInch(empCordLen)}</div>
                </div>
              </div>
            )}

            {shape==="three" ? (
              <InfoBox th={th}>
                For open 3-sided piping, the cord stops at the placement endpoint. The wrap strip is longer so the empty wrap can be notched, angled outward, and caught in the side seam without carrying cord into the seam allowance.
              </InfoBox>
            ) : (
              <InfoBox th={th}>
                <strong>Geometric</strong> uses pure math — sewline perimeter offset by cord radius and vinyl thickness. <strong>Snug Fit</strong> is experience-derived, producing intentionally tighter results that ease cleanly onto the panel without puckering or shifting. For larger cord sizes, cross-check against the geometric value.
              </InfoBox>
            )}

            {closed?(
              <NoteBox>
                <strong>Closed loop assembly:</strong> Sew the fabric/vinyl strip into a loop first, pressing or taping the seam allowance open flat. Secure the cord inside with double-sided tape, then glue or tape the strip closed around the cord before easing it onto the panel and stitching.
                <br/><br/>
                <strong>Cord trim note:</strong> The cord is intentionally shorter than the strip. Trim it so each end sits between the open seam allowances of the vinyl strip — this reduces bulk when the piping is folded and closed up, and keeps the needle clear of the cord at the join.
                <br/><br/>
                <strong>Easing:</strong> Clip into the strip's seam allowance at curves and corners every {fmtInch(0.25)}–{fmtInch(0.375)}. A slightly snug fit is ideal — gentle stretching produces tighter, cleaner corners.
              </NoteBox>
            ):(
              <NoteBox>
                <strong>Open 3-sided run:</strong> The cord stops {fmtInch(tEndDrop)} below the top edge. The wrap strip includes a {fmtInch(openTurnTail)} empty tail at each end so you can notch the wrap, angle it outward, and catch it in the side seam.
                <br/><br/>
                <strong>Bulk reduction:</strong> Keep the cord just inside the seam allowance instead of running it into the top seam. Only the flat wrap tail should enter the side seam.
                <br/><br/>
                <strong>Clipping:</strong> Clip into the strip's seam allowance at each rounded corner every {fmtInch(0.25)}–{fmtInch(0.375)} so the wrap turns smoothly.
              </NoteBox>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// PAGE 4 — COLLAPSIBLE BOTTLE POCKET
// ══════════════════════════════════════════════════════════════════════════════

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
function BPNotice({ type, children, th }) {
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

function BottlePocketPage() {
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
    <div style={{minHeight:"100vh", padding:"16px 16px 80px"}}>
      <SABar sa={sa} setSa={setSa} cSa={cSa} setCsa={setCsa} th={th}/>

      <div style={{background:th.sec, borderRadius:14, boxShadow:"0 4px 18px rgba(26,74,122,0.12)"}}>
        <SecHeader th={th}
          title="Accordion Pocket Calculator"
          sub="An open-bottomed accordion-fold pocket that expands to fit its contents and collapses flat when empty — ideal for water bottles, sunglass cases, or anything that benefits from a self-adjusting fit."/>

        <div style={{padding:"16px 16px 20px"}}>

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
                {ready && pf1 < minPF1 && <BPNotice type="warn" th={th}>Pocket front 1 ({fmtInch(pf1)}) must be at least {fmtInch(minPF1)} (flap1 x 2 + {fmtInch(0.25)}).</BPNotice>}
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
                {ready && pf2 < minPF2 && <BPNotice type="warn" th={th}>Pocket front 2 ({fmtInch(pf2)}) must be at least {fmtInch(minPF2)} (flap2 x 2 + {fmtInch(0.25)}).</BPNotice>}
              </div>

              <div style={{background:th.info,border:`1.5px solid ${th.infoBdr}`,borderRadius:8,
                padding:"8px 12px",marginTop:8,fontSize:14,fontWeight:600,color:th.infoTxt,fontFamily:"Nunito,sans-serif"}}>
                Center gap = Flap 1 ({fmtInch(flap1)}) + Flap 2 ({fmtInch(flap2)}) = <strong>{fmtInch(gap12)}</strong> · this value should stay equal to both flap widths combined.
              </div>
              {ready && <div style={{marginTop:8}}><BPNotice type={bagType} th={th}>{bagMsg}</BPNotice></div>}
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
                <BPNotice type="warn" th={th}>
                  Pocket front ({fmtInch(pf)}) must be at least {fmtInch(minPF)} (flap x 2 + {fmtInch(0.25)}) for accordion construction.
                </BPNotice>
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
                <BPNotice type={fitType} th={th}>
                  Pocket circumference: {fmtInch(actualCirc)} · Bottle circumference: {fmtInch(neededCirc)} · Extra room: {fmtInch(Math.max(0,circumDiff))} ({easePctLabel}%). Target: {fmtInch(targetEaseMin)}–{fmtInch(targetEaseMax)} extra. {fitMsg}
                </BPNotice>
              )}
              {ready && <div style={{marginTop:8}}><BPNotice type={bagType} th={th}>{bagMsg}</BPNotice></div>}
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


// ── Obfuscated email footer ───────────────────────────────────────────────────
function ContactFooter() {
  const [shown, setShown] = useState(false);
  // assembled at runtime — never a plain string in source
  const parts = ["moonshot", ".", "bagcalc", "@", "gmail", ".", "com"];
  const email = parts.join("");
  return (
    <div style={{
      background:"#140d30", borderTop:"1px solid rgba(255,255,255,0.08)",
      padding:"24px 20px 32px", textAlign:"center", borderRadius:"5px 5px 0 0",
    }}>
      <div style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.35)", marginBottom:10, fontFamily:"Nunito,sans-serif", letterSpacing:"0.08em", textTransform:"uppercase" }}>
        Questions or feedback?
      </div>
      {!shown ? (
        <button onClick={()=>setShown(true)} style={{
          fontSize:14, fontWeight:800, fontFamily:"Nunito,sans-serif",
          background:"rgba(152,128,216,0.15)", color:"#b8a8e8",
          border:"1.5px solid rgba(152,128,216,0.3)", borderRadius:8,
          padding:"8px 18px", cursor:"pointer",
        }}>
          Show contact email
        </button>
      ) : (
        <a href={`mailto:${email}`} style={{
          fontSize:14, fontWeight:700, fontFamily:"DM Mono,monospace",
          color:"#b8a8e8", textDecoration:"none",
          borderBottom:"1px dashed rgba(184,168,232,0.4)",
        }}>{email}</a>
      )}
      <div style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.45)", marginTop:18, fontFamily:"Nunito,sans-serif", lineHeight:1.55, maxWidth:560, marginLeft:"auto", marginRight:"auto" }}>
        This calculator is for drafting your own designs and tweaking your projects — it's a math tool, not a pattern.
        Pattern designers do far more than geometry: construction, fit, instructions, and style are the real craft.
        If you love a designer's work, buy their patterns. This exists to support that world, not shortcut it.
      </div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.2)", marginTop:16, fontFamily:"Nunito,sans-serif" }}>
        © Moonshot · made with love for the bag-making community
      </div>
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════════════════
// ── CURVED PANEL — fair-curve calculator (replaces the old Advanced tab) ──────
// Geometry core lives in ./curved-panel-core.js (pure JS, shared with the
// standalone curved-panel-prototype.html). This section is UI + print only.
// ══════════════════════════════════════════════════════════════════════════════

// ── Curved Panel theme tokens (Moonshot maroon palette) ───────────────────────
const CP = {
  maroon:"#8e1d3c", maroonDark:"#6f152e", rose:"#c2476b",
  pinkBg:"#fdf4f6", pinkSoft:"#f7e3e9", pinkLine:"#ecccd6", ink:"#4a2230",
  muted:"#9a6b7b", green:"#1d6b45",
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
/* Print colors */
const C_CUT    = CP.maroon;
const C_SEW    = "#aaaaaa";
const C_BORDER = "#000000";
const C_CENTER = "#00bcd4";
const C_PIECE_CENTER = "#b59ca5";
const C_MARK   = CP.maroon;
const C_NOTCH  = "#1565c0";

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

/* Z-order in cpDrawStrip: notches → center line → sewline → landmarks → center triangles → cut rect */
function cpDrawStrip(pc){
  const { x0, y0, cutL, w, sa } = pc;
  const runLen = pc.runLen !== undefined ? pc.runLen : (cutL - (pc.flushStart ? sa : 2*sa));
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
    ["Fullness / crown","Left "+cpFmt(m.crowns.hL)+" \u00B7 Right "+cpFmt(m.crowns.hR)+" \u00B7 Top "+cpFmt(m.crowns.hTop)+" \u00B7 Bottom "+cpFmt(m.crowns.hBot)+" \u00B7 feel: "+p.feel],
    ["Corner softness","top "+cpFmt(m.softness.ts)+" \u00B7 bottom "+cpFmt(m.softness.bs)+" (0 = crisp)"],
    ["Construction",open?"3-sided open top":"4-sided enclosed"],
    ["Sewline side runs",open
      ?("Right "+cpFmt(r.right)+" \u00B7 Bottom "+cpFmt(r.bottom)+" \u00B7 Left "+cpFmt(r.left)+" \u00B7 Top open")
      :("Top "+cpFmt(r.top)+" \u00B7 Right "+cpFmt(r.right)+" \u00B7 Bottom "+cpFmt(r.bottom)+" \u00B7 Left "+cpFmt(r.left))]
  ];
  cpPrintDoc("Curved Panel \u2014 Main Panel",geom,spanW,spanH,detailRows,
    "Maroon = cut line \u00B7 grey dashed = sewline \u00B7 cyan dashed = center fold line. \u25B2 = center/fold mark \u00B7 \u25A1 = side junction \u00B7 \u25C7 = side midpoint.");
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
  const VW=760,VH=490,PAD=28,bb=model.cutBB;
  const scale=Math.min((VW-PAD*2)/bb.w,(VH-PAD*2)/bb.h);
  const ox=(VW-bb.w*scale)/2-bb.minX*scale,oy=(VH-bb.h*scale)/2-bb.minY*scale;
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
  svg+=`<path d="${cpPtsToPath(map(model.cutPts),true)}" fill="#fbecef" stroke="${CP.maroon}" stroke-width="3.5" stroke-linejoin="round" fill-opacity="0.5"/>`;
  return svg;
}

/* Mini strip diagram (on-screen). Returns an HTML string. */
function cpMiniStrip(cutL, cutW, label, dims, opts){
  const o=opts||{};
  const VBW=760,PADX=28,PADY=18,MAX_DRAW_H=190;
  const scale=o.fitScale||Math.min((VBW-2*PADX)/Math.max(cutL,1e-9),MAX_DRAW_H/Math.max(cutW,1e-9));
  const displayL=cutL*scale,displayW=cutW*scale;
  const x0=(VBW-displayL)/2,y0=PADY,svgH=displayW+PADY*2;
  const saPx=(o.sa||0)*scale,sx=o.flushStart?x0:x0+saPx,ex=o.flushEnd?x0+displayL:x0+displayL-saPx;
  const midX=x0+displayL/2,midY=y0+displayW/2,STROKE=CP.maroon;
  let s=`<svg viewBox="0 0 ${VBW} ${svgH.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">`;
  if(o.ghost){const go=7;s+=`<rect x="${(x0+go).toFixed(1)}" y="${(y0-go).toFixed(1)}" width="${displayL.toFixed(1)}" height="${displayW.toFixed(1)}" fill="#fdf0f2" stroke="${CP.pinkLine}" stroke-width="1.5"/>`;}
  s+=`<rect x="${x0.toFixed(1)}" y="${y0}" width="${displayL.toFixed(1)}" height="${displayW.toFixed(1)}" fill="#fbecef" fill-opacity=".72" stroke="none"/>`;
  if(o.plan&&o.plan.marks.length){for(const mk of o.plan.marks){const tx=x0+(o.flushStart?0:saPx)+mk.s*scale,tl=mk.kind==="clip"?saPx*.8:saPx*.6,wg=mk.kind==="clip"?1.3:.9;s+=`<line x1="${tx.toFixed(1)}" y1="${y0}" x2="${tx.toFixed(1)}" y2="${(y0+tl).toFixed(1)}" stroke="#1565c0" stroke-width="${wg}" opacity=".7"/>`;s+=`<line x1="${tx.toFixed(1)}" y1="${(y0+displayW).toFixed(1)}" x2="${tx.toFixed(1)}" y2="${(y0+displayW-tl).toFixed(1)}" stroke="#1565c0" stroke-width="${wg}" opacity=".7"/>`;}}
  s+=`<line x1="${midX.toFixed(1)}" y1="${y0}" x2="${midX.toFixed(1)}" y2="${(y0+displayW).toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="5 5"/>`;
  s+=`<line x1="${x0.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${(x0+displayL).toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="5 5"/>`;
  if(saPx>0&&displayW>2*saPx){let d=`M ${sx.toFixed(1)} ${(y0+saPx).toFixed(1)} H ${ex.toFixed(1)} M ${sx.toFixed(1)} ${(y0+displayW-saPx).toFixed(1)} H ${ex.toFixed(1)}`;if(!o.flushStart)d+=` M ${sx.toFixed(1)} ${(y0+saPx).toFixed(1)} V ${(y0+displayW-saPx).toFixed(1)}`;if(!o.flushEnd)d+=` M ${ex.toFixed(1)} ${(y0+saPx).toFixed(1)} V ${(y0+displayW-saPx).toFixed(1)}`;s+=`<path d="${d}" fill="none" stroke="#8f8f8f" stroke-width="1.4" stroke-dasharray="7 5"/>`;}
  const tb=8,th=11;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${y0} ${(midX+tb/2).toFixed(1)},${y0} ${midX.toFixed(1)},${(y0+th).toFixed(1)}" fill="${STROKE}"/>`;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${(y0+displayW).toFixed(1)} ${(midX+tb/2).toFixed(1)},${(y0+displayW).toFixed(1)} ${midX.toFixed(1)},${(y0+displayW-th).toFixed(1)}" fill="${STROKE}"/>`;
  s+=`<polygon points="${x0.toFixed(1)},${(midY-tb/2).toFixed(1)} ${x0.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(x0+th).toFixed(1)},${midY.toFixed(1)}" fill="${STROKE}"/>`;
  s+=`<polygon points="${(x0+displayL).toFixed(1)},${(midY-tb/2).toFixed(1)} ${(x0+displayL).toFixed(1)},${(midY+tb/2).toFixed(1)} ${(x0+displayL-th).toFixed(1)},${midY.toFixed(1)}" fill="${STROKE}"/>`;
  s+=`<rect x="${x0.toFixed(1)}" y="${y0}" width="${displayL.toFixed(1)}" height="${displayW.toFixed(1)}" fill="none" stroke="${STROKE}" stroke-width="2.2"/>`;
  if(o.topLabel){const tx=o.flushStart?x0+13:x0+displayL-13;s+=`<text x="${tx.toFixed(1)}" y="${midY.toFixed(1)}" font-size="12" font-weight="800" font-family="Nunito,sans-serif" fill="${STROKE}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90,${tx.toFixed(1)},${midY.toFixed(1)})">TOP</text>`;}
  s+=`</svg>`;
  return `<div class="cp-mini">${s}<div class="mlabel">${label}</div><div class="mdims">${dims}</div></div>`;
}

/* Piece-table builders */
function cpProw(label, cutVal, sewVal){
  return `<div class="cp-prow"><div class="pl">${label}</div><div class="pc">${cutVal}</div><div class="ps">Sewline: ${sewVal}</div></div>`;
}
function cpPieceBlock(pill, rows, note){
  return `<span class="cp-pill">${pill}</span>` + rows.join("") + (note ? `<p class="cp-pnote">${note}</p>` : "");
}
function cpStripRows(cutL, sewL, cutW, sewW){
  return [
    cpProw("Length — cut", cpFmt(cutL), cpFmt(sewL)),
    cpProw("Width — cut", cpFmt(cutW), cpFmt(sewW)),
    cpProw("Cut perimeter", cpFmt(2*(cutL+cutW)), cpFmt(2*(sewL+sewW)))
  ];
}

/* Sides minis + tables */
function cpSidesHTML(m,p){
  const pieces=m.displaySidePieces||[];
  if(!pieces.length)return {minis:"",tables:""};
  const maxL=Math.max(...pieces.map(x=>x.cutLength)),maxW=Math.max(...pieces.map(x=>x.cutWidth));
  const fitScale=Math.min((760-56)/Math.max(maxL,1e-9),190/Math.max(maxW,1e-9));
  let minis="",tables="";
  for(const pc of pieces){
    minis+=cpMiniStrip(pc.cutLength,pc.cutWidth,pc.label,cpFmt(pc.cutLength)+" L × "+cpFmt(pc.cutWidth)+" D",{ghost:pc.quantity===2,sa:p.sa,plan:pc.plan,flushStart:pc.flushStart,flushEnd:pc.flushEnd,runLen:pc.runLength,topLabel:pc.flushStart||pc.flushEnd,fitScale});
    const note=pc.flushStart||pc.flushEnd?"Raw-top end is flush; the opposite end includes the joining seam allowance.":(pc.quantity===2?"Verified mirrored pair; one template can be used for both sides.":"");
    tables+=cpPieceBlock(pc.label,[cpProw("Length — cut",cpFmt(pc.cutLength),cpFmt(pc.runLength)),cpProw("Width — cut",cpFmt(pc.cutWidth),cpFmt(pc.finishedWidth))],note);
  }
  return {minis:`<div class="cp-miniWrap">${minis}</div>`,tables};
}

function cpGussetMapHTML(pc){
  if(!pc)return "";
  const VW=760,PADX=28,PADY=34,MAX_DRAW_H=210;
  const scale=Math.min((VW-2*PADX)/Math.max(pc.cutLength,1e-9),MAX_DRAW_H/Math.max(pc.cutWidth,1e-9));
  const drawL=pc.cutLength*scale,drawW=pc.cutWidth*scale,x0=(VW-drawL)/2,y0=PADY,H=drawW+PADY+56;
  const saPx=(pc.cutWidth-pc.finishedWidth)/2*scale,sewStart=x0+pc.startAllowance*scale,sewEnd=sewStart+pc.runLength*scale,midX=x0+drawL/2,midY=y0+drawW/2;
  let s=`<svg class="cp-zoneMap" viewBox="0 0 ${VW} ${H.toFixed(1)}" xmlns="http://www.w3.org/2000/svg">`;
  s+=`<rect x="${x0.toFixed(1)}" y="${y0}" width="${drawL.toFixed(1)}" height="${drawW.toFixed(1)}" rx="4" fill="#fbecef" fill-opacity=".75" stroke="none"/>`;
  s+=`<line x1="${midX.toFixed(1)}" y1="${y0}" x2="${midX.toFixed(1)}" y2="${(y0+drawW).toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="5 5"/><line x1="${x0.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${(x0+drawL).toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${C_PIECE_CENTER}" stroke-width="1.2" stroke-dasharray="5 5"/>`;
  if(saPx>0&&drawW>2*saPx){const yTop=y0+saPx,yBot=y0+drawW-saPx,d=`M ${sewStart.toFixed(1)} ${yTop.toFixed(1)} H ${sewEnd.toFixed(1)} M ${sewStart.toFixed(1)} ${yBot.toFixed(1)} H ${sewEnd.toFixed(1)} M ${sewStart.toFixed(1)} ${yTop.toFixed(1)} V ${yBot.toFixed(1)} M ${sewEnd.toFixed(1)} ${yTop.toFixed(1)} V ${yBot.toFixed(1)}`;s+=`<path d="${d}" fill="none" stroke="#8f8f8f" stroke-width="1.5" stroke-dasharray="7 5"/>`;}
  let acc=0;for(let i=0;i<pc.zones.length;i++){const z=pc.zones[i],x1=sewStart+acc*scale,x2=x1+z.length*scale;if(i>0)s+=`<line x1="${x1.toFixed(1)}" y1="${y0}" x2="${x1.toFixed(1)}" y2="${(y0+drawW).toFixed(1)}" stroke="${CP.maroon}" stroke-width="1.4" opacity=".65"/>`;if(x2-x1>54)s+=`<text x="${((x1+x2)/2).toFixed(1)}" y="${(midY+5).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="800" font-family="Nunito,sans-serif" fill="${CP.maroon}">${z.side.toUpperCase()}</text>`;acc+=z.length;}
  const tb=8,th=11;
  s+=`<polygon points="${(midX-tb/2).toFixed(1)},${y0} ${(midX+tb/2).toFixed(1)},${y0} ${midX.toFixed(1)},${(y0+th).toFixed(1)}" fill="${CP.maroon}"/><polygon points="${(midX-tb/2).toFixed(1)},${(y0+drawW).toFixed(1)} ${(midX+tb/2).toFixed(1)},${(y0+drawW).toFixed(1)} ${midX.toFixed(1)},${(y0+drawW-th).toFixed(1)}" fill="${CP.maroon}"/><polygon points="${x0.toFixed(1)},${(midY-tb/2).toFixed(1)} ${x0.toFixed(1)},${(midY+tb/2).toFixed(1)} ${(x0+th).toFixed(1)},${midY.toFixed(1)}" fill="${CP.maroon}"/><polygon points="${(x0+drawL).toFixed(1)},${(midY-tb/2).toFixed(1)} ${(x0+drawL).toFixed(1)},${(midY+tb/2).toFixed(1)} ${(x0+drawL-th).toFixed(1)},${midY.toFixed(1)}" fill="${CP.maroon}"/>`;
  s+=`<rect x="${x0.toFixed(1)}" y="${y0}" width="${drawL.toFixed(1)}" height="${drawW.toFixed(1)}" rx="4" fill="none" stroke="${CP.maroon}" stroke-width="2.2"/>`;
  s+=`<text x="${x0.toFixed(1)}" y="${(y0-10).toFixed(1)}" font-size="12.5" font-weight="800" font-family="Nunito,sans-serif" fill="${CP.muted}">END SA ${cpFmt(pc.startAllowance)}</text><text x="${(x0+drawL).toFixed(1)}" y="${(y0-10).toFixed(1)}" text-anchor="end" font-size="12.5" font-weight="800" font-family="Nunito,sans-serif" fill="${CP.muted}">END SA ${cpFmt(pc.endAllowance)}</text></svg>`;
  return s;
}

/* Gusset mini + table */
function cpGussetHTML(m,p){
  const pc=m.gussetPiece;
  if(!pc)return {minis:"",tables:""};
  const minis=`<div class="cp-miniWrap">${cpGussetMapHTML(pc)}<div class="cp-mini"><div class="mlabel">${pc.label}</div><div class="mdims">${cpFmt(pc.cutLength)} L \u00D7 ${cpFmt(pc.cutWidth)} W</div></div></div>`;
  let rows=[
    cpProw("Length — cut",cpFmt(pc.cutLength),cpFmt(pc.runLength)),
    cpProw("Width — cut",cpFmt(pc.cutWidth),cpFmt(pc.finishedWidth))
  ];
  const tables=cpPieceBlock(pc.label,rows,"");
  return {minis,tables};
}

/* Stat card HTML */
function cpStat(k, v, d){
  return `<div class="cp-stat"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
}

/* ── Small React helpers for this page ──────────────────────────────── */
function CpSeg({ options, value, set }){
  return (
    <div className="cp-seg">
      {options.map(o => (
        <button key={o.id} className={value===o.id ? "on" : ""} onClick={()=>set(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

function cpSidePrintSpan(m,p){
  const pcs=m.displaySidePieces||[];
  if(!pcs.length)return null;
  const gap=.55,pad=.4;
  return {w:Math.max(...pcs.map(x=>x.cutLength))+pad*2,h:pcs.reduce((a,x)=>a+x.cutWidth,0)+gap*(pcs.length-1)+pad*2};
}
function cpGussetPrintSpan(m){
  const pc=m.gussetPiece;
  return pc?{w:pc.cutWidth+.8,h:pc.cutLength+.8}:null;
}
function CpResultBand({model,params}){
  const active=model.activeSew,open=params.topMode==="3side";
  const cutRunText=`Top ${cpFmt(model.cutRuns.top)} · Right ${cpFmt(model.cutRuns.right)} · Bottom ${cpFmt(model.cutRuns.bottom)} · Left ${cpFmt(model.cutRuns.left)}`;
  const sewnRunText=open?`Right ${cpFmt(active.runs.right)} · Bottom ${cpFmt(active.runs.bottom)} · Left ${cpFmt(active.runs.left)} · Top raw/open`:`Top ${cpFmt(active.runs.top)} · Right ${cpFmt(active.runs.right)} · Bottom ${cpFmt(active.runs.bottom)} · Left ${cpFmt(active.runs.left)}`;
  return <div className="cp-resultBand">
    <div className="cp-resultLine"><div className="cp-resultCell"><div className="rk">Panel Size</div><div className="rv">{cpFmt(model.cutBB.w)} W × {cpFmt(model.cutBB.h)} H</div></div><div className="cp-resultCell right"><div className="rk">Sewline</div><div className="rv">{cpFmt(active.bb.w)} W × {cpFmt(active.bb.h)} H</div></div></div>
    <div className="cp-resultLine"><div className="cp-resultCell"><div className="rk">Cut Perimeter</div><div className="rv">{cpFmt(model.cutPerim)}</div></div><div className="cp-resultCell right"><div className="rk">{open?"Sewline Length":"Sewline Perimeter"}</div><div className="rv">{cpFmt(active.total)}</div></div></div>
    <div className="cp-resultLine"><div className="cp-resultCell"><div className="rk">Side Lengths</div><div className="rv runs">{cutRunText}</div></div><div className="cp-resultCell right"><div className="rk">Sewn Side Lengths</div><div className="rv runs">{sewnRunText}</div></div></div>
  </div>;
}

// ── CURVED PANEL PAGE — validated geometry + compact diagram-led layout ──────
function CurvedPanelPage() {
  const th=T.advanced;
  const [tWW,setTWW]=useState(0),[tWF,setTWF]=useState(0);
  const [bWW,setBWW]=useState(0),[bWF,setBWF]=useState(0);
  const [hWW,setHWW]=useState(0),[hWF,setHWF]=useState(0);
  const [saW,setSaW]=useState(0),[saF,setSaF]=useState(DEFAULT_SA);
  const [lfW,setLfW]=useState(0),[lfF,setLfF]=useState(0);
  const [rfW,setRfW]=useState(0),[rfF,setRfF]=useState(0);
  const [tcW,setTcW]=useState(0),[tcF,setTcF]=useState(0);
  const [bcW,setBcW]=useState(0),[bcF,setBcF]=useState(0);
  const [matchingSides,setMatchingSides]=useState(true);
  const [feel,setFeel]=useState("gentle");
  const [tsW,setTsW]=useState(0),[tsF,setTsF]=useState(0);
  const [bsW,setBsW]=useState(0),[bsF,setBsF]=useState(0);
  const [sgView,setSgView]=useState("sides");
  const [topMode,setTopMode]=useState("4side");
  const [sdW,setSdW]=useState(0),[sdF,setSdF]=useState(0);
  const [gwW,setGwW]=useState(0),[gwF,setGwF]=useState(0);
  const [decMode,setDecMode]=useState(false);
  const diagramRef=useRef(null);
  const floatDockRef=useRef(null);
  const dragRef=useRef(null);
  const resizeRef=useRef(null);
  const [draggingFloat,setDraggingFloat]=useState(false);
  const [resizingFloat,setResizingFloat]=useState(false);
  const [floatDiagOpen,setFloatDiagOpen]=useState(true);
  const [floatPos,setFloatPos]=useState(()=>{
    if (typeof window === "undefined") return {x:18,y:86};
    try {
      const saved=JSON.parse(window.sessionStorage.getItem("cpFloatDiagramPosition")||"null");
      if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)) return saved;
    } catch {}
    return {x:Math.max(18,window.innerWidth-358),y:86};
  });
  const [floatSize,setFloatSize]=useState(()=>{
    if (typeof window === "undefined") return {w:340,h:355};
    try {
      const saved=JSON.parse(window.sessionStorage.getItem("cpFloatDiagramSize")||"null");
      if(saved&&Number.isFinite(saved.w)&&Number.isFinite(saved.h)) return saved;
    } catch {}
    return {w:340,h:355};
  });
  const [dockSide,setDockSide]=useState(()=>{
    if (typeof window === "undefined") return "right";
    try { const v=window.sessionStorage.getItem("cpFloatDiagramDock"); return v==="left"||v==="right"?v:"right"; } catch { return "right"; }
  });
  const [dockCollapsed,setDockCollapsed]=useState(true);
  const [canFloatDiag,setCanFloatDiag]=useState(()=>typeof window !== "undefined" ? window.innerWidth >= 900 : false);

  const lf=Math.max(0,lfW+lfF),rf=matchingSides?lf:Math.max(0,rfW+rfF);
  const params={
    topW:Math.max(1,tWW+tWF),botW:Math.max(1,bWW+bWF),height:Math.max(1,hWW+hWF),
    sa:Math.max(0,saW+saF),topCrown:Math.max(0,tcW+tcF),botCrown:Math.max(0,bcW+bcF),
    leftFull:lf,rightFull:rf,matchingSides,feel,topMode,
    topSoft:Math.max(0,tsW+tsF),botSoft:Math.max(0,bsW+bsF),
    sideDepth:Math.max(0,sdW+sdF),gussetW:Math.max(0,gwW+gwF)
  };
  const ready=(tWW+tWF)>0&&(bWW+bWF)>0&&(hWW+hWF)>0;
  const model=buildCurvedPanelModel(params);
  const sides=cpSidesHTML(model,params),gusset=cpGussetHTML(model,params);
  const hasDepth=params.sideDepth>0,hasGusset=params.gussetW>0;
  const panelPlan=cpTilePlan(model.cutBB.w+.8,model.cutBB.h+.8);
  const sideSpan=cpSidePrintSpan(model,params),sidePlan=sideSpan?cpTilePlan(sideSpan.w,sideSpan.h):null;
  const gusSpan=cpGussetPrintSpan(model),gusPlan=gusSpan?cpTilePlan(gusSpan.w,gusSpan.h):null;

  function clampFloatSize(size){
    if (typeof window === "undefined") return size;
    return {
      w:Math.max(280,Math.min(size.w,Math.min(620,window.innerWidth-20))),
      h:Math.max(250,Math.min(size.h,Math.min(720,window.innerHeight-20)))
    };
  }

  function clampFloatPosition(pos,size=floatSize){
    if (typeof window === "undefined") return pos;
    const safe=clampFloatSize(size),pad=10;
    return {
      x:Math.max(pad,Math.min(pos.x,window.innerWidth-safe.w-pad)),
      y:Math.max(pad,Math.min(pos.y,window.innerHeight-safe.h-pad))
    };
  }

  function resetFloatPosition(){
    if (typeof window === "undefined") return;
    const size=clampFloatSize({w:340,h:355});
    setFloatSize(size);
    setDockSide(null);
    setDockCollapsed(false);
    setFloatDiagOpen(true);
    setFloatPos(clampFloatPosition({x:window.innerWidth-size.w-18,y:86},size));
  }

  function closeFloatFeed(){
    const side=dockSide||"right";
    setDockSide(side);
    setDockCollapsed(true);
    setFloatDiagOpen(true);
  }

  function dockFloat(side){
    setDockSide(side);
    setDockCollapsed(true);
    setFloatDiagOpen(true);
  }

  function undockFloat(){
    if (typeof window === "undefined") return;
    setFloatDiagOpen(true);
    const rect=floatDockRef.current?.getBoundingClientRect();
    const size=clampFloatSize({w:rect?.width||floatSize.w,h:rect?.height||floatSize.h});
    setFloatSize(size);
    setDockSide(null);
    setDockCollapsed(false);
    setFloatPos(clampFloatPosition({x:Math.max(12,(window.innerWidth-size.w)/2),y:Math.max(74,rect?.top||86)},size));
  }


  function startFloatDrag(e){
    if(e.button!==undefined&&e.button!==0)return;
    if(e.target.closest("button"))return;
    if(dockSide)return;
    const rect=floatDockRef.current?.getBoundingClientRect();
    if(!rect)return;
    dragRef.current={dx:e.clientX-rect.left,dy:e.clientY-rect.top,lastX:e.clientX,lastY:e.clientY};
    setDraggingFloat(true);
    e.preventDefault();
  }

  function startFloatResize(e){
    if(e.button!==undefined&&e.button!==0)return;
    const rect=floatDockRef.current?.getBoundingClientRect();
    if(!rect)return;
    resizeRef.current={startX:e.clientX,startY:e.clientY,w:rect.width,h:rect.height,side:dockSide};
    setResizingFloat(true);
    e.preventDefault();
    e.stopPropagation();
  }


  useEffect(()=>{
    const onResize=()=>{
      setCanFloatDiag(window.innerWidth >= 900);
      setFloatSize(size=>clampFloatSize(size));
      if(!dockSide)setFloatPos(pos=>clampFloatPosition(pos));
    };
    onResize();
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[dockSide]);

  useEffect(()=>{ try { window.sessionStorage.setItem("cpFloatDiagramOpen", floatDiagOpen ? "1" : "0"); } catch {} },[floatDiagOpen]);
  useEffect(()=>{ try { window.sessionStorage.setItem("cpFloatDiagramPosition",JSON.stringify(floatPos)); } catch {} },[floatPos]);
  useEffect(()=>{ try { window.sessionStorage.setItem("cpFloatDiagramSize",JSON.stringify(floatSize)); } catch {} },[floatSize]);
  useEffect(()=>{ try { if(dockSide)window.sessionStorage.setItem("cpFloatDiagramDock",dockSide); else window.sessionStorage.removeItem("cpFloatDiagramDock"); } catch {} },[dockSide]);
  useEffect(()=>{ try { window.sessionStorage.setItem("cpFloatDiagramCollapsed",dockCollapsed ? "1" : "0"); } catch {} },[dockCollapsed]);

  useEffect(()=>{
    if(!draggingFloat)return;
    const move=e=>{
      const d=dragRef.current;
      if(!d)return;
      d.lastX=e.clientX; d.lastY=e.clientY;
      setFloatPos(clampFloatPosition({x:e.clientX-d.dx,y:e.clientY-d.dy}));
    };
    const stop=()=>{
      const d=dragRef.current;
      if(d&&d.lastX<=34)dockFloat("left");
      else if(d&&d.lastX>=window.innerWidth-34)dockFloat("right");
      dragRef.current=null;setDraggingFloat(false);
    };
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerup",stop,{once:true});
    window.addEventListener("pointercancel",stop,{once:true});
    return ()=>{
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerup",stop);
      window.removeEventListener("pointercancel",stop);
    };
  },[draggingFloat,floatSize]);

  useEffect(()=>{
    if(!resizingFloat)return;
    const move=e=>{
      const r=resizeRef.current;
      if(!r)return;
      const dx=r.side==="right"?r.startX-e.clientX:e.clientX-r.startX;
      const next=clampFloatSize({w:r.w+dx,h:r.h+(e.clientY-r.startY)});
      setFloatSize(next);
      if(!r.side)setFloatPos(pos=>clampFloatPosition(pos,next));
    };
    const stop=()=>{resizeRef.current=null;setResizingFloat(false);};
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerup",stop,{once:true});
    window.addEventListener("pointercancel",stop,{once:true});
    return ()=>{
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerup",stop);
      window.removeEventListener("pointercancel",stop);
    };
  },[resizingFloat,dockSide]);

  return (
    <div className="cp-wrap" style={{minHeight:"100vh",padding:"16px 16px 48px"}}>
      <div style={{background:th.sec,borderRadius:14,boxShadow:"0 4px 18px rgba(122,26,46,0.10)"}}>
        <SecHeader th={th} title="Curved Panel"
          sub="Build a free-form bag panel with sharp or rounded corners and sides that can be straight or gently curved. Create matching rectangular side panels for an open-top or fully enclosed bag, or generate one continuous gusset for either construction style. When your design is complete, print the full-size pattern."/>
        <div style={{padding:"12px 12px 18px"}}>
          <div className="cp-topbar">
            <div className="cp-hint" style={{margin:0}}>The live diagram and matching pattern pieces update as you shape the panel.</div>
            {!isMetric()&&<label className="cp-decToggle"><input type="checkbox" checked={decMode} onChange={e=>setDecMode(e.target.checked)}/>Decimal input</label>}
          </div>

          <div className="cp-controlGrid">
            <div className="cp-card cp-frameCard">
              <div className="cp-controlSection">
                <h2>Starting Frame</h2>
                <div className="cp-row">
                  <FracInput variant="cp" label="Top width" decMode={decMode} whole={tWW} frac={tWF} onWhole={setTWW} onFrac={setTWF}/>
                  <FracInput variant="cp" label="Bottom width" decMode={decMode} whole={bWW} frac={bWF} onWhole={setBWW} onFrac={setBWF}/>
                  <FracInput variant="cp" label="Panel height" decMode={decMode} whole={hWW} frac={hWF} onWhole={setHWW} onFrac={setHWF}/>
                  <FracInput variant="cp" label="Seam allowance" decMode={decMode} whole={saW} frac={saF} onWhole={setSaW} onFrac={setSaF}/>
                </div>
                <p className="cp-hint">These are design-intent dimensions. Actual cut and sewline sizes appear below the diagram.</p>
              </div>

              <div className="cp-controlSection">
                <h2>Edge Shape</h2>
                <div className="cp-edgeFields">
                  <FracInput variant="cp" label={matchingSides?"Left & right fullness":"Left fullness"} decMode={decMode} whole={lfW} frac={lfF} onWhole={setLfW} onFrac={setLfF}/>
                  <FracInput variant="cp" label="Right fullness" decMode={decMode} ghost={matchingSides} whole={rfW} frac={rfF} onWhole={setRfW} onFrac={setRfF}/>
                  <FracInput variant="cp" label="Top crown" decMode={decMode} whole={tcW} frac={tcF} onWhole={setTcW} onFrac={setTcF}/>
                  <FracInput variant="cp" label="Bottom crown" decMode={decMode} whole={bcW} frac={bcF} onWhole={setBcW} onFrac={setBcF}/>
                </div>
                <label className="cp-check"><input type="checkbox" checked={matchingSides} onChange={e=>setMatchingSides(e.target.checked)}/>Matching Sides</label>
                <div style={{fontSize:12.5,fontWeight:800,margin:"5px 0 3px"}}>Curve feel</div>
                <CpSeg value={feel} set={setFeel} options={[{id:"gentle",label:"Gentle"},{id:"balanced",label:"Balanced"},{id:"defined",label:"Defined"}]}/>
                <p className="cp-hint">Fullness and crown set midpoint depth. Curve feel changes only how broadly each edge eases.</p>
              </div>

              <div className="cp-lowerControls">
                <div className="cp-controlSection">
                  <h2>Corners</h2>
                  <div className="cp-row">
                    <FracInput variant="cp" label="Top softness" decMode={decMode} whole={tsW} frac={tsF} onWhole={setTsW} onFrac={setTsF}/>
                    <FracInput variant="cp" label="Bottom softness" decMode={decMode} whole={bsW} frac={bsF} onWhole={setBsW} onFrac={setBsF}/>
                  </div>
                  <p className="cp-hint">0 keeps the join crisp. Higher values soften only the corner transition.</p>
                </div>

                <div className="cp-controlSection">
                  <h2>Construction</h2>
                  <CpSeg value={topMode} set={setTopMode} options={[{id:"4side",label:"4-Sided Enclosed"},{id:"3side",label:"3-Sided Open Top"}]}/>
                  <p className="cp-hint">Open top follows Right → Bottom → Left and carries each side seam to the raw top edge.</p>
                </div>
              </div>
            </div>
          </div>

          {!ready&&<div className="cp-card" style={{textAlign:"center",padding:"28px 16px"}}>
            <div style={{fontSize:15,fontWeight:800,color:CP.rose}}>Enter top width, bottom width, and panel height to begin.</div>
          </div>}

          {ready&&<>
            {model.notes.length>0&&<div className="cp-warn">Automatic geometry adjustments:<ul>{model.notes.map((n,i)=><li key={i}>{n}</li>)}</ul></div>}
            <TrustBadge tone="cp" valid={model.valid}
              okMessage="✓ Geometry verified: cut path and active sewline are non-crossing, correctly oriented, and contained."
              lockLabel="Pattern output locked" errors={model.errors}/>

            <div className="cp-card cp-diagramCard" ref={diagramRef}>
              <svg viewBox="0 0 760 490" style={{width:"100%",height:"auto",display:"block"}} role="img" aria-label="Live curved panel diagram"
                dangerouslySetInnerHTML={{__html:cpPanelDiagramSVG(model,params)}}/>
              <p className="cp-diagLegend">▲ Center marks &nbsp; □ Side junctions &nbsp; ◇ Side midpoints &nbsp; Solid = cut &nbsp; Dashed = sewline</p>
              <p className={"cp-symline "+(model.symmetry?"yes":"no")}>Fold-friendly symmetry: {model.symmetry?"yes":"no"}</p>
            </div>

            <CpResultBand model={model} params={params}/>

            {canFloatDiag && floatDiagOpen && dockSide && dockCollapsed && <button
              className={"cp-dockTab "+dockSide}
              style={{top:Math.max(86,Math.min(floatPos.y,typeof window!=="undefined"?window.innerHeight-210:120))}}
              onClick={undockFloat} aria-label="Undock and open MoonShot Mission Control">
              <span className="cp-liveDot" style={{background:!model.valid?"#c23b47":model.notes.length?"#d89b24":"#2f9a62"}}/>
              Live Pattern Feed
            </button>}

            {canFloatDiag && floatDiagOpen && !(dockSide&&dockCollapsed) && <div
              ref={floatDockRef}
              className={"cp-floatDock"+(draggingFloat?" dragging":"")+(resizingFloat?" resizing":"")+(dockSide?" docked-"+dockSide:"")}
              style={dockSide?{
                [dockSide]:0,
                top:Math.max(72,Math.min(floatPos.y,typeof window!=="undefined"?window.innerHeight-Math.min(floatSize.h,window.innerHeight-82)-10:86)),
                width:floatSize.w,height:typeof window!=="undefined"?Math.min(floatSize.h,window.innerHeight-82):floatSize.h
              }:{left:floatPos.x,top:floatPos.y,width:floatSize.w,height:floatSize.h}}>
              <div className="cp-floatHead" onPointerDown={startFloatDrag}>
                <div className="cp-missionBrand">
                  <span className="cp-liveDot" style={{background:!model.valid?"#c23b47":model.notes.length?"#d89b24":"#2f9a62"}}/>
                  <div className="cp-missionText">
                    <div className="cp-missionTitle">MoonShot Mission Control</div>
                    <div className="cp-missionFeed">Live Pattern Feed</div>
                  </div>
                </div>
                <button className="cp-floatClose" onPointerDown={e=>e.stopPropagation()} onClick={closeFloatFeed} aria-label="Close live pattern feed" title="Close">×</button>
              </div>
              <div className="cp-floatNav">
                <button onClick={()=>dockFloat("left")} aria-label="Dock and collapse live pattern feed left">← Dock Left</button>
                <button onClick={resetFloatPosition} aria-label="Recenter live pattern feed">ReCenter</button>
                <button onClick={()=>dockFloat("right")} aria-label="Dock and collapse live pattern feed right">Dock Right →</button>
              </div>
              <div className="cp-floatBody">
                <svg viewBox="0 0 760 490" style={{width:"100%",height:"auto",display:"block"}} role="img" aria-label="MoonShot Mission Control live pattern feed"
                  dangerouslySetInnerHTML={{__html:cpPanelDiagramSVG(model,params)}}/>
                <div className="cp-floatMeta">{cpFmt(model.cutBB.w)} W × {cpFmt(model.cutBB.h)} H cut · {cpFmt(params.sa)} seam allowance · {params.topMode==="3side"?"3-sided open top":"4-sided enclosed"}</div>
              </div>
              <div className={"cp-resizeHandle "+(dockSide==="right"?"left":"right")} onPointerDown={startFloatResize} aria-hidden="true"/>
            </div>}

            <div className="cp-card" style={{marginTop:8}}>
              <h2>Matching Pieces</h2>
              <div style={{marginBottom:7}}><CpSeg value={sgView} set={setSgView} options={[{id:"sides",label:"Side Panels"},{id:"gusset",label:"Gusset"}]}/></div>
              {sgView==="sides"?<>
                <div className="cp-row"><FracInput variant="cp" label="Finished side depth" decMode={decMode} whole={sdW} frac={sdF} onWhole={setSdW} onFrac={setSdF}/></div>
                <p className="cp-hint">Assumes a constant finished depth and two matching main panels.</p>
                {hasDepth&&model.valid?<>
                  <div dangerouslySetInnerHTML={{__html:sides.minis}}/><div dangerouslySetInnerHTML={{__html:sides.tables}}/>
                </>:<p className="cp-hint">{model.valid?"Enter a finished side depth to generate the pieces.":"Correct the geometry above before side pieces are generated."}</p>}
              </>:<>
                <div className="cp-row"><FracInput variant="cp" label="Finished gusset width" decMode={decMode} whole={gwW} frac={gwF} onWhole={setGwW} onFrac={setGwF}/></div>
                {hasGusset&&model.valid?<>
                  <div dangerouslySetInnerHTML={{__html:gusset.minis}}/><div dangerouslySetInnerHTML={{__html:gusset.tables}}/>
                </>:<p className="cp-hint">{model.valid?"Enter a finished gusset width to generate the strip.":"Correct the geometry above before the gusset is generated."}</p>}
              </>}
            </div>

            <div className="cp-card">
              <h2>Print Patterns</h2>
              <div className="cp-printGrid">
                <div className="cp-printCard">
                  <div className="pt">Main Panel</div><div className="pm">Actual cut path, active sewline, match marks, dimensions, and test squares.</div>
                  <PrintButton tone="cp" small label="Print Main Panel" meta={cpTileLabel(panelPlan)} disabled={!model.valid} onClick={()=>cpPrintPanel(model,params)}/>
                </div>
                <div className="cp-printCard">
                  <div className="pt">Side Panels</div><div className="pm">Exact matching strips with raw-top orientation and suggested clip/notch marks.</div>
                  <PrintButton tone="cp" small label="Print Side Panels" meta={sidePlan?cpTileLabel(sidePlan):"Add finished side depth"} disabled={!model.valid||!hasDepth||!sidePlan} onClick={()=>cpPrintSides(model,params)}/>
                </div>
                <div className="cp-printCard">
                  <div className="pt">Gusset</div><div className="pm">One continuous strip with side zones, end allowances, match marks, and tiling.</div>
                  <PrintButton tone="cp" small label="Print Gusset" meta={gusPlan?cpTileLabel(gusPlan):"Add finished gusset width"} disabled={!model.valid||!hasGusset||!gusPlan} onClick={()=>cpPrintGusset(model,params)}/>
                </div>
              </div>
            </div>
          </>}

        </div>
      </div>
    </div>
  );
}




// ══════════════════════════════════════════════════════════════════════════════
// ── BOXED CORNER — finished-size calculator ──────────────────────────────────
// Geometry core lives in ./boxed-corner-core.js. This section is UI + print.
// ══════════════════════════════════════════════════════════════════════════════

const BC = {
  pumpkin:"#a84f14", pumpkinDark:"#763407", amber:"#ca6b27",
  cream:"#fffaf6", soft:"#f6e3d4", line:"#e6b88f", ink:"#4d2a15",
  muted:"#9a6b4e", green:"#1d6b45", stabilizer:"#3f7d6d", center:"#6c4f8c",
  warnBg:"#fff4df", warnLine:"#e6bf73", warnInk:"#7b4d08",
};
const BC_THEME={
  sec:BC.soft,hdr:BC.pumpkin,hdrTxt:"#fff",card:BC.cream,border:BC.line,
  label:BC.pumpkinDark,sub:BC.muted,accent:BC.pumpkin,inputBg:"#fbf1e9",inputTxt:BC.ink,
  resBg:"#efcdb3",resAccent:BC.pumpkinDark,resTxt:BC.ink,btnOn:BC.pumpkin,btnOnTxt:"#fff",
  btnOff:"#efd5bf",btnOffTxt:BC.pumpkinDark,info:BC.soft,infoBdr:BC.line,infoTxt:BC.ink,
  ok:"#e0f5ea",okBdr:"#5aaa80",okTxt:"#1a5c38",warn:BC.warnBg,warnBdr:BC.warnLine,warnTxt:BC.warnInk,
  nudgeBg:"#efd5bf",nudgeTxt:BC.pumpkinDark,pageBg:"#faf0e8",
};
function bcFmt(v){ return isMetric()?fmtCm(v):bcFmtIn(v); }
function bcFmtD(v){ return isMetric()?fmtCm(v):bcFmtDec(v); }

function BcSeg({options,value,set}){return <div className="bc-seg">{options.map(o=><button key={o.id} className={value===o.id?"on":""} onClick={()=>set(o.id)}>{o.label}</button>)}</div>;}

function bcRightAngleSVG(marker,X,Y,scale){
  const q=7,at={x:X(marker.at.x),y:Y(marker.at.y)};
  const e={x:marker.edgeDir.x*q,y:marker.edgeDir.y*q},c={x:marker.cutDir.x*q,y:marker.cutDir.y*q};
  return `<path d="M ${(at.x+e.x).toFixed(1)} ${(at.y+e.y).toFixed(1)} L ${(at.x+e.x+c.x).toFixed(1)} ${(at.y+e.y+c.y).toFixed(1)} L ${(at.x+c.x).toFixed(1)} ${(at.y+c.y).toFixed(1)}" fill="none" stroke="${BC.amber}" stroke-width="1.4"/>`;
}
function bcPanelDiagramSVG(m){
  const VW=760,VH=520,PAD=38,bb=m.cutBB,sc=Math.min((VW-PAD*2)/Math.max(bb.w,.001),(VH-PAD*2)/Math.max(bb.h,.001));
  const ox=(VW-bb.w*sc)/2-bb.minX*sc,oy=(VH-bb.h*sc)/2-bb.minY*sc,X=v=>v*sc+ox,Y=v=>v*sc+oy,map=pts=>pts.map(p=>({x:X(p.x),y:Y(p.y)}));
  let s=`<path d="${bcPtsToPath(map(m.cutPts),true)}" fill="#f7dfcd" fill-opacity=".52" stroke="none"/>`;
  for(const rp of m.removedPolys||[]) s+=`<path d="${bcPtsToPath(map(rp.pts),true)}" fill="#f6e3d4" fill-opacity=".72" stroke="#d69a6b" stroke-width="1.3" stroke-dasharray="5 4"/>`;
  if(m.stabilizer?.enabled&&m.stabilizer.valid&&m.stabilizer.pts?.length)s+=`<path d="${bcPtsToPath(map(m.stabilizer.pts),true)}" fill="none" stroke="${BC.stabilizer}" stroke-width="2.2" stroke-dasharray="12 5 2 5"/>`;
  for(const line of m.stitchLines||[])s+=`<path d="${bcPtsToPath(map(line.pts),false)}" fill="none" stroke="#858585" stroke-width="2" stroke-dasharray="9 7" stroke-linecap="round"/>`;
  if(m.centerLine){
    s+=`<line x1="${X(m.centerLine.a.x)}" y1="${Y(m.centerLine.a.y)}" x2="${X(m.centerLine.b.x)}" y2="${Y(m.centerLine.b.y)}" stroke="${BC.center}" stroke-width="2" stroke-dasharray="15 6 3 6"/>`;
    const cy=(Y(m.centerLine.a.y)+Y(m.centerLine.b.y))/2;
    s+=`<text x="${X(0)+10}" y="${cy}" transform="rotate(-90 ${X(0)+10} ${cy})" text-anchor="middle" font-family="Nunito,sans-serif" font-size="12" font-weight="900" fill="${BC.center}">CENTER / PLACE ON FOLD</text>`;
  }
  if(m.foldLine){s+=`<line x1="${X(m.foldLine.a.x)}" y1="${Y(m.foldLine.y)}" x2="${X(m.foldLine.b.x)}" y2="${Y(m.foldLine.y)}" stroke="#00a9b8" stroke-width="2.3" stroke-dasharray="10 6"/>`;s+=`<text x="${X((m.foldLine.a.x+m.foldLine.b.x)/2)}" y="${Y(m.foldLine.y)-8}" text-anchor="middle" font-family="Nunito,sans-serif" font-size="13" font-weight="900" fill="#007783">BOTTOM FOLD</text>`;}
  s+=`<path d="${bcPtsToPath(map(m.cutPts),true)}" fill="none" stroke="${BC.pumpkin}" stroke-width="3.4" stroke-linejoin="round"/>`;
  for(const r of m.rightAngles||[])s+=bcRightAngleSVG(r,X,Y,sc);
  const c=m.construction.bottomCorner.left,mid1={x:(c.sideFoot.x+c.meet.x)/2,y:(c.sideFoot.y+c.meet.y)/2},mid2={x:(c.meet.x+c.edgeFoot.x)/2,y:(c.meet.y+c.edgeFoot.y)/2};
  s+=`<text x="${X(mid1.x)-8}" y="${Y(mid1.y)-7}" text-anchor="end" font-family="DM Mono,monospace" font-size="12" font-weight="500" fill="${BC.pumpkinDark}">${bcFmt(m.construction.bottomCorner.sideLegCut)}</text>`;
  s+=`<text x="${X(mid2.x)+9}" y="${Y(mid2.y)}" text-anchor="start" font-family="DM Mono,monospace" font-size="12" font-weight="500" fill="${BC.pumpkinDark}">${bcFmt(m.construction.bottomCorner.edgeLegCut)}</text>`;
  s+=`<text x="${VW/2}" y="${VH-8}" text-anchor="middle" font-family="Nunito,sans-serif" font-size="13" font-weight="800" fill="${BC.muted}">Cut envelope ${bcFmt(m.cutBB.w)} W × ${bcFmt(m.cutBB.h)} H · ${m.labels.layout}</text>`;
  return s;
}

function bcPrintDoc(title,geom,spanW,spanH,rows,legend){
  const plan=cpTilePlan(spanW,spanH,true);let draw=geom;if(plan.rotated)draw=`<g transform="translate(${spanH.toFixed(4)} 0) rotate(90)">${geom}</g>`;let tiles="";
  for(let r=0;r<plan.rows;r++)for(let c=0;c<plan.cols;c++){
    const vx=c*CP_TILE_W,vy=r*CP_TILE_H,label=cpRowLabel(r)+(c+1),last=r===plan.rows-1&&c===plan.cols-1;let inner=draw;
    inner+=`<rect x="${vx}" y="${vy}" width="${CP_TILE_W}" height="${CP_TILE_H}" fill="none" stroke="#000" stroke-width="0.025"/>`+cpRegistrationMarks(vx,vy,CP_TILE_W,CP_TILE_H);
    const L=c>0?cpRowLabel(r)+c:null,R=c<plan.cols-1?cpRowLabel(r)+(c+2):null,U=r>0?cpRowLabel(r-1)+(c+1):null,D=r<plan.rows-1?cpRowLabel(r+1)+(c+1):null;
    if(L)inner+=`<text x="${vx+.08}" y="${vy+CP_TILE_H/2}" font-size=".12" font-weight="700" font-family="Nunito,sans-serif" fill="#777">← ${L}</text>`;if(R)inner+=`<text x="${vx+CP_TILE_W-.08}" y="${vy+CP_TILE_H/2}" font-size=".12" font-weight="700" font-family="Nunito,sans-serif" fill="#777" text-anchor="end">${R} →</text>`;if(U)inner+=`<text x="${vx+CP_TILE_W/2}" y="${vy+.15}" font-size=".12" font-weight="700" font-family="Nunito,sans-serif" fill="#777" text-anchor="middle">↑ ${U}</text>`;if(D)inner+=`<text x="${vx+CP_TILE_W/2}" y="${vy+CP_TILE_H-.08}" font-size=".12" font-weight="700" font-family="Nunito,sans-serif" fill="#777" text-anchor="middle">↓ ${D}</text>`;
    tiles+=`<div class="tile${last?" last":""}"><div class="tlabel">${title} — ${label}</div><svg width="${CP_TILE_W}in" height="${CP_TILE_H}in" viewBox="${vx} ${vy} ${CP_TILE_W} ${CP_TILE_H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg></div>`;
  }
  const details=rows.map(x=>`<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`).join(""),w=window.open("","_blank");if(!w){window.alert("The print window was blocked. Allow pop-ups, then try again.");return;}
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>@page{margin:.5in}body{font-family:Nunito,system-ui,sans-serif;margin:0;color:#222}.page,.tile{page-break-after:always}.tile.last{page-break-after:auto}.tlabel{padding:3pt 0 0;font-size:7pt;font-weight:700;text-align:center}.tile svg{display:block;margin:0 auto}h1{font-size:15pt;margin:0 0 3pt;color:${BC.pumpkin}}h2{font-size:10pt;margin:0 0 8pt;color:#555}table{border-collapse:collapse;width:100%;font-size:10pt}td{border:1px solid #ddd;padding:4pt 7pt}td:first-child{font-weight:700;width:38%}.note{font-size:11pt;font-weight:800;margin-top:9pt;line-height:1.5}.legend{font-size:7.5pt;color:#444;margin-top:5pt}</style></head><body><div class="page"><h1>${title}</h1><h2>MoonShot Bag Calculator · ${plan.pages} pattern page${plan.pages===1?"":"s"} · ${plan.rows} × ${plan.cols} · 7″ × 9.68″ printable tiles${plan.rotated?" · auto-rotated":""}</h2><p style="font-size:9pt;font-weight:700;color:#555;margin:0 0 2pt">Verify both test squares before cutting fabric:</p>${cpTestSquareSVG()}<table>${details}</table><p class="legend">${legend}</p><p class="note">Print at 100% or Actual Size. Turn off Fit to Page, scaling, and browser headers/footers. Verify both test squares. Assemble matching tile edges using page labels and registration crosses.</p></div>${tiles}</body></html>`);w.document.close();const fire=()=>{const ready=w.document.fonts?.ready||Promise.resolve();ready.then(()=>setTimeout(()=>w.print(),80));};if(w.document.readyState==="complete")fire();else w.addEventListener("load",fire,{once:true});
}
function bcPrintPanel(m,includeStabilizer=false){
  if(!m.valid)return;const P=.4,ox=m.cutBB.minX-P,oy=m.cutBB.minY-P,shift=pts=>pts.map(q=>({x:q.x-ox,y:q.y-oy}));let g="";
  for(const line of m.stitchLines||[])g+=`<path d="${bcPtsToPath(shift(line.pts),false)}" fill="none" stroke="#888" stroke-width=".022" stroke-dasharray=".15 .10" stroke-linecap="round"/>`;
  if(includeStabilizer&&m.stabilizer?.valid)g+=`<path d="${bcPtsToPath(shift(m.stabilizer.pts),true)}" fill="none" stroke="${BC.stabilizer}" stroke-width=".028" stroke-dasharray=".22 .09 .04 .09"/>`;
  if(m.centerLine){const a={x:m.centerLine.a.x-ox,y:m.centerLine.a.y-oy},b={x:m.centerLine.b.x-ox,y:m.centerLine.b.y-oy},mx=(a.x+b.x)/2,my=(a.y+b.y)/2;g+=`<line x1="${a.x.toFixed(4)}" y1="${a.y.toFixed(4)}" x2="${b.x.toFixed(4)}" y2="${b.y.toFixed(4)}" stroke="${BC.center}" stroke-width=".024" stroke-dasharray=".28 .12 .05 .12"/>`;g+=`<text x="${(mx+.12).toFixed(4)}" y="${my.toFixed(4)}" transform="rotate(-90 ${(mx+.12).toFixed(4)} ${my.toFixed(4)})" font-size=".12" font-weight="800" font-family="Nunito,sans-serif" fill="${BC.center}" text-anchor="middle">CENTER / PLACE ON FOLD</text>`;}
  if(m.foldLine)g+=`<line x1="${(m.foldLine.a.x-ox).toFixed(4)}" y1="${(m.foldLine.y-oy).toFixed(4)}" x2="${(m.foldLine.b.x-ox).toFixed(4)}" y2="${(m.foldLine.y-oy).toFixed(4)}" stroke="#00a9b8" stroke-width=".024" stroke-dasharray=".2 .12"/>`;
  g+=`<path d="${bcPtsToPath(shift(m.cutPts),true)}" fill="none" stroke="${BC.pumpkin}" stroke-width=".04" stroke-linejoin="round"/>`;
  for(const r of m.rightAngles){const at={x:r.at.x-ox,y:r.at.y-oy},q=.10,e={x:r.edgeDir.x*q,y:r.edgeDir.y*q},c={x:r.cutDir.x*q,y:r.cutDir.y*q};g+=`<path d="M ${(at.x+e.x).toFixed(4)} ${(at.y+e.y).toFixed(4)} L ${(at.x+e.x+c.x).toFixed(4)} ${(at.y+e.y+c.y).toFixed(4)} L ${(at.x+c.x).toFixed(4)} ${(at.y+c.y).toFixed(4)}" fill="none" stroke="${BC.pumpkin}" stroke-width=".016"/>`;}
  const c=m.construction.bottomCorner,rows=[["Finished size",`${bcFmt(m.checks.topW)} top · ${bcFmt(m.checks.botW)} bottom · ${bcFmt(m.checks.height)} H · ${bcFmt(m.checks.depth)} D`],["Panel cut envelope",`${bcFmt(m.cutBB.w)} W × ${bcFmt(m.cutBB.h)} H`],["Cut quantity",`${m.quantity} · ${m.labels.layout}`],["Bottom corner — from side",bcFmt(c.sideLegCut)],[m.params.layout==="fold"?"Bottom corner — from fold":"Bottom corner — from bottom edge",bcFmt(c.edgeLegCut)],["Usable matched legs after side/bottom seam",`${bcFmt(c.sideLegFinished)} + ${bcFmt(c.edgeLegFinished)}`],["Seam allowance",bcFmt(m.params.sa)],["Construction",`${m.labels.shape} · ${m.labels.topMode}`]];
  if(includeStabilizer&&m.stabilizer?.valid)rows.push(["Stabilizer overlay",`${bcFmt(m.stabilizer.offset)} inside fabric cut edge`]);
  const stabLegend=includeStabilizer&&m.stabilizer?.valid?` · green dash-dot = stabilizer cut line`:"";
  bcPrintDoc("Boxed Corner — Main Panel",g,m.cutBB.w+P*2,m.cutBB.h+P*2,rows,`Pumpkin solid = fabric cut · grey dashed = assembly stitch lines only · purple dash-dot = center / place on fold · cyan dashed = bottom fold${stabLegend}. Small corner symbols confirm that each box-cut leg leaves its source edge at 90°.`);
}
function bcPrintStabilizer(m){
  if(!m.valid||!m.stabilizer?.enabled||!m.stabilizer.valid)return;const P=.4,bb=m.stabilizer.bb,ox=bb.minX-P,oy=bb.minY-P,shift=pts=>pts.map(q=>({x:q.x-ox,y:q.y-oy}));let g="";
  if(m.stabilizer.centerLine){const a={x:m.stabilizer.centerLine.a.x-ox,y:m.stabilizer.centerLine.a.y-oy},b={x:m.stabilizer.centerLine.b.x-ox,y:m.stabilizer.centerLine.b.y-oy},mx=(a.x+b.x)/2,my=(a.y+b.y)/2;g+=`<line x1="${a.x.toFixed(4)}" y1="${a.y.toFixed(4)}" x2="${b.x.toFixed(4)}" y2="${b.y.toFixed(4)}" stroke="${BC.center}" stroke-width=".024" stroke-dasharray=".28 .12 .05 .12"/>`;g+=`<text x="${(mx+.12).toFixed(4)}" y="${my.toFixed(4)}" transform="rotate(-90 ${(mx+.12).toFixed(4)} ${my.toFixed(4)})" font-size=".12" font-weight="800" font-family="Nunito,sans-serif" fill="${BC.center}" text-anchor="middle">CENTER / PLACE ON FOLD</text>`;}
  if(m.stabilizer.foldLine)g+=`<line x1="${(m.stabilizer.foldLine.a.x-ox).toFixed(4)}" y1="${(m.stabilizer.foldLine.a.y-oy).toFixed(4)}" x2="${(m.stabilizer.foldLine.b.x-ox).toFixed(4)}" y2="${(m.stabilizer.foldLine.b.y-oy).toFixed(4)}" stroke="#00a9b8" stroke-width=".024" stroke-dasharray=".2 .12"/>`;
  g+=`<path d="${bcPtsToPath(shift(m.stabilizer.pts),true)}" fill="none" stroke="${BC.stabilizer}" stroke-width=".04" stroke-linejoin="round"/>`;
  const rows=[["Stabilizer cut envelope",`${bcFmt(bb.w)} W × ${bcFmt(bb.h)} H`],["Offset from fabric cut edge",bcFmt(m.stabilizer.offset)],["Cut quantity",`${m.quantity} · ${m.labels.layout}`],["Fabric finished size",`${bcFmt(m.checks.topW)} top · ${bcFmt(m.checks.botW)} bottom · ${bcFmt(m.checks.height)} H · ${bcFmt(m.checks.depth)} D`],["Construction",`${m.labels.shape} · ${m.labels.topMode}`]];
  bcPrintDoc("Boxed Corner — Stabilizer",g,bb.w+P*2,bb.h+P*2,rows,"Green solid = stabilizer cut line · purple dash-dot = center / place on fold · cyan dashed = bottom fold.");
}

function BcResultBand({m}){const c=m.construction.bottomCorner;return <><div className="bc-resultBand"><div className="bc-resultLine"><div className="bc-resultCell"><div className="rk">Panel Cut Envelope</div><div className="rv">{bcFmt(m.cutBB.w)} W × {bcFmt(m.cutBB.h)} H</div></div><div className="bc-resultCell"><div className="rk">Cut Quantity</div><div className="rv">{m.quantity} · {m.labels.layout}</div></div></div><div className="bc-resultLine"><div className="bc-resultCell"><div className="rk">Corner From Side Edge</div><div className="rv">{bcFmt(c.sideLegCut)}</div></div><div className="bc-resultCell"><div className="rk">Corner From {m.params.layout==="fold"?"Fold":"Bottom Edge"}</div><div className="rv">{bcFmt(c.edgeLegCut)}</div></div></div><div className="bc-resultLine"><div className="bc-resultCell"><div className="rk">Matched After Sewing</div><div className="rv small">{bcFmt(c.sideLegFinished)} side · {bcFmt(c.edgeLegFinished)} bottom/fold</div></div><div className="bc-resultCell"><div className="rk">Construction</div><div className="rv small">{m.labels.shape} · {m.labels.topMode}</div></div></div>{m.stabilizer?.enabled&&m.stabilizer.valid&&<div className="bc-resultLine"><div className="bc-resultCell"><div className="rk">Stabilizer Cut Envelope</div><div className="rv">{bcFmt(m.stabilizer.bb.w)} W × {bcFmt(m.stabilizer.bb.h)} H</div></div><div className="bc-resultCell"><div className="rk">Stabilizer Offset</div><div className="rv">{bcFmt(m.stabilizer.offset)}</div></div></div>}</div><div className="bc-checkGrid">{[["Top",m.checks.topW],["Bottom",m.checks.botW],["Height",m.checks.height],["Depth",m.checks.depth]].map(x=><div className="bc-check" key={x[0]}><div className="k">Finished {x[0]}</div><div className="v">{bcFmt(x[1])} ✓</div></div>)}</div></>}


function BoxedCornerPage(){
  const th=BC_THEME;
  const [twW,setTwW]=useState(7),[twF,setTwF]=useState(0);const [bwW,setBwW]=useState(10),[bwF,setBwF]=useState(0);const [hW,setHW]=useState(8),[hF,setHF]=useState(0);const [dW,setDW]=useState(4),[dF,setDF]=useState(0);const [saW,setSaW]=useState(0),[saF,setSaF]=useState(DEFAULT_SA);
  const [layout,setLayout]=useState("two"),[shape,setShape]=useState("rect"),[topMode,setTopMode]=useState("open"),[decMode,setDecMode]=useState(false);
  const [stabEnabled,setStabEnabled]=useState(false),[stabW,setStabW]=useState(0),[stabF,setStabF]=useState(DEFAULT_SA),[stabPrintMode,setStabPrintMode]=useState("overlay");
  const floatRef=useRef(null),dragRef=useRef(null),resizeRef=useRef(null);const [dragging,setDragging]=useState(false),[resizing,setResizing]=useState(false),[floatOpen,setFloatOpen]=useState(true),[canFloat,setCanFloat]=useState(()=>typeof window!=="undefined"?window.innerWidth>=900:false),[dockSide,setDockSide]=useState("right"),[collapsed,setCollapsed]=useState(true);
  const [floatPos,setFloatPos]=useState(()=>({x:typeof window!=="undefined"?Math.max(18,window.innerWidth-358):18,y:86}));const [floatSize,setFloatSize]=useState({w:340,h:355});
  const sa=saW+saF,stabilizerOffset=stabW+stabF;
  const setStabilizerValue=v=>{const n=Math.max(0,+v||0),w=Math.floor(n);setStabW(w);setStabF(n-w);};
  const params={topW:shape==="rect"?bwW+bwF:twW+twF,botW:bwW+bwF,height:hW+hF,depth:dW+dF,sa,layout,shape,topMode,stabilizerEnabled:stabEnabled,stabilizerOffset};
  const m=buildBoxedCornerModel(params),plan=cpTilePlan(m.cutBB.w+.8,m.cutBB.h+.8),stabPlan=m.stabilizer?.valid&&m.stabilizer.bb?cpTilePlan(m.stabilizer.bb.w+.8,m.stabilizer.bb.h+.8):null;
  const overlayRequested=stabEnabled&&stabPrintMode==="overlay",overlayStabilizer=overlayRequested&&m.stabilizer.valid;
  const clampSize=z=>typeof window==="undefined"?z:{w:Math.max(280,Math.min(z.w,Math.min(620,window.innerWidth-20))),h:Math.max(250,Math.min(z.h,Math.min(720,window.innerHeight-20)))};const clampPos=(z,size=floatSize)=>{if(typeof window==="undefined")return z;const q=clampSize(size),p=10;return{x:Math.max(p,Math.min(z.x,window.innerWidth-q.w-p)),y:Math.max(p,Math.min(z.y,window.innerHeight-q.h-p))}};
  const dock=x=>{setDockSide(x);setCollapsed(true);setFloatOpen(true)};const undock=()=>{if(typeof window==="undefined")return;const r=floatRef.current?.getBoundingClientRect(),sz=clampSize({w:r?.width||floatSize.w,h:r?.height||floatSize.h});setFloatSize(sz);setDockSide(null);setCollapsed(false);setFloatPos(clampPos({x:Math.max(12,(window.innerWidth-sz.w)/2),y:Math.max(74,r?.top||86)},sz));};
  const reset=()=>{if(typeof window==="undefined")return;const sz=clampSize({w:340,h:355});setFloatSize(sz);setDockSide(null);setCollapsed(false);setFloatOpen(true);setFloatPos(clampPos({x:window.innerWidth-sz.w-18,y:86},sz));};
  const startDrag=e=>{if((e.button!==undefined&&e.button!==0)||e.target.closest("button")||dockSide)return;const r=floatRef.current?.getBoundingClientRect();if(!r)return;dragRef.current={dx:e.clientX-r.left,dy:e.clientY-r.top,lastX:e.clientX};setDragging(true);e.preventDefault();};const startResize=e=>{const r=floatRef.current?.getBoundingClientRect();if(!r)return;resizeRef.current={x:e.clientX,y:e.clientY,w:r.width,h:r.height,side:dockSide};setResizing(true);e.preventDefault();e.stopPropagation();};
  useEffect(()=>{const f=()=>{setCanFloat(window.innerWidth>=900);setFloatSize(x=>clampSize(x));if(!dockSide)setFloatPos(x=>clampPos(x));};f();window.addEventListener("resize",f);return()=>window.removeEventListener("resize",f)},[dockSide]);
  useEffect(()=>{if(!dragging)return;const move=e=>{const d=dragRef.current;if(!d)return;d.lastX=e.clientX;setFloatPos(clampPos({x:e.clientX-d.dx,y:e.clientY-d.dy}))};const stop=()=>{const d=dragRef.current;if(d?.lastX<=34)dock("left");else if(d?.lastX>=window.innerWidth-34)dock("right");dragRef.current=null;setDragging(false)};window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop,{once:true});return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop)}},[dragging,floatSize]);
  useEffect(()=>{if(!resizing)return;const move=e=>{const r=resizeRef.current;if(!r)return;const dx=r.side==="right"?r.x-e.clientX:e.clientX-r.x,next=clampSize({w:r.w+dx,h:r.h+e.clientY-r.y});setFloatSize(next);if(!r.side)setFloatPos(x=>clampPos(x,next))};const stop=()=>{resizeRef.current=null;setResizing(false)};window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop,{once:true});return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop)}},[resizing,dockSide]);
  return <div className="bc-wrap" style={{minHeight:"100vh",padding:"16px 16px 48px"}}><div style={{background:th.sec,borderRadius:14,boxShadow:"0 4px 18px rgba(118,52,7,.11)"}}><SecHeader th={th} title="Boxed Corner" sub="Work backward from finished width, height, and depth. Rectangle and tapered panels use the same trusted corner model; folded pieces are mirrored exactly across the bottom fold."/><div style={{padding:"12px 12px 18px"}}><div className="bc-topbar"><div className="bc-hint" style={{margin:0}}>The diagram, dimension checks, and full-size print pattern all use the same geometry model.</div>{!isMetric()&&<label className="bc-decToggle"><input type="checkbox" checked={decMode} onChange={e=>setDecMode(e.target.checked)}/>Decimal input</label>}</div>
    <div className="bc-card"><div className="bc-controlSection"><h2>Finished Dimensions</h2><div className="bc-row"><FracInput variant="bc" label="Top width" ghost={shape==="rect"} decMode={decMode} whole={shape==="rect"?bwW:twW} frac={shape==="rect"?bwF:twF} onWhole={setTwW} onFrac={setTwF}/><FracInput variant="bc" label="Bottom width" decMode={decMode} whole={bwW} frac={bwF} onWhole={setBwW} onFrac={setBwF}/><FracInput variant="bc" label="Height" decMode={decMode} whole={hW} frac={hF} onWhole={setHW} onFrac={setHF}/><FracInput variant="bc" label="Depth" decMode={decMode} whole={dW} frac={dF} onWhole={setDW} onFrac={setDF}/><FracInput variant="bc" label="Seam allowance" decMode={decMode} whole={saW} frac={saF} onWhole={setSaW} onFrac={setSaF}/></div><p className="bc-hint">For a rectangle, top width follows bottom width. A trapezoid may use different top and bottom widths.</p></div><div className="bc-lowerControls"><div className="bc-controlSection"><h2>Panel Layout</h2><BcSeg value={layout} set={setLayout} options={[{id:"two",label:"2 Separate Panels"},{id:"fold",label:"1 Mirrored Fold"}]}/><p className="bc-hint">The folded piece has no bottom seam allowance. Its side-edge corner leg still includes seam allowance so both boxed edges match after the side seam is sewn.</p></div><div className="bc-controlSection"><h2>Shape & Top</h2><BcSeg value={shape} set={setShape} options={[{id:"rect",label:"Rectangle"},{id:"trap",label:"Trapezoid"}]}/><div style={{height:6}}/><BcSeg value={topMode} set={setTopMode} options={[{id:"open",label:"Open Top"},{id:"enclosed",label:"Top Boxed"}]}/><p className="bc-hint">Every trapezoid box-cut leg leaves its own source edge at 90°; the two legs meet at the finished face corner.</p></div></div></div>
    <div className="bc-card"><div className="bc-controlSection"><h2>Stabilizer</h2><BcSeg value={stabEnabled?"add":"none"} set={v=>setStabEnabled(v==="add")} options={[{id:"none",label:"No Stabilizer"},{id:"add",label:"Add Stabilizer"}]}/>{stabEnabled&&<><div className="bc-stabGrid"><FracInput variant="bc" label="Offset from fabric cut edge" decMode={decMode} whole={stabW} frac={stabF} onWhole={setStabW} onFrac={setStabF}/><button className="bc-matchSa" onClick={()=>setStabilizerValue(sa)}>Match Seam Allowance</button><div className="bc-stabPrint"><label>Print stabilizer</label><BcSeg value={stabPrintMode} set={setStabPrintMode} options={[{id:"overlay",label:"On Main Pattern"},{id:"separate",label:"Separately"}]}/></div></div><p className="bc-hint">The stabilizer is one continuous inset of the fabric outline. Matching the seam allowance keeps it out of the stitched seams; on sewn edges, the green stabilizer line will intentionally coincide with the grey stitch line. Choose a larger offset when you want more clearance.</p></>}</div></div>
    {m.notes.length>0&&<div className="bc-warn">Geometry note:<ul>{m.notes.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
    <TrustBadge tone="bc" valid={m.valid}
      okMessage="✓ Finished dimensions verified: top, bottom, height, and depth reconstruct exactly from the cut geometry."
      lockLabel="Pattern output locked" errors={m.errors}/>
    {stabEnabled&&<TrustBadge tone="bc" valid={m.stabilizer.valid}
      okMessage={`✓ Stabilizer outline verified ${bcFmt(m.stabilizer.offset)} inside every fabric cut edge.`}
      lockLabel="Stabilizer output locked" errors={m.stabilizer.errors}/>}
    <div className="bc-card bc-diagramCard"><svg viewBox="0 0 760 520" style={{width:"100%",height:"auto",display:"block"}} role="img" aria-label="Live boxed corner panel diagram" dangerouslySetInnerHTML={{__html:bcPanelDiagramSVG(m)}}/><p className="bc-diagramLegend">Solid pumpkin = fabric cut &nbsp; Grey dashed = assembly stitch lines &nbsp; Purple dash-dot = center / place on fold &nbsp; Cyan dashed = bottom fold {stabEnabled&&m.stabilizer.valid&&<>&nbsp; Green dash-dot = stabilizer cut</>}</p></div>{m.valid&&<BcResultBand m={m}/>} 
    {canFloat&&floatOpen&&dockSide&&collapsed&&<button className={"bc-dockTab "+dockSide} style={{top:Math.max(86,Math.min(floatPos.y,typeof window!=="undefined"?window.innerHeight-210:120))}} onClick={undock}><span className="bc-liveDot" style={{background:m.valid?"#2f9a62":"#c23b47"}}/>Live Pattern Feed</button>}
    {canFloat&&floatOpen&&!(dockSide&&collapsed)&&<div ref={floatRef} className={"bc-floatDock"+(dragging?" dragging":"")+(resizing?" resizing":"")+(dockSide?" docked-"+dockSide:"")} style={dockSide?{[dockSide]:0,top:Math.max(72,Math.min(floatPos.y,typeof window!=="undefined"?window.innerHeight-Math.min(floatSize.h,window.innerHeight-82)-10:86)),width:floatSize.w,height:typeof window!=="undefined"?Math.min(floatSize.h,window.innerHeight-82):floatSize.h}:{left:floatPos.x,top:floatPos.y,width:floatSize.w,height:floatSize.h}}><div className="bc-floatHead" onPointerDown={startDrag}><div className="bc-missionBrand"><span className="bc-liveDot" style={{background:m.valid?"#2f9a62":"#c23b47"}}/><div><div className="bc-missionTitle">MoonShot Mission Control</div><div className="bc-missionFeed">Live Boxed-Corner Feed</div></div></div><button className="bc-floatClose" onPointerDown={e=>e.stopPropagation()} onClick={()=>{setDockSide(dockSide||"right");setCollapsed(true)}}>×</button></div><div className="bc-floatNav"><button onClick={()=>dock("left")}>← Dock Left</button><button onClick={reset}>ReCenter</button><button onClick={()=>dock("right")}>Dock Right →</button></div><div className="bc-floatBody"><svg viewBox="0 0 760 520" style={{width:"100%",height:"auto",display:"block"}} dangerouslySetInnerHTML={{__html:bcPanelDiagramSVG(m)}}/><div className="bc-floatMeta">{bcFmt(m.cutBB.w)} W × {bcFmt(m.cutBB.h)} H cut · {bcFmt(params.depth)} finished depth · {m.labels.layout}</div></div><div className={"bc-resizeHandle "+(dockSide==="right"?"left":"right")} onPointerDown={startResize}/></div>}
    <div className="bc-card" style={{marginTop:8}}><h2>Print Pattern</h2><div className="bc-printGrid"><div className="bc-printCard"><div className="pt">Main Panel</div><div className="pm">Actual-size fabric cut outline, assembly stitch lines only, center place-on-fold line, bottom fold where used, perpendicular-corner marks, registration crosses, and test squares.{overlayStabilizer?" The stabilizer cut line is overlaid in green.":""}</div><PrintButton tone="bc" label="Print Main Panel" meta={cpTileLabel(plan)} disabled={!m.valid||(overlayRequested&&!m.stabilizer.valid)} onClick={()=>bcPrintPanel(m,overlayStabilizer)}/></div>{stabEnabled&&stabPrintMode==="separate"&&<div className="bc-printCard"><div className="pt">Stabilizer</div><div className="pm">A separate actual-size pattern inset {bcFmt(stabilizerOffset)} from the fabric cut edge, with its own center place-on-fold line and bottom fold when applicable.</div><PrintButton tone="bc" label="Print Stabilizer" meta={stabPlan?cpTileLabel(stabPlan):"Adjust stabilizer offset"} disabled={!m.valid||!m.stabilizer.valid||!stabPlan} onClick={()=>bcPrintStabilizer(m)}/></div>}</div></div>
  </div></div></div>;
}



// ══════════════════════════════════════════════════════════════════════════════
const NAV_GROUPS = [
  {
    id:"basic", label:"Basic", color:"#7658b3",
    pages:[
      {id:"lid", label:"Lid & Bottom", color:"#5a2da0"},
      {id:"gusset", label:"Gusset", color:"#1a6e3a"},
      {id:"piping", label:"Piping", color:"#8e1a9e"},
    ],
  },
  {
    id:"advanced", label:"Advanced", color:"#9a3e52",
    pages:[
      {id:"advanced", label:"Curved Panel", color:"#7a1a2e"},
      {id:"boxed", label:"Boxed Corner", color:"#a84f14"},
      {id:"foldtuck", label:"Fold & Tuck", color:"#9a4968", coming:true},
    ],
  },
  {
    id:"pockets", label:"Pockets", color:"#356b9b",
    pages:[
      {id:"bottle", label:"Accordion", color:"#1a4a7a"},
      {id:"zippered", label:"Zippered", color:"#176b78", coming:true},
      {id:"welt", label:"Welt", color:"#3a5c99", coming:true},
    ],
  },
  {
    id:"trims", label:"Trims & Straps", color:"#167a73",
    pages:[
      {id:"trims", label:"Trims & Straps", color:"#167a73", coming:true},
    ],
  },
];

function navGroupForPage(pageId) {
  return NAV_GROUPS.find(group => group.pages.some(item => item.id === pageId)) || NAV_GROUPS[0];
}

function NavRocketIcon() {
  return (
    <svg className="nav-rocket" viewBox="0 0 18 24" fill="none" aria-hidden="true">
      <path className="trail" d="M7.2 16.2 C5.8 18.7 6.8 22.1 9 23.6 C11.2 22.1 12.2 18.7 10.8 16.2Z"
        fill="rgba(255,193,72,.72)"/>
      <path d="M9 1.7 C9 1.7 3.8 7.2 4 13.3 L9 16.9 L14 13.3 C14.2 7.2 9 1.7 9 1.7Z"
        fill="rgba(83,224,211,.17)" stroke="rgba(100,235,222,.92)" strokeWidth="1.1"/>
      <circle cx="9" cy="9.2" r="2" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.8)" strokeWidth=".9"/>
      <path d="M4.5 13.2 L2.8 17.1 L7 15.5 M13.5 13.2 L15.2 17.1 L11 15.5"
        stroke="rgba(255,193,72,.68)" strokeWidth=".9" strokeLinecap="round"/>
      <circle className="spark" cx="2.1" cy="8" r=".8" fill="rgba(255,255,255,.9)" style={{animationDelay:"-.7s"}}/>
      <circle className="spark" cx="15.9" cy="5.5" r=".6" fill="rgba(255,221,143,.95)" style={{animationDelay:"-1.5s"}}/>
    </svg>
  );
}

function IntroCard() {
  return (
    <div style={{
      margin:"0", padding:"18px 20px",
      background:"linear-gradient(135deg, #2a1860 0%, #1a0e40 100%)",
      borderBottom:"1px solid rgba(255,255,255,0.08)",
      borderRadius:"0 0 5px 5px",
      marginTop:-6, paddingTop:24,
      position:"relative", zIndex:1,
    }}>
      <div style={{ fontSize:14, fontWeight:800, color:"#c8b8f0", marginBottom:6, fontFamily:"Nunito,sans-serif", letterSpacing:"0.04em" }}>
        Hi, I'm Abby 👋
      </div>
      <div style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.72)", lineHeight:1.6, fontFamily:"Nunito,sans-serif" }}>
        I'm a bag maker and designer obsessed with getting the math right. I built this calculator for myself and figured other makers could use it too. It's free, it's a work in progress, and I hope it saves you some seam-ripping.
      </div>
    </div>
  );
}

export default function MoonshotBagCalc() {
  const [page, setPage] = useState("lid");
  const [unitMode, setUnitMode] = useState("imperial");
  setCurrentUnit(unitMode);
  const scrollPositions = useRef({});
  const visitedTabs     = useRef(new Set(["lid"]));
  const lastPageByGroup = useRef({ basic:"lid", advanced:"advanced", pockets:"bottle", trims:"trims" });
  const [isPhoneNav,setIsPhoneNav]=useState(()=>typeof window!=="undefined" ? window.matchMedia("(max-width: 600px)").matches : false);
  const [mobileNavCollapsed,setMobileNavCollapsed]=useState(false);
  const mobileLastScroll=useRef(0);

  // ── Page-reactive background patterns ──────────────────────────────────────
  const PAGE_PATTERNS = {
    lid: {
      color: "#f0ecfc",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44'%3E%3Cline x1='0' y1='44' x2='44' y2='0' stroke='%235a2da0' stroke-width='0.7' opacity='0.09'/%3E%3C/svg%3E")`,
    },
    gusset: {
      color: "#ecf8f0",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Cpath d='M30 0 L0 0 0 30' fill='none' stroke='%231a6e3a' stroke-width='0.6' opacity='0.22'/%3E%3C/svg%3E")`,
    },
    piping: {
      color: "#f8eefb",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Cline x1='11' y1='0' x2='11' y2='22' stroke='%238e1a9e' stroke-width='0.6' opacity='0.1'/%3E%3C/svg%3E")`,
    },
    bottle: {
      color: "#eaf2fc",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20'%3E%3Cpolyline points='0%2C10%2010%2C0%2020%2C10%2030%2C0%2040%2C10' fill='none' stroke='%231a4a7a' stroke-width='0.7' opacity='0.1'/%3E%3C/svg%3E")`,
    },
    advanced: {
      color: "#f2e8ea",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Ccircle cx='11' cy='11' r='1.5' fill='%237a1a2e' opacity='0.11'/%3E%3C/svg%3E")`,
    },
    boxed: {
      color: "#faf0e8",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Cpath d='M0 15 H30 M15 0 V30' stroke='%23a84f14' stroke-width='0.55' opacity='0.08'/%3E%3C/svg%3E")`,
    },
    foldtuck: {
      color: "#f7edf1",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpath d='M0 24 L8 16 L16 24 L24 16 L32 24' fill='none' stroke='%239a4968' stroke-width='0.65' opacity='0.09'/%3E%3C/svg%3E")`,
    },
    zippered: {
      color: "#eaf6f7",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='12' y1='0' x2='12' y2='24' stroke='%23176b78' stroke-width='0.55' opacity='0.09'/%3E%3C/svg%3E")`,
    },
    welt: {
      color: "#eef1f8",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='18'%3E%3Cline x1='0' y1='9' x2='36' y2='9' stroke='%233a5c99' stroke-width='0.65' opacity='0.09'/%3E%3C/svg%3E")`,
    },
    trims: {
      color: "#eaf7f5",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26'%3E%3Ccircle cx='13' cy='13' r='1.4' fill='%23167a73' opacity='0.1'/%3E%3C/svg%3E")`,
    },
  };

  useEffect(()=>{
    const mq=window.matchMedia("(max-width: 600px)");
    const update=()=>{setIsPhoneNav(mq.matches);if(!mq.matches)setMobileNavCollapsed(false);};
    update();
    if(mq.addEventListener)mq.addEventListener("change",update);else mq.addListener(update);
    return ()=>{if(mq.removeEventListener)mq.removeEventListener("change",update);else mq.removeListener(update);};
  },[]);

  useEffect(()=>{
    if(!isPhoneNav)return;
    mobileLastScroll.current=window.scrollY;
    let ticking=false;
    const onScroll=()=>{
      if(ticking)return;
      ticking=true;
      requestAnimationFrame(()=>{
        const y=Math.max(0,window.scrollY);
        const delta=y-mobileLastScroll.current;
        if(y<48)setMobileNavCollapsed(false);
        else if(delta>7)setMobileNavCollapsed(true);
        else if(delta<-7)setMobileNavCollapsed(false);
        mobileLastScroll.current=y;
        ticking=false;
      });
    };
    window.addEventListener("scroll",onScroll,{passive:true});
    return ()=>window.removeEventListener("scroll",onScroll);
  },[isPhoneNav]);

  useEffect(()=>{ if(isPhoneNav)setMobileNavCollapsed(false); },[page,isPhoneNav]);

  useEffect(() => {
    const p = PAGE_PATTERNS[page] || PAGE_PATTERNS.lid;
    document.body.style.transition = "background-color 0.4s ease";
    document.body.style.backgroundColor = p.color;
    document.body.style.backgroundImage = p.img;
    document.body.style.backgroundRepeat = "repeat";
    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.backgroundImage = "";
    };
  }, [page]);

  function handleTabClick(newPage) {
    if (newPage === page) return;
    // Save current scroll position for the tab we're leaving
    scrollPositions.current[page] = window.scrollY;
    const destinationGroup = navGroupForPage(newPage);
    lastPageByGroup.current[destinationGroup.id] = newPage;
    setPage(newPage);
    // After React renders the new tab, scroll appropriately
    requestAnimationFrame(() => {
      if (!visitedTabs.current.has(newPage)) {
        // First visit — scroll to top
        window.scrollTo({top: 0, behavior: "instant"});
        visitedTabs.current.add(newPage);
      } else {
        // Return visit — restore saved position
        window.scrollTo({top: scrollPositions.current[newPage] || 0, behavior: "instant"});
      }
    });
  }

  function handleGroupClick(group) {
    const target = lastPageByGroup.current[group.id] || group.pages[0].id;
    handleTabClick(target);
  }

  const activeGroup = navGroupForPage(page);

  return (
    <div className="ms-app">

      {/* ── Header + sticky tab bar — one solid #1e1040 block, no gap ── */}
      <div className={`ms-site-header${isPhoneNav&&mobileNavCollapsed?" mobile-collapsed":""}`} style={{ background:"#1e1040", position:"sticky", top:0, zIndex:10,
        boxShadow:"0 2px 12px rgba(0,0,0,0.34)", borderRadius:"0 0 5px 5px" }}>
        {/* Moonshot wordmark */}
        <div className="ms-header-inner" style={{ padding:"16px 20px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div className="ms-wordmark" style={{ fontSize:"clamp(28px, 8vw, 42px)", fontWeight:900, color:"#fff",
              letterSpacing:"-0.03em", fontFamily:"Nunito,sans-serif", lineHeight:1.05 }}>
              Moonshot
              <span style={{ color:"#9880d8" }}> Bag Calculator</span>
            </div>
            {/* Units toggle — metric coming soon */}
            <div className="ms-header-tools" style={{ flexShrink:0, marginLeft:10, marginTop:4, textAlign:"right", display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
              <div style={{ display:"flex", border:"1.5px solid rgba(152,128,216,0.5)", borderRadius:20, overflow:"hidden", background:"rgba(255,255,255,0.06)" }}>
                {["imperial","metric"].map(u => (
                  <button key={u} onClick={()=>setUnitMode(u)} style={{
                    fontSize:12, fontWeight:900, color:unitMode===u?"#1e1040":"rgba(255,255,255,0.68)",
                    fontFamily:"Nunito,sans-serif", letterSpacing:"0.04em",
                    background:unitMode===u?"#c8b8f0":"transparent", border:"none",
                    padding:"5px 10px", whiteSpace:"nowrap", cursor:"pointer", textTransform:"capitalize"
                  }}>
                    {u === "imperial" ? "Imperial" : "Metric"}
                  </button>
                ))}
              </div>
              <button onClick={()=>{
                window.open('https://moonshotbagcalc-cpu.github.io/moonshot-bag-calc/thread-needle.html', 'moonshot-thread-guide');
              }} style={{
                fontSize:12, fontWeight:800, color:"#3a1060",
                fontFamily:"Nunito,sans-serif", letterSpacing:"0.04em",
                background:"#ccc8d8", border:"1.5px solid #b8b0cc",
                borderRadius:20, padding:"4px 10px", whiteSpace:"nowrap",
                cursor:"pointer"
              }}>
                Thread &amp; Needle Guide
              </button>
            </div>
          </div>
          <div className="ms-header-tagline" style={{ fontSize:"clamp(14px, 3.5vw, 18px)", fontWeight:700, color:"rgba(255,255,255,0.5)",
            fontFamily:"Nunito,sans-serif", marginTop:4, marginBottom:7,
            letterSpacing:"0.01em", fontStyle:"italic" }}>
            Houston, we have the math.
          </div>
        </div>
        {/* Compact two-level navigation */}
        <div className="ms-nav-wrap" style={{ padding:"0 14px 4px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:4 }}>
            {NAV_GROUPS.map(group => {
              const active = activeGroup.id === group.id;
              return (
                <button key={group.id} onClick={()=>handleGroupClick(group)} aria-pressed={active} style={{
                  minWidth:0, padding:"5px 4px 4px", border:"none", cursor:"pointer",
                  borderRadius:7, background:active?"rgba(255,255,255,0.12)":"transparent",
                  color:active?"#fff":"rgba(255,255,255,0.48)",
                  borderBottom:active?`2px solid ${group.color}`:"2px solid transparent",
                  fontFamily:"Nunito,sans-serif", fontWeight:900,
                  fontSize:"clamp(9px,1.7vw,11px)", letterSpacing:"0.055em",
                  textTransform:"uppercase", lineHeight:1.05,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                  transition:"background .15s,color .15s,border-color .15s"
                }}>{group.label}</button>
              );
            })}
          </div>
          <div style={{
            display:"flex", justifyContent:activeGroup.pages.length===1?"center":"stretch",
            gap:4, paddingTop:4, borderTop:"1px solid rgba(255,255,255,0.07)"
          }}>
            {activeGroup.pages.map(item => {
              const active = page === item.id;
              return (
                <button key={item.id} onClick={()=>handleTabClick(item.id)} aria-current={active?"page":undefined} style={{
                  flex:activeGroup.pages.length===1?"0 1 180px":"1 1 0", minWidth:0,
                  padding:"6px 5px", border:"none", cursor:"pointer",
                  borderRadius:"7px 7px 3px 3px",
                  background:active?item.color:"rgba(255,255,255,0.065)",
                  color:active?"#fff":"rgba(255,255,255,0.62)",
                  boxShadow:active?`inset 0 -2px 0 rgba(255,255,255,.18)`:"none",
                  fontFamily:"Nunito,sans-serif", fontWeight:800,
                  fontSize:"clamp(10px,1.95vw,12px)", letterSpacing:"0.015em",
                  lineHeight:1.1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                  transition:"background .15s,color .15s"
                }}><span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,minWidth:0}}>
                  {item.coming&&<NavRocketIcon/>}<span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}}>{item.label}</span>
                </span></button>
              );
            })}
          </div>
        </div>
        <div className="ms-mobile-peek" role="button" tabIndex={0}
          aria-label={mobileNavCollapsed?"Show MoonShot navigation":"Hide MoonShot navigation"}
          onClick={()=>setMobileNavCollapsed(v=>!v)}
          onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setMobileNavCollapsed(v=>!v);}}}>
          <strong>MoonShot</strong>
          <span>{activeGroup.label} · {activeGroup.pages.find(item=>item.id===page)?.label||"Bag Calculator"}</span>
          <b>{mobileNavCollapsed?"⌄":"⌃"}</b>
        </div>
      </div>

      {/* ── Intro (shows only on first tab) ── */}
      {page==="lid" && <IntroCard />}

      {/* ── Page content — always mounted, shown/hidden to preserve state ── */}
      <div style={{display:page==="lid"      ?"block":"none"}}><LidPage /></div>
      <div style={{display:page==="gusset"   ?"block":"none"}}><GussetPage /></div>
      <div style={{display:page==="piping"   ?"block":"none"}}><PipingPage /></div>
      <div style={{display:page==="bottle"   ?"block":"none"}}><BottlePocketPage /></div>
      <div style={{display:page==="advanced" ?"block":"none"}}><CurvedPanelPage /></div>
      <div style={{display:page==="boxed"     ?"block":"none"}}><BoxedCornerPage /></div>
      <div style={{display:page==="foldtuck"  ?"block":"none"}}><ComingSoon label="Fold & Tuck" /></div>
      <div style={{display:page==="zippered"  ?"block":"none"}}><ComingSoon label="Zippered Pocket" /></div>
      <div style={{display:page==="welt"      ?"block":"none"}}><ComingSoon label="Welt Pocket" /></div>
      <div style={{display:page==="trims"     ?"block":"none"}}><ComingSoon label="Trims & Straps" /></div>

      {/* ── Footer ── */}
      <ContactFooter />
    </div>
  );
}
