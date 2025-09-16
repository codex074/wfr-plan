const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const dayColors = ['bg-red-100', 'bg-yellow-100', 'bg-pink-100', 'bg-green-100', 'bg-orange-100', 'bg-blue-100', 'bg-purple-100'];

let allCalculatedOptions = [];
let displayedOptionsCount = 0;
const OPTIONS_PER_PAGE = 10;

// --- Existing App Functions ---

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
    document.getElementById('summaryContainer').classList.add('hidden');
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
        changeText.innerHTML = `
            <div class="text-blue-600">
                <div class="text-3xl font-bold">คงที่ (0.0%)</div>
                <div class="text-lg">${previousDose.toFixed(1)} → ${newDose.toFixed(1)} mg/wk</div>
            </div>
        `;
    } else if (changePercent > 0) {
        changeText.innerHTML = `
            <div class="text-green-600">
                <div class="text-3xl font-bold">▲ increase ${changePercent.toFixed(1)}%</div>
                <div class="text-lg">${previousDose.toFixed(1)} → ${newDose.toFixed(1)} mg/wk (+${changeMg.toFixed(1)} mg)</div>
            </div>
        `;
    } else {
        changeText.innerHTML = `
            <div class="text-red-600">
                <div class="text-3xl font-bold">▼ decrease ${Math.abs(changePercent).toFixed(1)}%</div>
                <div class="text-lg">${previousDose.toFixed(1)} → ${newDose.toFixed(1)} mg/wk (${changeMg.toFixed(1)} mg)</div>
            </div>
        `;
    }
}

const DOSE_MULTIPLIER_LIMIT = 2;
const ABSOLUTE_MAX_DAILY_DOSE = 15;
const FLOAT_TOLERANCE = 0.01;

const fullThaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function findComb(target, availablePills, allowHalf, allowQuarter, minPillObjects = 1, maxPillObjects = 4) {
    if (Math.abs(target) < FLOAT_TOLERANCE) {
        return [[]];
    }

    const combinations = [];
    
    function backtrack(remaining, currentCombo, pillIndex, objectCount) {
        if (Math.abs(remaining) < FLOAT_TOLERANCE) {
            if (objectCount >= minPillObjects) {
                const aggregated = aggregateCombo(currentCombo);
                if (aggregated.length > 0) {
                    combinations.push(aggregated);
                }
            }
            return;
        }
        
        if (pillIndex >= availablePills.length || objectCount >= maxPillObjects || remaining < -FLOAT_TOLERANCE) {
            return;
        }
        
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
                const hasHalfOfThisSize = currentCombo.some(pill => pill.mg === pillMg && pill.half && !pill.quarter);
                if (!hasHalfOfThisSize) {
                    currentCombo.push({ mg: pillMg, half: true, quarter: false, count: 1 });
                    backtrack(remaining - halfDose, currentCombo, pillIndex + 1, objectCount + 1);
                    currentCombo.pop();
                }
            }
        }
        
        if (allowQuarter && objectCount < maxPillObjects) {
            const quarterDose = pillMg / 4;
            if (remaining >= quarterDose - FLOAT_TOLERANCE) {
                const hasQuarterOfThisSize = currentCombo.some(pill => pill.mg === pillMg && pill.quarter);
                if (!hasQuarterOfThisSize) {
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
    const aggregated = {};
    
    combo.forEach(pill => {
        const key = `${pill.mg}-${pill.half}-${pill.quarter}`;
        if (!aggregated[key]) {
            aggregated[key] = { mg: pill.mg, half: pill.half, quarter: pill.quarter, count: 0 };
        }
        aggregated[key].count += pill.count;
    });
    
    const result = [];
    Object.values(aggregated).forEach(pill => {
        if (pill.quarter && pill.count > 1) {
            const fullPills = Math.floor(pill.count / 4);
            const remainingQuarters = pill.count % 4;
            
            if (fullPills > 0) {
                result.push({ mg: pill.mg, half: false, quarter: false, count: fullPills });
            }
            if (remainingQuarters >= 2) {
                result.push({ mg: pill.mg, half: true, quarter: false, count: 1 });
                if (remainingQuarters === 3) {
                    result.push({ mg: pill.mg, half: false, quarter: true, count: 1 });
                }
            } else if (remainingQuarters === 1) {
                result.push({ mg: pill.mg, half: false, quarter: true, count: 1 });
            }
        } else if (pill.half && pill.count > 1) {
            const fullPills = Math.floor(pill.count / 2);
            const remainingHalf = pill.count % 2;
            
            if (fullPills > 0) {
                result.push({ mg: pill.mg, half: false, quarter: false, count: fullPills });
            }
            if (remainingHalf > 0) {
                result.push({ mg: pill.mg, half: true, quarter: false, count: 1 });
            }
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
        const key = combo
            .map(pill => `${pill.mg}${pill.quarter ? 'q' : pill.half ? 'h' : 'f'}x${pill.count}`)
            .sort()
            .join('|');
        
        if (!uniqueCombos.has(key)) {
            uniqueCombos.add(key);
            const optimized = optimizeCombination(combo, availablePills);
            filtered.push(optimized);
        }
    });
    
    return filtered;
}

function optimizeCombination(combo, availablePills) {
    const optimized = [...combo];
    let changed = true;
    
    while (changed) {
        changed = false;
        
        for (let i = 0; i < optimized.length; i++) {
            const pill = optimized[i];
            if (pill.half || pill.quarter) continue;
            
            for (const largePillMg of availablePills) {
                if (largePillMg <= pill.mg) continue;
                
                const totalMg = pill.mg * pill.count;
                if (totalMg % largePillMg === 0) {
                    const newCount = totalMg / largePillMg;
                    if (newCount <= 3) {
                        optimized[i] = { mg: largePillMg, half: false, quarter: false, count: newCount };
                        changed = true;
                        break;
                    }
                }
            }
            
            if (changed) break;
        }
        
        for (let i = 0; i < optimized.length - 1; i++) {
            for (let j = i + 1; j < optimized.length; j++) {
                const pill1 = optimized[i];
                const pill2 = optimized[j];
                
                if (pill1.mg === pill2.mg && !pill1.half && !pill2.half && !pill1.quarter && !pill2.quarter) {
                    const totalMg = pill1.mg * (pill1.count + pill2.count);
                    
                    for (const largePillMg of availablePills) {
                        if (largePillMg <= pill1.mg) continue;
                        
                        if (totalMg % largePillMg === 0) {
                            const newCount = totalMg / largePillMg;
                            if (newCount <= 3) {
                                optimized[i] = { mg: largePillMg, half: false, quarter: false, count: newCount };
                                optimized.splice(j, 1);
                                changed = true;
                                break;
                            }
                        }
                        
                        if (changed) break;
                    }
                    
                    if (changed) break;
                }
            }
            if (changed) break;
        }
        
        for (let i = 0; i < optimized.length - 1; i++) {
            for (let j = i + 1; j < optimized.length; j++) {
                const pill1 = optimized[i];
                const pill2 = optimized[j];
                
                if (pill1.half || pill2.half) continue;
                
                const totalMg = (pill1.mg * pill1.count) + (pill2.mg * pill2.count);
                
                for (const largePillMg of availablePills) {
                    if (largePillMg <= Math.max(pill1.mg, pill2.mg)) continue;
                    
                    if (totalMg % largePillMg === 0) {
                        const newCount = totalMg / largePillMg;
                        if (newCount <= 3) {
                            optimized[i] = { mg: largePillMg, half: false, count: newCount };
                            optimized.splice(j, 1);
                            changed = true;
                            break;
                        }
                    }
                }
                
                if (changed) break;
            }
            if (changed) break;
        }
        
        if (!changed) {
            for (let i = 0; i < optimized.length - 2; i++) {
                for (let j = i + 1; j < optimized.length - 1; j++) {
                    for (let k = j + 1; k < optimized.length; k++) {
                        const pill1 = optimized[i];
                        const pill2 = optimized[j];
                        const pill3 = optimized[k];
                        
                        if (pill1.half || pill2.half || pill3.half) continue;
                        
                        const totalMg = (pill1.mg * pill1.count) + (pill2.mg * pill2.count) + (pill3.mg * pill3.count);
                        
                        for (const largePillMg of availablePills) {
                            if (largePillMg <= Math.max(pill1.mg, pill2.mg, pill3.mg)) continue;
                            
                            if (totalMg % largePillMg === 0) {
                                const newCount = totalMg / largePillMg;
                                if (newCount <= 3) {
                                    optimized[i] = { mg: largePillMg, half: false, count: newCount };
                                    optimized.splice(k, 1);
                                    optimized.splice(j, 1);
                                    changed = true;
                                    break;
                                }
                            }
                        }
                        
                        if (changed) break;
                    }
                    if (changed) break;
                }
                if (changed) break;
            }
        }
    }
    
    optimized.sort((a, b) => {
        if (a.mg !== b.mg) return b.mg - a.mg;
        if (a.half !== b.half) return a.half ? 1 : -1;
        return 0;
    });
    
    return optimized;
}

function generateOptions() {
    const container = document.getElementById('optionsContainer');
    const showMoreContainer = document.getElementById('showMoreContainer');
    const weeklyDose = parseFloat(document.getElementById('newDose').value);
    const allowHalf = document.getElementById('allowHalf').checked;
    const allowQuarter = document.getElementById('allowQuarter').checked;
    const specialPattern = document.querySelector('input[name="specialDayPattern"]:checked').value;
    
    const availablePills = [];
    [5, 4, 3, 2, 1].forEach(mg => {
        if (document.getElementById(`pill${mg}mg`).checked) {
            availablePills.push(mg);
        }
    });
    
    if (availablePills.length === 0) {
        container.innerHTML = '<div class="text-red-600 text-center p-4">กรุณาเลือกขนาดยาอย่างน้อย 1 ขนาด</div>';
        allCalculatedOptions = [];
        return;
    }
    
    const options = [];
    const optionKeys = new Set();
    
    const dailyDoseTarget = weeklyDose / 7;
    const uniformCombos = findComb(dailyDoseTarget, availablePills, allowHalf, allowQuarter, 1, 4);
    
    uniformCombos.forEach(combo => {
        if (combo.length > 0) {
            const dailyDoses = new Array(7).fill(dailyDoseTarget);
            const combos = new Array(7).fill(combo);
            
            const optionKey = createOptionKey(combos);
            if (!optionKeys.has(optionKey)) {
                optionKeys.add(optionKey);
                options.push({
                    type: 'uniform',
                    description: `ทุกวัน วันละ ${dailyDoseTarget.toFixed(1)} mg`,
                    dailyDoses: dailyDoses,
                    combos: combos,
                    complexity: 0
                });
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
                        normalCombos.forEach(normalCombo => {
                            const option = createNonUniformOption(
                                baseDose, 0, normalCombo, [], 
                                skipDays, specialDays, specialPattern
                            );
                            if (option) {
                                const optionKey = createOptionKey(option.combos);
                                if (!optionKeys.has(optionKey)) {
                                    optionKeys.add(optionKey);
                                    options.push(option);
                                }
                            }
                        });
                    }
                } else {
                    const specialDayDoseTarget = remainingDose / specialDays;
                    
                    if (specialDayDoseTarget > 0 && 
                        Math.abs(specialDayDoseTarget - baseDose) > FLOAT_TOLERANCE &&
                        specialDayDoseTarget <= ABSOLUTE_MAX_DAILY_DOSE &&
                        specialDayDoseTarget <= baseDose * DOSE_MULTIPLIER_LIMIT) {
                        
                        const specialCombos = findComb(specialDayDoseTarget, availablePills, allowHalf, allowQuarter, 1, 4);
                        
                        normalCombos.forEach(normalCombo => {
                            specialCombos.forEach(specialCombo => {
                                const option = createNonUniformOption(
                                    baseDose, specialDayDoseTarget, 
                                    normalCombo, specialCombo, 
                                    skipDays, specialDays, specialPattern
                                );
                                if (option) {
                                    const optionKey = createOptionKey(option.combos);
                                    if (!optionKeys.has(optionKey)) {
                                        optionKeys.add(optionKey);
                                        options.push(option);
                                    }
                                }
                            });
                        });
                    }
                }
            }
        }
    }
    
    options.sort((a, b) => {
        const aHalfTypes = countHalfPillTypes(a.combos);
        const bHalfTypes = countHalfPillTypes(b.combos);
        if (aHalfTypes !== bHalfTypes) return aHalfTypes - bHalfTypes;
        
        if (a.type !== b.type) return a.type === 'uniform' ? -1 : 1;
        
        if (a.complexity !== b.complexity) return a.complexity - b.complexity;
        
        const aPillTypes = countPillTypes(a.combos);
        const bPillTypes = countPillTypes(b.combos);
        if (aPillTypes !== bPillTypes) return aPillTypes - bPillTypes;
        
        const aTotalObjects = countTotalObjects(a.combos);
        const bTotalObjects = countTotalObjects(b.combos);
        if (aTotalObjects !== bTotalObjects) return aTotalObjects - bTotalObjects;
        
        return 0;
    });
    
    allCalculatedOptions = options;
    displayedOptionsCount = 0;
    container.innerHTML = '';
    showMoreContainer.innerHTML = '';

    if (allCalculatedOptions.length > 0) {
         const infoBox = `<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div class="text-blue-800 font-medium">พบตัวเลือกทั้งหมด ${allCalculatedOptions.length} แบบ</div>
        </div>`;
        container.innerHTML = infoBox;
        loadMoreOptions();
    } else {
         container.innerHTML = '<div class="text-gray-600 text-center p-4">ไม่พบตัวเลือกที่เหมาะสม กรุณาปรับขนาดยาหรือเลือกเม็ดยาเพิ่มเติม</div>';
    }
}

function loadMoreOptions() {
    const container = document.getElementById('optionsContainer');
    const showMoreContainer = document.getElementById('showMoreContainer');
    
    const optionsToDisplay = allCalculatedOptions.slice(displayedOptionsCount, displayedOptionsCount + OPTIONS_PER_PAGE);

    let html = '';
    optionsToDisplay.forEach((option, index) => {
        const optionNumber = displayedOptionsCount + index + 1;
        html += generateOptionCard(option, optionNumber);
    });
    container.insertAdjacentHTML('beforeend', html);
    displayedOptionsCount += optionsToDisplay.length;

    showMoreContainer.innerHTML = '';
    if (allCalculatedOptions.length > displayedOptionsCount) {
        const remaining = allCalculatedOptions.length - displayedOptionsCount;
        const button = document.createElement('button');
        button.className = 'w-auto mx-auto px-6 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors shadow-md block';
        button.innerHTML = "ตัวเลือกเพิ่มเติม";
        button.onclick = loadMoreOptions;
        showMoreContainer.appendChild(button);
    }
}

function createOptionKey(combos) {
    return combos.map(combo => {
        if (combo.length === 0) return 'skip';
        return combo
            .map(pill => `${pill.mg}${pill.half ? 'h' : 'f'}x${pill.count}`)
            .sort()
            .join(',');
    }).join('|');
}

function countHalfPillTypes(combos) {
    const halfTypes = new Set();
    combos.forEach(combo => {
        combo.forEach(pill => {
            if (pill.half) {
                halfTypes.add(pill.mg);
            }
        });
    });
    return halfTypes.size;
}

function createNonUniformOption(baseDose, specialDose, normalCombo, specialCombo, skipDays, specialDays, pattern) {
    const dailyDoses = new Array(7).fill(0);
    const combos = new Array(7).fill([]);
    
    let skipIndices = [];
    let specialIndices = [];
    
    if (pattern === 'weekend') {
        const weekendDays = [0, 6, 5];
        skipIndices = weekendDays.slice(0, skipDays);
        specialIndices = weekendDays.slice(skipDays, skipDays + specialDays);
    } else {
        const mwfDays = [5, 3, 1];
        skipIndices = mwfDays.slice(0, skipDays);
        specialIndices = weekendDays.slice(skipDays, skipDays + specialDays);
    }
    
    for (let i = 0; i < 7; i++) {
        if (skipIndices.includes(i)) {
            dailyDoses[i] = 0;
            combos[i] = [];
        } else if (specialIndices.includes(i)) {
            dailyDoses[i] = specialDose;
            combos[i] = specialCombo;
        } else {
            dailyDoses[i] = baseDose;
            combos[i] = normalCombo;
        }
    }
    
    let description = '';
    if (skipDays > 0) {
        description += `หยุดยา ${skipDays} วัน `;
    }
    if (specialDays > 0) {
        description += `วันพิเศษ ${specialDays} วัน (${specialDose.toFixed(1)} mg) `;
    }
    description += `วันธรรมดา (${baseDose.toFixed(1)} mg)`;
    
    return {
        type: 'non-uniform',
        description: description,
        dailyDoses: dailyDoses,
        combos: combos,
        complexity: skipDays + specialDays
    };
}

function countHalves(combos) {
    let count = 0;
    combos.forEach(combo => {
        combo.forEach(pill => {
            if (pill.half) count += pill.count;
        });
    });
    return count;
}

function countPillTypes(combos) {
    const types = new Set();
    combos.forEach(combo => {
        combo.forEach(pill => {
            types.add(pill.mg);
        });
    });
    return types.size;
}

function countTotalObjects(combos) {
    let count = 0;
    combos.forEach(combo => {
        combo.forEach(pill => {
            count += pill.count;
        });
    });
    return count;
}

function generateOptionCard(option, optionNumber) {
    const totalWeekly = option.dailyDoses.reduce((sum, dose) => sum + dose, 0);
    const dayOrder = document.querySelector('input[name="dayOrder"]:checked').value;
    const startDay = dayOrder === 'sunday' ? 0 : 1;
    
    let html = `
        <div class="option-card section-card rounded-lg shadow-md p-6 mb-6" id="option-card-${optionNumber - 1}" onclick="selectOption(${optionNumber - 1})" data-total-dose="${totalWeekly.toFixed(1)}">
            <div class="option-checkbox" id="checkbox-${optionNumber - 1}">
                <span class="checkmark hidden">✓</span>
            </div>
            <h4 class="text-xl font-semibold mb-4 text-gray-800 pr-12">ตัวเลือกที่ ${optionNumber}</h4>
            <div class="grid grid-cols-4 md:grid-cols-7 gap-3 mb-6">
    `;
    
    for (let i = 0; i < 7; i++) {
        const dayIndex = (startDay + i) % 7;
        const dose = option.dailyDoses[dayIndex];
        const combo = option.combos[dayIndex];
        const dayName = thaiDays[dayIndex];
        const isDayOff = dose === 0;
        
        // สีเข้มสำหรับหัวข้อวัน
        const headerColors = [
            'bg-red-600 text-white',      // อาทิตย์
            'bg-yellow-500 text-white',   // จันทร์
            'bg-pink-600 text-white',     // อังคาร
            'bg-green-600 text-white',    // พุธ
            'bg-orange-600 text-white',   // พฤหัสบดี
            'bg-blue-600 text-white',     // ศุกร์
            'bg-purple-600 text-white'    // เสาร์
        ];
        const headerColorClass = headerColors[dayIndex];
        
        html += `
            <div class="border-2 ${isDayOff ? 'border-red-300' : 'border-gray-200'} rounded-xl day-card shadow-lg overflow-hidden">
                <div class="font-bold text-center py-3 text-lg ${headerColorClass}">
                    ${dayName}
                </div>
                <div class="${isDayOff ? 'bg-gray-50' : 'bg-white'} p-4 text-center">
                    <div class="text-sm text-gray-700 font-medium mb-3">
                        ${isDayOff ? '' : `${dose.toFixed(1)} mg`}
                    </div>
        `;
        
        if (isDayOff) {
            html += `<div class="p-3 text-center"><div class="text-4xl mb-2">🚫</div><div class="text-red-600 font-bold text-sm">หยุดยา</div></div>`;
        } else {
            html += `<div class="text-center"><div class="mb-3">${generatePillVisual(combo)}</div><div class="text-xs text-gray-700 font-medium">${generatePillText(combo)}</div></div>`;
        }
        
        html += `</div></div>`;
    }
    
    html += `</div>${generateMedicationSummary(option, optionNumber)}</div>`;
    
    return html;
}

function generatePillVisual(combo) {
    if (!combo || combo.length === 0) return '';
    
    let html = '';
    combo.forEach(pill => {
        for (let i = 0; i < pill.count; i++) {
            if (pill.quarter) {
                html += `<span class="pill pill-${pill.mg}mg pill-quarter-left" title="${pill.mg} mg หนึ่งส่วนสี่เม็ด"></span>`;
            } else if (pill.half) {
                html += `<span class="pill pill-${pill.mg}mg pill-half-left" title="${pill.mg} mg ครึ่งเม็ด"></span>`;
            } else {
                html += `<span class="pill pill-${pill.mg}mg" title="${pill.mg} mg เต็มเม็ด"></span>`;
            }
        }
    });
    return html;
}

function generatePillText(combo) {
    if (!combo || combo.length === 0) return '';
    
    const texts = [];
    combo.forEach(pill => {
        if (pill.quarter) {
            texts.push(`${pill.mg} mg 1/4 เม็ด`);
        } else if (pill.half) {
            texts.push(`${pill.mg} mg ครึ่งเม็ด`);
        } else if (pill.count === 1) {
            texts.push(`${pill.mg} mg x1`);
        } else {
            texts.push(`${pill.mg} mg x${pill.count}`);
        }
    });
    return texts.join(', ');
}

function generateMedicationSummary(option, optionNumber) {
    const useDateRange = document.getElementById('useDateRange').checked;
    const useWeeks = document.getElementById('useWeeks').checked;
    
    let days = 7;
    let periodText = '1 สัปดาห์';
    
    if (useDateRange) {
        const startDate = new Date(document.getElementById('startDate').value);
        const endDate = new Date(document.getElementById('endDate').value);
        if (!isNaN(startDate) && !isNaN(endDate) && endDate > startDate) {
            days = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
            periodText = `${days} วัน`;
        }
    } else if (useWeeks) {
        const weeks = parseInt(document.getElementById('numberOfWeeks').value) || 1;
        days = weeks * 7;
        periodText = `${weeks} สัปดาห์`;
    }
    
    return `<div class="border-t pt-4">${generateMedicationInstructions(option, days, periodText)}</div>`;
}

function generateMedicationInstructions(option, days, periodText) {
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
            case 5: return 'bg-pink-100 border-pink-300'; default: return 'bg-gray-100 border-gray-300';
        }
    }
    
    function groupConsecutiveDays(days) {
        if (days.length === 0) return [];
        const sortedDays = [...days].sort((a, b) => a - b);
        const groups = [];
        let currentGroup = [sortedDays[0]];
        for (let i = 1; i < sortedDays.length; i++) {
            if (sortedDays[i] === sortedDays[i-1] + 1) {
                currentGroup.push(sortedDays[i]);
            } else {
                groups.push(currentGroup);
                currentGroup = [sortedDays[i]];
            }
        }
        groups.push(currentGroup);
        return groups;
    }
    
    function formatDayGroups(dayGroups) {
        return dayGroups.map(group => {
            if (group.length === 1) return `วัน${fullThaiDays[group[0]]}`;
            
            // Handle wrapping around from Saturday (6) to Sunday (0)
            const dayOrder = document.querySelector('input[name="dayOrder"]:checked').value;
            if (dayOrder === 'sunday' && group[0] === 0 && group[group.length-1] === 6) {
                 // This case shouldn't happen with correct grouping, but as a safeguard
                 return `วันอาทิตย์ ถึง วันเสาร์`;
            }

            return `วัน${fullThaiDays[group[0]]} ถึง วัน${fullThaiDays[group[group.length - 1]]}`;
        }).join(', ');
    }

    const medicationGroups = {};
    option.combos.forEach((combo, dayIndex) => {
        // Force aggregation of the daily combo array to handle cases
        // where it might contain duplicate pill definitions (e.g., two '4mg x1' instead of one '4mg x2').
        const dailyAggregatedCombo = aggregateCombo(combo);

        dailyAggregatedCombo.forEach(pill => {
            const mg = pill.mg;
            if (!medicationGroups[mg]) medicationGroups[mg] = {};
            const pillKey = pill.quarter ? 'quarter' : (pill.half ? 'half' : pill.count);
            if (!medicationGroups[mg][pillKey]) {
                medicationGroups[mg][pillKey] = { mg: pill.mg, half: pill.half, quarter: pill.quarter, count: pill.count, days: [] };
            }
            medicationGroups[mg][pillKey].days.push(dayIndex);
        });
    });

    let html = '<div><h6 class="font-medium mb-3">วิธีกินยา:</h6><div class="flex flex-col gap-2">';

    const allInstructions = [];
    const sortedMgs = Object.keys(medicationGroups).map(Number).sort((a, b) => b - a);
    sortedMgs.forEach(mg => {
        const mgGroup = medicationGroups[mg];
        const sortedPillKeys = Object.keys(mgGroup).sort((a, b) => {
            if (a === 'quarter') return -1; if (b === 'quarter') return 1;
            if (a === 'half') return -1; if (b === 'half') return 1;
            return Number(a) - Number(b);
        });
        sortedPillKeys.forEach(pillKey => allInstructions.push(mgGroup[pillKey]));
    });

    allInstructions.forEach(instruction => {
        const { mg, half, quarter, count, days: instructionDays } = instruction;
        
        const pillColor = getPillColorName(mg);
        const pillText = quarter ? 'หนึ่งส่วนสี่เม็ด' : (half ? 'ครึ่งเม็ด' : `${count} เม็ด`);
        const frequency = instructionDays.length;
        const dayText = formatDayGroups(groupConsecutiveDays(instructionDays));
        const bgColor = getPillBgColor(mg);
        let instructionLine = frequency === 7 ? `${mg} mg (<strong>${pillColor}</strong>) กิน <strong>${pillText}</strong> ทุกวัน` :
                                               `${mg} mg (<strong>${pillColor}</strong>) กิน <strong>${pillText}</strong> สัปดาห์ละ ${frequency} ครั้ง เฉพาะ <strong>${dayText}</strong>`;
        let pillCountText = '';
        let totalInstances = 0;
        for (let d = 0; d < days; d++) if (instructionDays.includes(d % 7)) totalInstances++;

        if (totalInstances > 0) {
            let physicalPillsNeeded = quarter ? Math.ceil(totalInstances / 4) : (half ? Math.ceil(totalInstances / 2) : totalInstances * count);
            pillCountText = `${physicalPillsNeeded} เม็ด/${periodText}`;
        }

        let pillIconHtml = '';
        if (quarter) {
            pillIconHtml = `<span class="pill pill-${mg}mg pill-quarter-left" title="${mg} mg หนึ่งส่วนสี่เม็ด"></span>`;
        } else if (half) {
            pillIconHtml = `<span class="pill pill-${mg}mg pill-half-left" title="${mg} mg ครึ่งเม็ด"></span>`;
        } else {
            // Always show only one pill icon, even if the count is > 1
            pillIconHtml = `<span class="pill pill-${mg}mg" title="${mg} mg เต็มเม็ด"></span>`;
        }
        
        html += `
            <div class="text-sm p-3 ${bgColor} border rounded flex items-center">
                <div class="flex-shrink-0 w-10 flex justify-center items-center mr-3">${pillIconHtml}</div>
                <div class="flex-grow flex justify-between items-center gap-2">
                    <span class="flex-grow">${instructionLine}</span>
                    <span class="text-xs text-gray-600 font-semibold no-print flex-shrink-0 whitespace-nowrap">${pillCountText}</span>
                </div>
            </div>`;
    });
    
    html += '</div></div>';
    return html;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

function toggleAllowHalf() {
    const checkbox = document.getElementById('allowHalf');
    const btn = document.getElementById('allowHalfBtn');
    checkbox.checked = !checkbox.checked;
    btn.classList.toggle('active', checkbox.checked);
    hideResults();
}

function toggleAllowQuarter() {
    const checkbox = document.getElementById('allowQuarter');
    const btn = document.getElementById('allowQuarterBtn');
    checkbox.checked = !checkbox.checked;
    btn.classList.toggle('active', checkbox.checked);
    hideResults();
}

function togglePill(pillSize) {
    const checkbox = document.getElementById(`pill${pillSize}`);
    const btn = document.getElementById(`pill${pillSize}Btn`);
    checkbox.checked = !checkbox.checked;
    btn.classList.toggle('active', checkbox.checked);
    hideResults();
}

function setSpecialPattern(pattern) {
    document.querySelector(`input[name="specialDayPattern"][value="${pattern}"]`).checked = true;
    document.getElementById('weekendBtn').classList.toggle('active', pattern === 'weekend');
    document.getElementById('mwfBtn').classList.toggle('active', pattern === 'mwf');
    hideResults();
}

function setDayOrder(order) {
    document.querySelector(`input[name="dayOrder"][value="${order}"]`).checked = true;
    document.getElementById('sundayBtn').classList.toggle('active', order === 'sunday');
    document.getElementById('mondayBtn').classList.toggle('active', order === 'monday');
    hideResults();
}

function toggleDateRange() {
    const checkbox = document.getElementById('useDateRange');
    const btn = document.getElementById('useDateRangeBtn');
    const dateInputs = document.getElementById('dateRangeInputs');
    checkbox.checked = !checkbox.checked;
    btn.classList.toggle('active', checkbox.checked);
    if (checkbox.checked) {
        dateInputs.classList.remove('hidden');
        document.getElementById('startDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('useWeeks').checked = false;
        document.getElementById('useWeeksBtn').classList.remove('active');
        document.getElementById('weeksInput').classList.add('hidden');
    } else {
        dateInputs.classList.add('hidden');
    }
    if (allCalculatedOptions.length === 0) {
         hideResults();
    } else {
         document.getElementById('startDate').dispatchEvent(new Event('input'));
    }
}

function toggleWeeks() {
    const checkbox = document.getElementById('useWeeks');
    const btn = document.getElementById('useWeeksBtn');
    const weeksInput = document.getElementById('weeksInput');
    checkbox.checked = !checkbox.checked;
    btn.classList.toggle('active', checkbox.checked);
    if (checkbox.checked) {
        weeksInput.classList.remove('hidden');
        document.getElementById('useDateRange').checked = false;
        document.getElementById('useDateRangeBtn').classList.remove('active');
        document.getElementById('dateRangeInputs').classList.add('hidden');
    } else {
        weeksInput.classList.add('hidden');
    }
    if (allCalculatedOptions.length === 0) {
         hideResults();
    } else {
         document.getElementById('numberOfWeeks').dispatchEvent(new Event('input'));
    }
}

let selectedOption = -1;

function selectOption(optionIndex) {
    if (selectedOption === optionIndex) {
        const card = document.getElementById(`option-card-${optionIndex}`);
        const checkbox = document.getElementById(`checkbox-${optionIndex}`);
        if (card) card.classList.remove('selected');
        if (checkbox) {
            checkbox.classList.remove('checked');
            checkbox.querySelector('.checkmark').classList.add('hidden');
        }
        selectedOption = -1;
        updatePrintButtonVisibility();
        return;
    }
    
    if (selectedOption >= 0) {
        const oldCard = document.getElementById(`option-card-${selectedOption}`);
        const oldCheckbox = document.getElementById(`checkbox-${selectedOption}`);
        if (oldCard) oldCard.classList.remove('selected');
        if (oldCheckbox) {
            oldCheckbox.classList.remove('checked');
            oldCheckbox.querySelector('.checkmark').classList.add('hidden');
        }
    }
    
    selectedOption = optionIndex;
    const newCard = document.getElementById(`option-card-${optionIndex}`);
    const newCheckbox = document.getElementById(`checkbox-${optionIndex}`);
    
    if (newCard) newCard.classList.add('selected');
    if (newCheckbox) {
        newCheckbox.classList.add('checked');
        newCheckbox.querySelector('.checkmark').classList.remove('hidden');
    }
    
    updatePrintButtonVisibility();
}

function updatePrintButtonVisibility() {
    const printBtn = document.getElementById('printBtn');
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const hasSelectedOption = selectedOption >= 0;
    if (scrollTop > 300 && hasSelectedOption) {
        printBtn.classList.remove('opacity-0', 'invisible', 'translate-y-4');
    } else {
        printBtn.classList.add('opacity-0', 'invisible', 'translate-y-4');
    }
}

// Event Listeners
document.getElementById('previousDose').addEventListener('input', function() {
    const value = parseFloat(this.value);
    const adjustmentButtons = document.getElementById('adjustmentButtons');
    
    if (value && value > 0) {
        adjustmentButtons.classList.remove('hidden');
    } else {
        adjustmentButtons.classList.add('hidden');
    }
});

['previousDose', 'newDose'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('input', hideResults);
    }
});

