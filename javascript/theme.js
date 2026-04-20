// Unified Dark/Light Theme System

const THEME_KEY  = 'ds_theme';
const DARK_ATTR  = 'dark';
const LIGHT_ATTR = 'light';

// Apply Theme Utility
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  // Update ALL theme toggle buttons on the page
  document.querySelectorAll('.theme-toggle-btn, .admin-theme-btn').forEach(btn => {
    if (theme === LIGHT_ATTR) {
      // Moon icon → switch to dark
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      btn.title = 'Switch to Dark Mode';
      btn.setAttribute('aria-label', 'Switch to Dark Mode');
    } else {
      // Sun icon → switch to light
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
      btn.title = 'Switch to Light Mode';
      btn.setAttribute('aria-label', 'Switch to Light Mode');
    }
  });
}

// Toggle Theme Action
function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) || DARK_ATTR;
  const next    = current === DARK_ATTR ? LIGHT_ATTR : DARK_ATTR;
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);

  // Broadcast to other tabs on the same origin
  if (_themeBroadcast) {
    try { _themeBroadcast.postMessage({ theme: next }); } catch(e) {}
  }
}

// Cross-tab Sync (Storage Event)
window.addEventListener('storage', function(e) {
  if (e.key === THEME_KEY && e.newValue) {
    applyTheme(e.newValue);
  }
});

// Cross-tab Sync (BroadcastChannel)
let _themeBroadcast = null;
try {
  _themeBroadcast = new BroadcastChannel('ds_theme_channel');
  _themeBroadcast.onmessage = function(e) {
    if (e.data && e.data.theme) {
      localStorage.setItem(THEME_KEY, e.data.theme);
      applyTheme(e.data.theme);
    }
  };
} catch(err) {
  // BroadcastChannel not supported — storage event is the fallback
}

// Legacy Key Migration
(function migrateOldKey() {
  const oldAdmin = localStorage.getItem('ds_admin_theme');
  if (oldAdmin && !localStorage.getItem(THEME_KEY)) {
    localStorage.setItem(THEME_KEY, oldAdmin);
  }
  // Clean up legacy key
  localStorage.removeItem('ds_admin_theme');
})();

// Initialize Theme
(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || DARK_ATTR;
  applyTheme(saved);
})();

/* ── Alias for admin/owner pages backward compat ───────── */
function toggleAdminTheme() { toggleTheme(); }
