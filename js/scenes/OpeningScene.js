// scenes/OpeningScene.js

import { monstersData, tournamentData, strageData } from '../globalState.js';
import { GAME_SETTINGS, STRAGE_KEY }            from '../config.js';

// Phaser まわりの DOM 操作
import { addSpriteHoverEffect }             from '../utils/phaserUtil.js';

// ストレージ読み書き
import {
  saveStorageData,
  loadStorageData,
  removeStorageData,
  existsStorageData
} from '../utils/io.js';

// テキスト読み込み、アセット一括ロード
import { readTextFile, loadAssets }             from '../utils/io.js';
import { updateReference }                      from '../utils/data.js';

// カード描画コンポーネント
import { handleMonFilesSelect }                 from '../features/monster/MonsterCardRenderer.js';

// 発話サービス
import { fetchAndPlayAudio, waitForSpeakingToFinish } from '../services/speakingService.js';

// VRMレンダラー
import { getVRMRenderer }                       from '../features/avatar/VRMRenderer.js';


export default class OpeningScene extends Phaser.Scene {
  constructor() {
    super({ key: "openingScene" });
  }

  preload() {
    const manifest = {
      images: [
        { key: "OpeningImg", url: "assets/image/Opening.png" },
        { key: "CallMonButton", url: "assets/image/Select1Button.png" },
        { key: "BattleButton", url: "assets/image/Select2Button.png" },
        { key: "ReturnButton", url: "assets/image/Select3Button.png" },
        { key: "UploadButton", url: "assets/image/UploadButton.png" },
        { key: "CardBackImg", url: "assets/image/CardBack.png" },
        { key: "CardFrontImg", url: "assets/image/CardFront.png" },
        { key: "CardMonBackImg", url: "assets/image/monback.png" }
      ],
      audios: [
        { key: "OpeningBgm", url: "assets/bgm/ChatMonOpening.mp3" },
        { key: "SelectSound", url: "assets/sound/Select.mp3" }
      ]
    };
    loadAssets(this.load, manifest);
  }

  async create() {
    // BGM
    this.openingBgm = this.sound.add("OpeningBgm", { loop: true });
    this.openingBgm.setVolume(GAME_SETTINGS.bgmVolume);
    this.openingBgm.play();
    this.selectSound = this.sound.add("SelectSound");

    // 背景 & ロゴ
    this.add.image(0, 0, "OpeningImg").setOrigin(0);
    this.add.image(672, 250, "LogoImg").setOrigin(0.5);

    // ボタン初期化
    const select1Button = this.add.sprite(342, 700, "BattleButton").setVisible(false);
    const uploadButton  = this.add.sprite(1002, 700, "UploadButton").setVisible(false);
    const strageClear   = this.add.text(20, 20, "DELETE STRAGE", { fill: "#A88" })
                              .setInteractive()
                              .setVisible(false);

    // VRMレンダラー
    if(GAME_SETTINGS.vrmFlg){
      const renderer = await getVRMRenderer();
      renderer.setModelPosition(1.4, 0.15, 0);
      renderer.setModelRotation(0.2, 0.2, 0);
      renderer.setPoseImmediate("normal", false);
      renderer.setModelScale(0.1, 0.1, 0.1);
      renderer.setVisible(true);
      renderer.scaleModelTo(0.8, 0.8, 0.8);

      fetchAndPlayAudio(this, "チャットモンスターバトル。はじまります。");
      renderer.startHeadAnimation();
      waitForSpeakingToFinish(async () => {
        renderer.stopHeadAnimation();
        renderer.rotateModelTo(0.2, 0, 0);
        renderer.setPose("pointRight", false);

        uploadButton.setVisible(true);
        if (await existsStorageData(STRAGE_KEY)) {
          strageClear.setVisible(true);
          select1Button.setVisible(true);
          const stored = await loadStorageData(STRAGE_KEY);
          updateReference(monstersData, stored.monstersData);
          updateReference(tournamentData, stored.tournamentData);
        }
      });
      
    }else{
    // VRMアバターなし
      uploadButton.setVisible(true);
      if (await existsStorageData(STRAGE_KEY)) {
        strageClear.setVisible(true);
        select1Button.setVisible(true);
        const stored = await loadStorageData(STRAGE_KEY);
        updateReference(monstersData, stored.monstersData);
        updateReference(tournamentData, stored.tournamentData);
      }
    
    }


    // 既存データから「対戦へ」
    addSpriteHoverEffect(this, select1Button, () => {
      this.selectSound.setVolume(GAME_SETTINGS.effectVolume);
      this.selectSound.play();
      this.openingBgm.stop();
      this.scene.start("tournamentScene");
    });

    // ストレージ削除
    strageClear.on("pointerdown", async () => {
      if (await existsStorageData(STRAGE_KEY)
          && confirm("戦いの記録を消去しますか？")) {
        this.openingBgm.stop();
        await removeStorageData(STRAGE_KEY);
        this.scene.restart();
      }
    });

    // アップロード呼び出し
    addSpriteHoverEffect(this, uploadButton, () => {
      this.selectSound.setVolume(GAME_SETTINGS.effectVolume);
      this.selectSound.play();
      this.openingBgm.stop();
      const btn = document.getElementById("uploadMonsterFiles");
      if (btn) {
        btn.value = "";
        btn.click();
        btn.addEventListener("change", async evt => {
          const files = evt.target.files;
          if (!files.length) return;
          if (files.length<=1){
            alert("ファイルは２つ以上選択して下さい。");
            return;
          }
          if (files.length>16){
            alert("ファイルは最大１６までです。");
            return;
          }
          monstersData.length = 0;
          tournamentData.length = 0;
          await handleMonFilesSelect(files);
          //this.selectSound.play();
          this.scene.start("tournamentScene");
        }, { once: true });
      }
    });
  }
}
