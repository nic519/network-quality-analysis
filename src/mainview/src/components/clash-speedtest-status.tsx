import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import type { ClashSpeedtestState } from "../../../shared/rpc";

export function ClashSpeedtestQuickStatus({ state }: { state: ClashSpeedtestState }) {
  const Icon = getClashSpeedtestStatusIcon(state);

  return (
    <div className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-secondary-foreground">
      <Icon className={cn("h-4 w-4", getStatusTone(state), isBusy(state) ? "animate-spin" : "")} />
      <span className="min-w-0 flex-1 truncate">{getQuickStatusLabel(state)}</span>
      <Badge variant="outline" className={cn("shrink-0", getQuickStatusBadgeClass(state))}>
        {getQuickStatusBadgeText(state)}
      </Badge>
    </div>
  );
}

export function ClashSpeedtestInlineStatus({ state }: { state: ClashSpeedtestState }) {
  const Icon = getClashSpeedtestStatusIcon(state);

  return (
    <div className="flex items-center gap-2 text-sm text-secondary-foreground">
      <Icon className={cn("h-4 w-4", getStatusTone(state), isBusy(state) ? "animate-spin" : "")} />
      <span>{getDetailedStatusLabel(state)}</span>
    </div>
  );
}

export function ClashSpeedtestDiagnosticsPanel({ state }: { state: ClashSpeedtestState }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-muted-foreground">{getDiagnosticsSummary(state)}</div>
      {state.path ? <div className="break-all rounded-md border border-border bg-secondary/35 px-3 py-2 text-sm text-secondary-foreground">{state.path}</div> : null}
    </div>
  );
}

export function getDiagnosticsSummary(state: ClashSpeedtestState) {
  if (state.status === "error") return state.message;
  if (state.status === "missing") return "未检测到本地可执行文件。";
  if (state.source === "manual") return "当前使用手动指定路径。";
  if (state.source === "environment") return "当前使用环境变量路径。";
  return "当前使用系统命令依赖。";
}

function getClashSpeedtestStatusIcon(state: ClashSpeedtestState) {
  if (state.status === "ready") return CheckCircle2;
  return AlertTriangle;
}

function getQuickStatusLabel(state: ClashSpeedtestState) {
  if (state.status === "error") return "不可用";
  if (state.status === "missing") return "待安装";
  return "可用";
}

function getDetailedStatusLabel(state: ClashSpeedtestState) {
  if (state.status === "missing") return "未安装";
  if (state.status === "error") return "错误";
  return "可用";
}

function getQuickStatusBadgeText(state: ClashSpeedtestState) {
  if (state.status === "error") return "阻塞";
  if (state.status === "missing") return "待准备";
  return "就绪";
}

function getQuickStatusBadgeClass(state: ClashSpeedtestState) {
  if (state.status === "error") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (state.status === "missing") return "border-border bg-muted text-muted-foreground";
  return "border-primary/35 bg-primary/10 text-primary";
}

function getStatusTone(state: ClashSpeedtestState) {
  if (state.status === "error") return "text-destructive";
  if (state.status === "missing") return "text-muted-foreground";
  return "text-primary";
}

function isBusy(state: ClashSpeedtestState) {
  return false;
}
