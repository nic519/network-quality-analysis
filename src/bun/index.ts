import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import { writeCsvExport } from "./csv";
import { LatencyDatabase } from "./db";
import { chooseConfigFile, chooseExportDirectory } from "./file-dialog";
import { buildApplicationMenu } from "./menu";
import { runLatencyTest } from "./runner";
import { CLASH_SPEEDTEST_VERSION, getClashSpeedtestState, makeClashSpeedtestState } from "./clash-speedtest";
import { REGION_PRESETS, type HistoryFilters } from "../shared/domain";
import { APP_RPC_TIMEOUT_MS, type AppRPC, type ClashSpeedtestState } from "../shared/rpc";

const appDir = join(homedir(), "Library/Application Support/Latency Compass");
mkdirSync(appDir, { recursive: true });

const db = new LatencyDatabase(join(appDir, "latency-compass.sqlite"));
db.migrate();
ApplicationMenu.setApplicationMenu(buildApplicationMenu());
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
          clashSpeedtestState = await getClashSpeedtestState();
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
  clashSpeedtestState = await getClashSpeedtestState();
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
