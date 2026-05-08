import { describe, expect, test } from "bun:test";
import { buildAnalysisHistoryFilters } from "./history-filters";

describe("buildAnalysisHistoryFilters", () => {
  test("queries a selected run by id without carrying region presets", () => {
    expect(
      buildAnalysisHistoryFilters({
        selectedRunId: "run-20260508",
        fromDate: "2026-05-01",
        toDate: "2026-05-08",
      }),
    ).toEqual({ runId: "run-20260508" });
  });

  test("queries all runs by date range only", () => {
    expect(
      buildAnalysisHistoryFilters({
        selectedRunId: "all",
        fromDate: "2026-05-01",
        toDate: "2026-05-08",
      }),
    ).toEqual({
      fromDate: "2026-05-01T00:00:00.000Z",
      toDate: "2026-05-08T23:59:59.999Z",
    });
  });
});
