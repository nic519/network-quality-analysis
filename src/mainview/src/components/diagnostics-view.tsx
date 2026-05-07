import { useEffect, useState } from "react";
import { ChevronDown, FolderOpen, RotateCcw, X } from "lucide-react";
import { ClashSpeedtestDiagnosticsPanel } from "./clash-speedtest-status";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import type { AppState } from "../../../shared/rpc";

const GO_INSTALL_COMMAND = "go install github.com/nic519/clash-speedtest@latest";

export function DiagnosticsView({
  state,
  onSelectBinary,
  onSetBinaryPath,
  onResetBinaryPath,
}: {
  state: AppState["clashSpeedtest"];
  onSelectBinary: () => void;
  onSetBinaryPath: (path: string) => Promise<void>;
  onResetBinaryPath: () => Promise<void>;
}) {
  const [manualPath, setManualPath] = useState(state.source === "manual" ? state.path ?? "" : "");

  useEffect(() => {
    setManualPath(state.source === "manual" ? state.path ?? "" : "");
  }, [state.path, state.source]);

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-8 pb-10">
      <Card className="border-stone-800 bg-stone-950/80">
        <CardHeader className="gap-3 border-b border-stone-800">
          <CardTitle className="text-xl">依赖</CardTitle>
          <div className="rounded-xl border border-stone-800 bg-black/20 px-4 py-3 font-mono text-sm text-stone-100">
            {GO_INSTALL_COMMAND}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <ClashSpeedtestDiagnosticsPanel state={state} />
        </CardContent>
      </Card>

      <details className="rounded-2xl border border-stone-800 bg-stone-950/80">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-left">
          <div>
            <div className="text-sm font-semibold text-stone-100">开发调试</div>
            <div className="mt-1 text-xs text-stone-400">手动指定路径，或切回系统命令依赖。</div>
          </div>
          <ChevronDown className="h-4 w-4 text-stone-400" />
        </summary>
        <div className="grid gap-3 border-t border-stone-800 px-5 py-4">
          <Input
            value={manualPath}
            onChange={(event) => setManualPath(event.target.value)}
            placeholder="/absolute/path/to/clash-speedtest"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onSetBinaryPath(manualPath)}>
              指定路径
            </Button>
            <Button type="button" variant="outline" onClick={onSelectBinary}>
              从文件选择
              <FolderOpen className="ml-2 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                setManualPath("");
                await onResetBinaryPath();
              }}
            >
              切回系统命令
              <RotateCcw className="ml-2 h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" onClick={() => setManualPath("")}>
              清空输入
              <X className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </details>
    </section>
  );
}
