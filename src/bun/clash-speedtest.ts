import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, rename, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { ClashSpeedtestState } from "../shared/rpc";

export const CLASH_SPEEDTEST_VERSION = "v0.0.1";
const RELEASE_BASE_URL = `https://github.com/nic519/clash-speedtest/releases/download/${CLASH_SPEEDTEST_VERSION}`;
const RELEASE_API_URL = "https://api.github.com/repos/nic519/clash-speedtest/releases/latest";
const RELEASE_DOWNLOAD_TIMEOUT_MS = 120_000;
const RELEASE_CHECK_TIMEOUT_MS = 10_000;
const RELEASE_CHECK_CACHE_MS = 10 * 60 * 1000;

export type ClashSpeedtestAsset = {
  archiveName: string;
  archiveUrl: string;
  executableName: string;
};

export type ResolveClashSpeedtestOptions = {
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  installRoot?: string;
  envPath?: string;
  fetchArchive?: (url: string) => Promise<ArrayBuffer>;
  onProgress?: (message: string) => void;
};

export type ClashSpeedtestStatusOptions = Pick<ResolveClashSpeedtestOptions, "platform" | "arch" | "installRoot" | "envPath"> & {
  now?: () => Date;
  fetchLatestVersion?: () => Promise<string | null>;
};

type LocalClashSpeedtestInstall = {
  path: string | null;
  source: ClashSpeedtestState["source"];
};

let latestVersionCache: { checkedAt: number; version: string | null } | null = null;

export async function resolveClashSpeedtestPath(options: ResolveClashSpeedtestOptions = {}) {
  if (options.envPath && existsSync(options.envPath)) return options.envPath;
  if (process.env.CLASH_SPEEDTEST_PATH && existsSync(process.env.CLASH_SPEEDTEST_PATH)) {
    return process.env.CLASH_SPEEDTEST_PATH;
  }

  const platform = options.platform ?? process.platform;
  const asset = getClashSpeedtestAsset(platform, options.arch ?? process.arch);
  const installDir = getClashSpeedtestInstallDir(options.installRoot);
  const executablePath = join(installDir, asset.executableName);
  if (existsSync(executablePath)) return executablePath;

  options.onProgress?.(`下载 clash-speedtest ${CLASH_SPEEDTEST_VERSION}`);
  await downloadAndInstallClashSpeedtest(asset, installDir, {
    fetchArchive: options.fetchArchive,
    platform,
  });
  options.onProgress?.("clash-speedtest 准备完成");

  return executablePath;
}

export async function getClashSpeedtestState(options: ClashSpeedtestStatusOptions = {}): Promise<ClashSpeedtestState> {
  const now = options.now ?? (() => new Date());
  const local = getLocalClashSpeedtestInstall(options);
  const base = makeClashSpeedtestState({
    status: local.path ? "ready" : "missing",
    path: local.path,
    source: local.source,
    latestVersion: null,
    checkedAt: now().toISOString(),
  });

  try {
    const latestVersion = await getLatestClashSpeedtestVersion({
      fetchLatestVersion: options.fetchLatestVersion,
      now,
    });
    return makeClashSpeedtestState({
      ...base,
      latestVersion,
      updateAvailable: latestVersion ? isNewerVersion(latestVersion, CLASH_SPEEDTEST_VERSION) : null,
    });
  } catch (error) {
    return makeClashSpeedtestState({
      ...base,
      status: local.path ? "ready" : "error",
      message: local.path
        ? `clash-speedtest 已就绪，检查更新失败：${toErrorMessage(error)}`
        : `clash-speedtest 未下载，检查更新失败：${toErrorMessage(error)}`,
    });
  }
}

export function getLocalClashSpeedtestInstall(options: ClashSpeedtestStatusOptions = {}): LocalClashSpeedtestInstall {
  if (options.envPath && existsSync(options.envPath)) return { path: options.envPath, source: "environment" };
  if (process.env.CLASH_SPEEDTEST_PATH && existsSync(process.env.CLASH_SPEEDTEST_PATH)) {
    return { path: process.env.CLASH_SPEEDTEST_PATH, source: "environment" };
  }

  const platform = options.platform ?? process.platform;
  const asset = getClashSpeedtestAsset(platform, options.arch ?? process.arch);
  const executablePath = join(getClashSpeedtestInstallDir(options.installRoot), asset.executableName);
  return existsSync(executablePath) ? { path: executablePath, source: "cache" } : { path: null, source: null };
}

export function makeClashSpeedtestState(
  input: Partial<ClashSpeedtestState> & Pick<ClashSpeedtestState, "status" | "checkedAt">,
): ClashSpeedtestState {
  const updateAvailable =
    input.updateAvailable ?? (input.latestVersion ? isNewerVersion(input.latestVersion, CLASH_SPEEDTEST_VERSION) : null);
  const path = input.path ?? null;
  const source = input.source ?? null;
  const message = input.message ?? describeClashSpeedtestState(input.status, {
    latestVersion: input.latestVersion ?? null,
    path,
    updateAvailable,
  });

  return {
    status: input.status,
    version: CLASH_SPEEDTEST_VERSION,
    latestVersion: input.latestVersion ?? null,
    updateAvailable,
    path,
    source,
    message,
    checkedAt: input.checkedAt,
  };
}

