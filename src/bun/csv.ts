import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ResultRow } from "../shared/domain";

export type CsvExport = {
  details: string;
  summary: string;
};

export type CsvExportFiles = {
  detailsPath: string;
  summaryPath: string;
};

const DETAILS_HEADERS = [
  "run_id",
  "region",
  "site",
  "site_url",
  "sequence",
  "proxy_id",
  "proxy_name",
  "proxy_type",
  "latency",
  "jitter",
  "packet_loss",
  "download_speed",
  "upload_speed",
];

export function buildCsvExport(results: ResultRow[]): CsvExport {
  return {
    details: buildDetailsCsv(results),
    summary: buildSummaryCsv(results),
  };
}

export function writeCsvExport(results: ResultRow[], outputDir: string, basename: string): CsvExportFiles {
  mkdirSync(outputDir, { recursive: true });
  const exportData = buildCsvExport(results);
  const detailsPath = join(outputDir, `${basename}-details.csv`);
  const summaryPath = join(outputDir, `${basename}-summary.csv`);

  writeFileSync(detailsPath, exportData.details);
  writeFileSync(summaryPath, exportData.summary);

  return { detailsPath, summaryPath };
}

function buildDetailsCsv(results: ResultRow[]): string {
  const rows = results.map((row) => [
    row.runId,
    row.regionLabel,
    row.siteName,
    row.siteUrl,
    row.sequence,
    row.proxyId,
    row.proxyName,
    row.proxyType,
    row.latency,
    row.jitter,
    row.packetLoss,
    row.downloadSpeed,
    row.uploadSpeed,
  ]);

  return toCsv([DETAILS_HEADERS, ...rows]);
}

function buildSummaryCsv(results: ResultRow[]): string {
  const sites = Array.from(new Set(results.map((row) => row.siteName)));
  const rowsByProxy = new Map<string, ResultRow[]>();

  for (const row of results) {
    const key = [row.runId, row.regionLabel, row.proxyId].join("\u0000");
    rowsByProxy.set(key, [...(rowsByProxy.get(key) ?? []), row]);
  }

  const headers = ["run_id", "region", "proxy_id", "proxy_name", "proxy_type", ...sites];
  const rows = Array.from(rowsByProxy.values()).map((proxyRows) => {
    const first = proxyRows[0];
    const bySite = new Map(proxyRows.map((row) => [row.siteName, row.latency]));
    return [
      first.runId,
      first.regionLabel,
      first.proxyId,
      first.proxyName,
      first.proxyType,
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
