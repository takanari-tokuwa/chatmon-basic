/**
 * 指定ミリ秒だけ待機
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

/**
 * 条件成立までポーリング待機
 * @param {() => boolean} conditionFn
 * @param {number} interval
 * @param {number} timeout
 * @returns {Promise<void>}
 */
export async function waitUntil(conditionFn, interval = 100, timeout = Infinity) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      if (conditionFn()) return resolve();
      if (Date.now() - start >= timeout) return reject(new Error('Timeout'));
      setTimeout(check, interval);
    };
    check();
  });
}
