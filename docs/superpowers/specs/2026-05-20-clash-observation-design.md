# Clash 观测模块设计

## 目标

新增一个独立的 Clash/Mihomo 观测模块，用于定时采集足够多的运行时历史数据，支持后续复盘、跟进和与延迟测速结果关联分析。该模块必须按时间间隔自动运行，与现有手动 `clash-speedtest` 流程保持解耦，并把观测上下文提供给分析层使用。

## 用户意图

用户不需要实时监控面板。核心诉求是积累可追溯的历史证据，以便事后回答这些问题：

- 哪些节点在一段时间后逐渐变差？
- 某次测速失败附近，Clash 是否出现过 warning 或 error 事件？
- 代理组选择、规则或节点可用性是否在质量下降前发生变化？
- 节点出口 IP、ASN 或观测到的路由上下文是否出现漂移？

## 方案选择

采用双轨观测管线：

1. 定期快照采集结构化的 Clash 运行状态。
2. 日志事件采集 warning 和 error 上下文，用于后续诊断。

这种方式不把观测绑定到手动测速流程，同时允许分析层按时间、节点身份、代理组、规则或地区把两类数据关联起来。

## 非目标

- 第一版不做实时流量监控面板。
- 不依赖用户一直打开某个分析页面。
- 不改动 `runLatencyTest` 或 `clash-speedtest` 命令执行流程。
- 不做抓包、MITM 检查或请求内容记录。
- 不试图复制 Neko Master 的完整多网关流量分析平台。

## 架构

```text
Electrobun host
  -> 观测调度器
     -> Clash controller client
        -> /configs
        -> /proxies
        -> /rules
        -> /connections
        -> /logs
     -> SQLite 观测表

分析视图
  -> 现有 latency run/results 表
  -> 观测查询 helper
  -> 关联后的复盘上下文
```

观测调度器随 Bun host 启动，并独立于用户触发的测速任务运行。每次采集无论成功还是失败都要记录，确保历史数据缺口可见。

## Controller 配置

在工具设置或诊断设置中新增本地 Clash/Mihomo controller 配置：

- Controller URL，默认 `http://127.0.0.1:9090`
- 可选 secret/token
- 启用开关
- 采集间隔，默认 5 分钟
- 日志级别过滤，默认 `warning,error`

配置持久化到应用支持目录，位置与现有站点配置、Probe 配置和二进制路径配置保持一致。

## 数据采集

### 观测任务

每次定时采集创建一条观测任务记录，包含：

- run ID
- started/completed 时间戳
- 状态：`completed` 或 `failed`
- controller URL
- 采集失败时的错误信息

这会形成一条审计轨迹，也能明确告诉用户哪些时间段没有采集到数据。

### 配置快照

请求 `/configs`，保存一份较小的规范化摘要：

- 影响流量路由的端口，例如 `port`、`socks-port`、`mixed-port`、`redir-port`
- mode、log level、IPv6、LAN 访问等 controller 返回的稳定字段

第一版不保存完整配置文件，也不保存订阅原文。

### 代理与代理组快照

请求 `/proxies`，保存：

- proxy 或 group 名称
- 类型
- selector group 当前选中的节点
- group 的子节点名称
- controller 返回的 delay/history 值
- controller 返回的 alive/availability 字段

这是长期追踪代理组选择和节点可用性变化的主要数据源。

### 规则快照

请求 `/rules`，保存紧凑摘要：

- 规则总数
- 可用时保存 rule type、payload、proxy 映射
- 用 content hash 做变化检测

第一版 UI 可以把规则变化作为上下文展示，不需要完整渲染每一条规则。

### 连接采样

定时请求 `/connections`，作为周期性采样处理，而不是实时流。保存聚合行，不保存每条连接的完整细节：

- 采样时间
- 活跃连接数量
- domain 或 sniffed host
- destination IP
- source IP，如果 controller 提供
- rule 和 rule payload
- chain/proxy path
- 采样时的 upload/download 计数

