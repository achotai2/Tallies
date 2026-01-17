import Dexie, { type Table } from 'dexie';
import type { TallyRecord } from '../features/tallies/types';

export class TalliesDatabase extends Dexie {
  tallies!: Table<TallyRecord, string>;

  constructor() {
    super('tallies');
    this.version(1).stores({
      tallies: 'client_id, date, sync_status, created_at',
    });
  }
}

export const db = new TalliesDatabase();
