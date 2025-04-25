import { loadImage, loadImageElement, createWhiteBackgroundDataUrl } from './image.js';

/**
 * スプライトにホバーエフェクトとクリックを設定
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Sprite|Phaser.GameObjects.Image} sprite
 * @param {() => void} callback
 */
export function addSpriteHoverEffect(scene, sprite, callback) {
  sprite.setInteractive({ useHandCursor: true });
  sprite.on('pointerover', () => {
    scene.input.setDefaultCursor('pointer');
    sprite.setTint(0x88ccff);
  });
  sprite.on('pointerout', () => {
    scene.input.setDefaultCursor('auto');
    sprite.clearTint();
  });
  sprite.on('pointerdown', callback);
}

/**
 * DataUrl(PNG) → Phaser テクスチャ登録
 * @param {Phaser.Scene} scene
 * @param {string} key
 * @param {string} dataUrl — data:image/png;base64,... の形式
 * @param {boolean} [addWhiteBg=false]
 */
export async function convertDataUrlToSprite(scene, textureKey, dataUrl, addWhiteBg = false) {

  // 1) まず base64 を ロード済みの HTMLImageElement に
  const originalImg = await loadImageElement(dataUrl);

  // 2) 必要なら 白背景+正方形Canvas で新しいbase64を作成
  let finalDataUrl = dataUrl;
  if (addWhiteBg) {
    finalDataUrl = createWhiteBackgroundDataUrl(originalImg);
  }

  // 3) 最終画像をロードして HTMLImageElement にする（同期化）
  const finalImg = await loadImageElement(finalDataUrl);

  // 4) 既存キーを削除し、新規テクスチャを登録
  if (scene.textures.exists(textureKey)) {
    scene.textures.removeKey(textureKey);
  }

  // addImageで HTMLImageElement を渡すと同期的に幅高さが設定される
  scene.textures.addImage(textureKey, finalImg);

  return textureKey;
}

/**
 * DataUrl 画像データを使って、テクスチャを同期的に作成し、スプライトに適用する関数
 * スプライトの元のサイズを維持するためにテクスチャをリサイズする
 *
 * @param {Phaser.Scene} scene - Phaser のシーンオブジェクト
 * @param {Phaser.GameObjects.Sprite} sprite - テクスチャを適用するスプライト
 * @param {string} textureKey - 登録するテクスチャのキー
 * @param {string} dataUrl - DataUrl 画像データ（プレフィックスが抜けている場合は自動で追加）
 * @returns {Promise<void>}
 */
export async function setTexture(scene, sprite, textureKey, dataUrl) {
  
  try {
    // スプライトの現在のサイズを取得
    const spriteWidth = sprite.width;
    const spriteHeight = sprite.height;
    
    // スケールの保存（元のスケールを維持するため）
    const originalScaleX = sprite.scaleX;
    const originalScaleY = sprite.scaleY;
    
    // HTMLImageElement を生成し、画像のロードを待つ
    const originalImg = await loadImage(dataUrl);
    
    // スプライトのフレームサイズに合わせて画像をリサイズ
    const resizedDataUrl = resizeImageToCanvas(originalImg, spriteWidth, spriteHeight);
    
    // リサイズした画像を読み込む
    const resizedImg = await loadImage(resizedDataUrl);
    
    // 既存の同名テクスチャがあれば削除
    if (scene.textures.exists(textureKey)) {
      scene.textures.removeKey(textureKey);
    }
    
    // リサイズしたテクスチャを新たに登録
    scene.textures.addImage(textureKey, resizedImg);
    
    // スプライトにテクスチャを適用
    sprite.setTexture(textureKey);
    
    // 元のスケールを再適用
    sprite.setScale(originalScaleX, originalScaleY);
  } catch (error) {
    console.error("画像の読み込みに失敗しました:", error);
  }
}

/**
 * 画像をリサイズするためのキャンバスを作成し、リサイズされた画像のBase64を返す
 * @param {HTMLImageElement} img - 元の画像
 * @param {number} targetWidth - リサイズ後の幅
 * @param {number} targetHeight - リサイズ後の高さ
 * @returns {string} リサイズされた画像のBase64文字列
 */
function resizeImageToCanvas(img, targetWidth, targetHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  
  // 画像を指定サイズに描画
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  
  // キャンバスからBase64を取得
  return canvas.toDataURL('image/png');
}

/**
 * 不要 canvas を削除
 */
export function removeExtraCanvas(containerId = 'game-container') {
  const ctr = document.getElementById(containerId);
  const canvases = ctr?.getElementsByTagName('canvas');
  if (canvases && canvases.length > 1) {
    for (let i = 1; i < canvases.length; i++) ctr.removeChild(canvases[i]);
  }
}