export function getClashSpeedtestAsset(platform: NodeJS.Platform, arch: NodeJS.Architecture): ClashSpeedtestAsset {
  const osName = getReleaseOsName(platform);
  const archName = getReleaseArchName(arch);
  const archiveExt = platform === "win32" ? "zip" : "tar.gz";
  const executableName = platform === "win32" ? "clash-speedtest.exe" : "clash-speedtest";
  const archiveName = `clash-speedtest_${osName}_${archName}.${archiveExt}`;

  return {
    archiveName,
    archiveUrl: `${RELEASE_BASE_URL}/${archiveName}`,
    executableName,
  };
}

export function getClashSpeedtestInstallDir(installRoot = getDefaultInstallRoot()) {
  return join(installRoot, "clash-speedtest", CLASH_SPEEDTEST_VERSION);
}

async function getLatestClashSpeedtestVersion(options: {
  now: () => Date;
  fetchLatestVersion?: () => Promise<string | null>;
}) {
  const nowMs = options.now().getTime();
  if (!options.fetchLatestVersion && latestVersionCache && nowMs - latestVersionCache.checkedAt < RELEASE_CHECK_CACHE_MS) {
    return latestVersionCache.version;
  }

  const version = await (options.fetchLatestVersion ?? fetchLatestReleaseVersion)();
  if (!options.fetchLatestVersion) latestVersionCache = { checkedAt: nowMs, version };
  return version;
}

async function fetchLatestReleaseVersion() {
  const response = await fetch(RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Latency Compass",
    },
    signal: AbortSignal.timeout(RELEASE_CHECK_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { tag_name?: unknown };
  return typeof payload.tag_name === "string" && payload.tag_name.trim() ? payload.tag_name.trim() : null;
}

async function downloadAndInstallClashSpeedtest(
  asset: ClashSpeedtestAsset,
  installDir: string,
  options: {
    fetchArchive?: (url: string) => Promise<ArrayBuffer>;
    platform: NodeJS.Platform;
  },
) {
  const tempDir = await mkdtemp(join(tmpdir(), "latency-compass-clash-speedtest-"));
  const archivePath = join(tempDir, asset.archiveName);

  try {
    const archive = await (options.fetchArchive ?? fetchReleaseAsset)(asset.archiveUrl);
    writeFileSync(archivePath, new Uint8Array(archive));
    await extractArchive(archivePath, tempDir, options.platform);

    const extractedPath = join(tempDir, asset.executableName);
    if (!existsSync(extractedPath)) {
      throw new Error(`下载包中缺少 ${asset.executableName}: ${asset.archiveName}`);
    }

    rmSync(installDir, { recursive: true, force: true });
    mkdirSync(installDir, { recursive: true });
    await rename(extractedPath, join(installDir, asset.executableName));
    if (options.platform !== "win32") chmodSync(join(installDir, asset.executableName), 0o755);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchReleaseAsset(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Latency Compass",
    },
    signal: AbortSignal.timeout(RELEASE_DOWNLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`下载 clash-speedtest 失败：${response.status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}

async function extractArchive(archivePath: string, destination: string, platform: NodeJS.Platform) {
  const command =
    platform === "win32"
      ? [
          "powershell",
          "-NoProfile",
          "-Command",
          "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force",
          archivePath,
          destination,
        ]
      : ["tar", "-xzf", archivePath, "-C", destination];

  const proc = Bun.spawn(command, {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    throw new Error(`解压 clash-speedtest 失败：${output}`);
  }
}

function getReleaseOsName(platform: NodeJS.Platform) {
  if (platform === "darwin") return "Darwin";
  if (platform === "linux") return "Linux";
  if (platform === "win32") return "Windows";
  throw new Error(`暂不支持当前系统：${platform}`);
}

function getReleaseArchName(arch: NodeJS.Architecture) {
  if (arch === "x64") return "x86_64";
  if (arch === "arm64") return "arm64";
  throw new Error(`暂不支持当前 CPU 架构：${arch}`);
}

function describeClashSpeedtestState(
  status: ClashSpeedtestState["status"],
  details: {
    latestVersion: string | null;
    path: string | null;
    updateAvailable: boolean | null;
  },
) {
  if (status === "downloading") return `正在下载 clash-speedtest ${CLASH_SPEEDTEST_VERSION}`;
  if (status === "checking-update") return "正在检查 clash-speedtest 更新";
  if (status === "error") return "clash-speedtest 状态检查失败";
  if (!details.path) return `clash-speedtest 未下载，首次测试会自动下载 ${CLASH_SPEEDTEST_VERSION}`;
  if (details.updateAvailable) {
    return `clash-speedtest 已就绪，GitHub 有新版本 ${details.latestVersion}`;
  }
  if (details.updateAvailable === false) return `clash-speedtest 已就绪，当前为最新版本 ${CLASH_SPEEDTEST_VERSION}`;
  return `clash-speedtest 已就绪，当前版本 ${CLASH_SPEEDTEST_VERSION}`;
}

function isNewerVersion(candidate: string, current: string) {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  if (!candidateParts || !currentParts) return candidate !== current;

  for (let index = 0; index < Math.max(candidateParts.length, currentParts.length); index += 1) {
    const candidatePart = candidateParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;
    if (candidatePart > currentPart) return true;
    if (candidatePart < currentPart) return false;
  }
  return false;
}

function parseVersion(version: string) {
  const match = version.trim().match(/^v?(\d+(?:\.\d+)*)/i);
  return match ? match[1].split(".").map((part) => Number(part)) : null;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getDefaultInstallRoot() {
  if (process.platform === "darwin") {
    return join(homedir(), "Library/Application Support/Latency Compass/bin");
  }
  return join(homedir(), ".latency-compass/bin");
}
