import { describe, expect, test } from "bun:test";
import { openExternalUrl } from "./external-url";

describe("openExternalUrl", () => {
  test("uses the native opener for an HTTPS URL", () => {
    const opened: string[] = [];

    openExternalUrl("https://example.com/path?q=1", (url) => {
      opened.push(url);
      return true;
    });

    expect(opened).toEqual(["https://example.com/path?q=1"]);
  });

  test("rejects protocols that should not be opened from the webview", () => {
    let called = false;

    expect(() =>
      openExternalUrl("file:///tmp/private", () => {
        called = true;
        return true;
      }),
    ).toThrow("只允许打开 HTTP 或 HTTPS 链接");
    expect(called).toBe(false);
  });

  test("reports a native open failure", () => {
    expect(() => openExternalUrl("https://example.com", () => false)).toThrow("无法打开外部链接");
  });
});
