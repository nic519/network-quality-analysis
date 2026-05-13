import type { LatencyChartRow } from "./chart-data";
import { latencyToMs } from "../../../shared/domain";
import type { SiteDefinition } from "../../../shared/domain";
import type { AppState } from "../../../shared/rpc";

export type ProbeSortMode = "proxy-name" | "probe-latency";

export type ProbeRow = {
  key: string;
  proxyName: string;
  proxyType: string;
  regionLabel: string;
  probeIp: string;
  probeCountry: string;
  probeCountryCode: string;
  probeRegion: string;
  probeCity: string;
  probeAsn: string;
  probeOrg: string;
  probeLatency: string;
  probeStatus: string;
  probeError: string;
};

export type FailedSiteRow = {
  key: string;
  proxyName: string;
  proxyType: string;
  regionLabel: string;
  probeIp: string;
  historyFailedCount: number;
  historyTotalCount: number;
  historySiteStats: NonNullable<AppState["proxyHistoryStats"][string]["siteStats"]>;
  failedSites: string[];
};

export type ProbeSummaryRow = {
  totalNodes: number;
  effectiveNodes: number;
  effectiveNodesWithIp: number;
  uniqueEffectiveIps: number;
  effectiveNodesMissingIp: number;
};

export type ProbeSummary = ProbeSummaryRow & {
  showSupplierSummary: boolean;
  supplierRows: Array<ProbeSummaryRow & { supplier: string }>;
};

type ProxyProbeAccumulator = {
  proxyName: string;
  isEffective: boolean;
  bestProbeRow: ReturnType<typeof makeProbeRow> | null;
};

export function getVisibleRunItems(runs: AppState["runs"]) {
  return runs.slice(0, 12);
}

export function getEffectiveSelectedRunId(selectedRunId: string, runs: AppState["runs"]) {
  const runItems = getVisibleRunItems(runs);
  return selectedRunId === "all" ? runItems[0]?.id ?? "all" : selectedRunId;
}

export function filterScopedResults(results: AppState["results"], selectedRunId: string) {
  return selectedRunId === "all" ? results : results.filter((result) => result.runId === selectedRunId);
}

export function getRunPrimaryRegionId(run: AppState["runs"][number], results: AppState["results"]) {
  return results.find((result) => result.runId === run.id)?.regionId ?? run.selectedRegions[0] ?? null;
}

export function buildSelectableSites(sites: SiteDefinition[], results: AppState["results"]) {
  const siteMap = new Map<string, SiteDefinition>();
  for (const site of sites) siteMap.set(site.id, site);
  for (const result of results) {
    if (!siteMap.has(result.siteId)) {
      siteMap.set(result.siteId, {
        id: result.siteId,
        name: result.siteName,
        url: result.siteUrl,
      });
    }
  }
  return [...siteMap.values()];
}

export function buildRunScopedChartRows(
  results: AppState["results"],
  search: string,
  siteName?: string,
) {
  const normalizedSearch = search.trim().toLowerCase();
  const rowsByProxy = new Map<string, LatencyChartRow>();

  for (const result of results) {
    if (siteName && result.siteName !== siteName) continue;
    if (normalizedSearch && !result.proxyName.toLowerCase().includes(normalizedSearch)) continue;

    const existing = rowsByProxy.get(result.proxyId);
    const latency = latencyToMs(result.latency);
    const nextRow: LatencyChartRow = {
      key: `${result.proxyId}:${result.regionId}:${result.siteName}`,
      proxyName: result.proxyName,
      proxyType: result.proxyType,
      regionLabel: result.regionLabel,
      probeIp: result.probeIp,
      latency,
      latencyLabel: result.latency,
      isAvailable: latency !== null,
      runId: result.runId,
    };

    if (!existing) {
      rowsByProxy.set(result.proxyId, nextRow);
      continue;
    }

    if (existing.isAvailable && !nextRow.isAvailable) continue;
    if (!existing.isAvailable && nextRow.isAvailable) {
      rowsByProxy.set(result.proxyId, nextRow);
      continue;
    }

    if (nextRow.latency !== null && existing.latency !== null && nextRow.latency < existing.latency) {
      rowsByProxy.set(result.proxyId, nextRow);
    }
  }

  return [...rowsByProxy.values()].sort((left, right) => {
    if (left.isAvailable !== right.isAvailable) return left.isAvailable ? -1 : 1;
    if (left.latency !== null && right.latency !== null) return left.latency - right.latency;
    return left.proxyName.localeCompare(right.proxyName, "zh-CN");
  });
}

