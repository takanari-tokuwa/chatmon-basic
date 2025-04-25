// ────────────────────────────────────────────────────────────────
//  scenes/TournamentScene.js
//  モンスター召喚済みカードでトーナメント表を描画 & 進行管理
//  ■ 依存モジュールが分割されているため import パスを整理
//  ■ 参考ソースのロジックを 1:1 で移植（動作互換）
// ────────────────────────────────────────────────────────────────

// ----------------- アプリケーション状態 -------------------------
import { monstersData,
         tournamentData,
         battleState,
         strageData }                    from '../globalState.js';

// ----------------- 定数 / 設定 ---------------------------------
import { GAME_SETTINGS, STRAGE_KEY }     from '../config.js';

// ----------------- 汎用ユーティリティ ---------------------------
import { addSpriteHoverEffect,
         convertDataUrlToSprite }         from '../utils/phaserUtil.js';
import { readTextFile,
         loadAssets,
         saveStorageData,
         loadStorageData,
         removeStorageData,
         existsStorageData }             from '../utils/io.js';
import { wait }                          from '../utils/async.js';

// ----------------- 3D 解説キャラクター ---------------------------
import { getVRMRenderer }                from '../features/avatar/VRMRenderer.js';

// ----------------- 音声合成サービス ------------------------------
import { fetchAndPlayAudio,
         waitForSpeakingToFinish }       from '../services/speakingService.js';

// ----------------- フォント共通定義 ------------------------------
const FONT_FAMILY_JA =
  "'Noto Sans JP','Yu Gothic','Hiragino Sans','Meiryo',sans-serif";

// ────────────────────────────────────────────────────────────────
export default class TournamentScene extends Phaser.Scene {
  constructor() {
    super({ key: 'tournamentScene' });
  }

