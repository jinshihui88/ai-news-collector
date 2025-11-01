/**
 * 指数退避重试机制
 * @param {Function} fn - 要执行的异步函数
 * @param {Object} options - 重试选项
 * @param {number} options.maxRetries - 最大重试次数 (默认: 3)
 * @param {number} options.initialDelay - 初始延迟毫秒数 (默认: 1000)
 * @param {number} options.maxDelay - 最大延迟毫秒数 (默认: 30000)
 * @param {Function} options.shouldRetry - 判断是否应该重试的函数 (默认: 所有错误都重试)
 * @returns {Promise<any>} 函数执行结果
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
    onRetry = (error, attempt) => {
      console.warn(`[重试] 第 ${attempt}/${maxRetries} 次重试...`);
      console.warn(`[重试] 错误: ${error.message}`);
    }
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 执行函数
      return await fn();
    } catch (error) {
      lastError = error;

      // 如果是最后一次尝试,直接抛出错误
      if (attempt === maxRetries) {
        throw error;
      }

      // 检查是否应该重试
      if (!shouldRetry(error)) {
        throw error;
      }

      // 触发重试回调
      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      // 计算延迟时间 (指数退避)
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt),
        maxDelay
      );

      console.log(`[重试] 等待 ${delay}ms 后重试...`);

      // 等待
      await sleep(delay);
    }
  }

  // 如果所有重试都失败了
  throw lastError;
}

/**
 * 带超时的 Promise 包装
 * @param {Promise} promise - 原始 Promise
 * @param {number} timeoutMs - 超时时间(毫秒)
 * @param {string} errorMessage - 超时错误信息
 * @returns {Promise<any>}
 */
export function withTimeout(promise, timeoutMs, errorMessage = '操作超时') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 判断错误是否应该重试
 * @param {Error} error
 * @returns {boolean}
 */
export function shouldRetryError(error) {
  // 网络错误应该重试
  const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
  if (networkErrors.includes(error.code)) {
    return true;
  }

  // HTTP 5xx 错误应该重试
  if (error.response && error.response.status >= 500) {
    return true;
  }

  // HTTP 429 (速率限制) 应该重试
  if (error.response && error.response.status === 429) {
    return true;
  }

  // 其他错误不重试 (如 4xx 客户端错误)
  return false;
}
