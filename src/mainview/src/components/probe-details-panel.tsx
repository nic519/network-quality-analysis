import { ArrowDownAZ, Timer, X } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import type { ProbeRow, ProbeSortMode } from "./analysis-view";

export function ProbeDetailsPanel({
  open,
  rows,
  sortMode,
  onSortModeChange,
  onClose,
}: {
  open: boolean;
  rows: ProbeRow[];
  sortMode: ProbeSortMode;
  onSortModeChange: (value: ProbeSortMode) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/78 px-6 py-8 backdrop-blur-sm">
      <div className="flex h-full max-h-[min(820px,100%)] w-full max-w-6xl flex-col rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">出口详情</h3>
            <p className="text-xs text-muted-foreground">按节点 ID 合并展示完整 probe 结果。</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant={sortMode === "proxy-name" ? "default" : "outline"}
              className="h-8 rounded-md px-2 text-xs"
              title="按节点名称排序"
              onClick={() => onSortModeChange("proxy-name")}
            >
              <ArrowDownAZ className="h-3.5 w-3.5" />
              节点名称
            </Button>
            <Button
              type="button"
              variant={sortMode === "probe-latency" ? "default" : "outline"}
              className="h-8 rounded-md px-2 text-xs"
              title="按响应时间排序"
              onClick={() => onSortModeChange("probe-latency")}
            >
              <Timer className="h-3.5 w-3.5" />
              响应时间
            </Button>
            <Button type="button" variant="outline" className="h-8 w-8 rounded-md p-0" title="关闭出口详情" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1" viewportClassName="h-full" contentClassName="min-w-0">
          <div className="px-5 py-4">
            <ProbeTable rows={rows} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ProbeTable({ rows }: { rows: ProbeRow[] }) {
  return (
    <div className="rounded-md border border-border bg-card/45">
      <Table>
        <TableHeader className="[&_tr]:border-border">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">节点</TableHead>
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">出口 IP</TableHead>
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">ASN / 组织</TableHead>
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">Probe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-0">
          {rows.map((row) => (
            <TableRow key={row.key} className="border-border hover:bg-accent/35">
              <TableCell className="max-w-[260px] px-3 py-2">
                <div className="truncate text-sm font-medium text-foreground" title={row.proxyName}>
                  {row.proxyName}
                </div>
                <div className="mt-0.5 text-xs leading-4 text-muted-foreground">{row.proxyType} / {row.regionLabel}</div>
              </TableCell>
              <TableCell className="px-3 py-2">
                <ProbeIpCell row={row} />
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

function ProbeIpCell({ row }: { row: ProbeRow }) {
  const [locationLine1, locationLine2] = formatProbeLocationLines(row);

  return (
    <div title={[row.probeIp, formatProbeLocationTitle(row)].filter(Boolean).join(" / ") || "N/A"}>
      <div className="break-all text-sm leading-5 text-foreground">{row.probeIp || "N/A"}</div>
      {locationLine1 ? <div className="mt-0.5 text-xs leading-4 text-muted-foreground">{locationLine1}</div> : null}
      {locationLine2 ? <div className="text-xs leading-4 text-muted-foreground">{locationLine2}</div> : null}
    </div>
  );
}

function ProbeAsnCell({ row }: { row: ProbeRow }) {
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

function formatProbeLocationLines(row: ProbeRow) {
  const line1 = [row.probeCountryCode, row.probeCountry].filter(Boolean).join(" / ");
  const line2 = [row.probeRegion, row.probeCity].filter(Boolean).join(" / ");
  return [line1, line2] as const;
}

function formatProbeLocationTitle(row: ProbeRow) {
  const [line1, line2] = formatProbeLocationLines(row);
  return [line1, line2].filter(Boolean).join(" / ") || "N/A";
}
