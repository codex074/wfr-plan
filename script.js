// --- Global Constants and State ---
const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const fullThaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

// State for Auto Mode
let allCalculatedOptions = [];
let displayedOptionsCount = 0;
const OPTIONS_PER_PAGE = 10;
let selectedOption = -1;

// State for Manual Mode
let manualSchedule = [[], [], [], [], [], [], []];
let currentModalData = { dayIndex: null, mg: null };

// --- Utility Functions ---
function getThaiDayIndex(jsDay) {
    return jsDay === 0 ? 6 : jsDay - 1;
}

function roundToHalf(num) {
    const decimal = num % 1;
    const integer = Math.floor(num);
    if (decimal < 0.25) return integer;
    if (decimal < 0.75) return integer + 0.5;
    return integer + 1;
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const scheduleParam = urlParams.get('schedule');

    if (scheduleParam) {
        // Decompress the data from the URL
        const compressedSchedule = JSON.parse(decodeURIComponent(scheduleParam));
        const schedule = {
            dailyDoses: compressedSchedule.d,
            combos: compressedSchedule.c.map(dayCombo =>
                dayCombo.map(pill => ({
                    mg: pill.m,
                    count: pill.n,
                    half: pill.h,
                    quarter: pill.q
                }))
            )
        };

        const totalWeeklyDose = schedule.dailyDoses.reduce((sum, dose) => sum + dose, 0);

        const speechText = generateSpeechTextFromSchedule(schedule);
        const displayText = speechText.replace(/<[^>]*>/g, " ").replace(/\s+/g, ' ').trim();

        const requiredCss = `body{font-family:'Sarabun',sans-serif}.pill{width:28px;height:28px;border-radius:50%;display:inline-block;margin:2px;position:relative;border:1px solid #000;box-shadow:inset 0 1px 1px rgba(255,255,255,.5)}.pill-half-left{clip-path:polygon(0 0,50% 0,50% 100%,0 100%)}.pill-quarter-left{clip-path:polygon(50% 50%,50% 0,0 0,0 50%)}.pill-1mg{background-color:#fff}.pill-2mg{background-color:#ff8c42}.pill-3mg{background-color:#5bc0f8}.pill-4mg{background-color:#fcd34d}.pill-5mg{background-color:#f687b3}.day-card-header-0{background-color:#dc2626}.day-card-header-1{background-color:#f59e0b}.day-card-header-2{background-color:#ec4899}.day-card-header-3{background-color:#22c55e}.day-card-header-4{background-color:#ea580c}.day-card-header-5{background-color:#3b82f6}.day-card-header-6{background-color:#8b5cf6}`;
        const style = document.createElement('style');
        style.textContent = requiredCss;
        document.head.appendChild(style);

        let visualScheduleHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; width: 100%; max-width: 900px; margin-bottom: 2rem;">';
        for (let i = 0; i < 7; i++) {
            const dayIndex = i;
            const dose = schedule.dailyDoses[dayIndex];
            const combo = schedule.combos[dayIndex];
            const isDayOff = !dose || dose < 0.01;
            visualScheduleHtml += `
                <div style="border: 2px solid ${isDayOff ? '#fca5a5' : '#e5e7eb'}; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; text-align: center;">
                    <div class="day-card-header-${dayIndex}" style="font-weight: bold; padding: 0.75rem 0; font-size: 1.125rem; color: white;">${thaiDays[dayIndex]}</div>
                    <div style="background-color: ${isDayOff ? '#f9fafb' : 'white'}; padding: 1rem; min-height: 120px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        ${isDayOff
                            ? `<div style="font-size: 2.25rem; margin-bottom: 0.5rem;">🚫</div><div style="color: #dc2626; font-weight: bold; font-size: 0.875rem;">หยุดยา</div>`
                            : `<div style="font-size: 0.875rem; color: #374151; font-weight: 500; margin-bottom: 0.75rem;">${dose.toFixed(2)} mg</div><div>${(combo||[]).map(p=>Array(p.count||1).fill(`<span class="pill pill-${p.mg}mg ${p.quarter?'pill-quarter-left':p.half?'pill-half-left':''}"></span>`).join('')).join('')}</div>`
                        }
                    </div>
                </div>`;
        }
        visualScheduleHtml += '</div>';

        document.body.innerHTML = `
            <div id="speaker-view" style="font-family: 'Sarabun', sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; text-align: center; padding: 2em; background-color: #f0f9ff; color: #075985;">
                <h1 style="color: #0c4a6e; font-size: 1.8rem; font-weight: bold; margin-bottom: 0.5rem;">ตารางการทานยาวาร์ฟาริน</h1>
                <p style="font-size: 1.2rem; color: #075985; margin-bottom: 1.5rem; font-weight: 500;">ขนาดยารวม ${totalWeeklyDose.toFixed(2)} mg/สัปดาห์</p>
                ${visualScheduleHtml}
                <div id="instruction-text">
                    <h2 style="color: #0c4a6e; font-size: 1.5rem; margin-bottom: 1rem;">วิธีกินยา (สรุป)</h2>
                    <p style="font-size: 1.2rem; line-height: 1.8; max-width: 600px; margin-bottom: 2rem; text-align: left;">
                        ${displayText}
                    </p>
                </div>
                <button id="play-speech-btn" style="background-color: #0ea5e9; color: white; border: none; padding: 1rem 2rem; border-radius: 0.5rem; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                    <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-2.236 9.168-5.518"></path></svg>
                    แตะเพื่อฟังวิธีทานยา
                </button>
                 <div id="playing-status" style="display: none; margin-top: 1rem;">กำลังอ่าน...</div>
            </div>
        `;

        const playButton = document.getElementById('play-speech-btn');
        playButton.onclick = () => playTextWithGoogleTTS(speechText, playButton);
        return;
    }

    document.getElementById('mode-auto-btn').addEventListener('click', () => switchMode('auto'));
    document.getElementById('mode-manual-btn').addEventListener('click', () => switchMode('manual'));
    document.getElementById('modal-cancel-btn').addEventListener('click', hidePillModal);
    document.getElementById('pill-modal-form').addEventListener('submit', handleModalSubmit);
    initializeManualMode();
    switchMode('auto');
});

