import { useState } from "react";
import { isMetric, inToMm, mmToIn, fmtInch, setLengthViaUnit } from "../utils/formatting.js";

const EIGHTHS = [
  ["0",0],["1/8",0.125],["1/4",0.25],["3/8",0.375],
  ["1/2",0.5],["5/8",0.625],["3/4",0.75],["7/8",0.875]
];
const FOPTS = EIGHTHS.map(([,v]) => v);
const FLBLS = EIGHTHS.map(([l]) => l);

// Small-fraction list for vinyl/cord thickness inputs (1/64" through 1/8").
// Pass as fracList prop to override the default EIGHTHS dropdown.
export const VINYL_FRACS = [
  ["0",0],["1/64",1/64],["1/32",1/32],["3/64",3/64],
  ["1/16",1/16],["3/32",3/32],["1/8",0.125],
];

function ThemeFracInput({ label, sub, whole, frac, onWhole, onFrac, th, append, fracList }) {
  const [focused, setFocused] = useState(false);
  const valueInches = Math.max(0, (parseFloat(whole)||0) + (parseFloat(frac)||0));
  const metricValue = Math.round(inToMm(valueInches) / 10 * 10) / 10; // cm to 1 decimal
  const metricDisplay = focused && metricValue === 0 ? "" : (metricValue % 1 === 0 ? String(metricValue) : metricValue.toFixed(1));
  const currentFrac = parseFloat(frac) || 0;
  const fracs = fracList || EIGHTHS;
  const fopts = fracs.map(([,v]) => v);
  const flbls = fracs.map(([l]) => l);
  const standardFrac = fopts.some(f => Math.abs(f - currentFrac) < 0.0001);

  if (isMetric()) {
    return (
      <div style={{ marginBottom:16 }}>
        {label !== "" && (
          <div style={{ fontSize:14, fontWeight:800, color:th.label, marginBottom:sub?2:6, fontFamily:"Nunito,sans-serif" }}>
            {label}
          </div>
        )}
        {sub && (
          <div style={{ fontSize:13, fontWeight:600, color:th.sub, marginBottom:6, fontFamily:"Nunito,sans-serif", lineHeight:1.4 }}>
            {sub}
          </div>
        )}
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input type="number" min="0" step="0.1"
            value={metricDisplay}
            onFocus={e=>{setFocused(true);e.target.select();}}
            onBlur={e=>{setFocused(false);if(e.target.value==="")setLengthViaUnit(0,onWhole,onFrac);}}
            onChange={e=>setLengthViaUnit(e.target.value,onWhole,onFrac)}
            style={{ width:118, padding:"9px 8px", fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500,
              background:th.inputBg, border:`2px solid ${th.border}`, borderRadius:8,
              color:th.inputTxt, outline:"none", textAlign:"center" }}
          />
          <div style={{ fontSize:20, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.accent, minWidth:38 }}>
            cm
          </div>
          {append && append}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom:16 }}>
      {label !== "" && (
        <div style={{ fontSize:14, fontWeight:800, color:th.label, marginBottom:sub?2:6, fontFamily:"Nunito,sans-serif" }}>
          {label}
        </div>
      )}
      {sub && (
        <div style={{ fontSize:13, fontWeight:600, color:th.sub, marginBottom:6, fontFamily:"Nunito,sans-serif", lineHeight:1.4 }}>
          {sub}
        </div>
      )}
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <input type="number" min="0" step="1"
          value={focused ? (whole===0?"":whole) : whole}
          onFocus={e=>{setFocused(true);e.target.select();}}
          onBlur={e=>{setFocused(false);if(e.target.value==="")onWhole(0);}}
          onChange={e=>onWhole(Math.max(0,parseInt(e.target.value)||0))}
          style={{ width:64, padding:"9px 8px", fontSize:22, fontFamily:"DM Mono,monospace", fontWeight:500,
            background:th.inputBg, border:`2px solid ${th.border}`, borderRadius:8,
            color:th.inputTxt, outline:"none", textAlign:"center" }}
        />
        <select value={standardFrac ? currentFrac : "custom"} onChange={e=>onFrac(e.target.value==="custom" ? currentFrac : parseFloat(e.target.value))}
          style={{ padding:"9px 8px", fontSize:17, fontFamily:"DM Mono,monospace", fontWeight:500,
            background:th.inputBg, border:`2px solid ${th.border}`, borderRadius:8,
            color:th.inputTxt, outline:"none", cursor:"pointer" }}>
          {!standardFrac && <option value="custom">custom</option>}
          {fopts.map((f,i)=><option key={f} value={f}>{flbls[i]}</option>)}
        </select>
        <div style={{ fontSize:20, fontFamily:"DM Mono,monospace", fontWeight:500, color:th.accent, minWidth:56 }}>
          {fmtInch(whole+frac)}
        </div>
        {append && append}
      </div>
    </div>
  );
}

