// scenes/SummonScene.js

import { GAME_SETTINGS }                 from '../config.js';
import { monstersData,
         callMonsterState,
         battleState }                    from '../globalState.js';
import { addSpriteHoverEffect,
         setTexture }                    from '../utils/phaserUtil.js';
import { setAttributes }                 from '../utils/data.js';
import { loadAssets,
         readTextFile,
         readFile }                      from '../utils/io.js';
import { wait,
         waitUntil }                     from '../utils/async.js';
import { loadImage,
         drawDataUrlToCanvas,
         convertCanvasToDataUrl,
         loadImageElement,
         processImage }                  from '../utils/image.js';
import { MonsterCardRenderer }           from '../features/monster/MonsterCardRenderer.js';
import { starsRating,
         getFrameNo,
         monsterVoice }                  from '../features/monster/MonsterCharacter.js';
import { fetchAndPlayAudio,
         waitForSpeakingToFinish }       from '../services/speakingService.js';
import { monsterBattleRun,
         callChatMon }                   from '../services/chatService.js';
import { getVRMRenderer }                from '../features/avatar/VRMRenderer.js';

export default class SummonScene extends Phaser.Scene {
  constructor() {
    super({ key: "summonScene" });
  }

  init(data) {
    this.monsterData = data.monsterData;
    this.promptNo = data.promptNo;
  }

  preload() {
    const manifest = {
      images: [
        { key: "SummonImg",       url: "assets/image/Summon.png" },
        { key: "CardMonBackImg",  url: "assets/image/monback.png" },
        { key: "CallMonButton",   url: "assets/image/CallMonButton.png" },
        { key: "DownloadButton",  url: "assets/image/DownloadButton.png" },
        { key: "ReturnButton",    url: "assets/image/ReturnButton.png" },
        { key: "CardBackImg",     url: "assets/image/CardBack.png" },
        { key: "CardFrontImg",    url: "assets/image/CardFront.png" },
        { key: "MessageImg",      url: "assets/image/Message.png" }
      ],
      audios: [
        { key: "SummonBgm", url: "assets/bgm/ChatMonSummon.mp3" },
        { key: "CallBgm",   url: "assets/bgm/ChatMonCall.mp3" },
        { key: "SelectSound", url: "assets/sound/Select.mp3" }
      ]
    };
    loadAssets(this.load, manifest);
  }

