// --- Global Constants and State ---
const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const fullThaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const dayColors = ['bg-red-100', 'bg-yellow-100', 'bg-pink-100', 'bg-green-100', 'bg-orange-100', 'bg-blue-100', 'bg-purple-100'];

// State for Auto Mode
let allCalculatedOptions = [];
let displayedOptionsCount = 0;
const OPTIONS_PER_PAGE = 10;
let selectedOption = -1;

// State for Manual Mode
let manualSchedule = [[], [], [], [], [], [], []]; // 7 days, each an array of pill objects
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
    // Mode Toggling
    document.getElementById('mode-auto-btn').addEventListener('click', () => switchMode('auto'));
    document.getElementById('mode-manual-btn').addEventListener('click', () => switchMode('manual'));

    // Manual Mode Modal Logic
    document.getElementById('modal-cancel-btn').addEventListener('click', hidePillModal);
    document.getElementById('pill-modal-form').addEventListener('submit', handleModalSubmit);

    // Initial setup
    initializeManualMode();
    switchMode('auto'); // Set initial mode and component position
});


function switchMode(mode) {
    const autoContainer = document.getElementById('auto-mode-container');
    const manualContainer = document.getElementById('manual-mode-container');
    const autoBtn = document.getElementById('mode-auto-btn');
    const manualBtn = document.getElementById('mode-manual-btn');
    const printBtn = document.getElementById('printBtn');
    
    const dateCalculatorSection = document.getElementById('date-calculator-section');
    const autoPlaceholder = document.getElementById('date-calculator-placeholder-auto');
    const manualPlaceholder = document.getElementById('date-calculator-placeholder-manual');

    if (mode === 'auto') {
        autoContainer.classList.remove('hidden');
        manualContainer.classList.add('hidden');
        autoBtn.classList.add('active');
        manualBtn.classList.remove('active');
        printBtn.onclick = printSelectedOption;
        updatePrintButtonVisibility();
        autoPlaceholder.appendChild(dateCalculatorSection);
    } else { // manual mode
        autoContainer.classList.add('hidden');
        manualContainer.classList.remove('hidden');
        autoBtn.classList.remove('active');
        manualBtn.classList.add('active');
        printBtn.onclick = printManualSchedule;
        updateManualPrintButtonVisibility();
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

        pillContainer.innerHTML = `
            <span class="pill pill-${mg}mg"></span>
            <span class="text-xs font-medium mt-1">${mg} mg</span>
        `;

        pillContainer.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', mg);
        });

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

        const headerColors = [
            'bg-red-600 text-white', 'bg-yellow-500 text-white', 'bg-pink-600 text-white',
            'bg-green-600 text-white', 'bg-orange-600 text-white', 'bg-blue-600 text-white', 'bg-purple-600 text-white'
        ];
        const headerColorClass = headerColors[dayIndex];

        const dayCard = document.createElement('div');
        dayCard.className = 'drop-zone day-card border-2 border-gray-200 rounded-xl shadow-lg overflow-hidden min-h-[180px] flex flex-col';
        dayCard.dataset.dayIndex = dayIndex;
        dayCard.innerHTML = `
            <div class="font-bold text-center py-3 text-lg ${headerColorClass}">${dayName}</div>
            <div class="p-2 text-center bg-white flex-grow" id="manual-day-content-${dayIndex}">
                </div>
        `;

        dayCard.addEventListener('dragover', (e) => { e.preventDefault(); dayCard.classList.add('drag-over'); });
        dayCard.addEventListener('dragleave', (e) => { dayCard.classList.remove('drag-over'); });
        dayCard.addEventListener('drop', handleDrop);
        grid.appendChild(dayCard);
        renderManualDay(dayIndex); // Initial render
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
    document.getElementById('pill-modal').classList.add('flex');
    document.getElementById('pill-modal').classList.remove('hidden');
}

function hidePillModal() {
    document.getElementById('pill-modal').classList.add('hidden');
    document.getElementById('pill-modal').classList.remove('flex');
}

function handleModalSubmit(e) {
    e.preventDefault();
    const { dayIndex, mg } = currentModalData;
    const quantity = parseInt(document.getElementById('pill-quantity').value);
    const fraction = parseFloat(document.querySelector('input[name="fraction"]:checked').value);

    for (let i = 0; i < quantity; i++) {
        const pillObject = {
            mg: mg,
            count: 1,
            half: fraction === 0.5,
            quarter: fraction === 0.25
        };
        manualSchedule[dayIndex].push(pillObject);
    }

    hidePillModal();
    renderManualDay(dayIndex);
    updateManualSummary();
}

