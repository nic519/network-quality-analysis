import { HK, JP, SG, TW, US } from "country-flag-icons/react/3x2";
import type { ReactNode } from "react";
import type { RegionPreset } from "../../../shared/domain";
import { cn } from "../lib/utils";

type FlagCode = "HK" | "JP" | "SG" | "TW" | "US";

const FLAG_COMPONENTS: Record<FlagCode, (props: { className?: string; "aria-hidden"?: boolean }) => ReactNode> = {
  HK,
  JP,
  SG,
  TW,
  US,
};

const REGION_FLAG_CODES: Record<RegionPreset["id"], FlagCode> = {
  "hong-kong": "HK",
  singapore: "SG",
  japan: "JP",
  "united-states": "US",
  taiwan: "TW",
};

export function getRegionFlagCode(regionId: RegionPreset["id"] | string | null | undefined): FlagCode | null {
  if (!regionId) return null;
  return regionId in REGION_FLAG_CODES ? REGION_FLAG_CODES[regionId as RegionPreset["id"]] : null;
}

export function normalizeFlagCode(code: string | null | undefined): FlagCode | null {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;
  return normalized in FLAG_COMPONENTS ? (normalized as FlagCode) : null;
}

export function CountryFlag({
  code,
  label,
  className,
  markerName,
}: {
  code: string | null | undefined;
  label: string;
  className?: string;
  markerName?: string;
}) {
  const normalized = normalizeFlagCode(code);
  if (!normalized) return null;

  const Flag = FLAG_COMPONENTS[normalized];
  const marker = markerName ? { [markerName]: normalized } : {};

  return (
    <span
      {...marker}
      title={label}
      className={cn("inline-flex h-4 w-5 shrink-0 overflow-hidden rounded-[2px] border border-border/70 shadow-sm", className)}
    >
      <Flag aria-hidden className="h-full w-full" />
    </span>
  );
}
