import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ResultRow } from "../shared/domain";

export type CsvExport = {
  summary: string;
};

export type CsvExportFiles = {
  summaryPath: string;
};

export function buildCsvExport(results: ResultRow[]): CsvExport {
  return {
    summary: buildSummaryCsv(results),
  };
}

export function writeCsvExport(results: ResultRow[], outputDir: string, basename: string): CsvExportFiles {
  mkdirSync(outputDir, { recursive: true });
  const exportData = buildCsvExport(results);
  const summaryPath = join(outputDir, `${basename}-summary.csv`);

  writeFileSync(summaryPath, exportData.summary);

  return { summaryPath };
}

export function copyCsvExport(results: ResultRow[]): string {
  return buildCsvExport(results).summary;
}

function buildSummaryCsv(results: ResultRow[]): string {
  const sites = Array.from(new Set(results.map((row) => row.siteName)));
  const rowsByProxy = new Map<string, ResultRow[]>();

  for (const row of results) {
    const key = [row.runId, row.regionLabel, row.proxyId].join("\u0000");
    rowsByProxy.set(key, [...(rowsByProxy.get(key) ?? []), row]);
  }

  const headers = [
    "run_id",
    "region",
    "proxy_id",
    "proxy_name",
    "proxy_type",
    "probe_ip",
    "probe_country",
    "probe_country_code",
    "probe_region",
    "probe_city",
    "probe_asn",
    "probe_org",
    ...sites,
  ];
  const rows = Array.from(rowsByProxy.values()).map((proxyRows) => {
    const first = proxyRows[0];
    const bySite = new Map(proxyRows.map((row) => [row.siteName, row.latency]));
    return [
      first.runId,
      first.regionLabel,
      first.proxyId,
      first.proxyName,
      first.proxyType,
      first.probeIp ?? "",
      first.probeCountry ?? "",
      first.probeCountryCode ?? "",
      first.probeRegion ?? "",
      first.probeCity ?? "",
      first.probeAsn ?? "",
      first.probeOrg ?? "",
      ...sites.map((site) => bySite.get(site) ?? "N/A"),
    ];
  });

  return toCsv([headers, ...rows]);
}

function toCsv(rows: string[][]): string {
  return `${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}

function escapeCsv(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
