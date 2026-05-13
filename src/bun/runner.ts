import { existsSync, statSync } from "node:fs";
import { resolveClashSpeedtestPath, type ResolveClashSpeedtestOptions } from "./clash-speedtest";
import {
  DEFAULT_SITES,
  REGION_PRESETS,
  createRunId,
  enabledSiteDefinitions,
  parseTSVOutput,
  type RegionPreset,
  type ResultRow,
  type RunRecord,
  type SiteDefinition,
} from "../shared/domain";
import { DEFAULT_PROBE_SETTINGS, normalizeProbeSettings, type ProbeSettings } from "../shared/probe-settings";

const DEFAULT_PROXY_CONCURRENT = "2";

export type RunRequest = {
  configPath: string;
  regionIds: RegionPreset["id"][];
};

export type RunnerOptions = {
  binaryPath?: string;
  binaryResolverOptions?: ResolveClashSpeedtestOptions;
  sites?: SiteDefinition[];
  now?: () => Date;
  execute?: (binaryPath: string, args: string[], options?: ExecuteSpeedtestOptions) => Promise<string>;
  onProgress?: (message: string) => void;
  probeSettings?: ProbeSettings;
};

export type RunOutput = {
  run: RunRecord;
  runs: RunRecord[];
  results: ResultRow[];
};

export type ExecuteSpeedtestOptions = {
  onProgress?: (message: string) => void;
};

export function buildSpeedtestArgs(
  configPath: string,
  region: RegionPreset,
  site: SiteDefinition,
  probeSettings: ProbeSettings = DEFAULT_PROBE_SETTINGS,
  options: { includeProbe?: boolean } = {},
): string[] {
  const normalizedProbeSettings = normalizeProbeSettings(probeSettings);
  const args = [
    "-c",
    configPath,
    "-f",
    region.filterRegex,
    "--speed-mode",
    "fast",
    "--latency-url",
    site.url,
    "-timeout",
    "8s",
    "--latency-timeout",
    "8s",
    "--proxy-concurrent",
    DEFAULT_PROXY_CONCURRENT,
  ];

  if (normalizedProbeSettings.enabled && options.includeProbe !== false) {
    args.push(
      "--probe-url",
      normalizedProbeSettings.url,
      "--probe-method",
      "GET",
      "--probe-timeout",
      normalizedProbeSettings.timeout,
      "--probe-fields",
      normalizedProbeSettings.fields,
    );
  }

  return args;
}

export async function runLatencyTest(request: RunRequest, options: RunnerOptions = {}): Promise<RunOutput> {
  const configPath = normalizeConfigInput(request.configPath);
  const now = options.now ?? (() => new Date());

  validateConfigInput(configPath);
  const binaryPath =
    options.binaryPath ??
    (await resolveClashSpeedtestPath({
      ...options.binaryResolverOptions,
    }));
  validateBinaryInput(binaryPath);
  const execute = options.execute ?? executeSpeedtest;
  const sites = enabledSiteDefinitions(options.sites ?? DEFAULT_SITES);
  if (!sites.length) {
    throw new Error("请至少启用一个测试网站");
  }
  const selectedRegions = REGION_PRESETS.filter((region) => request.regionIds.includes(region.id));
  const runs: RunRecord[] = [];
  const results: ResultRow[] = [];
  let activeRun: RunRecord | null = null;

  try {
    for (const region of selectedRegions) {
      activeRun = createRegionRun(now(), region);
      runs.push(activeRun);
      let includeProbeForRegion = normalizeProbeSettings(options.probeSettings).enabled;

      for (const site of sites) {
        options.onProgress?.(`测试 ${region.label} -> ${site.name}`);
        const args = buildSpeedtestArgs(configPath, region, site, options.probeSettings, {
          includeProbe: includeProbeForRegion,
        });
        options.onProgress?.(`运行 ${formatSpeedtestCommand(args)}`);
        const raw = await executeWithOptionalFlagFallback(binaryPath, args, execute, options);
        const rows = normalizeSpeedtestRows(raw, activeRun.id, region, site);
        results.push(...rows);
        includeProbeForRegion = false;
      }

      activeRun.status = "completed";
      activeRun.completedAt = now().toISOString();
    }

    const run = runs[0] ?? createEmptyRun(now(), request.regionIds);
    return { run, runs, results };
  } catch (error) {
    if (activeRun) {
      activeRun.status = "failed";
      activeRun.completedAt = now().toISOString();
      activeRun.errorMessage = error instanceof Error ? error.message : String(error);
    }
    const run = activeRun ?? runs[0] ?? createEmptyRun(now(), request.regionIds);
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { run, runs, results });
  }
}

async function executeWithOptionalFlagFallback(
  binaryPath: string,
  args: string[],
  execute: NonNullable<RunnerOptions["execute"]>,
  options: RunnerOptions,
) {
  let currentArgs = args;
  const appliedFallbacks = new Set<OptionalFlagFallback>();

  while (true) {
    try {
      return await execute(binaryPath, currentArgs, { onProgress: options.onProgress });
    } catch (error) {
      const fallback = getUnsupportedOptionalFlagFallback(error);
      if (!fallback || appliedFallbacks.has(fallback)) throw error;

      appliedFallbacks.add(fallback);
      currentArgs = stripOptionalArgs(currentArgs, fallback);
      options.onProgress?.(describeOptionalFlagFallback(fallback));
      options.onProgress?.(`运行 ${formatSpeedtestCommand(currentArgs)}`);
    }
  }
}

