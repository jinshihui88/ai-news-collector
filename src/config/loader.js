import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 加载过滤规则配置
 * @param {string} configPath - 配置文件路径 (相对于项目根目录)
 * @returns {Object} 过滤配置对象
 */
export function loadFilterConfig(configPath = 'config/filter-rules.json') {
  try {
    // 构建配置文件的绝对路径
    const absolutePath = join(process.cwd(), configPath);
    
    // 读取文件内容
    const fileContent = readFileSync(absolutePath, 'utf-8');
    
    // 解析 JSON
    let config;
    try {
      config = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('[配置加载] JSON 格式错误');
      console.error('错误详情:', parseError.message);
      console.error('请检查配置文件格式是否正确');
      process.exit(1);
    }

    // 验证配置
    const validation = validateFilterConfig(config);
    if (!validation.valid) {
      console.error('[配置加载] 配置验证失败');
      validation.errors.forEach(err => console.error('  - ' + err));
      process.exit(1);
    }

    console.log('[配置加载] 配置加载成功');
    console.log(`  正面样例: ${config.positiveExamples.length} 个`);
    console.log(`  反面样例: ${config.negativeExamples.length} 个`);
    console.log(`  关键词: ${config.keywords ? config.keywords.length : 0} 个`);

    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`[配置加载] 配置文件不存在: ${configPath}`);
      console.error('请创建配置文件,或参考 config/filter-rules.json 示例');
    } else {
      console.error('[配置加载] 加载配置文件失败:', error.message);
    }
    process.exit(1);
  }
}

/**
 * 验证过滤配置
 * @param {Object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFilterConfig(config) {
  const errors = [];

  // 验证正面样例
  if (!config.positiveExamples || !Array.isArray(config.positiveExamples)) {
    errors.push('positiveExamples 必须是数组');
  } else if (config.positiveExamples.length === 0) {
    errors.push('至少需要 1 个正面样例');
  } else {
    // 验证每个样例的格式
    config.positiveExamples.forEach((example, index) => {
      const exampleErrors = validateExample(example, `正面样例[${index}]`);
      errors.push(...exampleErrors);
    });
  }

  // 验证反面样例
  if (!config.negativeExamples || !Array.isArray(config.negativeExamples)) {
    errors.push('negativeExamples 必须是数组');
  } else if (config.negativeExamples.length === 0) {
    errors.push('至少需要 1 个反面样例');
  } else {
    config.negativeExamples.forEach((example, index) => {
      const exampleErrors = validateExample(example, `反面样例[${index}]`);
      errors.push(...exampleErrors);
    });
  }

  // 验证关键词 (可选)
  if (config.keywords && !Array.isArray(config.keywords)) {
    errors.push('keywords 必须是数组');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证单个样例
 * @param {Object} example
 * @param {string} prefix - 错误信息前缀
 * @returns {string[]} 错误列表
 */
function validateExample(example, prefix) {
  const errors = [];

  if (!example.title || typeof example.title !== 'string') {
    errors.push(`${prefix}: 标题是必填字段`);
  }

  if (!example.summary || typeof example.summary !== 'string') {
    errors.push(`${prefix}: 摘要是必填字段`);
  } else if (example.summary.length < 100 || example.summary.length > 200) {
    errors.push(`${prefix}: 摘要长度必须在 100-200 字符之间 (当前: ${example.summary.length})`);
  }

  return errors;
}
