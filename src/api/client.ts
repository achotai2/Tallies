import { API_BASE_URL } from './config';
import type { TallyRecord } from '../features/tallies/types';
import type { Bagup, TallySession, Project } from '../features/tally_session/types';

export type TalliesBatchPayload = {
  tallies: TallyRecord[];
  sessions: TallySession[];
  bagups: Bagup[];
};

export const postTalliesBatch = async (payload: TalliesBatchPayload): Promise<void> => {
  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }
};

export const fetchProjects = async (): Promise<Project[]> => {
  const response = await fetch(API_BASE_URL, {
    method: 'GET',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data as Project[];
};
