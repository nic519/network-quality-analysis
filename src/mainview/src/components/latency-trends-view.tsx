import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, LineChart as LineChartIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "./ui/button";
import { buildLatencyTrendModel, type LatencyTrendChartRow, type LatencyTrendProxyRow } from "../lib/latency-trends";
import { cn } from "../lib/utils";
import type { AppState } from "../../../shared/rpc";

const maxDefaultProxyCount = 8;

export function LatencyTrendsView({
  state,
  selectedRegionId,
  onSelectedRegionIdChange,
  selectedSiteId,
  onSelectedSiteIdChange,
}: {
  state: AppState;
  selectedRegionId: string;
  onSelectedRegionIdChange: (regionId: string) => void;
  selectedSiteId: string;
  onSelectedSiteIdChange: (siteId: string) => void;
}) {
  const [selectedProxyIds, setSelectedProxyIds] = useState<string[] | null>(null);
  const availableSites = useMemo(() => buildTrendSites(state), [state]);
  const availableProxyIds = useMemo(
    () => getAvailableProxyIds(state.results, state.runs, selectedRegionId, selectedSiteId),
    [selectedRegionId, selectedSiteId, state.results, state.runs],
  );

  useEffect(() => {
    if (!state.regions.some((region) => region.id === selectedRegionId)) {
      onSelectedRegionIdChange(state.regions[0]?.id ?? "");
    }
  }, [onSelectedRegionIdChange, selectedRegionId, state.regions]);

  useEffect(() => {
    if (!availableSites.some((site) => site.id === selectedSiteId)) {
      onSelectedSiteIdChange(availableSites[0]?.id ?? "");
    }
  }, [availableSites, onSelectedSiteIdChange, selectedSiteId]);

  useEffect(() => {
    setSelectedProxyIds((current) => {
      if (current === null) return null;
      const retained = current.filter((proxyId) => availableProxyIds.includes(proxyId));
      if (retained.length) return retained;
      return [];
    });
  }, [availableProxyIds]);

  const visibleSelectedProxyIds = selectedProxyIds ?? availableProxyIds.slice(0, maxDefaultProxyCount);
  const model = useMemo(
    () =>
      buildLatencyTrendModel({
        results: state.results,
        runs: state.runs,
        regionId: selectedRegionId,
        siteId: selectedSiteId,
        selectedProxyIds: visibleSelectedProxyIds,
      }),
    [selectedRegionId, selectedSiteId, state.results, state.runs, visibleSelectedProxyIds],
  );

  const activeRegion = state.regions.find((region) => region.id === selectedRegionId);
  const activeSite = availableSites.find((site) => site.id === selectedSiteId);

  return (
    <section className="h-full min-h-0 overflow-y-auto px-5 py-5">
      <div className="mb-4 flex min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h1 className="text-base font-semibold text-foreground">趋势分析</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">按国家区域找到稳定 proxyId，观察同一节点在历史测试里的延迟变化。</p>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {model.proxyRows.length} 条节点线 · {model.chartRows.length} 次测试
        </div>
      </div>

      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          <FilterBand title="国家区域">
            {state.regions.map((region) => (
              <Button
                key={region.id}
                type="button"
                size="sm"
                variant={region.id === selectedRegionId ? "default" : "outline"}
                className="h-8 rounded-md px-3 text-sm"
                onClick={() => onSelectedRegionIdChange(region.id)}
              >
                {region.label}
              </Button>
            ))}
          </FilterBand>

          <FilterBand title="目标网站">
            {availableSites.map((site) => (
              <Button
                key={site.id}
                type="button"
                size="sm"
                variant={site.id === selectedSiteId ? "default" : "outline"}
                className="h-8 rounded-md px-3 text-sm"
                onClick={() => onSelectedSiteIdChange(site.id)}
              >
                {site.name}
              </Button>
            ))}
          </FilterBand>
        </div>

        <div className="rounded-md border border-border bg-card/45 px-3 py-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <LineChartIcon className="h-4 w-4 text-primary" />
            当前视图
          </div>
          <div className="text-sm font-semibold text-foreground">{activeRegion?.label ?? "暂无区域"} · {activeSite?.name ?? "暂无网站"}</div>
          <div className="mt-1 text-xs text-muted-foreground">显示有有效延迟样本的 proxyId。</div>
        </div>
      </div>

      <div className="grid min-h-[520px] gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
        <ProxyPicker
          proxyRows={buildAllProxyRows(state, selectedRegionId, selectedSiteId)}
          selectedProxyIds={visibleSelectedProxyIds}
          onClearSelection={() => setSelectedProxyIds([])}
          onToggleProxyId={toggleProxyId}
        />
        <TrendChart rows={model.chartRows} proxyRows={model.proxyRows} />
      </div>
    </section>
  );

  function toggleProxyId(proxyId: string) {
    setSelectedProxyIds((current) => {
      const selected = current ?? visibleSelectedProxyIds;
      return selected.includes(proxyId) ? selected.filter((id) => id !== proxyId) : [...selected, proxyId];
    });
  }
}

