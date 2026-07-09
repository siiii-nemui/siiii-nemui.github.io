// ScheduleTool/schedule_tool.js

console.log("日程調整ツールがロードされました。");

const calendarContainer = document.getElementById("calendar-container");
const selectedDatesTextarea = document.getElementById("selected-dates");
const copyButton = document.getElementById("copy-button");

// モード選択ボタン


const optionsButton = document.getElementById("options-button");
const optionsPanel = document.getElementById("options-panel");
const dayStartTimeInput = document.getElementById("day-start");
const dayEndTimeInput = document.getElementById("day-end");
const nightStartTimeInput = document.getElementById("night-start");
const nightEndTimeInput = document.getElementById("night-end");
const applyTimeSettingsButton = document.getElementById("apply-time-settings");
const selectedDatesListContainer = document.getElementById(
  "selected-dates-list-container",
);
const nightEnd24hDisplay = document.getElementById("night-end-24h-display"); // 新しい要素を取得
const bulkTimeButtons = document.querySelectorAll(".bulk-time-button");
const bulkOptionsToggle = document.getElementById("bulk-options-toggle");
const bulkOptionsContent = document.getElementById("bulk-options-content");
const weekdayCheckboxes = document.querySelectorAll(
  ".weekday-checkboxes input[type='checkbox'][data-day]",
);
const selectAllWeekdaysCheckbox = document.getElementById(
  "select-all-weekdays",
);
const unselectedOnlyCheckbox = document.getElementById("unselected-only");
const clearSelectedWeekdaysDatesButton = document.getElementById(
  "clear-selected-weekdays-dates",
);

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
// selectedDatesのtimeTypeを常に保持し、初期値は常にnullで、クリック時に初めてtimeTypeが設定される
let selectedDates = {}; // { "YYYY-MM-DD": { timeType: "all" | "day" | "night" | "none" } }
let selectedDatesHistory = []; // Undo機能のための履歴
let selectingRange = false; // 範囲選択中かどうか
let rangeStartDate = null; // 範囲選択の開始日
let isDragging = false; // ドラッグ中かどうかを追跡

let dayTimeStartHour = 13;
let dayTimeStartMinute = 0;
let dayTimeEndHour = 18;
let dayTimeEndMinute = 0;
let nightTimeStartHour = 21;
let nightTimeStartMinute = 0;
let nightTimeEndHour = 24; // デフォルトは24:00 (翌日00:00)
let nightTimeEndMinute = 0;



// 時間設定ボタンのイベントリスナー
optionsButton.addEventListener("click", () => {
  optionsPanel.classList.toggle("active");
  // トグル時に値を上書きしないように削除
});

// 時間設定適用ボタンのイベントリスナー
applyTimeSettingsButton.addEventListener("click", applyTimeSettings);

// 各inputタグの値が変更された際にも自動で適用する
[dayStartTimeInput, dayEndTimeInput, nightStartTimeInput, nightEndTimeInput].forEach(input => {
  input.addEventListener("change", applyTimeSettings);
});

function applyTimeSettings() {
  dayTimeStartHour = parseInt(dayStartTimeInput.value.split(":")[0], 10) || 0;
  dayTimeStartMinute = parseInt(dayStartTimeInput.value.split(":")[1], 10) || 0;
  dayTimeEndHour = parseInt(dayEndTimeInput.value.split(":")[0], 10) || 0;
  dayTimeEndMinute = parseInt(dayEndTimeInput.value.split(":")[1], 10) || 0;
  nightTimeStartHour = parseInt(nightStartTimeInput.value.split(":")[0], 10) || 0;
  nightTimeStartMinute = parseInt(nightStartTimeInput.value.split(":")[1], 10) || 0;

  let tempNightTimeEndHour = parseInt(nightEndTimeInput.value.split(":")[0], 10) || 0;
  let tempNightTimeEndMinute = parseInt(nightEndTimeInput.value.split(":")[1], 10) || 0;

  // 夜終了時刻が夜開始時刻より小さい場合は翌日と判断し、24を加算
  // Convert to total minutes for comparison
  let nightStartTotalMinutes = nightTimeStartHour * 60 + nightTimeStartMinute;
  let nightEndTotalMinutes = tempNightTimeEndHour * 60 + tempNightTimeEndMinute;

  if (nightEndTotalMinutes < nightStartTotalMinutes) {
    nightTimeEndHour = tempNightTimeEndHour + 24;
  } else {
    nightTimeEndHour = tempNightTimeEndHour;
  }
  nightTimeEndMinute = tempNightTimeEndMinute;

  // 時間の整合性チェック（例：開始時刻が終了時刻より前かなど）は省略

  updateSelectedDatesTextarea(); // 日程一覧を更新
  renderSelectedDatesList(); // リスト表示も更新
}

