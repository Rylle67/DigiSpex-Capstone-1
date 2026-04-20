// Auth Modal & Supabase Logic

const AUTH_SESSION_KEY = 'ds_auth_session';

// Auth Session
let _cachedSession = null;

// Session Helpers
function _getSession() {
  if (_cachedSession) return _cachedSession;
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function _setSession(user) {
  _cachedSession = user;
  try { localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user)); } catch { }
}
function _clearSession() {
  _cachedSession = null;
  try { localStorage.removeItem(AUTH_SESSION_KEY); } catch { }
}

// Public API
function getCurrentUser() { return _getSession(); }
function isLoggedIn() { return !!_getSession(); }

// Validators
function _validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }

async function _isEmailTaken(email) {
  if (!window.SBClient) return false;
  try {
    const emailLower = email.toLowerCase().trim();
    
    // 1. Preferred Method: Call an RPC function that bypasses RLS
    // To make this work, the user needs to create the 'check_email_exists' function in Supabase.
    const { data: rpcData, error: rpcError } = await window.SBClient.rpc('check_email_exists', { lookup_email: emailLower });
    
    if (!rpcError && rpcData !== null) {
      if (rpcData === true) return true;
      return false; // If explicitly false, email is definitely free.
    }

    // 2. Fallback: Check profiles table if RPC doesn't exist
    const { data: prof, error: e1 } = await window.SBClient
      .from('profiles')
      .select('email')
      .eq('email', emailLower)
      .maybeSingle();

    if (prof && prof.email) {
      console.log('[Store] Match found in profiles');
      return true;
    }
    
    if (e1 && e1.code !== 'PGRST116' && e1.code !== 'PGRST204') {
      console.warn('[Store] Profiles check error or RLS blocked:', e1.message);
    }
    
    return false;
  } catch (err) {
    console.error('[Store] Unexpected error in duplicate check:', err);
    return false;
  }
}

// UI Helpers
function _setError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}
function _clearErrors(prefix) {
  ['name', 'email', 'password', 'confirm', 'general']
    .forEach(f => _setError(prefix + '-err-' + f, ''));
}

const ICON_EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICON_EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;

function togglePasswordVis(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show ? ICON_EYE : ICON_EYE_OFF;
}
window.togglePasswordVis = togglePasswordVis;

// Modal Controls
function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    _clearErrors('login');
    modal.classList.add('open');
  } else {
    window.location.href = 'login.html';
  }
}
function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.remove('open');
}

function openRegisterModal() {
  const modal = document.getElementById('registerModal');
  if (modal) {
    _clearErrors('reg');
    modal.classList.add('open');
  } else {
    window.location.href = 'register.html';
  }
}
function closeRegisterModal() {
  const modal = document.getElementById('registerModal');
  if (modal) modal.classList.remove('open');
}

function switchToRegister() { closeLoginModal(); openRegisterModal(); }
function switchToLogin() { closeRegisterModal(); openLoginModal(); }

// UI Screen Switching (for login.html integrated screens)
function showAuthScreen(screenId) {
  const screens = document.querySelectorAll('.auth-screen');
  screens.forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
  
  // Clear any errors
  _setError('login-err-general', '');
  _setError('forgot-err-email', '');
  _setError('reset-err-otp', '');
  _setError('reset-err-password', '');
  _setError('reset-err-confirm', '');
}
window.showAuthScreen = showAuthScreen;

let currentOtp = null;
let currentRegData = null;

