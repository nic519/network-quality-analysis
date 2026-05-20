import { Trash2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { CountryFlag, getRegionFlagCode } from "./country-flag";
import { ScrollArea } from "./ui/scroll-area";
import { formatRunRegionLabels } from "../lib/run-region-label";
import { cn } from "../lib/utils";
import { getEffectiveSelectedRunId, getRunPrimaryRegionId, getVisibleRunItems } from "../lib/analysis-data";
import type { AppState } from "../../../shared/rpc";

export function RunHistorySidebar({
  runs,
  results,
  regions,
  selectedRunId,
  onSelectedRunIdChange,
  onDeleteRun,
}: {
  runs: AppState["runs"];
  results: AppState["results"];
  regions: AppState["regions"];
  selectedRunId: string;
  onSelectedRunIdChange: (value: string) => void;
  onDeleteRun?: (runId: string) => void;
}) {
  const runItems = getVisibleRunItems(runs);
  const effectiveSelectedRunId = getEffectiveSelectedRunId(selectedRunId, runs);

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-secondary/25">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div>
          <h1 className="text-base font-semibold text-foreground">历史测试</h1>
          <p className="text-xs text-muted-foreground">选择一次测速查看明细。</p>
        </div>
        <Badge variant="outline" className="border-border bg-secondary text-muted-foreground">
          {runs.length} 条
        </Badge>
      </div>

      <ScrollArea className="min-h-0 flex-1 p-2" viewportClassName="h-full pr-0" contentClassName="w-full space-y-1">
        <div role="radiogroup" aria-label="历史测试" className="w-full space-y-1">
          {runItems.map((run) => {
            const isActive = effectiveSelectedRunId === run.id;
            const regionLabel = formatRunRegionLabels({ run, results, regions });
            const primaryRegionId = getRunPrimaryRegionId(run, results);
            return (
              <div
                key={run.id}
                className={cn(
                  "group flex w-full items-center gap-1 rounded-md pr-1 transition-colors",
                  isActive ? "bg-accent text-accent-foreground" : "text-secondary-foreground hover:bg-accent/65",
                )}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className="min-w-0 flex-1 px-2 py-2 text-left"
                  title={run.id}
                  onClick={() => onSelectedRunIdChange(run.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <CountryFlag code={getRegionFlagCode(primaryRegionId)} label={regionLabel} markerName="data-region-flag" />
                      <span className="shrink-0 font-medium text-foreground">{regionLabel}</span>
                      <span className="min-w-0 truncate font-medium text-muted-foreground">{shortenId(run.id)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(run.startedAt)}</div>
                  </div>
                </button>
                {onDeleteRun ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 shrink-0 gap-1 rounded-md border-border/80 px-2 text-xs text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    title="删除历史测试"
                    onClick={() => onDeleteRun(run.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
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

function shortenId(id: string) {
  return id.length > 18 ? id.slice(-18) : id;
}
