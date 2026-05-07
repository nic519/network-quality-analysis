import type { ElectrobunConfig } from "electrobun";
import pkg from "./package.json";

export default {
  app: {
    name: "Latency Compass",
    identifier: "dev.local.latency-compass",
    version: pkg.version,
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      mainview: {
        entrypoint: "src/mainview/src/electrobun-main.tsx",
        sourcemap: "linked",
      },
    },
    copy: {
      "src/mainview/electrobun.html": "views/mainview/index.html",
      "src/mainview/electrobun.css": "views/mainview/main.css",
      "resources/bin/clash-speedtest": "resources/bin/clash-speedtest",
    },
  },
} satisfies ElectrobunConfig;
