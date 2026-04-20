// Messaging System (Customer-to-Seller)

const CHAT = (() => {
  const KEY_PREFIX = 'ds_chat_';

  function _read(orderId) {
    try { return JSON.parse(localStorage.getItem(KEY_PREFIX + orderId) || '[]'); }
    catch { return []; }
  }
  function _write(orderId, arr) {
    try { localStorage.setItem(KEY_PREFIX + orderId, JSON.stringify(arr)); } catch { }
  }

  function _uid() {
    try {
      const u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      return u ? { id: u.id, name: u.name || u.email } : { id: 'guest', name: 'Customer' };
    } catch { return { id: 'guest', name: 'Customer' }; }
  }

  return {
    getMessages(orderId) { return _read(orderId); },

    sendMessage(orderId, text, sender, senderName) {
      if (!text || !text.trim()) return null;
      const msg = {
        id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        sender,
        senderName: senderName || (sender === 'admin' ? 'Digispex Support' : 'Customer'),
        text: text.trim(),
        read: false,
        ts: Date.now(),
      };
      const arr = _read(orderId);
      arr.push(msg);
      _write(orderId, arr);
      return msg;
    },

    sendCustomer(orderId, text) {
      const user = _uid();
      const msg = this.sendMessage(orderId, text, 'customer', user.name);
      if (msg && typeof NOTIFY !== 'undefined') {
        NOTIFY.pushCustomerMsg(orderId, text);
      }
      // Sync to Supabase
      if (typeof SB !== 'undefined' && typeof SB.pushMessage === 'function') {
        SB.pushMessage(orderId, 'customer', text)
          .catch(e => console.warn('[CHAT] Supabase sync failed:', e));
      }
      return msg;
    },

    sendAdmin(orderId, text, targetUserId) {
      const msg = this.sendMessage(orderId, text, 'admin', 'Digispex Support');
      if (msg && typeof NOTIFY !== 'undefined') {
        NOTIFY.pushSellerReply(orderId, text, targetUserId);
      }
      // Sync to Supabase
      if (typeof SB !== 'undefined' && typeof SB.pushMessage === 'function') {
        SB.pushMessage(orderId, 'admin', text)
          .catch(e => console.warn('[CHAT] Supabase sync failed:', e));
      }
      return msg;
    },

    markAdminRead(orderId) {
      const arr = _read(orderId).map(m => m.sender === 'admin' ? { ...m, read: true } : m);
      _write(orderId, arr);
    },

    markCustomerRead(orderId) {
      const arr = _read(orderId).map(m => m.sender === 'customer' ? { ...m, read: true } : m);
      _write(orderId, arr);
    },

    unreadAdminCount(orderId) {
      return _read(orderId).filter(m => m.sender === 'admin' && !m.read).length;
    },

    totalUnread() {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ds_chat_')) {
          try {
            count += JSON.parse(localStorage.getItem(k) || '[]')
              .filter(m => m.sender === 'customer' && !m.read).length;
          } catch { }
        }
      }
      return count;
    },

    getAllConversations() {
      const convs = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ds_chat_')) {
          try {
            const orderId = k.replace('ds_chat_', '');
            const arr = JSON.parse(localStorage.getItem(k) || '[]');
            if (arr.length) {
              const last = arr[arr.length - 1];
              const unread = arr.filter(m => m.sender === 'customer' && !m.read).length;
              convs.push({ orderId, lastMsg: last, unread, count: arr.length });
            }
          } catch { }
        }
      }
      return convs.sort((a, b) => (b.lastMsg?.ts || 0) - (a.lastMsg?.ts || 0));
    },
  };
})();

// Shared Utilities

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function _fmtDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _relMsgTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + 'm ago';
  if (h < 24) return h + 'h ago';
  return d + 'd ago';
}

// Customer Chat Modal Functionality

let _chatCurrentOrder = null;
let _chatPollTimer = null;
let _chatLastCount = 0;

function openChat(orderId) {
  _chatCurrentOrder = orderId;
  CHAT.markAdminRead(orderId);
  _chatLastCount = CHAT.getMessages(orderId).length;

  const modal = document.getElementById('chatModal');
  const title = document.getElementById('chatModalTitle');
  const tag = document.getElementById('chatOrderTag');
  if (title) title.textContent = 'Order ' + orderId;
  if (tag) tag.textContent = 'Order ' + orderId;
  if (modal) modal.classList.add('open');

  _renderChat();

  clearInterval(_chatPollTimer);
  _chatPollTimer = setInterval(() => {
    if (!_chatCurrentOrder) return;
    const msgs = CHAT.getMessages(_chatCurrentOrder);
    if (msgs.length !== _chatLastCount) {
      _chatLastCount = msgs.length;
      CHAT.markAdminRead(_chatCurrentOrder);
      _renderChat();
      _refreshBell();
    }
  }, 3000);

  setTimeout(() => document.getElementById('chatInput')?.focus(), 100);
}