// 一括選択ボタンのイベントリスナー
bulkTimeButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    saveHistory(); // 変更前に履歴を保存
    const bulkType = event.target.dataset.bulkType;
    applyBulkTimeType(bulkType);
  });
});

function applyBulkTimeType(type) {
  Object.keys(selectedDates).forEach((dateString) => {
    if (selectedDates[dateString]) {
      selectedDates[dateString].timeType = type === "none" ? null : type;
    }
  });
  renderCalendar(); // カレンダー、テキストエリア、リスト表示を更新
}

// 一括入力ボタンのイベントリスナー
bulkOptionsToggle.addEventListener("click", () => {
  bulkOptionsContent.classList.toggle("active");
});

// 曜日「全て」チェックボックスのイベントリスナー
selectAllWeekdaysCheckbox.addEventListener("change", () => {
  weekdayCheckboxes.forEach((checkbox) => {
    checkbox.checked = selectAllWeekdaysCheckbox.checked;
  });
});

// 選択した曜日の日程をクリアボタンのイベントリスナー
clearSelectedWeekdaysDatesButton.addEventListener("click", () => {
  saveHistory(); // 変更前に履歴を保存
  applyBulkTimeType("none"); // 「×」ボタンと同じロジックでクリア
});

// applyBulkTimeType関数を修正
function applyBulkTimeType(type) {
  const selectedWeekdays = Array.from(weekdayCheckboxes)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => parseInt(checkbox.dataset.day));

  const applyToUnselectedOnly = unselectedOnlyCheckbox.checked;

  Object.keys(selectedDates).forEach((dateString) => {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay(); // 0:日, 1:月, ...

    // 曜日のフィルタリング
    // 選択された曜日がない場合、または選択された曜日に含まれる場合は処理を続行
    if (selectedWeekdays.length > 0 && !selectedWeekdays.includes(dayOfWeek)) {
      return; // 選択された曜日でなければスキップ
    }

    // 「未選択のみ」フィルタリング
    // 未選択のみがチェックされており、かつ既に選択されている場合はスキップ
    if (applyToUnselectedOnly && selectedDates[dateString].timeType !== null) {
      return; // 既に選択されている場合はスキップ
    }

    // 時間タイプを更新
    if (selectedDates[dateString]) {
      selectedDates[dateString].timeType = type === "none" ? null : type;
    }
  });
  renderCalendar(); // カレンダー、テキストエリア、リスト表示を更新
}

// カレンダーの描画
function renderCalendar() {
  calendarContainer.innerHTML = ""; // カレンダーをクリア

  const header = document.createElement("div");
  header.className = "calendar-header";
  header.innerHTML = `
    <button id="prev-month"><</button>
    <h2 id="current-month-year">${currentYear}年 ${currentMonth + 1}月</h2>
    <button id="next-month">></button>
  `;
  calendarContainer.appendChild(header);

  document.getElementById("prev-month").addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });

  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];
  const weekDaysHeader = document.createElement("div");
  weekDaysHeader.className = "weekdays";
  weekDays.forEach((day) => {
    const dayElement = document.createElement("div");
    dayElement.textContent = day;
    weekDaysHeader.appendChild(dayElement);
  });
  calendarContainer.appendChild(weekDaysHeader);

  const daysGrid = document.createElement("div");
  daysGrid.className = "days-grid";

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0:日, 1:月, ...
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 前月の日付を埋める
  for (let i = 0; i < firstDayOfMonth; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "empty-day";
    daysGrid.appendChild(emptyDay);
  }

  // 今月の日付を埋める
  for (let i = 1; i <= daysInMonth; i++) {
    const dayElement = document.createElement("div");
    dayElement.className = "day";
    dayElement.textContent = i;

    const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    dayElement.dataset.date = dateString;

    // selectedDatesに存在する日付は選択クラスを付与
      if (selectedDates[dateString]) {
        dayElement.classList.add("selected");
        // 範囲選択完了後のみ始点終点を表示
        // selectedDatesに存在するすべての日付を対象に始点終点を判断
        const sortedDates = Object.keys(selectedDates).sort();
        if (sortedDates.length > 0 && dateString === sortedDates[0]) {
          dayElement.classList.add("range-start");
        }
        if (sortedDates.length > 0 && dateString === sortedDates[sortedDates.length - 1]) {
          dayElement.classList.add("range-end");
        }
      }

    dayElement.addEventListener("mousedown", (event) => handleMouseDown(dateString, event));
    dayElement.addEventListener("mouseover", () => handleMouseOver(dateString));
    dayElement.addEventListener("mouseup", () => handleMouseUp(dateString));

    daysGrid.appendChild(dayElement);
  }

  calendarContainer.appendChild(daysGrid);
  updateSelectedDatesTextarea();
  renderSelectedDatesList(); // リスト表示を更新
}