function switchMode(mode) {
    const autoContainer = document.getElementById('auto-mode-container');
    const manualContainer = document.getElementById('manual-mode-container');
    const autoBtn = document.getElementById('mode-auto-btn');
    const manualBtn = document.getElementById('mode-manual-btn');
    const printBtnAuto = document.getElementById('printBtnAuto');
    const dateCalculatorSection = document.getElementById('date-calculator-section');
    const autoPlaceholder = document.getElementById('date-calculator-placeholder-auto');
    const manualPlaceholder = document.getElementById('date-calculator-placeholder-manual');

    if (mode === 'auto') {
        autoContainer.classList.remove('hidden');
        manualContainer.classList.add('hidden');
        autoBtn.classList.add('active');
        manualBtn.classList.remove('active');
        updatePrintButtonVisibility();
        autoPlaceholder.appendChild(dateCalculatorSection);
    } else {
        autoContainer.classList.add('hidden');
        manualContainer.classList.remove('hidden');
        autoBtn.classList.remove('active');
        manualBtn.classList.add('active');
        printBtnAuto.classList.add('hidden');
        manualPlaceholder.appendChild(dateCalculatorSection);
    }
}

// ===================================================================================
//
//                              MANUAL MODE FUNCTIONS
//
// ===================================================================================
function initializeManualMode() {
    setupPillPalette();
    setupManualDayCards();
    updateManualSummary();
}

function setupPillPalette() {
    const palette = document.getElementById('pill-palette');
    palette.innerHTML = '';
    [5, 4, 3, 2, 1].forEach(mg => {
        const pillContainer = document.createElement('div');
        pillContainer.className = 'flex flex-col items-center draggable-pill';
        pillContainer.setAttribute('draggable', true);
        pillContainer.dataset.mg = mg;
        pillContainer.innerHTML = `<span class="pill pill-${mg}mg"></span><span class="text-xs font-medium mt-1">${mg} mg</span>`;
        pillContainer.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', mg));
        palette.appendChild(pillContainer);
    });
}

function setupManualDayCards() {
    const grid = document.getElementById('manual-schedule-grid');
    grid.innerHTML = '';
    const dayOrder = document.querySelector('input[name="dayOrder"]:checked').value;
    const startDay = dayOrder === 'sunday' ? 0 : 1;
    for (let i = 0; i < 7; i++) {
        const dayIndex = (startDay + i) % 7;
        const dayName = thaiDays[dayIndex];
        const headerColors = ['bg-red-600 text-white','bg-yellow-500 text-white','bg-pink-600 text-white','bg-green-600 text-white','bg-orange-600 text-white','bg-blue-600 text-white','bg-purple-600 text-white'];
        const dayCard = document.createElement('div');
        dayCard.className = 'drop-zone day-card border-2 border-gray-200 rounded-xl shadow-lg overflow-hidden min-h-[180px] flex flex-col';
        dayCard.dataset.dayIndex = dayIndex;
        dayCard.innerHTML = `<div class="font-bold text-center py-3 text-lg ${headerColors[dayIndex]}">${dayName}</div><div class="p-2 text-center bg-white flex-grow" id="manual-day-content-${dayIndex}"></div>`;
        dayCard.addEventListener('dragover', (e) => { e.preventDefault(); dayCard.classList.add('drag-over'); });
        dayCard.addEventListener('dragleave', () => dayCard.classList.remove('drag-over'));
        dayCard.addEventListener('drop', handleDrop);
        grid.appendChild(dayCard);
        renderManualDay(dayIndex);
    }
}

function handleDrop(e) {
    e.preventDefault();
    const dayCard = e.currentTarget;
    dayCard.classList.remove('drag-over');
    const dayIndex = parseInt(dayCard.dataset.dayIndex);
    const mg = parseInt(e.dataTransfer.getData('text/plain'));
    showPillModal(dayIndex, mg);
}

function showPillModal(dayIndex, mg) {
    currentModalData = { dayIndex, mg };
    document.getElementById('modal-title').innerText = `เพิ่มยา ${mg} mg`;
    document.getElementById('pill-quantity').value = 1;
    document.getElementById('fraction-full').checked = true;
    const modal = document.getElementById('pill-modal');
    modal.classList.add('flex');
    modal.classList.remove('hidden');
}

