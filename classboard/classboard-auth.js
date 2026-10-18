(() => {
  const gate = document.getElementById('authGate');
  const app = document.querySelector('.app');
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const message = document.getElementById('authMessage');
  const buttons = ['signInButton', 'signUpButton', 'googleSignInButton', 'resetPasswordButton']
    .map((id) => document.getElementById(id));
  const emailPattern = /^[^@\s]+@medicaps[.]ac[.]in$/i;

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle('error', isError);
  }

  function showGoogleCallbackError() {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const error = params.get('error_description') || params.get('error') || hash.get('error_description') || hash.get('error');
    if (!error) return false;
    const detail = error.toLowerCase();
    if (/medicaps|email|domain|hook|not allowed|not authorized/.test(detail)) {
      showMessage('Only college Google accounts ending in @medicaps.ac.in can sign in. Switch to your Medicaps account and try again.', true);
    } else {
      showMessage(`Google sign-in could not finish: ${error}`, true);
    }
    return true;
  }

  function busy(isBusy) {
    buttons.forEach((button) => { button.disabled = isBusy; });
  }

  function cleanEmail() {
    return emailInput.value.trim().toLowerCase();
  }

  function validCollegeEmail() {
    const email = cleanEmail();
    if (!emailPattern.test(email)) {
      showMessage('Use your college email ending exactly in @medicaps.ac.in.', true);
      emailInput.focus();
      return false;
    }
    return true;
  }

  function setRoleOptions(roles) {
    const switcher = document.getElementById('roleSwitcher');
    const labels = { student: 'Student view', cr: 'CR workspace', admin: 'Admin workspace' };
    switcher.replaceChildren(...roles.map((role) => {
      const option = document.createElement('option');
      option.value = role;
      option.textContent = labels[role];
      return option;
    }));
    switcher.value = roles.includes('admin') ? 'admin' : roles.includes('cr') ? 'cr' : 'student';
    switcher.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function enterClass(user) {
    const { data, error } = await window.classboardSupabase
      .from('class_memberships')
      .select('class_id, role, roll_number, classes!inner(code, name)')
      .eq('user_id', user.id)
      .eq('classes.code', 'INTEL-1')
      .eq('is_active', true);

    if (error) throw error;
    const roles = [...new Set((data || []).map((row) => row.role))];
    if (!roles.length) {
      app.hidden = true;
      gate.hidden = false;
      showMessage('You are signed in, but this account has no active INTEL-1 class role yet. Ask a Classboard admin to add your account.', true);
      return;
    }

    const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.custom_claims?.name || user.email.split('@')[0];
    document.getElementById('crWorkspaceNav').hidden = !(roles.includes('cr') || roles.includes('admin'));
    const issuePanel = document.getElementById('issueForm')?.closest('article');
    if (issuePanel) issuePanel.hidden = !roles.includes('student');
    const uploadButton = document.getElementById('openResourceUpload');
    if (uploadButton) uploadButton.hidden = !(roles.includes('cr') || roles.includes('admin'));
    const initials = displayName.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'CB';
    document.querySelectorAll('.profile-name').forEach((el) => { el.textContent = displayName; });
    document.querySelectorAll('.profile .avatar').forEach((el) => { el.textContent = initials; });
    const roleLabel = `${roles.map((role) => role.toUpperCase()).join(' + ')} · AI & Analytics - A (INTEL-1)`;
    document.querySelector('.profile-role').textContent = roleLabel;
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('topbarAvatar').textContent = initials;
    document.getElementById('profileName').textContent = displayName;
    document.getElementById('profileRole').textContent = roleLabel;
    document.getElementById('profileEmail').textContent = user.email || 'Email unavailable';
    const greeting = document.getElementById('homeGreeting');
    if (greeting) greeting.textContent = `Hi ${displayName}`;
    const homeDate = document.getElementById('homeDate');
    if (homeDate) homeDate.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
    setRoleOptions(roles);
    const classId = data[0].class_id;
    window.classboardContext = { classId, userId: user.id, roles };
    const studentMembership = data.find((row) => row.role === 'student');
    if (studentMembership && window.setClassboardRoll) window.setClassboardRoll(studentMembership.roll_number);
    const issueDate = document.querySelector('#issueForm input[name="date"]');
    if (issueDate) {
      const today = new Date();
      issueDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    await loadLiveClassData(classId);
    if (roles.includes('admin')) await loadAdminAccounts(classId);
    gate.hidden = true;
    app.hidden = false;
    showMessage('');
    if (studentMembership && !studentMembership.roll_number) {
      window.openFormDialog({
        title: 'Set up your student details',
        description: 'Enter your lab batch and serial roll number. Your roll number and batch must match the class list.',
        fields: [
          { name: 'batch', label: 'Lab batch', options: [{ label: 'Choose your batch', value: '' }, 'A1', 'A2'] },
          { name: 'rollNumber', label: 'Serial roll number', type: 'number', placeholder: '1–66' }
        ],
        submitLabel: 'Save and join class',
        canCancel: false,
        onSubmit: async ({ batch, rollNumber }) => {
          const roll = Number(rollNumber);
          if (!Number.isInteger(roll) || roll < 1 || roll > 66) return 'Enter your serial roll number from 1 to 66.';
          const expectedBatch = roll <= 32 ? 'A1' : 'A2';
          if (batch !== expectedBatch) return `Roll number ${roll} belongs to batch ${expectedBatch}. Check your details and try again.`;
          const { error } = await window.classboardSupabase.rpc('set_own_student_setup', {
            p_class_id: classId,
            p_roll_number: roll,
            p_lab_batch: batch
          });
          if (error) return `Could not save your details: ${error.message}`;
          if (window.setClassboardRoll) window.setClassboardRoll(roll);
          return true;
        }
      });
    }
  }

  function addEmptyNote(container, text) {
    const note = document.createElement('div');
    note.className = 'page-description live-empty';
    note.textContent = text;
    container.append(note);
  }

  function addUpdateCard(update) {
    const card = document.createElement('div');
    card.className = 'update';
    card.dataset.contentId = update.id;
    card.dataset.contentType = 'updates';
    const category = update.category.toLowerCase();
    card.dataset.category = category === 'deadline' ? 'Deadline' : category === 'important' ? 'Important' : 'General';
    const mark = document.createElement('div');
    mark.className = 'update-mark blue';
    mark.textContent = category === 'deadline' || update.importance === 'important' ? '!' : 'i';
    const copy = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'update-title';
    title.textContent = update.title;
    if (update.importance === 'important') {
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = 'Important';
      title.append(' ', pill);
    }
    const body = document.createElement('div');
    body.className = 'update-body';
    body.textContent = update.body;
    const time = document.createElement('div');
    time.className = 'update-time';
    time.textContent = `Posted ${new Date(update.published_at || update.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
    copy.append(title, body, time);
    card.append(mark, copy);
    card.append(makeDeleteButton('Delete update'));
    return card;
  }

  function makeDeleteButton(label = 'Delete') {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'delete-content-button';
    button.dataset.deleteContent = 'true'; button.textContent = label;
    button.hidden = !window.classboardContext?.roles.some((role) => role === 'cr' || role === 'admin');
    return button;
  }

  function addSessionRow(session, compact = false) {
    const subject = Array.isArray(session.subjects) ? session.subjects[0] : session.subjects;
    const date = new Date(session.starts_at);
    const month = date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const row = document.createElement('div');
    row.className = 'list-row';
    row.dataset.contentId = session.id;
    row.dataset.contentType = 'class_sessions';
    row.dataset.classSubject = subject?.name || 'Class';
    row.dataset.month = month;
    row.dataset.batch = session.batch === 'all' ? 'All students' : session.batch;
    const dateBox = document.createElement('div');
    dateBox.className = 'reminder-date';
    const day = document.createElement('b'); day.textContent = String(date.getDate());
    const monthLabel = document.createElement('span'); monthLabel.textContent = date.toLocaleString('en-IN', { month: 'short' });
    dateBox.append(day, monthLabel);
    const main = document.createElement('div'); main.className = 'list-main';
    const title = document.createElement('div'); title.className = 'list-title';
    title.textContent = `${subject?.name || 'Class'}${session.class_number ? ` · Class ${session.class_number}` : ''}`;
    const detail = document.createElement('div'); detail.className = 'list-detail';
    const type = session.kind === 'lab' ? `Lab · ${session.batch}` : 'Lecture';
    detail.textContent = `${type} · ${date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${session.room ? ` · ${session.room}` : ''}${session.topic ? ` · ${session.topic}` : ''}`;
    main.append(title, detail);
    const status = document.createElement('span'); status.className = 'status'; status.textContent = session.state.replaceAll('_', ' ');
    row.append(dateBox, main, status);
    row.append(makeDeleteButton('Delete'));
    if (!compact) {
      const report = document.createElement('button'); report.className = 'text-link'; report.dataset.page = 'attendance'; report.textContent = 'Report an issue';
      row.append(report);
    }
    return row;
  }

  function resourceKindLabel(kind) {
    return ({ notes: 'Notes', syllabus: 'Syllabus', lab_manual: 'Lab manual', calendar: 'Calendar' })[kind] || kind;
  }

  async function signedResourceUrl(path) {
    if (!path) return null;
    const { data, error } = await window.classboardSupabase.storage.from('class-resources').createSignedUrl(path, 300);
    if (error) return null;
    return data.signedUrl;
  }

  async function showPublishedCalendar(resources) {
    const calendar = resources.find((resource) => resource.kind === 'calendar' && resource.storage_path);
    if (!calendar) return;
    const url = await signedResourceUrl(calendar.storage_path);
    if (!url) return;
    document.getElementById('calendarFrame').src = `${url}#view=FitH`;
    document.getElementById('calendarOpen').href = url;
    document.getElementById('calendarDownload').href = url;
    document.getElementById('calendarSource').textContent = `${calendar.title} · Published for AI & Analytics - A (INTEL-1).`;
  }

  async function addResourceCard(resource, compact = false) {
    const subject = Array.isArray(resource.subjects) ? resource.subjects[0] : resource.subjects;
    const kind = resourceKindLabel(resource.kind);
    const link = await signedResourceUrl(resource.storage_path);
    const card = document.createElement(compact ? 'div' : 'article');
    card.className = compact ? 'resource' : 'resource-card';
    card.dataset.contentId = resource.id;
    card.dataset.contentType = 'resources';
    card.dataset.subject = subject?.name || '';
    card.dataset.type = kind;
    card.dataset.search = `${resource.title} ${subject?.name || ''} ${kind} ${resource.unit_label || ''}`.toLowerCase();
    const icon = document.createElement('div'); icon.className = 'file-icon'; icon.textContent = 'PDF';
    const main = document.createElement('div'); main.className = 'list-main';
    const title = document.createElement('div'); title.className = 'resource-title'; title.textContent = resource.title;
    const meta = document.createElement('div'); meta.className = 'resource-meta';
    meta.textContent = [subject?.name, kind, resource.unit_label, `Added ${new Date(resource.published_at || resource.created_at).toLocaleDateString('en-IN')}`].filter(Boolean).join(' · ');
    main.append(title, meta);
    if (link) {
      const open = document.createElement('a');
      open.className = compact ? 'download' : 'download';
      open.href = link;
      open.target = '_blank';
      open.rel = 'noopener';
      open.setAttribute('aria-label', `Open ${resource.title}`);
      open.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';
      card.append(icon, main, open);
    } else {
      card.append(icon, main);
    }
    if (!compact) card.append(makeDeleteButton('Delete resource'));
    return card;
  }

  async function loadLiveClassData(classId) {
    const client = window.classboardSupabase;
    const [classResult, subjectResult, updateResult, sessionResult, resourceResult, reminderResult] = await Promise.all([
      client.from('classes').select('id,code,name,semester').eq('id', classId).single(),
      client.from('subjects').select('id,slug,name,short_name,display_order').eq('class_id', classId).eq('is_active', true).order('display_order'),
      client.from('updates').select('id,title,body,category,importance,created_at,published_at').eq('class_id', classId).not('published_at', 'is', null).order('published_at', { ascending: false }).limit(20),
      client.from('class_sessions').select('id,class_number,kind,batch,state,starts_at,room,topic,subjects(name,short_name)').eq('class_id', classId).order('starts_at', { ascending: false }).limit(50),
      client.from('resources').select('id,title,kind,unit_label,storage_path,created_at,published_at,subjects(name)').eq('class_id', classId).not('published_at', 'is', null).is('deleted_at', null).order('published_at', { ascending: false }).limit(50),
      client.from('reminders').select('id,title,body,due_at').eq('class_id', classId).eq('is_active', true).gte('due_at', new Date().toISOString()).order('due_at').limit(20)
    ]);

    const failed = [classResult, subjectResult, updateResult, sessionResult, resourceResult, reminderResult].find((result) => result.error);
    if (failed) throw failed.error;
    const classInfo = classResult.data;
    document.querySelectorAll('.brand-term').forEach((el) => { el.textContent = classInfo.semester ? `${classInfo.semester}${classInfo.semester === 1 ? 'st' : classInfo.semester === 2 ? 'nd' : classInfo.semester === 3 ? 'rd' : 'th'} Semester` : classInfo.code; });
    document.querySelectorAll('.page-heading .eyebrow').forEach((el) => {
      if (el.textContent.includes('INTEL-1')) el.textContent = `${classInfo.name} (${classInfo.code})`;
    });
    const subjectOptions = [{ value: 'all', label: 'All subjects' }, ...subjectResult.data.map((subject) => ({ value: subject.name, label: subject.name }))];
    ['subjectFilter', 'classSubjectFilter'].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) return;
      const previous = select.value;
      select.replaceChildren(...subjectOptions.map(({ value, label }) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
      }));
      if (subjectOptions.some((item) => item.value === previous)) select.value = previous;
    });
    document.querySelectorAll('#crClassForm select[name="subject"], #crScheduleForm select[name="subject"], #crResourceForm select[name="subject"], #issueForm select[name="subject"]').forEach((select) => {
      const subjectOptions = select.id === 'crResourceSubject' ? [{ value: '', label: 'Select a subject' }] : [];
      select.replaceChildren(...subjectOptions.map(({ value, label }) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
      }), ...subjectResult.data.map((subject) => {
        const option = document.createElement('option'); option.value = subject.name; option.textContent = subject.short_name ? `${subject.name} (${subject.short_name})` : subject.name; return option;
      }));
    });

    const updateContainers = [document.getElementById('updateList'), document.getElementById('homeUpdateList')];
    updateContainers.forEach((container, index) => {
      container.querySelectorAll('.update, .live-empty').forEach((node) => node.remove());
      if (!updateResult.data.length) { addEmptyNote(container, 'No class updates have been published yet.'); return; }
      updateResult.data.slice(0, index === 0 ? 20 : 2).forEach((update) => container.append(addUpdateCard(update)));
    });

    const resourceGrid = document.getElementById('resourceGrid');
    resourceGrid.replaceChildren();
    const resourceEmpty = document.getElementById('resourceEmpty');
    const homeResources = document.getElementById('homeResourceList');
    homeResources.querySelectorAll('.resource, .live-empty').forEach((node) => node.remove());
    const resources = resourceResult.data || [];
    await showPublishedCalendar(resources);
    if (!resources.length) {
      resourceEmpty.textContent = 'No resources have been published yet.';
      resourceEmpty.style.display = 'block';
      addEmptyNote(homeResources, 'No notes have been published yet.');
    } else {
      resourceEmpty.textContent = 'No files match. Try a different search.';
      const cards = await Promise.all(resources.map((resource) => addResourceCard(resource)));
      cards.forEach((card) => resourceGrid.append(card));
      const homeCards = await Promise.all(resources.slice(0, 2).map((resource) => addResourceCard(resource, true)));
      homeCards.forEach((card) => homeResources.append(card));
    }
    if (resources.length) document.getElementById('resourceSearch')?.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelectorAll('.stat-label').forEach((label) => {
      if (label.textContent.trim() === 'Resources available') label.previousElementSibling.textContent = String(resources.length);
      if (label.textContent.trim() === 'Upcoming reminders') label.previousElementSibling.textContent = String((reminderResult.data || []).length);
    });

    const sessions = sessionResult.data || [];
    const sessionContainers = [
      [document.getElementById('classLogList'), sessions, false],
      [document.getElementById('homeClassList'), sessions.slice(0, 3), true],
      [document.getElementById('crRecentClasses'), sessions.slice(0, 5), true]
    ];
    sessionContainers.forEach(([container, rows, compact]) => {
      container.replaceChildren();
      if (!rows.length) { addEmptyNote(container, 'No class sessions have been added yet.'); return; }
      rows.forEach((session) => container.append(addSessionRow(session, compact)));
    });
    const reminderContainer = document.getElementById('homeReminderList');
    reminderContainer.replaceChildren();
    (reminderResult.data || []).forEach((reminder) => reminderContainer.append(addReminderCard(reminder)));
    if (!(reminderResult.data || []).length) addEmptyNote(reminderContainer, 'No upcoming reminders.');
    await loadNotifications(classId);
    await loadAttendanceIssues(classId);
    document.getElementById('classSubjectFilter')?.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('subjectFilter')?.dispatchEvent(new Event('change', { bubbles: true }));
    const upcoming = sessions.filter((session) => session.state === 'scheduled' && new Date(session.starts_at) >= new Date()).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const scheduleList = document.getElementById('crScheduleList');
    if (scheduleList) {
      scheduleList.replaceChildren();
      if (upcoming.length) upcoming.forEach((session) => scheduleList.append(addSessionRow(session, true)));
      else addEmptyNote(scheduleList, 'No upcoming class sessions have been scheduled yet.');
    }
    const next = upcoming[0];
    if (next) {
      const subject = Array.isArray(next.subjects) ? next.subjects[0] : next.subjects;
      const date = new Date(next.starts_at);
      document.getElementById('nextClassName').textContent = subject?.name || 'Next class';
      document.getElementById('nextClassDetail').textContent = `${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
      document.getElementById('nextClassTime').textContent = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
      document.getElementById('nextClassContext').textContent = `${next.kind === 'lab' ? 'Lab' : 'Lecture'} · ${next.batch === 'all' ? 'All students' : next.batch}`;
      document.getElementById('nextClassRoom').textContent = next.room || 'Room not set';
    } else {
      document.getElementById('nextClassName').textContent = 'No class scheduled yet';
      document.getElementById('nextClassDetail').textContent = 'Your CR will add upcoming classes to the timetable.';
      document.getElementById('nextClassTime').textContent = '—';
      document.getElementById('nextClassContext').textContent = 'Timetable';
      document.getElementById('nextClassRoom').textContent = 'Waiting for the next class';
    }
  }

  function addReminderCard(reminder) {
    const date = new Date(reminder.due_at);
    const row = document.createElement('div'); row.className = 'reminder';
    row.dataset.contentId = reminder.id; row.dataset.contentType = 'reminders';
    const dateBox = document.createElement('div'); dateBox.className = 'reminder-date';
    const day = document.createElement('b'); day.textContent = String(date.getDate());
    const month = document.createElement('span'); month.textContent = date.toLocaleString('en-IN', { month: 'short' });
    dateBox.append(day, month);
    const detail = document.createElement('div');
    const title = document.createElement('div'); title.className = 'reminder-title'; title.textContent = reminder.title;
    const body = document.createElement('div'); body.className = 'reminder-detail'; body.textContent = reminder.body || date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    detail.append(title, body); row.append(dateBox, detail, makeDeleteButton('Delete reminder'));
    return row;
  }

  async function loadNotifications(classId) {
    const client = window.classboardSupabase;
    const list = document.getElementById('notificationList');
    const userId = window.classboardContext?.userId;
    if (!userId || !list) return;
    const result = await client.from('notifications')
      .select('id,source_type,source_id,created_at,read_at')
      .eq('class_id', classId).eq('recipient_id', userId).is('read_at', null)
      .order('created_at', { ascending: false }).limit(50);
    if (result.error) { notifyApp(`Could not load notifications: ${result.error.message}`, true); return; }

    const notifications = result.data || [];
    const ids = (type) => notifications.filter((item) => item.source_type === type).map((item) => item.source_id);
    const [updates, reminders, resources, sessions] = await Promise.all([
      ids('update').length ? client.from('updates').select('id,title,body').in('id', ids('update')) : Promise.resolve({ data: [], error: null }),
      ids('reminder').length ? client.from('reminders').select('id,title,body,due_at').in('id', ids('reminder')) : Promise.resolve({ data: [], error: null }),
      ids('resource').length ? client.from('resources').select('id,title,kind,subjects(name)').in('id', ids('resource')) : Promise.resolve({ data: [], error: null }),
      ids('class_session').length ? client.from('class_sessions').select('id,class_number,kind,batch,starts_at,room,subjects(name)').in('id', ids('class_session')) : Promise.resolve({ data: [], error: null })
    ]);
    const failed = [updates, reminders, resources, sessions].find((request) => request.error);
    if (failed) { notifyApp(`Could not load notification details: ${failed.error.message}`, true); return; }
    const sources = new Map([updates, reminders, resources, sessions].flatMap((request) => (request.data || []).map((source) => [source.id, source])));
    list.replaceChildren();
    notifications.forEach((notification) => {
      const source = sources.get(notification.source_id);
      if (!source) return;
      const subject = Array.isArray(source.subjects) ? source.subjects[0] : source.subjects;
      let title = source.title;
      let detail = '';
      if (notification.source_type === 'update') detail = source.body || '';
      else if (notification.source_type === 'reminder') detail = source.body || `Due ${new Date(source.due_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
      else if (notification.source_type === 'resource') detail = [subject?.name, resourceKindLabel(source.kind)].filter(Boolean).join(' · ');
      else {
        title = `${subject?.name || 'Class'}${source.class_number ? ` · Class ${source.class_number}` : ''}`;
        detail = `${source.kind === 'lab' ? `Lab · ${source.batch}` : 'Lecture'} · ${new Date(source.starts_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${source.room ? ` · ${source.room}` : ''}`;
      }
      const row = document.createElement('div'); row.className = 'list-row'; row.dataset.notificationId = notification.id;
      const mark = document.createElement('div'); mark.className = 'update-mark blue'; mark.textContent = notification.source_type === 'resource' ? 'PDF' : notification.source_type === 'reminder' ? '•' : notification.source_type === 'class_session' ? '↗' : '!';
      const main = document.createElement('div'); main.className = 'list-main';
      const heading = document.createElement('div'); heading.className = 'list-title'; heading.textContent = title;
      const sub = document.createElement('div'); sub.className = 'list-detail'; sub.textContent = detail;
      const date = document.createElement('div'); date.className = 'list-date'; date.textContent = new Date(notification.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      main.append(heading, sub); row.append(mark, main, date); list.append(row);
    });
    if (!list.children.length) addEmptyNote(list, 'You’re all caught up. No unread notifications.');
    document.querySelectorAll('.unread').forEach((dot) => dot.remove());
    if (notifications.length) document.querySelectorAll('[aria-label="Notifications"]').forEach((button) => {
      if (!button.querySelector('.unread')) { const dot = document.createElement('span'); dot.className = 'unread'; button.append(dot); }
    });
  }

  async function markAllNotificationsRead() {
    const context = window.classboardContext;
    if (!context) return;
    const { data, error } = await window.classboardSupabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('class_id', context.classId).eq('recipient_id', context.userId).is('read_at', null).select('id');
    if (error) { notifyApp(`Could not update notifications: ${error.message}`, true); return; }
    await loadNotifications(context.classId);
    notifyApp(`${data?.length || 0} notification${data?.length === 1 ? '' : 's'} marked as read.`);
  }
  window.classboardMarkAllNotificationsRead = markAllNotificationsRead;

  async function loadAttendanceIssues(classId) {
    const context = window.classboardContext;
    if (!context) return;
    const client = window.classboardSupabase;
    const { data: issues, error } = await client.from('attendance_issues')
      .select('id,student_id,message,state,assigned_to,created_at')
      .eq('class_id', classId).order('created_at', { ascending: false }).limit(100);
    if (error) { notifyApp(`Could not load attendance concerns: ${error.message}`, true); return; }
    window.classboardCurrentIssues = issues || [];
    const ids = [...new Set((issues || []).map((issue) => issue.student_id))];
    const issueIds = (issues || []).map((issue) => issue.id);
    const [profileResult, replyResult] = await Promise.all([
      ids.length ? client.from('profiles').select('user_id,display_name').in('user_id', ids) : Promise.resolve({ data: [], error: null }),
      issueIds.length ? client.from('attendance_issue_replies').select('issue_id,author_id,body,created_at').in('issue_id', issueIds).order('created_at') : Promise.resolve({ data: [], error: null })
    ]);
    const failed = [profileResult, replyResult].find((result) => result.error);
    if (failed) { notifyApp(`Could not load attendance concern details: ${failed.error.message}`, true); return; }
    const names = new Map((profileResult.data || []).map((profile) => [profile.user_id, profile.display_name || 'Student']));
    const replies = new Map();
    (replyResult.data || []).forEach((reply) => {
      if (!replies.has(reply.issue_id)) replies.set(reply.issue_id, []);
      replies.get(reply.issue_id).push(reply);
    });

    const studentList = document.getElementById('studentCaseList');
    studentList.replaceChildren();
    (issues || []).filter((issue) => issue.student_id === context.userId).forEach((issue) => {
      const row = document.createElement('div'); row.className = 'list-row';
      const main = document.createElement('div'); main.className = 'list-main';
      const title = document.createElement('div'); title.className = 'list-title'; title.textContent = `Attendance concern · ${issue.state.replaceAll('_', ' ')}`;
      const detail = document.createElement('div'); detail.className = 'list-detail'; detail.textContent = issue.message;
      main.append(title, detail); row.append(main);
      const latestReply = (replies.get(issue.id) || []).at(-1);
      if (latestReply) {
        const response = document.createElement('div'); response.className = 'list-detail'; response.textContent = `CR/Admin reply: ${latestReply.body}`; main.append(response);
      }
      studentList.append(row);
    });
    if (!studentList.children.length) addEmptyNote(studentList, 'You have not sent an attendance concern.');

    const crList = document.getElementById('crCaseList');
    crList.replaceChildren();
    const canReview = context.roles.some((role) => role === 'cr' || role === 'admin');
    const staffIssues = canReview ? issues || [] : [];
    staffIssues.forEach((issue) => {
      const row = document.createElement('div'); row.className = 'list-row'; row.dataset.caseId = issue.id;
      const main = document.createElement('div'); main.className = 'list-main';
      const title = document.createElement('div'); title.className = 'list-title'; title.textContent = `Attendance concern · ${names.get(issue.student_id) || 'Student'}`;
      const detail = document.createElement('div'); detail.className = 'list-detail'; detail.textContent = `${issue.message} · ${new Date(issue.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
      const stateLabels = { new: 'New', reviewing: 'Reviewing', reviewed: 'Reviewed', referred: 'Referred to faculty', resolved: 'Resolved' };
      const status = document.createElement('span'); status.className = `status${issue.state === 'resolved' ? '' : ' pending'}`; status.textContent = stateLabels[issue.state] || issue.state.replaceAll('_', ' ');
      const review = document.createElement('button'); review.type = 'button'; review.className = 'secondary-button case-open'; review.textContent = 'Review';
      const actions = document.createElement('div'); actions.className = 'case-actions';
      actions.append(review);
      if (issue.state !== 'resolved') {
        const close = document.createElement('button'); close.type = 'button'; close.className = 'secondary-button case-close'; close.textContent = 'Close issue';
        actions.append(close);
      }
      main.append(title, detail);
      (replies.get(issue.id) || []).forEach((reply) => {
        const replyDetail = document.createElement('div'); replyDetail.className = 'list-detail'; replyDetail.textContent = `Reply: ${reply.body}`; main.append(replyDetail);
      });
      row.append(main, status, actions); crList.append(row);
    });
    if (!crList.children.length) addEmptyNote(crList, 'No attendance concerns have been submitted.');
    const openCount = staffIssues.filter((issue) => issue.state !== 'resolved').length;
    document.getElementById('crCaseCount').textContent = String(openCount);
    document.getElementById('openCaseBadge').textContent = `${openCount} open`;
  }

  async function loadAdminAccounts(classId) {
    const container = document.getElementById('accountList');
    const client = window.classboardSupabase;
    const { data: memberships, error: membershipError } = await client
      .from('class_memberships').select('user_id,role,roll_number').eq('class_id', classId).eq('is_active', true);
    if (membershipError) {
      container.textContent = `Could not load accounts. Run migration 003 in Supabase first. (${membershipError.message})`;
      return;
    }
    const ids = [...new Set((memberships || []).map((membership) => membership.user_id))];
    const [profileResult, contactResult] = ids.length ? await Promise.all([
      client.from('profiles').select('user_id,display_name').in('user_id', ids),
      client.from('class_member_contacts').select('user_id,email').eq('class_id', classId).in('user_id', ids)
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    const failed = [profileResult, contactResult].find((result) => result.error);
    if (failed) {
      container.textContent = `Could not load account details. Run migration 003 in Supabase first. (${failed.error.message})`;
      return;
    }
    const profiles = new Map((profileResult.data || []).map((profile) => [profile.user_id, profile]));
    const contacts = new Map((contactResult.data || []).map((contact) => [contact.user_id, contact.email]));
    const users = new Map();
    (memberships || []).forEach((membership) => {
      const profile = profiles.get(membership.user_id) || {};
      const email = contacts.get(membership.user_id) || '';
      if (!users.has(membership.user_id)) users.set(membership.user_id, {
        userId: membership.user_id, name: profile.display_name || email.split('@')[0] || 'Class member',
        email, roles: new Set(), rollNumber: null
      });
      const user = users.get(membership.user_id);
      user.roles.add(membership.role);
      if (membership.role === 'student') user.rollNumber = membership.roll_number;
    });

    container.replaceChildren();
    const userRows = [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (!userRows.length) addEmptyNote(container, 'No class accounts yet. New college sign-ins will appear here as students.');
    userRows.forEach((user) => {
      const row = document.createElement('div'); row.className = 'list-row account-row'; row.dataset.userId = user.userId;
      const avatar = document.createElement('div'); avatar.className = 'avatar';
      avatar.textContent = user.name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'CB';
      const main = document.createElement('div'); main.className = 'list-main';
      const name = document.createElement('div'); name.className = 'list-title'; name.textContent = user.name;
      const email = document.createElement('div'); email.className = 'list-detail'; email.textContent = user.email;
      main.append(name, email);
      const controls = document.createElement('div'); controls.className = 'account-controls';
      const roleGroup = document.createElement('fieldset'); roleGroup.className = 'account-role-options';
      const legend = document.createElement('legend'); legend.textContent = 'Roles'; roleGroup.append(legend);
      [['student', 'Student'], ['cr', 'CR'], ['admin', 'Admin']].forEach(([value, label]) => {
        const roleLabel = document.createElement('label');
        const check = document.createElement('input'); check.type = 'checkbox'; check.value = value; check.checked = user.roles.has(value);
        roleLabel.append(check, document.createTextNode(label)); roleGroup.append(roleLabel);
      });
      const rollLabel = document.createElement('label'); rollLabel.className = 'account-roll-label'; rollLabel.textContent = 'Student roll number';
      const roll = document.createElement('input'); roll.className = 'text-field'; roll.type = 'number'; roll.min = '1'; roll.max = '66'; roll.placeholder = 'Optional'; roll.value = user.rollNumber ?? '';
      rollLabel.append(roll);
      const save = document.createElement('button'); save.className = 'secondary-button'; save.type = 'button'; save.textContent = 'Save roles';
      save.addEventListener('click', async () => {
        const roles = [...roleGroup.querySelectorAll('input:checked')].map((input) => input.value);
        const rollNumber = roles.includes('student') && roll.value ? Number(roll.value) : null;
        if (rollNumber !== null && (!Number.isInteger(rollNumber) || rollNumber < 1 || rollNumber > 66)) {
          notifyApp('Student roll number must be between 1 and 66.', true); return;
        }
        save.disabled = true;
        const { error } = await client.rpc('set_class_member_roles', {
          p_user_id: user.userId, p_class_id: classId, p_roles: roles, p_roll_number: rollNumber
        });
        save.disabled = false;
        if (error) { notifyApp(`Role change did not save: ${error.message}`, true); return; }
        await loadAdminAccounts(classId);
        notifyApp(`Saved access for ${user.name}.`);
      });
      controls.append(roleGroup, rollLabel, save); row.append(avatar, main, controls); container.append(row);
    });
    document.getElementById('adminMemberCount').textContent = String(userRows.length);
    document.getElementById('adminStudentCount').textContent = String(userRows.filter((user) => user.roles.has('student')).length);
    document.getElementById('adminCrCount').textContent = String(userRows.filter((user) => user.roles.has('cr')).length);
  }

  async function handleSession(session) {
    if (!session?.user) {
      app.hidden = true;
      gate.hidden = false;
      return;
    }
    if (!emailPattern.test(session.user.email || '')) {
      app.hidden = true;
      gate.hidden = false;
      showMessage('Only college Google accounts ending in @medicaps.ac.in can sign in. Switch to your Medicaps account and try again.', true);
      await window.classboardSupabase.auth.signOut();
      return;
    }
    busy(true);
    showMessage('Checking your class access…');
    try {
      await enterClass(session.user);
    } catch (error) {
      app.hidden = true;
      gate.hidden = false;
      showMessage(`Could not check class access: ${error.message}`, true);
    } finally {
      busy(false);
    }
  }

  async function start() {
    showGoogleCallbackError();
    const config = window.CLASSBOARD_SUPABASE_CONFIG;
    if (!config?.url || !config?.publishableKey || config.publishableKey.includes('PASTE_')) {
      showMessage('Add your Supabase publishable key in supabase-config.js first.', true);
      return;
    }
    if (!window.supabase?.createClient) {
      showMessage('Supabase client did not load. Check your internet connection and reload.', true);
      return;
    }

    window.classboardSupabase = window.supabase.createClient(config.url, config.publishableKey);
    const { data: { session }, error } = await window.classboardSupabase.auth.getSession();
    if (error) showMessage(error.message, true);
    else await handleSession(session);

    window.classboardSupabase.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => handleSession(nextSession));
    });
    connectCrForms();
  }

  function notifyApp(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    window.clearTimeout(window.classboardToastTimer);
    window.classboardToastTimer = window.setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function connectCrForms() {
    const uploadToggle = document.getElementById('openResourceUpload');
    const uploadPanel = document.getElementById('resourceUploadPanel');
    const closeUpload = () => { uploadPanel.hidden = true; uploadToggle.setAttribute('aria-expanded', 'false'); };
    uploadToggle?.addEventListener('click', () => {
      uploadPanel.hidden = !uploadPanel.hidden;
      uploadToggle.setAttribute('aria-expanded', String(!uploadPanel.hidden));
      if (!uploadPanel.hidden) uploadPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    document.getElementById('cancelResourceUpload')?.addEventListener('click', closeUpload);

    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-delete-content]');
      if (!button) return;
      const context = window.classboardContext;
      if (!context?.roles.some((role) => role === 'cr' || role === 'admin')) { notifyApp('Only class reps and admins can delete class content.', true); return; }
      const row = button.closest('[data-content-id]');
      if (!row || !window.confirm('Delete this item for the whole class? This cannot be undone.')) return;
      button.disabled = true;
      const client = window.classboardSupabase;
      let error;
      let cleanupWarning = '';
      if (row.dataset.contentType === 'resources') {
        const found = await client.from('resources').select('storage_path').eq('id', row.dataset.contentId).eq('class_id', context.classId).single();
        if (found.error) error = found.error;
        let deleted;
        if (!error) {
          deleted = await client.from('resources').delete().eq('id', row.dataset.contentId).eq('class_id', context.classId).select('id');
          error = deleted.error || (!deleted.data?.length ? new Error('No row was deleted. Apply the content-management migration and try again.') : null);
        }
        if (!error && found.data.storage_path) {
          const removed = await client.storage.from('class-resources').remove([found.data.storage_path]);
          if (removed.error) cleanupWarning = ` The resource record is deleted; PDF cleanup needs attention: ${removed.error.message}`;
        }
      } else {
        const deleted = await client.from(row.dataset.contentType).delete().eq('id', row.dataset.contentId).eq('class_id', context.classId).select('id');
        error = deleted.error || (!deleted.data?.length ? new Error('No row was deleted. Apply the content-management migration and try again.') : null);
      }
      if (error) { button.disabled = false; notifyApp(`Could not delete item: ${error.message}`, true); return; }
      await loadLiveClassData(context.classId);
      notifyApp(`Item deleted for the class.${cleanupWarning}`, Boolean(cleanupWarning));
    });

    const issueForm = document.getElementById('issueForm');
    issueForm?.addEventListener('submit', async (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      const context = window.classboardContext;
      if (!context?.roles.includes('student')) { notifyApp('Only a student account can submit an attendance concern.', true); return; }
      const values = new FormData(issueForm);
      const subjectName = String(values.get('subject'));
      const classDate = String(values.get('date'));
      const report = String(values.get('message')).trim();
      if (!report) { notifyApp('Describe the attendance concern before sending it.', true); return; }
      const subjectResult = await window.classboardSupabase.from('subjects').select('id,name').eq('class_id', context.classId).eq('name', subjectName).single();
      if (subjectResult.error) { notifyApp(`Could not find that subject: ${subjectResult.error.message}`, true); return; }
      const dayStart = new Date(`${classDate}T00:00:00+05:30`).toISOString();
      const nextDay = new Date(new Date(`${classDate}T00:00:00+05:30`).getTime() + 86400000).toISOString();
      const sessionResult = await window.classboardSupabase.from('class_sessions').select('id').eq('class_id', context.classId).eq('subject_id', subjectResult.data.id).gte('starts_at', dayStart).lt('starts_at', nextDay).limit(1);
      if (sessionResult.error) { notifyApp(`Could not check the class session: ${sessionResult.error.message}`, true); return; }
      const { error } = await window.classboardSupabase.from('attendance_issues').insert({
        class_id: context.classId, student_id: context.userId, session_id: sessionResult.data?.[0]?.id || null,
        message: `Subject: ${subjectName} · Class date: ${classDate}\n\n${report}`
      });
      if (error) { notifyApp(`Concern did not send: ${error.message}`, true); return; }
      issueForm.reset();
      const localDate = new Date();
      issueForm.elements.date.value = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
      await loadAttendanceIssues(context.classId);
      notifyApp('Your attendance concern was sent privately to the class team.');
    }, true);

    document.getElementById('crCaseList')?.addEventListener('click', async (event) => {
      const closeButton = event.target.closest('.case-close');
      if (closeButton) {
        event.preventDefault(); event.stopImmediatePropagation();
        const context = window.classboardContext;
        const issueId = closeButton.closest('[data-case-id]')?.dataset.caseId;
        if (!context || !issueId) return;
        if (!window.confirm('Close this attendance concern as resolved?')) return;
        const { data, error } = await window.classboardSupabase.from('attendance_issues').update({
          state: 'resolved', assigned_to: context.userId, resolved_at: new Date().toISOString()
        }).eq('id', issueId).eq('class_id', context.classId).select('id');
        if (error) { notifyApp(`Could not close the concern: ${error.message}`, true); return; }
        if (!data?.length) { notifyApp('The concern could not be closed. Check your CR or admin access.', true); return; }
        await loadAttendanceIssues(context.classId);
        notifyApp('Attendance concern closed as resolved.');
        return;
      }
      const button = event.target.closest('.case-open');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const context = window.classboardContext;
      const issueId = button.closest('[data-case-id]')?.dataset.caseId;
      const issue = window.classboardCurrentIssues?.find((item) => item.id === issueId);
      if (!context || !issue || typeof window.openFormDialog !== 'function') return;
      window.openFormDialog({
        title: 'Review attendance concern',
        description: `${issue.message}\n\nThis private follow-up does not change official attendance.`,
        fields: [
          { name: 'state', label: 'Status', value: issue.state, options: [
            { value: 'new', label: 'New' }, { value: 'reviewing', label: 'Reviewing' },
            { value: 'reviewed', label: 'Reviewed' },
            { value: 'referred', label: 'Referred to faculty' }, { value: 'resolved', label: 'Resolved' }
          ] },
          { name: 'reply', label: 'Reply to the student', multiline: true, required: false, placeholder: 'Write a private response' }
        ],
        submitLabel: 'Save follow-up',
        onSubmit: async ({ state, reply }) => {
          const text = String(reply || '').trim();
          const nextState = text && ['new', 'reviewing'].includes(state) ? 'reviewed' : state;
          const updated = await window.classboardSupabase.from('attendance_issues').update({
            state: nextState, assigned_to: context.userId, resolved_at: nextState === 'resolved' ? new Date().toISOString() : null
          }).eq('id', issueId).eq('class_id', context.classId).select('id');
          if (updated.error) return updated.error.message;
          if (!updated.data?.length) return 'The concern could not be updated. Check your CR or admin access.';
          if (text) {
            const inserted = await window.classboardSupabase.from('attendance_issue_replies').insert({ issue_id: issueId, author_id: context.userId, body: text });
            if (inserted.error) return `Status saved, but the reply did not send: ${inserted.error.message}`;
          }
          await loadAttendanceIssues(context.classId);
          notifyApp('Attendance concern follow-up saved.');
        }
      });
    }, true);

    const updatesForm = document.getElementById('crUpdateForm');
    updatesForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const context = window.classboardContext;
      if (!context?.roles.includes('cr')) { notifyApp('Only an assigned CR can publish class updates.', true); return; }
      const values = new FormData(updatesForm);
      const category = String(values.get('category'));
      const { error } = await window.classboardSupabase.from('updates').insert({
        class_id: context.classId,
        title: String(values.get('title')).trim(),
        body: String(values.get('message')).trim(),
        category: category.toLowerCase(),
        importance: category === 'Important' ? 'important' : 'normal',
        created_by: context.userId,
        published_at: new Date().toISOString()
      });
      if (error) { notifyApp(`Update did not save: ${error.message}`, true); return; }
      updatesForm.reset();
      await loadLiveClassData(context.classId);
      notifyApp('Update published for the class.');
    }, true);

    const classLogForm = document.getElementById('crClassForm');
    classLogForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const context = window.classboardContext;
      if (!context?.roles.includes('cr')) { notifyApp('Only an assigned CR can add class log entries.', true); return; }
      const subjectResult = await window.classboardSupabase.from('subjects').select('id,name').eq('class_id', context.classId);
      if (subjectResult.error) { notifyApp(`Could not load subjects: ${subjectResult.error.message}`, true); return; }
      const values = new FormData(classLogForm);
      const subject = subjectResult.data.find((item) => item.name === values.get('subject'));
      const kind = String(values.get('sessionType')).toLowerCase();
      const batchValue = String(values.get('batch'));
      const { error } = await window.classboardSupabase.from('class_sessions').insert({
        class_id: context.classId,
        subject_id: subject?.id,
        class_number: Number(values.get('classNumber')),
        kind,
        batch: kind === 'lecture' ? 'all' : batchValue,
        state: String(values.get('status')).toLowerCase().replace(' ', '_'),
        starts_at: `${values.get('date')}T12:00:00+05:30`,
        topic: String(values.get('note') || '').trim() || null,
        created_by: context.userId,
        updated_by: context.userId
      });
      if (error) { notifyApp(`Class log did not save: ${error.message}`, true); return; }
      classLogForm.reset();
      await loadLiveClassData(context.classId);
      notifyApp('Class log saved to Supabase.');
    }, true);

    const scheduleForm = document.getElementById('crScheduleForm');
    scheduleForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const context = window.classboardContext;
      if (!context?.roles.includes('cr')) { notifyApp('Only an assigned CR can schedule classes.', true); return; }
      const subjectResult = await window.classboardSupabase.from('subjects').select('id,name').eq('class_id', context.classId);
      if (subjectResult.error) { notifyApp(`Could not load subjects: ${subjectResult.error.message}`, true); return; }
      const values = new FormData(scheduleForm);
      const subject = subjectResult.data.find((item) => item.name === values.get('subject'));
      const kind = String(values.get('sessionType')).toLowerCase();
      const batchValue = String(values.get('batch'));
      const startsAt = new Date(`${values.get('date')}T${values.get('time')}:00+05:30`).toISOString();
      const { error } = await window.classboardSupabase.from('class_sessions').insert({
        class_id: context.classId,
        subject_id: subject?.id,
        kind,
        batch: kind === 'lecture' ? 'all' : batchValue,
        state: 'scheduled',
        starts_at: startsAt,
        room: String(values.get('room')).trim(),
        created_by: context.userId,
        updated_by: context.userId
      });
      if (error) { notifyApp(`Class schedule did not save: ${error.message}`, true); return; }
      scheduleForm.reset();
      await loadLiveClassData(context.classId);
      notifyApp('Class added to the shared timetable.');
    }, true);

    const resourceForm = document.getElementById('crResourceForm');
    const resourceSubject = document.getElementById('crResourceSubject');
    const resourceType = resourceForm?.elements.namedItem('type');
    const syncResourceSubject = () => {
      const isCalendar = resourceType.value === 'Academic calendar';
      resourceSubject.disabled = isCalendar;
      resourceSubject.required = !isCalendar;
      if (isCalendar) resourceSubject.value = '';
    };
    resourceType?.addEventListener('change', syncResourceSubject);
    syncResourceSubject();
    resourceForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const context = window.classboardContext;
      if (!context?.roles.some((role) => role === 'cr' || role === 'admin')) { notifyApp('Only class reps and admins can upload class resources.', true); return; }
      const values = new FormData(resourceForm);
      const file = values.get('file');
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf') || file.size === 0 || file.size > 10 * 1024 * 1024) {
        notifyApp('Choose a non-empty PDF file smaller than 10 MB.', true);
        return;
      }
      const subjectResult = await window.classboardSupabase.from('subjects').select('id,name').eq('class_id', context.classId);
      if (subjectResult.error) { notifyApp(`Could not load subjects: ${subjectResult.error.message}`, true); return; }
      const kind = ({ Notes: 'notes', Syllabus: 'syllabus', 'Lab manual': 'lab_manual', 'Academic calendar': 'calendar' })[String(values.get('type'))];
      const subject = kind === 'calendar' ? null : subjectResult.data.find((item) => item.name === values.get('subject'));
      if (kind !== 'calendar' && !subject) { notifyApp('Choose one of the listed class subjects.', true); return; }
      const resourceId = crypto.randomUUID();
      const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[_\.]+|[_\.]+$/g, '') || 'resource.pdf';
      const storagePath = `${context.classId}/${resourceId}/${safeName}`;
      const upload = await window.classboardSupabase.storage.from('class-resources').upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: false
      });
      if (upload.error) { notifyApp(`PDF upload failed: ${upload.error.message}`, true); return; }
      const insert = await window.classboardSupabase.from('resources').insert({
        id: resourceId,
        class_id: context.classId,
        subject_id: subject?.id || null,
        title: String(values.get('title')).trim(),
        kind,
        storage_path: storagePath,
        uploaded_by: context.userId,
        published_at: new Date().toISOString()
      });
      if (insert.error) {
        await window.classboardSupabase.storage.from('class-resources').remove([storagePath]);
        notifyApp(`PDF uploaded, but its resource record could not be saved: ${insert.error.message}`, true);
        return;
      }
      resourceForm.reset();
      syncResourceSubject();
      closeUpload();
      await loadLiveClassData(context.classId);
      notifyApp('PDF published to the class resources.');
    }, true);

    const reminderForm = document.getElementById('crReminderForm');
    reminderForm?.addEventListener('submit', async (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      const context = window.classboardContext;
      if (!context?.roles.includes('cr')) { notifyApp('Only an assigned CR can publish reminders.', true); return; }
      const values = new FormData(reminderForm);
      const dueAt = new Date(`${values.get('date')}T12:00:00+05:30`).toISOString();
      const { error } = await window.classboardSupabase.from('reminders').insert({
        class_id: context.classId, title: String(values.get('title')).trim(),
        body: String(values.get('details') || '').trim() || null, due_at: dueAt, created_by: context.userId
      });
      if (error) { notifyApp(`Reminder did not save: ${error.message}`, true); return; }
      reminderForm.reset(); await loadLiveClassData(context.classId); notifyApp('Reminder published for the class.');
    }, true);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validCollegeEmail()) return;
    busy(true);
    showMessage('Signing in…');
    const { error } = await window.classboardSupabase.auth.signInWithPassword({ email: cleanEmail(), password: passwordInput.value });
    if (error) showMessage(error.message, true);
    busy(false);
  });

  document.getElementById('signUpButton').addEventListener('click', async () => {
    if (!validCollegeEmail()) return;
    if (passwordInput.value.length < 8) {
      showMessage('Choose a password with at least 8 characters.', true);
      passwordInput.focus();
      return;
    }
    busy(true);
    showMessage('Creating your account…');
    const { data, error } = await window.classboardSupabase.auth.signUp({ email: cleanEmail(), password: passwordInput.value });
    if (error) showMessage(error.message, true);
    else if (!data.session) showMessage('Account request accepted. Check your college inbox to confirm your email, then sign in.');
    else showMessage('Account created. Checking your class access…');
    busy(false);
  });

  document.getElementById('googleSignInButton').addEventListener('click', async () => {
    busy(true);
    showMessage('Opening Google sign-in…');
    const { error } = await window.classboardSupabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href.split('#')[0],
        queryParams: { hd: 'medicaps.ac.in' }
      }
    });
    if (error) {
      showMessage(error.message, true);
      busy(false);
    }
  });

  document.getElementById('resetPasswordButton').addEventListener('click', async () => {
    if (!validCollegeEmail()) return;
    busy(true);
    const { error } = await window.classboardSupabase.auth.resetPasswordForEmail(cleanEmail(), {
      redirectTo: new URL('./reset-password.html', window.location.href).href
    });
    showMessage(error ? error.message : 'If an account exists for this email, a password reset link is on its way.', Boolean(error));
    busy(false);
  });

  ['signOutButton', 'profileSignOut'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', async (event) => {
      event.preventDefault();
      await window.classboardSupabase.auth.signOut();
    });
  });

  start().catch((error) => showMessage(error.message, true));
})();
