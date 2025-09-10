document.addEventListener('DOMContentLoaded', function() {

    // --- CONFIGURATION ---
    const daysName = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const dayColors = {
        'อา.': 'day-header-red',
        'จ.': 'day-header-yellow',
        'อ.': 'day-header-pink',
        'พ.': 'day-header-green',
        'พฤ.': 'day-header-orange',
        'ศ.': 'day-header-sky',
        'ส.': 'day-header-purple',
    };
    const DOSE_MULTIPLIER_LIMIT = 2.5;
    const ABSOLUTE_MAX_DAILY_DOSE = 15;
    const FLOAT_TOLERANCE = 0.01;
    let suggestionDebounceTimer;

    // --- DOM ELEMENT REFERENCES ---
    const previousDoseInput = document.getElementById('previousDoseInput');
    const weeklyDoseInput = document.getElementById('weeklyDoseInput');
    const allowHalfCheckbox = document.getElementById('allowHalf');
    const showBtn = document.getElementById('showBtn');
    const adjustmentTableDiv = document.getElementById('adjustmentTable');
    const percentageChangeDiv = document.getElementById('percentageChange');
    const resultDiv = document.getElementById('result');
    const appointmentToggle = document.getElementById('appointmentToggle');
    const appointmentFields = document.getElementById('appointmentFields');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const daysResultDiv = document.getElementById('daysResult');
    const patternFriSunRadio = document.getElementById('patternFriSun');
    const patternMonWedFriRadio = document.getElementById('patternMonWedFri');
    // Correctly reference the new pill buttons via their container
    const pillSelectionContainer = document.getElementById('pillSelection');


    /**
     * Gets the currently selected pill strengths from the checkboxes.
     */
    function getAvailablePills() {
        const selectedPills = [];
        // Query within the container for the checkboxes
        pillSelectionContainer.querySelectorAll('.pill-checkbox').forEach(checkbox => {
            if (checkbox.checked) {
                selectedPills.push(parseInt(checkbox.value));
            }
        });
        // Sort descending to prioritize larger pills in the findComb algorithm
        return selectedPills.sort((a, b) => b - a);
    }

    /**
     * Maps JS Date.getDay() to local day index (Sun=0, Sat=6).
     * This now matches the daysName array order.
     */
    function getThaiDayIndex(jsDayIndex) {
        return jsDayIndex; // Sunday is 0, Monday is 1, etc.
    }

    /**
     * Generates interactive buttons for quick dose adjustment.
     */
    function generateDoseAdjustmentTable() {
        const prev = parseFloat(previousDoseInput.value);
        if (isNaN(prev) || prev <= 0) {
            adjustmentTableDiv.innerHTML = '';
            return;
        }
        adjustmentTableDiv.innerHTML = '<h3 class="text-lg font-semibold mb-3 text-center text-gray-700">ปรับขนาดยาอัตโนมัติ <span class="text-sm font-normal text-gray-500"> (คลิกเพื่อเลือกขนาดยาใหม่)</span></h3>';
        const percentages = [-20, -15, -10, -5, 5, 10, 15, 20];
        let buttonsHtml = '<div class="grid grid-cols-4 gap-2 text-center">';
        percentages.forEach(p => {
            const exactDose = prev * (1 + p / 100);
            const roundedDose = Math.round(exactDose * 2) / 2;
            const buttonColor = p < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            buttonsHtml += `
                <button data-dose="${roundedDose}" class="dose-adjust-btn ${buttonColor}">
                    <div class="font-bold text-lg">${p > 0 ? '+' : ''}${p}%</div>
                    <div class="text-sm">${roundedDose.toFixed(1)} mg</div>
                </button>`;
        });
        buttonsHtml += '</div>';
        adjustmentTableDiv.innerHTML = buttonsHtml;

        adjustmentTableDiv.querySelectorAll('.dose-adjust-btn').forEach(button => {
            button.addEventListener('click', function() {
                const dose = parseFloat(this.dataset.dose);
                setWeeklyDoseAndSuggest(dose);
            });
        });
    }

    /**
     * Sets the weekly dose input and triggers suggestion generation.
     */
    function setWeeklyDoseAndSuggest(dose) {
        weeklyDoseInput.value = dose.toFixed(1);
        displayPercentageChange();
        // The live update will trigger automatically from the input event listener
    }

    /**
     * Displays the percentage change between previous and new dose.
     */
    function displayPercentageChange() {
        const weeklyDose = parseFloat(weeklyDoseInput.value);
        const previousDose = parseFloat(previousDoseInput.value);
        percentageChangeDiv.innerHTML = '';

        if (!isNaN(weeklyDose) && !isNaN(previousDose) && previousDose > 0) {
            const pctChange = ((weeklyDose - previousDose) / previousDose * 100);
            const isIncrease = pctChange > 0;
            const arrow = isIncrease ? '▲' : '▼';
            const colorClass = isIncrease ? 'text-green-600 border-green-500 bg-green-50' : 'text-red-600 border-red-500 bg-red-50';
            
            let content = `
                <div class="p-2 mt-2 border-l-4 rounded-r-lg ${colorClass}">
                    <div class="font-semibold flex items-center">
                        <span class="mr-2">${arrow}</span>
                        <span>${Math.abs(pctChange).toFixed(1)}%</span>
                    </div>
                    <div class="text-sm text-gray-600">
                        จาก ${previousDose.toFixed(1)}mg เป็น ${weeklyDose.toFixed(1)}mg/สัปดาห์
                    </div>
                </div>`;
            
             if (Math.abs(pctChange) < 0.05) {
                content = `
                <div class="p-2 mt-2 border-l-4 rounded-r-lg text-blue-700 border-blue-500 bg-blue-50">
                    <div class="font-semibold">ขนาดยาคงที่</div>
                    <div class="text-sm text-gray-600">
                       ${weeklyDose.toFixed(1)} mg/สัปดาห์
                    </div>
                </div>`;
            }
            percentageChangeDiv.innerHTML = content;
        }
    }
    
    /**
     * Finds the most efficient pill combinations for a target dose.
     */
    function findComb(target, availablePills, allowHalf, minPillObjects, maxPillObjects) {
        if (Math.abs(target) < FLOAT_TOLERANCE) {
            return minPillObjects === 0 ? [
                []
            ] : [];
        }

        let bestCombos = [];
        let minPills = Infinity;

        function findRecursive(currentDose, currentCombo, pillIndex) {
            if (currentCombo.length >= minPills || currentCombo.length > maxPillObjects || currentDose > target + FLOAT_TOLERANCE) {
                return;
            }

            if (Math.abs(currentDose - target) < FLOAT_TOLERANCE) {
                if (currentCombo.length >= minPillObjects) {
                    if (currentCombo.length < minPills) {
                        minPills = currentCombo.length;
                        bestCombos = [currentCombo.slice()];
                    } else if (currentCombo.length === minPills) {
                        bestCombos.push(currentCombo.slice());
                    }
                }
                return;
            }

            if (pillIndex >= availablePills.length) {
                return;
            }

            const pillMg = availablePills[pillIndex];

            // Option 1: Use the current pill as a whole pill
            currentCombo.push({ mg: pillMg, half: false });
            findRecursive(currentDose + pillMg, currentCombo, pillIndex);
            currentCombo.pop();

            // Option 2: Use the current pill as a half pill
            if (allowHalf) {
                currentCombo.push({ mg: pillMg, half: true });
                findRecursive(currentDose + pillMg / 2, currentCombo, pillIndex);
                currentCombo.pop();
            }

            // Option 3: Skip the current pill and move to the next
            findRecursive(currentDose, currentCombo, pillIndex + 1);
        }

        findRecursive(0, [], 0);

        const uniqueAggregatedCombos = new Set();
        return bestCombos
            .map(aggregateCombo)
            .filter(combo => {
                const key = JSON.stringify(combo.sort((a, b) => a.mg - b.mg));
                if (uniqueAggregatedCombos.has(key)) {
                    return false;
                }
                uniqueAggregatedCombos.add(key);
                return true;
            });
    }


    /**
     * Generates and displays suggestions for Warfarin dosage.
     */
    function generateSuggestions() {
        const weeklyDose = parseFloat(weeklyDoseInput.value);
        const allowHalf = allowHalfCheckbox.checked;
        const availablePills = getAvailablePills();
        resultDiv.innerHTML = '';

        if (isNaN(weeklyDose) || weeklyDose < 0) {
            return;
        }
        if (availablePills.length === 0) {
            resultDiv.innerHTML = `<div class="p-4 text-center font-semibold text-red-700 bg-red-50 rounded-lg">กรุณาเลือกเม็ดยาที่ใช้คำนวณอย่างน้อย 1 ขนาด</div>`;
            return;
        }
        displayPercentageChange();

        let {
            daysUntilAppointment,
            isAppointmentCalculation,
            startDate
        } = getAppointmentInfo();
        const specialDayPattern = document.querySelector('input[name="specialDayPattern"]:checked').value;

        let options = [];
        const seenOptions = new Set();
        
        // --- Day Indices based on Sun=0, Mon=1...Sat=6 ---
        const fri = 5, sat = 6, sun = 0;
        const mon = 1, wed = 3;


        // Case 1: Uniform dose
        const dailyDoseTarget = weeklyDose / 7;
        if (dailyDoseTarget >= 0) {
            const dailyCombos = findComb(dailyDoseTarget, availablePills, allowHalf, dailyDoseTarget === 0 ? 0 : 1, 4);
            dailyCombos.forEach(c => {
                const actualWeeklyDose = c.reduce((sum, p) => sum + (p.half ? p.mg * 0.5 * p.count : p.mg * p.count), 0) * 7;
                if (Math.abs(actualWeeklyDose - weeklyDose) < FLOAT_TOLERANCE) {
                    const key = `uniform-${JSON.stringify(c.map(p => `${p.mg}-${p.count}-${p.half}`).sort())}`;
                    if (!seenOptions.has(key)) {
                        seenOptions.add(key);
                        options.push({
                            type: 'uniform',
                            combo: c,
                            weeklyDoseActual: actualWeeklyDose,
                            priority: 0
                        });
                    }
                }
            });
        }

        // Case 2: Non-uniform doses
        for (let numStopDays = 0; numStopDays <= 3; numStopDays++) {
            for (let numSpecialDays = 0; numSpecialDays <= (3 - numStopDays); numSpecialDays++) {
                const normalDaysCount = 7 - numStopDays - numSpecialDays;
                if (normalDaysCount === 7) continue;

                let stopDaysIndices = [];
                let specialDaysIndices = [];
                
                // --- Determine Special/Stop days based on pattern ---
                 if (specialDayPattern === 'fri-sun') {
                    const weekend = [fri, sat, sun];
                    stopDaysIndices = weekend.slice(0, numStopDays);
                    specialDaysIndices = weekend.slice(numStopDays, numStopDays + numSpecialDays);
                } else { // mon-wed-fri
                    const weekdays = [mon, wed, fri];
                    // A bit complex to distribute, simple logic for now
                    if (numSpecialDays === 3) { specialDaysIndices = [mon, wed, fri]; }
                     else if (numSpecialDays === 2) { specialDaysIndices = [mon, fri]; if (numStopDays === 1) stopDaysIndices = [wed]; }
                     else if (numSpecialDays === 1) { specialDaysIndices = [wed]; if (numStopDays === 2) stopDaysIndices = [mon, fri]; else if (numStopDays === 1) stopDaysIndices = [mon]; }
                     else { // numSpecialDays === 0
                        if(numStopDays === 3) stopDaysIndices = [mon, wed, fri];
                        else if(numStopDays === 2) stopDaysIndices = [mon, fri];
                        else if(numStopDays === 1) stopDaysIndices = [wed];
                     }
                }


                for (let baseDose = 0.5; baseDose <= ABSOLUTE_MAX_DAILY_DOSE; baseDose += 0.5) {
                    const normalDayCombos = findComb(baseDose, availablePills, allowHalf, 1, 4);
                    if (normalDayCombos.length === 0) continue;

                    const remainingDose = weeklyDose - (baseDose * normalDaysCount);

                    if (numSpecialDays === 0) {
                        if (Math.abs(remainingDose) > FLOAT_TOLERANCE) continue;
                        addNonUniformOption(options, seenOptions, {
                            baseDose,
                            numStopDays,
                            stopDaysIndices,
                            normalDayCombos,
                            weeklyDose,
                            availablePills
                        });
                    } else {
                        if (remainingDose <= FLOAT_TOLERANCE) continue;
                        const specialDayDoseTarget = +(remainingDose / numSpecialDays).toFixed(2);
                        if (Math.abs(specialDayDoseTarget - baseDose) < FLOAT_TOLERANCE || specialDayDoseTarget <= 0) continue;
                        if (specialDayDoseTarget > ABSOLUTE_MAX_DAILY_DOSE || specialDayDoseTarget > baseDose * DOSE_MULTIPLIER_LIMIT) continue;

                        const specialDayCombos = findComb(specialDayDoseTarget, availablePills, allowHalf, 1, 4);
                        if (specialDayCombos.length === 0) continue;

                        addNonUniformOption(options, seenOptions, {
                            baseDose,
                            numStopDays,
                            stopDaysIndices,
                            numSpecialDays,
                            specialDaysIndices,
                            specialDayDoseTarget,
                            normalDayCombos,
                            specialDayCombos,
                            weeklyDose,
                            availablePills
                        });
                    }
                }
            }
        }

        sortAndRenderOptions(options, daysUntilAppointment, isAppointmentCalculation, startDate);
    }

    /**
     * Helper to add a valid non-uniform option to the list, avoiding duplicates.
     */
    function addNonUniformOption(options, seenOptions, params) {
        const {
            baseDose,
            numStopDays,
            stopDaysIndices,
            numSpecialDays = 0,
            specialDaysIndices = [],
            specialDayDoseTarget = 0,
            normalDayCombos,
            specialDayCombos = [
                []
            ],
            weeklyDose
        } = params;

        specialDayCombos.forEach(sCombo => {
            normalDayCombos.forEach(nCombo => {
                const comboWeekly = Array(7).fill(null);
                let actualWeeklyDose = 0;
                for (let i = 0; i < 7; i++) {
                    if (stopDaysIndices.includes(i)) {
                        comboWeekly[i] = [];
                    } else if (specialDaysIndices.includes(i)) {
                        comboWeekly[i] = sCombo.slice();
                    } else {
                        comboWeekly[i] = nCombo.slice();
                    }
                    actualWeeklyDose += comboWeekly[i].reduce((sum, p) => sum + (p.half ? p.mg * 0.5 * p.count : p.mg * p.count), 0);
                }

                if (Math.abs(actualWeeklyDose - weeklyDose) < FLOAT_TOLERANCE) {
                    const key = `nonuniform-${JSON.stringify(comboWeekly.map(day => day ? day.map(p => `${p.mg}-${p.count}-${p.half}`).sort().join('|') : 'null'))}`;
                    if (!seenOptions.has(key)) {
                        seenOptions.add(key);
                        options.push({
                            type: 'non-uniform',
                            comboWeekly,
                            weeklyDoseActual: actualWeeklyDose,
                            baseDose,
                            specialDose: specialDayDoseTarget,
                            numStopDays,
                            stopDays: stopDaysIndices.sort((a, b) => a - b),
                            numSpecialDays,
                            specialDays: specialDaysIndices.sort((a, b) => a - b),
                            priority: 1
                        });
                    }
                }
            });
        });
    }

    /**
     * Sorts the generated options and renders them to the DOM.
     */
    function sortAndRenderOptions(options, daysUntilAppointment, isAppointmentCalculation, startDate) {
        if (options.length === 0) {
            resultDiv.innerHTML = '<div class="p-4 text-center font-semibold text-gray-700 bg-gray-50 rounded-lg">ไม่พบตัวเลือกที่เหมาะสมสำหรับขนาดยาที่ต้องการ</div>';
            return;
        }

        options.sort((a, b) => {
            const aHalfComplexity = getHalfPillComplexity(a);
            const bHalfComplexity = getHalfPillComplexity(b);
            if (aHalfComplexity !== bHalfComplexity) return aHalfComplexity - bHalfComplexity;
            if (a.priority !== b.priority) return a.priority - b.priority;
            const aComplexity = (a.numStopDays || 0) + (a.numSpecialDays || 0);
            const bComplexity = (b.numStopDays || 0) + (b.numSpecialDays || 0);
            if (aComplexity !== bComplexity) return aComplexity - bComplexity;
            const aColors = countPillColors(a);
            const bColors = countPillColors(b);
            if (aColors !== bColors) return aColors - bColors;
            const aTotalPills = countTotalPillObjects(a);
            const bTotalPills = countTotalPillObjects(b);
            if (aTotalPills !== bTotalPills) return aTotalPills - bTotalPills;
            return 0;
        });

        resultDiv.innerHTML = options.slice(0, 30).map((option, index) => {
            return renderOption(option, index, daysUntilAppointment, isAppointmentCalculation, startDate);
        }).join('');
    }

    /**
     * Renders a single dosage option card.
     */
    function renderOption(option, index, daysUntilAppointment, isAppointmentCalculation, startDate) {
        let description = '';
        if (option.type === 'uniform') {
            const dailyDose = option.combo.reduce((sum, p) => sum + (p.half ? p.mg * 0.5 * p.count : p.mg * p.count), 0);
            description = dailyDose > 0 ? `<strong>วันละ ${dailyDose.toFixed(1)} mg</strong>` : '<strong>หยุดยาทุกวัน</strong>';
        } else { // non-uniform
            let parts = [];
            if (option.baseDose > 0) parts.push(`วันธรรมดา <strong>${option.baseDose.toFixed(1)} mg</strong>`);
            if (option.numSpecialDays > 0) {
                parts.push(`วันพิเศษ <strong>${option.specialDose.toFixed(1)} mg</strong> (${option.specialDays.map(idx => daysName[idx]).join(', ')})`);
            }
            if (option.numStopDays > 0) {
                parts.push(`หยุดยา <strong>${option.numStopDays} วัน</strong> (${option.stopDays.map(idx => daysName[idx]).join(', ')})`);
            }
            description = parts.join(', ');
        }

        const displayOrder = [0, 1, 2, 3, 4, 5, 6]; // Sun, Mon, Tue, Wed, Thu, Fri, Sat

        const weeklyScheduleHtml = displayOrder.map(j => {
            const combo = option.type === 'uniform' ? option.combo : option.comboWeekly[j];
            let dayType = 'normal';
            if (option.type === 'non-uniform') {
                if (option.stopDays.includes(j)) dayType = 'stop';
                else if (option.specialDays.includes(j)) dayType = 'special';
            }
            return renderDay(j, combo, dayType);
        }).join('');

        const totalPillsHeader = isAppointmentCalculation ? `รวมยาถึงวันนัด (${daysUntilAppointment} วัน):` : 'รวมยาสำหรับ 1 สัปดาห์:';
        const pillsNeededMessage = calculateTotalPills(option, daysUntilAppointment, startDate);

        return `
            <div class="result-option-card">
                <div class="result-option-header">
                    <h3>
                       ตัวเลือก ${index + 1}: ${description} <span>(รวม ${option.weeklyDoseActual.toFixed(1)} mg/สัปดาห์)</span>
                    </h3>
                </div>
                <div class="weekly-schedule-grid">
                    ${weeklyScheduleHtml}
                </div>
                <div class="result-option-footer">
                    <h4>${totalPillsHeader}</h4>
                    <div class="pill-summary">
                        ${pillsNeededMessage}
                    </div>
                </div>
            </div>`;
    }

    /**
     * Renders the HTML for a single day's dosage display.
     */
     function renderDay(dayIndex, combo, dayType) {
        const dayName = daysName[dayIndex];
        const dayColorClass = dayColors[dayName] || '';
    
        let visualPills = '';
        let textPillsArr = [];
        let dayDose = 0;
    
        if (combo && combo.length > 0) {
            // Sort combo to keep order consistent, e.g., 5mg then 2mg
            combo.sort((a, b) => b.mg - a.mg);
            combo.forEach(p => {
                dayDose += p.half ? p.mg * 0.5 * p.count : p.mg * p.count;
                const pillCount = p.count || 0;
                if (p.half) {
                    for (let k = 0; k < pillCount; k++) {
                        visualPills += `<span class="pill pill-${p.mg} pill-half-left"></span>`;
                    }
                    if (pillCount > 0) {
                        textPillsArr.push(`${p.mg} mg x(ครึ่ง)`);
                    }
                } else {
                    for (let k = 0; k < pillCount; k++) {
                        visualPills += `<span class="pill pill-${p.mg}"></span>`;
                    }
                    if (pillCount > 0) {
                        textPillsArr.push(`${p.mg} mg x${pillCount}`);
                    }
                }
            });
        }
    
        let dayContentHtml;
        let dayCardClasses = "day-card";
        if (dayType === 'special') {
            dayCardClasses += ' day-card--special';
        }
    
        if (dayType === 'stop' || dayDose < FLOAT_TOLERANCE) {
            dayContentHtml = `
                <div class="day-card-body day-card-body--stop">
                    หยุดยา
                </div>
            `;
        } else {
            const textPillsHtml = textPillsArr.map(t => `<div class="pill-text">${t}</div>`).join('');
            dayContentHtml = `
                <div class="day-card-body">
                    <div class="day-dose">(${dayDose.toFixed(1)} mg)</div>
                    <div class="pill-display">${visualPills || '&nbsp;'}</div>
                    <div>${textPillsHtml}</div>
                </div>
            `;
        }
    
        return `
            <div class="${dayCardClasses}">
                <div class="day-card-header ${dayColorClass}">${dayName}</div>
                ${dayContentHtml}
            </div>`;
    }


    /**
     * Aggregates a list of pill objects into a counted format.
     */
    function aggregateCombo(combo) {
        const aggregated = {};
        combo.forEach(pill => {
            const key = `${pill.mg}-${pill.half}`;
            if (!aggregated[key]) {
                aggregated[key] = {
                    mg: pill.mg,
                    half: pill.half,
                    count: 0
                };
            }
            aggregated[key].count++;
        });
        return Object.values(aggregated);
    }

    // --- UTILITY & HELPER FUNCTIONS ---

    function getHalfPillComplexity(o) {
        const halfPillStrengths = new Set();
        const combosToScan = o.type === 'uniform' ? [o.combo] : (o.comboWeekly || []);
        combosToScan.forEach(dayCombo => {
            if (dayCombo) {
                dayCombo.forEach(pill => {
                    if (pill.half) halfPillStrengths.add(pill.mg);
                });
            }
        });
        return halfPillStrengths.size;
    }

    function countPillColors(o) {
        const colors = new Set();
        const combosToScan = o.type === 'uniform' ? [o.combo] : (o.comboWeekly || []);
        combosToScan.forEach(day => day && day.forEach(p => (p.count > 0 || p.half) && colors.add(p.mg)));
        return colors.size;
    }

    function countTotalPillObjects(o) {
        const dailyPillObjects = (day) => day ? day.reduce((s, p) => s + p.count, 0) : 0;
        if (o.type === 'uniform') return dailyPillObjects(o.combo) * 7;
        return (o.comboWeekly || []).reduce((s, day) => s + dailyPillObjects(day), 0);
    }

    /**
     * Calculates total pills to dispense for an option.
     */
    function calculateTotalPills(option, daysUntilAppointment, startDate) {
        let halfPillCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let wholePillCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const startJsDayIndex = startDate ? startDate.getDay() : 0; // Default to Sunday if no date

        for (let day = 0; day < daysUntilAppointment; day++) {
            const currentDayIndexForCombo = getThaiDayIndex((startJsDayIndex + day) % 7);
            const comboForDay = option.type === 'uniform' ? option.combo : option.comboWeekly[currentDayIndexForCombo];
            if (comboForDay) {
                comboForDay.forEach(p => {
                    if (p.half) halfPillCounts[p.mg] += p.count;
                    else wholePillCounts[p.mg] += p.count;
                });
            }
        }

        let message = '';
        [5, 4, 3, 2, 1].forEach(mg => {
            const wholePills = wholePillCounts[mg];
            const halfPills = halfPillCounts[mg];
            
            let totalToDispense = wholePills;
            let usedDose = wholePills;
            
            if(halfPills > 0) {
                 const pairsOfHalves = Math.floor(halfPills / 2);
                 const remainingSingleHalf = halfPills % 2;
                 totalToDispense += pairsOfHalves + remainingSingleHalf;
                 usedDose += halfPills * 0.5;
            }

            if (totalToDispense > 0) {
                 message += `
                    <div class="summary-item">
                        <span class="pill pill-${mg}"></span>
                        <span>${mg}mg: ${totalToDispense} เม็ด 
                            ${(halfPills > 0) ? `(ใช้จริง ${usedDose.toFixed(1)} เม็ด)` : ''}
                        </span>
                    </div>`;
            }
        });
        return message || '<span>ไม่ต้องจ่ายยา</span>';
    }


    /**
     * Gets and validates appointment dates.
     */
    function getAppointmentInfo() {
        let daysUntilAppointment = 7;
        let isAppointmentCalculation = false;
        let startDate = null;

        if (appointmentToggle.checked) {
            const startVal = startDateInput.value;
            const endVal = endDateInput.value;
            if (startVal && endVal) {
                const startDt = new Date(startVal);
                const endDt = new Date(endVal);
                startDt.setHours(0, 0, 0, 0);
                endDt.setHours(0, 0, 0, 0);
                if (endDt >= startDt) { // Allow same day
                    const timeDiff = endDt.getTime() - startDt.getTime();
                    daysUntilAppointment = Math.round(timeDiff / (1000 * 3600 * 24)) + 1; // Inclusive
                    isAppointmentCalculation = true;
                    startDate = startDt;
                }
            }
        }
        return {
            daysUntilAppointment,
            isAppointmentCalculation,
            startDate
        };
    }

    /**
     * Updates the appointment days display and triggers recalculation if needed.
     */
    function updateAppointmentDaysDisplay() {
        const {
            daysUntilAppointment,
            isAppointmentCalculation
        } = getAppointmentInfo();
        if (isAppointmentCalculation) {
            daysResultDiv.textContent = `คำนวณสำหรับ ${daysUntilAppointment} วัน`;
        } else {
            daysResultDiv.textContent = '';
        }

        handleOptionChange();
    }

    // --- EVENT LISTENERS ---
    
    function handleOptionChange() {
        clearTimeout(suggestionDebounceTimer);
        suggestionDebounceTimer = setTimeout(generateSuggestions, 250); // Debounce to avoid rapid firing
    }
    
    showBtn.addEventListener('click', generateSuggestions);
    previousDoseInput.addEventListener('input', generateDoseAdjustmentTable);
    weeklyDoseInput.addEventListener('input', handleOptionChange);

    appointmentToggle.addEventListener('change', () => {
        if (appointmentToggle.checked) {
            appointmentFields.classList.remove('hidden');
            if (!startDateInput.value) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                startDateInput.value = `${yyyy}-${mm}-${dd}`;
            }
        } else {
            appointmentFields.classList.add('hidden');
        }
        updateAppointmentDaysDisplay();
    });

    startDateInput.addEventListener('change', updateAppointmentDaysDisplay);
    endDateInput.addEventListener('change', updateAppointmentDaysDisplay);

    patternFriSunRadio.addEventListener('change', handleOptionChange);
    patternMonWedFriRadio.addEventListener('change', handleOptionChange);
    
    // Add event listener to the container for delegation
    pillSelectionContainer.addEventListener('change', (event) => {
        if (event.target.classList.contains('pill-checkbox')) {
            handleOptionChange();
        }
    });
    
    allowHalfCheckbox.addEventListener('change', handleOptionChange);

    // Initial calls
    generateDoseAdjustmentTable();
    // generateSuggestions(); // Optional: run on page load
});