  async create() {
  
    // BGM の再生
    this.summonBgm = this.sound.add("SummonBgm", { loop: true });
    this.summonBgm.setVolume(GAME_SETTINGS.bgmVolume);
    this.summonBgm.play();

    this.selectSound = this.sound.add("SelectSound");

    // 背景画像の表示
    this.add.image(0, 0, "SummonImg").setOrigin(0);
    this.cameras.main.fadeIn(1000);

    // カードアニメーション用スプライトを生成（初期は非表示）
    this.openCardSprite  = this.add.sprite(672, 320, "CardBackImg").setVisible(false);
    this.closeCardSprite = this.add.sprite(672, 320, "CardFrontImg").setVisible(false);
    this.callCardSprite  = this.add.sprite(672, 320, "CardFrontImg").setVisible(false);
    this.animateCard    = this.getCardAnimation();

    // カード描画用レンダラー
    const cardRenderer = new MonsterCardRenderer(this, this.monsterData);
    let cardReady = false;

    if (!this.monsterData.ImageData) {
      // 画像未アップロード状態
    } else if (!this.monsterData.CardFrameNo) {
      // カード未生成状態
    } else if (!this.monsterData.CardImageData) {
      // カード画像生成必要
      await this.makeCard();
    } else {
      // すでに生成済み
      cardReady = true;
      await cardRenderer.drawMonsterStatus();
    }

    // 戻るボタン
    this.returnButton = this.add.sprite(1000, 700, "ReturnButton")
      .setInteractive()
      .setVisible(false);
    addSpriteHoverEffect(this, this.returnButton, () => {
      this.summonBgm.stop();
      this.scene.start("battleScene");
    });
    
    // ダウンロードボタン
    this.downloadButton = this.add.sprite(344, 700,  "DownloadButton")
      .setInteractive()
      .setVisible(false);
    addSpriteHoverEffect(this, this.downloadButton, async () => {
      await this.downloadCard();
    });

    // 召喚ボタン
    this.summonButton = this.add.sprite(344, 700, "CallMonButton")
      .setInteractive()
      .setVisible(false);
    addSpriteHoverEffect(this, this.summonButton, async () => {
    
      if (callMonsterState.isRunCallMonster || battleState.isRunBattleData) {
        alert("処理中です。お待ちください。");
        return;
      }
      
      this.summonButton.setVisible(false);
      this.returnButton.setVisible(false);
      
      // 入力を無効にする
      this.input.enabled = false;
      this.selectSound.setVolume(GAME_SETTINGS.effectVolume);
      this.selectSound.play();

      if(GAME_SETTINGS.vrmFlg){
        // Three.js + VRM のレンダラーを作成
        const vrm = await getVRMRenderer();
        vrm.setPose("normal");
        vrm.rotateModelTo(0, Math.PI * 6, 0);
        vrm.moveModelTo(0, 3, 0);
      }

      // 画像自体がない場合
      if (!this.monsterData.ImageData) {
        alert("画像データが正しく渡されていません。処理を見直してください。");
      } else {
        // 能力生成が出来ていない場合
        callMonsterState.isRunCallMonster_pre = true;
        callMonsterState.isRunCallMonster_end = false;
        
        // カードをアニメーションする
        this.animateCard();
        await this.callChatMonData(this.monsterData.ImageData);
        
        // カードが確定しており、バトルが始まっていない場合はバトルの読込（判定はmonsterBattleRun内）
        monsterBattleRun(
          monstersData[battleState.monsterData1.dataIndex],
          monstersData[battleState.monsterData2.dataIndex]
        );
      }
    });

    if(GAME_SETTINGS.vrmFlg){
      // VRM 初期配置
      const vrm = await getVRMRenderer();
      vrm.setPose("normal");
      if (cardReady) {
        vrm.setPose("normal");
        vrm.rotateModelTo(0, Math.PI * 6, 0);
        vrm.moveModelTo(0, 3, 0);
        this.returnButton.setVisible(true);
        this.downloadButton.setVisible(true);
      } else {
        vrm.moveModelTo(0, 0.5, 0);
        vrm.scaleModelTo(0.8, 0.8, 0.8);
        await vrm.waitForTransitionEnd();
        this.returnButton.setVisible(true);
        this.summonButton.setVisible(true);
      }
    }else{
      this.returnButton.setVisible(true);
      if (!cardReady) {
        this.summonButton.setVisible(true);
      }else{
        this.downloadButton.setVisible(true);
      }
    }
  }

  async makeCard() {
    // 画像取り込み〜Canvas描画
    await drawDataUrlToCanvas(this.monsterData.ImageData, "monCanvas");
  }

  async callChatMonData(dataUrlData) {
    let attempt = 0;
    const maxRetries = 3;
    while (attempt < maxRetries) {
      try {
        await this.callChatMonDataSub(dataUrlData);
        return; // 成功したらループを抜ける
      } catch (e) {
        console.error(e);
        if (attempt < maxRetries - 1) {
          if (!confirm("カード作成に失敗しました。再試行しますか？")) break;
        } else {
          alert("カード作成処理が3回失敗となりました。しばらくしてから再度お試しください。");
        }
      }
      attempt++;
    }
  }

