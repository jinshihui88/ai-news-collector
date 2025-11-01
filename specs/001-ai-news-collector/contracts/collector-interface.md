# Collector Interface Contract

**Version**: 1.0
**Last Updated**: 2025-11-01

## 概述

定义所有数据源采集器必须实现的统一接口,确保模块化和可扩展性。

---

## 接口定义

### BaseCollector (抽象基类)

所有采集器必须继承或实现此接口。

#### 方法: `collect()`

**描述**: 从数据源采集新闻内容

**签名**:
```javascript
async collect(): Promise<NewsItem[]>
```

**返回值**:
- **类型**: `Promise<NewsItem[]>`
- **说明**: 返回标准化的新闻条目数组,最多 10 条

**错误处理**:
- **网络错误**: 实现重试机制(最多 3 次,指数退避)
- **超时**: 默认 30 秒超时,可配置
- **解析错误**: 跳过无效数据,继续处理其他条目
- **致命错误**: 抛出异常,由调用方捕获

**示例实现**:

```javascript
// src/collectors/base.js
export class BaseCollector {
  constructor(config) {
    this.config = config;
    this.maxRetries = 3;
    this.timeout = config.timeout || 30000;
  }

  /**
   * 采集新闻(子类必须实现)
   * @returns {Promise<NewsItem[]>}
   */
  async collect() {
    throw new Error('collect() must be implemented by subclass');
  }

  /**
   * 重试包装器
   * @param {Function} fn - 要重试的函数
   * @param {number} retries - 剩余重试次数
   * @returns {Promise<any>}
   */
  async retryWithBackoff(fn, retries = this.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) {
        throw error;
      }

      const delay = Math.pow(2, this.maxRetries - retries) * 1000;
      console.warn(`Retry after ${delay}ms, ${retries} attempts left`);
      await new Promise(resolve => setTimeout(resolve, delay));

      return this.retryWithBackoff(fn, retries - 1);
    }
  }

  /**
   * 验证新闻条目
   * @param {Object} item - 待验证的新闻条目
   * @returns {boolean}
   */
  validateNewsItem(item) {
    if (!item.title || item.title.trim().length === 0) {
      return false;
    }
    if (!item.url || !this.isValidURL(item.url)) {
      return false;
    }
    if (!item.createdAt) {
      return false;
    }
    return true;
  }

  /**
   * 验证 URL 格式
   * @param {string} url
   * @returns {boolean}
   */
  isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 具体实现规范

### AIBase Collector

**文件**: `src/collectors/aibase.js`

**配置参数**:
```javascript
{
  "name": "AIBase",
  "type": "web",
  "config": {
    "url": "https://www.aibase.com/zh/news",
    "selectors": {
      "item": ".news-item",
      "title": ".title",
      "summary": ".summary",
      "link": "a"
    }
  },
  "maxItems": 10,
  "timeout": 30000
}
```

**实现要点**:
- 使用 Cheerio 进行 HTML 解析(首选)
- 失败时降级到 Puppeteer
- 提取字段: title, summary, url
- 生成 createdAt(使用当前时间或解析页面时间)
- source 固定为 "AIBase"

**示例代码**:
```javascript
import { BaseCollector } from './base.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class AIBaseCollector extends BaseCollector {
  async collect() {
    return this.retryWithBackoff(async () => {
      const { data } = await axios.get(this.config.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        },
        timeout: this.timeout
      });

      const $ = cheerio.load(data);
      const news = [];

      $(this.config.selectors.item).each((i, elem) => {
        if (i >= this.config.maxItems) return false;

        const item = {
          id: crypto.randomUUID(),
          title: $(elem).find(this.config.selectors.title).text().trim(),
          summary: $(elem).find(this.config.selectors.summary).text().trim(),
          url: $(elem).find(this.config.selectors.link).attr('href'),
          source: 'AIBase',
          createdAt: new Date(),
          fetchedAt: new Date()
        };

        if (this.validateNewsItem(item)) {
          news.push(item);
        }
      });

      return news;
    });
  }
}
```

---

### Twitter Collector

**文件**: `src/collectors/twitter.js`

**配置参数**:
```javascript
{
  "name": "Twitter",
  "type": "api",
  "config": {
    "query": "AI news -filter:retweets lang:en OR lang:zh",
    "resultType": "recent",
    "composioToolkit": "twitter"
  },
  "maxItems": 10,
  "timeout": 30000
}
```

**实现要点**:
- 使用 Composio SDK 调用 Twitter API
- 搜索关键词: "AI news"
- 过滤转发(避免重复)
- 提取推文文本作为 title 和 summary
- 生成推文 URL

---

### Feishu Collector

**文件**: `src/collectors/feishu.js`

**配置参数**:
```javascript
{
  "name": "Feishu",
  "type": "sdk",
  "config": {
    "appId": "env:FEISHU_APP_ID",
    "appSecret": "env:FEISHU_APP_SECRET",
    "folderToken": "env:FEISHU_FOLDER_TOKEN"
  },
  "maxItems": 10,
  "timeout": 30000
}
```

**实现要点**:
- 使用飞书官方 SDK
- 从指定文件夹获取文档列表
- 提取文档标题和内容摘要
- 生成飞书文档链接

---

### WeChat Collector

**文件**: `src/collectors/wechat.js`

**配置参数**:
```javascript
{
  "name": "WeChat",
  "type": "sdk",
  "config": {
    "appId": "env:WECHAT_APP_ID",
    "appSecret": "env:WECHAT_APP_SECRET"
  },
  "maxItems": 10,
  "timeout": 30000
}
```

**实现要点**:
- 使用微信公众号 SDK
- 获取素材列表(类型: news)
- 提取图文消息标题、摘要、链接
- 处理发布时间

---

### Zhishi Collector

**文件**: `src/collectors/zhishi.js`

**配置参数**:
```javascript
{
  "name": "Zhishi",
  "type": "api",
  "config": {
    "planetId": "env:ZHISHI_PLANET_ID",
    "cookie": "env:ZHISHI_COOKIE"
  },
  "maxItems": 10,
  "timeout": 30000
}
```

**实现要点**:
- 使用知识星球 API(需要 Cookie 认证)
- 获取星球最新帖子
- 提取标题、摘要、链接
- 处理发布时间

---

## 注册采集器

**文件**: `src/collectors/index.js`

```javascript
import { AIBaseCollector } from './aibase.js';
import { TwitterCollector } from './twitter.js';
import { FeishuCollector } from './feishu.js';
import { WeChatCollector } from './wechat.js';
import { ZhishiCollector } from './zhishi.js';

