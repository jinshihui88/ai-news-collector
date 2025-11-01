# 技术决策研究文档

## 1. LLM SDK 选择

### Decision: DeepSeek API (使用 OpenAI SDK)

选择 DeepSeek API 作为主要的 LLM 提供商,使用 OpenAI SDK 进行调用(DeepSeek API 兼容 OpenAI 格式)。

### Rationale

1. **极致性价比**
   - **超低成本**: DeepSeek-V3.1 是目前市场上最具性价比的高性能 LLM
   - **Prompt Cache**: 支持 prompt caching,命中缓存的 token 成本更低
   - **128K 上下文**: 支持超长上下文,适合处理多个新闻样例

2. **OpenAI 兼容性**
   - 完全兼容 OpenAI API 格式,可以直接使用 `openai` npm 包
   - 代码迁移成本极低,只需修改 `baseURL` 和 `apiKey`
   - 支持所有标准功能: JSON Mode, Function Calling, Streaming

3. **强大的功能支持**
   - **deepseek-chat**: 通用聊天模型(非思考模式),速度快,成本低
   - **deepseek-reasoner**: 思考模式,推理能力更强(可选)
   - 支持 Function Calling,方便未来扩展
   - 默认 4K 输出,最大支持 8K(Beta)

4. **健壮的错误处理**
   - 与 OpenAI SDK 相同的重试机制
   - 支持自定义超时配置
   - 提供详细的 usage 统计(包括 cache hit/miss tokens)

### Alternatives Considered

1. **Anthropic Claude**
   - **优点**:
     - 推理能力强,输出质量高
     - Prompt caching 成本节省显著
   - **缺点**:
     - 价格相对较高
     - 对于新闻评分这样的简单任务可能过度

2. **OpenAI GPT-4**
   - **优点**:
     - 生态系统成熟,文档丰富
     - API 稳定性好
   - **缺点**:
     - 成本最高
     - 对预算敏感的项目不友好

3. **本地开源模型**
   - **优点**:
     - 完全免费
     - 数据隐私好
   - **缺点**:
     - 需要 GPU 资源
     - 性能可能不足
     - 运维成本高

### Implementation Notes

```javascript
// 安装依赖
npm install openai

// 基本配置
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});

// 基本调用示例
async function scoreNewsItem(newsItem, examples) {
  const completion = await client.chat.completions.create({
    model: 'deepseek-chat', // 或 'deepseek-reasoner' 用于更强推理
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(examples) // 用户样例,可被缓存
      },
      {
        role: 'user',
        content: `评估以下新闻:\n标题: ${newsItem.title}\n摘要: ${newsItem.summary}`
      }
    ],
    temperature: 0.7,
    max_tokens: 500,
    response_format: { type: 'json_object' }, // JSON Mode
  });

  return JSON.parse(completion.choices[0].message.content);
}

// 批量评分建议实现
async function batchScore(newsItems, examples) {
  const batchSize = 10; // 控制并发数
  const results = [];

  for (let i = 0; i < newsItems.length; i += batchSize) {
    const batch = newsItems.slice(i, i + batchSize);
    const promises = batch.map(item => scoreNewsItem(item, examples));

    try {
      const batchResults = await Promise.allSettled(promises);
      results.push(...batchResults);
    } catch (error) {
      console.error(`Batch ${i}-${i+batchSize} failed:`, error);
      // 继续处理下一批,不中断整个流程
    }
  }

  return results;
}

// 查看 token 使用情况(包括缓存命中)
const usage = completion.usage;
console.log({
  prompt_tokens: usage.prompt_tokens,
  completion_tokens: usage.completion_tokens,
  cache_hit_tokens: usage.prompt_cache_hit_tokens,
  cache_miss_tokens: usage.prompt_cache_miss_tokens,
  total_tokens: usage.total_tokens
});
```

**成本优化策略**:
- 将用户样例放在系统提示中,利用 prompt caching 降低重复调用成本
- 使用 JSON Mode 确保输出格式正确,减少解析失败重试
- 控制 `max_tokens` 在 200-500 范围,避免不必要的长输出
- 监控 `prompt_cache_hit_tokens`,确保缓存正常工作
- 批量并发处理,提高吞吐量

