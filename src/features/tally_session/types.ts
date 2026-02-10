export type SyncStatus = 'pending' | 'draft' | 'synced' | 'error' | 'finalized' | 'archived';

export type SpeciesRequirement = {
  species_code: string;
  display_name: string;
  required_ratio: number;
};

export type TallySession = {
  session_id: string;
  created_at: number;
  block_name: string;
  project_name?: string;
  supervisor?: string;
  target_density?: number;
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
  project_name?: string;
  supervisor?: string;
  target_density?: number;
  notes?: string;
  species: SpeciesRequirement[];
  date?: string;
};

export type Project = {
  project_name: string;
  species_data: Record<string, string> | { error: string; raw: string };
  blocks_data: string[] | Record<string, any> | { error: string; raw: string };
};
