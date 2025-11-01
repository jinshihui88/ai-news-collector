/**
 * 全局常量配置
 * 避免在代码中使用魔法数字
 */

// 采集器配置
export const COLLECTOR_CONSTANTS = {
  // AIBase 采集器
  AIBASE: {
    MAX_ITEMS: 10,           // 最大采集数量
    TIMEOUT: 30000,          // 请求超时时间(毫秒)
    PAGE_LOAD_WAIT: 3000,    // 页面加载等待时间(毫秒)
    SELECTOR_WAIT: 10000     // 选择器等待超时(毫秒)
  }
};

// LLM 配置
export const LLM_CONSTANTS = {
  DEFAULT_MODEL: 'deepseek-chat',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 500,
  BATCH_SIZE: 10,              // 批量评分的批次大小

  // API 定价 (美元/百万 tokens)
  PRICING: {
    INPUT_PER_MILLION: 0.27,
    OUTPUT_PER_MILLION: 1.10,
    CACHE_HIT_PER_MILLION: 0.027
  }
};

// 过滤器配置
export const FILTER_CONSTANTS = {
  // 阈值配置默认值
  THRESHOLD: {
    MIN_PERCENTAGE: 10,      // 最少保留百分比
    MAX_PERCENTAGE: 30,      // 最多保留百分比
    PREFERRED_COUNT: 15      // 期望保留数量
  },

  // 样例验证
  EXAMPLE: {
    MIN_POSITIVE: 1,         // 最少正面样例数
    MIN_NEGATIVE: 1,         // 最少反面样例数
    SUMMARY_MIN_LENGTH: 100, // 摘要最小长度
    SUMMARY_MAX_LENGTH: 200  // 摘要最大长度
  }
};

// 重试配置
export const RETRY_CONSTANTS = {
  MAX_RETRIES: 3,             // 最大重试次数
  INITIAL_DELAY: 1000,        // 初始延迟(毫秒)
  MAX_DELAY: 30000,           // 最大延迟(毫秒)
  BACKOFF_FACTOR: 2           // 指数退避因子
};

// 新闻条目验证规则
export const NEWS_VALIDATION = {
  TITLE: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 500
  },
  SUMMARY: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 2000
  },
  URL_PATTERN: /^https?:\/\/.+/,
  ALLOWED_SOURCES: ['AIBase', 'Twitter', 'Feishu', 'WeChat', 'Zhishi']
};

// 日志级别
export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  SUCCESS: 'success'
};

// 输出配置
export const OUTPUT_CONSTANTS = {
  DEFAULT_PATH: 'output/filtered-news.md',
  DATE_FORMAT: {
    LOCALE: 'zh-CN',
    OPTIONS: {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
  },

  // 评分对应的表情符号阈值
  SCORE_EMOJI: {
    FIRE: 9,      // 🔥
    STAR: 8,      // ⭐
    THUMBS_UP: 7, // 👍
    OK: 6,        // 👌
    DEFAULT: 0    // 📋
  }
};