**模型选择建议**:
- **推荐使用 `deepseek-chat`**: 适合新闻评分任务,速度快,成本低
- **可选 `deepseek-reasoner`**: 如果需要更深入的推理分析(如复杂的内容理解)

**环境变量配置**:
```bash
# .env 文件
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 2. 测试框架选择

### Decision: Vitest

选择 Vitest 作为测试框架。

### Rationale

1. **性能优势**
   - 冷启动速度比 Jest 快 4 倍
   - 内存占用降低约 30% (在 50K 行代码库中 Jest 1.2GB vs Vitest 800MB)
   - 基于 Vite 的优化构建管道,测试执行更快

2. **原生 ESM 支持**
   - 项目使用 `"type": "module"`,Vitest 原生支持 ESM
   - 避免 CommonJS/ESM 互操作问题
   - Jest 配置 ESM 需要额外设置(Babel 等)

3. **现代化开发体验**
   - TypeScript、JSX、PostCSS 开箱即用
   - 热重载支持,测试即时更新
   - 与 Jest 兼容的 API,迁移成本低

4. **CLI 工具友好**
   - 简洁的配置
   - 良好的异步测试支持
   - 清晰的测试报告输出

### Alternatives Considered

1. **Jest**
   - **优点**:
     - 生态系统成熟,插件丰富
     - 零配置体验(对 CommonJS 项目)
     - 社区资源丰富
   - **缺点**:
     - ESM 支持需要额外配置
     - 性能相对较慢
     - 内存占用较高

2. **Mocha + Chai**
   - **优点**:
     - 灵活性极高
     - 可自定义测试栈
   - **缺点**:
     - 需要组合多个库(断言、mock、覆盖率)
     - 配置复杂
     - 学习成本高

3. **Node.js 原生 test runner**
   - **优点**:
     - 无需额外依赖
     - Node.js 18+ 内置
   - **缺点**:
     - 功能有限
     - 生态系统不成熟
     - 缺少快照测试等高级功能

### Implementation Notes

```javascript
// 安装依赖
npm install -D vitest

// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/']
    },
    // CLI 工具特定配置
    testTimeout: 10000, // 10秒超时
    hookTimeout: 10000,
  }
});

// package.json scripts
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}

// 示例测试文件: src/collector/collector.test.js
import { describe, it, expect, vi } from 'vitest';
import { collectNews } from './collector.js';

describe('News Collector', () => {
  it('should collect news from all sources', async () => {
    const news = await collectNews();
    expect(news).toBeInstanceOf(Array);
    expect(news.length).toBeGreaterThan(0);
  });

  it('should handle source failures gracefully', async () => {
    // Mock 失败的数据源
    vi.mock('./sources/aibase.js', () => ({
      fetchAIBaseNews: vi.fn().mockRejectedValue(new Error('Network error'))
    }));

    const news = await collectNews();
    // 应该继续处理其他数据源
    expect(news).toBeDefined();
  });
});
```

**测试策略**:
- 单元测试: 测试各个数据源采集器、过滤器、配置解析器
- 集成测试: 测试完整的采集-过滤-输出流程
- Mock 外部依赖: 使用 `vi.mock()` mock HTTP 请求和 LLM API
- 快照测试: 验证 Markdown 输出格式

---

## 3. 网页抓取最佳实践

### Decision: 混合策略 - Cheerio 为主,按需使用 Puppeteer

对于 AIBase 等大部分网站使用 Cheerio,对需要 JavaScript 渲染的特殊情况使用 Puppeteer。

### Rationale

1. **性能考虑**
   - Cheerio 比 Puppeteer 快 8-12 倍
   - 轻量级,内存占用低
   - 适合大批量、高频采集场景

2. **AIBase 网站特性分析**
   - AIBase (https://www.aibase.com/zh) 主要内容是服务器端渲染的 HTML
   - 新闻列表页面结构相对静态
   - 使用 Cheerio 可以满足基本需求

3. **动态内容处理**
   - 对于需要 JavaScript 渲染的特殊页面,按需启动 Puppeteer
   - 使用 `puppeteer-extra-plugin-stealth` 规避反爬虫检测
   - 实现降级策略:优先 Cheerio,失败时切换到 Puppeteer

### Alternatives Considered

1. **纯 Puppeteer 方案**
   - **优点**:
     - 处理所有类型网站,包括 SPA
     - 可模拟用户行为
     - 支持截图、PDF 生成等高级功能
   - **缺点**:
     - 启动慢,资源占用高
     - 对简单 HTML 解析过度设计
     - 成本高(CPU、内存、时间)

2. **纯 Cheerio 方案**
   - **优点**:
     - 极致性能
     - 简单直接
   - **缺点**:
     - 无法处理动态内容
     - 对复杂 JavaScript 应用无能为力

### Implementation Notes

```javascript
// 安装依赖
npm install cheerio axios
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth

