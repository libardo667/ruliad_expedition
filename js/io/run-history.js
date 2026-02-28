// IndexedDB-backed run history. Stores up to MAX_RUNS most recent runs.
const DB_NAME = 'ruliad_history';
const DB_VERSION = 1;
const STORE = 'runs';
const MAX_RUNS = 50;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'runId' });
        store.createIndex('savedAt', 'savedAt');
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

export async function saveRunToHistory(run) {
  if (!run?.runId || !run?.target) return;
  const db = await openDB();
  const record = { ...run, savedAt: Date.now() };
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  // Prune to MAX_RUNS (delete oldest)
  const all = await loadRunHistory();
  if (all.length > MAX_RUNS) {
    const toDelete = all.slice(MAX_RUNS);
    const tx2 = db.transaction(STORE, 'readwrite');
    const store2 = tx2.objectStore(STORE);
    for (const r of toDelete) store2.delete(r.runId);
  }
}

export async function loadRunHistory() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('savedAt').getAll();
    req.onsuccess = () => res((req.result || []).reverse()); // newest first
    req.onerror = () => rej(req.error);
  });
}

export async function getRunFromHistory(runId) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(runId);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => rej(req.error);
  });
}

export async function deleteRunFromHistory(runId) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(runId);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
