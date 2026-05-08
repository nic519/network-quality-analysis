import { useLayoutEffect, useRef, useState } from "react";
import { Check, FileSearch, Loader2, Play } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
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
  const isConfigUrl = /^https?:\/\//i.test(configPath.trim());
  const isRunDisabled =
    !configPath.trim() || !selectedRegionIds.length || isPending || state.clashSpeedtest.status === "downloading";

  return (
    <section className="mx-auto max-w-7xl px-8 pb-10 pt-5">
      <div className="grid gap-4">
        <Card className="rounded-lg border-white/10 bg-stone-950/80 shadow-2xl shadow-black/20 backdrop-blur">
          <CardContent className="grid gap-4 p-4">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="grid content-start gap-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-stone-400">yaml 地址</span>
                  <div className="flex gap-2">
                    <Input
                      value={isConfigUrl ? "" : configPath}
                      onChange={(event) => onConfigPathChange(event.target.value)}
                      placeholder="/Users/nicholas/Library/Application Support/mihomo-party/profiles/config.yaml"
                      className="h-10"
                    />
                    <Button type="button" variant="outline" onClick={onSelectConfigFile} className="h-10 shrink-0 px-3">
                      <FileSearch className="h-4 w-4" />
                      选择
                    </Button>
                  </div>
                </label>

                {recentConfigPaths.length ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs font-medium text-stone-500">读取预设</span>
                    <div className="custom-scrollbar flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto pb-1">
                      {recentConfigPaths.map((item) => (
                        <Button
                          key={item.path}
                          type="button"
                          variant="secondary"
                          className="h-8 max-w-[220px] shrink-0 truncate px-3 text-xs text-stone-200"
                          title={item.path}
                          onClick={() => onConfigPathChange(item.path)}
                        >
                          {shortenPath(item.path)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <Button
                  onClick={onStartRun}
                  disabled={isRunDisabled}
                  aria-busy={isPending}
                  className="mt-1 h-14 rounded-lg bg-gradient-to-r from-emerald-300 via-lime-300 to-amber-300 px-5 text-base font-black text-stone-950 shadow-[0_0_28px_rgba(132,204,22,0.35)] transition hover:scale-[1.01] hover:from-emerald-200 hover:via-lime-200 hover:to-amber-200 disabled:hover:scale-100"
                >
                  {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
                  {isPending ? "测试中..." : "开始测试"}
                </Button>

                <div className="flex min-w-0 items-baseline gap-2 text-sm">
                  <span className="shrink-0 text-xs font-medium text-stone-500">运行状态</span>
                  <span className="min-w-0 truncate text-stone-300">{progress}</span>
                  {error ? <span className="shrink-0 text-red-300">{error}</span> : null}
                </div>
              </div>

              <div className="grid content-start gap-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-stone-400">输入 URL</span>
                  <Input
                    value={isConfigUrl ? configPath : ""}
                    onChange={(event) => onConfigPathChange(event.target.value)}
                    placeholder="https://example.com/subscription.yaml"
                    className="h-10"
                  />
                </label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-stone-400">地区预设</span>
                    <Badge variant="outline" className="h-6 border-emerald-500/30 bg-emerald-500/10 px-2 text-emerald-200">
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
                          "h-9 justify-start border-dashed px-3 text-sm",
                          selectedRegionIds.includes(region.id)
                            ? "border-emerald-500/55 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
                            : "border-stone-700 bg-stone-950/40 text-stone-300 hover:bg-stone-900",
                        )}
                        onClick={() => onToggleRegion(region.id)}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            selectedRegionIds.includes(region.id)
                              ? "border-emerald-300 bg-emerald-400 text-emerald-950"
                              : "border-stone-600 bg-stone-950",
                          )}
                        >
                          {selectedRegionIds.includes(region.id) ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="truncate">{region.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {diagnosticsHint ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                <span className="min-w-0 truncate">{diagnosticsHint}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 shrink-0 border-amber-400/30 px-3 text-xs"
                  onClick={onOpenDiagnostics}
                >
                  诊断
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-stone-800 bg-stone-950/80">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-medium text-stone-500">日志</span>
              <span className="text-xs text-stone-600">{progressLog.length} 条</span>
            </div>
            <TerminalLog messages={progressLog} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function TerminalLog({ messages }: { messages: string[] }) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startY: number; startScrollTop: number } | null>(null);
  const [scrollState, setScrollState] = useState({ canScroll: false, thumbTop: 0, thumbHeight: 100 });

  const updateScrollState = () => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const { clientHeight, scrollHeight, scrollTop } = scrollArea;
    const canScroll = scrollHeight > clientHeight + 1;
    const thumbHeight = canScroll ? Math.max(34, (clientHeight / scrollHeight) * 100) : 100;
    const maxThumbTop = 100 - thumbHeight;
    const thumbTop = canScroll ? (scrollTop / (scrollHeight - clientHeight)) * maxThumbTop : 0;

    setScrollState({ canScroll, thumbTop, thumbHeight });
  };

  useLayoutEffect(() => {
    updateScrollState();
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(scrollArea);
    resizeObserver.observe(scrollArea.firstElementChild ?? scrollArea);

    return () => resizeObserver.disconnect();
  }, [messages]);

  const scrollToTrackPosition = (clientY: number) => {
    const scrollArea = scrollAreaRef.current;
    const track = thumbRef.current?.parentElement;
    if (!scrollArea || !track) return;

    const trackRect = track.getBoundingClientRect();
    const targetRatio =
      (clientY - trackRect.top - trackRect.height * (scrollState.thumbHeight / 100) * 0.5) / trackRect.height;
    scrollArea.scrollTop = targetRatio * scrollArea.scrollHeight;
    updateScrollState();
  };

  return (
    <div className="relative rounded-lg border border-stone-800 bg-black/25">
      <div
        ref={scrollAreaRef}
        className="terminal-log-scroll-area max-h-[340px] min-h-[180px] overflow-auto p-3 pr-7 font-mono text-xs leading-6 text-stone-400"
        onScroll={updateScrollState}
      >
        <div>
          {messages.map((message, index) => (
            <div key={`${index}-${message}`}>{message}</div>
          ))}
        </div>
      </div>

      {scrollState.canScroll ? (
        <div
          aria-hidden="true"
          className="absolute bottom-3 right-2 top-3 w-2 rounded-full bg-stone-900/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
          onPointerDown={(event) => scrollToTrackPosition(event.clientY)}
        >
          <div
            ref={thumbRef}
            className="absolute left-0 w-full rounded-full bg-emerald-300/45 shadow-[inset_0_0_0_1px_rgba(209,250,229,0.18)] transition-colors hover:bg-emerald-200/60"
            style={{
              height: `${scrollState.thumbHeight}%`,
              top: `${scrollState.thumbTop}%`,
            }}
            onPointerDown={(event) => {
              const scrollArea = scrollAreaRef.current;
              if (!scrollArea) return;

              event.stopPropagation();
              thumbRef.current?.setPointerCapture(event.pointerId);
              dragStateRef.current = {
                pointerId: event.pointerId,
                startY: event.clientY,
                startScrollTop: scrollArea.scrollTop,
              };
            }}
            onPointerMove={(event) => {
              const scrollArea = scrollAreaRef.current;
              const track = thumbRef.current?.parentElement;
              const dragState = dragStateRef.current;
              if (!scrollArea || !track || !dragState || dragState.pointerId !== event.pointerId) return;

              const trackHeight = track.getBoundingClientRect().height;
              const availableTrack = trackHeight * (1 - scrollState.thumbHeight / 100);
              const availableScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
              const scrollPerPixel = availableTrack > 0 ? availableScroll / availableTrack : 0;
              scrollArea.scrollTop = dragState.startScrollTop + (event.clientY - dragState.startY) * scrollPerPixel;
              updateScrollState();
            }}
            onPointerUp={(event) => {
              if (dragStateRef.current?.pointerId === event.pointerId) {
                dragStateRef.current = null;
                thumbRef.current?.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={(event) => {
              if (dragStateRef.current?.pointerId === event.pointerId) {
                dragStateRef.current = null;
                thumbRef.current?.releasePointerCapture(event.pointerId);
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function shortenPath(path: string) {
  const parts = path.split("/");
  if (parts.length <= 3) return path;
  return `${parts.at(-2)}/${parts.at(-1)}`;
}
