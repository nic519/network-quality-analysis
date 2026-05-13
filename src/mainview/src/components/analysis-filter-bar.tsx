import { Search } from "lucide-react";
import { Input } from "./ui/input";

export function AnalysisFilterBar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  search,
  onSearchChange,
  error,
}: {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  error: string | null;
}) {
  return (
    <div className="shrink-0 border-b border-border px-5 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">开始日期</span>
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => onFromDateChange(event.target.value)}
            className="h-8 w-[132px] rounded-none border-0 border-b border-input bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">结束日期</span>
          <Input
            type="date"
            value={toDate}
            onChange={(event) => onToDateChange(event.target.value)}
            className="h-8 w-[132px] rounded-none border-0 border-b border-input bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
          />
        </label>
        <label className="relative min-w-[220px] max-w-[320px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索节点名称"
            className="pl-9"
          />
        </label>
      </div>
      {error ? <div className="mt-2 text-sm text-destructive">{error}</div> : null}
    </div>
  );
}
