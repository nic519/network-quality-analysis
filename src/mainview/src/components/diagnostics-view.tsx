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

      <Card className="overflow-hidden rounded-2xl border-stone-800 bg-stone-950/80">
        <CardHeader className="border-b border-stone-800 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">测试网站</CardTitle>
              <div className="mt-1 text-xs text-stone-400">勾选启用的网站会参与测试，未勾选的网站保留但跳过。</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDraftSites([...draftSites, createBlankSite()])}>
                添加网站
                <Plus className="ml-2 h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDraftSites(DEFAULT_SITES)}>
                恢复默认
                <RotateCcw className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden grid-cols-[72px_180px_minmax(0,1fr)_72px] gap-2 border-b border-stone-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500 lg:grid">
            <span>启用</span>
            <span>名称</span>
            <span>延迟 URL</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-stone-800">
            {draftSites.map((site, index) => (
              <div key={`${site.id}-${index}`} className="grid gap-2 px-4 py-2 lg:grid-cols-[72px_180px_minmax(0,1fr)_72px] lg:items-center">
                <label className="inline-flex h-9 items-center gap-2 text-sm text-stone-200">
                  <input
                    type="checkbox"
                    checked={site.enabled !== false}
                    onChange={(event) => updateDraftSite(index, { enabled: event.target.checked })}
                    className="h-4 w-4 accent-emerald-400"
                    aria-label={`测试网站 ${index + 1} 是否启用`}
                  />
                  <span className="lg:hidden">启用</span>
                </label>
                <Input
                  value={site.name}
                  onChange={(event) => updateDraftSite(index, { name: event.target.value })}
                  placeholder="网站名称，例如 YouTube"
                  aria-label={`测试网站 ${index + 1} 名称`}
                  className="h-9 border-stone-800 bg-stone-950/60"
                />
                <Input
                  value={site.url}
                  onChange={(event) => updateDraftSite(index, { url: event.target.value })}
                  placeholder="https://example.com"
                  aria-label={`测试网站 ${index + 1} URL`}
                  className="h-9 border-stone-800 bg-stone-950/60"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-center text-red-200 hover:bg-red-500/10"
                  onClick={() => setDraftSites(draftSites.filter((_, siteIndex) => siteIndex !== index))}
                  aria-label={`删除测试网站 ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="lg:hidden">删除</span>
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-stone-800 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
            <span>保存后只测试已启用的网站，历史结果不受影响。</span>
            <Button type="button" size="sm" className="shrink-0" onClick={() => onSaveSites(draftSites)}>
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
    enabled: true,
  };
}
