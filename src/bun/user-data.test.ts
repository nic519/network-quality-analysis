import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateLegacyMacUserData } from "./user-data";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("migrateLegacyMacUserData", () => {
  test("copies legacy files that do not exist in the Electrobun user-data directory", async () => {
    const root = createTemporaryDirectory();
    const legacyDirectory = join(root, "legacy");
    const appDirectory = join(root, "current");
    await Bun.write(join(legacyDirectory, "latency-compass.sqlite"), "legacy-db");

    migrateLegacyMacUserData({ platform: "darwin", legacyDirectory, appDirectory });

    expect(readFileSync(join(appDirectory, "latency-compass.sqlite"), "utf8")).toBe("legacy-db");
  });

  test("does not overwrite data already stored at the current path", async () => {
    const root = createTemporaryDirectory();
    const legacyDirectory = join(root, "legacy");
    const appDirectory = join(root, "current");
    await Bun.write(join(legacyDirectory, "probe-settings.json"), "legacy");
    await Bun.write(join(appDirectory, "probe-settings.json"), "current");

    migrateLegacyMacUserData({ platform: "darwin", legacyDirectory, appDirectory });

    expect(readFileSync(join(appDirectory, "probe-settings.json"), "utf8")).toBe("current");
  });

  test("does nothing on other platforms", async () => {
    const root = createTemporaryDirectory();
    const legacyDirectory = join(root, "legacy");
    const appDirectory = join(root, "current");
    await Bun.write(join(legacyDirectory, "test-sites.json"), "legacy");

    migrateLegacyMacUserData({ platform: "win32", legacyDirectory, appDirectory });

    expect(existsSync(join(appDirectory, "test-sites.json"))).toBe(false);
  });
});

function createTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "latency-compass-user-data-"));
  temporaryDirectories.push(directory);
  return directory;
}
