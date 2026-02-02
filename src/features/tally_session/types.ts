export type SyncStatus = 'pending' | 'synced' | 'error';

export type SpeciesRequirement = {
  species_code: string;
  display_name: string;
  required_ratio: number;
};

export type TallySession = {
  session_id: string;
  created_at: number;
  block_name: string;
  notes?: string;
  species: SpeciesRequirement[];
  sync_status: SyncStatus;
  sync_error?: string;
};

export type Bagup = {
  bagup_id: string;
  session_id: string;
  created_at: number;
  counts: Record<string, number>;
  sync_status: SyncStatus;
  sync_error?: string;
};

export type CreateTallySessionInput = {
  block_name: string;
  notes?: string;
  species: SpeciesRequirement[];
};

export type Project = {
  project_name: string;
  species_data: Record<string, string> | { error: string; raw: string };
};
