import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Download, FolderOpen, Monitor, Moon, Plus, RotateCcw, Save, Sun, Trash2, X } from "lucide-react";
import { ClashSpeedtestInlineStatus, getDiagnosticsSummary } from "./clash-speedtest-status";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { DEFAULT_CLASH_OBSERVATION_SETTINGS, type ClashObservationSettings } from "../../../shared/clash-observation";
import { DEFAULT_SITES } from "../../../shared/domain";
import type { SiteDefinition } from "../../../shared/domain";
import { PROBE_PROVIDER_PRESETS, findProbeProviderPreset, type ProbeSettings } from "../../../shared/probe-settings";
import type { AppState } from "../../../shared/rpc";
import type { ThemeMode } from "../App";

const GO_INSTALL_COMMAND = "go install github.com/nic519/clash-speedtest@latest";

export function DiagnosticsView({
  state,
  sites,
  probeSettings,
  clashObservation,
  onSelectBinary,
  onSetBinaryPath,
  onResetBinaryPath,
  onSaveSites,
  onSaveProbeSettings,
  onSaveClashObservationSettings,
  onRunClashObservation,
  onExportAllResults,
  onCopyInstallCommand,
  canExportResults,
  themeMode,
  onThemeModeChange,
}: {
  state: AppState["clashSpeedtest"];
  sites: SiteDefinition[];
  probeSettings: ProbeSettings;
  clashObservation: AppState["clashObservation"];
  onSelectBinary: () => void;
  onSetBinaryPath: (path: string) => Promise<void>;
  onResetBinaryPath: () => Promise<void>;
  onSaveSites: (sites: SiteDefinition[]) => Promise<void>;
  onSaveProbeSettings: (settings: ProbeSettings) => Promise<void>;
  onSaveClashObservationSettings: (settings: ClashObservationSettings) => Promise<void>;
  onRunClashObservation: () => Promise<void>;
  onExportAllResults: () => void;
  onCopyInstallCommand: () => Promise<void>;
  canExportResults: boolean;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const [manualPath, setManualPath] = useState(state.source === "manual" ? state.path ?? "" : "");
  const [draftSites, setDraftSites] = useState<SiteDefinition[]>(sites);
  const [draftProbeSettings, setDraftProbeSettings] = useState<ProbeSettings>(probeSettings);
  const [draftClashObservationSettings, setDraftClashObservationSettings] = useState<ClashObservationSettings>(clashObservation.settings);
  const [probeProviderMode, setProbeProviderMode] = useState(getProbeProviderMode(probeSettings));
  const [didCopyInstallCommand, setDidCopyInstallCommand] = useState(false);

  useEffect(() => {
    setManualPath(state.source === "manual" ? state.path ?? "" : "");
  }, [state.path, state.source]);

  useEffect(() => {
    setDraftSites(sites);
  }, [sites]);

  useEffect(() => {
    setDraftProbeSettings(probeSettings);
    setProbeProviderMode(getProbeProviderMode(probeSettings));
  }, [probeSettings]);

  useEffect(() => {
    setDraftClashObservationSettings(clashObservation.settings);
  }, [clashObservation.settings]);

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
                <p className="mt-1 text-xs text-muted-foreground">用于识别每个节点的出口 IP、地区和 ASN；内置预设不需要手动维护 URL。</p>
              </div>
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
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Probe API 提供商">
                {PROBE_PROVIDER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={probeProviderMode === preset.id}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left transition-colors",
                      probeProviderMode === preset.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-input bg-secondary/35 text-secondary-foreground hover:bg-accent/65",
                    )}
                    onClick={() => selectProbeProviderPreset(preset.settings, preset.id)}
                  >
                    <span className="block text-sm font-semibold">{preset.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{preset.description}</span>
                    <span className="mt-2 block break-all font-mono text-[11px] text-muted-foreground">{preset.settings.url}</span>
                  </button>
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={probeProviderMode === "custom"}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left transition-colors",
                    probeProviderMode === "custom"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input bg-secondary/35 text-secondary-foreground hover:bg-accent/65",
                  )}
                  onClick={() => setProbeProviderMode("custom")}
                >
                  <span className="block text-sm font-semibold">自定义</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">需要使用自己的 Probe API 时再填写 URL、字段映射和超时时间。</span>
                  <span className="mt-2 block break-all font-mono text-[11px] text-muted-foreground">{draftProbeSettings.url}</span>
                </button>
              </div>
              {probeProviderMode === "custom" ? (
                <div className="grid gap-3 rounded-md border border-border bg-secondary/25 p-3">
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
                </div>
              ) : (
                <p className="rounded-md border border-border bg-secondary/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  当前使用内置预设。需要调整 URL 或字段映射时，切换到“自定义”；也可以随时点选 ip.sb 或 realip.cc 切回内置预设。
                </p>
              )}
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={() => onSaveProbeSettings(draftProbeSettings)}>
                  <Save className="h-4 w-4" />
                  保存 Probe API
                </Button>
              </div>
            </div>
          </section>

          <section className="py-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Clash 观测</h2>
                <p className="mt-1 text-xs text-muted-foreground">定时采集 controller 快照和 warning/error 日志，用于后续复盘。</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onRunClashObservation}>
                立即采集
              </Button>
            </div>

            <div className="grid gap-3 px-3">
              <label className="inline-flex h-9 items-center gap-2 text-sm text-secondary-foreground">
                <input
                  type="checkbox"
                  checked={draftClashObservationSettings.enabled}
                  onChange={(event) => updateDraftClashObservationSettings({ enabled: event.target.checked })}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  aria-label="启用 Clash 定时观测"
                />
                <span>启用定时观测</span>
              </label>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Controller URL</span>
                  <Input
                    value={draftClashObservationSettings.controllerUrl}
                    onChange={(event) => updateDraftClashObservationSettings({ controllerUrl: event.target.value })}
                    placeholder={DEFAULT_CLASH_OBSERVATION_SETTINGS.controllerUrl}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">采集间隔（分钟）</span>
                  <Input
                    value={String(draftClashObservationSettings.intervalMinutes)}
                    onChange={(event) => updateDraftClashObservationSettings({ intervalMinutes: Number.parseInt(event.target.value, 10) || 1 })}
                    placeholder="5"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">保留天数</span>
                  <Input
                    value={String(draftClashObservationSettings.retentionDays)}
                    onChange={(event) => updateDraftClashObservationSettings({ retentionDays: Number.parseInt(event.target.value, 10) || 30 })}
                    placeholder="30"
                  />
                </label>
              </div>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Secret / Token</span>
                <Input
                  value={draftClashObservationSettings.secret}
                  onChange={(event) => updateDraftClashObservationSettings({ secret: event.target.value })}
                  placeholder="留空表示 controller 未启用 secret"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3 text-sm text-secondary-foreground">
                  {(["warning", "error"] as const).map((level) => (
                    <label key={level} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draftClashObservationSettings.logLevels.includes(level)}
                        onChange={(event) => toggleDraftLogLevel(level, event.target.checked)}
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                        aria-label={`采集 ${level} 日志`}
                      />
                      <span>{level}</span>
                    </label>
                  ))}
                </div>
                <Button type="button" size="sm" onClick={() => onSaveClashObservationSettings(draftClashObservationSettings)}>
                  <Save className="h-4 w-4" />
                  保存观测设置
                </Button>
              </div>
              <div className="grid gap-2 rounded-md border border-border bg-secondary/25 p-3">
                <div className="grid gap-1">
                  <h3 className="text-xs font-semibold text-muted-foreground">最近观测</h3>
                  {clashObservation.summaries.length ? (
                    <div className="grid gap-1 text-xs text-secondary-foreground">
                      {clashObservation.summaries.slice(0, 4).map((summary) => (
                        <div key={summary.id} className="grid gap-1 border-t border-border/70 py-2 first:border-t-0 first:pt-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-[11px]">{summary.id}</span>
                            <span className={summary.status === "completed" ? "text-primary" : "text-destructive"}>
                              {summary.status === "completed" ? "完成" : "失败"}
                            </span>
                          </div>
                          <div className="text-muted-foreground">
                            {formatObservationTime(summary.startedAt)} · 节点 {summary.proxyCount} · 连接 {summary.connectionSampleCount} · 事件{" "}
                            {summary.logEventCount}
                          </div>
                          {summary.errorMessage ? <div className="text-destructive">{summary.errorMessage}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">还没有观测记录。保存设置后等待定时采集，或点击“立即采集”。</p>
                  )}
                </div>
                <div className="grid gap-1 border-t border-border/70 pt-3">
                  <h3 className="text-xs font-semibold text-muted-foreground">最近日志事件</h3>
                  {clashObservation.logEvents.length ? (
                    <div className="grid gap-1 text-xs">
                      {clashObservation.logEvents.slice(0, 5).map((event) => (
                        <div key={`${event.observationId}-${event.id ?? event.eventTime}-${event.message}`} className="grid gap-1 rounded border border-border/70 px-2 py-1.5">
                          <div className="flex flex-wrap gap-2 text-muted-foreground">
                            <span>{event.eventTime ? formatObservationTime(event.eventTime) : "未知时间"}</span>
                            <span>{event.level}</span>
                            <span>{event.eventType}</span>
                            {event.domain ? <span>{event.domain}</span> : null}
                            {event.proxyName ? <span>{event.proxyName}</span> : null}
                          </div>
                          <div className="break-words text-secondary-foreground">{event.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">最近没有 warning/error 日志事件。</p>
                  )}
                </div>
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
            <div className="grid gap-1">
              {state.path ? (
                <p className="break-all text-xs leading-5 text-muted-foreground">
                  路径：<span className="font-mono text-[12px] text-secondary-foreground">{state.path}</span>
                </p>
              ) : null}
              {state.version ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  版本：<span className="font-mono text-[12px] text-secondary-foreground">{state.version}</span>
                </p>
              ) : null}
            </div>
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

  function updateDraftClashObservationSettings(patch: Partial<ClashObservationSettings>) {
    setDraftClashObservationSettings((current) => ({ ...current, ...patch }));
  }

  function toggleDraftLogLevel(level: "warning" | "error", checked: boolean) {
    setDraftClashObservationSettings((current) => {
      const levels = checked ? [...current.logLevels, level] : current.logLevels.filter((item) => item !== level);
      return { ...current, logLevels: [...new Set(levels)] };
    });
  }

  function selectProbeProviderPreset(settings: ProbeSettings, providerId: string) {
    setProbeProviderMode(providerId);
    setDraftProbeSettings((current) => ({ ...settings, enabled: current.enabled }));
  }
}

function formatObservationTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getProbeProviderMode(settings: ProbeSettings) {
  return findProbeProviderPreset(settings)?.id ?? "custom";
}
