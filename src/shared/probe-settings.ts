export type ProbeSettings = {
  url: string;
  fields: string;
  timeout: string;
};

export const DEFAULT_PROBE_SETTINGS: ProbeSettings = {
  url: "https://api.ip.sb/geoip/",
  fields: "ip=ip,country=country,country_code=country_code,region=region,city=city,asn=asn,org=organization",
  timeout: "8s",
};

export function normalizeProbeSettings(settings: Partial<ProbeSettings> | null | undefined): ProbeSettings {
  const url = settings?.url?.trim() ?? "";
  if (!/^https?:\/\//i.test(url)) return DEFAULT_PROBE_SETTINGS;

  return {
    url,
    fields: settings?.fields?.trim() || DEFAULT_PROBE_SETTINGS.fields,
    timeout: settings?.timeout?.trim() || DEFAULT_PROBE_SETTINGS.timeout,
  };
}
