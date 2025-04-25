// globalState.js

/**
 * すべてのモンスターデータを格納
 * @type {Array<object>}
 */
export const monstersData = [];

/**
 * トーナメントの組み合わせ・結果を格納
 * @type {Array<object>}
 */
export const tournamentData = [];

/**
 * 召喚処理ステート管理
 */
export const callMonsterState = {
  isRunCallMonster:     false,
  isRunCallMonster_pre: false,
  isRunCallMonster_end: false
};

/**
 * バトル処理ステート管理
 */
export const battleState = {
  // GPT からの結果格納
  resulBattle:        undefined,
  // バトルデータ取得中フラグ
  isRunBattleData:    false,
  isBattleDataRequest:false,
  monsterBattleErrorCnt: 0,
  // 選択されたフィールド番号
  battleFieldNo:      "01",
  // 左のモンスター (index は tournamentData/monstersData の参照)
  monsterData1: { tournamentIndex: -1, dataIndex: -1 },
  // 右のモンスター
  monsterData2: { tournamentIndex: -1, dataIndex: -1 }
};

/**
 * IndexedDB や localStorage 用にシリアライズするデータ
 */
export const strageData = {
  monstersData:   [],
  tournamentData: []
};
