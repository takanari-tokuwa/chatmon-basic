// js/features/monster/MonsterCardRenderer.js

/**
 * MonsterCardRenderer
 * -------------------
 * Phaser シーン上に「モンスターカード」を描画するためのクラスです。
 * ・元画像とフレームを合成して Canvas に描画
 * ・Canvas → DataUrl → Phaser.Texture → Sprite の流れでカードを表示
 * ・詳細ステータスやテキストも Canvas 上でレンダリング
 */

import { drawSingleLineText, 
         drawMultiLineText, 
         drawDataUrlToCanvas,
         convertCanvasToDataUrl,
         processImage,
         loadImage }               from '../../utils/image.js';
import { elementMap,
         getMonsterNameFromFile }  from '../../features/monster/MonsterCharacter.js';
import { monstersData }            from '../../globalState.js';
import { wait }                    from '../../utils/async.js';
import { readFile }                from '../../utils/io.js';
import { truncateString }          from '../../utils/data.js';

/**
 * ファイルリストからモンスターを読み込むユーティリティ関数
 * @param {FileList} fileList
 */
export async function handleMonFilesSelect(fileList) {
  if (!fileList || fileList.length === 0) {
    alert("ファイルが選択されていません。");
    return;
  }
  // 既存データをクリア
  monstersData.length = 0;

  for (let file of fileList) {
    // 画像ファイル → DataUrl → monstersData 配列に追加
    const dataUrl = await processImageFileToDataUrl(file);
    const name = getMonsterNameFromFile(file.name);
    monstersData.push({ ImageData: dataUrl, Name: name });
    console.log("[handleMonFilesSelect]", file.name, name);
  }
}

/**
 * File → Canvas 処理 → AI 用 Canvas → DataUrl 生成
 * @param {File} file
 * @returns {Promise<string|null>} DataUrl データ
 */
export async function processImageFileToDataUrl(file) {
  if (!file) {
    console.error("[processImageFileToDataUrl] ファイル未指定");
    return null;
  }
  try {
    // 1) File → dataURL
    const dataUrl = await readFile(file); // e.g. data:image/png;base64,AAA...

    // 2) HTMLImageElement を生成
    const img = await loadImage(dataUrl);

    // 3) monCanvas に合成描画
    const canvas = document.getElementById("monCanvas");
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const ratio = Math.min(W / img.width, H / img.height);
    const sw = img.width * ratio, sh = img.height * ratio;
    const ox = (W - sw) / 2, oy = (H - sh) / 2;

    ctx.clearRect(0, 0, W, H);
    // 背景画像モンスターカード背面
    const bg = new Image();
    bg.src = "assets/image/monback.png";
    await new Promise(res => bg.onload = res);
    ctx.drawImage(bg, 0, 0, W, H);
    ctx.drawImage(img, ox, oy, sw, sh);

    // 4) AI 用リサイズ Canvas (最大 500px)
    const maxSize = 500;
    const aspect = img.width / img.height;
    const tw = img.width > img.height ? maxSize : maxSize * (img.width / img.height);
    const th = img.height >= img.width ? maxSize : maxSize / (img.width / img.height);
    const aiCanvas = document.getElementById("aiCanvas");
    aiCanvas.width = tw;
    aiCanvas.height = th;
    aiCanvas.getContext("2d").drawImage(img, 0, 0, tw, th);

    // 5) DataUrl 化して返す
    return convertCanvasToDataUrl("aiCanvas");
  } catch (err) {
    console.error("[processImageFileToDataUrl] エラー", err);
    return null;
  }
}

/**
 * MonsterCardRenderer
 * @param {Phaser.Scene} scene          - 呼び出し元シーン
 * @param {Object}       monsterData    - モンスター情報（globalState.monstersData の 1 要素）
 */
export class MonsterCardRenderer {
  constructor(scene, monsterData) {
    this.scene       = scene;
    this.monsterData = monsterData;     // 必ず参照を書き換えずに保持
  }