['startDate', 'endDate', 'numberOfWeeks'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('input', () => {
            if (allCalculatedOptions.length > 0) {
                const currentSelectedIndex = selectedOption;
                const container = document.getElementById('optionsContainer');
                const showMoreContainer = document.getElementById('showMoreContainer');
                
                container.innerHTML = '';
                showMoreContainer.innerHTML = '';
                displayedOptionsCount = 0;
                selectedOption = -1;

                const infoBox = `<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div class="text-blue-800 font-medium">พบตัวเลือกทั้งหมด ${allCalculatedOptions.length} แบบ</div>
                </div>`;
                container.innerHTML = infoBox;
                loadMoreOptions();

                if (currentSelectedIndex >= 0) {
                    if (document.getElementById(`option-card-${currentSelectedIndex}`)) {
                        selectOption(currentSelectedIndex);
                    }
                }
            }
        });
    }
});


function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', function() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    const printBtn = document.getElementById('printBtn');
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 300) {
        backToTopBtn.classList.remove('opacity-0', 'invisible', 'translate-y-4');
        if (selectedOption >= 0) {
            printBtn.classList.remove('opacity-0', 'invisible', 'translate-y-4');
        }
    } else {
        backToTopBtn.classList.add('opacity-0', 'invisible', 'translate-y-4');
        printBtn.classList.add('opacity-0', 'invisible', 'translate-y-4');
    }
});

