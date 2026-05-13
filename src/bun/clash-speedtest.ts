import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import packageJson from "../../package.json";
import type { ClashSpeedtestState } from "../shared/rpc";

const GO_INSTALL_COMMAND = "go install github.com/nic519/clash-speedtest@latest";
export const MINIMUM_CLASH_SPEEDTEST_VERSION = packageJson.version;

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
  readVersion?: (binaryPath: string) => Promise<string>;
};

type LocalClashSpeedtestInstall = {
  path: string | null;
  source: ClashSpeedtestState["source"];
};

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
  if (!local.path) {
    return makeClashSpeedtestState({
      status: "missing",
      version: null,
      path: local.path,
      source: local.source,
      checkedAt: now().toISOString(),
    });
  }

  const readVersion = options.readVersion ?? readClashSpeedtestVersion;
  try {
    const versionOutput = await readVersion(local.path);
    const version = parseClashSpeedtestVersion(versionOutput);
    if (!isClashSpeedtestVersionSupported(version, MINIMUM_CLASH_SPEEDTEST_VERSION)) {
      return makeClashSpeedtestState({
        status: "error",
        version,
        path: local.path,
        source: local.source,
        checkedAt: now().toISOString(),
        message: `clash-speedtest 版本不匹配：需要 >= ${MINIMUM_CLASH_SPEEDTEST_VERSION}，当前是 ${version || "未知"}。请重新编译或安装对应版本。`,
      });
    }

    return makeClashSpeedtestState({
      status: "ready",
      version,
      path: local.path,
      source: local.source,
      checkedAt: now().toISOString(),
    });
  } catch (error) {
    return makeClashSpeedtestState({
      status: "error",
      version: null,
      path: local.path,
      source: local.source,
      checkedAt: now().toISOString(),
      message: `无法读取 clash-speedtest 版本。请重新编译或安装 >= ${MINIMUM_CLASH_SPEEDTEST_VERSION} 的版本。${toErrorMessage(error)}`,
    });
  }
}

export function parseClashSpeedtestVersion(output: string) {
  const match = output.match(/clash-speedtest version\s+([^\s]+)/i);
  return match?.[1] ?? "";
}

export function isClashSpeedtestVersionSupported(version: string, minimumVersion = MINIMUM_CLASH_SPEEDTEST_VERSION) {
  return compareSemver(version, minimumVersion) >= 0;
}

async function readClashSpeedtestVersion(binaryPath: string) {
  const proc = Bun.spawn([binaryPath, "-v"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([readText(proc.stdout), readText(proc.stderr), proc.exited]);
  const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
  if (exitCode !== 0) {
    throw new Error(`版本检查失败：${combined || `退出码 ${exitCode}`}`);
  }
  return combined;
}

async function readText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  output += decoder.decode();
  return output;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function compareSemver(left: string, right: string) {
  const leftParts = normalizeVersionParts(left);
  const rightParts = normalizeVersionParts(right);
  if (!leftParts || !rightParts) return -1;

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

function normalizeVersionParts(version: string) {
  const normalized = version.trim().replace(/^v/i, "");
  if (!normalized) return null;

  const core = normalized.split("-", 1)[0];
  const parts = core.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part))) return null;
  return parts;
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
  const version = input.version ?? null;
  const path = input.path ?? null;
  const source = input.source ?? null;
  const message = input.message ?? describeClashSpeedtestState(input.status, path);

  return {
    status: input.status,
    version,
    path,
    source,
    message,
    checkedAt: input.checkedAt,
  };
}

function getExecutableName(platform: NodeJS.Platform) {
  return platform === "win32" ? "clash-speedtest.exe" : "clash-speedtest";
}

function describeClashSpeedtestState(status: ClashSpeedtestState["status"], path: string | null) {
  if (status === "error") return "clash-speedtest 当前不可用";
  if (!path) {
    return `尚未检测到 clash-speedtest。请先运行 \`${GO_INSTALL_COMMAND}\``;
  }
  return "已检测到 clash-speedtest，可直接运行";
}

function getDefaultGoPath() {
  return join(homedir(), "go");
}
