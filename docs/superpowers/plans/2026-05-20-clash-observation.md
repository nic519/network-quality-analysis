# Clash 观测模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个与手动测速解耦的 Clash/Mihomo 定时观测模块，保存可复盘的历史快照和日志事件。

**Architecture:** 共享层定义观测设置、快照、事件和规范化函数；Bun host 侧新增 controller client、collector、SQLite 表和 RPC；React 侧在工具设置页展示 controller 配置、最近观测、日志事件，并允许手动触发一次观测。第一版保留分析层融合的数据基础，不改动 `runLatencyTest` 写入路径。

**Tech Stack:** TypeScript、Bun、bun:sqlite、Electrobun typed RPC、React、shadcn-style local UI components、Bun test。

---

### Task 1: 共享类型与规范化函数

**Files:**
- Create: `src/shared/clash-observation.ts`
- Test: `src/shared/clash-observation.test.ts`

- [ ] **Step 1: Write failing tests**

Cover settings normalization, `/proxies` normalization, `/connections` aggregation, and log event classification.

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/shared/clash-observation.test.ts`

- [ ] **Step 3: Implement shared module**

Export normalized settings, payload types, observation row types, `normalizeClashObservationSettings`, `normalizeProxySnapshotRows`, `normalizeConnectionSampleRows`, `classifyClashLogEvent`, and `createObservationId`.

- [ ] **Step 4: Run tests**

Run: `bun test src/shared/clash-observation.test.ts`

### Task 2: SQLite persistence

**Files:**
- Modify: `src/bun/db.ts`
- Modify: `src/bun/db.test.ts`

- [ ] **Step 1: Write failing database tests**

Verify schema creation, saving a completed observation, querying recent summaries/events, and retention cleanup.

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/bun/db.test.ts`

- [ ] **Step 3: Implement DB methods**

Add observation tables, indexes, `saveClashObservation`, `listClashObservationSummaries`, `listClashLogEvents`, and `pruneClashObservations`.

- [ ] **Step 4: Run tests**

Run: `bun test src/bun/db.test.ts`

### Task 3: Controller client and collector

**Files:**
- Create: `src/bun/clash-observation.ts`
- Test: `src/bun/clash-observation.test.ts`

- [ ] **Step 1: Write failing collector tests**

Use fake fetch/stream functions to verify partial endpoint success, unauthorized handling, log event classification, and no dependency on `clash-speedtest`.

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/bun/clash-observation.test.ts`

- [ ] **Step 3: Implement client and collector**

Fetch `/configs`, `/proxies`, `/rules`, `/connections`; optionally capture bounded logs from `/logs?level=warning` and `/logs?level=error`; normalize rows and return one observation bundle.

- [ ] **Step 4: Run tests**

Run: `bun test src/bun/clash-observation.test.ts`

### Task 4: RPC, settings persistence, and scheduler

**Files:**
- Modify: `src/shared/rpc.ts`
- Modify: `src/bun/index.ts`
- Modify: `src/mainview/src/lib/electrobun.ts`

- [ ] **Step 1: Write/extend tests where practical**

At minimum keep typecheck as the verification for typed RPC and use collector/database tests for behavior.

- [ ] **Step 2: Implement RPC**

Add observation state to `AppState`, plus requests for saving settings and triggering one manual observation. Start a host-side interval when observation is enabled, refresh state after saves/runs, and keep this path separate from `startRun`.

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`

### Task 5: Settings and history UI

**Files:**
- Modify: `src/mainview/src/components/diagnostics-view.tsx`
- Modify: `src/mainview/src/components/diagnostics-view.test.tsx`
- Modify: `src/mainview/src/components/top-navigation.tsx`
- Modify: `src/mainview/src/components/top-navigation.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Verify the settings page renders controller fields, scheduler status, save/manual collect actions, recent observation summaries, and filtered log event rows.

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/mainview/src/components/diagnostics-view.test.tsx src/mainview/src/components/top-navigation.test.tsx`

- [ ] **Step 3: Implement UI**

Add a compact "Clash 观测" section to tool settings and rename top-level settings label only if needed for clarity.

- [ ] **Step 4: Run tests**

Run: `bun test src/mainview/src/components/diagnostics-view.test.tsx src/mainview/src/components/top-navigation.test.tsx`

### Task 6: Full verification

**Files:**
- No new files unless verification reveals defects.

- [ ] **Step 1: Run focused tests**

Run all new/changed test files.

- [ ] **Step 2: Run full suite**

Run: `bun test`

- [ ] **Step 3: Run typecheck and build**

Run: `bun run typecheck` and `bun run build:web`.