  /* =========================================================================
   * public : drawCard
   * -------------------------------------------------------------------------
   * Phaser.Sprite を返すだけ。カードの実体がまだ無ければ makeCard() で生成する。
   * =========================================================================*/
  async drawCard(x, y, displayW, displayH, textureKey) {
    // ① 必須データが無ければ何も返さない（外側で CardBack などを使う想定）
    if (!this.monsterData?.ImageData)         return undefined;      // 画像未設定
    if (!this.monsterData.CardFrameNo)        return undefined;      // 能力未設定
    if (!this.monsterData.CardImageData) await this.makeCard();      // 初回だけ生成

    // ② CanvasTexture を Phaser に登録
    const cardCanvas = document.getElementById('cardCanvas');
    await drawDataUrlToCanvas(this.monsterData.CardImageData , "cardCanvas");

    // ③ スプライト化
    if (this.scene.textures.exists(textureKey)) {
        this.scene.textures.removeKey(textureKey); // 既存のテクスチャを削除
    }
    this.scene.textures.addCanvas(textureKey, cardCanvas);
    const sprite = this.scene.add
      .sprite(x, y, textureKey)
      .setDisplaySize(displayW, displayH);

    return sprite;
  }

  /* =========================================================================
   * public : drawMonsterStatus
   * -------------------------------------------------------------------------
   * モンスターの詳細ステータスを (Phaser.Text) 群で描画する。
   * OpeningScene / BattleScene など “召喚済カード” を拡大表示したい時に使う。
   * =========================================================================*/
  async drawMonsterStatus( ) {
  
    // 表示するオブジェクト全て
    let c_monsterImg = [];
    let c_monsterSprite = [];
    let c_monsterText = [];
  
    // バックグラウンド（羊皮紙）  
    c_monsterImg.push(this.scene.add.image( 672, 350, 'MessageImg'));

    // モンスターイメージ
    c_monsterSprite.push(this.drawCard(220+162, 125+225, 324,450 , "summonMonster"));

  const fontFamily1 = "'Noto Sans CJK JP','Hiragino Sans', 'ヒラギノ角ゴシック', 'YuGothic', 'Yu Gothic', 'メイリオ', Meiryo, 'Helvetica Neue', Arial, sans-serif";
  const wordWrap1 = { 
          width: 440,
          useAdvancedWrap: true
      };
  const wordWrap2 = { 
          width: 530,
          useAdvancedWrap: true
      };
  const normalFont = { 
      fontFamily: fontFamily1, 
      fontSize: '18px', 
      color: '#884422',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };
  const normalFont2 = { 
      fontFamily: fontFamily1, 
      fontSize: '18px', 
      /*color: '#2C1010',*/
      color: '#5C3030',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };
  const normalFont3 = { 
      fontFamily: fontFamily1, 
      fontSize: '16px', 
      color: '#5C3030',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };
  const normalFont_blue = { 
      fontFamily: fontFamily1, 
      fontSize: '18px', 
      color: '#7777AA',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };
  const normalFont_red = { 
      fontFamily: fontFamily1, 
      fontSize: '18px', 
      color: '#CC4444',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };
  const normalFont_yellow = { 
      fontFamily: fontFamily1, 
      fontSize: '18px', 
      color: '#668822',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };
  const normalFont_gray = { 
      fontFamily: fontFamily1, 
      fontSize: '18px', 
      color: '#AAAA88',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };
  const normalFont_black = { 
      fontFamily: fontFamily1, 
      fontSize: '18px', 
      color: '#886644',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };
  const appearFont = { 
      fontFamily: fontFamily1, 
      fontSize: '16px', 
      color: '#4C3040',
      fontWeight: 'bold',
      wordWrap: wordWrap2
  };
  const bigFont = { 
      fontFamily: fontFamily1, 
      fontSize: '24px', 
      /*color: '#884422',*/
      color: '#5C3030',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };
  const bigFont2 = { 
      fontFamily: fontFamily1, 
      fontSize: '24px', 
      color: '#5C1010',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };
  const smallFont = { 
      fontFamily: fontFamily1, 
      fontSize: '12px', 
      color: '#884422',
      fontWeight: 'bold',
      wordWrap: wordWrap1
  };

  
  // 名前
  const name12_txt = this.scene.add.text(575, 125+10, "名前：", bigFont );
    c_monsterText.push(name12_txt);
  //const name22_txt = this.scene.add.text(650, 125+10, this.monsterData.Name + "iiiwwああああああああああああああああああああああ", bigFont2 );
  const name22_txt = this.scene.add.text(650, 125+10, this.monsterData.Name, bigFont2 );
    c_monsterText.push(name22_txt);
/*
    // 属性記号と名称のマッピング
  const eleMap = {
      "F": "火", //（Fire）",
      "W": "水", //（Water）",
      "A": "風", //（Air）",
      "E": "土", //（Earth）",
      "T": "雷", //（Thunder）",
      "I": "氷", //（Ice）",
      "L": "光", //（Light）",
      "D": "闇", //（Darkness）"
  };
*/


  // 見た目の情報
  const height1_txt = this.scene.add.text(560+15, 200-18+10, "身長：", normalFont );
    c_monsterText.push(height1_txt);
  const height2_txt = this.scene.add.text(620+15, 200-18+10, truncateString(this.monsterData.HeightAndUnit,20), normalFont2 );
    c_monsterText.push(height2_txt);
    
  const weight1_txt = this.scene.add.text(560+15, 222-16+10, "体重：", normalFont );
    c_monsterText.push(weight1_txt);
  const weight2_txt = this.scene.add.text(620+15, 222-16+10, truncateString(this.monsterData.WeightAndUnit,20), normalFont2 );
    c_monsterText.push(weight2_txt);

  const species1_txt = this.scene.add.text(800+15, 200-18+10, "種類：", normalFont );
    c_monsterText.push(species1_txt);
  const species2_txt = this.scene.add.text(860+15, 200-18+10, truncateString(this.monsterData.Species,26), normalFont2 );
    c_monsterText.push(species2_txt);
    
  const element1_txt = this.scene.add.text(800+15, 222-16+10, "属性：", normalFont );
    c_monsterText.push(element1_txt);
    const eleString = this.monsterData.Elements.map(mark => elementMap[mark]).join("、");
  const element2_txt = this.scene.add.text(860+15, 222-16+10, truncateString(eleString,26), normalFont2 );
    c_monsterText.push(element2_txt);



  const statusColor = (status) => {
    let w_font = normalFont_gray;
    if(status>=100) { w_font = normalFont_blue };
    if(status>=300) { w_font = normalFont_black };
    if(status>=700) { w_font = normalFont_yellow };
    if(status>=900) { w_font = normalFont_red };
    return w_font;
  }
  const convertToFullWidthDigits = (num, digits) => {
      const fullWidthDigits = '０１２３４５６７８９';
      const fullWidthSpace = '　'; // 全角スペース

      // 数値を文字列に変換し、全角数字に置換
      let str = String(num).replace(/[0-9]/g, function(char) {
          return fullWidthDigits.charAt(parseInt(char));
      });

      // 文字列の長さが指定された桁数よりも短い場合、前に全角スペースで埋める
      if (str.length < digits) {
          str = fullWidthSpace.repeat(digits - str.length) + str;
      }

      return str;
  }

  
  // ステータス
  const intelligence1_txt = this.scene.add.text(560+15, 248-5+10, "知性：", normalFont );
    c_monsterText.push(intelligence1_txt);
  const intelligence2_txt = this.scene.add.text(600+15, 248-5+10, convertToFullWidthDigits(this.monsterData.Intelligence,4), statusColor(this.monsterData.Intelligence) );
    c_monsterText.push(intelligence2_txt);

  const charm1_txt = this.scene.add.text(560+15, 270-5+10, "魅力：", normalFont );
    c_monsterText.push(charm1_txt);
  const charm2_txt = this.scene.add.text(600+15, 270-5+10, convertToFullWidthDigits(this.monsterData.Charm,4), statusColor(this.monsterData.Charm) );
    c_monsterText.push(charm2_txt);

  const vitality1_txt = this.scene.add.text(560+15, 292-5+10, "体力：", normalFont );
    c_monsterText.push(vitality1_txt);
  const vitality2_txt = this.scene.add.text(600+15, 292-5+10, convertToFullWidthDigits(this.monsterData.Vitality,4), statusColor(this.monsterData.Vitality) );
    c_monsterText.push(vitality2_txt);

  const attack1_txt = this.scene.add.text(560+15+170, 248-5+10, "攻撃：", normalFont );
    c_monsterText.push(attack1_txt);
  const attack2_txt = this.scene.add.text(600+15+170, 248-5+10, convertToFullWidthDigits(this.monsterData.Attack,4), statusColor(this.monsterData.Attack) );
    c_monsterText.push(attack2_txt);

  const defense1_txt = this.scene.add.text(560+15+170, 270-5+10, "防御：", normalFont );
    c_monsterText.push(defense1_txt);
  const defense2_txt = this.scene.add.text(600+15+170, 270-5+10, convertToFullWidthDigits(this.monsterData.Defense,4), statusColor(this.monsterData.Defense) );
    c_monsterText.push(defense2_txt);

  const agility1_txt = this.scene.add.text(560+15+170, 292-5+10, "速さ：", normalFont );
    c_monsterText.push(agility1_txt);
  const agility2_txt = this.scene.add.text(600+15+170, 292-5+10, convertToFullWidthDigits(this.monsterData.Agility,4), statusColor(this.monsterData.Agility) );
    c_monsterText.push(agility2_txt);

  const magicAttack1_txt = this.scene.add.text(560+15+340, 248-5+10, "魔法攻撃：", normalFont );
    c_monsterText.push(magicAttack1_txt);
  const magicAttack2_txt = this.scene.add.text(635+15+340, 248-5+10, convertToFullWidthDigits(this.monsterData.MagicAttack,4), statusColor(this.monsterData.MagicAttack) );
    c_monsterText.push(magicAttack2_txt);

  const magicDefense1_txt = this.scene.add.text(560+15+340, 270-5+10, "魔法防御：", normalFont );
    c_monsterText.push(magicDefense1_txt);
  const magicDefense2_txt = this.scene.add.text(635+15+340, 270-5+10, convertToFullWidthDigits(this.monsterData.MagicDefense,4), statusColor(this.monsterData.MagicDefense) );
    c_monsterText.push(magicDefense2_txt);

  const skills_txt = this.scene.add.text(560+15, 330+10, "【スキル】", smallFont );
    c_monsterText.push(skills_txt);
    if(this.monsterData.Skills.length >=1){
    const skill1_txt = this.scene.add.text(560+25, 330+20+10, this.monsterData.Skills[0], normalFont3);
      c_monsterText.push(skill1_txt);
    }
    if(this.monsterData.Skills.length >=2){
    const skill2_txt = this.scene.add.text(560+25, 330+40+10, this.monsterData.Skills[1], normalFont3);
      c_monsterText.push(skill2_txt);
    }
    if(this.monsterData.Skills.length >=3){
    const skill3_txt = this.scene.add.text(560+25, 330+60+10, this.monsterData.Skills[2], normalFont3);
      c_monsterText.push(skill3_txt);
    }

    const magicSpells_txt = this.scene.add.text(800+15, 330+10, "【魔法】", smallFont );
    c_monsterText.push(magicSpells_txt);
    if(this.monsterData.MagicSpells.length >=1){
    const magicSpell1_txt = this.scene.add.text(800+25, 330+20+10, this.monsterData.MagicSpells[0], normalFont3);
      c_monsterText.push(magicSpell1_txt);
    }
    if(this.monsterData.MagicSpells.length >=2){
    const magicSpell2_txt = this.scene.add.text(800+25, 330+40+10, this.monsterData.MagicSpells[1], normalFont3);
      c_monsterText.push(magicSpell2_txt);
    }
    if(this.monsterData.MagicSpells.length >=3){
    const magicSpell3_txt = this.scene.add.text(800+25, 330+60+10, this.monsterData.MagicSpells[2], normalFont3);
      c_monsterText.push(magicSpell3_txt);
    }

    const flavorText2_txt = this.scene.add.text(560+20, 440, this.monsterData.flavorText, appearFont );
      c_monsterText.push(flavorText2_txt);

  }
  
