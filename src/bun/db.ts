import { Database } from "bun:sqlite";
import { latencyToMs, type HistoryFilters, type ResultRow, type RunRecord } from "../shared/domain";
import type { ConfigHistoryItem, ProxyHistoryStat } from "../shared/rpc";

type RunRow = {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: RunRecord["status"];
  selected_regions: string;
  error_message: string | null;
};

type ResultDbRow = {
  run_id: string;
  region_id: string;
  region_label: string;
  site_id: string;
  site_name: string;
  site_url: string;
  sequence: string;
  proxy_id: string;
  proxy_name: string;
  proxy_type: string;
  latency: string;
  jitter: string;
  packet_loss: string;
  download_speed: string;
  upload_speed: string;
  probe_url: string | null;
  probe_latency: string | null;
  probe_status: string | null;
  probe_error: string | null;
  probe_ip: string | null;
  probe_country: string | null;
  probe_country_code: string | null;
  probe_region: string | null;
  probe_city: string | null;
  probe_asn: string | null;
  probe_org: string | null;
};

type ConfigHistoryRow = {
  path: string;
  last_used_at: string;
  use_count: number;
};

type ProxyHistoryStatRow = {
  proxy_id: string;
  site_name: string;
  latency: string;
};

export class LatencyDatabase {
  private readonly db: Database;

