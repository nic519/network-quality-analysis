import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticsView } from "./diagnostics-view";
import type { AppState } from "../../../shared/rpc";
import type { SiteDefinition } from "../../../shared/domain";

const state: AppState["clashSpeedtest"] = {
  status: "missing",
  version: null,
  path: null,
  source: null,
  message: "未安装",
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
  });
});
