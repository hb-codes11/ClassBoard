/**
 * ClassBoard Grade & SGPA/CGPA Planner (Tester Space)
 * Supports Semester 1 and Semester 2 with credit-weighted calculation,
 * official grade scale (admitted 2025 onwards), editable credits/marks,
 * and persistent state across tabs and sessions.
 */
(() => {
  const STORAGE_KEY = 'classboard_tester_grade_planner_v1';

  const DEFAULT_SCALE = { 10: 90, 9: 80, 8: 70, 7: 60, 6: 50, 5: 40, 4: 35 };

  const GRADE_LABELS = {
    10: 'O',
    9: 'A+',
    8: 'A',
    7: 'B+',
    6: 'B',
    5: 'C',
    4: 'P',
    0: 'F'
  };

  const THEORY_SCHEME = [
    ['MST', 20],
    ['Attendance', 5],
    ['Conduct', 5],
    ['End semester', 50],
    ['Recap', 10],
    ['Course proficiency', 10]
  ];

  const PRACTICAL_SCHEME = [
    ['Attendance', 10],
    ['Conduct', 10],
    ['File', 20],
    ['Viva', 40],
    ['Course proficiency', 20]
  ];

  const CPP_PRACTICAL_SCHEME = [
    ['Attendance', 10],
    ['Conduct', 10],
    ['File', 20],
    ['Viva', 40],
    ['Course proficiency', 10],
    ['Lab assessment', 10]
  ];

  const SWAYAM_SCHEME = [
    ['Online assignments', 30],
    ['Proctored exam', 70]
  ];

  const MENTORSHIP_SCHEME = [
    ['Mentorship evaluation', 100]
  ];

  // Semester 1 (Odd Semester - Dec 2025)
  // CL3018P & LN3003T are audit/qualifying (Grade X in official slip; 0 earned credits)
  const SEM1_COURSES = [
    { code: 'CL3018P', name: 'Sports Club', kind: 'P', credit: 1.0, isAudit: true },
    { code: 'CS3004P', name: 'Object Oriented Programming with C++', kind: 'P', credit: 1.0 },
    { code: 'CS3004T', name: 'Object Oriented Programming with C++', kind: 'T', credit: 3.0 },
    { code: 'EC3002P', name: 'Electronic Circuit Fundamentals', kind: 'P', credit: 1.0 },
    { code: 'EC3002T', name: 'Electronic Circuit Fundamentals', kind: 'T', credit: 3.0 },
    { code: 'LN3001P', name: 'Communication Skills', kind: 'P', credit: 1.0 },
    { code: 'LN3001T', name: 'Communication Skills', kind: 'T', credit: 2.0 },
    { code: 'LN3003T', name: 'Foreign Language', kind: 'T', credit: 1.0, isAudit: true },
    { code: 'MA3001T', name: 'Engineering Mathematics - I', kind: 'T', credit: 4.0 },
    { code: 'ME3003P', name: 'Engineering Graphics', kind: 'P', credit: 1.0 },
    { code: 'ME3003T', name: 'Engineering Graphics', kind: 'T', credit: 1.0 },
    { code: 'PH3001P', name: 'Applied Physics', kind: 'P', credit: 1.0 },
    { code: 'PH3001T', name: 'Applied Physics', kind: 'T', credit: 3.0 },
    { code: 'UC3001T', name: 'Mentorship-I', kind: 'T', credit: 0.25, isMentorship: true }
  ];

  // Semester 2 (Even Semester - May 2026)
  // LN3003T & LN3004T are audit/qualifying (Grade X in official slip; 0 earned credits)
  const SEM2_COURSES = [
    { code: 'CH3001P', name: 'Applied Chemistry', kind: 'P', credit: 1.0 },
    { code: 'CH3001T', name: 'Applied Chemistry', kind: 'T', credit: 2.0 },
    { code: 'CS3002P', name: 'Python Programming', kind: 'P', credit: 1.0 },
    { code: 'CS3002T', name: 'Python Programming', kind: 'T', credit: 3.0 },
    { code: 'CS3010P', name: 'Data Structures using C++', kind: 'P', credit: 1.0, isCpp: true },
    { code: 'CS3010T', name: 'Data Structures using C++', kind: 'T', credit: 3.0 },
    { code: 'CS3011P', name: 'Database Management System', kind: 'P', credit: 1.0 },
    { code: 'CS3011T', name: 'Database Management System', kind: 'T', credit: 3.0 },
    { code: 'LN3003T', name: 'Foreign Language', kind: 'T', credit: 1.0, isAudit: true },
    { code: 'LN3004T', name: 'Indian Language', kind: 'T', credit: 1.0, isAudit: true },
    { code: 'MA3002T', name: 'Engineering Mathematics – II', kind: 'T', credit: 4.0 },
    { code: 'ME3002P', name: 'Engineering Workshop', kind: 'P', credit: 1.0 },
    { code: 'UC3002T', name: 'Mentorship – II', kind: 'T', credit: 0.25, isMentorship: true }
  ];

  const COLOR_PALETTES = [
    { accent: '#168BFF', bg: '#e5f1ff' },
    { accent: '#0a7f5a', bg: '#def6ec' },
    { accent: '#8957d8', bg: '#f3eaff' },
    { accent: '#d8a20b', bg: '#fff3cf' },
    { accent: '#df4c55', bg: '#fdeceb' },
    { accent: '#14b8a6', bg: '#e6f9f6' }
  ];

  let state = {
    activeTab: 'sem2', // 'sem1' or 'sem2'
    scale: { ...DEFAULT_SCALE },
    targetType: 'sgpa',
    targetGpa: 8.0,
    priorGpa: '',
    priorCredits: '',
    sem1: {
      marks: {},
      selected: {},
      customCredits: {}
    },
    sem2: {
      marks: {},
      selected: {},
      customCredits: {}
    }
  };

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = {
          ...state,
          ...parsed,
          scale: { ...DEFAULT_SCALE, ...(parsed.scale || {}) },
          sem1: { ...state.sem1, ...(parsed.sem1 || {}) },
          sem2: { ...state.sem2, ...(parsed.sem2 || {}) }
        };
      }
    } catch (e) {
      console.warn('Could not load grade planner state from localStorage:', e);
    }
  }

  function saveCurrentState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save grade planner state to localStorage:', e);
    }
  }

  function getCourseComponents(course) {
    if (course.isAudit) return SWAYAM_SCHEME;
    if (course.isMentorship) return MENTORSHIP_SCHEME;
    if (course.kind === 'P') {
      return course.isCpp ? CPP_PRACTICAL_SCHEME : PRACTICAL_SCHEME;
    }
    return THEORY_SCHEME;
  }

  function getGradeInfo(totalMarks, scale) {
    for (let gp = 10; gp >= 4; gp--) {
      if (totalMarks >= scale[gp]) {
        return { gp, label: GRADE_LABELS[gp] };
      }
    }
    return { gp: 0, label: 'F' };
  }

  function renderScaleInputs(container) {
    if (!container) return;
    container.replaceChildren();
    for (let gp = 10; gp >= 4; gp--) {
      const wrap = document.createElement('label');
      wrap.className = 'planner-scale-item';
      wrap.innerHTML = `
        <span class="planner-scale-label">Grade ${GRADE_LABELS[gp]} (${gp} GP)</span>
        <input class="text-field planner-scale-input" type="number" min="0" max="100" step="1" value="${state.scale[gp]}" data-scale-gp="${gp}" aria-label="Minimum marks for Grade ${GRADE_LABELS[gp]}">
      `;
      wrap.querySelector('input').addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (!isNaN(val)) {
          state.scale[gp] = val;
          saveCurrentState();
          recalculate();
        }
      });
      container.append(wrap);
    }
  }

  function renderCourseCards(courses, semKey, container) {
    if (!container) return;
    container.replaceChildren();
    const semData = state[semKey];

    courses.forEach((course, idx) => {
      const isSelected = semData.selected[course.code] !== undefined ? semData.selected[course.code] : !course.isAudit;
      const currentCredit = semData.customCredits[course.code] !== undefined ? semData.customCredits[course.code] : course.credit;
      const palette = COLOR_PALETTES[idx % COLOR_PALETTES.length];
      const components = getCourseComponents(course);

      const card = document.createElement('details');
      card.className = `planner-subject-card ${isSelected ? '' : 'unselected'}`;
      card.dataset.courseCode = course.code;
      card.dataset.sem = semKey;
      card.style.setProperty('--card-accent', palette.accent);
      card.style.setProperty('--card-tint', palette.bg);

      card.innerHTML = `
        <summary class="planner-subject-summary">
          <input class="planner-course-checkbox" type="checkbox" aria-label="Include ${course.name} in calculation" ${isSelected ? 'checked' : ''}>
          <div class="planner-subject-icon">${course.kind === 'P' ? 'LAB' : 'TH'}</div>
          <div class="planner-subject-header">
            <div class="planner-subject-name">${course.name}</div>
            <div class="planner-subject-meta">${course.code} · ${course.kind === 'P' ? 'Practical' : 'Theory'} ${course.isAudit ? '· Audit/SWAYAM' : ''}</div>
          </div>
          <div class="planner-subject-badge-wrap">
            <span class="planner-grade-badge" data-course-grade>—</span>
            <div class="planner-credit-pill" title="Click to edit credits">
              <span class="planner-credit-display">${currentCredit} cr</span>
              <input class="planner-credit-input" type="number" step="0.25" min="0" max="10" value="${currentCredit}" aria-label="Credits for ${course.name}" hidden>
            </div>
          </div>
        </summary>
        <div class="planner-marks-body">
          <div class="planner-marks-notice">
            ${course.isAudit ? 'SWAYAM / Audit Course: Grade X does not earn SGPA credits on official slips unless registered for credit.' : 'Enter marks received so far; leave future components blank to calculate your target trajectory.'}
          </div>
          <div class="planner-marks-grid"></div>
        </div>
      `;

      // Checkbox handler
      const checkbox = card.querySelector('.planner-course-checkbox');
      checkbox.addEventListener('click', (e) => e.stopPropagation());
      checkbox.addEventListener('change', () => {
        semData.selected[course.code] = checkbox.checked;
        card.classList.toggle('unselected', !checkbox.checked);
        saveCurrentState();
        recalculate();
      });

      // Editable credit pill
      const creditPill = card.querySelector('.planner-credit-pill');
      const creditDisplay = card.querySelector('.planner-credit-display');
      const creditInput = card.querySelector('.planner-credit-input');

      creditPill.addEventListener('click', (e) => {
        e.stopPropagation();
        if (creditInput.hidden) {
          creditInput.hidden = false;
          creditDisplay.hidden = true;
          creditInput.focus();
          creditInput.select();
        }
      });

      const commitCredit = () => {
        const val = parseFloat(creditInput.value);
        if (!isNaN(val) && val >= 0) {
          semData.customCredits[course.code] = val;
          creditDisplay.textContent = `${val} cr`;
        } else {
          creditInput.value = currentCredit;
        }
        creditInput.hidden = true;
        creditDisplay.hidden = false;
        saveCurrentState();
        recalculate();
      };

      creditInput.addEventListener('click', (e) => e.stopPropagation());
      creditInput.addEventListener('blur', commitCredit);
      creditInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitCredit();
        }
      });

      // Render mark fields
      const marksGrid = card.querySelector('.planner-marks-grid');
      components.forEach(([label, maxMarks]) => {
        const savedVal = semData.marks[course.code]?.[label] ?? '';
        const field = document.createElement('label');
        field.className = 'planner-mark-field';
        field.innerHTML = `
          <div class="planner-mark-label"><span>${label}</span> <span class="planner-mark-max">/ ${maxMarks}</span></div>
          <input class="text-field planner-mark-input" type="number" min="0" max="${maxMarks}" step="any" placeholder="—" value="${savedVal}" data-label="${label}" aria-label="${course.name} ${label}">
        `;

        const markInput = field.querySelector('input');
        markInput.addEventListener('input', () => {
          if (!semData.marks[course.code]) semData.marks[course.code] = {};
          if (markInput.value === '') {
            delete semData.marks[course.code][label];
          } else {
            semData.marks[course.code][label] = Number(markInput.value);
          }
          saveCurrentState();
          recalculate();
        });

        marksGrid.append(field);
      });

      container.append(card);
    });
  }

  function computeSemesterResults(courses, semKey) {
    const semData = state[semKey];
    const scale = state.scale;
    let registeredCredits = 0;
    let earnedCredits = 0;
    let weightedPoints = 0;
    let maxWeightedPoints = 0;
    let allComponentsFilled = true;
    let hasInvalidMark = false;
    const courseStats = [];

    courses.forEach((course) => {
      const isSelected = semData.selected[course.code] !== undefined ? semData.selected[course.code] : !course.isAudit;
      if (!isSelected) return;

      const credit = semData.customCredits[course.code] !== undefined ? semData.customCredits[course.code] : course.credit;
      const components = getCourseComponents(course);
      let knownMarks = 0;
      let remainingMarks = 0;
      let courseAllFilled = true;

      components.forEach(([label, maxMarks]) => {
        const val = semData.marks[course.code]?.[label];
        if (val === undefined || val === null || val === '') {
          remainingMarks += maxMarks;
          allComponentsFilled = false;
          courseAllFilled = false;
        } else {
          const num = Number(val);
          if (isNaN(num) || num < 0 || num > maxMarks) {
            hasInvalidMark = true;
          } else {
            knownMarks += num;
          }
        }
      });

      const currentGrade = getGradeInfo(knownMarks, scale);
      const maxGrade = getGradeInfo(knownMarks + remainingMarks, scale);

      registeredCredits += credit;
      weightedPoints += credit * currentGrade.gp;
      maxWeightedPoints += credit * maxGrade.gp;
      if (currentGrade.gp >= 4) earnedCredits += credit;

      courseStats.push({
        code: course.code,
        credit,
        knownMarks,
        remainingMarks,
        currentGrade,
        maxGrade,
        isFilled: courseAllFilled
      });
    });

    const sgpa = registeredCredits > 0 ? weightedPoints / registeredCredits : 0;
    const maxSgpa = registeredCredits > 0 ? maxWeightedPoints / registeredCredits : 0;

    return {
      registeredCredits,
      earnedCredits,
      weightedPoints,
      maxWeightedPoints,
      sgpa,
      maxSgpa,
      allComponentsFilled,
      hasInvalidMark,
      courseStats
    };
  }

  function recalculate() {
    const semKey = state.activeTab;
    const courses = semKey === 'sem1' ? SEM1_COURSES : SEM2_COURSES;
    const results = computeSemesterResults(courses, semKey);

    // Update grade badges on subject cards
    document.querySelectorAll(`.planner-subject-card[data-sem="${semKey}"]`).forEach((card) => {
      const code = card.dataset.courseCode;
      const stat = results.courseStats.find((s) => s.code === code);
      const gradeBadge = card.querySelector('[data-course-grade]');
      if (!stat || !gradeBadge) return;

      if (stat.knownMarks === 0 && stat.remainingMarks > 0) {
        gradeBadge.textContent = '—';
        gradeBadge.className = 'planner-grade-badge';
      } else {
        const label = stat.currentGrade.label;
        gradeBadge.textContent = `${label} · ${stat.currentGrade.gp} GP`;
        gradeBadge.className = `planner-grade-badge grade-${label.toLowerCase().replace('+', 'plus')}`;
      }
    });

    // Overview Stats
    const creditsEl = document.getElementById('plannerCredits');
    const projectionEl = document.getElementById('plannerProjection');
    const maximumEl = document.getElementById('plannerMaximum');
    const targetResultEl = document.getElementById('plannerTargetResult');

    if (creditsEl) creditsEl.textContent = results.registeredCredits.toFixed(2).replace(/\.00$/, '');

    if (projectionEl) {
      if (results.registeredCredits === 0) {
        projectionEl.textContent = '—';
      } else if (results.allComponentsFilled && !results.hasInvalidMark) {
        projectionEl.textContent = results.sgpa.toFixed(2);
      } else {
        // Partial SGPA preview
        projectionEl.innerHTML = `<span style="font-size:0.75em;opacity:0.85">${results.sgpa.toFixed(2)}</span> <span style="font-size:11px;font-weight:600;color:var(--muted)">(current)</span>`;
      }
    }

    if (maximumEl) {
      maximumEl.textContent = results.registeredCredits > 0 && !results.hasInvalidMark ? results.maxSgpa.toFixed(2) : '—';
    }

    // Cumulative Dual-Semester Summary
    const sem1Results = computeSemesterResults(SEM1_COURSES, 'sem1');
    const sem2Results = computeSemesterResults(SEM2_COURSES, 'sem2');
    const totalRegCredits = sem1Results.registeredCredits + sem2Results.registeredCredits;
    const totalWeighted = sem1Results.weightedPoints + sem2Results.weightedPoints;
    const combinedCgpa = totalRegCredits > 0 ? totalWeighted / totalRegCredits : 0;

    const cgpaDisplayEl = document.getElementById('plannerDualCgpa');
    if (cgpaDisplayEl) {
      cgpaDisplayEl.textContent = totalRegCredits > 0 ? combinedCgpa.toFixed(2) : '—';
    }
    const sem1SummaryEl = document.getElementById('plannerSem1Summary');
    if (sem1SummaryEl) sem1SummaryEl.textContent = `${sem1Results.sgpa.toFixed(2)} (${sem1Results.registeredCredits} cr)`;
    const sem2SummaryEl = document.getElementById('plannerSem2Summary');
    if (sem2SummaryEl) sem2SummaryEl.textContent = `${sem2Results.sgpa.toFixed(2)} (${sem2Results.registeredCredits} cr)`;

    // Target Calculation
    if (!targetResultEl) return;

    if (results.registeredCredits === 0) {
      targetResultEl.className = 'planner-target-result';
      targetResultEl.textContent = 'Select at least one course to calculate your target plan.';
      return;
    }

    if (results.hasInvalidMark) {
      targetResultEl.className = 'planner-target-result result-error';
      targetResultEl.textContent = 'Please check that all entered marks are between 0 and their maximums.';
      return;
    }

    const targetType = state.targetType;
    const targetVal = Number(state.targetGpa);
    const priorGpa = Number(state.priorGpa);
    const priorCredits = Number(state.priorCredits);

    if (isNaN(targetVal) || targetVal <= 0 || targetVal > 10) {
      targetResultEl.className = 'planner-target-result result-error';
      targetResultEl.textContent = 'Enter a target grade point between 4.0 and 10.0.';
      return;
    }

    let neededSgpa = targetVal;
    if (targetType === 'cgpa') {
      if (!state.priorGpa || !state.priorCredits || isNaN(priorGpa) || isNaN(priorCredits) || priorCredits <= 0) {
        targetResultEl.className = 'planner-target-result';
        targetResultEl.innerHTML = `Enter your previous cumulative CGPA and earned credits below, or click <strong>"Use Sem 1 SGPA"</strong> to test cumulative results.`;
        return;
      }
      neededSgpa = (targetVal * (priorCredits + results.registeredCredits) - priorGpa * priorCredits) / results.registeredCredits;
    }

    const fmt = (n) => n.toFixed(2);
    if (neededSgpa > results.maxSgpa + 1e-9) {
      targetResultEl.className = 'planner-target-result result-warning';
      targetResultEl.innerHTML = `
        <strong>Target not reachable:</strong> Requires <strong>${fmt(neededSgpa)} SGPA</strong> this semester, but your maximum achievable SGPA is <strong>${fmt(results.maxSgpa)}</strong>.
        Consider adjusting your target or verifying entered marks.
      `;
      return;
    }

    // Solve for required fraction of remaining marks
    let neededFraction = null;
    for (let step = 0; step <= 10000; step++) {
      const f = step / 10000;
      let simWeighted = 0;
      results.courseStats.forEach((cs) => {
        const simulatedScore = cs.knownMarks + cs.remainingMarks * f;
        const g = getGradeInfo(simulatedScore, state.scale);
        simWeighted += cs.credit * g.gp;
      });
      const simSgpa = simWeighted / results.registeredCredits;
      if (simSgpa + 1e-9 >= neededSgpa) {
        neededFraction = f;
        break;
      }
    }

    if (neededFraction === null) {
      targetResultEl.className = 'planner-target-result result-warning';
      targetResultEl.textContent = 'This target cannot be reached with the current marks.';
      return;
    }

    targetResultEl.className = 'planner-target-result result-success';
    if (neededFraction === 0) {
      targetResultEl.innerHTML = `
        ${targetType === 'cgpa' ? `Required semester SGPA: <strong>${fmt(neededSgpa)}</strong>. ` : ''}
        🎉 <strong>Target already met!</strong> Your currently entered marks already achieve this target on the official grading scale.
      `;
    } else {
      const percent = Math.ceil(neededFraction * 100);
      targetResultEl.innerHTML = `
        ${targetType === 'cgpa' ? `Required semester SGPA: <strong>${fmt(neededSgpa)}</strong>. ` : ''}
        🎯 <strong>Action Plan:</strong> Aim for approximately <strong>${percent}%</strong> of available marks in each remaining/blank component to hit your target.
      `;
    }
  }

  function prefillSampleVerificationData(semKey) {
    const semData = state[semKey];
    if (semKey === 'sem1') {
      // Sem 1 sample matching official slip: SGPA 7.98 (21.25 credits)
      // CS3004P (O:10), CS3004T (A:8), EC3002P (O:10), EC3002T (B+:7), LN3001P (A+:9), LN3001T (A:8),
      // MA3001T (B+:7), ME3003P (A:8), ME3003T (A:8), PH3001P (A+:9), PH3001T (A:8), UC3001T (O:10)
      semData.selected = { CL3018P: false, LN3003T: false };
      semData.marks = {
        CS3004P: { Attendance: 10, Conduct: 10, File: 20, Viva: 36, 'Course proficiency': 18 }, // 94 -> O
        CS3004T: { MST: 15, Attendance: 4, Conduct: 4, 'End semester': 36, Recap: 7, 'Course proficiency': 7 }, // 73 -> A
        EC3002P: { Attendance: 10, Conduct: 10, File: 20, Viva: 35, 'Course proficiency': 18 }, // 93 -> O
        EC3002T: { MST: 14, Attendance: 4, Conduct: 4, 'End semester': 31, Recap: 6, 'Course proficiency': 6 }, // 65 -> B+
        LN3001P: { Attendance: 9, Conduct: 9, File: 18, Viva: 32, 'Course proficiency': 16 }, // 84 -> A+
        LN3001T: { MST: 15, Attendance: 4, Conduct: 4, 'End semester': 35, Recap: 8, 'Course proficiency': 8 }, // 74 -> A
        MA3001T: { MST: 13, Attendance: 4, Conduct: 4, 'End semester': 30, Recap: 7, 'Course proficiency': 7 }, // 65 -> B+
        ME3003P: { Attendance: 8, Conduct: 8, File: 16, Viva: 30, 'Course proficiency': 15 }, // 77 -> A
        ME3003T: { MST: 15, Attendance: 4, Conduct: 4, 'End semester': 37, Recap: 7, 'Course proficiency': 8 }, // 75 -> A
        PH3001P: { Attendance: 9, Conduct: 9, File: 18, Viva: 33, 'Course proficiency': 16 }, // 85 -> A+
        PH3001T: { MST: 16, Attendance: 4, Conduct: 4, 'End semester': 36, Recap: 7, 'Course proficiency': 7 }, // 74 -> A
        UC3001T: { 'Mentorship evaluation': 95 } // 95 -> O
      };
    } else {
      // Sem 2 sample matching official slip: SGPA 9.21 (20.25 credits)
      // CH3001P (A+:9), CH3001T (A+:9), CS3002P (O:10), CS3002T (O:10), CS3010P (O:10), CS3010T (A+:9),
      // CS3011P (A+:9), CS3011T (O:10), MA3002T (A:8), ME3002P (A+:9), UC3002T (O:10)
      semData.selected = { LN3003T: false, LN3004T: false };
      semData.marks = {
        CH3001P: { Attendance: 9, Conduct: 9, File: 18, Viva: 32, 'Course proficiency': 16 }, // 84 -> A+
        CH3001T: { MST: 17, Attendance: 5, Conduct: 4, 'End semester': 41, Recap: 8, 'Course proficiency': 8 }, // 83 -> A+
        CS3002P: { Attendance: 10, Conduct: 10, File: 20, Viva: 37, 'Course proficiency': 18 }, // 95 -> O
        CS3002T: { MST: 18, Attendance: 5, Conduct: 5, 'End semester': 45, Recap: 9, 'Course proficiency': 9 }, // 91 -> O
        CS3010P: { Attendance: 10, Conduct: 10, File: 20, Viva: 36, 'Course proficiency': 9, 'Lab assessment': 9 }, // 94 -> O
        CS3010T: { MST: 16, Attendance: 5, Conduct: 4, 'End semester': 41, Recap: 8, 'Course proficiency': 8 }, // 82 -> A+
        CS3011P: { Attendance: 9, Conduct: 9, File: 18, Viva: 33, 'Course proficiency': 16 }, // 85 -> A+
        CS3011T: { MST: 19, Attendance: 5, Conduct: 5, 'End semester': 44, Recap: 9, 'Course proficiency': 9 }, // 91 -> O
        MA3002T: { MST: 15, Attendance: 4, Conduct: 4, 'End semester': 36, Recap: 8, 'Course proficiency': 7 }, // 74 -> A
        ME3002P: { Attendance: 9, Conduct: 9, File: 18, Viva: 32, 'Course proficiency': 16 }, // 84 -> A+
        UC3002T: { 'Mentorship evaluation': 96 } // 96 -> O
      };
    }
    saveCurrentState();
    initGradePlannerUI();
    if (window.showToast) window.showToast(`Loaded sample verification marks for ${semKey === 'sem1' ? 'Semester 1' : 'Semester 2'}.`);
  }

  function resetSemesterMarks(semKey) {
    state[semKey].marks = {};
    saveCurrentState();
    initGradePlannerUI();
    if (window.showToast) window.showToast(`Cleared marks for ${semKey === 'sem1' ? 'Semester 1' : 'Semester 2'}.`);
  }

  function initGradePlannerUI() {
    const sem1Container = document.getElementById('plannerSem1Subjects');
    const sem2Container = document.getElementById('plannerSem2Subjects');
    const scaleContainer = document.getElementById('plannerScale');

    if (scaleContainer) renderScaleInputs(scaleContainer);
    if (sem1Container) renderCourseCards(SEM1_COURSES, 'sem1', sem1Container);
    if (sem2Container) renderCourseCards(SEM2_COURSES, 'sem2', sem2Container);

    // Sync tab visibility
    const sem1Panel = document.getElementById('plannerPanelSem1');
    const sem2Panel = document.getElementById('plannerPanelSem2');
    const tabSem1Btn = document.getElementById('plannerTabSem1');
    const tabSem2Btn = document.getElementById('plannerTabSem2');

    if (sem1Panel && sem2Panel && tabSem1Btn && tabSem2Btn) {
      const isSem1 = state.activeTab === 'sem1';
      sem1Panel.hidden = !isSem1;
      sem2Panel.hidden = isSem1;
      tabSem1Btn.classList.toggle('active', isSem1);
      tabSem2Btn.classList.toggle('active', !isSem1);
    }

    // Sync Target inputs
    const targetTypeSelect = document.getElementById('plannerTargetType');
    const targetGpaInput = document.getElementById('plannerTargetGpa');
    const priorWrap = document.getElementById('plannerPriorWrap');
    const priorGpaInput = document.getElementById('plannerPriorGpa');
    const priorCreditsInput = document.getElementById('plannerPriorCredits');

    if (targetTypeSelect) targetTypeSelect.value = state.targetType;
    if (targetGpaInput) targetGpaInput.value = state.targetGpa;
    if (priorGpaInput) priorGpaInput.value = state.priorGpa;
    if (priorCreditsInput) priorCreditsInput.value = state.priorCredits;
    if (priorWrap) priorWrap.hidden = state.targetType !== 'cgpa';

    recalculate();
  }

  function setupEventListeners() {
    const tabSem1Btn = document.getElementById('plannerTabSem1');
    const tabSem2Btn = document.getElementById('plannerTabSem2');
    const toggleAllBtn = document.getElementById('plannerToggleAll');
    const targetTypeSelect = document.getElementById('plannerTargetType');
    const targetGpaInput = document.getElementById('plannerTargetGpa');
    const priorGpaInput = document.getElementById('plannerPriorGpa');
    const priorCreditsInput = document.getElementById('plannerPriorCredits');
    const importSem1GpaBtn = document.getElementById('plannerImportSem1Gpa');
    const sampleFillBtn = document.getElementById('plannerSampleFill');
    const resetMarksBtn = document.getElementById('plannerResetMarks');

    if (tabSem1Btn) {
      tabSem1Btn.addEventListener('click', () => {
        state.activeTab = 'sem1';
        saveCurrentState();
        initGradePlannerUI();
      });
    }

    if (tabSem2Btn) {
      tabSem2Btn.addEventListener('click', () => {
        state.activeTab = 'sem2';
        saveCurrentState();
        initGradePlannerUI();
      });
    }

    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => {
        const cards = document.querySelectorAll(`.planner-subject-card[data-sem="${state.activeTab}"]`);
        const anyClosed = Array.from(cards).some((c) => !c.open);
        cards.forEach((c) => { c.open = anyClosed; });
        toggleAllBtn.textContent = anyClosed ? 'Collapse all' : 'Expand all';
      });
    }

    if (targetTypeSelect) {
      targetTypeSelect.addEventListener('change', () => {
        state.targetType = targetTypeSelect.value;
        const priorWrap = document.getElementById('plannerPriorWrap');
        if (priorWrap) priorWrap.hidden = state.targetType !== 'cgpa';
        saveCurrentState();
        recalculate();
      });
    }

    if (targetGpaInput) {
      targetGpaInput.addEventListener('input', () => {
        state.targetGpa = targetGpaInput.value;
        saveCurrentState();
        recalculate();
      });
    }

    if (priorGpaInput) {
      priorGpaInput.addEventListener('input', () => {
        state.priorGpa = priorGpaInput.value;
        saveCurrentState();
        recalculate();
      });
    }

    if (priorCreditsInput) {
      priorCreditsInput.addEventListener('input', () => {
        state.priorCredits = priorCreditsInput.value;
        saveCurrentState();
        recalculate();
      });
    }

    if (importSem1GpaBtn) {
      importSem1GpaBtn.addEventListener('click', () => {
        const s1 = computeSemesterResults(SEM1_COURSES, 'sem1');
        if (s1.registeredCredits > 0) {
          state.priorGpa = s1.sgpa.toFixed(2);
          state.priorCredits = s1.registeredCredits.toFixed(2).replace(/\.00$/, '');
          if (priorGpaInput) priorGpaInput.value = state.priorGpa;
          if (priorCreditsInput) priorCreditsInput.value = state.priorCredits;
          saveCurrentState();
          recalculate();
          if (window.showToast) window.showToast(`Imported Sem 1 SGPA (${state.priorGpa}) & credits (${state.priorCredits})`);
        } else {
          if (window.showToast) window.showToast('No registered credits in Semester 1 to import.');
        }
      });
    }

    if (sampleFillBtn) {
      sampleFillBtn.addEventListener('click', () => {
        prefillSampleVerificationData(state.activeTab);
      });
    }

    if (resetMarksBtn) {
      resetMarksBtn.addEventListener('click', () => {
        if (confirm(`Clear all entered marks for ${state.activeTab === 'sem1' ? 'Semester 1' : 'Semester 2'}?`)) {
          resetSemesterMarks(state.activeTab);
        }
      });
    }
  }

  // Exported global for ClassBoard
  window.initClassboardGradePlanner = () => {
    loadSavedState();
    setupEventListeners();
    initGradePlannerUI();
  };

  // Run on page load if element is present
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('page-tester')) {
      window.initClassboardGradePlanner();
    }
  });
})();

