# Implementation Plan: AI 新闻采集器

**Branch**: `001-ai-news-collector` | **Date**: 2025-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ai-news-collector/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

轻量级 AI 新闻采集器 - Node.js 命令行服务,从多个数据源(AIBase、推特、知识星球、飞书文档、公众号)采集最新的 AI 相关新闻,使用 LLM 根据用户提供的正反面样例进行智能过滤,输出高质量新闻到 Markdown 文档。系统采用配置化设计,支持动态阈值过滤和完整的错误处理机制。

## Technical Context

**Language/Version**: Node.js 18+ (LTS版本)
**Primary Dependencies**:
- `@composio/sdk` - 多平台集成(推特、飞书、公众号等)
- `axios` - HTTP请求客户端
- `cheerio` - HTML解析(用于AIBase网页抓取)
- `dotenv` - 环境变量管理
- `openai` - OpenAI SDK(用于调用 DeepSeek API,兼容格式)
**Storage**: 本地文件系统(配置文件为JSON格式,输出为Markdown文件),无数据库依赖
**Testing**: Vitest (性能优异,原生 ESM 支持)
**Target Platform**: macOS/Linux/Windows 命令行环境
**Project Type**: single (CLI工具)
**Performance Goals**:
- 完整采集和过滤流程 < 5分钟
- 支持至少50条新闻的并行处理
- 内存占用 < 512MB
**Constraints**:
- LLM API调用成本控制(需通过关键词初筛减少80%调用量)
- 单个数据源采集超时 30秒
- 最多重试3次(指数退避策略)
**Scale/Scope**:
- 5个硬编码数据源(AIBase、推特、知识星球、飞书文档、公众号)
- 每个数据源采集10条新闻
- 过滤后输出10-30%的高质量内容

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. 数据源统一性检查 ✅

**要求**: 每个配置项必须只在一个位置声明和维护

**本项目实施**:
- ✅ 所有环境变量(LLM API密钥等)集中在 `.env` 文件
- ✅ 数据源配置在 `src/config/datasources.js` 单一位置
- ✅ 过滤规则配置在 `config/filter-rules.json` 单一文件
- ✅ 禁止代码中硬编码配置值

**结论**: 符合宪章要求

### II. 模块化与可扩展性检查 ✅

**要求**: 每个数据源采集器必须实现统一接口,新增数据源不修改现有代码

**本项目实施**:
- ✅ 定义统一的 `Collector` 接口(方法: `collect()`)
- ✅ 所有采集器返回标准化的 `NewsItem` 结构
- ✅ 采集器放置在 `src/collectors/` 目录,互不依赖
- ✅ 过滤器和输出模块均支持插拔式设计

**结论**: 符合宪章要求

### III. 错误处理与容错性检查 ✅

**要求**: 单个数据源失败不中断整体流程,必须实现重试和超时

**本项目实施**:
- ✅ 使用 Promise.allSettled 处理多数据源采集,单个失败不影响其他
- ✅ 实现指数退避重试机制(最多3次)
- ✅ 所有外部调用设置30秒超时
- ✅ LLM服务不可用时通过日志记录并跳过评分

**结论**: 符合宪章要求

### IV. 成本控制与性能优化检查 ✅

**要求**: LLM调用必须经过初筛减少80%数据量,全流程<5分钟

**本项目实施**:
- ✅ 关键词初筛在LLM调用前执行(基于标题和摘要)
- ✅ 支持批量评分以减少API调用次数
- ✅ 实现基于URL的去重缓存
- ✅ 并行执行独立的数据采集任务

**结论**: 符合宪章要求

### V. 数据质量保证检查 ✅

**要求**: 去重准确率≥95%,推送评分阈值≥6分,保留原始数据

**本项目实施**:
- ✅ URL去重+标题相似度去重(双重机制)
- ✅ 动态阈值过滤保留10-30%高分内容
- ✅ 原始数据保存在输出的Markdown中
- ✅ 必填字段验证(标题、URL、发布时间)

**结论**: 符合宪章要求

### 总体评估: 通过 ✅

本项目设计完全符合宪章的所有核心原则,无违规项。可以继续进行 Phase 0 研究。

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── collectors/          # 数据采集器模块(每个数据源一个文件)
│   ├── base.js         # Collector接口定义
│   ├── aibase.js       # AIBase采集器
│   ├── twitter.js      # 推特采集器
│   ├── zhishi.js       # 知识星球采集器
│   ├── feishu.js       # 飞书文档采集器
│   └── wechat.js       # 公众号采集器
├── filters/            # 过滤器模块
│   ├── keyword.js      # 关键词初筛过滤器
│   ├── llm.js          # LLM评分过滤器
│   └── deduplicator.js # 去重过滤器
├── services/           # 核心服务
│   ├── orchestrator.js # 主流程编排器
│   ├── llm-client.js   # LLM客户端封装
│   └── retry.js        # 重试和超时处理
├── config/             # 配置管理
│   ├── loader.js       # 配置文件加载器
│   └── datasources.js  # 数据源配置
├── models/             # 数据模型
│   └── news-item.js    # NewsItem标准结构
├── output/             # 输出模块
│   └── markdown.js     # Markdown生成器
└── index.js            # CLI入口

config/                 # 配置文件目录
├── filter-rules.json   # 过滤规则配置
└── examples.json       # 用户提供的正反面样例

tests/
├── unit/              # 单元测试
│   ├── collectors/
│   ├── filters/
│   └── services/
└── integration/       # 集成测试
    └── e2e.test.js

output/                # 输出目录
└── filtered-news.md   # 过滤后的新闻输出
```

**Structure Decision**:
- 选择单一项目结构(CLI工具)
- `src/collectors/` - 采用插件化设计,每个数据源独立实现
- `src/filters/` - 多级过滤器链式调用(关键词初筛 → LLM评分 → 去重)
- `src/services/` - 核心业务逻辑封装,包含流程编排和LLM客户端
- `config/` - 用户配置文件与代码配置分离

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违规项,本节留空。
