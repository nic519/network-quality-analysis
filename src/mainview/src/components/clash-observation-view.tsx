import type { ClashObservationDetail, ClashObservationSummary } from "../../../shared/clash-observation";
import type { AppState } from "../../../shared/rpc";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function ClashObservationView({
  state,
  selectedObservationId,
  detail,
  onSelectedObservationIdChange,
}: {
  state: AppState;
  selectedObservationId: string | null;
  detail: ClashObservationDetail | null;
  onSelectedObservationIdChange: (observationId: string) => void;
}) {
  const summaries = state.clashObservation.summaries;

  return (
    <section className="flex h-full min-h-0 bg-background text-foreground">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-border bg-secondary/25">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div>
            <h1 className="text-base font-semibold">观测复盘</h1>
            <p className="text-xs text-muted-foreground">查看 Clash 观测历史。</p>
          </div>
          <Badge variant="outline" className="border-border bg-secondary text-muted-foreground">
            {summaries.length} 条
          </Badge>
        </header>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {summaries.length ? (
            <div className="grid gap-1">
              {summaries.map((summary) => (
                <ObservationSummaryButton
                  key={summary.id}
                  summary={summary}
                  active={selectedObservationId === summary.id}
                  onClick={() => onSelectedObservationIdChange(summary.id)}
                />
              ))}
            </div>
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">还没有观测记录。先在工具设置里启用 Clash 观测，或点击立即采集。</p>
          )}
        </div>
      </aside>

      <div className="custom-scrollbar min-w-0 flex-1 overflow-y-auto px-6 pb-8">
        {detail ? (
          <div className="mx-auto grid max-w-6xl gap-5">
            <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border py-3">
              <div>
                <h2 className="font-mono text-sm font-semibold">{detail.summary.id}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(detail.summary.startedAt)} · {detail.summary.controllerUrl}
                </p>
              </div>
              <Badge
                variant={detail.summary.status === "completed" ? "default" : "outline"}
                className={detail.summary.status === "completed" ? "" : "border-destructive/40 text-destructive"}
              >
                {detail.summary.status === "completed" ? "完成" : "失败"}
              </Badge>
            </header>

            {detail.summary.errorMessage ? (
              <div className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {detail.summary.errorMessage}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="节点快照" value={detail.summary.proxyCount} />
              <Metric label="连接采样" value={detail.summary.connectionSampleCount} />
              <Metric label="日志事件" value={detail.summary.logEventCount} />
              <Metric label="规则条目" value={detail.rules.length} />
            </div>

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold">配置摘要</h3>
              {detail.config ? (
                <div className="grid gap-2 rounded-md border border-border bg-secondary/25 p-3 text-xs sm:grid-cols-4">
                  <ConfigPair label="mode" value={detail.config.mode} />
                  <ConfigPair label="log-level" value={detail.config.logLevel} />
                  <ConfigPair label="mixed-port" value={detail.config.mixedPort} />
                  <ConfigPair label="config hash" value={detail.config.configHash} />
                </div>
              ) : (
                <EmptyLine text="没有配置快照。" />
              )}
            </section>

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold">节点快照</h3>
              {detail.proxies.length ? (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-secondary/55 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">名称</th>
                        <th className="px-3 py-2 font-medium">类型</th>
                        <th className="px-3 py-2 font-medium">当前选择</th>
                        <th className="px-3 py-2 font-medium">可用</th>
                        <th className="px-3 py-2 font-medium">延迟</th>
                        <th className="px-3 py-2 font-medium">子节点</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detail.proxies.slice(0, 80).map((proxy) => (
                        <tr key={proxy.proxyName}>
                          <td className="px-3 py-2 font-medium text-foreground">{proxy.proxyName}</td>
                          <td className="px-3 py-2 text-muted-foreground">{proxy.proxyType || "N/A"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{proxy.nowProxy || "N/A"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{proxy.alive || "N/A"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{proxy.delayMs === null ? "N/A" : `${proxy.delayMs}ms`}</td>
                          <td className="px-3 py-2 text-muted-foreground">{countJsonArray(proxy.childrenJson)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyLine text="没有节点快照。" />
              )}
            </section>

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold">连接采样</h3>
              {detail.connections.length ? (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[880px] text-left text-xs">
                    <thead className="bg-secondary/55 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">域名</th>
                        <th className="px-3 py-2 font-medium">目标 IP</th>
                        <th className="px-3 py-2 font-medium">规则</th>
                        <th className="px-3 py-2 font-medium">链路</th>
                        <th className="px-3 py-2 font-medium">连接</th>
                        <th className="px-3 py-2 font-medium">流量</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detail.connections.slice(0, 80).map((connection, index) => (
                        <tr key={`${connection.domain}-${connection.chain}-${index}`}>
                          <td className="px-3 py-2 font-medium text-foreground">{connection.domain || "N/A"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{connection.destinationIp || "N/A"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{formatRule(connection.rule, connection.rulePayload)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{connection.chain || "N/A"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{connection.connectionCount}</td>
                          <td className="px-3 py-2 text-muted-foreground">{formatBytes(connection.upload + connection.download)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyLine text="没有连接采样。" />
              )}
            </section>

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold">日志事件</h3>
              {detail.logEvents.length ? (
                <div className="grid gap-2">
                  {detail.logEvents.map((event) => (
                    <div key={`${event.id ?? event.eventTime}-${event.message}`} className="rounded-md border border-border bg-secondary/25 px-3 py-2 text-xs">
                      <div className="mb-1 flex flex-wrap gap-2 text-muted-foreground">
                        <span>{event.eventTime ? formatDateTime(event.eventTime) : "未知时间"}</span>
                        <span>{event.level}</span>
                        <span>{event.eventType}</span>
                        {event.domain ? <span>{event.domain}</span> : null}
                        {event.proxyName ? <span>{event.proxyName}</span> : null}
                      </div>
                      <div className="break-words text-secondary-foreground">{event.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyLine text="没有 warning/error 日志事件。" />
              )}
            </section>
          </div>
        ) : summaries.length ? (
          <div className="mx-auto flex h-full max-w-4xl items-center justify-center text-sm text-muted-foreground">选择左侧观测记录查看详情。</div>
        ) : (
          <div className="mx-auto flex h-full max-w-4xl items-center justify-center text-sm text-muted-foreground">还没有观测记录。</div>
        )}
      </div>
    </section>
  );
}

function ObservationSummaryButton({ summary, active, onClick }: { summary: ClashObservationSummary; active: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("h-auto w-full justify-start rounded-md px-2 py-2 text-left", active ? "bg-accent text-accent-foreground hover:bg-accent" : "hover:bg-accent/65")}
      onClick={onClick}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-xs">{summary.id}</span>
          <span className={cn("text-xs", summary.status === "completed" ? "text-primary" : "text-destructive")}>
            {summary.status === "completed" ? "完成" : "失败"}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatDateTime(summary.startedAt)} · 节点 {summary.proxyCount} · 连接 {summary.connectionSampleCount} · 事件 {summary.logEventCount}
        </div>
      </div>
    </Button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-secondary/25 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function ConfigPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-secondary-foreground">{value || "N/A"}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-md border border-border bg-secondary/25 px-3 py-2 text-sm text-muted-foreground">{text}</p>;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? String(parsed.length) : "0";
  } catch {
    return "0";
  }
}

function formatRule(rule: string, payload: string) {
  if (!rule && !payload) return "N/A";
  if (!payload) return rule;
  if (!rule) return payload;
  return `${rule} / ${payload}`;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
