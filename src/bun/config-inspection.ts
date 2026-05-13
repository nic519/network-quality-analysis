import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { REGION_PRESETS, type RegionPreset } from "../shared/domain";
import type { ConfigInspectionResult } from "../shared/rpc";

type ConfigInspectionOptions = {
  fetchText?: (url: string) => Promise<string>;
  readTextFile?: (path: string) => Promise<string>;
  regions?: RegionPreset[];
};

export async function inspectConfigRegions(
  configPath: string,
  options: ConfigInspectionOptions = {},
): Promise<ConfigInspectionResult> {
  const normalizedConfigPath = configPath.trim();
  if (!normalizedConfigPath) {
    throw new Error("请先提供 Clash/Mihomo 配置路径或订阅 URL");
  }

  const raw = await loadConfigText(normalizedConfigPath, options);
  const parsed = YAML.parse(raw);
  const proxyNames = extractProxyNames(parsed);
  const regions = options.regions ?? REGION_PRESETS;

  return {
    configPath: normalizedConfigPath,
    totalNodeCount: proxyNames.length,
    regionCounts: regions.map((region) => ({
      regionId: region.id,
      regionLabel: region.label,
      matchedNodeCount: proxyNames.filter((proxyName) => matchesRegion(proxyName, region)).length,
    })),
  };
}

async function loadConfigText(configPath: string, options: ConfigInspectionOptions) {
  if (/^https?:\/\//i.test(configPath)) {
    const fetchText =
      options.fetchText ??
      (async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`订阅请求失败：${response.status} ${response.statusText}`);
        }
        return response.text();
      });
    return fetchText(configPath);
  }

  const readTextFile = options.readTextFile ?? ((path: string) => readFile(path, "utf8"));
  return readTextFile(configPath);
}

function extractProxyNames(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") return [];

  const proxies = (parsed as { proxies?: unknown }).proxies;
  if (!Array.isArray(proxies)) return [];

  return proxies
    .map((proxy) => {
      if (!proxy || typeof proxy !== "object") return null;
      const name = (proxy as { name?: unknown }).name;
      return typeof name === "string" ? name.trim() : null;
    })
    .filter((name): name is string => Boolean(name));
}

function matchesRegion(proxyName: string, region: RegionPreset) {
  try {
    return new RegExp(region.filterRegex, "i").test(proxyName);
  } catch {
    return false;
  }
}
