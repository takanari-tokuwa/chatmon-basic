// scenes/BattleScene.js

import { GAME_SETTINGS }                 from '../config.js';
import { monstersData,
         battleState }                   from '../globalState.js';
import { MonsterCardRenderer }           from '../features/monster/MonsterCardRenderer.js';
import { loadAssets }                    from '../utils/io.js';
import { addSpriteHoverEffect }          from '../utils/phaserUtil.js';
import { getVRMRenderer }                from '../features/avatar/VRMRenderer.js';
import { fetchAndPlayAudio,
         waitForSpeakingToFinish }       from '../services/speakingService.js';
import { monsterBattleRun }              from '../services/chatService.js';


export default class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'battleScene' });
    this.editCardNo = "01";
  }

  preload() {
    // 共通アセットマニフェスト
    const manifest = {
      images: [
        { key: "BattleButton", url: "assets/image/Select2Button.png" },
        { key: "ReturnButton", url: "assets/image/Select3Button.png" },
        { key: "BattleImg",    url: "assets/image/Battle.png" },
        { key: "CardBackImg",  url: "assets/image/CardBack.png" }
      ],
      audios: [
        { key: "BattleBgm",    url: "assets/bgm/ChatMonBattle.mp3" },
        { key: "SelectSound",  url: "assets/sound/Select.mp3" }
      ]
    };
    // 共通のロード関数
    loadAssets(this.load, manifest);
  }

  /**
   * init:
   * @param {{ monsterDatas: [object, object] }} data
   */
  init(data) {
    this.battleCards1 = data.monsterDatas[0];
    this.battleCards2 = data.monsterDatas[1];
  }

  async create() {
    // BGM再生
    this.battleBgm = this.sound.add('BattleBgm', { loop: true });
    this.battleBgm.setVolume(GAME_SETTINGS.bgmVolume);
    this.battleBgm.play();

    this.selectSound = this.sound.add('SelectSound');

    // 背景
    this.add.image(0, 0, 'BattleImg').setOrigin(0);
    this.cameras.main.fadeIn(1000);

    // カード描画用レンダラーを作成
    const renderer1 = new MonsterCardRenderer(this, this.battleCards1);
    const renderer2 = new MonsterCardRenderer(this, this.battleCards2);

    let card1Shown = true;
    let card2Shown = true;
    // カード1描画 or 背面表示
    let card01 = await renderer1.drawCard(672 - 400, 350, 490, 680, "card01");
    if (!card01) {
      card01 = this.add.sprite(672 - 400, 350, 'CardBackImg').setDisplaySize(490, 680);
      card1Shown = false;
    }
    addSpriteHoverEffect(this, card01, () => {
      this.editCardNo = "01";
      this.selectSound.setVolume(GAME_SETTINGS.effectVolume);
      this.selectSound.play();
      this.battleBgm.stop();
      this.scene.start('summonScene', {
        monsterData: this.battleCards1,
        promptNo: GAME_SETTINGS.callMonPromptNo1
      });
    });

    // カード2描画 or 背面表示
    let card02 = await renderer2.drawCard(672 + 400, 350, 490, 680, "card02");
    if (!card02) {
      card02 = this.add.sprite(672 + 400, 350, 'CardBackImg').setDisplaySize(490, 680);
      card2Shown = false;
    }
    addSpriteHoverEffect(this, card02, () => {
      this.editCardNo = "02";
      this.selectSound.setVolume(GAME_SETTINGS.effectVolume);
      this.selectSound.play();
      this.battleBgm.stop();
      this.scene.start('summonScene', {
        monsterData: this.battleCards2,
        promptNo: GAME_SETTINGS.callMonPromptNo2
      });
    });

    // バトル開始ボタン（非表示）
    this.startBattleBtn = this.add.sprite(672 - 330, 720, 'BattleButton').setVisible(false);
    addSpriteHoverEffect(this, this.startBattleBtn, () => {
      this.battleBgm.stop();
      this.scene.start('monsterBattleScene', {
        monsterDatas: [this.battleCards1, this.battleCards2]
      });
    });

    // 戻るボタン
    this.returnBtn = this.add.sprite(672 + 500, 718, 'ReturnButton').setScale(0.4).setVisible(false);
    addSpriteHoverEffect(this, this.returnBtn, () => {
      this.selectSound.setVolume(GAME_SETTINGS.effectVolume);
      this.selectSound.play();
      this.battleBgm.stop();
      this.scene.start('openingScene');
    });

    // バトルデータ呼び出し
    monsterBattleRun(
      monstersData[battleState.monsterData1.dataIndex],
      monstersData[battleState.monsterData2.dataIndex]
    );

    if( GAME_SETTINGS.vrmFlg ){

	    // VRMレンダラー初期化
	    const vrm = await getVRMRenderer();
	    vrm.rotateModelTo(0.2, 0, 0);
	    vrm.setPose('normal');
	    vrm.moveModelTo(0, 0, 0);
	    vrm.scaleModelTo(1.2, 1.2, 1.2);
	    vrm.setVisible(true);

	    // VRMによる演出
	    if (!card1Shown && !card2Shown) {
	      fetchAndPlayAudio(this, "さあ、モンスターをよびだしましょう！");
	      vrm.startHeadAnimation();
	      vrm.setPose('pointRight', false);
	      await vrm.waitForTransitionEnd();
	      vrm.setPose('pointLeft', false);
	      await vrm.waitForTransitionEnd();
	      vrm.setPose('normal', false);
	      await waitForSpeakingToFinish(async () => {
	        await vrm.waitForTransitionEnd();
	        vrm.stopHeadAnimation();
	        vrm.setPose('normal');
	        this.returnBtn.setVisible(true);
	      });

	    } else if (!card1Shown || !card2Shown) {
	      if (card1Shown) {
	        vrm.setPose('pointRight', false);
	        await vrm.waitForTransitionEnd();
	      }
	      if (card2Shown) {
	        vrm.setPose('pointLeft', false);
	        await vrm.waitForTransitionEnd();
	      }
	      this.returnBtn.setVisible(true);

	    } else {
	      // 両カード表示済み
	      vrm.startHeadAnimation();
	      vrm.setPose('normal', false);
	      await vrm.waitForTransitionEnd();
	      vrm.setPose('pointLeft', false);
	      await vrm.waitForTransitionEnd();

	      fetchAndPlayAudio(this, this.battleCards1.Name);
	      await waitForSpeakingToFinish();

	      vrm.setPose('normal', false);
	      await vrm.waitForTransitionEnd();
	      fetchAndPlayAudio(this, "ぶいえす");
	      await waitForSpeakingToFinish();

	      vrm.setPose('pointRight', false);
	      await vrm.waitForTransitionEnd();
	      fetchAndPlayAudio(this, this.battleCards2.Name);
	      await waitForSpeakingToFinish();

	      vrm.setPose('normal', false);
	      await vrm.waitForTransitionEnd();
	      fetchAndPlayAudio(this, "の戦いを始めましょう！");
	      await waitForSpeakingToFinish();

	      vrm.stopHeadAnimation();
	      this.startBattleBtn.setVisible(true);
	      this.returnBtn.setVisible(true);

	    }
    }else{
	    if (card1Shown && card2Shown) {
        this.startBattleBtn.setVisible(true);
      }
      this.returnBtn.setVisible(true);
    }
  }
}
