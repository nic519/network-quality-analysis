import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Download, FolderOpen, Monitor, Moon, Plus, RotateCcw, Save, Sun, Trash2, X } from "lucide-react";
import { ClashSpeedtestInlineStatus, getDiagnosticsSummary } from "./clash-speedtest-status";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { DEFAULT_SITES } from "../../../shared/domain";
import type { SiteDefinition } from "../../../shared/domain";
import { DEFAULT_PROBE_SETTINGS, type ProbeSettings } from "../../../shared/probe-settings";
import type { AppState } from "../../../shared/rpc";
import type { ThemeMode } from "../App";

const GO_INSTALL_COMMAND = "go install github.com/nic519/clash-speedtest@latest";

export function DiagnosticsView({
  state,
  sites,
  probeSettings,
  onSelectBinary,
  onSetBinaryPath,
  onResetBinaryPath,
  onSaveSites,
  onSaveProbeSettings,
  onExportAllResults,
  onCopyInstallCommand,
  canExportResults,
  themeMode,
  onThemeModeChange,
}: {
  state: AppState["clashSpeedtest"];
  sites: SiteDefinition[];
  probeSettings: ProbeSettings;
  onSelectBinary: () => void;
  onSetBinaryPath: (path: string) => Promise<void>;
  onResetBinaryPath: () => Promise<void>;
  onSaveSites: (sites: SiteDefinition[]) => Promise<void>;
  onSaveProbeSettings: (settings: ProbeSettings) => Promise<void>;
  onExportAllResults: () => void;
  onCopyInstallCommand: () => Promise<void>;
  canExportResults: boolean;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const [manualPath, setManualPath] = useState(state.source === "manual" ? state.path ?? "" : "");
  const [draftSites, setDraftSites] = useState<SiteDefinition[]>(sites);
  const [draftProbeSettings, setDraftProbeSettings] = useState<ProbeSettings>(probeSettings);
  const [didCopyInstallCommand, setDidCopyInstallCommand] = useState(false);

  useEffect(() => {
    setManualPath(state.source === "manual" ? state.path ?? "" : "");
  }, [state.path, state.source]);

  useEffect(() => {
    setDraftSites(sites);
  }, [sites]);

  useEffect(() => {
    setDraftProbeSettings(probeSettings);
  }, [probeSettings]);

  useEffect(() => {
    if (!didCopyInstallCommand) return;

    const timeoutId = window.setTimeout(() => setDidCopyInstallCommand(false), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [didCopyInstallCommand]);

  return (
    <section className="custom-scrollbar h-full overflow-y-auto px-6 pb-8">
      <div className="mx-auto flex max-w-5xl flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border">
          <div>
            <h1 className="text-base font-semibold text-foreground">工具设置</h1>
            <p className="text-xs text-muted-foreground">管理目标网站、测速工具和历史结果。</p>
          </div>
        </header>

        <div className="divide-y divide-border">
          <section className="py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">外观</h2>
                <p className="mt-1 text-xs text-muted-foreground">选择浅色、深色，或跟随设备设置。</p>
              </div>
              <div className="inline-flex rounded-md border border-border bg-secondary/35 p-1" role="radiogroup" aria-label="外观模式">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = option.id === themeMode;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={cn(
                        "inline-flex h-8 items-center gap-2 rounded px-2.5 text-sm transition-colors",
                        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => onThemeModeChange(option.id)}
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="py-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">目标网站管理</h2>
                <p className="mt-1 text-xs text-muted-foreground">这里维护可选网站；每次测速时可在开始页选择本次目标。</p>
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
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
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
                    className="justify-center text-destructive hover:bg-destructive/10"
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
              <span>保存后会更新开始页可选网站；历史结果不受影响。</span>
              <Button type="button" size="sm" className="shrink-0" onClick={() => onSaveSites(draftSites)}>
                <Save className="h-4 w-4" />
                保存网站
              </Button>
            </div>
          </section>

          <section className="py-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">出口 Probe API</h2>
                <p className="mt-1 text-xs text-muted-foreground">用于识别每个节点的出口 IP、地区和 ASN；请求会通过节点代理发出。</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setDraftProbeSettings(DEFAULT_PROBE_SETTINGS)}>
                <RotateCcw className="h-4 w-4" />
                使用 ip.sb
              </Button>
            </div>
            <div className="grid gap-3 px-3">
              <label className="inline-flex h-9 items-center gap-2 text-sm text-secondary-foreground">
                <input
                  type="checkbox"
                  checked={draftProbeSettings.enabled}
                  onChange={(event) => updateDraftProbeSettings({ enabled: event.target.checked })}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  aria-label="启用出口 Probe API"
                />
                <span>启用出口 Probe API</span>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Probe URL</span>
                <Input
                  value={draftProbeSettings.url}
                  onChange={(event) => updateDraftProbeSettings({ url: event.target.value })}
                  placeholder="https://api.ip.sb/geoip/"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">字段映射</span>
                <Input
                  value={draftProbeSettings.fields}
                  onChange={(event) => updateDraftProbeSettings({ fields: event.target.value })}
                  placeholder="ip=ip,country=country,country_code=country_code,asn=asn,org=organization"
                />
              </label>
              <label className="grid gap-1.5 sm:max-w-[180px]">
                <span className="text-xs font-medium text-muted-foreground">超时时间</span>
                <Input
                  value={draftProbeSettings.timeout}
                  onChange={(event) => updateDraftProbeSettings({ timeout: event.target.value })}
                  placeholder="8s"
                />
              </label>
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={() => onSaveProbeSettings(draftProbeSettings)}>
                  <Save className="h-4 w-4" />
                  保存 Probe API
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-3 py-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">测速工具状态</h2>
              <ClashSpeedtestInlineStatus state={state} />
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/35 px-3 py-2">
              <div className="min-w-0 flex-1 overflow-x-auto font-mono text-sm text-secondary-foreground">
                <div className="w-max min-w-full">{GO_INSTALL_COMMAND}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 px-0 text-muted-foreground hover:text-foreground"
                aria-label="复制安装命令"
                title="复制安装命令"
                onClick={async () => {
                  await onCopyInstallCommand();
                  setDidCopyInstallCommand(true);
                }}
              >
                {didCopyInstallCommand ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {state.path ? <div className="break-all rounded-md border border-border bg-secondary/35 px-3 py-2 text-sm text-secondary-foreground">{state.path}</div> : null}
          </section>

          <section className="py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">历史结果导出</h2>
                <p className="mt-1 text-xs text-muted-foreground">导出全部测试结果，用于备份或迁移到另一台电脑。</p>
              </div>
              <Button type="button" variant="outline" className="shrink-0" onClick={onExportAllResults} disabled={!canExportResults}>
                <Download className="h-4 w-4" />
                导出所有结果
              </Button>
            </div>
          </section>

          <section className="py-5">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-2 py-2 text-left hover:bg-accent/65">
                <div>
                  <div className="text-sm font-semibold text-foreground">高级调试</div>
                  <div className="mt-1 text-xs text-muted-foreground">{getDiagnosticsSummary(state)} 手动指定路径，或切回系统命令依赖。</div>
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
      </div>
    </section>
  );

  function updateDraftSite(index: number, patch: Partial<SiteDefinition>) {
    setDraftSites((current) => current.map((site, siteIndex) => (siteIndex === index ? { ...site, ...patch } : site)));
  }

  function updateDraftProbeSettings(patch: Partial<ProbeSettings>) {
    setDraftProbeSettings((current) => ({ ...current, ...patch }));
  }
}

const themeOptions: Array<{ id: ThemeMode; label: string; icon: typeof Monitor }> = [
  { id: "system", label: "跟随系统", icon: Monitor },
  { id: "light", label: "浅色", icon: Sun },
  { id: "dark", label: "深色", icon: Moon },
];

function createBlankSite(): SiteDefinition {
  return {
    id: "",
    name: "",
    url: "",
    enabled: true,
  };
}