function FilterBand({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="flex min-w-0 flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ProxyPicker({
  proxyRows,
  selectedProxyIds,
  onClearSelection,
  onToggleProxyId,
}: {
  proxyRows: LatencyTrendProxyRow[];
  selectedProxyIds: string[];
  onClearSelection: () => void;
  onToggleProxyId: (proxyId: string) => void;
}) {
  return (
    <aside className="min-h-0 rounded-md border border-border bg-card/45">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">proxyId 节点</div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-7 rounded-md px-2 text-xs"
          disabled={!selectedProxyIds.length}
          onClick={onClearSelection}
        >
          取消选择
        </Button>
      </div>
      <div className="custom-scrollbar max-h-[520px] overflow-y-auto p-2">
        {proxyRows.length ? (
          <div className="space-y-1">
            {proxyRows.map((row) => {
              const active = selectedProxyIds.includes(row.proxyId);
              return (
                <button
                  key={row.proxyId}
                  type="button"
                  className={cn(
                    "w-full rounded-md px-2 py-2 text-left transition-colors",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/55 hover:text-foreground",
                  )}
                  onClick={() => onToggleProxyId(row.proxyId)}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.proxyName}</span>
                    <span className="text-xs">{row.latestLatencyLabel}</span>
                  </div>
                  <div className="mt-1 truncate text-xs opacity-80" title={row.proxyId}>{row.proxyId}</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-2 py-8 text-center text-sm text-muted-foreground">当前区域和网站没有可绘制的历史延迟。</div>
        )}
      </div>
    </aside>
  );
}

function TrendChart({ rows, proxyRows }: { rows: LatencyTrendChartRow[]; proxyRows: LatencyTrendProxyRow[] }) {
  return (
    <div className="rounded-md border border-border bg-card/45 px-3 py-3">
      {rows.length && proxyRows.length ? (
        <div className="grid h-[520px] min-w-0 gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
          <ChartNodeLabels proxyRows={proxyRows} />
          <div className="min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 920, height: 520 }}>
              <LineChart accessibilityLayer data={rows} margin={{ left: 8, right: 18, top: 12, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="rgba(120, 120, 128, 0.18)" />
                <XAxis dataKey="runLabel" tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: "rgb(142 142 147)", fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}ms`}
                  tick={{ fill: "rgb(142 142 147)", fontSize: 12 }}
                  width={56}
                />
                <Tooltip cursor={{ stroke: "rgba(120, 120, 128, 0.35)" }} content={<TrendTooltipContent proxyRows={proxyRows} />} />
                {proxyRows.map((proxy) => (
                  <Line
                    key={proxy.proxyId}
                    dataKey={proxy.dataKey}
                    name={proxy.proxyName}
                    type="monotone"
                    stroke={proxy.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="flex h-[520px] items-center justify-center rounded-md border border-dashed border-border bg-secondary/25 text-sm text-muted-foreground">
          选择至少一个有历史延迟的 proxyId。
        </div>
      )}
    </div>
  );
}

function ChartNodeLabels({ proxyRows }: { proxyRows: LatencyTrendProxyRow[] }) {
  return (
    <div className="min-h-0 rounded-md bg-secondary/30 px-2 py-2">
      <div className="mb-2 px-1 text-xs font-medium text-muted-foreground">图表节点</div>
      <div className="custom-scrollbar max-h-[480px] space-y-1 overflow-y-auto pr-1">
        {proxyRows.map((proxy) => (
          <div key={proxy.proxyId} className="rounded-md px-1.5 py-1" data-chart-node-label={proxy.proxyId}>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: proxy.color }} />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={proxy.proxyName}>
                {proxy.proxyName}
              </span>
            </div>
            <div className="mt-0.5 truncate pl-4 text-[11px] text-muted-foreground" title={proxy.proxyId}>
              {proxy.proxyId}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendTooltipContent({
  active,
  label,
  payload,
  proxyRows,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey?: string | number; value?: number | null }>;
  proxyRows: LatencyTrendProxyRow[];
}) {
  if (!active || !payload?.length) return null;
  const proxyByDataKey = new Map(proxyRows.map((proxy) => [proxy.dataKey, proxy]));

  return (
    <div className="min-w-48 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-2 space-y-1">
        {payload
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            const proxy = proxyByDataKey.get(String(item.dataKey));
            return (
              <div key={String(item.dataKey)} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: proxy?.color ?? "currentColor" }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{proxy?.proxyName ?? item.dataKey}</span>
                <span className="font-medium text-foreground">{item.value}ms</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function buildTrendSites(state: AppState) {
  const siteMap = new Map(state.sites.map((site) => [site.id, site]));
  for (const result of state.results) {
    if (!siteMap.has(result.siteId)) {
      siteMap.set(result.siteId, { id: result.siteId, name: result.siteName, url: result.siteUrl });
    }
  }
  return [...siteMap.values()];
}

function getAvailableProxyIds(results: AppState["results"], runs: AppState["runs"], regionId: string, siteId: string) {
  return buildLatencyTrendModel({ results, runs, regionId, siteId }).proxyRows.map((row) => row.proxyId);
}

function buildAllProxyRows(state: AppState, regionId: string, siteId: string) {
  return buildLatencyTrendModel({ results: state.results, runs: state.runs, regionId, siteId }).proxyRows;
}
