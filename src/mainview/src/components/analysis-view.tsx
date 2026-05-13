import { useState } from "react";
import { Copy } from "lucide-react";
import { AnalysisFilterBar } from "./analysis-filter-bar";
import { AnalysisSummary } from "./analysis-summary";
import { FailureTable } from "./failed-sites-table";
import { LatencyChartPanel, LatencyTooltipContent } from "./latency-chart-panel";
import { ProbeDetailsPanel } from "./probe-details-panel";
import { RunHistorySidebar } from "./run-history-sidebar";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  buildFailedSiteRows,
  buildProbeRows,
  buildProbeSummary,
  buildRunScopedChartRows,
  buildSelectableSites,
  filterScopedResults,
  getEffectiveSelectedRunId,
} from "../lib/analysis-data";
import type { ProbeRow, ProbeSortMode } from "../lib/analysis-data";
import { cn } from "../lib/utils";
import type { AppState } from "../../../shared/rpc";

export type { ProbeRow, ProbeSortMode } from "../lib/analysis-data";
export {
  buildProbeRows,
  buildProbeSummary,
  buildRunScopedChartRows,
  LatencyTooltipContent,
};

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
  onDeleteRun,
  pendingDeleteRunLabel,
  onConfirmDeleteRun,
  onCancelDeleteRun,
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
  onDeleteRun?: (runId: string) => void;
  pendingDeleteRunLabel?: string | null;
  onConfirmDeleteRun?: () => void;
  onCancelDeleteRun?: () => void;
}) {
  const [probeSortMode, setProbeSortMode] = useState<ProbeSortMode>("proxy-name");
  const [isProbeDetailsOpen, setProbeDetailsOpen] = useState(false);
  const selectableSites = buildSelectableSites(state.sites, state.results);
  const selectedSite = selectableSites.find((site) => site.id === selectedSiteId) ?? selectableSites[0];
  const effectiveSelectedRunId = getEffectiveSelectedRunId(selectedRunId, state.runs);
  const scopedResults = filterScopedResults(state.results, effectiveSelectedRunId);
  const chartRows = buildRunScopedChartRows(scopedResults, search, selectedSite?.name);
  const availableChartRows = chartRows.filter((row) => row.isAvailable);
  const failedSiteRows = buildFailedSiteRows(scopedResults, search, state.proxyHistoryStats);
  const probeRows: ProbeRow[] = buildProbeRows(scopedResults, search, probeSortMode);
  const probeSummary = buildProbeSummary(scopedResults, search);
  const fastestRow = availableChartRows[0];

  return (
    <section className="h-full min-h-0">
      <div className="grid h-full min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <RunHistorySidebar
          runs={state.runs}
          results={state.results}
          regions={state.regions}
          selectedRunId={selectedRunId}
          onSelectedRunIdChange={onSelectedRunIdChange}
          onDeleteRun={onDeleteRun}
        />

        <div className="custom-scrollbar min-h-0 min-w-0 overflow-y-auto">
          <AnalysisFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={onFromDateChange}
            onToDateChange={onToDateChange}
            search={search}
            onSearchChange={onSearchChange}
            error={error}
          />

          <div className="min-w-0 px-5 py-5">
            <section className="min-w-0">
              <AnalysisSummary
                fastestRow={fastestRow}
                selectedSiteName={selectedSite?.name}
                availableCount={availableChartRows.length}
                chartRowCount={chartRows.length}
                failedSiteCount={failedSiteRows.length}
                probeRowsCount={probeRows.length}
                probeTotalNodes={probeSummary.totalNodes}
                probeSummary={probeSummary}
                onOpenProbeDetails={() => setProbeDetailsOpen(true)}
              />

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

              <LatencyChartPanel rows={availableChartRows} selectedSiteName={selectedSite?.name} />

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
      <ProbeDetailsPanel
        open={isProbeDetailsOpen}
        rows={probeRows}
        sortMode={probeSortMode}
        onSortModeChange={setProbeSortMode}
        onClose={() => setProbeDetailsOpen(false)}
      />
      {pendingDeleteRunLabel && onConfirmDeleteRun && onCancelDeleteRun ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) onCancelDeleteRun();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确定删除这次历史测试？</AlertDialogTitle>
              <AlertDialogDescription className="break-all text-xs">{pendingDeleteRunLabel}</AlertDialogDescription>
              <AlertDialogDescription>删除后会从数据库移除对应结果。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onCancelDeleteRun}>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(event) => {
                  event.preventDefault();
                  onConfirmDeleteRun();
                }}
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </section>
  );
}
