import type { SyncStatus, TallyRecord } from '../features/tallies/types';

const DB_NAME = 'tallies-db';
const DB_VERSION = 1;
const STORE_NAME = 'tallies';

let dbPromise: Promise<IDBDatabase> | null = null;

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

export const initDb = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'client_id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('sync_status', 'sync_status', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

export const addTally = async (tally: TallyRecord): Promise<void> => {
  const db = await initDb();
  // Readwrite transaction because we're mutating the store.
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).add(tally);
  await transactionDone(transaction);
};

export const getTalliesByDate = async (date: string): Promise<TallyRecord[]> => {
  const db = await initDb();
  // Readonly transaction to safely read data without locks.
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const index = transaction.objectStore(STORE_NAME).index('date');
  const results = await requestToPromise<TallyRecord[]>(index.getAll(date));
  await transactionDone(transaction);
  return results.sort((a, b) => a.created_at - b.created_at);
};

export const getPendingTallies = async (): Promise<TallyRecord[]> => {
  const db = await initDb();
  // Readonly transaction for consistent snapshot of pending data.
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const index = transaction.objectStore(STORE_NAME).index('sync_status');
  const results = await requestToPromise<TallyRecord[]>(index.getAll('pending'));
  await transactionDone(transaction);
  return results;
};

export const getTalliesByStatus = async (statuses: SyncStatus[]): Promise<TallyRecord[]> => {
  const db = await initDb();
  // Readonly transaction to fetch multiple status buckets efficiently.
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const index = transaction.objectStore(STORE_NAME).index('sync_status');
  const requests = statuses.map((status) => requestToPromise<TallyRecord[]>(index.getAll(status)));
  const results = await Promise.all(requests);
  await transactionDone(transaction);
  return results.flat().sort((a, b) => a.created_at - b.created_at);
};

export const countByStatus = async (status: SyncStatus): Promise<number> => {
  const db = await initDb();
  // Readonly transaction for fast index count without touching records.
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const index = transaction.objectStore(STORE_NAME).index('sync_status');
  const count = await requestToPromise<number>(index.count(status));
  await transactionDone(transaction);
  return count;
};

export const updateTally = async (
  client_id: string,
  partialUpdate: Partial<TallyRecord>
): Promise<void> => {
  const db = await initDb();
  // Readwrite transaction because we're updating an existing record.
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const existing = await requestToPromise<TallyRecord | undefined>(store.get(client_id));
  if (!existing) {
    await transactionDone(transaction);
    return;
  }
  store.put({ ...existing, ...partialUpdate });
  await transactionDone(transaction);
};
