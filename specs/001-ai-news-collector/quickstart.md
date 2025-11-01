# 快速开始指南

**Feature**: AI 新闻采集器
**Version**: 1.0
**Last Updated**: 2025-11-01

---

## 目录

1. [前置要求](#前置要求)
2. [安装步骤](#安装步骤)
3. [配置设置](#配置设置)
4. [运行采集器](#运行采集器)
5. [查看结果](#查看结果)
6. [故障排查](#故障排查)
7. [下一步](#下一步)

---

## 前置要求

### 系统要求

- **Node.js**: >= 18.0.0 (LTS 版本)
- **npm**: >= 9.0.0
- **操作系统**: macOS, Linux, 或 Windows
- **网络**: 可访问外部 API 和网站

### 账号准备

你需要注册以下服务的账号(根据需要启用的数据源):

| 服务 | 必需 | 用途 | 注册链接 |
|------|------|------|----------|
| DeepSeek | 是 | LLM 评分(超低成本) | https://platform.deepseek.com/ |
| Composio | 推荐 | Twitter 集成 | https://app.composio.dev/ |
| 飞书开放平台 | 可选 | 飞书文档采集 | https://open.feishu.cn/ |
| 微信公众平台 | 可选 | 公众号采集 | https://mp.weixin.qq.com/ |

### 验证环境

```bash
# 检查 Node.js 版本
node --version
# 应该输出: v18.x.x 或更高

# 检查 npm 版本
npm --version
# 应该输出: 9.x.x 或更高
```

---

## 安装步骤

### 1. 克隆仓库(或创建新项目)

```bash
# 如果从 Git 克隆
git clone <repository-url>
cd ai-news-collector

# 或者创建新项目
mkdir ai-news-collector
cd ai-news-collector
```

### 2. 初始化项目

```bash
# 初始化 package.json
npm init -y

# 修改 package.json,添加 type: "module"
# 使用编辑器打开 package.json,添加以下行:
# "type": "module"
```

### 3. 安装依赖

```bash
# 核心依赖
npm install openai @composio/core axios cheerio dotenv string-similarity

# 可选依赖(根据需要安装)
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
npm install @larksuiteoapi/node-sdk wechat-api

# 开发依赖
npm install -D vitest @vitest/coverage-v8
```

**预计安装时间**: 2-5 分钟(取决于网络速度)

### 4. 创建项目结构

```bash
# 创建目录结构
mkdir -p src/collectors src/filters src/services src/config src/models src/output
mkdir -p config output tests/unit tests/integration
```

---

## 配置设置

### 1. 创建环境变量文件

```bash
# 复制示例配置文件
cp .env.example .env

# 使用编辑器打开 .env 文件
# vim .env  # 或使用你喜欢的编辑器
```

### 2. 填写 API 密钥

编辑 `.env` 文件,填写以下内容:

```bash
# LLM 配置(必需)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx

# Composio 配置(推荐)
COMPOSIO_API_KEY=ak_xxxxxxxxxxxxxxxxxxxxx

# 飞书配置(可选)
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxx
FEISHU_FOLDER_TOKEN=fldxxxxxxxxxxxxx

# 微信公众号配置(可选)
WECHAT_APP_ID=wxxxxxxxxxxxxxxxxxxx
WECHAT_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 知识星球配置(可选)
ZHISHI_PLANET_ID=xxxxxxxxxxxxx
ZHISHI_COOKIE=xxxxxxxxxxxxxxxxxxxxx
```

**获取 API 密钥的方法**:

#### DeepSeek API
1. 访问 https://platform.deepseek.com/
2. 注册账号并登录(支持邮箱或手机注册)
3. 进入 "API Keys" 页面
4. 点击 "Create API Key" 创建新密钥
5. 复制密钥并粘贴到 `.env` 文件
6. **充值**: DeepSeek 采用按量付费,新用户通常有免费额度,之后需要充值使用

**为什么选择 DeepSeek?**
- **超低成本**: 比 Claude/GPT-4 便宜 10-50 倍
- **高性能**: DeepSeek-V3.1 性能接近 GPT-4
- **支持 Prompt Caching**: 缓存命中可进一步降低成本

#### Composio API
1. 访问 https://app.composio.dev/
2. 注册账号并登录
3. 进入 Settings → API Keys
4. 复制你的 API Key

### 3. 创建过滤规则配置

创建 `config/filter-rules.json` 文件:

```json
{
  "version": "1.0",
  "lastUpdated": "2025-11-01T10:00:00Z",
  "positiveExamples": [
    {
      "title": "OpenAI 发布 GPT-5,性能大幅提升",
      "summary": "OpenAI 最新发布的 GPT-5 模型在多项基准测试中超越前代,特别是在数学推理和代码生成方面表现突出。新模型支持 128K 上下文窗口,并改进了多模态能力,为企业和开发者提供更强大的工具。",
      "reason": "关注主流 AI 公司的重大产品发布和技术突破"
    },
    {
      "title": "谷歌推出 Gemini 2.0,性能超越 GPT-4",
      "summary": "谷歌发布了最新的 Gemini 2.0 大语言模型,在多项评测中超越 GPT-4。新模型在推理、代码生成和多语言理解方面表现优异,并首次实现了真正的多模态统一架构。",
      "reason": "关注主流 AI 公司的重大产品发布和技术突破"
    },
    {
      "title": "AI 辅助药物研发取得突破性进展",
      "summary": "某顶级研究机构利用 AI 技术成功预测了新型抗癌药物分子结构,大幅缩短了药物研发周期。这一成果已在《Nature》期刊上发表,标志着 AI 在生物医药领域的重大突破。",
      "reason": "关注 AI 在重要领域的实际应用和突破性成果"
    }
  ],
  "negativeExamples": [
    {
      "title": "某创业公司推出 AI 聊天机器人",
      "summary": "某不知名创业公司今天宣布推出一款基于 GPT-3 的聊天机器人产品,功能与市面上现有产品类似,未见明显创新。公司称将在未来几个月内逐步完善功能。",
      "reason": "过滤无创新性的跟风产品和普通商业宣传"
    },
    {
      "title": "AI 绘画工具又增加新滤镜",
      "summary": "某 AI 绘画应用今天更新,增加了 5 个新的艺术风格滤镜。用户可以使用这些滤镜将照片转换为不同风格的艺术作品。应用在 App Store 获得了 4.5 星评价。",
      "reason": "过滤产品的小更新和功能迭代,缺乏技术深度"
    }
  ],
  "keywords": [
    "AI", "人工智能", "机器学习", "深度学习", "大模型", "LLM",
    "GPT", "Claude", "Gemini", "ChatGPT",
    "自然语言处理", "NLP", "计算机视觉", "CV",
    "强化学习", "Transformer", "神经网络"
  ],
  "thresholdConfig": {
    "minPercentage": 10,
    "maxPercentage": 30,
    "preferredCount": 15
  }
}
```

**配置说明**:

- **positiveExamples**: 正面样例,代表你希望看到的新闻类型(至少 1 个,建议 3-5 个)
- **negativeExamples**: 反面样例,代表你不希望看到的新闻类型(至少 1 个,建议 3-5 个)
- **keywords**: 关键词列表,用于初筛(可选,但建议提供以降低成本)
- **thresholdConfig**: 动态阈值配置
  - `minPercentage`: 最少保留的新闻百分比(默认 10%)
  - `maxPercentage`: 最多保留的新闻百分比(默认 30%)
  - `preferredCount`: 期望保留的新闻数量(默认 15 条)

---

## 运行采集器

### 1. 首次运行(开发模式)

```bash
# 运行采集器
npm run start

# 或直接使用 node
node src/index.js
```

**预计运行时间**: 2-5 分钟

### 2. 运行流程

程序将按照以下步骤执行:

```
1. ✓ 加载配置文件
2. ✓ 验证环境变量
3. ✓ 检查过滤规则(至少 1 个正面和 1 个反面样例)
4. ✓ 并行采集各个数据源(5 个数据源,每个 10 条)
5. ✓ 去重处理(URL + 标题 + 内容三层去重)
6. ✓ 关键词初筛(减少 80% 数据量)
7. ✓ LLM 批量评分(使用 prompt caching 降低成本)
8. ✓ 动态阈值过滤(保留 10-30% 高分新闻)
9. ✓ 生成 Markdown 输出
10. ✓ 完成
```

### 3. 控制台输出示例

```
[2025-11-01 11:00:00] Starting AI News Collector...
[2025-11-01 11:00:01] ✓ Configuration loaded
[2025-11-01 11:00:01] ✓ Filter rules validated (3 positive, 2 negative examples)

[Collection Phase]
[AIBase] Starting collection...
[Twitter] Starting collection...
[Feishu] Starting collection...
[WeChat] Starting collection...
[Zhishi] Starting collection...

[AIBase] Collected 10 items (3.2s)
[Twitter] Collected 10 items (5.5s)
[Feishu] Collected 8 items (12.0s) - 2 items failed
[WeChat] API rate limit exceeded, retrying...
[WeChat] Collected 7 items (15.2s)
[Zhishi] Collected 10 items (4.8s)

[Collection Summary]
Total collected: 45 items
Errors: 3

[Deduplication]
After URL dedup: 42 items
After title dedup: 39 items
After content dedup: 38 items
Deduplication rate: 15.56%

[Keyword Filter]
Filtered 38 → 12 items
Reduction rate: 68.42%

[LLM Scoring]
Processing batch 1/2 (10 items)...
Processing batch 2/2 (2 items)...
LLM scoring complete: 12 items scored
Average score: 6.8
Token usage: 15,234 input, 1,024 output, 12,450 cached

[Threshold Filter]
Total: 12
Selected: 4 (33.33%)
Threshold: 7.5
Score range: 9.2 - 3.5

[Output]
✓ Generated: output/filtered-news.md

[Execution Summary]
Start time: 2025-11-01 11:00:00
End time: 2025-11-01 11:03:45
Total duration: 3m 45s
Cost estimate: $0.08
```

---

## 查看结果

### 输出文件位置

过滤后的新闻保存在:
```
output/filtered-news.md
```

### 输出格式示例

```markdown
# AI 新闻采集结果

**采集时间**: 2025-11-01 11:03:45
**总采集数**: 45 条
**过滤后**: 4 条
**过滤率**: 91.11%

---

## 1. OpenAI 发布 GPT-5,性能大幅提升

**来源**: AIBase
**链接**: https://www.aibase.com/zh/news/12345
**发布时间**: 2025-11-01 10:30:00
**评分**: 9.2 / 10

**摘要**:
OpenAI 最新发布的 GPT-5 模型在多项基准测试中超越前代,特别是在数学推理和代码生成方面表现突出。新模型支持 128K 上下文窗口,并改进了多模态能力。

**评分理由**:
该新闻报道了 OpenAI 的重大产品发布,符合用户对主流 AI 公司技术进展的关注偏好。内容具有技术深度和行业影响力,提供了详细的性能提升数据和应用场景。

---

## 2. AI 辅助药物研发取得突破性进展

**来源**: Twitter
**链接**: https://twitter.com/ai_research/status/123456789
**发布时间**: 2025-11-01 09:15:00
**评分**: 8.8 / 10

**摘要**:
某顶级研究机构利用 AI 技术成功预测了新型抗癌药物分子结构,大幅缩短了药物研发周期。这一成果已在《Nature》期刊上发表。

**评分理由**:
该新闻展示了 AI 在生物医药领域的重大实际应用,具有很高的社会价值和技术含量。研究成果已在顶级期刊发表,可信度高。

---

...
```

### 使用 Markdown 查看器

推荐使用以下工具查看输出:

- **VS Code**: 内置 Markdown 预览(快捷键: `Cmd/Ctrl + Shift + V`)
- **Typora**: 优秀的 Markdown 编辑器
- **浏览器插件**: Markdown Viewer (Chrome/Firefox)
- **命令行**: `cat output/filtered-news.md` 或 `less output/filtered-news.md`

---

## 故障排查

### 问题 1: 配置文件格式错误

**错误信息**:
```
Error: Invalid JSON in config/filter-rules.json
```

**解决方法**:
1. 使用 JSON 验证器检查文件: https://jsonlint.com/
2. 确保所有字符串用双引号包裹
3. 确保最后一个元素后没有多余的逗号

### 问题 2: 缺少正反面样例

**错误信息**:
```
Error: Filter configuration must contain at least 1 positive and 1 negative example
```

**解决方法**:
编辑 `config/filter-rules.json`,确保:
- `positiveExamples` 数组至少包含 1 个样例
- `negativeExamples` 数组至少包含 1 个样例
- 每个样例的 `summary` 长度在 100-200 字符之间

### 问题 3: LLM API 密钥无效

**错误信息**:
```
Error: Invalid API key for DeepSeek
```

**解决方法**:
1. 检查 `.env` 文件中的 `DEEPSEEK_API_KEY`
2. 确保密钥以 `sk-` 开头
3. 访问 https://platform.deepseek.com/ 验证密钥是否有效
4. 确认账户有足够的余额(新用户通常有免费额度)

### 问题 4: 数据源采集失败

**错误信息**:
```
[AIBase] Both methods failed: cheerio: Network error, puppeteer: Timeout
```

**解决方法**:
1. 检查网络连接
2. 确认目标网站是否可访问
3. 检查是否被反爬虫机制拦截(尝试更换 User-Agent)
4. 增加超时时间(修改数据源配置的 `timeout` 字段)

### 问题 5: 内存不足

**错误信息**:
```
JavaScript heap out of memory
```

**解决方法**:
```bash
# 增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=4096" node src/index.js
```

### 问题 6: 依赖安装失败

**错误信息**:
```
npm ERR! code ENOTFOUND
```

**解决方法**:
```bash
# 清除 npm 缓存
npm cache clean --force

# 使用国内镜像(如果在中国)
npm config set registry https://registry.npmmirror.com

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

---

## 下一步

### 自定义配置

1. **调整过滤偏好**
   - 编辑 `config/filter-rules.json` 添加更多正反面样例
   - 调整关键词列表以提高初筛效果
   - 修改动态阈值配置以控制输出数量

2. **启用/禁用数据源**
   - 编辑 `src/config/datasources.js`
   - 设置 `enabled: false` 禁用不需要的数据源

3. **修改采集参数**
   - 调整每个数据源的 `maxItems`(默认 10)
   - 修改超时时间 `timeout`(默认 30 秒)

### 定时运行

#### 使用 cron (Linux/macOS)

```bash
# 编辑 crontab
crontab -e

# 添加定时任务(每天早上 8 点运行)
0 8 * * * cd /path/to/ai-news-collector && node src/index.js >> logs/cron.log 2>&1
```

#### 使用 Windows 任务计划程序

1. 打开 "任务计划程序"
2. 创建基本任务
3. 设置触发器(如每天 8:00)
4. 操作: 启动程序 `node.exe`
5. 参数: `src/index.js`
6. 起始于: 项目目录路径

### 添加新数据源

参考 [collector-interface.md](./contracts/collector-interface.md) 文档:

1. 在 `src/collectors/` 创建新文件
2. 实现 `BaseCollector` 接口
3. 在 `src/collectors/index.js` 注册新采集器
4. 在 `src/config/datasources.js` 添加配置

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 生成覆盖率报告
npm run test:coverage
```

### 贡献代码

如果你想为项目贡献代码:

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

---

## 获取帮助

### 文档

- [数据模型文档](./data-model.md)
- [采集器接口文档](./contracts/collector-interface.md)
- [过滤器接口文档](./contracts/filter-interface.md)
- [技术决策研究](./research.md)

### 社区

- 提交 Issue: <repository-url>/issues
- 讨论区: <repository-url>/discussions

### 联系方式

- Email: <your-email>
- Twitter: <your-twitter>

---

**祝使用愉快! 🎉**
