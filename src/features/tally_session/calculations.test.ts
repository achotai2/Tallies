import { expect, test, describe } from "bun:test";
import {
  calculateTotals,
  calculateRatios,
  formatElapsed,
  formatDuration,
  buildElapsedMap
} from "./calculations";
import type { Bagup, SpeciesRequirement } from "./types";

describe("calculations", () => {
  describe("formatDuration", () => {
    test("formats 0ms as 0s", () => {
      expect(formatDuration(0)).toBe("0s");
    });

    test("formats 500ms as 0s (rounded down)", () => {
      expect(formatDuration(500)).toBe("0s");
    });

    test("formats 1500ms as 1s", () => {
      expect(formatDuration(1500)).toBe("1s");
    });

    test("formats 65000ms as 1m 5s", () => {
      expect(formatDuration(65000)).toBe("1m 5s");
    });

    test("formats exactly 60000ms as 1m 0s", () => {
      expect(formatDuration(60000)).toBe("1m 0s");
    });
  });

  describe("formatElapsed", () => {
    test("returns 'First bagup' when previous is undefined", () => {
      expect(formatElapsed(1000, undefined)).toBe("First bagup");
    });

    test("handles previous timestamp of 0 correctly", () => {
      // If previous is 0, it is NOT undefined, so it should calculate duration.
      expect(formatElapsed(1000, 0)).toBe("1s");
    });

    test("handles current < previous by returning 0s", () => {
      expect(formatElapsed(1000, 2000)).toBe("0s");
    });

    test("calculates elapsed time correctly", () => {
      expect(formatElapsed(70000, 5000)).toBe("1m 5s");
    });
  });

  describe("calculateTotals", () => {
    const species: SpeciesRequirement[] = [
      { species_code: "SP1", species_name: "Species 1", color: "#ff0000" },
      { species_code: "SP2", species_name: "Species 2", color: "#00ff00" },
    ];

    test("returns zero totals when no bagups are provided", () => {
      const totals = calculateTotals(species, []);
      expect(totals).toEqual({ SP1: 0, SP2: 0 });
    });

    test("sums totals correctly from multiple bagups", () => {
      const bagups: Partial<Bagup>[] = [
        { counts: { SP1: 5, SP2: 10 } },
        { counts: { SP1: 3, SP2: 2 } },
      ];
      const totals = calculateTotals(species, bagups as Bagup[]);
      expect(totals).toEqual({ SP1: 8, SP2: 12 });
    });

    test("handles missing species codes in bagups", () => {
      const bagups: Partial<Bagup>[] = [
        { counts: { SP1: 5 } },
      ];
      const totals = calculateTotals(species, bagups as Bagup[]);
      expect(totals).toEqual({ SP1: 5, SP2: 0 });
    });
  });

  describe("calculateRatios", () => {
    const species: SpeciesRequirement[] = [
      { species_code: "SP1", species_name: "Species 1", color: "#ff0000" },
      { species_code: "SP2", species_name: "Species 2", color: "#00ff00" },
    ];

    test("returns 0 ratios when overall total is 0", () => {
      const totals = { SP1: 0, SP2: 0 };
      const ratios = calculateRatios(species, totals);
      expect(ratios).toEqual({ SP1: 0, SP2: 0 });
    });

    test("calculates ratios correctly", () => {
      const totals = { SP1: 25, SP2: 75 };
      const ratios = calculateRatios(species, totals);
      expect(ratios).toEqual({ SP1: 0.25, SP2: 0.75 });
    });
  });

  describe("buildElapsedMap", () => {
    test("builds correct map for multiple bagups, handling sort order", () => {
      const bagups: Partial<Bagup>[] = [
        { bagup_id: "b2", created_at: 20000 },
        { bagup_id: "b1", created_at: 10000 },
        { bagup_id: "b3", created_at: 50000 },
      ];
      const map = buildElapsedMap(bagups as Bagup[]);

      expect(map["b1"]).toBe("First bagup"); // earliest
      expect(map["b2"]).toBe("10s");        // 20000 - 10000
      expect(map["b3"]).toBe("30s");        // 50000 - 20000
    });

    test("returns empty object for empty bagups", () => {
        expect(buildElapsedMap([])).toEqual({});
    });
  });
});
