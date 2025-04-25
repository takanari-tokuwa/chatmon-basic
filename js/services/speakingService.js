/***************************************************************************************************
 *  speakingService.js
 *  -----------------------------------------------------------------------------------------------
 *  ブラウザ組み込みの Web Speech API（SpeechSynthesis） を使ってテキストを読み上げる
 *  ユーティリティ。  
 *
 *  ・fetchAndPlayAudio(scene, text) …… 非同期でテキストを読み上げる
 *  ・waitForSpeakingToFinish(cb)   …… 読み上げ完了まで待機し、任意のコールバックを実行
 *
 *  ※ゲーム側からは「実況」を行う場面で `await fetchAndPlayAudio(this, 'しゃべる内容');`
 *    のように呼び出してください。
 ***************************************************************************************************/

import { GAME_SETTINGS }            from '../config.js';


/* ------------------------------------------------------------------  
   1. ブラウザ判定
   ------------------------------------------------------------------ */
const ua          = navigator.userAgent;
const IS_EDGE     = ua.includes('Edg');
const IS_CHROME   = !IS_EDGE && ua.includes('Chrome'); // Edge も Chrome 判定に含まれぬよう注意

/* ------------------------------------------------------------------  
   2. 利用する音声名の定数プリセット
   ------------------------------------------------------------------ */
export const VOICE_NAME_HARUKA_DESKTOP = 'Microsoft Haruka Desktop - Japanese';
export const VOICE_NAME_NANAMI_ONLINE  = 'Microsoft Nanami Online (Natural) - Japanese (Japan)';
export const VOICE_NAME_AYUMI          = 'Microsoft Ayumi - Japanese (Japan)';
export const VOICE_NAME_HARUKA         = 'Microsoft Haruka - Japanese (Japan)';
export const VOICE_NAME_ICHIRO         = 'Microsoft Ichiro - Japanese (Japan)';
export const VOICE_NAME_SAYAKA         = 'Microsoft Sayaka - Japanese (Japan)';
export const VOICE_NAME_GOOGLE_JP      = 'Google 日本語';

/**
 * 環境に応じてデフォルト音声を選択
 */
const DEFAULT_VOICE_NAME = (() => {
  if (IS_EDGE)   return VOICE_NAME_NANAMI_ONLINE;
  if (IS_CHROME) return VOICE_NAME_GOOGLE_JP;
  return VOICE_NAME_HARUKA_DESKTOP;
})();

/* ------------------------------------------------------------------  
   3. SpeechSynthesisUtterance 初期化
   ------------------------------------------------------------------ */
let utterance      = null;      // 再利用する Utterance
let voiceRate      = IS_EDGE ? 1.3 : 1.2;
let speakingFlag   = false;     // 読み上げ中フラグ（簡易同期用）

/**
 * 音声リストがロードされたら音声設定を確定させる。
 * Chrome 系は非同期で voice が増える点に注意。
 */
speechSynthesis.addEventListener('voiceschanged', () => {
  utterance               = new SpeechSynthesisUtterance();
  utterance.lang          = 'ja-JP';
  utterance.rate          = voiceRate;
  utterance.voice         = speechSynthesis
    .getVoices()
    .find(v => v.name === DEFAULT_VOICE_NAME)
    ?? speechSynthesis.getVoices().find(v => /日本語|Japanese/.test(v.lang))
    ?? null;

  if (!utterance.voice) {
    console.warn('[speakingService] 日本語音声が見つかりません。既定の音声で再生します。');
  }
});

/* ------------------------------------------------------------------  
   4. 外部 API
   ------------------------------------------------------------------ */

/**
 * fetchAndPlayAudio(scene, text)
 * ----------------------------------------------------------------------------
 * 指定テキストを音声合成で読み上げる。  
 * すでに読み上げ中の場合は完了を待ってから再生する。
 *
 * @param {Phaser.Scene} scene ― 呼び出し元シーン（未使用だが将来拡張に備えて残す）
 * @param {string}       text  ― 読み上げる文字列
 */
export async function fetchAndPlayAudio (scene, text) {
  if( !GAME_SETTINGS.voiceFlg ) return;
  /* 直前の読み上げが終わるまでブロック */
  if (speakingFlag) {
    await waitForSpeakingToFinish();
  }
  if (!utterance) {
    console.error('[speakingService] utterance が初期化されていません（voiceschanged 未発火）。');
    return;
  }

  speakingFlag      = true;
  utterance.text    = text;
  utterance.onend   = () => { speakingFlag = false; };

  window.speechSynthesis.speak(utterance);
}

/**
 * waitForSpeakingToFinish([callback])
 * ----------------------------------------------------------------------------
 * `speakingFlag` が false になる（＝読み上げ完了）まで待機する Promise を返す。
 * 追加でコールバックを指定すると完了後に一度だけ実行される。
 *
 * @param {Function} [callback] ― 読み上げ完了時に呼ぶ関数
 * @returns {Promise<void>}
 */
export function waitForSpeakingToFinish (callback) {
  return new Promise(res => {
    if (!GAME_SETTINGS.voiceFlg) {
      if (typeof callback === 'function') callback();
      res();
      return;
    }  
    const id = setInterval(() => {
      if (!speakingFlag) {
        clearInterval(id);
        if (typeof callback === 'function') callback();
        res();
      }
    }, 100);   // 0.1 秒ごとに状態をチェック
  });
}