function renderManualDay(dayIndex) {
    const dayContent = document.getElementById(`manual-day-content-${dayIndex}`);
    if (!dayContent) return;
    const pills = manualSchedule[dayIndex];
    
    const dailyDose = pills.reduce((sum, pill) => {
        let dose = pill.mg * pill.count;
        if (pill.half) dose /= 2;
        if (pill.quarter) dose /= 4;
        return sum + dose;
    }, 0);

    dayContent.innerHTML = '';

    const doseEl = document.createElement('div');
    doseEl.className = 'text-sm text-gray-800 font-bold mb-2';
    doseEl.textContent = dailyDose > 0 ? `${dailyDose.toFixed(2)} mg` : '0 mg';
    dayContent.appendChild(doseEl);

    if (pills.length === 0) {
        const placeholder = document.createElement('span');
        placeholder.className = 'text-gray-400 text-xs';
        placeholder.textContent = 'วางยาที่นี่';
        dayContent.appendChild(placeholder);
        return;
    }

    const pillsContainer = document.createElement('div');
    pillsContainer.className = 'flex flex-wrap justify-center gap-1 mt-1';

    pills.forEach((pill, pillIndex) => {
        const pillEl = document.createElement('span');
        pillEl.className = `pill pill-${pill.mg}mg ${pill.quarter ? 'pill-quarter-left' : ''} ${pill.half ? 'pill-half-left' : ''} cursor-pointer hover:opacity-75`;
        pillEl.title = `คลิกเพื่อลบ: ${pill.mg} mg ${pill.quarter ? '1/4' : pill.half ? '1/2' : 'เต็ม'} เม็ด`;
        pillEl.dataset.pillIndex = pillIndex;
        pillEl.addEventListener('click', () => removePillFromManualDay(dayIndex, pillIndex));
        pillsContainer.appendChild(pillEl);
    });

    dayContent.appendChild(pillsContainer);
}


function removePillFromManualDay(dayIndex, pillIndex) {
    manualSchedule[dayIndex].splice(pillIndex, 1);
    renderManualDay(dayIndex);
    updateManualSummary();
}

function updateManualSummary() {
    const summaryContainer = document.getElementById('manual-summary-container');
    const weeklyDoseContainer = document.getElementById('manual-weekly-dose-display');

    const dailyDoses = manualSchedule.map(dayPills => 
        dayPills.reduce((sum, pill) => {
            let dose = pill.mg * pill.count;
            if (pill.half) dose /= 2;
            if (pill.quarter) dose /= 4;
            return sum + dose;
        }, 0)
    );

    const totalWeeklyDose = dailyDoses.reduce((sum, dose) => sum + dose, 0);

    weeklyDoseContainer.innerHTML = `
        <div class="text-gray-600 text-sm">ขนาดยารวมต่อสัปดาห์</div>
        <div class="text-3xl font-bold text-blue-600">${totalWeeklyDose.toFixed(2)} mg</div>
    `;

    const tempOption = {
        dailyDoses: dailyDoses,
        combos: manualSchedule.map(dayPills => aggregateCombo(dayPills))
    };

    let summaryHtml = `
        <div class="section-card rounded-lg shadow-md p-6 mt-6" id="manual-summary-card">
             <h3 class="text-xl font-semibold mb-4 text-gray-800">สรุปและวิธีกินยา</h3>
    `;

    if (totalWeeklyDose > 0) {
        summaryHtml += generateMedicationInstructions(tempOption);
    } else {
        summaryHtml += `<div class="text-center text-gray-500 p-4">ยังไม่มีการจัดยา</div>`;
    }

    summaryHtml += `</div>`;
    summaryContainer.innerHTML = summaryHtml;
    updateManualPrintButtonVisibility();
}

function clearManualSchedule() {
    Swal.fire({
        title: 'ยืนยันการล้างข้อมูล?',
        text: "ข้อมูลการจัดยาทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ใช่, ล้างทั้งหมด!',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            manualSchedule = [[], [], [], [], [], [], []];
            for (let i = 0; i < 7; i++) {
                renderManualDay(i);
            }
            updateManualSummary();
            Swal.fire(
                'ล้างข้อมูลแล้ว!',
                'คุณสามารถเริ่มจัดยาใหม่ได้เลย',
                'success'
            )
        }
    })
}


function updateManualPrintButtonVisibility() {
    const printBtn = document.getElementById('printBtn');
    const totalDose = manualSchedule.flat().reduce((sum, p) => sum + (p.mg || 0), 0);

    if (totalDose > 0) {
        printBtn.classList.remove('opacity-0', 'invisible', 'translate-y-4');
    } else {
        printBtn.classList.add('opacity-0', 'invisible', 'translate-y-4');
    }
}

