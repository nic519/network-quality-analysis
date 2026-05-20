export const DEFAULT_CLASH_OBSERVATION_SETTINGS: ClashObservationSettings = {
  enabled: false,
  controllerUrl: "http://127.0.0.1:9090",
  secret: "",
  intervalMinutes: 5,
  retentionDays: 30,
  logLevels: ["warning", "error"],
};

export type ClashObservationSettings = {
  enabled: boolean;
  controllerUrl: string;
  secret: string;
  intervalMinutes: number;
  retentionDays: number;
  logLevels: ClashLogLevel[];
};

export type ClashLogLevel = "warning" | "error";
export type ClashLogEventType = "dns" | "timeout" | "tls" | "eof" | "proxy" | "rule" | "provider" | "config" | "unknown";

export type ClashObservationRunRecord = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: "completed" | "failed";
  controllerUrl: string;
  errorMessage: string | null;
};

export type ClashConfigSnapshot = {
  observationId: string;
  mode: string;
  logLevel: string;
  mixedPort: string;
  httpPort: string;
  socksPort: string;
  ipv6: string;
  allowLan: string;
  configHash: string;
};

export type ClashProxySnapshot = {
  observationId: string;
  proxyName: string;
  proxyType: string;
  nowProxy: string;
  alive: string;
  delayMs: number | null;
  historyJson: string;
  childrenJson: string;
};

export type ClashRuleSnapshot = {
  observationId: string;
  ruleIndex: number;
  ruleType: string;
  payload: string;
  proxy: string;
};

export type ClashConnectionSample = {
  observationId: string;
  domain: string;
  destinationIp: string;
  sourceIp: string;
  rule: string;
  rulePayload: string;
  chain: string;
  connectionCount: number;
  upload: number;
  download: number;
};

export type ClashLogEvent = {
  id?: number;
  observationId?: string;
  eventTime?: string;
  level: ClashLogLevel;
  eventType: ClashLogEventType;
  message: string;
  proxyName: string;
  domain: string;
  rule: string;
};

export type ClashObservationSummary = ClashObservationRunRecord & {
  proxyCount: number;
  connectionSampleCount: number;
  logEventCount: number;
};

export type ClashObservationState = {
  settings: ClashObservationSettings;
  summaries: ClashObservationSummary[];
  logEvents: ClashLogEvent[];
};

export type ClashObservationBundle = {
  run: ClashObservationRunRecord;
  config: ClashConfigSnapshot | null;
  proxies: ClashProxySnapshot[];
  rules: ClashRuleSnapshot[];
  connections: ClashConnectionSample[];
  logEvents: Array<ClashLogEvent & Required<Pick<ClashLogEvent, "observationId" | "eventTime">>>;
};

export type ClashObservationDetail = {
  summary: ClashObservationSummary;
  config: ClashConfigSnapshot | null;
  proxies: ClashProxySnapshot[];
  rules: ClashRuleSnapshot[];
  connections: ClashConnectionSample[];
  logEvents: ClashLogEvent[];
};

type RawProxyEntry = {
  type?: unknown;
  now?: unknown;
  all?: unknown;
  alive?: unknown;
  history?: unknown;
  delay?: unknown;
};

type RawConnectionEntry = {
  metadata?: {
    host?: unknown;
    sniffHost?: unknown;
    destinationIP?: unknown;
    sourceIP?: unknown;
  };
  chains?: unknown;
  rule?: unknown;
  rulePayload?: unknown;
  upload?: unknown;
  download?: unknown;
};

export function normalizeClashObservationSettings(input: Partial<ClashObservationSettings> = {}): ClashObservationSettings {
  const defaults = DEFAULT_CLASH_OBSERVATION_SETTINGS;
  const enabled = input.enabled ?? defaults.enabled;
  const controllerUrl = normalizeControllerUrl(input.controllerUrl ?? defaults.controllerUrl);
  const secret = typeof input.secret === "string" ? input.secret.trim() : defaults.secret;
  const intervalMinutes = clampInteger(input.intervalMinutes, 1, 24 * 60, defaults.intervalMinutes);
  const retentionDays = clampInteger(input.retentionDays, 1, 365, defaults.retentionDays);
  const logLevels = normalizeLogLevels(input.logLevels);

  return { enabled, controllerUrl, secret, intervalMinutes, retentionDays, logLevels };
}

export function createObservationId(date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}z$/i, "Z");
  return `obs-${stamp}`;
}

