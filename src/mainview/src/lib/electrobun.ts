import { Electroview } from "electrobun/view";
import { REGION_PRESETS, type HistoryFilters } from "../../../shared/domain";
import type { AppRPC } from "../../../shared/rpc";
import type { AppState, ExportCsvResponse, StartRunParams } from "../../../shared/rpc";

export type ProgressHandler = (message: string) => void;

let progressHandler: ProgressHandler | null = null;

const rpc = Electroview.defineRPC<AppRPC>({
  handlers: {
    messages: {
      progress: ({ message }) => progressHandler?.(message),
    },
  },
});

const electroview = new Electroview({ rpc });

export function onProgress(handler: ProgressHandler) {
  progressHandler = handler;
  return () => {
    if (progressHandler === handler) progressHandler = null;
  };
}

const isElectrobun = "__electrobunBunBridge" in window;

export const api = isElectrobun ? electroview.rpc!.request : createPreviewApi();

function createPreviewApi() {
  const sample: AppState = {
    regions: REGION_PRESETS,
    runs: [
      {
        id: "preview-run",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: "completed",
        selectedRegions: ["hong-kong"],
        errorMessage: null,
      },
    ],
    results: [
      makePreviewResult("hong-kong", "香港", "HK-03", "Trojan", "YouTube", "128ms"),
      makePreviewResult("hong-kong", "香港", "HK-03", "Trojan", "X", "152ms"),
      makePreviewResult("hong-kong", "香港", "HK-03", "Trojan", "GitHub", "286ms"),
      makePreviewResult("hong-kong", "香港", "HK-11", "Vmess", "YouTube", "312ms"),
      makePreviewResult("hong-kong", "香港", "HK-11", "Vmess", "X", "N/A"),
      makePreviewResult("hong-kong", "香港", "HK-11", "Vmess", "GitHub", "188ms"),
    ],
  };

  return {
    getAppState: async (_filters: HistoryFilters) => sample,
    startRun: async (_params: StartRunParams) => {
      progressHandler?.("浏览器预览模式：真实测试会在 Electrobun 桌面应用内运行");
      return sample;
    },
    selectConfigFile: async ({ currentPath }: { currentPath?: string }) => {
      progressHandler?.("浏览器预览模式：系统文件选择器会在 Electrobun 桌面应用内打开");
      return currentPath?.trim() ? currentPath : null;
    },
    exportCsv: async (_filters: HistoryFilters): Promise<ExportCsvResponse> => ({
      detailsPath: "~/Library/Application Support/Latency Compass/exports/preview-details.csv",
      summaryPath: "~/Library/Application Support/Latency Compass/exports/preview-summary.csv",
    }),
  };
}

function makePreviewResult(
  regionId: "hong-kong" | "japan",
  regionLabel: string,
  proxyName: string,
  proxyType: string,
  siteName: string,
  latency: string,
) {
  return {
    runId: "preview-run",
    regionId,
    regionLabel,
    siteId: siteName.toLowerCase(),
    siteName,
    siteUrl: `https://${siteName.toLowerCase()}.example.com`,
    sequence: "1.",
    proxyId: `${regionId}-${proxyType.toLowerCase()}-${proxyName.toLowerCase()}`,
    proxyName,
    proxyType,
    latency,
    jitter: "N/A",
    packetLoss: "N/A",
    downloadSpeed: "N/A",
    uploadSpeed: "N/A",
  };
}
