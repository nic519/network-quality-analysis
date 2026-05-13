import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";

type ProbeConfigSplit = {
  probeConfigPath: string | null;
  cachedConfigPath: string | null;
  cleanup: () => Promise<void>;
};

type LoadConfigOptions = {
  fetchText?: (url: string) => Promise<string>;
  readTextFile?: (path: string) => Promise<string>;
};

export async function createProbeConfigSplit(
  configPath: string,
  cachedProxyIds: string[],
  options: LoadConfigOptions = {},
): Promise<ProbeConfigSplit | null> {
  const cachedProxyIdSet = new Set(cachedProxyIds.map((id) => id.trim()).filter(Boolean));
  if (!cachedProxyIdSet.size) return null;
  if (configPath.includes(",")) {
    throw new Error("无法按 proxyId 拆分多个配置路径，请先使用单一 Clash/Mihomo 配置再启用出口 IP 缓存复用。");
  }

  const raw = await loadConfigText(configPath, options);
  const parsed = YAML.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("无法按 proxyId 拆分配置：配置内容不是有效对象。");
  }
  if (hasProxyProviders(parsed)) {
    throw new Error("无法按 proxyId 拆分包含 proxy-providers 的配置，请先展开为静态 proxies 后再启用出口 IP 缓存复用。");
  }
  if (!Array.isArray(parsed.proxies)) {
    throw new Error("无法按 proxyId 拆分配置：未找到静态 proxies 列表。");
  }

  const cachedProxies: unknown[] = [];
  const probeProxies: unknown[] = [];
  for (const proxy of parsed.proxies) {
    if (!isRecord(proxy)) {
      probeProxies.push(proxy);
      continue;
    }

    // proxyId 是 clash-speedtest 输出里的稳定节点身份，不取节点名。
    // 它由协议、服务器、端口和连接参数共同决定，用来判断同一个节点是否已经有出口 IP 缓存。
    const proxyId = proxyIdFromProxyConfig(proxy);
    if (cachedProxyIdSet.has(proxyId)) {
      cachedProxies.push(proxy);
    } else {
      probeProxies.push(proxy);
    }
  }

  if (!cachedProxies.length) return null;
  if (!probeProxies.length) {
    return {
      probeConfigPath: null,
      cachedConfigPath: configPath,
      cleanup: async () => {},
    };
  }

  const tempDir = await mkdtemp(join(tmpdir(), "latency-probe-config-"));
  const probeConfigPath = join(tempDir, "probe.yaml");
  const cachedConfigPath = join(tempDir, "cached.yaml");
  await Promise.all([
    writeFile(probeConfigPath, YAML.stringify({ ...parsed, proxies: probeProxies }), "utf8"),
    writeFile(cachedConfigPath, YAML.stringify({ ...parsed, proxies: cachedProxies }), "utf8"),
  ]);

  return {
    probeConfigPath,
    cachedConfigPath,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  };
}

export function proxyIdFromProxyConfig(proxyConfig: Record<string, unknown>) {
  const parts = [
    `type=${valueString(proxyConfig.type)}`,
    `server=${valueString(proxyConfig.server)}`,
    `port=${valueString(proxyConfig.port)}`,
  ];

  for (const key of [
    "network",
    "cipher",
    "uuid",
    "password",
    "username",
    "alterId",
    "sni",
    "servername",
    "ws-opts",
    "grpc-opts",
    "reality-opts",
  ]) {
    if (Object.hasOwn(proxyConfig, key)) {
      parts.push(`${key}=${valueString(proxyConfig[key])}`);
    }
  }

  if (!Object.keys(proxyConfig).length) {
    parts.push("name=", "proxy_type=");
  }

  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

async function loadConfigText(configPath: string, options: LoadConfigOptions) {
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

function hasProxyProviders(parsed: Record<string, unknown>) {
  const providers = parsed["proxy-providers"];
  return isRecord(providers) && Object.keys(providers).length > 0;
}

function valueString(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return `[${value.map(valueString).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${key}=${valueString(value[key])}`)
      .join(",")}}`;
  }
  return String(value).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
