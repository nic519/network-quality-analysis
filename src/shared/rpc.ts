import type { RPCSchema } from "electrobun/bun";
import type { HistoryFilters, RegionPreset, ResultRow, RunRecord } from "./domain";

export type AppState = {
  regions: RegionPreset[];
  runs: RunRecord[];
  results: ResultRow[];
};

export type StartRunParams = {
  configPath: string;
  regionIds: RegionPreset["id"][];
};

export type ExportCsvResponse = {
  detailsPath: string;
  summaryPath: string;
};

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      getAppState: { params: HistoryFilters; response: AppState };
      startRun: { params: StartRunParams; response: AppState };
      exportCsv: { params: HistoryFilters; response: ExportCsvResponse };
    };
    messages: {
      log: { message: string };
    };
  }>;
  webview: RPCSchema<{
    messages: {
      progress: { message: string };
    };
  }>;
};
