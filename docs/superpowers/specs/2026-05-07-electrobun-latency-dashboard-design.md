# Electrobun Latency Dashboard Design

## Goal

Rewrite this project as a desktop UI for testing website latency through `clash-speedtest`, with React + shadcn/ui in Electrobun and `clash-speedtest` embedded as a bundled binary.

## First Version Scope

- The user selects a region preset, initially Hong Kong or Japan.
- Region presets map to hard-coded filter regexes in code; users do not edit raw filters in the UI.
- The app tests the same built-in site list for each selected region.
- The UI presents results directly with cards, icons, status colors, and a node-by-site latency matrix.
- SQLite stores run history and result rows.
- Date and region filters query SQLite history.
- CSV export remains available for current filtered results, generating detail and summary CSV files.

## Out Of Scope

- User-authored filter regex editor.
- Gist/GitHub upload.
- Clash config generation or proxy renaming.
- Advanced trend charts.
- Full cross-platform packaging beyond a first macOS-oriented build.

## Architecture

- Electrobun Bun host starts a desktop window and exposes RPC handlers to the React WebView.
- React renders the dashboard using shadcn/ui components and calls host RPC for data and test execution.
- The host builds or uses a bundled `clash-speedtest` binary from `/Users/nicholas/Desktop/my_program/clash-speedtest`.
- The host runs `clash-speedtest` in TSV mode per site and region preset, parses output, and stores normalized rows in SQLite.
- CSV exports are generated from SQLite rows, not from UI state.

## Data Model

- `runs`: one row per user-triggered test run.
- `regions`: built-in region presets and their filter regex values.
- `sites`: built-in test sites.
- `results`: one row per run, region, site, and proxy result.

## UI Direction

The visual hierarchy should make the latest result and action obvious: region pills and date filter at the top, a strong summary strip below, then a dense but readable latency matrix. Status icons should communicate latency health before users read exact millisecond values.
