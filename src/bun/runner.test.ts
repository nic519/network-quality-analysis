import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { REGION_PRESETS, type SiteDefinition } from "../shared/domain";
import { DEFAULT_PROBE_SETTINGS } from "../shared/probe-settings";
import {
  buildSpeedtestArgs,
  executeSpeedtest,
  normalizeSpeedtestRows,
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
    const args = buildSpeedtestArgs("config.yaml", REGION_PRESETS[0], site);

    expect(args).toEqual(
      expect.arrayContaining([
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
        "--latency-timeout",
        "8s",
        "--probe-url",
        DEFAULT_PROBE_SETTINGS.url,
        "--probe-method",
        "GET",
        "--probe-fields",
        DEFAULT_PROBE_SETTINGS.fields,
      ]),
    );
    expect(args).toContain("--probe-timeout");
    expect(args[args.indexOf("--probe-timeout") + 1]).toBe(DEFAULT_PROBE_SETTINGS.timeout);
  });

  test("uses configured probe settings when building args", () => {
    expect(
      buildSpeedtestArgs("config.yaml", REGION_PRESETS[0], site, {
        enabled: true,
        url: "https://example.com/probe",
        fields: "ip=query,country=country",
        timeout: "12s",
      }),
    ).toContain("https://example.com/probe");
    expect(buildSpeedtestArgs("config.yaml", REGION_PRESETS[0], site, { enabled: true, url: "https://example.com/probe", fields: "ip=query", timeout: "12s" })).toEqual(
      expect.arrayContaining(["--probe-timeout", "12s", "--probe-fields", "ip=query"]),
    );
  });

  test("omits probe flags when probe is disabled", () => {
    const args = buildSpeedtestArgs("config.yaml", REGION_PRESETS[0], site, {
      enabled: false,
      url: "https://example.com/probe",
      fields: "ip=query",
      timeout: "12s",
    });

    expect(args).toContain("--latency-timeout");
    expect(args).not.toContain("--probe-url");
    expect(args).not.toContain("https://example.com/probe");
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
        probeUrl: "",
        probeLatency: "",
        probeStatus: "",
        probeError: "",
        probeIp: "",
        probeCountry: "",
        probeCountryCode: "",
        probeRegion: "",
        probeCity: "",
        probeAsn: "",
        probeOrg: "",
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
        probeSettings: {
          enabled: true,
          url: "https://example.com/probe",
          fields: "ip=query",
          timeout: "12s",
        },
        now: () => new Date("2026-05-07T10:00:00.000Z"),
        execute: async (_binary, args) => {
          calls.push(args);
          return "序号\t节点名称\t类型\t延迟\n1.\tHK-01\tTrojan\t128ms\n";
        },
      },
    );

    expect(calls).toEqual([
      buildSpeedtestArgs(configPath, REGION_PRESETS[0], site, {
        enabled: true,
        url: "https://example.com/probe",
        fields: "ip=query",
        timeout: "12s",
      }),
    ]);
    expect(calls[0]).toContain("--probe-url");
    expect(calls[0]).toContain("https://example.com/probe");
    expect(output.run.status).toBe("completed");
    expect(output.results).toHaveLength(1);
  });

  test("runs probe only on the first enabled site for each region", async () => {
    const root = join(tmpdir(), `latency-runner-probe-once-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    const configPath = join(root, "config.yaml");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    writeFileSync(configPath, "");
    const githubSite = { id: "github", name: "GitHub", url: "https://github.com", enabled: true };
    const calls: string[][] = [];

    await runLatencyTest(
      {
        configPath,
        regionIds: ["hong-kong"],
      },
      {
        binaryPath,
        sites: [site, githubSite],
        execute: async (_binary, args) => {
          calls.push(args);
          return "序号\t节点名称\t类型\t延迟\n1.\tHK-01\tTrojan\t128ms\n";
        },
      },
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("--probe-url");
    expect(calls[1]).not.toContain("--probe-url");
    expect(calls[1]).toContain("--latency-timeout");
  });

  test("skips disabled configured sites", async () => {
    const root = join(tmpdir(), `latency-runner-disabled-sites-${Date.now()}`);
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
        sites: [
          { ...site, enabled: false },
          { id: "github", name: "GitHub", url: "https://github.com", enabled: true },
        ],
        now: () => new Date("2026-05-07T10:00:00.000Z"),
        execute: async (_binary, args) => {
          calls.push(args);
          return "序号\t节点名称\t类型\t延迟\n1.\tHK-01\tTrojan\t128ms\n";
        },
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("https://github.com");
    expect(output.results.map((row) => row.siteName)).toEqual(["GitHub"]);
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

  test("retries without probe flags when the installed clash-speedtest is older", async () => {
    const root = join(tmpdir(), `latency-runner-old-probe-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    const configPath = join(root, "config.yaml");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");
    writeFileSync(configPath, "");
    const calls: string[][] = [];

    await runLatencyTest(
      {
        configPath,
        regionIds: ["hong-kong"],
      },
      {
        binaryPath,
        sites: [site],
        execute: async (_binary, args) => {
          calls.push(args);
          if (args.includes("--probe-url")) {
            throw new Error("clash-speedtest exited with 2: flag provided but not defined: -probe-url");
          }
          return "序号\t节点名称\t类型\t延迟\n1.\tHK-01\tTrojan\t128ms\n";
        },
      },
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("--probe-url");
    expect(calls[1]).not.toContain("--probe-url");
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
