# Probe Table Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“出口信息”表格压缩为稳定的两行节奏，同时保留完整 probe 信息。

**Architecture:** 保留现有表头和数据来源，只调整 `ProbeTable` 的单元格结构与少量样式。先用服务端渲染测试锁定“地区两行”和“ASN 两行”的输出，再做最小实现修改并回归验证。

**Tech Stack:** React 19, TypeScript, Bun test, Tailwind CSS

---

### Task 1: 锁定表格两行输出

**Files:**
- Modify: `src/mainview/src/components/analysis-view.test.tsx`

- [ ] 新增一个 probe 表格渲染测试，断言 `地区` 拆成 `国家代码/国家` 和 `地区/城市` 两组文案，`ASN / 组织` 也按两组文案输出。

### Task 2: 调整 ProbeTable 结构

**Files:**
- Modify: `src/mainview/src/components/analysis-view.tsx`

- [ ] 为地区列增加两行分组渲染 helper。
- [ ] 为 ASN / 组织列改成上下两行输出。
- [ ] 轻微收紧 `TableCell` 的纵向 padding 和次级文案行高，避免只靠换行自然堆高。

### Task 3: 验证

**Files:**
- Modify: `src/mainview/src/components/analysis-view.test.tsx`
- Modify: `src/mainview/src/components/analysis-view.tsx`

- [ ] 运行新增测试，确认先红后绿。
- [ ] 运行 `bun test src/mainview/src/components/analysis-view.test.tsx`。
- [ ] 运行 `bun run typecheck`，确认没有引入类型错误。
