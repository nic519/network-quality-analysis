import { Electroview } from "electrobun/view";
import { DEFAULT_SITES, REGION_PRESETS, type HistoryFilters, type RegionPreset } from "../../../shared/domain";
import { DEFAULT_PROBE_SETTINGS } from "../../../shared/probe-settings";
import { APP_RPC_TIMEOUT_MS, type AppRPC } from "../../../shared/rpc";
import type {
  AppState,
  ClashSpeedtestState,
  ConfigInspectionResult,
  ExportCsvResponse,
  InspectConfigParams,
  ResetClashSpeedtestBinaryPathResponse,
  RunProgressState,
  SetProbeSettingsParams,
  SetClashSpeedtestBinaryPathParams,
  SetTestSitesParams,
  StartRunParams,
} from "../../../shared/rpc";

export type ProgressHandler = (message: string) => void;
export type RunProgressHandler = (state: RunProgressState) => void;
export type ClashSpeedtestStatusHandler = (state: ClashSpeedtestState) => void;

let progressHandler: ProgressHandler | null = null;
let runProgressHandler: RunProgressHandler | null = null;
let clashSpeedtestStatusHandler: ClashSpeedtestStatusHandler | null = null;
const isElectrobun = "__electrobunBunBridge" in window;

export const api = isElectrobun
  ? new Electroview({
      rpc: Electroview.defineRPC<AppRPC>({
        maxRequestTime: APP_RPC_TIMEOUT_MS,
        handlers: {
          messages: {
            progress: ({ message }) => progressHandler?.(message),
            runProgress: (state) => runProgressHandler?.(state),
            clashSpeedtestStatus: (state) => clashSpeedtestStatusHandler?.(state),
          },
        },
      }),
    }).rpc!.request
  : createPreviewApi();

export function onProgress(handler: ProgressHandler) {
  progressHandler = handler;
  return () => {
    if (progressHandler === handler) progressHandler = null;
  };
}

export function onRunProgress(handler: RunProgressHandler) {
  runProgressHandler = handler;
  return () => {
    if (runProgressHandler === handler) runProgressHandler = null;
  };
}

export function onClashSpeedtestStatus(handler: ClashSpeedtestStatusHandler) {
  clashSpeedtestStatusHandler = handler;
  return () => {
    if (clashSpeedtestStatusHandler === handler) clashSpeedtestStatusHandler = null;
  };
}

