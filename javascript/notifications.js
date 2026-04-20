// Unified Notification System (Handles order updates and alerts)

const NOTIFY = (() => {
  const KEY_PREFIX = 'ds_notif_';

  function _read(uid) {
    try { return JSON.parse(localStorage.getItem(KEY_PREFIX + uid) || '[]'); }
    catch { return []; }
  }
  function _write(uid, arr) {
    try { localStorage.setItem(KEY_PREFIX + uid, JSON.stringify(arr)); } catch {}
  }

  function _uid() {
    try {
      const u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      if (!u) return 'guest';
      // System-wide notifications for admins/owners use their role as the ID
      if (u.role === 'admin' || u.role === 'owner') return u.role;
      return u.id;
    } catch { return 'guest'; }
  }

  const ORDER_STATUS = {
    received:     { label: 'Order Received',    color: '#2563eb', bg: 'rgba(37,99,235,0.12)',  msg: 'Your order has been received and is under review.' },
    confirmed:    { label: 'Order Confirmed',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  msg: 'Your order has been confirmed by our team.' },
    processing:   { label: 'Order Processing',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', msg: 'Your order is being prepared for shipment.' },
    shipped:      { label: 'Order Shipped',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', msg: 'Your order has been dispatched and is on its way.' },
    out_delivery: { label: 'Out for Delivery',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', msg: 'Your order is out for delivery today.' },
    delivered:    { label: 'Order Delivered',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  msg: 'Your order has been delivered successfully.' },
    cancelled:    { label: 'Order Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  msg: 'Your order has been cancelled.' },
  };

  function _mkNotif(type, orderId, label, msg, color, bg, extra) {
    return {
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type, orderId, label, msg, color, bg,
      read: false, ts: Date.now(),
      ...(extra || {}),
    };
  }

  async function _push(uid, notif) {
    const arr = _read(uid);
    const isDup = arr.some(n =>
      n.type === notif.type &&
      n.orderId === notif.orderId &&
      n.label === notif.label &&
      Math.abs(n.ts - notif.ts) < 2000
    );
    if (isDup) return notif;
    arr.unshift(notif);
    if (arr.length > 60) arr.splice(60);
    _write(uid, arr);
    _refreshBell();

    // Sync to Supabase if uid is a UUID (not 'guest' or 'admin' or 'owner')
    if (uid && uid !== 'guest' && uid !== 'admin' && uid !== 'owner' && typeof SB !== 'undefined' && SB.pushNotification) {
      SB.pushNotification(uid, notif).catch(e => console.warn('[NOTIFY] Supabase sync failed:', e));
    }

    // Trigger visual alert if it's for the current user (either Admin or specific customer)
    const currentUid = _uid();
    if (uid === currentUid) {
      // Don't show toast if they are already in the chat for this specific order
      const isViewingChat = (typeof _chatCurrentOrder !== 'undefined' && _chatCurrentOrder === notif.orderId) ||
                            (typeof _adminChatOrder !== 'undefined' && _adminChatOrder === notif.orderId);
      
      if (!isViewingChat && typeof showToast === 'function') {
        const toastMsg = (notif.type === 'seller_reply' || notif.type === 'customer_msg')
          ? `💬 New message: ${notif.msg}`
          : `🔔 ${notif.label}: ${notif.msg}`;
        showToast(toastMsg);
      }
    }

    return notif;
  }

  return {
    pushOrderStatus(orderId, statusKey, userId) {
      const uid  = userId || _uid();
      // Admin/Owner should not receive status notifications for orders
      if (uid === 'admin' || uid === 'owner') return null;
      const meta = ORDER_STATUS[statusKey] || {
        label: statusKey.charAt(0).toUpperCase() + statusKey.slice(1),
        color: '#2563eb', bg: 'rgba(37,99,235,0.1)',
        msg: 'Order status updated to ' + statusKey + '.',
      };
      return _push(uid, _mkNotif('order_status', orderId, meta.label, meta.msg, meta.color, meta.bg, { statusKey }));
    },

    pushSellerReply(orderId, preview, userId) {
      const uid = userId || _uid();
      const msg = preview
        ? '"' + preview.slice(0, 80) + (preview.length > 80 ? '...' : '') + '"'
        : 'Digispex Support replied to your message.';
      return _push(uid, _mkNotif('seller_reply', orderId, 'New Reply from Support', msg, '#7c3aed', 'rgba(124,58,237,0.12)'));
    },

    pushCustomerMsg(orderId, preview) {
      const msg = preview ? '"' + preview.slice(0, 80) + '"' : 'A customer sent a new message.';
      return _push('admin', _mkNotif('customer_msg', orderId, 'New Customer Message', msg, '#f59e0b', 'rgba(245,158,11,0.12)'));
    },

    pushOrderMessage(orderId, preview) {
      const msg = preview ? '"' + preview.slice(0, 80) + '"' : 'A customer included a message with their order.';
      return _push('admin', _mkNotif('order_message', orderId, 'New Order Message', msg, '#3b82f6', 'rgba(59,130,246,0.12)'));
    },

    onOrderPlaced(order, userId) {
      // General order notifications go to the customer only
      return this.pushOrderStatus(order.id, 'received', userId);
    },

    getAll(userId)          { return _read(userId || _uid()); },
    unreadCount(userId)     { return _read(userId || _uid()).filter(n => !n.read).length; },

    markRead(notifId, userId) {
      const uid = userId || _uid();
      const arr = _read(uid);
      const n   = arr.find(x => x.id === notifId);
      if (n) { n.read = true; _write(uid, arr); }
      _refreshBell();
    },

    markAllRead(userId) {
      const uid = userId || _uid();
      _write(uid, _read(uid).map(n => ({ ...n, read: true })));
      _refreshBell();
    },

    _getStatusMeta(statusKey) {
      return ORDER_STATUS[statusKey] || null;
    },

    _receiveFromCloud(notif) {
      // Map cloud fields back to local fields if necessary
      const localNotif = {
        ...notif,
        id: notif.id || ('n_' + Date.now()),
        ts: notif.created_at ? new Date(notif.created_at).getTime() : Date.now(),
        orderId: notif.order_id || notif.ref_id || notif.orderId,
        label: notif.label || notif.title || 'Notification',
        msg: notif.msg || notif.body || '',
        statusKey: notif.statusKey || notif.status_key || null
      };
      
      // Reconstruct UI styling if missing
      if (!localNotif.color || !localNotif.bg) {
        if (localNotif.statusKey && ORDER_STATUS[localNotif.statusKey]) {
          const meta = ORDER_STATUS[localNotif.statusKey];
          localNotif.color = meta.color;
          localNotif.bg = meta.bg;
        } else if (localNotif.type === 'seller_reply') {
          localNotif.color = '#7c3aed'; localNotif.bg = 'rgba(124,58,237,0.12)';
        } else if (localNotif.type === 'customer_msg') {
          localNotif.color = '#f59e0b'; localNotif.bg = 'rgba(245,158,11,0.12)';
        }
      }

      // Use the internal _push to handle storage and visual alerts
      _push(_uid(), localNotif);
    },

    initRealtimeSync(onReviews) {
      const uid = _uid();
      if (!uid || uid === 'guest') return;
      if (typeof SB !== 'undefined' && SB.initRealtime) {
        console.log('[NOTIFY] Starting cloud listener for:', uid);
        SB.initRealtime(uid, 
          (notif) => this._receiveFromCloud(notif),
          (rev)   => { if (typeof onReviews === 'function') onReviews(rev); }
        );
      }
    },

    clearAll(userId) {
      const uid = userId || _uid();
      _write(uid, []);
      if (typeof SB !== 'undefined' && SB.deleteUserNotifications) {
        SB.deleteUserNotifications(uid);
      }
      _refreshBell();
    },

    remove(notifId, userId) {
      const uid = userId || _uid();
      const arr = _read(uid).filter(n => n.id !== notifId);
      _write(uid, arr);
      if (typeof SB !== 'undefined' && SB.deleteNotification) {
        SB.deleteNotification(notifId);
      }
      _renderNotifDropdown();
      _refreshBell();
    },
  };
})();

// Bell UI Functions

function _refreshBell() {
  const count = NOTIFY.unreadCount();
  const badge = document.getElementById('notifBadge');
  if (badge) {
    badge.textContent   = count > 9 ? '9+' : String(count);
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function toggleNotifDropdown(e) {
  if (e) e.stopPropagation();
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  document.querySelectorAll('.notif-dropdown').forEach(d => d.classList.remove('open'));
  if (!isOpen) { _renderNotifDropdown(); dd.classList.add('open'); }
}

function _relTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'Just now';
  if (m < 60) return m + 'm ago';
  if (h < 24) return h + 'h ago';
  if (d < 7)  return d + 'd ago';
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const _NOTIF_SVG = {
  order_status: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></svg>',
  seller_reply: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  customer_msg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  order_message: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/><path d="M7 12h10"/></svg>',
};

function _renderNotifDropdown() {
  const list    = NOTIFY.getAll();
  const content = document.getElementById('notifList');
  if (!content) return;

  if (!list.length) {
    content.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <div class="notif-empty-text">No notifications yet</div>
        <div class="notif-empty-sub">Order updates and messages will appear here</div>
      </div>`;
    return;
  }

  content.innerHTML = list.map(n => {
    const icon = _NOTIF_SVG[n.type] || _NOTIF_SVG.order_status;
    const unreadDot = !n.read ? `<span class="notif-unread-dot"></span>` : '';

    // What happens when the customer clicks this notification
    const action = n.type === 'seller_reply'
      ? `NOTIFY.markRead('${n.id}'); _renderNotifDropdown(); _refreshBell(); document.querySelectorAll('.notif-dropdown').forEach(d=>d.classList.remove('open')); openChat('${n.orderId}');`
      : n.type === 'order_status'
      ? `NOTIFY.markRead('${n.id}'); _renderNotifDropdown(); _refreshBell(); document.querySelectorAll('.notif-dropdown').forEach(d=>d.classList.remove('open')); if(typeof showPage==='function') showPage('orders');`
      : (n.type === 'customer_msg' || n.type === 'order_message')
      ? `NOTIFY.markRead('${n.id}'); _renderNotifDropdown(); _refreshBell(); document.querySelectorAll('.notif-dropdown').forEach(d=>d.classList.remove('open')); if(typeof openAdminChat==='function') openAdminChat('${n.orderId}'); else openChat('${n.orderId}');`
      : `NOTIFY.markRead('${n.id}'); _renderNotifDropdown(); _refreshBell();`;

    return `
      <div class="notif-item${n.read ? '' : ' notif-unread'}" onclick="${action}">
        <div class="notif-item-icon-wrap" style="background:${n.bg};color:${n.color}">
          ${icon}
        </div>
        <div class="notif-item-body">
          <div class="notif-item-header-row">
            <span class="notif-item-title">${n.label}</span>
            ${unreadDot}
          </div>
          <div class="notif-item-order">Order ${n.orderId}</div>
          <div class="notif-item-text">${n.msg}</div>
          <div class="notif-item-time">${_relTime(n.ts)}</div>
        </div>
        <button class="notif-item-delete" onclick="event.stopPropagation(); NOTIFY.remove('${n.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>`;
  }).join('');
}

function markAllNotifRead() { NOTIFY.markAllRead(); _renderNotifDropdown(); }
function clearAllNotif()    { NOTIFY.clearAll();    _renderNotifDropdown(); }

document.addEventListener('click', e => {
  const wrap = document.getElementById('notifBellWrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('notifDropdown');
    if (dd) dd.classList.remove('open');
  }
});

document.addEventListener('DOMContentLoaded', () => { _refreshBell(); });

// Real-time synchronization across tabs
window.addEventListener('storage', (e) => {
  if (!e.key) return;
  const uid = _uid();
  if (e.key === `ds_notif_${uid}`) {
    _refreshBell();
    const dd = document.getElementById('notifDropdown');
    if (dd && dd.classList.contains('open')) {
      _renderNotifDropdown();
    }
  }
});
