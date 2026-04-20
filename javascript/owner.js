/* Owner Dashboard Logic - Sales & Performance Analytics */
'use strict';

/* Auth & Session Setup */
const SESSION = (() => {
  try { return JSON.parse(localStorage.getItem('ds_auth_session')); }
  catch { return null; }
})();

if (document.getElementById('ownerSub')) {
  document.getElementById('ownerSub').textContent =
    'Welcome, ' + (SESSION?.name || 'Owner') + ' — read-only view';
}



/* Local Formatters & Helpers */
const PHP_RATE = 57;

function peso(php) {
  if (php === null || php === undefined) return '₱0';
  const val = typeof php === 'string' ? parseFloat(php.replace(/,/g, '')) : (php || 0);
  return '₱' + Math.round(val).toLocaleString('en-PH');
}

function num(v) {
  return Number(v || 0).toLocaleString();
}

function showToast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast ' + (type || 'info') + ' show';
  setTimeout(() => el.classList.remove('show'), 2400);
}

/* Data Fetching & Sync */
async function _getAllOrders() {
  /* Pull from Supabase first if available to ensure data parity */
  try {
    if (typeof SB !== 'undefined' && SB.pullAllOrders) {
      const remote = await SB.pullAllOrders();
      if (remote && remote.length) {
        localStorage.setItem('ds_owner_synced_orders', JSON.stringify(remote));
      }
    }
  } catch (err) {
    console.warn('[Owner] Background sync failed, using cached data:', err);
  }

  const all = [], seen = new Set();

  // 1. Sync from owner-specific cache
  try {
    const synced = JSON.parse(localStorage.getItem('ds_owner_synced_orders') || '[]');
    synced.forEach(o => { if (o && o.id && !seen.has(o.id)) { seen.add(o.id); all.push(o); } });
  } catch (e) { }

  // 2. Aggregate all other local orders
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.includes('orders') || key === 'ds_owner_synced_orders') continue;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(arr)) continue;
      arr.forEach(o => {
        if (o && o.id && !seen.has(o.id)) { seen.add(o.id); all.push(o); }
      });
    } catch { }
  }

  all.sort((a, b) => {
    const da = new Date(a.date || a.createdAt || 0);
    const db = new Date(b.date || b.createdAt || 0);
    return db - da;
  });
  return all;
}

/* Dashboard Global State */
let _rangeDays = 7;
let _allOrders = [];
let _chartRev = null;
let _chartSt = null;