function printManualSchedule() {
    const totalWeeklyDose = manualSchedule.flat().reduce((sum, p) => {
        let dose = p.mg;
        if (p.half) dose /= 2;
        if (p.quarter) dose /= 4;
        return sum + dose;
    }, 0);

    const printContainer = document.createElement('div');
    
    const dayGrid = document.getElementById('manual-schedule-grid');
    if (dayGrid) {
        const clonedGrid = dayGrid.cloneNode(true);
        
        const dayCards = clonedGrid.querySelectorAll('.day-card');
        const borderColors = [
            'border-red-400', 'border-yellow-400', 'border-pink-400',
            'border-green-400', 'border-orange-400', 'border-blue-400', 'border-purple-400'
        ];
        
        dayCards.forEach(card => {
            const dayIndex = card.dataset.dayIndex;
            if (manualSchedule[dayIndex] && manualSchedule[dayIndex].length === 0) {
                card.classList.remove('border-gray-200');
                card.classList.add(borderColors[dayIndex]);
                
                const contentArea = card.querySelector(`#manual-day-content-${dayIndex}`);
                if (contentArea) {
                    contentArea.classList.remove('bg-white');
                    contentArea.classList.add('bg-gray-50');
                    contentArea.innerHTML = `<div class="flex flex-col justify-center items-center h-full pt-4">
                                                <div class="text-4xl mb-2">🚫</div>
                                                <div class="text-red-600 font-bold text-sm">หยุดยา</div>
                                           </div>`;
                }
            }
        });
        printContainer.appendChild(clonedGrid);
    }
    
    const summaryCard = document.getElementById('manual-summary-card');
    if (summaryCard) {
        const clonedSummary = summaryCard.cloneNode(true);
        const titleInSummary = clonedSummary.querySelector('h3');
        if (titleInSummary) titleInSummary.remove();
        printContainer.appendChild(clonedSummary);
    }
    
    printContent(printContainer, "ขนาดยาวาร์ฟาริน (Warfarin) ที่รับประทาน", `ขนาดยารวม ${totalWeeklyDose.toFixed(2)} mg/สัปดาห์`);
}

// ... The rest of the script.js file remains the same ...
// [I have omitted the rest of the file for brevity as there are no more changes]
// ... Just copy this new version over the existing script.js file ...

// ===================================================================================
//
//                              AUTO MODE FUNCTIONS
//
// ===================================================================================

const DOSE_MULTIPLIER_LIMIT = 2;
const ABSOLUTE_MAX_DAILY_DOSE = 15;
const FLOAT_TOLERANCE = 0.01;

function adjustDose(percentage) {
    const previousDose = parseFloat(document.getElementById('previousDose').value) || 0;
    if (previousDose === 0) return;
    
    const newDose = previousDose * (1 + percentage / 100);
    const roundedDose = roundToHalf(newDose);
    
    document.getElementById('newDose').value = roundedDose;
    
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
            if (remaining >= halfDose - FLOAT_TOLERANCE) {
                if (!currentCombo.some(p => p.mg === pillMg && p.half && !p.quarter)) {
                    currentCombo.push({ mg: pillMg, half: true, quarter: false, count: 1 });
                    backtrack(remaining - halfDose, currentCombo, pillIndex + 1, objectCount + 1);
                    currentCombo.pop();
                }
            }
        }
        
        if (allowQuarter && objectCount < maxPillObjects) {
            const quarterDose = pillMg / 4;
            if (remaining >= quarterDose - FLOAT_TOLERANCE) {
                if (!currentCombo.some(p => p.mg === pillMg && p.quarter)) {
                    currentCombo.push({ mg: pillMg, half: false, quarter: true, count: 1 });
                    backtrack(remaining - quarterDose, currentCombo, pillIndex + 1, objectCount + 1);
                    currentCombo.pop();
                }
            }
        }
        
        backtrack(remaining, currentCombo, pillIndex + 1, objectCount);
    }
    
    backtrack(target, [], 0, 0);
    return filterAndOptimizeCombinations(combinations, availablePills);
}

