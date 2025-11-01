# Filter Interface Contract

**Version**: 1.0
**Last Updated**: 2025-11-01

## 概述

定义过滤器链的统一接口,支持关键词初筛、LLM 评分和去重等多种过滤策略。

---

## 接口定义

### BaseFilter (抽象基类)

所有过滤器必须继承或实现此接口。

#### 方法: `filter(newsItems)`

**描述**: 对新闻条目进行过滤

**签名**:
```javascript
async filter(newsItems: NewsItem[]): Promise<NewsItem[]>
```

**参数**:
- `newsItems`: 待过滤的新闻条目数组

**返回值**:
- **类型**: `Promise<NewsItem[]>`
- **说明**: 返回过滤后的新闻条目数组

**错误处理**:
- **单条失败**: 跳过该条,继续处理其他条目
- **致命错误**: 抛出异常,由调用方捕获

---

## 1. Keyword Filter (关键词初筛)

**文件**: `src/filters/keyword.js`

**用途**: 基于关键词快速过滤新闻,减少 LLM API 调用成本(目标: 减少 80% 数据量)

**契约**:

```javascript
/**
 * 关键词过滤器
 */
export class KeywordFilter {
  /**
   * @param {Array<string>} keywords - 关键词列表
   * @param {boolean} caseSensitive - 是否区分大小写(默认 false)
   */
  constructor(keywords, caseSensitive = false) {
    this.keywords = keywords.map(k =>
      caseSensitive ? k : k.toLowerCase()
    );
    this.caseSensitive = caseSensitive;
  }

  /**
   * 过滤新闻
   * @param {NewsItem[]} newsItems
   * @returns {Promise<NewsItem[]>}
   */
  async filter(newsItems) {
    const filtered = newsItems.filter(item => {
      const text = `${item.title} ${item.summary}`;
      const searchText = this.caseSensitive ? text : text.toLowerCase();

      return this.keywords.some(keyword => searchText.includes(keyword));
    });

    console.log(`[KeywordFilter] Filtered ${newsItems.length} → ${filtered.length} items`);
    console.log(`[KeywordFilter] Reduction rate: ${((1 - filtered.length / newsItems.length) * 100).toFixed(2)}%`);

    return filtered;
  }
}
```

**使用示例**:

```javascript
const keywords = ['AI', '人工智能', '机器学习', 'GPT', 'Claude'];
const filter = new KeywordFilter(keywords);

const filtered = await filter.filter(newsItems);
```

**性能要求**:
- 处理 50 条新闻 < 10ms
- 内存占用 < 1MB

---

## 2. LLM Filter (LLM 智能评分)

**文件**: `src/filters/llm.js`

**用途**: 使用 LLM 根据用户样例评估新闻质量

**契约**:

