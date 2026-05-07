import { useEffect, useMemo, useState, useTransition } from "react";
import { TopNavigation, type AppView } from "./components/top-navigation";
import { RunSetupView } from "./components/run-setup-view";
import { AnalysisView } from "./components/analysis-view";
import { DiagnosticsView } from "./components/diagnostics-view";
import type { MatrixRow } from "./lib/chart-data";
import { api, onClashSpeedtestStatus, onProgress } from "./lib/electrobun";
import { DEFAULT_SITES, REGION_PRESETS, latencyToMs } from "../../shared/domain";
import type { AppState } from "../../shared/rpc";

const today = new Date().toISOString().slice(0, 10);

export default function App() {
  const [state, setState] = useState<AppState>({
    regions: REGION_PRESETS,
    configHistory: [],
    runs: [],
    results: [],
    clashSpeedtest: {
      status: "checking-update",
      version: null,
      latestVersion: null,
      updateAvailable: null,
      updateCheckStatus: "idle",
      updateCheckMessage: null,
      path: null,
      source: null,
      message: "正在检查 clash-speedtest 状态",
      checkedAt: new Date().toISOString(),
    },
  });
  const [activeView, setActiveView] = useState<AppView>("run");
  const [configPath, setConfigPath] = useState("");
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>(["hong-kong"]);
  const [selectedRunId, setSelectedRunId] = useState<string>("all");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState(DEFAULT_SITES[0]?.id ?? "");
  const [progress, setProgress] = useState("准备就绪");
  const [progressLog, setProgressLog] = useState<string[]>(["准备就绪"]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filters = useMemo(
    () => ({
      runId: selectedRunId === "all" ? undefined : selectedRunId,
      regionIds: selectedRegionIds,
      fromDate: selectedRunId === "all" ? `${fromDate}T00:00:00.000Z` : undefined,
      toDate: selectedRunId === "all" ? `${toDate}T23:59:59.999Z` : undefined,
    }),
    [fromDate, selectedRegionIds, selectedRunId, toDate],
  );

  useEffect(
    () =>
      onProgress((message) => {
        setProgress(message);
        setProgressLog((current) => [...current.slice(-17), message]);
      }),
    [],
  );

  useEffect(
    () =>
      onClashSpeedtestStatus((clashSpeedtest) => {
        setState((current) => ({ ...current, clashSpeedtest }));
        setProgress(clashSpeedtest.message);
      }),
    [],
  );

  useEffect(() => {
    startTransition(async () => {
      try {
        setState(await api.getAppState(filters));
      } catch (caught) {
        setError(toErrorMessage(caught));
      }
    });
  }, [filters]);

  const recentConfigPaths = state.configHistory.filter((item) => item.path !== configPath);
  const diagnosticsHint = getDiagnosticsHint(state.clashSpeedtest);

  async function startRun() {
    setError(null);
    setProgress("启动测试任务");
    setProgressLog(["启动测试任务"]);
    try {
      const nextState = await api.startRun({
        configPath: configPath.trim(),
        regionIds: selectedRegionIds as Array<"hong-kong" | "japan">,
      });
      setState(nextState);
      setSelectedRunId(nextState.runs[0]?.id ?? "all");
      setProgress("测试完成");
      setProgressLog((current) => [...current.slice(-17), "测试完成"]);
      setActiveView("analysis");
    } catch (caught) {
      setError(toErrorMessage(caught));
      setProgress("测试失败");
      setProgressLog((current) => [...current.slice(-17), `测试失败：${toErrorMessage(caught)}`]);
    }
  }

  async function exportCsv() {
    setError(null);
    try {
      const exported = await api.exportCsv(filters);
      if (exported) {
        setProgress(`已导出汇总 CSV：${exported.summaryPath}`);
      } else {
        setProgress("已取消导出");
      }
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  async function selectConfigFile() {
    setError(null);
    try {
      const selectedPath = await api.selectConfigFile({ currentPath: configPath });
      if (selectedPath) {
        setConfigPath(selectedPath);
        setProgress("已选择配置文件");
      }
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  async function selectClashSpeedtestBinary() {
    setError(null);
    try {
      const selectedPath = await api.selectClashSpeedtestBinary({ currentPath: state.clashSpeedtest.path });
      if (selectedPath) {
        setProgress(`已导入本地 clash-speedtest：${selectedPath}`);
        setState(await api.getAppState(filters));
      }
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  async function setClashSpeedtestBinaryPath(path: string) {
    setError(null);
    try {
      const selectedPath = await api.setClashSpeedtestBinaryPath({ path });
      if (selectedPath) {
        setProgress(`已指定 clash-speedtest 路径：${selectedPath}`);
        setState(await api.getAppState(filters));
      }
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  async function resetClashSpeedtestBinaryPath() {
    setError(null);
    try {
      await api.resetClashSpeedtestBinaryPath();
      setProgress("已切换为系统命令依赖");
      setState(await api.getAppState(filters));
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="border-b border-white/10 px-8 py-5">
        <div className="mx-auto max-w-7xl">
          <TopNavigation activeView={activeView} onChange={setActiveView} state={state.clashSpeedtest} />
        </div>
      </section>

      {activeView === "run" ? (
        <RunSetupView
          state={state}
          configPath={configPath}
          onConfigPathChange={setConfigPath}
          onSelectConfigFile={selectConfigFile}
          recentConfigPaths={recentConfigPaths}
          selectedRegionIds={selectedRegionIds}
          onToggleRegion={toggleRegion}
          progress={progress}
          progressLog={progressLog}
          error={error}
          onStartRun={startRun}
          isPending={isPending}
          diagnosticsHint={diagnosticsHint}
          onOpenDiagnostics={() => setActiveView("diagnostics")}
        />
      ) : null}

      {activeView === "analysis" ? (
        <AnalysisView
          state={state}
          selectedRunId={selectedRunId}
          onSelectedRunIdChange={setSelectedRunId}
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          search={search}
          onSearchChange={setSearch}
          selectedSiteId={selectedSiteId}
          onSelectedSiteIdChange={setSelectedSiteId}
          progress={progress}
          error={error}
          onExportCsv={exportCsv}
        />
      ) : null}

      {activeView === "diagnostics" ? (
        <DiagnosticsView
          state={state.clashSpeedtest}
          onSelectBinary={selectClashSpeedtestBinary}
          onSetBinaryPath={setClashSpeedtestBinaryPath}
          onResetBinaryPath={resetClashSpeedtestBinaryPath}
        />
      ) : null}
    </main>
  );

  function toggleRegion(regionId: string) {
    setSelectedRegionIds((current) =>
      current.includes(regionId) ? current.filter((id) => id !== regionId) : [...current, regionId],
    );
  }
}

function buildMatrixRows(results: AppState["results"], search: string): MatrixRow[] {
  const rows = new Map<string, MatrixRow>();
  const normalizedSearch = search.trim().toLowerCase();

  for (const result of results) {
    if (normalizedSearch && !result.proxyName.toLowerCase().includes(normalizedSearch)) continue;

    const key = `${result.runId}:${result.regionId}:${result.proxyId}`;
    const row = rows.get(key) ?? {
      key,
      runId: result.runId,
      proxyId: result.proxyId,
      proxyName: result.proxyName,
      proxyType: result.proxyType,
      regionLabel: result.regionLabel,
      values: {},
    };
    row.values[result.siteName] = result.latency;
    rows.set(key, row);
  }

  return Array.from(rows.values()).sort((a, b) => {
    const aBest = bestLatency(a.values);
    const bBest = bestLatency(b.values);
    return aBest - bBest;
  });
}

function bestLatency(values: Record<string, string>) {
  const latencies = Object.values(values).map(latencyToMs).filter((value): value is number => value !== null);
  return latencies.length ? Math.min(...latencies) : Number.POSITIVE_INFINITY;
}

function getDiagnosticsHint(state: AppState["clashSpeedtest"]) {
  if (state.status === "error") return state.message;
  if (state.status === "missing" && state.updateCheckStatus === "failed") return "本地尚未下载，且远端检查失败；这更像网络或 GitHub 限流问题。";
  if (state.updateCheckStatus === "failed") return "本地可用，但当前无法确认远端最新版本。";
  return null;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