async function handleRegister(e) {
  e.preventDefault();
  _clearErrors('reg');

  const name = (document.getElementById('regName')?.value || '').trim();
  const email = (document.getElementById('regEmail')?.value || '').trim().toLowerCase();
  const password = (document.getElementById('regPassword')?.value || '').trim();
  const confirm = (document.getElementById('regConfirm')?.value || '').trim();

  let valid = true;
  if (!name) { _setError('reg-err-name', 'Name is required.'); valid = false; }
  
  if (!email) {
    _setError('reg-err-email', 'Email is required.');
    valid = false;
  } else if (!email.includes('@')) {
    _setError('reg-err-email', 'Email must contain "@" symbol.');
    valid = false;
  } else if (!_validEmail(email)) {
    _setError('reg-err-email', 'Enter a valid email address.');
    valid = false;
  } else {
    // If format is valid, check if taken
    const taken = await _isEmailTaken(email);
    if (taken) { 
      _setError('reg-err-email', 'This email is already registered.'); 
      valid = false; 
    }
  }

  if (!password) { _setError('reg-err-password', 'Password is required.'); valid = false; }
  else if (password.length < 6) { _setError('reg-err-password', 'Password must be at least 6 characters.'); valid = false; }
  if (!confirm) { _setError('reg-err-confirm', 'Please confirm your password.'); valid = false; }
  else if (password !== confirm) { _setError('reg-err-confirm', 'Passwords do not match.'); valid = false; }
  if (!valid) return;

  currentOtp = Math.floor(10000000 + Math.random() * 90000000).toString();
  currentRegData = { name, email, password };

  const submitBtn = document.getElementById('registerSubmitBtn');
  if (submitBtn) { submitBtn.textContent = "Sending Code..."; submitBtn.disabled = true; }

  try {
    if (typeof emailjs === 'undefined') throw new Error("EmailJS CDN is not loaded.");

    emailjs.init("5d6-cF4kjBNRzBRme");

    await emailjs.send("service_4jatqgj", "template_86bd2y9", {
      to_email: email,
      to_name: name,
      otp_code: currentOtp
    });

    const regUI = document.getElementById('registerScreen');
    const otpUI = document.getElementById('otpScreen');
    if (regUI && otpUI) {
      regUI.style.display = 'none';
      otpUI.style.display = 'block';
      const dEmail = document.getElementById('displayOtpEmail');
      if (dEmail) dEmail.textContent = email;
    } else {
      const code = prompt("An 8-digit code was sent to " + email + ". Enter it here:");
      if (code) {
        window._mockOtp = code;
        verifyOTP();
      } else {
        if (submitBtn) { submitBtn.textContent = "Create Account"; submitBtn.disabled = false; }
      }
    }
  } catch (err) {
    if (submitBtn) { submitBtn.textContent = "Create Account"; submitBtn.disabled = false; }
    alert("Failed to send OTP via EmailJS. Please ensure your Public Key is correct inside auth-modal.js. Error: " + (err.message || JSON.stringify(err)));
    console.error(err);
  }
}
window.handleRegister = handleRegister;

async function verifyOTP(e) {
  if (e) e.preventDefault();
  const inputs = document.querySelectorAll('.reg-otp');
  const token = Array.from(inputs).map(i => i.value).join('');
  _setError('reg-err-otp', '');

  if (token.length < 8) {
    _setError('reg-err-otp', 'Please enter the full 8-digit code.');
    return;
  }

  const code = token || (window._mockOtp || "");

  if (code !== currentOtp) {
    _setError('reg-err-otp', 'Invalid or incorrect code.');
    return;
  }

  const vBtn = document.getElementById('verifyOtpBtn');
  if (vBtn) { vBtn.textContent = "Verifying..."; vBtn.disabled = true; }

  try {
    // Generate a highly randomized simulated hash
    const getSimulatedHash = () => {
      const salt = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 11);
      const hash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 5);
      return `$2a$12$${salt.slice(0, 22)}${hash.slice(0, 31)}`;
    };
    const simulatedHash = getSimulatedHash();

    const { data, error } = await window.SBClient.auth.signUp({
      email: currentRegData.email,
      password: currentRegData.password,
      options: {
        data: {
          name: currentRegData.name,
          email: currentRegData.email, // Explicitly include email in metadata
          role: 'customer',
          password_hash: simulatedHash,
        }
      }
    });

    if (error) {
      if (vBtn) { vBtn.textContent = "Verify & Create Account"; vBtn.disabled = false; }
      alert("Registration Error: " + error.message);
      return;
    }

    const user = data?.user;
    if (!user) {
      alert("Registration successful! But Supabase 'Confirm Email' is ON. Please check your email for the confirmation link to login.");
      return;
    }

    const sessionUser = {
      id: user.id,
      name: currentRegData.name,
      email: currentRegData.email,
      role: 'customer'
    };
    _setSession(sessionUser);
    closeRegisterModal();

    _onAuthChange(sessionUser, 'registered');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  } catch (err) {
    if (vBtn) { vBtn.textContent = "Verify & Create Account"; vBtn.disabled = false; }
    alert("An unexpected error occurred during Supabase registration: " + err.message);
    console.error(err);
  }
}
window.verifyOTP = verifyOTP;

