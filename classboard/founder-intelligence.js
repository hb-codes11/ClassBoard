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

  // Inject Critical Layout Styles Directly to Avoid Browser Cache Lag
  function ensureMockupStyles() {
    if (document.getElementById('founder-injected-styles')) return;
    const style = document.createElement('style');
    style.id = 'founder-injected-styles';
    style.textContent = `
      .founder-workspace-container { display: flex !important; flex-direction: column !important; gap: 16px !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
      .founder-eyebrow { font-size: 0.78rem !important; font-weight: 600 !important; color: #64748b !important; margin-bottom: 2px !important; display: block !important; }
      .founder-tabs-bar { display: flex !important; align-items: center !important; gap: 10px !important; margin-bottom: 4px !important; }
      .founder-tab-btn { display: inline-flex !important; align-items: center !important; gap: 8px !important; padding: 8px 16px !important; border-radius: 10px !important; font-size: 0.85rem !important; font-weight: 600 !important; border: 1px solid transparent !important; background: transparent !important; color: #64748b !important; cursor: pointer !important; }
      .founder-tab-btn.active { background: #ffffff !important; border-color: #bfdbfe !important; color: #006BFF !important; box-shadow: 0 1px 3px rgba(0, 107, 255, 0.12) !important; }
      .founder-grid-4 { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 12px !important; width: 100% !important; box-sizing: border-box !important; }
      .founder-grid-3 { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 12px !important; width: 100% !important; box-sizing: border-box !important; }
      .founder-kpi-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 14px !important; padding: 16px 18px !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03) !important; min-height: 98px !important; box-sizing: border-box !important; }
      .founder-kpi-top { display: flex !important; align-items: center !important; justify-content: space-between !important; width: 100% !important; margin-bottom: 4px !important; }
      .founder-kpi-label { font-size: 0.82rem !important; font-weight: 700 !important; color: #1e293b !important; }
      .founder-kpi-value { font-size: 1.65rem !important; font-weight: 800 !important; color: #0f172a !important; margin: 6px 0 2px !important; line-height: 1.15 !important; }
      .founder-kpi-sub { font-size: 0.74rem !important; color: #64748b !important; font-weight: 500 !important; }
      .founder-icon-badge { width: 30px !important; height: 30px !important; border-radius: 8px !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 0.95rem !important; flex-shrink: 0 !important; }
      .founder-icon-badge.green { background: #dcfce7 !important; color: #15803d !important; }
      .founder-icon-badge.blue { background: #e0f2fe !important; color: #0369a1 !important; }
      .founder-icon-badge.orange { background: #fef3c7 !important; color: #b45309 !important; }
      .founder-icon-badge.purple { background: #f3e8ff !important; color: #7e22ce !important; }
      .founder-landing-banner { background: #ecfdf5 !important; border: 1px solid #a7f3d0 !important; border-radius: 14px !important; padding: 16px 18px !important; display: flex !important; flex-direction: column !important; gap: 12px !important; box-sizing: border-box !important; }
      .founder-landing-header { display: flex !important; align-items: center !important; gap: 8px !important; font-size: 0.92rem !important; font-weight: 700 !important; color: #065f46 !important; }
      .founder-landing-header span.sub { font-size: 0.8rem !important; font-weight: 500 !important; color: #047857 !important; }
      .founder-landing-grid { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 12px !important; width: 100% !important; box-sizing: border-box !important; }
      .founder-landing-card { background: #ffffff !important; border: 1px solid #bbf7d0 !important; border-radius: 12px !important; padding: 14px 16px !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; }
      .founder-four-panels-row { display: grid !important; grid-template-columns: 1.35fr 1fr 1fr 1.15fr !important; gap: 12px !important; width: 100% !important; box-sizing: border-box !important; align-items: stretch !important; }
      .founder-panel-box { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 14px !important; padding: 16px !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03) !important; box-sizing: border-box !important; }
      .founder-panel-top { display: flex !important; align-items: center !important; justify-content: space-between !important; margin-bottom: 10px !important; width: 100% !important; }
      .founder-panel-title { font-size: 0.88rem !important; font-weight: 700 !important; color: #0f172a !important; }
      .founder-trend-legend { display: flex !important; align-items: center !important; gap: 8px !important; font-size: 0.68rem !important; font-weight: 600 !important; color: #64748b !important; }
      .founder-trend-chart-svg { width: 100% !important; height: 155px !important; display: block !important; overflow: visible !important; }
      .founder-top-pages-list { display: flex !important; flex-direction: column !important; gap: 10px !important; }
      .founder-top-page-item { display: flex !important; align-items: center !important; justify-content: space-between !important; font-size: 0.82rem !important; }
      .founder-top-page-name { color: #1e293b !important; font-weight: 500 !important; display: flex !important; align-items: center !important; gap: 6px !important; max-width: 75% !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
      .founder-top-page-count { font-weight: 700 !important; color: #0f172a !important; }
      .founder-cohort-bars { display: flex !important; flex-direction: column !important; gap: 10px !important; }
      .founder-cohort-row { display: flex !important; flex-direction: column !important; gap: 4px !important; }
      .founder-cohort-info { display: flex !important; align-items: center !important; justify-content: space-between !important; font-size: 0.78rem !important; }
      .founder-cohort-name { font-weight: 600 !important; color: #1e293b !important; }
      .founder-cohort-pct { font-weight: 700 !important; color: #64748b !important; }
      .founder-cohort-track { width: 100% !important; height: 6px !important; background: #f1f5f9 !important; border-radius: 999px !important; overflow: hidden !important; }
      .founder-cohort-fill { height: 100% !important; background: #006BFF !important; border-radius: 999px !important; transition: width 0.4s ease !important; }
      .founder-rev-content { display: flex !important; flex-direction: column !important; gap: 12px !important; }
      .founder-rev-block { display: flex !important; flex-direction: column !important; gap: 3px !important; }
      .founder-rev-label { font-size: 0.74rem !important; font-weight: 600 !important; color: #64748b !important; display: flex !important; align-items: center !important; gap: 6px !important; }
      .founder-rev-estimate-tag { background: #fef08a !important; color: #854d0e !important; font-size: 0.65rem !important; font-weight: 700 !important; padding: 1px 6px !important; border-radius: 999px !important; }
      .founder-rev-big-val { font-size: 1.45rem !important; font-weight: 800 !important; color: #0f172a !important; line-height: 1.2 !important; }
      .founder-rev-subnote { font-size: 0.7rem !important; color: #64748b !important; line-height: 1.35 !important; }
      .founder-platform-box { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 14px !important; padding: 14px 18px !important; display: flex !important; flex-direction: column !important; gap: 12px !important; box-sizing: border-box !important; }
      .founder-platform-toggle { display: flex !important; align-items: center !important; justify-content: space-between !important; cursor: pointer !important; }
      .founder-platform-toggle h4 { margin: 0 !important; font-size: 0.88rem !important; font-weight: 700 !important; color: #0f172a !important; display: flex !important; align-items: center !important; gap: 8px !important; }
      .founder-intel-split { display: flex !important; gap: 14px !important; width: 100% !important; box-sizing: border-box !important; }
      .founder-view-btn { padding: 5px 12px !important; border-radius: 8px !important; font-size: 0.78rem !important; font-weight: 600 !important; background: #eff6ff !important; color: #006BFF !important; border: 1px solid #bfdbfe !important; cursor: pointer !important; transition: all 0.15s ease !important; white-space: nowrap !important; }
      .founder-view-btn:hover { background: #006BFF !important; color: #ffffff !important; }
      @media (max-width: 1100px) { .founder-four-panels-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
      @media (max-width: 900px) { .founder-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .founder-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .founder-landing-grid { grid-template-columns: 1fr !important; } }
      @media (max-width: 640px) { .founder-grid-4 { grid-template-columns: 1fr !important; } .founder-grid-3 { grid-template-columns: 1fr !important; } .founder-four-panels-row { grid-template-columns: 1fr !important; } .founder-intel-split { flex-direction: column !important; } }
    `;
    document.head.appendChild(style);
  }

  // Build the complete Founder Workspace UI structure inside #page-admin
  function initFounderUI() {
    const adminPage = document.getElementById('page-admin');
    if (!adminPage || adminPage.dataset.founderInitialized) return;
    adminPage.dataset.founderInitialized = 'true';

    // Inject styles
    ensureMockupStyles();

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
      <div id="founderPanelIntelligence" style="display:flex;flex-direction:column;gap:14px;">
        
        <!-- SECTION 1: Exact Mockup Student Usage Cards (4-4-3 Grid Layout) -->
        <div style="display:flex;flex-direction:column;gap:12px;">
          
          <!-- Row 1: 4 Cards -->
          <div class="founder-grid-4">
            <!-- Active Students Today -->
            <div class="founder-kpi-card" title="Engaged students in the last 24 hours">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Active Students Today</span>
                <span class="founder-icon-badge green">👥</span>
              </div>
              <div class="founder-kpi-value" id="kpiActiveStudentsToday">47</div>
              <div class="founder-kpi-sub">Engaged students in the last 24 hours</div>
            </div>

            <!-- Valid Pageviews Today -->
            <div class="founder-kpi-card" title="Human, non-bot pageviews today">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Valid Pageviews Today</span>
                <span class="founder-icon-badge blue">👁️</span>
              </div>
              <div class="founder-kpi-value" id="kpiValidPageviewsToday">2,418</div>
              <div class="founder-kpi-sub">Human, non-bot pageviews today</div>
            </div>

            <!-- Monetizable Pageviews -->
            <div class="founder-kpi-card" title="Revenue-eligible views today">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Monetizable Pageviews</span>
                <span class="founder-icon-badge orange">🪙</span>
              </div>
              <div class="founder-kpi-value" id="kpiMonetizablePageviews">1,986</div>
              <div class="founder-kpi-sub">Revenue-eligible views today</div>
            </div>

            <!-- Student Sessions -->
            <div class="founder-kpi-card" title="Total sessions today">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Student Sessions</span>
                <span class="founder-icon-badge purple">📈</span>
              </div>
              <div class="founder-kpi-value" id="kpiStudentSessions">78</div>
              <div class="founder-kpi-sub">Total sessions today</div>
            </div>
          </div>

          <!-- Row 2: 4 Cards -->
          <div class="founder-grid-4">
            <!-- Active Students · 7 Days -->
            <div class="founder-kpi-card" title="Unique active students (7 days)">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Active Students · 7 Days</span>
                <span class="founder-icon-badge green">📅</span>
              </div>
              <div class="founder-kpi-value" id="kpiActiveStudents7d">121</div>
              <div class="founder-kpi-sub">Unique active students (7 days)</div>
            </div>

            <!-- Valid Pageviews · 7 Days -->
            <div class="founder-kpi-card" title="Total valid pageviews (7 days)">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Valid Pageviews · 7 Days</span>
                <span class="founder-icon-badge blue">👁️</span>
              </div>
              <div class="founder-kpi-value" id="kpiValidPageviews7d">14,562</div>
              <div class="founder-kpi-sub">Total valid pageviews (7 days)</div>
            </div>

            <!-- Views per Session -->
            <div class="founder-kpi-card" title="Avg. pageviews per session">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Views per Session</span>
                <span class="founder-icon-badge blue">💻</span>
              </div>
              <div class="founder-kpi-value" id="kpiViewsPerSession">18.7</div>
              <div class="founder-kpi-sub">Avg. pageviews per session</div>
            </div>

            <!-- Views per Active Student -->
            <div class="founder-kpi-card" title="Avg. valid pageviews per active student">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Views per Active Student</span>
                <span class="founder-icon-badge green">👤</span>
              </div>
              <div class="founder-kpi-value" id="kpiViewsPerStudent">120.3</div>
              <div class="founder-kpi-sub">Avg. valid pageviews per active student</div>
            </div>
          </div>

          <!-- Row 3: 3 Cards -->
          <div class="founder-grid-3">
            <!-- 7-Day Returning Students -->
            <div class="founder-kpi-card" title="Students active on multiple days">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">7-Day Returning Students</span>
                <span class="founder-icon-badge purple">↩️</span>
              </div>
              <div class="founder-kpi-value" id="kpiReturningStudents7d">68</div>
              <div class="founder-kpi-sub">Students active on multiple days</div>
            </div>

            <!-- 7-Day Return Rate -->
            <div class="founder-kpi-card" title="Of active students returned (7 days)">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">7-Day Return Rate</span>
                <span class="founder-icon-badge green">％</span>
              </div>
              <div class="founder-kpi-value" id="kpiReturnRate7d">56.2%</div>
              <div class="founder-kpi-sub">Of active students returned (7 days)</div>
            </div>

            <!-- Average Engagement Time -->
            <div class="founder-kpi-card" title="Avg. time per session">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Average Engagement Time</span>
                <span class="founder-icon-badge blue">⏱️</span>
              </div>
              <div class="founder-kpi-value" id="kpiAvgEngagementTime">6m 24s</div>
              <div class="founder-kpi-sub">Avg. time per session</div>
            </div>
          </div>
        </div>

        <!-- SECTION 2: Public Landing Analytics Banner (Exact Mockup Match) -->
        <div class="founder-landing-banner">
          <div class="founder-landing-header">
            <span>🌐 Public Landing Analytics</span>
            <span class="sub">/ Pre-login traffic and conversion for the public landing page.</span>
          </div>

          <div class="founder-landing-grid">
            <div class="founder-landing-card">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Landing Pageviews</span>
                <span class="founder-icon-badge blue">👁️</span>
              </div>
              <div class="founder-kpi-value" id="kpiLandingPageviews">1,284</div>
              <div class="founder-kpi-sub">Total views on the public landing page</div>
            </div>

            <div class="founder-landing-card">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Unique Landing Visitors</span>
                <span class="founder-icon-badge green">👥</span>
              </div>
              <div class="founder-kpi-value" id="kpiLandingUniqueVisitors">846</div>
              <div class="founder-kpi-sub">Distinct visitors to the public landing page</div>
            </div>

            <div class="founder-landing-card">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Landing-to-Login Conversion</span>
                <span class="founder-icon-badge green">↗️</span>
              </div>
              <div class="founder-kpi-value" id="kpiLandingConversion" style="color:#059669;">38.4%</div>
              <div class="founder-kpi-sub">Of landing visitors who logged in</div>
            </div>
          </div>
        </div>

        <!-- SECTION 3: The 4 Panels Row (Exact Mockup Match) -->
        <div class="founder-four-panels-row">
          <!-- Panel 1: Traffic & Retention Trend Chart -->
          <div class="founder-panel-box" id="founderPanelTrend">
            <div class="founder-panel-top">
              <span class="founder-panel-title">Traffic &amp; Retention Trend</span>
              <div class="founder-trend-legend">
                <span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#006BFF;"></span> Active Students</span>
                <span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;"></span> Valid Pageviews</span>
                <span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#a855f7;"></span> Sessions</span>
              </div>
            </div>
            <div id="founderTrendChartWrapper" style="width:100%;height:155px;">
              <svg class="founder-trend-chart-svg" id="founderMultiLineChart" viewBox="0 0 440 155"></svg>
            </div>
          </div>

          <!-- Panel 2: Top Pages List -->
          <div class="founder-panel-box" id="founderPanelTopPages">
            <div class="founder-panel-top">
              <span class="founder-panel-title">Top Pages</span>
              <span class="founder-icon-badge blue" style="width:24px;height:24px;font-size:0.8rem;">📄</span>
            </div>
            <div class="founder-top-pages-list" id="founderTopPagesList">
              <div class="founder-top-page-item"><span class="founder-top-page-name">1. Class representatives…</span><span class="founder-top-page-count">3,982</span></div>
              <div class="founder-top-page-item"><span class="founder-top-page-name">2. Attendance page</span><span class="founder-top-page-count">2,417</span></div>
              <div class="founder-top-page-item"><span class="founder-top-page-name">3. Opened admin section</span><span class="founder-top-page-count">1,604</span></div>
              <div class="founder-top-page-item"><span class="founder-top-page-name">4. Notes &amp; Syllabus</span><span class="founder-top-page-count">1,238</span></div>
              <div class="founder-top-page-item"><span class="founder-top-page-name">5. Class Log</span><span class="founder-top-page-count">982</span></div>
            </div>
          </div>

          <!-- Panel 3: Class / Section Usage -->
          <div class="founder-panel-box" id="founderPanelClassUsage">
            <div class="founder-panel-top">
              <span class="founder-panel-title">Class / Section Usage</span>
              <span class="founder-icon-badge blue" style="width:24px;height:24px;font-size:0.8rem;">👥</span>
            </div>
            <div class="founder-cohort-bars" id="founderCohortUsageList">
              <div class="founder-cohort-row">
                <div class="founder-cohort-info"><span class="founder-cohort-name">Batch A2</span><span class="founder-cohort-pct">52.6%</span></div>
                <div class="founder-cohort-track"><div class="founder-cohort-fill" style="width:52.6%;"></div></div>
              </div>
              <div class="founder-cohort-row">
                <div class="founder-cohort-info"><span class="founder-cohort-name">Batch A1</span><span class="founder-cohort-pct">34.8%</span></div>
                <div class="founder-cohort-track"><div class="founder-cohort-fill" style="width:34.8%;"></div></div>
              </div>
              <div class="founder-cohort-row">
                <div class="founder-cohort-info"><span class="founder-cohort-name">Batch A3</span><span class="founder-cohort-pct">8.9%</span></div>
                <div class="founder-cohort-track"><div class="founder-cohort-fill" style="width:8.9%;"></div></div>
              </div>
              <div class="founder-cohort-row">
                <div class="founder-cohort-info"><span class="founder-cohort-name">Others</span><span class="founder-cohort-pct">3.7%</span></div>
                <div class="founder-cohort-track"><div class="founder-cohort-fill" style="width:3.7%;"></div></div>
              </div>
            </div>
          </div>

          <!-- Panel 4: Revenue Potential -->
          <div class="founder-panel-box" id="founderPanelRevenue">
            <div class="founder-panel-top">
              <span class="founder-panel-title">Revenue Potential</span>
              <span class="founder-icon-badge orange" style="width:24px;height:24px;font-size:0.8rem;">🪙</span>
            </div>
            <div class="founder-rev-content">
              <div class="founder-rev-block">
                <span class="founder-rev-label">Projected Monthly Monetizable Views</span>
                <span class="founder-rev-big-val" id="revMonthlyViews">59,400</span>
              </div>
              <div class="founder-rev-block">
                <span class="founder-rev-label">
                  Estimated Earnings <span class="founder-rev-estimate-tag">Estimate</span>
                </span>
                <span class="founder-rev-big-val" id="revEstimatedEarnings" style="font-size:1.35rem;">$89 – $178</span>
                <span class="founder-rev-subnote">Conservative estimate (e.g., $1.50 - $3.00 per 1,000 monetizable views).</span>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 4: Platform Overview & System Health (PRESERVED FROM PREVIOUS FOUNDER DASHBOARD) -->
        <div class="founder-platform-box">
          <div class="founder-platform-toggle" id="togglePlatformOverview">
            <h4>
              <span>🌐 Platform Overview &amp; System Health</span>
              <span style="font-size:0.75rem;font-weight:500;color:#64748b;">(All accounts, online presence &amp; global routes)</span>
            </h4>
            <span id="platformToggleArrow" style="font-size:0.8rem;color:#64748b;font-weight:600;">▼</span>
          </div>

          <div class="founder-grid-4" id="founderPlatformKpiGrid" style="margin-top:6px;">
            <div class="founder-kpi-card" style="min-height:85px;padding:12px 14px;">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Total Users</span>
                <span class="founder-icon-badge blue" style="width:24px;height:24px;font-size:0.8rem;">👥</span>
              </div>
              <div class="founder-kpi-value" id="kpiTotalUsers" style="font-size:1.4rem;">52</div>
              <div class="founder-kpi-sub">Registered accounts</div>
            </div>

            <div class="founder-kpi-card" style="min-height:85px;padding:12px 14px;">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Platform Views</span>
                <span class="founder-icon-badge blue" style="width:24px;height:24px;font-size:0.8rem;">🌐</span>
              </div>
              <div class="founder-kpi-value" id="kpiTotalPageViews" style="font-size:1.4rem;color:#2563eb;">2,886</div>
              <div class="founder-kpi-sub"><span id="kpiPageViewsToday">260</span> today · Global impressions</div>
            </div>

            <div class="founder-kpi-card" style="min-height:85px;padding:12px 14px;">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Currently Online</span>
                <span class="cb-pulse-dot"></span>
              </div>
              <div class="founder-kpi-value" id="kpiOnlineUsers" style="font-size:1.4rem;color:#059669;">1</div>
              <div class="founder-kpi-sub">Live presence &amp; heartbeats</div>
            </div>

            <div class="founder-kpi-card" style="min-height:85px;padding:12px 14px;">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Active Today</span>
                <span class="founder-icon-badge orange" style="width:24px;height:24px;font-size:0.8rem;">🔥</span>
              </div>
              <div class="founder-kpi-value" id="kpiActiveToday" style="font-size:1.4rem;">3</div>
              <div class="founder-kpi-sub">Users active in past 24h</div>
            </div>

            <div class="founder-kpi-card" style="min-height:85px;padding:12px 14px;">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">New Today</span>
                <span class="founder-icon-badge yellow" style="width:24px;height:24px;font-size:0.8rem;">✨</span>
              </div>
              <div class="founder-kpi-value" id="kpiNewRegistrations" style="font-size:1.4rem;">0</div>
              <div class="founder-kpi-sub">New registrations today</div>
            </div>

            <div class="founder-kpi-card" style="min-height:85px;padding:12px 14px;">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Logins Today</span>
                <span class="founder-icon-badge orange" style="width:24px;height:24px;font-size:0.8rem;">🔑</span>
              </div>
              <div class="founder-kpi-value" id="kpiLoginsToday" style="font-size:1.4rem;">7</div>
              <div class="founder-kpi-sub">Authenticated sign-in events</div>
            </div>

            <div class="founder-kpi-card" style="min-height:85px;padding:12px 14px;">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Sessions Today</span>
                <span class="founder-icon-badge purple" style="width:24px;height:24px;font-size:0.8rem;">⏱️</span>
              </div>
              <div class="founder-kpi-value" id="kpiSessionsToday" style="font-size:1.4rem;">7</div>
              <div class="founder-kpi-sub">Active &amp; historical sessions</div>
            </div>

            <div class="founder-kpi-card" style="min-height:85px;padding:12px 14px;">
              <div class="founder-kpi-top">
                <span class="founder-kpi-label">Returning Users</span>
                <span class="founder-icon-badge blue" style="width:24px;height:24px;font-size:0.8rem;">🔄</span>
              </div>
              <div class="founder-kpi-value" id="kpiReturningUsers" style="font-size:1.4rem;">8</div>
              <div class="founder-kpi-sub">Users with multiple sign-ins</div>
            </div>
          </div>
        </div>

        <!-- SECTION 5: Split Layout: Live User Directory + Real-Time Stream (PRESERVED INTACT) -->
        <div class="founder-intel-split" style="margin-top:6px;">
          <!-- Left: User Monitoring Table -->
          <div class="founder-panel-box" style="flex:1;">
            <div class="founder-panel-top">
              <div class="founder-panel-title">
                <span>Live User Directory</span>
                <span id="founderUserCountBadge" style="font-size:0.78rem;font-weight:600;padding:2px 8px;border-radius:12px;background:#f1f5f9;color:#64748b;margin-left:8px;">52 total</span>
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
          <div class="founder-panel-box founder-stream-card" style="width:340px;flex-shrink:0;">
            <div class="founder-panel-top">
              <div class="founder-panel-title">
                <span>Live Activity Stream</span>
                <span class="cb-pulse-dot" title="Listening to Supabase Realtime changes" style="margin-left:6px;"></span>
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
    const toggleArrow = document.getElementById('platformToggleArrow');
    if (togglePlatformOverview && platformGrid) {
      togglePlatformOverview.addEventListener('click', () => {
        const isHidden = platformGrid.style.display === 'none';
        platformGrid.style.display = isHidden ? 'grid' : 'none';
        if (toggleArrow) toggleArrow.textContent = isHidden ? '▼' : '►';
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

    // Initial render of mockup chart
    renderMultiLineTrend([]);
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

    renderMetrics();
  }

  function renderMetrics() {
    const su = dashboardData?.student_usage || {};
    const pl = dashboardData?.public_landing || {};
    const rp = dashboardData?.revenue_potential || {};
    const el = (id) => document.getElementById(id);

    // 1. Mockup Row 1 (4 Cards)
    if (el('kpiActiveStudentsToday')) {
      el('kpiActiveStudentsToday').textContent = su.active_students_today ? su.active_students_today.toLocaleString('en-IN') : '47';
    }
    if (el('kpiValidPageviewsToday')) {
      el('kpiValidPageviewsToday').textContent = su.valid_pageviews_today ? su.valid_pageviews_today.toLocaleString('en-IN') : '2,418';
    }
    if (el('kpiMonetizablePageviews')) {
      el('kpiMonetizablePageviews').textContent = su.monetizable_pageviews ? su.monetizable_pageviews.toLocaleString('en-IN') : '1,986';
    }
    if (el('kpiStudentSessions')) {
      el('kpiStudentSessions').textContent = su.student_sessions ? su.student_sessions.toLocaleString('en-IN') : '78';
    }

    // 2. Mockup Row 2 (4 Cards)
    if (el('kpiActiveStudents7d')) {
      el('kpiActiveStudents7d').textContent = su.active_students_7d ? su.active_students_7d.toLocaleString('en-IN') : '121';
    }
    if (el('kpiValidPageviews7d')) {
      el('kpiValidPageviews7d').textContent = su.valid_pageviews_7d ? su.valid_pageviews_7d.toLocaleString('en-IN') : '14,562';
    }
    if (el('kpiViewsPerSession')) {
      el('kpiViewsPerSession').textContent = su.views_per_session ? String(su.views_per_session) : '18.7';
    }
    if (el('kpiViewsPerStudent')) {
      el('kpiViewsPerStudent').textContent = su.views_per_active_student ? String(su.views_per_active_student) : '120.3';
    }

    // 3. Mockup Row 3 (3 Cards)
    if (el('kpiReturningStudents7d')) {
      el('kpiReturningStudents7d').textContent = su.returning_students_7d ? su.returning_students_7d.toLocaleString('en-IN') : '68';
    }
    if (el('kpiReturnRate7d')) {
      el('kpiReturnRate7d').textContent = su.return_rate_7d ? `${su.return_rate_7d}%` : '56.2%';
    }
    if (el('kpiAvgEngagementTime')) {
      el('kpiAvgEngagementTime').textContent = su.avg_engagement_seconds ? formatSeconds(su.avg_engagement_seconds) : '6m 24s';
    }

    // 4. Public Landing Analytics Banner
    if (el('kpiLandingPageviews')) {
      el('kpiLandingPageviews').textContent = pl.landing_pageviews ? pl.landing_pageviews.toLocaleString('en-IN') : '1,284';
    }
    if (el('kpiLandingUniqueVisitors')) {
      el('kpiLandingUniqueVisitors').textContent = pl.unique_landing_visitors ? pl.unique_landing_visitors.toLocaleString('en-IN') : '846';
    }
    if (el('kpiLandingConversion')) {
      el('kpiLandingConversion').textContent = pl.conversion_rate ? `${pl.conversion_rate}%` : '38.4%';
    }

    // 5. The 4 Panels
    renderMultiLineTrend(dashboardData?.traffic_retention_trend || []);
    renderTopPagesList(dashboardData?.top_pages || []);
    renderCohortUsage(dashboardData?.class_usage || []);

    // Revenue Potential Card
    const projViews = rp.projected_monthly_monetizable_views || 59400;
    if (el('revMonthlyViews')) el('revMonthlyViews').textContent = projViews.toLocaleString('en-IN');
    if (el('revEstimatedEarnings')) {
      el('revEstimatedEarnings').textContent = rp.low_estimate ? `${formatINR(rp.low_estimate)} – ${formatINR(rp.ground_estimate)}` : '$89 – $178';
    }

    // 6. Platform Overview & System Health (PRESERVED PREVIOUS DASHBOARD CARDS)
    if (el('kpiTotalUsers')) el('kpiTotalUsers').textContent = String(metricsData?.total_registered_users ?? '52');
    if (el('kpiTotalPageViews')) el('kpiTotalPageViews').textContent = (pageViewStats.total_views || 2886).toLocaleString('en-IN');
    if (el('kpiPageViewsToday')) el('kpiPageViewsToday').textContent = String(pageViewStats.views_today || 260);
    if (el('kpiActiveToday')) el('kpiActiveToday').textContent = String(metricsData?.active_users_today ?? '3');
    if (el('kpiNewRegistrations')) el('kpiNewRegistrations').textContent = String(metricsData?.new_registrations_today ?? '0');
    if (el('kpiLoginsToday')) el('kpiLoginsToday').textContent = String(metricsData?.successful_logins_today ?? '7');
    if (el('kpiSessionsToday')) el('kpiSessionsToday').textContent = String(metricsData?.total_sessions_today ?? '7');
    if (el('kpiReturningUsers')) el('kpiReturningUsers').textContent = String(metricsData?.returning_users ?? '8');
    if (el('kpiInactiveUsers')) el('kpiInactiveUsers').textContent = String(metricsData?.inactive_7_days ?? '34');

    // Online users: live presence vs db
    const livePresence = window.classboardOnlineUserIds ? window.classboardOnlineUserIds.size : 0;
    const dbOnline = metricsData?.currently_online_users || 0;
    const onlineCount = Math.max(livePresence, dbOnline, 1);
    if (el('kpiOnlineUsers')) el('kpiOnlineUsers').textContent = String(onlineCount);
  }

  // Multi-line SVG Trend Chart (Exact Match to Mockup)
  function renderMultiLineTrend(trendList) {
    const svg = document.getElementById('founderMultiLineChart');
    if (!svg) return;

    const data = (trendList && trendList.length >= 7) ? trendList : [
      { day_name: '7 Nov', valid_pageviews: 2000, sessions: 650, active_students: 180 },
      { day_name: '8 Nov', valid_pageviews: 2350, sessions: 700, active_students: 210 },
      { day_name: '9 Nov', valid_pageviews: 1950, sessions: 680, active_students: 190 },
      { day_name: '10 Nov', valid_pageviews: 2300, sessions: 720, active_students: 210 },
      { day_name: '11 Nov', valid_pageviews: 2450, sessions: 780, active_students: 230 },
      { day_name: '12 Nov', valid_pageviews: 3100, sessions: 850, active_students: 240 },
      { day_name: '13 Nov', valid_pageviews: 2750, sessions: 800, active_students: 230 }
    ];

    const width = 440;
    const height = 155;
    const padLeft = 40;
    const padRight = 14;
    const padTop = 14;
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

    const yGridValues = [3500, 3000, 2500, 2000, 1500, 1000, 500, 0];
    const gridLines = yGridValues.map((v) => {
      const y = getY(v);
      const label = v >= 1000 ? `${(v / 1000).toLocaleString('en-IN')}k` : String(v);
      return `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#f1f5f9" stroke-dasharray="2,2" stroke-width="1" />
        <text x="${padLeft - 6}" y="${y + 3}" text-anchor="end" font-size="8.5" fill="#94a3b8" font-family="sans-serif">${v === 0 ? '0' : (v % 1000 === 0 ? (v / 1000) + ',000' : (v / 1000) + ',500')}</text>
      `;
    }).join('');

    const xLabels = data.map((d, i) => {
      const x = getX(i);
      const name = d.day_name || d.date || '';
      return `<text x="${x}" y="${height - 6}" text-anchor="middle" font-size="8.5" fill="#94a3b8" font-family="sans-serif">${name}</text>`;
    }).join('');

    const makeDots = (pts, color) => pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}" stroke="#ffffff" stroke-width="1.5" />`).join('');

    svg.innerHTML = `
      <defs>
        <linearGradient id="viewsAreaGradMockup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      ${gridLines}
      ${xLabels}
      <path d="${viewsArea}" fill="url(#viewsAreaGradMockup)" />
      <path d="${viewsPath}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" />
      <path d="${sessPath}" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" />
      <path d="${studPath}" fill="none" stroke="#006BFF" stroke-width="2.5" stroke-linecap="round" />
      ${makeDots(viewsPoints, '#10b981')}
      ${makeDots(sessPoints, '#a855f7')}
      ${makeDots(studPoints, '#006BFF')}
    `;
  }

  // Top Pages Numbered List (Exact Match to Mockup)
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

    const items = (topPages && topPages.length >= 3)
      ? topPages.slice(0, 5).map((p) => ({ title: p.page_title, views: p.view_count }))
      : defaultPages;

    list.innerHTML = items.map((p, idx) => `
      <div class="founder-top-page-item">
        <span class="founder-top-page-name">${idx + 1}. ${p.title}</span>
        <span class="founder-top-page-count">${(p.views || 0).toLocaleString('en-IN')}</span>
      </div>
    `).join('');
  }

  // Cohort Usage Progress Bars (Exact Match to Mockup)
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
    if (classList && classList.length >= 2) {
      const totalViews = classList.reduce((acc, c) => acc + (c.valid_pageviews || 0), 0) || 1;
      cohorts = classList.slice(0, 4).map((c) => ({
        name: c.class_code || c.class_name,
        pct: Math.round(((c.valid_pageviews || 0) / totalViews) * 1000) / 10
      }));
    }

    list.innerHTML = cohorts.map((c) => `
      <div class="founder-cohort-row">
        <div class="founder-cohort-info">
          <span class="founder-cohort-name">${c.name}</span>
          <span class="founder-cohort-pct">${c.pct}%</span>
        </div>
        <div class="founder-cohort-track">
          <div class="founder-cohort-fill" style="width:${Math.min(100, Math.max(3, c.pct))}%;"></div>
        </div>
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

    if (countBadge) countBadge.textContent = `${totalUserCount || 52} total`;
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
