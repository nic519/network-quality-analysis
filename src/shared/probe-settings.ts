export type ProbeSettings = {
  enabled: boolean;
  url: string;
  fields: string;
  timeout: string;
};

export type ProbeProviderPreset = {
  id: string;
  label: string;
  description: string;
  settings: ProbeSettings;
};

export const PROBE_PROVIDER_PRESETS = [
  {
    id: "ip-sb",
    label: "ip.sb",
    description: "内置 GeoIP 预设，默认用于识别出口 IP、地区和 ASN。",
    settings: {
      enabled: true,
      url: "https://api.ip.sb/geoip/",
      fields: "ip=ip,country=country,country_code=country_code,region=region,city=city,asn=asn,org=organization",
      timeout: "15s",
    },
  },
  {
    id: "realip-cc",
    label: "realip.cc",
    description: "内置 IP 测试提供商，使用 realip.cc 返回的出口网络与运营商字段。",
    settings: {
      enabled: true,
      url: "https://realip.cc/",
      fields: "ip=ip,country=country,country_code=iso_code,region=province,city=city,asn=network,org=isp",
      timeout: "15s",
    },
  },
] as const satisfies readonly ProbeProviderPreset[];

export const DEFAULT_PROBE_SETTINGS: ProbeSettings = PROBE_PROVIDER_PRESETS[0].settings;

export function findProbeProviderPreset(settings: ProbeSettings): ProbeProviderPreset | null {
  return (
    PROBE_PROVIDER_PRESETS.find(
      (preset) => preset.settings.url === settings.url && preset.settings.fields === settings.fields && preset.settings.timeout === settings.timeout,
    ) ?? null
  );
}

export function normalizeProbeSettings(settings: Partial<ProbeSettings> | null | undefined): ProbeSettings {
  const enabled = settings?.enabled !== false;
  const url = settings?.url?.trim() ?? "";
  if (!/^https?:\/\//i.test(url)) return { ...DEFAULT_PROBE_SETTINGS, enabled };

  return {
    enabled,
    url,
    fields: settings?.fields?.trim() || DEFAULT_PROBE_SETTINGS.fields,
    timeout: settings?.timeout?.trim() || DEFAULT_PROBE_SETTINGS.timeout,
  };
}
