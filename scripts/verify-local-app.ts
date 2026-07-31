import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const STARTUP_MARKER = "[latency-compass] BrowserWindow created";
const channel = Bun.argv[2] ?? "stable";
const platform = resolvePlatform();
const arch = process.platform === "win32" ? "x64" : process.arch === "arm64" ? "arm64" : "x64";
const buildDir = join(import.meta.dir, "..", "build", `${channel}-${platform}-${arch}`);
const appName = channel === "stable" ? "Latency Compass" : `Latency Compass-${channel}`;
const launcher = resolveLauncher(buildDir, appName);

if (!existsSync(launcher)) {
  throw new Error(`找不到已打包应用 launcher：${launcher}\n请先运行 bun run build。`);
}

const logDir = mkdtempSync(join(tmpdir(), "latency-compass-verify-"));
const stdoutPath = join(logDir, "stdout.log");
const stderrPath = join(logDir, "stderr.log");
const markerPath = join(logDir, "window-created.json");
const processHandle = Bun.spawn([launcher], {
  cwd: dirname(launcher),
  env: {
    ...Bun.env,
    LATENCY_COMPASS_VERIFY_LOCAL_APP: markerPath,
  },
  stdout: Bun.file(stdoutPath),
  stderr: Bun.file(stderrPath),
});

try {
  let launcherExitCode: number | undefined;
  void processHandle.exited.then((exitCode) => {
    launcherExitCode = exitCode;
  });

  const deadline = Date.now() + 30_000;
  while (!existsSync(markerPath) && Date.now() < deadline) {
    if (launcherExitCode !== undefined && launcherExitCode !== 0) break;
    await Bun.sleep(250);
  }

  const stdout = readLog(stdoutPath);
  const stderr = readLog(stderrPath);

  if (launcherExitCode !== undefined && launcherExitCode !== 0) {
    throw new Error(
      `已打包应用提前退出（exit ${launcherExitCode}）。\nstdout:\n${stdout || "<empty>"}\nstderr:\n${stderr || "<empty>"}`,
    );
  }
  if (!existsSync(markerPath)) {
    throw new Error(
      `已打包应用仍在运行，但没有完成窗口创建。\nstdout:\n${stdout || "<empty>"}\nstderr:\n${stderr || "<empty>"}`,
    );
  }

  const marker = JSON.parse(readFileSync(markerPath, "utf8")) as { marker?: string; pid?: number };
  if (marker.marker !== STARTUP_MARKER || !Number.isInteger(marker.pid)) {
    throw new Error(`启动标记内容无效：${JSON.stringify(marker)}`);
  }

  console.log(`[latency-compass] packaged app verified: ${launcher}`);
  process.kill(marker.pid!, "SIGTERM");
} finally {
  if (processHandle.exitCode === null) processHandle.kill();
  await processHandle.exited.catch(() => undefined);
  rmSync(logDir, { recursive: true, force: true });
}

function resolvePlatform() {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "win";
  if (process.platform === "linux") return "linux";
  throw new Error(`不支持的运行平台：${process.platform}`);
}

function resolveLauncher(buildDirectory: string, displayName: string) {
  if (process.platform === "darwin") {
    return join(buildDirectory, `${displayName}.app`, "Contents", "MacOS", "launcher");
  }

  const directoryName = displayName.replaceAll(" ", "");
  return join(buildDirectory, directoryName, "bin", process.platform === "win32" ? "launcher.exe" : "launcher");
}

function readLog(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8").trim() : "";
}
