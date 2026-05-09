import { Check, FileSearch, Loader2, Play } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "../lib/utils";
import type { AppState } from "../../../shared/rpc";

export function RunSetupView({
  state,
  configPath,
  onConfigPathChange,
  onSelectConfigFile,
  recentConfigPaths,
  selectedRegionIds,
  onToggleRegion,
  progress,
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
  progress: string;
  progressLog: string[];
  error: string | null;
  onStartRun: () => void;
  isPending: boolean;
  diagnosticsHint: string | null;
  onOpenDiagnostics: () => void;
}) {
  const enabledSites = state.sites.filter((site) => site.enabled !== false);
  const isRunDisabled = !configPath.trim() || !selectedRegionIds.length || !enabledSites.length || isPending;

  return (
    <section className="custom-scrollbar h-full overflow-y-auto px-6 pb-8">
      <div className="mx-auto max-w-6xl">
      <header className="flex h-14 items-center justify-between border-b border-border">
        <div>
          <h1 className="text-base font-semibold text-foreground">执行测试</h1>
          <p className="text-xs text-muted-foreground">选择订阅配置和地区，然后运行延迟测试。</p>
        </div>
        <Badge variant="outline" className="border-border bg-secondary text-muted-foreground">
          {enabledSites.length} 个网站
        </Badge>
      </header>

      <div className="divide-y divide-border">
        <section className="py-5">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="grid content-start gap-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">yaml 地址或 URL</span>
                  <div className="flex gap-2">
                    <Input
                      value={configPath}
                      onChange={(event) => onConfigPathChange(event.target.value)}
                      placeholder="/Users/nicholas/.../config.yaml 或 https://example.com/subscription.yaml"
                      className="h-10"
                    />
                    <Button type="button" variant="outline" onClick={onSelectConfigFile} className="shrink-0">
                      <FileSearch className="h-4 w-4" />
                      选择
                    </Button>
                  </div>
                </label>
                <div className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">读取预设</span>
                  {recentConfigPaths.length ? (
                    <div className="custom-scrollbar flex min-w-0 flex-nowrap gap-2 overflow-x-auto pb-1">
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

              <div className="grid content-start gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-muted-foreground">地区预设</span>
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                      {selectedRegionIds.length}/{state.regions.length}
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="地区预设多选">
                    {state.regions.map((region) => (
                      <Button
                        key={region.id}
                        type="button"
                        variant="outline"
                        role="checkbox"
                        aria-checked={selectedRegionIds.includes(region.id)}
                        className={cn(
                          "h-8 justify-start px-2.5 text-sm",
                          selectedRegionIds.includes(region.id)
                            ? "border-emerald-500/45 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/16"
                            : "border-input bg-secondary/35 text-secondary-foreground hover:bg-accent",
                        )}
                        onClick={() => onToggleRegion(region.id)}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            selectedRegionIds.includes(region.id)
                              ? "border-emerald-300 bg-emerald-400 text-emerald-950"
                              : "border-input bg-background",
                          )}
                        >
                          {selectedRegionIds.includes(region.id) ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="truncate">{region.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">
                  当前会测试 {enabledSites.length} 个网站：
                  <span className="text-secondary-foreground"> {enabledSites.map((site) => site.name).join("、") || "请先到设置页启用网站"}</span>
                </div>
              </div>
            </div>

            {diagnosticsHint ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
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

        <section className="grid gap-4 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="grid content-start gap-3">
              <Button
                onClick={onStartRun}
                disabled={isRunDisabled}
                aria-busy={isPending}
                className="h-10 justify-start px-3"
              >
                {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
                {isPending ? "测试中..." : "开始测试"}
              </Button>

              <div className="grid gap-1 text-sm">
                <span className="min-w-0 break-words text-secondary-foreground">{progress}</span>
                {error ? <span className="break-words text-red-300">{error}</span> : null}
              </div>
            </div>

            <div className="min-w-0">
              <TerminalLog messages={progressLog} />
            </div>
        </section>
      </div>
      </div>
    </section>
  );
}

function TerminalLog({ messages }: { messages: string[] }) {
  return (
    <ScrollArea
      className="rounded-md border border-border bg-secondary/35"
      viewportClassName="max-h-[340px] min-h-[180px] p-3 font-mono text-xs leading-6 text-muted-foreground"
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
