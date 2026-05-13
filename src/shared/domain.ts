export type RegionPreset = {
  id: "hong-kong" | "singapore" | "japan" | "united-states" | "taiwan";
  label: string;
  shortLabel: string;
  filterRegex: string;
};

export type SiteDefinition = {
  id: string;
  name: string;
  url: string;
  enabled?: boolean;
};

export type SpeedtestRow = {
  sequence: string;
  // proxyId 是 clash-speedtest 基于节点连接身份生成的稳定 ID。
  // 它主要由协议、服务器、端口和认证/传输参数决定，不应把节点展示名当成同一性依据。
  proxyId: string;
  proxyName: string;
  proxyType: string;
  latency: string;
  jitter: string;
  packetLoss: string;
  downloadSpeed: string;
  uploadSpeed: string;
  probeUrl?: string;
  probeLatency?: string;
  probeStatus?: string;
  probeError?: string;
  probeIp?: string;
  probeCountry?: string;
  probeCountryCode?: string;
  probeRegion?: string;
  probeCity?: string;
  probeAsn?: string;
  probeOrg?: string;
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
    id: "singapore",
    label: "新加坡",
    shortLabel: "SG",
    filterRegex: "SG|新加坡|狮城|Singapore|Singa",
  },
  {
    id: "japan",
    label: "日本",
    shortLabel: "JP",
    filterRegex: "JP|日|日本|Japan|Tokyo|大阪|东京",
  },
  {
    id: "united-states",
    label: "美国",
    shortLabel: "US",
    filterRegex: "US|USA|美|美国|United States|America|Los Angeles|San Jose|Seattle|New York",
  },
  {
    id: "taiwan",
    label: "台湾",
    shortLabel: "TW",
    filterRegex: "TW|台|台湾|臺灣|Taiwan|Taipei|台北|臺北",
  },
];

export const DEFAULT_SITES: SiteDefinition[] = [
  {
    id: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/generate_204",
    enabled: true,
  },
  {
    id: "x",
    name: "X",
    url: "https://x.com",
    enabled: true,
  },
  {
    id: "github",
    name: "GitHub",
    url: "https://github.com",
    enabled: true,
  },
];