  /* ----------------------------------------------------------------
   *  preload ― 画像 / 音声アセットをロード
   * ---------------------------------------------------------------- */
  preload() {
    const manifest = {
      images: [
        { key: 'TournamentImg', url: 'assets/image/tournamentback.png' },
        { key: 'CrownImg',      url: 'assets/image/crown.png' },
        { key: 'BattleButton',  url: 'assets/image/Select2Button.png' },
        { key: "ReturnButton",  url: "assets/image/Select3Button.png" },
        { key: 'CardBackImg',   url: 'assets/image/CardBack.png' },
      ],
      audios: [
        { key: 'TournamentBgm',  url: 'assets/bgm/ChatMonTournament.mp3' },
        { key: 'TournamentBgm2', url: 'assets/bgm/ChatMonTournament2.mp3' },
        { key: 'SelectSound',    url: 'assets/sound/Select.mp3' },
      ],
    };
    loadAssets(this.load, manifest);

    // “透明四角テクスチャ” 生成（トーナメント枠のプレースホルダ）
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 0.5).fillRect(0, 0, 100, 100);
    g.generateTexture('square', 100, 100);
  }

  /* ----------------------------------------------------------------
   *  create ― トーナメント表を構築
   * ---------------------------------------------------------------- */
  async create() {
    /* ───────────── 画面共通変数 ───────────── */
    this.allPositions        = [];   // 各ラウンドの座標テーブル
    this.bottomRowPositions  = [];   // 最下段
    this.bottomRowImages     = [];   // 最下段スプライト
    this.squareSize          = 100;  // アイコン辺
    this.rowHeight           = 0;    // 1 段の高さ
    this.currentUploadIndex  = 0;    // “描画した数” カウンタ

    /* ───────────── 背景 & コピーライト ───────────── */
    this.add.image(
      this.game.config.width / 2,
      this.game.config.height / 2,
      'TournamentImg',
    ).setDisplaySize(this.game.config.width, this.game.config.height);

    /* ───────────── 出場数に応じた段数算定 ───────────── */
    const monCnt     = monstersData.length;
    this.screenCnt   = monCnt <= 2 ? 2 : monCnt <= 4 ? 4 : monCnt <= 8 ? 8 : 16;
    const rounds     = Math.log2(this.screenCnt) + 1;
    this.rowHeight   = this.game.config.height / rounds;

    /* ───────────── tournamentData が空なら初期生成 ───── */
    if (!tournamentData || tournamentData.length === 0) {
      await initTournamentData(this, monCnt);
    } else {
      // 既存データの場合でもテクスチャだけは毎回生成
      for (const tournamentWork of tournamentData) {
        if (!tournamentWork) continue;
        const monster = monstersData[tournamentWork.monstersDataIndex];
        if(tournamentWork.monstersDataIndex==undefined) continue;
        await convertDataUrlToSprite(this, tournamentWork.textureKey, monster.ImageData, true);
        
        // 名前を正式のものに
        tournamentWork.name = monstersData[tournamentWork.monstersDataIndex].Name;
        if( !tournamentWork.name || tournamentWork.name.length == "") tournamentWork.name= '?????';
        if( tournamentWork.name.length > 10) tournamentWork.name = tournamentWork.name.slice(0, 10) + '…';

      }
    }

    // 名前フォントサイズ調整
    this.nameFontSize = this.screenCnt === 2 ? "32px"
                      : this.screenCnt === 4 ? "24px"
                      : this.screenCnt === 8 ? "18px"
                      : "10px";

    // 画像サイズ調整
    this.squareSize = Math.min(
      this.game.config.width / (this.screenCnt + 1),
      ( this.game.config.height / (Math.log2(this.screenCnt) + 1) ) * 0.5
    );

    /* ───────────── 行レイアウト生成 ───────────── */
    buildBracketSkeleton(this);

    /* ───────────── 各モンスターのアイコン配置 ──────── */
    displayBottomRowIcons(this);

    /* ───────────── 過去の勝者を昇格描画 ───────────── */
    autoPromoteFinishedMatches(this);

    /* ───────────── UI ボタン ───────────── */
    const battleBtn = this.add
      .sprite(200, 60, 'BattleButton')
      .setScale(0.5)
      .setVisible(false);
    addSpriteHoverEffect(this, battleBtn, () => handleBattleClick(this));

    const returnBtn = this.add
      .sprite(1130, 60, 'ReturnButton')
      .setScale(0.5)
      .setVisible(false);
    addSpriteHoverEffect(this, returnBtn, () => {
      this.tournamentBgm.stop();
      this.scene.start('openingScene');
    });

    /* ───────────── BGM & 解説キャラ演出 ───────────── */
    playTournamentBgm(this);
    await playNarrationIntro(this);

    // 最終的にストレージへ保存
    strageData.monstersData   = monstersData;
    strageData.tournamentData = tournamentData;
    await saveStorageData(STRAGE_KEY, strageData);
    
    if(!isFinishedMatch()){
      // バトル画面へ遷移するボタンの表示
      battleBtn.setVisible(true);
    }
    // 戻る
    returnBtn.setVisible(true);
  }
}

/* =======================================================================
 *  ━━ 以下：ヘルパー関数群 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ===================================================================== */

/* ---------------------------- データ初期化 ------------------------- */

// 試合が始まっているかどうか？
function isAnyMatch() {
  return tournamentData.some(td => td?.battleResult > 0);
}

// 試合が終わっているかどうか？
function isFinishedMatch() {
  //return !tournamentData.some((td, i) => i < tournamentData.length - 1 && td?.battleResult === 0);
  // 既に戦いが残されたか？
  let endBattleFlg = true;
  for(let i=0 ; i< tournamentData.length ; i++ ){
    if( tournamentData[i] && !tournamentData[i].battleResult){
      if(i<(tournamentData.length-1)){
        endBattleFlg = false;
      }
    }
  }
  return endBattleFlg;
}

