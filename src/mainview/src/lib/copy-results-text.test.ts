import { describe, expect, test } from "bun:test";
import type { MatrixRow } from "./chart-data";
import { buildCopyResultsText } from "./copy-results-text";

describe("buildCopyResultsText", () => {
  test("omits run, region, and proxy id columns from copied text", () => {
    const text = buildCopyResultsText([
      {
        key: "run-1\u0000hong-kong\u0000stable-proxy-id",
        runId: "run-1",
        regionLabel: "香港",
        proxyId: "stable-proxy-id",
        proxyName: "HK-01",
        proxyType: "Trojan",
        values: {
          YouTube: "128ms",
          GitHub: "188ms",
        },
      },
    ]);

    expect(text).toBe(["proxy_name,proxy_type,YouTube,GitHub", "HK-01,Trojan,128ms,188ms", ""].join("\n"));
  });
});
