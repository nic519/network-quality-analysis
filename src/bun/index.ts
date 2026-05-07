import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BrowserView, BrowserWindow } from "electrobun/bun";
import { writeCsvExport } from "./csv";
import { LatencyDatabase } from "./db";
import { chooseConfigFile } from "./file-dialog";
import { runLatencyTest } from "./runner";
import { REGION_PRESETS, type HistoryFilters } from "../shared/domain";
import type { AppRPC } from "../shared/rpc";

const appDir = join(homedir(), "Library/Application Support/Latency Compass");
const exportDir = join(appDir, "exports");
mkdirSync(appDir, { recursive: true });

const db = new LatencyDatabase(join(appDir, "latency-compass.sqlite"));
db.migrate();

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 30 * 60 * 1000,
  handlers: {
    requests: {
      getAppState: (filters) => getAppState(filters),
      selectConfigFile: ({ currentPath }) => chooseConfigFile({ currentPath }),
      startRun: async ({ configPath, regionIds }) => {
        const output = await runLatencyTest(
          { configPath, regionIds },
          {
            onProgress: (message) => window.webview.rpc?.send.progress({ message }),
          },
        );

        db.saveRun(output.run);
        db.saveResults(output.results);
        return getAppState({ regionIds });
      },
      exportCsv: (filters) => {
        const results = db.queryResults(filters);
        const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
        return writeCsvExport(results, exportDir, `latency-${stamp}`);
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

function getAppState(filters: HistoryFilters = {}) {
  return {
    regions: REGION_PRESETS,
    runs: db.listRuns(),
    results: db.queryResults(filters),
  };
}
