import { useLayoutEffect, useRef, useState } from "react";
import { Check, FileSearch, Loader2, Play } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
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
  const isRunDisabled =
    !configPath.trim() || !selectedRegionIds.length || isPending || state.clashSpeedtest.status === "downloading";

  return (
    <section className="mx-auto max-w-7xl px-8 pb-10">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <Card className="border-white/10 bg-stone-950/70 shadow-2xl shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-3xl">配置并发起一次测试</CardTitle>
            <CardDescription>先选择 Clash/Mihomo 配置和地区预设，再启动一次新的节点延迟测试。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-300">Clash/Mihomo 配置路径或订阅 URL</span>
              <div className="flex gap-2">
                <Input
                  value={configPath}
                  onChange={(event) => onConfigPathChange(event.target.value)}
                  placeholder="/Users/nicholas/Library/Application Support/mihomo-party/profiles/config.yaml"
                />
                <Button type="button" variant="outline" onClick={onSelectConfigFile} className="shrink-0">
                  <FileSearch className="h-4 w-4" />
                  选择文件
                </Button>
              </div>
              {recentConfigPaths.length ? (
                <div className="flex flex-wrap gap-2">
                  {recentConfigPaths.map((item) => (
                    <Button
                      key={item.path}
                      type="button"
                      variant="secondary"
                      className="max-w-[260px] truncate px-3"
                      title={item.path}
                      onClick={() => onConfigPathChange(item.path)}
                    >
                      {shortenPath(item.path)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-stone-300">地区预设</span>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                  多选 · {selectedRegionIds.length}/{state.regions.length}
                </Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="地区预设多选">
                {state.regions.map((region) => (
                  <Button
                    key={region.id}
                    type="button"
                    variant="outline"
                    role="checkbox"
                    aria-checked={selectedRegionIds.includes(region.id)}
                    className={cn(
                      "h-10 justify-start border-dashed px-3 text-sm",
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
                    {region.label}
                  </Button>
                ))}
              </div>
            </div>

            {diagnosticsHint ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="font-medium">当前建议查看诊断</div>
                <div className="mt-1 text-amber-200/90">{diagnosticsHint}</div>
                <Button type="button" variant="outline" className="mt-3 border-amber-400/30" onClick={onOpenDiagnostics}>
                  打开依赖与诊断
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={onStartRun} disabled={isRunDisabled} aria-busy={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {isPending ? "测试中..." : "开始测试"}
              </Button>
              <span className="text-sm text-stone-400">{progress}</span>
              {error ? <span className="text-sm text-red-300">{error}</span> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-800 bg-stone-950/80">
          <CardHeader>
            <CardTitle className="text-2xl">执行日志</CardTitle>
            <CardDescription>这里只显示当前执行流程的实时进度，不再与结果分析区混排。</CardDescription>
          </CardHeader>
          <CardContent>
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
    <div className="relative rounded-2xl border border-stone-800 bg-black/25">
      <div
        ref={scrollAreaRef}
        className="terminal-log-scroll-area max-h-[460px] overflow-auto p-4 pr-7 font-mono text-xs leading-6 text-stone-400"
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