/* ---------------------------- データ初期化 ------------------------- */
async function initTournamentData(scene, monCnt) {
  // シャッフル
  const shuffled = Array.from({ length: monCnt }, (_, i) => i);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // ビットリバース配置
  const slots = new Array(scene.screenCnt).fill(null);
  setElementsByBitReversedIndexes(slots, shuffled);

  // tournamentData を 0 クリア
  tournamentData.length = 0;
  tournamentData.push(...Array(scene.screenCnt).fill(null));

  for (let i = 0; i < slots.length; i++) {
    const mi = slots[i];
    if (mi == null) continue;
    const mon = monstersData[mi];
    if (!mon?.ImageData) continue;

    const key  = `tournamentMon${mi}`;
    await convertDataUrlToSprite(scene, key, mon.ImageData, true);
    let name   = mon.Name;
    if( !name || name.length == "") name= '?????';
    if( name.length > 10) name.slice(0, 10) + '…';

    tournamentData[i] = {
      textureKey:       key,
      name,
      monstersDataIndex: mi,
      level:            0,
      index:            i,
      battleResult:     0,
    };

  }
}

/* ----------------------------ブラケット骨格 ----------------------- */
function buildBracketSkeleton(scene) {
  // 最下段
  layoutRow(scene, scene.screenCnt,
            scene.game.config.height - scene.rowHeight / 2);

  // 上層へ
  let current  = scene.bottomRowPositions;
  let remain   = scene.screenCnt / 2;
  let y        = scene.game.config.height - scene.rowHeight * 1.5;

  while (remain >= 1) {
    const nextRow = [];
    for (let i = 0; i < remain; i++) {
      const p1 = current[2 * i];
      const p2 = current[2 * i + 1];
      const x  = (p1.x + p2.x) / 2;
      const img = scene.add.image(x, y, 'square')
                   .setDisplaySize(scene.squareSize, scene.squareSize);
      img.isOccupied = false;
      nextRow.push({ x, y, image: img });
      drawHalfLine(scene, p1, { x, y }, true,
                   scene.squareSize, scene.rowHeight, 0);
      drawHalfLine(scene, p2, { x, y }, false,
                   scene.squareSize, scene.rowHeight, 0);
    }
    scene.allPositions.push(nextRow);
    current = nextRow;
    remain  = Math.floor(remain / 2);
    y      -= scene.rowHeight;
  }
}

/* 下段レイアウトユーティリティ */
function layoutRow(scene, count, y) {
  const W   = scene.game.config.width;
  const sq  = scene.squareSize;
  const gap = (W - count * sq) / (count + 1);
  let   x   = gap + sq / 2;
  for (let i = 0; i < count; i++) {
    const img = scene.add.image(x, y, 'square')
                 .setDisplaySize(sq, sq)
                 .setInteractive();
    scene.bottomRowImages.push(img);
    scene.bottomRowPositions.push({ x, y, image: img });
    x += sq + gap;
  }
  scene.allPositions.push(scene.bottomRowPositions.slice());
}

/* ---------------------------- 画像配置 ---------------------------- */
function displayBottomRowIcons(scene) {
  const sq = scene.squareSize;
  
  for (let i = 0; i < tournamentData.length; i++) {
    if (scene.currentUploadIndex >= scene.bottomRowImages.length) break;
    if ( tournamentData[i] && tournamentData[i].name){
      // 現在の配置先
      const { x, y } = scene.bottomRowPositions[scene.currentUploadIndex];
      const monImg = scene.bottomRowImages[scene.currentUploadIndex];

      // カードで見せない
      if( GAME_SETTINGS.cardHiddenFlg && !monstersData[tournamentData[i].monstersDataIndex].CardImageData){
        scene.returnButton = scene.add.sprite(x, y + (sq*1.4-sq)/2, "CardBackImg").setDisplaySize(sq*1.1, sq*1.4);
      }else{

        // 1) テクスチャを設定
        monImg.setTexture(tournamentData[i].textureKey);

        // 2) 画像の基準点を中央に（ヒット領域を描画と一致させる）
        monImg.setOrigin(0.5, 0.5);

        // 3) 正方形サイズに表示
        monImg.setDisplaySize(sq, sq);

        // スプライトを正しく配置
        monImg.setPosition(x, y);
        
        if (monImg.body) monImg.body.updateFromGameObject();

        // 4) ここで初めてインタラクティブ化（テクスチャ/サイズ決定後）

        monImg.setInteractive({ useHandCursor: true });
        let monIndex = scene.currentUploadIndex;

        // テキスト表示
        scene.add.text(
          x,
          y + sq / 2 + 10,
          tournamentData[i].name,
          {
            fill: '#fff',
            fontSize: scene.nameFontSize,
            fontFamily: FONT_FAMILY_JA
          }
        ).setOrigin(0.5, 0);
        
      }
    }

    scene.currentUploadIndex++;
  }
}

