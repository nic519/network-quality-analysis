import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

  test("deletes one run with its results and prunes orphan probe cache", () => {
    const db = new LatencyDatabase();
    db.migrate();

    db.saveRun(makeRun("run-1", "2026-05-07T10:00:00.000Z"));
    db.saveRun(makeRun("run-2", "2026-05-07T10:05:00.000Z"));
    db.saveResults([
      {
        ...makeResult("run-1", "hong-kong", "YouTube", "128ms"),
        probeIp: "203.0.113.10",
        probeStatus: "200",
      },
      {
        ...makeResult("run-2", "japan", "YouTube", "188ms"),
        probeIp: "203.0.113.11",
        probeStatus: "200",
      },
    ]);

    expect(db.deleteRun("run-1")).toBe(true);

    expect(db.listRuns().map((run) => run.id)).toEqual(["run-2"]);
    expect(db.queryResults().map((row) => row.runId)).toEqual(["run-2"]);
    expect(db.listCachedProbeProxyIds()).toEqual(["japan-stable-id"]);
    expect(db.deleteRun("missing-run")).toBe(false);

    db.close();
  });

  test("stores probe fields in a proxy keyed table and joins them into query results", () => {
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
    expect(db.listCachedProbeProxyIds()).toEqual(["hong-kong-stable-id"]);

    db.close();
  });

  test("keeps probe columns out of newly created results table", () => {
    const db = new LatencyDatabase();
    db.migrate();

    expect(db.listResultColumnNames()).not.toContain("probe_ip");
    expect(db.listResultColumnNames()).not.toContain("probe_url");

    db.close();
  });

  test("migrates legacy probe columns into proxy keyed records and removes them from results", () => {
    const path = join(tmpdir(), `latency-legacy-probe-${Date.now()}.sqlite`);
    const raw = new Database(path, { create: true });
    raw.exec(`
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        selected_regions TEXT NOT NULL,
        error_message TEXT
      );
      CREATE TABLE results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        region_id TEXT NOT NULL,
        region_label TEXT NOT NULL,
        site_id TEXT NOT NULL,
        site_name TEXT NOT NULL,
        site_url TEXT NOT NULL,
        sequence TEXT NOT NULL,
        proxy_id TEXT NOT NULL DEFAULT '',
        proxy_name TEXT NOT NULL,
        proxy_type TEXT NOT NULL,
        latency TEXT NOT NULL,
        jitter TEXT NOT NULL,
        packet_loss TEXT NOT NULL,
        download_speed TEXT NOT NULL,
        upload_speed TEXT NOT NULL,
        probe_url TEXT NOT NULL DEFAULT '',
        probe_latency TEXT NOT NULL DEFAULT '',
        probe_status TEXT NOT NULL DEFAULT '',
        probe_error TEXT NOT NULL DEFAULT '',
        probe_ip TEXT NOT NULL DEFAULT '',
        probe_country TEXT NOT NULL DEFAULT '',
        probe_country_code TEXT NOT NULL DEFAULT '',
        probe_region TEXT NOT NULL DEFAULT '',
        probe_city TEXT NOT NULL DEFAULT '',
        probe_asn TEXT NOT NULL DEFAULT '',
        probe_org TEXT NOT NULL DEFAULT ''
      );
      INSERT INTO runs VALUES ('run-1', '2026-05-07T10:00:00.000Z', '2026-05-07T10:01:00.000Z', 'completed', '["hong-kong"]', NULL);
      INSERT INTO results (
        run_id, region_id, region_label, site_id, site_name, site_url, sequence, proxy_id, proxy_name, proxy_type,
        latency, jitter, packet_loss, download_speed, upload_speed, probe_url, probe_latency, probe_status, probe_error,
        probe_ip, probe_country, probe_country_code, probe_region, probe_city, probe_asn, probe_org
      ) VALUES (
        'run-1', 'hong-kong', '香港', 'youtube', 'YouTube', 'https://www.youtube.com/generate_204', '1.', 'legacy-proxy-id', 'HK-01', 'Trojan',
        '128ms', 'N/A', '0.0%', 'N/A', 'N/A', 'https://ipapi.co/json/', '82ms', '200', '',
        '203.0.113.10', 'Japan', 'JP', 'Tokyo', 'Tokyo', 'AS64500', 'Example Transit'
      );
    `);
    raw.close();

    const db = new LatencyDatabase(path);
    db.migrate();

    expect(db.listResultColumnNames()).not.toContain("probe_ip");
    expect(db.queryResults({ runId: "run-1" })[0]).toMatchObject({
      proxyId: "legacy-proxy-id",
      probeIp: "203.0.113.10",
      probeCountryCode: "JP",
      probeOrg: "Example Transit",
    });
    expect(db.listCachedProbeProxyIds()).toEqual(["legacy-proxy-id"]);

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

  test("counts historical total and failed results by proxy id", () => {
    const db = new LatencyDatabase();
    db.migrate();

    db.saveRun(makeRun("run-1", "2026-05-07T10:00:00.000Z"));
    db.saveRun(makeRun("run-2", "2026-05-07T10:05:00.000Z"));
    db.saveResults([
      makeResult("run-1", "hong-kong", "YouTube", "128ms"),
      makeResult("run-1", "hong-kong", "GitHub", "N/A"),
      makeResult("run-2", "hong-kong", "YouTube", "188ms"),
      makeResult("run-2", "hong-kong", "GitHub", "N/A"),
      {
        ...makeResult("run-2", "hong-kong", "X", "timeout"),
        proxyId: "hong-kong-alt-id",
      },
    ]);

    expect(db.queryProxyHistoryStats(["hong-kong-stable-id", "hong-kong-alt-id", "missing-id"])).toEqual({
      "hong-kong-stable-id": {
        totalCount: 4,
        failedCount: 2,
      },
      "hong-kong-alt-id": {
        totalCount: 1,
        failedCount: 1,
      },
    });

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