function cancelOTP(e) {
  if (e) e.preventDefault();
  const regUI = document.getElementById('registerScreen');
  const otpUI = document.getElementById('otpScreen');
  if (regUI && otpUI) {
    regUI.style.display = 'block';
    otpUI.style.display = 'none';
    const sBtn = document.getElementById('registerSubmitBtn');
    if (sBtn) { sBtn.textContent = "Create Account"; sBtn.disabled = false; }
  }
}
window.cancelOTP = cancelOTP;

// Reset Password Logic
async function handleForgotPassword(e) {
  e.preventDefault();
  const email = (document.getElementById('forgotEmail')?.value || '').trim().toLowerCase();
  _setError('forgot-err-email', '');
  
  if (!email || !_validEmail(email)) {
    _setError('forgot-err-email', 'Please enter a valid email address.');
    return;
  }

  const btn = document.getElementById('forgotSubmitBtn');
  if (btn) { btn.textContent = 'Sending Code...'; btn.disabled = true; }

  try {
    const { error } = await window.SBClient.auth.resetPasswordForEmail(email);
    if (error) throw error;

    showToast('Verification code sent!', 'success');
    
    // Switch to OTP screen
    const dEmail = document.getElementById('resetOtpDisplayEmail');
    if (dEmail) dEmail.textContent = email;
    showAuthScreen('otpResetScreen');
    
    // Focus first OTP box
    setTimeout(() => {
      const first = document.querySelector('.reset-otp[data-index="0"]');
      if (first) first.focus();
    }, 100);
  } catch (err) {
    _setError('forgot-err-email', 'Reset failed: ' + (err.message || 'Check your internet connection.'));
  } finally {
    if (btn) { btn.textContent = 'Send Code'; btn.disabled = false; }
  }
}
window.handleForgotPassword = handleForgotPassword;

async function handleVerifyResetOtp() {
  const email = document.getElementById('forgotEmail')?.value.trim().toLowerCase();
  const inputs = document.querySelectorAll('.reset-otp');
  const token = Array.from(inputs).map(i => i.value).join('');
  _setError('reset-err-otp', '');

  if (token.length < 8) {
    _setError('reset-err-otp', 'Please enter the full 8-digit code.');
    return;
  }

  const btn = document.getElementById('verifyResetOtpBtn');
  if (btn) { btn.textContent = 'Verifying...'; btn.disabled = true; }

  try {
    const { error } = await window.SBClient.auth.verifyOtp({
      email,
      token,
      type: 'recovery'
    });

    if (error) throw error;

    showToast('Code verified!', 'success');
    showAuthScreen('resetPasswordScreen');
  } catch (err) {
    _setError('reset-err-otp', 'Invalid or expired code. Please try again.');
  } finally {
    if (btn) { btn.textContent = 'Verify & Continue'; btn.disabled = false; }
  }
}
window.handleVerifyResetOtp = handleVerifyResetOtp;

async function handleUpdatePassword(e) {
  e.preventDefault();
  const password = (document.getElementById('resetPassword')?.value || '').trim();
  const confirm = (document.getElementById('resetConfirm')?.value || '').trim();
  _setError('reset-err-password', '');
  _setError('reset-err-confirm', '');

  if (!password || password.length < 6) {
    _setError('reset-err-password', 'Password must be at least 6 characters.');
    return;
  }
  if (password !== confirm) {
    _setError('reset-err-confirm', 'Passwords do not match.');
    return;
  }

  const btn = document.getElementById('resetSubmitBtn');
  if (btn) { btn.textContent = 'Updating...'; btn.disabled = true; }

  try {
    const { error } = await window.SBClient.auth.updateUser({ password });
    if (error) throw error;

    showToast('Password updated successfully! Redirecting to login...', 'success');
    
    // Wait briefly and logout then redirect to login screen
    setTimeout(async () => {
      await handleLogout();
      showAuthScreen('loginScreen');
      if (btn) { btn.textContent = 'Update Password'; btn.disabled = false; }
    }, 2000);
  } catch (err) {
    _setError('reset-err-password', 'Failed to update password: ' + err.message);
    if (btn) { btn.textContent = 'Update Password'; btn.disabled = false; }
  }
}
window.handleUpdatePassword = handleUpdatePassword;