function hidePillModal() {
    const modal = document.getElementById('pill-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function handleModalSubmit(e) {
    e.preventDefault();
    const { dayIndex, mg } = currentModalData;
    const quantity = parseInt(document.getElementById('pill-quantity').value);
    const fraction = parseFloat(document.querySelector('input[name="fraction"]:checked').value);
    for (let i = 0; i < quantity; i++) {
        manualSchedule[dayIndex].push({ mg, count: 1, half: fraction === 0.5, quarter: fraction === 0.25 });
    }
    hidePillModal();
    renderManualDay(dayIndex);
    updateManualSummary();
}

function renderManualDay(dayIndex) {
    const dayContent = document.getElementById(`manual-day-content-${dayIndex}`);
    if (!dayContent) return;
    const pills = manualSchedule[dayIndex];
    const dailyDose = pills.reduce((sum, p) => sum + p.mg * p.count * (p.half ? 0.5 : p.quarter ? 0.25 : 1), 0);
    dayContent.innerHTML = `<div class="text-sm text-gray-800 font-bold mb-2">${dailyDose > 0 ? `${dailyDose.toFixed(2)} mg` : '0 mg'}</div>`;
    if (pills.length === 0) {
        dayContent.innerHTML += `<span class="text-gray-400 text-xs">วางยาที่นี่</span>`;
    } else {
        const pillsContainer = document.createElement('div');
        pillsContainer.className = 'flex flex-wrap justify-center gap-1 mt-1';
        pills.forEach((pill, i) => {
            const pillEl = document.createElement('span');
            pillEl.className = `pill pill-${pill.mg}mg ${pill.quarter ? 'pill-quarter-left' : ''} ${pill.half ? 'pill-half-left' : ''} cursor-pointer hover:opacity-75`;
            pillEl.title = `คลิกเพื่อลบ: ${pill.mg} mg ${pill.quarter ? '1/4' : pill.half ? '1/2' : 'เต็ม'} เม็ด`;
            pillEl.addEventListener('click', () => removePillFromManualDay(dayIndex, i));
            pillsContainer.appendChild(pillEl);
        });
        dayContent.appendChild(pillsContainer);
    }
}

function removePillFromManualDay(dayIndex, pillIndex) {
    manualSchedule[dayIndex].splice(pillIndex, 1);
    renderManualDay(dayIndex);
    updateManualSummary();
}

function updateManualSummary() {
    const summaryContainer = document.getElementById('manual-summary-container');
    const weeklyDoseContainer = document.getElementById('manual-weekly-dose-display');
    const dailyDoses = manualSchedule.map(pills => pills.reduce((sum, p) => sum + p.mg * p.count * (p.half ? 0.5 : p.quarter ? 0.25 : 1), 0));
    const totalWeeklyDose = dailyDoses.reduce((a, b) => a + b, 0);
    weeklyDoseContainer.innerHTML = `<div class="text-gray-600 text-sm">ขนาดยารวมต่อสัปดาห์</div><div class="text-3xl font-bold text-blue-600">${totalWeeklyDose.toFixed(2)} mg</div>`;
    const tempOption = { dailyDoses, combos: manualSchedule };
    const isDoseZero = totalWeeklyDose <= 0;
    let summaryHtml = `<div class="section-card rounded-lg shadow-md p-6 mt-6" id="manual-summary-card"><div class="flex justify-between items-center mb-4"><h3 class="text-xl font-semibold text-gray-800">สรุปและวิธีกินยา</h3><button id="printBtnManual" onclick="printManualSchedule()" class="no-print bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 shadow-md text-sm flex items-center ${isDoseZero ? 'hidden' : ''}"><svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg><span>พิมพ์</span></button></div>`;
    summaryHtml += totalWeeklyDose > 0 ? generateMedicationInstructions(tempOption) : `<div class="text-center text-gray-500 p-4">ยังไม่มีการจัดยา</div>`;
    summaryHtml += `</div>`;
    summaryContainer.innerHTML = summaryHtml;
}

function clearManualSchedule() {
    Swal.fire({ title: 'ยืนยันการล้างข้อมูล?', text: "ข้อมูลการจัดยาทั้งหมดจะถูกลบ", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'ใช่, ล้างทั้งหมด!', cancelButtonText: 'ยกเลิก' })
    .then((result) => {
        if (result.isConfirmed) {
            manualSchedule = [[], [], [], [], [], [], []];
            for (let i = 0; i < 7; i++) renderManualDay(i);
            updateManualSummary();
            Swal.fire('ล้างข้อมูลแล้ว!', 'คุณสามารถเริ่มจัดยาใหม่ได้เลย', 'success');
        }
    });
}

function printManualSchedule() {
    const totalWeeklyDose = manualSchedule.flat().reduce((sum, p) => sum + p.mg * (p.half ? 0.5 : p.quarter ? 0.25 : 1), 0);
    const printContainer = document.createElement('div');
    const dayGrid = document.getElementById('manual-schedule-grid');
    if (dayGrid) printContainer.appendChild(dayGrid.cloneNode(true));
    const summaryCard = document.getElementById('manual-summary-card');
    if (summaryCard) {
        const clonedSummary = summaryCard.cloneNode(true);
        clonedSummary.querySelector('.flex.justify-between')?.remove();
        printContainer.appendChild(clonedSummary);
    }
    printContent(printContainer, "ขนาดยาวาร์ฟาริน (Warfarin) ที่รับประทาน", `ขนาดยารวม ${totalWeeklyDose.toFixed(2)} mg/สัปดาห์`);
}

// ===================================================================================
//
//                              AUTO MODE FUNCTIONS
//
// ===================================================================================
const FLOAT_TOLERANCE = 0.01;

function adjustDose(percentage) {
    const previousDose = parseFloat(document.getElementById('previousDose').value) || 0;
    if (previousDose === 0) return;
    const newDose = previousDose * (1 + percentage / 100);
    document.getElementById('newDose').value = roundToHalf(newDose);
    calculateOptions();
}

function clearInputs() {
    document.getElementById('previousDose').value = '';
    document.getElementById('newDose').value = '';
    hideResults();
}

function hideResults() {
    document.getElementById('results').classList.add('hidden');
    document.getElementById('changeIndicator').classList.add('hidden');
    selectedOption = -1;
    allCalculatedOptions = [];
    displayedOptionsCount = 0;
    document.getElementById('optionsContainer').innerHTML = '';
    document.getElementById('showMoreContainer').innerHTML = '';
    updatePrintButtonVisibility();
}

function calculateOptions() {
    const newDose = parseFloat(document.getElementById('newDose').value);
    if (!newDose || newDose <= 0) {
        document.getElementById('newDose').focus();
        return;
    }
    document.getElementById('results').classList.remove('hidden');
    showChangeIndicator();
    generateOptions();
}

function showChangeIndicator() {
    const previousDose = parseFloat(document.getElementById('previousDose').value) || 0;
    const newDose = parseFloat(document.getElementById('newDose').value) || 0;
    const indicator = document.getElementById('changeIndicator');
    const changeText = document.getElementById('changeText');
    if (previousDose === 0) {
        indicator.classList.add('hidden');
        return;
    }
    const changePercent = ((newDose - previousDose) / previousDose) * 100;
    const changeMg = newDose - previousDose;
    indicator.classList.remove('hidden');
    if (Math.abs(changePercent) < 0.1) {
        changeText.innerHTML = `<div class="text-blue-600"><div class="text-3xl font-bold">คงที่ (0.0%)</div><div class="text-lg">${previousDose.toFixed(1)} → ${newDose.toFixed(1)} mg/wk</div></div>`;
    } else if (changePercent > 0) {
        changeText.innerHTML = `<div class="text-green-600"><div class="text-3xl font-bold">▲ increase ${changePercent.toFixed(1)}%</div><div class="text-lg">${previousDose.toFixed(1)} → ${newDose.toFixed(1)} mg/wk (+${changeMg.toFixed(1)} mg)</div></div>`;
    } else {
        changeText.innerHTML = `<div class="text-red-600"><div class="text-3xl font-bold">▼ decrease ${Math.abs(changePercent).toFixed(1)}%</div><div class="text-lg">${previousDose.toFixed(1)} → ${newDose.toFixed(1)} mg/wk (${changeMg.toFixed(1)} mg)</div></div>`;
    }
}

function findComb(target, availablePills, allowHalf, allowQuarter, minPillObjects = 1, maxPillObjects = 4) {
    if (Math.abs(target) < FLOAT_TOLERANCE) return [[]];
    const combinations = [];
    function backtrack(remaining, currentCombo, pillIndex, objectCount) {
        if (Math.abs(remaining) < FLOAT_TOLERANCE) {
            if (objectCount >= minPillObjects) {
                const aggregated = aggregateCombo(currentCombo);
                if (aggregated.length > 0) combinations.push(aggregated);
            }
            return;
        }
        if (pillIndex >= availablePills.length || objectCount >= maxPillObjects || remaining < -FLOAT_TOLERANCE) return;
        const pillMg = availablePills[pillIndex];
        const maxFullPills = Math.min(3, Math.floor((remaining + FLOAT_TOLERANCE) / pillMg));
        for (let count = 1; count <= maxFullPills; count++) {
            if (objectCount + count <= maxPillObjects) {
                currentCombo.push({ mg: pillMg, half: false, quarter: false, count: count });
                backtrack(remaining - pillMg * count, currentCombo, pillIndex + 1, objectCount + count);
                currentCombo.pop();
            }
        }
        if (allowHalf && objectCount < maxPillObjects) {
            const halfDose = pillMg / 2;
            if (remaining >= halfDose - FLOAT_TOLERANCE && !currentCombo.some(p => p.mg === pillMg && p.half)) {
                currentCombo.push({ mg: pillMg, half: true, quarter: false, count: 1 });
                backtrack(remaining - halfDose, currentCombo, pillIndex + 1, objectCount + 1);
                currentCombo.pop();
            }
        }
        if (allowQuarter && objectCount < maxPillObjects) {
            const quarterDose = pillMg / 4;
            if (remaining >= quarterDose - FLOAT_TOLERANCE && !currentCombo.some(p => p.mg === pillMg && p.quarter)) {
                currentCombo.push({ mg: pillMg, half: false, quarter: true, count: 1 });
                backtrack(remaining - quarterDose, currentCombo, pillIndex + 1, objectCount + 1);
                currentCombo.pop();
            }
        }
        backtrack(remaining, currentCombo, pillIndex + 1, objectCount);
    }
    backtrack(target, [], 0, 0);
    return filterAndOptimizeCombinations(combinations);
}

function aggregateCombo(combo) {
    if (!combo) return [];
    const aggregated = {};
    combo.forEach(pill => {
        const key = `${pill.mg}-${pill.half}-${pill.quarter}`;
        if (!aggregated[key]) aggregated[key] = { ...pill, count: 0 };
        aggregated[key].count += pill.count;
    });
    return Object.values(aggregated);
}

function filterAndOptimizeCombinations(combinations) {
    const uniqueCombos = new Set();
    return combinations.filter(combo => {
        const key = combo.map(p => `${p.mg}${p.quarter ? 'q' : p.half ? 'h' : 'f'}x${p.count}`).sort().join('|');
        if (uniqueCombos.has(key)) return false;
        uniqueCombos.add(key);
        return true;
    }).map(combo => combo.sort((a, b) => b.mg - a.mg));
}

function generateOptions() {
    const container = document.getElementById('optionsContainer');
    const showMoreContainer = document.getElementById('showMoreContainer');
    const weeklyDose = parseFloat(document.getElementById('newDose').value);
    const allowHalf = document.getElementById('allowHalf').checked;
    const allowQuarter = document.getElementById('allowQuarter').checked;
    const specialPattern = document.querySelector('input[name="specialDayPattern"]:checked').value;
    const availablePills = [5, 4, 3, 2, 1].filter(mg => document.getElementById(`pill${mg}mg`).checked);
    if (availablePills.length === 0) {
        container.innerHTML = '<div class="text-red-600 text-center p-4">กรุณาเลือกขนาดยาอย่างน้อย 1 ขนาด</div>';
        allCalculatedOptions = []; return;
    }
    const options = []; const optionKeys = new Set(); const dailyDoseTarget = weeklyDose / 7;
    findComb(dailyDoseTarget, availablePills, allowHalf, allowQuarter).forEach(combo => {
        if (combo.length > 0) {
            const dailyDoses = new Array(7).fill(dailyDoseTarget); const combos = new Array(7).fill(combo); const key = createOptionKey(combos);
            if (!optionKeys.has(key)) { optionKeys.add(key); options.push({ type: 'uniform', dailyDoses, combos, complexity: 0 }); }
        }
    });
    for (let skipDays = 0; skipDays <= 3; skipDays++) {
        for (let specialDays = 0; specialDays <= (3 - skipDays); specialDays++) {
            const normalDaysCount = 7 - skipDays - specialDays; if (normalDaysCount <= 0) continue;
            for (let baseDose = 0.5; baseDose <= 15; baseDose += 0.5) {
                const remainingDose = weeklyDose - baseDose * normalDaysCount; const normalCombos = findComb(baseDose, availablePills, allowHalf, allowQuarter);
                if (normalCombos.length === 0) continue;
                if (specialDays === 0) {
                    if (Math.abs(remainingDose) < FLOAT_TOLERANCE) {
                        normalCombos.forEach(nc => { const option = createNonUniformOption(baseDose, 0, nc, [], skipDays, specialDays, specialPattern); if (option) { const key = createOptionKey(option.combos); if (!optionKeys.has(key)) { optionKeys.add(key); options.push(option); } } });
                    }
                } else {
                    const specialDoseTarget = remainingDose / specialDays;
                    if (specialDoseTarget > 0 && Math.abs(specialDoseTarget - baseDose) > FLOAT_TOLERANCE && specialDoseTarget <= 15) {
                        const specialCombos = findComb(specialDoseTarget, availablePills, allowHalf, allowQuarter);
                        normalCombos.forEach(nc => specialCombos.forEach(sc => { const option = createNonUniformOption(baseDose, specialDoseTarget, nc, sc, skipDays, specialDays, specialPattern); if (option) { const key = createOptionKey(option.combos); if (!optionKeys.has(key)) { optionKeys.add(key); options.push(option); } } }));
                    }
                }
            }
        }
    }
    options.sort((a, b) => (countHalfPillTypes(a.combos) - countHalfPillTypes(b.combos)) || (a.type === 'uniform' ? -1 : 1) - (b.type === 'uniform' ? -1 : 1) || (a.complexity - b.complexity) || (countPillTypes(a.combos) - countPillTypes(b.combos)) || (countTotalObjects(a.combos) - countTotalObjects(b.combos)));
    allCalculatedOptions = options; displayedOptionsCount = 0; container.innerHTML = ''; showMoreContainer.innerHTML = '';
    if (allCalculatedOptions.length > 0) {
        container.innerHTML = `<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg no-print"><div class="text-blue-800 font-medium">พบตัวเลือกทั้งหมด ${allCalculatedOptions.length} แบบ</div></div>`;
        loadMoreOptions();
    } else {
        container.innerHTML = '<div class="text-gray-600 text-center p-4">ไม่พบตัวเลือกที่เหมาะสม</div>';
    }
}

function loadMoreOptions() {
    const container = document.getElementById('optionsContainer');
    const showMoreContainer = document.getElementById('showMoreContainer');
    const optionsToDisplay = allCalculatedOptions.slice(displayedOptionsCount, displayedOptionsCount + OPTIONS_PER_PAGE);
    optionsToDisplay.forEach((option, index) => container.insertAdjacentHTML('beforeend', generateOptionCard(option, displayedOptionsCount + index + 1)));
    displayedOptionsCount += optionsToDisplay.length;
    showMoreContainer.innerHTML = '';
    if (allCalculatedOptions.length > displayedOptionsCount) {
        const button = document.createElement('button');
        button.className = 'w-auto mx-auto px-6 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 shadow-md block no-print';
        button.innerHTML = "ตัวเลือกเพิ่มเติม";
        button.onclick = loadMoreOptions;
        showMoreContainer.appendChild(button);
    }
}

function createOptionKey(combos) {
    return combos.map(c => c.length === 0 ? 's' : c.map(p => `${p.mg}${p.half ? 'h' : p.quarter ? 'q' : 'f'}x${p.count}`).sort().join(',')).join('|');
}

function countHalfPillTypes(combos) {
    const halfTypes = new Set(); combos.flat().forEach(p => { if (p.half || p.quarter) halfTypes.add(p.mg); }); return halfTypes.size;
}

function createNonUniformOption(baseDose, specialDose, normalCombo, specialCombo, skipDays, specialDays, pattern) {
    const dailyDoses = new Array(7).fill(0), combos = new Array(7).fill([]);
    const specialDaysRef = (pattern === 'weekend') ? [0, 6, 5] : [5, 3, 1];
    const skipIndices = specialDaysRef.slice(0, skipDays); const specialIndices = specialDaysRef.slice(skipDays, skipDays + specialDays);
    for (let i = 0; i < 7; i++) {
        if (skipIndices.includes(i)) continue;
        if (specialIndices.includes(i)) { dailyDoses[i] = specialDose; combos[i] = specialCombo; } else { dailyDoses[i] = baseDose; combos[i] = normalCombo; }
    }
    return { type: 'non-uniform', dailyDoses, combos, complexity: skipDays + specialDays };
}

function countPillTypes(combos) { return new Set(combos.flat().map(p => p.mg)).size; }
function countTotalObjects(combos) { return combos.flat().reduce((sum, p) => sum + p.count, 0); }

function generateOptionCard(option, optionNumber) {
    const totalWeekly = option.dailyDoses.reduce((a, b) => a + b, 0); const dayOrder = document.querySelector('input[name="dayOrder"]:checked').value; const startDay = dayOrder === 'sunday' ? 0 : 1;
    let html = `<div class="option-card section-card rounded-lg shadow-md p-6 mb-6" id="option-card-${optionNumber - 1}" onclick="selectOption(${optionNumber - 1})" data-total-dose="${totalWeekly.toFixed(1)}"><div class="option-checkbox no-print" id="checkbox-${optionNumber - 1}"><span class="checkmark hidden">✓</span></div><h4 class="text-xl font-semibold mb-4 text-gray-800 pr-12">ตัวเลือกที่ ${optionNumber}</h4><div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-6">`;
    for (let i = 0; i < 7; i++) {
        const dayIndex = (startDay + i) % 7; const dose = option.dailyDoses[dayIndex]; const combo = option.combos[dayIndex]; const dayName = thaiDays[dayIndex]; const isDayOff = dose < FLOAT_TOLERANCE;
        const headerColors = ['bg-red-600 text-white','bg-yellow-500 text-white','bg-pink-600 text-white','bg-green-600 text-white','bg-orange-600 text-white','bg-blue-600 text-white','bg-purple-600 text-white'];
        html += `<div class="border-2 ${isDayOff ? 'border-red-300' : 'border-gray-200'} rounded-xl day-card shadow-lg overflow-hidden"><div class="font-bold text-center py-3 text-lg ${headerColors[dayIndex]}">${dayName}</div><div class="${isDayOff ? 'bg-gray-50' : 'bg-white'} p-4 text-center min-h-[100px] flex flex-col justify-center"><div class="text-sm text-gray-700 font-medium mb-3">${isDayOff ? '' : `${dose.toFixed(2)} mg`}</div>${isDayOff ? `<div class="text-center"><div class="text-4xl mb-2">🚫</div><div class="text-red-600 font-bold text-sm">หยุดยา</div></div>` : `<div class="text-center">${generatePillVisual(combo)}</div>`}</div></div>`;
    }
    html += `</div><div class="border-t pt-4">${generateMedicationInstructions(option)}</div></div>`; return html;
}

function generatePillVisual(combo) {
    return (combo || []).map(p => Array(p.count).fill(`<span class="pill pill-${p.mg}mg ${p.quarter ? 'pill-quarter-left' : (p.half ? 'pill-half-left' : '')}"></span>`).join('')).join('');
}

// ===================================================================================
//
//                              SHARED/COMMON FUNCTIONS
//
// ===================================================================================

async function playTextWithGoogleTTS(text, buttonElement) {
    const originalButtonContent = buttonElement.innerHTML;
    const functionUrl = 'https://asia-southeast1-leaveopd-90667.cloudfunctions.net/synthesizeSpeech';
    const statusDiv = document.getElementById('playing-status');

    try {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '🔄 กำลังโหลดเสียง...';
        if (statusDiv) statusDiv.style.display = 'block';

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ssml: text })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        
        buttonElement.innerHTML = '▶️ กำลังเล่น...';
        audio.play();

        audio.onended = () => {
            buttonElement.innerHTML = originalButtonContent;
            buttonElement.disabled = false;
            if (statusDiv) statusDiv.style.display = 'none';
        };

    } catch (error) {
        console.error('Failed to play speech:', error);
        alert('เกิดข้อผิดพลาด: ' + error.message);
        buttonElement.innerHTML = originalButtonContent;
        buttonElement.disabled = false;
        if (statusDiv) statusDiv.style.display = 'none';
    }
}


