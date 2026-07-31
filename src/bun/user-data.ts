import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LEGACY_FILE_NAMES = [
  "latency-compass.sqlite",
  "latency-compass.sqlite-shm",
  "latency-compass.sqlite-wal",
  "clash-speedtest-manual-path.txt",
  "test-sites.json",
  "probe-settings.json",
  "clash-observation-settings.json",
] as const;

interface LegacyMigrationOptions {
  platform?: NodeJS.Platform;
  legacyDirectory?: string;
  appDirectory: string;
}

export function migrateLegacyMacUserData({
  platform = process.platform,
  legacyDirectory = join(homedir(), "Library", "Application Support", "Latency Compass"),
  appDirectory,
}: LegacyMigrationOptions) {
  if (platform !== "darwin" || !existsSync(legacyDirectory)) return;

  mkdirSync(appDirectory, { recursive: true });
  for (const fileName of LEGACY_FILE_NAMES) {
    const source = join(legacyDirectory, fileName);
    const destination = join(appDirectory, fileName);
    if (existsSync(source) && !existsSync(destination)) {
      cpSync(source, destination);
    }
  }
}