function aggregateCombo(combo) {
    if(!combo) return [];
    const aggregated = {};
    combo.forEach(pill => {
        const key = `${pill.mg}-${pill.half}-${pill.quarter}`;
        if (!aggregated[key]) aggregated[key] = { mg: pill.mg, half: pill.half, quarter: pill.quarter, count: 0 };
        aggregated[key].count += pill.count;
    });
    
    const result = [];
    Object.values(aggregated).forEach(pill => {
        if (pill.quarter && pill.count > 1) {
            const fullPills = Math.floor(pill.count / 4);
            const remQuarters = pill.count % 4;
            if (fullPills > 0) result.push({ mg: pill.mg, half: false, quarter: false, count: fullPills });
            if (remQuarters >= 2) {
                result.push({ mg: pill.mg, half: true, quarter: false, count: 1 });
                if (remQuarters === 3) result.push({ mg: pill.mg, half: false, quarter: true, count: 1 });
            } else if (remQuarters === 1) result.push({ mg: pill.mg, half: false, quarter: true, count: 1 });
        } else if (pill.half && pill.count > 1) {
            const fullPills = Math.floor(pill.count / 2);
            if (fullPills > 0) result.push({ mg: pill.mg, half: false, quarter: false, count: fullPills });
            if (pill.count % 2 > 0) result.push({ mg: pill.mg, half: true, quarter: false, count: 1 });
        } else {
            result.push(pill);
        }
    });
    return result;
}

function filterAndOptimizeCombinations(combinations, availablePills) {
    const uniqueCombos = new Set();
    const filtered = [];
    combinations.forEach(combo => {
        const key = combo.map(p => `${p.mg}${p.quarter ? 'q' : p.half ? 'h' : 'f'}x${p.count}`).sort().join('|');
        if (!uniqueCombos.has(key)) {
            uniqueCombos.add(key);
            filtered.push(optimizeCombination(combo, availablePills));
        }
    });
    return filtered;
}

function optimizeCombination(combo, availablePills) {
    return combo.sort((a,b) => b.mg - a.mg);
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
        allCalculatedOptions = [];
        return;
    }
    
    const options = [];
    const optionKeys = new Set();
    
    const dailyDoseTarget = weeklyDose / 7;
    findComb(dailyDoseTarget, availablePills, allowHalf, allowQuarter, 1, 4).forEach(combo => {
        if (combo.length > 0) {
            const dailyDoses = new Array(7).fill(dailyDoseTarget);
            const combos = new Array(7).fill(combo);
            const key = createOptionKey(combos);
            if (!optionKeys.has(key)) {
                optionKeys.add(key);
                options.push({ type: 'uniform', dailyDoses, combos, complexity: 0 });
            }
        }
    });
    
    for (let skipDays = 0; skipDays <= 3; skipDays++) {
        for (let specialDays = 0; specialDays <= (3 - skipDays); specialDays++) {
            const normalDaysCount = 7 - skipDays - specialDays;
            if (normalDaysCount <= 0) continue;
            
            for (let baseDose = 0.5; baseDose <= ABSOLUTE_MAX_DAILY_DOSE; baseDose += 0.5) {
                const remainingDose = weeklyDose - baseDose * normalDaysCount;
                const normalCombos = findComb(baseDose, availablePills, allowHalf, allowQuarter, 1, 4);
                if (normalCombos.length === 0) continue;
                
                if (specialDays === 0) {
                    if (Math.abs(remainingDose) < FLOAT_TOLERANCE) {
                        normalCombos.forEach(nc => {
                            const option = createNonUniformOption(baseDose, 0, nc, [], skipDays, specialDays, specialPattern);
                            if (option) {
                                const key = createOptionKey(option.combos);
                                if (!optionKeys.has(key)) { optionKeys.add(key); options.push(option); }
                            }
                        });
                    }
                } else {
                    const specialDoseTarget = remainingDose / specialDays;
                    if (specialDoseTarget > 0 && Math.abs(specialDoseTarget - baseDose) > FLOAT_TOLERANCE && specialDoseTarget <= ABSOLUTE_MAX_DAILY_DOSE) {
                        const specialCombos = findComb(specialDoseTarget, availablePills, allowHalf, allowQuarter, 1, 4);
                        normalCombos.forEach(nc => specialCombos.forEach(sc => {
                            const option = createNonUniformOption(baseDose, specialDoseTarget, nc, sc, skipDays, specialDays, specialPattern);
                            if (option) {
                                const key = createOptionKey(option.combos);
                                if (!optionKeys.has(key)) { optionKeys.add(key); options.push(option); }
                            }
                        }));
                    }
                }
            }
        }
    }
    
    options.sort((a, b) => {
        const aHalf = countHalfPillTypes(a.combos), bHalf = countHalfPillTypes(b.combos);
        if (aHalf !== bHalf) return aHalf - bHalf;
        if (a.type !== b.type) return a.type === 'uniform' ? -1 : 1;
        if (a.complexity !== b.complexity) return a.complexity - b.complexity;
        const aPillTypes = countPillTypes(a.combos), bPillTypes = countPillTypes(b.combos);
        if (aPillTypes !== bPillTypes) return aPillTypes - bPillTypes;
        return countTotalObjects(a.combos) - countTotalObjects(b.combos);
    });
    
    allCalculatedOptions = options;
    displayedOptionsCount = 0;
    container.innerHTML = '';
    showMoreContainer.innerHTML = '';

    if (allCalculatedOptions.length > 0) {
        container.innerHTML = `<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg"><div class="text-blue-800 font-medium">พบตัวเลือกทั้งหมด ${allCalculatedOptions.length} แบบ</div></div>`;
        loadMoreOptions();
    } else {
        container.innerHTML = '<div class="text-gray-600 text-center p-4">ไม่พบตัวเลือกที่เหมาะสม กรุณาปรับขนาดยาหรือเลือกเม็ดยาเพิ่มเติม</div>';
    }
}

