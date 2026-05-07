import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSearch,
  Gauge,
  Globe2,
  Loader2,
  PackageCheck,
  Play,
  Radar,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { buildLatencyChartRows, type MatrixRow } from "./lib/chart-data";
import { api, onClashSpeedtestStatus, onProgress } from "./lib/electrobun";
import { cn } from "./lib/utils";
import { DEFAULT_SITES, REGION_PRESETS, latencyStatus, latencyToMs } from "../../shared/domain";
import type { AppState } from "../../shared/rpc";

const today = new Date().toISOString().slice(0, 10);

export default function App() {
  const [state, setState] = useState<AppState>({
    regions: REGION_PRESETS,
    configHistory: [],
    runs: [],
    results: [],
    clashSpeedtest: {
      status: "checking-update",
      version: "v0.0.1",
      latestVersion: null,
      updateAvailable: null,
      path: null,
      source: null,
      message: "正在检查 clash-speedtest 更新",
      checkedAt: new Date().toISOString(),
    },
  });
  const [configPath, setConfigPath] = useState("");
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>(["hong-kong"]);
  const [selectedRunId, setSelectedRunId] = useState<string>("all");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState(DEFAULT_SITES[0]?.id ?? "");
  const [progress, setProgress] = useState("准备就绪");
  const [progressLog, setProgressLog] = useState<string[]>(["准备就绪"]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filters = useMemo(
    () => ({
      runId: selectedRunId === "all" ? undefined : selectedRunId,
      regionIds: selectedRegionIds,
      fromDate: selectedRunId === "all" ? `${fromDate}T00:00:00.000Z` : undefined,
      toDate: selectedRunId === "all" ? `${toDate}T23:59:59.999Z` : undefined,
    }),
    [fromDate, selectedRegionIds, selectedRunId, toDate],
  );

  useEffect(
    () =>
      onProgress((message) => {
        setProgress(message);
        setProgressLog((current) => [...current.slice(-17), message]);
      }),
    [],
  );

  useEffect(
    () =>
      onClashSpeedtestStatus((clashSpeedtest) => {
        setState((current) => ({ ...current, clashSpeedtest }));
        setProgress(clashSpeedtest.message);
      }),
    [],
  );

  useEffect(() => {
    startTransition(async () => {
      try {
        setState(await api.getAppState(filters));
      } catch (caught) {
        setError(toErrorMessage(caught));
      }
    });
  }, [filters]);

  const matrixRows = useMemo(() => buildMatrixRows(state.results, search), [search, state.results]);
  const selectedSite = DEFAULT_SITES.find((site) => site.id === selectedSiteId) ?? DEFAULT_SITES[0];
  const latencyChartRows = useMemo(() => buildLatencyChartRows(matrixRows, selectedSite?.name), [matrixRows, selectedSite?.name]);
  const availableChartRows = useMemo(() => latencyChartRows.filter((row) => row.isAvailable), [latencyChartRows]);
  const unavailableChartRows = useMemo(() => latencyChartRows.filter((row) => !row.isAvailable), [latencyChartRows]);
  const summaryResults = useMemo(
    () => selectRunScopedResults(state.results, state.runs, selectedRunId),
    [selectedRunId, state.results, state.runs],
  );
  const summary = useMemo(() => summarize(summaryResults), [summaryResults]);
  const latestRun = state.runs[0];
  const recentConfigPaths = state.configHistory.filter((item) => item.path !== configPath);

  async function startRun() {
    setError(null);
    setProgress("启动测试任务");
    setProgressLog(["启动测试任务"]);
    try {
      const nextState = await api.startRun({
        configPath: configPath.trim(),
        regionIds: selectedRegionIds as Array<"hong-kong" | "japan">,
      });
      setState(nextState);
      setSelectedRunId(nextState.runs[0]?.id ?? "all");
      setProgress("测试完成");
      setProgressLog((current) => [...current.slice(-17), "测试完成"]);
    } catch (caught) {
      setError(toErrorMessage(caught));
      setProgress("测试失败");
      setProgressLog((current) => [...current.slice(-17), `测试失败：${toErrorMessage(caught)}`]);
    }
  }

  async function exportCsv() {
    setError(null);
    try {
      const exported = await api.exportCsv(filters);
      setProgress(`已导出 CSV：${exported.detailsPath}`);
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  async function selectConfigFile() {
    setError(null);
    try {
      const selectedPath = await api.selectConfigFile({ currentPath: configPath });
      if (selectedPath) {
        setConfigPath(selectedPath);
        setProgress("已选择配置文件");
      }
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative border-b border-white/10 px-8 py-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(36,143,118,.28),transparent_30%),radial-gradient(circle_at_85%_0%,rgba(230,164,62,.20),transparent_28%)]" />
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge variant="outline" className="mb-4 border-emerald-700/40 bg-emerald-950/30 text-emerald-200">
                <Radar className="mr-1 h-3.5 w-3.5" />
                Latency Compass
              </Badge>
              <h1 className="font-display text-5xl font-semibold tracking-tight text-stone-50">
                直接看节点访问体验。
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-300">
                选择地区和日期，应用会用内置 Filter 跑同一批网站，并把结果存在 SQLite。CSV 只是导出，不再打断结果浏览。
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <ClashSpeedtestStatusPanel state={state.clashSpeedtest} />
              <div className="flex gap-3">
              <Button variant="outline" onClick={exportCsv} disabled={!state.results.length}>
                <Download className="h-4 w-4" />
                导出 CSV
              </Button>
              <Button
                onClick={startRun}
                disabled={!configPath.trim() || !selectedRegionIds.length || isPending || state.clashSpeedtest.status === "downloading"}
              >
                <Play className="h-4 w-4" />
                开始测试
              </Button>
              </div>
            </div>
          </div>

          <Card className="border-white/10 bg-stone-950/70 shadow-2xl shadow-black/20 backdrop-blur">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.4fr_.9fr_.9fr]">
              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-300">Clash/Mihomo 配置路径或订阅 URL</span>
                <div className="flex gap-2">
                  <Input
                    value={configPath}
                    onChange={(event) => setConfigPath(event.target.value)}
                    placeholder="/Users/nicholas/Library/Application Support/mihomo-party/profiles/config.yaml"
                  />
                  <Button type="button" variant="outline" onClick={selectConfigFile} className="shrink-0">
                    <FileSearch className="h-4 w-4" />
                    选择文件
                  </Button>
                </div>
                {recentConfigPaths.length ? (
                  <div className="flex flex-wrap gap-2">
                    {recentConfigPaths.map((item) => (
                      <Button
                        key={item.path}
                        type="button"
                        variant="secondary"
                        className="max-w-[260px] truncate px-3"
                        title={item.path}
                        onClick={() => setConfigPath(item.path)}
                      >
                        {shortenPath(item.path)}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </label>
              <div className="space-y-2">
                <span className="text-sm font-medium text-stone-300">地区预设</span>
                <div className="flex gap-2">
                  {state.regions.map((region) => (
                    <Button
                      key={region.id}
                      variant={selectedRegionIds.includes(region.id) ? "default" : "outline"}
                      onClick={() => toggleRegion(region.id)}
                    >
                      {region.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-stone-300">开始日期</span>
                  <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-stone-300">结束日期</span>
                  <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </label>
              </div>
              <div className="space-y-2 lg:col-span-3">
                <span className="text-sm font-medium text-stone-300">运行批次</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={selectedRunId === "all" ? "default" : "outline"}
                    className="h-9 px-3 text-xs"
                    onClick={() => setSelectedRunId("all")}
                  >
                    全部运行
                  </Button>
                  {state.runs.slice(0, 8).map((run) => (
                    <Button
                      key={run.id}
                      type="button"
                      variant={selectedRunId === run.id ? "default" : "outline"}
                      className="h-9 max-w-[260px] px-3 text-xs"
                      title={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      {formatRunOption(run)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-8 py-7 lg:grid-cols-4">
        <MetricCard icon={Gauge} label="最快延迟" value={summary.fastest} tone="emerald" />
        <MetricCard icon={ShieldCheck} label="本次可用率" value={summary.availability} tone="amber" />
        <MetricCard icon={Globe2} label="覆盖站点" value={`${summary.siteCount} 个`} tone="blue" />
        <MetricCard icon={CalendarDays} label="最近测试" value={latestRun ? formatDate(latestRun.startedAt) : "暂无"} tone="stone" />
      </section>

      <section className="mx-auto max-w-7xl px-8 pb-10">
        <Card className="overflow-hidden border-stone-800 bg-stone-950/80">
          <CardHeader className="flex flex-col gap-4 border-b border-stone-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>节点 × 网站延迟矩阵</CardTitle>
              <CardDescription>
                {progress}
                {error ? <span className="ml-3 text-red-300">{error}</span> : null}
              </CardDescription>
              <div className="mt-3 max-h-32 overflow-auto rounded-md border border-stone-800 bg-black/25 p-3 font-mono text-xs leading-5 text-stone-400">
                {progressLog.map((message, index) => (
                  <div key={`${index}-${message}`}>{message}</div>
                ))}
              </div>
            </div>
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索节点" className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-stone-100">单站点延迟排行</h2>
                  <p className="mt-1 text-sm text-stone-400">切换网站查看每个节点的直接测试结果，数值越短越适合优先尝试。</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {DEFAULT_SITES.map((site) => (
                    <Button
                      key={site.id}
                      type="button"
                      variant={site.id === selectedSite?.id ? "default" : "outline"}
                      className="h-8 px-3 text-xs"
                      onClick={() => setSelectedSiteId(site.id)}
                    >
                      {site.name}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="h-[360px] w-full">
                {availableChartRows.length ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={0}
                    minHeight={0}
                    initialDimension={{ width: 800, height: 360 }}
                  >
                    <BarChart
                      accessibilityLayer
                      data={availableChartRows.slice(0, 12)}
                      layout="vertical"
                      margin={{ left: 8, right: 36, top: 6, bottom: 8 }}
                    >
                      <CartesianGrid horizontal={false} stroke="rgba(120, 113, 108, 0.22)" />
                      <XAxis
                        type="number"
                        dataKey="latency"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}ms`}
                        tick={{ fill: "rgb(168 162 158)", fontSize: 12 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="proxyName"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        width={150}
                        tick={{ fill: "rgb(214 211 209)", fontSize: 12 }}
                        tickFormatter={truncateChartLabel}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(120, 113, 108, 0.12)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0]?.payload as (typeof availableChartRows)[number];
                          return (
                            <div className="rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-sm shadow-xl">
                              <div className="max-w-64 truncate font-medium text-stone-100">{row.proxyName}</div>
                              <div className="mt-1 text-stone-400">{row.regionLabel} / {selectedSite?.name}</div>
                              <div className="mt-1 font-semibold text-emerald-200">{row.latencyLabel}</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="latency" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={22}>
                        <LabelList
                          dataKey="latencyLabel"
                          position="right"
                          className="fill-stone-200 text-xs font-medium"
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-md border border-dashed border-stone-800 bg-black/20 text-sm text-stone-400">
                    当前筛选下没有 {selectedSite?.name ?? "该网站"} 的可绘图延迟数据。
                  </div>
                )}
              </div>
              {unavailableChartRows.length ? (
                <div className="mt-4 rounded-md border border-stone-800 bg-black/20 p-3">
                  <div className="mb-2 text-xs font-semibold text-stone-300">
                    {selectedSite?.name ?? "该网站"} 无可用延迟（{unavailableChartRows.length}）
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {unavailableChartRows.map((row) => (
                      <Badge
                        key={row.key}
                        variant="outline"
                        className="max-w-[260px] border-zinc-700 bg-zinc-900 text-zinc-300"
                        title={`${row.proxyName} / ${row.regionLabel} / ${row.runId}`}
                      >
                        <span className="truncate">{row.proxyName}</span>
                        <span className="ml-1 text-zinc-500">N/A</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );

  function toggleRegion(regionId: string) {
    setSelectedRegionIds((current) =>
      current.includes(regionId) ? current.filter((id) => id !== regionId) : [...current, regionId],
    );
  }
}

function ClashSpeedtestStatusPanel({ state }: { state: AppState["clashSpeedtest"] }) {
  const Icon = getClashSpeedtestStatusIcon(state.status, state.updateAvailable);
  const label = getClashSpeedtestStatusLabel(state);
  const detail = state.latestVersion
    ? `当前 ${state.version} / 最新 ${state.latestVersion}`
    : `当前 ${state.version} / 最新版本待确认`;

  return (
    <div className="w-full rounded-lg border border-stone-800 bg-stone-950/75 px-4 py-3 text-left shadow-xl shadow-black/10 lg:w-[390px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-100">
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                state.status === "downloading" || state.status === "checking-update" ? "animate-spin text-sky-300" : "",
                state.status === "ready" && !state.updateAvailable ? "text-emerald-300" : "",
                state.updateAvailable ? "text-amber-300" : "",
                state.status === "missing" || state.status === "error" ? "text-red-300" : "",
              )}
            />
            <span>{label}</span>
          </div>
          <div className="mt-1 text-xs text-stone-400">{detail}</div>
          <div className="mt-2 truncate text-xs text-stone-500" title={state.path ?? state.message}>
            {state.path ? shortenPath(state.path) : state.message}
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0", getClashSpeedtestBadgeClass(state))}>
          {state.updateAvailable ? "有更新" : state.status === "missing" ? "待下载" : state.status === "ready" ? "就绪" : "检查中"}
        </Badge>
      </div>
    </div>
  );
}

function getClashSpeedtestStatusIcon(status: AppState["clashSpeedtest"]["status"], updateAvailable: boolean | null) {
  if (status === "downloading" || status === "checking-update") return Loader2;
  if (status === "ready" && updateAvailable) return PackageCheck;
  if (status === "ready") return CheckCircle2;
  return AlertTriangle;
}

function getClashSpeedtestStatusLabel(state: AppState["clashSpeedtest"]) {
  if (state.status === "downloading") return "clash-speedtest 下载中";
  if (state.status === "checking-update") return "clash-speedtest 检查中";
  if (state.status === "missing") return "clash-speedtest 未下载";
  if (state.status === "error") return "clash-speedtest 状态异常";
  if (state.updateAvailable) return "clash-speedtest 已就绪，有更新";
  return "clash-speedtest 已就绪";
}

function getClashSpeedtestBadgeClass(state: AppState["clashSpeedtest"]) {
  if (state.updateAvailable) return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  if (state.status === "ready") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (state.status === "downloading" || state.status === "checking-update") return "border-sky-500/40 bg-sky-500/10 text-sky-200";
  return "border-red-500/40 bg-red-500/10 text-red-200";
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "blue" | "stone";
}) {
  return (
    <Card className="border-stone-800 bg-stone-950/75">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            tone === "emerald" && "bg-emerald-500/15 text-emerald-300",
            tone === "amber" && "bg-amber-500/15 text-amber-300",
            tone === "blue" && "bg-sky-500/15 text-sky-300",
            tone === "stone" && "bg-stone-500/15 text-stone-300",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm text-stone-400">{label}</div>
          <div className="text-2xl font-semibold text-stone-50">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function buildMatrixRows(results: AppState["results"], search: string): MatrixRow[] {
  const rows = new Map<string, MatrixRow>();
  const normalizedSearch = search.trim().toLowerCase();

  for (const result of results) {
    if (normalizedSearch && !result.proxyName.toLowerCase().includes(normalizedSearch)) continue;

    const key = `${result.runId}:${result.regionId}:${result.proxyId}`;
    const row = rows.get(key) ?? {
      key,
      runId: result.runId,
      proxyId: result.proxyId,
      proxyName: result.proxyName,
      proxyType: result.proxyType,
      regionLabel: result.regionLabel,
      values: {},
    };
    row.values[result.siteName] = result.latency;
    rows.set(key, row);
  }

  return Array.from(rows.values()).sort((a, b) => {
    const aBest = bestLatency(a.values);
    const bBest = bestLatency(b.values);
    return aBest - bBest;
  });
}

function selectRunScopedResults(results: AppState["results"], _runs: AppState["runs"], selectedRunId: string) {
  const runId = selectedRunId === "all" ? results[0]?.runId : selectedRunId;
  return runId ? results.filter((row) => row.runId === runId) : results;
}

function summarize(results: AppState["results"]) {
  const latencies = results.map((row) => latencyToMs(row.latency)).filter((value): value is number => value !== null);
  const fastest = latencies.length ? `${Math.min(...latencies).toFixed(0)}ms` : "暂无";
  const available = results.filter((row) => ["fast", "usable", "slow"].includes(latencyStatus(row.latency))).length;
  const availability = results.length ? `${Math.round((available / results.length) * 100)}%` : "暂无";
  const siteCount = new Set(results.map((row) => row.siteId)).size;
  return { fastest, availability, siteCount };
}

function truncateChartLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}…` : value;
}

function bestLatency(values: Record<string, string>) {
  const latencies = Object.values(values).map(latencyToMs).filter((value): value is number => value !== null);
  return latencies.length ? Math.min(...latencies) : Number.POSITIVE_INFINITY;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRunOption(run: AppState["runs"][number]) {
  const status = run.status === "completed" ? "完成" : run.status === "failed" ? "失败" : "运行中";
  return `${formatDate(run.startedAt)} / ${status} / ${shortenId(run.id)}`;
}

function shortenId(id: string) {
  return id.length > 18 ? id.slice(-18) : id;
}

function shortenPath(path: string) {
  const parts = path.split("/");
  if (parts.length <= 3) return path;
  return `${parts.at(-2)}/${parts.at(-1)}`;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