```javascript
import OpenAI from 'openai';

/**
 * LLM 评分过滤器 (使用 DeepSeek API)
 */
export class LLMFilter {
  /**
   * @param {FilterConfig} config - 过滤配置(包含正反面样例)
   * @param {Object} llmConfig - LLM 配置
   */
  constructor(config, llmConfig = {}) {
    this.config = config;
    this.model = llmConfig.model || 'deepseek-chat';
    this.batchSize = llmConfig.batchSize || 10;
    this.maxRetries = 3;
    this.timeout = 30000;

    // 初始化 DeepSeek 客户端
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY
    });
  }

  /**
   * 批量评分新闻
   * @param {NewsItem[]} newsItems
   * @returns {Promise<FilterResult[]>}
   */
  async filter(newsItems) {
    const results = [];

    // 批量处理
    for (let i = 0; i < newsItems.length; i += this.batchSize) {
      const batch = newsItems.slice(i, i + this.batchSize);

      console.log(`[LLMFilter] Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(newsItems.length / this.batchSize)}`);

      const batchResults = await Promise.allSettled(
        batch.map(item => this.scoreNewsItem(item))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`[LLMFilter] Scoring failed:`, result.reason.message);
        }
      }
    }

    console.log(`[LLMFilter] Scored ${results.length}/${newsItems.length} items`);

    return results;
  }

  /**
   * 评分单条新闻
   * @param {NewsItem} newsItem
   * @returns {Promise<FilterResult>}
   */
  async scoreNewsItem(newsItem) {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.buildSystemPrompt() // 系统提示包含用户样例,会被缓存
          },
          {
            role: 'user',
            content: this.buildPrompt(newsItem)
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' } // 使用 JSON Mode 确保格式正确
      });

      const parsed = JSON.parse(completion.choices[0].message.content);

      return {
        newsId: newsItem.id,
        score: parsed.score,
        isPassed: false, // 稍后由动态阈值过滤器设置
        reason: parsed.reason,
        evaluatedAt: new Date(),
        llmProvider: 'deepseek',
        llmModel: this.model,
        tokenUsage: {
          inputTokens: completion.usage.prompt_tokens,
          outputTokens: completion.usage.completion_tokens,
          cacheHitTokens: completion.usage.prompt_cache_hit_tokens || 0
        }
      };
    } catch (error) {
      console.error(`[LLMFilter] Failed to score news ${newsItem.id}:`, error.message);
      throw error;
    }
  }

  /**
   * 构建系统提示词(包含用户样例,用于缓存)
   * @returns {string}
   */
  buildSystemPrompt() {
    const positiveExamples = this.config.positiveExamples
      .map((ex, i) => `${i + 1}. 标题: ${ex.title}\n   摘要: ${ex.summary}\n   原因: ${ex.reason || '高质量内容'}`)
      .join('\n\n');

    const negativeExamples = this.config.negativeExamples
      .map((ex, i) => `${i + 1}. 标题: ${ex.title}\n   摘要: ${ex.summary}\n   原因: ${ex.reason || '低质量内容'}`)
      .join('\n\n');

    return `你是一个专业的新闻质量评估助手。根据用户提供的正面和反面样例,评估新闻的价值。

## 正面样例(高质量内容)
${positiveExamples}

## 反面样例(低质量内容)
${negativeExamples}

## 评分标准
- 10分: 完全符合用户偏好,内容有深度且有价值
- 7-9分: 比较符合用户偏好,内容较有价值
- 4-6分: 部分符合用户偏好,内容一般
- 1-3分: 不太符合用户偏好,内容价值较低
- 0分: 完全不符合用户偏好,无价值内容

## 输出格式
请以 JSON 格式输出评分结果:
{
  "score": <0-10的数字>,
  "reason": "<简短的评分理由,50-200字>"
}`;
  }

  /**
   * 构建用户提示词
   * @param {NewsItem} newsItem
   * @returns {string}
   */
  buildPrompt(newsItem) {
    return `请评估以下新闻的质量:

标题: ${newsItem.title}
摘要: ${newsItem.summary}
来源: ${newsItem.source}

请根据之前的正反面样例,对这条新闻进行评分。`;
  }

  /**
   * 解析 LLM 响应
   * @param {string} text - LLM 返回的文本
   * @returns {Object} { score: number, reason: string }
   */
  parseResponse(text) {
    try {
      // 尝试解析 JSON
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const json = JSON.parse(match[0]);
        return {
          score: Math.max(0, Math.min(10, parseFloat(json.score))),
          reason: json.reason || '未提供理由'
        };
      }
    } catch (error) {
      console.warn('[LLMFilter] Failed to parse JSON response, using fallback');
    }

    // 降级方案: 从文本中提取评分
    const scoreMatch = text.match(/(\d+(\.\d+)?)\s*分/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5.0;

    return {
      score: Math.max(0, Math.min(10, score)),
      reason: text.substring(0, 200)
    };
  }
}
```

**性能要求**:
- 单条评分 < 3 秒
- 批量评分(10条) < 15 秒
- 成本: 使用 prompt caching 降低 80%+ 成本

---

## 3. Deduplication Filter (去重过滤器)

**文件**: `src/filters/deduplicator.js`

**用途**: 三层去重策略(URL + 标题 + 内容)

**契约**:

