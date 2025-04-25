// services/chatService.js

import { API_CONFIG,
         GAME_SETTINGS,
         dummyName1,
         dummyName2,
         FIELD_CONFIG }                 from '../config.js';
import { monstersData,
         battleState,
         tournamentData }               from '../globalState.js';
import { readTextFile }                 from '../utils/io.js';
import { convertMonsterToJsonText,
           convertMonsterName }         from '../features/monster/MonsterCharacter.js';
import { wait }                         from '../utils/async.js';


/**
 * モンスター召喚用: 画像を ChatGPT に渡し JSON を取得
 * @param {string} dataUrlImage  - data:image/... のプレフィックス付き DataUrl
 * @param {string} promptSystem - system プロンプト
 * @param {string} promptUser   - user プロンプト
 * @returns {Promise<object>}   - JSON オブジェクトとしてのレスポンス
 */
export async function callChatMon(dataUrlImage, promptSystem, promptUser) {
  const messages = [
    { role: "system", content: promptSystem },
    {
      role: "user",
      content: [
        { type: "text", text: promptUser },
        {
          type: "image_url",
          image_url: {
            url: dataUrlImage,
            detail: "low"
          }
        }
      ]
    }
  ];
  const bodyData = {
    model: API_CONFIG.modelName_Summon,
    messages,
    response_format: { type: "json_object" },
    max_tokens: 1000
  };
  const res = await fetch(API_CONFIG.endPoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_CONFIG.chatGptApiKey}`
    },
    body: JSON.stringify(bodyData)
  });
  const json = await res.json();
  if (!json.choices?.[0]?.message?.content) {
    throw new Error("Invalid response from OpenAI: " + JSON.stringify(json));
  }
  return json.choices[0].message.content;
}

/**
 * バトル結果を取得
 * @param {Array} messages - ChatGPT 用メッセージ配列
 * @returns {Promise<object>}
 */
export async function fetchBattleResult(messages) {
  const bodyData = {
    model: API_CONFIG.modelName_Battle,
    messages,
    response_format: { type: "json_object" },
    max_tokens: 3000
  };
  const res = await fetch(API_CONFIG.endPoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_CONFIG.chatGptApiKey}`
    },
    body: JSON.stringify(bodyData)
  });
  const json = await res.json();
  if (!json.choices?.[0]?.message?.content) {
    throw new Error("Invalid battle response: " + JSON.stringify(json));
  }
  return json.choices[0].message.content;
}

/**
 * 長いバトルをダイジェスト化
 * @param {Array} battleSituation 
 * @param {number} battleMaxCount 
 * @returns {Promise<Array>}
 */
export async function fetchBattleDigest(battleSituation, battleMaxCount) {
  const promptText = `
### 下記の戦いを不要な部分を省略圧縮し、フォーマットは変えず、***配列数${battleMaxCount}***のJSONデータに書き直して下さい。最後に配列数を確認し、多ければ作り直して下さい。
### ターン１は残して下さい。
### 勝者を変えず、決着はつけて下さい。
### Conditionが増減する後半のターンを優先して残し、不自然な展開にしないで下さい。
### Conditionが１ターンで50以上減るような展開は避けて下さい。
### バトルのダメージに焦点を当て、具体的な攻撃と防御のシーンを詳細に描写して下さい。
### BattleCommentaryの口調や文体は変えないで下さい。
{
BattleSituation:${JSON.stringify(battleSituation)}
}
`;
  const messages = [
    { role: "system", content: "編集者として創造的な文章を要約するようにふるまいます。" },
    { role: "user", content: promptText }
  ];
  const bodyData = {
    model: API_CONFIG.modelName_Battle,
    messages,
    response_format: { type: "json_object" },
    max_tokens: 3000
  };
  const res = await fetch(API_CONFIG.endPoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_CONFIG.chatGptApiKey}`
    },
    body: JSON.stringify(bodyData)
  });
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) return battleSituation;
  try {
    return JSON.parse(content).BattleSituation;
  } catch {
    return battleSituation;
  }
}

// --- Embeddings utilities ---

function dotProduct(a, b) {
  return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
}

function norm(v) {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/**
 * コサイン類似度
 * @param {Array<number>} vecA
 * @param {Array<number>} vecB
 * @returns {number}
 */
export function cosineSimilarity(vecA, vecB) {
  return dotProduct(vecA, vecB) / (norm(vecA) * norm(vecB));
}

/**
 * OpenAI Embedding 取得
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
export async function getEmbedding(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_CONFIG.chatGptApiKey}`
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float"
    })
  });
  const json = await res.json();
  return json.data[0].embedding;
}

/**
 * バトル実行ワークフロー：再試行付き
 * @param {object} monster1 
 * @param {object} monster2 
 */
export async function monsterBattleRun(monster1, monster2) {
  if (
    !monstersData[battleState.monsterData1.dataIndex].CardImageData ||
    !monstersData[battleState.monsterData2.dataIndex].CardImageData ||
    battleState.isRunBattleData ||
    battleState.isBattleDataRequest
  ) return;

  battleState.isBattleDataRequest = true;
  let attempt = 0;
  const maxRetries = 3;
  while (attempt < maxRetries) {
    try {
      await createBattle(monster1, monster2);
      return;
    } catch (err) {
      attempt++;
      if (attempt < maxRetries) {
        if (!confirm(`バトル処理エラー (${attempt}/${maxRetries})。再試行しますか？`)) break;
      } else {
        alert("バトル処理に3回失敗しました。しばらくしてから再試行してください。");
      }
    }
  }
}

/**
 * バトル用プロンプト読み込み～API 呼び出し、結果格納
 * @param {object} mon1 
 * @param {object} mon2 
 */
async function createBattle(mon1, mon2) {
  battleState.isRunBattleData = true;
  const no = GAME_SETTINGS.battlePromptNo;
  const userTpl   = await readTextFile(`assets/prompt/battle/${no}_user.txt`);
  const systemTpl = await readTextFile(`assets/prompt/battle/${no}_system.txt`);

  const m1 = convertMonsterToJsonText(dummyName1, mon1);
  const m2 = convertMonsterToJsonText(dummyName2, mon2);
  let prompt = userTpl
    .replaceAll("{dummyName1}", dummyName1)
    .replaceAll("{dummyName2}", dummyName2)
    .replaceAll("{monster1}", m1)
    .replaceAll("{monster2}", m2)
    .replaceAll("{max_turn}", GAME_SETTINGS.maxTurnCnt);

  const messages = [
    { role: "system", content: systemTpl },
    { role: "user",   content: prompt }
  ];

  let resultText;
  if (GAME_SETTINGS.debugMode_Battle) {
    const debugTxt = await readTextFile("assets/debug/battle.txt");
    resultText = debugTxt;
  } else {
    resultText = await fetchBattleResult(messages);
  }

  battleState.resulBattle = JSON.parse(resultText);

  // 必要に応じてダイジェスト化
  if (GAME_SETTINGS.battleMaxCountFlg) {
    battleState.resulBattle.BattleSituation = await fetchBattleDigest(
      battleState.resulBattle.BattleSituation,
      GAME_SETTINGS.battleMaxCount
    );
  }

  // 場所を埋め込む
  const emb = await getEmbedding(battleState.resulBattle.BattleLocation);
  let best = { dist: -Infinity, idx: 0 };
  FIELD_CONFIG.forEach((f, i) => {
    const d = cosineSimilarity(emb, f.embedding);
    if (d > best.dist) best = { dist: d, idx: i };
  });
  battleState.battleFieldNo = FIELD_CONFIG[best.idx].fieldNo;
  battleState.isRunBattleData = false;
}
