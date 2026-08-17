type MeshMappingCacheRecord = {
  key: string;
  rows: unknown[];
  updatedAt: number;
};

const DB_NAME = "niflaot-mesh-mapping-cache";
const STORE_NAME = "mapping-sets";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readMeshMappingCache(key: string): Promise<unknown[] | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDatabase();
  return new Promise<unknown[] | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as MeshMappingCacheRecord | undefined)?.rows || null);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export async function writeMeshMappingCache(key: string, rows: unknown[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ key, rows, updatedAt: Date.now() } satisfies MeshMappingCacheRecord);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}
