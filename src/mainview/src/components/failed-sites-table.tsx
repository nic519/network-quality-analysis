import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import type { FailedSiteRow } from "../lib/analysis-data";

export function FailureTable({ rows }: { rows: FailedSiteRow[] }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-card/45">
      <Table>
        <TableHeader className="[&_tr]:border-border">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">节点</TableHead>
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">出口 IP</TableHead>
            <TableHead className="h-9 px-3 text-xs text-muted-foreground">历史失败 / 总次数</TableHead>
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
                  <span className="text-xs text-muted-foreground">{row.proxyType} / {row.regionLabel}</span>
                </div>
              </TableCell>
              <TableCell className="px-3 py-2.5 text-sm text-foreground">
                <span className="break-all">{row.probeIp || "未获取"}</span>
              </TableCell>
              <TableCell className="px-3 py-2.5 text-sm text-foreground">
                <div className="space-y-1.5">
                  <div className="font-medium">{row.historyFailedCount} / {row.historyTotalCount}</div>
                  {row.historySiteStats.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {row.historySiteStats.map((site) => (
                        <Badge
                          key={`${row.key}-history-${site.siteName}`}
                          variant="outline"
                          className="border-border bg-secondary/70 text-[11px] font-normal text-muted-foreground"
                        >
                          {site.siteName} {site.failedCount} / {site.totalCount}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
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
