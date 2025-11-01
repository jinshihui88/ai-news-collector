#!/usr/bin/env node

import 'dotenv/config';
import { loadFilterConfig } from './config/loader.js';
import { AIBaseCollector } from './collectors/aibase.js';
import { Orchestrator } from './services/orchestrator.js';
import { MarkdownGenerator } from './output/markdown.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('Main');

/**
 * 主函数
 */
async function main() {
  try {
    logger.info('========================================');
    logger.info('AI 新闻采集器 v1.0');
    logger.info('========================================');

    // 1. 验证环境变量
    if (!process.env.DEEPSEEK_API_KEY) {
      logger.error('缺少环境变量: DEEPSEEK_API_KEY');
      logger.info('请在 .env 文件中设置 DEEPSEEK_API_KEY');
      logger.info('获取 API Key: https://platform.deepseek.com/api_keys');
      process.exit(1);
    }

    // 2. 加载配置
    logger.info('');
    logger.info('步骤 1/4: 加载配置文件');
    const filterConfig = loadFilterConfig();

    // 3. 采集新闻
    logger.info('');
    logger.info('步骤 2/4: 采集新闻');
    const collector = new AIBaseCollector();
    const newsItems = await collector.collect();

    if (newsItems.length === 0) {
      logger.warn('未采集到任何新闻,程序退出');
      process.exit(0);
    }

    logger.success(`成功采集 ${newsItems.length} 条新闻`);

    // 4. LLM 评分和过滤
    logger.info('');
    logger.info('步骤 3/4: LLM 评分和过滤');
    const orchestrator = new Orchestrator();
    const result = await orchestrator.execute(newsItems, filterConfig);

    // 5. 生成 Markdown 输出
    logger.info('');
    logger.info('步骤 4/4: 生成 Markdown 报告');
    const markdownGenerator = new MarkdownGenerator();
    const outputPath = await markdownGenerator.generate(
      result.filtered,
      result.stats
    );

    // 6. 输出执行摘要
    logger.info('');
    logger.success('========================================');
    logger.success('执行完成!');
    logger.success('========================================');
    logger.info(`📄 报告路径: ${outputPath}`);
    logger.info(`📊 总采集数: ${result.stats.totalNews} 条`);
    logger.info(`✨ 过滤后: ${result.stats.filteredCount} 条 (${result.stats.filterRate.toFixed(1)}%)`);
    logger.info(`⏱️  总耗时: ${result.stats.duration.toFixed(2)} 秒`);
    logger.info(`💰 预估成本: $${(result.stats.totalTokens / 1000000 * 0.5).toFixed(4)}`);
    logger.info('');

  } catch (error) {
    logger.error('');
    logger.error('========================================');
    logger.error('执行失败');
    logger.error('========================================');
    logger.error('错误详情:', error.message);
    
    if (error.stack) {
      logger.debug('堆栈信息:');
      logger.debug(error.stack);
    }

    process.exit(1);
  }
}

// 运行主函数
main();
