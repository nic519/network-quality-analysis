import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TopNavigation } from "./top-navigation";
import type { ClashSpeedtestState } from "../../../shared/rpc";

describe("TopNavigation", () => {
  test("renders latency trends as a first-level tab beside history", () => {
    const html = renderToStaticMarkup(<TopNavigation activeView="trends" onChange={() => {}} state={state} />);

    expect(html).toContain('role="tablist"');
    expect(html).toContain("历史结果");
    expect(html).toContain("趋势分析");
    expect(html).toContain("观测复盘");
    expect(html).toContain('aria-selected="true"');
  });
});

const state: ClashSpeedtestState = {
  status: "ready",
  version: "1.0.0",
  path: "/tmp/clash-speedtest",
  source: "manual",
  message: "",
  checkedAt: "2026-05-15T00:00:00.000Z",
};
