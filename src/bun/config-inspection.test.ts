import { describe, expect, test } from "bun:test";
import { inspectConfigRegions } from "./config-inspection";

describe("inspectConfigRegions", () => {
  test("counts proxies by configured region from a local yaml file", async () => {
    const result = await inspectConfigRegions("/tmp/config.yaml", {
      readTextFile: async () => `
proxies:
  - name: "HK-01"
  - name: "香港05HKT"
  - name: "Singapore Edge"
  - name: "US West"
`,
    });

    expect(result.totalNodeCount).toBe(4);
    expect(result.regionCounts.find((region) => region.regionId === "hong-kong")?.matchedNodeCount).toBe(2);
    expect(result.regionCounts.find((region) => region.regionId === "singapore")?.matchedNodeCount).toBe(1);
    expect(result.regionCounts.find((region) => region.regionId === "united-states")?.matchedNodeCount).toBe(1);
  });

  test("loads subscription yaml over http", async () => {
    const result = await inspectConfigRegions("https://example.com/subscription", {
      fetchText: async () => `
proxies:
  - name: "JP Tokyo"
  - name: "TW Taipei"
`,
    });

    expect(result.configPath).toBe("https://example.com/subscription");
    expect(result.totalNodeCount).toBe(2);
    expect(result.regionCounts.find((region) => region.regionId === "japan")?.matchedNodeCount).toBe(1);
    expect(result.regionCounts.find((region) => region.regionId === "taiwan")?.matchedNodeCount).toBe(1);
  });

  test("returns zero counts when the config has no proxies array", async () => {
    const result = await inspectConfigRegions("/tmp/config.yaml", {
      readTextFile: async () => "mixed-port: 7890\nmode: rule\n",
    });

    expect(result.totalNodeCount).toBe(0);
    expect(result.regionCounts.every((region) => region.matchedNodeCount === 0)).toBe(true);
  });
});
