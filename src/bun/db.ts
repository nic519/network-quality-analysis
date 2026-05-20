import { Database } from "bun:sqlite";
import type {
  ClashConfigSnapshot,
  ClashConnectionSample,
  ClashLogEvent,
  ClashObservationBundle,
  ClashObservationDetail,
  ClashObservationSummary,
  ClashProxySnapshot,
  ClashRuleSnapshot,
} from "../shared/clash-observation";
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

type ClashObservationSummaryRow = {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: "completed" | "failed";
  controller_url: string;
  error_message: string | null;
  proxy_count: number;
  connection_sample_count: number;
  log_event_count: number;
};

type ClashLogEventRow = {
  id: number;
  observation_id: string;
  event_time: string;
  level: ClashLogEvent["level"];
  event_type: ClashLogEvent["eventType"];
  message: string;
  proxy_name: string;
  domain: string;
  rule: string;
};

type ClashConfigSnapshotRow = {
  observation_id: string;
  mode: string;
  log_level: string;
  mixed_port: string;
  http_port: string;
  socks_port: string;
  ipv6: string;
  allow_lan: string;
  config_hash: string;
};

type ClashProxySnapshotRow = {
  observation_id: string;
  proxy_name: string;
  proxy_type: string;
  now_proxy: string;
  alive: string;
  delay_ms: number | null;
  history_json: string;
  children_json: string;
};

type ClashRuleSnapshotRow = {
  observation_id: string;
  rule_index: number;
  rule_type: string;
  payload: string;
  proxy: string;
};