/* Statistics Filter */
function setRange(days, btn) {
  document.querySelectorAll('.range-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _rangeDays = days;
  renderDashboard();
}

function _inRange(order) {
  if (_rangeDays === 0) return true;
  const d = new Date(order.date || order.createdAt || 0);
  return (Date.now() - d.getTime()) <= _rangeDays * 86400000;
}

/* Core Dashboard Rendering */
async function renderDashboard() {
  _allOrders = await _getAllOrders();

  const orders = _allOrders.filter(_inRange);
  const active = orders.filter(o => o.status !== 'cancelled');

  /* 1. KPI Calculation */
  const completedOrders = orders.filter(o => o.status === 'delivered' || o.status === 'received');
  const revenue = completedOrders.reduce((s, o) => {
    const val = typeof o.total === 'string' ? parseFloat(o.total.replace(/,/g, '')) : (o.total || 0);
    return s + val;
  }, 0);

  const nProducts = (() => {
    try {
      const custom = JSON.parse(localStorage.getItem('ds_custom_products') || '[]');
      const base = typeof PRODUCTS !== 'undefined' ? PRODUCTS.length : 0;
      return base + custom.length;
    } catch { return 0; }
  })();

  let nCustomers = 0;
  try {
    if (typeof SB !== 'undefined' && SB.getCustomerCount) {
      nCustomers = await SB.getCustomerCount();
    } else {
      const users = JSON.parse(localStorage.getItem('ds_auth_users') || '[]');
      nCustomers = users.filter(u => (u.role || 'customer') === 'customer').length;
    }
  } catch (e) { console.error('Customer count fetch failed:', e); }

  const kpis = [
    { lbl: 'Total Revenue', val: peso(revenue), sub: 'delivered & received', c: '#22c55e' },
    { lbl: 'Customers', val: num(nCustomers), sub: 'registered accounts', c: '#8b5cf6' },
    { lbl: 'Products', val: num(nProducts), sub: 'in catalogue', c: '#3b82f6' },
  ];
  const kpiEl = document.getElementById('kpiRow');
  if (kpiEl) {
    kpiEl.innerHTML = kpis.map(k =>
      `<div class="kpi-card" style="--kc:${k.c}">
        <div class="kpi-lbl">${k.lbl}</div>
        <div class="kpi-val">${k.val}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>`
    ).join('');
  }

  /* 2. Status Breakdown */
  const statusDefs = [
    { key: 'pending', lbl: 'Pending', c: '#f59e0b' },
    { key: 'confirmed', lbl: 'Confirmed', c: '#22c55e' },
    { key: 'processing', lbl: 'Processing', c: '#3b82f6' },
    { key: 'shipped', lbl: 'Shipped', c: '#8b5cf6' },
    { key: 'out_delivery', lbl: 'Out Delivery', c: '#2563eb' },
    { key: 'delivered', lbl: 'Delivered', c: '#22c55e' },
    { key: 'received', lbl: 'Received', c: '#7c3aed' },
    { key: 'cancelled', lbl: 'Cancelled', c: '#ef4444' },
  ];
  const statusCount = {};
  orders.forEach(o => {
    const k = o.status || 'pending';
    statusCount[k] = (statusCount[k] || 0) + 1;
  });

  const statusEl = document.getElementById('statusRow');
  if (statusEl) {
    statusEl.innerHTML = statusDefs.map(s =>
      `<div class="status-chip">
        <div class="status-dot" style="background:${s.c}"></div>
        <div class="status-info">
          <div class="s-name">${s.lbl}</div>
          <div class="s-count">${num(statusCount[s.key] || 0)}</div>
        </div>
      </div>`
    ).join('');
  }

  /* 3. Render Revenue Charts */
  _renderCharts(orders, statusDefs, statusCount);

  /* 4. Top Performing Products */
  const tally = {};
  completedOrders.forEach(o => {
    (o.items || []).forEach(item => {
      const n = item.name || item.productId || '?';
      if (!tally[n]) tally[n] = { name: n, qty: 0, rev: 0 };
      tally[n].qty += item.qty || 1;
      const pPrice = typeof item.price === 'string' ? parseFloat(item.price.replace(/,/g, '')) : (item.price || 0);
      const itemRev = pPrice < 1000 ? pPrice * 57 * (item.qty || 1) : pPrice * (item.qty || 1);
      tally[n].rev += itemRev;
    });
  });

  const topProds = Object.values(tally).sort((a, b) => b.rev - a.rev).slice(0, 10);
  const rankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  const topEl = document.getElementById('topTbody');
  if (topEl) {
    topEl.innerHTML = topProds.length
      ? topProds.map((p, i) =>
        `<tr>
          <td><span class="rank ${rankClass(i)}">${i + 1}</span></td>
          <td>${p.name}</td>
          <td>${num(p.qty)}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#22c55e">${peso(p.rev)}</td>
        </tr>`
      ).join('')
      : `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:2rem">No sales data yet</td></tr>`;
  }

  /* 5. Orders Summary Table */
  const countEl = document.getElementById('ordersCount');
  if (countEl) countEl.textContent = num(_allOrders.length) + ' total orders';
  _renderOrderRows(orders);

  /* 6. Refresh daily sales snapshot in Supabase (background) */
  if (typeof SB !== 'undefined' && typeof SB.refreshDailySales === 'function') {
    SB.refreshDailySales().catch(e => console.warn('[Owner] Daily sales refresh failed:', e));
  }
}

function _renderCharts(orders, statusDefs, statusCount) {
  if (typeof Chart === 'undefined') return;

  // Revenue chart mapping
  const dayMap = {};
  orders.filter(o => o.status === 'delivered' || o.status === 'received').forEach(o => {
    const d = (o.date || o.createdAt || '').slice(0, 10);
    if (!d) return;
    const val = typeof o.total === 'string' ? parseFloat(o.total.replace(/,/g, '')) : (o.total || 0);
    dayMap[d] = (dayMap[d] || 0) + val;
  });
  const sortedDays = Object.keys(dayMap).sort();
  const revLabels = sortedDays;
  const revData = sortedDays.map(d => Math.round(dayMap[d]));

  const ctxRev = document.getElementById('chartRevenue')?.getContext('2d');
  if (ctxRev) {
    if (_chartRev) {
      _chartRev.data.labels = revLabels;
      _chartRev.data.datasets[0].data = revData;
      _chartRev.update();
    } else {
      _chartRev = new Chart(ctxRev, {
        type: 'line',
        data: {
          labels: revLabels,
          datasets: [{
            label: 'Revenue (₱)', data: revData,
            borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.12)',
            tension: 0.35, fill: true, pointRadius: 3, pointBackgroundColor: '#7c3aed',
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.04)' } },
            y: { ticks: { color: '#6b7280', font: { size: 10 }, callback: v => '₱' + v.toLocaleString() }, grid: { color: 'rgba(255,255,255,.04)' } },
          }
        }
      });
    }
  }

  // Status doughnut mapping
  const stLabels = statusDefs.map(s => s.lbl);
  const stData = statusDefs.map(s => statusCount[s.key] || 0);
  const stColors = statusDefs.map(s => s.c);

  const ctxSt = document.getElementById('chartStatus')?.getContext('2d');
  if (ctxSt) {
    if (_chartSt) {
      _chartSt.data.datasets[0].data = stData;
      _chartSt.update();
    } else {
      _chartSt = new Chart(ctxSt, {
        type: 'doughnut',
        data: {
          labels: stLabels,
          datasets: [{ data: stData, backgroundColor: stColors.map(c => c + '99'), borderColor: stColors, borderWidth: 1.5 }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 11 }, boxWidth: 12, padding: 10 } }
          }
        }
      });
    }
  }
}

