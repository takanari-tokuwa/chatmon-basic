// scenes/SettingScene.js

import { CONFIG,
         GAME_SETTINGS,
         FIELD_CONFIG,
         promptForApiKey }        from '../config.js';
import { createSettingsModal }    from '../modal.js';
import { addSpriteHoverEffect,
         removeExtraCanvas }      from '../utils/phaserUtil.js';
import { loadAssets }             from '../utils/io.js';
import { getEmbedding }           from '../services/chatService.js';
import { getVRMRenderer }         from '../features/avatar/VRMRenderer.js';


export default class SettingScene extends Phaser.Scene {
  constructor() {
    super({ key: "settingScene" });
  }

  preload() {
    // 共通アセットマニフェスト
    const manifest = {
      images: [
        { key: "SettingImg", url: "assets/image/Setting.png" },
        { key: "LogoImg", url: "assets/image/logo.png" },
        { key: "SettingIcon", url: "assets/image/SettingIcon.png" },
        { key: "StartButton", url: "assets/image/StartButton.png" }
      ],
      audios: [
        { key: "SelectSound", url: "assets/sound/Select.mp3" }
      ]
    };
    loadAssets(this.load, manifest);
  }

  async create() {
    // 余分な canvas を削除
    this.removeExtraCanvas();

    const { width, height } = CONFIG.PHASER;

    // 背景
    this.add.image(0, 0, "SettingImg").setOrigin(0);

    // ロゴ
    this.add.image(width / 2, 200, "LogoImg")
      .setOrigin(0.5)
      .setScale(0.8);

    // 設定ボタン
    const settingsBtn = this.add.sprite(width - 62, height - 83, "SettingIcon")
      .setOrigin(0.5)
      .setScale(0.5)
      .setInteractive();

    addSpriteHoverEffect(this, settingsBtn, () => {
      const existing = document.getElementById("settingsModal");
      if (existing && existing.style.display !== "none") {
        return;
      }
      createSettingsModal();
      const modalElem = document.getElementById("settingsModal");
      if (modalElem) {
        modalElem.style.display = "flex";
      } else {
        console.error("settingsModal 要素が見つかりません。");
      }
    });

    // 開始ボタン
    const startBtn = this.add.sprite(width / 2, height - 100, "StartButton")
      .setOrigin(0.5)
      .setInteractive();

    addSpriteHoverEffect(this, startBtn, () => {
      const modalElem = document.getElementById("settingsModal");
      if (modalElem && modalElem.style.display !== "none") {
        return;
      }
      if (!GAME_SETTINGS.modelName_Summon || !GAME_SETTINGS.debugMode_Battle) {
        if (!promptForApiKey()) return;
      }
      this.scene.start("openingScene");
    });

    // ホバー cursor
    startBtn.on("pointerover", () => {
      this.input.setDefaultCursor("pointer");
      startBtn.setTint(0x88CCFF);
    });
    startBtn.on("pointerout", () => {
      this.input.setDefaultCursor("auto");
      startBtn.clearTint();
    });
  }

  /**
   * 余分な canvas 削除
   */
  removeExtraCanvas() {
    const container = document.getElementById("game-container");
    const canvases = container.getElementsByTagName("canvas");
    if (canvases.length > 1) {
      for (let i = 1; i < canvases.length; i++) {
        container.removeChild(canvases[i]);
      }
      console.log("不要な Canvas を削除しました。");
    }
  }
}
