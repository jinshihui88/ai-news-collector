import OpenAI from 'openai';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('LLM');

/**
 * DeepSeek LLM 客户端
 */
export class LLMClient {
  constructor(config = {}) {
    this.model = config.model || process.env.LLM_MODEL || 'deepseek-chat';
    this.maxTokens = config.maxTokens || parseInt(process.env.LLM_MAX_TOKENS || '500');
    this.temperature = config.temperature || parseFloat(process.env.LLM_TEMPERATURE || '0.7');

    // 初始化 OpenAI 客户端 (DeepSeek API 兼容 OpenAI 格式)
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY
    });

    logger.info(`LLM 客户端初始化: model=${this.model}`);
  }

  /**
   * 对单条新闻进行评分
   * @param {NewsItem} newsItem - 新闻条目
   * @param {Object} filterConfig - 过滤配置
   * @returns {Promise<{score: number, reason: string, tokenUsage: Object}>}
   */
  async scoreNewsItem(newsItem, filterConfig) {
    try {
      // 构建系统提示词 (包含正反面样例,支持 prompt caching)
      const systemPrompt = this.buildSystemPrompt(filterConfig);

      // 构建用户提示词
      const userPrompt = this.buildUserPrompt(newsItem);

      // 调用 DeepSeek API
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        response_format: { type: 'json_object' } // JSON Mode
      });

      // 解析响应
      const result = this.parseResponse(completion);

      // 记录 token 使用量
      logger.debug(`Token 使用: 输入=${result.tokenUsage.inputTokens}, 输出=${result.tokenUsage.outputTokens}, 缓存命中=${result.tokenUsage.cacheHitTokens || 0}`);

      return result;
    } catch (error) {
      logger.error(`评分失败 (新闻ID: ${newsItem.id}): ${error.message}`);
      throw error;
    }
  }

  /**
   * 构建系统提示词
   * @param {Object} filterConfig
   * @returns {string}
   */
  buildSystemPrompt(filterConfig) {
    const positiveExamples = filterConfig.positiveExamples
      .map((ex, i) => `### 正面样例 ${i + 1}
标题: ${ex.title}
摘要: ${ex.summary}
理由: ${ex.reason || '符合用户偏好'}
`)
      .join('\n');

    const negativeExamples = filterConfig.negativeExamples
      .map((ex, i) => `### 反面样例 ${i + 1}
标题: ${ex.title}
摘要: ${ex.summary}
理由: ${ex.reason || '不符合用户偏好'}
`)
      .join('\n');

    return `你是一个专业的 AI 新闻评估助手。根据用户提供的正反面样例,对新闻进行质量评分。

# 评分标准

- **10分**: 极度符合用户偏好,内容质量极高
- **8-9分**: 高度符合用户偏好,值得推送
- **6-7分**: 基本符合用户偏好,可以考虑
- **4-5分**: 部分符合用户偏好,质量一般
- **1-3分**: 不太符合用户偏好
- **0分**: 完全不符合用户偏好或质量很差

# 用户偏好样例

## 正面样例 (应该推送的新闻)

${positiveExamples}

## 反面样例 (不应该推送的新闻)

${negativeExamples}

# 输出格式

请以 JSON 格式输出评估结果:

{
  "score": 8.5,
  "reason": "详细的评分理由(50-200字符)"
}

评分理由应该:
1. 说明该新闻与用户偏好的匹配程度
2. 指出新闻的亮点或不足
3. 语言简洁专业,避免过度主观`;
  }

  /**
   * 构建用户提示词
   * @param {NewsItem} newsItem
   * @returns {string}
   */
  buildUserPrompt(newsItem) {
    return `请评估以下新闻:

**标题**: ${newsItem.title}

**摘要**: ${newsItem.summary}

请基于上述正反面样例,对这条新闻进行评分,并以 JSON 格式输出结果。`;
  }

  /**
   * 解析 LLM 响应
   * @param {Object} completion - OpenAI 响应对象
   * @returns {{score: number, reason: string, tokenUsage: Object}}
   */
  parseResponse(completion) {
    const content = completion.choices[0].message.content;

    // 解析 JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (error) {
      logger.error('JSON 解析失败:', content);
      throw new Error('LLM 响应不是有效的 JSON 格式');
    }

    // 验证必填字段
    if (typeof result.score !== 'number' || !result.reason) {
      throw new Error('LLM 响应缺少必填字段 (score 或 reason)');
    }

    // 验证评分范围
    if (result.score < 0 || result.score > 10) {
      logger.warn(`评分超出范围 (0-10): ${result.score}, 已截断`);
      result.score = Math.max(0, Math.min(10, result.score));
    }

    // 提取 token 使用量
    const usage = completion.usage || {};
    const tokenUsage = {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cacheHitTokens: usage.prompt_cache_hit_tokens || 0,
      cacheMissTokens: usage.prompt_cache_miss_tokens || 0,
      totalTokens: usage.total_tokens || 0
    };

    return {
      score: result.score,
      reason: result.reason,
      tokenUsage
    };
  }

  /**
   * 批量评分新闻
   * @param {NewsItem[]} newsItems
   * @param {Object} filterConfig
   * @param {number} batchSize - 每批并发数
   * @returns {Promise<Array<{newsId: string, score: number, reason: string, error?: string}>>}
   */
  async batchScore(newsItems, filterConfig, batchSize = 10) {
    const results = [];
    const total = newsItems.length;

    logger.info(`开始批量评分,共 ${total} 条新闻`);

    for (let i = 0; i < newsItems.length; i += batchSize) {
      const batch = newsItems.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(newsItems.length / batchSize);

      logger.info(`处理批次 ${batchNum}/${totalBatches} (第 ${i + 1}-${Math.min(i + batchSize, total)} 条)`);

      // 并发处理批次
      const promises = batch.map(async (item) => {
        try {
          const result = await this.scoreNewsItem(item, filterConfig);
          return {
            newsId: item.id,
            score: result.score,
            reason: result.reason,
            tokenUsage: result.tokenUsage
          };
        } catch (error) {
          logger.error(`评分失败 - 标题: ${item.title}`);
          return {
            newsId: item.id,
            score: 0,
            reason: '评分失败',
            error: error.message
          };
        }
      });

      const batchResults = await Promise.allSettled(promises);

      // 收集结果
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('批次处理失败:', result.reason);
        }
      });
    }

    logger.success(`批量评分完成,成功 ${results.filter(r => !r.error).length}/${total} 条`);

    return results;
  }
}
