export default function TrustBadge({ tone, valid, okMessage, lockLabel, errors }){
  return (
    <div className={`${tone}-status ${valid ? "ok" : "bad"}`}>
      {valid ? okMessage : <><strong>{lockLabel}:</strong><ul style={{margin:"4px 0 0",paddingLeft:18}}>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></>}
    </div>
  );
}
