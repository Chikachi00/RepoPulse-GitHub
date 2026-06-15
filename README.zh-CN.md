# RepoPulse

> 完整中英双语 README 请见 [README.md](README.md)。本文件保留为中文单独版。

![CI](https://github.com/Chikachi00/RepoPulse-GitHub/actions/workflows/ci.yml/badge.svg)

RepoPulse 是一个事件驱动的 GitHub 仓库工程健康监控平台，可将 Pull Request、Issue、Commit、Release、GitHub Actions 和仓库工程配置转化为可解释的工程指标、风险提示和历史趋势。

- GitHub: https://github.com/Chikachi00/RepoPulse-GitHub
- Latest Release: https://github.com/Chikachi00/RepoPulse-GitHub/releases/latest
- English Version: [README.md#english-version](README.md#english-version)

## 项目简介

RepoPulse 用于快速判断一个 GitHub 仓库是否仍在持续维护、协作效率是否稳定、CI 和测试体系是否完整，以及哪些文件或维护环节可能需要重点关注。

项目会将 GitHub 中分散在 Pull Request、Issue、Commit、Release、Actions 和仓库配置页面中的信息，整理为一份可解释的仓库工程健康报告。

RepoPulse 支持手动分析，也支持通过 GitHub App Webhook 在默认分支 Push 或部分 Pull Request 活动发生后自动创建新的历史快照。

当前版本：

```text
V1.0 — Event-driven repository health monitoring
```

## 快速链接

- [GitHub 仓库](https://github.com/Chikachi00/RepoPulse-GitHub)
- [Latest Release](https://github.com/Chikachi00/RepoPulse-GitHub/releases/latest)
- [完整双语 README](README.md)
- [架构说明](docs/architecture.md)
- [数据库结构](docs/database-schema.md)
- [Worker 生命周期](docs/worker-lifecycle.md)
- [指标方法论](docs/metrics-methodology.md)
- [测试说明](docs/testing.md)
- [GitHub App 配置](docs/github-app-setup.md)
- [CHANGELOG](CHANGELOG.md)

## 核心功能

### 仓库健康总览

- 输入 GitHub 仓库 URL 后创建持久化分析任务。
- 展示 Health Score、等级、置信度和分类得分。
- 分类展示 Collaboration、Activity & Delivery、Automation & Testing、Project Hygiene。
- 每个分类提供可解释的评分依据和改进建议。
- 缺失数据不会被简单当作零分，而是按可用指标重新归一化权重。
- Health Score 是工程信号汇总，不代表代码质量、安全性或项目价值的绝对判断。

### Pull Request 与 Issue 分析

- 统计 Pull Request 合并数量和开放数量。
- 分析平均值、中位数和 P75 合并耗时。
- 识别最老的开放 Pull Request。
- 统计开放 Issue、陈旧 Issue 和陈旧比例。
- 展示 Issue 年龄分布和最老开放 Issue。
- 明确展示 GitHub API 抽样和数据范围限制。

### Commit、文件热点与贡献者分析

- 分析近期 Commit 活动和连续周趋势。
- 展示活跃周数量和最近 Push 时间。
- 根据文件触达次数和 Churn 识别高频修改文件。
- 使用启发式规则识别疑似修复热点。
- 分析贡献者份额、前三贡献者占比和 HHI 集中度。
- 贡献者集中度只作为维护风险信号，不直接等同于质量问题。

### Release、CI 与工程实践

- 展示 Release 数量、稳定版本和发布时间趋势。
- 分析 GitHub Actions Workflow 和近期 Workflow Runs。
- 统计 CI 成功率、失败数、取消数和运行时长。
- 静态检测测试文件、测试框架和测试命令。
- 检测 Lint、Format、Typecheck、Build 和 Coverage 配置。
- 检测 README、License、CONTRIBUTING、CHANGELOG、SECURITY、CODEOWNERS 等治理文件。
- 检测 Dependabot 或 Renovate 等依赖更新自动化配置。
- RepoPulse 不执行被分析仓库中的代码。

### 历史快照与趋势

- 每次完成的分析都会保存为独立历史快照。
- 完整 Analysis Report 以 JSONB 保存。
- 常用分数、等级、置信度和时间字段单独保存，便于历史查询。
- Dashboard 展示 Health Score 和分类分数趋势。
- 支持查看历史快照并返回最新结果。
- 展示 Health Score、CI 成功率、陈旧 Issue 比例和 Commit 活动变化。

### GitHub App 与自动刷新

- 使用 HMAC SHA-256 验证 GitHub Webhook 签名。
- 使用 Delivery ID 和 Payload Hash 做幂等处理。
- 持久化 GitHub App Installation、授权仓库和 Webhook Delivery。
- Webhook API 只负责验签、规范化和持久化。
- Webhook Worker 异步处理 Installation 生命周期和仓库授权关系。
- 默认分支 Push 和支持的 Pull Request 事件可触发新的 FULL AnalysisRun。
- Installation Token 只缓存在内存中，不写入数据库或日志。
- 私有仓库必须存在有效 GitHub App 授权，不会回退匿名访问。

### 后台任务与恢复机制

- API 只创建任务和查询结果，完整 GitHub 分析由独立 Worker 执行。
- PostgreSQL `FOR UPDATE SKIP LOCKED` 用于多个 Worker 安全领取任务。
- 支持任务优先级、availableAt、最大尝试次数和重试退避。
- Worker 使用 Heartbeat 更新运行状态。
- Stale Recovery 可恢复因 Worker 中断而遗留的任务。
- 完成报告、任务状态和事件记录通过事务原子保存。
- 兼容的近期报告可以作为持久缓存复用。

## 技术栈

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts

### API 与分析服务

- Node.js
- Fastify
- TypeScript
- Zod
- Octokit / GitHub REST API
- Undici ProxyAgent

### 数据库与后台任务

- PostgreSQL
- Prisma ORM
- JSONB
- Database-backed Worker Queue
- `FOR UPDATE SKIP LOCKED`

### 测试与工程化

- Vitest
- PostgreSQL Integration Tests
- Temporary Schema Isolation
- ESLint
- Prettier
- TypeScript Strict Mode
- GitHub Actions
- PostgreSQL 17 CI Service

## 架构和数据模型亮点

```mermaid
flowchart LR
    Web[React Web] --> API[Fastify API]
    API --> DB[(PostgreSQL)]

    DB --> AnalysisWorker[Analysis Worker]
    AnalysisWorker --> GitHubAPI[GitHub REST API]
    AnalysisWorker --> DB

    GitHubApp[GitHub App] -->|Signed Webhook| WebhookAPI[Webhook API]
    WebhookAPI --> DB

    DB --> WebhookWorker[Webhook Worker]
    WebhookWorker --> AnalysisQueue[AnalysisRun Queue]
    AnalysisQueue --> AnalysisWorker

    DB --> History[Historical Snapshots]
    History --> API
```

- Monorepo 包含 `apps/web`、`apps/api`、`apps/worker`、`packages/shared`、`packages/database` 和 `packages/analysis-engine`。
- API 不直接执行完整分析，只负责输入校验、任务创建、状态查询和历史查询。
- Analysis Worker 负责 GitHub 数据获取、指标计算、健康评分和报告保存。
- Webhook Worker 负责 Installation 生命周期、仓库授权关系和自动分析触发。
- `AnalysisRun` 保存任务状态、进度、重试和触发来源。
- `AnalysisReportRecord` 保存完整 JSONB 快照与索引字段。
- `GitHubInstallation` 和 `GitHubInstallationRepository` 保存 GitHub App 授权关系。
- `WebhookDelivery` 保存 Delivery 去重、状态、重试和最小规范化 Payload。
- Installation Token 只保存在内存中。
- RepoPulse 不 Clone 仓库、不安装仓库依赖，也不执行被分析仓库中的代码。

## 本地运行

安装依赖并生成 Prisma Client：

```bash
npm install
npm run db:generate
```

准备 PostgreSQL。可以使用仓库提供的 Docker Compose：

```bash
npm run dev:services
```

也可以直接连接任意兼容 PostgreSQL 数据库，只需要正确设置 `DATABASE_URL`。

应用 Migration：

```bash
npm run db:migrate
```

分别启动：

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
```

或者在 PostgreSQL 已运行后同时启动：

```bash
npm run dev:all
```

`dev:all` 不会删除、重置或重建数据库。

## 环境变量

从 `.env.example` 创建本地 `.env`：

```env
DATABASE_URL=postgresql://repopulse:repopulse@localhost:5432/repopulse?schema=public
TEST_DATABASE_URL=postgresql://repopulse:repopulse@localhost:5432/repopulse
API_PORT=3001

GITHUB_TOKEN=
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_PRIVATE_KEY_BASE64=
GITHUB_APP_PRIVATE_KEY_PATH=
GITHUB_WEBHOOK_SECRET=
```

不要提交 `.env`、Token、Private Key、Webhook Secret、Installation Token、私有数据库凭据或 Webhook 原始 Payload。

## GitHub App 配置

完整配置说明见 [docs/github-app-setup.md](docs/github-app-setup.md)。

V1.0 支持：

- GitHub App Installation 生命周期同步
- 授权仓库映射
- Signed Webhook Delivery
- 默认分支 Push 自动刷新
- 部分 Pull Request Action 自动刷新
- Installation Token 身份认证
- 私有仓库授权保护

私有仓库功能主要面向单用户或 Self-hosted 部署，不代表已经具备公共多租户 SaaS 所需的完整权限隔离。

## 测试与验证

快速单元测试：

```bash
npm run test
```

完整本地检查：

```bash
npm run db:generate
npm run typecheck
npm run test
npm run lint
npm run format:check
npm run build
```

PostgreSQL 集成测试需要设置 `TEST_DATABASE_URL`：

```bash
npm run test:integration
```

Integration Tests 会创建唯一临时 PostgreSQL Schema、应用已提交的 Prisma Migration、验证持久化任务和 Worker，并在测试结束后删除临时 Schema。测试不会访问真实 GitHub API。

GitHub Actions 使用 PostgreSQL 17 Service 执行 Migration、Typecheck、Unit Tests、Integration Tests、Lint、Format Check 和 Build。

## 已知限制

- RepoPulse 主要面向公开仓库和单用户 / Self-hosted 私有仓库监控。
- 当前未实现 GitHub OAuth 和公共多租户权限隔离。
- Webhook 自动刷新只覆盖默认分支 `push` 和部分 `pull_request` Action。
- GitHub API Rate Limit 和抽样上限可能影响部分指标完整性。
- 工程实践检测基于静态规则和启发式判断。
- 文件热点和疑似修复热点不代表文件一定存在缺陷。
- Health Score 不是代码质量评分、安全审计或项目价值判断。
- RepoPulse 不会执行被分析仓库中的代码。
- 当前尚未提供正式在线 Demo 和生产部署模板。

## 截图 / Demo

截图待补充：

```text
docs/assets/dashboard-overview.png
docs/assets/engineering-metrics.png
docs/assets/history-trend.png
docs/assets/github-app-integration.png
```

## License

MIT License
