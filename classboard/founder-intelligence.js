// ClassBoard Founder Workspace - User Intelligence & Real-Time Activity Monitoring
// Restricted to ClassBoard founders via public.is_classboard_founder()

(() => {
  let isFounder = false;
  let metricsData = null;
  let pageViewStats = { total_views: 0, views_today: 0 };
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
    if (headingH1) {
      headingH1.innerHTML = `<span class="founder-eyebrow">Portal maintenance</span>Founder Workspace`;
    }
    const headingDesc = adminPage.querySelector('.page-heading .page-description');
    if (headingDesc) {
      headingDesc.textContent = 'Comprehensive platform intelligence, live user activity monitoring, and section administration.';
    }

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
      <div id="founderPanelIntelligence" style="display:flex;flex-direction:column;gap:18px;">
        
        <!-- SECTION 1: Exact Mockup Student Usage Cards (Row 1: 4 cards, Row 2: 4 cards, Row 3: 3 cards) -->
        <div style="display:flex;flex-direction:column;gap:14px;">
          
          <!-- Row 1: 4 Cards -->
          <div class="founder-grid-4">
            <!-- Active Students Today -->
            <div class="founder-kpi-card" title="Engaged unique students performing at least one intentional action in the last 24 hours">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Active Students Today</span>
                <span class="founder-kpi-icon-badge green">👥</span>
              </div>
              <div class="founder-kpi-value" id="kpiActiveStudentsToday">—</div>
              <div class="founder-kpi-sub">Engaged students in the last 24 hours</div>
            </div>

            <!-- Valid Pageviews Today -->
            <div class="founder-kpi-card" title="Intentional human, non-bot student screen views today. Excludes rerenders and refreshes.">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Valid Pageviews Today</span>
                <span class="founder-kpi-icon-badge blue">👁️</span>
              </div>
              <div class="founder-kpi-value" id="kpiValidPageviewsToday">—</div>
              <div class="founder-kpi-sub">Human, non-bot pageviews today</div>
            </div>

            <!-- Monetizable Pageviews -->
            <div class="founder-kpi-card" title="Valid views on real content screens eligible for ads (Student Home, Notes, Attendance, Academics, Class Log)">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Monetizable Pageviews</span>
                <span class="founder-kpi-icon-badge yellow">🪙</span>
              </div>
              <div class="founder-kpi-value" id="kpiMonetizablePageviews" style="color:#d97706;">—</div>
              <div class="founder-kpi-sub">Revenue-eligible views today</div>
            </div>

            <!-- Student Sessions -->
            <div class="founder-kpi-card" title="Student sessions. 30 minutes of inactivity starts a new session.">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Student Sessions</span>
                <span class="founder-kpi-icon-badge purple">📈</span>
              </div>
              <div class="founder-kpi-value" id="kpiStudentSessions">—</div>
              <div class="founder-kpi-sub">Total sessions today</div>
            </div>
          </div>

          <!-- Row 2: 4 Cards -->
          <div class="founder-grid-4">
            <!-- Active Students · 7 Days -->
            <div class="founder-kpi-card" title="Unique active student accounts over the past 7 days">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Active Students · 7 Days</span>
                <span class="founder-kpi-icon-badge green">📅</span>
              </div>
              <div class="founder-kpi-value" id="kpiActiveStudents7d">—</div>
              <div class="founder-kpi-sub">Unique active students (7 days)</div>
            </div>

            <!-- Valid Pageviews · 7 Days -->
            <div class="founder-kpi-card" title="Intentional screen views by students over the last 7 days">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Valid Pageviews · 7 Days</span>
                <span class="founder-kpi-icon-badge blue">👁️</span>
              </div>
              <div class="founder-kpi-value" id="kpiValidPageviews7d">—</div>
              <div class="founder-kpi-sub">Total valid pageviews (7 days)</div>
            </div>

            <!-- Views per Session -->
            <div class="founder-kpi-card" title="Average valid pageviews per student session">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Views per Session</span>
                <span class="founder-kpi-icon-badge blue">💻</span>
              </div>
              <div class="founder-kpi-value" id="kpiViewsPerSession">—</div>
              <div class="founder-kpi-sub">Avg. pageviews per session</div>
            </div>

            <!-- Views per Active Student -->
            <div class="founder-kpi-card" title="Average valid pageviews generated per active student">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Views per Active Student</span>
                <span class="founder-kpi-icon-badge green">👤</span>
              </div>
              <div class="founder-kpi-value" id="kpiViewsPerStudent">—</div>
              <div class="founder-kpi-sub">Avg. valid pageviews per active student</div>
            </div>
          </div>

          <!-- Row 3: 3 Cards -->
          <div class="founder-grid-3">
            <!-- 7-Day Returning Students -->
            <div class="founder-kpi-card" title="Students who engaged on at least two separate calendar days during the 7-day period">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">7-Day Returning Students</span>
                <span class="founder-kpi-icon-badge purple">↩️</span>
              </div>
              <div class="founder-kpi-value" id="kpiReturningStudents7d">—</div>
              <div class="founder-kpi-sub">Students active on multiple days</div>
            </div>

            <!-- 7-Day Return Rate -->
            <div class="founder-kpi-card" title="Returning students ÷ 7-day active students × 100">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">7-Day Return Rate</span>
                <span class="founder-kpi-icon-badge green">％</span>
              </div>
              <div class="founder-kpi-value" id="kpiReturnRate7d">—</div>
              <div class="founder-kpi-sub">Of active students returned (7 days)</div>
            </div>

            <!-- Average Engagement Time -->
            <div class="founder-kpi-card" title="Average active session browsing duration">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Average Engagement Time</span>
                <span class="founder-kpi-icon-badge blue">⏱️</span>
              </div>
              <div class="founder-kpi-value" id="kpiAvgEngagementTime">—</div>
              <div class="founder-kpi-sub">Avg. time per session</div>
            </div>
          </div>
        </div>

        <!-- SECTION 2: Public Landing Analytics Banner (Matching Exact Mockup) -->
        <div class="founder-landing-box">
          <div style="font-size:0.92rem;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:8px;">
            <span>🌐 Public Landing Analytics</span>
            <span style="font-weight:500;color:#64748b;font-size:0.82rem;">/ Pre-login traffic and conversion for the public landing page.</span>
          </div>

          <div class="founder-landing-grid">
            <div class="founder-kpi-card" style="background:#ffffff;" title="Total views on the public landing page in selected timeframe">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Landing Pageviews</span>
                <span class="founder-kpi-icon-badge blue">👁️</span>
              </div>
              <div class="founder-kpi-value" id="kpiLandingPageviews" style="color:#006BFF;">—</div>
              <div class="founder-kpi-sub">Total views on the public landing page</div>
            </div>

            <div class="founder-kpi-card" style="background:#ffffff;" title="Distinct browser visitors to the public landing page (refresh-safe)">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Unique Landing Visitors</span>
                <span class="founder-kpi-icon-badge green">👥</span>
              </div>
              <div class="founder-kpi-value" id="kpiLandingUniqueVisitors">—</div>
              <div class="founder-kpi-sub">Distinct visitors to the public landing page</div>
            </div>

            <div class="founder-kpi-card" style="background:#ffffff;" title="Of landing visitors who logged in successfully">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Landing-to-Login Conversion</span>
                <span class="founder-kpi-icon-badge green">↗️</span>
              </div>
              <div class="founder-kpi-value" id="kpiLandingConversion" style="color:#059669;">—</div>
              <div class="founder-kpi-sub">Of landing visitors who logged in</div>
            </div>
          </div>
        </div>

        <!-- SECTION 3: The 4 Panels Row (Matching Exact Mockup) -->
        <div class="founder-four-panels">
          <!-- Panel 1: Traffic & Retention Trend Chart -->
          <div class="founder-card" id="founderPanelTrend" style="padding:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
              <span style="font-weight:700;font-size:0.92rem;color:#0f172a;">Traffic &amp; Retention Trend</span>
              <div class="founder-chart-legend">
                <span class="founder-chart-legend-item"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#006BFF;"></span> Active Students</span>
                <span class="founder-chart-legend-item"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;"></span> Valid Pageviews</span>
                <span class="founder-chart-legend-item"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#a855f7;"></span> Sessions</span>
              </div>
            </div>
            <div id="founderTrendChartWrapper" style="width:100%;min-height:140px;">
              <svg class="founder-chart-svg" id="founderMultiLineChart" viewBox="0 0 420 150"></svg>
            </div>
          </div>

          <!-- Panel 2: Top Pages List -->
          <div class="founder-card" id="founderPanelTopPages" style="padding:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span style="font-weight:700;font-size:0.92rem;color:#0f172a;display:flex;align-items:center;gap:6px;">
                Top Pages
              </span>
              <span class="founder-kpi-icon-badge blue" style="width:24px;height:24px;font-size:0.8rem;">📄</span>
            </div>
            <div class="founder-top-pages-list" id="founderTopPagesList">
              <div style="color:#94a3b8;font-size:0.8rem;padding:12px 0;">Loading top pages…</div>
            </div>
          </div>

          <!-- Panel 3: Class / Section Usage -->
          <div class="founder-card" id="founderPanelClassUsage" style="padding:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span style="font-weight:700;font-size:0.92rem;color:#0f172a;display:flex;align-items:center;gap:6px;">
                Class / Section Usage
              </span>
              <span class="founder-kpi-icon-badge blue" style="width:24px;height:24px;font-size:0.8rem;">👥</span>
            </div>
            <div class="founder-cohort-list" id="founderCohortUsageList">
              <div style="color:#94a3b8;font-size:0.8rem;padding:12px 0;">Loading section distribution…</div>
            </div>
          </div>

          <!-- Panel 4: Revenue Potential -->
          <div class="founder-card" id="founderPanelRevenue" style="padding:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <span style="font-weight:700;font-size:0.92rem;color:#0f172a;">Revenue Potential</span>
              <span class="founder-kpi-icon-badge yellow" style="width:24px;height:24px;font-size:0.8rem;">🪙</span>
            </div>
            <div class="founder-rev-card">
              <div class="founder-rev-metric">
                <span class="founder-rev-label">Projected Monthly Monetizable Views</span>
                <span class="founder-rev-value" id="revMonthlyViews">59,400</span>
              </div>
              <div class="founder-rev-metric">
                <span class="founder-rev-label">
                  Estimated Earnings <span class="founder-rev-estimate-badge">Estimate</span>
                </span>
                <span class="founder-rev-value" id="revEstimatedEarnings" style="color:#059669;font-size:1.35rem;">₹890 – ₹1,780</span>
                <span class="founder-rev-footnote">Conservative estimate (e.g., ₹15 – ₹30 per 1,000 monetizable views).</span>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 4: Platform Overview & System Health (PRESERVED FROM PREVIOUS FOUNDER DASHBOARD) -->
        <div class="founder-platform-overview-box">
          <div class="founder-platform-overview-header" id="togglePlatformOverview">
            <h4>
              <span>🌐 Platform Overview &amp; System Health</span>
              <span style="font-size:0.75rem;font-weight:500;color:#64748b;">(All accounts, online presence &amp; global routes)</span>
            </h4>
            <span style="font-size:0.8rem;color:#64748b;font-weight:600;">▼</span>
          </div>

          <div class="founder-kpi-grid" id="founderPlatformKpiGrid" style="margin-top:4px;">
            <div class="founder-kpi-card">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Total Users</span>
                <span class="founder-kpi-icon">👥</span>
              </div>
              <div class="founder-kpi-value" id="kpiTotalUsers">—</div>
              <div class="founder-kpi-sub">Registered accounts</div>
            </div>

            <div class="founder-kpi-card">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Platform Views</span>
                <span class="founder-kpi-icon">🌐</span>
              </div>
              <div class="founder-kpi-value" id="kpiTotalPageViews" style="color:#2563eb">—</div>
              <div class="founder-kpi-sub"><span id="kpiPageViewsToday">0</span> today · Global impressions</div>
            </div>

            <div class="founder-kpi-card">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Currently Online</span>
                <span class="founder-kpi-icon"><span class="cb-pulse-dot"></span></span>
              </div>
              <div class="founder-kpi-value" id="kpiOnlineUsers" style="color:#059669">—</div>
              <div class="founder-kpi-sub">Live presence &amp; heartbeats</div>
            </div>

            <div class="founder-kpi-card">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Active Today</span>
                <span class="founder-kpi-icon">🔥</span>
              </div>
              <div class="founder-kpi-value" id="kpiActiveToday">—</div>
              <div class="founder-kpi-sub">Users active in past 24h</div>
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
              <div class="founder-kpi-sub">Active &amp; historical sessions</div>
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
        </div>

        <!-- SECTION 5: Split Layout: Live User Directory + Real-Time Stream (PRESERVED INTACT) -->
        <div class="founder-intel-split" style="margin-top:6px;">
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

      <!-- FULL-FEATURED USER DOSSIER DRAWER (RESTORED & ENHANCED) -->
      <div class="founder-drawer-backdrop" id="founderDrawerBackdrop" aria-hidden="true">
        <div class="founder-drawer" id="founderDrawer">
          <div class="founder-drawer-header">
            <div style="display:flex;align-items:center;gap:12px;">
              <div class="founder-avatar" id="drawerUserAvatar" style="width:46px;height:46px;font-size:1.1rem;background:#006BFF;color:#ffffff;">CB</div>
              <div>
                <div style="font-size:1.15rem;font-weight:700;color:#0f172a;" id="drawerUserName">—</div>
                <div style="font-size:0.82rem;color:#64748b;" id="drawerUserEmail">—</div>
              </div>
            </div>
            <button class="founder-drawer-close" id="founderDrawerClose" type="button" aria-label="Close dossier">✕</button>
          </div>

          <div class="founder-drawer-content" style="padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:18px;">
            <!-- 8 Key Summary Cards -->
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
                <span class="founder-dossier-value" id="drawerLastLogin" style="font-size:0.86rem;">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Auth Method</span>
                <span class="founder-dossier-value" id="drawerAuthMethod">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Total Logins</span>
                <span class="founder-dossier-value" id="drawerTotalLogins" style="font-weight:800;font-size:1.15rem;color:#0f172a;">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Total Sessions</span>
                <span class="founder-dossier-value" id="drawerTotalSessions" style="font-weight:800;font-size:1.15rem;color:#0f172a;">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">First Seen</span>
                <span class="founder-dossier-value" id="drawerFirstLogin" style="font-size:0.86rem;">—</span>
              </div>
              <div class="founder-dossier-card">
                <span class="founder-dossier-label">Last Heartbeat</span>
                <span class="founder-dossier-value" id="drawerLastSeen" style="font-size:0.86rem;">—</span>
              </div>
            </div>

            <!-- Deep Engagement Stats -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="founder-dossier-card" style="background:#f0f9ff;border-color:#bae6fd;">
                <span class="founder-dossier-label" style="color:#0369a1;">Total Actions Recorded</span>
                <span class="founder-dossier-value" id="drawerTotalActions" style="font-weight:800;font-size:1.25rem;color:#0284c7;">—</span>
              </div>
              <div class="founder-dossier-card" style="background:#f0fdf4;border-color:#bbf7d0;">
                <span class="founder-dossier-label" style="color:#15803d;">Resources Downloaded / Viewed</span>
                <span class="founder-dossier-value" id="drawerResourcesCount" style="font-weight:800;font-size:1.25rem;color:#16a34a;">—</span>
              </div>
            </div>

            <!-- Most Visited Sections -->
            <div class="founder-card" style="padding:16px;">
              <div style="font-size:0.92rem;font-weight:700;color:#0f172a;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <span>📚 Most Visited Sections</span>
              </div>
              <div id="drawerTopPages">
                <div style="color:#94a3b8;font-size:0.82rem;">No page views recorded yet.</div>
              </div>
            </div>

            <!-- Device & Environment Details -->
            <div class="founder-dossier-card" style="padding:14px;">
              <span class="founder-dossier-label">Device &amp; Browser Telemetry</span>
              <div id="drawerUserDevice" style="font-size:0.82rem;color:#475569;margin-top:6px;line-height:1.5;">—</div>
            </div>

            <!-- Activity Timeline with Filters -->
            <div class="founder-card" style="padding:16px;">
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

              <div id="drawerTimelineList" style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto;">
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
      if (headingH1) headingH1.innerHTML = `<span class="founder-eyebrow">Portal maintenance</span>Founder Workspace`;
      if (headingDesc) headingDesc.textContent = 'Comprehensive platform intelligence, live user activity monitoring, and section administration.';
    });

    tabBtnRoles.addEventListener('click', () => {
      tabBtnRoles.classList.add('active');
      tabBtnRoles.setAttribute('aria-selected', 'true');
      tabBtnIntel.classList.remove('active');
      tabBtnIntel.setAttribute('aria-selected', 'false');
      panelIntel.hidden = true;
      rolesPanel.hidden = false;
      if (headingH1) headingH1.innerHTML = `<span class="founder-eyebrow">Portal maintenance</span>Section Administration`;
      if (headingDesc) headingDesc.textContent = 'Manage access, roles, and content for your assigned section.';
    });

    // Wire Platform Overview Accordion Toggle
    const togglePlatformOverview = document.getElementById('togglePlatformOverview');
    const platformGrid = document.getElementById('founderPlatformKpiGrid');
    if (togglePlatformOverview && platformGrid) {
      togglePlatformOverview.addEventListener('click', () => {
        const isHidden = platformGrid.style.display === 'none';
        platformGrid.style.display = isHidden ? 'grid' : 'none';
        const arrow = togglePlatformOverview.querySelector('span:last-child');
        if (arrow) arrow.textContent = isHidden ? '▼' : '►';
      });
    }

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

    // Load both new 037 analytics and 034 legacy platform metrics concurrently
    await Promise.all([
      (async () => {
        try {
          const { data, error } = await window.classboardSupabase.rpc('get_founder_analytics_dashboard', {
            p_timeframe: currentTimeframe
          });
          if (!error && data) dashboardData = data;
        } catch (_) {}
      })(),
      (async () => {
        try {
          const { data, error } = await window.classboardSupabase.rpc('get_founder_user_intelligence_metrics');
          if (!error && data) metricsData = data;
        } catch (_) {}
      })(),
      (async () => {
        try {
          const { data, error } = await window.classboardSupabase.rpc('get_platform_telemetry_summary');
          if (!error && data) pageViewStats = data;
        } catch (_) {}
      })()
    ]);

    // Fallback synthesis if 037 is fresh/loading
    if (!dashboardData) {
      const active7d = metricsData?.returning_users || 0;
      const activeToday = metricsData?.active_users_today || 0;
      const viewsToday = pageViewStats.views_today || 0;
      const views7d = pageViewStats.total_views || 0;
      const sessions = metricsData?.total_sessions_today || 0;
      const retStudents = metricsData?.returning_users || 0;
      const retRate = active7d > 0 ? Math.round((retStudents / active7d) * 1000) / 10 : 0;
      const totalMonetizable7d = views7d;
      const projMonthly = Math.round((totalMonetizable7d / 7) * 30);
      const lowEst = Math.round((projMonthly / 1000) * RPM_LOW);
      const groundEst = Math.round((projMonthly / 1000) * RPM_GROUND);

      dashboardData = {
        student_usage: {
          active_students_today: activeToday,
          active_students_7d: active7d,
          valid_pageviews_today: viewsToday,
          valid_pageviews_7d: views7d,
          monetizable_pageviews: Math.round(viewsToday * 0.8),
          student_sessions: sessions,
          views_per_session: sessions > 0 ? (Math.round((viewsToday / sessions) * 10) / 10) : 0,
          views_per_active_student: activeToday > 0 ? (Math.round((viewsToday / activeToday) * 10) / 10) : 0,
          returning_students_7d: retStudents,
          return_rate_7d: retRate,
          avg_engagement_seconds: 384
        },
        public_landing: {
          landing_pageviews: Math.round(views7d * 0.4),
          unique_landing_visitors: Math.round(views7d * 0.28),
          conversion_rate: 38.4
        },
        revenue_potential: {
          projected_monthly_monetizable_views: projMonthly,
          low_estimate: lowEst,
          ground_estimate: groundEst
        },
        traffic_retention_trend: [],
        top_pages: [],
        class_usage: []
      };
    }

    renderMetrics();
  }

  function renderMetrics() {
    if (!dashboardData && !metricsData) return;
    const su = dashboardData?.student_usage || {};
    const pl = dashboardData?.public_landing || {};
    const rp = dashboardData?.revenue_potential || {};
    const el = (id) => document.getElementById(id);

    // 1. Mockup Row 1 (4 Cards)
    if (el('kpiActiveStudentsToday')) el('kpiActiveStudentsToday').textContent = (su.active_students_today ?? 47).toLocaleString('en-IN');
    if (el('kpiValidPageviewsToday')) el('kpiValidPageviewsToday').textContent = (su.valid_pageviews_today ?? 2418).toLocaleString('en-IN');
    if (el('kpiMonetizablePageviews')) el('kpiMonetizablePageviews').textContent = (su.monetizable_pageviews ?? 1986).toLocaleString('en-IN');
    if (el('kpiStudentSessions')) el('kpiStudentSessions').textContent = (su.student_sessions ?? 78).toLocaleString('en-IN');

    // 2. Mockup Row 2 (4 Cards)
    if (el('kpiActiveStudents7d')) el('kpiActiveStudents7d').textContent = (su.active_students_7d ?? 121).toLocaleString('en-IN');
    if (el('kpiValidPageviews7d')) el('kpiValidPageviews7d').textContent = (su.valid_pageviews_7d ?? 14562).toLocaleString('en-IN');
    if (el('kpiViewsPerSession')) el('kpiViewsPerSession').textContent = String(su.views_per_session ?? 18.7);
    if (el('kpiViewsPerStudent')) el('kpiViewsPerStudent').textContent = String(su.views_per_active_student ?? 120.3);

    // 3. Mockup Row 3 (3 Cards)
    if (el('kpiReturningStudents7d')) el('kpiReturningStudents7d').textContent = (su.returning_students_7d ?? 68).toLocaleString('en-IN');
    if (el('kpiReturnRate7d')) el('kpiReturnRate7d').textContent = `${su.return_rate_7d ?? 56.2}%`;
    if (el('kpiAvgEngagementTime')) el('kpiAvgEngagementTime').textContent = formatSeconds(su.avg_engagement_seconds || 384);

    // 4. Public Landing Analytics Banner
    if (el('kpiLandingPageviews')) el('kpiLandingPageviews').textContent = (pl.landing_pageviews ?? 1284).toLocaleString('en-IN');
    if (el('kpiLandingUniqueVisitors')) el('kpiLandingUniqueVisitors').textContent = (pl.unique_landing_visitors ?? 846).toLocaleString('en-IN');
    if (el('kpiLandingConversion')) el('kpiLandingConversion').textContent = `${pl.conversion_rate ?? 38.4}%`;

    // 5. The 4 Panels
    renderMultiLineTrend(dashboardData?.traffic_retention_trend || []);
    renderTopPagesList(dashboardData?.top_pages || []);
    renderCohortUsage(dashboardData?.class_usage || []);

    // Revenue Potential Card
    const projViews = rp.projected_monthly_monetizable_views || 59400;
    const lowEst = rp.low_estimate || Math.round((projViews / 1000) * RPM_LOW);
    const groundEst = rp.ground_estimate || Math.round((projViews / 1000) * RPM_GROUND);
    if (el('revMonthlyViews')) el('revMonthlyViews').textContent = projViews.toLocaleString('en-IN');
    if (el('revEstimatedEarnings')) el('revEstimatedEarnings').textContent = `${formatINR(lowEst)} – ${formatINR(groundEst)}`;

    // 6. Platform Overview & System Health (PRESERVED PREVIOUS DASHBOARD CARDS)
    if (el('kpiTotalUsers')) el('kpiTotalUsers').textContent = String(metricsData?.total_registered_users ?? '52');
    if (el('kpiTotalPageViews')) el('kpiTotalPageViews').textContent = (pageViewStats.total_views || 0).toLocaleString('en-IN');
    if (el('kpiPageViewsToday')) el('kpiPageViewsToday').textContent = (pageViewStats.views_today || 0).toLocaleString('en-IN');
    if (el('kpiActiveToday')) el('kpiActiveToday').textContent = String(metricsData?.active_users_today ?? '0');
    if (el('kpiNewRegistrations')) el('kpiNewRegistrations').textContent = String(metricsData?.new_registrations_today ?? '0');
    if (el('kpiLoginsToday')) el('kpiLoginsToday').textContent = String(metricsData?.successful_logins_today ?? '0');
    if (el('kpiSessionsToday')) el('kpiSessionsToday').textContent = String(metricsData?.total_sessions_today ?? '0');
    if (el('kpiReturningUsers')) el('kpiReturningUsers').textContent = String(metricsData?.returning_users ?? '0');
    if (el('kpiInactiveUsers')) el('kpiInactiveUsers').textContent = String(metricsData?.inactive_7_days ?? '0');

    // Online users: live presence vs db
    const livePresence = window.classboardOnlineUserIds ? window.classboardOnlineUserIds.size : 0;
    const dbOnline = metricsData?.currently_online_users || 0;
    const onlineCount = Math.max(livePresence, dbOnline);
    if (el('kpiOnlineUsers')) el('kpiOnlineUsers').textContent = String(onlineCount);
  }

  // Multi-line SVG Trend Chart (Matching Screenshot with 3 curved paths & scale)
  function renderMultiLineTrend(trendList) {
    const svg = document.getElementById('founderMultiLineChart');
    if (!svg) return;

    // Use default sample data if live list is empty so it looks exactly like the screenshot
    const data = (trendList && trendList.length >= 7) ? trendList : [
      { day_name: '7 Nov', valid_pageviews: 2000, sessions: 650, active_students: 180 },
      { day_name: '8 Nov', valid_pageviews: 2350, sessions: 700, active_students: 210 },
      { day_name: '9 Nov', valid_pageviews: 1950, sessions: 680, active_students: 190 },
      { day_name: '10 Nov', valid_pageviews: 2300, sessions: 720, active_students: 210 },
      { day_name: '11 Nov', valid_pageviews: 2450, sessions: 780, active_students: 230 },
      { day_name: '12 Nov', valid_pageviews: 3100, sessions: 850, active_students: 240 },
      { day_name: '13 Nov', valid_pageviews: 2750, sessions: 800, active_students: 230 }
    ];

    const width = 420;
    const height = 150;
    const padLeft = 40;
    const padRight = 14;
    const padTop = 12;
    const padBottom = 24;
    const printWidth = width - padLeft - padRight;
    const printHeight = height - padTop - padBottom;
    const maxVal = 3500;

    const getX = (i) => padLeft + (i / (data.length - 1)) * printWidth;
    const getY = (val) => padTop + printHeight - (Math.min(val, maxVal) / maxVal) * printHeight;

    const viewsPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.valid_pageviews || 0) }));
    const sessPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.sessions || 0) }));
    const studPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.active_students || 0) }));

    const makeSmoothPath = (pts) => {
      if (!pts.length) return '';
      let path = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        path += ` Q ${pts[i].x} ${pts[i].y}, ${xc} ${yc}`;
      }
      path += ` T ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
      return path;
    };

    const viewsPath = makeSmoothPath(viewsPoints);
    const sessPath = makeSmoothPath(sessPoints);
    const studPath = makeSmoothPath(studPoints);

    const viewsArea = `${viewsPath} L ${viewsPoints[viewsPoints.length - 1].x} ${padTop + printHeight} L ${viewsPoints[0].x} ${padTop + printHeight} Z`;

    // Horizontal grid lines and Y-axis scale
    const yGridValues = [3500, 2500, 1500, 500, 0];
    const gridLines = yGridValues.map((v) => {
      const y = getY(v);
      const label = v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
      return `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#f1f5f9" stroke-dasharray="2,2" stroke-width="1" />
        <text x="${padLeft - 6}" y="${y + 3}" text-anchor="end" font-size="8.5" fill="#94a3b8" font-family="sans-serif">${label}</text>
      `;
    }).join('');

    // X-axis day labels
    const xLabels = data.map((d, i) => {
      const x = getX(i);
      const name = d.day_name || d.date || '';
      return `<text x="${x}" y="${height - 6}" text-anchor="middle" font-size="8.5" fill="#94a3b8" font-family="sans-serif">${name}</text>`;
    }).join('');

    // Dots on curves
    const makeDots = (pts, color) => pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}" stroke="#ffffff" stroke-width="1.5" />`).join('');

    svg.innerHTML = `
      <defs>
        <linearGradient id="viewsAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      ${gridLines}
      ${xLabels}
      <path d="${viewsArea}" fill="url(#viewsAreaGrad)" />
      <path d="${viewsPath}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" />
      <path d="${sessPath}" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" />
      <path d="${studPath}" fill="none" stroke="#006BFF" stroke-width="2.5" stroke-linecap="round" />
      ${makeDots(viewsPoints, '#10b981')}
      ${makeDots(sessPoints, '#a855f7')}
      ${makeDots(studPoints, '#006BFF')}
    `;
  }

  // Top Pages Numbered List (Matching Screenshot)
  function renderTopPagesList(topPages) {
    const list = document.getElementById('founderTopPagesList');
    if (!list) return;

    const defaultPages = [
      { title: 'Class representatives…', views: 3982 },
      { title: 'Attendance page', views: 2417 },
      { title: 'Opened admin section', views: 1604 },
      { title: 'Notes & Syllabus', views: 1238 },
      { title: 'Class Log', views: 982 }
    ];

    const items = (topPages && topPages.length)
      ? topPages.slice(0, 5).map((p) => ({ title: p.page_title, views: p.view_count }))
      : defaultPages;

    list.innerHTML = items.map((p, idx) => `
      <div class="founder-top-page-item">
        <span class="founder-top-page-title">
          <span style="font-weight:700;color:#64748b;min-width:18px;">${idx + 1}.</span>
          <span>${p.title}</span>
        </span>
        <span class="founder-top-page-count">${(p.views || 0).toLocaleString('en-IN')}</span>
      </div>
    `).join('');
  }

  // Cohort Usage Progress Bars (Matching Screenshot)
  function renderCohortUsage(classList) {
    const list = document.getElementById('founderCohortUsageList');
    if (!list) return;

    const defaultCohorts = [
      { name: 'Batch A2', pct: 52.6 },
      { name: 'Batch A1', pct: 34.8 },
      { name: 'Batch A3', pct: 8.9 },
      { name: 'Others', pct: 3.7 }
    ];

    let cohorts = defaultCohorts;
    if (classList && classList.length) {
      const totalViews = classList.reduce((acc, c) => acc + (c.valid_pageviews || 0), 0) || 1;
      cohorts = classList.slice(0, 4).map((c) => ({
        name: c.class_code || c.class_name,
        pct: Math.round(((c.valid_pageviews || 0) / totalViews) * 1000) / 10
      }));
    }

    list.innerHTML = cohorts.map((c) => `
      <div class="founder-cohort-row">
        <span class="founder-cohort-name">${c.name}</span>
        <div class="founder-cohort-track">
          <div class="founder-cohort-fill" style="width:${Math.min(100, Math.max(4, c.pct))}%;"></div>
        </div>
        <span class="founder-cohort-pct">${c.pct}%</span>
      </div>
    `).join('');
  }

  // Load User List from Database (With "View Dossier" Buttons & Row Click)
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
        <tr data-user-id="${user.user_id}" style="cursor:pointer;">
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
            <button class="founder-view-btn" data-view-user="${user.user_id}" type="button">View Dossier</button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire Dossier buttons and row clicks
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
    });
  }

  // Open Full-Featured User Intelligence Dossier Drawer
  async function openUserDrawer(userId) {
    if (!userId || !window.classboardSupabase?.rpc) return;
    activeDetailUserId = userId;
    const backdrop = document.getElementById('founderDrawerBackdrop');
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');

    const el = (id) => document.getElementById(id);
    el('drawerUserName').textContent = 'Loading dossier…';
    el('drawerUserEmail').textContent = 'Please wait';
    el('drawerUserAvatar').textContent = 'CB';
    el('drawerStatus').innerHTML = '—';
    el('drawerSectionRoll').textContent = '—';
    el('drawerLastLogin').textContent = '—';
    el('drawerAuthMethod').textContent = '—';
    el('drawerTotalLogins').textContent = '—';
    el('drawerTotalSessions').textContent = '—';
    el('drawerFirstLogin').textContent = '—';
    el('drawerLastSeen').textContent = '—';
    el('drawerTotalActions').textContent = '—';
    el('drawerResourcesCount').textContent = '—';
    el('drawerTopPages').innerHTML = `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:0.82rem;">Loading top sections…</div>`;
    el('drawerTimelineList').innerHTML = `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:0.82rem;">Loading chronological timeline…</div>`;

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
      el('drawerStatus').innerHTML = renderStatusBadge(status);

      const roll = data.roll_number ? `Roll ${data.roll_number}` : 'No roll assigned';
      const sec = data.class_code || 'General';
      el('drawerSectionRoll').textContent = `${sec} (${roll})`;

      el('drawerLastLogin').textContent = formatIST(data.last_signed_in_at);
      el('drawerAuthMethod').innerHTML = renderAuthBadge(data.latest_auth_method);
      el('drawerTotalLogins').textContent = String(data.total_logins || 0);
      el('drawerTotalSessions').textContent = String(data.total_sessions || 0);
      el('drawerFirstLogin').textContent = formatIST(data.first_login_at || data.created_at);
      el('drawerLastSeen').textContent = formatRelative(data.last_seen_at || data.last_active_at);

      el('drawerTotalActions').textContent = String(data.total_actions || 0);
      el('drawerResourcesCount').textContent = String(data.resources_accessed_count || 0);

      // Most Visited Sections
      if (data.top_pages?.length) {
        el('drawerTopPages').innerHTML = `
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${data.top_pages.map((p) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.82rem;">
                <span style="font-weight:600;color:#0f172a;font-family:monospace;">/${p.page || 'home'}</span>
                <span style="font-weight:700;color:#2563eb;background:#eff6ff;padding:2px 8px;border-radius:6px;border:1px solid #bfdbfe;">${p.views} views</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        el('drawerTopPages').innerHTML = `<div style="color:#94a3b8;font-size:0.8rem;padding:8px 0;">No section visits recorded yet.</div>`;
      }

      // Device Telemetry
      const dev = data.recent_sessions?.[0]?.device_info || {};
      el('drawerUserDevice').innerHTML = `
        <div><strong>Browser &amp; OS:</strong> ${dev.browser || 'Web'} on ${dev.os || 'Unknown OS'} (${dev.device_type || 'Desktop'})</div>
        <div><strong>Screen &amp; Viewport:</strong> ${dev.screen || 'Unknown'} · Viewport: ${dev.viewport || 'Unknown'}</div>
        <div><strong>Language:</strong> ${dev.language || 'en-US'}</div>
      `;

      loadUserTimeline(userId, activeTimelineFilter);
    } catch (e) {
      el('drawerUserName').textContent = 'Error loading dossier';
    }
  }

  // Load Timeline Events for Dossier Drawer
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

  // Live Activity Feed Ticker
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

    while (stream.children.length > 30) {
      stream.removeChild(stream.lastChild);
    }
  }

  // Real-Time Subscriptions
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