function printSelectedOption() {
    if (selectedOption < 0) return;

    const selectedCard = document.getElementById(`option-card-${selectedOption}`);
    if (!selectedCard) return;

    const printDiv = document.createElement('div');
    printDiv.className = 'print-content';

    const header = document.createElement('div');
    header.className = 'print-header';
    
    const mainTitle = "ขนาดยาวาร์ฟาริน (Warfarin) ที่รับประทาน";
    const totalDose = selectedCard.dataset.totalDose;
    const totalDoseText = totalDose ? `ขนาดยารวม ${totalDose} mg/สัปดาห์` : '';
    
    header.innerHTML = `
        <div style="position: relative; text-align: center; padding-bottom: 10px;">
            <div style="position: absolute; top: 0; left: 0; font-size: 14px;">วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH')}</div>
            <div class="print-title" style="padding-top: 25px;">${mainTitle}</div>
            <div class="print-subtitle">${totalDoseText}</div>
        </div>
    `;
    printDiv.appendChild(header);

    const cardToPrint = selectedCard.cloneNode(true);
    
    const checkbox = cardToPrint.querySelector('.option-checkbox');
    if (checkbox) checkbox.remove();
    const titleInCard = cardToPrint.querySelector('h4');
    if (titleInCard) titleInCard.remove();

    printDiv.appendChild(cardToPrint);
    
    document.body.appendChild(printDiv);
    
    window.print();
    
    setTimeout(() => {
        document.body.removeChild(printDiv);
    }, 500);
}