function _renderOrderRows(orders) {
  const tbody = document.getElementById('ordersTbody');
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No orders found.</td></tr>';
    return;
  }
  const payStatusColors = { pending: '#f59e0b', paid: '#22c55e', failed: '#ef4444', refunded: '#3b82f6' };
  tbody.innerHTML = orders.slice(0, 150).map(o => {
    const items = o.items || [];
    const preview = items.slice(0, 2).map(i => (i.name || i.productId || '?') + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ')
      + (items.length > 2 ? ' +' + (items.length - 2) + ' more' : '');
    const customer = o.customer || o.userId || '—';
    const email = o.email || '';
    const st = o.status || 'pending';
    const paySt = o.payment_status || 'pending';
    const payColor = payStatusColors[paySt] || '#f59e0b';
    const date = (o.date || o.createdAt || '').slice(0, 16).replace('T', ' ');
    return `<tr style="cursor:pointer" onclick="openOrderDetails('${o.id}')">
      <td><div class="oid">${o.id || '—'}</div></td>
      <td>
        <div class="ocust">${customer}</div>
        <div style="font-size:0.68rem;color:var(--text3);margin-top:2px">${email}</div>
      </td>
      <td style="max-width:200px;font-size:.78rem;color:var(--text2)">${preview || '—'}</td>
      <td class="ototal">${peso(o.total)}</td>
      <td><span style="font-size:0.7rem;padding:2px 7px;border-radius:4px;background:${payColor}22;color:${payColor};font-weight:600">${paySt}</span></td>
      <td><span class="ostatus ${st}">${st}</span></td>
      <td class="odate">${date || '—'}</td>
    </tr>`;
  }).join('');
}

function filterOrders() {
  const searchEl = document.getElementById('ordersSearch');
  const sortEl = document.getElementById('ordersSort');
  if (!searchEl || !sortEl) return;

  const q = searchEl.value.toLowerCase();
  const s = sortEl.value;

  let filtered = _allOrders.filter(_inRange);

  if (q) {
    filtered = filtered.filter(o =>
      (o.id || '').toLowerCase().includes(q) ||
      (o.customer || '').toLowerCase().includes(q) ||
      (o.userId || '').toLowerCase().includes(q)
    );
  }

  if (s === 'dateDesc') filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  if (s === 'dateAsc') filtered.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  if (s === 'totalDesc') filtered.sort((a, b) => (b.total || 0) - (a.total || 0));
  if (s === 'totalAsc') filtered.sort((a, b) => (a.total || 0) - (b.total || 0));
  if (s === 'statusPending') {
    filtered.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
  }

  _renderOrderRows(filtered);
}

