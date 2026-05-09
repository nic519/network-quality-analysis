import type { ElectrobunConfig } from "electrobun";
import pkg from "./package.json";

const buildEnv = process.env.ELECTROBUN_BUILD_ENV ?? "dev";
const isStableBuild = buildEnv === "stable";

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
      minify: isStableBuild,
      define: {
        "process.env.NODE_ENV": JSON.stringify(isStableBuild ? "production" : "development"),
      },
    },
    views: {
      mainview: {
        entrypoint: "src/mainview/src/electrobun-main.tsx",
        minify: isStableBuild,
        sourcemap: isStableBuild ? "none" : "linked",
        define: {
          "process.env.NODE_ENV": JSON.stringify(isStableBuild ? "production" : "development"),
        },
      },
    },
    copy: {
      "src/mainview/electrobun.html": "views/mainview/index.html",
      "src/mainview/electrobun.css": "views/mainview/main.css",
    },
  },
} satisfies ElectrobunConfig;
