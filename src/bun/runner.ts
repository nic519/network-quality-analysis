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
import type { RunProgressState } from "../shared/rpc";

const DEFAULT_PROXY_CONCURRENT = "2";
const DEFAULT_NODE_COUNT_ESTIMATE = 4;

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
  onStructuredProgress?: (progress: RunProgressState) => void;
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
  const totalGroups = selectedRegions.length * sites.length;
  const runs: RunRecord[] = [];
  const results: ResultRow[] = [];
  const regionNodeCountHints = new Map<RegionPreset["id"], number>();
  let activeRun: RunRecord | null = null;
  let completedGroups = 0;
  let completedNodeUnits = 0;
  let activeGroup: { region: RegionPreset; site: SiteDefinition } | null = null;
  let activeGroupNodeIndex = 0;
  let activeGroupEstimatedNodeCount = 0;

  const emitTextProgress = (message: string) => {
    options.onProgress?.(message);

    if (!activeGroup) return;

    const nextNodeIndex = extractNodeSequenceFromProgressLine(message);
    if (nextNodeIndex === null || nextNodeIndex <= activeGroupNodeIndex) return;

    activeGroupNodeIndex = nextNodeIndex;
    activeGroupEstimatedNodeCount = estimateNodeCount(activeGroupNodeIndex, regionNodeCountHints.get(activeGroup.region.id) ?? null, [
      ...regionNodeCountHints.values(),
    ]);
    publishStructuredProgress(options, {
      stage: "running",
      completedGroups,
      totalGroups,
      percent: calculateNodeWeightedProgressPercent({
        completedNodeUnits,
        activeGroupNodeIndex,
        activeGroupEstimatedNodeCount,
        pendingGroupsCount: totalGroups - completedGroups - 1,
        knownNodeCountHints: [...regionNodeCountHints.values()],
      }),
      region: activeGroup.region,
      site: activeGroup.site,
      currentNodeIndex: activeGroupNodeIndex,
      estimatedNodeCount: activeGroupEstimatedNodeCount,
      nodeCount: null,
      message: `正在测试 ${activeGroup.region.label} -> ${activeGroup.site.name}，第 ${activeGroupNodeIndex} 个节点`,
    });
  };

  try {
    for (const region of selectedRegions) {
      activeRun = createRegionRun(now(), region);
      runs.push(activeRun);
      let includeProbeForRegion = normalizeProbeSettings(options.probeSettings).enabled;

      for (const site of sites) {
        activeGroup = { region, site };
        activeGroupNodeIndex = 0;
        activeGroupEstimatedNodeCount = estimateNodeCount(0, regionNodeCountHints.get(region.id) ?? null, [...regionNodeCountHints.values()]);
        publishStructuredProgress(options, {
          stage: "running",
          completedGroups,
          totalGroups,
          percent: calculateNodeWeightedProgressPercent({
            completedNodeUnits,
            activeGroupNodeIndex,
            activeGroupEstimatedNodeCount,
            pendingGroupsCount: totalGroups - completedGroups - 1,
            knownNodeCountHints: [...regionNodeCountHints.values()],
          }),
          region,
          site,
          currentNodeIndex: activeGroupNodeIndex,
          estimatedNodeCount: activeGroupEstimatedNodeCount,
          nodeCount: null,
          message: `正在测试 ${region.label} -> ${site.name} (${completedGroups + 1}/${totalGroups})`,
        });
        emitTextProgress(`测试 ${region.label} -> ${site.name}`);
        const args = buildSpeedtestArgs(configPath, region, site, options.probeSettings, {
          includeProbe: includeProbeForRegion,
        });
        emitTextProgress(`运行 ${formatSpeedtestCommand(args)}`);
        const raw = await executeWithOptionalFlagFallback(binaryPath, args, execute, {
          ...options,
          onProgress: emitTextProgress,
        });
        const rows = normalizeSpeedtestRows(raw, activeRun.id, region, site);
        results.push(...rows);
        regionNodeCountHints.set(region.id, rows.length);
        completedNodeUnits += rows.length;
        activeGroupNodeIndex = rows.length;
        activeGroupEstimatedNodeCount = rows.length;
        completedGroups += 1;
        activeGroup = null;
        includeProbeForRegion = false;
      }

      activeRun.status = "completed";
      activeRun.completedAt = now().toISOString();
    }

    publishStructuredProgress(options, {
      stage: "completed",
      completedGroups,
      totalGroups,
      percent: 100,
      region: null,
      site: null,
      currentNodeIndex: null,
      estimatedNodeCount: null,
      nodeCount: null,
      message: totalGroups ? `测试完成 (${completedGroups}/${totalGroups})` : "测试完成",
    });
    const run = runs[0] ?? createEmptyRun(now(), request.regionIds);
    return { run, runs, results };
  } catch (error) {
    if (activeRun) {
      activeRun.status = "failed";
      activeRun.completedAt = now().toISOString();
      activeRun.errorMessage = error instanceof Error ? error.message : String(error);
    }
    publishStructuredProgress(options, {
      stage: "failed",
      completedGroups,
      totalGroups,
      percent: calculateNodeWeightedProgressPercent({
        completedNodeUnits,
        activeGroupNodeIndex,
        activeGroupEstimatedNodeCount,
        pendingGroupsCount: Math.max(0, totalGroups - completedGroups - (activeGroup ? 1 : 0)),
        knownNodeCountHints: [...regionNodeCountHints.values()],
      }),
      region: activeGroup?.region ?? null,
      site: activeGroup?.site ?? null,
      currentNodeIndex: activeGroup ? activeGroupNodeIndex : null,
      estimatedNodeCount: activeGroup ? activeGroupEstimatedNodeCount : null,
      nodeCount: null,
      message: `测试失败：${error instanceof Error ? error.message : String(error)}`,
    });
    const run = activeRun ?? runs[0] ?? createEmptyRun(now(), request.regionIds);
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { run, runs, results });
  }
}