function loadMoreOptions() {
    const container = document.getElementById('optionsContainer');
    const showMoreContainer = document.getElementById('showMoreContainer');
    const optionsToDisplay = allCalculatedOptions.slice(displayedOptionsCount, displayedOptionsCount + OPTIONS_PER_PAGE);

    optionsToDisplay.forEach((option, index) => {
        const optionNumber = displayedOptionsCount + index + 1;
        container.insertAdjacentHTML('beforeend', generateOptionCard(option, optionNumber));
    });
    displayedOptionsCount += optionsToDisplay.length;

    showMoreContainer.innerHTML = '';
    if (allCalculatedOptions.length > displayedOptionsCount) {
        const button = document.createElement('button');
        button.className = 'w-auto mx-auto px-6 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors shadow-md block';
        button.innerHTML = "ตัวเลือกเพิ่มเติม";
        button.onclick = loadMoreOptions;
        showMoreContainer.appendChild(button);
    }
}


function createOptionKey(combos) {
    return combos.map(combo => combo.length === 0 ? 'skip' : combo.map(p => `${p.mg}${p.half ? 'h' : 'f'}x${p.count}`).sort().join(',')).join('|');
}

function countHalfPillTypes(combos) {
    const halfTypes = new Set();
    combos.forEach(day => day.forEach(pill => { if (pill.half) halfTypes.add(pill.mg); }));
    return halfTypes.size;
}

function createNonUniformOption(baseDose, specialDose, normalCombo, specialCombo, skipDays, specialDays, pattern) {
    const dailyDoses = new Array(7).fill(0);
    const combos = new Array(7).fill([]);
    const specialDaysRef = (pattern === 'weekend') ? [0, 6, 5] : [5, 3, 1];
    const skipIndices = specialDaysRef.slice(0, skipDays);
    const specialIndices = specialDaysRef.slice(skipDays, skipDays + specialDays);
    
    for (let i = 0; i < 7; i++) {
        if (skipIndices.includes(i)) { /* skip */ }
        else if (specialIndices.includes(i)) { dailyDoses[i] = specialDose; combos[i] = specialCombo; }
        else { dailyDoses[i] = baseDose; combos[i] = normalCombo; }
    }
    
    return { type: 'non-uniform', dailyDoses, combos, complexity: skipDays + specialDays };
}

function countPillTypes(combos) {
    const types = new Set();
    combos.forEach(day => day.forEach(pill => types.add(pill.mg)));
    return types.size;
}

function countTotalObjects(combos) {
    return combos.flat().reduce((sum, pill) => sum + pill.count, 0);
}

function generateOptionCard(option, optionNumber) {
    const totalWeekly = option.dailyDoses.reduce((sum, dose) => sum + dose, 0);
    const dayOrder = document.querySelector('input[name="dayOrder"]:checked').value;
    const startDay = dayOrder === 'sunday' ? 0 : 1;
    let html = `<div class="option-card section-card rounded-lg shadow-md p-6 mb-6" id="option-card-${optionNumber - 1}" onclick="selectOption(${optionNumber - 1})" data-total-dose="${totalWeekly.toFixed(1)}">
        <div class="option-checkbox" id="checkbox-${optionNumber - 1}"><span class="checkmark hidden">✓</span></div>
        <h4 class="text-xl font-semibold mb-4 text-gray-800 pr-12">ตัวเลือกที่ ${optionNumber}</h4>
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-6">`;
    
    for (let i = 0; i < 7; i++) {
        const dayIndex = (startDay + i) % 7;
        const dose = option.dailyDoses[dayIndex];
        const combo = option.combos[dayIndex];
        const dayName = thaiDays[dayIndex];
        const isDayOff = dose < FLOAT_TOLERANCE;
        const headerColors = ['bg-red-600 text-white','bg-yellow-500 text-white','bg-pink-600 text-white','bg-green-600 text-white','bg-orange-600 text-white','bg-blue-600 text-white','bg-purple-600 text-white'];
        
        html += `<div class="border-2 ${isDayOff ? 'border-red-300' : 'border-gray-200'} rounded-xl day-card shadow-lg overflow-hidden">
            <div class="font-bold text-center py-3 text-lg ${headerColors[dayIndex]}">${dayName}</div>
            <div class="${isDayOff ? 'bg-gray-50' : 'bg-white'} p-4 text-center">
                <div class="text-sm text-gray-700 font-medium mb-3">${isDayOff ? '' : `${dose.toFixed(1)} mg`}</div>
                ${isDayOff ? `<div class="p-3 text-center"><div class="text-4xl mb-2">🚫</div><div class="text-red-600 font-bold text-sm">หยุดยา</div></div>` : `<div class="text-center"><div class="mb-3">${generatePillVisual(combo)}</div><div class="text-xs text-gray-700 font-medium">${generatePillText(combo)}</div></div>`}
            </div></div>`;
    }
    
    html += `</div><div class="border-t pt-4">${generateMedicationInstructions(option)}</div></div>`;
    return html;
}