function generateSpeechTextFromSchedule(schedule) {
    let speechText = '';
    const medicationGroups = {};
    (schedule.combos || []).forEach((combo, dayIndex) => {
        (combo || []).forEach(pill => {
            const key = `${pill.mg}-${pill.half}-${pill.quarter}-${pill.count}`;
            if (!medicationGroups[key]) medicationGroups[key] = { ...pill, days: [] };
            medicationGroups[key].days.push(dayIndex);
        });
    });
    Object.values(medicationGroups).sort((a,b) => b.mg - a.mg).forEach(instr => {
        const { mg, half, quarter, count, days: instrDays } = instr;
        const pillText = quarter ? 'หนึ่งส่วนสี่เม็ด' : (half ? 'ครึ่งเม็ด' : `${count} เม็ด`);
        const dayText = formatDayGroups(groupConsecutiveDays(instrDays));
        const freq = instrDays.length;
        const line = freq === 7 ? `ยาขนาด ${mg} มิลลิกรัม ${getPillColorName(mg)} กิน ${pillText} ทุกวัน` : `ยาขนาด ${mg} มิลลิกรัม ${getPillColorName(mg)} กิน ${pillText} สัปดาห์ละ ${freq} ครั้ง เฉพาะ ${dayText}`;
        speechText += line + '. <break time="700ms"/> ';
    });
    return `<speak>${speechText}</speak>`;
}

