export type RegionPreset = {
  id: "hong-kong" | "japan";
  label: string;
  shortLabel: string;
  filterRegex: string;
};

export type SiteDefinition = {
  id: string;
  name: string;
  url: string;
};

export type SpeedtestRow = {
  sequence: string;
  proxyId: string;
  proxyName: string;
  proxyType: string;
  latency: string;
  jitter: string;
  packetLoss: string;
  downloadSpeed: string;
  uploadSpeed: string;
};

export type LatencyStatus = "fast" | "usable" | "slow" | "failed" | "missing";

export type ResultRow = SpeedtestRow & {
  runId: string;
  regionId: RegionPreset["id"];
  regionLabel: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
};

export type RunRecord = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "completed" | "failed";
  selectedRegions: string[];
  errorMessage: string | null;
};

export type HistoryFilters = {
  runId?: string;
  regionIds?: string[];
  fromDate?: string;
  toDate?: string;
};

export const REGION_PRESETS: RegionPreset[] = [
  {
    id: "hong-kong",
    label: "香港",
    shortLabel: "HK",
    filterRegex: "HK|港|香港|Hong Kong|HongKong",
  },
  {
    id: "japan",
    label: "日本",
    shortLabel: "JP",
    filterRegex: "JP|日|日本|Japan|Tokyo|大阪|东京",
  },
];

export const DEFAULT_SITES: SiteDefinition[] = [
  {
    id: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/generate_204",
  },
  {
    id: "x",
    name: "X",
    url: "https://x.com",
  },
  {
    id: "github",
    name: "GitHub",
    url: "https://github.com",
  },
];

export function parseTSVOutput(raw: string): SpeedtestRow[] {
  const rows: SpeedtestRow[] = [];
  const lines = raw.replaceAll("\r\n", "\n").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fields = trimmed.split("\t").map((field) => field.trim());
    if (isHeaderRow(fields)) continue;

    rows.push({
      sequence: fields[0] ?? "",
      proxyId: extractProxyId(fields),
      proxyName: fields[1] ?? "",
      proxyType: fields[2] ?? "",
      latency: fields[3] ?? "N/A",
      jitter: fields[4] ?? "N/A",
      packetLoss: fields[5] ?? "N/A",
      downloadSpeed: fields[6] ?? "N/A",
      uploadSpeed: fields[7] ?? "N/A",
    });
  }

  return rows;
}

export function latencyStatus(latency: string | null | undefined): LatencyStatus {
  if (!latency || latency.trim() === "") return "missing";

  const normalized = latency.trim().toLowerCase();
  if (normalized === "n/a" || normalized.includes("timeout") || normalized.includes("超时")) {
    return "failed";
  }

  const milliseconds = latencyToMs(normalized);
  if (milliseconds === null) return "missing";
  if (milliseconds <= 220) return "fast";
  if (milliseconds <= 550) return "usable";
  return "slow";
}

export function latencyToMs(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)(ms|s)?$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  return match[2] === "s" ? amount * 1000 : amount;
}

export function createRunId(date = new Date()): string {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}z$/i, "Z");
  return `run-${stamp}`;
}

export function legacyProxyId(proxyName: string, proxyType: string): string {
  let hash = 2166136261;
  const input = `legacy|${proxyType}|${proxyName}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `legacy-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function isHeaderRow(fields: string[]): boolean {
  const joined = fields.join("\t").toLowerCase();
  return joined.includes("节点名称") || joined.includes("proxy") || joined.includes("latency");
}

function extractProxyId(fields: string[]): string {
  if (fields.length === 5) return fields[4] ?? "";
  if (fields.length === 8) return fields[7] ?? "";
  if (fields.length >= 9) return fields[8] ?? "";
  return legacyProxyId(fields[1] ?? "", fields[2] ?? "");
}
