(() => {
  const gate = document.getElementById('authGate');
  const app = document.querySelector('.app');
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const passwordVisibility = document.getElementById('togglePasswordVisibility');
  const message = document.getElementById('authMessage');
  function hidePassword() {
    if (passwordInput.type === 'password') return;
    passwordInput.type = 'password';
    passwordVisibility.textContent = 'Show';
    passwordVisibility.setAttribute('aria-label', 'Show password');
    passwordVisibility.setAttribute('aria-pressed', 'false');
  }
  passwordVisibility.addEventListener('click', () => {
    const willShow = passwordInput.type === 'password';
    passwordInput.type = willShow ? 'text' : 'password';
    passwordVisibility.textContent = willShow ? 'Hide' : 'Show';
    passwordVisibility.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
    passwordVisibility.setAttribute('aria-pressed', String(willShow));
  });
  document.getElementById('authForm').addEventListener('submit', hidePassword);
  document.getElementById('signUpButton').addEventListener('click', hidePassword);
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
    const labels = { student: 'Student view', cr: 'Class representatives', admin: 'Admin workspace' };
    // Show every active membership so staff accounts can also use Student view.
    const orderedRoles = ['student', 'cr', 'admin'].filter((role) => roles.includes(role));
    switcher.replaceChildren(...orderedRoles.map((role) => {
      const option = document.createElement('option');
      option.value = role;
      option.textContent = labels[role];
      return option;
    }));
    const savedRole = sessionStorage.getItem('classboard-role');
    switcher.value = roles.includes(savedRole) ? savedRole : roles.includes('admin') ? 'admin' : roles.includes('cr') ? 'cr' : 'student';
    const savedPage = sessionStorage.getItem('classboard-page');
    switcher.dispatchEvent(new Event('change', { bubbles: true }));
    const roleForPage = switcher.value;
    const canRestorePage = savedPage && (savedPage === 'admin'
      ? roleForPage === 'admin'
      : savedPage === 'cr' ? roleForPage === 'cr' : true);
    if (canRestorePage) {
      window.openClassboardPage?.(savedPage);
    }
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
    document.getElementById('mobileCrWorkspaceNav').hidden = !(roles.includes('cr') || roles.includes('admin'));
    ['crUpdateForm', 'crClassForm', 'crScheduleForm', 'crReminderForm'].forEach((id) => {
      const form = document.getElementById(id);
      if (form) form.closest('article').hidden = !roles.includes('cr');
    });
    const isStaffAccount = roles.includes('cr') || roles.includes('admin');
    const issuePanel = document.getElementById('issueForm')?.closest('article');
    if (issuePanel) issuePanel.hidden = !roles.includes('student') || isStaffAccount;
    const uploadButton = document.getElementById('openResourceUpload');
    if (uploadButton) uploadButton.hidden = !(roles.includes('cr') || roles.includes('admin'));
    const initials = displayName.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'CB';
    document.querySelectorAll('.profile-name').forEach((el) => { el.textContent = displayName; });
    document.querySelectorAll('.profile .avatar').forEach((el) => { el.textContent = initials; });
    const displayedRoles = isStaffAccount ? roles.filter((role) => role !== 'student') : roles;
    const roleLabel = `${displayedRoles.map((role) => role.toUpperCase()).join(' + ')} · AI & Analytics - A (INTEL-1)`;
    document.querySelector('.profile-role').textContent = roleLabel;
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('topbarAvatar').textContent = initials;
    document.getElementById('profileName').textContent = displayName;
    document.getElementById('profileRole').textContent = roleLabel;
    document.getElementById('profileEmail').textContent = user.email || 'Email unavailable';
    const greeting = document.getElementById('homeGreeting');
    if (greeting) greeting.textContent = `Hello, ${displayName.toLocaleUpperCase('en-IN')}`;
    const homeDate = document.getElementById('homeDate');
    if (homeDate) homeDate.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
    setRoleOptions(roles);
    const studentMembership = data.find((row) => row.role === 'student');
    const classId = data[0].class_id;
    window.classboardContext = { classId, userId: user.id, roles, rollNumber: studentMembership?.roll_number ?? null };
    if (studentMembership && window.setClassboardRoll) window.setClassboardRoll(studentMembership.roll_number);
    const issueDate = document.querySelector('#issueForm input[name="date"]');
    if (issueDate) {
      const today = new Date();
      issueDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    await loadLiveClassData(classId);
    await loadAttendancePlanner(classId, user.id, roles, studentMembership?.roll_number ?? null);
    startNotificationRefresh(classId);
    if (roles.includes('admin')) await loadAdminAccounts(classId);
    gate.hidden = true;
    app.hidden = false;
    showMessage('');
    if (studentMembership && !studentMembership.roll_number && !roles.includes('cr') && !roles.includes('admin')) {
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
    note.className = 'live-empty';
    note.textContent = text;
    container.append(note);
  }

  function startNotificationRefresh(classId) {
    if (window.classboardNotificationRefreshTimer) clearInterval(window.classboardNotificationRefreshTimer);
    window.classboardNotificationRefreshTimer = window.setInterval(() => {
      if (!document.hidden && window.classboardContext?.classId === classId) loadNotifications(classId);
    }, 30000);
    if (!window.classboardNotificationFocusHandler) {
      window.classboardNotificationFocusHandler = () => {
        const context = window.classboardContext;
        if (!document.hidden && context?.classId) loadNotifications(context.classId);
      };
      window.addEventListener('focus', window.classboardNotificationFocusHandler);
      document.addEventListener('visibilitychange', window.classboardNotificationFocusHandler);
    }
  }

  function addUpdateCard(update) {
    const card = document.createElement('div');
    const category = update.category.toLowerCase();
    const cardType = update.isReminder ? 'reminder' : category === 'deadline' ? 'deadline' : category === 'important' || update.importance === 'important' ? 'important' : 'general';
    card.className = `update update-card update-${cardType}`;
    card.dataset.contentId = update.id;
    card.dataset.contentType = update.isReminder ? 'reminders' : 'updates';
    card.dataset.category = update.isReminder ? 'Deadline' : category === 'deadline' ? 'Deadline' : category === 'important' ? 'Important' : 'General';
    const displayDate = update.isReminder ? update.due_at : cardType === 'deadline' && update.expires_at ? update.expires_at : update.published_at || update.created_at;
    const date = new Date(displayDate);
    const dateTile = document.createElement('div'); dateTile.className = 'update-date';
    const month = document.createElement('span'); month.className = 'update-date-month'; month.textContent = date.toLocaleString('en-IN', { month: 'short' });
    const day = document.createElement('span'); day.className = 'update-date-day'; day.textContent = String(date.getDate());
    dateTile.append(month, day);
    const icon = document.createElement('div'); icon.className = 'update-icon';
    icon.innerHTML = update.isReminder
      ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l3 2M5 3 3 5m16-2 2 2"></path></svg>'
      : cardType === 'deadline'
        ? '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18M8 14h2m4 0h2"></path></svg>'
        : cardType === 'important'
          ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6m0 4h.01"></path></svg>'
          : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5m0-8h.01"></path></svg>';
    const copy = document.createElement('div'); copy.className = 'update-copy';
    const title = document.createElement('div');
    title.className = 'update-title';
    title.textContent = update.title;
    if (cardType !== 'general') {
      const pill = document.createElement('span'); pill.className = 'update-tag';
      pill.textContent = cardType === 'reminder' ? 'Reminder' : cardType === 'deadline' ? 'Deadline' : 'Important';
      title.append(' ', pill);
    }
    const urgent = update.isReminder && /\burgent\b/i.test(update.body || '');
    if (urgent) {
      const status = document.createElement('span'); status.className = 'update-urgent'; status.textContent = 'Urgent';
      title.append(' ', status);
    }
    const body = document.createElement('div'); body.className = 'update-body';
    const bodyText = String(update.body || '').trim();
    let readableBody = bodyText;
    let sessionUrl = null;
    const linkMatch = bodyText.match(/https?:\/\/[^\s<>"']+/i);
    if (linkMatch) {
      const candidate = linkMatch[0].replace(/[.,;!?)}\]]+$/, '');
      try {
        const parsedUrl = new URL(candidate);
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
          sessionUrl = parsedUrl.href;
          readableBody = bodyText.replace(candidate, '').replace(/\b(?:(?:session|meeting)\s*)?(?:link|url)\s*:\s*/gi, ' ').replace(/\s*[,·|]\s*/g, ' · ').replace(/^(?:\s*·\s*)+|(?:\s*·\s*)+$/g, '').replace(/\s+/g, ' ').trim();
        }
      } catch {}
    }
    if (readableBody && !(urgent && /^urgent[.!]?$/i.test(readableBody))) body.textContent = readableBody;
    const time = document.createElement('div');
    time.className = 'update-time';
    const dueAt = update.isReminder ? update.due_at : cardType === 'deadline' ? update.expires_at : null;
    time.textContent = dueAt
      ? `${update.isReminder ? 'Reminder due' : 'Due'} ${new Date(dueAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
      : `Posted ${new Date(update.published_at || update.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
    copy.append(title);
    if (readableBody && !(urgent && /^urgent[.!]?$/i.test(readableBody))) copy.append(body);
    let joinLink = null;
    if (sessionUrl) {
      joinLink = document.createElement('a');
      joinLink.className = 'update-join-link';
      joinLink.href = sessionUrl;
      joinLink.target = '_blank';
      joinLink.rel = 'noopener noreferrer';
      joinLink.textContent = update.isReminder ? 'Join session ↗' : 'Open link ↗';
    }
    copy.append(time);
    card.append(dateTile, icon, copy);
    if (joinLink) card.append(joinLink);
    card.append(makeDeleteButton(update.isReminder ? 'Delete reminder' : 'Delete update', true));
    return card;
  }

  function makeDeleteButton(label = 'Delete', iconOnly = false) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'delete-content-button';
    button.dataset.deleteContent = 'true';
    if (iconOnly) {
      button.classList.add('update-delete');
      button.setAttribute('aria-label', label);
      button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"></path></svg>';
    } else button.textContent = label;
    button.hidden = !window.classboardContext?.roles.some((role) => role === 'cr' || role === 'admin');
    return button;
  }

  function addSessionRow(session, compact = false) {
    const subject = Array.isArray(session.subjects) ? session.subjects[0] : session.subjects;
    const date = new Date(session.starts_at);
    const month = date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const row = document.createElement('div');
    row.className = compact ? 'list-row' : 'list-row class-log-session';
    row.dataset.contentId = session.id;
    row.dataset.contentType = 'class_sessions';
    row.dataset.classSubject = subject?.name || 'Class';
    row.dataset.month = month;
    row.dataset.batch = session.batch === 'all' ? 'All students' : session.batch;
    row.dataset.kind = session.kind === 'lab' ? 'lab' : 'lecture';
    const subjectName = (subject?.name || '').toLowerCase();
    if (!compact && /software engineering/.test(subjectName)) row.dataset.subjectColor = 'purple';
    else if (!compact && /artificial intelligence/.test(subjectName)) row.dataset.subjectColor = 'red';
    else if (!compact && /statistical analysis/.test(subjectName)) row.dataset.subjectColor = 'green';
    else if (!compact && /computer organisation|computer organization/.test(subjectName)) row.dataset.subjectColor = 'yellow';
    else if (!compact && /java programming/.test(subjectName)) row.dataset.subjectColor = 'orange';
    else if (!compact && /soft skills/.test(subjectName)) row.dataset.subjectColor = 'rose';
    const dateBox = document.createElement('div');
    if (compact) {
      dateBox.className = 'reminder-date';
      const day = document.createElement('b'); day.textContent = String(date.getDate());
      const monthLabel = document.createElement('span'); monthLabel.textContent = date.toLocaleString('en-IN', { month: 'short' });
      dateBox.append(day, monthLabel);
    } else {
      dateBox.className = 'class-log-time';
      dateBox.textContent = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    }
    const main = document.createElement('div'); main.className = 'list-main';
    const title = document.createElement('div'); title.className = 'list-title';
    title.textContent = `${subject?.name || 'Class'}${session.class_number ? ` · Class ${session.class_number}` : ''}`;
    const detail = document.createElement('div'); detail.className = 'list-detail';
    if (compact) {
      const type = session.kind === 'lab' ? `Lab · ${session.batch}` : 'Lecture';
      detail.textContent = `${type} · ${date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${session.room ? ` · ${session.room}` : ''}${session.topic ? ` · ${session.topic}` : ''}`;
    } else {
      [session.kind === 'lab' ? 'Lab' : 'Lecture', ...(session.kind === 'lab' && session.batch ? [session.batch] : []), ...(session.room ? [session.room] : []), ...(session.topic ? [session.topic] : [])].forEach((label) => {
        const tag = document.createElement('span'); tag.className = 'class-log-tag'; tag.textContent = label; detail.append(tag);
      });
    }
    main.append(title, detail);
    const status = document.createElement('span'); status.className = 'status'; status.textContent = session.state.replaceAll('_', ' ');
    row.append(dateBox, main, status);
    const actions = compact ? row : document.createElement('div');
    if (!compact) actions.className = 'class-log-actions';
    actions.append(makeDeleteButton('Delete'));
    if (!compact && session.state !== 'scheduled' && window.classboardContext?.roles.includes('cr')) {
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'secondary-button class-log-edit-button';
      edit.dataset.editClassSession = session.id; edit.textContent = 'Edit';
      edit.setAttribute('aria-label', `Edit ${subject?.name || 'class'} class log`);
      actions.append(edit);
    }
    if (!compact) {
      const report = document.createElement('button'); report.className = 'text-link'; report.dataset.page = 'attendance'; report.textContent = 'Report an issue';
      actions.append(report);
      row.append(actions);
    }
    return row;
  }

  function resourceKindLabel(kind) {
    return ({ notes: 'Notes', syllabus: 'Syllabus', lab_manual: 'Lab manual', mst_pyq: 'MST / PYQs', calendar: 'Calendar' })[kind] || kind;
  }

  async function signedResourceUrl(path) {
    if (!path) return null;
    const { data, error } = await window.classboardSupabase.storage.from('class-resources').createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  }

  async function signedResourceDownloadUrl(path, filename) {
    if (!path) return null;
    const { data, error } = await window.classboardSupabase.storage.from('class-resources').createSignedUrl(path, 3600, { download: filename });
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
    const card = document.createElement(compact ? 'div' : 'article');
    card.className = compact ? 'resource' : 'resource-card';
    card.dataset.contentId = resource.id;
    card.dataset.contentType = 'resources';
    card.dataset.subject = subject?.name || '';
    card.dataset.type = kind;
    card.dataset.search = `${resource.title} ${subject?.name || ''} ${kind} ${resource.unit_label || ''}`.toLowerCase();
    card.dataset.resourcePath = resource.storage_path || '';
    card.dataset.resourceTitle = resource.title;
    const extension = resource.storage_path?.split('.').pop()?.toUpperCase();
    const icon = document.createElement('div'); icon.className = 'file-icon'; icon.textContent = ['PDF', 'DOCX', 'PPTX'].includes(extension) ? extension : 'FILE';
    const main = document.createElement('div'); main.className = 'list-main';
    const title = document.createElement('div'); title.className = 'resource-title'; title.textContent = resource.title;
    const meta = document.createElement('div'); meta.className = 'resource-meta';
    meta.textContent = [subject?.name, kind, resource.unit_label, `Added ${new Date(resource.published_at || resource.created_at).toLocaleDateString('en-IN')}`].filter(Boolean).join(' · ');
    main.append(title, meta);
    const actions = document.createElement('div'); actions.className = 'resource-actions';
    const preview = document.createElement('button');
    preview.type = 'button'; preview.className = 'resource-preview-button'; preview.dataset.previewPdf = 'true';
    preview.textContent = 'Preview'; preview.setAttribute('aria-label', `Preview ${resource.title}`);
    const download = document.createElement('button');
    download.type = 'button'; download.className = 'resource-download-button'; download.dataset.downloadPdf = 'true';
    download.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';
    download.setAttribute('aria-label', `Download ${resource.title}`);
    actions.append(preview, download);
    card.append(icon, main, actions);
    if (!compact) card.append(makeDeleteButton('Delete resource'));
    return card;
  }

  async function loadLiveClassData(classId) {
    const client = window.classboardSupabase;
    const [classResult, subjectResult, updateResult, sessionResult, resourceResult, reminderResult] = await Promise.all([
      client.from('classes').select('id,code,name,semester').eq('id', classId).single(),
      client.from('subjects').select('id,slug,name,short_name,display_order').eq('class_id', classId).eq('is_active', true).order('display_order'),
      client.from('updates').select('id,title,body,category,importance,created_at,published_at,expires_at').eq('class_id', classId).not('published_at', 'is', null).order('published_at', { ascending: false }).limit(20),
      client.from('class_sessions').select('id,subject_id,class_number,kind,batch,state,starts_at,room,topic,subjects(name,short_name)').eq('class_id', classId).order('starts_at', { ascending: false }).limit(50),
      client.from('resources').select('id,title,kind,unit_label,storage_path,created_at,published_at,subjects(name)').eq('class_id', classId).not('published_at', 'is', null).is('deleted_at', null).order('published_at', { ascending: false }).limit(50),
      client.from('reminders').select('id,title,body,due_at,created_at').eq('class_id', classId).eq('is_active', true).gte('due_at', new Date().toISOString()).order('due_at').limit(20)
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

    const updateFeed = [
      ...(updateResult.data || []).map((item) => ({ ...item, isReminder: false })),
      ...(reminderResult.data || []).map((item) => ({ ...item, category: 'deadline', importance: 'normal', isReminder: true }))
    ].sort((a, b) => new Date(b.isReminder ? b.created_at : b.published_at || b.created_at) - new Date(a.isReminder ? a.created_at : a.published_at || a.created_at));
    const updateContainers = [document.getElementById('updateList'), document.getElementById('homeUpdateList')];
    updateContainers.forEach((container, index) => {
      container.querySelectorAll('.update, .live-empty').forEach((node) => node.remove());
      if (!updateFeed.length) { addEmptyNote(container, 'No class updates or reminders have been published yet.'); return; }
      updateFeed.slice(0, index === 0 ? 40 : 2).forEach((item) => container.append(addUpdateCard(item)));
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
    window.classboardCurrentSessions = sessions;
    window.classboardSubjects = subjectResult.data || [];
    const monthSelect = document.getElementById('classMonthFilter');
    const previousMonth = monthSelect.value;
    const monthRows = new Map();
    sessions.forEach((session) => {
      const date = new Date(session.starts_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthRows.set(key, date.toLocaleString('en-IN', { month: 'long', year: 'numeric' }));
    });
    if (!monthRows.size) {
      const now = new Date();
      monthRows.set(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, now.toLocaleString('en-IN', { month: 'long', year: 'numeric' }));
    }
    const monthOptions = [...monthRows].sort(([a], [b]) => b.localeCompare(a));
    monthSelect.replaceChildren(...monthOptions.map(([, label]) => {
      const option = document.createElement('option'); option.value = label; option.textContent = label; return option;
    }));
    monthSelect.value = monthOptions.some(([, label]) => label === previousMonth) ? previousMonth : monthOptions[0][1];
    const classLogList = document.getElementById('classLogList');
    classLogList.replaceChildren();
    if (!sessions.length) addEmptyNote(classLogList, 'No class sessions have been added yet.');
    const dayGroups = new Map();
    const chronologicalSessions = [...sessions].sort((first, second) => new Date(first.starts_at) - new Date(second.starts_at));
    chronologicalSessions.forEach((session) => {
      const date = new Date(session.starts_at);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!dayGroups.has(key)) {
        const group = document.createElement('section'); group.className = 'class-log-day-group'; group.dataset.classLogDay = key;
        const heading = document.createElement('h2'); heading.className = 'class-log-day-heading';
        heading.innerHTML = '<span class="class-log-day-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg></span>';
        const dateLabel = document.createElement('span'); dateLabel.textContent = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        heading.append(dateLabel); group.append(heading); classLogList.append(group); dayGroups.set(key, { group, categories: new Map() });
      }
      const day = dayGroups.get(key);
      const category = session.kind === 'lab' ? 'lab' : 'lecture';
      if (!day.categories.has(category)) {
        const kindGroup = document.createElement('section'); kindGroup.className = 'class-log-kind-group'; kindGroup.dataset.classLogKind = category;
        const kindHeading = document.createElement('div'); kindHeading.className = 'class-log-kind-heading';
        kindHeading.textContent = category === 'lab' ? 'Labs' : 'Lectures';
        const count = document.createElement('span'); count.textContent = String(chronologicalSessions.filter((item) => {
          const itemDate = new Date(item.starts_at);
          return itemDate.getFullYear() === date.getFullYear() && itemDate.getMonth() === date.getMonth() && itemDate.getDate() === date.getDate() && (item.kind === 'lab' ? 'lab' : 'lecture') === category;
        }).length);
        kindHeading.append(count);
        const grid = document.createElement('div'); grid.className = 'class-log-session-grid';
        kindGroup.append(kindHeading, grid); day.group.append(kindGroup); day.categories.set(category, grid);
      }
      day.categories.get(category).append(addSessionRow(session));
    });
    const sessionContainers = [
      [document.getElementById('homeClassList'), sessions.slice(0, 3)],
      [document.getElementById('crRecentClasses'), sessions.slice(0, 5)]
    ];
    sessionContainers.forEach(([container, rows, compact]) => {
      container.replaceChildren();
      if (!rows.length) { addEmptyNote(container, 'No class sessions have been added yet.'); return; }
      rows.forEach((session) => container.append(addSessionRow(session, true)));
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
    const studentRoll = Number(window.classboardContext?.rollNumber);
    const studentBatch = studentRoll >= 1 && studentRoll <= 32 ? 'A1' : studentRoll >= 33 && studentRoll <= 66 ? 'A2' : null;
    const nextOptions = studentBatch
      ? upcoming.filter((session) => session.batch === 'all' || session.batch === 'Both batches' || session.batch === studentBatch)
      : upcoming;
    const next = nextOptions[0];
    if (next) {
      const subject = Array.isArray(next.subjects) ? next.subjects[0] : next.subjects;
      const date = new Date(next.starts_at);
      document.getElementById('nextClassName').textContent = subject?.name || 'Next class';
      document.getElementById('nextClassDetail').textContent = `${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
      document.getElementById('nextClassTime').textContent = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
      const batchLabel = next.batch === 'all' ? 'All students' : next.batch;
      document.getElementById('nextClassContext').textContent = `${next.kind === 'lab' ? 'Lab' : 'Lecture'} · ${batchLabel}`;
      document.getElementById('nextClassRoom').textContent = next.room || 'Room not set';
    } else {
      document.getElementById('nextClassName').textContent = 'No class scheduled yet';
      document.getElementById('nextClassDetail').textContent = 'Your CR will add upcoming classes to the timetable.';
      document.getElementById('nextClassTime').textContent = '—';
      document.getElementById('nextClassContext').textContent = 'Timetable';
      document.getElementById('nextClassRoom').textContent = 'Waiting for the next class';
    }
  }

  function renderHomeAttendanceSummary(subjects, sharedRows, personalRows, rollNumber) {
    const root = document.getElementById('homeAttendanceSummary');
    if (!root) return;

    const subjectById = new Map((subjects || []).map((subject) => [subject.id, subject]));
    const heldByKey = new Map((sharedRows || []).map((row) => [
      `${row.subject_id}:${row.kind}:${row.batch}`,
      Number(row.classes_held) || 0
    ]));
    const roll = Number(rollNumber);
    const studentBatch = roll >= 1 && roll <= 32 ? 'A1' : roll >= 33 && roll <= 66 ? 'A2' : null;
    const entries = (personalRows || []).reduce((items, row) => {
      const subject = subjectById.get(row.subject_id);
      if (!subject || !['lecture', 'lab'].includes(row.kind)) return items;
      if (row.kind === 'lecture' && row.batch !== 'all') return items;
      if (row.kind === 'lab' && studentBatch && row.batch !== studentBatch) return items;
      const held = heldByKey.get(`${row.subject_id}:${row.kind}:${row.batch}`) || 0;
      if (!held) return items;
      const attended = Number(row.attended_classes) || 0;
      const percentage = Math.min(100, attended / held * 100);
      items.push({
        name: subject.name,
        meta: `${row.kind === 'lab' ? `Lab · ${row.batch} · ` : 'Lecture · '}${attended} of ${held} classes`,
        percentage
      });
      return items;
    }, []).sort((left, right) => right.percentage - left.percentage || left.name.localeCompare(right.name));

    root.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'home-attendance-empty';
      empty.textContent = 'Add attendance in the planner to see your subject and lab summaries.';
      root.append(empty);
      return;
    }

    entries.slice(0, 3).forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'home-attendance-row';
      const details = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'home-attendance-name';
      name.textContent = entry.name;
      const meta = document.createElement('div');
      meta.className = 'home-attendance-meta';
      meta.textContent = entry.meta;
      details.append(name, meta);
      const value = document.createElement('div');
      value.className = 'home-attendance-value';
      value.textContent = `${entry.percentage.toFixed(1)}%`;
      const progress = document.createElement('div');
      progress.className = 'progress';
      progress.setAttribute('aria-label', `${entry.name} attendance ${entry.percentage.toFixed(1)}%`);
      const fill = document.createElement('span');
      fill.style.setProperty('--percent', `${entry.percentage}%`);
      progress.append(fill);
      row.append(details, value, progress);
      root.append(row);
    });
  }

  async function loadAttendancePlanner(classId, userId, roles, rollNumber) {
    const client = window.classboardSupabase;
    const cards = [...document.querySelectorAll('#page-attendance [data-subject-card]')];
    const subjectByName = new Map((window.classboardSubjects || []).map((subject) => [subject.name, subject]));
    const isStaff = roles.includes('cr') || roles.includes('admin');
    const batchFromRoll = Number(rollNumber) >= 1 && Number(rollNumber) <= 32 ? 'A1' : Number(rollNumber) >= 33 && Number(rollNumber) <= 66 ? 'A2' : null;
    const batchPickerWrap = document.getElementById('attendanceLabBatchWrap');
    const batchPicker = document.getElementById('attendanceLabBatch');
    if (batchPickerWrap) batchPickerWrap.hidden = !isStaff;
    if (batchPicker && !isStaff && batchFromRoll) batchPicker.value = batchFromRoll;
    cards.forEach((card) => {
      card.querySelector('.subject-held').readOnly = !isStaff;
      card.querySelector('.subject-attended').readOnly = !roles.includes('student');
    });
    const activeBatch = isStaff ? batchPicker?.value || 'A1' : batchFromRoll || 'A1';
    const [countsResult, progressResult] = await Promise.all([
      client.from('attendance_class_counts').select('subject_id,kind,batch,classes_held').eq('class_id', classId),
      client.from('student_attendance_progress').select('subject_id,kind,batch,attended_classes').eq('class_id', classId).eq('user_id', userId)
    ]);
    if (countsResult.error || progressResult.error) {
      notifyApp(`Could not load attendance figures: ${(countsResult.error || progressResult.error).message}`, true);
      return;
    }
    renderHomeAttendanceSummary(window.classboardSubjects, countsResult.data, progressResult.data, rollNumber);
    const countKey = (subjectId, kind, batch) => `${subjectId}:${kind}:${batch}`;
    const heldCounts = new Map((countsResult.data || []).map((row) => [countKey(row.subject_id, row.kind, row.batch), row.classes_held]));
    const personalCounts = new Map((progressResult.data || []).map((row) => [countKey(row.subject_id, row.kind, row.batch), row.attended_classes]));
    cards.forEach((card) => {
      const subjectName = card.dataset.attendanceSubjectName || String(card.dataset.subjectName || '').replace(/ Lab$/, '');
      const subject = subjectByName.get(subjectName);
      if (!subject) return;
      const kind = card.dataset.attendanceMode === 'lab' ? 'lab' : 'lecture';
      const batch = kind === 'lab' ? activeBatch : 'all';
      const key = countKey(subject.id, kind, batch);
      const held = heldCounts.get(key) ?? 0;
      const attended = personalCounts.get(key) ?? 0;
      const heldInput = card.querySelector('.subject-held');
      const attendedInput = card.querySelector('.subject-attended');
      const heldLabel = heldInput.closest('label');
      const submit = card.querySelector('.subject-calculator button[type="submit"]');
      heldInput.value = String(held);
      heldInput.readOnly = !isStaff;
      heldInput.setAttribute('aria-readonly', String(!isStaff));
      heldInput.title = isStaff ? 'Shared class count managed by CRs and admins' : 'Set by a class representative or admin';
      attendedInput.value = String(attended);
      attendedInput.max = String(held);
      attendedInput.readOnly = !roles.includes('student');
      attendedInput.title = 'Your personal attended-class count';
      if (isStaff && !heldInput.dataset.attendanceLimitConnected) {
        heldInput.dataset.attendanceLimitConnected = 'true';
        heldInput.addEventListener('input', () => {
          const nextHeld = Number(heldInput.value);
          attendedInput.max = String(Number.isInteger(nextHeld) && nextHeld >= 0 ? nextHeld : 0);
        });
      }
      heldLabel.dataset.sharedAttendanceCount = 'true';
      if (!card.dataset.attendanceStorageKey) card.dataset.attendanceStorageKey = key;
      if (!card.dataset.attendanceConnected) {
        card.dataset.attendanceConnected = 'true';
        card.querySelector('.subject-calculator').addEventListener('submit', async (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          const activeContext = window.classboardContext;
          const activeRoles = activeContext?.roles || [];
          const activeStaff = activeRoles.includes('cr') || activeRoles.includes('admin');
          const enteredHeld = Number(heldInput.value);
          const enteredAttended = Number(attendedInput.value);
          if (!Number.isInteger(enteredAttended) || enteredAttended < 0) {
            notifyApp('Attended classes must be a whole number of 0 or more.', true);
            return;
          }
          if (!activeStaff && enteredAttended > Number(heldInput.value)) {
            notifyApp('Attended classes cannot exceed the shared classes-held total.', true);
            return;
          }
          if (activeStaff && (!Number.isInteger(enteredHeld) || enteredHeld < 0)) {
            notifyApp('Classes held must be a whole number of 0 or more.', true);
            return;
          }
          const savePersonalAttendance = activeRoles.includes('student')
            && enteredAttended <= (activeStaff ? enteredHeld : Number(heldInput.value));
          const activeSubject = subjectByName.get(card.dataset.attendanceSubjectName || String(card.dataset.subjectName || '').replace(/ Lab$/, ''));
          if (!activeSubject) {
            notifyApp('Could not identify this subject. Refresh and try again.', true);
            button.disabled = false;
            return;
          }
          const activeKind = card.dataset.attendanceMode === 'lab' ? 'lab' : 'lecture';
          const activeBatch = activeKind === 'lab' ? (activeStaff ? document.getElementById('attendanceLabBatch')?.value || 'A1' : batchFromRoll || 'A1') : 'all';
          const button = card.querySelector('.subject-calculator button[type="submit"]');
          button.disabled = true;
          try {
            if (activeStaff) {
              const savedHeld = await client.from('attendance_class_counts').upsert({
                class_id: classId, subject_id: activeSubject.id, kind: activeKind, batch: activeBatch,
                classes_held: enteredHeld, updated_by: userId
              }, { onConflict: 'class_id,subject_id,kind,batch' }).select('classes_held').maybeSingle();
              if (savedHeld.error) throw savedHeld.error;
            }
            if (savePersonalAttendance) {
              const savedProgress = await client.from('student_attendance_progress').upsert({
                class_id: classId, user_id: userId, subject_id: activeSubject.id, kind: activeKind,
                batch: activeBatch, attended_classes: enteredAttended
              }, { onConflict: 'user_id,class_id,subject_id,kind,batch' }).select('attended_classes').maybeSingle();
              if (savedProgress.error) throw savedProgress.error;
            }
            heldInput.value = String(activeStaff ? enteredHeld : held);
            attendedInput.max = String(heldInput.value);
            attendedInput.value = String(enteredAttended);
            card.updateAttendancePlan?.();
            notifyApp(activeStaff && activeRoles.includes('student') && !savePersonalAttendance
              ? 'Shared total saved. Your attended count is above it; update your own count to continue.'
              : activeStaff ? (activeRoles.includes('student') ? 'Shared classes-held total and your attendance were saved.' : 'Shared classes-held total was saved.') : 'Your attended-class count was saved.', activeStaff && activeRoles.includes('student') && !savePersonalAttendance);
            await loadAttendancePlanner(classId, userId, roles, rollNumber);
          } catch (error) {
            notifyApp(`Attendance figures did not save: ${error.message}`, true);
          } finally {
            button.disabled = false;
          }
        }, true);
      }
      card.updateAttendancePlan?.();
    });
    const modePicker = document.getElementById('attendanceMode');
    if (modePicker && !modePicker.dataset.batchConnected) {
      modePicker.dataset.batchConnected = 'true';
      modePicker.addEventListener('change', () => {
        if (batchPickerWrap) batchPickerWrap.hidden = !isStaff || modePicker.value !== 'lab';
      });
    }
    if (batchPicker && isStaff && !batchPicker.dataset.reloadConnected) {
      batchPicker.dataset.reloadConnected = 'true';
      batchPicker.addEventListener('change', () => loadAttendancePlanner(classId, userId, roles, rollNumber));
    }
    if (batchPickerWrap) batchPickerWrap.hidden = !isStaff || modePicker?.value !== 'lab';
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
    const [result, updateCountResult, unreadCountResult] = await Promise.all([
      client.from('notifications')
        .select('id,source_type,source_id,created_at,read_at')
        .eq('class_id', classId).eq('recipient_id', userId)
        .order('created_at', { ascending: false }).limit(50),
      client.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId).eq('recipient_id', userId).eq('source_type', 'update').is('read_at', null),
      client.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId).eq('recipient_id', userId).is('read_at', null)
    ]);
    if (result.error) { notifyApp(`Could not load notifications: ${result.error.message}`, true); return; }

    const notifications = result.data || [];
    const unreadTotal = unreadCountResult.error
      ? notifications.filter((item) => !item.read_at).length
      : unreadCountResult.count || 0;
    const updateCount = updateCountResult.error
      ? notifications.filter((item) => item.source_type === 'update' && !item.read_at).length
      : updateCountResult.count || 0;
    const updatesBadge = document.getElementById('updatesUnreadCount');
    if (updatesBadge) {
      updatesBadge.textContent = updateCount > 99 ? '99+' : String(updateCount);
      updatesBadge.hidden = updateCount === 0;
      updatesBadge.closest('.nav-item')?.setAttribute('aria-label', updateCount ? `Updates, ${updateCount} unread` : 'Updates');
    }
    const ids = (type) => notifications.filter((item) => item.source_type === type).map((item) => item.source_id);
    const [updates, reminders, resources, sessions] = await Promise.all([
      ids('update').length ? client.from('updates').select('id,title,body,category,importance').in('id', ids('update')) : Promise.resolve({ data: [], error: null }),
      ids('reminder').length ? client.from('reminders').select('id,title,body,due_at').in('id', ids('reminder')) : Promise.resolve({ data: [], error: null }),
      ids('resource').length ? client.from('resources').select('id,title,kind,subjects(name)').in('id', ids('resource')) : Promise.resolve({ data: [], error: null }),
      ids('class_session').length ? client.from('class_sessions').select('id,class_number,kind,batch,starts_at,room,subjects(name)').in('id', ids('class_session')) : Promise.resolve({ data: [], error: null })
    ]);
    const failed = [updates, reminders, resources, sessions].find((request) => request.error);
    if (failed) { notifyApp(`Could not load notification details: ${failed.error.message}`, true); return; }
    const sources = new Map([updates, reminders, resources, sessions].flatMap((request) => (request.data || []).map((source) => [source.id, source])));
    const seenByUser = window.classboardNotificationSeenByUser || (window.classboardNotificationSeenByUser = new Map());
    const seenKey = `${classId}:${userId}`;
    const seenIds = seenByUser.get(seenKey);
    const firstNotificationLoad = !seenIds;
    const newNotificationIds = new Set(firstNotificationLoad ? [] : notifications.filter((item) => !seenIds.has(String(item.id))).map((item) => String(item.id)));
    const updatedSeenIds = new Set(seenIds || []);
    notifications.forEach((item) => updatedSeenIds.add(String(item.id)));
    while (updatedSeenIds.size > 500) updatedSeenIds.delete(updatedSeenIds.values().next().value);
    seenByUser.set(seenKey, updatedSeenIds);
    list.replaceChildren();
    const renderedNotificationDetails = [];
    let currentDay = '';
    notifications.forEach((notification) => {
      const source = sources.get(notification.source_id);
      if (!source) return;
      const subject = Array.isArray(source.subjects) ? source.subjects[0] : source.subjects;
      let title = source.title;
      let detail = '';
      if (notification.source_type === 'update') detail = [source.category === 'deadline' ? 'Deadline' : source.category === 'important' ? 'Important' : 'Update', source.body || ''].filter(Boolean).join(' · ');
      else if (notification.source_type === 'reminder') detail = [source.body, `Due ${new Date(source.due_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`].filter(Boolean).join(' · ');
      else if (notification.source_type === 'resource') detail = [subject?.name, resourceKindLabel(source.kind)].filter(Boolean).join(' · ');
      else {
        title = `${subject?.name || 'Class'}${source.class_number ? ` · Class ${source.class_number}` : ''}`;
        detail = `${source.kind === 'lab' ? `Lab · ${source.batch}` : 'Lecture'} · ${new Date(source.starts_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${source.room ? ` · ${source.room}` : ''}`;
      }
      const createdAt = new Date(notification.created_at);
      const dayKey = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;
      if (dayKey !== currentDay) {
        currentDay = dayKey;
        const group = document.createElement('section'); group.className = 'notification-day';
        const label = document.createElement('div'); label.className = 'notification-day-label';
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const notificationDay = new Date(createdAt); notificationDay.setHours(0, 0, 0, 0);
        label.textContent = notificationDay.getTime() === today.getTime() ? 'Today' : notificationDay.getTime() === yesterday.getTime() ? 'Yesterday' : createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        group.append(label); list.append(group);
      }
      let type = notification.source_type === 'reminder' ? 'reminder' : notification.source_type === 'resource' ? 'resource' : notification.source_type === 'class_session' ? 'class' : source.category === 'deadline' ? 'deadline' : source.category === 'important' ? 'important' : 'update';
      const labels = { update: 'Class update', important: 'Important notice', deadline: 'Deadline', reminder: 'Reminder', resource: 'New resource', class: 'Class schedule' };
      renderedNotificationDetails.push({ id: String(notification.id), title, message: detail, label: labels[type] });
      const row = document.createElement('article'); row.className = `notification-item notification-${type}`; row.dataset.notificationId = notification.id;
      if (notification.read_at) row.classList.add('notification-read');
      const mark = document.createElement('div'); mark.className = 'notification-icon'; mark.textContent = notification.source_type === 'resource' ? resourceKindLabel(source.kind).split(' ')[0].toUpperCase() : notification.source_type === 'reminder' ? 'REM' : notification.source_type === 'class_session' ? 'CLASS' : type === 'deadline' ? 'DUE' : type === 'important' ? '!' : 'INFO';
      const main = document.createElement('div'); main.className = 'notification-main';
      const typeLabel = document.createElement('div'); typeLabel.className = 'notification-type'; typeLabel.textContent = labels[type];
      const heading = document.createElement('div'); heading.className = 'list-title'; heading.textContent = title;
      const sub = document.createElement('div'); sub.className = 'list-detail'; sub.textContent = detail;
      const meta = document.createElement('div'); meta.className = 'notification-meta';
      const date = document.createElement('time'); date.dateTime = notification.created_at; date.textContent = createdAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
      const unread = document.createElement('span'); unread.className = 'notification-unread'; unread.setAttribute('aria-label', notification.read_at ? 'Read' : 'Unread');
      meta.append(date, unread); main.append(typeLabel, heading, sub); row.append(mark, main, meta); list.lastElementChild.append(row);
    });
    if (!list.children.length) addEmptyNote(list, 'No class notifications yet. New updates and reminders will appear here.');
    document.querySelectorAll('.unread').forEach((dot) => dot.remove());
    if ((unreadCountResult.count || 0) > 0) document.querySelectorAll('[aria-label="Notifications"]').forEach((button) => {
      if (!button.querySelector('.unread')) { const dot = document.createElement('span'); dot.className = 'unread'; button.append(dot); }
    });
    const freshDetails = renderedNotificationDetails.filter((item) => newNotificationIds.has(item.id));
    if (freshDetails.length) {
      window.dispatchEvent(new CustomEvent('classboard:new-notification', { detail: { ...freshDetails[0], count: freshDetails.length } }));
    } else if (firstNotificationLoad && unreadTotal === 0) {
      const promptKey = `classboard-empty-notifications:${seenKey}`;
      let alreadyPrompted = false;
      try { alreadyPrompted = sessionStorage.getItem(promptKey) === 'shown'; } catch (_) {}
      if (!alreadyPrompted) {
        try { sessionStorage.setItem(promptKey, 'shown'); } catch (_) {}
        window.dispatchEvent(new CustomEvent('classboard:new-notification', { detail: { kind: 'empty' } }));
      }
    }
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
      if (['referred', 'resolved'].includes(issue.state)) {
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-content-button case-delete'; remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove reviewed attendance concern from ${names.get(issue.student_id) || 'student'}`);
        actions.append(remove);
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
      [['cr', 'Class representative'], ['admin', 'Admin']].forEach(([value, label]) => {
        const roleLabel = document.createElement('label');
        const check = document.createElement('input'); check.type = 'checkbox'; check.value = value; check.checked = user.roles.has(value);
        roleLabel.append(check, document.createTextNode(label)); roleGroup.append(roleLabel);
      });
      const rollLabel = document.createElement('label'); rollLabel.className = 'account-roll-label'; rollLabel.textContent = 'Student roll number';
      const roll = document.createElement('input'); roll.className = 'text-field'; roll.type = 'number'; roll.min = '1'; roll.max = '66'; roll.placeholder = 'Optional'; roll.value = user.rollNumber ?? '';
      rollLabel.append(roll);
      const save = document.createElement('button'); save.className = 'secondary-button'; save.type = 'button'; save.textContent = 'Save roles';
      save.addEventListener('click', async () => {
        const roles = ['student', ...[...roleGroup.querySelectorAll('input:checked')].map((input) => input.value)];
        const rollNumber = roll.value ? Number(roll.value) : null;
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
      const remove = document.createElement('button'); remove.className = 'account-remove-button'; remove.type = 'button'; remove.textContent = 'Remove access';
      remove.disabled = user.userId === window.classboardContext?.userId;
      remove.title = remove.disabled ? 'You cannot remove your own access here.' : 'Remove this account from the Classboard class';
      remove.addEventListener('click', async () => {
        if (user.userId === window.classboardContext?.userId) return;
        const confirmed = window.confirm(`Remove ${user.name} from this Classboard class? They will lose access to its resources and workspaces. Their Google account will not be deleted.`);
        if (!confirmed) return;
        remove.disabled = true;
        const { error } = await client.rpc('remove_class_member_access', {
          p_user_id: user.userId, p_class_id: classId
        });
        if (error) { remove.disabled = false; notifyApp(`Could not remove class access: ${error.message}`, true); return; }
        await loadAdminAccounts(classId);
        notifyApp(`Removed ${user.name} from this Classboard class.`);
      });
      controls.append(roleGroup, rollLabel, save, remove); row.append(avatar, main, controls); container.append(row);
    });
    document.getElementById('adminMemberCount').textContent = String(userRows.length);
    document.getElementById('adminStudentCount').textContent = String(userRows.filter((user) => user.roles.has('student') && user.rollNumber !== null).length);
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

    window.classboardSupabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
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
      if (!context?.roles.some((role) => role === 'cr' || role === 'admin')) { notifyApp('Only class representatives and admins can delete class content.', true); return; }
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

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-edit-class-session]');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const context = window.classboardContext;
      if (!context?.roles.includes('cr')) { notifyApp('Only class representatives can edit saved class-log entries.', true); return; }
      const session = window.classboardCurrentSessions?.find((item) => item.id === button.dataset.editClassSession);
      if (!session || session.state === 'scheduled') { notifyApp('This saved class-log entry is no longer available to edit.', true); return; }
      const subjects = window.classboardSubjects || [];
      const classDate = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date(session.starts_at)).map((part) => [part.type, part.value]));
      if (typeof window.openFormDialog !== 'function') return;
      window.openFormDialog({
        title: 'Edit class-log entry',
        description: 'Correct this saved class record. Only CRs can edit class-log details.',
        fields: [
          { name: 'subjectId', label: 'Subject', value: session.subject_id, options: subjects.map((item) => ({ value: item.id, label: item.short_name ? `${item.name} (${item.short_name})` : item.name })) },
          { name: 'sessionType', label: 'Class type', value: session.kind, options: [{ value: 'lecture', label: 'Lecture' }, { value: 'lab', label: 'Lab' }] },
          { name: 'batch', label: 'Lab batch', value: session.batch === 'all' ? 'A1' : session.batch, options: ['A1', 'A2'] },
          { name: 'date', label: 'Class date', type: 'date', value: `${classDate.year}-${classDate.month}-${classDate.day}` },
          { name: 'classNumber', label: 'Class number', type: 'number', required: false, value: session.class_number == null ? '' : String(session.class_number), placeholder: 'Optional' },
          { name: 'status', label: 'Status', value: session.state, options: [{ value: 'held', label: 'Held' }, { value: 'no_class', label: 'No class' }] },
          { name: 'note', label: 'Topic or note', required: false, value: session.topic || '', placeholder: 'Optional' }
        ],
        submitLabel: 'Save changes',
        onSubmit: async ({ subjectId, sessionType, batch, date, classNumber, status, note }) => {
          if (!subjects.some((item) => item.id === subjectId)) return 'Choose a valid subject.';
          if (!date) return 'Choose the class date.';
          const kind = String(sessionType);
          if (!['lecture', 'lab'].includes(kind)) return 'Choose Lecture or Lab.';
          if (kind === 'lab' && !['A1', 'A2'].includes(batch)) return 'Choose A1 or A2 for the lab.';
          const numberText = String(classNumber || '').trim();
          const number = numberText ? Number(numberText) : null;
          if (number !== null && (!Number.isInteger(number) || number < 1)) return 'Class number must be a positive whole number.';
          const updated = await window.classboardSupabase.from('class_sessions').update({
            subject_id: subjectId,
            class_number: number,
            kind,
            batch: kind === 'lecture' ? 'all' : batch,
            state: status,
            starts_at: `${date}T12:00:00+05:30`,
            topic: String(note || '').trim() || null,
            updated_by: context.userId
          }).eq('id', session.id).eq('class_id', context.classId).select('id');
          if (updated.error) return updated.error.message;
          if (!updated.data?.length) return 'The entry was not changed. Confirm the CR edit migration is applied and try again.';
          await loadLiveClassData(context.classId);
          notifyApp('Class-log entry updated.');
        }
      });
    }, true);

    const previewDialog = document.getElementById('pdfPreviewDialog');
    const previewFrame = document.getElementById('pdfPreviewFrame');
    const previewTitle = document.getElementById('pdfPreviewTitle');
    const previewFileType = document.getElementById('previewFileType');
    const previewDownload = document.getElementById('pdfPreviewDownload');
    document.getElementById('pdfPreviewClose')?.addEventListener('click', () => previewDialog?.close());
    previewDialog?.addEventListener('click', (event) => {
      if (event.target === previewDialog) previewDialog.close();
    });
    previewDialog?.addEventListener('close', () => {
      previewFrame.removeAttribute('src');
      delete previewDownload.dataset.resourcePath;
      delete previewDownload.dataset.filename;
    });
    previewDownload?.addEventListener('click', async () => {
      const path = previewDownload.dataset.resourcePath;
      const filename = previewDownload.dataset.filename;
      if (!path || !filename) return;
      previewDownload.disabled = true;
      const url = await signedResourceDownloadUrl(path, filename);
      previewDownload.disabled = false;
      if (!url) { notifyApp('Could not download this resource. Please try again.', true); return; }
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    });
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-preview-pdf], [data-download-pdf]');
      if (!button) return;
      event.preventDefault();
      const card = button.closest('[data-resource-path]');
      if (!card?.dataset.resourcePath) { notifyApp('This resource is not available right now.', true); return; }
      button.disabled = true;
      const title = card.dataset.resourceTitle || 'Class resource';
      const extension = card.dataset.resourcePath.split('.').pop().toLowerCase();
      const filename = `${title.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'class-resource'}.${['pdf', 'docx', 'pptx'].includes(extension) ? extension : 'pdf'}`;
      if (button.dataset.previewPdf) {
        const viewUrl = await signedResourceUrl(card.dataset.resourcePath);
        button.disabled = false;
        if (!viewUrl) { notifyApp('Could not open this resource. Please try again.', true); return; }
        previewTitle.textContent = title;
        previewFileType.textContent = extension.toUpperCase();
        previewFrame.src = extension === 'pdf'
          ? `${viewUrl}#view=FitH`
          : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewUrl)}`;
        previewDownload.dataset.resourcePath = card.dataset.resourcePath;
        previewDownload.dataset.filename = filename;
        previewDownload.disabled = false;
        if (!previewDialog.open) previewDialog.showModal();
      } else {
        const url = await signedResourceDownloadUrl(card.dataset.resourcePath, filename);
        button.disabled = false;
        if (!url) { notifyApp('Could not download this resource. Please try again.', true); return; }
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      }
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
      const deleteButton = event.target.closest('.case-delete');
      if (deleteButton) {
        event.preventDefault(); event.stopImmediatePropagation();
        const context = window.classboardContext;
        const issueId = deleteButton.closest('[data-case-id]')?.dataset.caseId;
        const issue = window.classboardCurrentIssues?.find((item) => item.id === issueId);
        if (!context || !issue) return;
        if (!['referred', 'resolved'].includes(issue.state)) {
          notifyApp('Only reviewed concerns can be removed.', true);
          return;
        }
        if (!window.confirm('Remove this reviewed attendance concern and its replies? This cannot be undone.')) return;
        deleteButton.disabled = true;
        const { data, error } = await window.classboardSupabase.from('attendance_issues')
          .delete().eq('id', issueId).eq('class_id', context.classId).select('id');
        if (error) { deleteButton.disabled = false; notifyApp(`Could not remove the concern: ${error.message}`, true); return; }
        if (!data?.length) { deleteButton.disabled = false; notifyApp('Could not remove this concern. Check your CR or admin access.', true); return; }
        await loadAttendanceIssues(context.classId);
        notifyApp('Reviewed attendance concern removed.');
        return;
      }
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
    const deadlineField = document.getElementById('crUpdateDeadlineField');
    const syncDeadlineField = () => {
      const isDeadline = updatesForm?.elements.namedItem('category').value === 'Deadline';
      deadlineField.hidden = !isDeadline;
      deadlineField.querySelector('input').required = isDeadline;
    };
    updatesForm?.elements.namedItem('category').addEventListener('change', syncDeadlineField);
    syncDeadlineField();
    updatesForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const context = window.classboardContext;
      if (!context?.roles.includes('cr')) { notifyApp('Only an assigned CR can publish class updates.', true); return; }
      const values = new FormData(updatesForm);
      const category = String(values.get('category'));
      const expiresAt = category === 'Deadline' ? new Date(String(values.get('deadline'))).toISOString() : null;
      const { error } = await window.classboardSupabase.from('updates').insert({
        class_id: context.classId,
        title: String(values.get('title')).trim(),
        body: String(values.get('message')).trim(),
        category: category.toLowerCase(),
        importance: category === 'Important' ? 'important' : 'normal',
        expires_at: expiresAt,
        created_by: context.userId,
        published_at: new Date().toISOString()
      });
      if (error) { notifyApp(`Update did not save: ${error.message}`, true); return; }
      updatesForm.reset();
      syncDeadlineField();
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
      if (kind === 'lab' && !['A1', 'A2'].includes(batchValue)) { notifyApp('Choose A1 or A2 for the lab.', true); return; }
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
      if (kind === 'lab' && !['A1', 'A2'].includes(batchValue)) { notifyApp('Choose A1 or A2 for the lab.', true); return; }
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
      if (!context?.roles.some((role) => role === 'cr' || role === 'admin')) { notifyApp('Only class representatives and admins can upload class resources.', true); return; }
      const values = new FormData(resourceForm);
      const file = values.get('file');
      const extension = file instanceof File ? file.name.split('.').pop().toLowerCase() : '';
      const resourceMimeTypes = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      };
      if (!(file instanceof File) || !resourceMimeTypes[extension] || (file.type && file.type !== resourceMimeTypes[extension]) || file.size === 0 || file.size > 10 * 1024 * 1024) {
        notifyApp('Choose a non-empty PDF, DOCX, or PPTX file smaller than 10 MB.', true);
        return;
      }
      const subjectResult = await window.classboardSupabase.from('subjects').select('id,name').eq('class_id', context.classId);
      if (subjectResult.error) { notifyApp(`Could not load subjects: ${subjectResult.error.message}`, true); return; }
      const kind = ({ Notes: 'notes', Syllabus: 'syllabus', 'Lab manual': 'lab_manual', 'MST / PYQs': 'mst_pyq', 'Academic calendar': 'calendar' })[String(values.get('type'))];
      const subject = kind === 'calendar' ? null : subjectResult.data.find((item) => item.name === values.get('subject'));
      if (kind !== 'calendar' && !subject) { notifyApp('Choose one of the listed class subjects.', true); return; }
      const resourceId = crypto.randomUUID();
      const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[_\.]+|[_\.]+$/g, '') || `resource.${extension}`;
      const storagePath = `${context.classId}/${resourceId}/${safeName}`;
      const upload = await window.classboardSupabase.storage.from('class-resources').upload(storagePath, file, {
        contentType: resourceMimeTypes[extension],
        upsert: false
      });
      if (upload.error) { notifyApp(`Resource upload failed: ${upload.error.message}`, true); return; }
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
        notifyApp(`File uploaded, but its resource record could not be saved: ${insert.error.message}`, true);
        return;
      }
      resourceForm.reset();
      syncResourceSubject();
      closeUpload();
      await loadLiveClassData(context.classId);
      notifyApp('Resource published to the class.');
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
