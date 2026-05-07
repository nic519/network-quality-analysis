import type { RPCSchema } from "electrobun/bun";
import type { HistoryFilters, RegionPreset, ResultRow, RunRecord } from "./domain";

export const APP_RPC_TIMEOUT_MS = 10 * 60 * 1000;

export type AppState = {
  regions: RegionPreset[];
  runs: RunRecord[];
  results: ResultRow[];
  configHistory: ConfigHistoryItem[];
  clashSpeedtest: ClashSpeedtestState;
};

export type ClashSpeedtestState = {
  status: "missing" | "ready" | "downloading" | "checking-update" | "error";
  version: string;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  updateCheckStatus: "idle" | "ok" | "failed";
  updateCheckMessage: string | null;
  path: string | null;
  source: "environment" | "cache" | "manual" | null;
  message: string;
  checkedAt: string;
};

export type StartRunParams = {
  configPath: string;
  regionIds: RegionPreset["id"][];
};

export type ExportCsvResponse = {
  summaryPath: string;
};

export type OpenExternalUrlParams = {
  url: string;
};

export type SelectConfigFileParams = {
  currentPath?: string;
};

export type SelectClashSpeedtestBinaryParams = {
  currentPath?: string | null;
};

export type ConfigHistoryItem = {
  path: string;
  lastUsedAt: string;
  useCount: number;
};

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      getAppState: { params: HistoryFilters; response: AppState };
      selectConfigFile: { params: SelectConfigFileParams; response: string | null };
      selectClashSpeedtestBinary: { params: SelectClashSpeedtestBinaryParams; response: string | null };
      openExternalUrl: { params: OpenExternalUrlParams; response: null };
      startRun: { params: StartRunParams; response: AppState };
      exportCsv: { params: HistoryFilters; response: ExportCsvResponse | null };
    };
    messages: {
      log: { message: string };
    };
  }>;
  webview: RPCSchema<{
    messages: {
      progress: { message: string };
      clashSpeedtestStatus: ClashSpeedtestState;
    };
  }>;
};
