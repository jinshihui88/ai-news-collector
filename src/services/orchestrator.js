import { LLMClient } from './llm-client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Orchestrator');

/**
 * 主流程编排器
 * 负责协调采集、评分、过滤等流程
 */
export class Orchestrator {
  constructor(config = {}) {
    this.llmClient = new LLMClient(config.llm);
    this.batchSize = config.batchSize || 10;
  }

  /**
   * 执行完整的过滤流程
   * @param {NewsItem[]} newsItems - 新闻列表
   * @param {Object} filterConfig - 过滤配置
   * @returns {Promise<{scored: Array, filtered: Array, stats: Object}>}
   */
  async execute(newsItems, filterConfig) {
    logger.info(`开始执行过滤流程,共 ${newsItems.length} 条新闻`);
    const startTime = Date.now();

    try {
      // 1. LLM 批量评分
      const scoredResults = await this.llmClient.batchScore(
        newsItems,
        filterConfig,
        this.batchSize
      );

      // 2. 合并评分结果到新闻条目
      const scoredNews = this.mergeScores(newsItems, scoredResults);

      // 3. 动态阈值过滤
      const filteredNews = this.applyDynamicThreshold(
        scoredNews,
        filterConfig.thresholdConfig || {}
      );

      // 4. 计算统计信息
      const stats = this.calculateStats(scoredNews, filteredNews, startTime);

      logger.success('过滤流程执行完成');
      logger.info(`  总数: ${stats.totalNews}`);
      logger.info(`  平均分: ${stats.averageScore.toFixed(2)}`);
      logger.info(`  过滤后: ${stats.filteredCount}`);
      logger.info(`  过滤率: ${stats.filterRate.toFixed(1)}%`);
      logger.info(`  耗时: ${stats.duration.toFixed(2)}s`);

      return {
        scored: scoredNews,
        filtered: filteredNews,
        stats
      };
    } catch (error) {
      logger.error('过滤流程执行失败:', error.message);
      throw error;
    }
  }

  /**
   * 合并评分结果到新闻条目
   * @param {NewsItem[]} newsItems
   * @param {Array} scoredResults
   * @returns {Array}
   */
  mergeScores(newsItems, scoredResults) {
    const scoreMap = new Map();
    scoredResults.forEach(result => {
      scoreMap.set(result.newsId, result);
    });

    return newsItems.map(item => {
      const scoreData = scoreMap.get(item.id);
      if (!scoreData) {
        logger.warn(`新闻未找到评分结果: ${item.title}`);
        return {
          newsItem: item,
          score: 0,
          reason: '未评分',
          isPassed: false
        };
      }

      return {
        newsItem: item,
        score: scoreData.score,
        reason: scoreData.reason,
        error: scoreData.error,
        tokenUsage: scoreData.tokenUsage,
        isPassed: false // 稍后由动态阈值过滤决定
      };
    });
  }

  /**
   * 应用动态阈值过滤
   * 保留得分最高的 10-30% 新闻
   * @param {Array} scoredNews
   * @param {Object} thresholdConfig
   * @returns {Array}
   */
  applyDynamicThreshold(scoredNews, thresholdConfig) {
    const {
      minPercentage = 10,
      maxPercentage = 30,
      preferredCount = 15
    } = thresholdConfig;

    // 过滤掉评分失败的新闻
    const validNews = scoredNews.filter(item => !item.error && item.score > 0);

    if (validNews.length === 0) {
      logger.warn('没有有效的评分结果');
      return [];
    }

    // 按评分从高到低排序
    const sorted = [...validNews].sort((a, b) => b.score - a.score);

    // 计算保留数量
    const totalCount = sorted.length;
    const minCount = Math.ceil(totalCount * minPercentage / 100);
    const maxCount = Math.ceil(totalCount * maxPercentage / 100);
    const targetCount = Math.min(
      Math.max(minCount, preferredCount),
      maxCount
    );

    // 取前 targetCount 个
    const filtered = sorted.slice(0, targetCount);

    // 计算实际阈值
    const threshold = filtered.length > 0 ? filtered[filtered.length - 1].score : 0;

    logger.info(`动态阈值过滤: 阈值=${threshold.toFixed(2)}, 选中=${filtered.length}/${totalCount} (${(filtered.length/totalCount*100).toFixed(1)}%)`);

    // 标记通过的新闻
    const passedIds = new Set(filtered.map(item => item.newsItem.id));
    scoredNews.forEach(item => {
      item.isPassed = passedIds.has(item.newsItem.id);
    });

    return filtered;
  }

  /**
   * 计算统计信息
   * @param {Array} scoredNews
   * @param {Array} filteredNews
   * @param {number} startTime
   * @returns {Object}
   */
  calculateStats(scoredNews, filteredNews, startTime) {
    const validScores = scoredNews
      .filter(item => !item.error && item.score > 0)
      .map(item => item.score);

    const averageScore = validScores.length > 0
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : 0;

    const totalTokens = scoredNews.reduce((sum, item) => {
      return sum + (item.tokenUsage?.totalTokens || 0);
    }, 0);

    const cacheHitTokens = scoredNews.reduce((sum, item) => {
      return sum + (item.tokenUsage?.cacheHitTokens || 0);
    }, 0);

    return {
      totalNews: scoredNews.length,
      validNews: validScores.length,
      filteredCount: filteredNews.length,
      filterRate: scoredNews.length > 0
        ? (filteredNews.length / scoredNews.length) * 100
        : 0,
      averageScore,
      highestScore: Math.max(...validScores, 0),
      lowestScore: Math.min(...validScores, 10),
      duration: (Date.now() - startTime) / 1000,
      totalTokens,
      cacheHitTokens,
      cacheHitRate: totalTokens > 0
        ? (cacheHitTokens / totalTokens) * 100
        : 0
    };
  }
}
