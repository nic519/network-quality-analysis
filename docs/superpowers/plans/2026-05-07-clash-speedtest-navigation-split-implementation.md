# Clash Speedtest 导航拆分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将界面拆分为执行测试、结果分析、依赖与诊断三个主视图，并修正 `clash-speedtest` 更新检查失败时的状态语义。

**Architecture:** 先在宿主与共享类型层引入更精确的工具状态字段，再把 React 单页拆为多组件的三段导航结构。诊断页消费完整状态，头部只保留轻量摘要，现有执行与分析流程继续复用。

**Tech Stack:** Bun、Electrobun、React 19、TypeScript、Tailwind、bun:test

---

### Task 1: 收紧 `clash-speedtest` 状态模型

**Files:**
- Modify: `src/shared/rpc.ts`
- Modify: `src/bun/clash-speedtest.test.ts`
- Modify: `src/bun/clash-speedtest.ts`

- [ ] **Step 1: 先写会失败的宿主状态测试**

```ts
test("keeps missing installs non-blocking when update checks fail", async () => {
  const root = join(tmpdir(), `latency-compass-missing-failed-${Date.now()}`);

  await expect(
    getClashSpeedtestState({
      installRoot: root,
      platform: "darwin",
      arch: "arm64",
      fetchLatestVersion: async () => {
        throw new Error("403 rate limited");
      },
      now: () => new Date("2026-05-07T00:00:00.000Z"),
    }),
  ).resolves.toMatchObject({
    status: "missing",
    updateCheckStatus: "failed",
  });
});
```

- [ ] **Step 2: 运行单测，确认先失败**

Run: `bun test src/bun/clash-speedtest.test.ts`
Expected: FAIL，因为 `updateCheckStatus` 字段不存在，且当前实现会把状态设为 `error`

- [ ] **Step 3: 扩展共享类型**

```ts
export type ClashSpeedtestState = {
  status: "missing" | "ready" | "downloading" | "checking-update" | "error";
  version: string;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  updateCheckStatus: "idle" | "ok" | "failed";
  updateCheckMessage: string | null;
  path: string | null;
  source: "environment" | "cache" | null;
  message: string;
  checkedAt: string;
};
```

- [ ] **Step 4: 最小修改宿主状态计算逻辑**

```ts
const base = makeClashSpeedtestState({
  status: local.path ? "ready" : "missing",
  path: local.path,
  source: local.source,
  latestVersion: null,
  updateCheckStatus: "idle",
  updateCheckMessage: null,
  checkedAt: now().toISOString(),
});

try {
  const latestVersion = await getLatestClashSpeedtestVersion({ fetchLatestVersion: options.fetchLatestVersion, now });
  return makeClashSpeedtestState({
    ...base,
    latestVersion,
    updateAvailable: latestVersion ? isNewerVersion(latestVersion, CLASH_SPEEDTEST_VERSION) : null,
    updateCheckStatus: "ok",
  });
} catch (error) {
  return makeClashSpeedtestState({
    ...base,
    updateCheckStatus: "failed",
    updateCheckMessage: toErrorMessage(error),
  });
}
```

- [ ] **Step 5: 再跑单测确认通过**

Run: `bun test src/bun/clash-speedtest.test.ts`
Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add src/shared/rpc.ts src/bun/clash-speedtest.ts src/bun/clash-speedtest.test.ts
git commit -m "fix: separate clash-speedtest update check status"
```

### Task 2: 对齐宿主发布状态

**Files:**
- Modify: `src/bun/index.ts`
- Test: `src/bun/clash-speedtest.test.ts`

- [ ] **Step 1: 写一个针对真实失败语义的补充测试**

```ts
test("keeps update-check failures distinct from startup failures", async () => {
  const state = await getClashSpeedtestState({
    installRoot: join(tmpdir(), `latency-compass-update-fail-${Date.now()}`),
    platform: "darwin",
    arch: "arm64",
    fetchLatestVersion: async () => {
      throw new Error("timeout");
    },
    now: () => new Date("2026-05-07T00:00:00.000Z"),
  });

  expect(state.status).toBe("missing");
  expect(state.updateCheckStatus).toBe("failed");
  expect(state.updateCheckMessage).toContain("timeout");
});
```

- [ ] **Step 2: 运行该测试确认红灯**

Run: `bun test src/bun/clash-speedtest.test.ts`
Expected: 若前一任务尚未完成会 FAIL；完成后应作为回归测试存在

- [ ] **Step 3: 更新宿主运行时发布逻辑**

```ts
publishClashSpeedtestState(
  makeClashSpeedtestState({
    ...clashSpeedtestState,
    status: clashSpeedtestState.path ? "ready" : "downloading",
    checkedAt: new Date().toISOString(),
  }),
);

