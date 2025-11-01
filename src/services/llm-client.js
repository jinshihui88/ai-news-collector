import OpenAI from 'openai';
import { createLogger } from '../utils/logger.js';
import { buildSystemPrompt, buildUserPrompt, parseResponse } from './prompt-builder.js';
import { LLM_CONSTANTS } from '../config/constants.js';

const logger = createLogger('LLM');

/**
 * DeepSeek LLM 客户端
 */
export class LLMClient {
  constructor(config = {}) {
    const {
      DEFAULT_MODEL,
      DEFAULT_TEMPERATURE,
      DEFAULT_MAX_TOKENS,
      BATCH_SIZE
    } = LLM_CONSTANTS;

    this.model = config.model || process.env.LLM_MODEL || DEFAULT_MODEL;
    this.maxTokens = config.maxTokens || parseInt(process.env.LLM_MAX_TOKENS || DEFAULT_MAX_TOKENS);
    this.temperature = config.temperature || parseFloat(process.env.LLM_TEMPERATURE || DEFAULT_TEMPERATURE);
    this.batchSize = config.batchSize || BATCH_SIZE;

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
      // 构建提示词
      const systemPrompt = buildSystemPrompt(filterConfig);
      const userPrompt = buildUserPrompt(newsItem);

      // 调用 DeepSeek API
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        response_format: { type: 'json_object' } // JSON Mode
      });

      // 解析响应
      const result = parseResponse(completion);

      // 记录 token 使用量
      logger.debug(
        `Token 使用: 输入=${result.tokenUsage.inputTokens}, ` +
        `输出=${result.tokenUsage.outputTokens}, ` +
        `缓存命中=${result.tokenUsage.cacheHitTokens}`
      );

      return result;
    } catch (error) {
      logger.error(`评分失败 (新闻ID: ${newsItem.id}): ${error.message}`);
      throw error;
    }
  }

  /**
   * 批量评分新闻
   * @param {NewsItem[]} newsItems
   * @param {Object} filterConfig
   * @param {number} batchSize - 每批并发数
   * @returns {Promise<Array<{newsId: string, score: number, reason: string, error?: string}>>}
   */
  async batchScore(newsItems, filterConfig, batchSize = this.batchSize) {
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
