import { describe, expect, test } from "bun:test";
import { DEFAULT_PROBE_SETTINGS, normalizeProbeSettings } from "./probe-settings";

describe("normalizeProbeSettings", () => {
  test("defaults to api.ip.sb geoip settings", () => {
    expect(DEFAULT_PROBE_SETTINGS).toEqual({
      enabled: true,
      url: "https://api.ip.sb/geoip/",
      fields: "ip=ip,country=country,country_code=country_code,region=region,city=city,asn=asn,org=organization",
      timeout: "8s",
    });
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