function closeChat() {
  clearInterval(_chatPollTimer);
  _chatCurrentOrder = null;
  const modal = document.getElementById('chatModal');
  if (modal) modal.classList.remove('open');
  _refreshBell();
}

function _buildChatBubbles(messages, perspective) {
  if (!messages.length) return '';

  let html = '';
  let lastDateLabel = '';

  messages.forEach((m, idx) => {
    const dateLabel = _fmtDate(m.ts);
    if (dateLabel !== lastDateLabel) {
      html += `<div class="chat-date-sep"><span>${dateLabel}</span></div>`;
      lastDateLabel = dateLabel;
    }

    const isSelf = perspective === 'customer'
      ? m.sender === 'customer'
      : m.sender === 'admin';

    const isFirst = idx === 0 || messages[idx - 1].sender !== m.sender;
    const isLast = idx === messages.length - 1 || messages[idx + 1].sender !== m.sender;

    const side = isSelf ? 'chat-self' : 'chat-other';
    const radius = isSelf ? 'bubble-self' : 'bubble-other';
    const name = isSelf
      ? (perspective === 'admin' ? 'You' : 'You')
      : (m.senderName || (m.sender === 'admin' ? 'Digispex Support' : 'Customer'));

    const readMark = isSelf && isLast
      ? `<span class="chat-read-mark${m.read ? ' read' : ''}">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
         </span>`
      : '';

    html += `
      <div class="chat-row ${side}">
        ${!isSelf && isFirst
        ? `<div class="chat-avatar">${name[0].toUpperCase()}</div>`
        : `<div class="chat-avatar-spacer"></div>`}
        <div class="chat-msg-col">
          ${!isSelf && isFirst ? `<div class="chat-sender-name">${_escHtml(name)}</div>` : ''}
          <div class="chat-bubble ${radius}${isSelf ? '' : ''}" title="${_fmtTime(m.ts)}">
            <div class="chat-bubble-text">${_escHtml(m.text)}</div>
          </div>
          ${isLast ? `<div class="chat-meta">${_fmtTime(m.ts)}${readMark}</div>` : ''}
        </div>
      </div>`;
  });

  return html;
}

