import { API_BASE_URL } from './config';
import type { TallyRecord } from '../features/tallies/types';

export const postTalliesBatch = async (tallies: TallyRecord[]): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/tallies/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tallies }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }
};
