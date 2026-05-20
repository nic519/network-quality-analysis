# Clash Observation Design

## Goal

Add an independent Clash/Mihomo observation module that collects enough historical runtime data for review, follow-up, and later correlation with latency test results. The module must run on a timer, stay separate from the existing manual `clash-speedtest` flow, and expose observation context to the analysis layer.

## User Intent

The user does not need a real-time monitoring dashboard. The priority is to accumulate useful historical evidence so they can answer questions after the fact:

- Which nodes became worse over time?
- Did a latency test failure happen near Clash warning or error events?
- Did proxy group selection, rules, or node availability change before quality dropped?
- Did a node's exit IP, ASN, or observed route context drift over time?

## Chosen Approach

Use a dual-track observation pipeline:

1. Periodic snapshots capture structured Clash runtime state.
2. Log events capture warning/error context for later diagnosis.

This avoids coupling observation to manual latency tests while still allowing the analysis layer to join the two datasets by time, node identity, group, rule, or region.

## Non-Goals

- No real-time traffic dashboard in the first version.
- No dependency on an always-open analysis view.
- No changes to `runLatencyTest` or the `clash-speedtest` command flow.
- No packet capture, MITM inspection, or content logging.
- No attempt to clone Neko Master's full multi-gateway traffic analytics platform.

## Architecture

```
Electrobun host
  -> Observation scheduler
     -> Clash controller client
        -> /configs
        -> /proxies
        -> /rules
        -> /connections
        -> /logs
     -> SQLite observation tables

Analysis view
  -> Existing latency run/results tables
  -> Observation query helpers
  -> Correlated review context
```

The observation scheduler starts with the Bun host and runs independently from user-triggered test runs. It records both successful and failed collection attempts so gaps in history are visible.

## Controller Configuration

Add a diagnostics/settings section for local Clash/Mihomo controller access:

- Controller URL, default `http://127.0.0.1:9090`
- Optional secret/token
- Enabled toggle
- Collection interval, default 5 minutes
- Log level filter, default `warning,error`

Configuration is persisted in the app support directory next to the existing site, probe, and binary path settings.

## Data Collection

### Observation Runs

Every scheduled collection creates one observation run with:

- run ID
- started/completed timestamps
- status: `completed` or `failed`
- controller URL
- error message when collection fails

This gives the user an audit trail and makes missing data explicit.

### Config Snapshot

Fetch `/configs` and store a small normalized summary:

- ports that affect traffic routing, such as `port`, `socks-port`, `mixed-port`, and `redir-port`
- mode, log level, IPv6, LAN access, and other stable controller-provided flags when present

The first version should avoid storing large config files or subscription content.

### Proxy And Group Snapshot

Fetch `/proxies` and store:

- proxy/group name
- type
- current selected node for selector groups
- child proxy names for groups
- delay/history values when provided
- alive/availability fields when provided

This is the main source for tracking long-term group selection and node availability changes.

### Rule Snapshot

Fetch `/rules` and store a compact digest:

- total rule count
- rule type/payload/proxy mapping when available
- a content hash for change detection

The first UI can show rule changes as context instead of rendering every rule in detail.

### Connection Sample

Fetch `/connections` as a periodic sample, not as a real-time stream. Store aggregated rows rather than every connection detail:

- sample timestamp
- active connection count
- domain or sniffed host
- destination IP
- source IP if present
- rule and rule payload
- chain/proxy path
- upload/download counters at sample time

This provides historical context about real traffic without turning the app into a live monitor.

### Log Events

Connect to `/logs` during each observation window or use the controller's supported streaming mode for a short bounded capture. Store warning/error entries with lightweight classification:

- timestamp
- level
- message
- event type: `dns`, `timeout`, `tls`, `eof`, `proxy`, `rule`, `provider`, `config`, `unknown`
- extracted proxy, domain, or rule when the message format makes that reliable

Raw log messages are useful for review, but classification makes trend analysis possible.

## Storage Model

Add new tables without modifying the existing latency tables:

```sql
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
  mode TEXT,
  log_level TEXT,
  mixed_port TEXT,
  http_port TEXT,
  socks_port TEXT,
  ipv6 TEXT,
  allow_lan TEXT,
  config_hash TEXT,
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
```

Indexes should cover:

- observation run time
- proxy name over time
- log event type and event time
- connection domain and chain

## Analysis Integration

The first correlation layer should be query-only. It does not change how latency results are written.

For any selected latency run:

- find observation runs within a configurable time window, default ±15 minutes
- show nearby warning/error event counts
- show proxy group selections at that time
- show matching proxy/node observations by `proxyName` first, and by future `proxyId` mapping when available
- show whether config/rule hashes changed near the run

For long-term review:

- aggregate node delay/history values by day
- aggregate log event counts by node, event type, and day
- aggregate proxy group selected-node history by day
- surface "changed near quality drop" context rather than trying to assign causality automatically

## UI Direction

Add a new observation area under tools or analysis, with a review-first layout:

- Scheduler status: enabled, interval, last run, last error
- Controller settings form
- Observation history list grouped by day
- Event timeline with level and type filters
- Node follow-up view for a selected proxy name
- Correlation panel on the existing analysis page for the selected latency run

The interface should favor dense, searchable tables and timelines over live charts.

## Error Handling

- Controller unreachable: save a failed observation run with the connection error.
- Unauthorized: save failed run and show a clear controller secret message.
- Endpoint unsupported: collect the remaining endpoints and mark the missing endpoint in the run error summary.
- Malformed payload: skip that endpoint, keep the rest of the observation, and store a parse error message.
- Log stream timeout: treat as a bounded empty log window, not as a failed observation if other endpoints succeeded.

## Privacy And Retention

Because connection samples and logs can include domains and local source IPs, retention needs to be explicit:

- default retention: 30 days
- configurable retention in settings
- delete old observation rows on app startup and after successful observation runs
- no request body capture
- no full Clash config or subscription text storage in the first version

## Testing

Backend tests:

- normalize `/proxies` payloads with groups, leaf proxies, missing fields, and delay histories
- normalize `/connections` samples with host, sniffHost, chains, rules, and empty metadata
- classify log messages into event types
- persist and query observation runs with partial endpoint failure
- retention cleanup deletes child rows through cascading relationships

Frontend tests:

- settings form renders saved controller configuration
- observation status renders last success and failure states
- event timeline filters by level and event type
- analysis correlation panel renders empty, partial, and populated context states

## Acceptance Criteria

- Observation runs on a timer without invoking or blocking manual latency tests.
- The app records successful and failed observation attempts in SQLite.
- Proxy/group snapshots, connection samples, rule summaries, and warning/error log events are stored separately from latency results.
- A selected latency run can show nearby observation context without changing the existing test result schema.
- Retention cleanup prevents unbounded database growth.
- The first version provides reviewable history, not a real-time monitoring dashboard.
