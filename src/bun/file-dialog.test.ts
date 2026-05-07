import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chooseClashSpeedtestBinary, chooseConfigFile, chooseExportDirectory } from "./file-dialog";

describe("chooseConfigFile", () => {
  test("returns the selected config path", async () => {
    const selected = await chooseConfigFile({
      currentPath: "/Users/nicholas/configs/current.yaml",
      openFileDialog: async (options) => {
        expect(options).toMatchObject({
          startingFolder: "/Users/nicholas/configs",
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: false,
        });
        return ["/Users/nicholas/configs/next.yaml"];
      },
    });

    expect(selected).toBe("/Users/nicholas/configs/next.yaml");
  });

  test("returns null when the file dialog is cancelled", async () => {
    const selected = await chooseConfigFile({
      currentPath: "https://example.com/subscription",
      openFileDialog: async (options) => {
        expect(options.startingFolder).toBe("~");
        return [""];
      },
    });

    expect(selected).toBeNull();
  });

  test("normalizes selected file urls with spaces", async () => {
    const selected = await chooseConfigFile({
      openFileDialog: async () => [" file:///Users/nicholas/Library/Application%20Support/mihomo-party/profiles/19536a6d39f.yaml "],
    });

    expect(selected).toBe("/Users/nicholas/Library/Application Support/mihomo-party/profiles/19536a6d39f.yaml");
  });
});

describe("chooseExportDirectory", () => {
  test("returns the selected export folder", async () => {
    const selected = await chooseExportDirectory({
      openFileDialog: async (options) => {
        expect(options).toMatchObject({
          startingFolder: "~",
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });
        return ["/Users/nicholas/Desktop/exports"];
      },
    });

    expect(selected).toBe("/Users/nicholas/Desktop/exports");
  });

  test("returns null when export folder selection is cancelled", async () => {
    const selected = await chooseExportDirectory({
      openFileDialog: async () => [""],
    });

    expect(selected).toBeNull();
  });
});

describe("chooseClashSpeedtestBinary", () => {
  test("returns the selected binary path", async () => {
    const root = join(tmpdir(), `latency-file-dialog-${Date.now()}`);
    const binaryPath = join(root, "clash-speedtest");
    mkdirSync(root, { recursive: true });
    writeFileSync(binaryPath, "");

    const selected = await chooseClashSpeedtestBinary({
      currentPath: binaryPath,
      openFileDialog: async (options) => {
        expect(options).toMatchObject({
          startingFolder: root,
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: false,
        });
        return [binaryPath];
      },
    });

    expect(selected).toBe(binaryPath);
  });

  test("rejects selecting a compressed archive instead of the extracted binary", async () => {
    await expect(
      chooseClashSpeedtestBinary({
        currentPath: "/Users/nicholas/Downloads/clash-speedtest",
        openFileDialog: async () => ["/Users/nicholas/Downloads/clash-speedtest_Darwin_arm64.tar.gz"],
      }),
    ).rejects.toThrow("请选择解压后的 clash-speedtest 可执行文件，不要直接选择压缩包");
  });

  test("returns null when binary selection is cancelled", async () => {
    const selected = await chooseClashSpeedtestBinary({
      currentPath: undefined,
      openFileDialog: async () => [""],
    });

    expect(selected).toBeNull();
  });
});
