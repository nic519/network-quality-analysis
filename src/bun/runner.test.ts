import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { REGION_PRESETS, type SiteDefinition } from "../shared/domain";
import {
  buildSpeedtestArgs,
  normalizeSpeedtestRows,
  resolveBundledBinaryPathFrom,
  runLatencyTest,
  validateRunnableInputs,
} from "./runner";

const site: SiteDefinition = {
  id: "youtube",
  name: "YouTube",
  url: "https://www.youtube.com/generate_204",
};

describe("buildSpeedtestArgs", () => {
  test("uses fast mode and the site's latency URL", () => {
    expect(buildSpeedtestArgs("config.yaml", REGION_PRESETS[0], site)).toEqual([
      "-c",
      "config.yaml",
      "-f",
      REGION_PRESETS[0].filterRegex,
      "--speed-mode",
      "fast",
      "--latency-url",
      "https://www.youtube.com/generate_204",
    ]);
  });
});

describe("normalizeSpeedtestRows", () => {
  test("attaches run, region, and site metadata to parsed TSV rows", () => {
    expect(
      normalizeSpeedtestRows("序号\t节点名称\t类型\t延迟\n1.\tHK-01\tTrojan\t128ms\n", "run-1", REGION_PRESETS[0], site),
    ).toEqual([
      {
        runId: "run-1",
        regionId: "hong-kong",
        regionLabel: "香港",
        siteId: "youtube",
        siteName: "YouTube",
        siteUrl: "https://www.youtube.com/generate_204",
        sequence: "1.",
        proxyId: "legacy-18f5e961",
        proxyName: "HK-01",
        proxyType: "Trojan",
        latency: "128ms",
        jitter: "N/A",
        packetLoss: "N/A",
        downloadSpeed: "N/A",
        uploadSpeed: "N/A",
      },
    ]);
  });
});

describe("runLatencyTest", () => {
  test("runs each selected region against each site", async () => {
    const root = join(tmpdir(), `latency-runner-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    const configPath = join(root, "config.yaml");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    writeFileSync(configPath, "");
    const calls: string[][] = [];
    const output = await runLatencyTest(
      {
        configPath,
        regionIds: ["hong-kong"],
      },
      {
        binaryPath,
        sites: [site],
        now: () => new Date("2026-05-07T10:00:00.000Z"),
        execute: async (_binary, args) => {
          calls.push(args);
          return "序号\t节点名称\t类型\t延迟\n1.\tHK-01\tTrojan\t128ms\n";
        },
      },
    );

    expect(calls).toEqual([buildSpeedtestArgs(configPath, REGION_PRESETS[0], site)]);
    expect(output.run.status).toBe("completed");
    expect(output.results).toHaveLength(1);
  });
});

describe("resolveBundledBinaryPathFrom", () => {
  test("resolves Electrobun macOS app resource path from Contents/MacOS cwd", () => {
    const root = join(tmpdir(), `latency-compass-${Date.now()}`);
    const cwd = join(root, "Latency Compass-dev.app/Contents/MacOS");
    const resourceBinary = join(root, "Latency Compass-dev.app/Contents/Resources/app/resources/bin/clash-speedtest");
    mkdirSync(dirname(resourceBinary), { recursive: true });
    writeFileSync(resourceBinary, "");

    const resolved = resolveBundledBinaryPathFrom(cwd, "/tmp/source/src/bun");

    expect(resolved).toBe(resourceBinary);
  });
});

describe("validateRunnableInputs", () => {
  test("reports missing config paths before spawning clash-speedtest", () => {
    expect(() => validateRunnableInputs(import.meta.path, "/path/that/does/not/exist.yaml")).toThrow(
      "找不到 Clash/Mihomo 配置文件",
    );
  });
});
