// 納期の制限設定
const deadlineInput = document.getElementById("deadline");
const warning = document.getElementById("deadline-warning");

const today = new Date();
const minDate = new Date();
minDate.setDate(today.getDate() + 5); // 4日以内を選択不可（5日後から選択可能）
deadlineInput.min = minDate.toISOString().split("T")[0];

function updateVisibility() {
  // 差分入力の切り替え
  document.getElementById("outfit-count-wrap").style.display =
    document.getElementById("outfit-toggle").value === "有"
      ? "inline-block"
      : "none";

  document.getElementById("face-count-wrap").style.display =
    document.getElementById("face-toggle").value === "有"
      ? "inline-block"
      : "none";

  // 納期警告の判定
  const selectedDate = new Date(deadlineInput.value);
  const oneWeekLater = new Date();
  oneWeekLater.setDate(today.getDate() + 7);

  if (deadlineInput.value && selectedDate <= oneWeekLater) {
    warning.style.display = "block";
  } else {
    warning.style.display = "none";
  }

  generateSheet(); // プレビュー更新
}

// 全ての入力に対して監視
document.querySelectorAll("input, select, textarea").forEach((el) => {
  el.addEventListener("input", updateVisibility);
});

function generateSheet() {
  // 差分の表示文字列作成
  const outfit =
    document.getElementById("outfit-toggle").value === "有"
      ? `有（${document.getElementById("outfit-count").value}枚）`
      : "無";
  const face =
    document.getElementById("face-toggle").value === "有"
      ? `有（${document.getElementById("face-count").value}枚）`
      : "無";

  const text = `【依頼内容】
描画範囲：${document.getElementById("draw-range").value}
立ち絵枚数：${document.getElementById("count").value}
衣装差分の有無・数：${outfit}
表情差分の有無・数：${face}

画像サイズ：${document.getElementById("img-size").value || "指定なし"}
解像度：${document.getElementById("img-dpi").value || "指定なし"}
著作権譲渡・商用利用の有無：${document.getElementById("commercial-toggle").value}
実績公開の可否：${document.getElementById("portfolio").value}

希望納期：${document.getElementById("deadline").value || "相談"}

【キャラクター詳細】
世界観（ジャンル、シナリオ名等）：${document.getElementById("world").value || "未定"}
性別：${document.getElementById("gender-select").value}
髪型・色：${document.getElementById("hair").value || "未指定"}
目・色：${document.getElementById("eye").value || "未指定"}
肌色：${document.getElementById("skin").value || "未指定"}
服装：${document.getElementById("clothing").value || "未指定"}
その他特徴（装飾・こだわり等）：${document.getElementById("details").value || "特になし"}
簡単な性格：上記に含む

資料画像の有無：${document.getElementById("ref-image").value}`;

  document.getElementById("output-text").value = text;
}

// 全ての入力に対して監視
document.querySelectorAll("input, select, textarea").forEach((el) => {
  // inputイベント（文字入力や選択変更）があったら表示を更新
  el.addEventListener("input", updateVisibility);
});

// --- ここを追加 ---
// ページ読み込み時に1回実行して、初期状態のプレビューを表示させる
window.addEventListener("DOMContentLoaded", () => {
  updateVisibility();
});

// --- コピー機能の修正 ---
function copyToClipboard() {
  const output = document.getElementById("output-text");
  const copyBtn = document.getElementById("copy-order");

  // テキストを選択してコピー
  output.select();
  output.setSelectionRange(0, 99999); // スマホ対応

  try {
    const successful = document.execCommand("copy");
    if (successful) {
      // 成功時の演出：ボタンの文字を一時的に変える
      const originalText = copyBtn.innerText;
      copyBtn.innerText = "コピー完了！";
      copyBtn.style.backgroundColor = "#4caf50"; // 一時的に緑色に

      setTimeout(() => {
        copyBtn.innerText = "テンプレをコピー";
        copyBtn.style.backgroundColor = "";
        copyBtn.style.width = ""; // 元（100%など）に戻す
      }, 2000);
    }
  } catch (err) {
    alert(
      "コピーに失敗しました。お手数ですが手動で選択してコピーしてください。",
    );
  }
}

// ページ読み込み完了時の処理
window.addEventListener("DOMContentLoaded", () => {
  // 初期表示の反映
  updateVisibility();

  // コピーボタンにクリックイベントを登録
  const copyBtn = document.getElementById("copy-order");
  if (copyBtn) {
    copyBtn.addEventListener("click", copyToClipboard);
  }
});
