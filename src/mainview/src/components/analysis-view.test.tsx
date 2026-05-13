import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalysisView, buildProbeRows, buildProbeSummary } from "./analysis-view";
import type { AppState } from "../../../shared/rpc";
import { DEFAULT_PROBE_SETTINGS } from "../../../shared/probe-settings";
import { DEFAULT_SITES, REGION_PRESETS, type ResultRow } from "../../../shared/domain";

describe("AnalysisView", () => {
  test("does not render recommendation ranking cards in history view", () => {
    const html = renderToStaticMarkup(
      <AnalysisView
        state={makeState([
          makeResult({
            proxyId: "proxy-hk-02",
            proxyName: "HK-02",
            latency: "88ms",
          }),
          makeResult({
            proxyId: "proxy-hk-03",
            proxyName: "HK-03",
            latency: "108ms",
          }),
        ])}
        selectedRunId="run-1"
        onSelectedRunIdChange={() => {}}
        fromDate="2026-05-13"
        toDate="2026-05-13"
        onFromDateChange={() => {}}
        onToDateChange={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedSiteId="youtube"
        onSelectedSiteIdChange={() => {}}
        error={null}
        onCopyResults={() => {}}
      />,
    );

    expect(html).not.toContain("第 1 名");
    expect(html).not.toContain("第 2 名");
    expect(html).not.toContain("第 3 名");
  });

  test("prefers a successful probe result over an earlier probe error for the same proxy", () => {
    const rows: ResultRow[] = [
      makeResult({
        siteId: "youtube",
        siteName: "YouTube",
        latency: "128ms",
        probeError: "probe request failed: context deadline exceeded",
      }),
      makeResult({
        siteId: "github",
        siteName: "GitHub",
        latency: "140ms",
        probeIp: "203.0.113.88",
        probeStatus: "200",
        probeLatency: "420ms",
        probeCountryCode: "HK",
        probeCountry: "Hong Kong",
      }),
    ];

    const html = renderToStaticMarkup(
      <AnalysisView
        state={makeState(rows)}
        selectedRunId="run-1"
        onSelectedRunIdChange={() => {}}
        fromDate="2026-05-13"
        toDate="2026-05-13"
        onFromDateChange={() => {}}
        onToDateChange={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedSiteId="youtube"
        onSelectedSiteIdChange={() => {}}
        error={null}
        onCopyResults={() => {}}
      />,
    );

    expect(html).toContain("203.0.113.88");
    expect(html).toContain("200 / 420ms");
  });

  test("renders probe location and ASN content in grouped two-line blocks", () => {
    const html = renderToStaticMarkup(
      <AnalysisView
        state={makeState([
          makeResult({
            proxyId: "proxy-us-01",
            proxyName: "US-01",
            probeIp: "23.94.213.251",
            probeStatus: "200",
            probeLatency: "698ms",
            probeCountryCode: "US",
            probeCountry: "United States",
            probeRegion: "California",
            probeCity: "Los Angeles",
            probeAsn: "AS36352",
            probeOrg: "HostPapa",
          }),
        ])}
        selectedRunId="run-1"
        onSelectedRunIdChange={() => {}}
        fromDate="2026-05-13"
        toDate="2026-05-13"
        onFromDateChange={() => {}}
        onToDateChange={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedSiteId="youtube"
        onSelectedSiteIdChange={() => {}}
        error={null}
        onCopyResults={() => {}}
      />,
    );

    expect(html).toContain("US / United States");
    expect(html).toContain("California / Los Angeles");
    expect(html).toContain("AS36352");
    expect(html).toContain("HostPapa");
    expect(html).toContain('class="break-all text-sm leading-5 text-foreground"');
    expect(html).toContain('class="text-xs leading-4 text-muted-foreground"');
  });

  test("renders probe location below the IP instead of using a separate location column", () => {
    const html = renderToStaticMarkup(
      <AnalysisView
        state={makeState([
          makeResult({
            proxyId: "proxy-us-01",
            proxyName: "US-01",
            probeIp: "23.94.213.251",
            probeStatus: "200",
            probeLatency: "698ms",
            probeCountryCode: "US",
            probeCountry: "United States",
            probeRegion: "California",
            probeCity: "Los Angeles",
          }),
        ])}
        selectedRunId="run-1"
        onSelectedRunIdChange={() => {}}
        fromDate="2026-05-13"
        toDate="2026-05-13"
        onFromDateChange={() => {}}
        onToDateChange={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedSiteId="youtube"
        onSelectedSiteIdChange={() => {}}
        error={null}
        onCopyResults={() => {}}
      />,
    );

    expect(html).not.toContain(">地区</th>");
    expect(html).toContain("23.94.213.251");
    expect(html).toContain("US / United States");
    expect(html).toContain("California / Los Angeles");
  });

  test("renders every probe row without truncating the list", () => {
    const rows = Array.from({ length: 13 }, (_, index) =>
      makeResult({
        proxyId: `proxy-hk-${String(index + 1).padStart(2, "0")}`,
        proxyName: `HK-${String(index + 1).padStart(2, "0")}`,
        probeIp: `203.0.113.${index + 1}`,
        probeStatus: "200",
        probeLatency: `${100 + index}ms`,
      }),
    );

    const html = renderToStaticMarkup(
      <AnalysisView
        state={makeState(rows)}
        selectedRunId="run-1"
        onSelectedRunIdChange={() => {}}
        fromDate="2026-05-13"
        toDate="2026-05-13"
        onFromDateChange={() => {}}
        onToDateChange={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedSiteId="youtube"
        onSelectedSiteIdChange={() => {}}
        error={null}
        onCopyResults={() => {}}
      />,
    );

    expect(html).toContain("HK-01");
    expect(html).toContain("HK-13");
  });

  test("sorts probe rows by response time with unavailable latencies last", () => {
    const rows = buildProbeRows(
      [
        makeResult({
          proxyId: "proxy-slow",
          proxyName: "HK Slow",
          probeStatus: "200",
          probeLatency: "450ms",
        }),
        makeResult({
          proxyId: "proxy-missing",
          proxyName: "HK Missing",
          probeStatus: "200",
          probeLatency: "",
        }),
        makeResult({
          proxyId: "proxy-fast",
          proxyName: "HK Fast",
          probeStatus: "200",
          probeLatency: "82ms",
        }),
      ],
      "",
      "probe-latency",
    );

    expect(rows.map((row) => row.proxyName)).toEqual(["HK Fast", "HK Slow", "HK Missing"]);
  });

  test("keeps failed probe rows after successful rows when sorting by response time", () => {
    const rows = buildProbeRows(
      [
        makeResult({
          proxyId: "proxy-failed-fast",
          proxyName: "IPv6 Failed",
          latency: "N/A",
          probeLatency: "0ms",
          probeError:
            'probe request failed: Get "https://api.ip.sb/geoip/": [2401:b60:e0ce:20::1]:8080 connect error: dns resolve failed: ip version error',
        }),
        makeResult({
          proxyId: "proxy-success",
          proxyName: "HK Success",
          probeIp: "203.0.113.10",
          probeStatus: "200",
          probeLatency: "120ms",
        }),
      ],
      "",
      "probe-latency",
    );

    expect(rows.map((row) => row.proxyName)).toEqual(["HK Success", "IPv6 Failed"]);
  });

  test("summarizes effective nodes and unique probe IPs from grouped results", () => {
    const rows = [
      makeResult({ proxyId: "rice-01", proxyName: "🍚-🇹🇼 [Any]TW 01", latency: "400ms", probeIp: "118.167.221.153" }),
      makeResult({ proxyId: "rice-02", proxyName: "🍚-🇹🇼 [三网]TW 02", latency: "665ms", probeIp: "118.167.221.153" }),
      makeResult({ proxyId: "bird-01", proxyName: "🐦-hy2台湾01", latency: "359ms", probeIp: "36.231.118.136" }),
      makeResult({ proxyId: "bird-03", proxyName: "🐦-hy2台湾03", latency: "669ms", probeIp: "111.249.72.199" }),
      makeResult({ proxyId: "bird-04", proxyName: "🐦-hy2台湾04", latency: "379ms", probeIp: "36.231.97.220" }),
      makeResult({ proxyId: "bird-05", proxyName: "🐦-hy2台湾05", latency: "N/A", probeError: "timeout" }),
      makeResult({ proxyId: "bird-07", proxyName: "🐦-hy2台湾07", latency: "144ms", probeIp: "111.250.118.214" }),
      makeResult({ proxyId: "bird-trojan-03", proxyName: "🐦-trojan台湾03", latency: "N/A", probeError: "connect refused" }),
      makeResult({ proxyId: "bird-vless-01", proxyName: "🐦-vless台湾01", latency: "133ms", probeError: "context deadline exceeded" }),
      makeResult({ proxyId: "bird-vless-02", proxyName: "🐦-vless台湾02", latency: "N/A", probeError: "context deadline exceeded" }),
      makeResult({ proxyId: "bird-vless-03", proxyName: "🐦-vless台湾03", latency: "956ms", probeIp: "36.231.105.13" }),
      makeResult({ proxyId: "heart-01", proxyName: "💗-🇨🇳台湾专线01|BGP|流媒体", latency: "653ms", probeIp: "2406:da1c:80f6:b00:ac4b:319d:d098:bc83" }),
      makeResult({ proxyId: "heart-02", proxyName: "💗-🇨🇳台湾高速01|BGP|流媒体", latency: "368ms", probeIp: "2406:da1c:80f6:b00:ac4b:319d:d098:bc83" }),
    ];

    const summary = buildProbeSummary(rows, "");

    expect(summary.totalNodes).toBe(13);
    expect(summary.effectiveNodes).toBe(10);
    expect(summary.effectiveNodesWithIp).toBe(9);
    expect(summary.uniqueEffectiveIps).toBe(7);
    expect(summary.effectiveNodesMissingIp).toBe(1);
  });

  test("renders unique probe IPs as a ratio against effective nodes with IP", () => {
    const html = renderToStaticMarkup(
      <AnalysisView
        state={makeState([
          makeResult({ proxyId: "rice-01", proxyName: "🍚-🇹🇼 [Any]TW 01", latency: "400ms", probeIp: "118.167.221.153" }),
          makeResult({ proxyId: "plain-01", proxyName: "TW 01", latency: "665ms", probeIp: "118.167.221.153" }),
          makeResult({ proxyId: "bird-01", proxyName: "🐦-hy2台湾01", latency: "359ms", probeIp: "36.231.118.136" }),
        ])}
        selectedRunId="run-1"
        onSelectedRunIdChange={() => {}}
        fromDate="2026-05-13"
        toDate="2026-05-13"
        onFromDateChange={() => {}}
        onToDateChange={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedSiteId="youtube"
        onSelectedSiteIdChange={() => {}}
        error={null}
        onCopyResults={() => {}}
      />,
    );

    expect(html).toContain("独立出口 IP");
    expect(html).toContain('title="2/3"');
  });

  test("shows only supplier comparison when every node has a supplier prefix", () => {
    const html = renderToStaticMarkup(
      <AnalysisView
        state={makeState([
          makeResult({ proxyId: "rice-01", proxyName: "🍚-🇹🇼 [Any]TW 01", latency: "400ms", probeIp: "118.167.221.153" }),
          makeResult({ proxyId: "rice-02", proxyName: "🍚-🇹🇼 [三网]TW 02", latency: "665ms", probeIp: "118.167.221.153" }),
          makeResult({ proxyId: "bird-01", proxyName: "🐦-hy2台湾01", latency: "359ms", probeIp: "36.231.118.136" }),
        ])}
        selectedRunId="run-1"
        onSelectedRunIdChange={() => {}}
        fromDate="2026-05-13"
        toDate="2026-05-13"
        onFromDateChange={() => {}}
        onToDateChange={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedSiteId="youtube"
        onSelectedSiteIdChange={() => {}}
        error={null}
        onCopyResults={() => {}}
      />,
    );

    expect(html).toContain("供应商前缀");
    expect(html).not.toContain("延迟可解析的节点数");
    expect(html).not.toContain("独立 IP / 有 IP 的有效节点");
    expect(html).toContain(">1/2<");
    expect(html).toContain(">1/1<");
  });

  test("shows only node summary cards when the node list is not fully prefixed", () => {
    const html = renderToStaticMarkup(
      <AnalysisView
        state={makeState([
          makeResult({ proxyId: "rice-01", proxyName: "🍚-🇹🇼 [Any]TW 01", latency: "400ms", probeIp: "118.167.221.153" }),
          makeResult({ proxyId: "plain-01", proxyName: "TW 01", latency: "665ms", probeIp: "118.167.221.153" }),
          makeResult({ proxyId: "bird-01", proxyName: "🐦-hy2台湾01", latency: "359ms", probeIp: "36.231.118.136" }),
        ])}
        selectedRunId="run-1"
        onSelectedRunIdChange={() => {}}
        fromDate="2026-05-13"
        toDate="2026-05-13"
        onFromDateChange={() => {}}
        onToDateChange={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedSiteId="youtube"
        onSelectedSiteIdChange={() => {}}
        error={null}
        onCopyResults={() => {}}
      />,
    );

    expect(html).not.toContain("供应商前缀");
    expect(html).toContain("延迟可解析的节点数");
    expect(html).toContain("独立 IP / 有 IP 的有效节点");
  });

  test("groups probe summary by supplier prefix when proxy names use prefix separators", () => {
    const summary = buildProbeSummary(
      [
        makeResult({ proxyId: "rice-01", proxyName: "🍚-🇹🇼 [Any]TW 01", latency: "400ms", probeIp: "118.167.221.153" }),
        makeResult({ proxyId: "rice-02", proxyName: "🍚-🇹🇼 [三网]TW 02", latency: "665ms", probeIp: "118.167.221.153" }),
        makeResult({ proxyId: "bird-01", proxyName: "🐦-hy2台湾01", latency: "359ms", probeIp: "36.231.118.136" }),
        makeResult({ proxyId: "bird-vless-01", proxyName: "🐦-vless台湾01", latency: "133ms", probeError: "context deadline exceeded" }),
        makeResult({ proxyId: "heart-01", proxyName: "💗-🇨🇳台湾专线01|BGP|流媒体", latency: "653ms", probeIp: "2406:da1c:80f6:b00:ac4b:319d:d098:bc83" }),
        makeResult({ proxyId: "heart-02", proxyName: "💗-🇨🇳台湾高速01|BGP|流媒体", latency: "368ms", probeIp: "2406:da1c:80f6:b00:ac4b:319d:d098:bc83" }),
      ],
      "",
    );

    expect(summary.supplierRows).toEqual([
      expect.objectContaining({ supplier: "🍚", totalNodes: 2, effectiveNodes: 2, uniqueEffectiveIps: 1 }),
      expect.objectContaining({ supplier: "🐦", totalNodes: 2, effectiveNodes: 2, uniqueEffectiveIps: 1, effectiveNodesMissingIp: 1 }),
      expect.objectContaining({ supplier: "💗", totalNodes: 2, effectiveNodes: 2, uniqueEffectiveIps: 1 }),
    ]);
  });
});

function makeState(results: ResultRow[]): AppState {
  return {
    regions: REGION_PRESETS,
    sites: DEFAULT_SITES,
    probeSettings: DEFAULT_PROBE_SETTINGS,
    runs: [
      {
        id: "run-1",
        startedAt: "2026-05-13T04:00:00.000Z",
        completedAt: "2026-05-13T04:01:00.000Z",
        status: "completed",
        selectedRegions: ["hong-kong"],
        errorMessage: null,
      },
    ],
    results,
    configHistory: [],
    clashSpeedtest: {
      status: "ready",
      version: "0.1.3",
      path: "/Users/nicholas/go/bin/clash-speedtest",
      source: "go-install",
      message: "",
      checkedAt: "2026-05-13T04:00:00.000Z",
    },
  };
}

function makeResult(patch: Partial<ResultRow>): ResultRow {
  return {
    runId: "run-1",
    regionId: "hong-kong",
    regionLabel: "香港",
    siteId: "youtube",
    siteName: "YouTube",
    siteUrl: "https://www.youtube.com/generate_204",
    sequence: "1.",
    proxyId: "proxy-hk-01",
    proxyName: "HK-01",
    proxyType: "Trojan",
    latency: "128ms",
    jitter: "N/A",
    packetLoss: "N/A",
    downloadSpeed: "N/A",
    uploadSpeed: "N/A",
    probeUrl: "https://api.ip.sb/geoip/",
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
    ...patch,
  };
}
