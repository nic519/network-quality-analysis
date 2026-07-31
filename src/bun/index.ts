import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import { collectClashObservation } from "./clash-observation";
import { writeCsvExport } from "./csv";
import { inspectConfigRegions } from "./config-inspection";
import { LatencyDatabase } from "./db";
import { chooseClashSpeedtestBinary, chooseConfigFile, chooseExportDirectory } from "./file-dialog";
import { openExternalUrl } from "./external-url";
import { buildApplicationMenu } from "./menu";
import { runLatencyTest } from "./runner";
import { migrateLegacyMacUserData } from "./user-data";
import { getClashSpeedtestState, makeClashSpeedtestState } from "./clash-speedtest";
import { DEFAULT_SITES, REGION_PRESETS, normalizeSiteDefinitions, type HistoryFilters, type SiteDefinition } from "../shared/domain";
import { DEFAULT_CLASH_OBSERVATION_SETTINGS, normalizeClashObservationSettings, type ClashObservationSettings } from "../shared/clash-observation";
import { DEFAULT_PROBE_SETTINGS, normalizeProbeSettings, type ProbeSettings } from "../shared/probe-settings";
import { APP_RPC_TIMEOUT_MS, type AppRPC, type ClashSpeedtestState } from "../shared/rpc";

const appDir = Utils.paths.userData;
mkdirSync(appDir, { recursive: true });
migrateLegacyMacUserData({ appDirectory: appDir });
const manualBinaryPathFile = join(appDir, "clash-speedtest-manual-path.txt");
const testSitesFile = join(appDir, "test-sites.json");
const probeSettingsFile = join(appDir, "probe-settings.json");
const clashObservationSettingsFile = join(appDir, "clash-observation-settings.json");