// Login Logic
async function handleLogin(e) {
  e.preventDefault();
  _clearErrors('login');

  const email = (document.getElementById('loginEmail')?.value || '').trim().toLowerCase();
  const password = (document.getElementById('loginPassword')?.value || '').trim();

  let valid = true;
  if (!email) {
    _setError('login-err-email', 'Email is required.');
    valid = false;
  } else if (!email.includes('@')) {
    _setError('login-err-email', 'Email must contain "@" symbol.');
    valid = false;
  } else if (!_validEmail(email)) {
    _setError('login-err-email', 'Enter a valid email address.');
    valid = false;
  }
  if (!password) { _setError('login-err-password', 'Password is required.'); valid = false; }
  if (!valid) return;

  try {
    const { data, error } = await window.SBClient.auth.signInWithPassword({ email, password });

    if (error) {
      if (document.getElementById('login-err-general')) {
        _setError('login-err-general', error.message || 'Incorrect email or password.');
      } else {
        alert("Login Error: " + (error.message || 'Incorrect credentials.'));
      }
      return;
    }

    const user = data?.user;
    if (!user) {
      alert("Login failed: Unable to retrieve user info. Check your email verification.");
      return;
    }

    let role = 'customer';
    let name = user.user_metadata?.name || '';
    if (typeof getSupabaseProfile === 'function') {
      const profile = await getSupabaseProfile();
      if (!profile) {
        // User exists in Auth but record is missing from 'profiles' table
        await handleLogout();
        const genErr = document.getElementById('login-err-general');
        if (genErr) {
          _setError('login-err-general', 'Account record not found in database. Email will remain unavailable until an admin clears the account.');
        } else {
          alert("Account not found in database. Email will remain unavailable until an admin clears the account.");
        }
        return;
      }
      role = profile.role || role;
      name = profile.name || name;
    }

    const sessionUser = {
      id: user.id,
      name: name,
      email: user.email,
      role: role
    };
    _setSession(sessionUser);
    closeLoginModal();

    if (typeof SB !== 'undefined') await SB.pull();

    if (role === 'admin') {
      window.location.href = 'admin.html';
      return;
    }
    if (role === 'owner') {
      window.location.href = 'owner.html';
      return;
    }

    _onAuthChange(sessionUser, 'loggedin');

    if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    }
  } catch (err) {
    alert("An unexpected error occurred during login: " + err.message);
    console.error(err);
  }
}
window.handleLogin = handleLogin;

// Logout Logic
async function handleLogout() {
  await window.SBClient.auth.signOut();
  _clearSession();
  _onAuthChange(null, 'loggedout');
  
  // Force redirect on logout if on admin/owner pages
  const path = window.location.pathname;
  const page = path.split('/').pop();
  if (page === 'admin.html' || page === 'owner.html') {
    window.location.href = 'login.html';
  }
}
window.handleLogout = handleLogout;

// Auth Change Handler
function _onAuthChange(user, action) {
  _updateAuthNav(user);
  if (action === 'loggedin') {
    showToast('Welcome back, ' + user.name + '!', 'success');
    if (typeof NOTIFY !== 'undefined' && NOTIFY.initRealtimeSync) {
      NOTIFY.initRealtimeSync(() => {
        if (typeof renderStore === 'function') renderStore();
        if (typeof renderNav === 'function') renderNav();
        if (typeof renderCart === 'function') renderCart();
        if (typeof renderOrders === 'function') renderOrders();
      });
    }
  }
  if (action === 'loggedout') showToast('You have been logged out.', 'success');
}

