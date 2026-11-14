(() => {
  const grid = document.getElementById('attendanceCalendarGrid');
  const dialog = document.getElementById('calendarDayDialog');
  if (!grid || !dialog) return;

  const monthTitle = document.getElementById('attendanceCalendarMonthTitle');
  const batchSelect = document.getElementById('attendanceCalendarBatch');
  const classList = document.getElementById('calendarClassList');
  const dialogDate = document.getElementById('calendarDialogDate');
  const dialogSub = document.getElementById('calendarDialogSub');
  const resetButton = document.getElementById('resetCalendarDay');
  const addForm = document.getElementById('calendarAddForm');
  const calendarNote = document.getElementById('attendanceCalendarNote');
  const monthButtons = [...document.querySelectorAll('[data-calendar-month]')];
  const subjects = [
    { name: 'Software Engineering', short: 'SE' },
    { name: 'Statistical Analysis', short: 'SA' },
    { name: 'Computer Organisation & Microprocessors', short: 'COM' },
    { name: 'Java Programming', short: 'JAVA' },
    { name: 'Soft Skills-I', short: 'SS-I' },
    { name: 'Artificial Intelligence', short: 'AI' },
    { name: 'Mentoring-III', short: 'MEN' },
    { name: 'Data Structures using C++', short: 'DSC++' },
    { name: 'Machine Learning', short: 'ML' },
    { name: 'Object Oriented Programming using Java', short: 'JAVA' }
  ];
  const times = {
    first: ['08:30', '09:20'], second: ['09:20', '10:10'], third: ['10:20', '11:10'],
    fourth: ['11:10', '12:00'], sixth: ['12:50', '13:40'], seventh: ['13:40', '14:20'],
    morningLab: ['08:30', '10:10'], afternoonLab: ['12:50', '14:20'], afternoonTheory: ['13:40', '15:10']
  };
  const weekdaySchedule = {
    1: [
      ['Java Programming', 'lab', 'A1', ...times.first, 'L.V102'], ['Statistical Analysis', 'lab', 'A2', ...times.first, 'L.V015'],
      ['Java Programming', 'lab', 'A1', ...times.second, 'L.V102'], ['Statistical Analysis', 'lab', 'A2', ...times.second, 'L.V015'],
      ['Artificial Intelligence', 'lecture', 'all', ...times.third, 'V306'], ['Software Engineering', 'lecture', 'all', ...times.fourth, 'V306'],
      ['Statistical Analysis', 'lecture', 'all', ...times.sixth, 'V306'], ['Computer Organisation & Microprocessors', 'lecture', 'all', ...times.seventh, 'V306']
    ],
    2: [
      ['Java Programming', 'lecture', 'all', ...times.first, 'V306'], ['Computer Organisation & Microprocessors', 'lecture', 'all', ...times.second, 'V306'],
      ['Artificial Intelligence', 'lab', 'A1', ...times.third, 'L.V002'], ['Java Programming', 'lab', 'A2', ...times.third, 'L.V102'],
      ['Artificial Intelligence', 'lab', 'A1', ...times.fourth, 'L.V002'], ['Java Programming', 'lab', 'A2', ...times.fourth, 'L.V102'],
      ['Soft Skills-I', 'lecture', 'all', ...times.sixth, 'V306'], ['Soft Skills-I', 'lecture', 'all', ...times.seventh, 'V306']
    ],
    3: [
      ['Statistical Analysis', 'lab', 'A1', ...times.first, 'L.V015'], ['Computer Organisation & Microprocessors', 'lab', 'A2', ...times.first, 'B207'],
      ['Statistical Analysis', 'lab', 'A1', ...times.second, 'L.V015'], ['Computer Organisation & Microprocessors', 'lab', 'A2', ...times.second, 'B207'],
      ['Computer Organisation & Microprocessors', 'lecture', 'all', ...times.third, 'V306'], ['Software Engineering', 'lecture', 'all', ...times.fourth, 'V306'],
      ['Java Programming', 'lecture', 'all', ...times.sixth, 'V306'], ['Mentoring-III', 'lecture', 'all', ...times.seventh, 'V306']
    ],
    4: [
      ['Computer Organisation & Microprocessors', 'lab', 'A1', ...times.first, 'B207'], ['Software Engineering', 'lab', 'A2', ...times.first, 'L.V203'],
      ['Computer Organisation & Microprocessors', 'lab', 'A1', ...times.second, 'B207'], ['Software Engineering', 'lab', 'A2', ...times.second, 'L.V203'],
      ['Artificial Intelligence', 'lecture', 'all', ...times.third, 'V306'], ['Statistical Analysis', 'lecture', 'all', ...times.fourth, 'V306'],
      ['Java Programming', 'lecture', 'all', ...times.sixth, 'V306']
    ],
    5: [
      ['Java Programming', 'lecture', 'all', ...times.first, 'V306'], ['Statistical Analysis', 'lecture', 'all', ...times.second, 'V306'],
      ['Software Engineering', 'lecture', 'all', ...times.third, 'V306'],
      ['Software Engineering', 'lab', 'A1', ...times.sixth, 'L.V203'], ['Artificial Intelligence', 'lab', 'A2', ...times.sixth, 'L.V002'],
      ['Software Engineering', 'lab', 'A1', ...times.seventh, 'L.V203'], ['Artificial Intelligence', 'lab', 'A2', ...times.seventh, 'L.V002']
    ]
  };
  const intel2WeekdaySchedule = {
    1: [
      ['Computer Organisation & Microprocessors', 'lab', 'B1', ...times.morningLab, 'B207'],
      ['Artificial Intelligence', 'lab', 'B2', ...times.morningLab, 'L.V203'],
      ['Java Programming', 'lecture', 'all', ...times.third, 'V307'],
      ['Mentoring-III', 'lecture', 'all', ...times.fourth, ''],
      ['Software Engineering', 'lecture', 'all', ...times.afternoonTheory, 'V228']
    ],
    2: [
      ['Artificial Intelligence', 'lecture', 'all', ...times.first, 'V307'],
      ['Software Engineering', 'lecture', 'all', ...times.second, 'V307'],
      ['Java Programming', 'lecture', 'all', ...times.third, 'V307'],
      ['Statistical Analysis', 'lecture', 'all', ...times.fourth, 'V307'],
      ['Artificial Intelligence', 'lab', 'B1', ...times.afternoonLab, 'L.V203'],
      ['Computer Organisation & Microprocessors', 'lab', 'B2', ...times.afternoonLab, 'B207']
    ],
    3: [
      ['Computer Organisation & Microprocessors', 'lecture', 'all', ...times.first, 'V307'],
      ['Statistical Analysis', 'lecture', 'all', ...times.second, 'V307'],
      ['Software Engineering', 'lecture', 'all', ...times.third, 'V307'],
      ['Artificial Intelligence', 'lecture', 'all', ...times.fourth, 'V307'],
      ['Statistical Analysis', 'lab', 'B1', ...times.afternoonLab, 'L.V015'],
      ['Software Engineering', 'lab', 'B2', ...times.afternoonLab, 'L.V003']
    ],
    4: [
      ['Computer Organisation & Microprocessors', 'lecture', 'all', ...times.first, 'V307'],
      ['Statistical Analysis', 'lecture', 'all', ...times.second, 'V307'],
      ['Soft Skills-I', 'lecture', 'all', ...times.third, 'V307'],
      ['Soft Skills-I', 'lecture', 'all', ...times.fourth, 'V307'],
      ['Statistical Analysis', 'lab', 'B2', ...times.afternoonLab, 'L.V002'],
      ['Java Programming', 'lab', 'B1', ...times.afternoonLab, 'L.V102']
    ],
    5: [
      ['Java Programming', 'lecture', 'all', ...times.first, 'V307'],
      ['Statistical Analysis', 'lecture', 'all', ...times.second, 'V307'],
      ['Computer Organisation & Microprocessors', 'lecture', 'all', ...times.third, 'V307'],
      ['Software Engineering', 'lecture', 'all', ...times.fourth, 'V307'],
      ['Java Programming', 'lab', 'B2', ...times.afternoonLab, 'L.V102'],
      ['Software Engineering', 'lab', 'B1', ...times.afternoonLab, 'L.V015']
    ]
  };
  const ibmWeekdaySchedule = {
    1: [
      ['Machine Learning', 'lecture', 'all', ...times.first, 'V206'],
      ['Data Structures using C++', 'lecture', 'all', ...times.second, 'V206'],
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.third, 'V206'],
      ['Statistical Analysis', 'lecture', 'all', ...times.fourth, 'V206'],
      ['Statistical Analysis', 'lab', 'A1', ...times.afternoonLab, 'L.V015'],
      ['Machine Learning', 'lab', 'A2', ...times.afternoonLab, 'L.V103']
    ],
    2: [
      ['Software Engineering', 'lecture', 'all', ...times.first, 'V206'],
      ['Data Structures using C++', 'lecture', 'all', ...times.second, 'V206'],
      ['Soft Skills-I', 'lecture', 'all', ...times.third, 'V206'],
      ['Soft Skills-I', 'lecture', 'all', ...times.fourth, 'V206'],
      ['Object Oriented Programming using Java', 'lab', 'A1', ...times.afternoonLab, 'L.V102'],
      ['Statistical Analysis', 'lab', 'A2', ...times.afternoonLab, 'L.V015']
    ],
    3: [
      ['Machine Learning', 'lab', 'A1', ...times.morningLab, 'L.V103'],
      ['Object Oriented Programming using Java', 'lab', 'A2', ...times.morningLab, 'L.V102'],
      ['Data Structures using C++', 'lecture', 'all', ...times.third, 'V206'],
      ['Statistical Analysis', 'lecture', 'all', ...times.fourth, 'V206'],
      ['Software Engineering', 'lecture', 'all', ...times.sixth, 'V206'],
      ['Mentoring-III', 'lecture', 'all', ...times.seventh, 'V206']
    ],
    4: [
      ['Software Engineering', 'lab', 'A1', ...times.morningLab, 'L.V003'],
      ['Data Structures using C++', 'lab', 'A2', ...times.morningLab, 'L.V303'],
      ['Machine Learning', 'lecture', 'all', ...times.third, 'V206'],
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.fourth, 'V206'],
      ['Software Engineering', 'lecture', 'all', ...times.sixth, 'V206']
    ],
    5: [
      ['Data Structures using C++', 'lab', 'A1', ...times.morningLab, 'L.V303'],
      ['Software Engineering', 'lab', 'A2', ...times.morningLab, 'L.V003'],
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.third, 'V206'],
      ['Statistical Analysis', 'lecture', 'all', ...times.fourth, 'V206'],
      ['Machine Learning', 'lecture', 'all', ...times.sixth, 'V206']
    ]
  };
  const ibm2WeekdaySchedule = {
    1: [
      ['Software Engineering', 'lab', 'B1', ...times.morningLab, 'L.V003'],
      ['Data Structures using C++', 'lab', 'B2', ...times.morningLab, 'L.V002'],
      ['Statistical Analysis', 'lecture', 'all', ...times.third, 'V207'],
      ['Software Engineering', 'lecture', 'all', ...times.fourth, 'V207'],
      ['Machine Learning', 'lecture', 'all', ...times.sixth, 'V207']
    ],
    2: [
      ['Data Structures using C++', 'lab', 'B1', ...times.morningLab, 'L.V002'],
      ['Software Engineering', 'lab', 'B2', ...times.morningLab, 'L.V003'],
      ['Software Engineering', 'lecture', 'all', ...times.third, 'V207'],
      ['Data Structures using C++', 'lecture', 'all', ...times.fourth, 'V207'],
      ['Machine Learning', 'lecture', 'all', ...times.sixth, 'V207'],
      ['Statistical Analysis', 'lecture', 'all', ...times.seventh, 'V207']
    ],
    3: [
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.first, 'V207'],
      ['Data Structures using C++', 'lecture', 'all', ...times.second, 'V207'],
      ['Soft Skills-I', 'lecture', 'all', ...times.third, 'V207'],
      ['Soft Skills-I', 'lecture', 'all', ...times.fourth, 'V207'],
      ['Object Oriented Programming using Java', 'lab', 'B1', ...times.afternoonLab, 'L.V102'],
      ['Machine Learning', 'lab', 'B2', ...times.afternoonLab, 'L.V103']
    ],
    4: [
      ['Statistical Analysis', 'lab', 'B1', ...times.morningLab, 'L.V015'],
      ['Object Oriented Programming using Java', 'lab', 'B2', ...times.morningLab, 'L.V102'],
      ['Data Structures using C++', 'lecture', 'all', ...times.third, 'V207'],
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.fourth, 'V207'],
      ['Machine Learning', 'lecture', 'all', ...times.sixth, 'V207']
    ],
    5: [
      ['Machine Learning', 'lab', 'B1', ...times.morningLab, 'L.V103'],
      ['Statistical Analysis', 'lab', 'B2', ...times.morningLab, 'L.V015'],
      ['Mentoring-III', 'lecture', 'all', ...times.third, 'V207'],
      ['Statistical Analysis', 'lecture', 'all', ...times.fourth, 'V207'],
      ['Software Engineering', 'lecture', 'all', ...times.sixth, 'V207'],
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.seventh, 'V004']
    ]
  };
  const ibm3WeekdaySchedule = {
    1: [
      ['Software Engineering', 'lecture', 'all', ...times.first, 'V304'],
      ['Statistical Analysis', 'lecture', 'all', ...times.second, 'V205'],
      ['Mentoring-III', 'lecture', 'all', ...times.third, 'V304'],
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.fourth, 'V304'],
      ['Object Oriented Programming using Java', 'lab', 'C1', ...times.afternoonLab, 'L.V002'],
      ['Data Structures using C++', 'lab', 'C2', ...times.afternoonLab, 'L.V102']
    ],
    2: [
      ['Data Structures using C++', 'lecture', 'all', ...times.first, 'V304'],
      ['Statistical Analysis', 'lecture', 'all', ...times.second, 'V205'],
      ['Statistical Analysis', 'lab', 'C1', '10:20', '12:00', 'L.V015'],
      ['Software Engineering', 'lab', 'C2', '10:20', '12:00', 'L.V003'],
      ['Object Oriented Programming using Java', 'lab', 'C2', ...times.afternoonLab, 'L.V002'],
      ['Data Structures using C++', 'lab', 'C1', ...times.afternoonLab, 'L.V103']
    ],
    3: [
      ['Statistical Analysis', 'lecture', 'all', ...times.first, 'V205'],
      ['Software Engineering', 'lecture', 'all', ...times.second, 'V205'],
      ['Data Structures using C++', 'lecture', 'all', ...times.third, 'V304'],
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.sixth, 'V304'],
      ['Machine Learning', 'lecture', 'all', ...times.seventh, 'V304']
    ],
    4: [
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.first, 'V304'],
      ['Machine Learning', 'lecture', 'all', ...times.second, 'V304'],
      ['Machine Learning', 'lab', 'C1', '10:20', '12:00', 'L.V103'],
      ['Statistical Analysis', 'lab', 'C2', '10:20', '12:00', 'L.V015'],
      ['Soft Skills-I', 'lecture', 'all', ...times.sixth, 'V304'],
      ['Soft Skills-I', 'lecture', 'all', ...times.seventh, 'V304']
    ],
    5: [
      ['Machine Learning', 'lecture', 'all', ...times.first, 'V304'],
      ['Data Structures using C++', 'lecture', 'all', ...times.second, 'V304'],
      ['Software Engineering', 'lab', 'C1', '10:20', '12:00', 'L.V003'],
      ['Machine Learning', 'lab', 'C2', '10:20', '12:00', 'L.V103'],
      ['Software Engineering', 'lecture', 'all', ...times.sixth, 'V205']
    ]
  };
  const ibm4WeekdaySchedule = {
    1: [
      ['Machine Learning', 'lecture', 'all', ...times.first, 'V305'],
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.second, 'V305'],
      ['Soft Skills-I', 'lecture', 'all', ...times.third, 'V305'],
      ['Soft Skills-I', 'lecture', 'all', ...times.fourth, 'V305'],
      ['Software Engineering', 'lecture', 'all', ...times.sixth, 'V305'],
      ['Data Structures using C++', 'lecture', 'all', ...times.seventh, 'V305']
    ],
    2: [
      ['Statistical Analysis', 'lab', 'D1', ...times.morningLab, 'L.V015'],
      ['Object Oriented Programming using Java', 'lab', 'D2', ...times.morningLab, 'L.V102'],
      ['Machine Learning', 'lecture', 'all', ...times.third, 'V305'],
      ['Statistical Analysis', 'lecture', 'all', ...times.fourth, 'V305'],
      ['Software Engineering', 'lecture', 'all', ...times.sixth, 'V305'],
      ['Mentoring-III', 'lecture', 'all', ...times.seventh, 'V305']
    ],
    3: [
      ['Machine Learning', 'lecture', 'all', ...times.first, 'V305'],
      ['Software Engineering', 'lecture', 'all', ...times.second, 'V305'],
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.third, 'V305'],
      ['Statistical Analysis', 'lecture', 'all', ...times.fourth, 'V305'],
      ['Machine Learning', 'lab', 'D1', ...times.afternoonLab, 'L.V302'],
      ['Data Structures using C++', 'lab', 'D2', ...times.afternoonLab, 'L.V002']
    ],
    4: [
      ['Data Structures using C++', 'lab', 'D1', ...times.morningLab, 'L.V002'],
      ['Machine Learning', 'lab', 'D2', ...times.morningLab, 'L.V103'],
      ['Object Oriented Programming using Java', 'lecture', 'all', ...times.third, 'V305'],
      ['Data Structures using C++', 'lecture', 'all', ...times.fourth, 'V305'],
      ['Software Engineering', 'lab', 'D1', ...times.afternoonLab, 'L.V003'],
      ['Statistical Analysis', 'lab', 'D2', ...times.afternoonLab, 'L.V015']
    ],
    5: [
      ['Object Oriented Programming using Java', 'lab', 'D1', ...times.morningLab, 'L.V102'],
      ['Software Engineering', 'lab', 'D2', ...times.morningLab, 'L.V203'],
      ['Statistical Analysis', 'lecture', 'all', ...times.third, 'V305'],
      ['Data Structures using C++', 'lecture', 'all', ...times.fourth, 'V305']
    ]
  };
  const eventMap = {
    '2026-10-01': { label: 'MST-I', kind: 'exam' },
    '2026-10-02': { label: 'Gandhi Jayanti', kind: 'holiday' },
    '2026-10-03': { label: 'MST-I', kind: 'exam' },
    '2026-10-05': { label: 'SVAR test', kind: 'event' },
    '2026-10-20': { label: 'Vijayadashami', kind: 'holiday' },
    ...Object.fromEntries([6, 7, 8, 9, 10, 11].map((day) => [`2026-11-${String(day).padStart(2, '0')}`, { label: 'Deepawali break', kind: 'holiday' }])),
    '2026-11-14': { label: 'Compilation of Unit-3 & Unit-4 B1 soft skill online course', kind: 'event' },
    ...Object.fromEntries([16, 17, 18, 19, 20].map((day) => [`2026-11-${String(day).padStart(2, '0')}`, { label: 'MST-II', kind: 'exam' }])),
    '2026-11-21': { label: 'SHLAMCAT: AI mock interview', kind: 'event' },
    '2026-11-24': { label: 'Guru Nanak Jayanti', kind: 'holiday' },
    '2026-11-26': { label: 'Compilation of Unit-5 & B1 soft skill online course', kind: 'event' },
    '2026-11-27': { label: 'End of teaching', kind: 'term' },
    '2026-11-29': { label: 'Convocation', kind: 'convocation' }
  };
  const getInitialMonth = () => {
    try {
      const stored = sessionStorage.getItem('classboard-calendar-month') || localStorage.getItem('classboard-calendar-month');
      const parsed = Number(stored);
      if ([9, 10, 11].includes(parsed)) return parsed;
    } catch (_) {}
    return 10;
  };
  let activeMonth = getInitialMonth();
  let activeDateKey = '';
  let selectedClassId = '';
  let calendarOverrides = {};
  let calendarClassId = null;
  let calendarLoadId = 0;
  let sharedCalendarReady = false;
  let calendarChannel = null;

  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const mstExams = {
    '2026-11-16': ['JAVA', 'Java Programming', 'CS3024T'],
    '2026-11-17': ['AI', 'Artificial Intelligence', 'CS3023T'],
    '2026-11-18': ['COM', 'Computer Organization & Microprocessors', 'CS3005T'],
    '2026-11-19': ['SE', 'Software Engineering', 'CS3021T'],
    '2026-11-20': ['SA', 'Statistical Analysis', 'CS3020T']
  };
  const ibmMstExams = {
    '2026-11-16': ['DSC++', 'Data Structures using C++', 'CS3010T'],
    '2026-11-17': ['ML', 'Machine Learning', 'CS3022T'],
    '2026-11-18': ['JAVA', 'Object Oriented Programming using Java', 'CS3013T'],
    '2026-11-19': ['SE', 'Software Engineering', 'CS3021T'],
    '2026-11-20': ['SA', 'Statistical Analysis', 'CS3020T']
  };
  const endSemExams = {
    '2026-12-09': ['COM', 'Computer Organization & Microprocessors', 'CS3005T'],
    '2026-12-14': ['SA', 'Statistical Analysis', 'CS3020T'],
    '2026-12-17': ['SE', 'Software Engineering', 'CS3021T'],
    '2026-12-21': ['JAVA', 'Java Programming', 'CS3024T'],
    '2026-12-26': ['AI', 'Artificial Intelligence', 'CS3023T']
  };
  const ibmEndSemExams = {
    '2026-12-10': ['DSC++', 'Data Structures using C++', 'CS3010T'],
    '2026-12-14': ['SA', 'Statistical Analysis', 'CS3020T'],
    '2026-12-17': ['SE', 'Software Engineering', 'CS3021T'],
    '2026-12-21': ['JAVA', 'Object Oriented Programming using Java', 'CS3013T'],
    '2026-12-26': ['ML', 'Machine Learning', 'CS3022T']
  };
  const isIbmCode = (code = window.classboardContext?.classCode) => typeof code === 'string' && code.startsWith('IBM-');
  const eventForDate = (date) => {
    const key = dateKey(date);
    const code = window.classboardContext?.classCode;
    const mst = isIbmCode(code) ? ibmMstExams[key] : (code === 'INTEL-1' || code === 'INTEL-2') ? mstExams[key] : null;
    if (mst) return { label: 'MST-II', kind: 'exam', short: mst[0], subject: mst[1], code: mst[2], time: '9:30 AM–10:00 AM' };
    const exam = isIbmCode(code) ? ibmEndSemExams[key] : (code === 'INTEL-1' || code === 'INTEL-2') ? endSemExams[key] : null;
    if (exam) return { label: `End Sem · ${exam[0]}`, kind: 'exam', subject: exam[1], code: exam[2], time: '9:30 AM–12:30 PM' };
    return eventMap[key] || null;
  };
  const batchCodes = () => {
    const code = window.classboardContext?.classCode;
    if (code === 'INTEL-2' || code === 'IBM-2') return ['B1', 'B2'];
    if (code === 'IBM-3') return ['C1', 'C2'];
    if (code === 'IBM-4') return ['D1', 'D2'];
    return ['A1', 'A2'];
  };
  const setBatchOptions = (select) => {
    if (!select) return;
    const current = select.value;
    const batches = batchCodes();
    const options = batches.map((batch) => {
      const option = document.createElement('option'); option.value = batch; option.textContent = batch; return option;
    });
    select.replaceChildren(...options);
    select.value = batches.includes(current) ? current : batches[0];
  };
  const batchForRoll = (roll) => {
    const code = window.classboardContext?.classCode;
    const isSelfSelect = code === 'INTEL-2' || code === 'IBM-2' || code === 'IBM-3' || code === 'IBM-4';
    if (isSelfSelect) {
      const stored = window.classboardContext?.labBatch
        || (window.classboardContext?.classId && window.classboardContext?.userId
            ? localStorage.getItem(`classboard_student_batch:${window.classboardContext.classId}:${window.classboardContext.userId}`)
            : null);
      if (stored) return stored;
    }
    const [first, second] = batchCodes();
    const maxRoll = code === 'IBM-1' ? 67 : (code === 'IBM-2' || code === 'IBM-3' || code === 'IBM-4') ? 80 : 66;
    const split = (code === 'IBM-2' || code === 'IBM-3' || code === 'IBM-4') ? 40 : 32;
    return roll >= 1 && roll <= split ? first : roll > split && roll <= maxRoll ? second : null;
  };
  const contextKey = () => {
    const context = window.classboardContext;
    return `classboard-personal-calendar:${context?.classId || 'class'}:${context?.userId || 'guest'}`;
  };
  const readLegacyOverrides = () => {
    try { return JSON.parse(localStorage.getItem(contextKey()) || '{}') || {}; } catch { return {}; }
  };
  const currentSubjects = () => isIbmCode()
    ? subjects.filter(s => !['Computer Organisation & Microprocessors', 'Java Programming', 'Artificial Intelligence'].includes(s.name))
    : subjects.filter(s => !['Data Structures using C++', 'Machine Learning', 'Object Oriented Programming using Java'].includes(s.name));
  const subjectInfo = (name) => subjects.find((subject) => subject.name === name) || { name, short: name.slice(0, 6).toUpperCase() };
  const canEditCalendar = () => sharedCalendarReady && (window.classboardContext?.roles?.some((role) => role === 'cr' || role === 'admin') || false);
  const createClass = ([subject, kind, batch, start, end, room], id) => ({ id, subject, kind, batch, start, end, room });
  const defaultClasses = (date) => {
    const event = eventForDate(date);
    if (['holiday', 'convocation', 'exam'].includes(event?.kind) || dateKey(date) > '2026-11-27') return [];
    const code = window.classboardContext?.classCode;
    const schedule =
      code === 'IBM-1' ? ibmWeekdaySchedule :
      code === 'IBM-2' ? ibm2WeekdaySchedule :
      code === 'IBM-3' ? ibm3WeekdaySchedule :
      code === 'IBM-4' ? ibm4WeekdaySchedule :
      code === 'INTEL-2' ? intel2WeekdaySchedule :
      weekdaySchedule;
    return (schedule[date.getDay()] || []).map((item, index) => createClass(item, `base-${date.getDay()}-${index}`));
  };
  const classesForDate = (date, overrides = calendarOverrides) => {
    const event = eventForDate(date);
    if (['holiday', 'convocation', 'exam'].includes(event?.kind) || dateKey(date) > '2026-11-27') return [];
    return Object.hasOwn(overrides, dateKey(date)) ? overrides[dateKey(date)] : defaultClasses(date);
  };
  const visibleClasses = (classes) => classes.filter((item) => item.kind !== 'lab' || item.batch === batchSelect.value);
  const calendarLabels = (date, classes) => {
    const event = eventForDate(date);
    const labels = [];
    if (event) labels.push(event.label);
    if (event?.short) labels.push(event.short);
    const unique = new Set();
    visibleClasses(classes).forEach((item) => {
      const subject = subjectInfo(item.subject);
      const label = `${subject.short}${item.kind === 'lab' ? ' (P)' : ''}`;
      if (!unique.has(label)) { unique.add(label); labels.push(label); }
    });
    return labels.slice(0, 5);
  };

  function renderCalendar() {
    const year = 2026;
    const month = activeMonth;
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const overrides = calendarOverrides;
    const highlights = document.querySelector('.attendance-calendar-highlights');
    if (highlights) highlights.hidden = month === 11;
    if (monthTitle) monthTitle.textContent = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    monthButtons.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.calendarMonth) === month)));
    if (!grid) return;
    grid.replaceChildren();
    for (let index = 0; index < firstWeekday; index += 1) {
      const empty = document.createElement('span'); empty.className = 'attendance-day empty'; empty.setAttribute('aria-hidden', 'true'); grid.append(empty);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const key = dateKey(date);
      const event = eventForDate(date);
      const classes = classesForDate(date, overrides);
      const button = document.createElement('button');
      button.type = 'button';
      const hasVisibleOverride = key <= '2026-11-27' && Object.hasOwn(overrides, key) && !['holiday', 'convocation', 'exam'].includes(event?.kind);
      button.className = `attendance-day${date.getDay() === 0 || date.getDay() === 6 ? ' weekend' : ''}${event ? ` ${event.kind}` : ''}${hasVisibleOverride ? ' modified' : ''}${activeDateKey === key ? ' selected' : ''}`;
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', `${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${event ? `, ${event.label}${event.subject ? `, ${event.subject}, ${event.time}` : ''}` : ''}${hasVisibleOverride ? ', edited' : ''}`);
      const number = document.createElement('span'); number.className = 'attendance-day-number'; number.textContent = String(day); button.append(number);
      calendarLabels(date, classes).forEach((label) => {
        const eventLabel = label === event?.label;
        const line = document.createElement('span'); line.className = 'attendance-day-label'; line.textContent = label;
        if (eventLabel && event?.kind === 'term') line.dataset.eventKind = 'term';
        if (!eventLabel) line.dataset.classType = label.endsWith(' (P)') ? 'practical' : 'lecture';
        const short = label.split(' ')[0];
        const color = { AI: 'ai', ML: 'ai', JAVA: 'java', COM: 'com', 'DSC++': 'com', SE: 'se', SA: 'sa' }[short];
        if (!eventLabel && color) line.dataset.color = color;
        if (eventLabel || classes.length) line.title = label;
        button.append(line);
      });
      button.addEventListener('click', () => openDay(date));
      grid.append(button);
    }
  }

  function buildSelect(options, selected) {
    const select = document.createElement('select');
    select.className = 'select-field';
    options.forEach(([value, label]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option);
    });
    select.value = selected;
    return select;
  }

  async function loadSharedCalendar() {
    const context = window.classboardContext;
    const client = window.classboardSupabase;
    const requestId = ++calendarLoadId;
    calendarClassId = context?.classId || null;
    sharedCalendarReady = false;
    calendarOverrides = {};
    if (calendarChannel && client) {
      client.removeChannel(calendarChannel);
      calendarChannel = null;
    }
    renderCalendar();
    if (!context?.classId || !client) {
      calendarNote.textContent = 'Sign in to view the shared class schedule.';
      return;
    }

    calendarNote.textContent = 'Loading the shared class calendar…';
    const { data, error } = await client.from('class_calendar_overrides')
      .select('calendar_date,classes').eq('class_id', context.classId);
    if (requestId !== calendarLoadId) return;
    if (error) {
      calendarNote.textContent = 'Shared calendar is unavailable. Apply Supabase migration 025 to enable class-wide edits.';
      return;
    }

    const localOverrides = readLegacyOverrides();
    const sharedDates = new Set((data || []).map((row) => row.calendar_date));
    const missingLocalRows = Object.entries(localOverrides)
      .filter(([calendarDate]) => !sharedDates.has(calendarDate))
      .map(([calendarDate, classes]) => ({
        class_id: context.classId,
        calendar_date: calendarDate,
        classes,
        updated_by: context.userId
      }));
    if (missingLocalRows.length) {
      const { error: syncError } = await client.from('class_calendar_overrides')
        .upsert(missingLocalRows, { onConflict: 'class_id,calendar_date', ignoreDuplicates: true });
      if (requestId !== calendarLoadId) return;
      if (syncError) {
        calendarNote.textContent = 'Could not publish your saved calendar edits. Apply Supabase migration 025, then reload.';
        return;
      }
    }
    if (requestId !== calendarLoadId) return;
    if (Object.keys(localOverrides).length) localStorage.removeItem(contextKey());
    const { data: currentRows, error: refreshError } = await client.from('class_calendar_overrides')
      .select('calendar_date,classes').eq('class_id', context.classId);
    if (requestId !== calendarLoadId) return;
    if (refreshError) {
      calendarNote.textContent = 'Could not refresh the shared calendar. Please reload the page.';
      return;
    }
    calendarOverrides = Object.fromEntries((currentRows || []).map((row) => [row.calendar_date, row.classes]));
    sharedCalendarReady = true;
    calendarNote.textContent = canEditCalendar()
      ? 'Calendar changes are shared with your class.'
      : 'Select any date to view its shared class schedule.';
    renderCalendar();
    if (dialog.open && activeDateKey) renderDayDialog(new Date(`${activeDateKey}T12:00:00`));

    calendarChannel = client.channel(`class-calendar-${context.classId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'class_calendar_overrides', filter: `class_id=eq.${context.classId}`
      }, (change) => {
        const changedDate = change.new?.calendar_date || change.old?.calendar_date;
        if (!changedDate) return;
        if (change.eventType === 'DELETE') delete calendarOverrides[changedDate];
        else calendarOverrides[changedDate] = change.new.classes;
        renderCalendar();
        if (dialog.open && activeDateKey === changedDate) renderDayDialog(new Date(`${activeDateKey}T12:00:00`));
      }).subscribe();
  }

  async function persistClasses(classes) {
    if (!canEditCalendar()) return;
    const context = window.classboardContext;
    const { error } = await window.classboardSupabase.from('class_calendar_overrides').upsert({
      class_id: context.classId,
      calendar_date: activeDateKey,
      classes,
      updated_by: context.userId
    }, { onConflict: 'class_id,calendar_date' });
    if (error) {
      calendarNote.textContent = `Calendar change was not saved: ${error.message}`;
      return;
    }
    calendarOverrides[activeDateKey] = classes;
    calendarNote.textContent = 'Calendar changes are shared with your class.';
    renderCalendar();
    const date = new Date(`${activeDateKey}T12:00:00`);
    renderDayDialog(date);
  }

  function renderDayDialog(date) {
    const classes = visibleClasses(classesForDate(date));
    const event = eventForDate(date);
    const editable = canEditCalendar();
    dialogDate.textContent = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    dialogSub.textContent = event?.subject ? `${event.label} · ${event.time}` : [event?.label, `${classes.length} ${classes.length === 1 ? 'class' : 'classes'} for ${batchSelect.value}`].filter(Boolean).join(' · ');
    if (resetButton) {
      resetButton.hidden = !editable || Boolean(event?.subject) || dateKey(date) > '2026-11-27';
      resetButton.disabled = !Object.hasOwn(calendarOverrides, activeDateKey);
    }
    if (addForm) addForm.hidden = !editable || Boolean(event?.subject) || dateKey(date) > '2026-11-27';
    if (!classList) return;
    classList.replaceChildren();
    if (event?.subject) {
      const examRow = document.createElement('div'); examRow.className = 'list-row';
      const details = document.createElement('div'); details.className = 'list-main';
      const title = document.createElement('div'); title.className = 'list-title'; title.textContent = event.subject;
      const meta = document.createElement('div'); meta.className = 'list-detail'; meta.textContent = `${event.code} · Theory · ${event.time}`;
      details.append(title, meta); examRow.append(details); classList.append(examRow);
    }
    if (!classes.length && !event?.subject) {
      const empty = document.createElement('div'); empty.className = 'list-row'; empty.textContent = dateKey(date) > '2026-11-27' ? 'Teaching has ended for the semester.' : event?.kind === 'holiday' ? `${event.label} · No scheduled classes. Add a makeup class below if needed.` : 'No classes scheduled. Add a class below if needed.'; classList.append(empty);
    }
    classes.forEach((session) => {
      const row = document.createElement('article'); row.className = 'calendar-class-row';
      const main = document.createElement('div'); main.className = 'calendar-class-main';
      const title = document.createElement('div'); title.className = 'calendar-class-title'; title.textContent = subjectInfo(session.subject).name;
      const meta = document.createElement('div'); meta.className = 'calendar-class-meta';
      meta.textContent = `${session.start}–${session.end} · ${session.kind === 'lab' ? `Lab · ${session.batch}` : 'Lecture'}${session.room ? ` · ${session.room}` : ''}`;
      main.append(title, meta);
      if (!editable) { row.append(main); classList.append(row); return; }
      const actions = document.createElement('div'); actions.className = 'calendar-class-actions';
      const replaceButton = document.createElement('button'); replaceButton.type = 'button'; replaceButton.className = 'secondary-button'; replaceButton.textContent = 'Replace';
      const removeButton = document.createElement('button'); removeButton.type = 'button'; removeButton.className = 'secondary-button'; removeButton.textContent = 'Remove';
      actions.append(replaceButton, removeButton);
      const editForm = document.createElement('form'); editForm.className = 'calendar-class-edit'; editForm.hidden = true;
      const subjectSelect = buildSelect(currentSubjects().map((item) => [item.name, item.name]), session.subject);
      const kindSelect = buildSelect([['lecture', 'Lecture'], ['lab', 'Lab']], session.kind);
      const batchSelectEdit = buildSelect(batchCodes().map((batch) => [batch, `Lab batch ${batch}`]), session.batch === 'all' ? batchSelect.value : session.batch);
      const subjectLabel = document.createElement('label'); subjectLabel.className = 'field-label'; subjectLabel.textContent = 'Subject'; subjectLabel.append(subjectSelect);
      const kindLabel = document.createElement('label'); kindLabel.className = 'field-label'; kindLabel.textContent = 'Type'; kindLabel.append(kindSelect);
      const batchLabel = document.createElement('label'); batchLabel.className = 'field-label'; batchLabel.textContent = 'Lab batch'; batchLabel.append(batchSelectEdit); batchLabel.hidden = kindSelect.value !== 'lab';
      const formActions = document.createElement('div'); formActions.className = 'calendar-edit-actions';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'secondary-button'; cancel.textContent = 'Cancel';
      const save = document.createElement('button'); save.type = 'submit'; save.className = 'primary-button'; save.textContent = 'Save';
      formActions.append(cancel, save); editForm.append(subjectLabel, kindLabel, batchLabel, formActions);
      kindSelect.addEventListener('change', () => { batchLabel.hidden = kindSelect.value !== 'lab'; });
      replaceButton.addEventListener('click', () => { selectedClassId = session.id; editForm.hidden = !editForm.hidden; });
      cancel.addEventListener('click', () => { editForm.hidden = true; });
      removeButton.addEventListener('click', () => { void persistClasses(classesForDate(date).filter((item) => item.id !== session.id)); });
      editForm.addEventListener('submit', (eventObject) => {
        eventObject.preventDefault();
        if (selectedClassId !== session.id) return;
        const updated = { ...session, subject: subjectSelect.value, kind: kindSelect.value, batch: kindSelect.value === 'lab' ? batchSelectEdit.value : 'all' };
        void persistClasses(classesForDate(date).map((item) => item.id === session.id ? updated : item));
      });
      row.append(main, actions, editForm); classList.append(row);
    });
  }

  function openDay(date) {
    activeDateKey = dateKey(date);
    selectedClassId = '';
    renderCalendar();
    renderDayDialog(date);
    if (!dialog.open) dialog.showModal();
  }

  const addSubjectSelect = addForm?.elements?.subject;
  function updateSubjectOptions() {
    if (!addSubjectSelect) return;
    addSubjectSelect.replaceChildren(...currentSubjects().map((subject) => {
      const option = document.createElement('option'); option.value = subject.name; option.textContent = subject.name; return option;
    }));
  }
  updateSubjectOptions();
  const addKindSelect = addForm?.elements?.kind;
  const addBatchLabel = addForm?.querySelector('[data-calendar-add-batch]');
  if (batchSelect) setBatchOptions(batchSelect);
  if (addForm?.elements?.batch) setBatchOptions(addForm.elements.batch);
  if (addKindSelect && addBatchLabel) {
    addKindSelect.addEventListener('change', () => { addBatchLabel.hidden = addKindSelect.value !== 'lab'; });
  }
  if (addForm) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!activeDateKey || !canEditCalendar()) return;
      const values = new FormData(addForm);
      const start = String(values.get('start'));
      const end = String(values.get('end'));
      if (!start || !end || start >= end) { addForm.elements.end?.setCustomValidity('End time must be after start time.'); addForm.elements.end?.reportValidity(); return; }
      addForm.elements.end?.setCustomValidity('');
      const date = new Date(`${activeDateKey}T12:00:00`);
      const currentClasses = classesForDate(date);
      currentClasses.push({ id: `added-${Date.now()}`, subject: String(values.get('subject')), kind: String(values.get('kind')), batch: values.get('kind') === 'lab' ? String(values.get('batch')) : 'all', start, end, room: String(values.get('room') || '').trim() });
      addForm.reset(); if (addBatchLabel) addBatchLabel.hidden = true;
      void persistClasses(currentClasses);
    });
  }

  monthButtons.forEach((button) => button.addEventListener('click', () => {
    activeMonth = Number(button.dataset.calendarMonth);
    try {
      sessionStorage.setItem('classboard-calendar-month', String(activeMonth));
      localStorage.setItem('classboard-calendar-month', String(activeMonth));
    } catch (_) {}
    renderCalendar();
  }));
  if (batchSelect) {
    batchSelect.addEventListener('change', () => {
      renderCalendar();
      if (dialog?.open && activeDateKey) renderDayDialog(new Date(`${activeDateKey}T12:00:00`));
    });
  }
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      if (!canEditCalendar()) return;
      const dateToReset = activeDateKey;
      window.classboardSupabase.from('class_calendar_overrides').delete()
        .eq('class_id', calendarClassId).eq('calendar_date', dateToReset).then(({ error }) => {
          if (error) {
            if (calendarNote) calendarNote.textContent = `Calendar day was not reset: ${error.message}`;
            return;
          }
          delete calendarOverrides[dateToReset];
          if (calendarNote) calendarNote.textContent = 'Calendar day reset to the default schedule for your class.';
          renderCalendar();
          renderDayDialog(new Date(`${dateToReset}T12:00:00`));
        });
    });
  }
  document.getElementById('closeCalendarDialog')?.addEventListener('click', () => dialog?.close());
  if (dialog) {
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  }
  window.addEventListener('classboard:attendance-calendar-context', () => {
    updateSubjectOptions();
    const studentRoll = Number(window.classboardContext?.rollNumber);
    const savedBatch = window.classboardContext?.labBatch
      || (window.classboardContext?.classId && window.classboardContext?.userId
          ? localStorage.getItem(`classboard_student_batch:${window.classboardContext.classId}:${window.classboardContext.userId}`)
          : null);
    if (batchSelect) setBatchOptions(batchSelect);
    if (addForm?.elements?.batch) setBatchOptions(addForm.elements.batch);
    if (batchSelect && savedBatch) {
      batchSelect.value = savedBatch;
    } else if (batchSelect && studentRoll >= 1 && batchForRoll(studentRoll)) {
      batchSelect.value = batchForRoll(studentRoll);
    }
    void loadSharedCalendar();
  });
  const studentBatch = Number(window.classboardContext?.rollNumber);
  const initialSavedBatch = window.classboardContext?.labBatch
    || (window.classboardContext?.classId && window.classboardContext?.userId
        ? localStorage.getItem(`classboard_student_batch:${window.classboardContext.classId}:${window.classboardContext.userId}`)
        : null);
  if (batchSelect) setBatchOptions(batchSelect);
  if (addForm?.elements?.batch) setBatchOptions(addForm.elements.batch);
  if (batchSelect && initialSavedBatch) {
    batchSelect.value = initialSavedBatch;
  } else if (batchSelect && studentBatch >= 1 && batchForRoll(studentBatch)) {
    batchSelect.value = batchForRoll(studentBatch);
  }
  if (grid) renderCalendar();
  if (window.classboardContext?.classId) void loadSharedCalendar();
})();
