// utils/image.js

/**
 * File/URL/Canvas から HTMLImageElement を生成
 */
export async function processImage(input) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        // 画像が正常に読み込まれた場合
        img.onload = function () {
            resolve(img); // 画像オブジェクトを返す
        };

        // 画像の読み込みに失敗した場合
        img.onerror = function () {
            reject(new Error("画像の読み込みに失敗しました（" + input + "）"));
        };

        // 入力がFileオブジェクトの場合
        if (input instanceof File) {
            img.src = URL.createObjectURL(input);
        } 
        // 入力がURL文字列の場合
        else if (typeof input === 'string') {
            img.src = input;
        } 
        // 入力がHTMLCanvasElementの場合
        else if (input instanceof HTMLCanvasElement) {
            img.src = input.toDataURL(); // CanvasをデータURLに変換
        } 
        // その他の無効な入力の場合
        else {
            reject(new Error("無効な入力が指定されました。Fileオブジェクト、URL文字列、またはCanvasエレメントを指定してください"));
        }
    });
}

/**
 * dataURL URL / File / Canvas から HTMLImageElement を生成します。
 * @param {string|File|HTMLCanvasElement} input 
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(input) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    if (input instanceof File) {
      img.src = URL.createObjectURL(input);
    } else if (input instanceof HTMLCanvasElement) {
      img.src = input.toDataURL('image/png');
    } else if (typeof input === 'string') {
      // dataURL / 外部URL
      img.src = input;
    } else {
      reject(new Error('Invalid input for loadImage'));
    }
  });
}

// utils/image.js

/**
 * 画像を受け取り、白背景の正方形キャンバス上に中央配置して
 * PNG の DataUrl データを返します。
 *
 * @param {HTMLImageElement} img — 対象の画像要素
 * @returns {string} — `data:image/png;base64,XXXX...` 形式の文字列
 */
export function createWhiteBackgroundDataUrl(img) {
  // 元画像の幅・高さの大きい方をキャンバスのサイズに
  const size = Math.max(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;

  const ctx = canvas.getContext('2d');
  // 白背景を塗りつぶし
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // 画像を中央に描画
  const offsetX = (size - img.width) / 2;
  const offsetY = (size - img.height) / 2;
  ctx.drawImage(img, offsetX, offsetY, img.width, img.height);

  // PNG 形式で DataUrl に変換
  const dataUrl = canvas.toDataURL('image/png');

  // （必要なら）一時的に生成した canvas を破棄
  canvas.remove();

  return dataUrl;
}

/**
 * DataUrl → HTMLImageElement に変換する
 * @param {string} dataUrl - data URL 
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load error'));
    img.src = dataUrl;
  });
}

/**
 * Canvas → DataUrl を返します。
 * @param {string|HTMLCanvasElement} canvasOrId 
 * @returns {string}
 */
export function convertCanvasToDataUrl(canvasOrId) {
  const canvas = typeof canvasOrId === 'string'
    ? document.getElementById(canvasOrId)
    : canvasOrId;
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('convertCanvasToDataUrl: not a canvas');
  }
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl;
}

/**
 * DataUrl → 指定キャンバスに描画します。
 * @param {string} dataURL
 * @param {string} canvasId 
 */
export async function drawDataUrlToCanvas(dataUrl, canvasId) {
  const img = await loadImage(dataUrl);
  const canvas = /** @type {HTMLCanvasElement} */(document.getElementById(canvasId));
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

/**
 * Canvas に画像をアスペクト比を保って中央フィット描画します。
 * @param {HTMLCanvasElement} canvas 
 * @param {HTMLImageElement} img 
 */
export function drawCanvasImage(canvas, img) {
  const ctx = canvas.getContext('2d');
  const ratio = Math.min(canvas.width / img.width, canvas.height / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, x, y, w, h);
}

/**
 * 単一行テキスト描画。文字数に応じて横方向を縮小して収めます。
 * @param {CanvasRenderingContext2D} ctx 
 * @param {string} text 
 * @param {number} x 
 * @param {number} y 
 * @param {number} fontSize 
 * @param {number} widthRatio 
 * @param {number} maxWidth 
 * @param {string} color 
 * @param {"left"|"center"|"right"} [align] 
 * @param {"normal"|"bold"} [weight] 
 */
export function drawSingleLineText(ctx, text, x, y, fontSize, widthRatio, maxWidth, color, align='left', weight='normal') {
    // フォント設定
    ctx.font = `${weight} ${fontSize}px 'Yu Gothic UI', 'Segoe UI', 'Meiryo UI', 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = color;

    // 文字の幅を計測し、スケールを適用
    const textWidth = ctx.measureText(text).width;
    const scaleX = Math.min(widthRatio, maxWidth / textWidth);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, 1); // 横幅の比率を変更

    // 位置調整
    let offsetX = 0;
    if (align === 'center') {
        offsetX = -textWidth / 2;
    } else if (align === 'right') {
        offsetX = -textWidth;
    }

    ctx.fillText(text, offsetX, 0);
    ctx.restore();
}

/**
 * 複数行テキスト描画。折り返しして最大高さを超えないようにします。
 * @param {CanvasRenderingContext2D} ctx 
 * @param {string} text 
 * @param {number} x 
 * @param {number} y 
 * @param {number} maxW 
 * @param {number} maxH 
 * @param {number} fontSize 
 * @param {number} widthRatio 
 * @param {string} color 
 * @param {"normal"|"bold"} [weight] 
 */
export function drawMultiLineText(ctx, text, x, y, maxW, maxH, fontSize, widthRatio, color, weight='normal') {
  ctx.font = `${weight} ${fontSize}px sans-serif`;
  ctx.fillStyle = color;
  const lineHeight = fontSize * 1.2;
  let curY = y;
  let line = '';

  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width * widthRatio > maxW && line) {
      ctx.save();
        ctx.translate(x, curY);
        ctx.scale(widthRatio, 1);
        ctx.fillText(line, 0, 0);
      ctx.restore();
      line = ch;
      curY += lineHeight;
      if (curY + lineHeight > y + maxH) return;
    } else {
      line = test;
    }
  }
  if (line && curY + lineHeight <= y + maxH) {
    ctx.save();
      ctx.translate(x, curY);
      ctx.scale(widthRatio, 1);
      ctx.fillText(line, 0, 0);
    ctx.restore();
  }
}
