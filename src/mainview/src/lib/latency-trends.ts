import { latencyToMs, type RegionPreset, type ResultRow, type RunRecord } from "../../../shared/domain";

export type LatencyTrendProxyRow = {
  proxyId: string;
  proxyName: string;
  proxyType: string;
  dataKey: string;
  color: string;
  sampleCount: number;
  latestLatency: number | null;
  latestLatencyLabel: string;
};

export type LatencyTrendChartRow = {
  runId: string;
  runLabel: string;
  startedAt: string;
  [dataKey: string]: string | number | null;
};

export type LatencyTrendModel = {
  proxyRows: LatencyTrendProxyRow[];
  chartRows: LatencyTrendChartRow[];
};

const trendColors = [
  "hsl(var(--primary))",
  "rgb(37 99 235)",
  "rgb(217 119 6)",
  "rgb(219 39 119)",
  "rgb(124 58 237)",
  "rgb(8 145 178)",
  "rgb(101 163 13)",
  "rgb(220 38 38)",
];

export function buildLatencyTrendModel({
  results,
  runs,
  regionId,
  siteId,
  selectedProxyIds,
}: {
  results: ResultRow[];
  runs: RunRecord[];
  regionId: RegionPreset["id"] | string;
  siteId: string;
  selectedProxyIds?: string[];
}): LatencyTrendModel {
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const scopedResults = results.filter((result) => result.regionId === regionId && result.siteId === siteId);
  const proxyStats = new Map<string, Omit<LatencyTrendProxyRow, "dataKey" | "color">>();

  for (const result of scopedResults) {
    const latency = latencyToMs(result.latency);
    const existing = proxyStats.get(result.proxyId) ?? {
      proxyId: result.proxyId,
      proxyName: result.proxyName,
      proxyType: result.proxyType,
      sampleCount: 0,
      latestLatency: null,
      latestLatencyLabel: "N/A",
    };

    if (latency !== null) {
      existing.sampleCount += 1;
      existing.latestLatency = latency;
      existing.latestLatencyLabel = result.latency;
    }

    proxyStats.set(result.proxyId, existing);
  }

  const availableProxyRows = [...proxyStats.values()]
    .filter((row) => row.sampleCount > 0)
    .sort((left, right) => {
      if (right.sampleCount !== left.sampleCount) return right.sampleCount - left.sampleCount;
      return (left.latestLatency ?? Number.POSITIVE_INFINITY) - (right.latestLatency ?? Number.POSITIVE_INFINITY);
    });

  const indexedProxyRows = availableProxyRows.map((row, index) => ({
    ...row,
    dataKey: `proxy-${index}`,
    color: trendColors[index % trendColors.length],
  }));
  const selectedProxyIdSet = selectedProxyIds ? new Set(selectedProxyIds) : null;
  const proxyRows = indexedProxyRows.filter((row) => !selectedProxyIdSet || selectedProxyIdSet.has(row.proxyId));

  const chartRowsByRun = new Map<string, LatencyTrendChartRow>();
  const selectedResultKeys = new Map(proxyRows.map((row) => [row.proxyId, row.dataKey]));

  for (const result of scopedResults) {
    const dataKey = selectedResultKeys.get(result.proxyId);
    if (!dataKey) continue;
    const run = runsById.get(result.runId);
    const startedAt = run?.startedAt ?? result.runId;
    const chartRow = chartRowsByRun.get(result.runId) ?? {
      runId: result.runId,
      runLabel: formatTrendRunLabel(startedAt),
      startedAt,
    };
    chartRow[dataKey] = latencyToMs(result.latency);
    chartRowsByRun.set(result.runId, chartRow);
  }

  const chartRows = [...chartRowsByRun.values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  for (const chartRow of chartRows) {
    for (const proxy of proxyRows) {
      if (!(proxy.dataKey in chartRow)) chartRow[proxy.dataKey] = null;
    }
  }

  return { proxyRows, chartRows };
}

function formatTrendRunLabel(startedAt: string) {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return startedAt;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
