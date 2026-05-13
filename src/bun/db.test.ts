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

  test("queries results for one run id", () => {
    const db = new LatencyDatabase();
    db.migrate();

    db.saveRun(makeRun("run-1", "2026-05-07T10:00:00.000Z"));
    db.saveRun(makeRun("run-2", "2026-05-07T10:05:00.000Z"));
    db.saveResults([
      makeResult("run-1", "hong-kong", "YouTube", "128ms"),
      makeResult("run-2", "hong-kong", "YouTube", "328ms"),
    ]);

    expect(db.queryResults({ runId: "run-2" })).toEqual([makeResult("run-2", "hong-kong", "YouTube", "328ms")]);

    db.close();
  });

  test("stores probe fields with each result row", () => {
    const db = new LatencyDatabase();
    db.migrate();

    db.saveRun(makeRun("run-1", "2026-05-07T10:00:00.000Z"));
    db.saveResults([
      {
        ...makeResult("run-1", "hong-kong", "YouTube", "128ms"),
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

    expect(db.queryResults({ runId: "run-1" })[0]).toMatchObject({
      probeUrl: "https://ipapi.co/json/",
      probeLatency: "82ms",
      probeStatus: "200",
      probeIp: "203.0.113.10",
      probeCountry: "Japan",
      probeCountryCode: "JP",
      probeAsn: "AS64500",
      probeOrg: "Example Transit",
    });

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
}
