import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveClashSpeedtestPath, type ResolveClashSpeedtestOptions } from "./clash-speedtest";
import {
  DEFAULT_SITES,
  REGION_PRESETS,
  createRunId,
  parseTSVOutput,
  type RegionPreset,
  type ResultRow,
  type RunRecord,
  type SiteDefinition,
} from "../shared/domain";

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
};

export type RunOutput = {
  run: RunRecord;
  results: ResultRow[];
};

export type ExecuteSpeedtestOptions = {
  onProgress?: (message: string) => void;
};

export function buildSpeedtestArgs(configPath: string, region: RegionPreset, site: SiteDefinition): string[] {
  return [
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
  ];
}

export async function runLatencyTest(request: RunRequest, options: RunnerOptions = {}): Promise<RunOutput> {
  const configPath = normalizeConfigInput(request.configPath);
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const run: RunRecord = {
    id: createRunId(startedAt),
    startedAt: startedAt.toISOString(),
    completedAt: null,
    status: "running",
    selectedRegions: request.regionIds,
    errorMessage: null,
  };

  validateConfigInput(configPath);
  const binaryPath =
    options.binaryPath ??
    (await resolveClashSpeedtestPath({
      ...options.binaryResolverOptions,
      onProgress: options.onProgress,
    }));
  validateBinaryInput(binaryPath);
  const execute = options.execute ?? executeSpeedtest;
  const sites = options.sites ?? DEFAULT_SITES;
  const selectedRegions = REGION_PRESETS.filter((region) => request.regionIds.includes(region.id));
  const results: ResultRow[] = [];

  try {
    for (const region of selectedRegions) {
      for (const site of sites) {
        options.onProgress?.(`测试 ${region.label} -> ${site.name}`);
        const args = buildSpeedtestArgs(configPath, region, site);
        options.onProgress?.(`运行 ${formatSpeedtestCommand(args)}`);
        const raw = await execute(binaryPath, args, { onProgress: options.onProgress });
        const rows = normalizeSpeedtestRows(raw, run.id, region, site);
        results.push(...rows);
      }
    }

    run.status = "completed";
    run.completedAt = now().toISOString();
    return { run, results };
  } catch (error) {
    run.status = "failed";
    run.completedAt = now().toISOString();
    run.errorMessage = error instanceof Error ? error.message : String(error);
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { run, results });
  }
}

export function validateRunnableInputs(binaryPath: string, configPath: string) {
  validateBinaryInput(binaryPath);
  validateConfigInput(configPath);
}

export function validateBinaryInput(binaryPath: string) {
  if (!existsSync(binaryPath)) {
    throw new Error(`找不到 clash-speedtest 二进制：${binaryPath}`);
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

export function resolveBundledBinaryPath(): string {
  return resolveBundledBinaryPathFrom(process.cwd(), import.meta.dir);
}

export function resolveBundledBinaryPathFrom(cwd: string, moduleDir: string): string {
  const macosDir = cwd;
  const resourcesDir = join(dirname(macosDir), "Resources");
  const candidates = [
    join(cwd, "resources/bin/clash-speedtest"),
    join(resourcesDir, "app/resources/bin/clash-speedtest"),
    join(moduleDir, "../../resources/bin/clash-speedtest"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found ?? candidates[0];
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
