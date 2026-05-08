import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ClashSpeedtestState } from "../shared/rpc";

const GO_INSTALL_COMMAND = "go install github.com/nic519/clash-speedtest@latest";

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
  return makeClashSpeedtestState({
    status: local.path ? "ready" : "missing",
    version: null,
    path: local.path,
    source: local.source,
    checkedAt: now().toISOString(),
  });
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
