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
  let created_at = Date.now();
  if (input.date) {
    const [year, month, day] = input.date.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const now = new Date();
    date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    created_at = date.getTime();
  }

  const session: TallySession = {
    session_id: createUUID(),
    created_at,
    block_name: input.block_name.trim(),
    project_name: input.project_name?.trim(),
    supervisor: input.supervisor?.trim(),
    target_density: input.target_density,
    notes: input.notes?.trim() || undefined,
    species: input.species,
    sync_status: 'draft',
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
  const sessions = await getTallySessionsByStatus(['finalized', 'error']);
  return sessions.slice(0, limit);
};

export const listSessionSyncCounts = async (): Promise<{
  pending: number;
  draft: number;
  synced: number;
  error: number;
  finalized: number;
  archived: number;
}> => {
  const [pending, draft, synced, error, finalized, archived] = await Promise.all([
    countSessionsByStatus('pending'),
    countSessionsByStatus('draft'),
    countSessionsByStatus('synced'),
    countSessionsByStatus('error'),
    countSessionsByStatus('finalized'),
    countSessionsByStatus('archived'),
  ]);

  return { pending, draft, synced, error, finalized, archived };
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

export const createBagup = async (
  session_id: string,
  speciesCodes: string[],
  location?: { lat: number; lng: number }
): Promise<Bagup> => {
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

  if (location) {
    bagup.lat = location.lat;
    bagup.lng = location.lng;
  }

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
  const bagups = await getBagupsByStatus(['finalized', 'error']);
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

export const finalizeSession = async (session_id: string): Promise<void> => {
  const session = await getTallySession(session_id);
  if (!session) return;

  await updateTallySession(session_id, { sync_status: 'finalized', sync_error: undefined });

  const bagups = await getBagupsBySession(session_id);
  await Promise.all(
    bagups
      .filter((b) => b.sync_status === 'pending' || b.sync_status === 'error')
      .map((b) => updateBagup(b.bagup_id, { sync_status: 'finalized', sync_error: undefined }))
  );
};

export const archiveSession = async (session_id: string): Promise<void> => {
  await updateTallySession(session_id, { sync_status: 'archived' });
};

export const getTallySessionsByFilter = async (filter: string): Promise<TallySession[]> => {
  switch (filter) {
    case 'Synced Sessions':
      return getTallySessionsByStatus(['synced']);
    case 'Finalized Sessions':
      return getTallySessionsByStatus(['finalized']);
    case 'Archived Sessions':
      return getTallySessionsByStatus(['archived']);
    case 'Error Sessions':
      return getTallySessionsByStatus(['error']);
    case 'All Sessions':
    default:
      return getTallySessionsByCreatedAt();
  }
};
