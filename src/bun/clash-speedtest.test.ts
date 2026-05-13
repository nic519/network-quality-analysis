import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getClashSpeedtestState, resolveClashSpeedtestPath } from "./clash-speedtest";

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
        now: () => new Date("2026-05-07T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      status: "missing",
      path: null,
      source: null,
      message: "尚未检测到 clash-speedtest。请先运行 `go install github.com/nic519/clash-speedtest@latest`",
    });
  });

  test("reports minimum supported go install binaries as ready", async () => {
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
        now: () => new Date("2026-05-07T00:00:00.000Z"),
        readVersion: async () => "clash-speedtest version 0.1.3 (commit abc123)",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      version: "0.1.3",
      path: binaryPath,
      source: "go-install",
      message: "已检测到 clash-speedtest，可直接运行",
    });
  });

  test("accepts newer clash-speedtest versions", async () => {
    const root = join(tmpdir(), `latency-compass-newer-version-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    chmodSync(binaryPath, 0o755);

    await expect(
      getClashSpeedtestState({
        gobin: root,
        platform: "darwin",
        arch: "arm64",
        now: () => new Date("2026-05-07T00:00:00.000Z"),
        readVersion: async () => "clash-speedtest version 0.1.5 (commit abc123)",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      version: "0.1.5",
      path: binaryPath,
      source: "go-install",
      message: "已检测到 clash-speedtest，可直接运行",
    });
  });

  test("rejects clash-speedtest versions below the minimum requirement", async () => {
    const root = join(tmpdir(), `latency-compass-wrong-version-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    chmodSync(binaryPath, 0o755);

    await expect(
      getClashSpeedtestState({
        gobin: root,
        platform: "darwin",
        arch: "arm64",
        now: () => new Date("2026-05-07T00:00:00.000Z"),
        readVersion: async () => "clash-speedtest version 0.1.2 (commit abc123)",
      }),
    ).resolves.toMatchObject({
      status: "error",
      version: "0.1.2",
      path: binaryPath,
      source: "go-install",
      message: "clash-speedtest 版本不匹配：需要 >= 0.1.3，当前是 0.1.2。请重新编译或安装对应版本。",
    });
  });
});
