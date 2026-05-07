import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ClashSpeedtestState } from "../shared/rpc";

export const CLASH_SPEEDTEST_VERSION = "v0.0.1";
const RELEASE_API_URL = "https://api.github.com/repos/nic519/clash-speedtest/releases/latest";
const RELEASE_CHECK_TIMEOUT_MS = 10_000;
const RELEASE_CHECK_CACHE_MS = 10 * 60 * 1000;
const GO_INSTALL_COMMAND = "go install github.com/nic519/clash-speedtest@latest";

export type ClashSpeedtestAsset = {
  archiveName: string;
  archiveUrl: string;
  executableName: string;
};

export type ResolveClashSpeedtestOptions = {
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  envPath?: string;
  gobin?: string;
  goPath?: string;
};

export type ClashSpeedtestStatusOptions = Pick<
  ResolveClashSpeedtestOptions,
  "platform" | "arch" | "envPath" | "gobin" | "goPath"
> & {
  now?: () => Date;
  fetchLatestVersion?: () => Promise<string | null>;
};

type LocalClashSpeedtestInstall = {
  path: string | null;
  source: ClashSpeedtestState["source"];
};

let latestVersionCache: { checkedAt: number; version: string | null } | null = null;

export async function resolveClashSpeedtestPath(options: ResolveClashSpeedtestOptions = {}) {
  const local = getLocalClashSpeedtestInstall(options);
  if (local.path) return local.path;
  throw new Error(
    `未找到 clash-speedtest 可执行文件。请先运行 \`${GO_INSTALL_COMMAND}\`，或在“依赖”页手动指定一个本地可执行文件路径。`,
  );
}

export async function getClashSpeedtestState(options: ClashSpeedtestStatusOptions = {}): Promise<ClashSpeedtestState> {
  const now = options.now ?? (() => new Date());
  const local = getLocalClashSpeedtestInstall(options);
  const base = makeClashSpeedtestState({
    status: local.path ? "ready" : "missing",
    version: local.path ? CLASH_SPEEDTEST_VERSION : null,
    path: local.path,
    source: local.source,
    latestVersion: null,
    updateCheckStatus: "idle",
    updateCheckMessage: null,
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
      updateCheckStatus: "ok",
      updateCheckMessage: null,
    });
  } catch (error) {
    return makeClashSpeedtestState({
      ...base,
      updateCheckStatus: "failed",
      updateCheckMessage: toErrorMessage(error),
    });
  }
}

export function getLocalClashSpeedtestInstall(options: ClashSpeedtestStatusOptions = {}): LocalClashSpeedtestInstall {
  if (options.envPath && existsSync(options.envPath)) return { path: options.envPath, source: "environment" };
  if (process.env.CLASH_SPEEDTEST_PATH && existsSync(process.env.CLASH_SPEEDTEST_PATH)) {
    return { path: process.env.CLASH_SPEEDTEST_PATH, source: "environment" };
  }

  const executableName = getExecutableName(options.platform ?? process.platform);
  const gobin = options.gobin ?? process.env.GOBIN ?? null;
  const goPath = options.goPath ?? process.env.GOPATH ?? getDefaultGoPath();
  const hasExplicitGoPaths = options.gobin !== undefined || options.goPath !== undefined;
  const candidates = [
    gobin ? join(gobin, executableName) : null,
    goPath ? join(goPath, "bin", executableName) : null,
    !hasExplicitGoPaths ? join(homedir(), "go", "bin", executableName) : null,
  ].filter((value): value is string => Boolean(value));

  const installedPath = candidates.find((candidate) => existsSync(candidate));
  return installedPath ? { path: installedPath, source: "go-install" } : { path: null, source: null };
}

export function makeClashSpeedtestState(
  input: Partial<ClashSpeedtestState> & Pick<ClashSpeedtestState, "status" | "checkedAt">,
): ClashSpeedtestState {
  const version = input.version ?? (input.path ? CLASH_SPEEDTEST_VERSION : null);
  const updateAvailable = input.updateAvailable ?? (input.latestVersion ? isNewerVersion(input.latestVersion, CLASH_SPEEDTEST_VERSION) : null);
  const updateCheckStatus = input.updateCheckStatus ?? "idle";
  const updateCheckMessage = input.updateCheckMessage ?? null;
  const path = input.path ?? null;
  const source = input.source ?? null;
  const message =
    input.message ??
    describeClashSpeedtestState(input.status, {
      latestVersion: input.latestVersion ?? null,
      path,
      updateAvailable,
      updateCheckStatus,
      updateCheckMessage,
    });

  return {
    status: input.status,
    version,
    latestVersion: input.latestVersion ?? null,
    updateAvailable,
    updateCheckStatus,
    updateCheckMessage,
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
    archiveUrl: `https://github.com/nic519/clash-speedtest/releases/download/${CLASH_SPEEDTEST_VERSION}/${archiveName}`,
    executableName,
  };
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

function getExecutableName(platform: NodeJS.Platform) {
  return platform === "win32" ? "clash-speedtest.exe" : "clash-speedtest";
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
    updateCheckStatus: ClashSpeedtestState["updateCheckStatus"];
    updateCheckMessage: string | null;
  },
) {
  if (status === "downloading") return "正在准备 clash-speedtest";
  if (status === "checking-update") return "正在检查 clash-speedtest 状态";
  if (status === "error") return "clash-speedtest 当前不可用";
  if (!details.path) {
    if (details.updateCheckStatus === "failed" && details.updateCheckMessage) {
      return `尚未检测到 clash-speedtest，本地安装检查正常，但远端版本检查失败：${details.updateCheckMessage}`;
    }
    return `尚未检测到 clash-speedtest。请先运行 \`${GO_INSTALL_COMMAND}\``;
  }
  if (details.updateCheckStatus === "failed" && details.updateCheckMessage) {
    return `已检测到 clash-speedtest，但远端版本检查失败：${details.updateCheckMessage}`;
  }
  if (details.updateAvailable) {
    return `已检测到 clash-speedtest，GitHub 有新版本 ${details.latestVersion}`;
  }
  if (details.updateAvailable === false) return `已检测到 clash-speedtest，当前最新版本为 ${CLASH_SPEEDTEST_VERSION}`;
  return "已检测到 clash-speedtest，可直接运行";
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

function getDefaultGoPath() {
  return join(homedir(), "go");
}