// src/scraper/aibase.js
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// Cheerio 抓取(首选方案)
async function scrapeWithCheerio(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      timeout: 10000 // 10秒超时
    });

    const $ = cheerio.load(data);
    const news = [];

    // 解析新闻列表(需要根据实际 HTML 结构调整选择器)
    $('.news-item').each((i, elem) => {
      if (i >= 10) return false; // 只取前10条

      news.push({
        title: $(elem).find('.title').text().trim(),
        summary: $(elem).find('.summary').text().trim(),
        url: $(elem).find('a').attr('href'),
        source: 'AIBase'
      });
    });

    return news;
  } catch (error) {
    console.error('Cheerio scraping failed:', error.message);
    throw error;
  }
}

// Puppeteer 抓取(降级方案)
async function scrapeWithPuppeteer(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 设置视口和用户代理
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 等待内容加载
    await page.waitForSelector('.news-item', { timeout: 10000 });

    // 提取数据
    const news = await page.evaluate(() => {
      const items = document.querySelectorAll('.news-item');
      return Array.from(items).slice(0, 10).map(item => ({
        title: item.querySelector('.title')?.textContent.trim(),
        summary: item.querySelector('.summary')?.textContent.trim(),
        url: item.querySelector('a')?.href,
        source: 'AIBase'
      }));
    });

    return news;
  } finally {
    if (browser) await browser.close();
  }
}

// 智能抓取策略
export async function scrapeAIBase() {
  const url = 'https://www.aibase.com/zh/news';

  try {
    // 优先使用 Cheerio
    console.log('[AIBase] Attempting Cheerio scraping...');
    return await scrapeWithCheerio(url);
  } catch (cheerioError) {
    console.warn('[AIBase] Cheerio failed, falling back to Puppeteer');

    try {
      return await scrapeWithPuppeteer(url);
    } catch (puppeteerError) {
      console.error('[AIBase] Both methods failed:', {
        cheerio: cheerioError.message,
        puppeteer: puppeteerError.message
      });
      return []; // 返回空数组,不阻塞其他数据源
    }
  }
}
```

**反爬虫对策**:
1. **User-Agent 轮换**: 使用真实浏览器的 User-Agent
2. **请求延迟**: 在请求之间添加随机延迟(1-3秒)
3. **Stealth 插件**: Puppeteer 使用 stealth 插件隐藏自动化特征
4. **代理支持**(可选): 必要时使用代理池
5. **Cookie 管理**: 保存和重用 cookies 模拟会话

**错误处理策略**:
1. 超时控制: Cheerio 10秒, Puppeteer 30秒
2. 失败降级: Cheerio → Puppeteer → 返回空数组
3. 日志记录: 详细记录失败原因和上下文
4. 重试机制: 对网络错误实现指数退避重试

**维护建议**:
- 定期检查目标网站的 HTML 结构变化
- 使用环境变量配置选择器,便于快速更新
- 实现选择器验证测试,及时发现结构变更

---

## 4. Composio SDK 集成

### Decision: 使用 @composio/core + 按需自定义 API 集成

对于 Composio 支持的平台(Twitter)使用 SDK,对于不支持的平台(飞书、公众号)使用自定义 API 集成。

### Rationale

1. **Composio SDK 能力**
   - 支持 100+ 工具集成,包括 Twitter
   - 统一的认证管理(OAuth、API Key、Basic Auth)
   - 内置工具定义和执行端点
   - 安全的认证处理

2. **平台覆盖情况**
   - ✅ **Twitter**: Composio 原生支持,75+ 社交自动化工具
   - ❌ **飞书 (Feishu)**: 未在 Composio 文档中明确支持
   - ❌ **微信公众号**: 未在 Composio 文档中明确支持
   - ⚠️ **知识星球**: 需要验证是否支持

3. **混合策略优势**
   - 利用 Composio 的认证和 API 管理能力
   - 对不支持的平台使用官方 SDK 或 HTTP 客户端
   - 保持代码的统一性和可维护性

### Alternatives Considered

1. **完全不使用 Composio**
   - **优点**:
     - 完全控制所有 API 调用
     - 减少依赖
   - **缺点**:
     - 需要自行处理认证流程
     - 重复实现各平台的 OAuth 逻辑
     - 维护成本高

2. **完全依赖 Composio**
   - **优点**:
     - 统一的接口
     - 简化认证
   - **缺点**:
     - 受限于平台支持范围
     - 飞书和公众号无法使用
     - 可能存在功能限制

### Implementation Notes

```javascript
// 安装依赖
npm install @composio/core
npm install @larksuiteoapi/node-sdk  // 飞书官方 SDK
npm install wechat-api              // 微信公众号 SDK

