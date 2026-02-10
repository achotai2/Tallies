import Dexie, { type Table } from 'dexie';
import type { TallyRecord } from '../features/tallies/types';
import type { Bagup, TallySession, Project } from '../features/tally_session/types';

class TalliesDatabase extends Dexie {
  tallies!: Table<TallyRecord, string>;
  tally_sessions!: Table<TallySession, string>;
  bagups!: Table<Bagup, string>;
  projects!: Table<Project, string>;
  supervisors!: Table<{ name: string }, string>;

  constructor() {
    super('tallies-db');
    this.version(1).stores({
      tallies: 'client_id, date, created_at, sync_status',
    });
    // v2 adds tally sessions + bagups with indexed fields for offline-first sync.
    this.version(2).stores({
      tallies: 'client_id, date, created_at, sync_status',
      tally_sessions: 'session_id, created_at, sync_status',
      bagups: 'bagup_id, session_id, created_at, sync_status, [session_id+created_at]',
    });
    // v3 adds projects table for syncing project details
    this.version(3).stores({
      tallies: 'client_id, date, created_at, sync_status',
      tally_sessions: 'session_id, created_at, sync_status',
      bagups: 'bagup_id, session_id, created_at, sync_status, [session_id+created_at]',
      projects: 'project_name',
    });
    // v4 adds supervisors table
    this.version(4).stores({
      tallies: 'client_id, date, created_at, sync_status',
      tally_sessions: 'session_id, created_at, sync_status',
      bagups: 'bagup_id, session_id, created_at, sync_status, [session_id+created_at]',
      projects: 'project_name',
      supervisors: 'name',
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

export const addTallySession = async (session: TallySession): Promise<void> => {
  await initDb();
  await db.tally_sessions.add(session);
};

export const updateTallySession = async (
  session_id: string,
  partialUpdate: Partial<TallySession>
): Promise<void> => {
  await initDb();
  await db.tally_sessions.update(session_id, partialUpdate);
};

export const getTallySession = async (session_id: string): Promise<TallySession | undefined> => {
  await initDb();
  return db.tally_sessions.get(session_id);
};

export const getTallySessionsByStatus = async (
  statuses: TallySession['sync_status'][]
): Promise<TallySession[]> => {
  await initDb();
  return db.tally_sessions
    .where('sync_status')
    .anyOf(statuses)
    .reverse()
    .sortBy('created_at');
};

export const getTallySessionsByCreatedAt = async (): Promise<TallySession[]> => {
  await initDb();
  return db.tally_sessions.orderBy('created_at').reverse().toArray();
};

export const countSessionsByStatus = async (status: TallySession['sync_status']): Promise<number> => {
  await initDb();
  return db.tally_sessions.where('sync_status').equals(status).count();
};

export const addBagup = async (bagup: Bagup): Promise<void> => {
  await initDb();
  await db.bagups.add(bagup);
};

export const updateBagup = async (bagup_id: string, partialUpdate: Partial<Bagup>): Promise<void> => {
  await initDb();
  await db.bagups.update(bagup_id, partialUpdate);
};

export const deleteBagup = async (bagup_id: string): Promise<void> => {
  await initDb();
  await db.bagups.delete(bagup_id);
};

export const getBagupsBySession = async (session_id: string): Promise<Bagup[]> => {
  await initDb();
  return db.bagups
    .where('[session_id+created_at]')
    .between([session_id, Dexie.minKey], [session_id, Dexie.maxKey])
    .reverse()
    .toArray();
};

export const getBagupsByStatus = async (statuses: Bagup['sync_status'][]): Promise<Bagup[]> => {
  await initDb();
  return db.bagups
    .where('sync_status')
    .anyOf(statuses)
    .reverse()
    .sortBy('created_at');
};

export const countBagupsByStatus = async (status: Bagup['sync_status']): Promise<number> => {
  await initDb();
  return db.bagups.where('sync_status').equals(status).count();
};

export const saveProjects = async (projects: Project[]): Promise<void> => {
  await initDb();
  await db.transaction('rw', db.projects, async () => {
    await db.projects.clear();
    await db.projects.bulkPut(projects);
  });
};

export const listProjects = async (): Promise<Project[]> => {
  await initDb();
  return db.projects.toArray();
};

export const saveSupervisors = async (supervisors: string[]): Promise<void> => {
  await initDb();
  await db.transaction('rw', db.supervisors, async () => {
    await db.supervisors.clear();
    await db.supervisors.bulkPut(supervisors.map((name) => ({ name })));
  });
};

export const listSupervisors = async (): Promise<string[]> => {
  await initDb();
  const result = await db.supervisors.toArray();
  return result.map((s) => s.name);
};
