import type { RPCSchema } from "electrobun/bun";
import type { HistoryFilters, RegionPreset, ResultRow, RunRecord, SiteDefinition } from "./domain";
import type { ProbeSettings } from "./probe-settings";

// 应用层 RPC 的统一超时时间，覆盖测速、导出等耗时操作。
export const APP_RPC_TIMEOUT_MS = 10 * 60 * 1000;

// 前端初始化和刷新页面时使用的完整应用状态快照。
export type AppState = {
  // 当前可用的地区预设列表。
  regions: RegionPreset[];
  // 当前参与测速的网站定义列表。
  sites: SiteDefinition[];
  // 当前用于节点出口探测的 probe API 配置。
  probeSettings: ProbeSettings;
  // 历史测速任务记录。
  runs: RunRecord[];
  // 历史测速结果明细。
  results: ResultRow[];
  // 配置文件使用历史，用于快速回填最近选择过的配置。
  configHistory: ConfigHistoryItem[];
  // clash-speedtest 可执行文件的检测状态。
  clashSpeedtest: ClashSpeedtestState;
};

// clash-speedtest 二进制工具的可用性状态。
export type ClashSpeedtestState = {
  // 当前检查结果：缺失、可用或异常。
  status: "missing" | "ready" | "error";
  // 已检测到的版本号；未检测到时为空。
  version: string | null;
  // 当前实际使用的二进制路径；未定位到时为空。
  path: string | null;
  // 当前路径来源：环境变量、自动安装、手动指定或未知。
  source: "environment" | "go-install" | "manual" | null;
  // 给界面展示的状态说明或错误信息。
  message: string;
  // 最近一次完成检测的时间戳。
  checkedAt: string;
};

export type RunProgressState = {
  stage: "running" | "completed" | "failed";
  completedGroups: number;
  totalGroups: number;
  percent: number;
  currentGroupNodeIndex: number | null;
  currentGroupEstimatedNodeCount: number | null;
  currentRegionId: string | null;
  currentRegionLabel: string | null;
  currentSiteId: string | null;
  currentSiteName: string | null;
  currentSiteUrl: string | null;
  currentGroupLabel: string | null;
  currentGroupNodeCount: number | null;
  message: string;
};

// 发起一次测速任务时需要的参数。
export type StartRunParams = {
  // 选中的 Clash 配置文件路径。
  configPath: string;
  // 本次要执行测速的地区 ID 列表。
  regionIds: RegionPreset["id"][];
};

// 导出 CSV 成功后返回的文件信息。
export type ExportCsvResponse = {
  // 汇总 CSV 文件的输出路径。
  summaryPath: string;
};

// 打开外部链接时使用的参数。
export type OpenExternalUrlParams = {
  // 需要交给系统浏览器打开的完整 URL。
  url: string;
};

// 选择配置文件时的可选上下文参数。
export type SelectConfigFileParams = {
  // 当前配置路径，用于让文件选择器定位到更合适的初始目录。
  currentPath?: string;
};

// 选择 clash-speedtest 可执行文件时的可选上下文参数。
export type SelectClashSpeedtestBinaryParams = {
  // 当前已配置的二进制路径，用于作为文件选择器的默认位置。
  currentPath?: string | null;
};

// 手动设置 clash-speedtest 路径时使用的参数。
export type SetClashSpeedtestBinaryPathParams = {
  // 用户指定的可执行文件绝对路径。
  path: string;
};

// 批量更新测速站点列表时使用的参数。
export type SetTestSitesParams = {
  // 更新后的完整站点定义集合。
  sites: SiteDefinition[];
};

export type SetProbeSettingsParams = {
  settings: ProbeSettings;
};

// 重置自定义二进制路径后的返回结果。
export type ResetClashSpeedtestBinaryPathResponse = {
  // 是否真的清除了已有配置。
  cleared: boolean;
};

// 配置文件历史记录项，用于展示最近使用情况。
export type ConfigHistoryItem = {
  // 配置文件路径。
  path: string;
  // 最近一次使用时间。
  lastUsedAt: string;
  // 被使用的累计次数。
  useCount: number;
};

// 应用进程与 WebView 之间共享的 RPC 协议定义。
export type AppRPC = {
  // bun 侧暴露给 WebView 主动调用的请求接口。
  bun: RPCSchema<{
    requests: {
      // 获取应用状态，支持按筛选条件返回历史任务与结果。
      getAppState: { params: HistoryFilters; response: AppState };
      // 打开系统文件选择器，让用户选择 Clash 配置文件。
      selectConfigFile: { params: SelectConfigFileParams; response: string | null };
      // 打开系统文件选择器，让用户选择 clash-speedtest 可执行文件。
      selectClashSpeedtestBinary: { params: SelectClashSpeedtestBinaryParams; response: string | null };
      // 保存用户手动指定的 clash-speedtest 路径，并返回最终生效路径。
      setClashSpeedtestBinaryPath: { params: SetClashSpeedtestBinaryPathParams; response: string | null };
      // 清除手动配置的 clash-speedtest 路径，回退到自动探测逻辑。
      resetClashSpeedtestBinaryPath: { params: undefined; response: ResetClashSpeedtestBinaryPathResponse };
      // 保存测速站点配置，并返回最新站点列表。
      setTestSites: { params: SetTestSitesParams; response: SiteDefinition[] };
      // 保存节点出口 probe API 配置，并返回规范化后的配置。
      setProbeSettings: { params: SetProbeSettingsParams; response: ProbeSettings };
      // 让宿主环境在外部浏览器中打开指定链接。
      openExternalUrl: { params: OpenExternalUrlParams; response: null };
      // 根据配置文件和地区列表启动一次完整测速，并返回刷新后的应用状态。
      startRun: { params: StartRunParams; response: AppState };
      // 按当前筛选条件导出 CSV，未生成文件时返回空。
      exportCsv: { params: HistoryFilters; response: ExportCsvResponse | null };
    };
    messages: {
      // bun 侧向 WebView 推送通用日志文本。
      log: { message: string };
    };
  }>;
  // webview 侧监听的被动消息，用于接收运行时进度和状态变更。
  webview: RPCSchema<{
    messages: {
      // 实时进度文本，例如当前正在测速的地区或步骤。
      progress: { message: string };
      // 实时结构化进度，用于驱动进度条与当前测试目标展示。
      runProgress: RunProgressState;
      // clash-speedtest 检测状态更新，用于驱动界面展示。
      clashSpeedtestStatus: ClashSpeedtestState;
    };
  }>;
};
