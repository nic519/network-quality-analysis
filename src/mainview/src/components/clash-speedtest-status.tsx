import { AlertTriangle, CheckCircle2, FileWarning, Loader2, PackageCheck } from "lucide-react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
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
    <Card className="border-stone-800 bg-stone-950/80">
      <CardHeader className="border-b border-stone-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">clash-speedtest 依赖状态</CardTitle>
          <CardDescription className="mt-2">{getDiagnosticsSummary(state)}</CardDescription>
        </div>
          <div className="flex items-center gap-2 rounded-full border border-stone-800 bg-black/20 px-3 py-2 text-sm text-stone-200">
            <Icon className={cn("h-4 w-4", getStatusTone(state), isBusy(state) ? "animate-spin" : "")} />
            <span>{getDetailedStatusLabel(state)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        <DiagnosticItem
          label="当前内置版本"
          value={state.version}
          tone="emerald"
          detail={state.updateAvailable ? "检测到远端有更新版本" : "当前内置版本可直接用于测试"}
        />
        <DiagnosticItem
          label="远端最新版本"
          value={state.latestVersion ?? "暂未确认"}
          tone={state.updateCheckStatus === "failed" ? "amber" : "stone"}
          detail={
            state.updateCheckStatus === "failed"
              ? `检查失败：${state.updateCheckMessage ?? "未知原因"}`
              : state.updateCheckStatus === "ok"
                ? "已成功获取远端版本信息"
                : "等待检查结果"
          }
        />
        <DiagnosticItem
          label="更新检查"
          value={getUpdateCheckStatusLabel(state)}
          tone={state.updateCheckStatus === "failed" ? "amber" : state.updateCheckStatus === "ok" ? "blue" : "stone"}
          detail={state.updateCheckMessage ?? "当前没有额外错误信息"}
        />
        <DiagnosticItem
          label="本地安装路径"
          value={state.path ? shortenPath(state.path) : "尚未安装"}
          tone={state.path ? "blue" : "stone"}
          detail={state.path ?? "首次运行时会自动准备二进制"}
        />
        <DiagnosticItem
          label="安装来源"
          value={state.source === "cache" ? "缓存目录" : state.source === "environment" ? "环境变量" : "无"}
          tone="stone"
          detail={state.source === "environment" ? "来自显式环境覆盖" : "默认使用应用缓存目录"}
        />
        <DiagnosticItem
          label="最近检查时间"
          value={formatCheckedAt(state.checkedAt)}
          tone="stone"
          detail={state.message}
        />
      </CardContent>
    </Card>
  );
}

export function getDiagnosticsSummary(state: ClashSpeedtestState) {
  if (state.status === "error") return state.message;
  if (state.status === "downloading") return "正在准备 clash-speedtest，下载完成后即可直接开始测试。";
  if (state.status === "missing" && state.updateCheckStatus === "failed") {
    return "本地尚未下载 clash-speedtest，当前只是更新检查失败，不代表应用损坏；首次运行仍可在网络恢复后自动尝试下载。";
  }
  if (state.status === "missing") return "当前还没有本地 clash-speedtest，首次运行测试时会自动下载。";
  if (state.updateCheckStatus === "failed") {
    return `本地版本仍可继续使用，但远端更新检查失败：${state.updateCheckMessage ?? "未知原因"}。`;
  }
  if (state.updateAvailable) return `本地已可用，同时检测到新版本 ${state.latestVersion}。`;
  return "本地版本已就绪，可以直接发起测试。";
}

function DiagnosticItem({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "amber" | "blue" | "stone";
}) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{label}</div>
      <div
        className={cn(
          "mt-2 text-sm font-semibold",
          tone === "emerald" && "text-emerald-200",
          tone === "amber" && "text-amber-200",
          tone === "blue" && "text-sky-200",
          tone === "stone" && "text-stone-100",
        )}
      >
        {value}
      </div>
      <div className="mt-2 text-xs leading-5 text-stone-400">{detail}</div>
    </div>
  );
}

function getClashSpeedtestStatusIcon(state: ClashSpeedtestState) {
  if (state.status === "downloading" || state.status === "checking-update") return Loader2;
  if (state.status === "ready" && state.updateAvailable) return PackageCheck;
  if (state.status === "ready") return CheckCircle2;
  if (state.status === "missing" && state.updateCheckStatus === "failed") return FileWarning;
  return AlertTriangle;
}

function getQuickStatusLabel(state: ClashSpeedtestState) {
  if (state.status === "downloading") return "准备中";
  if (state.status === "checking-update") return "检查更新中";
  if (state.status === "error") return "不可用";
  if (state.status === "missing" && state.updateCheckStatus === "failed") return "待导入";
  if (state.status === "missing") return "未安装";
  if (state.updateAvailable) return "可用，有更新";
  if (state.updateCheckStatus === "failed") return "可用，检查失败";
  return "可用";
}

function getDetailedStatusLabel(state: ClashSpeedtestState) {
  if (state.status === "downloading") return "下载中";
  if (state.status === "checking-update") return "检查中";
  if (state.status === "missing") return "尚未下载";
  if (state.status === "error") return "真实错误";
  if (state.updateAvailable) return "可用且有更新";
  return "可直接运行";
}

function getQuickStatusBadgeText(state: ClashSpeedtestState) {
  if (state.status === "downloading") return "下载中";
  if (state.status === "checking-update") return "检查中";
  if (state.status === "error") return "阻塞";
  if (state.status === "missing") return "待准备";
  if (state.updateAvailable) return "有更新";
  if (state.updateCheckStatus === "failed") return "可用";
  return "就绪";
}

function getQuickStatusBadgeClass(state: ClashSpeedtestState) {
  if (state.status === "error") return "border-red-500/40 bg-red-500/10 text-red-200";
  if (state.status === "downloading" || state.status === "checking-update") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-200";
  }
  if (state.status === "missing" && state.updateCheckStatus === "failed") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  if (state.status === "missing") return "border-stone-700 bg-stone-900/60 text-stone-300";
  if (state.updateAvailable) return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  if (state.updateCheckStatus === "failed") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
}

function getStatusTone(state: ClashSpeedtestState) {
  if (state.status === "error") return "text-red-300";
  if (state.status === "downloading" || state.status === "checking-update") return "text-sky-300";
  if (state.status === "missing" && state.updateCheckStatus === "failed") return "text-amber-300";
  if (state.status === "missing") return "text-stone-300";
  if (state.updateAvailable) return "text-amber-300";
  if (state.updateCheckStatus === "failed") return "text-amber-300";
  return "text-emerald-300";
}

function getUpdateCheckStatusLabel(state: ClashSpeedtestState) {
  if (state.updateCheckStatus === "ok") return "检查成功";
  if (state.updateCheckStatus === "failed") return "检查失败";
  return "等待检查";
}

function isBusy(state: ClashSpeedtestState) {
  return state.status === "downloading" || state.status === "checking-update";
}

function shortenPath(path: string) {
  const parts = path.split("/");
  if (parts.length <= 3) return path;
  return `${parts.at(-2)}/${parts.at(-1)}`;
}

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
