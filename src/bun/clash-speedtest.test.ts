import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CLASH_SPEEDTEST_VERSION,
  getClashSpeedtestAsset,
  getClashSpeedtestState,
  resolveClashSpeedtestPath,
} from "./clash-speedtest";

describe("getClashSpeedtestAsset", () => {
  test("maps macOS arm64 to the GitHub release asset", () => {
    expect(getClashSpeedtestAsset("darwin", "arm64")).toEqual({
      archiveName: "clash-speedtest_Darwin_arm64.tar.gz",
      archiveUrl: `https://github.com/nic519/clash-speedtest/releases/download/${CLASH_SPEEDTEST_VERSION}/clash-speedtest_Darwin_arm64.tar.gz`,
      executableName: "clash-speedtest",
    });
  });

  test("maps x64 and Windows names to GoReleaser asset names", () => {
    expect(getClashSpeedtestAsset("win32", "x64")).toEqual({
      archiveName: "clash-speedtest_Windows_x86_64.zip",
      archiveUrl: `https://github.com/nic519/clash-speedtest/releases/download/${CLASH_SPEEDTEST_VERSION}/clash-speedtest_Windows_x86_64.zip`,
      executableName: "clash-speedtest.exe",
    });
  });
});

describe("resolveClashSpeedtestPath", () => {
  test("uses CLASH_SPEEDTEST_PATH-style override when the file exists", async () => {
    const root = join(tmpdir(), `latency-compass-env-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");

    await expect(resolveClashSpeedtestPath({ envPath: binaryPath })).resolves.toBe(binaryPath);
  });

  test("uses the go install binary under GOBIN before falling back", async () => {
    const root = join(tmpdir(), `latency-compass-gobin-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    chmodSync(binaryPath, 0o755);

    await expect(
      resolveClashSpeedtestPath({
        gobin: root,
        platform: "darwin",
        arch: "arm64",
      }),
    ).resolves.toBe(binaryPath);
  });

  test("fails with installation guidance when no binary is available", async () => {
    const root = join(tmpdir(), `latency-compass-missing-bin-${Date.now()}`);

    await expect(
      resolveClashSpeedtestPath({
        gobin: root,
        goPath: root,
      }),
    ).rejects.toThrow("go install github.com/nic519/clash-speedtest@latest");
  });
});

describe("getClashSpeedtestState", () => {
  test("reports missing installs with go install guidance", async () => {
    const root = join(tmpdir(), `latency-compass-missing-${Date.now()}`);

    await expect(
      getClashSpeedtestState({
        gobin: root,
        goPath: root,
        platform: "darwin",
        arch: "arm64",
        fetchLatestVersion: async () => CLASH_SPEEDTEST_VERSION,
        now: () => new Date("2026-05-07T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      status: "missing",
      path: null,
      source: null,
      updateAvailable: false,
      latestVersion: CLASH_SPEEDTEST_VERSION,
      updateCheckStatus: "ok",
      updateCheckMessage: null,
    });
  });

  test("reports go install binaries as ready", async () => {
    const root = join(tmpdir(), `latency-compass-ready-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    chmodSync(binaryPath, 0o755);

    await expect(
      getClashSpeedtestState({
        gobin: root,
        platform: "darwin",
        arch: "arm64",
        fetchLatestVersion: async () => CLASH_SPEEDTEST_VERSION,
        now: () => new Date("2026-05-07T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      status: "ready",
      path: binaryPath,
      source: "go-install",
      updateAvailable: false,
      latestVersion: CLASH_SPEEDTEST_VERSION,
      updateCheckStatus: "ok",
      updateCheckMessage: null,
    });
  });

  test("surfaces update availability from the latest release tag", async () => {
    const root = join(tmpdir(), `latency-compass-update-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    chmodSync(binaryPath, 0o755);

    await expect(
      getClashSpeedtestState({
        gobin: root,
        platform: "darwin",
        arch: "arm64",
        fetchLatestVersion: async () => "v0.0.2",
        now: () => new Date("2026-05-07T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      status: "ready",
      updateAvailable: true,
      latestVersion: "v0.0.2",
      updateCheckStatus: "ok",
      updateCheckMessage: null,
    });
  });

  test("keeps missing installs non-blocking when update checks fail", async () => {
    const root = join(tmpdir(), `latency-compass-missing-update-check-failed-${Date.now()}`);

    await expect(
      getClashSpeedtestState({
        gobin: root,
        goPath: root,
        platform: "darwin",
        arch: "arm64",
        fetchLatestVersion: async () => {
          throw new Error("403 rate limited");
        },
        now: () => new Date("2026-05-07T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      status: "missing",
      path: null,
      updateCheckStatus: "failed",
      updateCheckMessage: "403 rate limited",
    });
  });

  test("keeps ready installs usable when update checks fail", async () => {
    const root = join(tmpdir(), `latency-compass-ready-update-check-failed-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    chmodSync(binaryPath, 0o755);

    await expect(
      getClashSpeedtestState({
        gobin: root,
        platform: "darwin",
        arch: "arm64",
        fetchLatestVersion: async () => {
          throw new Error("timeout");
        },
        now: () => new Date("2026-05-07T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      status: "ready",
      path: binaryPath,
      updateCheckStatus: "failed",
      updateCheckMessage: "timeout",
    });
  });
});
