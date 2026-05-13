import { AlertCircle, Gauge, Globe2, ShieldCheck, Trophy } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import type { LatencyChartRow } from "../lib/chart-data";
import type { ProbeSummary } from "../lib/analysis-data";

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
        <SupplierSummaryTable rows={summary.supplierRows} />
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

function SupplierSummaryTable({ rows }: { rows: ProbeSummary["supplierRows"] }) {
  return (
    <div className="rounded-md border border-border bg-card/45">
      <Table>
        <TableHeader className="[&_tr]:border-border">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 px-3 text-xs text-muted-foreground">供应商前缀</TableHead>
            <TableHead className="h-8 px-3 text-xs text-muted-foreground">有效 / 总节点</TableHead>
            <TableHead className="h-8 px-3 text-xs text-muted-foreground">独立出口 IP</TableHead>
            <TableHead className="h-8 px-3 text-xs text-muted-foreground">有效但无 IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-0">
          {rows.map((row) => (
            <TableRow key={row.supplier} className="border-border hover:bg-accent/35">
              <TableCell className="px-3 py-2 text-sm font-medium text-foreground">{row.supplier}</TableCell>
              <TableCell className="px-3 py-2 text-sm text-foreground">{row.effectiveNodes}/{row.totalNodes}</TableCell>
              <TableCell className="px-3 py-2 text-sm text-foreground">{row.uniqueEffectiveIps}/{row.effectiveNodes}</TableCell>
              <TableCell className="px-3 py-2 text-sm text-muted-foreground">{row.effectiveNodesMissingIp}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