export function buildFailedSiteRows(results: AppState["results"], search: string, proxyHistoryStats: AppState["proxyHistoryStats"]) {
  const normalizedSearch = search.trim().toLowerCase();
  const failures = new Map<string, FailedSiteRow>();

  for (const result of results) {
    if (normalizedSearch && !result.proxyName.toLowerCase().includes(normalizedSearch)) continue;
    if (latencyToMs(result.latency) !== null) continue;

    const key = result.proxyId;
    const probeIp = (result.probeIp ?? "").trim();
    const historyStats = proxyHistoryStats[key] ?? { failedCount: 0, totalCount: 0 };
    const existing = failures.get(key);
    if (!existing) {
      failures.set(key, {
        key,
        proxyName: result.proxyName,
        proxyType: result.proxyType,
        regionLabel: result.regionLabel,
        probeIp,
        historyFailedCount: historyStats.failedCount,
        historyTotalCount: historyStats.totalCount,
        historySiteStats: historyStats.siteStats ?? [],
        failedSites: [result.siteName],
      });
      continue;
    }

    if (!existing.probeIp && probeIp) {
      existing.probeIp = probeIp;
    }

    if (!existing.failedSites.includes(result.siteName)) {
      existing.failedSites.push(result.siteName);
    }
  }

  return [...failures.values()].sort((left, right) => {
    const proxyCompare = left.proxyName.localeCompare(right.proxyName, "zh-CN");
    if (proxyCompare !== 0) return proxyCompare;
    return left.failedSites.length - right.failedSites.length;
  });
}

export function buildProbeSummary(results: AppState["results"], search: string): ProbeSummary {
  const normalizedSearch = search.trim().toLowerCase();
  const proxies = new Map<string, ProxyProbeAccumulator>();

  for (const result of results) {
    if (normalizedSearch && !result.proxyName.toLowerCase().includes(normalizedSearch)) continue;

    const key = result.proxyId;
    const existing = proxies.get(key);
    const nextProbeRow = makeProbeRow(result);
    const isEffective = latencyToMs(result.latency) !== null;

    if (!existing) {
      proxies.set(key, {
        proxyName: result.proxyName,
        isEffective,
        bestProbeRow: hasProbeEvidence(nextProbeRow) ? nextProbeRow : null,
      });
      continue;
    }

    existing.isEffective = existing.isEffective || isEffective;
    if (!existing.bestProbeRow || probeResultScore(nextProbeRow) > probeResultScore(existing.bestProbeRow)) {
      existing.bestProbeRow = hasProbeEvidence(nextProbeRow) ? nextProbeRow : existing.bestProbeRow;
    }
  }

  const proxyRows = [...proxies.values()];
  const summary = summarizeProxyRows(proxyRows);
  const suppliers = new Map<string, ProxyProbeAccumulator[]>();
  let prefixedProxyCount = 0;

  for (const proxy of proxyRows) {
    const supplier = extractSupplierPrefix(proxy.proxyName);
    if (!supplier) continue;

    prefixedProxyCount += 1;
    const rows = suppliers.get(supplier) ?? [];
    rows.push(proxy);
    suppliers.set(supplier, rows);
  }

  const supplierRows = [...suppliers.entries()]
    .map(([supplier, rows]) => ({ supplier, ...summarizeProxyRows(rows) }))
    .sort((left, right) => left.supplier.localeCompare(right.supplier, "zh-CN"));

  return {
    ...summary,
    showSupplierSummary: proxyRows.length > 0 && prefixedProxyCount === proxyRows.length,
    supplierRows,
  };
}

