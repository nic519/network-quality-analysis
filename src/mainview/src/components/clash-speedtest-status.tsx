import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import type { ClashSpeedtestState } from "../../../shared/rpc";

export function ClashSpeedtestQuickStatus({ state }: { state: ClashSpeedtestState }) {
  const Icon = getClashSpeedtestStatusIcon(state);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-800 bg-stone-950/75 px-3 py-2 text-sm text-stone-200">
      <Icon className={cn("h-4 w-4", getStatusTone(state), isBusy(state) ? "animate-spin" : "")} />
      <span className="font-medium">{getQuickStatusLabel(state)}</span>
      <Badge variant="outline" className={cn("hidden md:inline-flex", getQuickStatusBadgeClass(state))}>
        {getQuickStatusBadgeText(state)}
      </Badge>
    </div>
  );
}

export function ClashSpeedtestDiagnosticsPanel({ state }: { state: ClashSpeedtestState }) {
  const Icon = getClashSpeedtestStatusIcon(state);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-stone-200">
        <Icon className={cn("h-4 w-4", getStatusTone(state), isBusy(state) ? "animate-spin" : "")} />
        <span>{getDetailedStatusLabel(state)}</span>
      </div>
      <div className="text-sm text-stone-300">{getDiagnosticsSummary(state)}</div>
      {state.path ? <div className="break-all rounded-xl border border-stone-800 bg-black/20 px-4 py-3 text-sm text-stone-200">{state.path}</div> : null}
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
  if (state.status === "error") return "border-red-500/40 bg-red-500/10 text-red-200";
  if (state.status === "missing") return "border-stone-700 bg-stone-900/60 text-stone-300";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
}

function getStatusTone(state: ClashSpeedtestState) {
  if (state.status === "error") return "text-red-300";
  if (state.status === "missing") return "text-stone-300";
  return "text-emerald-300";
}

function isBusy(state: ClashSpeedtestState) {
  return false;
}
