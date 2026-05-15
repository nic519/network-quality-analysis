import { describe, expect, test } from "bun:test";
import { buildLatencyTrendModel } from "./latency-trends";
import type { ResultRow, RunRecord } from "../../../shared/domain";

describe("latency trends", () => {
  test("groups historical site latency by region and stable proxy id", () => {
    const runs: RunRecord[] = [
      makeRun("run-1", "2026-05-13T04:00:00.000Z"),
      makeRun("run-2", "2026-05-14T04:00:00.000Z"),
    ];
    const results: ResultRow[] = [
      makeResult({ runId: "run-1", proxyId: "hk-a", proxyName: "HK A", latency: "128ms" }),
      makeResult({ runId: "run-1", proxyId: "hk-b", proxyName: "HK B", latency: "N/A" }),
      makeResult({ runId: "run-2", proxyId: "hk-a", proxyName: "HK A", latency: "166ms" }),
      makeResult({ runId: "run-2", proxyId: "hk-b", proxyName: "HK B", latency: "210ms" }),
      makeResult({ runId: "run-2", regionId: "japan", regionLabel: "日本", proxyId: "jp-a", proxyName: "JP A", latency: "88ms" }),
      makeResult({ runId: "run-2", siteId: "github", siteName: "GitHub", proxyId: "hk-a", proxyName: "HK A", latency: "320ms" }),
    ];

    const model = buildLatencyTrendModel({
      results,
      runs,
      regionId: "hong-kong",
      siteId: "youtube",
      selectedProxyIds: ["hk-a", "hk-b"],
    });

    expect(model.proxyRows.map((row) => [row.proxyId, row.sampleCount, row.latestLatencyLabel])).toEqual([
      ["hk-a", 2, "166ms"],
      ["hk-b", 1, "210ms"],
    ]);
    expect(model.chartRows).toEqual([
      expect.objectContaining({ runId: "run-1", "proxy-0": 128, "proxy-1": null }),
      expect.objectContaining({ runId: "run-2", "proxy-0": 166, "proxy-1": 210 }),
    ]);
  });
});

function makeRun(id: string, startedAt: string): RunRecord {
  return {
    id,
    startedAt,
    completedAt: startedAt,
    status: "completed",
    selectedRegions: ["hong-kong"],
    errorMessage: null,
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
