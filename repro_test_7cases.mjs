// 7-case test plan from SESSION_HANDOFF.md §4
// All cases: check model.errors is empty AND selfIntersections count is 0.
import { buildCurvedPanelModel, selfIntersections } from './src/curved-panel-core.js';

const BASE = {
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

const cases = [
  { id: 1, desc: 'ts=1", 9×10×10, SA=3/8" (primary repro)', params: { ...BASE, topSoft: 1, botSoft: 0, sa: 0.375 }, expectFail: true },
  { id: 2, desc: 'ts=1", 9×10×10, SA=1/4"',                  params: { ...BASE, topSoft: 1, botSoft: 0, sa: 0.25  }, expectFail: true },
  { id: 3, desc: 'ts=2", 9×10×10, SA=3/8" (regression)',      params: { ...BASE, topSoft: 2, botSoft: 0, sa: 0.375 }, expectFail: false },
  { id: 4, desc: 'ts=0 (crisp corners), SA=3/8"',             params: { ...BASE, topSoft: 0, botSoft: 0, sa: 0.375 }, expectFail: false },
  { id: 5, desc: 'ts=1", bs=0.5" (mixed corners), SA=3/8"',   params: { ...BASE, topSoft: 1, botSoft: 0.5, sa: 0.375 }, expectFail: false },
  { id: 6, desc: 'ts=1", asymmetric (top 7", bot 13"), SA=3/8"', params: { ...BASE, topW: 7, botW: 13, topSoft: 1, botSoft: 0, sa: 0.375 }, expectFail: false },
  { id: 7, desc: 'ts=1", 9×10×10, SA=0',                      params: { ...BASE, topSoft: 1, botSoft: 0, sa: 0 }, expectFail: false },
];

let allPass = true;
for (const { id, desc, params, expectFail } of cases) {
  const model = buildCurvedPanelModel(params);
  const crossings = selfIntersections(model.sewPts, true);
  const hasError = model.errors.some(e => e.includes('sewline to cross itself'));
  const hasCrossings = crossings.length > 0;

  const nowFails = hasError || hasCrossings;
  const pass = !nowFails;

  const marker = pass ? 'PASS' : 'FAIL';
  console.log(`[${marker}] Case ${id}: ${desc}`);
  if (!pass) {
    if (hasError)    console.log(`       errors: ${JSON.stringify(model.errors)}`);
    if (hasCrossings) console.log(`       crossings: ${crossings.length}`);
    allPass = false;
  }
}

console.log('');
console.log(allPass ? 'All 7 cases PASS.' : 'SOME CASES FAILED — do not commit.');
