import { Activity, CalendarDays, Circle, CircleDot, Download, Gauge, Globe2, Search, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import type { LatencyChartRow } from "../lib/chart-data";
import { cn } from "../lib/utils";
import { DEFAULT_SITES } from "../../../shared/domain";
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
  summary,
  latestRunLabel,
  availableChartRows,
  unavailableChartRows,
  progress,
  error,
  onExportCsv,
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
  summary: { fastest: string; availability: string; siteCount: number };
  latestRunLabel: string;
  availableChartRows: LatencyChartRow[];
  unavailableChartRows: LatencyChartRow[];
  progress: string;
  error: string | null;
  onExportCsv: () => void;
}) {
  const selectedSite = DEFAULT_SITES.find((site) => site.id === selectedSiteId) ?? DEFAULT_SITES[0];

  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-5 px-8 py-7 lg:grid-cols-4">
        <MetricCard icon={Gauge} label="最快延迟" value={summary.fastest} tone="emerald" />
        <MetricCard icon={ShieldCheck} label="本次可用率" value={summary.availability} tone="amber" />
        <MetricCard icon={Globe2} label="覆盖站点" value={`${summary.siteCount} 个`} tone="blue" />
        <MetricCard icon={CalendarDays} label="最近测试" value={latestRunLabel} tone="stone" />
      </section>

      <section className="mx-auto max-w-7xl px-8 pb-10">
        <Card className="border-white/10 bg-stone-950/70 shadow-2xl shadow-black/20 backdrop-blur">
          <CardHeader className="border-b border-stone-800">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle className="text-3xl">结果分析</CardTitle>
                <CardDescription className="mt-2">
                  基于已保存的运行记录筛选、比对和导出结果。
                  {error ? <span className="ml-3 text-red-300">{error}</span> : null}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-stone-300">开始日期</span>
                  <Input type="date" value={fromDate} onChange={(event) => onFromDateChange(event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-stone-300">结束日期</span>
                  <Input type="date" value={toDate} onChange={(event) => onToDateChange(event.target.value)} />
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-5">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr_auto]">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-stone-300">运行批次</span>
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                    单选
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 rounded-2xl border border-stone-800 bg-black/20 p-2" role="radiogroup" aria-label="运行批次单选">
                  <Button
                    type="button"
                    variant="ghost"
                    role="radio"
                    aria-checked={selectedRunId === "all"}
                    className={cn(
                      "h-9 px-3 text-xs",
                      selectedRunId === "all"
                        ? "bg-amber-500/15 text-amber-100 hover:bg-amber-500/20"
                        : "text-stone-400 hover:bg-stone-900 hover:text-stone-100",
                    )}
                    onClick={() => onSelectedRunIdChange("all")}
                  >
                    {selectedRunId === "all" ? <CircleDot className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    全部运行
                  </Button>
                  {state.runs.slice(0, 8).map((run) => (
                    <Button
                      key={run.id}
                      type="button"
                      variant="ghost"
                      role="radio"
                      aria-checked={selectedRunId === run.id}
                      className={cn(
                        "h-9 max-w-[260px] px-3 text-xs",
                        selectedRunId === run.id
                          ? "bg-amber-500/15 text-amber-100 hover:bg-amber-500/20"
                          : "text-stone-400 hover:bg-stone-900 hover:text-stone-100",
                      )}
                      title={run.id}
                      onClick={() => onSelectedRunIdChange(run.id)}
                    >
                      {selectedRunId === run.id ? <CircleDot className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      {formatRunOption(run)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="搜索节点" className="pl-9" />
              </div>

              <Button variant="outline" onClick={onExportCsv} disabled={!state.results.length}>
                <Download className="h-4 w-4" />
                导出 CSV
              </Button>
            </div>

            <Card className="border-stone-800 bg-stone-950/80">
              <CardHeader className="border-b border-stone-800">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>单站点延迟排行</CardTitle>
                    <CardDescription className="mt-2">{progress}</CardDescription>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {DEFAULT_SITES.map((site) => (
                      <Button
                        key={site.id}
                        type="button"
                        variant={site.id === selectedSite?.id ? "default" : "outline"}
                        className="h-8 px-3 text-xs"
                        onClick={() => onSelectedSiteIdChange(site.id)}
                      >
                        {site.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="h-[360px] w-full">
                  {availableChartRows.length ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 360 }}>
                      <BarChart accessibilityLayer data={availableChartRows.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 36, top: 6, bottom: 8 }}>
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
                            const row = payload[0]?.payload as LatencyChartRow;
                            return (
                              <div className="rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-sm shadow-xl">
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
                          <span className="ml-1 text-zinc-500">{row.proxyType} / N/A</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </section>
    </>
  );
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

function truncateChartLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}…` : value;
}