// 選択された日付のリスト表示を生成・更新
function renderSelectedDatesList() {
  selectedDatesListContainer.innerHTML =
    '<h3>選択日程詳細</h3><ul class="selected-dates-list"></ul>';
  const selectedDatesList = selectedDatesListContainer.querySelector(
    ".selected-dates-list",
  );

  // 全ての日付をリストに表示
  let datesToDisplayInList = Object.keys(selectedDates);
  datesToDisplayInList.sort();

  if (datesToDisplayInList.length === 0) {
    selectedDatesListContainer.style.display = "none";
    return;
  }

  selectedDatesListContainer.style.display = "block";

  datesToDisplayInList.forEach((dateString) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1);
    const day = String(date.getDate());
    const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    const displayDate = `${month}/${day}（${dayOfWeek}）`;

    const listItem = document.createElement("li");
    listItem.className = "selected-date-item";
    listItem.innerHTML = `
      <span class="date-info">${displayDate}</span>
      <div class="time-type-select-buttons">
        <button class="time-type-button" data-time-type="all">全日</button>
        <button class="time-type-button" data-time-type="day">昼</button>
        <button class="time-type-button" data-time-type="night">夜</button>
      </div>
    `;

    const buttons = listItem.querySelectorAll(".time-type-button");
    const currentTimeType = selectedDates[dateString]
      ? selectedDates[dateString].timeType
      : null; // 初期値はnull

    buttons.forEach((button) => {
      // activeクラスの付与
      if (button.dataset.timeType === currentTimeType) {
        button.classList.add(`active-${currentTimeType}`);
      }
      button.addEventListener("click", (event) => {
        saveHistory();
        const newTimeType = event.target.dataset.timeType;
        // 選択中のものを再クリックで無選択にするロジック
        if (
          selectedDates[dateString] &&
          selectedDates[dateString].timeType === newTimeType
        ) {
          selectedDates[dateString].timeType = null; // 無選択状態
        } else {
          if (!selectedDates[dateString]) {
            selectedDates[dateString] = {};
          }
          selectedDates[dateString].timeType = newTimeType;
        }
        renderCalendar(); // カレンダー、テキストエリア、リスト表示を更新
      });
    });

    selectedDatesList.appendChild(listItem);
  });
}

let dragBaseState = null;

function handleMouseDown(dateString, event) {
  if (event.button === 0) {
    // 左クリックの場合のみ処理
    saveHistory();
    rangeStartDate = dateString;
    isDragging = false;
    dragBaseState = { ...selectedDates }; // ドラッグ開始前の状態を保存

    document.addEventListener("mousemove", handleMouseMove);
  }
}

function handleMouseMove(event) {
  if (rangeStartDate) {
    isDragging = true;
    const dateElements = document.querySelectorAll(".day[data-date]");
    dateElements.forEach((dayElement) => {
      const rect = dayElement.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        handleMouseOver(dayElement.dataset.date);
      }
    });
  }
}

