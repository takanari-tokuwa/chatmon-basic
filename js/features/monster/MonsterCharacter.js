// features/monster/MonsterCharacter.js

import { dummyName1, dummyName2 } from '../../config.js';

/**
 * 属性コード → 日本語名称マッピング
 */
export const elementMap = {
  F: "火",   // Fire
  W: "水",   // Water
  A: "風",   // Air
  E: "土",   // Earth
  T: "雷",   // Thunder
  I: "氷",   // Ice
  L: "光",   // Light
  D: "闇"    // Darkness
};

/**
 * モンスター情報を ChatGPT へ渡す JSON 形式テキストに変換
 * @param {string} name - モンスターの名前（ダミー名）
 * @param {object} monster - モンスターデータオブジェクト
 * @returns {string} JSON 文字列
 */
export function convertMonsterToJsonText(name, monster) {
  const eleString = monster.Elements.map(code => elementMap[code]).join(",");
  return `{
  "名前": "${name}",
  "身長": "${monster.HeightAndUnit}",
  "体重": "${monster.WeightAndUnit}",
  "種類": "${monster.Species}",
  "属性": "[${eleString}]",
  "知性": ${monster.Intelligence},
  "魅力": ${monster.Charm},
  "体力": ${monster.Vitality},
  "速さ": ${monster.Agility},
  "攻撃": ${monster.Attack},
  "防御": ${monster.Defense},
  "魔法攻撃": ${monster.MagicAttack},
  "魔法防御": ${monster.MagicDefense},
  "スキル": "${monster.Skills.join("、")}",
  "魔法": "${monster.MagicSpells.join("、")}",
  "説明": "${monster.flavorText}"
}`;
}

/**
 * テキスト内の不要改行・空白・英単語を置換
 * @param {string} comment
 * @returns {string}
 */
export function sanitizeComment(comment) {
  if (!comment) return "";
  return comment
    .replace(/\n/g, "")
    .replace(/ /g, "　")
    .replace(/Condition/g, "コンディション")
    .replace(/モンスター1/g, dummyName1)
    .replace(/モンスター１/g, dummyName1)
    .replace(/モンスター2/g, dummyName2)
    .replace(/モンスター２/g, dummyName2);
}


/**
 * コメント文字列を正規化しつつモンスター名を置換
 * @param {string} comment
 * @param {Object} monsterNames
 * @param {boolean} useBrackets
 * @returns {string}
 */
export function convertMonsterName(comment, monsterNames, useBrackets = false) {
  const prefix = useBrackets ? "「" : "";
  const suffix = useBrackets ? "」" : "";
  let result = sanitizeComment(comment);
  for (const [orig, rep] of Object.entries(monsterNames)) {
    result = result.replaceAll(orig, `${prefix}${rep}${suffix}`);
  }
  return result;
}

/**
 * ファイル名からモンスター名を抽出
 * @param {string} fileName
 * @returns {string}
 */
export function getMonsterNameFromFile(fileName) {
  let name = fileName.replace(/\.[^/.]+$/, ""); // 拡張子除去
  if (name.includes('_')){
    name = name.split('_').pop();
  }else{
    name = "";
  }
  return name.length > 40 ? name.slice(0, 40) : name;
}

/**
 * 属性値の平均 A を計算
 * @param {object} m
 * @returns {number}
 */
function calculateA(m) {
  const vals = [
    m.Intelligence,
    m.Charm,
    m.Attack,
    m.Defense,
    m.MagicAttack,
    m.MagicDefense,
    m.Agility
  ];
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

/**
 * A と (OverallScore + SpecialAbilityScore)/2 の平均 B を計算
 * @param {object} m
 * @returns {number}
 */
function calculateB(m) {
  const A = calculateA(m);
  const specAvg = (m.OverallScore + m.SpecialAbilityScore) / 2;
  return (A + specAvg) / 2;
}

/**
 * 星評価を 1～10 の整数で返す
 * @param {object} monster
 * @returns {number}
 */
export function starsRating(monster) {
  const B = calculateB(monster);
  const ratio = (B * B) / (999 * 999); // 最大値 999² で正規化
  return Math.min(Math.ceil(ratio * 10), 10);
}

/**
 * 星数に応じたフレーム番号を返す
 * @param {object} monster
 * @returns {number}
 */
export function getFrameNo(monster) {
  if (monster.Stars >= 9) return 3;
  if (monster.Stars >= 7) return 2;
  return 1;
}

/**
 * 召喚時に再生する音声用テキストを返す
 * @param {object} m
 * @returns {string}
 */
export function monsterVoice(m) {
  if (m.Stars >= 9) {
    return "最強レベルのモンスターが召喚されました。";
  } else if (m.Stars >= 7) {
    return "非常に強いモンスターが召喚されました。";
  } else if (m.Attack >= 500 && m.Attack > m.MagicAttack) {
    return "攻撃が得意なモンスターが召喚されました。";
  } else if (m.MagicAttack >= 500) {
    return "魔力の強いモンスターが召喚されました。";
  } else if (m.Defense >= 400 && m.MagicDefense >= 400) {
    return "防御力が高いモンスターが召喚されました。";
  } else if (m.Charm >= 800) {
    return "非常に魅力的なモンスターが召喚されました。";
  } else {
    return `ほしが${m.Stars}のモンスターが召喚されました。`;
  }
}