// src/platforms/index.js
import { Composio } from '@composio/core';

// Composio 客户端初始化
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY
});

// Twitter 集成(使用 Composio)
export async function fetchTwitterNews(query) {
  try {
    // 获取 Twitter 工具
    const twitter = composio.getToolkit('twitter');

    // 搜索推文
    const result = await twitter.execute('TWITTER_SEARCH_TWEETS', {
      query: query || 'AI news',
      count: 10,
      result_type: 'recent'
    });

    return result.data.statuses.map(tweet => ({
      title: tweet.text.substring(0, 100),
      summary: tweet.text,
      url: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
      source: 'Twitter',
      createdAt: new Date(tweet.created_at)
    }));
  } catch (error) {
    console.error('[Twitter] Fetch failed:', error);
    return [];
  }
}

// 飞书文档集成(使用官方 SDK)
import * as lark from '@larksuiteoapi/node-sdk';

export async function fetchFeishuDocs() {
  try {
    const client = new lark.Client({
      appId: process.env.FEISHU_APP_ID,
      appSecret: process.env.FEISHU_APP_SECRET
    });

    // 获取文档列表
    const res = await client.drive.file.list({
      page_size: 10,
      folder_token: process.env.FEISHU_FOLDER_TOKEN
    });

    // 解析文档内容
    const news = [];
    for (const file of res.data.files) {
      if (file.type === 'doc') {
        const content = await client.docx.document.get({
          document_id: file.token
        });

        news.push({
          title: file.name,
          summary: extractSummary(content.data.document.body),
          url: file.url,
          source: 'Feishu',
          createdAt: new Date(file.created_time * 1000)
        });
      }
    }

    return news.slice(0, 10);
  } catch (error) {
    console.error('[Feishu] Fetch failed:', error);
    return [];
  }
}

// 微信公众号集成(使用第三方 SDK)
import WechatAPI from 'wechat-api';

