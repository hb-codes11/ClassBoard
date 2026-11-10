// ClassBoard Activity Intelligence & Login Tracker
// Production-ready user presence, heartbeat, and action audit trail

(() => {
  let activeSessionId = null;
  let heartbeatTimer = null;
  let presenceChannel = null;
  let lastLoggedAction = { key: '', time: 0 };

  function getDeviceInfo() {
    const ua = navigator.userAgent || '';
    let os = 'Unknown OS';
    if (/iPad|iPhone|iPod/.test(ua)) os = 'iOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
    else if (/Windows NT/.test(ua)) os = 'Windows';
    else if (/Linux/.test(ua)) os = 'Linux';

    let browser = 'Unknown Browser';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';

    const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua) || window.innerWidth < 768;

    return {
      os,
      browser,
      device_type: isMobile ? 'Mobile' : 'Desktop',
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language || 'en-US'
    };
  }

  async function sendHeartbeat() {
    if (!window.classboardSupabase?.rpc) return;
    try {
      await window.classboardSupabase.rpc('user_heartbeat', {
        p_session_id: activeSessionId || null
      });
    } catch (_) {}
  }

  function startHeartbeatLoop() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    // Send periodic heartbeat every 45 seconds while active
    heartbeatTimer = setInterval(sendHeartbeat, 45000);
  }

  function setupPresence(user) {
    if (!window.classboardSupabase?.channel || !user?.id) return;
    try {
      if (presenceChannel) {
        window.classboardSupabase.removeChannel(presenceChannel);
      }

      presenceChannel = window.classboardSupabase.channel('classboard-presence', {
        config: { presence: { key: user.id } }
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const onlineIds = new Set(Object.keys(state));
          window.classboardOnlineUserIds = onlineIds;
          window.dispatchEvent(new CustomEvent('classboard:presence-sync', { detail: { state, onlineIds } }));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user_id: user.id,
              email: user.email,
              display_name: user.user_metadata?.full_name || '',
              online_at: new Date().toISOString()
            });
          }
        });
    } catch (e) {
      console.warn('ClassBoard presence initialization error:', e);
    }
  }

  async function recordUserLogin(method, isExplicitLogin = true) {
    if (!window.classboardSupabase?.rpc) return null;
    const deviceInfo = getDeviceInfo();
    try {
      const { data, error } = await window.classboardSupabase.rpc('record_user_login', {
        p_auth_method: method,
        p_device_info: deviceInfo,
        p_is_explicit_login: isExplicitLogin
      });

      if (error) {
        console.warn('Could not record user login event:', error.message);
        return null;
      }

      if (data?.session_id) {
        activeSessionId = data.session_id;
        sessionStorage.setItem('cb_session_id', activeSessionId);
      }
      return data;
    } catch (e) {
      console.warn('ClassBoard login recording error:', e);
      return null;
    }
  }

  async function trackActivity(action, description, page = null, metadata = {}) {
    if (!window.classboardSupabase?.rpc) return;
    const now = Date.now();
    const actionKey = `${action}:${page || ''}:${description}`;
    // Debounce fast identical actions within 2 seconds
    if (lastLoggedAction.key === actionKey && (now - lastLoggedAction.time) < 2000) {
      return;
    }
    lastLoggedAction = { key: actionKey, time: now };

    const currentPage = page || sessionStorage.getItem('classboard-page') || 'home';
    try {
      await window.classboardSupabase.rpc('record_user_activity', {
        p_action: action,
        p_description: description,
        p_page: currentPage,
        p_metadata: metadata || {},
        p_session_id: activeSessionId || null
      });
    } catch (err) {
      // Non-critical; silently handle tracking errors
    }
  }

  async function initSession(user, forcedMethod = null) {
    if (!user) return;
    activeSessionId = sessionStorage.getItem('cb_session_id');

    const pendingMethod = sessionStorage.getItem('cb_pending_auth_method');
    sessionStorage.removeItem('cb_pending_auth_method');

    // Detect OAuth callback in URL hash or query params
    const hasOAuthParams = window.location.hash.includes('access_token=') ||
      window.location.search.includes('code=') ||
      window.location.hash.includes('provider_token=');

    const isExplicit = Boolean(forcedMethod || pendingMethod || hasOAuthParams || !activeSessionId);
    const method = forcedMethod || pendingMethod || (hasOAuthParams ? 'google' : 'session_restore');

    if (!activeSessionId || forcedMethod || pendingMethod || hasOAuthParams) {
      await recordUserLogin(method, isExplicit);
    } else {
      // Tab refresh with existing session: send immediate heartbeat
      await sendHeartbeat();
    }

    startHeartbeatLoop();
    setupPresence(user);
  }

  async function handleLogout() {
    if (presenceChannel) {
      try { await presenceChannel.untrack(); } catch (_) {}
    }
    if (heartbeatTimer) clearInterval(heartbeatTimer);

    if (activeSessionId && window.classboardSupabase?.rpc) {
      try {
        await window.classboardSupabase.rpc('record_user_logout', {
          p_session_id: activeSessionId
        });
      } catch (_) {}
    }

    sessionStorage.removeItem('cb_session_id');
    activeSessionId = null;
  }

  // Auto-instrument DOM interactions
  function initAutoTracking() {
    // 1. Page view changes: hook into openClassboardPage if available
    const originalOpenPage = window.openClassboardPage;
    if (typeof originalOpenPage === 'function') {
      window.openClassboardPage = function (pageId) {
        originalOpenPage.apply(this, arguments);
        trackActivity('page_view', `Opened ${pageId} section`, pageId);
      };
    }

    // 2. Resource clicks & downloads
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target) return;

      // Download links
      const downloadLink = target.closest('a[download], a[href$=".pdf"], [data-resource-download]');
      if (downloadLink) {
        const title = downloadLink.getAttribute('download') || downloadLink.textContent.trim() || 'Resource document';
        trackActivity('resource_download', `Downloaded ${title}`, 'resources', {
          href: downloadLink.getAttribute('href')
        });
        return;
      }

      // Notes preview cards
      const resourceCard = target.closest('.resource-card, .notes-card, [data-preview-resource]');
      if (resourceCard && !target.closest('a')) {
        const title = resourceCard.querySelector('.resource-title, h3, .card-title')?.textContent.trim() || 'Resource item';
        trackActivity('resource_view', `Viewed resource: ${title}`, 'resources');
        return;
      }

      // Sign out buttons
      const signOutBtn = target.closest('#signOutButton, .sign-out-button, [data-sign-out]');
      if (signOutBtn) {
        handleLogout();
      }
    }, true);

    // 3. Tab visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    });

    // 4. Window beforeunload
    window.addEventListener('beforeunload', () => {
      if (activeSessionId && window.classboardSupabase?.rpc) {
        // Send final beacon heartbeat if supported
        navigator.sendBeacon?.('/api/heartbeat', JSON.stringify({ session_id: activeSessionId }));
      }
    });
  }

  // Expose global tracker methods
  window.classboardActivityTracker = {
    initSession,
    recordUserLogin,
    trackActivity,
    handleLogout,
    getDeviceInfo,
    getActiveSessionId: () => activeSessionId
  };
  window.classboardTrackActivity = trackActivity;

  // Initialize auto-tracking on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoTracking);
  } else {
    initAutoTracking();
  }
})();