```javascript
import { compareTwoStrings } from 'string-similarity';
import crypto from 'crypto';

/**
 * 去重过滤器
 */
export class DeduplicationFilter {
  /**
   * @param {Object} config - 去重配置
   */
  constructor(config = {}) {
    this.titleThreshold = config.titleThreshold || 0.85;
    this.contentThreshold = config.contentThreshold || 0.7;
    this.numHashes = config.numHashes || 128;

    this.seenURLs = new Set();
    this.seenTitles = [];
    this.seenHashes = [];
  }

  /**
   * 去重过滤
   * @param {NewsItem[]} newsItems
   * @returns {Promise<NewsItem[]>}
   */
  async filter(newsItems) {
    const unique = [];
    const stats = {
      total: newsItems.length,
      urlDuplicates: 0,
      titleDuplicates: 0,
      contentDuplicates: 0
    };

    for (const item of newsItems) {
      // 第一层: URL 去重
      const normalizedURL = this.normalizeURL(item.url);
      if (this.seenURLs.has(normalizedURL)) {
        stats.urlDuplicates++;
        continue;
      }

      // 第二层: 标题相似度
      if (this.isTitleDuplicate(item.title)) {
        stats.titleDuplicates++;
        continue;
      }

      // 第三层: 内容相似度
      const content = `${item.title} ${item.summary}`;
      if (this.isContentDuplicate(content)) {
        stats.contentDuplicates++;
        continue;
      }

      // 记录已见数据
      this.seenURLs.add(normalizedURL);
      this.seenTitles.push(this.normalizeTitle(item.title));
      this.seenHashes.push(this.minHash(content));

      unique.push(item);
    }

    console.log(`[Deduplication] Stats:`, stats);
    console.log(`[Deduplication] Unique: ${unique.length}/${newsItems.length}`);
    console.log(`[Deduplication] Deduplication rate: ${((1 - unique.length / newsItems.length) * 100).toFixed(2)}%`);

    return unique;
  }

  normalizeURL(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  normalizeTitle(title) {
    return title.toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/g, '').trim();
  }

  isTitleDuplicate(title) {
    const normalized = this.normalizeTitle(title);

    for (const seen of this.seenTitles) {
      const similarity = compareTwoStrings(normalized, seen);
      if (similarity >= this.titleThreshold) {
        return true;
      }
    }

    return false;
  }

  isContentDuplicate(content) {
    const hash = this.minHash(content);

    for (const seen of this.seenHashes) {
      const similarity = this.jaccardSimilarity(hash, seen);
      if (similarity >= this.contentThreshold) {
        return true;
      }
    }

    return false;
  }

  minHash(text) {
    const shingles = this.generateShingles(text, 3);
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
```

**性能要求**:
- 处理 50 条新闻 < 500ms
- 去重准确率 > 95%
- 内存占用 < 10MB

---

## 4. Threshold Filter (动态阈值过滤器)

**文件**: `src/filters/threshold.js`

**用途**: 根据评分分布动态确定阈值,保留得分最高的 10-30% 新闻

**契约**:

```javascript
/**
 * 动态阈值过滤器
 */
export class ThresholdFilter {
  /**
   * @param {Object} config - 阈值配置
   */
  constructor(config = {}) {
    this.minPercentage = config.minPercentage || 10;
    this.maxPercentage = config.maxPercentage || 30;
    this.preferredCount = config.preferredCount || 15;
  }

  /**
   * 应用动态阈值
   * @param {FilterResult[]} filterResults
   * @returns {FilterResult[]}
   */
  filter(filterResults) {
    if (filterResults.length === 0) {
      return [];
    }

    // 按评分从高到低排序
    const sorted = [...filterResults].sort((a, b) => b.score - a.score);

    // 计算保留数量
    const minCount = Math.ceil(filterResults.length * this.minPercentage / 100);
    const maxCount = Math.ceil(filterResults.length * this.maxPercentage / 100);
    const targetCount = Math.min(
      Math.max(minCount, this.preferredCount),
      maxCount
    );

    // 选取得分最高的 N 条
    const selected = sorted.slice(0, targetCount);

    // 计算阈值
    const threshold = selected[selected.length - 1].score;

    // 标记通过的新闻
    selected.forEach(result => {
      result.isPassed = true;
    });

    console.log(`[ThresholdFilter] Total: ${filterResults.length}`);
    console.log(`[ThresholdFilter] Selected: ${selected.length} (${(selected.length / filterResults.length * 100).toFixed(2)}%)`);
    console.log(`[ThresholdFilter] Threshold: ${threshold.toFixed(2)}`);
    console.log(`[ThresholdFilter] Score range: ${sorted[0].score.toFixed(2)} - ${sorted[sorted.length - 1].score.toFixed(2)}`);

    return selected;
  }
}
```

