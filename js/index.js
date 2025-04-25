// index.js

import { CONFIG } from './config.js';

import SettingScene        from './scenes/SettingScene.js';
import OpeningScene        from './scenes/OpeningScene.js';
import TournamentScene     from './scenes/TournamentScene.js';
import SummonScene         from './scenes/SummonScene.js';
import BattleScene         from './scenes/BattleScene.js';
import MonsterBattleScene  from './scenes/MonsterBattleScene.js';

// Phaserゲームの初期化
const gameConfig = {
  ...CONFIG.PHASER,
  parent: 'game-container'  // Phaser描画先のDIV
};

const game = new Phaser.Game(gameConfig);

// シーン登録
game.scene.add('settingScene', SettingScene);
game.scene.add('openingScene', OpeningScene);
game.scene.add('tournamentScene', TournamentScene);
game.scene.add('summonScene', SummonScene);
game.scene.add('battleScene', BattleScene);
game.scene.add('monsterBattleScene', MonsterBattleScene);

// 最初のシーンを起動
game.scene.start('settingScene');
