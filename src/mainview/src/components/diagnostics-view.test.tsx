import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticsView } from "./diagnostics-view";
import type { AppState } from "../../../shared/rpc";
import type { SiteDefinition } from "../../../shared/domain";

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
        onSelectBinary={() => {}}
        onSetBinaryPath={async () => {}}
        onResetBinaryPath={async () => {}}
        onSaveSites={async () => {}}
        onExportAllResults={() => {}}
        onCopyInstallCommand={async () => {}}
        canExportResults={false}
      />,
    );

    expect(html).toContain('aria-label="复制安装命令"');
    expect(html).toContain("github.com/nic519/clash-speedtest@latest");
    expect(html).toContain(">依赖</h2><div class=\"flex items-center gap-2 text-sm text-secondary-foreground\"");
    expect(html).toContain("当前使用系统命令依赖。 手动指定路径，或切回系统命令依赖。");
  });
});
