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
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { api, onClashSpeedtestStatus, onProgress } from "./lib/electrobun";
import { cn } from "./lib/utils";
import { DEFAULT_SITES, REGION_PRESETS, latencyStatus, latencyToMs } from "../../shared/domain";
import type { AppState } from "../../shared/rpc";

type MatrixRow = {
  key: string;
  proxyId: string;
  proxyName: string;
  proxyType: string;
  regionLabel: string;
  values: Record<string, string>;
};

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
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState("");
  const [progress, setProgress] = useState("准备就绪");
  const [progressLog, setProgressLog] = useState<string[]>(["准备就绪"]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filters = useMemo(
    () => ({
      regionIds: selectedRegionIds,
      fromDate: `${fromDate}T00:00:00.000Z`,
      toDate: `${toDate}T23:59:59.999Z`,
    }),
    [fromDate, selectedRegionIds, toDate],
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
  const summary = useMemo(() => summarize(state.results), [state.results]);
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
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-8 py-7 lg:grid-cols-4">
        <MetricCard icon={Gauge} label="最快延迟" value={summary.fastest} tone="emerald" />
        <MetricCard icon={ShieldCheck} label="可用率" value={summary.availability} tone="amber" />
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
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-stone-800">
                  <TableHead className="w-[280px]">节点</TableHead>
                  <TableHead>地区</TableHead>
                  {DEFAULT_SITES.map((site) => (
                    <TableHead key={site.id}>{site.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrixRows.map((row) => (
                  <TableRow key={row.key} className="border-stone-900">
                    <TableCell>
                      <div className="font-medium text-stone-100">{row.proxyName}</div>
                      <div className="text-xs text-stone-500">{row.proxyType}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.regionLabel}</Badge>
                    </TableCell>
                    {DEFAULT_SITES.map((site) => (
                      <TableCell key={site.id}>
                        <LatencyPill value={row.values[site.name] ?? "N/A"} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {!matrixRows.length ? (
                  <TableRow>
                    <TableCell colSpan={DEFAULT_SITES.length + 2} className="h-40 text-center text-stone-400">
                      还没有匹配结果。选择配置并开始测试，或者调整日期/地区筛选。
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
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

function LatencyPill({ value }: { value: string }) {
  const status = latencyStatus(value);
  const icon = status === "fast" ? "●" : status === "usable" ? "●" : status === "slow" ? "▲" : status === "failed" ? "×" : "○";
  return (
    <span
      className={cn(
        "inline-flex min-w-24 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
        status === "fast" && "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30",
        status === "usable" && "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30",
        status === "slow" && "bg-red-500/15 text-red-200 ring-1 ring-red-400/30",
        status === "failed" && "bg-zinc-700/70 text-zinc-300 ring-1 ring-zinc-500/30",
        status === "missing" && "bg-zinc-900 text-zinc-500 ring-1 ring-zinc-700",
      )}
    >
      <span>{icon}</span>
      {value}
    </span>
  );
}

function buildMatrixRows(results: AppState["results"], search: string): MatrixRow[] {
  const rows = new Map<string, MatrixRow>();
  const normalizedSearch = search.trim().toLowerCase();

  for (const result of results) {
    if (normalizedSearch && !result.proxyName.toLowerCase().includes(normalizedSearch)) continue;

    const key = `${result.regionId}:${result.proxyId}`;
    const row = rows.get(key) ?? {
      key,
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

function summarize(results: AppState["results"]) {
  const latencies = results.map((row) => latencyToMs(row.latency)).filter((value): value is number => value !== null);
  const fastest = latencies.length ? `${Math.min(...latencies).toFixed(0)}ms` : "暂无";
  const available = results.filter((row) => ["fast", "usable", "slow"].includes(latencyStatus(row.latency))).length;
  const availability = results.length ? `${Math.round((available / results.length) * 100)}%` : "暂无";
  const siteCount = new Set(results.map((row) => row.siteId)).size;
  return { fastest, availability, siteCount };
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

function shortenPath(path: string) {
  const parts = path.split("/");
  if (parts.length <= 3) return path;
  return `${parts.at(-2)}/${parts.at(-1)}`;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