/**
 * 采集器注册表
 */
export const COLLECTORS = {
  'AIBase': AIBaseCollector,
  'Twitter': TwitterCollector,
  'Feishu': FeishuCollector,
  'WeChat': WeChatCollector,
  'Zhishi': ZhishiCollector
};

/**
 * 创建采集器实例
 * @param {Object} config - 数据源配置
 * @returns {BaseCollector}
 */
export function createCollector(config) {
  const CollectorClass = COLLECTORS[config.name];

  if (!CollectorClass) {
    throw new Error(`Unknown collector: ${config.name}`);
  }

  return new CollectorClass(config);
}

/**
 * 从所有数据源采集新闻
 * @param {Array<Object>} sources - 数据源配置数组
 * @returns {Promise<NewsItem[]>}
 */
export async function collectFromAllSources(sources) {
  const results = await Promise.allSettled(
    sources
      .filter(s => s.enabled)
      .map(async (source) => {
        console.log(`[${source.name}] Starting collection...`);
        const collector = createCollector(source);

        try {
          const news = await collector.collect();
          console.log(`[${source.name}] Collected ${news.length} items`);
          return { source: source.name, news };
        } catch (error) {
          console.error(`[${source.name}] Collection failed:`, error.message);
          return { source: source.name, news: [], error: error.message };
        }
      })
  );

  const allNews = [];
  const errors = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { source, news, error } = result.value;

      if (error) {
        errors.push({ source, error });
      } else {
        allNews.push(...news);
      }
    } else {
      errors.push({ source: 'unknown', error: result.reason.message });
    }
  }

  console.log(`\n[Collection Summary]`);
  console.log(`Total collected: ${allNews.length} items`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.warn(`\n[Collection Errors]`);
    errors.forEach(({ source, error }) => {
      console.warn(`  - ${source}: ${error}`);
    });
  }

  return allNews;
}
```

---

## 测试契约

每个采集器必须通过以下测试:

### 单元测试

```javascript
import { describe, it, expect, vi } from 'vitest';
import { AIBaseCollector } from './aibase.js';

describe('AIBaseCollector', () => {
  it('should return array of NewsItem', async () => {
    const config = {
      url: 'https://www.aibase.com/zh/news',
      selectors: { /* ... */ },
      maxItems: 10,
      timeout: 30000
    };

    const collector = new AIBaseCollector(config);
    const news = await collector.collect();

    expect(news).toBeInstanceOf(Array);
    expect(news.length).toBeLessThanOrEqual(10);
  });

  it('should validate required fields', async () => {
    const collector = new AIBaseCollector(config);
    const news = await collector.collect();

    news.forEach(item => {
      expect(item.title).toBeTruthy();
      expect(item.url).toBeTruthy();
      expect(item.source).toBe('AIBase');
      expect(item.createdAt).toBeInstanceOf(Date);
    });
  });

  it('should handle network errors gracefully', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));

    const collector = new AIBaseCollector(config);

    await expect(collector.collect()).rejects.toThrow();
  });

  it('should retry on failure', async () => {
    const mockGet = vi.spyOn(axios, 'get')
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValueOnce({ data: '<html>...</html>' });

    const collector = new AIBaseCollector(config);
    const news = await collector.collect();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(news).toBeInstanceOf(Array);
  });
});
```

---

## 性能要求

| 指标 | 要求 |
|------|------|
| 单个数据源采集时间 | < 30 秒 |
| 最大重试次数 | 3 次 |
| 超时时间 | 30 秒(可配置) |
| 返回条目数 | ≤ 10 条 |
| 内存占用 | < 50MB per collector |

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0 | 2025-11-01 | 初始版本 |
