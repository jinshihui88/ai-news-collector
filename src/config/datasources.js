/**
 * AIBase 数据源配置
 */
export const AIBASE_CONFIG = {
  name: 'AIBase',
  type: 'web',
  enabled: true,
  maxItems: 10,
  timeout: 30000, // 30秒
  config: {
    url: 'https://www.aibase.com/zh/news',
    selectors: {
      // 注意: 这些选择器需要根据实际网站HTML结构调整
      newsContainer: '.news-list',
      newsItem: '.news-item',
      title: '.news-title',
      summary: '.news-summary',
      link: 'a',
      publishTime: '.publish-time'
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    }
  }
};

/**
 * 获取所有启用的数据源配置
 */
export function getEnabledDataSources() {
  const allSources = [
    AIBASE_CONFIG
    // 未来可以在这里添加其他数据源
    // TWITTER_CONFIG,
    // FEISHU_CONFIG,
    // WECHAT_CONFIG,
    // ZHISHI_CONFIG
  ];

  return allSources.filter(source => source.enabled);
}

/**
 * 根据名称获取数据源配置
 */
export function getDataSourceByName(name) {
  const sources = {
    'AIBase': AIBASE_CONFIG
  };

  return sources[name] || null;
}
