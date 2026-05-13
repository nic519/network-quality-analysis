import { ArrowDownAZ, Timer } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
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
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      <DialogContent className="flex h-[min(820px,calc(100vh-4rem))] max-w-6xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-14">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <DialogTitle>出口详情</DialogTitle>
              <DialogDescription className="text-xs">按节点 ID 合并展示完整 probe 结果。</DialogDescription>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
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
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1" viewportClassName="h-full" contentClassName="min-w-0">
          <div className="px-5 py-4">
            <ProbeTable rows={rows} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
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
  const locationLine = formatProbeLocationLine(row);

  return (
    <div title={[row.probeIp, formatProbeLocationTitle(row)].filter(Boolean).join(" / ") || "N/A"}>
      <div className="truncate text-sm leading-5 text-foreground">{row.probeIp || "N/A"}</div>
      {locationLine ? <div className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">{locationLine}</div> : null}
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

function formatProbeLocationLine(row: ProbeRow) {
  return [row.probeCountryCode, row.probeCountry, row.probeRegion, row.probeCity].filter(Boolean).join(" / ");
}

function formatProbeLocationTitle(row: ProbeRow) {
  return formatProbeLocationLine(row) || "N/A";
}
