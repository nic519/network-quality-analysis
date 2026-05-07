import { describe, expect, test } from "bun:test";
import { LatencyDatabase } from "./db";
import type { ResultRow, RunRecord } from "../shared/domain";

describe("LatencyDatabase", () => {
  test("stores runs and queries results by region and date", () => {
    const db = new LatencyDatabase();
    db.migrate();

    const run: RunRecord = {
      id: "run-1",
      startedAt: "2026-05-07T10:00:00.000Z",
      completedAt: "2026-05-07T10:01:00.000Z",
      status: "completed",
      selectedRegions: ["hong-kong"],
      errorMessage: null,
    };
    db.saveRun(run);
    db.saveResults([
      makeResult("run-1", "hong-kong", "YouTube", "128ms"),
      makeResult("run-1", "japan", "YouTube", "188ms"),
    ]);

    expect(db.listRuns()).toEqual([run]);
    expect(
      db.queryResults({
        regionIds: ["hong-kong"],
        fromDate: "2026-05-07T00:00:00.000Z",
        toDate: "2026-05-08T00:00:00.000Z",
      }),
    ).toEqual([makeResult("run-1", "hong-kong", "YouTube", "128ms")]);

    db.close();
  });

  test("stores recent config paths by latest successful run", () => {
    const db = new LatencyDatabase();
    db.migrate();

    db.saveConfigHistory("/Users/nicholas/configs/old.yaml", "2026-05-07T10:00:00.000Z");
    db.saveConfigHistory("/Users/nicholas/configs/current.yaml", "2026-05-07T10:01:00.000Z");
    db.saveConfigHistory("/Users/nicholas/configs/old.yaml", "2026-05-07T10:02:00.000Z");

    expect(db.listConfigHistory()).toEqual([
      {
        path: "/Users/nicholas/configs/old.yaml",
        lastUsedAt: "2026-05-07T10:02:00.000Z",
        useCount: 2,
      },
      {
        path: "/Users/nicholas/configs/current.yaml",
        lastUsedAt: "2026-05-07T10:01:00.000Z",
        useCount: 1,
      },
    ]);

    db.close();
  });
});

function makeResult(
  runId: string,
  regionId: "hong-kong" | "japan",
  siteName: string,
  latency: string,
): ResultRow {
  return {
    runId,
    regionId,
    regionLabel: regionId === "hong-kong" ? "香港" : "日本",
    siteId: siteName.toLowerCase(),
    siteName,
    siteUrl: `https://${siteName.toLowerCase()}.example.com`,
    sequence: "1.",
    proxyName: `${regionId}-01`,
    proxyId: `${regionId}-stable-id`,
    proxyType: "Trojan",
    latency,
    jitter: "N/A",
    packetLoss: "N/A",
    downloadSpeed: "N/A",
    uploadSpeed: "N/A",
  };
}