export async function fetchWeChatArticles() {
  try {
    const api = new WechatAPI(
      process.env.WECHAT_APP_ID,
      process.env.WECHAT_APP_SECRET
    );

    // 获取素材列表
    const result = await new Promise((resolve, reject) => {
      api.getMaterials('news', 0, 10, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const news = [];
    for (const item of result.item) {
      const article = item.content.news_item[0]; // 取首条图文
      news.push({
        title: article.title,
        summary: article.digest,
        url: article.url,
        source: 'WeChat',
        createdAt: new Date(item.update_time * 1000)
      });
    }

    return news;
  } catch (error) {
    console.error('[WeChat] Fetch failed:', error);
    return [];
  }
}

// 统一的数据源接口
export async function fetchAllSources() {
  const sources = [
    { name: 'AIBase', fetcher: scrapeAIBase },
    { name: 'Twitter', fetcher: fetchTwitterNews },
    { name: 'Feishu', fetcher: fetchFeishuDocs },
    { name: 'WeChat', fetcher: fetchWeChatArticles }
  ];

  const results = await Promise.allSettled(
    sources.map(async ({ name, fetcher }) => {
      console.log(`[${name}] Fetching...`);
      const news = await fetcher();
      console.log(`[${name}] Fetched ${news.length} items`);
      return { name, news };
    })
  );

  // 合并所有成功的结果
  const allNews = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allNews.push(...result.value.news);
    } else {
      console.error(`Source failed:`, result.reason);
    }
  }

  return allNews;
}
```

**认证配置(.env)**:
```bash
# Composio
COMPOSIO_API_KEY=ak_zssWrBBvYsgT5QMFO1Hr

# Twitter (通过 Composio 管理)
# 在 Composio 控制台配置 Twitter OAuth

# 飞书
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_FOLDER_TOKEN=your_folder_token

# 微信公众号
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret
```

**错误处理和重试**:
1. **超时设置**: 每个平台独立的超时配置
2. **重试策略**:
   - 网络错误: 指数退避,最多 3 次
   - 认证错误: 不重试,记录错误
   - 速率限制: 根据 Retry-After header 等待
3. **降级策略**: 单个平台失败不影响其他平台
4. **错误日志**: 记录详细的错误上下文,包括请求参数和响应

**API 限制和最佳实践**:
- **Twitter**: 15分钟窗口内限制,注意速率控制
- **飞书**: 注意租户级别的 QPS 限制
- **微信公众号**: 每日调用次数有限,建议缓存结果
- **实现请求队列**: 控制并发数,避免触发限流

**维护建议**:
- 定期检查 Composio 文档,了解新增的平台支持
- 监控各平台 API 的变更通知
- 实现健康检查,及时发现认证过期或 API 失效
- 考虑实现 fallback 机制,当某个平台长期不可用时临时禁用

---

## 5. 去重算法选择

### Decision: 三层去重策略

1. **URL 精确匹配**(第一层,100% 准确)
2. **标题相似度检测**(第二层,使用编辑距离)
3. **内容语义相似度**(第三层,使用 MinHash 或 LLM 嵌入)

### Rationale

1. **准确率要求**
   - 需要达到 95% 以上的准确率
   - 单一算法难以满足所有场景
   - 多层策略可以平衡准确率和性能

2. **性能考虑**
   - URL 匹配: O(1) 复杂度,极快
   - 编辑距离: O(n*m) 复杂度,适合短文本
   - MinHash: O(n) 预计算,O(1) 查询,适合大规模

3. **实际场景分析**
   - 相同新闻可能有不同 URL(不同平台转发)
   - 标题可能略有差异(增删标点、修改措辞)
   - 内容核心相同但表述不同

### Alternatives Considered

1. **纯 SimHash 方案**
   - **优点**:
     - 速度快,内存占用低
     - Google 在 2007 年使用于网页去重
   - **缺点**:
     - 对差异容忍度低(Hamming 距离限制在 3-7)
     - 不适合短文本(新闻标题通常较短)
     - 准确率可能不足 95%

2. **纯余弦相似度方案**
   - **优点**:
     - 语义理解较好
     - 适合文本相似度计算
   - **缺点**:
     - 需要向量化,计算成本高
     - 对于简单的完全重复检测过度设计

3. **纯 LLM 嵌入方案**
   - **优点**:
     - 语义理解最强
     - 可以识别改写的重复内容
   - **缺点**:
     - API 调用成本高
     - 延迟大
     - 对于大量数据不现实

### Implementation Notes

```javascript
// 安装依赖
npm install string-similarity
npm install js-sha3  // 用于 MinHash
// 或使用更现代的库
npm install cmpstr   // 2025 年重新设计,支持多种算法

// src/deduplication/index.js
import { compareTwoStrings } from 'string-similarity';
import crypto from 'crypto';

// 第一层: URL 精确匹配
class URLDeduplicator {
  constructor() {
    this.seenURLs = new Set();
  }

  isDuplicate(url) {
    // 标准化 URL(去除查询参数、锚点等)
    const normalized = this.normalizeURL(url);

    if (this.seenURLs.has(normalized)) {
      return true;
    }

    this.seenURLs.add(normalized);
    return false;
  }

  normalizeURL(url) {
    try {
      const parsed = new URL(url);
      // 移除查询参数和锚点
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url; // 如果解析失败,使用原始 URL
    }
  }
}

// 第二层: 标题相似度(编辑距离 + 余弦相似度)
class TitleDeduplicator {
  constructor(threshold = 0.85) {
    this.threshold = threshold; // 相似度阈值
    this.seenTitles = [];
  }

  isDuplicate(title) {
    const normalized = this.normalizeTitle(title);

    for (const seen of this.seenTitles) {
      const similarity = compareTwoStrings(normalized, seen);

      if (similarity >= this.threshold) {
        return true;
      }
    }

    this.seenTitles.push(normalized);
    return false;
  }

  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '') // 只保留中文、英文、数字
      .trim();
  }
}