function createPreviewApi() {
  const sample: AppState = {
    regions: REGION_PRESETS,
    sites: DEFAULT_SITES,
    probeSettings: DEFAULT_PROBE_SETTINGS,
    configHistory: [
      {
        path: "/Users/nicholas/Library/Application Support/mihomo-party/profiles/config.yaml",
        lastUsedAt: new Date().toISOString(),
        useCount: 2,
      },
    ],
    clashSpeedtest: {
      status: "ready",
      version: null,
      path: "~/go/bin/clash-speedtest",
      source: "go-install",
      message: "已检测到 clash-speedtest，可直接运行",
      checkedAt: new Date().toISOString(),
    },
    runs: [
      {
        id: "preview-run",
        startedAt: "2026-05-07T05:40:00.000Z",
        completedAt: "2026-05-07T05:41:00.000Z",
        status: "completed",
        selectedRegions: ["hong-kong"],
        errorMessage: null,
      },
      {
        id: "preview-run-previous",
        startedAt: "2026-05-07T05:20:00.000Z",
        completedAt: "2026-05-07T05:21:00.000Z",
        status: "completed",
        selectedRegions: ["hong-kong"],
        errorMessage: null,
      },
    ],
    results: [
      makePreviewResult("preview-run", "hong-kong", "香港", "HK-03", "Trojan", "YouTube", "128ms"),
      makePreviewResult("preview-run", "hong-kong", "香港", "HK-03", "Trojan", "X", "152ms"),
      makePreviewResult("preview-run", "hong-kong", "香港", "HK-03", "Trojan", "GitHub", "286ms"),
      makePreviewResult("preview-run", "hong-kong", "香港", "HK-11", "Vmess", "YouTube", "312ms"),
      makePreviewResult("preview-run", "hong-kong", "香港", "HK-11", "Vmess", "X", "N/A"),
      makePreviewResult("preview-run", "hong-kong", "香港", "HK-11", "Vmess", "GitHub", "188ms"),
      makePreviewResult("preview-run-previous", "hong-kong", "香港", "HK-03", "Trojan", "YouTube", "166ms"),
      makePreviewResult("preview-run-previous", "hong-kong", "香港", "HK-03", "Trojan", "X", "190ms"),
      makePreviewResult("preview-run-previous", "hong-kong", "香港", "HK-03", "Trojan", "GitHub", "340ms"),
    ],
  };

  const getFilteredState = (filters: HistoryFilters = {}) => ({
    ...sample,
    results: sample.results.filter((row) => {
      if (filters.runId && row.runId !== filters.runId) return false;
      if (filters.regionIds?.length && !filters.regionIds.includes(row.regionId)) return false;
      return true;
    }),
  });

  return {
    getAppState: async (filters: HistoryFilters) => getFilteredState(filters),
    inspectConfig: async ({ configPath }: InspectConfigParams): Promise<ConfigInspectionResult> => ({
      configPath,
      totalNodeCount: 18,
      regionCounts: [
        { regionId: "hong-kong", regionLabel: "香港", matchedNodeCount: 6 },
        { regionId: "singapore", regionLabel: "新加坡", matchedNodeCount: 4 },
        { regionId: "japan", regionLabel: "日本", matchedNodeCount: 3 },
        { regionId: "united-states", regionLabel: "美国", matchedNodeCount: 3 },
        { regionId: "taiwan", regionLabel: "台湾", matchedNodeCount: 2 },
      ],
    }),
    startRun: async (_params: StartRunParams) => {
      progressHandler?.("浏览器预览模式：真实测试会在 Electrobun 桌面应用内运行");
      runProgressHandler?.({
        stage: "completed",
        completedGroups: 0,
        totalGroups: 0,
        percent: 100,
        currentGroupNodeIndex: null,
        currentGroupEstimatedNodeCount: null,
        currentRegionId: null,
        currentRegionLabel: null,
        currentSiteId: null,
        currentSiteName: null,
        currentSiteUrl: null,
        currentGroupLabel: null,
        currentGroupNodeCount: null,
        message: "浏览器预览模式：真实测试会在 Electrobun 桌面应用内运行",
      });
      return getFilteredState({ runId: sample.runs[0]?.id });
    },
    selectConfigFile: async ({ currentPath }: { currentPath?: string }) => {
      progressHandler?.("浏览器预览模式：系统文件选择器会在 Electrobun 桌面应用内打开");
      return currentPath?.trim() ? currentPath : null;
    },
    selectClashSpeedtestBinary: async ({ currentPath }: { currentPath?: string | null }) => {
      progressHandler?.("浏览器预览模式：请在桌面应用中选择 clash-speedtest 二进制");
      return currentPath?.trim() ? currentPath : "/Users/nicholas/Downloads/clash-speedtest";
    },
    setClashSpeedtestBinaryPath: async ({ path }: SetClashSpeedtestBinaryPathParams) => {
      progressHandler?.(`浏览器预览模式：已指定 clash-speedtest 路径 ${path}`);
      return path.trim() || null;
    },
    resetClashSpeedtestBinaryPath: async (): Promise<ResetClashSpeedtestBinaryPathResponse> => {
      progressHandler?.("浏览器预览模式：已切换回系统命令依赖");
      return { cleared: true };
    },
    setTestSites: async ({ sites }: SetTestSitesParams) => {
      const enabledSiteCount = sites.filter((site) => site.enabled !== false).length;
      progressHandler?.(`浏览器预览模式：已保存 ${sites.length} 个测试网站，其中 ${enabledSiteCount} 个已启用`);
      sample.sites = sites;
      return sites;
    },
    setProbeSettings: async ({ settings }: SetProbeSettingsParams) => {
      progressHandler?.(`浏览器预览模式：已保存 Probe API ${settings.url}`);
      sample.probeSettings = settings;
      return settings;
    },
    openExternalUrl: async ({ url }: { url: string }) => {
      window.open(url, "_blank", "noopener,noreferrer");
      return null;
    },
    exportCsv: async (_filters: HistoryFilters): Promise<ExportCsvResponse> => ({
      summaryPath: "~/Desktop/latency-preview-summary.csv",
    }),
  };
}

function makePreviewResult(
  runId: string,
  regionId: RegionPreset["id"],
  regionLabel: string,
  proxyName: string,
  proxyType: string,
  siteName: string,
  latency: string,
) {
  return {
    runId,
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