**性能要求**:
- 处理 50 条结果 < 10ms
- 算法复杂度: O(n log n)

---

## 过滤器链编排

**文件**: `src/services/orchestrator.js`

```javascript
/**
 * 过滤器链编排器
 */
export class FilterOrchestrator {
  constructor(config) {
    this.keywordFilter = new KeywordFilter(config.keywords);
    this.deduplicator = new DeduplicationFilter();
    this.llmFilter = new LLMFilter(config);
    this.thresholdFilter = new ThresholdFilter(config.thresholdConfig);
  }

  /**
   * 执行完整的过滤流程
   * @param {NewsItem[]} newsItems
   * @returns {Promise<{newsItems: NewsItem[], filterResults: FilterResult[]}>}
   */
  async execute(newsItems) {
    console.log(`\n[FilterOrchestrator] Starting filter pipeline...`);
    console.log(`[FilterOrchestrator] Input: ${newsItems.length} items\n`);

    // 1. 去重
    let filtered = await this.deduplicator.filter(newsItems);
    console.log(`After deduplication: ${filtered.length} items\n`);

    // 2. 关键词初筛
    filtered = await this.keywordFilter.filter(filtered);
    console.log(`After keyword filter: ${filtered.length} items\n`);

    // 3. LLM 评分
    console.log(`Starting LLM scoring...`);
    const filterResults = await this.llmFilter.filter(filtered);
    console.log(`LLM scoring complete: ${filterResults.length} items scored\n`);

    // 4. 动态阈值过滤
    const passedResults = this.thresholdFilter.filter(filterResults);
    console.log(`After threshold filter: ${passedResults.length} items\n`);

    // 提取通过的新闻
    const passedNewsIds = new Set(passedResults.map(r => r.newsId));
    const passedNews = filtered.filter(item => passedNewsIds.has(item.id));

    return {
      newsItems: passedNews,
      filterResults: passedResults
    };
  }
}
```

---

## 测试契约

```javascript
import { describe, it, expect } from 'vitest';

describe('Filter Pipeline', () => {
  it('should reduce data by 80% after keyword filter', async () => {
    const filter = new KeywordFilter(['AI', '人工智能']);
    const input = generateMockNews(100);

    const output = await filter.filter(input);

    expect(output.length).toBeLessThan(input.length * 0.2);
  });

  it('should detect duplicates accurately', async () => {
    const dedup = new DeduplicationFilter();
    const news = [
      { url: 'https://a.com/1', title: 'Title 1', summary: 'Summary 1' },
      { url: 'https://a.com/1', title: 'Title 2', summary: 'Summary 2' }
    ];

    const unique = await dedup.filter(news);

    expect(unique.length).toBe(1);
  });

  it('should score news with LLM', async () => {
    const filter = new LLMFilter(mockConfig);
    const news = [mockNewsItem];

    const results = await filter.filter(news);

    expect(results).toHaveLength(1);
    expect(results[0].score).toBeGreaterThanOrEqual(0);
    expect(results[0].score).toBeLessThanOrEqual(10);
    expect(results[0].reason).toBeTruthy();
  });

  it('should keep top 10-30% news', () => {
    const filter = new ThresholdFilter();
    const results = generateMockResults(50);

    const passed = filter.filter(results);

    expect(passed.length).toBeGreaterThanOrEqual(5);
    expect(passed.length).toBeLessThanOrEqual(15);
  });
});
```

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0 | 2025-11-01 | 初始版本 |
