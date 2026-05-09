# Latency Compass

Electrobun desktop app for testing website latency through `clash-speedtest`.

## First Version

- React UI with shadcn/ui-style components
- Electrobun desktop shell
- Built-in region presets: Hong Kong and Japan
- Configurable test sites with YouTube, X, and GitHub as defaults
- Guides users to install `clash-speedtest` with `go install github.com/nic519/clash-speedtest@latest`
- Stores history in SQLite at `~/Library/Application Support/Latency Compass/latency-compass.sqlite`
- Shows summary cards and a node-by-site latency matrix
- Exports current filtered results as a summary CSV to a folder you choose

## Setup

```bash
bun install
```

Install `clash-speedtest` separately before running tests in the app:

```bash
go install github.com/nic519/clash-speedtest@latest
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

For local development and debugging, you can still set `CLASH_SPEEDTEST_PATH`
or manually specify a binary path in the diagnostics view.