function generatePillVisual(combo) {
    if (!combo || combo.length === 0) return '';
    return combo.map(pill => {
        let pillHtml = '';
        for (let i = 0; i < pill.count; i++) {
            const fractionClass = pill.quarter ? 'pill-quarter-left' : (pill.half ? 'pill-half-left' : '');
            pillHtml += `<span class="pill pill-${pill.mg}mg ${fractionClass}"></span>`;
        }
        return pillHtml;
    }).join('');
}


function generatePillText(combo) {
    if (!combo || combo.length === 0) return '';
    return combo.map(pill => {
        if (pill.quarter) return `${pill.mg} mg 1/4 เม็ด`;
        if (pill.half) return `${pill.mg} mg ครึ่งเม็ด`;
        return `${pill.mg} mg x${pill.count}`;
    }).join(', ');
}

// ===================================================================================
//
//                              SHARED/COMMON FUNCTIONS
//
// ===================================================================================

function getPillColorName(mg) {
    switch(mg) {
        case 1: return 'สีขาว'; case 2: return 'สีส้ม'; case 3: return 'สีฟ้า';
        case 4: return 'สีเหลือง'; case 5: return 'สีชมพู'; default: return '';
    }
}
function getPillBgColor(mg) {
    switch(mg) {
        case 1: return 'bg-gray-100 border-gray-300'; case 2: return 'bg-orange-100 border-orange-300';
        case 3: return 'bg-blue-100 border-blue-300'; case 4: return 'bg-yellow-100 border-yellow-300';
        case 5: return 'bg-pink-100 border-pink-300'; default: 'bg-gray-100 border-gray-300';
    }
}
function groupConsecutiveDays(days) {
    if (days.length === 0) return [];
    const sorted = [...days].sort((a, b) => a - b), groups = [];
    let currentGroup = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i-1] + 1) currentGroup.push(sorted[i]);
        else { groups.push(currentGroup); currentGroup = [sorted[i]]; }
    }
    groups.push(currentGroup);
    return groups;
}
function formatDayGroups(dayGroups) {
    return dayGroups.map(group => group.length === 1 ? `วัน${fullThaiDays[group[0]]}` : `วัน${fullThaiDays[group[0]]} ถึง วัน${fullThaiDays[group[group.length - 1]]}`).join(', ');
}

