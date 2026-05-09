import { useEffect, useState } from "react";
import { ChevronDown, FolderOpen, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { ClashSpeedtestDiagnosticsPanel } from "./clash-speedtest-status";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { DEFAULT_SITES } from "../../../shared/domain";
import type { SiteDefinition } from "../../../shared/domain";
import type { AppState } from "../../../shared/rpc";

const GO_INSTALL_COMMAND = "go install github.com/nic519/clash-speedtest@latest";

export function DiagnosticsView({
  state,
  sites,
  onSelectBinary,
  onSetBinaryPath,
  onResetBinaryPath,
  onSaveSites,
}: {
  state: AppState["clashSpeedtest"];
  sites: SiteDefinition[];
  onSelectBinary: () => void;
  onSetBinaryPath: (path: string) => Promise<void>;
  onResetBinaryPath: () => Promise<void>;
  onSaveSites: (sites: SiteDefinition[]) => Promise<void>;
}) {
  const [manualPath, setManualPath] = useState(state.source === "manual" ? state.path ?? "" : "");
  const [draftSites, setDraftSites] = useState<SiteDefinition[]>(sites);

  useEffect(() => {
    setManualPath(state.source === "manual" ? state.path ?? "" : "");
  }, [state.path, state.source]);

  useEffect(() => {
    setDraftSites(sites);
  }, [sites]);

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-8 pb-10">
      <div className="pt-2">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Settings</div>
        <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-stone-100">设置</h1>
        <p className="mt-1 text-sm text-stone-400">管理测试网站和本机依赖。新测试会使用这里保存的网站列表。</p>
      </div>

      <Card className="border-stone-800 bg-stone-950/80">
        <CardHeader className="gap-2 border-b border-stone-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">测试网站</CardTitle>
              <div className="mt-1 text-sm text-stone-400">每个地区都会依次测试这些站点的延迟 URL。</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setDraftSites([...draftSites, createBlankSite()])}>
                添加网站
                <Plus className="ml-2 h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={() => setDraftSites(DEFAULT_SITES)}>
                恢复默认
                <RotateCcw className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4">
          {draftSites.map((site, index) => (
            <div key={`${site.id}-${index}`} className="grid gap-2 rounded-2xl border border-stone-800 bg-black/20 p-3 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-center">
              <Input
                value={site.name}
                onChange={(event) => updateDraftSite(index, { name: event.target.value })}
                placeholder="网站名称，例如 YouTube"
                aria-label={`测试网站 ${index + 1} 名称`}
              />
              <Input
                value={site.url}
                onChange={(event) => updateDraftSite(index, { url: event.target.value })}
                placeholder="https://example.com"
                aria-label={`测试网站 ${index + 1} URL`}
              />
              <Button
                type="button"
                variant="outline"
                className="justify-center border-red-500/40 text-red-200 hover:bg-red-500/10"
                onClick={() => setDraftSites(draftSites.filter((_, siteIndex) => siteIndex !== index))}
              >
                删除
                <Trash2 className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
            <span>保存后，后续测试会使用这些网站；历史结果仍保留当时的网站名称。</span>
            <Button type="button" className="shrink-0" onClick={() => onSaveSites(draftSites)}>
              保存网站
              <Save className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-stone-800 bg-stone-950/80">
        <CardHeader className="gap-3 border-b border-stone-800">
          <CardTitle className="text-xl">依赖</CardTitle>
          <div className="rounded-xl border border-stone-800 bg-black/20 px-4 py-3 font-mono text-sm text-stone-100">
            {GO_INSTALL_COMMAND}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <ClashSpeedtestDiagnosticsPanel state={state} />
        </CardContent>
      </Card>

      <details className="rounded-2xl border border-stone-800 bg-stone-950/80">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-left">
          <div>
            <div className="text-sm font-semibold text-stone-100">开发调试</div>
            <div className="mt-1 text-xs text-stone-400">手动指定路径，或切回系统命令依赖。</div>
          </div>
          <ChevronDown className="h-4 w-4 text-stone-400" />
        </summary>
        <div className="grid gap-3 border-t border-stone-800 px-5 py-4">
          <Input
            value={manualPath}
            onChange={(event) => setManualPath(event.target.value)}
            placeholder="/absolute/path/to/clash-speedtest"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onSetBinaryPath(manualPath)}>
              指定路径
            </Button>
            <Button type="button" variant="outline" onClick={onSelectBinary}>
              从文件选择
              <FolderOpen className="ml-2 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                setManualPath("");
                await onResetBinaryPath();
              }}
            >
              切回系统命令
              <RotateCcw className="ml-2 h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" onClick={() => setManualPath("")}>
              清空输入
              <X className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </details>
    </section>
  );

  function updateDraftSite(index: number, patch: Partial<SiteDefinition>) {
    setDraftSites((current) => current.map((site, siteIndex) => (siteIndex === index ? { ...site, ...patch } : site)));
  }
}

function createBlankSite(): SiteDefinition {
  return {
    id: "",
    name: "",
    url: "",
  };
}
