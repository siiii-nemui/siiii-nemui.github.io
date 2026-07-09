let dayTimeStartHour = 13;
let dayTimeStartMinute = 30; // user changed to 30
let dayTimeEndHour = 18;
let dayTimeEndMinute = 0;

let selectedDates = { '2026-07-15': { timeType: 'day' } };

let datesToDisplay = Object.keys(selectedDates);
let displayText = '';
datesToDisplay.forEach(dateString => {
    let currentDayPrefix = '7/15';
    displayText += `${currentDayPrefix} ${String(dayTimeStartHour).padStart(2, '0')}：${String(dayTimeStartMinute).padStart(2, '0')}～${String(dayTimeEndHour).padStart(2, '0')}：${String(dayTimeEndMinute).padStart(2, '0')}\n`;
});
console.log(displayText);