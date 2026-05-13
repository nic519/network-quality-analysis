import { describe, expect, test } from "bun:test";
import { DEFAULT_PROBE_SETTINGS, PROBE_PROVIDER_PRESETS, findProbeProviderPreset, normalizeProbeSettings } from "./probe-settings";

describe("normalizeProbeSettings", () => {
  test("defaults to api.ip.sb geoip settings", () => {
    expect(DEFAULT_PROBE_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_PROBE_SETTINGS.url).toBe("https://api.ip.sb/geoip/");
    expect(DEFAULT_PROBE_SETTINGS.fields).toContain("ip=ip");
    expect(DEFAULT_PROBE_SETTINGS.fields).toContain("org=organization");
    expect(DEFAULT_PROBE_SETTINGS.timeout).toMatch(/^\d+s$/);
  });

  test("includes realip.cc as a built-in provider preset", () => {
    const preset = PROBE_PROVIDER_PRESETS.find((item) => item.id === "realip-cc");

    expect(preset?.settings.url).toBe("https://realip.cc/");
    expect(preset?.settings.fields).toContain("country_code=iso_code");
    expect(preset?.settings.fields).toContain("region=province");
    expect(preset?.settings.fields).toContain("org=isp");
  });

  test("finds matching built-in provider presets", () => {
    expect(findProbeProviderPreset(DEFAULT_PROBE_SETTINGS)?.id).toBe("ip-sb");
    expect(
      findProbeProviderPreset({
        enabled: true,
        url: "https://example.com/probe",
        fields: "ip=query",
        timeout: "12s",
      }),
    ).toBeNull();
  });

  test("keeps usable custom probe settings", () => {
    expect(
      normalizeProbeSettings({
        url: " https://example.com/probe ",
        fields: " ip=query,country=country ",
        timeout: " 12s ",
      }),
    ).toEqual({
      enabled: true,
      url: "https://example.com/probe",
      fields: "ip=query,country=country",
      timeout: "12s",
    });
  });

  test("falls back when the probe URL is unusable", () => {
    expect(normalizeProbeSettings({ url: "ftp://example.com", fields: "", timeout: "" })).toEqual(DEFAULT_PROBE_SETTINGS);
  });

  test("keeps probe disabled while preserving safe defaults", () => {
    expect(normalizeProbeSettings({ enabled: false, url: "", fields: "", timeout: "" })).toEqual({
      ...DEFAULT_PROBE_SETTINGS,
      enabled: false,
    });
  });
});
