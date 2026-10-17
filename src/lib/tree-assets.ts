import type { PassiveTree } from './passive-tree';
export const treeBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/trees/`;
const trees = new Map<string, Promise<PassiveTree>>();
const sprites = new Map<string, Promise<HTMLImageElement[]>>();
export function loadPassiveTree(version: string) {
  if (!trees.has(version)) trees.set(version, fetch(`${treeBase}${version}/tree.json`).then(r => { if (!r.ok) throw new Error('Tree data could not be loaded.'); return r.json(); }).catch(error => { trees.delete(version); throw error; }));
  return trees.get(version)!;
}
export function loadTreeSprites(tree: PassiveTree) {
  if (!sprites.has(tree.version)) sprites.set(tree.version, Promise.all(tree.sheets.map(sheet => new Promise<HTMLImageElement>(resolve => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(image); image.src = `${treeBase}${tree.version}/${sheet.file}`;
  }))).then(images => { if (images.some(image => !image.naturalWidth)) sprites.delete(tree.version); return images; }));
  return sprites.get(tree.version)!;
}
