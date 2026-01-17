export type SyncStatus = 'pending' | 'synced' | 'error';

export type TallyRecord = {
  client_id: string;
  date: string;
  trees: number;
  notes?: string;
  block_name?: string;
  created_at: number;
  sync_status: SyncStatus;
  sync_error?: string;
};

export type CreateTallyInput = {
  date: string;
  trees: number;
  notes?: string;
  block_name?: string;
};