function publishStructuredProgress(
  options: RunnerOptions,
  details: {
    stage: RunProgressState["stage"];
    completedGroups: number;
    totalGroups: number;
    percent: number;
    region: RegionPreset | null;
    site: SiteDefinition | null;
    currentNodeIndex: number | null;
    estimatedNodeCount: number | null;
    nodeCount: number | null;
    message: string;
  },
) {
  options.onStructuredProgress?.({
    stage: details.stage,
    completedGroups: details.completedGroups,
    totalGroups: details.totalGroups,
    percent: details.percent,
    currentGroupNodeIndex: details.currentNodeIndex,
    currentGroupEstimatedNodeCount: details.estimatedNodeCount,
    currentRegionId: details.region?.id ?? null,
    currentRegionLabel: details.region?.label ?? null,
    currentSiteId: details.site?.id ?? null,
    currentSiteName: details.site?.name ?? null,
    currentSiteUrl: details.site?.url ?? null,
    currentGroupLabel: details.region && details.site ? `${details.region.label} -> ${details.site.name}` : null,
    currentGroupNodeCount: details.nodeCount,
    message: details.message,
  });
}

function calculateNodeWeightedProgressPercent({
  completedNodeUnits,
  activeGroupNodeIndex,
  activeGroupEstimatedNodeCount,
  pendingGroupsCount,
  knownNodeCountHints,
}: {
  completedNodeUnits: number;
  activeGroupNodeIndex: number;
  activeGroupEstimatedNodeCount: number;
  pendingGroupsCount: number;
  knownNodeCountHints: number[];
}) {
  const fallbackNodeCount = averageNodeCount(knownNodeCountHints) || activeGroupEstimatedNodeCount || DEFAULT_NODE_COUNT_ESTIMATE;
  const activeNodeBudget = activeGroupEstimatedNodeCount || 0;
  const totalEstimatedNodeUnits = completedNodeUnits + activeNodeBudget + Math.max(0, pendingGroupsCount) * fallbackNodeCount;
  if (totalEstimatedNodeUnits <= 0) return 0;
  const progressedNodeUnits = completedNodeUnits + Math.min(activeGroupNodeIndex, activeNodeBudget || activeGroupNodeIndex);
  return Math.max(0, Math.min(100, Math.round((progressedNodeUnits / totalEstimatedNodeUnits) * 100)));
}

function averageNodeCount(values: number[]) {
  if (!values.length) return null;
  return Math.max(1, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
}

function estimateNodeCount(currentNodeIndex: number, knownRegionNodeCount: number | null, knownNodeHints: number[]) {
  if (knownRegionNodeCount && knownRegionNodeCount > 0) return knownRegionNodeCount;
  const averageKnownNodeCount = averageNodeCount(knownNodeHints);
  if (averageKnownNodeCount) return Math.max(currentNodeIndex + 1, averageKnownNodeCount);
  return Math.max(DEFAULT_NODE_COUNT_ESTIMATE, currentNodeIndex + 1);
}

function extractNodeSequenceFromProgressLine(message: string) {
  const trimmed = message.replace(/^\[clash-speedtest\]\s*/, "").trim();
  const match = trimmed.match(/^(\d+)\.\s/);
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isFinite(sequence) ? sequence : null;
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
