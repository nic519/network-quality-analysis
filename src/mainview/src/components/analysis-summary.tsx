import { AlertCircle, Gauge, Globe2, ShieldCheck, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import type { LatencyChartRow } from "../lib/chart-data";
import type { ProbeSummary } from "../lib/analysis-data";

type SupplierChartRow = ProbeSummary["supplierRows"][number] & {
  effectiveNodesWithIp: number;
  invalidNodes: number;
};

const supplierChartSegments = [
  { key: "effectiveNodesWithIp", label: "有效且有 IP", color: "hsl(var(--primary))" },
  { key: "effectiveNodesMissingIp", label: "有效但无 IP", color: "rgb(217 119 6)" },
  { key: "invalidNodes", label: "无效节点", color: "hsl(var(--muted-foreground))" },
] as const;

export function AnalysisSummary({
  fastestRow,
  selectedSiteName,
  availableCount,
  chartRowCount,
  failedSiteCount,
  probeRowsCount,
  probeTotalNodes,
  probeSummary,
  onOpenProbeDetails,
}: {
  fastestRow?: LatencyChartRow;
  selectedSiteName?: string;
  availableCount: number;
  chartRowCount: number;
  failedSiteCount: number;
  probeRowsCount: number;
  probeTotalNodes: number;
  probeSummary: ProbeSummary;
  onOpenProbeDetails: () => void;
}) {
  return (
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
          detail={fastestRow ? `${fastestRow.latencyLabel} / ${selectedSiteName ?? "当前网站"}` : "完成测速后显示"}
        />
        <SummaryTile
          icon={ShieldCheck}
          label="可用节点"
          value={`${availableCount}/${chartRowCount}`}
          detail={selectedSiteName ? `${selectedSiteName} 下可绘图延迟` : "当前筛选范围"}
        />
        <SummaryTile
          icon={AlertCircle}
          label="失败节点"
          value={`${failedSiteCount}`}
          detail={failedSiteCount ? "下方失败记录可查看网站" : "当前范围没有失败记录"}
        />
      </div>
      {probeRowsCount || probeTotalNodes ? (
        <section className="mb-5">
          <div className="mb-3 flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">出口信息</h2>
            <span className="text-xs text-muted-foreground">完整节点列表收进二级详情面板。</span>
            <div className="ml-auto">
              <Button
                type="button"
                variant="outline"
                className="h-7 rounded-md px-2 text-xs"
                title="查看出口详情"
                onClick={onOpenProbeDetails}
              >
                查看出口详情
              </Button>
            </div>
          </div>
          <ProbeSummaryPanel summary={probeSummary} />
        </section>
      ) : null}
    </div>
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

function ProbeSummaryPanel({ summary }: { summary: ProbeSummary }) {
  return (
    <div className="mb-3 space-y-3">
      {summary.showSupplierSummary ? (
        <SupplierSummaryChart rows={summary.supplierRows} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryTile
            icon={ShieldCheck}
            label="有效节点"
            value={`${summary.effectiveNodes}/${summary.totalNodes}`}
            detail="延迟可解析的节点数"
          />
          <SummaryTile
            icon={Globe2}
            label="独立出口 IP"
            value={`${summary.uniqueEffectiveIps}/${summary.effectiveNodesWithIp}`}
            detail="独立 IP / 有 IP 的有效节点"
          />
          <SummaryTile
            icon={AlertCircle}
            label="有效但无 IP"
            value={`${summary.effectiveNodesMissingIp}`}
            detail={summary.effectiveNodesMissingIp ? "Probe 未拿到出口 IP" : "有效节点均有出口 IP"}
          />
        </div>
      )}
    </div>
  );
}

function SupplierSummaryChart({ rows }: { rows: ProbeSummary["supplierRows"] }) {
  const chartRows: SupplierChartRow[] = rows.map((row) => ({
    ...row,
    effectiveNodesWithIp: row.effectiveNodesWithIp,
    invalidNodes: Math.max(0, row.totalNodes - row.effectiveNodes),
  }));
  const chartHeight = Math.max(160, chartRows.length * 44 + 36);

  return (
    <div className="rounded-md border border-border bg-card/45 px-3 py-3" data-supplier-chart-row-count={chartRows.length}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="mr-auto text-xs font-medium text-muted-foreground">节点有效性对比</div>
        {supplierChartSegments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: segment.color }} />
            {segment.label}
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
        <div style={{ height: `${chartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 780, height: chartHeight }}>
            <BarChart accessibilityLayer data={chartRows} layout="vertical" margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
              <CartesianGrid horizontal={false} stroke="rgba(120, 120, 128, 0.18)" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: "rgb(142 142 147)", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="supplier"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={48}
                tick={{ fill: "hsl(var(--foreground))", fontSize: 18 }}
              />
              <Tooltip cursor={{ fill: "rgba(120, 120, 128, 0.10)" }} content={<SupplierChartTooltipContent />} />
              <Bar dataKey="effectiveNodesWithIp" stackId="nodes" fill="hsl(var(--primary))" radius={[4, 0, 0, 4]} barSize={22} />
              <Bar dataKey="effectiveNodesMissingIp" stackId="nodes" fill="rgb(217 119 6)" barSize={22} />
              <Bar dataKey="invalidNodes" stackId="nodes" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid content-start gap-2 text-xs">
          <div className="hidden grid-cols-[1fr_auto] px-1 font-medium text-muted-foreground lg:grid">
            <span>独立出口 IP</span>
            <span>有效节点</span>
          </div>
          {chartRows.map((row) => (
            <div key={row.supplier} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-secondary/45 px-2 py-1.5">
              <span className="text-base leading-none lg:hidden">{row.supplier}</span>
              <span className="truncate font-medium text-foreground" title={`${row.uniqueEffectiveIps}/${row.effectiveNodesWithIp}`}>
                {row.uniqueEffectiveIps}/{row.effectiveNodesWithIp}
              </span>
              <span className="text-muted-foreground">{row.effectiveNodes}/{row.totalNodes}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SupplierChartTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: SupplierChartRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
      <div className="font-medium text-foreground">{row.supplier}</div>
      <div className="mt-1 text-muted-foreground">有效节点：{row.effectiveNodes}/{row.totalNodes}</div>
      <div className="text-muted-foreground">独立出口 IP：{row.uniqueEffectiveIps}/{row.effectiveNodesWithIp}</div>
      <div className="text-muted-foreground">有效但无 IP：{row.effectiveNodesMissingIp}</div>
    </div>
  );
}
