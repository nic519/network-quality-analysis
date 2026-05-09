import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { TopNavigation, type AppView } from "./components/top-navigation";
import { RunSetupView } from "./components/run-setup-view";
import { AnalysisView } from "./components/analysis-view";
import { DiagnosticsView } from "./components/diagnostics-view";
import type { MatrixRow } from "./lib/chart-data";
import { buildCopyResultsText } from "./lib/copy-results-text";
import { api, onClashSpeedtestStatus, onProgress } from "./lib/electrobun";
import { buildAnalysisHistoryFilters } from "./lib/history-filters";
import { DEFAULT_SITES, REGION_PRESETS, latencyToMs } from "../../shared/domain";
import type { RegionPreset, SiteDefinition } from "../../shared/domain";
import type { AppState } from "../../shared/rpc";

const today = new Date().toISOString().slice(0, 10);

export default function App() {
  const [state, setState] = useState<AppState>({
    regions: REGION_PRESETS,
    sites: DEFAULT_SITES,
    configHistory: [],
    runs: [],
    results: [],
    clashSpeedtest: {
      status: "missing",
      version: null,
      path: null,
      source: null,
      message: "正在检查本地 clash-speedtest",
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
  const [isRunPending, setIsRunPending] = useState(false);
  const isRunInFlightRef = useRef(false);
  const [, startTransition] = useTransition();

  const filters = useMemo(
    () => buildAnalysisHistoryFilters({ selectedRunId, fromDate, toDate }),
    [fromDate, selectedRunId, toDate],
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

  useEffect(() => {
    const selectableSites = buildSelectableSites(state.sites, state.results);
    if (!selectableSites.some((site) => site.id === selectedSiteId)) {
      setSelectedSiteId(selectableSites[0]?.id ?? "");
    }
  }, [selectedSiteId, state.results, state.sites]);

  const recentConfigPaths = state.configHistory.filter((item) => item.path !== configPath);
  const diagnosticsHint = getDiagnosticsHint(state.clashSpeedtest);

  async function startRun() {
    if (isRunInFlightRef.current) return;

    isRunInFlightRef.current = true;
    setIsRunPending(true);
    setError(null);
    setProgress("启动测试任务");
    setProgressLog(["启动测试任务"]);
    try {
      const nextState = await api.startRun({
        configPath: configPath.trim(),
        regionIds: selectedRegionIds as RegionPreset["id"][],
      });
      setState(nextState);
      setSelectedRunId(selectedRegionIds.length > 1 ? "all" : nextState.runs[0]?.id ?? "all");
      setProgress("测试完成");
      setProgressLog((current) => [...current.slice(-17), "测试完成"]);
      setActiveView("analysis");
    } catch (caught) {
      setError(toErrorMessage(caught));
      setProgress("测试失败");
      setProgressLog((current) => [...current.slice(-17), `测试失败：${toErrorMessage(caught)}`]);
    } finally {
      isRunInFlightRef.current = false;
      setIsRunPending(false);
    }
  }

  async function copyResults() {
    setError(null);
    try {
      const rows = buildMatrixRows(state.results, search);
      const csv = buildCopyResultsText(rows);
      await navigator.clipboard.writeText(csv);
      if (csv) {
        setProgress("已复制纯文本结果到剪贴板");
      } else {
        setProgress("没有可复制的结果");
      }
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  async function exportAllResults() {
    setError(null);
    try {
      const exported = await api.exportCsv({});
      if (exported) {
        setProgress(`已导出全部结果 CSV：${exported.summaryPath}`);
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

  async function saveTestSites(sites: SiteDefinition[]) {
    setError(null);
    try {
      const savedSites = await api.setTestSites({ sites });
      const enabledSiteCount = savedSites.filter((site) => site.enabled !== false).length;
      setState((current) => ({ ...current, sites: savedSites }));
      setProgress(`已保存 ${savedSites.length} 个测试网站，其中 ${enabledSiteCount} 个已启用`);
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="sticky top-0 h-screen w-[196px] shrink-0 border-r border-border bg-secondary/65">
        <TopNavigation activeView={activeView} onChange={setActiveView} state={state.clashSpeedtest} />
      </aside>

      <div className="min-w-0 flex-1 overflow-hidden">
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
            isPending={isRunPending}
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
            error={error}
            onCopyResults={copyResults}
            onExportAllResults={exportAllResults}
          />
        ) : null}

        {activeView === "diagnostics" ? (
          <DiagnosticsView
            state={state.clashSpeedtest}
            sites={state.sites}
            onSelectBinary={selectClashSpeedtestBinary}
            onSetBinaryPath={setClashSpeedtestBinaryPath}
            onResetBinaryPath={resetClashSpeedtestBinaryPath}
            onSaveSites={saveTestSites}
          />
        ) : null}
      </div>
    </main>
  );

  function toggleRegion(regionId: string) {
    setSelectedRegionIds((current) =>
      current.includes(regionId) ? current.filter((id) => id !== regionId) : [...current, regionId],
    );
  }
}

function buildSelectableSites(sites: SiteDefinition[], results: AppState["results"]) {
  const siteMap = new Map<string, SiteDefinition>();
  for (const site of sites) siteMap.set(site.id, site);
  for (const result of results) {
    if (!siteMap.has(result.siteId)) {
      siteMap.set(result.siteId, {
        id: result.siteId,
        name: result.siteName,
        url: result.siteUrl,
      });
    }
  }
  return [...siteMap.values()];
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
  if (state.status === "missing") return "未检测到本地 clash-speedtest，请先运行 go install 或在设置页指定路径。";
  return null;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