const db = new LatencyDatabase(join(appDir, "latency-compass.sqlite"));
db.migrate();
ApplicationMenu.setApplicationMenu(buildApplicationMenu());
let manualClashSpeedtestPath = loadManualClashSpeedtestPath();
let testSites = loadTestSites();
let probeSettings = loadProbeSettings();
let clashObservationSettings = loadClashObservationSettings();
let clashSpeedtestState = makeClashSpeedtestState({
  status: "missing",
  checkedAt: new Date().toISOString(),
});
let clashObservationTimer: ReturnType<typeof setInterval> | null = null;

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: APP_RPC_TIMEOUT_MS,
  handlers: {
    requests: {
      getAppState: (filters) => getAppState(filters),
      selectConfigFile: ({ currentPath }) => chooseConfigFile({ currentPath, openFileDialog: Utils.openFileDialog }),
      inspectConfig: ({ configPath }) => inspectConfigRegions(configPath),
      selectClashSpeedtestBinary: async ({ currentPath }) => {
        const selectedPath = await chooseClashSpeedtestBinary({
          currentPath: currentPath ?? manualClashSpeedtestPath,
          openFileDialog: Utils.openFileDialog,
        });
        if (!selectedPath) return null;
        manualClashSpeedtestPath = selectedPath;
        await Bun.write(manualBinaryPathFile, `${selectedPath}\n`);
        clashSpeedtestState = await getClashSpeedtestState({ envPath: manualClashSpeedtestPath });
        publishClashSpeedtestState(
          makeClashSpeedtestState({
            ...clashSpeedtestState,
            source: "manual",
            path: manualClashSpeedtestPath,
            message:
              clashSpeedtestState.status === "ready"
                ? `已指定本地 clash-speedtest：${selectedPath}`
                : clashSpeedtestState.message,
            checkedAt: new Date().toISOString(),
          }),
        );
        return selectedPath;
      },
      setClashSpeedtestBinaryPath: async ({ path }) => {
        const selectedPath = path.trim();
        if (!selectedPath) return null;
        manualClashSpeedtestPath = selectedPath;
        await Bun.write(manualBinaryPathFile, `${selectedPath}\n`);
        clashSpeedtestState = await getClashSpeedtestState({ envPath: manualClashSpeedtestPath });
        publishClashSpeedtestState(
          makeClashSpeedtestState({
            ...clashSpeedtestState,
            source: "manual",
            path: manualClashSpeedtestPath,
            message:
              clashSpeedtestState.status === "ready"
                ? `已指定 clash-speedtest 路径：${selectedPath}`
                : clashSpeedtestState.message,
            checkedAt: new Date().toISOString(),
          }),
        );
        return selectedPath;
      },
      resetClashSpeedtestBinaryPath: async () => {
        manualClashSpeedtestPath = null;
        rmSync(manualBinaryPathFile, { force: true });
        clashSpeedtestState = await getClashSpeedtestState();
        publishClashSpeedtestState(
          makeClashSpeedtestState({
            ...clashSpeedtestState,
            message: clashSpeedtestState.path ? "已切换为系统命令依赖" : "已切换为系统命令依赖，当前未检测到 clash-speedtest",
            checkedAt: new Date().toISOString(),
          }),
        );
        return { cleared: true };
      },
      setTestSites: async ({ sites }) => {
        testSites = normalizeSiteDefinitions(sites);
        await Bun.write(testSitesFile, JSON.stringify(testSites, null, 2));
        return testSites;
      },
      setProbeSettings: async ({ settings }) => {
        probeSettings = normalizeProbeSettings(settings);
        await Bun.write(probeSettingsFile, JSON.stringify(probeSettings, null, 2));
        return probeSettings;
      },
      setClashObservationSettings: async ({ settings }) => {
        clashObservationSettings = normalizeClashObservationSettings(settings);
        await Bun.write(clashObservationSettingsFile, JSON.stringify(clashObservationSettings, null, 2));
        scheduleClashObservation();
        return getAppState({});
      },
      runClashObservation: async () => {
        await runAndSaveClashObservation("manual");
        return getAppState({});
      },
      getClashObservationDetail: async ({ observationId }) => db.getClashObservationDetail(observationId),
      openExternalUrl: async ({ url }) => {
        openExternalUrl(url, Utils.openExternal);
        return null;
      },
      startRun: async ({ configPath, regionIds }) => {
        try {
          const dependencyState = await getClashSpeedtestState({ envPath: manualClashSpeedtestPath ?? undefined });
          if (dependencyState.status !== "ready") {
            publishClashSpeedtestState(dependencyState);
            throw new Error(dependencyState.message);
          }
          publishClashSpeedtestState(
            makeClashSpeedtestState({
              ...dependencyState,
              message: "已检测到匹配版本的 clash-speedtest，开始执行测试",
              checkedAt: new Date().toISOString(),
            }),
          );

          const output = await runLatencyTest(
            { configPath, regionIds },
            {
              binaryPath: manualClashSpeedtestPath && existsSync(manualClashSpeedtestPath) ? manualClashSpeedtestPath : undefined,
              sites: testSites,
              probeSettings,
              cachedProbeProxyIds: db.listCachedProbeProxyIds(),
              onProgress: (message) => {
                window.webview.rpc?.send.progress({ message });
              },
              onStructuredProgress: (progress) => {
                window.webview.rpc?.send.runProgress(progress);
              },
            },
          );

          for (const run of output.runs) db.saveRun(run);
          db.saveResults(output.results);
          db.saveConfigHistory(configPath, output.run.completedAt ?? output.run.startedAt);
          clashSpeedtestState = await getClashSpeedtestState({ envPath: manualClashSpeedtestPath ?? undefined });
          publishClashSpeedtestState(clashSpeedtestState);
          return getAppState(output.runs.length === 1 ? { runId: output.run.id } : {});
        } catch (error) {
          publishClashSpeedtestState(
            makeClashSpeedtestState({
              ...clashSpeedtestState,
              status: "error",
              message: `clash-speedtest 准备失败：${toErrorMessage(error)}`,
              checkedAt: new Date().toISOString(),
            }),
          );
          throw error;
        }
      },
      deleteRun: async ({ runId }) => {
        db.deleteRun(runId);
        return getAppState({});
      },
      exportCsv: async (filters) => {
        const results = db.queryResults(filters);
        const outputDir = await awaitExportDirectory();
        if (!outputDir) return null;
        const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
        return writeCsvExport(results, outputDir, `latency-${stamp}`);
      },
    },
    messages: {
      log: ({ message }) => console.log(`[webview] ${message}`),
    },
  },
});

let window: BrowserWindow<typeof rpc>;

