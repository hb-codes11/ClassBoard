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
  const months = [9, 10];
  const subjects = [
    { name: 'Software Engineering', short: 'SE' },
    { name: 'Statistical Analysis', short: 'SA' },
    { name: 'Computer Organisation & Microprocessors', short: 'COM' },
    { name: 'Java Programming', short: 'JAVA' },
    { name: 'Soft Skills-I', short: 'SS-I' },
    { name: 'Artificial Intelligence', short: 'AI' },
    { name: 'Mentoring-III', short: 'MEN' }
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
      ['Software Engineering', 'lecture', 'all', ...times.third, 'V306'], ['Statistical Analysis', 'lecture', 'all', ...times.fourth, 'V306'],
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
  let activeMonth = 9;
  let activeDateKey = '';
  let selectedClassId = '';
  let calendarOverrides = {};
  let calendarClassId = null;
  let calendarLoadId = 0;
  let sharedCalendarReady = false;
  let calendarChannel = null;

  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const eventForDate = (date) => {
    return eventMap[dateKey(date)] || null;
  };
  const batchCodes = () => window.classboardContext?.classCode === 'INTEL-2' ? ['B1', 'B2'] : ['A1', 'A2'];
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
    const [first, second] = batchCodes();
    return roll >= 1 && roll <= 32 ? first : roll >= 33 && roll <= 66 ? second : null;
  };
  const contextKey = () => {
    const context = window.classboardContext;
    return `classboard-personal-calendar:${context?.classId || 'class'}:${context?.userId || 'guest'}`;
  };
  const readLegacyOverrides = () => {
    try { return JSON.parse(localStorage.getItem(contextKey()) || '{}') || {}; } catch { return {}; }
  };
  const subjectInfo = (name) => subjects.find((subject) => subject.name === name) || { name, short: name.slice(0, 6).toUpperCase() };
  const canEditCalendar = () => sharedCalendarReady && (window.classboardContext?.roles?.some((role) => role === 'cr' || role === 'admin') || false);
  const createClass = ([subject, kind, batch, start, end, room], id) => ({ id, subject, kind, batch, start, end, room });
  const defaultClasses = (date) => {
    const event = eventForDate(date);
    if (['holiday', 'convocation', 'exam'].includes(event?.kind)) return [];
    const schedule = window.classboardContext?.classCode === 'INTEL-2' ? intel2WeekdaySchedule : weekdaySchedule;
    return (schedule[date.getDay()] || []).map((item, index) => createClass(item, `base-${date.getDay()}-${index}`));
  };
  const classesForDate = (date, overrides = calendarOverrides) => {
    const event = eventForDate(date);
    if (['holiday', 'convocation', 'exam'].includes(event?.kind)) return [];
    return Object.hasOwn(overrides, dateKey(date)) ? overrides[dateKey(date)] : defaultClasses(date);
  };
  const visibleClasses = (classes) => classes.filter((item) => item.kind !== 'lab' || item.batch === batchSelect.value);
  const calendarLabels = (date, classes) => {
    const event = eventForDate(date);
    const labels = [];
    if (event) labels.push(event.label);
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
    monthTitle.textContent = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    monthButtons.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.calendarMonth) === month)));
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
      const hasVisibleOverride = Object.hasOwn(overrides, key) && !['holiday', 'convocation', 'exam'].includes(event?.kind);
      button.className = `attendance-day${date.getDay() === 0 || date.getDay() === 6 ? ' weekend' : ''}${event ? ` ${event.kind}` : ''}${hasVisibleOverride ? ' modified' : ''}${activeDateKey === key ? ' selected' : ''}`;
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', `${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${hasVisibleOverride ? ', edited' : ''}`);
      const number = document.createElement('span'); number.className = 'attendance-day-number'; number.textContent = String(day); button.append(number);
      calendarLabels(date, classes).forEach((label) => {
        const eventLabel = label === event?.label;
        const line = document.createElement('span'); line.className = 'attendance-day-label'; line.textContent = label;
        if (eventLabel && event?.kind === 'term') line.dataset.eventKind = 'term';
        if (!eventLabel) line.dataset.classType = label.endsWith(' (P)') ? 'practical' : 'lecture';
        const short = label.split(' ')[0];
        const color = { AI: 'ai', JAVA: 'java', COM: 'com', SE: 'se', SA: 'sa' }[short];
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
    dialogSub.textContent = [event?.label, `${classes.length} ${classes.length === 1 ? 'class' : 'classes'} for ${batchSelect.value}`].filter(Boolean).join(' · ');
    resetButton.hidden = !editable;
    addForm.hidden = !editable;
    resetButton.disabled = !Object.hasOwn(calendarOverrides, activeDateKey);
    classList.replaceChildren();
    if (!classes.length) {
      const empty = document.createElement('div'); empty.className = 'list-row'; empty.textContent = event?.kind === 'holiday' ? `${event.label} · No scheduled classes. Add a makeup class below if needed.` : 'No classes scheduled. Add a class below if needed.'; classList.append(empty);
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
      const subjectSelect = buildSelect(subjects.map((item) => [item.name, item.name]), session.subject);
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

  const addSubjectSelect = addForm.elements.subject;
  addSubjectSelect.replaceChildren(...subjects.map((subject) => {
    const option = document.createElement('option'); option.value = subject.name; option.textContent = subject.name; return option;
  }));
  const addKindSelect = addForm.elements.kind;
  const addBatchLabel = addForm.querySelector('[data-calendar-add-batch]');
  setBatchOptions(batchSelect);
  setBatchOptions(addForm.elements.batch);
  addKindSelect.addEventListener('change', () => { addBatchLabel.hidden = addKindSelect.value !== 'lab'; });
  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!activeDateKey || !canEditCalendar()) return;
    const values = new FormData(addForm);
    const start = String(values.get('start'));
    const end = String(values.get('end'));
    if (!start || !end || start >= end) { addForm.elements.end.setCustomValidity('End time must be after start time.'); addForm.elements.end.reportValidity(); return; }
    addForm.elements.end.setCustomValidity('');
    const date = new Date(`${activeDateKey}T12:00:00`);
    const currentClasses = classesForDate(date);
    currentClasses.push({ id: `added-${Date.now()}`, subject: String(values.get('subject')), kind: String(values.get('kind')), batch: values.get('kind') === 'lab' ? String(values.get('batch')) : 'all', start, end, room: String(values.get('room') || '').trim() });
    addForm.reset(); addBatchLabel.hidden = true;
    void persistClasses(currentClasses);
  });

  monthButtons.forEach((button) => button.addEventListener('click', () => {
    activeMonth = Number(button.dataset.calendarMonth);
    renderCalendar();
  }));
  batchSelect.addEventListener('change', () => {
    renderCalendar();
    if (dialog.open && activeDateKey) renderDayDialog(new Date(`${activeDateKey}T12:00:00`));
  });
  resetButton.addEventListener('click', () => {
    if (!canEditCalendar()) return;
    const dateToReset = activeDateKey;
    window.classboardSupabase.from('class_calendar_overrides').delete()
      .eq('class_id', calendarClassId).eq('calendar_date', dateToReset).then(({ error }) => {
        if (error) {
          calendarNote.textContent = `Calendar day was not reset: ${error.message}`;
          return;
        }
        delete calendarOverrides[dateToReset];
        calendarNote.textContent = 'Calendar day reset to the default schedule for your class.';
        renderCalendar();
        renderDayDialog(new Date(`${dateToReset}T12:00:00`));
      });
  });
  document.getElementById('closeCalendarDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  window.addEventListener('classboard:attendance-calendar-context', () => {
    const studentRoll = Number(window.classboardContext?.rollNumber);
    setBatchOptions(batchSelect);
    setBatchOptions(addForm.elements.batch);
    if (studentRoll >= 1 && studentRoll <= 66) batchSelect.value = batchForRoll(studentRoll);
    void loadSharedCalendar();
  });
  const studentBatch = Number(window.classboardContext?.rollNumber);
  setBatchOptions(batchSelect);
  setBatchOptions(addForm.elements.batch);
  if (studentBatch >= 1 && studentBatch <= 66) batchSelect.value = batchForRoll(studentBatch);
  renderCalendar();
  if (window.classboardContext?.classId) void loadSharedCalendar();
})();
