import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { TopNavigation, type AppView } from "./components/top-navigation";
import { RunSetupView } from "./components/run-setup-view";
import { AnalysisView } from "./components/analysis-view";
import { DiagnosticsView } from "./components/diagnostics-view";
import type { MatrixRow } from "./lib/chart-data";
import { buildCopyResultsText } from "./lib/copy-results-text";
import { api, onClashSpeedtestStatus, onProgress, onRunProgress } from "./lib/electrobun";
import { buildAnalysisHistoryFilters } from "./lib/history-filters";
import { DEFAULT_SITES, REGION_PRESETS, latencyToMs } from "../../shared/domain";
import type { RegionPreset, SiteDefinition } from "../../shared/domain";
import { DEFAULT_PROBE_SETTINGS, type ProbeSettings } from "../../shared/probe-settings";
import type { AppState, ConfigInspectionResult, RunProgressState } from "../../shared/rpc";

const today = new Date().toISOString().slice(0, 10);
export type ThemeMode = "system" | "light" | "dark";

export default function App() {
  const [state, setState] = useState<AppState>({
    regions: REGION_PRESETS,
    sites: DEFAULT_SITES,
    probeSettings: DEFAULT_PROBE_SETTINGS,
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
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(DEFAULT_SITES.map((site) => site.id));
  const [selectedRunId, setSelectedRunId] = useState<string>("all");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState(DEFAULT_SITES[0]?.id ?? "");
  const [progress, setProgress] = useState("准备就绪");
  const [progressLog, setProgressLog] = useState<string[]>(["准备就绪"]);
  const [runProgress, setRunProgress] = useState<RunProgressState | null>(null);
  const [configInspection, setConfigInspection] = useState<ConfigInspectionResult | null>(null);
  const [isInspectingConfig, setIsInspectingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRunPending, setIsRunPending] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readInitialThemeMode());
  const isRunInFlightRef = useRef(false);
  const siteSettingsSignatureRef = useRef("");
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
      onRunProgress((nextRunProgress) => {
        setRunProgress(nextRunProgress);
        setProgress(nextRunProgress.message);
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

  useEffect(() => {
    const nextSignature = state.sites.map((site) => `${site.id}:${site.enabled !== false}`).join("|");
    const shouldUseSavedSiteSelection = siteSettingsSignatureRef.current !== nextSignature;
    siteSettingsSignatureRef.current = nextSignature;

    setSelectedSiteIds((current) => {
      if (shouldUseSavedSiteSelection) {
        return state.sites.filter((site) => site.enabled !== false).map((site) => site.id);
      }

      const validSiteIds = new Set(state.sites.map((site) => site.id));
      const nextSelectedIds = current.filter((siteId) => validSiteIds.has(siteId));
      if (nextSelectedIds.length) return nextSelectedIds;
      return state.sites.filter((site) => site.enabled !== false).map((site) => site.id);
    });
  }, [state.sites]);

  useEffect(() => {
    if (themeMode === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = themeMode;
    }
    window.localStorage.setItem("latency-compass-theme", themeMode);
  }, [themeMode]);

  const recentConfigPaths = state.configHistory.filter((item) => item.path !== configPath);
  const diagnosticsHint = getDiagnosticsHint(state.clashSpeedtest);

  useEffect(() => {
    const normalizedConfigPath = configPath.trim();
    if (!looksInspectableConfigPath(normalizedConfigPath)) {
      setConfigInspection(null);
      setIsInspectingConfig(false);
      return;
    }

    let isCancelled = false;
    setIsInspectingConfig(true);
    setConfigInspection(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const inspection = await api.inspectConfig({ configPath: normalizedConfigPath });
        if (!isCancelled) {
          setConfigInspection(inspection);
        }
      } catch (caught) {
        if (!isCancelled) {
          setConfigInspection(null);
          setProgress(`配置解析失败：${toErrorMessage(caught)}`);
        }
      } finally {
        if (!isCancelled) {
          setIsInspectingConfig(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [configPath]);

  async function startRun() {
    if (isRunInFlightRef.current) return;

    isRunInFlightRef.current = true;
    setIsRunPending(true);
    setError(null);
    setProgress("启动测试任务");
    setProgressLog(["启动测试任务"]);
    setRunProgress({
      stage: "running",
      completedGroups: 0,
      totalGroups: selectedRegionIds.length * selectedSiteIds.length,
      percent: 0,
      currentGroupNodeIndex: null,
      currentGroupEstimatedNodeCount: null,
      currentRegionId: null,
      currentRegionLabel: null,
      currentSiteId: null,
      currentSiteName: null,
      currentSiteUrl: null,
      currentGroupLabel: null,
      currentGroupNodeCount: null,
      message: "启动测试任务",
    });
    let didSucceed = false;
    try {
      const sitesForRun = state.sites.map((site) => ({ ...site, enabled: selectedSiteIds.includes(site.id) }));
      if (sitesForRun.length) {
        await api.setTestSites({ sites: sitesForRun });
      }
      const nextState = await api.startRun({
        configPath: configPath.trim(),
        regionIds: selectedRegionIds as RegionPreset["id"][],
      });
      setState(nextState);
      setSelectedRunId(selectedRegionIds.length > 1 ? "all" : nextState.runs[0]?.id ?? "all");
      setProgress("测试完成");
      setProgressLog((current) => [...current.slice(-17), "测试完成"]);
      setActiveView("analysis");
      didSucceed = true;
    } catch (caught) {
      setError(toErrorMessage(caught));
      setProgress("测试失败");
      setProgressLog((current) => [...current.slice(-17), `测试失败：${toErrorMessage(caught)}`]);
    } finally {
      isRunInFlightRef.current = false;
      setIsRunPending(false);
      if (didSucceed) setRunProgress(null);
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

  async function copyInstallCommand() {
    setError(null);
    try {
      await navigator.clipboard.writeText("go install github.com/nic519/clash-speedtest@latest");
      setProgress("已复制安装命令");
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
      setSelectedSiteIds(savedSites.filter((site) => site.enabled !== false).map((site) => site.id));
      setProgress(`已保存 ${savedSites.length} 个测试网站，其中 ${enabledSiteCount} 个已启用`);
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  async function saveProbeSettings(settings: ProbeSettings) {
    setError(null);
    try {
      const savedSettings = await api.setProbeSettings({ settings });
      setState((current) => ({ ...current, probeSettings: savedSettings }));
      setProgress(`已保存 Probe API：${savedSettings.url}`);
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card">
        <TopNavigation activeView={activeView} onChange={setActiveView} state={state.clashSpeedtest} />
      </header>

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
            configInspection={configInspection}
            isInspectingConfig={isInspectingConfig}
            selectedSiteIds={selectedSiteIds}
            onToggleSite={toggleSite}
            progress={progress}
            runProgress={runProgress}
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
          />
        ) : null}

        {activeView === "diagnostics" ? (
          <DiagnosticsView
            state={state.clashSpeedtest}
            sites={state.sites}
            probeSettings={state.probeSettings}
            onSelectBinary={selectClashSpeedtestBinary}
            onSetBinaryPath={setClashSpeedtestBinaryPath}
            onResetBinaryPath={resetClashSpeedtestBinaryPath}
            onSaveSites={saveTestSites}
            onSaveProbeSettings={saveProbeSettings}
            onExportAllResults={exportAllResults}
            onCopyInstallCommand={copyInstallCommand}
            canExportResults={Boolean(state.results.length)}
            themeMode={themeMode}
            onThemeModeChange={setThemeMode}
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

  function toggleSite(siteId: string) {
    setSelectedSiteIds((current) =>
      current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId],
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

function readInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem("latency-compass-theme");
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function looksInspectableConfigPath(configPath: string) {
  if (!configPath) return false;
  if (/^https?:\/\//i.test(configPath)) return true;
  return /\.(yaml|yml|json)(\?.*)?$/i.test(configPath);
}
