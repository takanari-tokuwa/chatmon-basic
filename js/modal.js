// modal.js

import { GAME_SETTINGS, MODEL_SUMMON, MODEL_BATTLE ,CALLMON_PROMPT , BATTLE_PROMPT } from './config.js';

/**
 * createSettingsModal()
 * モーダルを動的に生成し、初期状態は非表示。
 * 背景は黒の半透明オーバーレイ。クリックしても閉じない。
 */
export function createSettingsModal() {
  // 既存モーダルがあれば削除
  const existing = document.getElementById("settingsModal");
  if (existing) existing.remove();

  // オーバーレイ
  const modal = document.createElement("div");
  modal.id = "settingsModal";
  Object.assign(modal.style, {
    display: "none",
    position: "fixed",
    zIndex: "1000",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "auto"
  });
  modal.addEventListener("click", e => e.stopPropagation());
  document.body.appendChild(modal);

  // コンテンツ箱
  const content = document.createElement("div");
  content.className = "modal-content";
  Object.assign(content.style, {
    backgroundColor: "#fff",
    padding: "15px 30px",
    width: "800px",
    borderRadius: "10px",
    boxShadow: "0 0 10px #000",
    color: "#333",
    textAlign: "left",
    fontSize: "14px",
    pointerEvents: "auto",
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)"
  });
  content.addEventListener("click", e => e.stopPropagation());
  modal.appendChild(content);

  // タイトル
  const title = document.createElement("div");
  title.textContent = "≪ 設 定 ≫";
  Object.assign(title.style, {
    backgroundColor: "#333",
    color: "#fff",
    padding: "8px 0",
    textAlign: "center",
    fontSize: "16px",
    fontWeight: "bold",
    borderRadius: "10px 10px 0 0",
    marginBottom: "5px"
  });
  content.appendChild(title);

  // フォームコンテナ
  const form = document.createElement("form");
  form.id = "settingsForm";
  content.appendChild(form);

  // 共通スタイル
  const inputStyle = `
    font-size:16px;
    padding:5px 10px;
    border:2px solid #333;
    border-radius:5px;
    margin-bottom:8px;
    width:100%;
    box-sizing:border-box;
  `;

  // 設定項目一覧
  const settings = [
    // ターン設定
    { category: "ターン設定", name: "maxTurnCnt", type: "number", label: "最大ターン数（目安）", defaultValue: GAME_SETTINGS.maxTurnCnt },
    { category: "ターン設定", name: "battleMaxCountFlg", type: "checkbox", label: "ターン数の調整", defaultValue: GAME_SETTINGS.battleMaxCountFlg },
    { category: "ターン設定", name: "battleMaxCount", type: "number", label: "調整後のターン数", defaultValue: GAME_SETTINGS.battleMaxCount },
    // 音量設定
    { category: "音量設定", name: "bgmVolume", type: "range", label: "BGM音量", min:0, max:1, step:0.1, defaultValue: GAME_SETTINGS.bgmVolume },
    { category: "音量設定", name: "effectVolume", type: "range", label: "効果音音量", min:0, max:1, step:0.1, defaultValue: GAME_SETTINGS.effectVolume },
    { category: "音量設定", name: "voiceFlg", type: "checkbox", label: "音声", defaultValue: GAME_SETTINGS.voiceFlg },
    // プロンプト
    { category: "プロンプト", name: "callMonPromptNo1", type: "select", label: "召喚(左)", options: CALLMON_PROMPT, defaultValue: GAME_SETTINGS.callMonPromptNo1 },
    { category: "プロンプト", name: "callMonPromptNo2", type: "select", label: "召喚(右)", options: CALLMON_PROMPT, defaultValue: GAME_SETTINGS.callMonPromptNo2 },
    { category: "プロンプト", name: "battlePromptNo", type: "select", label: "バトル",    options: BATTLE_PROMPT, defaultValue: GAME_SETTINGS.battlePromptNo },
    // モデル
    { category: "モデル", name: "modelName_Summon", type: "select", label: "召喚モデル", options: MODEL_SUMMON, defaultValue: GAME_SETTINGS.modelName_Summon },
    { category: "モデル", name: "modelName_Battle", type: "select", label: "バトルモデル", options: MODEL_BATTLE, defaultValue: GAME_SETTINGS.modelName_Battle },
    // その他
    { category: "その他", name: "cardHiddenFlg", type: "checkbox", label: "直前まで対戦相手を非公開", defaultValue: GAME_SETTINGS.cardHiddenFlg },
    { category: "その他", name: "cardResetFlg", type: "checkbox", label: "対戦時に能力再設定", defaultValue: GAME_SETTINGS.cardResetFlg },
    { category: "その他", name: "vrmFlg", type: "checkbox", label: "VRMモデル", defaultValue: GAME_SETTINGS.vrmFlg },
    //{ category: "その他", name: "autoPlayFlg", type: "checkbox", label: "全自動操作", defaultValue: GAME_SETTINGS.autoPlayFlg }
  ];

  // グローバルで参照
  window.settingsList = settings;

  // 2列レイアウト
  const container = document.createElement("div");
  container.style.cssText = "display:grid;grid-template-columns:370px 370px;gap:5px 20px;margin-top:10px;";
  form.appendChild(container);

  let currentCategory = "";
  settings.forEach(setting => {
    // カテゴリ見出し
    if (setting.category !== currentCategory) {
      currentCategory = setting.category;
      const lbl = document.createElement("div");
      lbl.textContent = currentCategory;
      lbl.style.cssText = "grid-column:span 2;font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:3px;margin-top:5px;";
      container.appendChild(lbl);
    }
    // 入力行
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;align-items:center;gap:5px;";
    const label = document.createElement("label");
    label.textContent = setting.label;
    label.style.flex = "1";

    let input;
    if (setting.type === "select") {
      input = document.createElement("select");
      input.name = setting.name;
      setting.options.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.displayName;
        input.appendChild(o);
      });
      input.value = setting.defaultValue;
      input.style.cssText = inputStyle;
    } else if (setting.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.name = setting.name;
      input.checked = setting.defaultValue;
    } else {
      input = document.createElement("input");
      input.type = setting.type;
      input.name = setting.name;
      input.value = parseFloat(setting.defaultValue);
      if (setting.type === "range") {
        input.min = setting.min;
        input.max = setting.max;
        input.step = setting.step;
        input.value = parseFloat(setting.defaultValue);
      }else{
        input.value = setting.defaultValue;
        input.style.cssText = inputStyle;
      }
    }
    input.style.flex = "1";

    wrapper.append(label, input);
    container.appendChild(wrapper);
  });

  // ボタン
  const btnArea = document.createElement("div");
  btnArea.style.cssText = "display:flex;justify-content:center;gap:10px;margin-top:10px;";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "保存";
  saveBtn.addEventListener("click", () => {
    saveSettings();
    closeModal();
  });
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "キャンセル";
  cancelBtn.addEventListener("click", closeModal);
  btnArea.append(saveBtn, cancelBtn);
  content.appendChild(btnArea);
}

/**
 * saveSettings()
 * フォーム値を GAME_SETTINGS に反映
 */
export function saveSettings() {
  const form = document.getElementById("settingsForm");
  if (!form || !window.settingsList) return;
  window.settingsList.forEach(s => {
    if (s.type === "checkbox") {
      GAME_SETTINGS[s.name] = form[s.name].checked;
    } else if (s.type === "range") {
      GAME_SETTINGS[s.name] = parseFloat(form[s.name].value);
    } else {
      GAME_SETTINGS[s.name] = form[s.name].value;
    }
  });
  // debug モード自動切り替え
  GAME_SETTINGS.debugMode_Summon = GAME_SETTINGS.modelName_Summon === "debug";
  GAME_SETTINGS.debugMode_Battle = GAME_SETTINGS.modelName_Battle === "debug";
  console.log("[INFO] 設定更新:", GAME_SETTINGS);
}

/** openModal(): モーダル表示 */
export function openModal() {
  const m = document.getElementById("settingsModal");
  if (m) m.style.display = "flex";
}
/** closeModal(): モーダル非表示 */
export function closeModal() {
  const m = document.getElementById("settingsModal");
  if (m) m.style.display = "none";
}
