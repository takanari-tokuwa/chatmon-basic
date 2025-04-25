/**
 * オブジェクトに属性をセット（ディープコピー対応）
 */
export function setAttributes(target, updates) {
  if (!target || typeof target!=='object') return {};
  if (!updates || typeof updates!=='object') return target;
  Object.keys(updates).forEach(key => {
    const v = updates[key];
    if (Array.isArray(v)) target[key] = [...v];
    else if (v && typeof v==='object') target[key] = JSON.parse(JSON.stringify(v));
    else target[key] = v;
  });
  return target;
}

/**
 * 参照を保ったまま配列/オブジェクト更新
 */
export function updateReference(target, newValue) {
  if (Array.isArray(target) && Array.isArray(newValue)) {
    target.length=0; target.push(...newValue);
  } else if (typeof target==='object' && typeof newValue==='object') {
    Object.keys(target).forEach(k=>delete target[k]);
    Object.assign(target, newValue);
  }
}

/**
 * 文字列から数値抽出
 */
export function extractNumericValue(str) {
  if (typeof str!=='string') return str;
  const m = str.match(/\d+/);
  return m? parseFloat(m[0]) : 0;
}

/**
 * 文字列をバイト長で切り詰め
 */
export function truncateString(str, maxLen) {
  const count = s => [...s].reduce((c,ch)=> c + (/[^\x00-\x7F]/.test(ch)?2:1),0);
  if (count(str)<=maxLen) return str;
  let res='';
  for (let ch of str) {
    if (count(res+ch)>maxLen) break;
    res += ch;
  }
  return res;
}

/**
 * バックティック内 JSON 抽出
 */
export function extractTextBetweenBackticks(text) {
  const m = /```(?:json)?([^`]*)```/.exec(text);
  return m ? m[1].trim() : text;
}
