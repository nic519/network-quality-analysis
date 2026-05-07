# Latency Compass

Electrobun desktop app for testing website latency through `clash-speedtest`.

## First Version

- React UI with shadcn/ui-style components
- Electrobun desktop shell
- Built-in region presets: Hong Kong and Japan
- Built-in sites: YouTube, X, GitHub
- Uses the bundled `clash-speedtest` binary in fast latency mode
- Stores history in SQLite at `~/Library/Application Support/Latency Compass/latency-compass.sqlite`
- Shows summary cards and a node-by-site latency matrix
- Exports current filtered results as details and summary CSV files

## Setup

```bash
bun install
bun run build:clash-speedtest
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
