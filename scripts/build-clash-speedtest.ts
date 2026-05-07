import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const sourceDir = "/Users/nicholas/Desktop/my_program/clash-speedtest";
const outputDir = join(process.cwd(), "resources/bin");
const outputPath = join(outputDir, "clash-speedtest");

mkdirSync(outputDir, { recursive: true });

const result = Bun.spawnSync({
  cmd: ["go", "build", "-o", outputPath, "."],
  cwd: sourceDir,
  stdout: "pipe",
  stderr: "pipe",
});

if (result.exitCode !== 0) {
  console.error(new TextDecoder().decode(result.stderr));
  process.exit(result.exitCode);
}

chmodSync(outputPath, 0o755);
console.log(`Built ${outputPath}`);
