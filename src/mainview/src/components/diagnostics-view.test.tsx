import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticsView } from "./diagnostics-view";
import type { AppState } from "../../../shared/rpc";
import type { SiteDefinition } from "../../../shared/domain";
import { DEFAULT_CLASH_OBSERVATION_SETTINGS } from "../../../shared/clash-observation";
import { DEFAULT_PROBE_SETTINGS } from "../../../shared/probe-settings";

const state: AppState["clashSpeedtest"] = {
  status: "ready",
  version: "1.0.0",
  path: "/Users/nicholas/go/bin/clash-speedtest",
  source: "go-install",
  message: "",
  checkedAt: "2026-05-09T00:00:00.000Z",
};

const sites: SiteDefinition[] = [];

describe("DiagnosticsView", () => {
  test("renders a copy button next to the install command", () => {
    const html = renderToStaticMarkup(
      <DiagnosticsView
        state={state}
        sites={sites}
        probeSettings={DEFAULT_PROBE_SETTINGS}
        clashObservation={{
          settings: DEFAULT_CLASH_OBSERVATION_SETTINGS,
          summaries: [],
          logEvents: [],
        }}
        onSelectBinary={() => {}}
        onSetBinaryPath={async () => {}}
        onResetBinaryPath={async () => {}}
        onSaveSites={async () => {}}
        onSaveProbeSettings={async () => {}}
        onSaveClashObservationSettings={async () => {}}
        onRunClashObservation={async () => {}}
        onExportAllResults={() => {}}
        onCopyInstallCommand={async () => {}}
        canExportResults={false}
        themeMode="system"
        onThemeModeChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="复制安装命令"');
    expect(html).toContain("github.com/nic519/clash-speedtest@latest");
    expect(html).toContain('aria-label="启用出口 Probe API"');
    expect(html).toContain(">测速工具状态</h2><div class=\"flex items-center gap-2 text-sm text-secondary-foreground\"");
    expect(html).toContain("路径：");
    expect(html).toContain("/Users/nicholas/go/bin/clash-speedtest");
    expect(html).toContain("版本：");
    expect(html).toContain("1.0.0");
    expect(html).toContain("当前使用系统命令依赖。 手动指定路径，或切回系统命令依赖。");
  });

  test("renders built-in probe providers without exposing custom inputs by default", () => {
    const html = renderDiagnosticsView(DEFAULT_PROBE_SETTINGS);

    expect(html).toContain("ip.sb");
    expect(html).toContain("realip.cc");
    expect(html).toContain("当前使用内置预设");
    expect(html).not.toContain("<span class=\"text-xs font-medium text-muted-foreground\">Probe URL</span>");
  });

  test("renders custom probe inputs for custom provider settings", () => {
    const html = renderDiagnosticsView({
      enabled: true,
      url: "https://example.com/probe",
      fields: "ip=query,country=country",
      timeout: "12s",
    });

    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("https://example.com/probe");
    expect(html).toContain("<span class=\"text-xs font-medium text-muted-foreground\">Probe URL</span>");
    expect(html).toContain("ip=query,country=country");
  });

  test("renders clash observation settings and recent review data", () => {
    const html = renderDiagnosticsView(DEFAULT_PROBE_SETTINGS, {
      settings: {
        ...DEFAULT_CLASH_OBSERVATION_SETTINGS,
        enabled: true,
        controllerUrl: "http://127.0.0.1:9090",
      },
      summaries: [
        {
          id: "obs-1",
          startedAt: "2026-05-20T10:00:00.000Z",
          completedAt: "2026-05-20T10:00:03.000Z",
          status: "completed",
          controllerUrl: "http://127.0.0.1:9090",
          errorMessage: null,
          proxyCount: 8,
          connectionSampleCount: 3,
          logEventCount: 2,
        },
      ],
      logEvents: [
        {
          id: 1,
          observationId: "obs-1",
          eventTime: "2026-05-20T10:00:02.000Z",
          level: "warning",
          eventType: "dns",
          message: "[DNS] github.com lookup failed",
          proxyName: "",
          domain: "github.com",
          rule: "",
        },
      ],
    });

    expect(html).toContain("Clash 观测");
    expect(html).toContain("Controller URL");
    expect(html).toContain("http://127.0.0.1:9090");
    expect(html).toContain("立即采集");
    expect(html).toContain("obs-1");
    expect(html).toContain("[DNS] github.com lookup failed");
  });
});

function renderDiagnosticsView(
  probeSettings = DEFAULT_PROBE_SETTINGS,
  clashObservation: AppState["clashObservation"] = {
    settings: DEFAULT_CLASH_OBSERVATION_SETTINGS,
    summaries: [],
    logEvents: [],
  },
) {
  return renderToStaticMarkup(
    <DiagnosticsView
      state={state}
      sites={sites}
      probeSettings={probeSettings}
      clashObservation={clashObservation}
      onSelectBinary={() => {}}
      onSetBinaryPath={async () => {}}
      onResetBinaryPath={async () => {}}
      onSaveSites={async () => {}}
      onSaveProbeSettings={async () => {}}
      onSaveClashObservationSettings={async () => {}}
      onRunClashObservation={async () => {}}
      onExportAllResults={() => {}}
      onCopyInstallCommand={async () => {}}
      canExportResults={false}
      themeMode="system"
      onThemeModeChange={() => {}}
    />,
  );
}