// 仅当真实下载/启动失败时才发布 error
publishClashSpeedtestState(
  makeClashSpeedtestState({
    ...clashSpeedtestState,
    status: "error",
    updateCheckStatus: clashSpeedtestState.updateCheckStatus,
    updateCheckMessage: clashSpeedtestState.updateCheckMessage,
    message: `clash-speedtest 准备失败：${toErrorMessage(error)}`,
    checkedAt: new Date().toISOString(),
  }),
);
```

- [ ] **Step 4: 跑宿主相关测试**

Run: `bun test src/bun/clash-speedtest.test.ts src/bun/runner.test.ts`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/bun/index.ts src/bun/clash-speedtest.test.ts
git commit -m "fix: preserve clash-speedtest usability during update check failures"
```

### Task 3: 拆分前端导航与视图

**Files:**
- Modify: `src/mainview/src/App.tsx`
- Create: `src/mainview/src/components/top-navigation.tsx`
- Create: `src/mainview/src/components/clash-speedtest-status.tsx`
- Create: `src/mainview/src/components/run-setup-view.tsx`
- Create: `src/mainview/src/components/analysis-view.tsx`
- Create: `src/mainview/src/components/diagnostics-view.tsx`

- [ ] **Step 1: 先写 UI 行为测试**

```ts
test("renders diagnostics navigation label", async () => {
  const mod = await import("./App");
  expect(typeof mod.default).toBe("function");
});
```

- [ ] **Step 2: 运行前端测试确认当前覆盖不足但至少可执行**

Run: `bun test src/mainview/src/lib/electrobun.test.ts`
Expected: PASS，作为现有前端测试基线

- [ ] **Step 3: 新增导航和状态组件**

```tsx
export type AppView = "run" | "analysis" | "diagnostics";

export function TopNavigation({ activeView, onChange, state }: TopNavigationProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => onChange("run")}>执行测试</Button>
      <Button onClick={() => onChange("analysis")}>结果分析</Button>
      <Button onClick={() => onChange("diagnostics")}>依赖与诊断</Button>
      <ClashSpeedtestQuickStatus state={state} />
    </div>
  );
}
```

- [ ] **Step 4: 新增三个主视图组件并迁移现有 JSX**

```tsx
{activeView === "run" ? <RunSetupView ... /> : null}
{activeView === "analysis" ? <AnalysisView ... /> : null}
{activeView === "diagnostics" ? <DiagnosticsView ... /> : null}
```

- [ ] **Step 5: 在 `App.tsx` 中只保留顶层状态和派发逻辑**

```tsx
const [activeView, setActiveView] = useState<AppView>("run");

return (
  <main>
    <Header ... />
    <TopNavigation activeView={activeView} onChange={setActiveView} state={state.clashSpeedtest} />
    {renderActiveView()}
  </main>
);
```

- [ ] **Step 6: 跑前端相关测试与类型检查**

Run: `bun test src/mainview/src/lib/electrobun.test.ts && bun run typecheck`
Expected: PASS

- [ ] **Step 7: 提交这一小步**

```bash
git add src/mainview/src/App.tsx src/mainview/src/components/top-navigation.tsx src/mainview/src/components/clash-speedtest-status.tsx src/mainview/src/components/run-setup-view.tsx src/mainview/src/components/analysis-view.tsx src/mainview/src/components/diagnostics-view.tsx
git commit -m "feat: split dashboard into run analysis and diagnostics views"
```

### Task 4: 收尾验证

**Files:**
- Modify: `src/mainview/src/App.tsx`
- Modify: `src/mainview/src/components/clash-speedtest-status.tsx`
- Test: `src/bun/clash-speedtest.test.ts`

- [ ] **Step 1: 检查诊断文案是否准确区分场景**

```ts
expect(getDiagnosticsSummary({
  status: "missing",
  updateCheckStatus: "failed",
  updateCheckMessage: "403 rate limited",
})).toContain("首次运行时会自动下载");
```

- [ ] **Step 2: 跑全量测试**

Run: `bun test`
Expected: PASS

- [ ] **Step 3: 跑类型检查**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: 如有样式变更则重建 CSS**

Run: `bun run build:css`
Expected: PASS

- [ ] **Step 5: 提交最终改动**

```bash
git add src/shared/rpc.ts src/bun/index.ts src/bun/clash-speedtest.ts src/bun/clash-speedtest.test.ts src/mainview/src/App.tsx src/mainview/src/components src/mainview/electrobun.css docs/superpowers/specs/2026-05-07-clash-speedtest-navigation-split-design.md docs/superpowers/plans/2026-05-07-clash-speedtest-navigation-split-implementation.md
git commit -m "feat: add clash-speedtest diagnostics workspace split"
```
