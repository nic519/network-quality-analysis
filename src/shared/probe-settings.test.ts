import { describe, expect, test } from "bun:test";
import { DEFAULT_PROBE_SETTINGS, normalizeProbeSettings } from "./probe-settings";

describe("normalizeProbeSettings", () => {
  test("defaults to api.ip.sb geoip settings", () => {
    expect(DEFAULT_PROBE_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_PROBE_SETTINGS.url).toBe("https://api.ip.sb/geoip/");
    expect(DEFAULT_PROBE_SETTINGS.fields).toContain("ip=ip");
    expect(DEFAULT_PROBE_SETTINGS.fields).toContain("org=organization");
    expect(DEFAULT_PROBE_SETTINGS.timeout).toMatch(/^\d+s$/);
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