  /* =========================================================================
   * private : makeCard
   * -------------------------------------------------------------------------
   * ＜1＞ 既存キャンバス（#cardCanvas）を真っさらにして背景／枠／メイン画像を合成
   * ＜2＞ カードのタイトル・星・属性ピクトグラム・ステータスバーを手書き
   * ＜3＞ 完成画像を monsterData.CardImageData に保存（DataUrl）
   * =========================================================================*/
  async makeCard() {
    await drawDataUrlToCanvas(this.monsterData.ImageData , "monCanvas");
    const baseDir = "./assets/image/"
    const basePartsDir = "cardParts/"
    const monCanvas = document.getElementById('monCanvas');
    const cardCanvas = document.getElementById('cardCanvas');
    const cardContext = cardCanvas.getContext('2d');

    // ---------- 1. 背景 / モンスター画像合成 -------------------------------

    // 背景（カードフレーム） / モンスター画像
    const monCanvasImg = await processImage(monCanvas);
    const frameImg     = await processImage(baseDir + "frame" + this.monsterData.CardFrameNo + ".png");

    cardContext.clearRect(0, 0, cardCanvas.width, cardCanvas.height);
    cardContext.fillStyle = "rgba(0, 0, 0, 0)"; 
    cardContext.fillRect(0, 0, cardCanvas.width, cardCanvas.height);
    cardContext.drawImage(monCanvasImg, 76, 78, 566, 566);
    cardContext.drawImage(frameImg    ,  0,  0, 720, 1000);

    // ---------- 2. テキスト & アイコン類 -----------------------------------
    // 星
    drawSingleLineText(cardContext, '★'.repeat(this.monsterData.Stars), 360, 56, 26, 1, 400, '#CC8800', 'center');
    
    // 名前
    drawSingleLineText(cardContext, this.monsterData.Name, 80, 700, 36, 1, 450, '#000022', 'left','bold');

    // 属性アイコン --- F:火（Fire）,W:水（Water）,A:風（Air）,E:土（Earth）,T:雷（Thunder）,I:氷（Ice）,L:光（Light）,D:闇（Darkness）
    const eleMark = ["F","W","A","E","T","I","L","D"];
    const eleImg = {};
    for( let cnt=0 ; cnt < eleMark.length ; cnt++ ){
        eleImg[eleMark[cnt]] = await processImage(baseDir + basePartsDir + "ele" + eleMark[cnt] + ".png");
    };
    const startEleImg = 520 + (3-this.monsterData.Elements.length)*42;
    this.monsterData.Elements.forEach((element, index) => {
        cardContext.drawImage(eleImg[this.monsterData.Elements[index]], startEleImg + index*42, 665 , 40, 40);
    });    

    // フレーバーテキスト
    let flavorTextColor = '#FFFFFF';
    let flavorTextWeight = 'normal';
    if( this.monsterData.CardFrameNo == 3 ){
    	flavorTextColor ='#040200';
      flavorTextWeight = 'bold';
    }
    
    if( this.monsterData.flavorText.length < 120 ){
        drawMultiLineText(cardContext, this.monsterData.flavorText ,50, 745, 620 , 100 ,  20, 1, flavorTextColor,flavorTextWeight)
    }else if(this.monsterData.flavorText.length < 150){
        drawMultiLineText(cardContext, this.monsterData.flavorText ,50, 745, 620 , 100 ,  20, 0.8, flavorTextColor,flavorTextWeight)
    }else if(this.monsterData.flavorText.length < 180){
        drawMultiLineText(cardContext, this.monsterData.flavorText ,60, 735, 600 , 120 ,  20, 0.8, flavorTextColor,flavorTextWeight)
    }else if(this.monsterData.flavorText.length < 250){
        drawMultiLineText(cardContext, this.monsterData.flavorText ,60, 735, 600 , 120 ,  20, 0.6, flavorTextColor,flavorTextWeight)
    }else{
        drawMultiLineText(cardContext, this.monsterData.flavorText ,45, 738, 630 , 120 ,  18, 0.5, flavorTextColor,'normal')
    }

    // ---- 各ステータス（INT/ATK/DEF ...） ------
    const iconINT = await processImage(baseDir + basePartsDir + "INT.png");
    const iconCHR = await processImage(baseDir + basePartsDir + "CHR.png");
    const iconVIT = await processImage(baseDir + basePartsDir + "VIT.png");
    const iconAGI = await processImage(baseDir + basePartsDir + "AGI.png");
    const iconATK = await processImage(baseDir + basePartsDir + "ATK.png");
    const iconDEF = await processImage(baseDir + basePartsDir + "DEF.png");
    const iconMAT = await processImage(baseDir + basePartsDir + "MAT.png");
    const iconMDF = await processImage(baseDir + basePartsDir + "MDF.png");

    const adjustValue = (w_status) => {
        const x = w_status / 999;
        const y = 7.575 * Math.pow(x, 3) - 11.635 * Math.pow(x, 2) + 9.475 * x;
        return Math.round(y);
    };
                
    const drawStatus = (w_col,w_row,w_title,w_status,w_icon) => {
        const x = w_col * 162 + 65;
        const y = w_row * 26 + 864;
        drawSingleLineText(cardContext, w_title, x, y, 20, 1, 40, '#EEEEFF', 'center','bold');
        const stCnt = adjustValue(w_status);
        for( let cnt=0 ; cnt < stCnt ; cnt++ ){
            cardContext.drawImage(w_icon, x + 34 + cnt*19, y -16 , 18, 18);
        }
    }
    drawStatus(0,0,"知性",this.monsterData.Intelligence,iconINT);
    drawStatus(1,0,"魅力",this.monsterData.Charm,iconCHR);
    drawStatus(2,0,"体力",this.monsterData.Vitality,iconVIT);
    drawStatus(3,0,"速さ",this.monsterData.Agility,iconAGI);
    drawStatus(0,1,"攻撃",this.monsterData.Attack,iconATK);
    drawStatus(1,1,"防御",this.monsterData.Defense,iconDEF);
    drawStatus(2,1,"魔攻",this.monsterData.MagicAttack,iconMAT);
    drawStatus(3,1,"魔防",this.monsterData.MagicDefense,iconMDF);
    
    
    drawSingleLineText(cardContext, "SKILL", 72, 917, 20, 0.8, 70, '#CC8822', 'center','bold');
    this.monsterData.Skills.forEach((skill, index) => {
        drawSingleLineText(cardContext, this.monsterData.Skills[index], 115+index*190, 917, 20, 0.7, 180, '#220000', 'left','bold');
    });

    drawSingleLineText(cardContext, "MAGIC", 72, 943, 20, 0.7, 70, '#CC8822', 'center','bold');
    this.monsterData.MagicSpells.forEach((Spell, index) => {
        drawSingleLineText(cardContext, this.monsterData.MagicSpells[index], 115+index*190, 943, 20, 0.7, 180, '#220000', 'left','bold');
    });
    
    // ---------- 3. 完成したカードを DataUrl 化し、モデルへ保存 -------------
    this.monsterData.CardImageData = convertCanvasToDataUrl('cardCanvas');
  }
}