// 第三层: 内容语义相似度(MinHash)
class ContentDeduplicator {
  constructor(numHashes = 128, threshold = 0.7) {
    this.numHashes = numHashes;
    this.threshold = threshold;
    this.seenHashes = [];
  }

  isDuplicate(content) {
    const hash = this.minHash(content);

    for (const seen of this.seenHashes) {
      const similarity = this.jaccardSimilarity(hash, seen);

      if (similarity >= this.threshold) {
        return true;
      }
    }

    this.seenHashes.push(hash);
    return false;
  }

  minHash(text) {
    // 使用 shingling 技术生成 n-gram
    const shingles = this.generateShingles(text, 3);

    // 生成 MinHash 签名
    const signature = [];
    for (let i = 0; i < this.numHashes; i++) {
      let minHash = Infinity;

      for (const shingle of shingles) {
        const hash = this.hashString(`${i}-${shingle}`);
        minHash = Math.min(minHash, hash);
      }

      signature.push(minHash);
    }

    return signature;
  }

  generateShingles(text, k = 3) {
    const normalized = text.toLowerCase().replace(/\s+/g, '');
    const shingles = new Set();

    for (let i = 0; i <= normalized.length - k; i++) {
      shingles.add(normalized.substring(i, i + k));
    }

    return shingles;
  }

  hashString(str) {
    const hash = crypto.createHash('md5').update(str).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  jaccardSimilarity(hash1, hash2) {
    let matches = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }
    return matches / hash1.length;
  }
}

// 统一的去重管道
export class DeduplicationPipeline {
  constructor(config = {}) {
    this.urlDedup = new URLDeduplicator();
    this.titleDedup = new TitleDeduplicator(config.titleThreshold || 0.85);
    this.contentDedup = new ContentDeduplicator(
      config.numHashes || 128,
      config.contentThreshold || 0.7
    );

    this.stats = {
      total: 0,
      urlDuplicates: 0,
      titleDuplicates: 0,
      contentDuplicates: 0,
      unique: 0
    };
  }

  isDuplicate(newsItem) {
    this.stats.total++;

    // 第一层: URL 检查
    if (this.urlDedup.isDuplicate(newsItem.url)) {
      this.stats.urlDuplicates++;
      return { isDuplicate: true, reason: 'url' };
    }

    // 第二层: 标题检查
    if (this.titleDedup.isDuplicate(newsItem.title)) {
      this.stats.titleDuplicates++;
      return { isDuplicate: true, reason: 'title' };
    }

    // 第三层: 内容检查
    const content = `${newsItem.title} ${newsItem.summary}`;
    if (this.contentDedup.isDuplicate(content)) {
      this.stats.contentDuplicates++;
      return { isDuplicate: true, reason: 'content' };
    }

    this.stats.unique++;
    return { isDuplicate: false, reason: null };
  }

  deduplicate(newsItems) {
    const unique = [];
    const duplicates = [];

    for (const item of newsItems) {
      const result = this.isDuplicate(item);

      if (result.isDuplicate) {
        duplicates.push({ ...item, duplicateReason: result.reason });
      } else {
        unique.push(item);
      }
    }

    console.log('[Deduplication] Stats:', this.stats);
    console.log(`[Deduplication] Accuracy: ${(this.stats.unique / this.stats.total * 100).toFixed(2)}%`);

    return { unique, duplicates };
  }

  getStats() {
    return this.stats;
  }
}

// 使用示例
export async function deduplicateNews(newsItems) {
  const pipeline = new DeduplicationPipeline({
    titleThreshold: 0.85,    // 标题相似度阈值
    contentThreshold: 0.7,   // 内容相似度阈值
    numHashes: 128           // MinHash 签名长度
  });

  const { unique, duplicates } = pipeline.deduplicate(newsItems);

  console.log(`Total: ${newsItems.length}`);
  console.log(`Unique: ${unique.length}`);
  console.log(`Duplicates: ${duplicates.length}`);
  console.log(`Deduplication rate: ${(duplicates.length / newsItems.length * 100).toFixed(2)}%`);

  return unique;
}
```

**性能优化**:

1. **早期退出**: 按照从快到慢的顺序检查(URL → 标题 → 内容)
2. **批量处理**: 对大量数据使用批处理和并行计算
3. **缓存机制**: 缓存已计算的哈希值,避免重复计算
4. **增量更新**: 支持增量添加新闻,不需要每次全量处理

**准确率验证**:

```javascript
// 测试用例
import { describe, it, expect } from 'vitest';

