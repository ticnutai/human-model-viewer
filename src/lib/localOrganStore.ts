export type LocalOrgan = {
  id: string;
  name: string;
  fileName: string;
  blob: Blob;
  position: [number, number, number];
  scale: number;
  color: string;
  createdAt: number;
};

const DB_NAME = "niflaot-organ-library";
const STORE_NAME = "organs";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listLocalOrgans(): Promise<LocalOrgan[]> {
  const db = await openDatabase();
  return new Promise<LocalOrgan[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as LocalOrgan[]).sort((a, b) => a.createdAt - b.createdAt));
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export async function saveLocalOrgan(organ: LocalOrgan) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(organ);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export async function removeLocalOrgan(id: string) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}
