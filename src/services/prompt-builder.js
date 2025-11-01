/**
 * Prompt 构建器
 * 集中管理 LLM 提示词的构建逻辑
 */

/**
 * 构建系统提示词
 * @param {Object} filterConfig - 过滤配置
 * @returns {string}
 */
export function buildSystemPrompt(filterConfig) {
  const positiveExamples = formatExamples(
    filterConfig.positiveExamples,
    '正面样例'
  );

  const negativeExamples = formatExamples(
    filterConfig.negativeExamples,
    '反面样例'
  );

  return `你是一个 AI 新闻评分助手,根据用户提供的正反面样例,对新闻进行评分 (0-10分)。

## 评分标准

**高分新闻 (8-10分)**:
- 技术创新和突破性进展
- 对行业有重大影响
- 实用价值高,可落地应用
- 信息量大,分析深入

**中等分数 (5-7分)**:
- 常规技术更新
- 行业动态和趋势
- 有一定参考价值
- 信息完整但不够深入

**低分新闻 (0-4分)**:
- 纯商业宣传或融资消息
- 日常维护更新
- 信息价值低
- 内容空洞或重复

## 用户偏好

${positiveExamples}

${negativeExamples}

## 输出格式

请以 JSON 格式返回评分结果:
\`\`\`json
{
  "score": 7.5,
  "reason": "简要说明评分理由 (50-100字)"
}
\`\`\``;
}

/**
 * 构建用户提示词
 * @param {NewsItem} newsItem - 新闻条目
 * @returns {string}
 */
export function buildUserPrompt(newsItem) {
  return `请对以下新闻进行评分:

**标题**: ${newsItem.title}

**摘要**: ${newsItem.summary}

请根据系统提示词中的评分标准和用户偏好进行评分。`;
}

/**
 * 格式化样例
 * @param {Array} examples - 样例数组
 * @param {string} label - 标签
 * @returns {string}
 */
function formatExamples(examples, label) {
  if (!examples || examples.length === 0) {
    return `### ${label}\n无`;
  }

  return examples
    .map((ex, i) => formatSingleExample(ex, `${label} ${i + 1}`))
    .join('\n');
}

/**
 * 格式化单个样例
 * @param {Object} example - 样例对象
 * @param {string} label - 标签
 * @returns {string}
 */
function formatSingleExample(example, label) {
  return `### ${label}
标题: ${example.title}
摘要: ${example.summary}
理由: ${example.reason || '符合/不符合用户偏好'}
`;
}

/**
 * 解析 LLM 响应
 * @param {Object} completion - OpenAI API 响应
 * @returns {Object} {score, reason, tokenUsage}
 * @throws {Error} 解析失败时抛出错误
 */
export function parseResponse(completion) {
  try {
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('响应内容为空');
    }

    // 解析 JSON
    const data = JSON.parse(content);

    // 验证必需字段
    if (typeof data.score !== 'number') {
      throw new Error('score 字段缺失或类型错误');
    }

    if (!data.reason || typeof data.reason !== 'string') {
      throw new Error('reason 字段缺失或类型错误');
    }

    // 提取 token 使用信息
    const usage = completion.usage || {};
    const tokenUsage = {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      cacheHitTokens: usage.prompt_cache_hit_tokens || 0
    };

    // 限制评分范围
    const score = Math.max(0, Math.min(10, data.score));

    return {
      score,
      reason: data.reason.trim(),
      tokenUsage
    };
  } catch (error) {
    throw new Error(`解析 LLM 响应失败: ${error.message}`);
  }
}