function generateMedicationInstructions(option) {
    let days = 7, periodText = '1 สัปดาห์';
    if (document.getElementById('useDateRange').checked) {
        const start = new Date(document.getElementById('startDate').value), end = new Date(document.getElementById('endDate').value);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) { 
            days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
            periodText = `${days} วัน`; 
        }
    } else if (document.getElementById('useWeeks').checked) {
        const weeks = parseInt(document.getElementById('numberOfWeeks').value) || 1;
        days = weeks * 7; periodText = `${weeks} สัปดาห์`;
    }

    const medicationGroups = {};
    (option.combos || []).forEach((combo, dayIndex) => {
        (combo || []).forEach(pill => {
            if (!medicationGroups[pill.mg]) medicationGroups[pill.mg] = {};
            const key = `${pill.half}-${pill.quarter}-${pill.count}`;
            if (!medicationGroups[pill.mg][key]) medicationGroups[pill.mg][key] = { ...pill, days: [] };
            medicationGroups[pill.mg][key].days.push(dayIndex);
        });
    });

    let html = '<div><h6 class="font-medium mb-3">วิธีกินยา:</h6><div class="flex flex-col gap-2">';
    const sortedMgs = Object.keys(medicationGroups).map(Number).sort((a, b) => b - a);

    if (sortedMgs.length === 0) {
        html += '<p class="text-gray-500">ไม่มีข้อมูล</p>';
    }

    sortedMgs.forEach(mg => {
        Object.values(medicationGroups[mg]).forEach(instr => {
            const { half, quarter, count, days: instrDays } = instr;
            const pillText = quarter ? 'หนึ่งส่วนสี่เม็ด' : (half ? 'ครึ่งเม็ด' : `${count} เม็ด`);
            const dayText = formatDayGroups(groupConsecutiveDays(instrDays));
            const freq = instrDays.length;
            const instructionLine = freq === 7 ? `${mg} mg (<strong>${getPillColorName(mg)}</strong>) กิน <strong>${pillText}</strong> ทุกวัน` :
                                               `${mg} mg (<strong>${getPillColorName(mg)}</strong>) กิน <strong>${pillText}</strong> สัปดาห์ละ ${freq} ครั้ง เฉพาะ <strong>${dayText}</strong>`;
            
            let totalInstances = 0;
            const startDateValue = document.getElementById('startDate').value;
            const startDayOfWeek = startDateValue ? new Date(startDateValue).getDay() : new Date().getDay();

            for (let d = 0; d < days; d++) {
                const currentDayOfWeek = (startDayOfWeek + d) % 7;
                if (instrDays.includes(currentDayOfWeek)) totalInstances++;
            }
            let physicalPillsNeeded = quarter ? Math.ceil(totalInstances / 4) : (half ? Math.ceil(totalInstances / 2) : totalInstances * count);
            const pillCountText = totalInstances > 0 ? `${physicalPillsNeeded} เม็ด/${periodText}` : '';
            
            const pillIconHtml = `<span class="pill pill-${mg}mg ${quarter ? 'pill-quarter-left':''} ${half ? 'pill-half-left':''}"></span>`;

            html += `<div class="text-sm p-3 ${getPillBgColor(mg)} border rounded flex items-center">
                <div class="flex-shrink-0 w-10 flex justify-center items-center mr-3">${pillIconHtml}</div>
                <div class="flex-grow flex justify-between items-center gap-2">
                    <span class="flex-grow">${instructionLine}</span>
                    <span class="text-xs text-gray-600 font-semibold flex-shrink-0 whitespace-nowrap">${pillCountText}</span>
                </div>
            </div>`;
        });
    });
    html += '</div></div>';
    return html;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
    document.body.style.overflow = sidebar.classList.contains('-translate-x-full') ? 'auto' : 'hidden';
}

function toggleAllowHalf() { document.getElementById('allowHalf').checked = !document.getElementById('allowHalf').checked; document.getElementById('allowHalfBtn').classList.toggle('active'); hideResults(); }
function toggleAllowQuarter() { document.getElementById('allowQuarter').checked = !document.getElementById('allowQuarter').checked; document.getElementById('allowQuarterBtn').classList.toggle('active'); hideResults(); }
function togglePill(pillSize) { document.getElementById(`pill${pillSize}`).checked = !document.getElementById(`pill${pillSize}`).checked; document.getElementById(`pill${pillSize}Btn`).classList.toggle('active'); hideResults(); setupPillPalette(); }
function setSpecialPattern(p) { document.querySelector(`input[name="specialDayPattern"][value="${p}"]`).checked = true; document.getElementById('weekendBtn').classList.toggle('active', p==='weekend'); document.getElementById('mwfBtn').classList.toggle('active', p==='mwf'); hideResults(); }
function setDayOrder(o) { document.querySelector(`input[name="dayOrder"][value="${o}"]`).checked = true; document.getElementById('sundayBtn').classList.toggle('active', o==='sunday'); document.getElementById('mondayBtn').classList.toggle('active', o==='monday'); hideResults(); setupManualDayCards(); }

function toggleDateRange() {
    const cb = document.getElementById('useDateRange');
    cb.checked = !cb.checked;
    document.getElementById('useDateRangeBtn').classList.toggle('active', cb.checked);
    document.getElementById('dateRangeInputs').classList.toggle('hidden', !cb.checked);
    if (cb.checked) {
        document.getElementById('startDate').valueAsDate = new Date();
        document.getElementById('useWeeks').checked = false;
        document.getElementById('useWeeksBtn').classList.remove('active');
        document.getElementById('weeksInput').classList.add('hidden');
    }
    document.getElementById('startDate').dispatchEvent(new Event('input'));
}

function toggleWeeks() {
    const cb = document.getElementById('useWeeks');
    cb.checked = !cb.checked;
    document.getElementById('useWeeksBtn').classList.toggle('active', cb.checked);
    document.getElementById('weeksInput').classList.toggle('hidden', !cb.checked);
    if (cb.checked) {
        document.getElementById('useDateRange').checked = false;
        document.getElementById('useDateRangeBtn').classList.remove('active');
        document.getElementById('dateRangeInputs').classList.add('hidden');
    }
    document.getElementById('numberOfWeeks').dispatchEvent(new Event('input'));
}


