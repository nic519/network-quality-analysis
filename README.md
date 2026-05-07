# Latency Compass

Electrobun desktop app for testing website latency through `clash-speedtest`.

## First Version

- React UI with shadcn/ui-style components
- Electrobun desktop shell
- Built-in region presets: Hong Kong and Japan
- Built-in sites: YouTube, X, GitHub
- Downloads `clash-speedtest` from the `nic519/clash-speedtest` GitHub release on first use
- Stores history in SQLite at `~/Library/Application Support/Latency Compass/latency-compass.sqlite`
- Shows summary cards and a node-by-site latency matrix
- Exports current filtered results as a summary CSV to a folder you choose

## Setup

```bash
bun install
```

## Development

```bash
bun test
bun run typecheck
bun run build:web
bun run dev
```

The app expects a local Clash/Mihomo config path or subscription URL in the UI.
Filters are not user-authored in the first version; selecting `香港` or `日本`
uses the region regexes defined in `src/shared/domain.ts`.

For local Go development, set `CLASH_SPEEDTEST_PATH` to a locally built binary
before starting the app.