function openOrderDetails(id) {
  const o = _allOrders.find(x => x.id === id);
  if (!o) return;

  document.getElementById('mdlOrderId').textContent = o.id;
  document.getElementById('mdlCust').textContent = o.customer || o.userId || '—';
  document.getElementById('mdlEmail').textContent = o.email || '—';
  document.getElementById('mdlDate').textContent = (o.date || o.createdAt || '').slice(0, 16).replace('T', ' ');

  const stEl = document.getElementById('mdlStatus');
  stEl.textContent = o.status || 'pending';
  stEl.className = 'ostatus ' + (o.status || 'pending');

  document.getElementById('mdlTotal').textContent = peso(o.total);

  // Payment & Delivery details
  const paymentMethodLabels = { cod: 'Cash on Delivery', gcash: 'GCash', paymaya: 'Maya', bank_transfer: 'Bank Transfer' };
  const paymentStatusColors = { pending: '#f59e0b', paid: '#22c55e', failed: '#ef4444', refunded: '#3b82f6' };
  const payMethod = o.payment_method || o.payment || 'cod';
  const paySt = o.payment_status || 'pending';
  const payColor = paymentStatusColors[paySt] || '#f59e0b';

  const extraInfoHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;padding:0.75rem;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--border)">
      <div>
        <div style="font-size:0.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Payment</div>
        <div style="font-size:0.82rem;font-weight:600">${paymentMethodLabels[payMethod] || payMethod}</div>
        <div style="font-size:0.72rem;padding:2px 7px;border-radius:4px;display:inline-block;margin-top:3px;background:${payColor}22;color:${payColor};font-weight:600">${paySt.toUpperCase()}</div>
      </div>
      <div>
        <div style="font-size:0.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Delivery</div>
        <div style="font-size:0.82rem;font-weight:600">${o.delivery_method || 'Standard'}</div>
        ${o.tracking_number ? `<div style="font-size:0.72rem;color:var(--accent);margin-top:2px">📦 ${o.tracking_number}</div>` : ''}
      </div>
      ${o.phone || o.customer_phone ? `
      <div>
        <div style="font-size:0.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Phone</div>
        <div style="font-size:0.82rem">${o.phone || o.customer_phone || '—'}</div>
      </div>` : ''}
      ${o.address || o.delivery_address ? `
      <div style="grid-column:span 2">
        <div style="font-size:0.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Delivery Address</div>
        <div style="font-size:0.82rem">${o.address || o.delivery_address || '—'}</div>
      </div>` : ''}
      ${o.notes || o.additionalInfo ? `
      <div style="grid-column:span 2">
        <div style="font-size:0.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Customer Note</div>
        <div style="font-size:0.82rem;color:var(--accent)">${o.notes || o.additionalInfo}</div>
      </div>` : ''}
    </div>`;

  const items = o.items || [];
  const itemsHtml = items.length ? items.map(i => `
    <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--border)">
      <div>
         <div style="font-weight:600;font-size:0.85rem">${i.name || i.productId || '?'}</div>
         <div style="color:var(--text3);font-size:0.75rem">Qty: ${i.qty || 1} × ${peso((i.price || 0) * 57)}</div>
      </div>
      <div style="font-weight:700;font-family:'JetBrains Mono',monospace">${peso((i.price || 0) * (i.qty || 1) * 57)}</div>
    </div>
  `).join('') : '<div style="color:var(--text3);font-size:0.8rem">No items found</div>';

  const mdlItemsEl = document.getElementById('mdlItems');
  if (mdlItemsEl) mdlItemsEl.innerHTML = itemsHtml;

  const mdlExtraEl = document.getElementById('mdlExtra');
  if (mdlExtraEl) mdlExtraEl.innerHTML = extraInfoHtml;

  document.getElementById('orderDetailModal').classList.add('open');
}

/* Global Expose (for HTML onclicks) */
window.toggleNotifDropdown = typeof toggleNotifDropdown !== 'undefined' ? toggleNotifDropdown : () => { };
window.toggleAdminTheme = typeof toggleAdminTheme !== 'undefined' ? toggleAdminTheme : () => { };
window.setRange = setRange;
window.filterOrders = filterOrders;
window.openOrderDetails = openOrderDetails;


/* Initialize on Load */
document.addEventListener('DOMContentLoaded', renderDashboard);