function selectOption(optionIndex) {
    if (selectedOption === optionIndex) { // Deselect
        document.getElementById(`option-card-${optionIndex}`).classList.remove('selected');
        document.getElementById(`checkbox-${optionIndex}`).classList.remove('checked');
        document.getElementById(`checkbox-${optionIndex}`).querySelector('.checkmark').classList.add('hidden');
        selectedOption = -1;
    } else { // Select new
        if (selectedOption >= 0) { // Deselect old
            const oldCard = document.getElementById(`option-card-${selectedOption}`);
            if(oldCard) {
                oldCard.classList.remove('selected');
                document.getElementById(`checkbox-${selectedOption}`).classList.remove('checked');
                document.getElementById(`checkbox-${selectedOption}`).querySelector('.checkmark').classList.remove('hidden');
            }
        }
        selectedOption = optionIndex;
        document.getElementById(`option-card-${optionIndex}`).classList.add('selected');
        document.getElementById(`checkbox-${optionIndex}`).classList.add('checked');
        document.getElementById(`checkbox-${optionIndex}`).querySelector('.checkmark').classList.remove('hidden');
    }
    updatePrintButtonVisibility();
}

function updatePrintButtonVisibility() {
    const printBtn = document.getElementById('printBtn');
    if (window.pageYOffset > 300 && selectedOption >= 0) {
        printBtn.classList.remove('opacity-0', 'invisible', 'translate-y-4');
    } else {
        printBtn.classList.add('opacity-0', 'invisible', 'translate-y-4');
    }
}

// --- Event Listeners ---
document.getElementById('previousDose').addEventListener('input', function() {
    document.getElementById('adjustmentButtons').classList.toggle('hidden', !(parseFloat(this.value) > 0));
});
['previousDose', 'newDose'].forEach(id => document.getElementById(id).addEventListener('input', hideResults));
['startDate', 'endDate', 'numberOfWeeks'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        const isManualMode = !document.getElementById('manual-mode-container').classList.contains('hidden');
        if (isManualMode) {
            updateManualSummary();
        } else if (allCalculatedOptions.length > 0 && selectedOption >= 0) {
            const selectedCard = document.getElementById(`option-card-${selectedOption}`);
            const summaryContainer = selectedCard.querySelector('.border-t.pt-4');
            if(summaryContainer) {
                summaryContainer.innerHTML = generateMedicationInstructions(allCalculatedOptions[selectedOption]);
            }
        }
    });
});

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
window.addEventListener('scroll', function() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    const isManualMode = !document.getElementById('manual-mode-container').classList.contains('hidden');
    
    if (window.pageYOffset > 300) {
        backToTopBtn.classList.remove('opacity-0', 'invisible', 'translate-y-4');
        if (isManualMode) updateManualPrintButtonVisibility();
        else updatePrintButtonVisibility();
    } else {
        backToTopBtn.classList.add('opacity-0', 'invisible', 'translate-y-4');
        document.getElementById('printBtn').classList.add('opacity-0', 'invisible', 'translate-y-4');
    }
});


function printSelectedOption() {
    if (selectedOption < 0) return;
    const selectedCard = document.getElementById(`option-card-${selectedOption}`);
    if (!selectedCard) return;
    
    printContent(selectedCard.cloneNode(true), "ขนาดยาวาร์ฟาริน (Warfarin) ที่รับประทาน", `ขนาดยารวม ${selectedCard.dataset.totalDose} mg/สัปดาห์`);
}

function printContent(elementToPrint, title, subtitle) {
    const printDiv = document.createElement('div');
    printDiv.className = 'print-content';
    const header = document.createElement('div');
    header.className = 'print-header';
    header.innerHTML = `
        <div style="position: relative; text-align: center; padding-bottom: 10px;">
            <div style="position: absolute; top: 0; left: 0; font-size: 14px;">วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH')}</div>
            <div class="print-title" style="padding-top: 25px;">${title}</div>
            <div class="print-subtitle">${subtitle}</div>
        </div>`;
    printDiv.appendChild(header);

    const checkbox = elementToPrint.querySelector('.option-checkbox');
    if (checkbox) checkbox.remove();
    const titleInCard = elementToPrint.querySelector('h4');
    if (titleInCard) titleInCard.remove();
    
    printDiv.appendChild(elementToPrint);
    document.body.appendChild(printDiv);
    window.print();
    setTimeout(() => document.body.removeChild(printDiv), 500);
}