function generateQrCodeAndSpeechButton(option, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelector('.qr-speech-wrapper')?.remove();
    const newWrapper = document.createElement('div');
    newWrapper.className = 'qr-speech-wrapper mt-4';
    const speechText = generateSpeechTextFromSchedule(option);

    const speechButton = document.createElement('button');
    speechButton.innerHTML = `<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-2.236 9.168-5.518"></path></svg><span>ฟังวิธีทานยา</span>`;
    speechButton.className = 'toggle-btn flex items-center justify-center no-print';
    speechButton.onclick = () => playTextWithGoogleTTS(speechText, speechButton);

    const qrContainer = document.createElement('div');
    qrContainer.className = 'text-center print-only';
    try {
        const compressedSchedule = {
            d: option.dailyDoses,
            c: option.combos.map(dayCombo =>
                dayCombo.map(pill => ({
                    m: pill.mg,
                    n: pill.count,
                    h: pill.half,
                    q: pill.quarter
                }))
            )
        };
        const encodedSchedule = encodeURIComponent(JSON.stringify(compressedSchedule));
        const baseUrl = window.location.href.split('?')[0].split('#')[0];
        const finalUrl = `${baseUrl}?schedule=${encodedSchedule}`;
        const qr = qrcode(0, 'L');
        qr.addData(finalUrl); qr.make();
        qrContainer.innerHTML = qr.createImgTag(5, 4);
        qrContainer.firstChild.className = 'mx-auto';
        qrContainer.innerHTML += '<p class="text-xs text-gray-600 mt-2">สแกน QR Code เพื่อฟังเสียง</p>';
    } catch (e) {
        console.error("QR Code generation failed:", e);
        qrContainer.innerHTML = '<p class="text-red-500 text-xs">ข้อมูลยาวเกินไป ไม่สามารถสร้าง QR Code ได้</p>';
    }

    newWrapper.appendChild(speechButton);
    newWrapper.appendChild(qrContainer);
    container.appendChild(newWrapper);
}

