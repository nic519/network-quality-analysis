# Latency Compass

Latency Compass 是一个基于 Electrobun 的桌面应用，用于通过 `clash-speedtest` 测试网站访问延迟。

## 第一版功能

- 使用 React 构建界面，并采用 shadcn/ui 风格组件。
- 使用 Electrobun 提供桌面应用外壳。
- 内置香港和日本两个地区预设。
- 支持配置测试站点，默认包含 YouTube、X 和 GitHub。
- 引导用户通过 `go install github.com/nic519/clash-speedtest@latest` 安装 `clash-speedtest`。
- 将历史记录存储在 `~/Library/Application Support/Latency Compass/latency-compass.sqlite`。
- 展示汇总卡片，以及按节点和站点排列的延迟矩阵。
- 支持将当前筛选结果导出为汇总 CSV 文件到指定文件夹。

## 安装依赖

```bash
bun install
```

在应用内运行测试之前，需要单独安装 `clash-speedtest`：

```bash
go install github.com/nic519/clash-speedtest@latest
```

当前桌面 app 会校验 `clash-speedtest -v` 输出的版本号，要求它不低于本应用 `package.json` 里的最低版本要求。当前最低要求为 `0.1.3`，因此 `0.1.3` 及以上版本都可以使用。如果本机二进制版本过低，依赖状态会显示为不可用，需要先在 Go 项目中重新编译：

```bash
cd /Users/nicholas/Desktop/my_program/clash-speedtest
go build -ldflags "-X main.version=0.1.3 -X main.commit=$(git rev-parse --short HEAD)" -o ~/go/bin/clash-speedtest .
~/go/bin/clash-speedtest -v
```

开发时如果使用手动路径或 `CLASH_SPEEDTEST_PATH`，也需要指向满足最低版本要求的二进制。

## 出口 IP Probe API

应用会让 `clash-speedtest` 通过每个节点访问 Probe API，用于记录节点出口 IP、国家/地区、ASN 和组织信息。默认配置为：

```text
启用: 是
Probe URL: https://api.ip.sb/geoip/
字段映射: ip=ip,country=country,country_code=country_code,region=region,city=city,asn=asn,org=organization
超时时间: 8s
```

如果某个 IP API 在你的网络或节点出口下不可用，可以在“工具设置”里的“出口 Probe API”关闭 Probe，或切换 URL、字段映射和超时时间。保存后，下一次测速会使用新的配置。

为了避免 IP API 影响整体测速，桌面 app 只会在每个地区的第一个启用网站上执行出口 Probe；YouTube、X、GitHub 等目标站点的延迟测试使用独立的 `--latency-timeout 8s`，不会再被 `--max-latency` 的筛选阈值误当作请求超时。

## 本地开发

```bash
bun test
bun run typecheck
bun run build:web
bun run dev
```

## 发布构建

推送任意 Git tag 都会触发 GitHub Actions 自动构建。tag 名称不再需要与 `package.json` 中的版本号保持一致。

示例：

```bash
git tag v0.1.0
git push origin v0.1.0
```

该工作流会先运行测试和类型检查，然后为 macOS 和 Windows 构建桌面应用。构建完成后，压缩包会同时上传到 Actions 运行记录，以及对应 tag 的 GitHub Release。

应用界面中需要填写本地 Clash/Mihomo 配置路径或订阅 URL。第一版暂不支持用户自定义筛选规则；选择 `香港` 或 `日本` 时，会使用 `src/shared/domain.ts` 中定义的地区正则。

本地开发和调试时，仍然可以设置 `CLASH_SPEEDTEST_PATH`，也可以在诊断视图中手动指定二进制文件路径。
