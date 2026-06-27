import { useState } from "react";
import { T } from "../utils/theme.js";
import { Card, CardTitle, RRow, InfoBox, NoteBox, SubTabs, SABar } from "../components/SharedUI.jsx";
import FracInput, { VINYL_FRACS } from "../components/FracInput.jsx";
import { roundRectPerim } from "../utils/geometry.js";
import { PI, DEFAULT_SA, CORDS } from "../utils/constants.js";
import { smartRound, fmtInch } from "../utils/formatting.js";

// Piping strip width: vinyl-calibrated (anchor: 3/32" + 3/8" SA → 1-1/8")
function pipingStripWidth(dia, sa) { return smartRound(4*dia + 2*sa); }
// Cord length offset: cord curves inside sewline
// offset = 2π × (cord_radius + vinyl_thickness)
function cordOffset(dia, vinylThick) { return 2*PI*(dia/2 + vinylThick); }

export default function PipingPage() {
  const th=T.magenta;
  const [sa,setSa]=useState(DEFAULT_SA); const [cSa,setCsa]=useState("");
  const [shape,setShape]=useState("rect");
  const [cIdx,setCIdx]=useState(0);
  const [vinylThickW,setVinylThickW]=useState(0),[vinylThickF,setVinylThickF]=useState(1/32);
  const [vinylInfoOpen,setVinylInfoOpen]=useState(false);

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
  const vinylThick=vinylThickW+vinylThickF;

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

  return (
    <div className="tab-page" data-group="trim-pockets">
      <div className="tab-content-wrap">
        <div className="tab-intro-card">
          <div className="tab-intro-card-thumb" />
          <div className="tab-intro-card-text">
            <div className="tab-intro-card-title">Piping</div>
            <div className="tab-intro-card-desc">Calculates piping cord length and fabric/vinyl strip dimensions for rectangular, oval, and 3-sided panels. Cord length accounts for the cord curving inside the sewline, with both geometric and snug-fit values.</div>
          </div>
        </div>

        <SABar th={th} sa={sa} setSa={setSa} cSa={cSa} setCsa={setCsa} />

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
            <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <FracInput th={th} label="Wrap material thickness" fracList={VINYL_FRACS}
                  whole={vinylThickW} frac={vinylThickF} onWhole={setVinylThickW} onFrac={setVinylThickF}/>
              </div>
              <div style={{marginBottom:16}}>
                <button onClick={()=>setVinylInfoOpen(v=>!v)} title="Material wrap thickness guide" aria-label="Material wrap thickness guide"
                  style={{
                    width:28,height:28,borderRadius:"50%",
                    background:vinylInfoOpen?th.btnOn:th.btnOff,
                    color:vinylInfoOpen?"#fff":th.btnOffTxt,
                    border:`1.5px solid ${vinylInfoOpen?th.btnOn:th.border}`,
                    fontSize:14,cursor:"pointer",fontWeight:900,
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}
                >ℹ</button>
              </div>
            </div>
            {vinylInfoOpen&&(
              <div style={{background:th.resBg,border:`1px solid ${th.border}`,borderRadius:8,padding:"12px 14px",marginBottom:12,fontSize:12.5,fontFamily:"Nunito,sans-serif"}}>
                <div style={{fontWeight:700,color:th.label,marginBottom:6,lineHeight:1.4}}>These are starting points — always test-wrap your cord before cutting the full length.</div>
                <div style={{marginTop:6}}>
                  <div style={{fontWeight:900,color:th.accent,fontSize:11,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3}}>Lightweight</div>
                  <ul style={{margin:0,paddingLeft:14,color:th.label,lineHeight:1.5,fontSize:12}}>
                    <li>Very thin ripstop / lightweight technical fabric / lining — <strong>1/64"–1/32"</strong></li>
                    <li>Quilting cotton / lightweight woven — <strong>1/64"–1/32"</strong> (higher if interfaced or laminated)</li>
                  </ul>
                </div>
                <div style={{marginTop:8,borderTop:`1px solid ${th.border}`,paddingTop:8}}>
                  <div style={{fontWeight:900,color:th.accent,fontSize:11,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3}}>Standard</div>
                  <ul style={{margin:0,paddingLeft:14,color:th.label,lineHeight:1.5,fontSize:12}}>
                    <li>Standard vinyl / faux leather / UltraLeather — <strong>1/32"</strong> (default)</li>
                    <li>Garment leather / soft leather — <strong>1/32"–1/16"</strong></li>
                    <li>Cork fabric — <strong>1/32"–1/16"</strong> (backing and quality vary)</li>
                    <li>Waterproof canvas / waxed cotton / duck / denim / twill — <strong>1/32"–1/16"</strong></li>
                    <li>Cordura / packcloth / coated nylon — <strong>1/32"–1/16"</strong> (higher end for heavier coated versions)</li>
                  </ul>
                </div>
                <div style={{marginTop:8,borderTop:`1px solid ${th.border}`,paddingTop:8}}>
                  <div style={{fontWeight:900,color:th.accent,fontSize:11,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3}}>Heavy</div>
                  <ul style={{margin:0,paddingLeft:14,color:th.label,lineHeight:1.5,fontSize:12}}>
                    <li>Upholstery vinyl / marine vinyl — <strong>1/16"</strong> (use 3/32"–1/8" if foam-backed or padded)</li>
                    <li>Neoprene / scuba fabric — <strong>1/16"–1/8"</strong></li>
                    <li>Veg-tan / tooling leather — <strong>1/16"–1/8"</strong> (use 1/8" if it doesn't compress around the cord)</li>
                  </ul>
                </div>
                <div style={{marginTop:8,color:th.muted||th.label,fontSize:11,fontStyle:"italic",borderTop:`1px solid ${th.border}`,paddingTop:6}}>Material thickness, backing, coatings, and compression can all change the result.</div>
              </div>
            )}
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
  );
}
