import {
  addBagup,
  addTallySession,
  countBagupsByStatus,
  countSessionsByStatus,
  deleteBagup,
  getBagupsBySession,
  getBagupsByStatus,
  getTallySession,
  getTallySessionsByCreatedAt,
  getTallySessionsByStatus,
  updateBagup,
  updateTallySession,
} from '../../db';
import type { Bagup, CreateTallySessionInput, TallySession } from './types';

const createUUID = (): string => {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createTallySession = async (input: CreateTallySessionInput): Promise<TallySession> => {
  const session: TallySession = {
    session_id: createUUID(),
    created_at: Date.now(),
    block_name: input.block_name.trim(),
    notes: input.notes?.trim() || undefined,
    species: input.species,
    sync_status: 'pending',
  };

  await addTallySession(session);
  return session;
};

export const listTallySessions = async (): Promise<TallySession[]> => {
  return getTallySessionsByCreatedAt();
};

export const fetchTallySession = async (session_id: string): Promise<TallySession | undefined> => {
  return getTallySession(session_id);
};

export const listSessionSyncQueue = async (limit = 20): Promise<TallySession[]> => {
  const sessions = await getTallySessionsByStatus(['pending', 'error']);
  return sessions.slice(0, limit);
};

export const listSessionSyncCounts = async (): Promise<{
  pending: number;
  synced: number;
  error: number;
}> => {
  const [pending, synced, error] = await Promise.all([
    countSessionsByStatus('pending'),
    countSessionsByStatus('synced'),
    countSessionsByStatus('error'),
  ]);

  return { pending, synced, error };
};

export const markSessionsSynced = async (sessions: TallySession[]): Promise<void> => {
  await Promise.all(
    sessions.map((session) =>
      updateTallySession(session.session_id, { sync_status: 'synced', sync_error: undefined })
    )
  );
};

export const markSessionsError = async (sessions: TallySession[], error: string): Promise<void> => {
  await Promise.all(
    sessions.map((session) =>
      updateTallySession(session.session_id, { sync_status: 'error', sync_error: error })
    )
  );
};

export const createBagup = async (session_id: string, speciesCodes: string[]): Promise<Bagup> => {
  const counts: Record<string, number> = {};
  speciesCodes.forEach((code) => {
    counts[code] = 0;
  });

  const bagup: Bagup = {
    bagup_id: createUUID(),
    session_id,
    created_at: Date.now(),
    counts,
    sync_status: 'pending',
  };

  await addBagup(bagup);
  return bagup;
};

export const saveBagupCounts = async (bagup_id: string, counts: Record<string, number>): Promise<void> => {
  await updateBagup(bagup_id, { counts });
};

export const removeBagup = async (bagup_id: string): Promise<void> => {
  await deleteBagup(bagup_id);
};

export const listBagupsForSession = async (session_id: string): Promise<Bagup[]> => {
  return getBagupsBySession(session_id);
};

export const listBagupSyncQueue = async (limit = 20): Promise<Bagup[]> => {
  const bagups = await getBagupsByStatus(['pending', 'error']);
  return bagups.slice(0, limit);
};

export const listBagupSyncCounts = async (): Promise<{
  pending: number;
  synced: number;
  error: number;
}> => {
  const [pending, synced, error] = await Promise.all([
    countBagupsByStatus('pending'),
    countBagupsByStatus('synced'),
    countBagupsByStatus('error'),
  ]);

  return { pending, synced, error };
};

export const markBagupsSynced = async (bagups: Bagup[]): Promise<void> => {
  await Promise.all(
    bagups.map((bagup) => updateBagup(bagup.bagup_id, { sync_status: 'synced', sync_error: undefined }))
  );
};

export const markBagupsError = async (bagups: Bagup[], error: string): Promise<void> => {
  await Promise.all(
    bagups.map((bagup) => updateBagup(bagup.bagup_id, { sync_status: 'error', sync_error: error }))
  );
};
