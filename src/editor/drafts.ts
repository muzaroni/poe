import type { Guide } from '../types';

const DB_NAME = 'poe-guide-drafts';
const STORE = 'guides';

function database(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDraft(slug: string): Promise<Guide | null> {
  const db = await database();
  return new Promise<Guide | null>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(slug);
    request.onsuccess = () => resolve((request.result as Guide) ?? null);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export async function listDrafts(): Promise<Guide[]> {
  const db = await database();
  return new Promise<Guide[]>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as Guide[]);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export async function deleteDraft(slug: string): Promise<void> {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(slug);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}

export async function saveDraft(guide: Guide): Promise<void> {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(guide, guide.slug);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}
