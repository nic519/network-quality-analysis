import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { REGION_PRESETS, type SiteDefinition } from "../shared/domain";
import {
  buildSpeedtestArgs,
  executeSpeedtest,
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
  test("uses fast mode, the site's latency URL, and a short proxy timeout", () => {
    expect(buildSpeedtestArgs("config.yaml", REGION_PRESETS[0], site)).toEqual([
      "-c",
      "config.yaml",
      "-f",
      REGION_PRESETS[0].filterRegex,
      "--speed-mode",
      "fast",
      "--latency-url",
      "https://www.youtube.com/generate_204",
      "-timeout",
      "8s",
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

  test("creates one completed run per selected region", async () => {
    const root = join(tmpdir(), `latency-runner-regions-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    const configPath = join(root, "config.yaml");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    writeFileSync(configPath, "");

    const output = await runLatencyTest(
      {
        configPath,
        regionIds: ["hong-kong", "japan"],
      },
      {
        binaryPath,
        sites: [site],
        now: () => new Date("2026-05-07T10:00:00.000Z"),
        execute: async (_binary, args) => {
          const filterIndex = args.indexOf("-f");
          const filterRegex = args[filterIndex + 1];
          const proxyName = filterRegex === REGION_PRESETS[0].filterRegex ? "HK-01" : "JP-01";
          return `序号\t节点名称\t类型\t延迟\n1.\t${proxyName}\tTrojan\t128ms\n`;
        },
      },
    );

    expect(output.runs.map((run) => run.selectedRegions)).toEqual([["hong-kong"], ["japan"]]);
    expect(output.runs.every((run) => run.status === "completed")).toBe(true);
    expect(output.runs.map((run) => run.id)).toEqual([
      "run-20260507T100000Z-hong-kong",
      "run-20260507T100000Z-japan",
    ]);
    expect(output.results.map((row) => [row.runId, row.regionId, row.proxyName])).toEqual([
      ["run-20260507T100000Z-hong-kong", "hong-kong", "HK-01"],
      ["run-20260507T100000Z-japan", "japan", "JP-01"],
    ]);
  });

  test("resolves clash-speedtest from a go install location when no binary path is provided", async () => {
    const root = join(tmpdir(), `latency-runner-gobin-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    const configPath = join(root, "config.yaml");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    chmodSync(binaryPath, 0o755);
    writeFileSync(configPath, "");
    const binaries: string[] = [];

    await runLatencyTest(
      {
        configPath,
        regionIds: ["hong-kong"],
      },
      {
        binaryResolverOptions: {
          gobin: root,
          platform: "darwin",
          arch: "arm64",
        },
        sites: [site],
        execute: async (binary) => {
          binaries.push(binary);
          return "序号\t节点ID\t节点名称\t类型\t延迟\n1.\tproxy-1\tHK-01\tTrojan\t128ms\n";
        },
      },
    );

    expect(binaries).toEqual([binaryPath]);
  });

  test("reports each command before executing it", async () => {
    const root = join(tmpdir(), `latency-runner-progress-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    const configPath = join(root, "config.yaml");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    writeFileSync(configPath, "");
    const messages: string[] = [];

    await runLatencyTest(
      {
        configPath,
        regionIds: ["hong-kong"],
      },
      {
        binaryPath,
        sites: [site],
        onProgress: (message) => messages.push(message),
        execute: async () => "序号\t节点ID\t节点名称\t类型\t延迟\n1.\tproxy-1\tHK-01\tTrojan\t128ms\n",
      },
    );

    expect(messages).toContain("测试 香港 -> YouTube");
    expect(messages.some((message) => message.includes("clash-speedtest -c") && message.includes("-timeout 8s"))).toBe(
      true,
    );
  });

  test("streams clash-speedtest output into progress messages", async () => {
    const root = join(tmpdir(), `latency-runner-stream-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    mkdirSync(root, { recursive: true });
    writeFileSync(
      binaryPath,
      "#!/bin/sh\nprintf 'loading proxies\\n' >&2\nprintf '序号\\t节点名称\\t类型\\t延迟\\n1.\\tHK-01\\tTrojan\\t128ms\\n'\n",
    );
    chmodSync(binaryPath, 0o755);
    const messages: string[] = [];

    const output = await executeSpeedtest(binaryPath, [], { onProgress: (message) => messages.push(message) });

    expect(output).toContain("HK-01");
    expect(messages).toContain("[clash-speedtest] loading proxies");
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

  test("rejects archive files selected as clash-speedtest binaries", () => {
    expect(() =>
      validateRunnableInputs("/Users/nicholas/Downloads/clash-speedtest_Darwin_arm64.tar.gz", import.meta.path),
    ).toThrow("请选择解压后的 clash-speedtest 可执行文件，不要直接选择压缩包");
  });

  test("accepts pasted config paths with surrounding whitespace", () => {
    expect(() => validateRunnableInputs(import.meta.path, `  ${import.meta.path}  `)).not.toThrow();
  });
});