function handleMouseOver(dateString) {
  if (rangeStartDate && isDragging && dragBaseState) {
    const start = new Date(rangeStartDate);
    const end = new Date(dateString);

    const [actualStart, actualEnd] = start <= end ? [start, end] : [end, start];

    // ベース状態を復元し、ドラッグ範囲を上書きする
    selectedDates = { ...dragBaseState };
    const targetState = dragBaseState[rangeStartDate] ? false : true; // 開始セルが選択されていれば解除、そうでなければ選択

    let currentDate = new Date(actualStart);
    while (currentDate <= actualEnd) {
      const yyyy = currentDate.getFullYear();
      const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
      const dd = String(currentDate.getDate()).padStart(2, "0");
      const currentDateString = `${yyyy}-${mm}-${dd}`;
      
      if (targetState) {
        if (!selectedDates[currentDateString]) {
          selectedDates[currentDateString] = { timeType: null };
        }
      } else {
        delete selectedDates[currentDateString];
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    renderCalendar();
  }
}

function handleMouseUp(dateString) {
  document.removeEventListener("mousemove", handleMouseMove);

  if (rangeStartDate) {
    if (!isDragging) {
      // シングルクリック時は選択状態をトグル
      if (selectedDates[dateString]) {
        delete selectedDates[dateString];
      } else {
        selectedDates[dateString] = { timeType: null };
      }
    }
    rangeStartDate = null;
    isDragging = false;
    dragBaseState = null;
    renderCalendar(); // 最終的な選択状態を反映
  }
}

// グローバルなmouseupイベントリスナーを追加して、カレンダー外でのドラッグ終了に対応
document.addEventListener("mouseup", () => {
  document.removeEventListener("mousemove", handleMouseMove);
  if (rangeStartDate) {
    rangeStartDate = null;
    isDragging = false;
    dragBaseState = null;
    renderCalendar();
  }
});

// 選択された日付をテキストエリアに表示
function updateSelectedDatesTextarea() {
  // 全ての日付を表示するため、フィルターはしない
  let datesToDisplay = Object.keys(selectedDates);
  datesToDisplay.sort(); // 常にソート

  let displayText = "";
  let lastMonth = "";
  let lastDay = "";
  let totalDays = 0; // すべての日付の合計
  let totalHours = 0;

  datesToDisplay.forEach((dateString) => {
    totalDays++; // 無選択の日付も含めて日数をカウント
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1);
    const day = String(date.getDate());
    const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];

    let currentDayPrefix = "";
    if (month !== lastMonth || day !== lastDay) {
      currentDayPrefix = `${month}/${day}（${dayOfWeek}）`;
      lastMonth = month;
      lastDay = day;
    } else {
      currentDayPrefix = "〃　　　　";
    }

    const timeConfig = selectedDates[dateString];
    let addedDayTime = false;

    // 時間設定がある日付のみを合計時間計算の対象とする
    if (
      timeConfig &&
      timeConfig.timeType !== null &&
      timeConfig.timeType !== "none"
    ) {
      if (timeConfig.timeType === "all" || timeConfig.timeType === "day") {
        displayText += `${currentDayPrefix} ${String(dayTimeStartHour).padStart(2, "0")}：${String(dayTimeStartMinute).padStart(2, "0")}～${String(dayTimeEndHour).padStart(2, "0")}：${String(dayTimeEndMinute).padStart(2, "0")}\n`;
        totalHours += (dayTimeEndHour + dayTimeEndMinute / 60) - (dayTimeStartHour + dayTimeStartMinute / 60);
        addedDayTime = true;
      }

      // 夜の時間帯が選択されている場合
      if (timeConfig.timeType === "all" || timeConfig.timeType === "night") {
        if (addedDayTime) {
          // 同じ日で昼の時間帯が既に追加されている場合
          displayText += `〃　　　　`;
        } else if (timeConfig.timeType === "night") {
          // 昼の時間帯が追加されておらず、夜の時間帯がその日の最初に追加される場合
          displayText += currentDayPrefix;
        }
        displayText += ` ${String(nightTimeStartHour).padStart(2, "0")}:${String(nightTimeStartMinute).padStart(2, "0")}～${String(nightTimeEndHour).padStart(2, "0")}:${String(nightTimeEndMinute).padStart(2, "0")}\n`;
        totalHours += (nightTimeEndHour + nightTimeEndMinute / 60) - (nightTimeStartHour + nightTimeStartMinute / 60);
      }
    } else {
      // timeType === null または timeType === 'none' の場合
      displayText += `${currentDayPrefix}\n`; // 時間設定がないのでブランク
    }
  });

  // 合計時間をテキストエリアの末尾に追加
  if (totalDays > 0) {
    displayText += `\n計${totalDays}日 ${totalHours}h`;
  }

  selectedDatesTextarea.value = displayText;
}

// コピーボタンのイベントリスナー
copyButton.addEventListener("click", () => {
  selectedDatesTextarea.select();
  document.execCommand("copy");
  alert("選択された日時をコピーしました！");
});

// 初期カレンダー描画
renderCalendar();

function saveHistory() { selectedDatesHistory.push(JSON.parse(JSON.stringify(selectedDates))); }
