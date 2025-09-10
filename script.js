document.addEventListener('DOMContentLoaded', function() {

    // --- CONFIGURATION ---
    const daysName = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
    const DOSE_MULTIPLIER_LIMIT = 2.5;
    const ABSOLUTE_MAX_DAILY_DOSE = 15;
    const FLOAT_TOLERANCE = 0.01;

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
    // Corrected selector for the new pill buttons
    const pillCheckboxes = document.querySelectorAll('.pill-checkbox');

    // --- DEBOUNCE UTILITY ---
    function debounce(func, delay = 500) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    /**
     * Gets the currently selected pill strengths from the checkboxes.
     */
    function getAvailablePills() {
        const selectedPills = [];
        pillCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedPills.push(parseInt(checkbox.value));
            }
        });
        return selectedPills.sort((a, b) => b - a);
    }

    /**
     * Maps JS Date.getDay() to local day index (Mon=0, Sun=6).
     */
    function getThaiDayIndex(jsDayIndex) {
        return (jsDayIndex === 0) ? 6 : jsDayIndex - 1;
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
        let content = '<h2 class="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">ปรับขนาดยาอัตโนมัติ</h2><p class="text-sm text-gray-500 mb-4">คลิกเพื่อเลือกขนาดยาใหม่โดยประมาณ</p>';
        const percentages = [-20, -15, -10, -5, 5, 10, 15, 20];
        let buttonsHtml = '<div class="grid grid-cols-4 gap-2 text-center">';
        percentages.forEach(p => {
            const exactDose = prev * (1 + p / 100);
            const roundedDose = Math.round(exactDose * 2) / 2;
            const buttonColor = p < 0 ? 'bg-red-100 hover:bg-red-200 text-red-800' : 'bg-green-100 hover:bg-green-200 text-green-800';
            buttonsHtml += `
                <button data-dose="${roundedDose}" class="dose-adjust-btn p-2 rounded-lg ${buttonColor} transition duration-150 ease-in-out shadow-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    <div class="font-bold text-base">${p > 0 ? '+' : ''}${p}%</div>
                    <div class="text-xs">${roundedDose.toFixed(1)} mg</div>
                </button>`;
        });
        buttonsHtml += '</div>';
        adjustmentTableDiv.innerHTML = content + buttonsHtml;

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
        showBtn.click();
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
            let content = '';
            if (Math.abs(pctChange) < 0.05) {
                content = `
                    <div class="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r-lg">
                        <div class="flex items-center">
                            <div class="ml-3">
                                <p class="text-lg font-bold text-blue-800">ขนาดยาคงที่</p>
                                <p class="text-sm text-blue-700">ไม่มีการเปลี่ยนแปลงขนาดยาจากเดิม</p>
                            </div>
                        </div>
                    </div>`;
            } else {
                const isIncrease = pctChange > 0;
                const arrow = isIncrease ? '' : '';
                const absPctChange = Math.abs(pctChange).toFixed(1);
                const colorTheme = isIncrease ? 'green' : 'red';
                
                content = `
                     <div class="p-4 border-l-4 border-${colorTheme}-500 bg-${colorTheme}-50 rounded-r-lg">
                        <div class="flex items-center">
                            <span class="text-3xl font-bold text-${colorTheme}-600">${arrow}</span>
                            <div class="ml-4">
                                 <p class="text-lg font-bold text-${colorTheme}-800">${isIncrease ? 'เพิ่ม' : 'ลด'}ขนาดยา ${absPctChange}%</p>
                                <p class="text-sm text-${colorTheme}-700">จาก ${previousDose.toFixed(1)} mg/สัปดาห์ เป็น ${weeklyDose.toFixed(1)} mg/สัปดาห์</p>
                            </div>
                        </div>
                    </div>`;
            }
            percentageChangeDiv.innerHTML = content;
        }
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
            resultDiv.innerHTML = '<div class="text-red-600 text-center font-bold bg-red-50 p-4 rounded-lg">กรุณากรอกขนาดยาใหม่ที่ถูกต้อง</div>';
            return;
        }
         if (availablePills.length === 0) {
            resultDiv.innerHTML = '<div class="text-red-600 text-center font-bold bg-red-50 p-4 rounded-lg">กรุณาเลือกเม็ดยาที่ใช้คำนวณอย่างน้อย 1 ขนาด</div>';
            return;
        }
        displayPercentageChange();

        let { daysUntilAppointment, isAppointmentCalculation, startDate } = getAppointmentInfo();
        const specialDayPattern = document.querySelector('input[name="specialDayPattern"]:checked').value;
        
        let options = [];
        const seenOptions = new Set();

        const dailyDoseTarget = weeklyDose / 7;
        if (dailyDoseTarget >= 0) {
            const dailyCombos = findComb(dailyDoseTarget, availablePills, allowHalf, dailyDoseTarget === 0 ? 0 : 1, 4);
            dailyCombos.forEach(c => {
                const actualWeeklyDose = c.reduce((sum, p) => sum + (p.half ? p.mg * 0.5 * p.count : p.mg * p.count), 0) * 7;
                if (Math.abs(actualWeeklyDose - weeklyDose) < FLOAT_TOLERANCE) {
                    const key = `uniform-${JSON.stringify(c.map(p => `${p.mg}-${p.count}-${p.half}`).sort())}`;
                    if (!seenOptions.has(key)) {
                        seenOptions.add(key);
                        options.push({ type: 'uniform', combo: c, weeklyDoseActual: actualWeeklyDose, priority: 0 });
                    }
                }
            });
        }

        for (let numStopDays = 0; numStopDays <= 3; numStopDays++) {
            for (let numSpecialDays = 0; numSpecialDays <= (3 - numStopDays); numSpecialDays++) {
                const normalDaysCount = 7 - numStopDays - numSpecialDays;
                if (normalDaysCount === 7) continue;

                let stopDaysIndices = [], specialDaysIndices = [];
                if (specialDayPattern === 'fri-sun') {
                    stopDaysIndices = Array.from({ length: numStopDays }, (_, i) => 6 - i);
                    specialDaysIndices = Array.from({ length: numSpecialDays }, (_, i) => 6 - numStopDays - i);
                } else { // mon-wed-fri
                    const patternDays = [0, 2, 4]; // จ, พ, ศ
                    specialDaysIndices = patternDays.slice(0, numSpecialDays);
                    stopDaysIndices = patternDays.slice(numSpecialDays, numSpecialDays + numStopDays);
                }

                for (let baseDose = 0.5; baseDose <= ABSOLUTE_MAX_DAILY_DOSE; baseDose += 0.5) {
                    const normalDayCombos = findComb(baseDose, availablePills, allowHalf, 1, 4);
                    if (normalDayCombos.length === 0) continue;
                    const remainingDose = weeklyDose - (baseDose * normalDaysCount);
                    if (numSpecialDays === 0) {
                        if (Math.abs(remainingDose) > FLOAT_TOLERANCE) continue;
                         addNonUniformOption(options, seenOptions, { baseDose, numStopDays, stopDaysIndices, normalDayCombos, weeklyDose });
                    } else {
                        if (remainingDose <= FLOAT_TOLERANCE) continue;
                        const specialDayDoseTarget = +(remainingDose / numSpecialDays).toFixed(2);
                        if (Math.abs(specialDayDoseTarget - baseDose) < FLOAT_TOLERANCE || specialDayDoseTarget <= 0) continue;
                        if (specialDayDoseTarget > ABSOLUTE_MAX_DAILY_DOSE || specialDayDoseTarget > baseDose * DOSE_MULTIPLIER_LIMIT) continue;
                        
                        const specialDayCombos = findComb(specialDayDoseTarget, availablePills, allowHalf, 1, 4);
                        if (specialDayCombos.length === 0) continue;
                        
                        addNonUniformOption(options, seenOptions, { baseDose, numStopDays, stopDaysIndices, numSpecialDays, specialDaysIndices, specialDayDoseTarget, normalDayCombos, specialDayCombos, weeklyDose });
                    }
                }
            }
        }
        sortAndRenderOptions(options, daysUntilAppointment, isAppointmentCalculation, startDate);
    }

    function addNonUniformOption(options, seenOptions, params) {
        const { baseDose, numStopDays, stopDaysIndices, numSpecialDays = 0, specialDaysIndices = [], specialDayDoseTarget = 0, normalDayCombos, specialDayCombos = [[]], weeklyDose } = params;
        specialDayCombos.forEach(sCombo => {
            normalDayCombos.forEach(nCombo => {
                const comboWeekly = Array(7).fill(null);
                let actualWeeklyDose = 0;
                for (let i = 0; i < 7; i++) {
                    if (stopDaysIndices.includes(i)) comboWeekly[i] = [];
                    else if (specialDaysIndices.includes(i)) comboWeekly[i] = sCombo.slice();
                    else comboWeekly[i] = nCombo.slice();
                    actualWeeklyDose += comboWeekly[i].reduce((sum, p) => sum + (p.half ? p.mg * 0.5 * p.count : p.mg * p.count), 0);
                }
                if (Math.abs(actualWeeklyDose - weeklyDose) < FLOAT_TOLERANCE) {
                     const key = `nonuniform-${JSON.stringify(comboWeekly.map(day => day ? day.map(p => `${p.mg}-${p.count}-${p.half}`).sort().join('|') : 'null'))}`;
                     if (!seenOptions.has(key)) {
                        seenOptions.add(key);
                        options.push({ type: 'non-uniform', comboWeekly, weeklyDoseActual: actualWeeklyDose, baseDose, specialDose: specialDayDoseTarget, numStopDays, stopDays: stopDaysIndices.sort((a,b)=>a-b), numSpecialDays, specialDays: specialDaysIndices.sort((a,b)=>a-b), priority: 1 });
                    }
                }
            });
        });
    }
    
    function sortAndRenderOptions(options, daysUntilAppointment, isAppointmentCalculation, startDate) {
         if (options.length === 0) {
             resultDiv.innerHTML = '<div class="text-red-600 text-center font-bold bg-red-50 p-4 rounded-lg">ไม่พบตัวเลือกที่เหมาะสมสำหรับขนาดยาที่ต้องการ</div>';
             return;
         }
        options.sort((a, b) => {
            const criteria = [
                (o) => getHalfPillComplexity(o),
                (o) => o.priority,
                (o) => (o.numStopDays || 0) + (o.numSpecialDays || 0),
                (o) => countPillColors(o),
                (o) => countTotalPillObjects(o),
            ];
            for (const criterion of criteria) {
                const valA = criterion(a);
                const valB = criterion(b);
                if (valA !== valB) return valA - valB;
            }
            return 0;
        });
        resultDiv.innerHTML = options.slice(0, 30).map((option, index) => renderOption(option, index, daysUntilAppointment, isAppointmentCalculation, startDate)).join('');
    }
    
    function renderOption(option, index, daysUntilAppointment, isAppointmentCalculation, startDate) {
        let description = '';
        if (option.type === 'uniform') {
            const dailyDose = option.combo.reduce((sum, p) => sum + (p.half ? p.mg * 0.5 * p.count : p.mg * p.count), 0);
            description = dailyDose > 0 ? `วันธรรมดา ${dailyDose.toFixed(1)} mg` : 'หยุดยา';
        } else {
            let parts = [];
            if(option.baseDose > 0) parts.push(`วันธรรมดา ${option.baseDose.toFixed(1)} mg`);
            if (option.numSpecialDays > 0) parts.push(`วันพิเศษ ${option.specialDose.toFixed(1)} mg (${option.specialDays.map(idx => daysName[idx]).join(', ')})`);
            if (option.numStopDays > 0) parts.push(`หยุดยา ${option.numStopDays} วัน (${option.stopDays.map(idx => daysName[idx]).join(', ')})`);
            description = parts.join(', ');
        }

        const displayOrder = [6, 0, 1, 2, 3, 4, 5]; // Always start with Sunday
        const weeklyScheduleHtml = displayOrder.map(j => {
            const combo = option.type === 'uniform' ? option.combo : option.comboWeekly[j];
            let dayType = 'normal';
            if (option.type === 'non-uniform') {
                if (option.stopDays.includes(j)) dayType = 'stop';
                else if (option.specialDays.includes(j)) dayType = 'special';
            }
            return renderDay(j, combo, dayType);
        }).join('');

        const totalPillsHeader = isAppointmentCalculation ? `รวมยาสำหรับ ${daysUntilAppointment} วัน:` : 'รวมยาสำหรับ 1 สัปดาห์:';
        const pillsNeededMessage = calculateTotalPills(option, daysUntilAppointment, startDate);

        return `
            <div class="card result-option-card">
                 <div class="result-option-header">
                    <h3><strong>ตัวเลือก ${index + 1}:</strong> ${description} (รวม ${option.weeklyDoseActual.toFixed(1)} mg/สัปดาห์)</h3>
                </div>
                <div class="weekly-schedule-grid">${weeklyScheduleHtml}</div>
                <div class="result-option-footer">
                    <h4>${totalPillsHeader}</h4>
                    <div class="pill-summary">${pillsNeededMessage}</div>
                </div>
            </div>`;
    }

    function renderDay(idx, combo, dayType) {
        const dayStyles = {
            0: { name: 'จ.', colorClass: 'day-header-yellow' },
            1: { name: 'อ.', colorClass: 'day-header-pink' },
            2: { name: 'พ.', colorClass: 'day-header-green' },
            3: { name: 'พฤ.', colorClass: 'day-header-orange' },
            4: { name: 'ศ.', colorClass: 'day-header-sky' },
            5: { name: 'ส.', colorClass: 'day-header-purple' },
            6: { name: 'อา.', colorClass: 'day-header-red' }
        };

        let visualPills = '', textPillsArr = [], dayDose = 0;
        if (combo && combo.length > 0) {
            combo.forEach(p => {
                dayDose += p.half ? p.mg * 0.5 * p.count : p.mg * p.count;
                if (p.half) {
                    for (let k = 0; k < p.count; k++) visualPills += `<span class="pill pill-${p.mg} pill-half-left"></span>`;
                    if (p.count > 0) textPillsArr.push(`${p.mg} mg x(ครึ่ง)`);
                } else {
                    for (let k = 0; k < p.count; k++) visualPills += `<span class="pill pill-${p.mg}"></span>`;
                    if (p.count > 0) textPillsArr.push(`${p.mg} mg x${p.count}`);
                }
            });
        }

        const containerClasses = `day-card ${dayType === 'special' ? 'day-card--special' : ''}`;
        let contentHtml;

        if (dayType === 'stop' || dayDose < FLOAT_TOLERANCE) {
            contentHtml = `
                <div class="day-card-header ${dayStyles[idx].colorClass}">${dayStyles[idx].name}</div>
                <div class="day-card-body day-card-body--stop">
                    <div>หยุดยา</div>
                </div>`;
        } else {
            const textPillsHtml = textPillsArr.join('<br>');
            contentHtml = `
                <div class="day-card-header ${dayStyles[idx].colorClass}">${dayStyles[idx].name}</div>
                <div class="day-card-body">
                    <div class="day-dose">(${dayDose.toFixed(1)} mg)</div>
                    <div class="pill-display">${visualPills}</div>
                    <div class="pill-text">${textPillsHtml}</div>
                </div>`;
        }

        return `<div class="${containerClasses}">${contentHtml}</div>`;
    }
    
    function findComb(target, availablePills, allowHalf, minPillObjects, maxPillObjects) {
        const resultCombos = [], seenKeys = new Set();
        if (Math.abs(target) < FLOAT_TOLERANCE) return minPillObjects === 0 ? [[]] : [];
        
        function findRecursive(currentDose, currentCombo, pillIndex) {
            if (currentCombo.length > maxPillObjects || currentDose > target + FLOAT_TOLERANCE) return;
            
            if (Math.abs(currentDose - target) < FLOAT_TOLERANCE) {
                if (currentCombo.length >= minPillObjects) {
                    const aggregated = aggregateCombo(currentCombo);
                    const key = JSON.stringify(aggregated.sort((a, b) => a.mg - b.mg));
                    if (!seenKeys.has(key) && !aggregated.some(p => p.half && p.count > 1)) {
                        resultCombos.push(aggregated);
                        seenKeys.add(key);
                    }
                }
                return;
            }
            
            if (pillIndex >= availablePills.length) return;
            
            const pillMg = availablePills[pillIndex];
            
            currentCombo.push({ mg: pillMg, half: false }); findRecursive(currentDose + pillMg, currentCombo, pillIndex); currentCombo.pop();
            if (allowHalf) { currentCombo.push({ mg: pillMg, half: true }); findRecursive(currentDose + pillMg / 2, currentCombo, pillIndex); currentCombo.pop(); }
            findRecursive(currentDose, currentCombo, pillIndex + 1);
        }
        
        findRecursive(0, [], 0);

        if (resultCombos.length <= 1) {
            return resultCombos;
        }

        let minPills = Infinity;
        resultCombos.forEach(combo => {
            const totalPills = combo.reduce((sum, pill) => sum + pill.count, 0);
            if (totalPills < minPills) {
                minPills = totalPills;
            }
        });

        return resultCombos.filter(combo => {
            const totalPills = combo.reduce((sum, pill) => sum + pill.count, 0);
            return totalPills === minPills;
        });
    }
    
    function aggregateCombo(combo) {
        const aggregated = {};
        combo.forEach(pill => {
            const key = `${pill.mg}-${pill.half}`;
            if (!aggregated[key]) aggregated[key] = { mg: pill.mg, half: pill.half, count: 0 };
            aggregated[key].count++;
        });
        return Object.values(aggregated);
    }

    function getHalfPillComplexity(o) {
        const halfPillStrengths = new Set();
        (o.type === 'uniform' ? [o.combo] : (o.comboWeekly || [])).forEach(day => day && day.forEach(p => p.half && halfPillStrengths.add(p.mg)));
        return halfPillStrengths.size;
    }
    function countPillColors(o) {
        const colors = new Set();
        (o.type === 'uniform' ? [o.combo] : (o.comboWeekly || [])).forEach(day => day && day.forEach(p => (p.count > 0 || p.half) && colors.add(p.mg)));
        return colors.size;
    }
    function countTotalPillObjects(o) {
        const daily = (day) => day ? day.reduce((s, p) => s + p.count, 0) : 0;
        return o.type === 'uniform' ? daily(o.combo) * 7 : (o.comboWeekly || []).reduce((s, d) => s + daily(d), 0);
    }
    
    function calculateTotalPills(option, daysUntilAppointment, startDate) {
        let totalPills = { 1: { whole: 0, half: 0 }, 2: { whole: 0, half: 0 }, 3: { whole: 0, half: 0 }, 4: { whole: 0, half: 0 }, 5: { whole: 0, half: 0 } };
        const startJsDayIndex = startDate ? startDate.getDay() : 0;
        for (let day = 0; day < daysUntilAppointment; day++) {
            const combo = option.type === 'uniform' ? option.combo : option.comboWeekly[getThaiDayIndex((startJsDayIndex + day) % 7)];
            if (combo) {
                combo.forEach(p => {
                    if (p.half) {
                        totalPills[p.mg].half += p.count;
                    } else {
                        totalPills[p.mg].whole += p.count;
                    }
                });
            }
        }
        let message = '';
        [5, 4, 3, 2, 1].forEach(mg => {
            if (totalPills[mg].half > 0) {
                const actualUsed = totalPills[mg].half * 0.5;
                message += `<div class="summary-item">
                    <span class="pill pill-${mg} pill-half-left"></span>
                    <span><strong>${mg}mg:</strong> ${totalPills[mg].half} เม็ด (ใช้จริง ${actualUsed.toFixed(1)} เม็ด)</span>
                </div>`;
            }
            if (totalPills[mg].whole > 0) {
                message += `<div class="summary-item">
                    <span class="pill pill-${mg}"></span>
                    <span><strong>${mg}mg:</strong> ${totalPills[mg].whole} เม็ด</span>
                </div>`;
            }
        });
        return message || '<span>ไม่ต้องจ่ายยา</span>';
    }

    function getAppointmentInfo() {
        let days = 7, isCalc = false, start = null;
        if (appointmentToggle.checked) {
            if (startDateInput.value && endDateInput.value) {
                const startDt = new Date(startDateInput.value), endDt = new Date(endDateInput.value);
                startDt.setHours(0,0,0,0); endDt.setHours(0,0,0,0);
                if (endDt > startDt) { days = Math.round((endDt - startDt) / (1000 * 3600 * 24)); isCalc = true; start = startDt; }
            }
        }
        return { daysUntilAppointment: days, isAppointmentCalculation: isCalc, startDate: start };
    }
    
    function updateAppointmentDaysDisplay() {
        const { daysUntilAppointment, isAppointmentCalculation } = getAppointmentInfo();
        daysResultDiv.textContent = isAppointmentCalculation ? `คำนวณสำหรับ ${daysUntilAppointment} วัน` : '';
        generateSuggestions();
    }

    const debouncedGenerateSuggestions = debounce(generateSuggestions);
    showBtn.addEventListener('click', generateSuggestions);
    previousDoseInput.addEventListener('input', generateDoseAdjustmentTable);
    weeklyDoseInput.addEventListener('input', () => {
        displayPercentageChange();
        debouncedGenerateSuggestions();
    });
    
    appointmentToggle.addEventListener('change', () => {
        appointmentFields.classList.toggle('hidden', !appointmentToggle.checked);
        if (appointmentToggle.checked && !startDateInput.value) {
            const today = new Date();
            startDateInput.value = today.toISOString().split('T')[0];
        }
        updateAppointmentDaysDisplay();
    });

    startDateInput.addEventListener('change', updateAppointmentDaysDisplay);
    endDateInput.addEventListener('change', updateAppointmentDaysDisplay);
    
    // Corrected to include all interactive elements that should trigger a recalculation
    document.querySelectorAll('input[name="specialDayPattern"], .pill-checkbox, #allowHalf').forEach(el => {
        el.addEventListener('change', generateSuggestions);
    });
    
    generateDoseAdjustmentTable();
});

