import { describe, expect, test } from "bun:test";
import { REGION_PRESETS, type ResultRow, type RunRecord } from "../../../shared/domain";
import { formatRunRegionLabels } from "./run-region-label";

describe("formatRunRegionLabels", () => {
  test("uses labels from loaded results when present", () => {
    expect(
      formatRunRegionLabels({
        run: makeRun(["hong-kong"]),
        results: [makeResult("run-1", "香港")],
        regions: REGION_PRESETS,
      }),
    ).toBe("香港");
  });

  test("maps selected region ids to labels when results are not loaded", () => {
    expect(
      formatRunRegionLabels({
        run: makeRun(["hong-kong", "japan"]),
        results: [],
        regions: REGION_PRESETS,
      }),
    ).toBe("香港 / 日本");
  });
});

function makeRun(selectedRegions: string[]): RunRecord {
  return {
    id: "run-1",
    startedAt: "2026-05-08T10:00:00.000Z",
    completedAt: "2026-05-08T10:01:00.000Z",
    status: "completed",
    selectedRegions,
    errorMessage: null,
  };
}

function makeResult(runId: string, regionLabel: string): ResultRow {
  return {
    runId,
    regionId: "hong-kong",
    regionLabel,
    siteId: "youtube",
    siteName: "YouTube",
    siteUrl: "https://youtube.example.com",
    sequence: "1.",
    proxyId: "proxy-1",
    proxyName: "proxy 1",
    proxyType: "Trojan",
    latency: "120ms",
    jitter: "N/A",
    packetLoss: "N/A",
    downloadSpeed: "N/A",
    uploadSpeed: "N/A",
  };
}
