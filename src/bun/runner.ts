import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
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
  sites?: SiteDefinition[];
  now?: () => Date;
  execute?: (binaryPath: string, args: string[]) => Promise<string>;
  onProgress?: (message: string) => void;
};

export type RunOutput = {
  run: RunRecord;
  results: ResultRow[];
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
  ];
}

export async function runLatencyTest(request: RunRequest, options: RunnerOptions = {}): Promise<RunOutput> {
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

  const binaryPath = options.binaryPath ?? resolveBundledBinaryPath();
  validateRunnableInputs(binaryPath, request.configPath);
  const execute = options.execute ?? executeSpeedtest;
  const sites = options.sites ?? DEFAULT_SITES;
  const selectedRegions = REGION_PRESETS.filter((region) => request.regionIds.includes(region.id));
  const results: ResultRow[] = [];

  try {
    for (const region of selectedRegions) {
      for (const site of sites) {
        options.onProgress?.(`测试 ${region.label} -> ${site.name}`);
        const raw = await execute(binaryPath, buildSpeedtestArgs(request.configPath, region, site));
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
  if (!existsSync(binaryPath)) {
    throw new Error(`找不到内置 clash-speedtest 二进制：${binaryPath}`);
  }
  if (!/^https?:\/\//i.test(configPath) && !existsSync(configPath)) {
    throw new Error(`找不到 Clash/Mihomo 配置文件：${configPath}`);
  }
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

async function executeSpeedtest(binaryPath: string, args: string[]): Promise<string> {
  const proc = Bun.spawn([binaryPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  const combined = [stdout, stderr].filter(Boolean).join("\n");
  if (exitCode !== 0) {
    throw new Error(`clash-speedtest exited with ${exitCode}: ${combined.trim()}`);
  }
  return combined;
}
