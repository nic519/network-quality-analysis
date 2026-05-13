import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalysisView } from "./analysis-view";
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
    expect(html).toContain('class="text-sm leading-5 text-muted-foreground"');
    expect(html).toContain('class="text-xs leading-4 text-muted-foreground"');
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
