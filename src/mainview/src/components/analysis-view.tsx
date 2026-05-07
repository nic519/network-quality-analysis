import { Activity, Circle, CircleDot, Copy, Download, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { CardDescription, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import type { LatencyChartRow } from "../lib/chart-data";
import { cn } from "../lib/utils";
import { DEFAULT_SITES, latencyToMs } from "../../../shared/domain";
import type { AppState } from "../../../shared/rpc";

export function AnalysisView({
  state,
  selectedRunId,
  onSelectedRunIdChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  search,
  onSearchChange,
  selectedSiteId,
  onSelectedSiteIdChange,
  progress,
  error,
  onCopyResults,
  onExportAllResults,
}: {
  state: AppState;
  selectedRunId: string;
  onSelectedRunIdChange: (value: string) => void;
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedSiteId: string;
  onSelectedSiteIdChange: (value: string) => void;
  progress: string;
  error: string | null;
  onCopyResults: () => void;
  onExportAllResults: () => void;
}) {
  const selectedSite = DEFAULT_SITES.find((site) => site.id === selectedSiteId) ?? DEFAULT_SITES[0];
  const selectedRun = state.runs.find((run) => run.id === selectedRunId) ?? null;
  const runItems = state.runs.slice(0, 12);
  const scopedResults = filterScopedResults(state.results, selectedRunId);
  const chartRows = buildRunScopedChartRows(scopedResults, search, selectedSite?.name);
  const availableChartRows = chartRows.filter((row) => row.isAvailable);
  const failedSiteRows = buildFailedSiteRows(scopedResults, search);

  return (
    <section className="mx-auto max-w-7xl px-8 pb-10">
      <div className="overflow-hidden rounded-[28px] border border-white/8 bg-stone-950/85 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur">
        <div className="grid min-h-[720px] lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border-r border-stone-900/90 bg-[linear-gradient(180deg,rgba(18,18,17,0.98),rgba(12,12,11,0.95))]">
            <div className="border-b border-stone-900 px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Run Explorer</div>
                  <CardTitle className="mt-2 text-[22px]">运行批次</CardTitle>
                </div>
                <Badge variant="outline" className="border-stone-700 bg-stone-900/80 text-stone-300">
                  {state.runs.length} 条
                </Badge>
              </div>
              <CardDescription className="mt-2">
                选择一个批次查看单次结果，或切回全部运行查看当前日期范围内的汇总。
              </CardDescription>
            </div>

            <div className="border-b border-stone-900 px-4 py-3">
              <button
                type="button"
                role="radio"
                aria-checked={selectedRunId === "all"}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                  selectedRunId === "all"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-50 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]"
                    : "border-transparent bg-stone-950/50 text-stone-300 hover:border-stone-800 hover:bg-stone-900/80",
                )}
                onClick={() => onSelectedRunIdChange("all")}
              >
                <div className="mt-0.5 text-stone-500">
                  {selectedRunId === "all" ? <CircleDot className="h-4 w-4 text-emerald-300" /> : <Circle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-stone-100">全部运行</span>
                    <span className="text-xs text-stone-500">{state.results.length} 条结果</span>
                  </div>
                  <div className="mt-1 text-xs text-stone-500">按日期范围聚合当前历史记录</div>
                </div>
              </button>
            </div>

            <div className="custom-scrollbar max-h-[calc(100vh-280px)] overflow-auto px-3 py-3" role="radiogroup" aria-label="运行批次">
              <div className="space-y-2">
                {runItems.map((run) => {
                  const isActive = selectedRunId === run.id;
                  return (
                    <button
                      key={run.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                        isActive
                          ? "border-amber-500/35 bg-amber-500/10 text-amber-50 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.18)]"
                          : "border-transparent bg-transparent text-stone-300 hover:border-stone-800 hover:bg-stone-900/75",
                      )}
                      title={run.id}
                      onClick={() => onSelectedRunIdChange(run.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="truncate font-medium text-stone-100">{shortenId(run.id)}</span>
                          <span className="truncate text-stone-500">{formatRunRegion(run, state.results)}</span>
                        </div>
                        <div className="mt-1 text-xs text-stone-500">{formatDate(run.startedAt)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="bg-[linear-gradient(180deg,rgba(20,20,18,0.96),rgba(12,12,11,0.98))]">
            <div className="border-b border-stone-900 px-6 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">From</span>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(event) => onFromDateChange(event.target.value)}
                      className="w-[176px] border-stone-800 bg-stone-950/90 text-stone-100"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">To</span>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(event) => onToDateChange(event.target.value)}
                      className="w-[176px] border-stone-800 bg-stone-950/90 text-stone-100"
                    />
                  </label>
                  <label className="relative w-full max-w-[320px] space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Search</span>
                    <Search className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-stone-500" />
                    <Input
                      value={search}
                      onChange={(event) => onSearchChange(event.target.value)}
                      placeholder="搜索节点名称"
                      className="h-11 border-stone-800 bg-stone-950/90 pl-9 text-stone-100 placeholder:text-stone-500"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="h-11 border-stone-800 bg-stone-950/90 text-stone-200 hover:bg-stone-900" onClick={onCopyResults} disabled={!state.results.length}>
                    <Copy className="h-4 w-4" />
                    复制结果
                  </Button>
                  <Button variant="outline" className="h-11 border-stone-800 bg-stone-950/90 text-stone-200 hover:bg-stone-900" onClick={onExportAllResults} disabled={!state.results.length}>
                    <Download className="h-4 w-4" />
                    导出所有结果
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {DEFAULT_SITES.map((site) => {
                  const active = site.id === selectedSite?.id;
                  return (
                    <Button
                      key={site.id}
                      type="button"
                      variant="ghost"
                      className={cn(
                        "h-10 rounded-full border px-4 text-sm",
                        active
                          ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18"
                          : "border-stone-800 bg-stone-950/80 text-stone-400 hover:bg-stone-900 hover:text-stone-100",
                      )}
                      onClick={() => onSelectedSiteIdChange(site.id)}
                    >
                      {site.name}
                    </Button>
                  );
                })}
              </div>
              {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
            </div>

            <div className="grid gap-0">
              <section className="min-w-0 border-b border-stone-900 px-6 py-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="text-sm text-stone-400">
                    {selectedRun ? `当前批次 · ${formatDate(selectedRun.startedAt)}` : progress}
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-stone-800 bg-stone-950/80 px-3 py-2 text-xs text-stone-400">
                    <Activity className="h-3.5 w-3.5 text-emerald-300" />
                    <span>{selectedSite?.name}</span>
                  </div>
                </div>

                <div className="h-[420px] rounded-[24px] border border-stone-900 bg-black/20 px-3 py-3">
                  {availableChartRows.length ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 420 }}>
                      <BarChart accessibilityLayer data={availableChartRows.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 36, top: 8, bottom: 8 }}>
                        <CartesianGrid horizontal={false} stroke="rgba(120, 113, 108, 0.18)" />
                        <XAxis
                          type="number"
                          dataKey="latency"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `${value}ms`}
                          tick={{ fill: "rgb(120 113 108)", fontSize: 12 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="proxyName"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          width={168}
                          tick={{ fill: "rgb(214 211 209)", fontSize: 12 }}
                          tickFormatter={truncateChartLabel}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(120, 113, 108, 0.10)" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload[0]?.payload as LatencyChartRow;
                            return (
                              <div className="rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm shadow-xl">
                                <div className="max-w-64 truncate font-medium text-stone-100">{row.proxyName}</div>
                                <div className="mt-1 text-stone-400">
                                  {row.proxyType} / {row.regionLabel} / {selectedSite?.name}
                                </div>
                                <div className="mt-1 font-semibold text-emerald-200">{row.latencyLabel}</div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="latency" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={22}>
                          <LabelList dataKey="proxyType" position="insideLeft" className="fill-primary-foreground text-xs font-semibold" />
                          <LabelList dataKey="latencyLabel" position="right" className="fill-stone-200 text-xs font-medium" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-stone-800 bg-stone-950/60 text-sm text-stone-500">
                      当前筛选下没有 {selectedSite?.name ?? "该网站"} 的可绘图延迟数据。
                    </div>
                  )}
                </div>

                <section className="mt-6">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Failures</div>
                  <div className="mt-3 rounded-[22px] border border-stone-900 bg-stone-950/70 p-4">
                    <div className="mb-3 text-sm font-medium text-stone-100">测试失败记录</div>
                    {failedSiteRows.length ? (
                      <div className="custom-scrollbar max-h-[260px] overflow-auto rounded-2xl border border-stone-800 bg-black/20">
                        <Table>
                          <TableHeader className="[&_tr]:border-stone-800">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="h-10 px-3 text-[11px] uppercase tracking-[0.16em] text-stone-500">节点</TableHead>
                              <TableHead className="h-10 px-3 text-[11px] uppercase tracking-[0.16em] text-stone-500">失败网站</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="[&_tr:last-child]:border-stone-800">
                            {failedSiteRows.map((row) => (
                              <TableRow key={row.key} className="border-stone-800 hover:bg-stone-900/40">
                                <TableCell className="px-3 py-2.5">
                                  <div className="truncate text-sm text-stone-100">
                                    <span className="font-medium">{row.proxyName}</span>
                                    <span className="mx-2 text-stone-600">·</span>
                                    <span className="text-xs text-stone-500">
                                      {row.proxyType} / {row.regionLabel}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="px-3 py-2.5">
                                  <div className="flex flex-wrap gap-1.5">
                                    {row.failedSites.map((siteName) => (
                                      <Badge key={`${row.key}-${siteName}`} variant="outline" className="border-stone-700 bg-stone-900/80 text-stone-300">
                                        {siteName}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-sm leading-6 text-stone-500">当前批次或时间范围内没有失败记录。</div>
                    )}
                  </div>
                </section>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildRunScopedChartRows(
  results: AppState["results"],
  search: string,
  siteName?: string,
) {
  const normalizedSearch = search.trim().toLowerCase();
  const rowsByProxy = new Map<string, LatencyChartRow>();

  for (const result of results) {
    if (siteName && result.siteName !== siteName) continue;
    if (normalizedSearch && !result.proxyName.toLowerCase().includes(normalizedSearch)) continue;

    const existing = rowsByProxy.get(result.proxyId);
    const latency = latencyToMs(result.latency);
    const nextRow: LatencyChartRow = {
      key: `${result.proxyId}:${result.regionId}:${result.siteName}`,
      proxyName: result.proxyName,
      proxyType: result.proxyType,
      regionLabel: result.regionLabel,
      latency,
      latencyLabel: result.latency,
      isAvailable: latency !== null,
      runId: result.runId,
    };

    if (!existing) {
      rowsByProxy.set(result.proxyId, nextRow);
      continue;
    }

    if (existing.isAvailable && !nextRow.isAvailable) continue;
    if (!existing.isAvailable && nextRow.isAvailable) {
      rowsByProxy.set(result.proxyId, nextRow);
      continue;
    }

    if (nextRow.latency !== null && existing.latency !== null && nextRow.latency < existing.latency) {
      rowsByProxy.set(result.proxyId, nextRow);
    }
  }

  return [...rowsByProxy.values()].sort((left, right) => {
    if (left.isAvailable !== right.isAvailable) return left.isAvailable ? -1 : 1;
    if (left.latency !== null && right.latency !== null) return left.latency - right.latency;
    return left.proxyName.localeCompare(right.proxyName, "zh-CN");
  });
}

function filterScopedResults(results: AppState["results"], selectedRunId: string) {
  return selectedRunId === "all" ? results : results.filter((result) => result.runId === selectedRunId);
}

function buildFailedSiteRows(results: AppState["results"], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  const failures = new Map<
    string,
    {
      key: string;
      proxyName: string;
      proxyType: string;
      regionLabel: string;
      failedSites: string[];
    }
  >();

  for (const result of results) {
    if (normalizedSearch && !result.proxyName.toLowerCase().includes(normalizedSearch)) continue;
    if (latencyToMs(result.latency) !== null) continue;

    const key = result.proxyId;
    const existing = failures.get(key);
    if (!existing) {
      failures.set(key, {
        key,
        proxyName: result.proxyName,
        proxyType: result.proxyType,
        regionLabel: result.regionLabel,
        failedSites: [result.siteName],
      });
      continue;
    }

    if (!existing.failedSites.includes(result.siteName)) {
      existing.failedSites.push(result.siteName);
    }
  }

  return [...failures.values()].sort((left, right) => {
    const proxyCompare = left.proxyName.localeCompare(right.proxyName, "zh-CN");
    if (proxyCompare !== 0) return proxyCompare;
    return left.failedSites.length - right.failedSites.length;
  });
}

function formatRunRegion(run: AppState["runs"][number], results: AppState["results"]) {
  const regions = Array.from(new Set(results.filter((item) => item.runId === run.id).map((item) => item.regionLabel)));
  return regions.length ? regions.join(" / ") : run.selectedRegions.join(" / ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortenId(id: string) {
  return id.length > 18 ? id.slice(-18) : id;
}

function truncateChartLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}…` : value;
}
