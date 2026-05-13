import { describe, expect, test } from "bun:test";
import { DEFAULT_SITES, REGION_PRESETS, latencyStatus, latencyToMs, normalizeSiteDefinitions, parseTSVOutput } from "./domain";

describe("region presets", () => {
  test("exposes built-in location presets without user-authored filters", () => {
    expect(REGION_PRESETS.map((region) => region.id)).toEqual([
      "hong-kong",
      "singapore",
      "japan",
      "united-states",
      "taiwan",
    ]);
    expect(REGION_PRESETS.find((region) => region.id === "hong-kong")?.filterRegex).toContain("香港");
    expect(REGION_PRESETS.find((region) => region.id === "singapore")?.filterRegex).toContain("Singapore");
    expect(REGION_PRESETS.find((region) => region.id === "japan")?.filterRegex).toContain("Japan");
    expect(REGION_PRESETS.find((region) => region.id === "united-states")?.filterRegex).toContain("United States");
    expect(REGION_PRESETS.find((region) => region.id === "taiwan")?.filterRegex).toContain("Taiwan");
  });
});

describe("normalizeSiteDefinitions", () => {
  test("trims configured test sites and derives stable ids", () => {
    expect(
      normalizeSiteDefinitions([
        {
          id: "",
          name: "  OpenAI Status  ",
          url: " https://status.openai.com ",
          enabled: false,
        },
      ]),
    ).toEqual([
      {
        id: "openai-status",
        name: "OpenAI Status",
        url: "https://status.openai.com",
        enabled: false,
      },
    ]);
  });

  test("defaults legacy site entries to enabled", () => {
    expect(normalizeSiteDefinitions([{ id: "example", name: "Example", url: "https://example.com" }])).toEqual([
      {
        id: "example",
        name: "Example",
        url: "https://example.com",
        enabled: true,
      },
    ]);
  });

  test("falls back to default sites when no configured site is usable", () => {
    expect(normalizeSiteDefinitions([{ id: "", name: "Only name", url: "" }])).toEqual(DEFAULT_SITES);
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
        ...emptyProbeFields,
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
        ...emptyProbeFields,
      },
    ]);
  });

  test("parses stable proxy id when clash-speedtest provides it", () => {
    const raw = "序号\t节点名称\t类型\t延迟\t节点ID\n1.\tRenamed HK\tTrojan\t128ms\tabc123def4567890\n";

    expect(parseTSVOutput(raw)[0].proxyId).toBe("abc123def4567890");
  });

  test("parses probe columns by header name without moving the proxy id", () => {
    const raw = [
      "序号\t节点名称\t类型\t延迟\tProbe URL\tProbe 延迟\tProbe 状态\tProbe 错误\tprobe.ip\tprobe.country\tprobe.country_code\tprobe.region\tprobe.city\tprobe.asn\tprobe.org\t节点ID",
      "1.\tHK-01\tTrojan\t128ms\thttps://ipapi.co/json/\t82ms\t200\t\t203.0.113.10\tJapan\tJP\tTokyo\tTokyo\tAS64500\tExample Transit\tabc123def4567890",
      "",
    ].join("\n");

    expect(parseTSVOutput(raw)).toEqual([
      {
        sequence: "1.",
        proxyId: "abc123def4567890",
        proxyName: "HK-01",
        proxyType: "Trojan",
        latency: "128ms",
        jitter: "N/A",
        packetLoss: "N/A",
        downloadSpeed: "N/A",
        uploadSpeed: "N/A",
        probeUrl: "https://ipapi.co/json/",
        probeLatency: "82ms",
        probeStatus: "200",
        probeError: "",
        probeIp: "203.0.113.10",
        probeCountry: "Japan",
        probeCountryCode: "JP",
        probeRegion: "Tokyo",
        probeCity: "Tokyo",
        probeAsn: "AS64500",
        probeOrg: "Example Transit",
      },
    ]);
  });
});

const emptyProbeFields = {
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
};

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