  async callChatMonDataSub(dataUrlData) {
    // Canvas に背景描画
    const img = await loadImage(dataUrlData);
    const back = this.textures.get("CardMonBackImg").source[0].image;
    const ctx  = document.getElementById("monCanvas").getContext("2d");
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    
    // 画像の縦横比を保持したまま、canvas内に収めるためのサイズ計算などの処理
    const ratio = Math.min(cw/img.width, ch/img.height);
    const w = img.width*ratio, h = img.height*ratio;
    const x = (cw - w)/2, y = (ch - h)/2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(back, 0, 0, cw, ch);
    ctx.drawImage(img, x, y, w, h);

	  // 指定する最大サイズ（縦横の大きい方をこのサイズに）
    const maxSize = 500;
    
	  // 元画像の幅と高さ
    const ar = img.width/img.height;
    let tw, th;
    if (img.width > img.height) {
      tw = maxSize; th = maxSize/ar;
    } else {
      th = maxSize; tw = maxSize*ar;
    }
    
	  // キャンバス要素の取得
    const aiCanvas = document.getElementById("aiCanvas");
    aiCanvas.width = tw; aiCanvas.height = th;
    aiCanvas.getContext("2d").drawImage(img, 0, 0, tw, th);
    const aiDataUrl = convertCanvasToDataUrl("aiCanvas");

    // プロンプト読み込み
    const userTxt   = await readTextFile(`assets/prompt/callMon/${this.promptNo}_user.txt`);
    const systemTxt = await readTextFile(`assets/prompt/callMon/${this.promptNo}_system.txt`);
    
    // モンスター名を退避
    let monsterName = undefined;
    if(this.monsterData.Name != undefined){
      monsterName = this.monsterData.Name;
    }

    //デバッグモード
    let response;
    if (GAME_SETTINGS.debugMode_Summon) {
      response = await readTextFile("assets/debug/cardCanvas.txt");
    } else {
      response = await callChatMon(aiDataUrl, systemTxt, userTxt);
    }

    // モンスターデータ更新（フレーバーテキスト内のモンスター名を正しいものに変更）
    setAttributes(this.monsterData, JSON.parse(response));
    if (monsterName) {
      this.monsterData.flavorText = this.monsterData.flavorText.replaceAll(
        this.monsterData.Name,
        monsterName
      );
      this.monsterData.Name = monsterName;
    }
    this.monsterData.Stars       = starsRating(this.monsterData);
    this.monsterData.CardFrameNo = getFrameNo(this.monsterData);
    this.monsterData.ImageData   = convertCanvasToDataUrl("monCanvas");

    // カード生成 & テクスチャ設定
    const renderer = new MonsterCardRenderer(this, this.monsterData);
    await renderer.makeCard();
    await setTexture(this, this.callCardSprite, "callCardSprite", this.monsterData.CardImageData);

    callMonsterState.isRunCallMonster_pre = false;
    fetchAndPlayAudio(this, monsterVoice(this.monsterData));
    await waitUntil(() => callMonsterState.isRunCallMonster_end);
    await waitForSpeakingToFinish();
    await wait(1000);

    await renderer.drawMonsterStatus();
    await wait(2000);
    fetchAndPlayAudio(this, `${this.monsterData.Name}。${this.monsterData.flavorText}`);
    await waitForSpeakingToFinish();
    this.returnButton.setVisible(true).setDepth(999);
    this.downloadButton.setVisible(true).setDepth(999);

    this.input.enabled = true;
  }

  /**
   * getCardAnimation:
   * カードのアニメーション設定
   */
  getCardAnimation() {
  
    // 表示時に座標とスケールを設定して表示する関数
    const showSprite = (cardSprite , x, y, scaleX, scaleY) => {
        cardSprite.setVisible(true); // スプライトを表示する
        cardSprite.setPosition(x, y); // 座標を設定する
        cardSprite.setScale(scaleX,scaleY); // スケールを設定する
    }
    
    const cardAnimation1 = {
        targets: this.openCardSprite,
        y : 320,
        scale: 0.8,
        angle: 360,
        duration: 2000, // アニメーションの期間（ミリ秒）
        onComplete: function(tween, targets) {
            animateCardPattern2();
        }
    };

    const cardAnimation2 = {
        targets: this.openCardSprite,
        scaleX: 0.01, // 横幅を変更する
        duration: 2000, // アニメーションの期間（ミリ秒）
        //yoyo: false // アニメーションを反転させる
        angle: 360,
        onComplete: function(tween, targets) {
            if( !callMonsterState.isRunCallMonster_pre ) {
                animateCardPattern6();
            }else{
                animateCardPattern3();
            }
        }
    };

    const cardAnimation3 = {
        targets: this.closeCardSprite,
        scaleX: 0.8, // 横幅を変更する
        duration: 2000, // アニメーションの期間（ミリ秒）
        //repeat: 0, // 繰り返す
        //yoyo: true, // アニメーションを反転させる
        angle: 360,
        onComplete: function(tween, targets) {
            animateCardPattern4();
        }
    };

    const cardAnimation4 = {
        targets: this.closeCardSprite,
        scaleX: 0.01, // 横幅を変更する
        duration: 2000, // アニメーションの期間（ミリ秒）
        //repeat: 0, // 繰り返す
        //yoyo: true, // アニメーションを反転させる
        angle: 360,
        onComplete: function(tween, targets) {
            animateCardPattern5();
        }
    };

    const cardAnimation5 = {
        targets: this.openCardSprite,
        scaleX: 0.8, // 横幅を変更する
        duration: 2000, // アニメーションの期間（ミリ秒）
        //yoyo: false // アニメーションを反転させる
        angle: 360,
        onComplete: function(tween, targets) {
            animateCardPattern2();
        }
    };

    const cardAnimation6 = {
        targets: this.callCardSprite,
        scaleX: 0.8, // 横幅を変更する
        duration: 2000, // アニメーションの期間（ミリ秒）
        repeat: 0, // 繰り返す
        //yoyo: true, // アニメーションを反転させる
        angle: 360,
        onComplete: function(tween, targets) {
            callMonsterState.isRunCallMonster_end= true;
        }
    };

    // アニメーションの設定
    const animateCardPattern1 = () => {
        showSprite(this.openCardSprite , 670, 370, 0.01, 0.01);
        this.tweens.add(cardAnimation1);        
    }
    const animateCardPattern2 = () => {
        this.closeCardSprite.setVisible(false);
        showSprite(this.openCardSprite , 670, 320, 0.8 , 0.8);
        this.tweens.add(cardAnimation2);        
    }
    const animateCardPattern3 = () => {
        this.openCardSprite.setVisible(false);
        showSprite(this.closeCardSprite , 670, 320, 0.01 , 0.8);
        this.tweens.add(cardAnimation3);        
    }
    const animateCardPattern4 = () => {
        this.tweens.add(cardAnimation4);        
    }
    const animateCardPattern5 = () => {
        this.closeCardSprite.setVisible(false);
        showSprite(this.openCardSprite , 670, 320, 0.01 , 0.8);
        this.tweens.add(cardAnimation5);        
    }
    const animateCardPattern6 = () => {
        this.openCardSprite.setVisible(false);
        this.closeCardSprite.setVisible(false);
        showSprite(this.callCardSprite , 670, 320, 0.01 , 0.8);
        this.tweens.add(cardAnimation6);        
    }
    return animateCardPattern1;
  }
  
