import { postTalliesBatch } from '../api/client';
import {
  listSyncQueue,
  markTalliesError,
  markTalliesSynced,
} from '../features/tallies/tallies';

const BATCH_SIZE = 20;

export const syncTallies = async (): Promise<{ synced: number; failed: number; skipped: boolean }> => {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, skipped: true };
  }

  let synced = 0;
  let failed = 0;

  while (true) {
    const pending = await listSyncQueue(BATCH_SIZE);
    if (pending.length === 0) {
      break;
    }

    try {
      await postTalliesBatch(pending);
      await markTalliesSynced(pending);
      synced += pending.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      await markTalliesError(pending, message);
      failed += pending.length;
    }

    if (pending.length < BATCH_SIZE) {
      break;
    }
  }

  return { synced, failed, skipped: false };
};
