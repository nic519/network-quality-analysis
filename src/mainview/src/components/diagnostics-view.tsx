import { ArrowRight, Download, FolderOpen } from "lucide-react";
import { ClashSpeedtestDiagnosticsPanel } from "./clash-speedtest-status";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import type { AppState } from "../../../shared/rpc";

export function DiagnosticsView({
  state,
  onOpenRunView,
  onSelectBinary,
  onOpenReleasePage,
}: {
  state: AppState["clashSpeedtest"];
  onOpenRunView: () => void;
  onSelectBinary: () => void;
  onOpenReleasePage: () => void;
}) {
  return (
    <section className="mx-auto max-w-7xl px-8 pb-10">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <ClashSpeedtestDiagnosticsPanel state={state} />

        <Card className="border-stone-800 bg-stone-950/80">
          <CardHeader>
            <CardTitle className="text-2xl">补救方式</CardTitle>
            <CardDescription className="mt-2">如果 GitHub 检查失败，最直接的做法是手动下载官方二进制，然后在这里导入。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-2xl border border-stone-800 bg-black/20 p-4">
              <div className="text-sm font-semibold text-stone-100">官方下载地址</div>
              <div className="mt-3 space-y-2 text-sm text-stone-300">
                <div>Apple Silicon: GitHub release 中的 `clash-speedtest_Darwin_arm64.tar.gz`</div>
                <div>Intel Mac: GitHub release 中的 `clash-speedtest_Darwin_x86_64.tar.gz`</div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-800 bg-black/20 p-4">
              <div className="text-sm font-semibold text-stone-100">导入步骤</div>
              <div className="mt-3 space-y-2 text-sm leading-7 text-stone-300">
                <div>1. 下载并解压官方压缩包。</div>
                <div>2. 选择其中的 `clash-speedtest` 可执行文件。</div>
                <div>3. 点击下面的“选择本地 clash-speedtest”。</div>
              </div>
            </div>

            <Button type="button" onClick={onSelectBinary} className="justify-between">
              选择本地 clash-speedtest
              <FolderOpen className="h-4 w-4" />
            </Button>

            <Button type="button" variant="outline" className="justify-between" onClick={onOpenReleasePage}>
              打开官方发布页
              <Download className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