type ClashConnectionSampleRow = {
  observation_id: string;
  domain: string;
  destination_ip: string;
  source_ip: string;
  rule: string;
  rule_payload: string;
  chain: string;
  connection_count: number;
  upload: number;
  download: number;
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

      CREATE TABLE IF NOT EXISTS clash_observation_runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        controller_url TEXT NOT NULL,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS clash_config_snapshots (
        observation_id TEXT NOT NULL REFERENCES clash_observation_runs(id) ON DELETE CASCADE,
        mode TEXT NOT NULL DEFAULT '',
        log_level TEXT NOT NULL DEFAULT '',
        mixed_port TEXT NOT NULL DEFAULT '',
        http_port TEXT NOT NULL DEFAULT '',
        socks_port TEXT NOT NULL DEFAULT '',
        ipv6 TEXT NOT NULL DEFAULT '',
        allow_lan TEXT NOT NULL DEFAULT '',
        config_hash TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (observation_id)
      );

      CREATE TABLE IF NOT EXISTS clash_proxy_snapshots (
        observation_id TEXT NOT NULL REFERENCES clash_observation_runs(id) ON DELETE CASCADE,
        proxy_name TEXT NOT NULL,
        proxy_type TEXT NOT NULL,
        now_proxy TEXT NOT NULL DEFAULT '',
        alive TEXT NOT NULL DEFAULT '',
        delay_ms INTEGER,
        history_json TEXT NOT NULL DEFAULT '[]',
        children_json TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (observation_id, proxy_name)
      );

      CREATE TABLE IF NOT EXISTS clash_rule_snapshots (
        observation_id TEXT NOT NULL REFERENCES clash_observation_runs(id) ON DELETE CASCADE,
        rule_index INTEGER NOT NULL,
        rule_type TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '',
        proxy TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (observation_id, rule_index)
      );

      CREATE TABLE IF NOT EXISTS clash_connection_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        observation_id TEXT NOT NULL REFERENCES clash_observation_runs(id) ON DELETE CASCADE,
        domain TEXT NOT NULL DEFAULT '',
        destination_ip TEXT NOT NULL DEFAULT '',
        source_ip TEXT NOT NULL DEFAULT '',
        rule TEXT NOT NULL DEFAULT '',
        rule_payload TEXT NOT NULL DEFAULT '',
        chain TEXT NOT NULL DEFAULT '',
        connection_count INTEGER NOT NULL DEFAULT 1,
        upload INTEGER NOT NULL DEFAULT 0,
        download INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS clash_log_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        observation_id TEXT NOT NULL REFERENCES clash_observation_runs(id) ON DELETE CASCADE,
        event_time TEXT NOT NULL,
        level TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        proxy_name TEXT NOT NULL DEFAULT '',
        domain TEXT NOT NULL DEFAULT '',
        rule TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_clash_observation_runs_started_at ON clash_observation_runs(started_at);
      CREATE INDEX IF NOT EXISTS idx_clash_proxy_snapshots_proxy_name ON clash_proxy_snapshots(proxy_name, observation_id);
      CREATE INDEX IF NOT EXISTS idx_clash_connection_samples_domain ON clash_connection_samples(domain, chain);
      CREATE INDEX IF NOT EXISTS idx_clash_log_events_type_time ON clash_log_events(event_type, event_time);
      CREATE INDEX IF NOT EXISTS idx_clash_log_events_observation ON clash_log_events(observation_id);
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

  saveClashObservation(bundle: ClashObservationBundle) {
    const insertRun = this.db.query(`
      INSERT INTO clash_observation_runs (id, started_at, completed_at, status, controller_url, error_message)
      VALUES ($id, $startedAt, $completedAt, $status, $controllerUrl, $errorMessage)
      ON CONFLICT(id) DO UPDATE SET
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        status = excluded.status,
        controller_url = excluded.controller_url,
        error_message = excluded.error_message
    `);
    const insertConfig = this.db.query(`
      INSERT INTO clash_config_snapshots (
        observation_id, mode, log_level, mixed_port, http_port, socks_port, ipv6, allow_lan, config_hash
      )
      VALUES (
        $observationId, $mode, $logLevel, $mixedPort, $httpPort, $socksPort, $ipv6, $allowLan, $configHash
      )
      ON CONFLICT(observation_id) DO UPDATE SET
        mode = excluded.mode,
        log_level = excluded.log_level,
        mixed_port = excluded.mixed_port,
        http_port = excluded.http_port,
        socks_port = excluded.socks_port,
        ipv6 = excluded.ipv6,
        allow_lan = excluded.allow_lan,
        config_hash = excluded.config_hash
    `);
    const insertProxy = this.db.query(`
      INSERT INTO clash_proxy_snapshots (
        observation_id, proxy_name, proxy_type, now_proxy, alive, delay_ms, history_json, children_json
      )
      VALUES (
        $observationId, $proxyName, $proxyType, $nowProxy, $alive, $delayMs, $historyJson, $childrenJson
      )
    `);
    const insertRule = this.db.query(`
      INSERT INTO clash_rule_snapshots (observation_id, rule_index, rule_type, payload, proxy)
      VALUES ($observationId, $ruleIndex, $ruleType, $payload, $proxy)
    `);
    const insertConnection = this.db.query(`
      INSERT INTO clash_connection_samples (
        observation_id, domain, destination_ip, source_ip, rule, rule_payload, chain, connection_count, upload, download
      )
      VALUES (
        $observationId, $domain, $destinationIp, $sourceIp, $rule, $rulePayload, $chain, $connectionCount, $upload, $download
      )
    `);
    const insertLogEvent = this.db.query(`
      INSERT INTO clash_log_events (
        observation_id, event_time, level, event_type, message, proxy_name, domain, rule
      )
      VALUES (
        $observationId, $eventTime, $level, $eventType, $message, $proxyName, $domain, $rule
      )
    `);
    const clearChildRows = [
      this.db.query("DELETE FROM clash_config_snapshots WHERE observation_id = $observationId"),
      this.db.query("DELETE FROM clash_proxy_snapshots WHERE observation_id = $observationId"),
      this.db.query("DELETE FROM clash_rule_snapshots WHERE observation_id = $observationId"),
      this.db.query("DELETE FROM clash_connection_samples WHERE observation_id = $observationId"),
      this.db.query("DELETE FROM clash_log_events WHERE observation_id = $observationId"),
    ];

    const transaction = this.db.transaction((input: ClashObservationBundle) => {
      insertRun.run({
        $id: input.run.id,
        $startedAt: input.run.startedAt,
        $completedAt: input.run.completedAt,
        $status: input.run.status,
        $controllerUrl: input.run.controllerUrl,
        $errorMessage: input.run.errorMessage,
      });
      for (const statement of clearChildRows) {
        statement.run({ $observationId: input.run.id });
      }
      if (input.config) {
        insertConfig.run({
          $observationId: input.config.observationId,
          $mode: input.config.mode,
          $logLevel: input.config.logLevel,
          $mixedPort: input.config.mixedPort,
          $httpPort: input.config.httpPort,
          $socksPort: input.config.socksPort,
          $ipv6: input.config.ipv6,
          $allowLan: input.config.allowLan,
          $configHash: input.config.configHash,
        });
      }
      for (const row of input.proxies) {
        insertProxy.run({
          $observationId: row.observationId,
          $proxyName: row.proxyName,
          $proxyType: row.proxyType,
          $nowProxy: row.nowProxy,
          $alive: row.alive,
          $delayMs: row.delayMs,
          $historyJson: row.historyJson,
          $childrenJson: row.childrenJson,
        });
      }
      for (const row of input.rules) {
        insertRule.run({
          $observationId: row.observationId,
          $ruleIndex: row.ruleIndex,
          $ruleType: row.ruleType,
          $payload: row.payload,
          $proxy: row.proxy,
        });
      }
      for (const row of input.connections) {
        insertConnection.run({
          $observationId: row.observationId,
          $domain: row.domain,
          $destinationIp: row.destinationIp,
          $sourceIp: row.sourceIp,
          $rule: row.rule,
          $rulePayload: row.rulePayload,
          $chain: row.chain,
          $connectionCount: row.connectionCount,
          $upload: row.upload,
          $download: row.download,
        });
      }
      for (const event of input.logEvents) {
        insertLogEvent.run({
          $observationId: event.observationId,
          $eventTime: event.eventTime,
          $level: event.level,
          $eventType: event.eventType,
          $message: event.message,
          $proxyName: event.proxyName,
          $domain: event.domain,
          $rule: event.rule,
        });
      }
    });

    transaction(bundle);
  }

  listClashObservationSummaries(limit = 20): ClashObservationSummary[] {
    const rows = this.db
      .query<ClashObservationSummaryRow, { $limit: number }>(`
        SELECT
          runs.id,
          runs.started_at,
          runs.completed_at,
          runs.status,
          runs.controller_url,
          runs.error_message,
          COUNT(DISTINCT proxies.proxy_name) AS proxy_count,
          COUNT(DISTINCT connections.id) AS connection_sample_count,
          COUNT(DISTINCT events.id) AS log_event_count
        FROM clash_observation_runs runs
        LEFT JOIN clash_proxy_snapshots proxies ON proxies.observation_id = runs.id
        LEFT JOIN clash_connection_samples connections ON connections.observation_id = runs.id
        LEFT JOIN clash_log_events events ON events.observation_id = runs.id
        GROUP BY runs.id
        ORDER BY runs.started_at DESC
        LIMIT $limit
      `)
      .all({ $limit: limit });

    return rows.map((row) => ({
      id: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      controllerUrl: row.controller_url,
      errorMessage: row.error_message,
      proxyCount: row.proxy_count,
      connectionSampleCount: row.connection_sample_count,
      logEventCount: row.log_event_count,
    }));
  }

  listClashLogEvents(limit = 50): ClashLogEvent[] {
    const rows = this.db
      .query<ClashLogEventRow, { $limit: number }>(`
        SELECT id, observation_id, event_time, level, event_type, message, proxy_name, domain, rule
        FROM clash_log_events
        ORDER BY event_time DESC, id DESC
        LIMIT $limit
      `)
      .all({ $limit: limit });

    return rows.map((row) => ({
      id: row.id,
      observationId: row.observation_id,
      eventTime: row.event_time,
      level: row.level,
      eventType: row.event_type,
      message: row.message,
      proxyName: row.proxy_name,
      domain: row.domain,
      rule: row.rule,
    }));
  }

  getClashObservationDetail(observationId: string): ClashObservationDetail | null {
    const summary = this.listClashObservationSummaries(200).find((item) => item.id === observationId);
    if (!summary) return null;

    const configRow = this.db
      .query<ClashConfigSnapshotRow, { $observationId: string }>(`
        SELECT observation_id, mode, log_level, mixed_port, http_port, socks_port, ipv6, allow_lan, config_hash
        FROM clash_config_snapshots
        WHERE observation_id = $observationId
      `)
      .get({ $observationId: observationId });
    const proxyRows = this.db
      .query<ClashProxySnapshotRow, { $observationId: string }>(`
        SELECT observation_id, proxy_name, proxy_type, now_proxy, alive, delay_ms, history_json, children_json
        FROM clash_proxy_snapshots
        WHERE observation_id = $observationId
        ORDER BY proxy_name
      `)
      .all({ $observationId: observationId });
    const ruleRows = this.db
      .query<ClashRuleSnapshotRow, { $observationId: string }>(`
        SELECT observation_id, rule_index, rule_type, payload, proxy
        FROM clash_rule_snapshots
        WHERE observation_id = $observationId
        ORDER BY rule_index
      `)
      .all({ $observationId: observationId });
    const connectionRows = this.db
      .query<ClashConnectionSampleRow, { $observationId: string }>(`
        SELECT observation_id, domain, destination_ip, source_ip, rule, rule_payload, chain, connection_count, upload, download
        FROM clash_connection_samples
        WHERE observation_id = $observationId
        ORDER BY connection_count DESC, download DESC, upload DESC, domain
      `)
      .all({ $observationId: observationId });
    const logRows = this.db
      .query<ClashLogEventRow, { $observationId: string }>(`
        SELECT id, observation_id, event_time, level, event_type, message, proxy_name, domain, rule
        FROM clash_log_events
        WHERE observation_id = $observationId
        ORDER BY event_time DESC, id DESC
      `)
      .all({ $observationId: observationId });

    return {
      summary,
      config: configRow ? fromClashConfigSnapshotRow(configRow) : null,
      proxies: proxyRows.map(fromClashProxySnapshotRow),
      rules: ruleRows.map(fromClashRuleSnapshotRow),
      connections: connectionRows.map(fromClashConnectionSampleRow),
      logEvents: logRows.map(fromClashLogEventRow),
    };
  }

  pruneClashObservations(cutoffStartedAt: string) {
    const count = this.db
      .query<{ count: number }, { $cutoffStartedAt: string }>("SELECT COUNT(*) AS count FROM clash_observation_runs WHERE started_at < $cutoffStartedAt")
      .get({ $cutoffStartedAt: cutoffStartedAt })?.count ?? 0;
    this.db.query("DELETE FROM clash_observation_runs WHERE started_at < $cutoffStartedAt").run({
      $cutoffStartedAt: cutoffStartedAt,
    });
    return count;
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

function fromClashConfigSnapshotRow(row: ClashConfigSnapshotRow): ClashConfigSnapshot {
  return {
    observationId: row.observation_id,
    mode: row.mode,
    logLevel: row.log_level,
    mixedPort: row.mixed_port,
    httpPort: row.http_port,
    socksPort: row.socks_port,
    ipv6: row.ipv6,
    allowLan: row.allow_lan,
    configHash: row.config_hash,
  };
}

function fromClashProxySnapshotRow(row: ClashProxySnapshotRow): ClashProxySnapshot {
  return {
    observationId: row.observation_id,
    proxyName: row.proxy_name,
    proxyType: row.proxy_type,
    nowProxy: row.now_proxy,
    alive: row.alive,
    delayMs: row.delay_ms,
    historyJson: row.history_json,
    childrenJson: row.children_json,
  };
}

function fromClashRuleSnapshotRow(row: ClashRuleSnapshotRow): ClashRuleSnapshot {
  return {
    observationId: row.observation_id,
    ruleIndex: row.rule_index,
    ruleType: row.rule_type,
    payload: row.payload,
    proxy: row.proxy,
  };
}

function fromClashConnectionSampleRow(row: ClashConnectionSampleRow): ClashConnectionSample {
  return {
    observationId: row.observation_id,
    domain: row.domain,
    destinationIp: row.destination_ip,
    sourceIp: row.source_ip,
    rule: row.rule,
    rulePayload: row.rule_payload,
    chain: row.chain,
    connectionCount: row.connection_count,
    upload: row.upload,
    download: row.download,
  };
}

function fromClashLogEventRow(row: ClashLogEventRow): ClashLogEvent {
  return {
    id: row.id,
    observationId: row.observation_id,
    eventTime: row.event_time,
    level: row.level,
    eventType: row.event_type,
    message: row.message,
    proxyName: row.proxy_name,
    domain: row.domain,
    rule: row.rule,
  };
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
