import {
  classifyClashLogEvent,
  createObservationId,
  normalizeClashObservationSettings,
  normalizeConnectionSampleRows,
  normalizeProxySnapshotRows,
  type ClashConfigSnapshot,
  type ClashLogLevel,
  type ClashObservationBundle,
  type ClashObservationSettings,
  type ClashRuleSnapshot,
} from "../shared/clash-observation";

type RequestInitLike = {
  headers?: Record<string, string>;
};

type CollectClashObservationOptions = {
  now?: () => Date;
  fetchJson?: (url: string, init?: RequestInitLike) => Promise<unknown>;
  fetchText?: (url: string, init?: RequestInitLike) => Promise<string>;
};

type EndpointResult<T> =
  | { ok: true; value: T }
  | { ok: false; endpoint: string; error: string };

export async function collectClashObservation(
  settings: ClashObservationSettings,
  options: CollectClashObservationOptions = {},
): Promise<ClashObservationBundle> {
  const normalizedSettings = normalizeClashObservationSettings(settings);
  const startedAt = options.now?.() ?? new Date();
  const observationId = createObservationId(startedAt);
  const requestInit = buildRequestInit(normalizedSettings.secret);
  const fetchJson = options.fetchJson ?? defaultFetchJson;
  const fetchText = options.fetchText ?? defaultFetchText;

  const [configResult, proxyResult, ruleResult, connectionResult, logResult] = await Promise.all([
    captureEndpoint("/configs", () => fetchJson(buildControllerUrl(normalizedSettings.controllerUrl, "/configs"), requestInit)),
    captureEndpoint("/proxies", () => fetchJson(buildControllerUrl(normalizedSettings.controllerUrl, "/proxies"), requestInit)),
    captureEndpoint("/rules", () => fetchJson(buildControllerUrl(normalizedSettings.controllerUrl, "/rules"), requestInit)),
    captureEndpoint("/connections", () => fetchJson(buildControllerUrl(normalizedSettings.controllerUrl, "/connections"), requestInit)),
    captureEndpoint("/logs", () => captureLogs(normalizedSettings.controllerUrl, normalizedSettings.logLevels, fetchText, requestInit)),
  ]);

  const errors = [configResult, proxyResult, ruleResult, connectionResult, logResult]
    .filter((result): result is { ok: false; endpoint: string; error: string } => !result.ok)
    .map((result) => `${result.endpoint}: ${result.error}`);
  const successCount = [configResult, proxyResult, ruleResult, connectionResult, logResult].filter((result) => result.ok).length;
  const completedAt = (options.now?.() ?? new Date()).toISOString();

  return {
    run: {
      id: observationId,
      startedAt: startedAt.toISOString(),
      completedAt,
      status: successCount > 0 ? "completed" : "failed",
      controllerUrl: normalizedSettings.controllerUrl,
      errorMessage: errors.length ? errors.join("; ") : null,
    },
    config: configResult.ok ? normalizeConfigSnapshot(observationId, configResult.value) : null,
    proxies: proxyResult.ok ? normalizeProxySnapshotRows(observationId, proxyResult.value) : [],
    rules: ruleResult.ok ? normalizeRuleSnapshotRows(observationId, ruleResult.value) : [],
    connections: connectionResult.ok ? normalizeConnectionSampleRows(observationId, connectionResult.value) : [],
    logEvents: logResult.ok
      ? logResult.value.map((event) => ({
          ...event,
          observationId,
          eventTime: startedAt.toISOString(),
        }))
      : [],
  };
}

async function captureEndpoint<T>(endpoint: string, action: () => Promise<T>): Promise<EndpointResult<T>> {
  try {
    return { ok: true, value: await action() };
  } catch (error) {
    return { ok: false, endpoint, error: error instanceof Error ? error.message : String(error) };
  }
}

async function captureLogs(
  controllerUrl: string,
  levels: ClashLogLevel[],
  fetchText: NonNullable<CollectClashObservationOptions["fetchText"]>,
  init: RequestInitLike,
) {
  const events = [];
  for (const level of levels) {
    const text = await fetchText(buildControllerUrl(controllerUrl, `/logs?level=${level}`), init);
    events.push(...parseLogText(text, level));
  }
  return events;
}

function parseLogText(text: string, fallbackLevel: ClashLogLevel) {
  const events = [];
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseLogLine(trimmed);
    events.push(classifyClashLogEvent(parsed.message, parsed.level ?? fallbackLevel));
  }
  return events;
}

function parseLogLine(line: string): { level?: ClashLogLevel; message: string } {
  try {
    const parsed = JSON.parse(line) as { type?: unknown; level?: unknown; payload?: unknown; message?: unknown };
    const level = parsed.type === "error" || parsed.level === "error" ? "error" : parsed.type === "warning" || parsed.level === "warning" ? "warning" : undefined;
    const message = typeof parsed.payload === "string" ? parsed.payload : typeof parsed.message === "string" ? parsed.message : line;
    return { level, message };
  } catch {
    return { message: line };
  }
}

function normalizeConfigSnapshot(observationId: string, payload: unknown): ClashConfigSnapshot {
  const source = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return {
    observationId,
    mode: toStringValue(source.mode),
    logLevel: toStringValue(source["log-level"] ?? source.logLevel),
    mixedPort: toStringValue(source["mixed-port"] ?? source.mixedPort),
    httpPort: toStringValue(source.port),
    socksPort: toStringValue(source["socks-port"] ?? source.socksPort),
    ipv6: toStringValue(source.ipv6),
    allowLan: toStringValue(source["allow-lan"] ?? source.allowLan),
    configHash: hashString(stableStringify(source)),
  };
}

function normalizeRuleSnapshotRows(observationId: string, payload: unknown): ClashRuleSnapshot[] {
  const rules = payload && typeof payload === "object" ? (payload as { rules?: unknown }).rules : null;
  if (!Array.isArray(rules)) return [];
  return rules.map((rule, index) => {
    const source = rule && typeof rule === "object" ? (rule as Record<string, unknown>) : {};
    return {
      observationId,
      ruleIndex: index,
      ruleType: toStringValue(source.type),
      payload: toStringValue(source.payload),
      proxy: toStringValue(source.proxy),
    };
  });
}

function buildRequestInit(secret: string): RequestInitLike {
  return secret ? { headers: { Authorization: `Bearer ${secret}` } } : { headers: {} };
}

function buildControllerUrl(controllerUrl: string, endpoint: string) {
  return `${controllerUrl}${endpoint}`;
}

async function defaultFetchJson(url: string, init?: RequestInitLike) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`gateway http ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function defaultFetchText(url: string, init?: RequestInitLike) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`gateway http ${response.status}: ${await response.text()}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function toStringValue(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
