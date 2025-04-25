// scenes/MonsterBattleScene.js

import { GAME_SETTINGS,
         FIELD_CONFIG,
         dummyName1,
         dummyName2 }                   from '../config.js';
import { battleState,
         tournamentData }               from '../globalState.js';
import { addSpriteHoverEffect}          from '../utils/phaserUtil.js';
import { extractNumericValue }          from '../utils/data.js';
import { wait }                         from '../utils/async.js';
import { readTextFile,
         loadAssets }                   from '../utils/io.js';
import { convertMonsterName,
         sanitizeComment }              from '../features/monster/MonsterCharacter.js';
import { getVRMRenderer }               from '../features/avatar/VRMRenderer.js';
import { fetchAndPlayAudio,
         waitForSpeakingToFinish }      from '../services/speakingService.js';


/**
 * MonsterBattleScene
 * このシーンは、実際のモンスターバトルを進行し、各ターンの情報を表示、最終的な勝者の結果を演出します。
 * 以下の役割に分けて実装しています。
 * 
 * [UIレンダリング]
 *   - バトル背景、戦闘情報ウィンドウ、テキストオブジェクトの生成
 *   - 戻るボタンの配置と処理
 *
 * [バトル進行]
 *   - resulBattle の BattleSituation 配列をもとに、各ターンの情報を定期的に表示
 *   - 未取得の場合は待機して、データ取得後に処理を開始
 *
 * [テキストアニメーション]
 *   - 各ターンの BattleCommentary を 1文字ずつ表示
 *
 * [サウンド管理・フェード演出]
 *   - 各ターン開始時に効果音を再生
 *   - カメラのフェードアウト・フェードイン演出で、シーン切替え感を演出
 *
 * [最終結果表示]
 *   - 最終ターンの状態を元に、勝者に応じた演出（カードのアニメーション、終了効果音）を実施
 */

