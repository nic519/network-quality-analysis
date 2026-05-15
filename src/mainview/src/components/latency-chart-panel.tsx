import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LatencyChartRow } from "../lib/chart-data";

export function LatencyChartPanel({
  rows,
  selectedSiteName,
}: {
  rows: LatencyChartRow[];
  selectedSiteName?: string;
}) {
  const chartHeight = Math.max(420, rows.length * 34 + 48);

  return (
    <div
      className="rounded-md border border-border bg-card/45 px-3 py-3"
      data-chart-row-count={rows.length}
      style={{ height: `${chartHeight}px` }}
    >
      {rows.length ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 800, height: chartHeight }}>
          <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 0, right: 44, top: 8, bottom: 8 }}>
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
            <Tooltip cursor={{ fill: "rgba(120, 120, 128, 0.10)" }} content={<LatencyTooltipContent />} />
            <Bar dataKey="latency" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={22}>
              <LabelList dataKey="proxyType" position="insideLeft" className="fill-primary-foreground text-xs font-semibold" />
              <LabelList dataKey="latencyLabel" position="right" className="fill-current text-xs font-medium text-foreground" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border bg-secondary/30 text-sm text-muted-foreground">
          当前筛选下没有 {selectedSiteName ?? "该网站"} 的可绘图延迟数据。
        </div>
      )}
    </div>
  );
}

export function LatencyTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: LatencyChartRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
      <div className="max-w-64 truncate font-medium text-foreground">{row.proxyName}</div>
      <div className="mt-1 max-w-64 break-all font-semibold text-primary">出口 IP：{row.probeIp?.trim() || "未获取"}</div>
    </div>
  );
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