function _renderChat() {
  const messages = CHAT.getMessages(_chatCurrentOrder);
  const container = document.getElementById('chatMessages');
  if (!container) return;

  if (!messages.length) {
    container.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="chat-empty-title">No messages yet</div>
        <div class="chat-empty-sub">Send us a message and our team will get back to you</div>
      </div>`;
    return;
  }

  container.innerHTML = _buildChatBubbles(messages, 'customer');
  container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input ? input.value.trim() : '';
  if (!text || !_chatCurrentOrder) return;

  CHAT.sendCustomer(_chatCurrentOrder, text);
  input.value = '';
  input.style.height = 'auto';
  _chatLastCount++;
  _renderChat();
  _renderMsgBadge();
}

function chatInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

function chatInputAutoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 110) + 'px';
}

function _renderMsgBadge() {
  const badge = document.getElementById('msgBadge');
  if (!badge) return;
  try {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const prefix = user && user.id ? `ds_u_${user.id}_` : 'ds_guest_';
    const orders = JSON.parse(localStorage.getItem(prefix + 'orders') || '[]');
    let count = 0;
    orders.forEach(o => { count += CHAT.unreadAdminCount(o.id); });
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.style.display = count > 0 ? 'flex' : 'none';
  } catch { }
}

// Admin Chat Modal Functionality

let _adminChatOrder = null;
let _adminChatUserId = null;
let _adminChatOrderData = null;
let _adminChatPollTimer = null;
let _adminChatLastCount = 0;

function openAdminChat(orderId, userId) {
  _adminChatOrder = orderId;
  _adminChatUserId = userId || null;
  CHAT.markCustomerRead(orderId);
  _adminChatLastCount = CHAT.getMessages(orderId).length;

  _adminChatOrderData = _resolveOrder(orderId);
  if (_adminChatOrderData && !_adminChatUserId) {
    _adminChatUserId = _adminChatOrderData.userId || null;
  }

  const modal = document.getElementById('adminChatModal');
  const title = document.getElementById('adminChatTitle');
  const tag = document.getElementById('adminChatTag');
  if (title) title.textContent = 'Order ' + orderId + (_adminChatOrderData?.customer ? '  ·  ' + _adminChatOrderData.customer : '');
  if (tag) tag.textContent = 'Order ' + orderId;
  if (modal) modal.classList.add('open');

  _renderAdminOrderContext(_adminChatOrderData);
  _renderAdminChat();

  clearInterval(_adminChatPollTimer);
  _adminChatPollTimer = setInterval(() => {
    if (!_adminChatOrder) return;
    const msgs = CHAT.getMessages(_adminChatOrder);
    if (msgs.length !== _adminChatLastCount) {
      _adminChatLastCount = msgs.length;
      CHAT.markCustomerRead(_adminChatOrder);
      _renderAdminChat();
    }
  }, 3000);

  setTimeout(() => document.getElementById('adminChatInput')?.focus(), 100);
}

function _resolveOrder(orderId) {
  if (typeof _getAllOrders === 'function') {
    const found = _getAllOrders().find(o => o.id === orderId);
    if (found) return found;
  }
  
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.includes('orders')) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || '[]');
      if (Array.isArray(arr)) {
        const found = arr.find(o => o && o.id === orderId);
        if (found) return found;
      }
    } catch { }
  }
  return null;
}

function _renderAdminOrderContext(order) {
  const metaEl = document.getElementById('adminChatMeta');
  const itemsEl = document.getElementById('adminChatItems');
  const chipsEl = document.getElementById('adminChatChips');

  if (!order) {
    if (metaEl) metaEl.innerHTML = '<div class="acs-empty">Order details unavailable</div>';
    if (itemsEl) itemsEl.innerHTML = '';
    if (chipsEl) chipsEl.innerHTML = '';
    return;
  }

  const statusColor = {
    processing: '#f59e0b', shipped: '#3b82f6', delivered: '#22c55e',
    cancelled: '#ef4444', received: '#2563eb',
  }[order.status || 'processing'] || '#2563eb';

  if (metaEl) {
    metaEl.innerHTML = `
      <div class="acs-meta-row">
        <span class="acs-meta-label">Customer</span>
        <span class="acs-meta-val">${_escHtml(order.customer || '—')}</span>
      </div>
      <div class="acs-meta-row">
        <span class="acs-meta-label">Date</span>
        <span class="acs-meta-val">${_escHtml(order.date || '—')}</span>
      </div>
      <div class="acs-meta-row">
        <span class="acs-meta-label">Status</span>
        <span class="acs-status-chip" style="background:${statusColor}1a;color:${statusColor};border-color:${statusColor}44">
          ${order.status || 'processing'}
        </span>
      </div>
      <div class="acs-meta-row">
        <span class="acs-meta-label">Total</span>
        <span class="acs-meta-val acs-total">&#8369;${_escHtml(String(order.total || '0'))}</span>
      </div>
      ${order.payment ? `
      <div class="acs-meta-row">
        <span class="acs-meta-label">Payment</span>
        <span class="acs-meta-val">${_escHtml(order.payment)}</span>
      </div>` : ''}
      ${order.address ? `
      <div class="acs-meta-row acs-addr-row">
        <span class="acs-meta-label">Ship to</span>
        <span class="acs-meta-val acs-addr">${_escHtml(order.address)}</span>
      </div>` : ''}
      ${order.additionalInfo ? `
      <div class="acs-meta-row acs-addr-row">
        <span class="acs-meta-label">Add. Info</span>
        <span class="acs-meta-val acs-addr" style="color:var(--accent3)">${_escHtml(order.additionalInfo)}</span>
      </div>` : ''}`;
  }

  const items = order.items || [];
  if (itemsEl) {
    if (!items.length) {
      itemsEl.innerHTML = '<div class="acs-empty">No items recorded</div>';
    } else {
      itemsEl.innerHTML = items.map(item => `
        <div class="acs-item">
          <div class="acs-item-name">${_escHtml(item.name || '—')}</div>
          <div class="acs-item-meta">
            <span class="acs-item-qty">x${item.qty || 1}</span>
            ${item.price ? `<span class="acs-item-price">&#8369;${(item.price * (item.qty || 1) * 57).toLocaleString()}</span>` : ''}
          </div>
        </div>`).join('');
    }
  }

  if (chipsEl) {
    const status = order.status || 'processing';
    const custName = (order.customer || 'Customer').split(' ')[0];

    const genericChips = [
      { label: 'Greeting', text: `Hi ${custName}, thank you for your order. How can I help you today?` },
      { label: 'Processing', text: `Hi ${custName}, your order ${order.id} is currently being processed. We will update you as soon as it ships.` },
      { label: 'Shipping update', text: `Hi ${custName}, your order ${order.id} has been shipped and is on its way. You will receive it within 2–5 business days.` },
      { label: 'Delivered', text: `Hi ${custName}, your order ${order.id} has been delivered. We hope you are satisfied with your purchase. Please let us know if you have any questions.` },
      { label: 'Apology', text: `Hi ${custName}, we sincerely apologize for any inconvenience. We are looking into this and will resolve it as soon as possible.` },
    ];

    const productChips = items.slice(0, 4).map(item => ({
      label: item.name.length > 22 ? item.name.slice(0, 22) + '...' : item.name,
      text: `Hi ${custName}, regarding your ${item.name}${item.qty > 1 ? ' (x' + item.qty + ')' : ''}: `,
      isContinue: true,
    }));

    const allChips = [...productChips, ...genericChips];

    chipsEl.innerHTML = allChips.map((c, idx) => `
      <button class="acs-chip" onclick="adminChatQuickReply(${idx})" data-chip-idx="${idx}" title="${_escHtml(c.text)}">
        ${_escHtml(c.label)}
      </button>`).join('');

    chipsEl._chips = allChips;
  }
}

function closeAdminChat() {
  clearInterval(_adminChatPollTimer);
  _adminChatOrder = null;
  const modal = document.getElementById('adminChatModal');
  if (modal) modal.classList.remove('open');
  if (typeof renderAdminMessages === 'function') renderAdminMessages();
}

function _renderAdminChat() {
  const messages = CHAT.getMessages(_adminChatOrder);
  const container = document.getElementById('adminChatMessages');
  if (!container) return;

  if (!messages.length) {
    container.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="chat-empty-title">No messages yet</div>
        <div class="chat-empty-sub">No messages from customer for this order</div>
      </div>`;
    return;
  }

  container.innerHTML = _buildChatBubbles(messages, 'admin');
  container.scrollTop = container.scrollHeight;
}