export function normalizeProxySnapshotRows(observationId: string, payload: unknown): ClashProxySnapshot[] {
  const proxies = payload && typeof payload === "object" ? (payload as { proxies?: unknown }).proxies : null;
  if (!proxies || typeof proxies !== "object") return [];

  return Object.entries(proxies as Record<string, RawProxyEntry>)
    .map(([name, value]) => {
      const history = Array.isArray(value?.history) ? value.history : [];
      const children = Array.isArray(value?.all) ? value.all.filter((item): item is string => typeof item === "string") : [];
      return {
        observationId,
        proxyName: name.trim(),
        proxyType: toTrimmedString(value?.type),
        nowProxy: toTrimmedString(value?.now),
        alive: value?.alive === undefined || value?.alive === null ? "" : String(value.alive),
        delayMs: extractDelay(value?.delay, history),
        historyJson: JSON.stringify(history),
        childrenJson: JSON.stringify(children),
      };
    })
    .filter((row) => row.proxyName)
    .sort((left, right) => left.proxyName.localeCompare(right.proxyName, "zh-CN"));
}

export function normalizeConnectionSampleRows(observationId: string, payload: unknown): ClashConnectionSample[] {
  const connections = payload && typeof payload === "object" ? (payload as { connections?: unknown }).connections : null;
  if (!Array.isArray(connections)) return [];

  const rows = new Map<string, ClashConnectionSample>();
  for (const connection of connections as RawConnectionEntry[]) {
    if (!connection || typeof connection !== "object") continue;
    const metadata = connection.metadata ?? {};
    const chains = Array.isArray(connection.chains) ? connection.chains.filter((item): item is string => typeof item === "string") : [];
    const row: ClashConnectionSample = {
      observationId,
      domain: toTrimmedString(metadata.host) || toTrimmedString(metadata.sniffHost),
      destinationIp: toTrimmedString(metadata.destinationIP),
      sourceIp: toTrimmedString(metadata.sourceIP),
      rule: toTrimmedString(connection.rule),
      rulePayload: toTrimmedString(connection.rulePayload),
      chain: chains.join(" > "),
      connectionCount: 1,
      upload: toNonNegativeInteger(connection.upload),
      download: toNonNegativeInteger(connection.download),
    };
    const key = [row.domain, row.destinationIp, row.sourceIp, row.rule, row.rulePayload, row.chain].join("\u0000");
    const existing = rows.get(key);
    if (existing) {
      existing.connectionCount += 1;
      existing.upload += row.upload;
      existing.download += row.download;
    } else {
      rows.set(key, row);
    }
  }

  return [...rows.values()].sort((left, right) => left.domain.localeCompare(right.domain, "zh-CN"));
}

export function classifyClashLogEvent(message: string, level: string): ClashLogEvent {
  const normalizedMessage = message.trim();
  const lower = normalizedMessage.toLowerCase();
  const eventType =
    lower.includes("dns") || lower.includes("lookup")
      ? "dns"
      : lower.includes("provider")
        ? "provider"
        : lower.includes("timeout") || lower.includes("deadline")
          ? "timeout"
          : lower.includes("tls") || lower.includes("x509") || lower.includes("handshake")
            ? "tls"
            : lower.includes("eof") || lower.includes("connection reset")
              ? "eof"
              : lower.includes("rule")
                ? "rule"
                : lower.includes("config")
                  ? "config"
                  : lower.includes("proxy") || lower.includes("dial")
                    ? "proxy"
                    : "unknown";

  return {
    level: level === "error" ? "error" : "warning",
    eventType,
    message: normalizedMessage,
    proxyName: extractProxyName(normalizedMessage),
    domain: extractDomain(normalizedMessage),
    rule: extractRule(normalizedMessage),
  };
}

function normalizeControllerUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_CLASH_OBSERVATION_SETTINGS.controllerUrl;
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_CLASH_OBSERVATION_SETTINGS.controllerUrl;
  }
}

function normalizeLogLevels(values: unknown) {
  const levels = Array.isArray(values) ? values : DEFAULT_CLASH_OBSERVATION_SETTINGS.logLevels;
  const normalized = levels.filter((level): level is ClashLogLevel => level === "warning" || level === "error");
  return [...new Set(normalized)].length ? [...new Set(normalized)] : DEFAULT_CLASH_OBSERVATION_SETTINGS.logLevels;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNonNegativeInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function extractDelay(value: unknown, history: unknown[]) {
  const directDelay = toNonNegativeInteger(value);
  if (directDelay > 0) return directDelay;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    const delay = item && typeof item === "object" ? toNonNegativeInteger((item as { delay?: unknown }).delay) : 0;
    if (delay > 0) return delay;
  }
  return null;
}

function extractDomain(message: string) {
  const match = message.match(/\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)\b/i);
  return match?.[1] ?? "";
}

function extractProxyName(message: string) {
  const match = message.match(/\bproxy\s+([^\s,;:[\]()]+)/i);
  return match?.[1] ?? "";
}

function extractRule(message: string) {
  const match = message.match(/\brule\s+([^\s,;:[\]()]+)/i);
  return match?.[1] ?? "";
}
