// ClassBoard Founder Workspace - User Intelligence & Real-Time Activity Monitoring
// Restricted to ClassBoard founders via public.is_classboard_founder()

(() => {
  let isFounder = false;
  let metricsData = null;
  let currentUserList = [];
  let currentFilter = 'all';
  let currentSort = 'last_active';
  let currentSearch = '';
  let currentPageOffset = 0;
  const pageSize = 25;
  let totalUserCount = 0;
  let realtimeChannel = null;
  let activeDetailUserId = null;
  let activeTimelineFilter = 'all';

  function formatIST(isoDate) {
    if (!isoDate) return 'Never';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatRelative(isoDate) {
    if (!isoDate) return 'Never';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return 'Never';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 45) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function getPresenceStatus(user) {
    if (window.classboardOnlineUserIds?.has(user.user_id)) {
      return 'online';
    }
    if (!user.last_seen_at) return 'offline';
    const diffMin = (Date.now() - new Date(user.last_seen_at).getTime()) / 60000;
    if (diffMin <= 3) return 'online';
    if (diffMin <= 15) return 'recently_active';
    return 'offline';
  }

  function renderStatusBadge(status) {
    if (status === 'online') {
      return `<span class="cb-status-badge online"><span class="cb-pulse-dot"></span> Online</span>`;
    }
    if (status === 'recently_active') {
      return `<span class="cb-status-badge recently_active">● Recently active</span>`;
    }
    return `<span class="cb-status-badge offline">○ Offline</span>`;
  }

  function renderAuthBadge(method) {
    const m = (method || 'password').toLowerCase();
    const isGoogle = m.includes('google');
    return `<span class="cb-auth-badge ${isGoogle ? 'google' : ''}">${isGoogle ? 'Google' : 'Password'}</span>`;
  }

  function renderDeviceBadge(dev) {
    if (!dev || typeof dev !== 'object') return '<span class="founder-user-sub">Web</span>';
    const os = dev.os || 'Web';
    const browser = dev.browser || '';
    const type = dev.device_type === 'Mobile' ? '📱' : '💻';
    return `<span class="founder-user-sub" title="${browser} on ${os}">${type} ${browser || os}</span>`;
  }

  // Build the complete Founder Workspace UI structure inside #page-admin
  function initFounderUI() {
    const adminPage = document.getElementById('page-admin');
    if (!adminPage || adminPage.dataset.founderInitialized) return;
    adminPage.dataset.founderInitialized = 'true';

    // Update Header
    const headingH1 = adminPage.querySelector('.page-heading h1');
    if (headingH1) headingH1.textContent = 'Founder Workspace';
    const headingDesc = adminPage.querySelector('.page-heading .page-description');
    if (headingDesc) headingDesc.textContent = 'Comprehensive platform intelligence, live user activity monitoring, and section administration.';

    // Create Founder Workspace Wrapper
    const founderRoot = document.createElement('div');
    founderRoot.className = 'founder-workspace-container';
    founderRoot.id = 'founderWorkspaceRoot';

    founderRoot.innerHTML = `
      <!-- Founder Tabs -->
      <div class="founder-tabs-bar" role="tablist">
        <button class="founder-tab-btn active" id="tabBtnIntelligence" type="button" role="tab" aria-selected="true">
          <span>⚡ User Intelligence &amp; Activity</span>
        </button>
        <button class="founder-tab-btn" id="tabBtnRoles" type="button" role="tab" aria-selected="false">
          <span>👥 Section Management &amp; Roles</span>
        </button>
      </div>

      <!-- Panel: User Intelligence & Monitoring -->
      <div id="founderPanelIntelligence">
        <!-- 8 Core KPI Stat Cards -->
        <div class="founder-kpi-grid" id="founderKpiGrid">
          <div class="founder-kpi-card">
            <div class="founder-kpi-top">
              <span class="founder-kpi-label">Total Users</span>
              <span class="founder-kpi-icon">👥</span>
            </div>
            <div class="founder-kpi-value" id="kpiTotalUsers">—</div>
            <div class="founder-kpi-sub">Registered student &amp; staff accounts</div>
          </div>

          <div class="founder-kpi-card">
            <div class="founder-kpi-top">
              <span class="founder-kpi-label">Currently Online</span>
              <span class="founder-kpi-icon"><span class="cb-pulse-dot"></span></span>
            </div>
            <div class="founder-kpi-value" id="kpiOnlineUsers" style="color:#059669">—</div>
            <div class="founder-kpi-sub">Live presence &amp; active heartbeats</div>
          </div>

          <div class="founder-kpi-card">
            <div class="founder-kpi-top">
              <span class="founder-kpi-label">Active Today</span>
              <span class="founder-kpi-icon">🔥</span>
            </div>
            <div class="founder-kpi-value" id="kpiActiveToday">—</div>
            <div class="founder-kpi-sub">Engaged users in past 24 hours</div>
          </div>

          <div class="founder-kpi-card">
            <div class="founder-kpi-top">
              <span class="founder-kpi-label">New Today</span>
              <span class="founder-kpi-icon">✨</span>
            </div>
            <div class="founder-kpi-value" id="kpiNewRegistrations">—</div>
            <div class="founder-kpi-sub">New registrations today</div>
          </div>

          <div class="founder-kpi-card">
            <div class="founder-kpi-top">
              <span class="founder-kpi-label">Logins Today</span>
              <span class="founder-kpi-icon">🔑</span>
            </div>
            <div class="founder-kpi-value" id="kpiLoginsToday">—</div>
            <div class="founder-kpi-sub">Authenticated sign-in events</div>
          </div>

          <div class="founder-kpi-card">
            <div class="founder-kpi-top">
              <span class="founder-kpi-label">Sessions Today</span>
              <span class="founder-kpi-icon">⏱️</span>
            </div>
            <div class="founder-kpi-value" id="kpiSessionsToday">—</div>
            <div class="founder-kpi-sub">Total active &amp; historical sessions</div>
          </div>

          <div class="founder-kpi-card">
            <div class="founder-kpi-top">
              <span class="founder-kpi-label">Returning Users</span>
              <span class="founder-kpi-icon">🔄</span>
            </div>
            <div class="founder-kpi-value" id="kpiReturningUsers">—</div>
            <div class="founder-kpi-sub">Users with multiple sign-ins</div>
          </div>

          <div class="founder-kpi-card">
            <div class="founder-kpi-top">
              <span class="founder-kpi-label">Inactive (7+ Days)</span>
              <span class="founder-kpi-icon">💤</span>
            </div>
            <div class="founder-kpi-value" id="kpiInactiveUsers" style="color:#64748b">—</div>
            <div class="founder-kpi-sub">No recorded activity in 7+ days</div>
          </div>
        </div>

        <!-- Split Layout: Live Table + Real-Time Stream -->
        <div class="founder-intel-split" style="margin-top:20px;">
          <!-- Left: User Monitoring Table -->
          <div class="founder-card" style="flex:1;">
            <div class="founder-card-header">
              <div class="founder-card-title">
                <span>Live User Directory</span>
                <span id="founderUserCountBadge" style="font-size:0.8rem;font-weight:600;padding:2px 8px;border-radius:12px;background:#f1f5f9;color:#64748b">Loading…</span>
              </div>
            </div>

            <!-- Toolbar: Search & Status Filters -->
            <div class="founder-toolbar">
              <div class="founder-search-box">
                <span class="founder-search-icon">🔍</span>
                <input type="search" class="founder-search-input" id="founderSearchInput" placeholder="Search name, email, roll number…" />
              </div>

              <div class="founder-filter-group" id="founderStatusFilters">
                <button class="founder-filter-pill active" data-status="all" type="button">All</button>
                <button class="founder-filter-pill" data-status="online" type="button">🟢 Online</button>
                <button class="founder-filter-pill" data-status="recently_active" type="button">🟡 Recently active</button>
                <button class="founder-filter-pill" data-status="offline" type="button">Offline</button>
              </div>

              <select class="select-field" id="founderSortSelect" style="padding:6px 10px;font-size:0.82rem;margin:0;">
                <option value="last_active">Sort: Most recently active</option>
                <option value="last_login">Sort: Latest login</option>
                <option value="sessions">Sort: Most sessions</option>
                <option value="name">Sort: Name (A–Z)</option>
              </select>
            </div>

            <!-- Table -->
            <div class="founder-table-wrapper">
              <table class="founder-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Last Active</th>
                    <th>Sessions</th>
                    <th>Device</th>
                    <th style="text-align:right">Action</th>
                  </tr>
                </thead>
                <tbody id="founderUserTableBody">
                  <tr>
                    <td colspan="8" style="text-align:center;padding:32px;color:#94a3b8">Loading real-time user records…</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:0.82rem;color:#64748b;">
              <span id="founderPaginationInfo">Showing 0 of 0</span>
              <div style="display:flex;gap:8px;">
                <button class="secondary-button" id="founderPrevPage" type="button" disabled style="padding:4px 10px;font-size:0.8rem">Previous</button>
                <button class="secondary-button" id="founderNextPage" type="button" disabled style="padding:4px 10px;font-size:0.8rem">Next</button>
              </div>
            </div>
          </div>

          <!-- Right: Live Activity Feed Ticker -->
          <div class="founder-card" style="width:340px;">
            <div class="founder-card-header">
              <div class="founder-card-title">
                <span>Live Activity Stream</span>
                <span class="cb-pulse-dot" title="Listening to Supabase Realtime changes"></span>
              </div>
            </div>
            <div class="founder-stream-list" id="founderLiveStream">
              <div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.82rem;">Connecting to real-time events…</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Drawer / Modal for Detailed User Dossier -->
      <div class="founder-drawer-backdrop" id="founderDrawerBackdrop" aria-hidden="true">
        <div class="founder-drawer" id="founderDrawer">
          <div class="founder-drawer-header">
            <div style="display:flex;align-items:center;gap:12px;">
              <div class="founder-avatar" id="drawerUserAvatar" style="width:44px;height:44px;font-size:1.05rem;">CB</div>
              <div>
                <div style="font-size:1.15rem;font-weight:700;color:#0f172a;" id="drawerUserName">—</div>
                <div style="font-size:0.82rem;color:#64748b;" id="drawerUserEmail">—</div>
              </div>
            </div>
            <button class="founder-drawer-close" id="founderDrawerClose" type="button" aria-label="Close drawer">✕</button>
          </div>

          <div class="founder-drawer-body" id="drawerBody">
            <!-- Account & Auth Summary -->
            <div class="founder-dossier-grid">
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Current Status</span>
                <span class="founder-dossier-value" id="drawerStatus">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Section &amp; Roll</span>
                <span class="founder-dossier-value" id="drawerSectionRoll">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Latest Login</span>
                <span class="founder-dossier-value" id="drawerLastLogin" style="font-size:0.88rem;">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Auth Method</span>
                <span class="founder-dossier-value" id="drawerAuthMethod">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Total Logins</span>
                <span class="founder-dossier-value" id="drawerTotalLogins">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Total Sessions</span>
                <span class="founder-dossier-value" id="drawerTotalSessions">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">First Seen</span>
                <span class="founder-dossier-value" id="drawerFirstLogin" style="font-size:0.88rem;">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Last Heartbeat</span>
                <span class="founder-dossier-value" id="drawerLastSeen" style="font-size:0.88rem;">—</span>
              </div>
            </div>

            <!-- Top Visited Sections -->
            <div class="founder-card" style="padding:16px;">
              <div style="font-size:0.92rem;font-weight:700;color:#0f172a;margin-bottom:12px;">Most Visited Sections</div>
              <div id="drawerTopPages">
                <div style="color:#94a3b8;font-size:0.8rem;">No page views recorded yet.</div>
              </div>
            </div>

            <!-- Activity Timeline with Filters -->
            <div class="founder-card" style="padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                <div style="font-size:0.92rem;font-weight:700;color:#0f172a;">Activity Timeline</div>
                <div style="display:flex;gap:4px;" id="drawerTimelineFilters">
                  <button class="founder-filter-pill active" data-timeline-filter="all" type="button" style="padding:4px 8px;font-size:0.75rem;">All</button>
                  <button class="founder-filter-pill" data-timeline-filter="login" type="button" style="padding:4px 8px;font-size:0.75rem;">🔑 Logins</button>
                  <button class="founder-filter-pill" data-timeline-filter="page_view" type="button" style="padding:4px 8px;font-size:0.75rem;">📄 Pages</button>
                  <button class="founder-filter-pill" data-timeline-filter="resource" type="button" style="padding:4px 8px;font-size:0.75rem;">📚 Resources</button>
                  <button class="founder-filter-pill" data-timeline-filter="posts" type="button" style="padding:4px 8px;font-size:0.75rem;">✍️ Posts</button>
                </div>
              </div>

              <div id="drawerTimelineList" style="display:flex;flex-direction:column;">
                <div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.82rem;">Loading chronological activity…</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insert founderRoot at the top of #page-admin before the workspace-grid
    const existingRoleBanner = adminPage.querySelector('.role-banner');
    const existingStats = adminPage.querySelector('.stats');
    const existingGrid = adminPage.querySelector('.workspace-grid');

    if (existingRoleBanner) existingRoleBanner.style.display = 'none';
    if (existingStats) existingStats.style.display = 'none';

    // Wrap the existing section management in a panel container
    const rolesPanel = document.createElement('div');
    rolesPanel.id = 'founderPanelRoles';
    rolesPanel.hidden = true;
    if (existingGrid) {
      existingGrid.parentNode.insertBefore(rolesPanel, existingGrid);
      rolesPanel.appendChild(existingGrid);
    }

    adminPage.insertBefore(founderRoot, rolesPanel);

    // Wire Tab Switcher
    const tabBtnIntel = document.getElementById('tabBtnIntelligence');
    const tabBtnRoles = document.getElementById('tabBtnRoles');
    const panelIntel = document.getElementById('founderPanelIntelligence');

    tabBtnIntel.addEventListener('click', () => {
      tabBtnIntel.classList.add('active');
      tabBtnIntel.setAttribute('aria-selected', 'true');
      tabBtnRoles.classList.remove('active');
      tabBtnRoles.setAttribute('aria-selected', 'false');
      panelIntel.hidden = false;
      rolesPanel.hidden = true;
    });

    tabBtnRoles.addEventListener('click', () => {
      tabBtnRoles.classList.add('active');
      tabBtnRoles.setAttribute('aria-selected', 'true');
      tabBtnIntel.classList.remove('active');
      tabBtnIntel.setAttribute('aria-selected', 'false');
      panelIntel.hidden = true;
      rolesPanel.hidden = false;
    });

    // Wire Search Input (Debounced)
    let searchDebounce = null;
    const searchInput = document.getElementById('founderSearchInput');
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        currentSearch = searchInput.value.trim();
        currentPageOffset = 0;
        loadUserTable();
      }, 300);
    });

    // Wire Status Filter Pills
    document.querySelectorAll('#founderStatusFilters button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#founderStatusFilters button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.status;
        currentPageOffset = 0;
        loadUserTable();
      });
    });

    // Wire Sort Select
    const sortSelect = document.getElementById('founderSortSelect');
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      currentPageOffset = 0;
      loadUserTable();
    });

    // Wire Pagination Buttons
    document.getElementById('founderPrevPage').addEventListener('click', () => {
      if (currentPageOffset > 0) {
        currentPageOffset = Math.max(0, currentPageOffset - pageSize);
        loadUserTable();
      }
    });

    document.getElementById('founderNextPage').addEventListener('click', () => {
      if (currentPageOffset + pageSize < totalUserCount) {
        currentPageOffset += pageSize;
        loadUserTable();
      }
    });

    // Wire Drawer Close
    const drawerBackdrop = document.getElementById('founderDrawerBackdrop');
    const drawerCloseBtn = document.getElementById('founderDrawerClose');
    const closeDrawer = () => {
      drawerBackdrop.classList.remove('open');
      drawerBackdrop.setAttribute('aria-hidden', 'true');
      activeDetailUserId = null;
    };
    drawerCloseBtn.addEventListener('click', closeDrawer);
    drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === drawerBackdrop) closeDrawer();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawerBackdrop.classList.contains('open')) closeDrawer();
    });

    // Wire Drawer Timeline Filters
    document.querySelectorAll('#drawerTimelineFilters button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#drawerTimelineFilters button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeTimelineFilter = btn.dataset.timelineFilter;
        if (activeDetailUserId) loadUserTimeline(activeDetailUserId, activeTimelineFilter);
      });
    });
  }

  // Load Metrics from Database
  async function loadMetrics() {
    if (!window.classboardSupabase?.rpc) return;
    try {
      const { data, error } = await window.classboardSupabase.rpc('get_founder_user_intelligence_metrics');
      if (error) {
        console.warn('Metrics error:', error.message);
        return;
      }
      metricsData = data;
      renderMetrics();
    } catch (e) {
      console.warn('Could not load founder metrics:', e);
    }
  }

  function renderMetrics() {
    if (!metricsData) return;
    const el = (id) => document.getElementById(id);
    if (el('kpiTotalUsers')) el('kpiTotalUsers').textContent = metricsData.total_registered_users ?? '0';
    if (el('kpiActiveToday')) el('kpiActiveToday').textContent = metricsData.active_users_today ?? '0';
    if (el('kpiNewRegistrations')) el('kpiNewRegistrations').textContent = metricsData.new_registrations_today ?? '0';
    if (el('kpiLoginsToday')) el('kpiLoginsToday').textContent = metricsData.successful_logins_today ?? '0';
    if (el('kpiSessionsToday')) el('kpiSessionsToday').textContent = metricsData.total_sessions_today ?? '0';
    if (el('kpiReturningUsers')) el('kpiReturningUsers').textContent = metricsData.returning_users ?? '0';
    if (el('kpiInactiveUsers')) el('kpiInactiveUsers').textContent = metricsData.inactive_7_days ?? '0';

    // Online users: compute maximum of active heartbeat users and live Realtime presence users
    const livePresenceCount = window.classboardOnlineUserIds ? window.classboardOnlineUserIds.size : 0;
    const dbOnline = metricsData.currently_online_users || 0;
    const onlineCount = Math.max(livePresenceCount, dbOnline);
    if (el('kpiOnlineUsers')) el('kpiOnlineUsers').textContent = String(onlineCount);
  }

  // Load User List from Database
  async function loadUserTable() {
    const tbody = document.getElementById('founderUserTableBody');
    if (!tbody || !window.classboardSupabase?.rpc) return;

    try {
      const { data, error } = await window.classboardSupabase.rpc('get_founder_user_intelligence_users', {
        p_search: currentSearch || null,
        p_status_filter: currentFilter || 'all',
        p_sort_by: currentSort || 'last_active',
        p_limit: pageSize,
        p_offset: currentPageOffset
      });

      if (error) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#ef4444">Error loading users: ${error.message}</td></tr>`;
        return;
      }

      totalUserCount = data.total || 0;
      currentUserList = data.users || [];
      renderUserTable();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#ef4444">Failed to load user directory.</td></tr>`;
    }
  }

  function renderUserTable() {
    const tbody = document.getElementById('founderUserTableBody');
    const countBadge = document.getElementById('founderUserCountBadge');
    const paginationInfo = document.getElementById('founderPaginationInfo');
    const prevBtn = document.getElementById('founderPrevPage');
    const nextBtn = document.getElementById('founderNextPage');

    if (!tbody) return;

    if (countBadge) countBadge.textContent = `${totalUserCount} total`;
    if (paginationInfo) {
      const start = totalUserCount === 0 ? 0 : currentPageOffset + 1;
      const end = Math.min(currentPageOffset + pageSize, totalUserCount);
      paginationInfo.textContent = `Showing ${start}–${end} of ${totalUserCount} accounts`;
    }

    if (prevBtn) prevBtn.disabled = currentPageOffset === 0;
    if (nextBtn) nextBtn.disabled = currentPageOffset + pageSize >= totalUserCount;

    if (!currentUserList.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:#94a3b8">No users found matching current filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = currentUserList.map((user) => {
      const status = getPresenceStatus(user);
      const name = user.display_name || user.email.split('@')[0];
      const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'U';
      const roll = user.roll_number ? `Roll ${user.roll_number}` : '';
      const section = user.class_code || '';
      const sub = [section, roll].filter(Boolean).join(' · ');

      return `
        <tr data-user-id="${user.user_id}">
          <td>
            <div class="founder-user-cell">
              <div class="founder-avatar">${initials}</div>
              <div class="founder-user-meta">
                <span class="founder-user-name">${name}</span>
                <span class="founder-user-sub">${sub || 'Student'}</span>
              </div>
            </div>
          </td>
          <td>
            <span style="font-family:monospace;font-size:0.8rem;color:#475569;">${user.email}</span>
          </td>
          <td data-presence-cell="${user.user_id}">
            ${renderStatusBadge(status)}
          </td>
          <td>
            <div style="display:flex;flex-direction:column;gap:3px;">
              <span style="font-size:0.82rem;font-weight:600;color:#1e293b;">${formatIST(user.last_signed_in_at)}</span>
              <div>${renderAuthBadge(user.last_auth_method)}</div>
            </div>
          </td>
          <td>
            <div style="display:flex;flex-direction:column;gap:2px;">
              <span style="font-size:0.82rem;color:#0f172a;" title="${user.latest_activity_desc || 'No action recorded'}">
                ${user.latest_activity_desc ? (user.latest_activity_desc.length > 28 ? user.latest_activity_desc.slice(0, 28) + '…' : user.latest_activity_desc) : '—'}
              </span>
              <span style="font-size:0.74rem;color:#94a3b8;">${formatRelative(user.last_active_at)}</span>
            </div>
          </td>
          <td>
            <span style="font-weight:700;color:#0f172a;">${user.total_sessions || 0}</span>
          </td>
          <td>
            ${renderDeviceBadge(user.latest_device_info)}
          </td>
          <td style="text-align:right">
            <button class="founder-view-btn" data-view-user="${user.user_id}" type="button">View Dossier</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click listeners to view buttons and rows
    tbody.querySelectorAll('[data-view-user]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openUserDrawer(btn.dataset.viewUser);
      });
    });

    tbody.querySelectorAll('tr[data-user-id]').forEach((row) => {
      row.addEventListener('click', () => {
        openUserDrawer(row.dataset.userId);
      });
      row.style.cursor = 'pointer';
    });
  }

  // Open Individual User Intelligence Drawer
  async function openUserDrawer(userId) {
    if (!userId || !window.classboardSupabase?.rpc) return;
    activeDetailUserId = userId;
    const backdrop = document.getElementById('founderDrawerBackdrop');
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');

    const el = (id) => document.getElementById(id);
    el('drawerUserName').textContent = 'Loading dossier…';
    el('drawerUserEmail').textContent = 'Please wait';
    el('drawerStatus').textContent = '…';
    el('drawerSectionRoll').textContent = '…';
    el('drawerLastLogin').textContent = '…';
    el('drawerAuthMethod').textContent = '…';
    el('drawerTotalLogins').textContent = '…';
    el('drawerTotalSessions').textContent = '…';
    el('drawerFirstLogin').textContent = '…';
    el('drawerLastSeen').textContent = '…';
    el('drawerTopPages').innerHTML = '<div style="color:#94a3b8;font-size:0.8rem;">Loading analytics…</div>';
    el('drawerTimelineList').innerHTML = '<div style="color:#94a3b8;font-size:0.8rem;">Loading activity timeline…</div>';

    try {
      const { data, error } = await window.classboardSupabase.rpc('get_founder_user_detail', {
        p_target_user_id: userId
      });

      if (error || !data) {
        el('drawerUserName').textContent = 'User not found';
        return;
      }

      const name = data.display_name || data.email.split('@')[0];
      const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'U';
      el('drawerUserAvatar').textContent = initials;
      el('drawerUserName').textContent = name;
      el('drawerUserEmail').textContent = data.email;

      const isLiveOnline = window.classboardOnlineUserIds?.has(userId);
      const status = isLiveOnline ? 'online' : data.presence_status;
      el('drawerStatus').innerHTML = renderStatusBadge(status);

      const roll = data.roll_number ? `Roll ${data.roll_number}` : 'No roll assigned';
      const sec = data.class_code || 'General';
      el('drawerSectionRoll').textContent = `${sec} (${roll})`;

      el('drawerLastLogin').textContent = formatIST(data.last_signed_in_at);
      el('drawerAuthMethod').innerHTML = renderAuthBadge(data.latest_auth_method);
      el('drawerTotalLogins').textContent = String(data.total_logins || 0);
      el('drawerTotalSessions').textContent = String(data.total_sessions || 0);
      el('drawerFirstLogin').textContent = formatIST(data.first_login_at || data.created_at);
      el('drawerLastSeen').textContent = `${formatRelative(data.last_seen_at)} (${formatIST(data.last_seen_at)})`;

      // Render Top Visited Sections with Progress Bars
      const topPages = data.top_pages || [];
      if (topPages.length > 0) {
        const maxViews = Math.max(...topPages.map((p) => p.views), 1);
        el('drawerTopPages').innerHTML = topPages.map((item) => {
          const pct = Math.round((item.views / maxViews) * 100);
          return `
            <div class="founder-progress-row">
              <div class="founder-progress-label">
                <span>/${item.page}</span>
                <span>${item.views} visits</span>
              </div>
              <div class="founder-progress-bar-bg">
                <div class="founder-progress-fill" style="width:${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        el('drawerTopPages').innerHTML = '<div style="color:#94a3b8;font-size:0.8rem;">No page views recorded yet.</div>';
      }

      // Load chronological timeline
      loadUserTimeline(userId, activeTimelineFilter);
    } catch (e) {
      el('drawerUserName').textContent = 'Error loading details';
    }
  }

  // Load User Chronological Activity Timeline
  async function loadUserTimeline(userId, actionFilter = 'all') {
    const container = document.getElementById('drawerTimelineList');
    if (!container || !window.classboardSupabase?.rpc) return;

    try {
      const { data, error } = await window.classboardSupabase.rpc('get_founder_user_timeline', {
        p_target_user_id: userId,
        p_action_filter: actionFilter,
        p_limit: 50,
        p_offset: 0
      });

      if (error || !data?.events?.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.82rem;">No matching activity events found.</div>';
        return;
      }

      container.innerHTML = data.events.map((evt) => {
        let dotType = 'page';
        if (evt.action === 'login') dotType = 'login';
        else if (evt.action === 'logout') dotType = 'logout';
        else if (evt.action.includes('resource')) dotType = 'resource';
        else if (['update_create', 'reminder_create', 'class_logged'].includes(evt.action)) dotType = 'posts';

        return `
          <div class="founder-timeline-item">
            <span class="founder-timeline-dot ${dotType}"></span>
            <div class="founder-timeline-content">
              <span class="founder-timeline-title">${evt.description || evt.action}</span>
              <span class="founder-timeline-time">${formatIST(evt.created_at)} (${formatRelative(evt.created_at)})</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (_) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:0.82rem;">Error loading timeline events.</div>';
    }
  }

  // Prepend event to Live Activity Stream Ticker
  function appendLiveStreamItem(icon, title, subtitle) {
    const stream = document.getElementById('founderLiveStream');
    if (!stream) return;

    // Remove empty placeholder
    const emptyNotice = stream.querySelector('div[style*="text-align:center"]');
    if (emptyNotice) emptyNotice.remove();

    const item = document.createElement('div');
    item.className = 'founder-stream-item';
    item.innerHTML = `
      <div class="founder-stream-icon">${icon}</div>
      <div class="founder-stream-content">
        <span class="founder-stream-title">${title}</span>
        <span class="founder-stream-meta">
          <span>${subtitle}</span>
          <span>·</span>
          <span>Just now</span>
        </span>
      </div>
    `;

    stream.insertBefore(item, stream.firstChild);

    // Keep stream bounded to 30 items
    while (stream.children.length > 30) {
      stream.removeChild(stream.lastChild);
    }
  }

  // Setup Supabase Realtime Subscriptions
  function setupFounderRealtime() {
    if (!window.classboardSupabase?.channel) return;
    try {
      if (realtimeChannel) {
        window.classboardSupabase.removeChannel(realtimeChannel);
      }

      realtimeChannel = window.classboardSupabase.channel('founder-realtime-monitoring')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_login_events' }, (payload) => {
          const rec = payload.new;
          appendLiveStreamItem('🔑', `Sign-in via ${rec.auth_method || 'email'}`, `User: ${rec.user_id.slice(0, 8)}`);
          loadMetrics();
          loadUserTable();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_activity' }, (payload) => {
          const rec = payload.new;
          appendLiveStreamItem('⚡', rec.description || rec.action, `/${rec.page || 'app'}`);
          loadMetrics();
          // If drawer is open for this user, refresh timeline
          if (activeDetailUserId === rec.user_id) {
            loadUserTimeline(activeDetailUserId, activeTimelineFilter);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, () => {
          loadMetrics();
        })
        .subscribe();

      // Listen for presence updates from activity-tracker.js
      window.addEventListener('classboard:presence-sync', () => {
        renderMetrics();
        // Update presence status badges in table
        document.querySelectorAll('[data-presence-cell]').forEach((cell) => {
          const uid = cell.dataset.presenceCell;
          const isOnline = window.classboardOnlineUserIds?.has(uid);
          if (isOnline) {
            cell.innerHTML = renderStatusBadge('online');
          }
        });
      });
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  }

  // Startup Orchestrator
  async function init() {
    const context = window.classboardContext;
    if (!context?.isFounder) return;
    isFounder = true;

    initFounderUI();
    await loadMetrics();
    await loadUserTable();
    setupFounderRealtime();
  }

  // Listen for context-ready or initialize directly
  window.addEventListener('classboard:context-ready', (e) => {
    if (e.detail?.isFounder) {
      init();
    }
  });

  if (window.classboardContext?.isFounder) {
    init();
  }
})();