/* ---------------------------- 勝敗自動昇格 ------------------------ */
function autoPromoteFinishedMatches(scene) {
  for (let i = 0; i < tournamentData.length; i++) {
    if (tournamentData[i]?.battleResult === 1) {
      const winner = promoteData(scene, i);
      if( !tournamentData[winner].battleResult ) tournamentData[winner].battleResult = 0;
    }
  }
}

/* ---------------------------- バトル開始 -------------------------- */
function handleBattleClick(scene) {
  let dataIndx1 = 0;
  let dataIndx2 = 0;
  for (let i = 0; i < tournamentData.length; i++) {
    if( tournamentData[i] && tournamentData[i].battleResult == 0 ) {
      if( i % 2 === 0 ){ //偶数
        dataIndx1 =i;
        dataIndx2 =i+1;
      }
      if( i % 2 !== 0 ){ //奇数
        dataIndx1 =i-1;
        dataIndx2 =i;
      }
      if(!tournamentData[dataIndx1] || !tournamentData[dataIndx1].name){
        const winner = promoteData(scene,i);
        if(!tournamentData[dataIndx1]) tournamentData[dataIndx1] = {};
        if(!tournamentData[winner]) tournamentData[winner] = {};
        tournamentData[dataIndx1].battleResult = 2;
        tournamentData[dataIndx2].battleResult = 1;
        tournamentData[winner].battleResult = 0;
        break;
      }else if(!tournamentData[dataIndx2] || !tournamentData[dataIndx2].name){
        const winner = promoteData(scene,i);
        if(!tournamentData[dataIndx2]) tournamentData[dataIndx2] = {};
        if(!tournamentData[winner]) tournamentData[winner] = {};
        tournamentData[dataIndx1].battleResult = 1;
        tournamentData[dataIndx2].battleResult = 2;
        tournamentData[winner].battleResult = 0;
        break;
      }else{
        battleState.monsterData1.tournamentIndex = dataIndx1;
        battleState.monsterData2.tournamentIndex = dataIndx2;
        scene.tournamentBgm.stop();
        if( GAME_SETTINGS.cardResetFlg ) {
          monstersData[tournamentData[dataIndx1].monstersDataIndex].CardFrameNo = undefined;
          monstersData[tournamentData[dataIndx1].monstersDataIndex].CardImageData = undefined;

          monstersData[tournamentData[dataIndx2].monstersDataIndex].CardFrameNo = undefined;
          monstersData[tournamentData[dataIndx2].monstersDataIndex].CardImageData = undefined;
        }

        battleState.monsterData1.dataIndex=tournamentData[dataIndx1].monstersDataIndex;
        battleState.monsterData2.dataIndex=tournamentData[dataIndx2].monstersDataIndex;
        
        // データは作成依頼されていない状態とする
        battleState.isBattleDataRequest = false;
        
        // バトルシーンへ
        scene.scene.start('battleScene',{ 
              monsterDatas:[
                  monstersData[tournamentData[dataIndx1].monstersDataIndex],
                  monstersData[tournamentData[dataIndx2].monstersDataIndex]
              ],
        });

        break;
      }
    }
  }
}

