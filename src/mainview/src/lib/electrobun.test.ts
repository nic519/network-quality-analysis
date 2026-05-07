import { describe, expect, mock, test } from "bun:test";

describe("webview RPC", () => {
  test("waits long enough for full speed test runs", async () => {
    let rpcConfig: { maxRequestTime?: number } | undefined;

    mock.module("electrobun/view", () => ({
      Electroview: class {
        rpc = { request: {} };

        static defineRPC(config: { maxRequestTime?: number }) {
          rpcConfig = config;
          return {};
        }
      },
    }));

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });

    await import("./electrobun");

    expect(rpcConfig?.maxRequestTime).toBe(10 * 60 * 1000);
  });
});
