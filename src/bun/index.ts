import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import { writeCsvExport } from "./csv";
import { LatencyDatabase } from "./db";
import { chooseClashSpeedtestBinary, chooseConfigFile, chooseExportDirectory } from "./file-dialog";
import { buildApplicationMenu } from "./menu";
import { runLatencyTest } from "./runner";
import { getClashSpeedtestState, makeClashSpeedtestState } from "./clash-speedtest";
import { DEFAULT_SITES, REGION_PRESETS, normalizeSiteDefinitions, type HistoryFilters, type SiteDefinition } from "../shared/domain";
import { DEFAULT_PROBE_SETTINGS, normalizeProbeSettings, type ProbeSettings } from "../shared/probe-settings";
import { APP_RPC_TIMEOUT_MS, type AppRPC, type ClashSpeedtestState } from "../shared/rpc";

const appDir = join(homedir(), "Library/Application Support/Latency Compass");
mkdirSync(appDir, { recursive: true });
const manualBinaryPathFile = join(appDir, "clash-speedtest-manual-path.txt");
const testSitesFile = join(appDir, "test-sites.json");
const probeSettingsFile = join(appDir, "probe-settings.json");

const db = new LatencyDatabase(join(appDir, "latency-compass.sqlite"));
db.migrate();
ApplicationMenu.setApplicationMenu(buildApplicationMenu());
let manualClashSpeedtestPath = loadManualClashSpeedtestPath();
let testSites = loadTestSites();
let probeSettings = loadProbeSettings();
let clashSpeedtestState = makeClashSpeedtestState({
  status: "missing",
  checkedAt: new Date().toISOString(),
});

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: APP_RPC_TIMEOUT_MS,
  handlers: {
    requests: {
      getAppState: (filters) => getAppState(filters),
      selectConfigFile: ({ currentPath }) => chooseConfigFile({ currentPath, openFileDialog: Utils.openFileDialog }),
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
      openExternalUrl: async ({ url }) => {
        await openExternalUrl(url);
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
              onProgress: (message) => {
                window.webview.rpc?.send.progress({ message });
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

async function getAppState(filters: HistoryFilters = {}) {
  clashSpeedtestState = await getClashSpeedtestState({ envPath: manualClashSpeedtestPath ?? undefined });
  if (manualClashSpeedtestPath && clashSpeedtestState.path === manualClashSpeedtestPath) {
    clashSpeedtestState = makeClashSpeedtestState({
      ...clashSpeedtestState,
      source: "manual",
      checkedAt: clashSpeedtestState.checkedAt,
    });
  }
  return {
    regions: REGION_PRESETS,
    sites: testSites,
    probeSettings,
    runs: db.listRuns(),
    results: db.queryResults(filters),
    configHistory: db.listConfigHistory(),
    clashSpeedtest: clashSpeedtestState,
  };
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

async function openExternalUrl(url: string) {
  const proc = Bun.spawn(["open", url], {
    stdout: "ignore",
    stderr: "pipe",
  });
  const [stderr, exitCode] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `无法打开外部链接：${url}`);
  }
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
