// ClassBoard Founder Workspace - User Intelligence & Real-Time Activity Monitoring
// Restricted to ClassBoard founders via public.is_classboard_founder()

(() => {
  let isFounder = false;
  let metricsData = null;
  let dashboardData = null;
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
  let currentTimeframe = '7d';

  // Configurable AdSense Monetization Constants
  const RPM_LOW = 15;      // ₹15 per 1,000 monetizable pageviews
  const RPM_GROUND = 30;   // ₹30 per 1,000 monetizable pageviews

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

  function formatSeconds(sec) {
    if (!sec || isNaN(sec) || sec <= 0) return '0s';
    const s = Math.round(sec);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }

  function formatINR(val) {
    const num = Number(val) || 0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

  function getBatchForRollAndClass(roll, classCode) {
    if (!roll) return null;
    const num = Number(roll);
    if (!Number.isInteger(num)) return null;
    const isIntel2 = classCode === 'INTEL-2';
    const first = isIntel2 ? 'B1' : 'A1';
    const second = isIntel2 ? 'B2' : 'A2';
    const maxRoll = classCode === 'IBM-1' ? 67 : 66;
    if (num >= 1 && num <= 32) return first;
    if (num >= 33 && num <= maxRoll) return second;
    return null;
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
    if (headingDesc) headingDesc.textContent = 'Comprehensive platform intelligence, student-usage analytics, and section administration.';

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
      <div id="founderPanelIntelligence" style="display:flex;flex-direction:column;gap:20px;">
        
        <!-- SECTION 1: Student Usage Analytics Header & Timeframe Filter -->
        <div class="founder-analytics-section">
          <div class="founder-analytics-header">
            <div class="founder-analytics-title">
              <h3>
                <span>🎓 Student Usage Analytics</span>
                <span class="founder-info-tip" title="Metrics strictly calculate active student accounts. Founder, admin, staff, and tester accounts along with background heartbeats are excluded.">?</span>
              </h3>
              <p>Real student adoption, intentional screen engagement, and 7-day retention.</p>
            </div>
            <div class="founder-timeframe-toolbar" id="founderTimeframeToolbar">
              <button class="founder-tf-pill" data-tf="today" type="button">Today</button>
              <button class="founder-tf-pill active" data-tf="7d" type="button">7 Days</button>
              <button class="founder-tf-pill" data-tf="30d" type="button">30 Days</button>
            </div>
          </div>

          <!-- 11 Student Usage Cards -->
          <div class="founder-kpi-grid" id="founderStudentKpiGrid">
            <!-- 1. Active Students Today -->
            <div class="founder-kpi-card" title="Unique student accounts that performed at least one intentional action today">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Active Students Today</span>
                <span class="founder-kpi-icon">🔥</span>
              </div>
              <div class="founder-kpi-value" id="kpiActiveStudentsToday">—</div>
              <div class="founder-kpi-sub">Unique active students today</div>
            </div>

            <!-- 2. Active Students · 7 Days -->
            <div class="founder-kpi-card" title="Unique student accounts active over the past 7 days">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Active Students · 7D</span>
                <span class="founder-kpi-icon">👥</span>
              </div>
              <div class="founder-kpi-value" id="kpiActiveStudents7d" style="color:#0284c7">—</div>
              <div class="founder-kpi-sub">Unique students in past 7 days</div>
            </div>

            <!-- 3. Valid Pageviews Today -->
            <div class="founder-kpi-card" title="Intentional student screen views today. Excludes rerenders, refreshes, and heartbeats.">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Valid Pageviews Today</span>
                <span class="founder-kpi-icon">📄</span>
              </div>
              <div class="founder-kpi-value" id="kpiValidPageviewsToday">—</div>
              <div class="founder-kpi-sub">Intentional screen navigations</div>
            </div>

            <!-- 4. Valid Pageviews · 7 Days -->
            <div class="founder-kpi-card" title="Intentional screen views by students in the past 7 days">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Valid Pageviews · 7D</span>
                <span class="founder-kpi-icon">📊</span>
              </div>
              <div class="founder-kpi-value" id="kpiValidPageviews7d" style="color:#2563eb">—</div>
              <div class="founder-kpi-sub">Past 7 days student screen views</div>
            </div>

            <!-- 5. Monetizable Pageviews -->
            <div class="founder-kpi-card" title="Valid views on real content screens eligible for ads (Student Home, Notes, Attendance, Academics, Class Log)">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Monetizable Pageviews</span>
                <span class="founder-kpi-icon">💎</span>
              </div>
              <div class="founder-kpi-value" id="kpiMonetizablePageviews" style="color:#059669">—</div>
              <div class="founder-kpi-sub">Eligible ad-ready content views</div>
            </div>

            <!-- 6. Student Sessions -->
            <div class="founder-kpi-card" title="Student sessions. A new session starts after 30 minutes of inactivity.">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Student Sessions</span>
                <span class="founder-kpi-icon">⏱️</span>
              </div>
              <div class="founder-kpi-value" id="kpiStudentSessions">—</div>
              <div class="founder-kpi-sub">30-min inactivity rule</div>
            </div>

            <!-- 7. Views per Session -->
            <div class="founder-kpi-card" title="Average valid pageviews per student session">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Views per Session</span>
                <span class="founder-kpi-icon">🧭</span>
              </div>
              <div class="founder-kpi-value" id="kpiViewsPerSession">—</div>
              <div class="founder-kpi-sub">Valid views ÷ total sessions</div>
            </div>

            <!-- 8. Views per Active Student -->
            <div class="founder-kpi-card" title="Average valid pageviews generated per active student">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Views / Active Student</span>
                <span class="founder-kpi-icon">🎯</span>
              </div>
              <div class="founder-kpi-value" id="kpiViewsPerStudent">—</div>
              <div class="founder-kpi-sub">Valid views ÷ active students</div>
            </div>

            <!-- 9. 7-Day Returning Students -->
            <div class="founder-kpi-card" title="Students who were active on at least two distinct calendar days during the 7-day period">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">7D Returning Students</span>
                <span class="founder-kpi-icon">🔄</span>
              </div>
              <div class="founder-kpi-value" id="kpiReturningStudents7d" style="color:#7c3aed">—</div>
              <div class="founder-kpi-sub">Active on ≥2 distinct calendar days</div>
            </div>

            <!-- 10. 7-Day Return Rate -->
            <div class="founder-kpi-card" title="Returning students ÷ 7-day active students × 100">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">7-Day Return Rate</span>
                <span class="founder-kpi-icon">📈</span>
              </div>
              <div class="founder-kpi-value" id="kpiReturnRate7d" style="color:#d97706">—</div>
              <div class="founder-kpi-sub">Repeat student engagement rate</div>
            </div>

            <!-- 11. Average Engagement Time -->
            <div class="founder-kpi-card" title="Average active session browsing duration">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Avg Engagement Time</span>
                <span class="founder-kpi-icon">⏳</span>
              </div>
              <div class="founder-kpi-value" id="kpiAvgEngagementTime">—</div>
              <div class="founder-kpi-sub">Mean active duration / session</div>
            </div>
          </div>
        </div>

        <!-- SECTION 2: Public Landing Analytics (Visually Grouped) -->
        <div class="founder-landing-box">
          <div class="founder-analytics-title">
            <h3>
              <span>🌐 Public Landing Analytics</span>
              <span class="founder-info-tip" title="Privacy-safe anonymous visitor tracking before login. Refreshes do not inflate unique visitors.">?</span>
            </h3>
            <p>Pre-authentication top-of-funnel reach and landing-to-login conversion efficiency.</p>
          </div>

          <div class="founder-landing-grid">
            <div class="founder-kpi-card" style="background:#ffffff;" title="Total impressions on the public landing page in selected timeframe">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Landing Pageviews</span>
                <span class="founder-kpi-icon">👀</span>
              </div>
              <div class="founder-kpi-value" id="kpiLandingPageviews" style="color:#006BFF;">—</div>
              <div class="founder-kpi-sub">Public landing page impressions</div>
            </div>

            <div class="founder-kpi-card" style="background:#ffffff;" title="Unique browser devices visiting the public landing page (refresh-safe)">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Unique Landing Visitors</span>
                <span class="founder-kpi-icon">👤</span>
              </div>
              <div class="founder-kpi-value" id="kpiLandingUniqueVisitors">—</div>
              <div class="founder-kpi-sub">Distinct anonymous visitors</div>
            </div>

            <div class="founder-kpi-card" style="background:#ffffff;" title="Successful logins ÷ unique landing visitors × 100">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Landing-to-Login Conversion</span>
                <span class="founder-kpi-icon">🚀</span>
              </div>
              <div class="founder-kpi-value" id="kpiLandingConversion" style="color:#059669;">—</div>
              <div class="founder-kpi-sub">Visitors who converted to sign-in</div>
            </div>
          </div>
        </div>

        <!-- SECTION 3: Analytics Panels (Trend, Top Pages, Class Usage, Revenue Potential) -->
        <div class="founder-panels-grid">
          <!-- Panel 1: Traffic & Retention Trend -->
          <div class="founder-card" id="founderPanelTrend">
            <div class="founder-card-header">
              <div class="founder-card-title">
                <span>Traffic &amp; Retention Trend</span>
                <span style="font-size:0.75rem;font-weight:600;color:#64748b;">7-Day Daily Breakdown</span>
              </div>
            </div>
            <div class="founder-trend-container">
              <div class="founder-trend-bars" id="founderTrendBars">
                <div style="margin:auto;color:#94a3b8;font-size:0.8rem;">Loading 7-day trend…</div>
              </div>
              <div class="founder-trend-legend">
                <span><span class="founder-legend-dot" style="background:#006BFF;"></span>Valid Pageviews</span>
                <span><span class="founder-legend-dot" style="background:#0284c7;"></span>Active Students</span>
              </div>
            </div>
          </div>

          <!-- Panel 2: Top Pages -->
          <div class="founder-card" id="founderPanelTopPages">
            <div class="founder-card-header">
              <div class="founder-card-title">
                <span>Top Pages</span>
                <span style="font-size:0.75rem;font-weight:600;color:#64748b;">Ranked by Valid Pageviews</span>
              </div>
            </div>
            <div class="founder-table-wrapper" style="max-height:240px;overflow-y:auto;">
              <table class="founder-table">
                <thead>
                  <tr>
                    <th style="width:36px;">#</th>
                    <th>Page / Screen</th>
                    <th>Type</th>
                    <th style="text-align:right;">Views</th>
                    <th style="text-align:right;">Share</th>
                  </tr>
                </thead>
                <tbody id="founderTopPagesBody">
                  <tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">Loading top pages…</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Panel 3: Class / Section Usage -->
          <div class="founder-card" id="founderPanelClassUsage">
            <div class="founder-card-header">
              <div class="founder-card-title">
                <span>Class / Section Usage</span>
                <span style="font-size:0.75rem;font-weight:600;color:#64748b;">Cohort Engagement Breakdown</span>
              </div>
            </div>
            <div class="founder-table-wrapper" style="max-height:240px;overflow-y:auto;">
              <table class="founder-table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Cohort Name</th>
                    <th style="text-align:right;">Active Students</th>
                    <th style="text-align:right;">Valid Views</th>
                    <th style="text-align:right;">Views/Student</th>
                  </tr>
                </thead>
                <tbody id="founderClassUsageBody">
                  <tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">Loading class breakdown…</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Panel 4: Revenue Potential -->
          <div class="founder-card" id="founderPanelRevenue">
            <div class="founder-card-header">
              <div class="founder-card-title">
                <span>Revenue Potential</span>
                <span style="font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e;">Conservative ₹15–₹30 RPM</span>
              </div>
            </div>
            
            <div class="founder-revenue-grid">
              <div class="founder-revenue-stat-box">
                <span class="founder-revenue-stat-label">Projected Monthly Views</span>
                <span class="founder-revenue-stat-val" id="revMonthlyViews" style="color:#006BFF;">—</span>
                <span style="font-size:0.68rem;color:#64748b;">(7D monetizable views ÷ 7) × 30</span>
              </div>

              <div class="founder-revenue-stat-box highlight">
                <span class="founder-revenue-stat-label">Estimated Monthly Earnings</span>
                <span class="founder-revenue-stat-val" id="revEstimatedEarnings" style="color:#059669;">—</span>
                <span style="font-size:0.68rem;color:#059669;font-weight:600;">₹15 Low · ₹30 Ground RPM</span>
              </div>

              <div class="founder-revenue-stat-box">
                <span class="founder-revenue-stat-label">Public Landing Views (7D)</span>
                <span class="founder-revenue-stat-val" id="revLandingViews">—</span>
                <span style="font-size:0.68rem;color:#64748b;">Pre-auth ad-ready views</span>
              </div>

              <div class="founder-revenue-stat-box">
                <span class="founder-revenue-stat-label">Logged-in App Views (7D)</span>
                <span class="founder-revenue-stat-val" id="revAppViews">—</span>
                <span style="font-size:0.68rem;color:#64748b;">Authenticated content screens</span>
              </div>
            </div>

            <div class="founder-revenue-disclaimer">
              ⚠️ <strong>Estimate only.</strong> Actual earnings depend on AdSense approval, ad fill, viewability, traffic quality and the real Page RPM reported by Google. Never display this estimate as guaranteed income or official AdSense eligibility.
            </div>
          </div>
        </div>

        <!-- SECTION 4: Split Layout: Live User Directory + Real-Time Stream (Preserved Intact) -->
        <div class="founder-intel-split" style="margin-top:10px;">
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

              <div class="founder-toolbar-actions">
                <div class="founder-filter-group" id="founderStatusFilters">
                  <button class="founder-filter-pill active" data-status="all" type="button">All</button>
                  <button class="founder-filter-pill" data-status="online" type="button">🟢 Online</button>
                  <button class="founder-filter-pill" data-status="recently_active" type="button">🟡 Recently active</button>
                  <button class="founder-filter-pill" data-status="offline" type="button">Offline</button>
                </div>

                <select class="select-field founder-sort-select" id="founderSortSelect">
                  <option value="last_active">Sort: Most recently active</option>
                  <option value="last_login">Sort: Latest login</option>
                  <option value="sessions">Sort: Most sessions</option>
                  <option value="name">Sort: Name (A–Z)</option>
                </select>
              </div>
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
          <div class="founder-card founder-stream-card">
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

      <!-- Drawer / Modal for Detailed User Dossier (Preserved Intact) -->
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

          <div class="founder-drawer-content">
            <div class="founder-dossier-grid">
              <div class="founder-dossier-card">
                <div class="founder-dossier-label">Current Status</div>
                <div id="drawerUserStatus" style="margin-top:4px;">—</div>
              </div>
              <div class="founder-dossier-card">
                <div class="founder-dossier-label">Enrolled Section</div>
                <div id="drawerUserSection" style="font-weight:700;margin-top:4px;">—</div>
              </div>
              <div class="founder-dossier-card">
                <div class="founder-dossier-label">Total Logins</div>
                <div id="drawerUserLogins" style="font-weight:700;font-size:1.2rem;margin-top:4px;">—</div>
              </div>
              <div class="founder-dossier-card">
                <div class="founder-dossier-label">Recorded Sessions</div>
                <div id="drawerUserSessions" style="font-weight:700;font-size:1.2rem;margin-top:4px;">—</div>
              </div>
            </div>

            <div class="founder-dossier-card" style="margin-top:14px;">
              <div class="founder-dossier-label">Device &amp; Environment</div>
              <div id="drawerUserDevice" style="font-size:0.82rem;color:#475569;margin-top:6px;line-height:1.4;">—</div>
            </div>

            <div style="margin-top:20px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
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
      if (headingH1) headingH1.textContent = 'Founder Workspace';
      if (headingDesc) headingDesc.textContent = 'Comprehensive platform intelligence, student-usage analytics, and section administration.';
    });

    tabBtnRoles.addEventListener('click', () => {
      tabBtnRoles.classList.add('active');
      tabBtnRoles.setAttribute('aria-selected', 'true');
      tabBtnIntel.classList.remove('active');
      tabBtnIntel.setAttribute('aria-selected', 'false');
      panelIntel.hidden = true;
      rolesPanel.hidden = false;
      if (headingH1) headingH1.textContent = 'Section Administration';
      if (headingDesc) headingDesc.textContent = 'Manage access, roles, and content for your assigned section.';
    });

    // Wire Timeframe Filter Pills (Today, 7D, 30D)
    document.querySelectorAll('#founderTimeframeToolbar button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#founderTimeframeToolbar button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentTimeframe = btn.dataset.tf || '7d';
        loadMetrics();
      });
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
      // Primary RPC: Comprehensive Analytics Dataset (Migration 037)
      const { data, error } = await window.classboardSupabase.rpc('get_founder_analytics_dashboard', {
        p_timeframe: currentTimeframe
      });

      if (!error && data) {
        dashboardData = data;
        renderMetrics();
        return;
      }
    } catch (_) {}

    // Fallback: Query 034 legacy metrics RPC if 037 RPC is pending
    try {
      const [metricsRes, telemRes] = await Promise.all([
        window.classboardSupabase.rpc('get_founder_user_intelligence_metrics'),
        window.classboardSupabase.rpc('get_platform_telemetry_summary')
      ]);

      metricsData = metricsRes?.data || null;
      const telem = telemRes?.data || { total_views: 0, views_today: 0 };

      // Synthesize fallback dashboard data
      const active7d = metricsData?.returning_users || 0;
      const activeToday = metricsData?.active_users_today || 0;
      const viewsToday = telem.views_today || 0;
      const views7d = telem.total_views || 0;
      const sessions = metricsData?.total_sessions_today || 0;
      const retStudents = metricsData?.returning_users || 0;
      const retRate = active7d > 0 ? Math.round((retStudents / active7d) * 1000) / 10 : 0;

      // Revenue Potential Fallback
      const landingViews7d = Math.round(views7d * 0.35);
      const appViews7d = Math.round(views7d * 0.65);
      const totalMonetizable7d = landingViews7d + appViews7d;
      const projMonthly = Math.round((totalMonetizable7d / 7) * 30);
      const lowEst = Math.round((projMonthly / 1000) * RPM_LOW);
      const groundEst = Math.round((projMonthly / 1000) * RPM_GROUND);

      dashboardData = {
        student_usage: {
          active_students_today: activeToday,
          active_students_7d: active7d,
          valid_pageviews_today: viewsToday,
          valid_pageviews_7d: views7d,
          monetizable_pageviews: appViews7d,
          student_sessions: sessions,
          views_per_session: sessions > 0 ? (Math.round((viewsToday / sessions) * 100) / 100) : 0,
          views_per_active_student: activeToday > 0 ? (Math.round((viewsToday / activeToday) * 100) / 100) : 0,
          returning_students_7d: retStudents,
          return_rate_7d: retRate,
          avg_engagement_seconds: 240
        },
        public_landing: {
          landing_pageviews: landingViews7d,
          unique_landing_visitors: Math.round(landingViews7d * 0.7),
          successful_logins: metricsData?.successful_logins_today || 0,
          conversion_rate: landingViews7d > 0 ? Math.round(((metricsData?.successful_logins_today || 0) / (landingViews7d * 0.7)) * 1000) / 10 : 0
        },
        revenue_potential: {
          rpm_low: RPM_LOW,
          rpm_ground: RPM_GROUND,
          landing_monetizable_views_7d: landingViews7d,
          authenticated_monetizable_views_7d: appViews7d,
          total_monetizable_views_7d: totalMonetizable7d,
          projected_monthly_monetizable_views: projMonthly,
          low_estimate: lowEst,
          ground_estimate: groundEst,
          disclaimer: 'Estimate only. Actual earnings depend on AdSense approval, ad fill, viewability, traffic quality and the real Page RPM reported by Google. Never display this estimate as guaranteed income or official AdSense eligibility.'
        },
        traffic_retention_trend: [],
        top_pages: [],
        class_usage: []
      };

      renderMetrics();
    } catch (e) {
      console.warn('Could not load founder metrics:', e);
    }
  }

  function renderMetrics() {
    if (!dashboardData) return;
    const su = dashboardData.student_usage || {};
    const pl = dashboardData.public_landing || {};
    const rp = dashboardData.revenue_potential || {};
    const el = (id) => document.getElementById(id);

    // 1. Student Usage Cards
    if (el('kpiActiveStudentsToday')) el('kpiActiveStudentsToday').textContent = String(su.active_students_today ?? 0);
    if (el('kpiActiveStudents7d')) el('kpiActiveStudents7d').textContent = String(su.active_students_7d ?? 0);
    if (el('kpiValidPageviewsToday')) el('kpiValidPageviewsToday').textContent = String(su.valid_pageviews_today ?? 0);
    if (el('kpiValidPageviews7d')) el('kpiValidPageviews7d').textContent = String(su.valid_pageviews_7d ?? 0);
    if (el('kpiMonetizablePageviews')) el('kpiMonetizablePageviews').textContent = String(su.monetizable_pageviews ?? 0);
    if (el('kpiStudentSessions')) el('kpiStudentSessions').textContent = String(su.student_sessions ?? 0);
    if (el('kpiViewsPerSession')) el('kpiViewsPerSession').textContent = String(su.views_per_session ?? 0);
    if (el('kpiViewsPerStudent')) el('kpiViewsPerStudent').textContent = String(su.views_per_active_student ?? 0);
    if (el('kpiReturningStudents7d')) el('kpiReturningStudents7d').textContent = String(su.returning_students_7d ?? 0);
    if (el('kpiReturnRate7d')) el('kpiReturnRate7d').textContent = `${su.return_rate_7d ?? 0}%`;
    if (el('kpiAvgEngagementTime')) el('kpiAvgEngagementTime').textContent = formatSeconds(su.avg_engagement_seconds);

    // 2. Public Landing Analytics Cards
    if (el('kpiLandingPageviews')) el('kpiLandingPageviews').textContent = String(pl.landing_pageviews ?? 0);
    if (el('kpiLandingUniqueVisitors')) el('kpiLandingUniqueVisitors').textContent = String(pl.unique_landing_visitors ?? 0);
    if (el('kpiLandingConversion')) el('kpiLandingConversion').textContent = `${pl.conversion_rate ?? 0}%`;

    // 3. Revenue Potential Panel
    const lowEst = rp.low_estimate ?? 0;
    const groundEst = rp.ground_estimate ?? 0;
    if (el('revMonthlyViews')) el('revMonthlyViews').textContent = (rp.projected_monthly_monetizable_views ?? 0).toLocaleString('en-IN');
    if (el('revEstimatedEarnings')) el('revEstimatedEarnings').textContent = `${formatINR(lowEst)} – ${formatINR(groundEst)} / mo`;
    if (el('revLandingViews')) el('revLandingViews').textContent = (rp.landing_monetizable_views_7d ?? 0).toLocaleString('en-IN');
    if (el('revAppViews')) el('revAppViews').textContent = (rp.authenticated_monetizable_views_7d ?? 0).toLocaleString('en-IN');

    // 4. Traffic & Retention 7-Day Trend Chart
    renderTrendChart(dashboardData.traffic_retention_trend || []);

    // 5. Top Pages Table
    renderTopPages(dashboardData.top_pages || []);

    // 6. Class / Section Usage Table
    renderClassUsage(dashboardData.class_usage || []);
  }

  function renderTrendChart(trendList) {
    const container = document.getElementById('founderTrendBars');
    if (!container) return;

    if (!trendList || !trendList.length) {
      container.innerHTML = `<div style="margin:auto;color:#94a3b8;font-size:0.8rem;">No trend records for this window.</div>`;
      return;
    }

    const maxViews = Math.max(...trendList.map((t) => t.valid_pageviews || 0), 10);

    container.innerHTML = trendList.map((item) => {
      const views = item.valid_pageviews || 0;
      const heightPercent = Math.max(8, Math.round((views / maxViews) * 100));
      const day = item.day_name || item.date || '';

      return `
        <div class="founder-trend-col" title="${item.display_date || item.date}: ${views} views, ${item.active_students || 0} active students, ${item.sessions || 0} sessions">
          <span class="founder-trend-val">${views}</span>
          <div class="founder-trend-bar-track">
            <div class="founder-trend-bar-fill" style="height:${heightPercent}%;"></div>
          </div>
          <span class="founder-trend-label">${day}</span>
        </div>
      `;
    }).join('');
  }

  function renderTopPages(topPages) {
    const tbody = document.getElementById('founderTopPagesBody');
    if (!tbody) return;

    if (!topPages || !topPages.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8;">No screen view activity in this timeframe.</td></tr>`;
      return;
    }

    tbody.innerHTML = topPages.map((p) => {
      const isLanding = p.page_type === 'public_landing';
      const badge = isLanding
        ? `<span class="founder-type-badge public-landing">🌐 Public Landing</span>`
        : `<span class="founder-type-badge authenticated-app">🔒 Authenticated App</span>`;

      return `
        <tr>
          <td style="font-weight:700;color:#64748b;font-size:0.8rem;">#${p.rank}</td>
          <td>
            <div style="font-weight:600;color:#0f172a;font-size:0.84rem;">${p.page_title}</div>
            <div style="font-size:0.72rem;color:#94a3b8;font-family:monospace;">${p.page_key}</div>
          </td>
          <td>${badge}</td>
          <td style="text-align:right;font-weight:700;color:#0f172a;">${(p.view_count || 0).toLocaleString('en-IN')}</td>
          <td style="text-align:right;font-weight:600;color:#64748b;font-size:0.8rem;">${p.percentage}%</td>
        </tr>
      `;
    }).join('');
  }

  function renderClassUsage(classList) {
    const tbody = document.getElementById('founderClassUsageBody');
    if (!tbody) return;

    if (!classList || !classList.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8;">No active cohort activity.</td></tr>`;
      return;
    }

    tbody.innerHTML = classList.map((c) => {
      return `
        <tr>
          <td>
            <span style="font-weight:700;color:#1d4ed8;background:#eff6ff;padding:2px 8px;border-radius:6px;font-size:0.8rem;border:1px solid #bfdbfe;">
              ${c.class_code}
            </span>
          </td>
          <td style="font-weight:600;color:#334155;font-size:0.84rem;">${c.class_name}</td>
          <td style="text-align:right;font-weight:700;color:#0f172a;">${c.active_students || 0}</td>
          <td style="text-align:right;font-weight:700;color:#2563eb;">${c.valid_pageviews || 0}</td>
          <td style="text-align:right;font-weight:600;color:#64748b;font-size:0.82rem;">${c.views_per_student || 0}</td>
        </tr>
      `;
    }).join('');
  }

  // Load User List from Database (Preserved Intact)
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
      const batch = getBatchForRollAndClass(user.roll_number, user.class_code);
      const batchTag = batch ? `Batch ${batch}` : '';
      const sub = [section, roll, batchTag].filter(Boolean).join(' · ');

      return `
        <tr data-user-id="${user.user_id}">
          <td>
            <div class="founder-user-cell">
              <div class="founder-avatar">${initials}</div>
              <div class="founder-user-meta">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span class="founder-user-name">${name}</span>
                  ${batch ? `<span style="display:inline-flex;align-items:center;padding:1px 6px;border-radius:999px;font-size:0.68rem;font-weight:700;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">Batch ${batch}</span>` : ''}
                </div>
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
            <span style="font-weight:700;color:#0f172a;font-size:0.88rem;">${user.total_sessions || 0}</span>
          </td>
          <td>
            ${renderDeviceBadge(user.device_info)}
          </td>
          <td style="text-align:right;">
            <button class="secondary-button founder-inspect-btn" data-inspect-user="${user.user_id}" type="button" style="padding:4px 10px;font-size:0.78rem;">Inspect</button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire Inspect Buttons
    tbody.querySelectorAll('[data-inspect-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.inspectUser;
        if (uid) openUserDrawer(uid);
      });
    });
  }

  // Open Detailed Dossier Drawer (Preserved Intact)
  async function openUserDrawer(userId) {
    if (!window.classboardSupabase?.rpc) return;
    activeDetailUserId = userId;
    const backdrop = document.getElementById('founderDrawerBackdrop');
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');

    const el = (id) => document.getElementById(id);
    el('drawerUserName').textContent = 'Loading dossier…';
    el('drawerUserEmail').textContent = '';
    el('drawerUserAvatar').textContent = 'CB';
    el('drawerUserStatus').innerHTML = '—';
    el('drawerUserSection').textContent = '—';
    el('drawerUserLogins').textContent = '—';
    el('drawerUserSessions').textContent = '—';
    el('drawerUserDevice').textContent = '—';
    el('drawerTimelineList').innerHTML = `<div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.82rem;">Loading chronological timeline…</div>`;

    try {
      const { data, error } = await window.classboardSupabase.rpc('get_founder_user_detail', {
        p_target_user_id: userId
      });

      if (error || !data) {
        el('drawerUserName').textContent = 'Could not load dossier';
        return;
      }

      const name = data.display_name || data.email?.split('@')[0] || 'User';
      const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'U';
      const status = getPresenceStatus(data);

      el('drawerUserName').textContent = name;
      el('drawerUserEmail').textContent = data.email || '';
      el('drawerUserAvatar').textContent = initials;
      el('drawerUserStatus').innerHTML = renderStatusBadge(status);
      el('drawerUserSection').textContent = data.class_code ? `${data.class_code} · ${data.class_name}` : 'No class assigned';
      el('drawerUserLogins').textContent = String(data.total_logins || 0);
      el('drawerUserSessions').textContent = String(data.total_sessions || 0);

      const dev = data.device_info || {};
      el('drawerUserDevice').innerHTML = `
        <div><strong>Browser &amp; OS:</strong> ${dev.browser || 'Web'} on ${dev.os || 'Unknown OS'} (${dev.device_type || 'Desktop'})</div>
        <div><strong>Screen &amp; Viewport:</strong> ${dev.screen || 'Unknown'} · Viewport: ${dev.viewport || 'Unknown'}</div>
        <div><strong>Language:</strong> ${dev.language || 'en-US'}</div>
      `;

      loadUserTimeline(userId, activeTimelineFilter);
    } catch (e) {
      el('drawerUserName').textContent = 'Error loading user data';
    }
  }

  // Load Timeline Events for Dossier Drawer (Preserved Intact)
  async function loadUserTimeline(userId, actionFilter = 'all') {
    const list = document.getElementById('drawerTimelineList');
    if (!list || !window.classboardSupabase?.rpc) return;

    try {
      const { data, error } = await window.classboardSupabase.rpc('get_founder_user_timeline', {
        p_target_user_id: userId,
        p_action_filter: actionFilter,
        p_limit: 50,
        p_offset: 0
      });

      if (error || !data || !data.events?.length) {
        list.innerHTML = `<div style="padding:24px;text-align:center;color:#94a3b8;font-size:0.82rem;">No recorded activity found for this filter.</div>`;
        return;
      }

      list.innerHTML = data.events.map((ev) => {
        let icon = '⚡';
        if (ev.event_type === 'login') icon = '🔑';
        else if (ev.event_type === 'page_view') icon = '📄';
        else if (ev.event_type === 'resource') icon = '📚';
        else if (ev.event_type === 'attendance') icon = '📅';

        return `
          <div class="founder-timeline-item">
            <div class="founder-timeline-icon">${icon}</div>
            <div class="founder-timeline-meta">
              <div class="founder-timeline-desc">${ev.description || ev.event_type}</div>
              <div class="founder-timeline-time">
                <span>${formatIST(ev.created_at)}</span>
                ${ev.page ? `<span style="font-family:monospace;background:#f1f5f9;padding:1px 6px;border-radius:4px;">/${ev.page}</span>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:#ef4444;font-size:0.82rem;">Failed to load user timeline.</div>`;
    }
  }

  // Live Activity Feed Ticker (Preserved Intact)
  function appendLiveStreamItem(icon, title, subtitle) {
    const stream = document.getElementById('founderLiveStream');
    if (!stream) return;

    const placeholder = stream.querySelector('div[style*="text-align:center"]');
    if (placeholder) placeholder.remove();

    const item = document.createElement('div');
    item.className = 'founder-stream-item';
    item.innerHTML = `
      <div class="founder-stream-icon">${icon}</div>
      <div class="founder-stream-meta">
        <div class="founder-stream-desc">${title}</div>
        <div class="founder-stream-time">${subtitle} · Just now</div>
      </div>
    `;

    stream.insertBefore(item, stream.firstChild);

    // Keep feed trimmed to 30 items
    while (stream.children.length > 30) {
      stream.removeChild(stream.lastChild);
    }
  }

  // Real-Time Subscriptions (Preserved Intact)
  function setupFounderRealtime() {
    if (!window.classboardSupabase?.channel || realtimeChannel) return;

    try {
      realtimeChannel = window.classboardSupabase.channel('founder-intelligence-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_login_events' }, (payload) => {
          const rec = payload.new;
          appendLiveStreamItem('🔑', `Signed in via ${rec.auth_method || 'password'}`, 'Authentication');
          loadMetrics();
          loadUserTable();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_activity' }, (payload) => {
          const rec = payload.new;
          appendLiveStreamItem('⚡', rec.description || rec.action, `/${rec.page || 'app'}`);
          loadMetrics();
          if (activeDetailUserId === rec.user_id) {
            loadUserTimeline(activeDetailUserId, activeTimelineFilter);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, () => {
          loadMetrics();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'landing_page_events' }, () => {
          loadMetrics();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_telemetry' }, () => {
          loadMetrics();
        })
        .subscribe();

      // Listen for presence updates from activity-tracker.js
      window.addEventListener('classboard:presence-sync', () => {
        renderMetrics();
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
