import { BarChart3, History, LineChart, PlayCircle, Wrench } from "lucide-react";
import { Button } from "./ui/button";
import { ClashSpeedtestQuickStatus } from "./clash-speedtest-status";
import { cn } from "../lib/utils";
import type { ClashSpeedtestState } from "../../../shared/rpc";

export type AppView = "run" | "analysis" | "trends" | "observation" | "diagnostics";

const viewItems: Array<{ id: AppView; label: string; icon: typeof PlayCircle }> = [
  { id: "run", label: "开始测速", icon: PlayCircle },
  { id: "analysis", label: "历史结果", icon: BarChart3 },
  { id: "trends", label: "趋势分析", icon: LineChart },
  { id: "observation", label: "观测复盘", icon: History },
  { id: "diagnostics", label: "工具设置", icon: Wrench },
];

export function TopNavigation({
  activeView,
  onChange,
  state,
}: {
  activeView: AppView;
  onChange: (view: AppView) => void;
  state: ClashSpeedtestState;
}) {
  return (
    <div className="flex h-14 items-center gap-4 px-5">
      <div className="flex min-w-0 flex-1 items-center gap-1" role="tablist" aria-label="主导航">
        {viewItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView;
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.id)}
              className={cn(
                "h-8 shrink-0 rounded-md px-3 text-sm",
                active
                  ? "bg-accent text-accent-foreground hover:bg-accent"
                  : "text-muted-foreground hover:bg-accent/65 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Button>
          );
        })}
      </div>

      <div className="shrink-0">
        <ClashSpeedtestQuickStatus state={state} />
      </div>
    </div>
  );
}