  constructor(path = ":memory:") {
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA foreign_keys = ON");
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        selected_regions TEXT NOT NULL,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        region_id TEXT NOT NULL,
        region_label TEXT NOT NULL,
        site_id TEXT NOT NULL,
        site_name TEXT NOT NULL,
        site_url TEXT NOT NULL,
        sequence TEXT NOT NULL,
        proxy_id TEXT NOT NULL DEFAULT '',
        proxy_name TEXT NOT NULL,
        proxy_type TEXT NOT NULL,
        latency TEXT NOT NULL,
        jitter TEXT NOT NULL,
        packet_loss TEXT NOT NULL,
        download_speed TEXT NOT NULL,
        upload_speed TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS probe_results (
        proxy_id TEXT PRIMARY KEY,
        probe_url TEXT NOT NULL DEFAULT '',
        probe_latency TEXT NOT NULL DEFAULT '',
        probe_status TEXT NOT NULL DEFAULT '',
        probe_error TEXT NOT NULL DEFAULT '',
        probe_ip TEXT NOT NULL DEFAULT '',
        probe_country TEXT NOT NULL DEFAULT '',
        probe_country_code TEXT NOT NULL DEFAULT '',
        probe_region TEXT NOT NULL DEFAULT '',
        probe_city TEXT NOT NULL DEFAULT '',
        probe_asn TEXT NOT NULL DEFAULT '',
        probe_org TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_results_run ON results(run_id);
      CREATE INDEX IF NOT EXISTS idx_results_region ON results(region_id);
      CREATE INDEX IF NOT EXISTS idx_results_proxy_id ON results(proxy_id);
      CREATE INDEX IF NOT EXISTS idx_probe_results_probe_ip ON probe_results(probe_ip);
      CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);

      CREATE TABLE IF NOT EXISTS config_history (
        path TEXT PRIMARY KEY,
        last_used_at TEXT NOT NULL,
        use_count INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_config_history_last_used_at ON config_history(last_used_at);
    `);
    this.addColumnIfMissing("results", "proxy_id", "TEXT NOT NULL DEFAULT ''");
    this.backfillProbeResultsFromLegacyColumns();
    this.removeLegacyProbeColumnsFromResults();
    this.ensureResultIndexes();
  }

  close() {
    this.db.close();
  }

  saveRun(run: RunRecord) {
    this.db
      .query(`
        INSERT INTO runs (id, started_at, completed_at, status, selected_regions, error_message)
        VALUES ($id, $startedAt, $completedAt, $status, $selectedRegions, $errorMessage)
        ON CONFLICT(id) DO UPDATE SET
          completed_at = excluded.completed_at,
          status = excluded.status,
          selected_regions = excluded.selected_regions,
          error_message = excluded.error_message
      `)
      .run({
        $id: run.id,
        $startedAt: run.startedAt,
        $completedAt: run.completedAt,
        $status: run.status,
        $selectedRegions: JSON.stringify(run.selectedRegions),
        $errorMessage: run.errorMessage,
      });
  }

  saveResults(rows: ResultRow[]) {
    const insert = this.db.query(`
      INSERT INTO results (
        run_id,
        region_id,
        region_label,
        site_id,
        site_name,
        site_url,
        sequence,
        proxy_id,
        proxy_name,
        proxy_type,
        latency,
        jitter,
        packet_loss,
        download_speed,
        upload_speed
      )
      VALUES (
        $runId,
        $regionId,
        $regionLabel,
        $siteId,
        $siteName,
        $siteUrl,
        $sequence,
        $proxyId,
        $proxyName,
        $proxyType,
        $latency,
        $jitter,
        $packetLoss,
        $downloadSpeed,
        $uploadSpeed
      )
    `);

    const upsertProbe = this.db.query(`
      INSERT INTO probe_results (
        proxy_id,
        probe_url,
        probe_latency,
        probe_status,
        probe_error,
        probe_ip,
        probe_country,
        probe_country_code,
        probe_region,
        probe_city,
        probe_asn,
        probe_org,
        updated_at
      )
      VALUES (
        $proxyId,
        $probeUrl,
        $probeLatency,
        $probeStatus,
        $probeError,
        $probeIp,
        $probeCountry,
        $probeCountryCode,
        $probeRegion,
        $probeCity,
        $probeAsn,
        $probeOrg,
        $updatedAt
      )
      ON CONFLICT(proxy_id) DO UPDATE SET
        probe_url = excluded.probe_url,
        probe_latency = excluded.probe_latency,
        probe_status = excluded.probe_status,
        probe_error = excluded.probe_error,
        probe_ip = excluded.probe_ip,
        probe_country = excluded.probe_country,
        probe_country_code = excluded.probe_country_code,
        probe_region = excluded.probe_region,
        probe_city = excluded.probe_city,
        probe_asn = excluded.probe_asn,
        probe_org = excluded.probe_org,
        updated_at = excluded.updated_at
    `);

    const transaction = this.db.transaction((items: ResultRow[]) => {
      for (const row of items) {
        insert.run({
          $runId: row.runId,
          $regionId: row.regionId,
          $regionLabel: row.regionLabel,
          $siteId: row.siteId,
          $siteName: row.siteName,
          $siteUrl: row.siteUrl,
          $sequence: row.sequence,
          $proxyId: row.proxyId,
          $proxyName: row.proxyName,
          $proxyType: row.proxyType,
          $latency: row.latency,
          $jitter: row.jitter,
          $packetLoss: row.packetLoss,
          $downloadSpeed: row.downloadSpeed,
          $uploadSpeed: row.uploadSpeed,
        });
        if (!row.proxyId || !hasProbeEvidence(row)) continue;
        upsertProbe.run({
          $proxyId: row.proxyId,
          $probeUrl: row.probeUrl ?? "",
          $probeLatency: row.probeLatency ?? "",
          $probeStatus: row.probeStatus ?? "",
          $probeError: row.probeError ?? "",
          $probeIp: row.probeIp ?? "",
          $probeCountry: row.probeCountry ?? "",
          $probeCountryCode: row.probeCountryCode ?? "",
          $probeRegion: row.probeRegion ?? "",
          $probeCity: row.probeCity ?? "",
          $probeAsn: row.probeAsn ?? "",
          $probeOrg: row.probeOrg ?? "",
          $updatedAt: new Date().toISOString(),
        });
      }
    });

    transaction(rows);
  }

  listCachedProbeProxyIds(): string[] {
    // 这里只返回已有出口 IP 的 proxyId。proxyId 是节点连接身份缓存键，
    // 后续 probe 前会据此把已探测节点排除，而不是依赖节点名。
    const rows = this.db
      .query<{ proxy_id: string }, []>(`
        SELECT proxy_id
        FROM probe_results
        WHERE probe_ip <> ''
        ORDER BY proxy_id
      `)
      .all();
    return rows.map((row) => row.proxy_id);
  }

  listResultColumnNames(): string[] {
    return this.db.query<{ name: string }, []>("PRAGMA table_info(results)").all().map((column) => column.name);
  }

  saveConfigHistory(path: string, lastUsedAt = new Date().toISOString()) {
    const normalizedPath = path.trim();
    if (!normalizedPath) return;

    this.db
      .query(`
        INSERT INTO config_history (path, last_used_at, use_count)
        VALUES ($path, $lastUsedAt, 1)
        ON CONFLICT(path) DO UPDATE SET
          last_used_at = excluded.last_used_at,
          use_count = config_history.use_count + 1
      `)
      .run({
        $path: normalizedPath,
        $lastUsedAt: lastUsedAt,
      });
  }

  listConfigHistory(limit = 6): ConfigHistoryItem[] {
    const rows = this.db
      .query<ConfigHistoryRow, { $limit: number }>(`
        SELECT path, last_used_at, use_count
        FROM config_history
        ORDER BY last_used_at DESC
        LIMIT $limit
      `)
      .all({ $limit: limit });

    return rows.map((row) => ({
      path: row.path,
      lastUsedAt: row.last_used_at,
      useCount: row.use_count,
    }));
  }

  deleteRun(runId: string) {
    const proxyRows = this.db
      .query<{ proxy_id: string }, { $runId: string }>(`
        SELECT DISTINCT proxy_id
        FROM results
        WHERE run_id = $runId
          AND proxy_id <> ''
      `)
      .all({ $runId: runId });
    const proxyIds = proxyRows.map((row) => row.proxy_id);
    const deleteRun = this.db.query("DELETE FROM runs WHERE id = $runId");
    const deleteOrphanProbe = this.db.query(`
      DELETE FROM probe_results
      WHERE proxy_id = $proxyId
        AND NOT EXISTS (
          SELECT 1
          FROM results
          WHERE results.proxy_id = probe_results.proxy_id
        )
    `);

    const transaction = this.db.transaction(() => {
      const result = deleteRun.run({ $runId: runId });
      for (const proxyId of proxyIds) {
        deleteOrphanProbe.run({ $proxyId: proxyId });
      }
      return result.changes > 0;
    });

    return transaction();
  }

  listRuns(): RunRecord[] {
    const rows = this.db
      .query<RunRow, []>("SELECT * FROM runs ORDER BY started_at DESC")
      .all();
    return rows.map((row) => ({
      id: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      selectedRegions: JSON.parse(row.selected_regions) as string[],
      errorMessage: row.error_message,
    }));
  }

  queryResults(filters: HistoryFilters = {}): ResultRow[] {
    const clauses: string[] = [];
    const params: Record<string, string> = {};

    if (filters.runId) {
      clauses.push("results.run_id = $runId");
      params.$runId = filters.runId;
    }

    if (filters.regionIds?.length) {
      const placeholders = filters.regionIds.map((_, index) => `$region${index}`);
      clauses.push(`results.region_id IN (${placeholders.join(", ")})`);
      filters.regionIds.forEach((regionId, index) => {
        params[`$region${index}`] = regionId;
      });
    }

    if (filters.fromDate) {
      clauses.push("runs.started_at >= $fromDate");
      params.$fromDate = filters.fromDate;
    }

    if (filters.toDate) {
      clauses.push("runs.started_at <= $toDate");
      params.$toDate = filters.toDate;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .query<ResultDbRow, Record<string, string>>(`
        SELECT
          results.run_id,
          results.region_id,
          results.region_label,
          results.site_id,
          results.site_name,
          results.site_url,
          results.sequence,
          results.proxy_id,
          results.proxy_name,
          results.proxy_type,
          results.latency,
          results.jitter,
          results.packet_loss,
          results.download_speed,
          results.upload_speed,
          probe_results.probe_url,
          probe_results.probe_latency,
          probe_results.probe_status,
          probe_results.probe_error,
          probe_results.probe_ip,
          probe_results.probe_country,
          probe_results.probe_country_code,
          probe_results.probe_region,
          probe_results.probe_city,
          probe_results.probe_asn,
          probe_results.probe_org
        FROM results
        JOIN runs ON runs.id = results.run_id
        LEFT JOIN probe_results ON probe_results.proxy_id = results.proxy_id
        ${where}
        ORDER BY runs.started_at DESC, results.region_id, results.site_id, CAST(REPLACE(results.sequence, '.', '') AS INTEGER)
      `)
      .all(params);

    return rows.map(fromDbRow);
  }

  queryProxyHistoryStats(proxyIds: string[]): Record<string, ProxyHistoryStat> {
    const normalizedProxyIds = [...new Set(proxyIds.map((proxyId) => proxyId.trim()).filter(Boolean))];
    if (!normalizedProxyIds.length) return {};

    const placeholders = normalizedProxyIds.map((_, index) => `$proxyId${index}`);
    const params = Object.fromEntries(normalizedProxyIds.map((proxyId, index) => [`$proxyId${index}`, proxyId]));
    const rows = this.db
      .query<ProxyHistoryStatRow, Record<string, string>>(`
        SELECT proxy_id, site_name, latency
        FROM results
        WHERE proxy_id IN (${placeholders.join(", ")})
      `)
      .all(params);

    const stats: Record<string, ProxyHistoryStat> = {};
    const siteStats = new Map<string, Map<string, { totalCount: number; failedCount: number }>>();
    for (const row of rows) {
      const current = stats[row.proxy_id] ?? { totalCount: 0, failedCount: 0 };
      current.totalCount += 1;
      if (latencyToMs(row.latency) === null) {
        current.failedCount += 1;
      }
      stats[row.proxy_id] = current;

      const sitesForProxy = siteStats.get(row.proxy_id) ?? new Map<string, { totalCount: number; failedCount: number }>();
      const currentSite = sitesForProxy.get(row.site_name) ?? { totalCount: 0, failedCount: 0 };
      currentSite.totalCount += 1;
      if (latencyToMs(row.latency) === null) {
        currentSite.failedCount += 1;
      }
      sitesForProxy.set(row.site_name, currentSite);
      siteStats.set(row.proxy_id, sitesForProxy);
    }

    for (const [proxyId, sitesForProxy] of siteStats) {
      stats[proxyId].siteStats = [...sitesForProxy.entries()]
        .map(([siteName, siteStat]) => ({
          siteName,
          totalCount: siteStat.totalCount,
          failedCount: siteStat.failedCount,
        }))
        .sort((left, right) => left.siteName.localeCompare(right.siteName, "zh-CN"));
    }

    return stats;
  }

  private addColumnIfMissing(tableName: string, columnName: string, definition: string) {
    const columns = this.db.query<{ name: string }, []>(`PRAGMA table_info(${tableName})`).all();
    if (columns.some((column) => column.name === columnName)) return;
    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }

  private backfillProbeResultsFromLegacyColumns() {
    const columns = this.listResultColumnNames();
    if (!columns.includes("probe_ip")) return;

    this.db.exec(`
      INSERT INTO probe_results (
        proxy_id,
        probe_url,
        probe_latency,
        probe_status,
        probe_error,
        probe_ip,
        probe_country,
        probe_country_code,
        probe_region,
        probe_city,
        probe_asn,
        probe_org,
        updated_at
      )
      SELECT
        proxy_id,
        probe_url,
        probe_latency,
        probe_status,
        probe_error,
        probe_ip,
        probe_country,
        probe_country_code,
        probe_region,
        probe_city,
        probe_asn,
        probe_org,
        CURRENT_TIMESTAMP
      FROM results
      WHERE proxy_id <> ''
        AND (probe_ip <> '' OR probe_status <> '' OR probe_error <> '')
      ON CONFLICT(proxy_id) DO NOTHING
    `);
  }

  private removeLegacyProbeColumnsFromResults() {
    const columns = this.listResultColumnNames();
    if (!columns.includes("probe_ip")) return;

    this.db.exec(`
      CREATE TABLE results_without_probe_columns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        region_id TEXT NOT NULL,
        region_label TEXT NOT NULL,
        site_id TEXT NOT NULL,
        site_name TEXT NOT NULL,
        site_url TEXT NOT NULL,
        sequence TEXT NOT NULL,
        proxy_id TEXT NOT NULL DEFAULT '',
        proxy_name TEXT NOT NULL,
        proxy_type TEXT NOT NULL,
        latency TEXT NOT NULL,
        jitter TEXT NOT NULL,
        packet_loss TEXT NOT NULL,
        download_speed TEXT NOT NULL,
        upload_speed TEXT NOT NULL
      );

      INSERT INTO results_without_probe_columns (
        id,
        run_id,
        region_id,
        region_label,
        site_id,
        site_name,
        site_url,
        sequence,
        proxy_id,
        proxy_name,
        proxy_type,
        latency,
        jitter,
        packet_loss,
        download_speed,
        upload_speed
      )
      SELECT
        id,
        run_id,
        region_id,
        region_label,
        site_id,
        site_name,
        site_url,
        sequence,
        proxy_id,
        proxy_name,
        proxy_type,
        latency,
        jitter,
        packet_loss,
        download_speed,
        upload_speed
      FROM results;

      DROP TABLE results;
      ALTER TABLE results_without_probe_columns RENAME TO results;
    `);
  }

  private ensureResultIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_results_run ON results(run_id);
      CREATE INDEX IF NOT EXISTS idx_results_region ON results(region_id);
      CREATE INDEX IF NOT EXISTS idx_results_proxy_id ON results(proxy_id);
    `);
  }
}