/* ---------------------------- 昇格描画 --------------------------- */
function promoteData(scene, currentIndex) {
  let data = tournamentData[currentIndex];
  let currentLevel = data.level;
  let nextLevel = currentLevel+1;
  if(nextLevel >= scene.allPositions.length) return;
  let nextIndex = Math.floor(data.index/2);
  let positions = scene.allPositions[nextLevel];
  
  let upperImage = positions[nextIndex].image;
  
  const image = scene.bottomRowImages[0];
  let baseCnt =0;
  for( let i=0 ; i<nextLevel ; i++){
    baseCnt = baseCnt + scene.screenCnt / Math.pow(2, i)
  }
  
  // 名前を正式のものに
  data.name = monstersData[data.monstersDataIndex].Name;
  if( !data.name || data.name.length == "") data.name= '?????';
  if( data.name.length > 10) data.name = data.name.slice(0, 10) + '…';
  
  // 埋まっていない場合のみ処理する
  if(!upperImage.isOccupied) {
  
    /* 敗者側線描画 & アイコンフェード */
    let siblingIndex = (data.index %2===0)? data.index+1 : data.index-1;
    let losingImg = scene.allPositions[currentLevel][siblingIndex].image;
    losingImg.setAlpha(0.2);
    
    drawHalfLine(scene, scene.allPositions[currentLevel][siblingIndex], upperImage, data.index%2===0, image.displayWidth, scene.rowHeight, 1);
    drawHalfLine(scene, scene.allPositions[currentLevel][data.index], upperImage, data.index%2===0, image.displayWidth, scene.rowHeight, 2);
    
    /* 勝者アイコン & 名前表示 */
    upperImage.setTexture(data.textureKey).setDisplaySize(image.displayWidth, image.displayHeight);
    scene.add.text(upperImage.x, upperImage.y + image.displayHeight/2 +10, data.name,{
      fill:'#fff', fontSize:scene.nameFontSize, fontFamily: FONT_FAMILY_JA
    }).setOrigin(0.5,0);
    upperImage.isOccupied=true;

    /* 次バトル用設定 */
    if(currentLevel === scene.allPositions.length-2) {
      scene.add.image(upperImage.x, upperImage.y - image.displayHeight/2 - 20, "CrownImg").setDisplaySize(89,40);
    }
    
    /* tournamentData に次レベルを登録 */
    const tournamentIndex = baseCnt + nextIndex;
    if(!tournamentData[tournamentIndex]){
      tournamentData[tournamentIndex]={};
	    tournamentData[tournamentIndex].textureKey        = data.textureKey;
	    tournamentData[tournamentIndex].name              = data.name;
	    tournamentData[tournamentIndex].monstersDataIndex = data.monstersDataIndex;
	    tournamentData[tournamentIndex].level             = nextLevel;
	    tournamentData[tournamentIndex].index             = nextIndex;
    }

    // 決勝で王冠
    if( GAME_SETTINGS.cardHiddenFlg && !monstersData[tournamentData[tournamentIndex].monstersDataIndex].CardImageData){
        scene.returnButton = scene.add.sprite(upperImage.x, upperImage.y + (image.displayHeight*1.4-image.displayHeight)/2, "CardBackImg").setDisplaySize(image.displayWidth*1.1, image.displayHeight*1.4);
    }
  }
  return baseCnt + nextIndex;
}


function calcArrayIndex(scene, level, idxInLevel) {
  // レベル毎に要素数: screenCnt / 2^level
  let offset = 0;
  for (let lv = 0; lv < level; lv++) offset += scene.screenCnt / 2 ** lv;
  return offset + idxInLevel;
}

/* ---------------------------- BGM 再生 -------------------------- */
function playTournamentBgm(scene) {
  const finishedMatch = isFinishedMatch();
  const bgmKey = finishedMatch ? 'TournamentBgm2' : 'TournamentBgm';
  scene.tournamentBgm = scene.sound.add(bgmKey, { loop: true });
  scene.tournamentBgm.setVolume(GAME_SETTINGS.bgmVolume).play();
}

