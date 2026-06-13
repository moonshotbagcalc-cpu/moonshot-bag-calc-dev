import { useState, useRef, useEffect } from "react";
import {
  setCurrentUnit,
} from "./utils/formatting.js";
import { GA_MEASUREMENT_ID } from "./utils/constants.js";
import "./moonshot.css";
import GussetPage from "./tabs/Gusset.jsx";
import PipingPage from "./tabs/Piping.jsx";
import LidPage from "./tabs/LidBottom.jsx";
import AccordionPocketPage from "./tabs/AccordionPocket.jsx";
import CurvedPanelPage from "./tabs/CurvedPanel.jsx";
import BoxedCornerPage from "./tabs/BoxedCorner.jsx";
import FoldTuckPage from "./tabs/FoldTuck.jsx";
import ZipperedPocketPage from "./tabs/ZipperedPocket.jsx";
import WeltPocketPage from "./tabs/WeltPocket.jsx";
import TrimsStrapsPage from "./tabs/TrimsStraps.jsx";

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
      <div style={{display:page==="bottle"   ?"block":"none"}}><AccordionPocketPage /></div>
      <div style={{display:page==="advanced" ?"block":"none"}}><CurvedPanelPage /></div>
      <div style={{display:page==="boxed"     ?"block":"none"}}><BoxedCornerPage /></div>
      <div style={{display:page==="foldtuck"  ?"block":"none"}}><FoldTuckPage /></div>
      <div style={{display:page==="zippered"  ?"block":"none"}}><ZipperedPocketPage /></div>
      <div style={{display:page==="welt"      ?"block":"none"}}><WeltPocketPage /></div>
      <div style={{display:page==="trims"     ?"block":"none"}}><TrimsStrapsPage /></div>

      {/* ── Footer ── */}
      <ContactFooter />
    </div>
  );
}
