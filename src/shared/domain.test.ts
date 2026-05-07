import { describe, expect, test } from "bun:test";
import { REGION_PRESETS, latencyStatus, latencyToMs, parseTSVOutput } from "./domain";

describe("region presets", () => {
  test("exposes Hong Kong and Japan without user-authored filters", () => {
    expect(REGION_PRESETS.map((region) => region.id)).toEqual(["hong-kong", "japan"]);
    expect(REGION_PRESETS[0].filterRegex).toContain("香港");
    expect(REGION_PRESETS[1].filterRegex).toContain("Japan");
  });
});

describe("parseTSVOutput", () => {
  test("parses fast-mode clash-speedtest rows", () => {
    const raw = [
      "序号\t节点名称\t类型\t延迟",
      "1.\tHK-01\tTrojan\t128ms",
      "2.\tHK-02\tVmess\tN/A",
      "",
    ].join("\n");

    expect(parseTSVOutput(raw)).toEqual([
      {
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
      {
        sequence: "2.",
        proxyId: "legacy-48196e0a",
        proxyName: "HK-02",
        proxyType: "Vmess",
        latency: "N/A",
        jitter: "N/A",
        packetLoss: "N/A",
        downloadSpeed: "N/A",
        uploadSpeed: "N/A",
      },
    ]);
  });

  test("parses stable proxy id when clash-speedtest provides it", () => {
    const raw = "序号\t节点名称\t类型\t延迟\t节点ID\n1.\tRenamed HK\tTrojan\t128ms\tabc123def4567890\n";

    expect(parseTSVOutput(raw)[0].proxyId).toBe("abc123def4567890");
  });
});

describe("latency status", () => {
  test("maps latency values into visual buckets", () => {
    expect(latencyStatus("128ms")).toBe("fast");
    expect(latencyStatus("410ms")).toBe("usable");
    expect(latencyStatus("1.2s")).toBe("slow");
    expect(latencyStatus("N/A")).toBe("failed");
    expect(latencyStatus("???")).toBe("missing");
  });

  test("converts seconds and milliseconds to ms", () => {
    expect(latencyToMs("1.5s")).toBe(1500);
    expect(latencyToMs("240ms")).toBe(240);
  });
});