/* ---------------------------- ナレーション ----------------------- */
async function playNarrationIntro(scene) {

  if(!GAME_SETTINGS.vrmFlg) return;
  const renderer  = await getVRMRenderer();
  const anyMatch  = isAnyMatch();
  const finishedMatch = isFinishedMatch();

  // VRM ポーズ初期位置
  const yOffset = scene.screenCnt === 16 ? 0.75
               : scene.screenCnt ===  8 ? 0.50
               : scene.screenCnt ===  4 ? 0.20
               :                           -0.1;
  const scl      = scene.screenCnt === 16 ? 0.50
               : scene.screenCnt ===  8 ? 0.60
               : scene.screenCnt ===  4 ? 0.70
               :                           0.75;
  renderer.moveModelTo(0, yOffset, 0);
  renderer.scaleModelTo(scl, scl, scl);
  renderer.setPose('normal');
  renderer.rotateModelTo(0, Math.PI * 2, 0);

  if (!anyMatch) {
    await narrativeOpening(scene, renderer);
  } else if (finishedMatch) {
    await narrativeChampion(scene, renderer);
  }
}
async function narrativeOpening(scene, renderer) {

  if(!GAME_SETTINGS.vrmFlg) return;
  await fetchAndPlayAudio(scene, 'チャットモンスターバトルトーナメントが開幕しました。');
  renderer.startHeadAnimation();
  await waitForSpeakingToFinish();
  renderer.stopHeadAnimation();

  await fetchAndPlayAudio(scene, `あわせて、${monstersData.length}名のモンスターたちによる熱い戦いが始まります。`);
  renderer.startHeadAnimation();
  renderer.setPose('pointRight');
  await renderer.waitForTransitionEnd();
  renderer.rotateModelTo(0, 0, 0);
  renderer.setPose('pointLeft');
  await renderer.waitForTransitionEnd();
  await waitForSpeakingToFinish();
  renderer.stopHeadAnimation();
  renderer.setPose('normal');
  await renderer.waitForTransitionEnd();
}
async function narrativeChampion(scene, renderer) {

  if(!GAME_SETTINGS.vrmFlg) return;
  await fetchAndPlayAudio(scene, 'チャットモンスターバトルトーナメントの優勝が決まりました。');
  renderer.startHeadAnimation();
  await waitForSpeakingToFinish();
  renderer.stopHeadAnimation();

  renderer.setPose('banzai');
  await renderer.waitForTransitionEnd();
  await fetchAndPlayAudio(scene, '優勝は…。');
  await waitForSpeakingToFinish();
  await wait(1000);

  const champName =
    monstersData[tournamentData[tournamentData.length - 1].monstersDataIndex]
      .Name;
  await fetchAndPlayAudio(scene, `${champName} です！`);
  await waitForSpeakingToFinish();
  await wait(1000);

  await fetchAndPlayAudio(scene, 'おめでとうございます！');
  await waitForSpeakingToFinish();
  renderer.stopHeadAnimation();
  renderer.setPose('normal');
}

/* ---------------------------- ヘルパー（ビットリバース）-------- */
function generateBitReversedIndexes(N) {
  return Array.from({ length: N }, (_, i) =>
    parseInt(i.toString(2).padStart(Math.log2(N), '0').split('').reverse().join(''), 2),
  );
}
function setElementsByBitReversedIndexes(dst, src) {
  const order = generateBitReversedIndexes(dst.length);
  let si = 0;
  for (const pos of order) {
    if (si >= src.length) break;
    dst[pos] = src[si++];
  }
}

/* ---------------------------- 線描画ユーティリティ -------------- */
function drawLine(scene, a, b, col = 0xffffff) {
  const g = scene.add.graphics();
  g.lineStyle(5, col, 1).beginPath().moveTo(a.x, a.y).lineTo(b.x, b.y).strokePath();
}
function drawHalfLine(scene, start, end, leftSide, sq, rh, redLvl) {
  const mx = leftSide ? start.x + (end.x - start.x) : end.x;
  const c1 = redLvl >= 1 ? 0xff0000 : 0xffffff;
  const c2 = redLvl === 2 ? 0xff0000 : 0xffffff;

  drawLine(scene, { x: mx,      y: end.y + rh / 2 }, { x: mx,      y: end.y + sq / 2 }, c2);
  drawLine(scene, { x: start.x, y: end.y + rh / 2 }, { x: mx,      y: end.y + rh / 2 }, c2);
  drawLine(scene, { x: start.x, y: start.y - sq / 2 }, { x: start.x, y: end.y + rh / 2 }, c1);
}
