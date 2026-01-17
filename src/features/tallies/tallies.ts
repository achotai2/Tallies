import {
  addTally,
  countByStatus,
  getPendingTallies,
  getTalliesByDate,
  getTalliesByStatus,
  updateTally,
} from '../../db';
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

  await addTally(tally);
  return tally;
};

export const listTalliesByDate = async (date: string): Promise<TallyRecord[]> => {
  return getTalliesByDate(date);
};

export const listPendingTallies = async (limit = 20): Promise<TallyRecord[]> => {
  const pending = await getPendingTallies();
  return pending.slice(0, limit);
};

export const listSyncQueue = async (limit = 20): Promise<TallyRecord[]> => {
  const queued = await getTalliesByStatus(['pending', 'error']);
  return queued.slice(0, limit);
};

export const listSyncCounts = async (): Promise<{ pending: number; synced: number; error: number }> => {
  const [pending, synced, error] = await Promise.all([
    countByStatus('pending'),
    countByStatus('synced'),
    countByStatus('error'),
  ]);

  return { pending, synced, error };
};

export const markTalliesSynced = async (tallies: TallyRecord[]): Promise<void> => {
  await Promise.all(
    tallies.map((tally) =>
      updateTally(tally.client_id, {
        sync_status: 'synced',
        sync_error: undefined,
      })
    )
  );
};

export const markTalliesError = async (tallies: TallyRecord[], error: string): Promise<void> => {
  await Promise.all(
    tallies.map((tally) =>
      updateTally(tally.client_id, {
        sync_status: 'error',
        sync_error: error,
      })
    )
  );
};
