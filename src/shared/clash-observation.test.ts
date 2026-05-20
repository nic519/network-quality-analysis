import { describe, expect, test } from "bun:test";
import {
  classifyClashLogEvent,
  createObservationId,
  normalizeClashObservationSettings,
  normalizeConnectionSampleRows,
  normalizeProxySnapshotRows,
} from "./clash-observation";

describe("clash observation shared helpers", () => {
  test("normalizes observation settings with safe defaults and bounds", () => {
    expect(
      normalizeClashObservationSettings({
        enabled: true,
        controllerUrl: " http://127.0.0.1:9090/ ",
        secret: "  token-1  ",
        intervalMinutes: 0,
        retentionDays: 999,
        logLevels: ["warning", "debug", "error", "warning"] as never,
      }),
    ).toEqual({
      enabled: true,
      controllerUrl: "http://127.0.0.1:9090",
      secret: "token-1",
      intervalMinutes: 1,
      retentionDays: 365,
      logLevels: ["warning", "error"],
    });

    expect(normalizeClashObservationSettings({ controllerUrl: "notaurl", enabled: true })).toMatchObject({
      enabled: true,
      controllerUrl: "http://127.0.0.1:9090",
      intervalMinutes: 5,
      retentionDays: 30,
      logLevels: ["warning", "error"],
    });
  });

  test("normalizes proxy and group snapshots from controller proxies payload", () => {
    const rows = normalizeProxySnapshotRows("obs-1", {
      proxies: {
        "Proxy": {
          type: "Selector",
          now: "HK-01",
          all: ["HK-01", "HK-02"],
          alive: true,
          history: [{ delay: 42 }, { delay: 36 }],
        },
        "HK-01": {
          type: "Trojan",
          alive: false,
          history: [{ delay: 120 }],
        },
      },
    });

    expect(rows).toEqual([
      {
        observationId: "obs-1",
        proxyName: "HK-01",
        proxyType: "Trojan",
        nowProxy: "",
        alive: "false",
        delayMs: 120,
        historyJson: JSON.stringify([{ delay: 120 }]),
        childrenJson: "[]",
      },
      {
        observationId: "obs-1",
        proxyName: "Proxy",
        proxyType: "Selector",
        nowProxy: "HK-01",
        alive: "true",
        delayMs: 36,
        historyJson: JSON.stringify([{ delay: 42 }, { delay: 36 }]),
        childrenJson: JSON.stringify(["HK-01", "HK-02"]),
      },
    ]);
  });

  test("aggregates connection samples by domain, route, and chain", () => {
    const rows = normalizeConnectionSampleRows("obs-1", {
      connections: [
        {
          metadata: { host: "github.com", destinationIP: "140.82.112.4", sourceIP: "192.168.1.2" },
          chains: ["Proxy", "HK-01"],
          rule: "RuleSet",
          rulePayload: "github",
          upload: 100,
          download: 300,
        },
        {
          metadata: { sniffHost: "github.com", destinationIP: "140.82.112.4", sourceIP: "192.168.1.2" },
          chains: ["Proxy", "HK-01"],
          rule: "RuleSet",
          rulePayload: "github",
          upload: 50,
          download: 70,
        },
      ],
    });

    expect(rows).toEqual([
      {
        observationId: "obs-1",
        domain: "github.com",
        destinationIp: "140.82.112.4",
        sourceIp: "192.168.1.2",
        rule: "RuleSet",
        rulePayload: "github",
        chain: "Proxy > HK-01",
        connectionCount: 2,
        upload: 150,
        download: 370,
      },
    ]);
  });

  test("classifies log events and extracts obvious domain or proxy hints", () => {
    expect(classifyClashLogEvent("[DNS] github.com lookup failed", "warning")).toMatchObject({
      level: "warning",
      eventType: "dns",
      domain: "github.com",
    });
    expect(classifyClashLogEvent("proxy HK-01 connect timeout", "error")).toMatchObject({
      level: "error",
      eventType: "timeout",
      proxyName: "HK-01",
    });
    expect(classifyClashLogEvent("rule provider reject.yaml updated", "warning")).toMatchObject({
      eventType: "provider",
    });
  });

  test("creates stable observation ids from timestamps", () => {
    expect(createObservationId(new Date("2026-05-20T10:11:12.345Z"))).toBe("obs-20260520T101112Z");
  });
});