export function normalizeSiteDefinitions(sites: SiteDefinition[]): SiteDefinition[] {
  const normalized = sites
    .map((site) => {
      const name = site.name.trim();
      const url = site.url.trim();
      const id = (site.id.trim() || slugifySiteId(name || url)).slice(0, 80);
      return { id, name, url, enabled: site.enabled !== false };
    })
    .filter((site) => site.name && /^https?:\/\//i.test(site.url));

  return normalized.length ? dedupeSiteIds(normalized) : DEFAULT_SITES;
}

export function enabledSiteDefinitions(sites: SiteDefinition[]): SiteDefinition[] {
  return sites.filter((site) => site.enabled !== false);
}

export function parseTSVOutput(raw: string): SpeedtestRow[] {
  const rows: SpeedtestRow[] = [];
  const lines = raw.replaceAll("\r\n", "\n").split("\n");
  let header: Map<string, number> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fields = trimmed.split("\t").map((field) => field.trim());
    if (isHeaderRow(fields)) {
      header = buildHeaderIndex(fields);
      continue;
    }

    rows.push(header ? parseHeaderRow(fields, header) : parseLegacyRow(fields));
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

function parseLegacyRow(fields: string[]): SpeedtestRow {
  return withDefaultProbeFields({
    sequence: fields[0] ?? "",
    proxyId: extractLegacyProxyId(fields),
    proxyName: fields[1] ?? "",
    proxyType: fields[2] ?? "",
    latency: fields[3] ?? "N/A",
    jitter: fields[4] ?? "N/A",
    packetLoss: fields[5] ?? "N/A",
    downloadSpeed: fields[6] ?? "N/A",
    uploadSpeed: fields[7] ?? "N/A",
  });
}

function parseHeaderRow(fields: string[], header: Map<string, number>): SpeedtestRow {
  const proxyName = getByHeader(fields, header, ["节点名称", "proxy name", "name"]) || "";
  const proxyType = getByHeader(fields, header, ["类型", "proxy type", "type"]) || "";

  return withDefaultProbeFields({
    sequence: getByHeader(fields, header, ["序号", "id", "sequence"]) || "",
    proxyId: getByHeader(fields, header, ["节点id", "proxy id"]) || legacyProxyId(proxyName, proxyType),
    proxyName,
    proxyType,
    latency: getByHeader(fields, header, ["延迟", "latency"]) || "N/A",
    jitter: getByHeader(fields, header, ["抖动", "jitter"]) || "N/A",
    packetLoss: getByHeader(fields, header, ["丢包率", "packet loss"]) || "N/A",
    downloadSpeed: getByHeader(fields, header, ["下载速度", "download speed"]) || "N/A",
    uploadSpeed: getByHeader(fields, header, ["上传速度", "upload speed"]) || "N/A",
    probeUrl: getByHeader(fields, header, ["probe url"]) || "",
    probeLatency: getByHeader(fields, header, ["probe 延迟", "probe latency"]) || "",
    probeStatus: getByHeader(fields, header, ["probe 状态", "probe status"]) || "",
    probeError: getByHeader(fields, header, ["probe 错误", "probe error"]) || "",
    probeIp: getByHeader(fields, header, ["probe.ip"]) || "",
    probeCountry: getByHeader(fields, header, ["probe.country"]) || "",
    probeCountryCode: getByHeader(fields, header, ["probe.country_code"]) || "",
    probeRegion: getByHeader(fields, header, ["probe.region"]) || "",
    probeCity: getByHeader(fields, header, ["probe.city"]) || "",
    probeAsn: getByHeader(fields, header, ["probe.asn"]) || "",
    probeOrg: getByHeader(fields, header, ["probe.org"]) || "",
  });
}

function withDefaultProbeFields(row: Omit<SpeedtestRow, "probeUrl" | "probeLatency" | "probeStatus" | "probeError" | "probeIp" | "probeCountry" | "probeCountryCode" | "probeRegion" | "probeCity" | "probeAsn" | "probeOrg"> & Partial<SpeedtestRow>): SpeedtestRow {
  return {
    ...row,
    probeUrl: row.probeUrl ?? "",
    probeLatency: row.probeLatency ?? "",
    probeStatus: row.probeStatus ?? "",
    probeError: row.probeError ?? "",
    probeIp: row.probeIp ?? "",
    probeCountry: row.probeCountry ?? "",
    probeCountryCode: row.probeCountryCode ?? "",
    probeRegion: row.probeRegion ?? "",
    probeCity: row.probeCity ?? "",
    probeAsn: row.probeAsn ?? "",
    probeOrg: row.probeOrg ?? "",
  };
}

function buildHeaderIndex(fields: string[]) {
  const header = new Map<string, number>();
  fields.forEach((field, index) => {
    header.set(normalizeHeader(field), index);
  });
  return header;
}

function getByHeader(fields: string[], header: Map<string, number>, names: string[]) {
  for (const name of names) {
    const index = header.get(normalizeHeader(name));
    if (index !== undefined) return fields[index] ?? "";
  }
  return "";
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
}

function extractLegacyProxyId(fields: string[]): string {
  if (fields.length === 5) return fields[4] ?? "";
  if (fields.length === 8) return fields[7] ?? "";
  if (fields.length >= 9) return fields[8] ?? "";
  return legacyProxyId(fields[1] ?? "", fields[2] ?? "");
}

function slugifySiteId(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "site";
}

function dedupeSiteIds(sites: SiteDefinition[]) {
  const counts = new Map<string, number>();
  return sites.map((site) => {
    const count = counts.get(site.id) ?? 0;
    counts.set(site.id, count + 1);
    return count === 0 ? site : { ...site, id: `${site.id}-${count + 1}` };
  });
}
