import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/passive-tree.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(output, context);
const { compatibleTree, stageChanges } = context.exports;
assert.ok(compatibleTree('3_29', '3.29.1'));
assert.ok(compatibleTree('3.28', '3.28.0'));
assert.ok(!compatibleTree('3.28', '3.29.1'));
for (const version of ['3.28.0', '3.29.1']) {
  const folder = new URL(`../public/data/trees/${version}/`, import.meta.url);
  const tree = JSON.parse(fs.readFileSync(new URL('tree.json', folder), 'utf8'));
  assert.equal(tree.version, version);
  assert.ok(tree.nodes.length > 2500);
  assert.equal(new Set(tree.nodes.map(n => n.id)).size, tree.nodes.length);
  for (const sheet of tree.sheets) assert.ok(fs.existsSync(new URL(sheet.file, folder)));
  for (const node of tree.nodes) {
    if (node.classStart !== null) assert.equal(node.name, tree.classes.find(c => c.id === node.classStart).name.toUpperCase());
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y), `Invalid position ${node.id}`);
    for (const icon of [node.active, node.inactive].filter(Boolean)) {
      const sheet = tree.sheets[icon[0]];
      assert.ok(sheet && icon[1] >= 0 && icon[2] >= 0 && icon[3] > 0 && icon[4] > 0);
      assert.ok(icon[1] + icon[3] <= sheet.width && icon[2] + icon[4] <= sheet.height, `Sprite outside sheet: ${node.id}`);
    }
  }
}
const build = JSON.parse(fs.readFileSync(new URL('../public/data/trees/sunder-rf-stages.json', import.meta.url), 'utf8'));
assert.equal(build.stages.length, 11);
assert.ok(build.stages.every(stage => compatibleTree(stage.version, '3.28.0')));
const before = build.stages.find(stage => stage.title === '55 pre-swap');
const after = build.stages.find(stage => stage.title === '55 post-swap');
const changes = stageChanges(after, before);
assert.equal(changes.added.size, 24);
assert.equal(changes.removed.size, 28);
assert.ok(changes.removed.has(31961), 'Resolute Technique should be removed by the RF transition');
assert.equal(stageChanges(build.stages[0]).added.size, 0);
console.log('Tree checks passed: positions, sprite bounds, local assets, version matching, and real RF transition allocations.');

