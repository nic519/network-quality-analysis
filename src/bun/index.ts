import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import { writeCsvExport } from "./csv";
import { LatencyDatabase } from "./db";
import { chooseClashSpeedtestBinary, chooseConfigFile, chooseExportDirectory } from "./file-dialog";
import { buildApplicationMenu } from "./menu";
import { runLatencyTest } from "./runner";
import { CLASH_SPEEDTEST_VERSION, getClashSpeedtestState, makeClashSpeedtestState } from "./clash-speedtest";
import { REGION_PRESETS, type HistoryFilters } from "../shared/domain";
import { APP_RPC_TIMEOUT_MS, type AppRPC, type ClashSpeedtestState } from "../shared/rpc";

const appDir = join(homedir(), "Library/Application Support/Latency Compass");
mkdirSync(appDir, { recursive: true });
const manualBinaryPathFile = join(appDir, "clash-speedtest-manual-path.txt");

const db = new LatencyDatabase(join(appDir, "latency-compass.sqlite"));
db.migrate();
ApplicationMenu.setApplicationMenu(buildApplicationMenu());
let manualClashSpeedtestPath = loadManualClashSpeedtestPath();
let clashSpeedtestState = makeClashSpeedtestState({
  status: "checking-update",
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
            message: `已指定本地 clash-speedtest：${selectedPath}`,
            checkedAt: new Date().toISOString(),
          }),
        );
        return selectedPath;
      },
      openExternalUrl: async ({ url }) => {
        await openExternalUrl(url);
        return null;
      },
      startRun: async ({ configPath, regionIds }) => {
        publishClashSpeedtestState(
          makeClashSpeedtestState({
            ...clashSpeedtestState,
            status: clashSpeedtestState.path ? "ready" : "downloading",
            message: clashSpeedtestState.path
              ? `clash-speedtest 已就绪，当前版本 ${CLASH_SPEEDTEST_VERSION}`
              : `正在下载 clash-speedtest ${CLASH_SPEEDTEST_VERSION}`,
            checkedAt: new Date().toISOString(),
          }),
        );

        try {
          const output = await runLatencyTest(
            { configPath, regionIds },
            {
              binaryPath: manualClashSpeedtestPath && existsSync(manualClashSpeedtestPath) ? manualClashSpeedtestPath : undefined,
              onProgress: (message) => {
                window.webview.rpc?.send.progress({ message });
                if (message.includes("下载 clash-speedtest")) {
                  publishClashSpeedtestState(
                    makeClashSpeedtestState({
                      ...clashSpeedtestState,
                      status: "downloading",
                      message,
                      checkedAt: new Date().toISOString(),
                    }),
                  );
                }
                if (message.includes("clash-speedtest 准备完成")) {
                  publishClashSpeedtestState(
                    makeClashSpeedtestState({
                      ...clashSpeedtestState,
                      status: "ready",
                      message,
                      checkedAt: new Date().toISOString(),
                    }),
                  );
                }
              },
            },
          );

          db.saveRun(output.run);
          db.saveResults(output.results);
          db.saveConfigHistory(configPath, output.run.completedAt ?? output.run.startedAt);
          clashSpeedtestState = await getClashSpeedtestState({ envPath: manualClashSpeedtestPath ?? undefined });
          publishClashSpeedtestState(clashSpeedtestState);
          return getAppState({ runId: output.run.id, regionIds });
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