function getPillColorName(mg) {
    return {1: 'สีขาว', 2: 'สีส้ม', 3: 'สีฟ้า', 4: 'สีเหลือง', 5: 'สีชมพู'}[mg] || '';
}
function getPillBgColor(mg) {
    return {1: 'bg-gray-100 border-gray-300', 2: 'bg-orange-100 border-orange-300', 3: 'bg-blue-100 border-blue-300', 4: 'bg-yellow-100 border-yellow-300', 5: 'bg-pink-100 border-pink-300'}[mg] || 'bg-gray-100 border-gray-300';
}
function groupConsecutiveDays(days) {
    if (days.length === 0) return [];
    const sorted = [...days].sort((a, b) => a - b); const groups = []; let currentGroup = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i-1] + 1) { currentGroup.push(sorted[i]); }
        else { groups.push(currentGroup); currentGroup = [sorted[i]]; }
    }
    groups.push(currentGroup); return groups;
}
function formatDayGroups(dayGroups) {
    return dayGroups.map(group => group.length === 1 ? `วัน${fullThaiDays[group[0]]}` : `วัน${fullThaiDays[group[0]]} ถึง วัน${fullThaiDays[group[group.length - 1]]}`).join(', ');
}

function doseToPillText(totalDose, mg) {
    if (!mg || mg === 0) return '';
    const numPills = totalDose / mg;
    const fullPills = Math.floor(numPills);
    const remainder = numPills - fullPills;
    let parts = [];
    if (fullPills > 0) {
        parts.push(`${fullPills} เม็ด`);
    }
    if (Math.abs(remainder - 0.5) < 0.01) {
        parts.push('ครึ่ง');
    } else if (Math.abs(remainder - 0.25) < 0.01) {
        parts.push('หนึ่งส่วนสี่');
    } else if (Math.abs(remainder - 0.75) < 0.01) {
        parts.push('สามส่วนสี่');
    }
    let text = parts.join('');
    if (fullPills === 0 && remainder > 0.01) {
         text += 'เม็ด';
    }
    return text || '0 เม็ด';
}

