import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCsvExport } from "./csv";
import { writeCsvExport } from "./csv";
import type { ResultRow } from "../shared/domain";

describe("buildCsvExport", () => {
  test("exports only proxy-site summary rows", () => {
    const exportData = buildCsvExport([
      makeResult("YouTube", "128ms"),
      makeResult("GitHub", "188ms"),
    ]);

    expect(exportData).not.toHaveProperty("details");
    expect(exportData.summary).toBe(
      [
        "run_id,region,proxy_id,proxy_name,proxy_type,YouTube,GitHub",
        "run-1,香港,stable-proxy-id,HK-01,Trojan,128ms,188ms",
        "",
      ].join("\n"),
    );
  });

  test("writes only the summary CSV file", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "latency-csv-"));

    try {
      const exported = writeCsvExport([makeResult("YouTube", "128ms")], outputDir, "latency-test");

      expect(exported).toEqual({ summaryPath: join(outputDir, "latency-test-summary.csv") });
      expect(existsSync(join(outputDir, "latency-test-summary.csv"))).toBe(true);
      expect(existsSync(join(outputDir, "latency-test-details.csv"))).toBe(false);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

function makeResult(siteName: string, latency: string): ResultRow {
  return {
    runId: "run-1",
    regionId: "hong-kong",
    regionLabel: "香港",
    siteId: siteName.toLowerCase(),
    siteName,
    siteUrl: `https://${siteName.toLowerCase()}.example.com`,
    sequence: "1.",
    proxyName: "HK-01",
    proxyId: "stable-proxy-id",
    proxyType: "Trojan",
    latency,
    jitter: "N/A",
    packetLoss: "N/A",
    downloadSpeed: "N/A",
    uploadSpeed: "N/A",
  };
}
