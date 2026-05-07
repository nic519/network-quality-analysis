import { describe, expect, test } from "bun:test";
import { buildLatencyChartRows, type MatrixRow } from "./chart-data";

describe("buildLatencyChartRows", () => {
  test("keeps missing site latency rows at the end", () => {
    const rows: MatrixRow[] = [
      makeRow("slow", "Slow Node", { YouTube: "328ms" }),
      makeRow("missing", "Missing Node", { YouTube: "N/A" }),
      makeRow("fast", "Fast Node", { YouTube: "128ms" }),
    ];

    expect(buildLatencyChartRows(rows, "YouTube").map((row) => row.proxyName)).toEqual([
      "Fast Node",
      "Slow Node",
      "Missing Node",
    ]);
  });
});

function makeRow(key: string, proxyName: string, values: Record<string, string>): MatrixRow {
  return {
    key,
    runId: "run-1",
    proxyId: key,
    proxyName,
    proxyType: "Trojan",
    regionLabel: "香港",
    values,
  };
}
