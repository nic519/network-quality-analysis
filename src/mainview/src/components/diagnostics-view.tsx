import { useEffect, useState } from "react";
import { ChevronDown, FolderOpen, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { ClashSpeedtestDiagnosticsPanel } from "./clash-speedtest-status";
import { Button } from "./ui/button";
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
    <section className="mx-auto flex max-w-5xl flex-col px-6 pb-8">
      <header className="flex h-14 items-center justify-between border-b border-border">
        <div>
          <h1 className="text-base font-semibold text-foreground">设置</h1>
          <p className="text-xs text-muted-foreground">管理测试网站和本机依赖。</p>
        </div>
      </header>

      <div className="divide-y divide-border">
        <section className="py-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">测试网站</h2>
              <p className="mt-1 text-xs text-muted-foreground">勾选启用的网站会参与测试，未勾选的网站保留但跳过。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDraftSites([...draftSites, createBlankSite()])}>
                <Plus className="h-4 w-4" />
                添加网站
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDraftSites(DEFAULT_SITES)}>
                <RotateCcw className="h-4 w-4" />
                恢复默认
              </Button>
            </div>
          </div>

          <div className="hidden grid-cols-[72px_180px_minmax(0,1fr)_72px] gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground lg:grid">
            <span>启用</span>
            <span>名称</span>
            <span>延迟 URL</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-border border-b border-border">
            {draftSites.map((site, index) => (
              <div key={`${site.id}-${index}`} className="grid gap-2 px-3 py-2 lg:grid-cols-[72px_180px_minmax(0,1fr)_72px] lg:items-center">
                <label className="inline-flex h-9 items-center gap-2 text-sm text-secondary-foreground">
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
                />
                <Input
                  value={site.url}
                  onChange={(event) => updateDraftSite(index, { url: event.target.value })}
                  placeholder="https://example.com"
                  aria-label={`测试网站 ${index + 1} URL`}
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
          <div className="flex flex-col gap-2 px-3 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>保存后只测试已启用的网站；历史结果不受影响。</span>
            <Button type="button" size="sm" className="shrink-0" onClick={() => onSaveSites(draftSites)}>
              <Save className="h-4 w-4" />
              保存网站
            </Button>
          </div>
        </section>

        <section className="grid gap-3 py-5">
          <h2 className="text-sm font-semibold text-foreground">依赖</h2>
          <div className="rounded-md border border-border bg-secondary/35 px-3 py-2 font-mono text-sm text-secondary-foreground">
            {GO_INSTALL_COMMAND}
          </div>
          <ClashSpeedtestDiagnosticsPanel state={state} />
        </section>

        <section className="py-5">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-2 py-2 text-left hover:bg-accent/65">
          <div>
            <div className="text-sm font-semibold text-foreground">开发调试</div>
            <div className="mt-1 text-xs text-muted-foreground">手动指定路径，或切回系统命令依赖。</div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </summary>
        <div className="grid gap-3 px-2 py-3">
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
              <FolderOpen className="h-4 w-4" />
              从文件选择
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                setManualPath("");
                await onResetBinaryPath();
              }}
            >
              <RotateCcw className="h-4 w-4" />
              切回系统命令
            </Button>
            <Button type="button" variant="outline" onClick={() => setManualPath("")}>
              <X className="h-4 w-4" />
              清空输入
            </Button>
          </div>
        </div>
      </details>
        </section>
      </div>
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