// UI Sync
function _updateAuthNav(user) {
  const guestArea = document.getElementById('navAuthGuest');
  const userArea = document.getElementById('navAuthUser');
  const userLabel = document.getElementById('navUserLabel');
  const bellWrap = document.getElementById('notifBellWrap');
  const msgBtn = document.getElementById('navMsgBtn');
  const ordersTab = document.getElementById('navOrdersTab');
  const wishlistTab = document.getElementById('navWishlistTab');

  if (!guestArea || !userArea) return;

  if (user) {
    guestArea.style.display = 'none';
    userArea.style.display = 'flex';
    if (userLabel) userLabel.textContent = user.name;

    const existingPanelBtn = document.getElementById('navPanelBtn');
    if (existingPanelBtn) existingPanelBtn.remove();
    if (user.role === 'admin' || user.role === 'owner') {
      const panelBtn = document.createElement('a');
      panelBtn.id = 'navPanelBtn';
      panelBtn.className = 'nav-auth-btn nav-login-btn';
      panelBtn.style.cssText = 'background:rgba(124,58,237,0.18);color:#a78bfa;border-color:rgba(124,58,237,0.4);';
      panelBtn.href = user.role === 'admin' ? 'admin.html' : 'owner.html';
      panelBtn.textContent = user.role === 'admin' ? 'Admin Panel' : 'Owner Panel';
      userArea.insertBefore(panelBtn, userArea.firstChild);
    }
    if (bellWrap) bellWrap.style.display = '';
    if (msgBtn) msgBtn.style.display = 'flex';
    if (ordersTab) ordersTab.style.display = '';
    if (wishlistTab) wishlistTab.style.display = '';
    const cartBtnIn = document.getElementById('navCartBtn');
    if (cartBtnIn) cartBtnIn.style.display = '';
    if (typeof DB !== 'undefined') DB.init();
    if (typeof _renderMsgBadge === 'function') _renderMsgBadge();
    if (typeof _refreshBell === 'function') _refreshBell();
    if (typeof _reloadWishlist === 'function') _reloadWishlist();
    if (typeof _updateWishlistBadge === 'function') _updateWishlistBadge();
    if (typeof renderNav === 'function') renderNav();
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderOrders === 'function') renderOrders();
    const wlOpt = document.getElementById('sortWishlistOption');
    if (wlOpt) wlOpt.style.display = '';
  } else {
    guestArea.style.display = 'flex';
    userArea.style.display = 'none';
    if (bellWrap) bellWrap.style.display = 'none';
    if (msgBtn) msgBtn.style.display = 'none';
    if (ordersTab) ordersTab.style.display = 'none';
    if (wishlistTab) wishlistTab.style.display = 'none';
    const cartBtn = document.getElementById('navCartBtn');
    if (cartBtn) cartBtn.style.display = 'none';
    const wlOpt = document.getElementById('sortWishlistOption');
    if (wlOpt) wlOpt.style.display = 'none';
    if (typeof _reloadWishlist === 'function') _reloadWishlist();
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) cartCountEl.textContent = '0';
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderOrders === 'function') renderOrders();
    const activePage = document.querySelector('.page.active');
    if (activePage && (activePage.id === 'page-orders' || activePage.id === 'page-wishlist' || activePage.id === 'page-cart') && typeof showPage === 'function') {
      showPage('store');
    }
  }
}


// Full UI Re-render (called after Supabase data pull completes)
function _fullReRender() {
  if (typeof renderStore === 'function') renderStore();
  if (typeof renderNav === 'function') renderNav();
  if (typeof renderCart === 'function') renderCart();
  if (typeof renderFeaturedPackages === 'function') renderFeaturedPackages();
  if (typeof renderAllPackages === 'function') {
    const pkgPage = document.getElementById('page-packages');
    if (pkgPage && pkgPage.classList.contains('active')) renderAllPackages();
  }
  if (typeof renderLaptops === 'function') {
    const laptopPage = document.getElementById('page-laptops');
    if (laptopPage && laptopPage.classList.contains('active')) renderLaptops();
  }
  if (typeof renderBuilder === 'function') {
    const builderPage = document.getElementById('page-builder');
    if (builderPage && builderPage.classList.contains('active')) renderBuilder();
  }
  if (typeof renderOrders === 'function') {
    const ordersPage = document.getElementById('page-orders');
    if (ordersPage && ordersPage.classList.contains('active')) renderOrders();
  }
  if (typeof renderWishlistPage === 'function') {
    const wlPage = document.getElementById('page-wishlist');
    if (wlPage && wlPage.classList.contains('active')) renderWishlistPage();
  }
}