function generateMedicationInstructions(option) {
    let days = 7, periodText = '1 สัปดาห์';
    if (document.getElementById('useDateRange').checked) {
        const start = new Date(document.getElementById('startDate').value), end = new Date(document.getElementById('endDate').value);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
            days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1; periodText = `${days} วัน`;
        }
    } else if (document.getElementById('useWeeks').checked) {
        const weeks = parseInt(document.getElementById('numberOfWeeks').value) || 1;
        days = weeks * 7; periodText = `${weeks} สัปดาห์`;
    }

    const medicationGroups = {};
    (option.combos || []).forEach((combo, dayIndex) => {
        (combo || []).forEach(pill => {
            const key = `${pill.mg}-${pill.half}-${pill.quarter}-${pill.count}`;
            if (!medicationGroups[key]) medicationGroups[key] = { ...pill, days: [] };
            medicationGroups[key].days.push(dayIndex);
        });
    });

    let html = '<div><h6 class="font-medium mb-3">วิธีกินยา:</h6><div class="flex flex-col gap-2">';
    if (Object.keys(medicationGroups).length === 0) {
        html += '<p class="text-gray-500">ไม่มีข้อมูล</p>';
    } else {
        const finalInstructions = {};
        Object.values(medicationGroups).forEach(instr => {
            const key = `${instr.mg}-${instr.days.sort().join(',')}`;
            if (!finalInstructions[key]) {
                finalInstructions[key] = {
                    mg: instr.mg,
                    days: instr.days,
                    totalDailyDose: 0,
                    originalInstructions: []
                };
            }
            finalInstructions[key].totalDailyDose += (instr.half ? 0.5 : instr.quarter ? 0.25 : 1) * instr.count * instr.mg;
            finalInstructions[key].originalInstructions.push(instr);
        });

        Object.values(finalInstructions).sort((a,b) => b.mg - a.mg).forEach(group => {
            const { mg, days: instrDays, totalDailyDose, originalInstructions } = group;
            const pillText = doseToPillText(totalDailyDose, mg);
            const dayText = formatDayGroups(groupConsecutiveDays(instrDays));
            const freq = instrDays.length;
            const instructionLineForDisplay = freq === 7 ? `${mg} mg (<strong>${getPillColorName(mg)}</strong>) กิน <strong>${pillText}</strong> ทุกวัน` : `${mg} mg (<strong>${getPillColorName(mg)}</strong>) กิน <strong>${pillText}</strong> สัปดาห์ละ ${freq} ครั้ง เฉพาะ <strong>${dayText}</strong>`;
            let totalPhysicalPillsNeeded = 0;
            const startDateValue = document.getElementById('startDate').value;
            const startDayOfWeek = startDateValue ? new Date(startDateValue).getDay() : new Date().getDay();
            originalInstructions.forEach(instr => {
                let totalInstances = 0;
                for (let d = 0; d < days; d++) {
                    if (instr.days.includes((startDayOfWeek + d) % 7)) totalInstances++;
                }
                totalPhysicalPillsNeeded += instr.quarter ? Math.ceil(totalInstances / 4) : (instr.half ? Math.ceil(totalInstances / 2) : totalInstances * instr.count);
            });
            const pillCountText = totalPhysicalPillsNeeded > 0 ? `${totalPhysicalPillsNeeded} เม็ด/${periodText}` : '';
            const singlePillIconInstr = { ...originalInstructions[0], count: 1 };
            const pillIconHtml = generatePillVisual([singlePillIconInstr]);
            html += `<div class="text-sm p-3 ${getPillBgColor(mg)} border rounded flex items-center"><div class="flex-shrink-0 w-10 flex justify-center items-center mr-3">${pillIconHtml}</div><div class="flex-grow flex justify-between items-center gap-2"><span class="flex-grow">${instructionLineForDisplay}</span><span class="text-xs text-gray-600 font-semibold flex-shrink-0 whitespace-nowrap">${pillCountText}</span></div></div>`;
        });
    }

    html += '</div></div>';
    const uniqueId = `qr-speech-container-${Date.now()}-${Math.random()}`;
    html += `<div id="${uniqueId}"></div>`;
    setTimeout(() => {
        if (Object.keys(medicationGroups).length > 0) {
            generateQrCodeAndSpeechButton(option, uniqueId);
        }
    }, 10);
    return html;
}

