import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RunSetupView } from "./run-setup-view";
import type { AppState, ConfigInspectionResult, RunProgressState } from "../../../shared/rpc";
import { DEFAULT_PROBE_SETTINGS } from "../../../shared/probe-settings";

const state: AppState = {
  regions: [
    { id: "hong-kong", label: "香港", shortLabel: "HK", filterRegex: "HK" },
    { id: "singapore", label: "新加坡", shortLabel: "SG", filterRegex: "SG" },
  ],
  sites: [
    { id: "youtube", name: "YouTube", url: "https://www.youtube.com/generate_204", enabled: true },
    { id: "github", name: "GitHub", url: "https://github.com", enabled: true },
  ],
  probeSettings: DEFAULT_PROBE_SETTINGS,
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
  const configInspection: ConfigInspectionResult = {
    configPath: "https://example.com/config.yaml",
    totalNodeCount: 10,
    regionCounts: [
      { regionId: "hong-kong", regionLabel: "香港", matchedNodeCount: 6 },
      { regionId: "singapore", regionLabel: "新加坡", matchedNodeCount: 4 },
    ],
  };

  const activeRunProgress: RunProgressState = {
    stage: "running",
    completedGroups: 1,
    totalGroups: 4,
    percent: 25,
    currentGroupNodeIndex: 3,
    currentGroupEstimatedNodeCount: 12,
    currentRegionId: "hong-kong",
    currentRegionLabel: "香港",
    currentSiteId: "github",
    currentSiteName: "GitHub",
    currentSiteUrl: "https://github.com",
    currentGroupLabel: "香港 -> GitHub",
    currentGroupNodeCount: 18,
    message: "正在测试 香港 -> GitHub (2/4)",
  };

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
        configInspection={null}
        isInspectingConfig={false}
        selectedSiteIds={["youtube", "github"]}
        onToggleSite={() => {}}
        progress="准备开始"
        runProgress={null}
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

  test("renders a group progress bar and node estimate while a run is active", () => {
    const html = renderToStaticMarkup(
      <RunSetupView
        state={state}
        configPath="https://example.com/config.yaml"
        onConfigPathChange={() => {}}
        onSelectConfigFile={() => {}}
        recentConfigPaths={[]}
        selectedRegionIds={["hong-kong", "singapore"]}
        onToggleRegion={() => {}}
        configInspection={null}
        isInspectingConfig={false}
        selectedSiteIds={["youtube", "github"]}
        onToggleSite={() => {}}
        progress={activeRunProgress.message}
        runProgress={activeRunProgress}
        progressLog={["启动测试任务", activeRunProgress.message]}
        error={null}
        onStartRun={() => {}}
        isPending={true}
        diagnosticsHint={null}
        onOpenDiagnostics={() => {}}
      />,
    );

    expect(html).toContain('role="progressbar"');
    expect(html).toContain("第 3 / 12 个节点");
    expect(html).toContain("1 / 4 组已完成");
    expect(html).toContain("当前目标");
    expect(html).toContain("香港 -&gt; GitHub");
    expect(html).toContain("当前组合已返回 18 个节点结果");
    expect(html).toContain('aria-valuenow="25"');
  });

  test("renders matched node counts beside each region after config inspection", () => {
    const html = renderToStaticMarkup(
      <RunSetupView
        state={state}
        configPath="https://example.com/config.yaml"
        onConfigPathChange={() => {}}
        onSelectConfigFile={() => {}}
        recentConfigPaths={[]}
        selectedRegionIds={["hong-kong"]}
        onToggleRegion={() => {}}
        configInspection={configInspection}
        isInspectingConfig={false}
        selectedSiteIds={["youtube", "github"]}
        onToggleSite={() => {}}
        progress="已解析配置"
        runProgress={null}
        progressLog={[]}
        error={null}
        onStartRun={() => {}}
        isPending={false}
        diagnosticsHint={null}
        onOpenDiagnostics={() => {}}
      />,
    );

    expect(html).toContain(">香港</span><span class=\"shrink-0 text-xs text-muted-foreground\">6</span>");
    expect(html).toContain(">新加坡</span><span class=\"shrink-0 text-xs text-muted-foreground\">4</span>");
  });
});