function hasProbeEvidence(row: ResultRow) {
  return Boolean(row.probeIp || row.probeStatus || row.probeError);
}

function fromDbRow(row: ResultDbRow): ResultRow {
  return {
    runId: row.run_id,
    regionId: row.region_id as ResultRow["regionId"],
    regionLabel: row.region_label,
    siteId: row.site_id,
    siteName: row.site_name,
    siteUrl: row.site_url,
    sequence: row.sequence,
    proxyName: row.proxy_name,
    proxyId: row.proxy_id,
    proxyType: row.proxy_type,
    latency: row.latency,
    jitter: row.jitter,
    packetLoss: row.packet_loss,
    downloadSpeed: row.download_speed,
    uploadSpeed: row.upload_speed,
    probeUrl: row.probe_url ?? "",
    probeLatency: row.probe_latency ?? "",
    probeStatus: row.probe_status ?? "",
    probeError: row.probe_error ?? "",
    probeIp: row.probe_ip ?? "",
    probeCountry: row.probe_country ?? "",
    probeCountryCode: row.probe_country_code ?? "",
    probeRegion: row.probe_region ?? "",
    probeCity: row.probe_city ?? "",
    probeAsn: row.probe_asn ?? "",
    probeOrg: row.probe_org ?? "",
  };
}
