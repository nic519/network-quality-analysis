import type { HistoryFilters } from "../../../shared/domain";

export function buildAnalysisHistoryFilters({
  selectedRunId,
  fromDate,
  toDate,
}: {
  selectedRunId: string;
  fromDate: string;
  toDate: string;
}): HistoryFilters {
  if (selectedRunId !== "all") {
    return { runId: selectedRunId };
  }

  return {
    fromDate: `${fromDate}T00:00:00.000Z`,
    toDate: `${toDate}T23:59:59.999Z`,
  };
}
