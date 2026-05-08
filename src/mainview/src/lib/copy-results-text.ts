import type { MatrixRow } from "./chart-data";

export function buildCopyResultsText(rows: MatrixRow[]) {
  const sites = Array.from(new Set(rows.flatMap((row) => Object.keys(row.values))));
  const headers = ["proxy_name", "proxy_type", ...sites];
  const data = rows.map((row) => [row.proxyName, row.proxyType, ...sites.map((site) => row.values[site] ?? "N/A")]);
  return [headers, ...data].map((cols) => cols.map(escapeCsv).join(",")).join("\n") + "\n";
}

function escapeCsv(value: string) {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