export default class MonsterBattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'monsterBattleScene' });
    // インターバルや待機タイマーのIDを管理するためのプロパティ
    this.battleInterval = null;
    this.waitInterval = null;
    // シーン内の進行状態フラグ
    this.isBattleInProgress = false;
    this.isTextDisplaying = false;
  }

  /**
   * init:
   */
  init(data) {
    // OpeningScene から渡されるモンスターデータ
    this.monsterDatas = data.monsterDatas;
  }
  
  preload() {
  
    // 共通アセットマニフェスト
    const manifest = {
      images: [
        { key: "BattleImg", url: "assets/image/Battle.png" }
      ],
      audios: [
        { key: "Effect1", url: "assets/sound/effect1.mp3" },
        { key: "Effect2", url: "assets/sound/effect2.mp3" },
        { key: "Effect3", url: "assets/sound/effect3.mp3" },
        { key: "Effect4", url: "assets/sound/effect4.mp3" },
        { key: "Finish", url: "assets/sound/finish.mp3" },
      ]
    };
    
    for (let i = 0; i < FIELD_CONFIG.length; i++) {
      const fieldNo = FIELD_CONFIG[i].fieldNo ;
      const imgData =  { key: "MonsterBattleImg" + fieldNo , url: "assets/image/fields/MonsterBattle" + fieldNo + ".png" }
      manifest.images.push(imgData);
      const bgmData =  { key: "MonsterBattleBgm" + fieldNo , url: "assets/bgm/ChatMonMonsterBattle" + fieldNo + ".mp3" }
      manifest.audios.push(bgmData);
    
    }
    
    // 共通のロード関数を呼び出す
    loadAssets(this.load, manifest);

  }
  
  async create() {
  
    this.monsterBattleImage = undefined;
  	this.monBattleBgm = undefined;

    // VRMモデルの初期化・表示
    if(GAME_SETTINGS.vrmFlg){
      this.renderer3D = await getVRMRenderer();
      this.renderer3D.setVisible(true);
    }

    // シーンフェードイン／効果音で演出
    this.playRandomEffectSound();
    this.cameras.main.fadeIn(1000);
    this.cameras.main.fadeOut(1000);
    this.cameras.main.fadeIn(1000);

    // 戻るボタンとコメント表示領域をセットアップ
    this.setupReturnButton();
    this.setupBattleText();

    // バトル進行をキックオフ
    this.startBattleProgress();
    battleState.isBattleDataRequest = false;
  }

  /** 戻るボタンを画面下部に設置 */
  setupReturnButton() {
    this.returnBtn = this.add
      .sprite(672, 745, 'ReturnButton')
      .setScale(0.5)
      .setVisible(false);
    addSpriteHoverEffect(this, this.returnBtn, () => {
      if (this.isBattleInProgress) {
        alert("バトルデータ取得中です。しばらくお待ち下さい。");
        return;
      }
      this.monBattleBgm.stop();
      this.stopBattleProgress();
      this.scene.start('tournamentScene');
    });
  }

  /** 上部テキスト表示領域を2行分作成 */
  setupBattleText() {
    this.displayText1 = this.add.text(110, 520, '', {
      fontFamily: "'Arial', sans-serif",
      fontSize: "28px",
      color: "#ffffff",
      wordWrap: { width: 1124, useAdvancedWrap: true }
    }).setDepth(1);

    this.displayText2 = this.add.text(120, 560, '', {
      fontFamily: "'Arial', sans-serif",
      fontSize: "28px",
      color: "#ffffff",
      wordWrap: { width: 1104, useAdvancedWrap: true }
    }).setDepth(1);
  }

  /** バトルデータが揃うまで待機し、揃い次第ターン表示を開始 */
  startBattleProgress() {
    if(GAME_SETTINGS.vrmFlg){
      this.renderer3D.setPose('normal');
    }
    let waitCnt = 0;

    if (typeof battleState.resulBattle === "undefined" || battleState.isRunBattleData) {
      // ローディングメッセージ
      const loadingText = this.add.text(350, 50, "戦いの準備中...", {
        fontFamily: "'Arial', sans-serif",
        fontSize: "28px",
        color: "#ffffff"
      });
      this.waitInterval = setInterval(() => {
        if (battleState.resulBattle !== undefined && !battleState.isRunBattleData) {
          clearInterval(this.waitInterval);
          loadingText.destroy();
          this.progressBattle();
        } else {
          if(GAME_SETTINGS.vrmFlg){
            // VRMモデルを左右に揺らすだけの演出
            waitCnt++;
            if (waitCnt === 5) this.renderer3D.rotateModelTo(0, 6.4, 0);
            if (waitCnt === 10) {
              this.renderer3D.rotateModelTo(0, 0, 0);
              waitCnt = 0;
            }
	        }
        }
      }, 1000);
    } else {
      this.progressBattle();
    }
  }

  /** バトル進行・演出のメインループ */
  async progressBattle() {
    this.isBattleInProgress = true;

    if(GAME_SETTINGS.vrmFlg){
      // VRM: 初期ポーズ＆配置
      this.renderer3D.setPose('normal');
      this.renderer3D.moveModelTo(0, 0.75, 0);
      this.renderer3D.scaleModelTo(0.5, 0.5, 0.5);
      this.renderer3D.rotateModelTo(0, 0, 0);
    }

    // 画面背景のフェードイン
    this.monsterBattleImage = this.add.image(0, 0, 'MonsterBattleImg' + battleState.battleFieldNo).setOrigin(0);

    // カードの描写
    this.cardSprite1 = this.add.sprite(220, 230, 'card01');
    this.cardSprite2 = this.add.sprite(1120, 230, 'card02');
    this.cardSprite1.setDisplaySize(307,432);
    this.cardSprite2.setDisplaySize(307,432);

    // UI作成
    this.setupReturnButton();
    this.setupBattleText();

    // BGMループ再生
    this.monBattleBgm = this.sound.add('MonsterBattleBgm' + battleState.battleFieldNo, { loop: true });
    this.monBattleBgm.setVolume(GAME_SETTINGS.bgmVolume);
    this.monBattleBgm.play();

    // 初期情報（開始時刻・場所）を表示
    this.displayStartTimeAndLocation();

    // 開始案内
    const startInfo = `開始時間：${battleState.resulBattle.StartTime}、戦闘場所：${battleState.resulBattle.BattleLocation}`;
    fetchAndPlayAudio(this, `戦いが始まります！ ${startInfo}`);
    await waitForSpeakingToFinish();

    // ターン描画ループ
    const battleData = battleState.resulBattle.BattleSituation;
    let turnIndex = 0, waitCount = 0, waitBase = 20;
    this.displayNextTurn(turnIndex, battleData);
    turnIndex++;

    this.battleInterval = setInterval(async () => {
      if (turnIndex < battleData.length) {
        if (this.isTextDisplaying) {
          waitCount = waitBase;
        } else if (waitCount <= 0) {
          this.displayNextTurn(turnIndex, battleData);
          turnIndex++;
        } else {
          waitCount--;
        }
      } else {
        if (this.isTextDisplaying) {
          waitCount = waitBase;
        } else if (waitCount <= 0) {
          clearInterval(this.battleInterval);
          await this.displayConclusion();
        } else {
          waitCount--;
        }
      }
    }, 100);
  }
  
  /**
   * stopBattleProgress:
   * ターン進行ループを停止し、待機タイマーもクリアします。
   */
  stopBattleProgress() {
    this.isBattleInProgress = false;
    if (this.battleInterval) clearInterval(this.battleInterval);
    if (this.waitInterval) clearInterval(this.waitInterval);
  }
  
  /* --------------------------------------------------
     バトル情報表示（UI更新）
  -----------------------------------------------------*/

  /**
   * displayStartTimeAndLocation:
   * 戦闘開始時刻と場所の情報ウィンドウを画面上部に描画します。
   */
  displayStartTimeAndLocation() {
    const graphics_place = this.add.graphics();
    const placeWinBase = 25;
    graphics_place.fillStyle(0x000000, 0.7);
    graphics_place.fillRoundedRect(422, placeWinBase, 500, 100, 20);
    const startTimeText = `開始時間：${battleState.resulBattle.StartTime}`;
    const locationText = `戦闘場所：${battleState.resulBattle.BattleLocation}`;
    this.add.text(450, placeWinBase + 20, startTimeText, {
      fontFamily: "'Arial', sans-serif",
      fontSize: "24px",
      color: "#ffffff"
    }).setDepth(1);
    this.add.text(450, placeWinBase + 55, locationText, {
      fontFamily: "'Arial', sans-serif",
      fontSize: "24px",
      color: "#ffffff"
    }).setDepth(1);

    // 下部ウィンドウ背景
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.7);
    graphics.fillRoundedRect(80, 495, 1184, 220, 20);
  }

  /** 上部テキストとゲージを更新し、効果音・ポーズ切替を行う */
  displayNextTurn(turnIndex, battleData) {
    // ランダム効果音 or BattleEffectによる選択
    const effects = ['Effect1', 'Effect2', 'Effect3', 'Effect4'];
    let battleEffectIdx = parseInt(battleData[turnIndex].BattleEffect);
    battleEffectIdx = battleEffectIdx >= 1 && battleEffectIdx <= 4 ? battleEffectIdx - 1 : Math.floor(Math.random() * 4);
    const sound = this.sound.add(effects[battleEffectIdx]);
    sound.setVolume(GAME_SETTINGS.effectVolume);
    sound.play();

    // カメラフェード
    this.cameras.main.fadeOut(500);
    this.cameras.main.fadeIn(500);

    // ゲージ更新
    this.displayBattleSituation(turnIndex, battleData);

    // 時間表示
    this.displayText1.setText(battleData[turnIndex].Time);

    // コメント一文字ずつ表示
    const namesMap = { [dummyName1]: this.monsterDatas[0].Name, [dummyName2]: this.monsterDatas[1].Name };
    const comment = convertMonsterName(sanitizeComment(battleData[turnIndex].BattleCommentary), namesMap, true);
    
    this.displayText2.setText("");
    this.isTextDisplaying = true;

    if(GAME_SETTINGS.vrmFlg){
      // VRMポーズ切替
      if (battleEffectIdx == 1) {
        this.renderer3D.rotateModelTo(0, 6.3, 0);
        this.renderer3D.setPose('banzai',false);
      }
      if (battleEffectIdx == 2) {
        this.renderer3D.rotateModelTo(0, 0, 0);
        this.renderer3D.setPose('normal',false);
      }
      if (battleEffectIdx == 3) {
        this.renderer3D.rotateModelTo(0, -6.3, 0);
        this.renderer3D.setPose('normal',false);
      }
      if (battleEffectIdx == 4) {
        this.renderer3D.rotateModelTo(0, 0, 0);
        this.renderer3D.setPose('banzai',false);
      }
      this.renderer3D.startHeadAnimation();
    }
    fetchAndPlayAudio(this, comment);
    
    
    
    this.showTextAnimated(this.displayText2, comment, 0, 100)
      .then(() => this.isTextDisplaying = false);
  }

  /** 指定されたターンの、各モンスターのCondition値（状態）を取得し、条件バーを描画します */
  displayBattleSituation(turnIndex, battleData) {
    let c1 = Math.max(0, Math.min(parseInt(battleData[turnIndex].Monster1Condition), 100));
    let c2 = Math.max(0, Math.min(parseInt(battleData[turnIndex].Monster2Condition), 100));
    this.drawConditionBars(c1, c2);
  }

  /** 条件バーを2本描画 */
  drawConditionBars(c1, c2) {
    const g = this.add.graphics();
    const w = 280, h = 20, y = 460;
    const x1 = 672 - 445 - 140, x2 = 672 + 445 - 140;
    // 背景バー
    g.fillStyle(0x444444, 1);
    g.fillRoundedRect(x1, y, w, h, h / 2);
    g.fillRoundedRect(x2, y, w, h, h / 2);
    // 前景バー
    if (c1 > 0) {
      g.fillStyle(0x44FF44, 1);
      g.fillRoundedRect(x1, y, w * this.calculateBarLength(c1), h, h / 2);
    }
    if (c2 > 0) {
      g.fillStyle(0x44FF44, 1);
      g.fillRoundedRect(x2, y, w * this.calculateBarLength(c2), h, h / 2);
    }
  }
  
  /** 条件値を非線形マッピング */
  calculateBarLength(v) {
    if (v <= 30) return v / 100;
    const extra = (v - 30) / 70;
    return 0.3 + Math.pow(extra, 2) * 0.7;
  }

  /** バトル終了後の勝敗表示・演出 */
  async displayConclusion() {
    const lastTurn = battleState.resulBattle.BattleSituation.slice(-1)[0];
    let c1 = Math.max(0, Math.min(parseInt(lastTurn.Monster1Condition), 100));
    let c2 = Math.max(0, Math.min(parseInt(lastTurn.Monster2Condition), 100));
    this.drawConditionBars(c1, c2);

    // 勝敗判定ロジック
    const winnerName = battleState.resulBattle.Winner.trim();
    
    if (winnerName === dummyName1) {
      tournamentData[battleState.monsterData1.tournamentIndex].battleResult=1;
      tournamentData[battleState.monsterData2.tournamentIndex].battleResult=2;
    }else if (winnerName === dummyName2) {
      tournamentData[battleState.monsterData1.tournamentIndex].battleResult=2;
      tournamentData[battleState.monsterData2.tournamentIndex].battleResult=1;
    }else{
      if (c1 > c2) {
        tournamentData[battleState.monsterData1.tournamentIndex].battleResult=1;
        tournamentData[battleState.monsterData2.tournamentIndex].battleResult=2;
      }else{
        tournamentData[battleState.monsterData1.tournamentIndex].battleResult=2;
        tournamentData[battleState.monsterData2.tournamentIndex].battleResult=1;
      }
    }

    // テキスト表示
    const namesMap = { [dummyName1]: this.monsterDatas[0].Name, [dummyName2]: this.monsterDatas[1].Name };
    const conclusion1 = '勝者: ' + convertMonsterName(winnerName, namesMap, false);
    const conclusion2 = convertMonsterName(battleState.resulBattle.ConclusionOfBattle, namesMap, true);
    this.displayText1.setText(conclusion1);
    this.displayText2.setText(conclusion2);

    // 終了効果音
    if (c1 <= 0 || c2 <= 0) {
      const finish = this.sound.add('Finish');
      finish.setVolume(GAME_SETTINGS.effectVolume);
      finish.play();
    } else {
      const eff = this.sound.add('Effect1');
      eff.setVolume(GAME_SETTINGS.effectVolume);
      eff.play();
      setTimeout(() => {
        const fin = this.sound.add('Finish');
        fin.setVolume(GAME_SETTINGS.effectVolume);
        fin.play();
        if (tournamentData[battleState.monsterData1.tournamentIndex].battleResult === 1) {
          this.drawConditionBars(c1, 0);
        } else {
          this.drawConditionBars(0, c2);
        }
      }, 2000);
    }

    // カード演出（左右どちらかを強調）
    if (winnerName === dummyName1) {
      if(GAME_SETTINGS.vrmFlg) this.renderer3D.setPose('pointLeft');
      this.cardSprite2.setTint(0xAAAACC);
      this.tweens.add({
        targets: this.cardSprite2,
        alpha: 0.3,
        duration: 10000
      });
      this.cardSprite1.setDepth(1);
      this.tweens.add({
        targets: this.cardSprite1,
        scale: 0.4,
        duration: 500,
        repeat: -1,
        yoyo: true
      });
    } else {
      if(GAME_SETTINGS.vrmFlg) this.renderer3D.setPose('pointRight');
      this.cardSprite1.setTint(0xAAAACC);
      this.tweens.add({
        targets: this.cardSprite1,
        alpha: 0.3,
        duration: 10000
      });
      this.cardSprite2.setDepth(1);
      this.tweens.add({
        targets: this.cardSprite2,
        scale: 0.4,
        duration: 500,
        repeat: -1,
        yoyo: true
      });
    }
    
    // VRMでアニメーション＋音声
    if(GAME_SETTINGS.vrmFlg) this.renderer3D.startHeadAnimation();
    fetchAndPlayAudio(this, conclusion1);
    fetchAndPlayAudio(this, conclusion2);
    await waitForSpeakingToFinish();
    if(GAME_SETTINGS.vrmFlg) this.renderer3D.stopHeadAnimation();

    await waitForSpeakingToFinish();
    // 戻るボタン表示
    this.returnBtn.setVisible(true);
    this.isBattleInProgress = false;
    battleState.resulBattle = undefined;
  }

  /** 指定テキストを1文字ずつ表示 */
  async showTextAnimated(textObj, text, idx = 0, delay = 100) {
    for (let i = idx; i < text.length; i++) {
      textObj.setText(textObj.text + text[i]);
      await new Promise(r => setTimeout(r, delay));
    }
    if(GAME_SETTINGS.vrmFlg) this.renderer3D.stopHeadAnimation();
    await waitForSpeakingToFinish();
  }

  /** ランダムな効果音を1つ再生 */
  playRandomEffectSound() {
    const effects = ['Effect1', 'Effect2', 'Effect3', 'Effect4'];
    const sound = this.sound.add(effects[Math.floor(Math.random() * effects.length)]);
    sound.setVolume(GAME_SETTINGS.effectVolume);
    sound.play();
  }
}