/* Compact fraction input — prototype `fi` widget, React-ified.
   Imperial fraction: whole box + 16ths dropdown. Decimal toggle: single
   inches box. Metric mode: single cm box (decimal). Same whole+frac state
   contract as the app FracInput. */
function ClassFracInput({ tone, label, whole, frac, onWhole, onFrac, ghost, decMode, fracList, append }){
  const inches = Math.max(0, (parseFloat(whole)||0) + (parseFloat(frac)||0));
  const currentFrac = parseFloat(frac) || 0;
  const fracs = fracList || EIGHTHS;
  const matchIdx = fracs.findIndex(([,v]) => Math.abs(v - currentFrac) < 0.0001);
  const metricValue = Math.round(inToMm(inches) / 10 * 10) / 10;
  const fieldClass = tone === "cp" ? "cp-field" : "bc-field";
  const fiClass = tone === "cp" ? "cp-fi" : "bc-fi";
  const unitClass = tone === "cp" ? "inch" : "unit";

  function setFromInches(val){
    const v = Math.max(0, parseFloat(val) || 0);
    const w = Math.floor(v);
    onWhole(w); onFrac(Math.max(0, v - w));
  }

  return (
    <div className={fieldClass + (ghost ? " ghost" : "")}>
      <label>{label}</label>
      {isMetric() ? (
        <div className={fiClass}>
          <input type="number" className="dec" min="0" step="0.1" value={metricValue}
            onChange={e=>setFromInches(mmToIn((parseFloat(e.target.value)||0) * 10))}
            onFocus={e=>e.target.select()}/>
          <span className={unitClass}>cm</span>
          {append}
        </div>
      ) : decMode ? (
        <div className={fiClass}>
          <input type="number" className="dec" min="0" step="0.125" value={inches}
            onChange={e=>setFromInches(e.target.value)}
            onFocus={e=>e.target.select()}/>
          <span className={unitClass}>{"″"}</span>
          {append}
        </div>
      ) : (
        <div className={fiClass}>
          <input type="number" min="0" step="1" value={whole}
            onChange={e=>onWhole(Math.max(0, parseInt(e.target.value)||0))}
            onFocus={e=>e.target.select()}/>
          <select value={matchIdx >= 0 ? matchIdx : "custom"}
            onChange={e=>{ if(e.target.value !== "custom") onFrac(fracs[parseInt(e.target.value)][1]); }}>
            {matchIdx < 0 && <option value="custom">custom</option>}
            {fracs.map(([lbl], i)=><option key={i} value={i}>{lbl}</option>)}
          </select>
          <span className={unitClass}>{"″"}</span>
          {append}
        </div>
      )}
    </div>
  );
}

export default function FracInput({ variant="theme", label, sub, whole, frac, onWhole, onFrac, th, append, ghost, decMode, fracList }) {
  if (variant === "cp" || variant === "bc") {
    return <ClassFracInput tone={variant} label={label} whole={whole} frac={frac} onWhole={onWhole} onFrac={onFrac} ghost={ghost} decMode={decMode} fracList={fracList} append={append}/>;
  }
  return <ThemeFracInput label={label} sub={sub} whole={whole} frac={frac} onWhole={onWhole} onFrac={onFrac} th={th} append={append} fracList={fracList}/>;
}
