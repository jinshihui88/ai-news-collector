# AI 新闻采集器

轻量级 AI 新闻采集器 - 从 AIBase 等数据源采集最新的 AI 相关新闻,使用 DeepSeek LLM 根据用户提供的正反面样例进行智能过滤,输出高质量新闻到 Markdown 文档。

## 功能特性

- ✅ **智能采集**: 从 AIBase 网站自动抓取最新 AI 新闻
- ✅ **LLM 评分**: 使用 DeepSeek API 根据用户偏好对新闻进行智能评分
- ✅ **动态过滤**: 自动保留得分最高的 10-30% 新闻
- ✅ **配置化**: 通过 JSON 配置文件设置正反面样例
- ✅ **低成本**: 使用 DeepSeek API,每次运行约 $0.01-0.02
- ✅ **完整日志**: 彩色日志输出,清晰展示采集和过滤进度

## 快速开始

### 1. 环境要求

- Node.js 18+ (LTS 版本)
- DeepSeek API Key ([获取地址](https://platform.deepseek.com/api_keys))

### 2. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 3. 配置环境变量

复制 \`.env.example\` 到 \`.env\` 并填入你的 API Key:

\`\`\`bash
cp .env.example .env
\`\`\`

编辑 \`.env\` 文件:

\`\`\`env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

### 4. 配置过滤规则

编辑 \`config/filter-rules.json\` 文件,设置你的正反面样例:

\`\`\`json
{
  "positiveExamples": [
    {
      "title": "你想看到的新闻类型的标题",
      "summary": "新闻摘要(100-200字符)",
      "reason": "为什么喜欢这类新闻"
    }
  ],
  "negativeExamples": [
    {
      "title": "你不想看到的新闻类型的标题",
      "summary": "新闻摘要(100-200字符)",
      "reason": "为什么不喜欢这类新闻"
    }
  ]
}
\`\`\`

### 5. 运行程序

\`\`\`bash
npm start
\`\`\`

程序会自动:
1. 从 AIBase 采集最新新闻
2. 使用 LLM 对新闻进行评分
3. 过滤出高质量新闻
4. 生成 Markdown 报告到 \`output/filtered-news.md\`

## 项目结构

\`\`\`
ai-news-collector/
├── src/
│   ├── collectors/       # 数据采集器
│   │   ├── base.js      # 采集器基类
│   │   └── aibase.js    # AIBase 采集器
│   ├── services/        # 核心服务
│   │   ├── llm-client.js    # LLM 客户端
│   │   ├── orchestrator.js  # 流程编排器
│   │   └── retry.js     # 重试机制
│   ├── models/          # 数据模型
│   │   └── news-item.js # 新闻条目模型
│   ├── config/          # 配置管理
│   │   ├── loader.js    # 配置加载器
│   │   └── datasources.js  # 数据源配置
│   ├── output/          # 输出模块
│   │   └── markdown.js  # Markdown 生成器
│   ├── utils/           # 工具类
│   │   └── logger.js    # 日志工具
│   └── index.js         # CLI 入口
├── config/              # 配置文件
│   └── filter-rules.json  # 过滤规则
├── output/              # 输出目录
│   └── filtered-news.md   # 生成的报告
├── .env.example         # 环境变量示例
└── package.json
\`\`\`

## 配置说明

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| DEEPSEEK_API_KEY | 是 | - | DeepSeek API 密钥 |
| LLM_MODEL | 否 | deepseek-chat | 使用的模型 |
| LLM_MAX_TOKENS | 否 | 500 | 最大输出 token 数 |
| LLM_TEMPERATURE | 否 | 0.7 | 温度参数 |

### 过滤规则配置

配置文件: \`config/filter-rules.json\`

- **positiveExamples**: 正面样例(至少 1 个),表示你想看到的新闻类型
- **negativeExamples**: 反面样例(至少 1 个),表示你不想看到的新闻类型
- **keywords**: 关键词列表(可选),用于初筛
- **thresholdConfig**: 阈值配置
  - \`minPercentage\`: 最少保留百分比(默认 10%)
  - \`maxPercentage\`: 最多保留百分比(默认 30%)
  - \`preferredCount\`: 期望保留数量(默认 15 条)

### 样例要求

- 标题: 必填,1-200 字符
- 摘要: 必填,**100-200 字符**(严格要求)
- 理由: 可选,说明为什么喜欢/不喜欢

## 成本估算

使用 DeepSeek API 的成本极低:

- Input tokens: $0.27 / 1M tokens
- Output tokens: $1.10 / 1M tokens
- Cache hit tokens: $0.027 / 1M tokens (仅 10%)

**预估成本**: 每次采集 10 条新闻并评分,成本约 **$0.01-0.02**

## 常见问题

### 1. 如何修改采集的网站?

目前仅支持 AIBase。如需添加其他数据源,需要:
1. 在 \`src/collectors/\` 创建新的采集器
2. 在 \`src/config/datasources.js\` 注册数据源

### 2. 为什么采集不到新闻?

可能的原因:
- AIBase 网站结构发生变化
- 网络连接问题
- HTML 选择器需要更新

可以查看日志获取详细错误信息。

### 3. LLM 评分失败怎么办?

检查:
1. \`DEEPSEEK_API_KEY\` 是否正确
2. API 密钥是否有余额
3. 网络是否可以访问 DeepSeek API

### 4. 如何调整过滤阈值?

编辑 \`config/filter-rules.json\` 中的 \`thresholdConfig\`:
- 想要更多新闻: 增大 \`maxPercentage\` 或 \`preferredCount\`
- 想要更少但更精准: 减小 \`minPercentage\` 或 \`preferredCount\`

## 技术栈

- **运行时**: Node.js 18+ (ESM)
- **LLM**: DeepSeek API (使用 OpenAI SDK)
- **网页抓取**: Cheerio + Axios
- **工具库**: dotenv, string-similarity

## 开发

### 调试模式

设置环境变量 \`DEBUG=1\` 可以查看更详细的日志。

### 添加新的数据源

1. 继承 \`BaseCollector\` 类
2. 实现 \`collect()\` 方法
3. 返回 \`NewsItem[]\` 数组
4. 在 \`datasources.js\` 注册

## License

MIT

## 支持

如有问题,请在 GitHub Issues 提交反馈。