// Initialize Auth (Runs on load)
async function initAuth() {
  try {
    /* Check Supabase session */
    if (!window.SBClient) throw new Error("Supabase is not initialized.");
    const { data: { session }, error } = await window.SBClient.auth.getSession();
    if (error) throw error;

    if (session && session.user) {
      const user = session.user;

      let role = 'customer';
      let name = user.user_metadata?.name || '';
      if (typeof getSupabaseProfile === 'function') {
        const profile = await getSupabaseProfile();
        if (!profile) {
          // If profile is missing, clear session and force logout
          console.warn("[Auth] Profile missing from database. Clearing session.");
          await handleLogout();
          _updateAuthNav(null);
          return;
        }
        role = profile.role || role;
        name = profile.name || name;
      }

      const sessionUser = {
        id: user.id,
        name: name,
        email: user.email,
        role: role
      };
      _setSession(sessionUser);

      // Sync data (Background pull if cache exists)
      const hasCache = !!localStorage.getItem('ds_custom_products');
      if (typeof SB !== 'undefined') {
        if (hasCache) {
          SB.pull().then(_fullReRender).catch(e => { console.warn('[Auth] Background pull failed:', e); _fullReRender(); });
        } else {
          try { await SB.pull(); } catch (e) { console.warn('[Auth] Blocking pull failed:', e); }
        }
      }

      _updateAuthNav(sessionUser);
    } else {
      _clearSession();
      // Public data sync
      const hasCache = !!localStorage.getItem('ds_custom_products');
      if (typeof SB !== 'undefined') {
        if (hasCache) {
          SB.pull().then(_fullReRender).catch(e => { console.warn('[Auth] Background pull failed:', e); _fullReRender(); });
        } else {
          try { await SB.pull(); } catch (e) { console.warn('[Auth] Blocking pull failed:', e); }
        }
      }
      _updateAuthNav(null);
    }
  } catch (err) {
    console.error("Auth Session Check Failed:", err);
    _clearSession();
    if (typeof window !== "undefined" && window.location.href.indexOf('file://') === 0 && !window.location.href.includes('index.html')) {
      console.warn("Local file test detected. Ignored auth fetch failure.");
    }
  }

  if (typeof renderNav === 'function') renderNav();

  // Full re-render after data is available
  _fullReRender();

  // Redirect admin/owner away from store pages
  const user = getCurrentUser();
  if (user && (user.role === 'admin' || user.role === 'owner')) {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    const isStorePage = ['index.html', 'login.html', 'register.html'].includes(page) || path === '/';
    
    if (isStorePage) {
      if (user.role === 'admin') window.location.href = 'admin.html';
      else if (user.role === 'owner') window.location.href = 'owner.html';
    }
  }

  // Event Listeners
  ['loginModal', 'registerModal'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', ev => {
      if (ev.target === el) el.classList.remove('open');
    });
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    closeLoginModal();
    closeRegisterModal();
  });

  // OTP Input Handling (Reset)
  const resetInputs = document.querySelectorAll('.reset-otp');
  resetInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && idx < resetInputs.length - 1) {
        resetInputs[idx + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        resetInputs[idx - 1].focus();
      }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const data = e.clipboardData.getData('text').slice(0, 8);
      [...data].forEach((char, i) => {
        if (resetInputs[i]) resetInputs[i].value = char;
      });
      if (resetInputs[data.length - 1]) resetInputs[data.length - 1].focus();
    });
  });

  // OTP Input Handling (Registration)
  const regInputs = document.querySelectorAll('.reg-otp');
  regInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && idx < regInputs.length - 1) {
        regInputs[idx + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        regInputs[idx - 1].focus();
      }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const data = e.clipboardData.getData('text').slice(0, 8);
      [...data].forEach((char, i) => {
        if (regInputs[i]) regInputs[i].value = char;
      });
      if (regInputs[data.length - 1]) regInputs[data.length - 1].focus();
    });
  });
}

document.addEventListener('DOMContentLoaded', initAuth);