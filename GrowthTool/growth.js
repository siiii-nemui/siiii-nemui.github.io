// 技能初期値リスト
const initialValues = {
  回避: 0,
  キック: 25,
  組み付き: 25,
  こぶし: 50,
  パンチ: 50,
  頭突き: 10,
  投擲: 25,
  マーシャルアーツ: 1,
  拳銃: 20,
  サブマシンガン: 15,
  ショットガン: 30,
  マシンガン: 15,
  ライフル: 25,
  応急手当: 30,
  鍵開け: 1,
  隠す: 15,
  隠れる: 10,
  聞き耳: 25,
  忍び歩き: 10,
  写真術: 10,
  精神分析: 1,
  追跡: 10,
  登攀: 40,
  図書館: 25,
  目星: 25,
  運転: 20,
  機械修理: 20,
  重機械操作: 1,
  乗馬: 5,
  水泳: 25,
  製作: 5,
  操縦: 1,
  跳躍: 25,
  電気修理: 10,
  ナビゲート: 10,
  変装: 1,
  言いくるめ: 5,
  信用: 15,
  説得: 15,
  値切り: 5,
  母国語: 0,
  医学: 5,
  オカルト: 5,
  化学: 1,
  クトゥルフ神話: 0,
  芸術: 5,
  経理: 10,
  考古学: 1,
  コンピューター: 1,
  心理学: 5,
  人類学: 1,
  生物学: 1,
  地質学: 1,
  電子工学: 1,
  天文学: 1,
  博物学: 1,
  物理学: 1,
  法律: 5,
  薬学: 1,
  歴史: 20,
};

let rawLogData = [];
let excludeTabs = [];
let userOrder = [];
let currentDisplayMode = "timeline";

function changeDisplayMode(mode) {
  currentDisplayMode = mode;
  document
    .getElementById("mode-timeline")
    .classList.toggle("active", mode === "timeline");
  document
    .getElementById("mode-category")
    .classList.toggle("active", mode === "category");
  applyFilters();
}

document.getElementById("log-file").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    processLog(event.target.result);
  };
  reader.readAsText(file);
});

// ログ解析（カッコ付きCCBや複数回ロールに対応）
function processLog(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  const messages = doc.querySelectorAll("p");
  rawLogData = [];
  userOrder = []; // 人物一覧（並び順・表示設定）をリセット
  document.getElementById("user-list").innerHTML = ""; // 画面上の人物リスト表示もクリア

  messages.forEach((msg, index) => {
    const text = msg.textContent.trim();
    if (!text) return;

    const headerMatch = text.match(/^\[(.*?)\]\s*(.*?)\s*:\s*(.*)/s);
    if (!headerMatch) {
      rawLogData.push({
        isDice: false,
        fullText: text,
        lineIndex: index,
      });
      return;
    }
    const [_, tab, name, body] = headerMatch;

    // カッコ付きCCBも許容する正規表現に強化
    if (body.trim().startsWith("x")) {
      const multiHeader = body.match(/^(x\d+\s+CCB?.*?<=?\d+\s*【.*?】)/);
      if (multiHeader) {
        const title = multiHeader[1];
        const resRegex =
          /#\d+\s*\(1D100<=?(\d+)\).*?＞\s*(\d+)\s*＞\s*([^\s#]+)/g;
        let matchRes;
        let subResults = [];
        while ((matchRes = resRegex.exec(body)) !== null) {
          const [__, targetVal, value, status] = matchRes;
          subResults.push({
            detail: `(1D100<=${targetVal}) ＞ ${value} ＞ ${status}`,
            value: parseInt(value),
            target: parseInt(targetVal),
            status: status,
          });
        }
        if (subResults.length > 0) {
          rawLogData.push({
            isDice: true,
            tab,
            name,
            title,
            subResults,
            isMulti: true,
            fullText: text,
            lineIndex: index,
          });
        }
      }
    } else {
      // 通常ロール：CCBの後のカッコ等を柔軟に拾うように修正
      const singleMatch = body.match(
        /(CCB?.*?<=?(\d+).*?＞\s*(\d+)\s*＞\s*([^\s]+))/,
      );
      if (singleMatch) {
        const [__, detail, target, value, status] = singleMatch;
        rawLogData.push({
          isDice: true,
          tab,
          name,
          detail,
          target: parseInt(target),
          value: parseInt(value),
          status: status,
          isMulti: false,
          fullText: text,
          lineIndex: index,
        });
      } else {
        rawLogData.push({
          isDice: false,
          fullText: text,
          lineIndex: index,
        });
      }
    }
  });
  applyFilters();
}

