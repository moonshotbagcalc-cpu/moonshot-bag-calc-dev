function MoonshotRocket({ label }) {
  const id = `moonshot-${String(label).toLowerCase().replace(/[^a-z0-9]+/g,"-")}`;
  const stars = [
    [24,64,2.2,-.2],[45,28,1.4,-1.1],[84,18,1.8,-2.2],[136,20,1.2,-.7],[181,46,2.1,-1.7],
    [199,92,1.5,-2.5],[192,146,2.4,-.4],[171,190,1.3,-1.4],[138,220,1.9,-2.8],[78,222,1.2,-.9],
    [39,194,2.1,-2],[18,150,1.3,-1.2],[17,104,1.8,-2.4],[61,77,1.1,-.5],[163,93,1.1,-1.9]
  ];
  return (
    <svg width="190" height="230" viewBox="0 0 220 260" fill="none" aria-hidden="true" style={{overflow:"visible"}}>
      <defs>
        <radialGradient id={`${id}-halo`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(110 117) rotate(90) scale(112)">
          <stop stopColor="rgba(77,224,212,.13)"/>
          <stop offset=".72" stopColor="rgba(77,224,212,.035)"/>
          <stop offset="1" stopColor="rgba(77,224,212,0)"/>
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="110" y1="26" x2="110" y2="166" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(115,241,229,.24)"/>
          <stop offset="1" stopColor="rgba(63,196,187,.08)"/>
        </linearGradient>
      </defs>
      <circle cx="110" cy="116" r="108" fill={`url(#${id}-halo)`}/>
      <circle cx="110" cy="116" r="91" stroke="rgba(124,235,224,.08)" strokeDasharray="2 8"/>
      {stars.map(([cx,cy,r,delay],i)=><circle key={i} className="moon-star" cx={cx} cy={cy} r={r}
        fill={i%3===0?"rgba(255,220,142,.9)":"rgba(255,255,255,.82)"} style={{animationDelay:`${delay}s`}}/>)}
      <g opacity=".72">
        <path className="moon-star" d="M33 111 l2.2 4.5 4.5 2.2-4.5 2.2-2.2 4.5-2.2-4.5-4.5-2.2 4.5-2.2Z" fill="rgba(255,255,255,.72)" style={{animationDelay:"-1.8s"}}/>
        <path className="moon-star" d="M184 123 l1.8 3.6 3.6 1.8-3.6 1.8-1.8 3.6-1.8-3.6-3.6-1.8 3.6-1.8Z" fill="rgba(255,214,128,.8)" style={{animationDelay:"-.9s"}}/>
        <path className="moon-star" d="M151 56 l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5Z" fill="rgba(255,255,255,.72)" style={{animationDelay:"-2.6s"}}/>
      </g>
      <ellipse cx="110" cy="239" rx="31" ry="7" fill="rgba(255,255,255,.055)"/>
      <g>
        <path className="moon-flame" d="M91 157 C79 181 87 218 110 246 C133 218 141 181 129 157 C122 172 118 181 110 193 C102 181 98 172 91 157Z" fill="rgba(255,157,47,.28)" stroke="rgba(255,188,79,.45)"/>
        <path className="moon-flame mid" d="M98 159 C91 181 98 211 110 232 C122 211 129 181 122 159 C118 174 115 184 110 194 C105 184 102 174 98 159Z" fill="rgba(255,198,74,.5)"/>
        <path className="moon-flame core" d="M104 160 C101 179 105 201 110 216 C115 201 119 179 116 160 C114 172 112 181 110 187 C108 181 106 172 104 160Z" fill="rgba(255,240,174,.82)"/>
        <circle className="moon-spark" cx="91" cy="185" r="2.2" fill="rgba(255,211,104,.8)" style={{animationDelay:"-.3s"}}/>
        <circle className="moon-spark" cx="132" cy="193" r="1.7" fill="rgba(255,239,175,.85)" style={{animationDelay:"-1.1s"}}/>
        <circle className="moon-spark" cx="101" cy="214" r="1.4" fill="rgba(255,191,71,.8)" style={{animationDelay:"-1.55s"}}/>
      </g>
      <path d="M110 25 C110 25 70 63 71 123 L110 162 L149 123 C150 63 110 25 110 25Z"
        fill={`url(#${id}-body)`} stroke="rgba(105,235,222,.75)" strokeWidth="2.2"/>
      <path d="M75 115 L55 158 L91 145" fill="rgba(255,190,72,.12)" stroke="rgba(255,198,78,.52)" strokeWidth="1.8"/>
      <path d="M145 115 L165 158 L129 145" fill="rgba(255,190,72,.12)" stroke="rgba(255,198,78,.52)" strokeWidth="1.8"/>
      <circle cx="110" cy="92" r="15" fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.62)" strokeWidth="2"/>
      <circle cx="110" cy="92" r="8.5" fill="rgba(74,220,211,.1)"/>
      <path d="M84 129 H136" stroke="rgba(255,255,255,.16)" strokeWidth="1.4" strokeDasharray="5 5"/>
    </svg>
  );
}

export default function ComingSoon({ label }) {
  return (
    <div style={{ minHeight:"calc(100vh - 170px)", padding:"18px 16px 48px" }}>
      <div style={{
        minHeight:480, display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", padding:"44px 20px 58px", gap:8,
        background:"radial-gradient(circle at 50% 22%, #302066 0%, #211247 48%, #170c34 100%)",
        border:"1px solid rgba(112,221,210,0.18)", borderRadius:16,
        boxShadow:"0 10px 28px rgba(24,10,54,0.22)",
        color:"rgba(255,255,255,0.4)", textAlign:"center", overflow:"hidden"
      }}>
        <MoonshotRocket label={label}/>
        <div style={{ fontFamily:"Nunito,sans-serif", fontWeight:900, fontSize:"1.18rem",
                      color:"rgba(255,255,255,0.72)", letterSpacing:"0.025em", marginTop:-5 }}>
          {label}
        </div>
        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:".92rem",
                      color:"rgba(255,255,255,0.38)", maxWidth:290, lineHeight:1.55 }}>
          This calculator is in the queue.<br/>Check back soon.
        </div>
      </div>
    </div>
  );
}
