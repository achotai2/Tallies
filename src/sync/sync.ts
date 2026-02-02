import { fetchProjects, postTalliesBatch } from '../api/client';
import { saveProjects } from '../db';
import {
  listSyncQueue,
  markTalliesError,
  markTalliesSynced,
} from '../features/tallies/tallies';
import {
  listBagupSyncQueue,
  listSessionSyncQueue,
  markBagupsError,
  markBagupsSynced,
  markSessionsError,
  markSessionsSynced,
} from '../features/tally_session/db';

const BATCH_SIZE = 20;

export const syncTallies = async (): Promise<{ synced: number; failed: number; skipped: boolean }> => {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, skipped: true };
  }

  let synced = 0;
  let failed = 0;

  while (true) {
    const [pendingTallies, pendingSessions, pendingBagups] = await Promise.all([
      listSyncQueue(BATCH_SIZE),
      listSessionSyncQueue(BATCH_SIZE),
      listBagupSyncQueue(BATCH_SIZE),
    ]);

    if (pendingTallies.length === 0 && pendingSessions.length === 0 && pendingBagups.length === 0) {
      break;
    }

    try {
      await postTalliesBatch({
        tallies: pendingTallies,
        sessions: pendingSessions,
        bagups: pendingBagups,
      });
      await Promise.all([
        markTalliesSynced(pendingTallies),
        markSessionsSynced(pendingSessions),
        markBagupsSynced(pendingBagups),
      ]);
      synced += pendingTallies.length + pendingSessions.length + pendingBagups.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      await Promise.all([
        markTalliesError(pendingTallies, message),
        markSessionsError(pendingSessions, message),
        markBagupsError(pendingBagups, message),
      ]);
      failed += pendingTallies.length + pendingSessions.length + pendingBagups.length;
    }

    if (
      pendingTallies.length < BATCH_SIZE &&
      pendingSessions.length < BATCH_SIZE &&
      pendingBagups.length < BATCH_SIZE
    ) {
      break;
    }
  }

  return { synced, failed, skipped: false };
};

export const syncProjects = async (): Promise<void> => {
  if (!navigator.onLine) {
    return;
  }
  try {
    const projects = await fetchProjects();
    await saveProjects(projects);
  } catch (error) {
    console.error('Failed to sync projects', error);
  }
};