function applyFilters() {
  const ui = {
    critical: document.getElementById("f-critical").checked,
    special: document.getElementById("f-special").checked,
    fumble: document.getElementById("f-fumble").checked,
    success: document.getElementById("f-success").checked,
    initial: document.getElementById("f-initial").checked,
    failure: document.getElementById("f-failure").checked,
    unique: document.getElementById("f-unique").checked,
    excludeStats: document.getElementById("f-exclude-stats").checked,
    valMin: document.getElementById("val-min").value,
    valEq: document.getElementById("val-eq").value,
    valMax: document.getElementById("val-max").value,
    afterStr: document.getElementById("after-string").value.trim(),
  };

  let filteredData = {};
  let foundTrigger = ui.afterStr === "";
  let userSkillHistory = {};

  rawLogData.forEach((log) => {
    // 1. トリガーチェック
    if (!foundTrigger) {
      if (log.fullText.includes(ui.afterStr)) foundTrigger = true;
      if (!foundTrigger || !log.isDice) return;
    }
    if (!log.isDice) return;
    if (excludeTabs.includes(log.tab)) return;

    if (!userSkillHistory[log.name]) userSkillHistory[log.name] = new Set();

    let displayLog = JSON.parse(JSON.stringify(log)); // 深いコピーで元のデータを守る

    // 能力値・SAN等の除外判定（フラグ管理に変更）
    let isStatExcluded = false;
    if (ui.excludeStats) {
      const bodyText = log.fullText;
      const isRegisteredSkill = Object.keys(initialValues).some((skill) =>
        bodyText.includes(skill),
      );
      const hasSkillBracket = /【.*?】/.test(bodyText);
      const isStatRoll =
        /SAN|ＳＡＮ|正気度|アイデア|知識|幸運|db|ダメージボーナス|集計|野外|STR|CON|POW|DEX|APP|SIZ|INT|EDU/.test(
          bodyText,
        ) || /\*\d+/.test(bodyText);
      if (!isRegisteredSkill && (!hasSkillBracket || isStatRoll)) {
        isStatExcluded = true;
      }
    }

    const processEntry = (entry, skillDetail) => {
      const type = getFinalType(
        skillDetail,
        entry.target,
        entry.value,
        entry.status,
      );
      let isHidden = false;

      // 1. 能力値排除（既存ロジック）
      if (ui.excludeStats) {
        const isRegistered = Object.keys(initialValues).some((s) =>
          skillDetail.includes(s),
        );
        const hasBracket = /【.*?】/.test(log.fullText);
        const isStat =
          /SAN|ＳＡＮ|正気度|アイデア|知識|幸運|STR|CON|POW|DEX|APP|SIZ|INT|EDU/.test(
            log.fullText,
          ) || /\*\d+/.test(log.fullText);
        if (!isRegistered && (!hasBracket || isStat)) isHidden = true;
      }

      // 2. 出目フィルタ（ここを修正：数値変換と空欄チェックを厳密化）
      if (!isHidden) {
        const val = parseInt(entry.value);
        if (ui.valMin !== "" && val < parseInt(ui.valMin)) isHidden = true;
        if (ui.valEq !== "" && val !== parseInt(ui.valEq)) isHidden = true;
        if (ui.valMax !== "" && val > parseInt(ui.valMax)) isHidden = true;
      }

      // 3. 重複排除（既存ロジック）
      if (!isHidden && ui.unique) {
        let skillName = "";
        for (let s in initialValues) {
          if (skillDetail.includes(s)) {
            skillName = s;
            break;
          }
        }
        if (skillName) {
          if (userSkillHistory[log.name].has(skillName)) isHidden = true;
          else userSkillHistory[log.name].add(skillName);
        }
      }

      // 4. UIトグル判定（成功・失敗などの種類別）
      if (!isHidden) {
        if (type === "critical" && !ui.critical) isHidden = true;
        else if (type === "special" && !ui.special) isHidden = true;
        else if (type === "fumble" && !ui.fumble) isHidden = true;
        else if (type === "initial" && !ui.initial) isHidden = true;
        else if (type === "success" && !ui.success) isHidden = true;
        else if (type === "other" && !ui.failure) isHidden = true;
      }

      return { type, isHidden };
    };

    if (log.isMulti) {
      displayLog.subResults = log.subResults.map((sub) => {
        const res = processEntry(sub, log.title);
        return { ...sub, type: res.type, isHidden: res.isHidden };
      });
      // すべての結果が非表示でも、CFカウントのためにデータは送る
    } else {
      const res = processEntry(log, log.detail);
      displayLog.type = res.type;
      displayLog.isHidden = res.isHidden;
    }

    if (!filteredData[log.name]) filteredData[log.name] = {};
    if (!filteredData[log.name][log.tab]) filteredData[log.name][log.tab] = [];
    filteredData[log.name][log.tab].push(displayLog);
  });

  render(filteredData);
}

