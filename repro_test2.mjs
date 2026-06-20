import { buildCurvedPanelModel } from './src/curved-panel-core.js';

const params = {
  topW: 9, botW: 10, height: 10,
  sa: 0.375, topCrown: 0, botCrown: 0,
  leftFull: 0, rightFull: 0, matchingSides: true,
  feel: 'gentle', topSoft: 1, botSoft: 0,
  topMode: '4side', stabilizerOn: false, stabilizerInset: 0, sideDepth: 0,
};

const model = buildCurvedPanelModel(params);
const cutRight = model.cutSides.right;
const sewRight = model.sewSides.right;

// Show cutSides.right around the arc-edge boundary (indices 29-36)
// and what _offsetOpen produces there
console.log('--- cutRight at arc-edge junction ---');
for (let i = 29; i <= 36; i++) {
  const p = cutRight[i];
  const dy_fwd = i < cutRight.length-1 ? (cutRight[i+1].y - p.y).toFixed(8) : '---';
  console.log(`  cutRight[${i}]=(${p.x.toFixed(8)}, ${p.y.toFixed(8)})  dy_fwd=${dy_fwd}`);
}

console.log('\n--- sewRight (offsetSidePaths output) at same indices ---');
for (let i = 29; i <= 36; i++) {
  const p = sewRight[i];
  console.log(`  sewRight[${i}]=(${p.x.toFixed(8)}, ${p.y.toFixed(8)})`);
}

// Confirm: what chord direction does _offsetOpen compute at indices 32, 33?
console.log('\n--- manual _offsetOpen chord u at critical indices ---');
for (const i of [31, 32, 33, 34]) {
  const prev = cutRight[Math.max(0, i-1)];
  const cur  = cutRight[i];
  const next = cutRight[Math.min(cutRight.length-1, i+1)];
  const dx = next.x - prev.x, dy = next.y - prev.y;
  const mag = Math.hypot(dx, dy);
  const ux = dx/mag, uy = dy/mag;
  const nx = -uy, ny = ux;  // inward normal (-u.y, u.x)
  const off_y = cur.y + ny * 0.375;
  console.log(`  i=${i}: chord_u=(${ux.toFixed(6)},${uy.toFixed(6)}) normal_y=${ny.toFixed(6)} -> off_y=${off_y.toFixed(8)}`);
}

// Also: miter-normal approach at same indices for comparison
console.log('\n--- miter-normal approach at same indices ---');
for (const i of [31, 32, 33, 34]) {
  if (i === 0 || i === cutRight.length-1) continue;
  const prev = cutRight[i-1], cur = cutRight[i], next = cutRight[i+1];
  const u1x = cur.x-prev.x, u1y = cur.y-prev.y, m1 = Math.hypot(u1x,u1y);
  const u2x = next.x-cur.x, u2y = next.y-cur.y, m2 = Math.hypot(u2x,u2y);
  if (m1<1e-9||m2<1e-9) { console.log(`  i=${i}: degenerate`); continue; }
  const t1x=u1x/m1, t1y=u1y/m1, n1x=-t1y, n1y=t1x;
  const t2x=u2x/m2, t2y=u2y/m2, n2x=-t2y, n2y=t2x;
  const bx=n1x+n2x, by=n1y+n2y, bm=Math.hypot(bx,by);
  const bnx=bx/bm, bny=by/bm;
  const cosH = Math.max(0.35, bnx*n1x + bny*n1y);
  const off_y = cur.y + bny/cosH * 0.375;
  console.log(`  i=${i}: miter_n=(${bnx.toFixed(6)},${bny.toFixed(6)}) cosH=${cosH.toFixed(6)} -> off_y=${off_y.toFixed(8)}`);
}

// ts=2" comparison: does it still fold?
const params2 = { ...params, topSoft: 2 };
const model2 = buildCurvedPanelModel(params2);
console.log('\n--- ts=2" errors:', model2.errors);

// ts=1", sa=0.25"
const params3 = { ...params, sa: 0.25 };
const model3 = buildCurvedPanelModel(params3);
console.log('--- ts=1", sa=0.25" errors:', model3.errors);
const sewRight3 = model3.sewSides.right;
let fold3 = false;
for (let i = 1; i < sewRight3.length; i++) {
  if (sewRight3[i].y < sewRight3[i-1].y - 1e-9) { fold3=true; console.log(`  fold at right3[${i}]: ${sewRight3[i-1].y.toFixed(8)} -> ${sewRight3[i].y.toFixed(8)}`); }
}
if (!fold3) console.log('  no fold in sewRight3');
