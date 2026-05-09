import { BarChart3, PlayCircle, Wrench } from "lucide-react";
import { Button } from "./ui/button";
import { ClashSpeedtestQuickStatus } from "./clash-speedtest-status";
import { cn } from "../lib/utils";
import type { ClashSpeedtestState } from "../../../shared/rpc";

export type AppView = "run" | "analysis" | "diagnostics";

const viewItems: Array<{ id: AppView; label: string; icon: typeof PlayCircle }> = [
  { id: "run", label: "执行测试", icon: PlayCircle },
  { id: "analysis", label: "结果分析", icon: BarChart3 },
  { id: "diagnostics", label: "设置", icon: Wrench },
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
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2 pt-4">
        <div className="text-xs font-medium text-muted-foreground">Latency Compass</div>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-2" role="tablist" aria-label="主导航">
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
                "h-8 w-full justify-start rounded-md px-2 text-sm",
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

      <div className="border-t border-border px-2 py-3">
        <ClashSpeedtestQuickStatus state={state} />
      </div>
    </div>
  );
}
