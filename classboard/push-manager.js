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
      if (typeof window.notifyApp === 'function') {
        window.notifyApp('Device push notifications enabled! You will get alerts even when the browser is closed.');
      }
      return true;
    } catch (err) {
      console.error('Failed to subscribe for push notifications:', err);
      alert(`Could not enable push notifications: ${err.message}`);
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
        window.notifyApp('Push notifications turned off on this device.');
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
      if (toggleBtn) toggleBtn.disabled = true;
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
      if (statusEl) statusEl.textContent = 'Active on this device (alerts when closed)';
      if (toggleBtn) {
        toggleBtn.textContent = 'Turn off';
        toggleBtn.classList.remove('primary-button');
        toggleBtn.classList.add('secondary-button');
        toggleBtn.disabled = false;
      }
    } else {
      if (statusEl) statusEl.textContent = 'Disabled on this device';
      if (toggleBtn) {
        toggleBtn.textContent = 'Enable alerts';
        toggleBtn.classList.remove('secondary-button');
        toggleBtn.classList.add('primary-button');
        toggleBtn.disabled = false;
      }
    }
  }

  // Bind to button clicks
  document.addEventListener('click', (e) => {
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
    }
  });

  // Re-sync subscription with active class when user switches section
  window.addEventListener('classboard:context-ready', async () => {
    registerServiceWorker().then(updatePushUI);
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