function sendAdminReply() {
  const input = document.getElementById('adminChatInput');
  const text = input ? input.value.trim() : '';
  if (!text || !_adminChatOrder) return;

  CHAT.sendAdmin(_adminChatOrder, text, _adminChatUserId);
  input.value = '';
  input.style.height = 'auto';
  _adminChatLastCount++;
  _renderAdminChat();
}

function adminChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAdminReply();
  }
}

function adminChatQuickReply(idx) {
  const chipsEl = document.getElementById('adminChatChips');
  const chips = chipsEl?._chips;
  if (!chips || !chips[idx]) return;

  const chip = chips[idx];
  const input = document.getElementById('adminChatInput');
  if (!input) return;

  input.value = chip.text;
  chatInputAutoResize(input);
  input.focus();

  const len = input.value.length;
  input.setSelectionRange(len, len);
}

// Admin Message List Logic

function renderAdminMessages() {
  const convs = CHAT.getAllConversations();
  const el = document.getElementById('adminMsgList');
  if (!el) return;

  if (!convs.length) {
    el.innerHTML = `
      <div class="chat-empty-state" style="padding:3rem 1rem">
        <div class="chat-empty-icon-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="chat-empty-title">No customer messages</div>
        <div class="chat-empty-sub">Customer messages will appear here</div>
      </div>`;
    return;
  }

  el.innerHTML = convs.map(c => {
    const lastSender = c.lastMsg?.sender === 'admin' ? 'You' : (c.lastMsg?.senderName || 'Customer');
    const preview = _escHtml((c.lastMsg?.text || '').slice(0, 55)) + ((c.lastMsg?.text || '').length > 55 ? '...' : '');
    return `
      <div class="admin-msg-item${c.unread ? ' has-unread' : ''}" onclick="openAdminChat('${c.orderId}')">
        <div class="admin-msg-avatar">${c.orderId.slice(-2).toUpperCase()}</div>
        <div class="admin-msg-content">
          <div class="admin-msg-top">
            <span class="admin-msg-order">Order ${c.orderId}</span>
            <span class="admin-msg-time">${_relMsgTime(c.lastMsg?.ts)}</span>
          </div>
          <div class="admin-msg-preview">
            <span class="admin-msg-sender-prefix">${lastSender}:</span>
            ${preview}
          </div>
        </div>
        ${c.unread ? `<div class="admin-msg-unread-badge">${c.unread}</div>` : ''}
      </div>`;
  }).join('');
}