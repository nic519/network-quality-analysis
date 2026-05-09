import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RunSetupView } from "./run-setup-view";
import type { AppState } from "../../../shared/rpc";

const state: AppState = {
  regions: [
    { id: "hong-kong", label: "香港", shortLabel: "HK", filterRegex: "HK" },
    { id: "singapore", label: "新加坡", shortLabel: "SG", filterRegex: "SG" },
  ],
  sites: [
    { id: "youtube", name: "YouTube", url: "https://www.youtube.com/generate_204", enabled: true },
    { id: "github", name: "GitHub", url: "https://github.com", enabled: true },
  ],
  runs: [],
  results: [],
  configHistory: [],
  clashSpeedtest: {
    status: "ready",
    version: "1.0.0",
    path: "/tmp/clash-speedtest",
    source: "manual",
    message: "",
    checkedAt: "2026-05-09T00:00:00.000Z",
  },
};

describe("RunSetupView", () => {
  test("recent preset list only enables horizontal scrolling", () => {
    const html = renderToStaticMarkup(
      <RunSetupView
        state={state}
        configPath="https://example.com/config.yaml"
        onConfigPathChange={() => {}}
        onSelectConfigFile={() => {}}
        recentConfigPaths={[
          { path: "/Users/nicholas/a-long-config-file-name.yaml", lastUsedAt: "2026-05-09T00:00:00.000Z", useCount: 1 },
          { path: "https://example.com/another-very-long-subscription-path.yaml", lastUsedAt: "2026-05-09T00:00:00.000Z", useCount: 1 },
        ]}
        selectedRegionIds={["hong-kong"]}
        onToggleRegion={() => {}}
        progress="准备开始"
        progressLog={[]}
        error={null}
        onStartRun={() => {}}
        isPending={false}
        diagnosticsHint={null}
        onOpenDiagnostics={() => {}}
      />,
    );

    expect(html).toContain("custom-scrollbar flex min-w-0 flex-nowrap gap-2 overflow-x-auto overflow-y-hidden pb-1");
  });
});
