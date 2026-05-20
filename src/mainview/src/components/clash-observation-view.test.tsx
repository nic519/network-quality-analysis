import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ClashObservationView } from "./clash-observation-view";
import type { ClashObservationDetail } from "../../../shared/clash-observation";
import { DEFAULT_CLASH_OBSERVATION_SETTINGS } from "../../../shared/clash-observation";
import type { AppState } from "../../../shared/rpc";

describe("ClashObservationView", () => {
  test("renders observation summaries and selected detail tables", () => {
    const html = renderToStaticMarkup(
      <ClashObservationView state={state} selectedObservationId="obs-1" detail={detail} onSelectedObservationIdChange={() => {}} />,
    );

    expect(html).toContain("观测复盘");
    expect(html).toContain("obs-1");
    expect(html).toContain("节点快照");
    expect(html).toContain("HK-01");
    expect(html).toContain("连接采样");
    expect(html).toContain("github.com");
    expect(html).toContain("日志事件");
    expect(html).toContain("[DNS] github.com lookup failed");
    expect(html).toContain("mixed-port");
    expect(html).toContain("7890");
  });

  test("renders an empty state before any observation is collected", () => {
    const html = renderToStaticMarkup(
      <ClashObservationView
        state={{ ...state, clashObservation: { settings: DEFAULT_CLASH_OBSERVATION_SETTINGS, summaries: [], logEvents: [] } }}
        selectedObservationId={null}
        detail={null}
        onSelectedObservationIdChange={() => {}}
      />,
    );

    expect(html).toContain("还没有观测记录");
  });
});

const state: AppState = {
  regions: [],
  sites: [],
  probeSettings: {
    enabled: true,
    url: "https://api.ip.sb/geoip/",
    fields: "ip=ip",
    timeout: "8s",
  },
  clashObservation: {
    settings: DEFAULT_CLASH_OBSERVATION_SETTINGS,
    summaries: [
      {
        id: "obs-1",
        startedAt: "2026-05-20T10:00:00.000Z",
        completedAt: "2026-05-20T10:00:03.000Z",
        status: "completed",
        controllerUrl: "http://127.0.0.1:9090",
        errorMessage: null,
        proxyCount: 1,
        connectionSampleCount: 1,
        logEventCount: 1,
      },
    ],
    logEvents: [],
  },
  runs: [],
  results: [],
  proxyHistoryStats: {},
  configHistory: [],
  clashSpeedtest: {
    status: "ready",
    version: "1.0.0",
    path: "/tmp/clash-speedtest",
    source: "manual",
    message: "",
    checkedAt: "2026-05-20T10:00:00.000Z",
  },
};

const detail: ClashObservationDetail = {
  summary: state.clashObservation.summaries[0],
  config: {
    observationId: "obs-1",
    mode: "rule",
    logLevel: "warning",
    mixedPort: "7890",
    httpPort: "",
    socksPort: "",
    ipv6: "true",
    allowLan: "false",
    configHash: "hash-1",
  },
  proxies: [
    {
      observationId: "obs-1",
      proxyName: "HK-01",
      proxyType: "Trojan",
      nowProxy: "",
      alive: "true",
      delayMs: 128,
      historyJson: "[]",
      childrenJson: "[]",
    },
  ],
  rules: [
    {
      observationId: "obs-1",
      ruleIndex: 0,
      ruleType: "RuleSet",
      payload: "github",
      proxy: "Proxy",
    },
  ],
  connections: [
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
  ],
  logEvents: [
    {
      id: 1,
      observationId: "obs-1",
      eventTime: "2026-05-20T10:00:02.000Z",
      level: "warning",
      eventType: "dns",
      message: "[DNS] github.com lookup failed",
      proxyName: "",
      domain: "github.com",
      rule: "",
    },
  ],
};
