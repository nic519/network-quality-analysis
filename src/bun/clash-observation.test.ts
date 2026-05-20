import { describe, expect, test } from "bun:test";
import { collectClashObservation } from "./clash-observation";
import { DEFAULT_CLASH_OBSERVATION_SETTINGS } from "../shared/clash-observation";

describe("collectClashObservation", () => {
  test("collects controller snapshots and warning/error log events", async () => {
    const requested: Array<{ url: string; authorization: string }> = [];
    const bundle = await collectClashObservation(
      { ...DEFAULT_CLASH_OBSERVATION_SETTINGS, controllerUrl: "http://127.0.0.1:9090", secret: "secret-1" },
      {
        now: () => new Date("2026-05-20T10:00:00.000Z"),
        fetchJson: async (url, init) => {
          requested.push({ url, authorization: String(init?.headers?.Authorization ?? "") });
          if (url.endsWith("/configs")) return { mode: "rule", "mixed-port": 7890, ipv6: true, "allow-lan": false, "log-level": "warning" };
          if (url.endsWith("/proxies")) {
            return {
              proxies: {
                Proxy: { type: "Selector", now: "HK-01", all: ["HK-01"], history: [{ delay: 45 }] },
              },
            };
          }
          if (url.endsWith("/rules")) return { rules: [{ type: "RuleSet", payload: "github", proxy: "Proxy" }] };
          if (url.endsWith("/connections")) {
            return {
              connections: [
                {
                  metadata: { host: "github.com", destinationIP: "140.82.112.4" },
                  chains: ["Proxy", "HK-01"],
                  rule: "RuleSet",
                  rulePayload: "github",
                  upload: 10,
                  download: 20,
                },
              ],
            };
          }
          throw new Error(`unexpected url ${url}`);
        },
        fetchText: async (url, init) => {
          requested.push({ url, authorization: String(init?.headers?.Authorization ?? "") });
          if (url.endsWith("/logs?level=warning")) return JSON.stringify({ type: "warning", payload: "[DNS] github.com failed" });
          if (url.endsWith("/logs?level=error")) return "proxy HK-01 connect timeout";
          return "";
        },
      },
    );

    expect(requested.every((item) => item.authorization === "Bearer secret-1")).toBe(true);
    expect(bundle.run).toMatchObject({
      id: "obs-20260520T100000Z",
      status: "completed",
      controllerUrl: "http://127.0.0.1:9090",
      errorMessage: null,
    });
    expect(bundle.config).toMatchObject({
      mode: "rule",
      mixedPort: "7890",
      ipv6: "true",
      allowLan: "false",
    });
    expect(bundle.proxies).toHaveLength(1);
    expect(bundle.rules).toEqual([
      {
        observationId: "obs-20260520T100000Z",
        ruleIndex: 0,
        ruleType: "RuleSet",
        payload: "github",
        proxy: "Proxy",
      },
    ]);
    expect(bundle.connections).toHaveLength(1);
    expect(bundle.logEvents.map((event) => event.eventType)).toEqual(["dns", "timeout"]);
  });

  test("keeps partial observations when a supported endpoint fails", async () => {
    const bundle = await collectClashObservation(DEFAULT_CLASH_OBSERVATION_SETTINGS, {
      now: () => new Date("2026-05-20T10:00:00.000Z"),
      fetchJson: async (url) => {
        if (url.endsWith("/configs")) return { mode: "rule" };
        if (url.endsWith("/proxies")) throw new Error("gateway http 404: missing");
        if (url.endsWith("/rules")) return { rules: [] };
        if (url.endsWith("/connections")) return { connections: [] };
        throw new Error(`unexpected url ${url}`);
      },
      fetchText: async () => "",
    });

    expect(bundle.run.status).toBe("completed");
    expect(bundle.run.errorMessage).toContain("/proxies");
    expect(bundle.config).toMatchObject({ mode: "rule" });
  });

  test("marks the observation failed when every endpoint fails", async () => {
    const bundle = await collectClashObservation(DEFAULT_CLASH_OBSERVATION_SETTINGS, {
      now: () => new Date("2026-05-20T10:00:00.000Z"),
      fetchJson: async () => {
        throw new Error("connection refused");
      },
      fetchText: async () => {
        throw new Error("connection refused");
      },
    });

    expect(bundle.run.status).toBe("failed");
    expect(bundle.run.errorMessage).toContain("connection refused");
    expect(bundle.proxies).toEqual([]);
    expect(bundle.logEvents).toEqual([]);
  });
});
