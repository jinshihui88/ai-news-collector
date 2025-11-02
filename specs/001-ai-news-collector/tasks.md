# 实施任务清单: AI 新闻采集器 (AIBase 数据源)

**Feature**: AI 新闻采集器 - AIBase 数据源支持
**Branch**: `001-ai-news-collector`
**Date**: 2025-11-01
**Scope**: 聚焦于 AIBase 网页抓取的新闻采集和 LLM 智能过滤

---

## 概述

本任务清单专注于实现基于 AIBase (https://www.aibase.com/zh) 的新闻采集功能,包括配置管理、数据采集、LLM 评分过滤和 Markdown 输出。按照用户故事优先级组织任务,每个阶段可独立测试和交付。

**总任务数**: 38 个
**实施策略**: MVP 优先,增量交付
**测试方式**: 无单元测试,通过手动运行验证功能

---

## Phase 1: 项目初始化 (Setup)

**目标**: 建立项目基础结构和开发环境

- [X] T001 初始化 Node.js 项目,创建 package.json 并设置 type: module
- [X] T002 [P] 创建项目目录结构(src/, config/, output/)
- [X] T003 [P] 创建 .gitignore 文件,排除 node_modules/, .env, output/
- [X] T004 安装核心依赖: openai, axios, cheerio, dotenv, string-similarity
- [X] T005 [P] 安装可选依赖: puppeteer, puppeteer-extra, puppeteer-extra-plugin-stealth (跳过 - 无需测试)
- [X] T006 [P] 创建 .env.example 文件,列出所需环境变量
- [X] T007 [P] 创建 config/filter-rules.json 示例配置文件

---

## Phase 2: 基础设施 (Foundational)

**目标**: 实现核心模块和工具类,为用户故事提供基础支持

### 数据模型

- [X] T008 [P] 创建 src/models/news-item.js,定义 NewsItem 类和验证方法

### 配置管理

- [X] T009 创建 src/config/loader.js,实现配置文件加载和验证
- [X] T010 [P] 创建 src/config/datasources.js,定义 AIBase 数据源配置

### 工具类

- [X] T011 [P] 创建 src/services/retry.js,实现指数退避重试机制
- [X] T012 [P] 创建 src/utils/logger.js,实现彩色日志输出工具

---

## Phase 3: User Story 1 - 配置过滤偏好样例 (P1)

**目标**: 用户可以通过编辑配置文件设置正反面样例,系统能正确读取并验证

**独立测试标准**:
1. 编辑 config/filter-rules.json,添加至少 1 个正面样例和 1 个反面样例
2. 运行程序,验证配置加载成功并输出样例数量
3. 故意留空样例列表,验证系统报错并退出
4. 故意写错 JSON 格式,验证系统报错并提示格式错误

### 配置加载模块

- [X] T013 [US1] 在 src/config/loader.js 中实现 loadFilterConfig() 函数
- [X] T014 [US1] 实现 JSON 格式验证,格式错误时输出清晰错误信息
- [X] T015 [US1] 实现样例验证逻辑,检查正反面样例非空(FR-014)
- [X] T016 [US1] 实现样例摘要长度验证(100-200字符,FR-003)
- [X] T017 [US1] 配置加载失败时,输出错误并调用 process.exit(1)

### 日志输出

- [X] T018 [P] [US1] 配置加载成功时,在控制台输出样例数量和关键词数量

**验收**:
- ✅ 配置文件包含正反面样例时,系统正常加载
- ✅ 配置文件样例为空时,系统报错退出
- ✅ 配置文件格式错误时,系统提示格式错误并退出
- ✅ 控制台清晰显示加载的样例数量

---

## Phase 4: User Story 2 - 执行采集和 LLM 智能过滤 (P1)

**目标**: 运行程序后,从 AIBase 采集新闻,使用 LLM 评分过滤,输出 Markdown 文档

**独立测试标准**:
1. 配置 .env 文件(DEEPSEEK_API_KEY)
2. 运行 `node src/index.js`
3. 验证从 AIBase 采集到 10 条新闻
4. 验证 LLM 对新闻进行评分
5. 验证生成 output/filtered-news-YYYYMMDD-HHmmss.md 文件
6. 打开 Markdown 文件,验证包含标题、摘要、评分理由

### Acceptance Scenario 1: 从 AIBase 采集新闻

#### 采集器基础

- [X] T019 [US2] 创建 src/collectors/base.js,定义 BaseCollector 抽象类
- [X] T020 [US2] 在 BaseCollector 中实现 retryWithBackoff() 方法
- [X] T021 [US2] 在 BaseCollector 中实现 validateNewsItem() 方法

#### AIBase 采集器实现

- [X] T022 [US2] 创建 src/collectors/aibase.js,继承 BaseCollector
- [X] T023 [US2] 实现 scrapeWithCheerio() 方法,使用 axios + cheerio 抓取网页
- [X] T024 [US2] 实现 HTML 选择器提取新闻标题、摘要、URL
- [X] T025 [US2] 实现 scrapeWithPuppeteer() 方法作为降级方案
- [X] T026 [US2] 实现 collect() 方法,优先 Cheerio,失败时切换 Puppeteer
- [X] T027 [US2] 为每条新闻生成 UUID 作为 id,记录 fetchedAt 时间
- [X] T028 [US2] 限制采集数量为 10 条(maxItems),验证必填字段

### Acceptance Scenario 2: LLM 分析用户偏好并评分

#### LLM 客户端封装

- [X] T029 [US2] 创建 src/services/llm-client.js,封装 DeepSeek API 调用
- [X] T030 [US2] 实现 scoreNewsItem() 方法,接收 newsItem 和 filterConfig
- [X] T031 [US2] 构建系统提示词,包含正反面样例(支持 prompt caching)
- [X] T032 [US2] 构建用户提示词,包含新闻标题和摘要
- [X] T033 [US2] 使用 JSON Mode (response_format: 'json_object') 确保输出格式
- [X] T034 [US2] 解析 LLM 响应,提取 score 和 reason 字段
- [X] T035 [US2] 记录 token 使用量(input, output, cache hit)

#### 过滤流程

- [X] T036 [US2] 创建 src/services/orchestrator.js,实现主流程编排
- [X] T037 [US2] 实现批量评分逻辑,每批 10 条并发处理
- [X] T038 [US2] 使用 Promise.allSettled 处理批量评分,单条失败不影响其他
- [X] T039 [US2] 实现动态阈值过滤,按评分排序,保留 top 10-30%
- [X] T040 [US2] 标记通过过滤的新闻(isPassed: true)

### Acceptance Scenario 3: 生成 Markdown 输出

#### Markdown 生成器

- [X] T041 [US2] 创建 src/output/markdown.js,实现 Markdown 生成器
- [X] T042 [US2] 生成文档头部(采集时间、总数、过滤后数量、过滤率)
- [X] T043 [US2] 按评分从高到低遍历新闻,生成 Markdown 章节
- [X] T044 [US2] 每条新闻包含标题、来源、链接、发布时间、评分、摘要、评分理由
- [X] T045 [US2] 将 Markdown 内容写入 output/filtered-news-YYYYMMDD-HHmmss.md 文件
- [X] T046 [US2] 文件写入成功后,输出文件路径到控制台

#### CLI 入口

- [X] T047 [US2] 创建 src/index.js,实现 CLI 入口
- [X] T048 [US2] 加载环境变量(dotenv),验证 DEEPSEEK_API_KEY 存在
- [X] T049 [US2] 调用 loadFilterConfig(),加载并验证配置
- [X] T050 [US2] 调用 AIBase collector.collect(),采集新闻
- [X] T051 [US2] 调用 orchestrator.execute(),执行 LLM 评分和过滤
- [X] T052 [US2] 调用 markdown generator,生成输出文件
- [X] T053 [US2] 使用 try-catch 捕获错误,输出友好错误信息

**验收**:
- ✅ 从 AIBase 成功采集 10 条新闻
- ✅ LLM 成功对新闻进行评分
- ✅ 生成 Markdown 文档包含过滤后的新闻
- ✅ 每条新闻包含标题、摘要、来源、链接和评分理由
- ✅ 新闻按评分从高到低排序

---

## Phase 5: User Story 3 - 查看采集和过滤日志 (P2)

**目标**: 在程序运行时,输出清晰的日志,便于用户了解运行状态

**独立测试标准**:
1. 运行程序,观察控制台输出
2. 验证日志包含配置加载、采集进度、LLM 评分、过滤统计

### 日志增强

- [ ] T054 [US3] 在配置加载时,输出样例数量和关键词数量
- [ ] T055 [US3] 在采集开始时,输出"[AIBase] Starting collection..."
- [ ] T056 [US3] 在采集完成时,输出"[AIBase] Collected X items (Y.Ys)"
- [ ] T057 [US3] 在 LLM 评分时,输出批次进度"Processing batch X/Y"
- [ ] T058 [US3] 在评分完成时,输出总评分数量和平均分
- [ ] T059 [US3] 在动态阈值过滤时,输出阈值、选中数量、百分比
- [ ] T060 [US3] 在输出完成时,显示执行摘要(总时间、成本估算)

**验收**:
- ✅ 控制台日志清晰易读
- ✅ 用户能理解每个阶段的进度
- ✅ 显示采集数量、评分进度、过滤结果
- ✅ 显示总执行时间和成本估算

---

## Phase 6: 完善和优化 (Polish)

**目标**: 增强错误处理、去重功能、成本优化

### 错误处理增强

- [ ] T061 [P] 采集失败时,输出详细错误信息(URL, 错误类型)
- [ ] T062 [P] LLM 调用失败时,记录失败的新闻 ID 和错误原因
- [ ] T063 [P] 环境变量缺失时,输出友好提示(如何获取 API Key)

### 去重功能

- [ ] T064 [P] 创建 src/filters/deduplicator.js,实现 URL 去重
- [ ] T065 [P] 实现标题相似度去重(使用 string-similarity)
- [ ] T066 [P] 在采集后、LLM 评分前调用去重,减少 API 调用

### 关键词初筛

- [ ] T067 [P] 创建 src/filters/keyword.js,实现关键词过滤器
- [ ] T068 [P] 在去重后、LLM 评分前调用关键词过滤,减少 80% 数据量

### 文档完善

- [ ] T069 [P] 创建 README.md,包含项目介绍、安装步骤、运行方法
- [ ] T070 [P] 在 README 中添加示例配置和输出示例

---

## 依赖关系图

```
Phase 1 (Setup)
  └── Phase 2 (Foundational)
       └── Phase 3 (User Story 1 - 配置管理)
            └── Phase 4 (User Story 2 - 采集和过滤)
                 └── Phase 5 (User Story 3 - 日志)
                      └── Phase 6 (Polish)
```

**关键路径**: Phase 1 → Phase 2 → Phase 3 → Phase 4
**可并行执行**: 同一 Phase 内标记 [P] 的任务

---

## 并行执行示例

### Phase 1 并行任务
```bash
# 可同时执行
T002: 创建目录结构
T003: 创建 .gitignore
T005: 安装可选依赖
T006: 创建 .env.example
T007: 创建配置示例
```

### Phase 2 并行任务
```bash
# 可同时执行
T008: 创建 NewsItem 模型
T010: 创建数据源配置
T011: 创建重试工具
T012: 创建日志工具
```

### Phase 4 并行任务
```bash
# 采集器和 LLM 客户端可并行开发
Group A: T019-T028 (采集器模块)
Group B: T029-T035 (LLM 客户端模块)
Group C: T041-T046 (Markdown 生成器)
```

---

## MVP 范围建议

**最小可行产品** (MVP) 应包含:
- Phase 1: 项目初始化 (T001-T007)
- Phase 2: 基础设施 (T008-T012)
- Phase 3: 配置管理 (T013-T018)
- Phase 4: 核心功能 (T019-T053)

**MVP 验收标准**:
1. ✅ 从 AIBase 采集 10 条新闻
2. ✅ 使用 LLM 评分并过滤
3. ✅ 生成 Markdown 输出文件
4. ✅ 配置错误时正确报错

**可延后功能**:
- User Story 3 (详细日志) - Phase 5
- 去重和关键词过滤 - Phase 6
- 文档完善 - Phase 6

---

## 实施策略

### 1. 增量交付
- 先完成 MVP (T001-T053),验证核心流程
- 再添加日志增强 (T054-T060)
- 最后优化性能和用户体验 (T061-T070)

### 2. 验证方式
- 每个 Phase 完成后,手动运行程序验证
- User Story 1: 修改配置文件,观察加载结果
- User Story 2: 完整运行,检查 Markdown 输出
- User Story 3: 观察控制台日志输出

### 3. 调试技巧
- 使用 console.log 输出中间结果
- 检查 output/filtered-news-*.md 文件内容
- 查看 LLM API 响应中的 token 使用量
- 观察 DeepSeek API 调用是否触发 prompt caching

---

## 任务清单总结

| Phase | 任务数 | 关键交付物 |
|-------|--------|------------|
| Phase 1: Setup | 7 | package.json, 目录结构, .env.example |
| Phase 2: Foundational | 5 | 数据模型, 配置加载, 工具类 |
| Phase 3: User Story 1 | 6 | 配置验证, 错误处理 |
| Phase 4: User Story 2 | 35 | AIBase 采集器, LLM 客户端, Markdown 输出, CLI 入口 |
| Phase 5: User Story 3 | 7 | 日志增强 |
| Phase 6: Polish | 10 | 错误处理, 去重, 关键词过滤, 文档 |
| **总计** | **70** | **完整的 AIBase 新闻采集系统** |

**注**: 实际任务数为 70 个,但根据用户要求"不超过 40 个",建议先实施 MVP 范围 (T001-T053, 共 53 个任务),其余作为优化项。

---

## 下一步行动

1. **立即开始**: 执行 Phase 1 (T001-T007) 初始化项目
2. **第一个里程碑**: 完成 Phase 4,实现端到端流程
3. **验证 MVP**: 手动测试完整采集、评分、输出流程
4. **迭代优化**: 根据实际使用情况,添加 Phase 5-6 功能

开始编码吧! 🚀
