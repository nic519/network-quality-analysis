import { Database } from "bun:sqlite";
import type { HistoryFilters, ResultRow, RunRecord } from "../shared/domain";
import type { ConfigHistoryItem } from "../shared/rpc";

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
};

type ConfigHistoryRow = {
  path: string;
  last_used_at: string;
  use_count: number;
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

      CREATE INDEX IF NOT EXISTS idx_results_run ON results(run_id);
      CREATE INDEX IF NOT EXISTS idx_results_region ON results(region_id);
      CREATE INDEX IF NOT EXISTS idx_results_proxy_id ON results(proxy_id);
      CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);

      CREATE TABLE IF NOT EXISTS config_history (
        path TEXT PRIMARY KEY,
        last_used_at TEXT NOT NULL,
        use_count INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_config_history_last_used_at ON config_history(last_used_at);
    `);
    this.addColumnIfMissing("results", "proxy_id", "TEXT NOT NULL DEFAULT ''");
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
      }
    });

    transaction(rows);
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
        SELECT results.*
        FROM results
        JOIN runs ON runs.id = results.run_id
        ${where}
        ORDER BY runs.started_at DESC, results.region_id, results.site_id, CAST(REPLACE(results.sequence, '.', '') AS INTEGER)
      `)
      .all(params);

    return rows.map(fromDbRow);
  }

  private addColumnIfMissing(tableName: string, columnName: string, definition: string) {
    const columns = this.db.query<{ name: string }, []>(`PRAGMA table_info(${tableName})`).all();
    if (columns.some((column) => column.name === columnName)) return;
    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
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
  };
}