type OptionalFlagFallback = "probe" | "proxy-concurrent";

function getUnsupportedOptionalFlagFallback(error: unknown): OptionalFlagFallback | null {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("flag provided but not defined")) return null;
  if (message.includes("probe")) return "probe";
  if (message.includes("proxy-concurrent")) return "proxy-concurrent";
  return null;
}

function stripOptionalArgs(args: string[], fallback: OptionalFlagFallback) {
  const flags =
    fallback === "probe"
      ? new Set(["--probe-url", "--probe-method", "--probe-timeout", "--probe-fields"])
      : new Set(["--proxy-concurrent"]);
  const stripped: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (flags.has(arg)) {
      index += 1;
      continue;
    }
    stripped.push(arg);
  }
  return stripped;
}

function describeOptionalFlagFallback(fallback: OptionalFlagFallback) {
  if (fallback === "probe") return "当前 clash-speedtest 不支持 probe 参数，已降级为仅测速模式。";
  return "当前 clash-speedtest 不支持节点并发参数，已降级为串行节点测速。";
}

export function validateRunnableInputs(binaryPath: string, configPath: string) {
  validateBinaryInput(binaryPath);
  validateConfigInput(configPath);
}

export function validateBinaryInput(binaryPath: string) {
  const normalizedPath = binaryPath.trim();
  const lowerPath = normalizedPath.toLowerCase();
  if (lowerPath.endsWith(".tar.gz") || lowerPath.endsWith(".tgz") || lowerPath.endsWith(".zip")) {
    throw new Error("请选择解压后的 clash-speedtest 可执行文件，不要直接选择压缩包");
  }

  if (!existsSync(normalizedPath)) {
    throw new Error(`找不到 clash-speedtest 二进制：${normalizedPath}`);
  }

  const stats = statSync(normalizedPath);
  if (!stats.isFile()) {
    throw new Error(`请选择 clash-speedtest 可执行文件，当前不是文件：${normalizedPath}`);
  }
}

export function validateConfigInput(configPath: string) {
  const normalizedConfigPath = normalizeConfigInput(configPath);
  if (!/^https?:\/\//i.test(normalizedConfigPath) && !existsSync(normalizedConfigPath)) {
    throw new Error(`找不到 Clash/Mihomo 配置文件：${normalizedConfigPath}`);
  }
}

function normalizeConfigInput(configPath: string) {
  return configPath.trim();
}

function createRegionRun(startedAt: Date, region: RegionPreset): RunRecord {
  return {
    id: `${createRunId(startedAt)}-${region.id}`,
    startedAt: startedAt.toISOString(),
    completedAt: null,
    status: "running",
    selectedRegions: [region.id],
    errorMessage: null,
  };
}

function createEmptyRun(startedAt: Date, selectedRegions: RegionPreset["id"][]): RunRecord {
  return {
    id: createRunId(startedAt),
    startedAt: startedAt.toISOString(),
    completedAt: null,
    status: "completed",
    selectedRegions,
    errorMessage: null,
  };
}

export function normalizeSpeedtestRows(
  raw: string,
  runId: string,
  region: RegionPreset,
  site: SiteDefinition,
): ResultRow[] {
  return parseTSVOutput(raw).map((row) => ({
    ...row,
    runId,
    regionId: region.id,
    regionLabel: region.label,
    siteId: site.id,
    siteName: site.name,
    siteUrl: site.url,
  }));
}

export async function executeSpeedtest(
  binaryPath: string,
  args: string[],
  options: ExecuteSpeedtestOptions = {},
): Promise<string> {
  const proc = Bun.spawn([binaryPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    readTextStream(proc.stdout, options.onProgress),
    readTextStream(proc.stderr, options.onProgress),
    proc.exited,
  ]);

  const combined = [stdout, stderr].filter(Boolean).join("\n");
  if (exitCode !== 0) {
    throw new Error(`clash-speedtest exited with ${exitCode}: ${combined.trim()}`);
  }
  return stdout;
}

function formatSpeedtestCommand(args: string[]) {
  return `clash-speedtest ${args.map(quoteCommandArg).join(" ")}`;
}

function quoteCommandArg(arg: string) {
  return /^[a-zA-Z0-9_./:=@+-]+$/.test(arg) ? arg : JSON.stringify(arg);
}

async function readTextStream(stream: ReadableStream<Uint8Array>, onProgress?: (message: string) => void) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let bufferedLine = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    output += chunk;
    bufferedLine = emitCompleteLines(bufferedLine + chunk, onProgress);
  }

  const finalChunk = decoder.decode();
  if (finalChunk) {
    output += finalChunk;
    bufferedLine = emitCompleteLines(bufferedLine + finalChunk, onProgress);
  }
  emitProgressLine(bufferedLine, onProgress);

  return output;
}

function emitCompleteLines(text: string, onProgress?: (message: string) => void) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const remainder = lines.pop() ?? "";
  for (const line of lines) emitProgressLine(line, onProgress);
  return remainder;
}

function emitProgressLine(line: string, onProgress?: (message: string) => void) {
  const trimmed = line.trim();
  if (trimmed) onProgress?.(`[clash-speedtest] ${trimmed}`);
}