export function buildProbeRows(results: AppState["results"], search: string, sortMode: ProbeSortMode = "proxy-name") {
  const normalizedSearch = search.trim().toLowerCase();
  const rows = new Map<string, ProbeRow>();

  for (const result of results) {
    if (normalizedSearch && !result.proxyName.toLowerCase().includes(normalizedSearch)) continue;
    if (!result.probeIp && !result.probeStatus && !result.probeError) continue;
    const nextRow = makeProbeRow(result);
    const existing = rows.get(result.proxyId);
    if (existing && probeResultScore(existing) >= probeResultScore(nextRow)) continue;
    rows.set(result.proxyId, nextRow);
  }

  return [...rows.values()].sort((a, b) => compareProbeRows(a, b, sortMode));
}

function summarizeProxyRows(rows: ProxyProbeAccumulator[]): ProbeSummaryRow {
  const effectiveIps = new Set<string>();
  let effectiveNodes = 0;
  let effectiveNodesWithIp = 0;
  let effectiveNodesMissingIp = 0;

  for (const row of rows) {
    if (!row.isEffective) continue;
    effectiveNodes += 1;

    const probeIp = row.bestProbeRow?.probeIp.trim() ?? "";
    if (!probeIp) {
      effectiveNodesMissingIp += 1;
      continue;
    }

    effectiveNodesWithIp += 1;
    effectiveIps.add(probeIp);
  }

  return {
    totalNodes: rows.length,
    effectiveNodes,
    effectiveNodesWithIp,
    uniqueEffectiveIps: effectiveIps.size,
    effectiveNodesMissingIp,
  };
}

function extractSupplierPrefix(proxyName: string) {
  const separatorIndex = proxyName.indexOf("-");
  if (separatorIndex <= 0) return "";
  const prefix = proxyName.slice(0, separatorIndex).trim();
  if (!prefix) return "";
  return /[^A-Za-z0-9]/.test(prefix) ? prefix : "";
}

function hasProbeEvidence(row: ReturnType<typeof makeProbeRow>) {
  return Boolean(row.probeIp || row.probeStatus || row.probeError);
}

function makeProbeRow(result: AppState["results"][number]): ProbeRow {
  return {
    key: result.proxyId,
    proxyName: result.proxyName,
    proxyType: result.proxyType,
    regionLabel: result.regionLabel,
    probeIp: result.probeIp ?? "",
    probeCountry: result.probeCountry ?? "",
    probeCountryCode: result.probeCountryCode ?? "",
    probeRegion: result.probeRegion ?? "",
    probeCity: result.probeCity ?? "",
    probeAsn: result.probeAsn ?? "",
    probeOrg: result.probeOrg ?? "",
    probeLatency: result.probeLatency ?? "",
    probeStatus: result.probeStatus ?? "",
    probeError: result.probeError ?? "",
  };
}

function probeResultScore(row: ReturnType<typeof makeProbeRow>) {
  if (row.probeIp) return 3;
  if (row.probeStatus && !row.probeError) return 2;
  if (row.probeStatus) return 1;
  return 0;
}

function compareProbeRows(left: ReturnType<typeof makeProbeRow>, right: ReturnType<typeof makeProbeRow>, sortMode: ProbeSortMode) {
  if (sortMode === "probe-latency") {
    const leftFailed = Boolean(left.probeError);
    const rightFailed = Boolean(right.probeError);
    if (leftFailed !== rightFailed) return leftFailed ? 1 : -1;

    const leftLatency = latencyToMs(left.probeLatency);
    const rightLatency = latencyToMs(right.probeLatency);
    if (leftLatency !== null && rightLatency !== null && leftLatency !== rightLatency) return leftLatency - rightLatency;
    if (leftLatency !== null && rightLatency === null) return -1;
    if (leftLatency === null && rightLatency !== null) return 1;
  }

  return left.proxyName.localeCompare(right.proxyName, "zh-CN");
}
