import { db } from '../../db';
import type { CreateTallyInput, TallyRecord } from './types';

const createUUID = (): string => {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createLocalTally = async (input: CreateTallyInput): Promise<TallyRecord> => {
  const tally: TallyRecord = {
    client_id: createUUID(),
    date: input.date,
    trees: input.trees,
    notes: input.notes?.trim() || undefined,
    block_name: input.block_name?.trim() || undefined,
    created_at: Date.now(),
    sync_status: 'pending',
  };

  await db.tallies.add(tally);
  return tally;
};

export const listTalliesByDate = async (date: string): Promise<TallyRecord[]> => {
  return db.tallies.where('date').equals(date).reverse().sortBy('created_at');
};

export const listPendingTallies = async (limit = 20): Promise<TallyRecord[]> => {
  return db.tallies.where('sync_status').equals('pending').limit(limit).toArray();
};

export const listSyncQueue = async (limit = 20): Promise<TallyRecord[]> => {
  return db.tallies
    .where('sync_status')
    .anyOf(['pending', 'error'])
    .limit(limit)
    .toArray();
};

export const listSyncCounts = async (): Promise<{ pending: number; synced: number; error: number }> => {
  const [pending, synced, error] = await Promise.all([
    db.tallies.where('sync_status').equals('pending').count(),
    db.tallies.where('sync_status').equals('synced').count(),
    db.tallies.where('sync_status').equals('error').count(),
  ]);

  return { pending, synced, error };
};

export const markTalliesSynced = async (tallies: TallyRecord[]): Promise<void> => {
  await db.transaction('rw', db.tallies, async () => {
    await Promise.all(
      tallies.map((tally) =>
        db.tallies.update(tally.client_id, {
          sync_status: 'synced',
          sync_error: undefined,
        })
      )
    );
  });
};

export const markTalliesError = async (tallies: TallyRecord[], error: string): Promise<void> => {
  await db.transaction('rw', db.tallies, async () => {
    await Promise.all(
      tallies.map((tally) =>
        db.tallies.update(tally.client_id, {
          sync_status: 'error',
          sync_error: error,
        })
      )
    );
  });
};