const snapshotSource = fs.readFileSync(new URL('../src/lib/tree-snapshot.ts', import.meta.url), 'utf8');
const snapshotContext = { exports: {} };
vm.runInNewContext(ts.transpileModule(snapshotSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, snapshotContext);
const { normalizeSnapshot, snapshotStage, snapshotNodes, frameNodes, cameraForFrame, markerPositions, captureFrame } = snapshotContext.exports;
const example = JSON.parse(fs.readFileSync(new URL('../src/data/tree-inline-example.json', import.meta.url), 'utf8'));
const snapshot = normalizeSnapshot(example);
const recovered = normalizeSnapshot(JSON.parse(JSON.stringify({ type: 'passiveTree', attrs: { snapshot } })).attrs.snapshot);
assert.equal(JSON.stringify(snapshot), JSON.stringify(recovered), 'Guide serialization must preserve the snapshot, notes, and marker order');
assert.equal(recovered.markers[0].nodeId, 12795);
assert.equal(recovered.markers[1].nodeId, 14606);
assert.equal(snapshotStage(recovered).nodes.length, build.stages[0].nodes.length);
const tree = JSON.parse(fs.readFileSync(new URL('../public/data/trees/3.28.0/tree.json', import.meta.url), 'utf8'));
const visible = snapshotNodes(tree, recovered);
const focus = visible.filter(n => recovered.markers.some(m => m.nodeId === n.id));
const crop = frameNodes(focus);
assert.ok(crop.width < 2000 && crop.height < 2000, 'Inline framing must focus the destinations, not the entire tree');
for (const width of [480, 320, 260]) {
  const size = { width, height: width / 2, dpr: 1 };
  const camera = cameraForFrame(crop, size);
  for (const marker of markerPositions(recovered.markers, visible, camera, size)) {
    assert.ok(marker.x >= 0 && marker.x <= width && marker.y >= 0 && marker.y <= size.height, 'Numbered destinations must remain visible at compact widths');
  }
  const manual = captureFrame(camera, size, 480, 240);
  assert.equal(manual.width / manual.height, 2);
}
assert.ok(cameraForFrame(crop, { width: 0, height: 0, dpr: 1 }).scale > 0);
assert.equal(normalizeSnapshot({ width: 5000, height: 1 }).width, 1000);
assert.equal(normalizeSnapshot({ width: 5000, height: 1 }).height, 120);
assert.equal(normalizeSnapshot({ frame: { x: 0, y: 0, width: -1, height: 10 } }).frame, null);
console.log('Inline checks passed: guide round-trip, marker order, compact framing, responsive marker visibility, and custom crop bounds.');

const { progressionNodes } = snapshotContext.exports;
const firstStep = progressionNodes(visible, recovered, recovered.markers[0].nodeId);
const secondStep = progressionNodes(visible, recovered, recovered.markers[1].nodeId);
assert.ok(firstStep.has(12795), 'Step 1 must highlight its destination');
assert.ok(!firstStep.has(14606), 'Step 1 must dim the later destination');
assert.ok(secondStep.has(12795) && secondStep.has(14606), 'Step 2 must preserve earlier destinations');
for (const id of firstStep) assert.ok(secondStep.has(id), 'Progression must accumulate earlier paths');
assert.equal(progressionNodes(visible, recovered, null), null);
console.log('Progression checks passed: later branches dim and earlier paths remain highlighted.');

const { shortestAllocationPath } = snapshotContext.exports;
const pathToFirst = shortestAllocationPath(tree.nodes, new Set(), recovered.classId, 12795);
assert.ok(pathToFirst && pathToFirst.length > 1, 'An empty tree must allocate the route to the first notable');
assert.equal(pathToFirst.at(-1), 12795);
assert.equal(tree.nodes.find(node => node.id === pathToFirst[0]).classStart, recovered.classId);
const pathToSecond = shortestAllocationPath(tree.nodes, new Set(pathToFirst), recovered.classId, 14606);
assert.ok(pathToSecond && pathToSecond.at(-1) === 14606);
assert.ok(pathToFirst.includes(pathToSecond[0]), 'Later paths must connect to the existing allocation');
const edgesForCheck = snapshotContext.exports.treeEdges(tree.nodes);
for (const path of [pathToFirst, pathToSecond]) {
  for (let i = 1; i < path.length; i++) assert.ok(edgesForCheck.some(([a, b]) => (a.id === path[i - 1] && b.id === path[i]) || (b.id === path[i - 1] && a.id === path[i])), 'Auto-allocation cannot skip connecting nodes');
}
const stub = (id, out, classStart = null, kind = 'normal') => ({ id, out, classStart, kind, ascendancy: null, bloodline: false, ascendancyStart: false });
const branch = [stub(0, [1, 3], 1), stub(1, [2]), stub(2, [5]), stub(3, [5]), stub(5, [])];
assert.equal(shortestAllocationPath(branch, new Set(), 1, 5).join(','), '0,3,5', 'Use the shortest route rather than the first discovered branch');
assert.equal(shortestAllocationPath(branch, new Set([1, 2]), 1, 5).join(','), '2,5', 'Prefer connecting to existing allocated nodes');
assert.equal(shortestAllocationPath([...branch, stub(9, [])], new Set(), 1, 9), null, 'Do not allocate disconnected destinations');
const masteryShortcut = [stub(0, [1, 3], 1), stub(1, [5], null, 'mastery'), stub(3, [4]), stub(4, [5]), stub(5, [])];
assert.equal(shortestAllocationPath(masteryShortcut, new Set(), 1, 5).join(','), '0,3,4,5', 'Masteries cannot be used as travel shortcuts');
console.log('Auto-allocation checks passed: class start, shortest route, existing branches, disconnected nodes, and mastery restrictions.');

const { unallocateBranch } = snapshotContext.exports;
assert.equal(unallocateBranch(branch, new Set([0, 1, 2, 3]), 1, 1).sort().join(','), '0,3', 'Refund disconnected descendants while preserving the other branch');
assert.equal(unallocateBranch(branch, new Set([0, 1, 2, 3, 5]), 1, 3).sort().join(','), '0,1,2,5', 'An alternate allocated route must preserve downstream nodes');
const allAllocated = new Set([...pathToFirst, ...pathToSecond]);
const refunded = unallocateBranch(tree.nodes, allAllocated, recovered.classId, pathToFirst[1]);
assert.ok(!refunded.includes(pathToFirst[1]));
assert.ok(refunded.length < allAllocated.size, 'Refunding an early travel node must cascade');
assert.equal(unallocateBranch(branch, new Set([0, 1]), 1, 0).join(','), '0,1', 'Class starts cannot be refunded');
const withAscendancy = [...branch, { ...stub(20, [21]), ascendancy: 'Chieftain', ascendancyStart: true }, { ...stub(21, []), ascendancy: 'Chieftain' }];
assert.ok(unallocateBranch(withAscendancy, new Set([0, 1, 2, 20, 21]), 1, 1).includes(21), 'Refunding the main tree must preserve ascendancy allocations');
console.log('Refund checks passed: disconnected branches, alternate paths, protected starts, and separate ascendancy allocations.');

const { continueFromSnapshot } = snapshotContext.exports;
const earlierJson = JSON.stringify(recovered);
const nextAct = continueFromSnapshot(normalizeSnapshot({ title: 'Act 2', width: 600, height: 300 }), recovered);
assert.equal(nextAct.title, 'Act 2');
assert.equal(nextAct.width, 600);
assert.equal(nextAct.version, recovered.version);
assert.equal(nextAct.classId, recovered.classId);
assert.equal(nextAct.markers.length, 0);
assert.equal(nextAct.frame, null);
assert.equal(nextAct.nodes.join(','), recovered.nodes.join(','));
assert.equal(nextAct.inheritedNodes.join(','), recovered.nodes.join(','));
assert.equal(JSON.stringify(normalizeSnapshot(JSON.parse(JSON.stringify(nextAct)))), JSON.stringify(nextAct), 'Inherited paths must survive saving and reload');
const highlightedContinuation = progressionNodes(visible, { ...nextAct, markers: recovered.markers }, 12795);
for (const id of nextAct.inheritedNodes) assert.ok(highlightedContinuation.has(id), 'Earlier act allocations stay visible when selecting a new step');
nextAct.nodes.pop(); nextAct.mastery['123'] = 5; nextAct.inheritedNodes.pop();
assert.equal(JSON.stringify(recovered), earlierJson, 'Editing the next act must never mutate the earlier act');
console.log('Continuation checks passed: copied allocations, fresh markers, version matching, persistence, and independent snapshots.');

const movedSnapshot = normalizeSnapshot({ ...recovered, markers: recovered.markers.map((marker, i) => i ? marker : { ...marker, offsetX: 180, offsetY: -120 }) });
const restoredMoved = normalizeSnapshot(JSON.parse(JSON.stringify(movedSnapshot)));
assert.equal(restoredMoved.markers[0].offsetX, 180);
assert.equal(restoredMoved.markers[0].offsetY, -120);
for (const scale of [.12, .4]) {
  const size = { width: 480, height: 240, dpr: 1 }, camera = { x: 0, y: 0, scale };
  const original = markerPositions(recovered.markers, visible, camera, size)[0];
  const moved = markerPositions(restoredMoved.markers, visible, camera, size)[0];
  assert.ok(Math.abs(moved.x - original.x - 180 * scale) < .00001);
  assert.ok(Math.abs(moved.y - original.y + 120 * scale) < .00001);
  assert.equal(moved.nodeId, original.nodeId, 'Moving a label must not change its destination');
}
assert.equal(normalizeSnapshot({ markers: [{ nodeId: 1, note: '', offsetX: Infinity, offsetY: 99999 }] }).markers[0].offsetY, 5000);
console.log('Marker position checks passed: saved offsets, zoom scaling, destination identity, and bounds.');

const { stepNodeIds } = snapshotContext.exports;
const grouped = normalizeSnapshot({ ...recovered, markers: [{ ...recovered.markers[0], nodeIds: [12795, 14606, 14606] }] });
assert.equal(stepNodeIds(grouped.markers[0]).join(','), '12795,14606');
const groupProgress = progressionNodes(visible, grouped, 12795);
assert.ok(groupProgress.has(12795) && groupProgress.has(14606), 'Selecting one step must highlight every assigned destination');
assert.equal(normalizeSnapshot(JSON.parse(JSON.stringify(grouped))).markers[0].nodeIds.join(','), '12795,14606', 'Grouped destinations must survive guide saves');
assert.equal(stepNodeIds(recovered.markers[0]).join(','), '12795', 'Existing single-node steps remain compatible');
console.log('Grouped step checks passed: deduplication, cumulative paths, persistence, and older snapshots.');

const { saveMarkerPositions, cropViewport } = snapshotContext.exports;
for (const [width, height] of [[600, 240], [320, 420], [600, 1200]]) {
  const pickerSize = { width: 1140, height: 630, dpr: 1 };
  const pickerCamera = { x: 300, y: 500, scale: .32 };
  const cropBox = cropViewport(pickerSize, width, height);
  const frame = captureFrame(pickerCamera, pickerSize, width, height);
  assert.equal(frame.width * pickerCamera.scale, cropBox.width);
  const savedMarkers = normalizeSnapshot({ ...recovered, markers: saveMarkerPositions(movedSnapshot.markers, visible, pickerCamera, pickerSize) }).markers;
  const pickerMarkers = markerPositions(movedSnapshot.markers, visible, pickerCamera, pickerSize);
  for (const outputWidth of [width, width / 2]) {
    const outputSize = { width: outputWidth, height: outputWidth * height / width, dpr: 1 };
    const outputCamera = cameraForFrame(frame, outputSize, 0);
    const outputMarkers = markerPositions(savedMarkers, visible, outputCamera, outputSize);
    for (let i = 0; i < pickerMarkers.length; i++) {
      assert.ok(Math.abs(outputMarkers[i].x / outputSize.width - (pickerMarkers[i].x - cropBox.x) / cropBox.width) < .00001, 'Marker X must match its position within the dashed crop');
      assert.ok(Math.abs(outputMarkers[i].y / outputSize.height - (pickerMarkers[i].y - cropBox.y) / cropBox.height) < .00001, 'Marker Y must match its position within the dashed crop');
    }
  }
  const reopenedCamera = cameraForFrame(frame, { ...pickerSize, width: cropBox.width, height: cropBox.height }, 0);
  assert.ok(Math.abs(reopenedCamera.scale - pickerCamera.scale) < .00001, 'Reopening the manual crop must restore the same zoom');
}
console.log('Manual crop checks passed: exact dashed bounds, marker placement at responsive widths, and reopening zoom.');

const { respecBaseline } = snapshotContext.exports;
const beforeSnapshot = normalizeSnapshot({ ...before, version: '3.28.0', title: 'Before RF swap' });
const respecSnapshot = normalizeSnapshot({ ...after, version: '3.28.0', respec: { ...respecBaseline(beforeSnapshot), note: 'Use quest refunds, then gold.' } });
const savedRespec = normalizeSnapshot(JSON.parse(JSON.stringify(respecSnapshot)));
const respecChanges = stageChanges(snapshotStage(savedRespec), savedRespec.respec);
assert.equal(respecChanges.removed.size, 28);
assert.equal(respecChanges.added.size, 24);
assert.equal(savedRespec.respec.title, beforeSnapshot.title);
assert.equal(savedRespec.respec.note, 'Use quest refunds, then gold.');
assert.ok(respecChanges.removed.has(31961));
const originalBefore = beforeSnapshot.nodes.join(',');
respecSnapshot.respec.nodes.pop();
assert.equal(beforeSnapshot.nodes.join(','), originalBefore, 'Comparison baselines must be independent of earlier guide snapshots');
assert.equal(continueFromSnapshot(normalizeSnapshot({ title: 'Next act' }), savedRespec).respec, undefined, 'Continuing into a later act must start from the After allocations without retaining the respec overlay');
const removalStep = normalizeSnapshot({ ...savedRespec, markers: [{ nodeId: 31961, note: 'Refund this keystone first.' }] });
assert.equal(removalStep.markers[0].nodeId, 31961, 'Removal instructions must retain markers on refunded nodes');
console.log('Respec checks passed: real 28-removal / 24-addition transition, saved notes, independent baseline, continuation, and removal markers.');

assert.equal(normalizeSnapshot({ height: 1200 }).height, 1200);
assert.equal(normalizeSnapshot({ height: 5000 }).height, 1200);

const { ascendancyStepMarkers } = snapshotContext.exports;
const ascendancyTree = JSON.parse(fs.readFileSync(new URL('../public/data/trees/3.29.1/tree.json', import.meta.url), 'utf8'));
const ascendancyExample = normalizeSnapshot(JSON.parse(fs.readFileSync(new URL('../src/data/tree-ascendancy-example.json', import.meta.url), 'utf8')));
const ascMarkers = ascendancyStepMarkers(ascendancyTree, ascendancyExample);
assert.equal(ascMarkers.map(marker => marker.nodeId).join(','), '48480,32249');
assert.ok(ascMarkers.every(marker => ascendancyTree.nodes.find(node => node.id === marker.nodeId).stats.length > 0));
const authored = { ...ascendancyExample, markers: [{ nodeId: 32249, note: 'Second lab destination', positionX: 200, positionY: 300 }, { nodeId: 48480, note: 'First lab destination' }] };
assert.equal(JSON.stringify(ascendancyStepMarkers(ascendancyTree, authored)), JSON.stringify(authored.markers), 'Existing order, positions, and notes must be preserved');
assert.equal(ascendancyStepMarkers(ascendancyTree, { ...ascendancyExample, markers: [{ nodeId: 48480, nodeIds: [32249], note: 'Both notables' }] }).length, 1, 'Grouped ascendancy destinations must not get duplicate markers');
assert.equal(ascendancyStepMarkers(ascendancyTree, { ...ascendancyExample, ascendancyNumbering: 'manual' }).length, 0);
assert.equal(ascendancyStepMarkers(tree, recovered).length, recovered.markers.length, 'Main-tree marker behavior must remain unchanged');
assert.equal(normalizeSnapshot(JSON.parse(JSON.stringify({ ...ascendancyExample, markers: ascMarkers, ascendancyNumbering: 'manual' }))).ascendancyNumbering, 'manual');
console.log('Ascendancy checks passed: automatic notable numbering, stats availability, existing order and positions, grouped destinations, and manual opt-out.');
