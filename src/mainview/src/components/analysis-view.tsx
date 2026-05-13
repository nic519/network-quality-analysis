import { AlertCircle, Circle, CircleDot, Copy, Gauge, Globe2, Search, ShieldCheck, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import type { LatencyChartRow } from "../lib/chart-data";
import { formatRunRegionLabels } from "../lib/run-region-label";
import { cn } from "../lib/utils";
import { latencyToMs } from "../../../shared/domain";
import type { SiteDefinition } from "../../../shared/domain";
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
  error,
  onCopyResults,
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
  error: string | null;
  onCopyResults: () => void;
}) {
  const selectableSites = buildSelectableSites(state.sites, state.results);
  const selectedSite = selectableSites.find((site) => site.id === selectedSiteId) ?? selectableSites[0];
  const runItems = state.runs.slice(0, 12);
  const scopedResults = filterScopedResults(state.results, selectedRunId);
  const chartRows = buildRunScopedChartRows(scopedResults, search, selectedSite?.name);
  const availableChartRows = chartRows.filter((row) => row.isAvailable);
  const failedSiteRows = buildFailedSiteRows(scopedResults, search);
  const probeRows = buildProbeRows(scopedResults, search);
  const fastestRow = availableChartRows[0];

  return (
    <section className="h-full min-h-0">
      <div className="grid h-full min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-border bg-secondary/25">
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <div>
              <h1 className="text-base font-semibold text-foreground">历史测试</h1>
              <p className="text-xs text-muted-foreground">选择一次测速，或查看所有历史。</p>
            </div>
            <Badge variant="outline" className="border-border bg-secondary text-muted-foreground">
              {state.runs.length} 条
            </Badge>
          </div>

          <div className="border-b border-border p-2">
            <button
              type="button"
              role="radio"
              aria-checked={selectedRunId === "all"}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                selectedRunId === "all" ? "bg-accent text-accent-foreground" : "text-secondary-foreground hover:bg-accent/65",
              )}
              onClick={() => onSelectedRunIdChange("all")}
            >
              {selectedRunId === "all" ? <CircleDot className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className="min-w-0 flex-1 font-medium">全部运行</span>
              <span className="text-xs text-muted-foreground">{state.results.length}</span>
            </button>
          </div>

          <ScrollArea className="min-h-0 flex-1 p-2" viewportClassName="h-full" contentClassName="space-y-1">
            <div role="radiogroup" aria-label="历史测试" className="space-y-1">
              {runItems.map((run) => {
                const isActive = selectedRunId === run.id;
                return (
                  <button
                    key={run.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors",
                      isActive ? "bg-accent text-accent-foreground" : "text-secondary-foreground hover:bg-accent/65",
                    )}
                    title={run.id}
                    onClick={() => onSelectedRunIdChange(run.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="truncate font-medium">{shortenId(run.id)}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {formatRunRegionLabels({ run, results: state.results, regions: state.regions })}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(run.startedAt)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        <div className="custom-scrollbar min-h-0 min-w-0 overflow-y-auto">
          <div className="shrink-0 border-b border-border px-5 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">开始日期</span>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(event) => onFromDateChange(event.target.value)}
                  className="h-8 w-[132px] rounded-none border-0 border-b border-input bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">结束日期</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(event) => onToDateChange(event.target.value)}
                  className="h-8 w-[132px] rounded-none border-0 border-b border-input bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                />
              </label>
              <label className="relative min-w-[220px] max-w-[320px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="搜索节点名称"
                  className="pl-9"
                />
              </label>

            </div>
            {error ? <div className="mt-2 text-sm text-destructive">{error}</div> : null}
          </div>

          <div className="min-w-0 px-5 py-5">
            <section className="min-w-0">
              <div className="mb-5">
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">结果摘要</h2>
                  <span className="text-xs text-muted-foreground">先看结论，再看图表明细</span>
                </div>
                <div className="mb-3 grid gap-2 lg:grid-cols-3">
                  <SummaryTile
                    icon={Gauge}
                    label="最快节点"
                    value={fastestRow ? fastestRow.proxyName : "暂无"}
                    detail={fastestRow ? `${fastestRow.latencyLabel} / ${selectedSite?.name ?? "当前网站"}` : "完成测速后显示"}
                  />
                  <SummaryTile
                    icon={ShieldCheck}
                    label="可用节点"
                    value={`${availableChartRows.length}/${chartRows.length}`}
                    detail={selectedSite ? `${selectedSite.name} 下可绘图延迟` : "当前筛选范围"}
                  />
                  <SummaryTile
                    icon={AlertCircle}
                    label="失败节点"
                    value={`${failedSiteRows.length}`}
                    detail={failedSiteRows.length ? "下方失败记录可查看网站" : "当前范围没有失败记录"}
                  />
                </div>
                {probeRows.length ? (
                  <section className="mb-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Globe2 className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-semibold text-foreground">出口信息</h2>
                      <span className="text-xs text-muted-foreground">按节点 ID 合并展示 probe 结果</span>
                    </div>
                    <ProbeTable rows={probeRows} />
                  </section>
                ) : null}
              </div>

              <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {selectableSites.map((site) => {
                    const active = site.id === selectedSite?.id;
                    return (
                      <Button
                        key={site.id}
                        type="button"
                        variant="ghost"
                        className={cn(
                          "h-8 rounded-md px-3 text-sm",
                          active
                            ? "bg-accent text-accent-foreground hover:bg-accent"
                            : "text-muted-foreground hover:bg-accent/65 hover:text-foreground",
                        )}
                        onClick={() => onSelectedSiteIdChange(site.id)}
                      >
                        {site.name}
                      </Button>
                    );
                  })}
                </div>
                <Button className="ml-auto shrink-0" variant="outline" onClick={onCopyResults} disabled={!state.results.length}>
                  <Copy className="h-4 w-4" />
                  复制结果
                </Button>
              </div>

              <div className="h-[420px] rounded-md border border-border bg-card/45 px-3 py-3">
                {availableChartRows.length ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 420 }}>
                    <BarChart accessibilityLayer data={availableChartRows.slice(0, 12)} layout="vertical" margin={{ left: 0, right: 44, top: 8, bottom: 8 }}>
                        <CartesianGrid horizontal={false} stroke="rgba(120, 120, 128, 0.18)" />
                        <XAxis
                          type="number"
                          dataKey="latency"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `${value}ms`}
                          tick={{ fill: "rgb(142 142 147)", fontSize: 12 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="proxyName"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          width={220}
                          tick={<ChartYAxisTick />}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(120, 120, 128, 0.10)" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload[0]?.payload as LatencyChartRow;
                            return (
                              <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                                <div className="max-w-64 truncate font-medium text-foreground">{row.proxyName}</div>
                                <div className="mt-1 text-muted-foreground">
                                  {row.proxyType} / {row.regionLabel} / {selectedSite?.name}
                                </div>
                                <div className="mt-1 font-semibold text-primary">{row.latencyLabel}</div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="latency" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={22}>
                          <LabelList dataKey="proxyType" position="insideLeft" className="fill-primary-foreground text-xs font-semibold" />
                          <LabelList dataKey="latencyLabel" position="right" className="fill-current text-xs font-medium text-foreground" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border bg-secondary/30 text-sm text-muted-foreground">
                      当前筛选下没有 {selectedSite?.name ?? "该网站"} 的可绘图延迟数据。
                    </div>
                  )}
              </div>

              <section className="mt-6">
                <div className="text-xs font-medium text-muted-foreground">失败记录</div>
                {failedSiteRows.length ? (
                  <FailureTable rows={failedSiteRows} />
                ) : (
                  <div className="mt-3 text-sm leading-6 text-muted-foreground">当前批次或时间范围内没有失败记录。</div>
                )}
              </section>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card/45 px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="truncate text-sm font-semibold text-foreground" title={value}>
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground" title={detail}>
        {detail}
      </div>
    </div>
  );
}

function ProbeTable({ rows }: { rows: ReturnType<typeof buildProbeRows> }) {
  return (
    <div className="rounded-md border border-border bg-card/45">
      <Table>
        <TableHeader className="[&_tr]:border-border">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">节点</TableHead>
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">出口 IP</TableHead>
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">地区</TableHead>
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">ASN / 组织</TableHead>
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">Probe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-0">
          {rows.slice(0, 12).map((row) => (
            <TableRow key={row.key} className="border-border hover:bg-accent/35">
              <TableCell className="max-w-[260px] px-3 py-2">
                <div className="truncate text-sm font-medium text-foreground" title={row.proxyName}>
                  {row.proxyName}
                </div>
                <div className="mt-0.5 text-xs leading-4 text-muted-foreground">
                  {row.proxyType} / {row.regionLabel}
                </div>
              </TableCell>
              <TableCell className="px-3 py-2 text-sm text-foreground">
                <div className="break-all leading-5">{row.probeIp || "N/A"}</div>
              </TableCell>
              <TableCell className="px-3 py-2">
                <ProbeLocationCell row={row} />
              </TableCell>
              <TableCell className="max-w-[260px] px-3 py-2">
                <ProbeAsnCell row={row} />
              </TableCell>
              <TableCell className="px-3 py-2 text-xs leading-4 text-muted-foreground">
                {row.probeStatus ? `${row.probeStatus} / ${row.probeLatency || "N/A"}` : row.probeError || "N/A"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProbeLocationCell({ row }: { row: ReturnType<typeof buildProbeRows>[number] }) {
  const [line1, line2] = formatProbeLocationLines(row);

  if (!line1 && !line2) {
    return <div className="text-sm leading-5 text-muted-foreground">N/A</div>;
  }

  return (
    <div title={formatProbeLocationTitle(row)}>
      {line1 ? <div className="text-sm leading-5 text-muted-foreground">{line1}</div> : null}
      {line2 ? <div className="text-xs leading-4 text-muted-foreground">{line2}</div> : null}
    </div>
  );
}

function ProbeAsnCell({ row }: { row: ReturnType<typeof buildProbeRows>[number] }) {
  const hasAsn = Boolean(row.probeAsn);
  const hasOrg = Boolean(row.probeOrg);

  if (!hasAsn && !hasOrg) {
    return <div className="text-sm leading-5 text-foreground">N/A</div>;
  }

  return (
    <div title={row.probeOrg || row.probeAsn || "N/A"}>
      {hasAsn ? <div className="truncate text-sm leading-5 text-foreground">{row.probeAsn}</div> : null}
      {hasOrg ? <div className="truncate text-xs leading-4 text-muted-foreground">{row.probeOrg}</div> : null}
    </div>
  );
}

function FailureTable({ rows }: { rows: ReturnType<typeof buildFailedSiteRows> }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-card/45">
      <Table>
        <TableHeader className="[&_tr]:border-border">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">节点</TableHead>
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">失败网站</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-0">
          {rows.map((row) => (
            <TableRow key={row.key} className="border-border hover:bg-accent/35">
              <TableCell className="px-3 py-2.5">
                <div className="truncate text-sm text-foreground">
                  <span className="font-medium">{row.proxyName}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    {row.proxyType} / {row.regionLabel}
                  </span>
                </div>
              </TableCell>
              <TableCell className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {row.failedSites.map((siteName) => (
                    <Badge key={`${row.key}-${siteName}`} variant="outline" className="border-border bg-secondary text-secondary-foreground">
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
  );
}

function buildProbeRows(results: AppState["results"], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  const rows = new Map<string, {
    key: string;
    proxyName: string;
    proxyType: string;
    regionLabel: string;
    probeIp: string;
    probeCountry: string;
    probeCountryCode: string;
    probeRegion: string;
    probeCity: string;
    probeAsn: string;
    probeOrg: string;
    probeLatency: string;
    probeStatus: string;
    probeError: string;
  }>();

  for (const result of results) {
    if (normalizedSearch && !result.proxyName.toLowerCase().includes(normalizedSearch)) continue;
    if (!result.probeIp && !result.probeStatus && !result.probeError) continue;
    const nextRow = makeProbeRow(result);
    const existing = rows.get(result.proxyId);
    if (existing && probeResultScore(existing) >= probeResultScore(nextRow)) continue;
    rows.set(result.proxyId, nextRow);
  }

  return [...rows.values()].sort((a, b) => a.proxyName.localeCompare(b.proxyName, "zh-CN"));
}

function makeProbeRow(result: AppState["results"][number]) {
  return {
    key: result.proxyId,
    proxyName: result.proxyName,
    proxyType: result.proxyType,
    regionLabel: result.regionLabel,
    probeIp: result.probeIp ?? "",
    probeCountry: result.probeCountry ?? "",
    probeCountryCode: result.probeCountryCode ?? "",
    probeRegion: result.probeRegion ?? "",
    probeCity: result.probeCity ?? "",
    probeAsn: result.probeAsn ?? "",
    probeOrg: result.probeOrg ?? "",
    probeLatency: result.probeLatency ?? "",
    probeStatus: result.probeStatus ?? "",
    probeError: result.probeError ?? "",
  };
}

function probeResultScore(row: ReturnType<typeof makeProbeRow>) {
  if (row.probeIp) return 3;
  if (row.probeStatus && !row.probeError) return 2;
  if (row.probeStatus) return 1;
  return 0;
}

function formatProbeLocationLines(row: ReturnType<typeof buildProbeRows>[number]) {
  const line1 = [row.probeCountryCode, row.probeCountry].filter(Boolean).join(" / ");
  const line2 = [row.probeRegion, row.probeCity].filter(Boolean).join(" / ");
  return [line1, line2] as const;
}

function formatProbeLocationTitle(row: ReturnType<typeof buildProbeRows>[number]) {
  const [line1, line2] = formatProbeLocationLines(row);
  return [line1, line2].filter(Boolean).join(" / ") || "N/A";
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

function buildSelectableSites(sites: SiteDefinition[], results: AppState["results"]) {
  const siteMap = new Map<string, SiteDefinition>();
  for (const site of sites) siteMap.set(site.id, site);
  for (const result of results) {
    if (!siteMap.has(result.siteId)) {
      siteMap.set(result.siteId, {
        id: result.siteId,
        name: result.siteName,
        url: result.siteUrl,
      });
    }
  }
  return [...siteMap.values()];
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

function ChartYAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const label = payload?.value ?? "";
  const width = 208;

  return (
    <g>
      <title>{label}</title>
      <foreignObject x={x - width - 8} y={y - 12} width={width} height={24}>
        <div className="flex h-6 justify-end pr-1">
          <span className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-xs font-medium leading-6 text-foreground">
            {label}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}