// --- UI Toggles & Actions ---
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('-translate-x-full'); document.getElementById('sidebarOverlay').classList.toggle('hidden'); }
function togglePill(pillSize) { document.getElementById(`pill${pillSize}Btn`).classList.toggle('active'); document.getElementById(`pill${pillSize}`).checked = !document.getElementById(`pill${pillSize}`).checked; hideResults(); setupPillPalette(); }
function toggleAllowHalf() { document.getElementById('allowHalfBtn').classList.toggle('active'); document.getElementById('allowHalf').checked = !document.getElementById('allowHalf').checked; hideResults(); }
function toggleAllowQuarter() { document.getElementById('allowQuarterBtn').classList.toggle('active'); document.getElementById('allowQuarter').checked = !document.getElementById('allowQuarter').checked; hideResults(); }
function setSpecialPattern(p) { document.getElementById('weekendBtn').classList.toggle('active', p==='weekend'); document.getElementById('mwfBtn').classList.toggle('active', p==='mwf'); document.querySelector(`input[name="specialDayPattern"][value="${p}"]`).checked = true; hideResults(); }
function setDayOrder(o) { document.getElementById('sundayBtn').classList.toggle('active', o==='sunday'); document.getElementById('mondayBtn').classList.toggle('active', o==='monday'); document.querySelector(`input[name="dayOrder"][value="${o}"]`).checked = true; hideResults(); setupManualDayCards(); }

function toggleDateRange() {
    const cb = document.getElementById('useDateRange'); cb.checked = !cb.checked;
    document.getElementById('useDateRangeBtn').classList.toggle('active', cb.checked);
    document.getElementById('dateRangeInputs').classList.toggle('hidden', !cb.checked);
    if (cb.checked) {
        document.getElementById('startDate').valueAsDate = new Date();
        document.getElementById('useWeeks').checked = false;
        document.getElementById('useWeeksBtn').classList.remove('active');
        document.getElementById('weeksInput').classList.add('hidden');
    }
    updateInstructionsOnDateChange();
}

function toggleWeeks() {
    const cb = document.getElementById('useWeeks'); cb.checked = !cb.checked;
    document.getElementById('useWeeksBtn').classList.toggle('active', cb.checked);
    document.getElementById('weeksInput').classList.toggle('hidden', !cb.checked);
    if (cb.checked) {
        document.getElementById('useDateRange').checked = false;
        document.getElementById('useDateRangeBtn').classList.remove('active');
        document.getElementById('dateRangeInputs').classList.add('hidden');
    }
    updateInstructionsOnDateChange();
}

function updateInstructionsOnDateChange() {
    const isManualMode = !document.getElementById('manual-mode-container').classList.contains('hidden');
    if (isManualMode) {
        updateManualSummary();
    } else if (selectedOption >= 0) {
        const selectedCard = document.getElementById(`option-card-${selectedOption}`);
        const summaryContainer = selectedCard.querySelector('.border-t.pt-4');
        if(summaryContainer) {
            summaryContainer.innerHTML = generateMedicationInstructions(allCalculatedOptions[selectedOption]);
        }
    }
}

function selectOption(optionIndex) {
    if (selectedOption >= 0) {
        document.getElementById(`option-card-${selectedOption}`)?.classList.remove('selected');
        const checkbox = document.getElementById(`checkbox-${selectedOption}`);
        if(checkbox) {
            checkbox.classList.remove('checked');
            checkbox.querySelector('.checkmark').classList.add('hidden');
        }
    }
    if (selectedOption === optionIndex) {
        selectedOption = -1;
    } else {
        selectedOption = optionIndex;
        const card = document.getElementById(`option-card-${optionIndex}`);
        card.classList.add('selected');
        const checkbox = document.getElementById(`checkbox-${optionIndex}`);
        checkbox.classList.add('checked');
        checkbox.querySelector('.checkmark').classList.remove('hidden');
    }
    updatePrintButtonVisibility();
}

function updatePrintButtonVisibility() {
    document.getElementById('printBtnAuto').classList.toggle('hidden', selectedOption < 0);
}

document.getElementById('previousDose').addEventListener('input', function() {
    document.getElementById('adjustmentButtons').classList.toggle('hidden', !(parseFloat(this.value) > 0));
});
['previousDose', 'newDose'].forEach(id => document.getElementById(id).addEventListener('input', hideResults));
['startDate', 'endDate', 'numberOfWeeks'].forEach(id => document.getElementById(id).addEventListener('input', updateInstructionsOnDateChange));

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

window.addEventListener('scroll', () => {
    const btn = document.getElementById('backToTopBtn');
    if (window.pageYOffset > 300) {
        btn.classList.remove('opacity-0', 'invisible');
    } else {
        btn.classList.add('opacity-0', 'invisible');
    }
});

function printSelectedOption() {
    if (selectedOption < 0) return;
    const selectedCard = document.getElementById(`option-card-${selectedOption}`);
    if (selectedCard) {
        printContent(selectedCard.cloneNode(true), "ขนาดยาวาร์ฟาริน (Warfarin) ที่รับประทาน", `ขนาดยารวม ${selectedCard.dataset.totalDose} mg/สัปดาห์`);
    }
}

function printContent(elementToPrint, title, subtitle) {
    const printDiv = document.createElement('div');
    printDiv.className = 'print-content';
    const header = document.createElement('div');
    header.className = 'print-header';
    header.innerHTML = `<div style="text-align: center; margin-bottom: 20px;"><img src="${document.getElementById('hospital-logo').src}" style="height: 60px; margin: 0 auto 10px;"><div class="print-title">${title}</div><div class="print-subtitle">${subtitle}</div><div style="font-size: 12px; margin-top: 5px;">วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>`;
    printDiv.appendChild(header);
    elementToPrint.querySelectorAll('.no-print').forEach(el => el.remove());
    elementToPrint.querySelector('h4')?.remove();
    printDiv.appendChild(elementToPrint);
    document.body.appendChild(printDiv);
    window.print();
    setTimeout(() => {
        document.body.removeChild(printDiv);
    }, 500);
}