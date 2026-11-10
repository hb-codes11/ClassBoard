// ClassBoard Web Push Manager
(function () {
  const VAPID_PUBLIC_KEY = (window.CLASSBOARD_SUPABASE_CONFIG && window.CLASSBOARD_SUPABASE_CONFIG.vapidPublicKey) ||
    'BFjWbGKRLxuAZgRU0oWgTzz85xnTpTNjJ_868u7gtrDPfrgG9HnppGqMRQ8Yv_mbCSFNpe2GgQSE1mRRSKyEcrc';

  let swRegistration = null;

  function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function registerServiceWorker() {
    if (!isPushSupported()) return null;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      swRegistration = reg;
      return reg;
    } catch (err) {
      console.warn('ServiceWorker registration failed:', err);
      return null;
    }
  }

  async function getExistingSubscription() {
    if (!swRegistration) {
      swRegistration = await registerServiceWorker();
    }
    if (!swRegistration) return null;
    return await swRegistration.pushManager.getSubscription();
  }

  async function subscribeToPush() {
    if (!isPushSupported()) {
      alert('Push notifications are not supported by this browser.');
      return false;
    }

    const reg = await registerServiceWorker();
    if (!reg) return false;

    // Check / request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Notification permission was denied. Please allow notifications in your browser settings.');
      updatePushUI();
      hidePromptBanner();
      return false;
    }

    try {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      const subJson = subscription.toJSON();
      const context = window.classboardContext;
      const client = window.classboardSupabase;

      if (context?.userId && client) {
        await client.from('push_subscriptions').upsert({
          user_id: context.userId,
          class_id: context.classId || null,
          endpoint: subscription.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          user_agent: navigator.userAgent
        }, { onConflict: 'user_id,endpoint' });
      }

      updatePushUI();
      hidePromptBanner();
      if (typeof window.notifyApp === 'function') {
        window.notifyApp('Background notifications enabled! You will get notifications even when ClassBoard is closed.');
      }
      return true;
    } catch (err) {
      console.error('Failed to subscribe for push notifications:', err);
      alert(`Could not enable background notifications: ${err.message}`);
      return false;
    }
  }

  async function unsubscribeFromPush() {
    try {
      const subscription = await getExistingSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        const context = window.classboardContext;
        const client = window.classboardSupabase;
        if (context?.userId && client) {
          await client.from('push_subscriptions')
            .delete()
            .eq('user_id', context.userId)
            .eq('endpoint', endpoint);
        }
      }
      updatePushUI();
      if (typeof window.notifyApp === 'function') {
        window.notifyApp('Background notifications turned off on this device.');
      }
      return true;
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      return false;
    }
  }

  async function updatePushUI() {
    const statusEl = document.getElementById('pushNotificationStatus');
    const toggleBtn = document.getElementById('pushNotificationToggle');
    if (!statusEl && !toggleBtn) return;

    if (!isPushSupported()) {
      if (statusEl) statusEl.textContent = 'Not supported on this browser';
      if (toggleBtn) {
        toggleBtn.textContent = 'Not supported';
        toggleBtn.disabled = true;
      }
      return;
    }

    if (Notification.permission === 'denied') {
      if (statusEl) statusEl.textContent = 'Blocked in browser settings';
      if (toggleBtn) {
        toggleBtn.textContent = 'Blocked';
        toggleBtn.disabled = true;
      }
      return;
    }

    const sub = await getExistingSubscription();
    if (sub) {
      if (statusEl) statusEl.textContent = 'Active on this device (notifications when closed)';
      if (toggleBtn) {
        toggleBtn.textContent = 'Turn off';
        toggleBtn.classList.remove('primary-button');
        toggleBtn.classList.add('secondary-button');
        toggleBtn.disabled = false;
      }
    } else {
      if (statusEl) statusEl.textContent = 'Never miss updates — notifications sent directly to your lock screen.';
      if (toggleBtn) {
        toggleBtn.textContent = 'Enable';
        toggleBtn.classList.remove('secondary-button');
        toggleBtn.classList.add('primary-button');
        toggleBtn.disabled = false;
      }
    }
  }

  // --- Push Prompt Banner for All Users ---
  function showPromptBanner() {
    const banner = document.getElementById('pushPromptBanner');
    if (!banner) return;
    banner.hidden = false;
    requestAnimationFrame(() => banner.classList.add('is-visible'));
  }

  function hidePromptBanner() {
    const banner = document.getElementById('pushPromptBanner');
    if (!banner) return;
    banner.classList.remove('is-visible');
    setTimeout(() => { banner.hidden = true; }, 360);
  }

  async function checkAndShowPushPrompt() {
    if (!isPushSupported()) return;
    if (Notification.permission === 'denied') return;

    const context = window.classboardContext;
    if (!context?.userId) return; // Only show to logged in users

    // Check if dismissed recently (within 4 days)
    const dismissedAt = localStorage.getItem('classboard-push-prompt-dismissed');
    if (dismissedAt) {
      const daysSinceDismiss = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < 4) return;
    }

    // Check if already subscribed
    const existingSub = await getExistingSubscription();
    if (existingSub) return; // Already enabled on this device

    // Show prompt after a short delay so the user lands on the page first
    setTimeout(() => {
      showPromptBanner();
    }, 2800);
  }

  // Bind to button clicks
  document.addEventListener('click', (e) => {
    // Profile toggle
    const toggleBtn = e.target.closest('#pushNotificationToggle');
    if (toggleBtn) {
      e.preventDefault();
      getExistingSubscription().then((sub) => {
        if (sub) {
          unsubscribeFromPush();
        } else {
          subscribeToPush();
        }
      });
      return;
    }

    // Prompt banner buttons
    if (e.target.closest('#pushPromptEnable')) {
      e.preventDefault();
      subscribeToPush();
      return;
    }

    if (e.target.closest('#pushPromptDismiss') || e.target.closest('#pushPromptClose')) {
      e.preventDefault();
      localStorage.setItem('classboard-push-prompt-dismissed', Date.now());
      hidePromptBanner();
      return;
    }
  });

  // Re-sync subscription with active class when user switches section or signs in
  window.addEventListener('classboard:context-ready', async () => {
    registerServiceWorker().then(() => {
      updatePushUI();
      checkAndShowPushPrompt();
    });

    const sub = await getExistingSubscription();
    const context = window.classboardContext;
    const client = window.classboardSupabase;
    if (sub && context?.userId && client) {
      const subJson = sub.toJSON();
      await client.from('push_subscriptions').upsert({
        user_id: context.userId,
        class_id: context.classId || null,
        endpoint: sub.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        user_agent: navigator.userAgent
      }, { onConflict: 'user_id,endpoint' });
    }
  });

  // Expose methods globally
  window.classboardPush = {
    isSupported: isPushSupported,
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush,
    updateUI: updatePushUI
  };

  // Auto-init on load
  if (isPushSupported()) {
    registerServiceWorker().then(updatePushUI);
  }
})();
