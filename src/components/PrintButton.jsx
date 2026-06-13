const PRINT_BTN_TONES = {
  cp: {
    bg:"var(--cp-maroon)", disabledBg:"#d8c8ce", color:"#fff", disabledColor:"#7f6870",
    shadow:"0 2px 5px rgba(111,21,46,.3)", fontWeight:800,
    small:{ marginTop:10, fontSize:14, padding:"9px 12px", borderRadius:8 },
    normal:{ marginTop:12, fontSize:15, padding:"10px 16px", borderRadius:10 },
  },
  bc: {
    bg:"var(--bc-pumpkin)", disabledBg:"#dcc9ba", color:"#fff", disabledColor:"#806b5d",
    shadow:"0 2px 5px rgba(118,52,7,.28)", fontWeight:900,
    small:{ marginTop:10, fontSize:14, padding:"10px 12px", borderRadius:8 },
    normal:{ marginTop:10, fontSize:14, padding:"10px 12px", borderRadius:8 },
  },
};

export default function PrintButton({ label, onClick, disabled, meta, tone, small }){
  const t = PRINT_BTN_TONES[tone];
  const size = small ? t.small : t.normal;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...size,
      background: disabled ? t.disabledBg : t.bg,
      color: disabled ? t.disabledColor : t.color,
      border:"none", cursor:disabled?"not-allowed":"pointer", width:"100%",
      fontFamily:"var(--font-sans)", fontWeight:t.fontWeight,
      boxShadow: disabled ? "none" : t.shadow,
    }}>
      <span>{label}</span>
      {meta && <span style={{display:"block",fontSize:12,fontWeight:700,opacity:.82,marginTop:2}}>{meta}</span>}
    </button>
  );
}
