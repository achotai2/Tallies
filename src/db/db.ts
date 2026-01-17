import Dexie, { type Table } from 'dexie';
import type { TallyRecord } from '../features/tallies/types';

class TalliesDatabase extends Dexie {
  tallies!: Table<TallyRecord, string>;

  constructor() {
    super('tallies-db');
    this.version(1).stores({
      tallies: 'client_id, date, created_at, sync_status',
    });
  }
}

const db = new TalliesDatabase();

export const initDb = async (): Promise<void> => {
  if (db.isOpen()) {
    return;
  }
  await db.open();
};

export const addTally = async (tally: TallyRecord): Promise<void> => {
  await initDb();
  await db.tallies.add(tally);
};

export const getTalliesByDate = async (date: string): Promise<TallyRecord[]> => {
  await initDb();
  return db.tallies.where('date').equals(date).reverse().sortBy('created_at');
};

export const getPendingTallies = async (): Promise<TallyRecord[]> => {
  await initDb();
  return db.tallies.where('sync_status').equals('pending').toArray();
};

export const getTalliesByStatus = async (statuses: TallyRecord['sync_status'][]): Promise<TallyRecord[]> => {
  await initDb();
  return db.tallies
    .where('sync_status')
    .anyOf(statuses)
    .reverse()
    .sortBy('created_at');
};

export const countByStatus = async (status: TallyRecord['sync_status']): Promise<number> => {
  await initDb();
  return db.tallies.where('sync_status').equals(status).count();
};

export const updateTally = async (
  client_id: string,
  partialUpdate: Partial<TallyRecord>
): Promise<void> => {
  await initDb();
  await db.tallies.update(client_id, partialUpdate);
};