   /**
   * downloadCard:
   * カードのダウンロード
   */
  async downloadCard() {
  
    const monsterUrl = "https://cdle.jp/blogs/edd0e3a00cf9";
    const downloadFileName = "ChatMonCard.png"

    const cardImg = await await loadImageElement(this.monsterData.CardImageData);
    const cardBackImg = await processImage("assets/image/printCardBack.png");
    const qrCordImg = await processImage("assets/image/qrCord.png");

    // Canvasとコンテキストの取得
    const printCanvas = document.getElementById('printCanvas');
    const printContext = printCanvas.getContext('2d');

    printContext.clearRect(0, 0, printCanvas.width, printCanvas.height);
    printContext.fillStyle = 'black';
    printContext.fillRect(0, 0, printCanvas.width, printCanvas.height);
    
    // カードの描画
    //printContext.drawImage(cardImg, 30, 25, 720, 1000);
    printContext.drawImage(cardImg, 25, 35, 700, 972);
    //printContext.drawImage(cardBackImg, 780, 25, 720, 1000);
    printContext.drawImage(cardBackImg, 780, 35, 700, 972);
    printContext.drawImage(qrCordImg, 930, 570, 426, 426);
  	
    // QRコード
    // qr-code-stylingインスタンスの作成
    const qrCode = new QRCodeStyling({
        width: 200,   // QRコードの幅
        height: 200,  // QRコードの高さ
        data: monsterUrl,  // 表示したいデータ
        dotsOptions: {
            color: "#000000", // ドットの色
            type: "rounded"   // ドットのタイプ
        }
    });
    await generateAndDrawQRCode(printContext,1040, 685 , qrCode);
    const link = document.createElement('a');
    
    // ダウンロード
    link.href = printCanvas.toDataURL('image/png'); // PNG形式で画像を取得
    link.download = downloadFileName; // ダウンロード時のファイル名
    // スマホやPCでも動作するようにクリックイベントをトリガー
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  }
}
// QRコードをCanvas上に描画する関数
async function generateAndDrawQRCode(ctx, x, y, qrCode) {
    const blob = await qrCode.getRawData('png');
    const imgQR = new Image();

    // QRコード画像がロードされたらCanvasに描画
    return new Promise((resolve) => {
        imgQR.onload = () => {
            ctx.drawImage(imgQR, x, y);
            console.log("QRコード描画完了");
            resolve(); // 描画完了を通知
        };
        imgQR.src = URL.createObjectURL(blob);
    });
}