describe('Deduplication Pipeline', () => {
  it('should detect exact URL duplicates', () => {
    const pipeline = new DeduplicationPipeline();
    const news = [
      { url: 'https://example.com/news/1', title: 'Title 1', summary: 'Summary 1' },
      { url: 'https://example.com/news/1', title: 'Title 2', summary: 'Summary 2' }
    ];

    const { unique } = pipeline.deduplicate(news);
    expect(unique.length).toBe(1);
  });

  it('should detect similar titles', () => {
    const pipeline = new DeduplicationPipeline();
    const news = [
      { url: 'https://a.com/1', title: 'OpenAI发布GPT-5模型', summary: 'Summary 1' },
      { url: 'https://b.com/2', title: 'OpenAI 发布 GPT-5 模型!!!', summary: 'Summary 2' }
    ];

    const { unique } = pipeline.deduplicate(news);
    expect(unique.length).toBe(1);
  });

  it('should detect similar content', () => {
    const pipeline = new DeduplicationPipeline();
    const news = [
      { url: 'https://a.com/1', title: 'AI News', summary: 'OpenAI今天发布了最新的GPT-5模型,性能提升显著' },
      { url: 'https://b.com/2', title: 'Latest AI', summary: 'OpenAI最新发布GPT-5,模型性能大幅提升' }
    ];

    const { unique } = pipeline.deduplicate(news);
    expect(unique.length).toBe(1);
  });
});
```

**阈值调优建议**:
1. 收集真实数据集,手动标注重复/非重复
2. 使用不同阈值进行测试,计算精确率和召回率
3. 选择 F1-score 最高的阈值组合
4. 建议初始值:
   - 标题相似度: 0.85 (允许 15% 差异)
   - 内容相似度: 0.7 (允许 30% 差异)
   - MinHash 签名长度: 128 (平衡性能和准确率)

**实现注意事项**:
1. 对中文文本特殊处理(分词、去除停用词)
2. 对不同来源的新闻可能需要不同的阈值
3. 定期评估去重效果,根据反馈调整参数
4. 记录被去重的新闻,便于人工审核和算法改进

---

## 总结

以上技术决策形成了一个完整的技术栈:

```
AI新闻采集器技术架构
├── 运行环境: Node.js 18+ (ESM)
├── LLM: DeepSeek API (使用 OpenAI SDK,极致性价比)
├── 测试框架: Vitest (性能优异 + 原生 ESM)
├── 网页抓取: Cheerio (主) + Puppeteer (降级)
├── API 集成: Composio SDK (Twitter) + 官方 SDK (飞书、微信)
└── 去重算法: URL + 标题相似度 + 内容 MinHash (三层策略)
```

**依赖清单**:

```json
{
  "dependencies": {
    "@composio/core": "latest",
    "openai": "latest",
    "axios": "^1.13.1",
    "cheerio": "^1.1.2",
    "puppeteer": "latest",
    "puppeteer-extra": "latest",
    "puppeteer-extra-plugin-stealth": "latest",
    "@larksuiteoapi/node-sdk": "latest",
    "wechat-api": "latest",
    "string-similarity": "latest",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "vitest": "latest",
    "@vitest/coverage-v8": "latest"
  }
}
```

**预估性能指标**:
- 单次完整采集(5个数据源 × 10条): 30-60秒
- LLM 评分(50条新闻,DeepSeek): 15-30秒(更快,使用 prompt caching)
- 去重处理: < 1秒
- 总运行时间: 约 2-3 分钟
- 内存占用: < 500MB
- **成本估算**: 每次运行约 **$0.01-0.02** (DeepSeek 超低成本,使用 prompt caching)

**风险和缓解措施**:
1. **网站结构变更**: 实现选择器配置化,定期监控
2. **API 限流**: 实现请求队列和速率控制
3. **LLM 成本**: 使用 caching 和 batch API,监控 token 使用
4. **去重准确率**: 持续收集反馈,优化阈值参数
5. **依赖更新**: 锁定主版本号,测试后再升级