这能提供真实使用场景的历史上下文，同时避免把应用变成实时监控工具。

### 日志事件

在每个观测窗口内连接 `/logs`，或使用 controller 支持的流式模式做短时间、有边界的采集。保存 warning/error 事件，并做轻量分类：

- 时间戳
- 日志级别
- 原始 message
- event type：`dns`、`timeout`、`tls`、`eof`、`proxy`、`rule`、`provider`、`config`、`unknown`
- 当日志格式足够可靠时，提取 proxy、domain 或 rule

原始日志对复盘有价值，分类字段则让后续趋势分析可行。

## 存储模型

新增独立表，不修改现有延迟测速表：

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

索引覆盖：

- 观测任务时间
- proxy name 的时间序列查询
- 日志 event type 与 event time
- 连接采样的 domain 与 chain

## 分析集成

第一版关联层只做查询，不改变延迟结果的写入方式。

针对任意选中的测速 run：

- 查找可配置时间窗口内的观测任务，默认前后 15 分钟
- 展示附近 warning/error 事件数量
- 展示当时的代理组选择状态
- 优先按 `proxyName` 匹配 proxy/node 观测记录，后续有稳定映射后再补充 `proxyId`
- 展示该 run 附近 config/rule hash 是否变化

针对长期复盘：

- 按天聚合节点 delay/history 值
- 按节点、event type、日期聚合日志事件数量
- 按天聚合代理组已选节点历史
- 展示“质量下降附近发生过什么变化”的上下文，不自动断言因果

## UI 方向

在工具或分析区域新增观测页面，采用复盘优先的布局：

- 调度器状态：是否启用、间隔、上次运行、上次错误
- Controller 设置表单
- 按天分组的观测历史列表
- 支持 level 和 event type 过滤的事件时间线
- 面向单个 proxy name 的节点跟进视图
- 现有分析页中为选中的测速 run 增加关联上下文面板

界面应优先使用密集、可搜索的表格和时间线，而不是实时图表。

## 错误处理

- Controller 不可达：保存失败的观测任务，并记录连接错误。
- 未授权：保存失败任务，并给出清晰的 controller secret 提示。
- 某个 endpoint 不支持：继续采集其余 endpoint，并在任务错误摘要中标记缺失 endpoint。
- payload 格式异常：跳过该 endpoint，保留其他观测结果，并保存解析错误信息。
- 日志流超时：如果其他 endpoint 成功，则把它视为一个有边界的空日志窗口，不把整次观测标记为失败。

## 隐私与保留策略

连接采样和日志可能包含域名与本地 source IP，因此需要明确保留策略：

- 默认保留 30 天
- 可在设置中调整保留时间
- 应用启动后和每次成功观测后清理过期观测数据
- 不采集请求 body
- 第一版不保存完整 Clash 配置或订阅文本

## 测试

后端测试：

- 规范化包含 group、叶子节点、缺失字段和 delay history 的 `/proxies` payload
- 规范化包含 host、sniffHost、chains、rules 和空 metadata 的 `/connections` sample
- 将日志 message 分类到 event type
- 持久化并查询包含部分 endpoint 失败的观测任务
- 验证保留策略清理能通过 cascade 删除子表数据

前端测试：

- 设置表单能渲染已保存的 controller 配置
- 观测状态能渲染上次成功和失败状态
- 事件时间线能按 level 和 event type 过滤
- 分析关联面板能渲染空状态、部分数据状态和完整数据状态

## 验收标准

- 观测任务按定时器运行，不调用或阻塞手动延迟测速。
- 应用把成功和失败的观测尝试记录到 SQLite。
- proxy/group 快照、连接采样、规则摘要和 warning/error 日志事件与延迟结果分表保存。
- 选中某次测速 run 时，可以展示附近的观测上下文，且不改变现有测速结果 schema。
- 保留策略能防止数据库无限增长。
- 第一版提供可复盘的历史数据，而不是实时监控面板。
