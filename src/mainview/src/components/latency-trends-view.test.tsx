import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LatencyTrendsView } from "./latency-trends-view";
import { DEFAULT_PROBE_SETTINGS } from "../../../shared/probe-settings";
import { DEFAULT_SITES, REGION_PRESETS, type ResultRow } from "../../../shared/domain";
import type { AppState } from "../../../shared/rpc";

describe("LatencyTrendsView", () => {
  test("renders selected node names beside the chart and a quick clear button", () => {
    const html = renderToStaticMarkup(
      <LatencyTrendsView
        state={makeState([
          makeResult({ runId: "run-1", proxyId: "hk-a", proxyName: "HK A", latency: "128ms" }),
          makeResult({ runId: "run-2", proxyId: "hk-a", proxyName: "HK A", latency: "166ms" }),
          makeResult({ runId: "run-2", proxyId: "hk-b", proxyName: "HK B", latency: "210ms" }),
        ])}
        selectedRegionId="hong-kong"
        onSelectedRegionIdChange={() => {}}
        selectedSiteId="youtube"
        onSelectedSiteIdChange={() => {}}
      />,
    );

    expect(html).toContain("取消选择");
    expect(html).toContain("图表节点");
    expect(html).toContain('data-chart-node-label="hk-a"');
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
      {
        id: "run-2",
        startedAt: "2026-05-14T04:00:00.000Z",
        completedAt: "2026-05-14T04:01:00.000Z",
        status: "completed",
        selectedRegions: ["hong-kong"],
        errorMessage: null,
      },
    ],
    results,
    proxyHistoryStats: {},
    configHistory: [],
    clashSpeedtest: {
      status: "ready",
      version: "1.0.0",
      path: "/tmp/clash-speedtest",
      source: "manual",
      message: "",
      checkedAt: "2026-05-15T00:00:00.000Z",
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
    proxyId: "hk-a",
    proxyName: "HK A",
    proxyType: "Trojan",
    latency: "128ms",
    jitter: "N/A",
    packetLoss: "N/A",
    downloadSpeed: "N/A",
    uploadSpeed: "N/A",
    ...patch,
  };
}
