import { Check, ChevronDown, FileSearch, Loader2, Play, Route, Target, TerminalSquare } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { getDiagnosticsSummary } from "./clash-speedtest-status";
import { cn } from "../lib/utils";
import type { AppState, RunProgressState } from "../../../shared/rpc";

export function RunSetupView({
  state,
  configPath,
  onConfigPathChange,
  onSelectConfigFile,
  recentConfigPaths,
  selectedRegionIds,
  onToggleRegion,
  selectedSiteIds,
  onToggleSite,
  progress,
  runProgress,
  progressLog,
  error,
  onStartRun,
  isPending,
  diagnosticsHint,
  onOpenDiagnostics,
}: {
  state: AppState;
  configPath: string;
  onConfigPathChange: (value: string) => void;
  onSelectConfigFile: () => void;
  recentConfigPaths: AppState["configHistory"];
  selectedRegionIds: string[];
  onToggleRegion: (regionId: string) => void;
  selectedSiteIds: string[];
  onToggleSite: (siteId: string) => void;
  progress: string;
  runProgress: RunProgressState | null;
  progressLog: string[];
  error: string | null;
  onStartRun: () => void;
  isPending: boolean;
  diagnosticsHint: string | null;
  onOpenDiagnostics: () => void;
}) {
  const selectedRegions = state.regions.filter((region) => selectedRegionIds.includes(region.id));
  const selectedSites = state.sites.filter((site) => selectedSiteIds.includes(site.id));
  const testGroupCount = selectedRegions.length * selectedSites.length;
  const isRunDisabled =
    !configPath.trim() || !selectedRegions.length || !selectedSites.length || state.clashSpeedtest.status !== "ready" || isPending;

  return (
    <section className="custom-scrollbar h-full overflow-y-auto px-6 pb-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex min-h-16 items-center justify-between border-b border-border py-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">测速工作台</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              读取配置，按节点名称筛选地区，再让这些节点访问目标网站，最后按延迟和失败情况排序。
            </p>
          </div>
          <Badge variant="outline" className="border-border bg-secondary text-muted-foreground">
            {testGroupCount} 组测试
          </Badge>
        </header>

        <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.82fr)]">
          <section className="grid content-start gap-5">
            <div className="grid gap-3">
              <StepHeading number="1" title="选择配置" description="支持本地 yaml 文件路径，或 Clash/Mihomo 订阅 URL。" />
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Clash/Mihomo 配置</span>
                <div className="flex gap-2">
                  <Input
                    value={configPath}
                    onChange={(event) => onConfigPathChange(event.target.value)}
                    placeholder="本地 yaml 文件路径，或 https:// 开头的订阅 URL"
                    className="h-10"
                  />
                  <Button type="button" variant="outline" onClick={onSelectConfigFile} className="shrink-0">
                    <FileSearch className="h-4 w-4" />
                    选择
                  </Button>
                </div>
              </label>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">最近使用</span>
                {recentConfigPaths.length ? (
                  <div className="custom-scrollbar flex min-w-0 flex-nowrap gap-2 overflow-x-auto overflow-y-hidden pb-1">
                    {recentConfigPaths.map((item) => (
                      <Button
                        key={item.path}
                        type="button"
                        variant="secondary"
                        className="h-8 max-w-[220px] shrink-0 truncate px-2.5 text-xs"
                        title={item.path}
                        onClick={() => onConfigPathChange(item.path)}
                      >
                        {shortenPath(item.path)}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">暂无历史地址</span>
                )}
              </div>
            </div>

            <div className="grid gap-3">
              <StepHeading number="2" title="筛选节点地区" description="地区不是目标网站所在地，而是用节点名称规则筛出要测试的代理节点。" />
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="地区预设多选">
                {state.regions.map((region) => (
                  <SelectableButton
                    key={region.id}
                    selected={selectedRegionIds.includes(region.id)}
                    label={region.label}
                    onClick={() => onToggleRegion(region.id)}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <StepHeading number="3" title="选择目标网站" description="每个匹配到的节点都会依次访问所选网站，用来比较真实访问质量。" />
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="目标网站多选">
                {state.sites.map((site) => (
                  <SelectableButton
                    key={site.id}
                    selected={selectedSiteIds.includes(site.id)}
                    label={site.name}
                    onClick={() => onToggleSite(site.id)}
                  />
                ))}
              </div>
            </div>
          </section>

          <aside className="grid content-start gap-4">
            <section className="rounded-md border border-border bg-card px-4 py-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">执行预览</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">这里展示点击开始后，工具实际会做的事情。</p>
                </div>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {selectedRegions.length} 地区 × {selectedSites.length} 网站
                </Badge>
              </div>

              <div className="grid gap-3">
                <PreviewRow
                  icon={Route}
                  title="筛出节点"
                  body={selectedRegions.length ? selectedRegions.map((region) => region.label).join("、") : "请选择至少一个节点地区"}
                />
                <PreviewRow
                  icon={Target}
                  title="访问网站"
                  body={selectedSites.length ? selectedSites.map((site) => site.name).join("、") : "请选择至少一个目标网站"}
                />
                <PreviewRow icon={TerminalSquare} title="输出结果" body="记录每个节点的延迟和失败情况，再按当前网站给出最快节点。" />
              </div>

              <div className="mt-4 rounded-md border border-border bg-secondary/35 px-3 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">本次测试规模</span>
                  <span className="text-muted-foreground">{testGroupCount} 组 clash-speedtest 调用</span>
                </div>
                <div className="mt-2 text-xs leading-5 text-muted-foreground">
                  每组测试都会使用同一份配置，通过一个地区筛选规则访问一个目标 URL。
                </div>
              </div>
            </section>

            <section className="rounded-md border border-border bg-card px-4 py-4">
              <h2 className="text-sm font-semibold text-foreground">节点匹配规则</h2>
              <div className="mt-3 grid gap-3">
                {selectedRegions.length ? (
                  selectedRegions.map((region) => (
                    <div key={region.id} className="grid gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="border-border bg-secondary text-secondary-foreground">
                          {region.shortLabel}
                        </Badge>
                        <span className="font-medium text-foreground">{region.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {splitRegionTerms(region.filterRegex).map((term) => (
                          <span key={`${region.id}-${term}`} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">选择地区后，这里会显示用于匹配节点名称的关键词。</p>
                )}
              </div>
            </section>

            <section className="rounded-md border border-border bg-card px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">准备状态</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{getDiagnosticsSummary(state.clashSpeedtest)}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0",
                    state.clashSpeedtest.status === "ready"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {state.clashSpeedtest.status === "ready" ? "可开始" : "需处理"}
                </Badge>
              </div>
              {diagnosticsHint ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                  <span className="min-w-0 truncate">{diagnosticsHint}</span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 shrink-0 border-amber-400/30 px-2.5 text-xs"
                    onClick={onOpenDiagnostics}
                  >
                    诊断
                  </Button>
                </div>
              ) : null}
            </section>
          </aside>
        </div>

        <section className="border-t border-border py-5">
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="grid content-start gap-3">
              <Button onClick={onStartRun} disabled={isRunDisabled} aria-busy={isPending} className="h-11 justify-start px-3">
                {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
                {isPending ? "测试中..." : "开始测试"}
              </Button>

              {runProgress ? <RunProgressPanel progress={runProgress} /> : null}

              <div className="grid gap-1 text-sm">
                <span className="min-w-0 break-words text-secondary-foreground">{progress}</span>
                {error ? <span className="break-words text-destructive">{error}</span> : null}
              </div>
            </div>

            <details className="min-w-0 rounded-md border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm text-secondary-foreground hover:bg-accent/45">
                <span>详细日志</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </summary>
              <TerminalLog messages={progressLog} />
            </details>
          </div>
        </section>
      </div>
    </section>
  );
}

function RunProgressPanel({ progress }: { progress: RunProgressState }) {
  const currentGroupText = progress.currentGroupLabel ?? "等待测速目标";
  const completedText = `${progress.completedGroups} / ${progress.totalGroups} 组已完成`;
  const nodeProgressText =
    progress.currentGroupNodeIndex !== null && progress.currentGroupEstimatedNodeCount !== null
      ? `第 ${progress.currentGroupNodeIndex} / ${progress.currentGroupEstimatedNodeCount} 个节点`
      : progress.currentGroupNodeIndex !== null
        ? `第 ${progress.currentGroupNodeIndex} 个节点`
        : "等待节点进度";

  return (
    <div className="grid gap-2 rounded-md border border-border bg-card/45 px-3 py-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">测试进度</span>
        <span className="text-muted-foreground">{nodeProgressText}</span>
      </div>
      <div
        role="progressbar"
        aria-label="测速进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-3 overflow-hidden rounded-full bg-secondary"
      >
        <div className="h-full rounded-full bg-primary transition-colors" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="grid gap-1">
        <div className="text-xs text-muted-foreground">{completedText}</div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">当前目标</span>
          <span className="text-right font-medium text-foreground">{currentGroupText}</span>
        </div>
        {progress.currentGroupNodeCount !== null ? (
          <div className="text-xs text-muted-foreground">当前组合已返回 {progress.currentGroupNodeCount} 个节点结果</div>
        ) : null}
      </div>
    </div>
  );
}

function StepHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
        {number}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function SelectableButton({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      role="checkbox"
      aria-checked={selected}
      className={cn(
        "h-9 justify-start px-2.5 text-sm",
        selected
          ? "border-primary/45 bg-primary/10 text-foreground hover:bg-primary/15"
          : "border-input bg-secondary/20 text-secondary-foreground hover:bg-accent",
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
        )}
      >
        {selected ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="truncate">{label}</span>
    </Button>
  );
}

function PreviewRow({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Route;
  title: string;
  body: string;
}) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        <div className="mt-0.5 min-w-0 break-words text-sm text-foreground">{body}</div>
      </div>
    </div>
  );
}

function splitRegionTerms(filterRegex: string) {
  return filterRegex
    .split("|")
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function TerminalLog({ messages }: { messages: string[] }) {
  return (
    <ScrollArea
      className="border-t border-border bg-secondary/25"
      viewportClassName="max-h-[280px] min-h-[150px] p-3 font-mono text-xs leading-6 text-muted-foreground"
      contentClassName="space-y-0"
    >
      {messages.map((message, index) => (
        <div key={`${index}-${message}`}>{message}</div>
      ))}
    </ScrollArea>
  );
}

function shortenPath(path: string) {
  const parts = path.split("/");
  if (parts.length <= 3) return path;
  return `${parts.at(-2)}/${parts.at(-1)}`;
}