function getFinalType(detail, target, value, status) {
  // 1. まず「成功したかどうか」を大前提にする
  const isSuccess = value <= target;

  // 2. 成功している場合のみ、クリティカルやスペシャルの判定を行う
  if (isSuccess) {
    // 1-5 かつ 目標値以下ならクリティカル
    if (value <= 5 || status.includes("決定的成功")) return "critical";

    // スペシャル（目標値の1/5以下）
    if (status.includes("スペシャル")) return "special";

    // 初期値成功のチェック
    let isInitialVal = false;
    for (let skill in initialValues) {
      if (detail.includes(skill) && target === initialValues[skill]) {
        isInitialVal = true;
        break;
      }
    }
    return isInitialVal ? "initial" : "success";
  }

  // 3. 失敗している場合
  // 96-100 はファンブル
  if (value >= 96 || status.includes("致命的失敗")) return "fumble";

  // それ以外はただの失敗
  return "other";
}

function render(data) {
  const display = document.getElementById("display-area");
  const textarea = document.getElementById("output-text");
  display.innerHTML = "";
  let textOut = "";

  updateUserList(data);

  userOrder.forEach((user) => {
    if (!user.visible || !data[user.name]) return;

    const tabs = data[user.name];
    let cCount = 0,
      fCount = 0;

    // --- カウント処理：isHiddenに関係なく、タブ除外されていないすべてのダイスを集計 ---
    Object.values(tabs).forEach((logs) => {
      logs.forEach((log) => {
        if (log.isMulti) {
          log.subResults.forEach((sub) => {
            if (sub.type === "critical") cCount++;
            if (sub.type === "fumble") fCount++;
          });
        } else {
          if (log.type === "critical") cCount++;
          if (log.type === "fumble") fCount++;
        }
      });
    });

    let userHtml = `<div class="user-block"><span class="user-name">❚ ${user.name}  ${cCount}C ${fCount}F</span>`;
    textOut += `❚${user.name}  ${cCount}C${fCount}F\n`;

    // 画面表示用：isHidden が false のものだけを出す
    if (currentDisplayMode === "timeline") {
      for (let tab in tabs) {
        let tabHtml = "";
        tabs[tab].forEach((log) => {
          if (log.isMulti) {
            const visibleSubs = log.subResults.filter((s) => !s.isHidden);
            if (visibleSubs.length > 0) {
              tabHtml += `<div class="log-line">${log.title}</div>`;
              visibleSubs.forEach((sub) => {
                tabHtml += `<div class="log-line ${sub.type}" style="padding-left: 2em;">${sub.detail}</div>`;
              });
            }
          } else if (!log.isHidden) {
            tabHtml += `<div class="log-line ${log.type}">${log.detail}</div>`;
          }
        });
        if (tabHtml !== "") {
          userHtml += `<span class="tab-name">${tab}</span>` + tabHtml;
        }
      }
    } else {
      const categories = { 決定的成功: [], 致命的失敗: [], 初期値成功: [] };
      Object.values(tabs).forEach((logs) => {
        logs.forEach((log) => {
          if (log.isMulti) {
            log.subResults.forEach((sub) => {
              if (sub.isHidden) return;
              const label =
                sub.type === "critical"
                  ? "決定的成功"
                  : sub.type === "fumble"
                    ? "致命的失敗"
                    : sub.type === "initial"
                      ? "初期値成功"
                      : null;
              if (label)
                categories[label].push({ detail: sub.detail, type: sub.type });
            });
          } else if (!log.isHidden) {
            const label =
              log.type === "critical"
                ? "決定的成功"
                : log.type === "fumble"
                  ? "致命的失敗"
                  : log.type === "initial"
                    ? "初期値成功"
                    : null;
            if (label)
              categories[label].push({ detail: log.detail, type: log.type });
          }
        });
      });
      for (let cat in categories) {
        if (categories[cat].length > 0) {
          userHtml += `<div class="category-label">${cat}</div>`;
          categories[cat].forEach((item) => {
            userHtml += `<div class="log-line ${item.type}">${item.detail}</div>`;
          });
        }
      }
    }
    userHtml += `</div>`;
    display.innerHTML += userHtml;

    // コピー用テキスト作成（isHidden を無視しないように修正）
    const copyCats = { 決定的成功: [], 致命的失敗: [], 初期値成功: [] };
    Object.values(tabs).forEach((logs) => {
      logs.forEach((log) => {
        if (log.isMulti) {
          log.subResults.forEach((sub) => {
            if (sub.isHidden) return;
            const label =
              sub.type === "critical"
                ? "決定的成功"
                : sub.type === "fumble"
                  ? "致命的失敗"
                  : sub.type === "initial"
                    ? "初期値成功"
                    : null;
            if (label)
              copyCats[label].push({
                parentTitle: log.title,
                detail: sub.detail,
              });
          });
        } else if (!log.isHidden) {
          const label =
            log.type === "critical"
              ? "決定的成功"
              : log.type === "fumble"
                ? "致命的失敗"
                : log.type === "initial"
                  ? "初期値成功"
                  : null;
          if (label)
            copyCats[label].push({ parentTitle: null, detail: log.detail });
        }
      });
    });
    for (let cat in copyCats) {
      if (copyCats[cat].length > 0) {
        textOut += `・${cat}\n`;
        let lastParent = "";
        copyCats[cat].forEach((item) => {
          if (item.parentTitle) {
            if (lastParent !== item.parentTitle) {
              textOut += `　${item.parentTitle}\n`;
              lastParent = item.parentTitle;
            }
            textOut += `　　${item.detail}\n`;
          } else {
            textOut += `　${item.detail}\n`;
            lastParent = "";
          }
        });
      }
    }
    textOut += `\n`;
  });
  textarea.value = textOut.trim();
}

