import { BarChart3, PlayCircle, Wrench } from "lucide-react";
import { Button } from "./ui/button";
import { ClashSpeedtestQuickStatus } from "./clash-speedtest-status";
import { cn } from "../lib/utils";
import type { ClashSpeedtestState } from "../../../shared/rpc";

export type AppView = "run" | "analysis" | "diagnostics";

const viewItems: Array<{ id: AppView; label: string; icon: typeof PlayCircle }> = [
  { id: "run", label: "执行测试", icon: PlayCircle },
  { id: "analysis", label: "结果分析", icon: BarChart3 },
  { id: "diagnostics", label: "依赖", icon: Wrench },
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
    <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-stone-950/60 p-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="主导航">
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
                "h-11 rounded-full px-4 text-sm",
                active
                  ? "bg-stone-100 text-stone-950 hover:bg-stone-100"
                  : "border border-stone-800 bg-stone-950/50 text-stone-300 hover:bg-stone-900 hover:text-stone-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </div>
      <ClashSpeedtestQuickStatus state={state} />
    </div>
  );
}
