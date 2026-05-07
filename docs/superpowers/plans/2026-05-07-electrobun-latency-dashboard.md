# Electrobun Latency Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + shadcn/ui Electrobun desktop app that runs bundled `clash-speedtest`, stores history in SQLite, displays latency results visually, and exports CSV.

**Architecture:** The Bun host owns native concerns: process execution, SQLite persistence, and CSV export. The React WebView owns presentation and calls the host through typed Electrobun RPC. Core parsing and summary logic are written as testable TypeScript modules.

**Tech Stack:** Electrobun, Bun, React, Vite, TypeScript, shadcn/ui, Tailwind CSS, Bun SQLite, Bun test.

---

### Task 1: Scaffold Electrobun React App

**Files:**
- Create: `package.json`
- Create: `electrobun.config.ts`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/bun/index.ts`
- Create: `src/shared/rpc.ts`
- Create: `src/mainview/index.html`
- Create: `src/mainview/src/main.tsx`
- Create: `src/mainview/src/App.tsx`
- Create: `src/mainview/src/index.css`

- [ ] Create a minimal Electrobun config with Bun entrypoint `src/bun/index.ts`.
- [ ] Create a Vite React WebView under `src/mainview`.
- [ ] Create typed RPC placeholders for `listRuns`, `startRun`, and `exportCsv`.

### Task 2: Add Core Domain Tests

**Files:**
- Create: `src/shared/domain.ts`
- Create: `src/shared/domain.test.ts`

- [ ] Test region presets expose Hong Kong and Japan with fixed regex values.
- [ ] Test TSV parsing handles fast-mode rows: sequence, proxy name, proxy type, latency.
- [ ] Test latency status maps fast, usable, slow, failed, and missing results.

### Task 3: Implement Persistence

**Files:**
- Create: `src/bun/db.ts`
- Create: `src/bun/db.test.ts`

- [ ] Test schema initialization creates runs, sites, regions, and results.
- [ ] Test inserting a run and result rows can be queried by region and date.
- [ ] Implement SQLite access using `bun:sqlite`.

### Task 4: Implement Runner

**Files:**
- Create: `src/bun/runner.ts`
- Create: `src/bun/runner.test.ts`

- [ ] Test command arguments include `-c`, `-f`, `--speed-mode fast`, and `--latency-url`.
- [ ] Test parsed rows are normalized with run, region, and site metadata.
- [ ] Implement process execution against the bundled binary path.

### Task 5: Implement CSV Export

**Files:**
- Create: `src/bun/csv.ts`
- Create: `src/bun/csv.test.ts`

- [ ] Test details CSV includes one row per result.
- [ ] Test summary CSV pivots site latency columns by proxy.
- [ ] Implement export writing into user-selected or app export directory.

### Task 6: Build Dashboard UI

**Files:**
- Modify: `src/mainview/src/App.tsx`
- Create: `src/mainview/src/components/ui/*`
- Create: `src/mainview/src/lib/utils.ts`

- [ ] Add shadcn/ui components for button, card, badge, table, input, and select.
- [ ] Render region buttons for Hong Kong and Japan.
- [ ] Render date filter controls.
- [ ] Render summary cards and latency matrix with icons and colors.
- [ ] Add Start Test and Export CSV actions wired to RPC.

### Task 7: Build Embedded Binary

**Files:**
- Create: `scripts/build-clash-speedtest.ts`
- Modify: `package.json`

- [ ] Build `/Users/nicholas/Desktop/my_program/clash-speedtest` to `resources/bin/clash-speedtest`.
- [ ] Add scripts for app dev, tests, frontend build, and binary build.

### Task 8: Verify

**Files:**
- Modify: `README.md`

- [ ] Run `bun test`.
- [ ] Run the clash-speedtest build script.
- [ ] Run Vite build.
- [ ] Document first-version usage and architecture.
