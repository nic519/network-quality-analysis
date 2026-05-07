import { describe, expect, test } from "bun:test";
import { buildCsvExport } from "./csv";
import type { ResultRow } from "../shared/domain";

describe("buildCsvExport", () => {
  test("exports detail rows and proxy-site summary", () => {
    const exportData = buildCsvExport([
      makeResult("YouTube", "128ms"),
      makeResult("GitHub", "188ms"),
    ]);

    expect(exportData.details).toContain("run_id,region,site,site_url,sequence,proxy_id,proxy_name");
    expect(exportData.details).toContain("run-1,香港,YouTube,https://youtube.example.com,1.,stable-proxy-id,HK-01,Trojan,128ms");
    expect(exportData.summary).toBe(
      [
        "run_id,region,proxy_id,proxy_name,proxy_type,YouTube,GitHub",
        "run-1,香港,stable-proxy-id,HK-01,Trojan,128ms,188ms",
        "",
      ].join("\n"),
    );
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
