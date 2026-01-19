import type { Bagup, SpeciesRequirement } from './types';

export const calculateTotals = (
  species: SpeciesRequirement[],
  bagups: Bagup[]
): Record<string, number> => {
  // Sum all trees per species across bagups for running totals.
  const totals: Record<string, number> = {};
  species.forEach((item) => {
    totals[item.species_code] = 0;
  });
  bagups.forEach((bagup) => {
    Object.entries(bagup.counts).forEach(([code, count]) => {
      totals[code] = (totals[code] ?? 0) + count;
    });
  });
  return totals;
};

export const calculateRatios = (
  species: SpeciesRequirement[],
  totals: Record<string, number>
): Record<string, number> => {
  // Ratios are derived from totals so far (species total / overall total).
  const overall = species.reduce((sum, item) => sum + (totals[item.species_code] ?? 0), 0);
  const ratios: Record<string, number> = {};
  species.forEach((item) => {
    ratios[item.species_code] = overall === 0 ? 0 : (totals[item.species_code] ?? 0) / overall;
  });
  return ratios;
};

export const formatElapsed = (current: number, previous?: number): string => {
  // Format elapsed time using timestamps (created_at values).
  if (!previous) {
    return 'First bagup';
  }
  const durationMs = Math.max(current - previous, 0);
  return formatDuration(durationMs);
};

export const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

export const buildElapsedMap = (bagups: Bagup[]): Record<string, string> => {
  const sorted = [...bagups].sort((a, b) => a.created_at - b.created_at);
  const elapsedById: Record<string, string> = {};
  sorted.forEach((bagup, index) => {
    const previous = index === 0 ? undefined : sorted[index - 1]?.created_at;
    elapsedById[bagup.bagup_id] = formatElapsed(bagup.created_at, previous);
  });
  return elapsedById;
};
