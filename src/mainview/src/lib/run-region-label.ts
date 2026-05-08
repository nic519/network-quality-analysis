import type { RegionPreset, ResultRow, RunRecord } from "../../../shared/domain";

export function formatRunRegionLabels({
  run,
  results,
  regions,
}: {
  run: RunRecord;
  results: ResultRow[];
  regions: RegionPreset[];
}) {
  const resultLabels = Array.from(new Set(results.filter((item) => item.runId === run.id).map((item) => item.regionLabel)));
  if (resultLabels.length) return resultLabels.join(" / ");

  const labelsById = new Map(regions.map((region) => [region.id, region.label]));
  return run.selectedRegions.map((regionId) => labelsById.get(regionId as RegionPreset["id"]) ?? regionId).join(" / ");
}
