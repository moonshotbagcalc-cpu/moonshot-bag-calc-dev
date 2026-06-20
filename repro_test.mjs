import { buildCurvedPanelModel, selfIntersections } from './src/curved-panel-core.js';
import { offsetSidePaths } from './src/geometryOffset.js';

const params = {
  topW: 9, botW: 10, height: 10,
  sa: 0.375,
  topCrown: 0, botCrown: 0,
  leftFull: 0, rightFull: 0,
  matchingSides: true,
  feel: 'gentle',
  topSoft: 1, botSoft: 0,
  topMode: '4side',
  stabilizerOn: false, stabilizerInset: 0,
  sideDepth: 0,
};

const model = buildCurvedPanelModel(params);
const sewPts = model.sewPts;

console.log('errors:', model.errors);
console.log('sewPts length:', sewPts.length);

const xs = selfIntersections(sewPts, true);
console.log('selfIntersections count:', xs.length);

// Print the 4 points around each crossing
for (const {i, j} of xs) {
  const show = (idx) => {
    const p = sewPts[idx];
    return `pts[${idx}]=(${p.x.toFixed(11)}, ${p.y.toFixed(11)}) side=${p.side}`;
  };
  console.log(`\nCross at segments [${i},${i+1}] × [${j},${j+1}]:`);
  for (const idx of [i, i+1, j, j+1]) console.log('  ', show(idx));
}

// Also inspect the raw sewSides to find where the fold originates
console.log('\n--- inspecting sewSides.right and sewSides.top near junction ---');
const sewSides = model.sewSides;
const right = sewSides.right;
const top = sewSides.top;
console.log(`sewSides.top length=${top.length}, last 4 pts:`);
for (let i = top.length-4; i < top.length; i++) {
  const p = top[i]; 
  console.log(`  top[${i}]=(${p.x.toFixed(8)}, ${p.y.toFixed(8)})`);
}
console.log(`sewSides.right length=${right.length}, first 10 pts:`);
for (let i = 0; i < Math.min(10, right.length); i++) {
  const p = right[i];
  console.log(`  right[${i}]=(${p.x.toFixed(8)}, ${p.y.toFixed(8)})`);
}

// Find where in sewSides.right the y reversal happens
console.log('\n--- y-reversals in sewSides.right ---');
for (let i = 1; i < right.length; i++) {
  if (right[i].y < right[i-1].y - 1e-9) {
    console.log(`  reversal at right[${i}]: y went from ${right[i-1].y.toFixed(8)} DOWN to ${right[i].y.toFixed(8)}`);
    // show context
    for (let k = Math.max(0,i-3); k <= Math.min(right.length-1,i+3); k++) {
      const p = right[k];
      console.log(`    right[${k}]=(${p.x.toFixed(8)}, ${p.y.toFixed(8)})`);
    }
  }
}

// Also look at the cutSides.right to compare
console.log('\n--- cutSides.right first 40 pts ---');
const cutRight = model.cutSides.right;
console.log(`cutSides.right length=${cutRight.length}`);
for (let i = 0; i < Math.min(40, cutRight.length); i++) {
  const p = cutRight[i];
  console.log(`  cutRight[${i}]=(${p.x.toFixed(8)}, ${p.y.toFixed(8)})`);
}
