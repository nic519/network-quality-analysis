import { latencyToMs } from "../../../shared/domain";

export type MatrixRow = {
  key: string;
  runId: string;
  proxyId: string;
  proxyName: string;
  proxyType: string;
  regionLabel: string;
  values: Record<string, string>;
};

export type LatencyChartRow = {
  key: string;
  runId: string;
  proxyName: string;
  proxyType: string;
  regionLabel: string;
  latency: number | null;
  latencyLabel: string;
  isAvailable: boolean;
};

export function buildLatencyChartRows(rows: MatrixRow[], siteName: string | undefined): LatencyChartRow[] {
  if (!siteName) return [];

  return rows
    .map((row) => {
      const latencyLabel = row.values[siteName] ?? "N/A";
      const latency = latencyToMs(latencyLabel);
      return {
        key: row.key,
        runId: row.runId,
        proxyName: row.proxyName,
        proxyType: row.proxyType,
        regionLabel: row.regionLabel,
        latency,
        latencyLabel,
        isAvailable: latency !== null,
      };
    })
    .sort((a, b) => {
      if (a.latency !== null && b.latency !== null) return a.latency - b.latency;
      if (a.latency !== null) return -1;
      if (b.latency !== null) return 1;
      return a.proxyName.localeCompare(b.proxyName, "zh-CN");
    });
}
