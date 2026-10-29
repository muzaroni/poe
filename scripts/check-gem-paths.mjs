import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
const plainText = node => (node.text ?? node.attrs?.name ?? '') + (node.content ?? []).map(plainText).join('');
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const context = { exports: {}, require: dep => {
    if (dep === './guide') return { plainText };
    if (dep === './gem-rewards') return { gemRewardNpc: () => null };
    if (dep === './tree-snapshot') return {};
    return load(dep.slice(2));
  }};
  const source = fs.readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
  return cache[name] = context.exports;
}
const { resolveGemPaths } = load('gem-paths');
const { guideGemProgressionByAct } = load('campaign');
const heading = text => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
const setup = (name, attrs = {}) => ({ type: 'gemSetup', attrs, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Main: ' }, { type: 'gem', attrs: { name } }] }] });
const guide = { type: 'doc', content: [
  heading('Act 1'), setup('Kinetic Bolt'), heading('Act 3-8'),
  { type: 'gemPathChoice', attrs: { id: 'leveling', title: 'Choose your leveling path', defaultPath: 'kf', options: [{ id: 'kf', label: 'KF', description: 'Keep current links' }, { id: 'kb', label: 'KB', description: 'Switch links' }] } },
  setup('Kinetic Fusillade', { pathChoice: 'leveling', pathId: 'kf' }),
  setup('Kinetic Blast', { pathChoice: 'leveling', pathId: 'kb' }),
  heading('Act 9'), { type: 'paragraph' }, heading('Act 10'),
  { type: 'gemPathMerge', attrs: { choiceId: 'leveling' } }, setup('Kinetic Blast of Clustering'),
] };
const kf = guideGemProgressionByAct(resolveGemPaths(guide, { leveling: 'kf' }));
const kb = guideGemProgressionByAct(resolveGemPaths(guide, { leveling: 'kb' }));
for (const act of [3, 4, 5, 6, 7, 8, 9]) {
  assert(plainText({ content: kf[act].at(-1).rows }).includes('Kinetic Fusillade'), `KF persists in act ${act}`);
  assert(!plainText({ content: kf[act].at(-1).rows }).includes('Kinetic Blast'), `KB excluded in KF act ${act}`);
  assert(plainText({ content: kb[act].at(-1).rows }).includes('Kinetic Blast'), `KB persists in act ${act}`);
}
assert.equal(plainText({ content: kf[10].at(-1).rows }), plainText({ content: kb[10].at(-1).rows }), 'Both paths converge at merge');
assert.equal(JSON.stringify(resolveGemPaths(guide, {})), JSON.stringify(resolveGemPaths(guide, { leveling: 'kf' })), 'Default path matches author setting');
console.log('Gem path checks passed: default, branch filtering, carry-forward, merge, early starting act.');
const { prepareGemPathContent, gemPathField, gemPathAttributes } = load('gem-paths');
const migrated = prepareGemPathContent(guide);
const choice = migrated.content.find(n => n.type === 'gemPathChoice');
assert.equal(choice.content.length, 5, 'Old card heading, names, and descriptions become editable text fields');
assert.equal(JSON.stringify(prepareGemPathContent(migrated)), JSON.stringify(migrated), 'Migration is idempotent');
choice.content[0].content[0].marks = [{ type: 'bold' }, { type: 'underline' }, { type: 'textStyle', attrs: { color: '#58a6ff' } }];
const reloaded = JSON.parse(JSON.stringify(choice));
assert.equal(gemPathField(reloaded, 'title')[0].marks.length, 3, 'Formatting survives saved JSON');
assert.equal(gemPathAttributes(reloaded).title, choice.attrs.title, 'Formatting keeps plain labels intact');
assert.equal(gemPathField(reloaded, 'description', 'kf')[0].text, choice.attrs.options[0].description, 'Existing card descriptions are preserved');
console.log('Rich-text checks passed: legacy card migration, idempotence, saved marks, and preserved copy.');

const sparse = { type: 'doc', content: [heading('Act 6'), guide.content[3], guide.content[4], guide.content[5]] };
const sparseLinks = guideGemProgressionByAct(resolveGemPaths(sparse, { leveling: 'kb' }));
for (const act of [7, 8, 9, 10, 11]) {
  assert.equal(sparseLinks[act][0].sourceAct, 6, 'Missing sections retain source act');
  assert.equal(sparseLinks[act][0].carried, true, 'Missing act sections are explicitly marked unchanged');
  assert.equal(sparseLinks[act][0].acquisitionNodes.length, 0, 'Carried links do not repeat acquisition instructions');
  assert(plainText({ content: sparseLinks[act][0].rows }).includes('Kinetic Blast'), 'Selected branch carries through Maps');
}
const withMaps = { ...sparse, content: [...sparse.content, heading('Maps'), setup('Maps Upgrade', { pathChoice: 'leveling', pathId: 'kb' })] };
const mapsLinks = guideGemProgressionByAct(resolveGemPaths(withMaps, { leveling: 'kb' }));
assert.equal(mapsLinks[11][0].sourceAct, 11, 'Maps recognizes its own gem update');
assert(plainText({ content: mapsLinks[11][0].rows }).includes('Maps Upgrade'));
const { campaignMarkers } = load('campaign');
const markers = [{ nodeId: 1, actDivider: 'Act 10' }, { nodeId: 2, actDivider: 'Maps' }];
assert.equal(campaignMarkers(markers, 10).length, 1, 'Act 10 excludes Maps steps');
assert.equal(campaignMarkers(markers, 11)[0].nodeId, 2, 'Maps divider selects Maps steps');
console.log('Campaign checks passed: missing act sections, no duplicate acquisitions, Maps upgrades and Maps tree dividers.');