function updateUserList(data) {
  const currentNames = Object.keys(data);
  currentNames.forEach((name) => {
    if (!userOrder.find((u) => u.name === name)) {
      userOrder.push({ name: name, visible: true });
    }
  });
  renderUserList();
}

function renderUserList() {
  const container = document.getElementById("user-list");
  container.innerHTML = "";
  userOrder.forEach((user, index) => {
    const div = document.createElement("div");
    div.className = `user-item ${user.visible ? "" : "hidden"}`;
    div.draggable = true;
    div.innerHTML = `<span>${user.name}</span> <small>${user.visible ? "表示" : "非表示"}</small>`;
    div.onclick = () => {
      user.visible = !user.visible;
      applyFilters();
    };
    div.ondragstart = (e) => e.dataTransfer.setData("text/plain", index);
    div.ondragover = (e) => e.preventDefault();
    div.ondrop = (e) => {
      e.preventDefault();
      const fromIndex = e.dataTransfer.getData("text/plain");
      const item = userOrder.splice(fromIndex, 1)[0];
      userOrder.splice(index, 0, item);
      applyFilters();
    };
    container.appendChild(div);
  });
}

function toggleFilterDetail() {
  const el = document.getElementById("filter-inputs");
  el.style.display = el.style.display === "none" ? "block" : "none";
}

function clearDiceFilter() {
  document.getElementById("val-min").value = "";
  document.getElementById("val-eq").value = "";
  document.getElementById("val-max").value = "";
  applyFilters();
}

// 除外タブ追加（Enter対応と再描画の修正）
function addExcludeTab() {
  const input = document.getElementById("exclude-tab-input");
  const tabName = input.value.trim();
  if (tabName && !excludeTabs.includes(tabName)) {
    excludeTabs.push(tabName);
    const list = document.getElementById("exclude-tabs-list");
    const span = document.createElement("span");
    span.style =
      "background:#e91e63; color:white; padding:2px 8px; margin:2px; border-radius:12px; cursor:pointer; display:inline-block; font-size:11px;";
    span.textContent = tabName + " ×";
    span.onclick = function () {
      excludeTabs = excludeTabs.filter((t) => t !== tabName);
      this.remove();
      applyFilters();
    };
    list.appendChild(span);
    input.value = "";
    applyFilters();
  }
}

// イベント登録
document.querySelectorAll(".toggle").forEach((el) => {
  el.addEventListener("change", applyFilters);
});
document.querySelector(".main-copy-btn").addEventListener("click", function () {
  const textarea = document.getElementById("output-text");
  textarea.select();
  document.execCommand("copy");
  alert("テキストをコピーしました！");
});
document.getElementById("after-string").addEventListener("input", applyFilters);
document
  .getElementById("exclude-tab-input")
  .addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addExcludeTab();
    }
  });
document.getElementById("val-min").addEventListener("input", applyFilters);
document.getElementById("val-eq").addEventListener("input", applyFilters);
document.getElementById("val-max").addEventListener("input", applyFilters);