window = new BrowserWindow<typeof rpc>({
  title: "Latency Compass",
  url: "views://mainview/index.html",
  frame: {
    x: 80,
    y: 80,
    width: 1280,
    height: 860,
  },
  rpc,
});
if (Bun.env.LATENCY_COMPASS_VERIFY_LOCAL_APP) {
  await Bun.write(
    Bun.env.LATENCY_COMPASS_VERIFY_LOCAL_APP,
    JSON.stringify({ marker: "[latency-compass] BrowserWindow created", pid: process.pid }),
  );
}
scheduleClashObservation();

async function getAppState(filters: HistoryFilters = {}) {
  clashSpeedtestState = await getClashSpeedtestState({ envPath: manualClashSpeedtestPath ?? undefined });
  if (manualClashSpeedtestPath && clashSpeedtestState.path === manualClashSpeedtestPath) {
    clashSpeedtestState = makeClashSpeedtestState({
      ...clashSpeedtestState,
      source: "manual",
      checkedAt: clashSpeedtestState.checkedAt,
    });
  }
  const results = db.queryResults(filters);
  return {
    regions: REGION_PRESETS,
    sites: testSites,
    probeSettings,
    clashObservation: {
      settings: clashObservationSettings,
      summaries: db.listClashObservationSummaries(),
      logEvents: db.listClashLogEvents(),
    },
    runs: db.listRuns(),
    results,
    proxyHistoryStats: db.queryProxyHistoryStats(results.map((row) => row.proxyId)),
    configHistory: db.listConfigHistory(),
    clashSpeedtest: clashSpeedtestState,
  };
}

function scheduleClashObservation() {
  if (clashObservationTimer) {
    clearInterval(clashObservationTimer);
    clashObservationTimer = null;
  }
  if (!clashObservationSettings.enabled) return;

  clashObservationTimer = setInterval(() => {
    void runAndSaveClashObservation("scheduled").catch((error) => {
      console.warn(`[clash-observation] scheduled collection failed: ${toErrorMessage(error)}`);
    });
  }, clashObservationSettings.intervalMinutes * 60 * 1000);
}

async function runAndSaveClashObservation(source: "manual" | "scheduled") {
  const bundle = await collectClashObservation(clashObservationSettings);
  db.saveClashObservation(bundle);
  pruneOldClashObservations();
  if (source === "manual") {
    window.webview.rpc?.send.progress({
      message: bundle.run.status === "completed" ? "Clash 观测完成" : `Clash 观测失败：${bundle.run.errorMessage ?? "未知错误"}`,
    });
  }
  return bundle;
}

function pruneOldClashObservations(now = new Date()) {
  const cutoff = new Date(now.getTime() - clashObservationSettings.retentionDays * 24 * 60 * 60 * 1000);
  db.pruneClashObservations(cutoff.toISOString());
}

function publishClashSpeedtestState(state: ClashSpeedtestState) {
  clashSpeedtestState = state;
  window.webview.rpc?.send.clashSpeedtestStatus(state);
}

async function awaitExportDirectory() {
  return chooseExportDirectory({ openFileDialog: Utils.openFileDialog });
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function loadManualClashSpeedtestPath() {
  if (!existsSync(manualBinaryPathFile)) return null;
  const content = readFileSync(manualBinaryPathFile, "utf8").trim();
  return content || null;
}

function loadTestSites(): SiteDefinition[] {
  if (!existsSync(testSitesFile)) return DEFAULT_SITES;

  try {
    const parsed = JSON.parse(readFileSync(testSitesFile, "utf8")) as SiteDefinition[];
    return normalizeSiteDefinitions(Array.isArray(parsed) ? parsed : []);
  } catch {
    return DEFAULT_SITES;
  }
}

function loadProbeSettings(): ProbeSettings {
  if (!existsSync(probeSettingsFile)) return DEFAULT_PROBE_SETTINGS;

  try {
    const parsed = JSON.parse(readFileSync(probeSettingsFile, "utf8")) as Partial<ProbeSettings>;
    return normalizeProbeSettings(parsed);
  } catch {
    return DEFAULT_PROBE_SETTINGS;
  }
}

function loadClashObservationSettings(): ClashObservationSettings {
  if (!existsSync(clashObservationSettingsFile)) return DEFAULT_CLASH_OBSERVATION_SETTINGS;

  try {
    const parsed = JSON.parse(readFileSync(clashObservationSettingsFile, "utf8")) as Partial<ClashObservationSettings>;
    return normalizeClashObservationSettings(parsed);
  } catch {
    return DEFAULT_CLASH_OBSERVATION_SETTINGS;
  }
}
