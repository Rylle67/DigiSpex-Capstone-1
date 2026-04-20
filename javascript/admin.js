// Admin Panel Logic (Inventory, Products, Orders, Audit)
'use strict';

const STOCK_KEY = 'ds_stock';
const CUSTOM_KEY = 'ds_custom_products';
const IMG_KEY = 'ds_custom_images';
const DESC_KEY = 'ds_custom_descs';
const AUDIT_KEY = 'ds_audit_log';
const ORDER_KEY = 'ds_audit_log';

let selected = new Set();
let filtered = [];
let editingProductId = null; // Track if we are editing an existing product

function rowActEdit(btn) {
  const { id } = _rowData(btn);
  openEditProduct(id);
}

function openEditProduct(id) {
  const products = allProducts();
  const p = products.find(prod => prod.id === id);
  if (!p) return;

  editingProductId = id;

  // switch to Add Product tab
  switchTab('addProduct');

  // Populate form
  document.getElementById('apName').value = p.name || '';
  document.getElementById('apCat').value = p.cat || '';
  document.getElementById('apPricePHP').value = Math.round(p.price * 57);
  document.getElementById('apSpecs').value = p.specs || '';

  // Description
  const descs = getCustomDescs();
  document.getElementById('apDesc').value = descs[id] || '';

  // Bench score
  const benchIn = document.getElementById('apBenchScore');
  if (benchIn) {
    benchIn.value = p.benchScore !== undefined ? p.benchScore : '';
    updateBenchPreview(p.benchScore !== undefined ? p.benchScore : '');
  }

  // Compatibility fields
  if (document.getElementById('apSocket')) document.getElementById('apSocket').value = p.socket || '';
  if (document.getElementById('apMemType')) document.getElementById('apMemType').value = p.memType || '';
  if (document.getElementById('apWattage')) document.getElementById('apWattage').value = p.wattage || '';
  if (document.getElementById('apGpuLength')) document.getElementById('apGpuLength').value = p.length_mm || '';
  if (document.getElementById('apMaxGpuLength')) document.getElementById('apMaxGpuLength').value = p.max_gpu_length || '';
  if (document.getElementById('apFormFactor')) document.getElementById('apFormFactor').value = p.form_factor || '';
  if (document.getElementById('apSupportedFf')) document.getElementById('apSupportedFf').value = p.supported_form_factors || '';

  // Image handling
  newImgBase64 = null;
  const zone = document.getElementById('imgUploadZone');
  zone.classList.remove('has-img');
  zone.innerHTML = `<div class="upload-icon">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  </div><div class="upload-label">Click or drag image here</div><div class="upload-hint">JPG, PNG, WebP — max 4 MB</div>`;
  document.getElementById('apImageUrl').value = '';
  document.getElementById('apImageUrlPreview').style.display = 'none';

  const images = getCustomImages();
  if (images[id]) {
    if (images[id].startsWith('data:image')) {
      newImgBase64 = images[id];
      zone.classList.add('has-img');
      zone.innerHTML = `<div class="upload-img-wrap"><img src="${newImgBase64}" alt="preview" style="max-width:100%;max-height:140px;object-fit:contain;border-radius:6px;display:block;margin:0 auto"></div><button class="btn-remove-img" onclick="removeNewImage(event)">Remove image</button>`;
    } else {
      document.getElementById('apImageUrl').value = images[id];
      // Trigger preview manually
      const preview = document.getElementById('apImageUrlPreview');
      const img = document.getElementById('apImageUrlImg');
      img.src = images[id];
      img.onload = () => preview.style.display = '';
      img.onerror = () => preview.style.display = 'none';
    }
  }

  // Status & Sale & Qty
  const st = getStatus(id);
  const qty = (typeof INVENTORY !== 'undefined') ? INVENTORY.getQty(id) : 0;
  const statusIn = document.getElementById('apStatus');
  if (statusIn) {
    statusIn.value = st;
    _handleStatusChange(st, true); // true to skip qty automation on load
  }
  if (document.getElementById('apQty')) {
    document.getElementById('apQty').value = (qty !== null) ? qty : 50;
  }

  const saleCfg = readLS('ds_sale_config') || {};
  const cfg = saleCfg[id] || {};
  if (document.getElementById('apDiscount')) document.getElementById('apDiscount').value = (cfg.discount ? Math.round(cfg.discount * 100) : 15);
  if (document.getElementById('apSaleStart')) document.getElementById('apSaleStart').value = cfg.startDate || '';
  if (document.getElementById('apSaleEnd')) document.getElementById('apSaleEnd').value = cfg.endDate || '';

  // UI updates
  const panelTitle = document.querySelector('#panelAddProduct .panel-title');
  if (panelTitle) panelTitle.textContent = 'Edit Product: ' + p.name;

  const submitBtn = document.querySelector('#panelAddProduct .btn-add-product');
  if (submitBtn) submitBtn.textContent = 'Update Product Details';

  // Toggle fields based on restored category
  _toggleCompatFields(p.cat);
  updatePreview();

  // Show cancel button if it exists
  const cancelBtn = document.getElementById('apCancelEdit');
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

function cancelEdit() {
  editingProductId = null;
  resetAddForm();
  switchTab('inventory');
  const cancelBtn = document.getElementById('apCancelEdit');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

/* Categories that require a benchmark score */
const BENCH_CATEGORIES = ['CPU', 'GPU', 'RAM', 'Storage'];

function updateBenchPreview(val) {
  const fill = document.getElementById('benchScoreFill');
  const label = document.getElementById('benchScoreLabel');
  if (!fill || !label) return;
  const score = Math.min(100, Math.max(0, parseInt(val) || 0));
  const pct = val === '' || val === null ? 0 : score;
  fill.style.width = pct + '%';

  let color = '#6b7280';
  let text = 'Not set';
  if (pct >= 95) { color = '#ef4444'; text = 'Flagship'; }
  else if (pct >= 80) { color = '#f97316'; text = 'High-End'; }
  else if (pct >= 55) { color = '#2563eb'; text = 'Mid-Range'; }
  else if (pct >= 30) { color = '#22c55e'; text = 'Budget'; }
  else if (pct >= 1) { color = '#94a3b8'; text = 'Entry-Level'; }

  if (val === '' || val === undefined) {
    fill.style.background = '#6b7280';
    label.textContent = 'Not set';
    label.style.color = 'var(--text3)';
    return;
  }
  fill.style.background = color;
  label.textContent = score + ' — ' + text;
  label.style.color = color;
}

// Toggle fields based on category
function _toggleCompatFields(cat) {
  const benchGroup = document.getElementById('apBenchGroup');
  const benchIn = document.getElementById('apBenchScore');
  const needsBench = ['CPU', 'GPU', 'RAM', 'Storage'].includes(cat);

  // Keep the Benchmark Group (Calculate Button + Result) visible for hardware, 
  // but the manual input is now type="hidden" in HTML.
  if (benchGroup) benchGroup.style.display = needsBench ? '' : 'none';
  if (!needsBench && benchIn) {
    benchIn.value = '';
    updateBenchPreview('');
  }

  // Visibility toggling for dynamic spec groups based on category
  const needsSock = ['CPU', 'Motherboard'].includes(cat);
  const needsMem = ['CPU', 'Motherboard', 'RAM'].includes(cat);
  const isGPU = cat === 'GPU';
  const isMB = cat === 'Motherboard';
  const isCase = cat === 'Case';

  // Compatibility groups (Socket, Memory, Power, Physical)
  const compatGrp = document.getElementById('apCompatGroup');
  const powerGrp = document.getElementById('apPowerGroup');
  const physicalGrp = document.getElementById('apPhysicalGroup');

  if (compatGrp) compatGrp.style.display = (needsSock || needsMem) ? '' : 'none';
  if (powerGrp) powerGrp.style.display = (cat === 'PSU' || cat === 'GPU' || cat === 'CPU') ? '' : 'none';
  if (physicalGrp) physicalGrp.style.display = (isGPU || isCase || isMB) ? '' : 'none';

  // Specific sub-fields
  const sockGrp = document.getElementById('apSocketGroup');
  const memGrp = document.getElementById('apMemGroup');
  const gpuLenGrp = document.getElementById('apGpuLengthGroup');
  const maxGpuGrp = document.getElementById('apMaxGpuLengthGroup');
  const mbFfGrp = document.getElementById('apMbFfGroup');
  const caseFfGrp = document.getElementById('apSupportedFfGroup');

  if (sockGrp) sockGrp.style.display = needsSock ? '' : 'none';
  if (memGrp) memGrp.style.display = needsMem ? '' : 'none';
  if (gpuLenGrp) gpuLenGrp.style.display = isGPU ? '' : 'none';
  if (maxGpuGrp) maxGpuGrp.style.display = isCase ? '' : 'none';
  if (mbFfGrp) mbFfGrp.style.display = isMB ? '' : 'none';
  if (caseFfGrp) caseFfGrp.style.display = isCase ? '' : 'none';

  if (!needsSock) { document.getElementById('apSocket').value = ''; }
  if (!needsMem) { document.getElementById('apMemType').value = ''; }
  if (cat !== 'PSU') { document.getElementById('apWattage').value = ''; }
  if (!isGPU) { document.getElementById('apGpuLength').value = ''; }
  if (!isCase) { document.getElementById('apMaxGpuLength').value = ''; }
  if (!isMB) { document.getElementById('apFormFactor').value = ''; }
  if (!isCase) { document.getElementById('apSupportedFf').value = ''; }

  updatePreview();
}

function _handleStatusChange(status, isLoad = false) {
  const saleFields = document.getElementById('apSaleFields');
  const saleDates = document.getElementById('apSaleDates');
  if (saleFields) saleFields.style.display = (status === 'sale') ? '' : 'none';
  if (saleDates) saleDates.style.display = (status === 'sale') ? 'flex' : 'none';

  // Automated Quantity Setting
  if (!isLoad && typeof INVENTORY !== 'undefined') {
    const qtyIn = document.getElementById('apQty');
    if (qtyIn) {
      if (status === 'lowstock') {
        qtyIn.value = INVENTORY.getLowStockThreshold();
      } else if (status === 'outofstock') {
        qtyIn.value = 0;
      } else if (status === 'normal' || status === 'sale') {
        if (parseInt(qtyIn.value) <= INVENTORY.getLowStockThreshold()) {
          qtyIn.value = INVENTORY.getLowStockThreshold() * 2;
        }
      }
    }
  }
}

function readLS(k) { try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } }
function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }

function getStock() { return readLS(STOCK_KEY) || {}; }
function getStatus(id) {
  const stock = getStock();
  const st = stock[id] || 'normal';

  // Sale status check
  if (st === 'sale') {
    const saleCfg = readLS('ds_sale_config') || {};
    const cfg = saleCfg[id];
    if (cfg) {
      const today = new Date().setHours(0, 0, 0, 0);
      // Check for future start
      if (cfg.startDate && new Date(cfg.startDate) > today) {
        return 'normal';
      }
      // Check for expiration
      if (cfg.endDate && new Date(cfg.endDate) < today) {
        return 'normal';
      }
    }
    return 'sale';
  }

  if (typeof INVENTORY !== 'undefined') {
    const qty = INVENTORY.getQty(id);
    if (qty === 0) return 'outofstock';
    if (qty !== null && qty <= INVENTORY.getLowStockThreshold()) return 'lowstock';
  }

  return st;
}


function setStockVal(id, status, productName) {
  const s = getStock();
  const old = s[id] || 'normal';
  if (status === 'normal') delete s[id]; else s[id] = status;
  writeLS(STOCK_KEY, s);
  pushAudit({ type: 'status_change', productId: id, productName: productName || id, oldStatus: old, newStatus: status });
  if (typeof SB !== 'undefined') {
    SB.updateProduct(id, { stock_status: status }).catch(e => console.warn('[Admin] Sync status failed:', e));
  }
}



function pushAudit(entry) {
  const log = readLS(AUDIT_KEY) || [];
  log.unshift({ ...entry, ts: Date.now() });
  if (log.length > 30) log.splice(30);
  writeLS(AUDIT_KEY, log);
  if (typeof SB !== 'undefined') {
    SB.pushAuditEntry(entry).catch(e => console.warn('[Admin] Sync audit failed:', e));
  }
}

function getCustomProducts() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch(e) { return []; }
}
function getCustomImages() {
  try { return JSON.parse(localStorage.getItem(IMG_KEY) || '{}'); } catch(e) { return {}; }
}
function getCustomDescs() {
  try { return JSON.parse(localStorage.getItem(DESC_KEY) || '{}'); } catch(e) { return {}; }
}
function allProducts() {
  const hidden = readLS('ds_hidden_products') || [];
  const base = hidden.length ? PRODUCTS.filter(p => !hidden.includes(p.id)) : PRODUCTS;
  return [...base, ...getCustomProducts()];
}

function switchTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  ['panelInventory', 'panelAddProduct', 'panelOrders', 'panelAudit', 'panelPackages'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const panelEl = document.getElementById('panel' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panelEl) panelEl.style.display = '';
  if (tab === 'orders') renderOrders();
  if (tab === 'audit') renderAudit();
  if (tab === 'packages') adminRenderPackages();
}

// Inventory Management
function renderTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const cat = document.getElementById('catFilter').value;
  const status = document.getElementById('statusFilter').value;

  filtered = allProducts().filter(p => {
    const mQ = !q || p.name.toLowerCase().includes(q) || p.specs.toLowerCase().includes(q);
    const mC = cat === 'All' || p.cat === cat;
    const mS = status === 'All' || getStatus(p.id) === status;
    return mQ && mC && mS;
  });

  const imgs = getCustomImages();
  const tbody = document.getElementById('tableBody');

  if (!filtered.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No products match your filters.</td></tr>';
    renderStats(); return;
  }

  tbody.innerHTML = filtered.map(p => {
    const st = getStatus(p.id);
    const php = Math.round(p.price * 57);
    const salePHP = Math.round(php * 0.85);
    const isChecked = selected.has(p.id);

    const imgSrc = imgs[p.id];

    const priceHtml = st === 'sale'
      ? `<span class="price-orig">&#8369;${php.toLocaleString()}</span><span class="price-sale">&#8369;${salePHP.toLocaleString()}</span>`
      : `&#8369;${php.toLocaleString()}`;

    const statusLabels = { normal: 'In Stock', sale: 'On Sale', lowstock: 'Low Stock', outofstock: 'Out of Stock' };
    const dotLabel = '&#9679; ' + (statusLabels[st] || 'In Stock');

    const thumb = imgSrc
      ? `<img src="${imgSrc}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;display:block;">`
      : `<div style="width:36px;height:36px;border-radius:6px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:0.48rem;font-weight:700;text-transform:uppercase;color:var(--accent);letter-spacing:0.5px;text-align:center;line-height:1.2">${p.cat.slice(0, 3).toUpperCase()}</div>`;

    const socketBadge = (p.socket && (p.cat === 'CPU' || p.cat === 'Motherboard'))
      ? `<span style="font-size:0.56rem;padding:1px 5px;border-radius:3px;background:rgba(255,107,53,0.1);color:#ff6b35;font-family:'JetBrains Mono',monospace;letter-spacing:0.5px;vertical-align:middle;margin-left:5px;border:1px solid rgba(255,107,53,0.2)">${p.socket}</span>`
      : '';
    const memBadge = (p.memType && (p.cat === 'CPU' || p.cat === 'Motherboard' || p.cat === 'RAM'))
      ? `<span style="font-size:0.56rem;padding:1px 5px;border-radius:3px;background:rgba(37,99,235,0.1);color:var(--accent);font-family:'JetBrains Mono',monospace;letter-spacing:0.5px;vertical-align:middle;margin-left:5px;border:1px solid rgba(37,99,235,0.2)">${p.memType}</span>`
      : '';

    return `<tr id="row-${p.id}" class="${isChecked ? 'selected' : ''}">
      <td><input type="checkbox" data-id="${p.id}" ${isChecked ? 'checked' : ''} onchange="toggleRow('${p.id}',this)"></td>
      <td>
        <div style="display:flex;align-items:center;gap:0.65rem">
          ${thumb}
          <div>
            <div class="prod-name">${p.name}${socketBadge}${memBadge}</div>
            <div class="prod-specs">${p.specs.length > 65 ? p.specs.slice(0, 65) + '…' : p.specs}</div>
            ${(function () {
        const bs = p.benchScore || 0;
        if (!bs) return '';
        let bc = '#94a3b8', bl = 'Entry';
        if (bs >= 95) { bc = '#ef4444'; bl = 'Flagship'; }
        else if (bs >= 80) { bc = '#f97316'; bl = 'High-End'; }
        else if (bs >= 55) { bc = '#2563eb'; bl = 'Mid-Range'; }
        else if (bs >= 30) { bc = '#22c55e'; bl = 'Budget'; }
        return `<div style="display:flex;align-items:center;gap:0.35rem;margin-top:3px">
                <div style="width:50px;height:3px;border-radius:2px;background:var(--border);overflow:hidden">
                  <div style="height:100%;width:${bs}%;background:${bc}"></div>
                </div>
                <span style="font-size:0.62rem;font-weight:700;color:${bc}">Performance Score: ${bs}/100 · ${bl}</span>
              </div>`;
      })()}
          </div>
        </div>
      </td>
      <td><span class="cat-tag">${p.cat}</span></td>
      <td class="price-col">${priceHtml}</td>
      <td>
        <div class="inv-qty-cell" id="qty-cell-${p.id}">
          ${_renderQtyCell(p.id)}
        </div>
      </td>
      <td><span class="status-badge ${st}"><span class="status-dot"></span>${dotLabel}</span></td>
      <td>
        <div class="row-actions" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}">
          <button class="btn-action btn-edit" onclick="rowActEdit(this)">Edit</button>
          <button class="btn-action btn-del" onclick="rowActDel(this)" title="Delete product">Del</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  renderStats();
  updateSelCount();
}

function _rowData(btn) {
  const div = btn.closest('.row-actions');
  return { id: div.dataset.id, name: div.dataset.name };
}
function rowActDel(btn) {
  const { id } = _rowData(btn);
  deleteCustomProduct(id);
}

function renderStats() {
  const stock = getStock();
  const products = allProducts();
  const total = products.length;
  const productIds = new Set(products.map(p => p.id));

  let saleCount = 0;
  let lowCount = 0;
  let oosCount = 0;

  const lowThreshold = (typeof INVENTORY !== 'undefined') ? INVENTORY.getLowStockThreshold() : 10;

  products.forEach(p => {
    const st = getStatus(p.id);
    if (st === 'sale') saleCount++;
    else if (st === 'lowstock') lowCount++;
    else if (st === 'outofstock') oosCount++;
  });

  document.getElementById('statTotal').innerHTML = `${total}<span style="font-size:0.85rem;margin-left:6px;opacity:0.75;font-weight:600">Products</span>`;
  document.getElementById('statNormal').innerHTML = `${total - saleCount - lowCount - oosCount}<span style="font-size:0.85rem;margin-left:6px;opacity:0.75;font-weight:600">Items</span>`;
  document.getElementById('statSale').innerHTML = `${saleCount}<span style="font-size:0.85rem;margin-left:6px;opacity:0.75;font-weight:600">Sale</span>`;
  document.getElementById('statLow').innerHTML = `${lowCount}<span style="font-size:0.85rem;margin-left:6px;opacity:0.75;font-weight:600">Low</span>`;
  document.getElementById('statOOS').innerHTML = `${oosCount}<span style="font-size:0.85rem;margin-left:6px;opacity:0.75;font-weight:600">OOS</span>`;
  _updateRestockBanner();

  // Clean up stock object if it contains removed products
  const stockKeys = Object.keys(stock);
  const deadKeys = stockKeys.filter(id => !productIds.has(id));
  if (deadKeys.length > 0) {
    const cleaned = { ...stock };
    deadKeys.forEach(id => delete cleaned[id]);
    writeLS(STOCK_KEY, cleaned);
  }

  const hiddenCount = (readLS('ds_hidden_products') || []).length;
  const restoreBtn = document.getElementById('restoreHiddenBtn');
  if (restoreBtn) restoreBtn.style.display = hiddenCount > 0 ? '' : 'none';
  if (restoreBtn && hiddenCount > 0) restoreBtn.textContent = 'Restore Hidden (' + hiddenCount + ')';
}

function _renderQtyCell(productId) {
  if (typeof INVENTORY === 'undefined') return '<span style="color:var(--text3);font-size:0.7rem">N/A</span>';
  const qty = INVENTORY.getQty(productId);
  if (qty === null) return '<span style="color:var(--text3);font-size:0.7rem">N/A</span>';
  const cls = qty === 0 ? 'qty-oos' : qty <= INVENTORY.getLowStockThreshold() ? 'qty-low' : 'qty-ok';
  return `<span class="inv-qty-badge ${cls}" id="qbadge-${productId}">${qty}</span>`;
}

function _updateRestockBanner() {
  const banner = document.getElementById('invRestockBanner');
  if (!banner || typeof INVENTORY === 'undefined') return;
  const products = typeof allProducts === 'function' ? allProducts() : [];
  const oosCount = products.filter(p => INVENTORY.getQty(p.id) === 0).length;
  if (oosCount > 0) {
    banner.classList.add('visible');
    const countEl = banner.querySelector('.inv-restock-count');
    if (countEl) countEl.textContent = oosCount;
  } else {
    banner.classList.remove('visible');
  }
}

function setStatus(productId, status, productName) {
  setStockVal(productId, status, productName);
  if (typeof INVENTORY !== 'undefined') {
    if (status === 'outofstock') {
      INVENTORY.setQty(productId, 0);
    } else if (status === 'normal') {
      const current = INVENTORY.getQty(productId);
      if (current === 0) INVENTORY.setQty(productId, INVENTORY.getLowStockThreshold() * 2 + 1);
    }
  }
  renderTable();
  const labels = { normal: 'marked In Stock', sale: 'marked On Sale', lowstock: 'marked Low Stock', outofstock: 'marked Out of Stock' };
  showToast(' ' + (productName || productId) + ' ' + (labels[status] || status));
}



function toggleRow(id, cb) {
  cb.checked ? selected.add(id) : selected.delete(id);
  const row = document.getElementById('row-' + id);
  if (row) row.classList.toggle('selected', cb.checked);
  updateSelCount();
}

function toggleAll(masterCb) {
  filtered.forEach(p => {
    masterCb.checked ? selected.add(p.id) : selected.delete(p.id);
    const row = document.getElementById('row-' + p.id);
    const cb = row && row.querySelector('input[type=checkbox]');
    if (cb) cb.checked = masterCb.checked;
    if (row) row.classList.toggle('selected', masterCb.checked);
  });
  updateSelCount();
}

function updateSelCount() {
  document.getElementById('selCount').textContent =
    selected.size ? selected.size + ' selected' : '0 selected';
}

// Full system purge for a product
function _purgeProductFromSystem(productId) {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;

    // Cleanup Cart
    if (k.endsWith('_cart')) {
      try {
        let cart = JSON.parse(localStorage.getItem(k) || '[]');
        const newCart = cart.filter(item => item.productId !== productId);
        if (newCart.length !== cart.length) localStorage.setItem(k, JSON.stringify(newCart));
      } catch (e) { }
    }

    // Cleanup Wishlist
    if (k.includes('wishlist')) {
      try {
        let wl = JSON.parse(localStorage.getItem(k) || '[]');
        const newWl = wl.filter(id => id !== productId);
        if (newWl.length !== wl.length) localStorage.setItem(k, JSON.stringify(newWl));
      } catch (e) { }
    }

    // Cleanup Build
    if (k.endsWith('_build')) {
      try {
        let build = JSON.parse(localStorage.getItem(k) || '{}');
        let buildChanged = false;
        Object.keys(build).forEach(slot => {
          if (build[slot] === productId) { delete build[slot]; buildChanged = true; }
        });
        if (buildChanged) localStorage.setItem(k, JSON.stringify(build));
      } catch (e) { }
    }

    // Update Orders (Mark items as deleted)
    if (k.endsWith('_orders')) {
      try {
        let orders = JSON.parse(localStorage.getItem(k) || '[]');
        let ordChanged = false;
        orders.forEach(order => {
          if (order.items) {
            order.items.forEach(item => {
              if (item.productId === productId && !item.name.includes('[Deleted]')) {
                item.name += ' [Deleted]';
                ordChanged = true;
              }
            });
          }
        });
        if (ordChanged) localStorage.setItem(k, JSON.stringify(orders));
      } catch (e) { }
    }

    // Cleanup Packages
    if (k === 'ds_custom_packages') {
      try {
        let pkgs = JSON.parse(localStorage.getItem(k) || '[]');
        let pkgChanged = false;
        pkgs.forEach(pkg => {
          if (pkg.slots) {
            Object.keys(pkg.slots).forEach(slot => {
              if (pkg.slots[slot] === productId) { delete pkg.slots[slot]; pkgChanged = true; }
            });
          }
        });
        if (pkgChanged) localStorage.setItem(k, JSON.stringify(pkgs));
      } catch (e) { }
    }
  }

  const stock = readLS(STOCK_KEY) || {};
  if (stock[productId] !== undefined) { delete stock[productId]; writeLS(STOCK_KEY, stock); }

  const saleCfg = readLS('ds_sale_config') || {};
  if (saleCfg[productId] !== undefined) { delete saleCfg[productId]; writeLS('ds_sale_config', saleCfg); }

  const invTrack = readLS('ds_inv') || {};
  if (invTrack[productId] !== undefined) { delete invTrack[productId]; writeLS('ds_inv', invTrack); }

  try { localStorage.removeItem('ds_reviews_' + productId); } catch (e) { }

  const imgs = getCustomImages(); if (imgs[productId]) { delete imgs[productId]; writeLS(IMG_KEY, imgs); }
  const desc = getCustomDescs(); if (desc[productId]) { delete desc[productId]; writeLS(DESC_KEY, desc); }


  const hidden = readLS('ds_hidden_products') || [];
  const hidIdx = hidden.indexOf(productId);
  if (hidIdx !== -1) { hidden.splice(hidIdx, 1); writeLS('ds_hidden_products', hidden); }

  try {
    window.dispatchEvent(new CustomEvent('ds:product:deleted', { detail: { productId } }));
  } catch (e) { }

  if (typeof renderNav === 'function') try { renderNav(); } catch (e) { }
  if (typeof renderCart === 'function') try { renderCart(); } catch (e) { }
  if (typeof _wishlist !== 'undefined' && Array.isArray(_wishlist)) {
    const wIdx = _wishlist.indexOf(productId);
    if (wIdx !== -1) _wishlist.splice(wIdx, 1);
  }
  if (typeof _updateWishlistBadge === 'function') try { _updateWishlistBadge(); } catch (e) { }
  if (typeof renderBuilder === 'function') try { renderBuilder(); } catch (e) { }
  if (typeof renderStore === 'function') try { renderStore(); } catch (e) { }
  if (typeof renderDeals === 'function') try { renderDeals(); } catch (e) { }
  if (typeof renderFeaturedPackages === 'function') try { renderFeaturedPackages(); } catch (e) { }
  if (typeof renderAllPackages === 'function') try { renderAllPackages(); } catch (e) { }
}

function deleteCustomProduct(id) {
  const isCustom = getCustomProducts().some(p => p.id === id);
  const allP = allProducts();
  const name = (allP.find(p => p.id === id) || {}).name || id;

  if (isCustom) {
    if (!confirm('Permanently delete "' + name + '"?\n\nThis will remove it from:\n\u2022 All user carts\n\u2022 All wishlists\n\u2022 All PC builds\n\u2022 Inventory & stock status\n\u2022 Flash Deals (if on sale)\n\nThis cannot be undone.')) return;
    writeLS(CUSTOM_KEY, getCustomProducts().filter(p => p.id !== id));
  } else {
    if (!confirm('Hide "' + name + '" from the store?\n\nThis will also clean it from all carts, builds, and wishlists.\nYou can restore it later.')) return;
    const hidden = readLS('ds_hidden_products') || [];
    if (!hidden.includes(id)) hidden.push(id);
    writeLS('ds_hidden_products', hidden);
  }

  _purgeProductFromSystem(id);

  pushAudit({ type: 'product_deleted', action: 'deleted', productId: id, productName: name });

  if (typeof SB !== 'undefined') {
    SB.deleteProduct(id).catch(e => console.warn('[Admin] Sync delete failed:', e));
  }

  renderTable();
  renderRecentList();
  showToast(isCustom ? 'Product deleted & purged from all users' : 'Product hidden & cleaned from all users');
}

// Add Product
let newImgBase64 = null;

function setupAddProduct() {
  const zone = document.getElementById('imgUploadZone');
  const input = document.getElementById('imgFileInput');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = ''; if (e.dataTransfer.files[0]) processImageFile(e.dataTransfer.files[0]); });
  input.addEventListener('change', () => { if (input.files[0]) processImageFile(input.files[0]); });
  ['apName', 'apPricePHP', 'apSpecs'].forEach(id => document.getElementById(id).addEventListener('input', updatePreview));

  // Auto-sync status based on quantity
  const qtyIn = document.getElementById('apQty');
  if (qtyIn) {
    qtyIn.addEventListener('input', function() {
      const qty = parseInt(this.value);
      if (isNaN(qty)) return;

      const statusSelect = document.getElementById('apStatus');
      if (!statusSelect) return;

      const threshold = (typeof INVENTORY !== 'undefined') ? INVENTORY.getLowStockThreshold() : 10;
      
      // If manually set to sale, don't override unless it hits 0 or user increases it way past low stock
      // But for simplicity, let's follow the user's logic: sync based on qty.
      // We'll preserve 'sale' if qty > threshold.
      
      let nextStatus = 'normal';
      if (qty === 0) {
        nextStatus = 'outofstock';
      } else if (qty <= threshold) {
        nextStatus = 'lowstock';
      } else {
        // If it was 'sale', keep it 'sale'. If it was 'lowstock'/'outofstock', move to 'normal'.
        if (statusSelect.value === 'sale') nextStatus = 'sale';
        else nextStatus = 'normal';
      }

      if (statusSelect.value !== nextStatus) {
        statusSelect.value = nextStatus;
        _handleStatusChange(nextStatus, true); // true to avoid circular qty setting
      }
    });
  }

  document.getElementById('apCat').addEventListener('change', function () {
    updatePreview();
  });

  document.getElementById('apImageUrl').addEventListener('input', function () {
    const preview = document.getElementById('apImageUrlPreview');
    const img = document.getElementById('apImageUrlImg');
    const url = this.value.trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      img.src = url;
      img.onerror = function () { preview.style.display = 'none'; };
      img.onload = function () { preview.style.display = ''; };
    } else {
      preview.style.display = 'none';
    }
    updatePreview();
  });

  renderRecentList();
  updatePreview();
}

// Image compression helper
async function _compressImage(base64, maxWidth = 600) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

async function processImageFile(file) {
  if (!file.type.startsWith('image/')) { showToast('Please select an image file'); return; }
  if (file.size > 4 * 1024 * 1024) { showToast('Image must be under 4 MB'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    const rawB64 = e.target.result;
    newImgBase64 = await _compressImage(rawB64);
    const zone = document.getElementById('imgUploadZone');
    zone.classList.add('has-img');
    zone.innerHTML = `<div class="upload-img-wrap"><img src="${newImgBase64}" alt="preview" style="max-width:100%;max-height:140px;object-fit:contain;border-radius:6px;display:block;margin:0 auto"></div><button class="btn-remove-img" onclick="removeNewImage(event)">Remove image</button>`;
    updatePreview();
  };
  reader.readAsDataURL(file);
}

function removeNewImage(e) {
  e.stopPropagation();
  newImgBase64 = null;
  const zone = document.getElementById('imgUploadZone');
  zone.classList.remove('has-img');
  zone.innerHTML = `<div class="upload-icon">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  </div><div class="upload-label">Click or drag image here</div><div class="upload-hint">JPG, PNG, WebP — max 4 MB</div>`;
  updatePreview();
}

function updatePreview() {
  const name = (document.getElementById('apName').value || '').trim();
  const cat = document.getElementById('apCat').value || '';
  const php = parseFloat(document.getElementById('apPricePHP').value) || 0;
  const specs = (document.getElementById('apSpecs').value || '').trim();
  const imgEl = document.getElementById('previewImg');
  const _prevUrl = (document.getElementById('apImageUrl')?.value || '').trim();
  if (newImgBase64) {
    imgEl.innerHTML = `<img src="${newImgBase64}" alt="preview" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`;
  } else if (_prevUrl) {
    imgEl.innerHTML = `<img src="${_prevUrl}" alt="preview" style="width:100%;height:100%;object-fit:cover;border-radius:6px" onerror="this.parentElement.innerHTML=cat||'PRODUCT'">`;
  } else {
    imgEl.innerHTML = cat || 'PRODUCT';
  }
  document.getElementById('previewName').textContent = name || 'Product Name';
  document.getElementById('previewCat').textContent = cat || 'Category';
  document.getElementById('previewSpecs').textContent = specs || 'Specifications will appear here';
  document.getElementById('previewPrice').innerHTML = php > 0 ? '&#8369;' + Math.round(php).toLocaleString() : '&#8369;0';
}

function cancelEdit() {
  editingProductId = null;
  resetAddForm();
  switchTab('inventory');
}

function submitAddProduct(e) {
  e.preventDefault();
  const name = document.getElementById('apName').value.trim();
  const cat = document.getElementById('apCat').value;
  const php = parseFloat(document.getElementById('apPricePHP').value);
  const specs = document.getElementById('apSpecs').value.trim();
  const desc = document.getElementById('apDesc').value.trim();
  const benchRaw = document.getElementById('apBenchScore')?.value;
  const bench = benchRaw !== '' && benchRaw !== undefined ? Math.min(100, Math.max(0, parseInt(benchRaw) || 0)) : null;

  const socket = document.getElementById('apSocket')?.value || null;
  const memType = document.getElementById('apMemType')?.value || null;
  const wattage = parseInt(document.getElementById('apWattage')?.value) || 0;
  const gpuLength = parseInt(document.getElementById('apGpuLength')?.value) || 0;
  const maxGpuLen = parseInt(document.getElementById('apMaxGpuLength')?.value) || 0;
  const formFactor = document.getElementById('apFormFactor')?.value || null;
  const suppFf = document.getElementById('apSupportedFf')?.value || null;

  if (!name) { showToast('Enter a product name'); return; }
  if (!cat) { showToast('Select a category'); return; }
  if (!php || php <= 0) { showToast('Enter a valid price'); return; }
  if (!specs) { showToast('Enter specifications'); return; }

  const status = document.getElementById('apStatus')?.value || 'normal';
  const qty = parseInt(document.getElementById('apQty')?.value) || 0;
  const discount = Math.max(1, Math.min(99, parseInt(document.getElementById('apDiscount')?.value) || 15)) / 100;
  const saleStart = document.getElementById('apSaleStart')?.value || '';
  const saleEnd = document.getElementById('apSaleEnd')?.value || '';

  if (BENCH_CATEGORIES.includes(cat)) {
    if (bench === null || bench <= 0 || bench > 100) {
      showToast(cat + ' products require a Benchmark Score (1\u2013100)');
      return;
    }
  }

  const isEdit = !!editingProductId;
  const id = isEdit ? editingProductId : 'custom_' + Date.now();
  const prod = { id, name, cat, price: +(php / 57).toFixed(4), specs, socket, memType };
  if (bench !== null) prod.benchScore = bench;

  if (wattage > 0) prod.wattage = wattage;
  if (gpuLength > 0) prod.length_mm = gpuLength;
  if (maxGpuLen > 0) prod.max_gpu_length = maxGpuLen;
  if (formFactor) prod.form_factor = formFactor;
  if (suppFf) prod.supported_form_factors = suppFf;

  // Storage and Sync updates
  const customs = getCustomProducts();
  if (isEdit) {
    const idx = customs.findIndex(p => p.id === id);
    if (idx !== -1) customs[idx] = prod; else customs.push(prod);
  } else {
    customs.push(prod);
  }
  writeLS(CUSTOM_KEY, customs);

  const _imgUrlInput = (document.getElementById('apImageUrl')?.value || '').trim();
  let imageUrl = '';
  if (newImgBase64) {
    const imgs = getCustomImages(); imgs[id] = newImgBase64; writeLS(IMG_KEY, imgs);
    imageUrl = newImgBase64;
  } else if (_imgUrlInput) {
    const imgs = getCustomImages(); imgs[id] = _imgUrlInput; writeLS(IMG_KEY, imgs);
    imageUrl = _imgUrlInput;
  }

  if (desc) {
    const descs = getCustomDescs(); descs[id] = desc; writeLS(DESC_KEY, descs);
  }

  if (typeof SB !== 'undefined') {
    if (isEdit) {
      SB.updateProduct(id, {
        name, category: cat, price_php: Math.round(php), specs,
        description: desc, image_url: imageUrl,
        bench_score: prod.benchScore || 0, wattage: wattage || 0,
        socket, mem_type: memType,
        length_mm: gpuLength || 0, max_gpu_length: maxGpuLen || 0,
        form_factor: formFactor, supported_form_factors: suppFf
      });
    } else {
      SB.pushProduct({
        id, name, cat, price: prod.price, specs,
        description: desc, imageUrl: imageUrl,
        benchScore: prod.benchScore || 0, wattage: wattage || 0,
        stockStatus: 'normal', stockQty: 50,
        socket, memType,
        length_mm: gpuLength, max_gpu_length: maxGpuLen,
        form_factor: formFactor, supported_form_factors: suppFf,
      });
    }
  }

  // Save Status & Sale & Qty
  setStockVal(id, status, name);
  if (typeof INVENTORY !== 'undefined') {
    INVENTORY.setQty(id, qty);
  }
  if (status === 'sale') {
    const saleCfg = readLS('ds_sale_config') || {};
    saleCfg[id] = { discount, startDate: saleStart, endDate: saleEnd, updatedAt: new Date().toISOString() };
    writeLS('ds_sale_config', saleCfg);
  }

  pushAudit({
    type: isEdit ? 'product_updated' : 'product_added',
    action: isEdit ? 'updated' : 'added',
    productId: id, productName: name, category: cat, pricePHP: Math.round(php)
  });

  // showToast(name + (isEdit ? ' updated!' : ' added to store!'));
  resetAddForm();
  renderRecentList();
  renderStats();
  if (isEdit) {
    renderTable();
    switchTab('inventory');
  }
}

function resetAddForm() {
  editingProductId = null;

  const panelTitle = document.querySelector('#panelAddProduct .panel-title');
  if (panelTitle) panelTitle.textContent = 'Add New Product';

  const submitBtn = document.querySelector('#panelAddProduct .btn-add-product');
  if (submitBtn) submitBtn.textContent = 'Add Product to Store';

  const cancelBtn = document.getElementById('apCancelEdit');
  if (cancelBtn) cancelBtn.style.display = 'none';

  document.getElementById('addProductForm').reset();
  _toggleCompatFields('');
  newImgBase64 = null;
  const zone = document.getElementById('imgUploadZone');
  zone.classList.remove('has-img');
  zone.innerHTML = `<div class="upload-icon">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  </div><div class="upload-label">Click or drag image here</div><div class="upload-hint">JPG, PNG, WebP — max 4 MB</div>`;

  if (document.getElementById('apPowerGroup')) {
    ['apPowerGroup', 'apPhysicalGroup', 'apGpuLengthGroup', 'apMaxGpuLengthGroup',
      'apFormFactorGroup', 'apSupportedFfGroup'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    ['apWattage', 'apGpuLength', 'apMaxGpuLength', 'apFormFactor', 'apSupportedFf'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  if (document.getElementById('apStatus')) {
    document.getElementById('apStatus').value = 'normal';
    _handleStatusChange('normal', true);
  }
  if (document.getElementById('apQty')) {
    document.getElementById('apQty').value = 50;
  }
  if (document.getElementById('apDiscount')) document.getElementById('apDiscount').value = 15;
  if (document.getElementById('apSaleStart')) document.getElementById('apSaleStart').value = '';
  if (document.getElementById('apSaleEnd')) document.getElementById('apSaleEnd').value = '';

  updateBenchPreview('');
  updatePreview();
}

// function updateBenchPreview(val) { ... } // DELETED DUPLICATE

function renderRecentList() {
  const customs = getCustomProducts();
  const imgs = getCustomImages();
  const el = document.getElementById('recentList');
  if (!customs.length) {
    el.innerHTML = '<div style="font-size:0.78rem;color:var(--text3);padding:0.5rem 0">No custom products added yet.</div>';
    return;
  }
  el.innerHTML = [...customs].reverse().slice(0, 8).map(p => {
    const imgSrc = imgs[p.id];
    const thumb = imgSrc
      ? `<div class="recent-thumb"><img src="${imgSrc}" alt="${p.name}"></div>`
      : `<div class="recent-thumb">${p.cat.slice(0, 3)}</div>`;
    return `<div class="recent-item">${thumb}<div class="recent-info"><div class="recent-name">${p.name}</div><div class="recent-price">&#8369;${Math.round(p.price * 57).toLocaleString()}</div></div><button class="btn-recent-del" onclick="deleteCustomProduct('${p.id}')">&#x2715;</button></div>`;
  }).join('');
}

// Order Management
function _getAllOrders() {
  const allOrders = [];
  const seen = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.includes('orders')) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(arr)) {
        arr.forEach(o => {
          if (o && o.id && !seen.has(o.id)) {
            seen.add(o.id);
            allOrders.push({ ...o, _key: key });
          }
        });
      }
    } catch { }
  }
  allOrders.sort((a, b) => {
    const valA = a.date || a.created_at || '';
    const valB = b.date || b.created_at || '';
    return valB.localeCompare(valA);
  });
  return allOrders;
}

function _mutateOrder(orderId, mutateFn) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.includes('orders')) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(arr)) continue;
      let changed = false;
      arr.forEach(o => { if (o && o.id === orderId) { mutateFn(o); changed = true; } });
      if (changed) localStorage.setItem(key, JSON.stringify(arr));
    } catch { }
  }
}

function _deleteOrderFromStorage(orderId) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.includes('orders')) keys.push(k);
  }
  keys.forEach(key => {
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(arr)) return;
      const next = arr.filter(o => !(o && o.id === orderId));
      if (next.length !== arr.length) localStorage.setItem(key, JSON.stringify(next));
    } catch { }
  });
}

async function setOrderStatus(orderId, newStatus) {
  try {
    // Prevent changing status if the order is already cancelled or received
    const currentOrders = _getAllOrders();
    const existingOrder = currentOrders.find(o => o.id === orderId);
    if (existingOrder) {
      if (existingOrder.status === 'cancelled') {
        showToast('Cannot change status: Order is already cancelled.');
        return;
      }
      if (existingOrder.status === 'received') {
        showToast('Cannot change status: Order is already completed (Received).');
        return;
      }
    }

    // Admin cannot manually set status to received or cancelled
    if (newStatus === 'received' || newStatus === 'cancelled') {
      showToast('Admin cannot manually set status to ' + newStatus + '.');
      return;
    }

    // Deduct stock if marking as received and it wasn't already received
    if (newStatus === 'received' && existingOrder && existingOrder.status !== 'received') {
      if (existingOrder.items && typeof INVENTORY !== 'undefined') {
        INVENTORY.deductCart(existingOrder.items);
      }
    }

    // 1. Optimistic Update (Local Storage & Local UI)
    _mutateOrder(orderId, o => {
      o.status = newStatus;
      if (newStatus === 'shipped') o.shippedAt = new Date().toISOString();
      if (newStatus === 'delivered') o.deliveredAt = new Date().toISOString();
    });

    // Refresh UI immediately (Optimistic)
    renderOrders();
    if (newStatus === 'received') renderTable();

    // Log Audit
    pushAudit({ type: 'order_status_change', orderId, newStatus });

    // Data retrieval for sync
    const allOrders = _getAllOrders();
    const order = allOrders.find(o => o.id === orderId);

    // Notifications
    if (typeof NOTIFY !== 'undefined') {
      const userId = order?.userId || null;
      NOTIFY.pushOrderStatus(orderId, newStatus, userId);
    }

    // 2. Background Sync to Cloud
    if (typeof SB !== 'undefined') {
      const extra = {};
      const addr = order ? (order.address || order.delivery_address || 'Customer Address') : 'Customer Address';

      if (newStatus === 'shipped') { extra.shippedAt = new Date().toISOString(); extra.location = 'Dispatch Center'; }
      if (newStatus === 'delivered') { extra.deliveredAt = new Date().toISOString(); extra.location = addr; }
      if (newStatus === 'received') { extra.receivedAt = new Date().toISOString(); }
      if (newStatus === 'cancelled') { extra.cancelledAt = new Date().toISOString(); }

      // Pass tracking if admin filled it in
      const trackingEl = document.getElementById('adminTrackingNumber');
      if (trackingEl && trackingEl.value) extra.trackingNumber = trackingEl.value.trim();

      try {
        await SB.updateOrderStatus(orderId, newStatus, extra);
        // Suppress successful sync toast for common transitions per user request
        if (newStatus !== 'processing' && newStatus !== 'shipped' && newStatus !== 'delivered') {
          showToast('Sync successful: Order ' + orderId + ' marked ' + newStatus);
        }
      } catch (e) {
        console.error('[Admin] Sync failed, but local data saved:', e);
      }
    } else {
      if (newStatus !== 'processing' && newStatus !== 'shipped' && newStatus !== 'delivered') {
        showToast('Order ' + orderId + ' marked ' + newStatus);
      }
    }
  } catch (err) {
    console.error('[Admin] setOrderStatus error:', err);
    showToast('Failed to update order status.', 'error');
  } finally {
    // Final UI refresh to be absolutely sure
    renderOrders();
  }
}

function deleteOrder(orderId) {
  if (!confirm('Permanently delete order ' + orderId + '? This cannot be undone.')) return;
  _deleteOrderFromStorage(orderId);
  pushAudit({ type: 'order_deleted', orderId });
  if (typeof SB !== 'undefined') SB.deleteOrder(orderId);
  renderOrders();
  showToast('Order ' + orderId + ' deleted');
}

function renderOrders() {
  const allOrders = _getAllOrders();
  const proc = allOrders.filter(o => o.status === 'processing').length;
  const shipped = allOrders.filter(o => o.status === 'shipped').length;
  const delivered = allOrders.filter(o => o.status === 'delivered').length;
  const received = allOrders.filter(o => o.status === 'received').length;
  const cancelled = allOrders.filter(o => o.status === 'cancelled').length;

  document.getElementById('orderStatTotal').textContent = allOrders.length;
  document.getElementById('orderStatProc').textContent = proc;
  document.getElementById('orderStatShipped').textContent = shipped;
  document.getElementById('orderStatDelivered').textContent = delivered;
  if (document.getElementById('orderStatReceived')) document.getElementById('orderStatReceived').textContent = received;
  if (document.getElementById('orderStatCancelled')) document.getElementById('orderStatCancelled').textContent = cancelled;

  const tbody = document.getElementById('ordersTableBody');
  if (!allOrders.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No orders placed yet.</td></tr>';
    return;
  }

  const STATUS_LIST = ['processing', 'shipped', 'delivered'];

  tbody.innerHTML = allOrders.map(o => {
    const st = o.status || 'processing';
    const itemPreview = (o.items || []).slice(0, 2)
      .map(i => i.name + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ')
      + ((o.items || []).length > 2 ? ' +' + (o.items.length - 2) + ' more' : '');

    const isLocked = (st === 'received' || st === 'cancelled');
    const statusBtns = isLocked ? '' : STATUS_LIST.filter(s => s !== st).map(s => {
      const cls = {
        processing: 'btn-ord-proc', shipped: 'btn-ord-ship',
        delivered: 'btn-ord-delv', received: 'btn-ord-recv',
        cancelled: 'btn-ord-canc'
      }[s];
      return `<button class="btn-action ${cls}" onclick="setOrderStatus('${o.id}','${s}')">${s.charAt(0).toUpperCase() + s.slice(1)}</button>`;
    }).join('');

    const dateVal = o.date || o.created_at || '';
    let dateStr = '—';
    if (dateVal) {
      const dt = new Date(dateVal);
      if (!isNaN(dt.getTime())) {
        dateStr = dt.toLocaleString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        dateStr = dateVal;
      }
    }

    return `<tr id="orow-${o.id}">
      <td>
        <div class="order-id-cell">${o.id || '—'}</div>
        <div class="order-date-cell">${dateStr}</div>
      </td>
      <td>
        <div class="order-cust-cell">${o.customer || '—'}</div>
        <div class="order-email-cell" style="font-size:0.75rem;color:var(--text3);margin-top:2px">${o.email || ''}</div>
      </td>
      <td>
        <div class="order-items-cell">${itemPreview || '—'}</div>
        <div class="order-count-cell">${(o.items || []).length} item(s)</div>
      </td>
      <td><span class="order-total-cell">&#8369;${(o.total || 0).toLocaleString()}</span></td>
      <td>
        <div class="order-pm-cell" style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;text-transform:uppercase;color:var(--text2)">
          ${o.payment || o.payment_method || '—'}
        </div>
      </td>
      <td>
        <span class="ot-status ${st}">${st}</span>
        ${o.shippedAt ? `<div style="font-size:0.62rem;color:var(--text3);margin-top:3px;line-height:1.1">Ship: ${new Date(o.shippedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>` : ''}
        ${o.deliveredAt ? `<div style="font-size:0.62rem;color:var(--text3);line-height:1.1">Delv: ${new Date(o.deliveredAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>` : ''}
        ${o.receivedAt ? `<div style="font-size:0.62rem;color:var(--green);line-height:1.1">Recv: ${new Date(o.receivedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>` : ''}
      </td>
      <td>
        <div class="order-row-actions">
          ${statusBtns}
          <div class="action-divider"></div>
          <button class="btn-action btn-admin-chat" onclick="openAdminChat('${o.id}','${o.user_id || ''}')">Chat</button>
          <button class="btn-action btn-ord-del" onclick="deleteOrder('${o.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// Audit Trail
let auditTypeFilter = 'all';

function pushAudit(entry) {
  const log = readLS(AUDIT_KEY) || [];
  const fullEntry = {
    ...entry,
    ts: new Date().toISOString(),
    id: 'audit_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
  };
  log.unshift(fullEntry);
  writeLS(AUDIT_KEY, log.slice(0, 200)); // Keep last 200 entries
  if (typeof renderAudit === 'function') renderAudit();

  // Sync to Supabase
  if (typeof SB !== 'undefined' && typeof SB.pushAuditEntry === 'function') {
    SB.pushAuditEntry(fullEntry).catch(e => console.error('[SB] pushAudit sync failed:', e));
  }
}

function renderAudit() {
  const log = readLS(AUDIT_KEY) || [];
  const typeFilter = document.getElementById('auditTypeFilter')?.value || 'all';

  const filtered = typeFilter === 'all' ? log : log.filter(e => e.type === typeFilter);

  const el = document.getElementById('auditList');

  if (!filtered.length) {
    el.innerHTML = '<div class="audit-empty">No audit entries yet. Actions like status changes, orders, and product additions will appear here.</div>';
    return;
  }

  el.innerHTML = filtered.map(entry => {
    const ts = entry.ts ? new Date(entry.ts) : null;
    const timeStr = ts ? ts.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + ts.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—';

    let iconClass = entry.type || 'status_change';
    const _isOrderEvt = entry.type === 'order_placed' || entry.type === 'order_status_change' || entry.type === 'order_deleted';
    let iconChar = _isOrderEvt ? '' : entry.type === 'product_added' ? '&#43;' : '&#8644;';
    let actionHtml = '';
    let detailHtml = '';

    if (entry.type === 'status_change') {
      const oldColor = { normal: 'var(--green)', lowstock: 'var(--orange)', outofstock: 'var(--red)', sale: 'var(--yellow)' }[entry.oldStatus] || 'var(--text3)';
      const newColor = { normal: 'var(--green)', lowstock: 'var(--orange)', outofstock: 'var(--red)', sale: 'var(--yellow)' }[entry.newStatus] || 'var(--text3)';
      actionHtml = `Status changed <span class="audit-type-badge badge-status">INVENTORY</span>`;
      detailHtml = `Target Product: ${entry.productName || entry.productId} &nbsp;&#8212;&nbsp; <span style="color:${oldColor}">From: ${entry.oldStatus || 'normal'}</span> <span class="status-arrow">&#8594;</span> <span style="color:${newColor}">To: ${entry.newStatus || '?'}</span>`;
    } else if (entry.type === 'order_placed') {
      actionHtml = `Order placed <span class="audit-type-badge badge-order">ORDER</span>`;
      detailHtml = `Order ID: ${entry.orderId || '—'} &nbsp;&#8212;&nbsp; Customer: ${entry.customer || 'Guest'} &nbsp;&#8212;&nbsp; Amount: &#8369;${entry.total || '0'} &nbsp;(${entry.itemCount || 0} item${(entry.itemCount || 0) !== 1 ? 's' : ''})`;
    } else if (entry.type === 'order_status_change') {
      const sColor = { processing: 'var(--orange)', shipped: 'var(--accent)', delivered: 'var(--green)', cancelled: 'var(--red)' }[entry.newStatus] || 'var(--text3)';
      actionHtml = `Order status updated <span class="audit-type-badge badge-order">ORDER</span>`;
      detailHtml = `Order ID: ${entry.orderId || '—'} &nbsp;&#8212;&nbsp; Status: <span style="color:${sColor}">${entry.newStatus || '?'}</span>`;
    } else if (entry.type === 'order_deleted') {
      actionHtml = `Order deleted <span class="audit-type-badge badge-del">ORDER</span>`;
      detailHtml = `Order ID: ${entry.orderId || '—'}`;
    } else if (entry.type === 'product_added') {
      const verb = entry.action === 'deleted' ? 'deleted' : 'added';
      actionHtml = `Product ${verb} <span class="audit-type-badge badge-product">PRODUCT</span>`;
      detailHtml = `Product: ${entry.productName || entry.productId}` + (entry.pricePHP ? ` &nbsp;&#8212;&nbsp; Price: &#8369;${entry.pricePHP.toLocaleString()}` : '') + (entry.category ? ` &nbsp;&#8212;&nbsp; Cat: ${entry.category}` : '');
    } else {
      actionHtml = entry.type || 'Unknown action';
      detailHtml = JSON.stringify(entry).slice(0, 80);
    }

    return `<div class="audit-entry">
      <div class="audit-icon ${iconClass}">${iconChar}</div>
      <div class="audit-meta">
        <div class="audit-action">${actionHtml}</div>
        <div class="audit-detail">${detailHtml}</div>
      </div>
      <div class="audit-ts">${timeStr}</div>
    </div>`;
  }).join('');
}

function restoreHiddenProducts() {
  if (!confirm('Restore all hidden built-in products? They will reappear in the store.')) return;
  writeLS('ds_hidden_products', []);
  renderTable();
  renderStats();
  showToast('All hidden products restored');
}

function clearAuditLog() {
  if (!confirm('Clear the entire audit log? This cannot be undone.')) return;
  writeLS(AUDIT_KEY, []);
  renderAudit();
  showToast('Audit log cleared');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

// Package Manager
const PKG_STORE_KEY = 'ds_custom_packages';
const SLOT_KEYS = ['CPU', 'GPU', 'Motherboard', 'RAM', 'Storage', 'PSU', 'Cooling', 'Case'];
const SLOT_LABELS = {
  CPU: 'Processor', GPU: 'Graphics Card', Motherboard: 'Motherboard',
  RAM: 'Memory', Storage: 'Storage', PSU: 'Power Supply',
  Cooling: 'CPU Cooler', Case: 'Case'
};

function adminGetPackages() {
  try {
    const saved = JSON.parse(localStorage.getItem(PKG_STORE_KEY) || 'null');
    if (saved && Array.isArray(saved)) return saved;
  } catch (e) { }
  return typeof PACKAGES !== 'undefined' ? JSON.parse(JSON.stringify(PACKAGES)) : [];
}

function adminSavePackages(pkgs) {
  writeLS(PKG_STORE_KEY, pkgs);
  try { localStorage.setItem('ds_packages_updated', Date.now()); } catch (e) { }
}

function adminResetPackages() {
  if (!confirm('Reset all packages to defaults? Your custom changes will be lost.')) return;
  localStorage.removeItem(PKG_STORE_KEY);
  adminRenderPackages();
  showToast('Packages reset to defaults');
}

function adminRenderPackages() {
  const el = document.getElementById('pkgAdminGrid');
  if (!el) return;
  const pkgs = adminGetPackages();

  if (!pkgs.length) {
    el.innerHTML = '<div style="color:var(--text3);padding:2rem;text-align:center">No packages yet. Click + New Package to create one.</div>';
    return;
  }

  el.innerHTML = pkgs.map((pkg, idx) => {
    const slots = pkg.slots || {};
    const compRows = SLOT_KEYS.map(k => {
      if (!slots[k]) return '';
      const p = (typeof getProduct === 'function') ? getProduct(slots[k]) : null;
      const name = p ? p.name : slots[k];
      return `<div style="display:flex;justify-content:space-between;gap:.5rem;font-size:.72rem;padding:.18rem 0;border-bottom:1px solid var(--border)">
        <span style="color:var(--text3);min-width:80px;flex-shrink:0">${SLOT_LABELS[k] || k}</span>
        <span style="color:var(--text);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
      </div>`;
    }).join('');

    const phpTotal = SLOT_KEYS.reduce((sum, k) => {
      if (!slots[k]) return sum;
      const p = (typeof getProduct === 'function') ? getProduct(slots[k]) : null;
      return sum + (p ? p.price * 57 : 0);
    }, 0);

    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.1rem;margin-bottom:1rem;border-left:3px solid ${pkg.color || 'var(--accent)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;gap:.5rem;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
          <span style="font-family:'Bebas Neue',sans-serif;font-size:1.15rem;letter-spacing:1px;color:var(--text)">${pkg.name}</span>
          <span style="font-size:.68rem;padding:2px 7px;border-radius:4px;background:var(--s2);color:var(--accent);font-family:'JetBrains Mono',monospace">${pkg.category}</span>
          ${pkg.featured ? '<span style="font-size:.65rem;padding:2px 7px;border-radius:4px;background:rgba(245,158,11,0.15);color:var(--yellow)">FEATURED</span>' : ''}
        </div>
        <div style="display:flex;gap:.4rem">
          <button class="btn-action btn-normal" onclick="adminOpenEditPkg(${idx})" style="font-size:.72rem;padding:.25rem .65rem">Edit</button>
          <button class="btn-action btn-del"    onclick="adminDeletePkg(${idx})"   style="font-size:.72rem;padding:.25rem .65rem">Delete</button>
        </div>
      </div>
      <div style="font-size:.76rem;color:var(--text3);margin-bottom:.6rem;font-style:italic">${pkg.tagline || ''}</div>
      <div>${compRows}</div>
      <div style="font-size:.82rem;font-family:'JetBrains Mono',monospace;color:var(--accent);margin-top:.6rem">&#8369;${Math.round(phpTotal).toLocaleString()}</div>
    </div>`;
  }).join('');
}

let _editPkgIdx = null;

function adminOpenNewPkg() {
  _editPkgIdx = null;
  document.getElementById('pkgEditModalTitle').textContent = 'New Package';
  document.getElementById('peditName').value = '';
  document.getElementById('peditTagline').value = '';
  document.getElementById('peditCat').value = 'Gaming';
  document.getElementById('peditFeatured').checked = false;
  _renderPeditSlots({});
  document.getElementById('pkgEditModal').classList.add('open');
}

function adminOpenEditPkg(idx) {
  const pkgs = adminGetPackages();
  const pkg = pkgs[idx];
  if (!pkg) return;
  _editPkgIdx = idx;
  document.getElementById('pkgEditModalTitle').textContent = 'Edit Package';
  document.getElementById('peditName').value = pkg.name;
  document.getElementById('peditTagline').value = pkg.tagline || '';
  document.getElementById('peditCat').value = pkg.category || 'Gaming';
  document.getElementById('peditFeatured').checked = !!pkg.featured;
  _renderPeditSlots(pkg.slots || {});
  document.getElementById('pkgEditModal').classList.add('open');
}

function closePkgEditModal() {
  document.getElementById('pkgEditModal').classList.remove('open');
}

function _renderPeditSlots(currentSlots) {
  const el = document.getElementById('peditSlots');
  if (!el) return;
  function opts(cat, selectedId) {
    const prods = (typeof getProductsByCategory === 'function') ? getProductsByCategory(cat) : [];
    return prods.map(p =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name}</option>`
    ).join('');
  }
  el.innerHTML = SLOT_KEYS.map(k => `
    <div style="display:grid;grid-template-columns:110px 1fr;gap:.5rem;align-items:center">
      <label style="font-size:.75rem;color:var(--text3);font-family:'JetBrains Mono',monospace">${SLOT_LABELS[k] || k}</label>
      <select class="form-select" id="pedit_slot_${k}" style="font-size:.75rem;padding:.3rem .5rem">
        <option value="">— None —</option>
        ${opts(k, currentSlots[k] || '')}
      </select>
    </div>`).join('');
}

function savePkgEdit() {
  const name = document.getElementById('peditName').value.trim();
  const tagline = document.getElementById('peditTagline').value.trim();
  const cat = document.getElementById('peditCat').value;
  const featured = document.getElementById('peditFeatured').checked;
  if (!name) { showToast('Enter a package name'); return; }
  if (!tagline) { showToast('Enter a tagline'); return; }
  const slots = {};
  SLOT_KEYS.forEach(k => {
    const val = document.getElementById('pedit_slot_' + k)?.value;
    if (val) slots[k] = val;
  });
  const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#a855f7', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'];
  slots._ui_color = document.getElementById('pkgEditModal').style.getPropertyValue('--pc-color') || colors[0];
  if (!Object.keys(slots).filter(k => !k.startsWith('_')).length) { showToast('Select at least one component'); return; }

  const pkgs = adminGetPackages();
  if (_editPkgIdx === null) {
    const id = 'pkg_admin_' + Date.now();
    const colors = ['#22c55e', '#ef4444', '#f59e0b', '#a855f7', '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899'];
    const color = colors[pkgs.length % colors.length];
    pkgs.push({ id, name, category: cat, icon: '', tagline, color, featured, slots });
    if (typeof SB !== 'undefined') SB.pushPackage(pkgs[pkgs.length - 1]);
    pushAudit({ type: 'product_added', action: 'added', productId: id, productName: name, category: 'Package' });
    showToast(name + ' created!');
  } else {
    const existing = pkgs[_editPkgIdx];
    pkgs[_editPkgIdx] = { ...existing, name, category: cat, tagline, featured, slots };
    if (typeof SB !== 'undefined') SB.pushPackage(pkgs[_editPkgIdx]);
    pushAudit({ type: 'product_added', action: 'added', productId: existing.id, productName: name, category: 'Package (edited)' });
    showToast(name + ' saved!');
  }
  adminSavePackages(pkgs);
  closePkgEditModal();
  adminRenderPackages();
}

function adminDeletePkg(idx) {
  const pkgs = adminGetPackages();
  const pkg = pkgs[idx];
  if (!pkg) return;
  if (!confirm('Delete "' + pkg.name + '"? This cannot be undone.')) return;
  pkgs.splice(idx, 1);
  adminSavePackages(pkgs);
  pushAudit({ type: 'product_added', action: 'deleted', productId: pkg.id, productName: pkg.name, category: 'Package' });
  /* Sync to Supabase */
  if (typeof SB !== 'undefined') SB.deletePackage(pkg.id);
  adminRenderPackages();
  showToast('Package deleted');
}

// Initialize page
(async function () {
  if (typeof SB !== 'undefined') {
    await SB.pull();
  }
  renderTable();
  setupAddProduct();
  if (typeof renderOrders === 'function') renderOrders();
  if (typeof renderAudit === 'function') renderAudit();
  if (typeof adminRenderPackages === 'function') adminRenderPackages();
})();

// Real-time synchronization for multi-tab testing
window.addEventListener('storage', (e) => {
  if (!e.key) return;
  // If orders or inventory changes in another tab, refresh our views
  if (e.key.includes('orders') || e.key.includes('ds_inv') || e.key.includes('ds_stock')) {
    console.log('[Admin] Storage sync triggered by:', e.key);
    if (typeof renderOrders === 'function') renderOrders();
    if (typeof renderTable === 'function') renderTable();
    if (typeof renderStats === 'function') renderStats();
    if (typeof renderAudit === 'function') renderAudit();
  }
});

/** Benchmark Score Calculator **/

let currentBenchScore = 0;

function openBenchCalculator() {
  const cat = document.getElementById('apCat').value;
  if (!['CPU', 'GPU', 'RAM', 'Storage'].includes(cat)) {
    showToast('Select a hardware category first', 'error');
    return;
  }

  document.getElementById('benchCalcTitle').textContent = cat + ' Performance Calculator';
  document.getElementById('benchCalcModal').classList.add('open');
  document.getElementById('benchCalcResultArea').style.display = 'none';

  _renderBenchCalcFields(cat);
}

function closeBenchCalculator() {
  document.getElementById('benchCalcModal').classList.remove('open');
}

function _renderBenchCalcFields(cat) {
  const container = document.getElementById('benchCalcFields');
  let html = '';

  if (cat === 'CPU') {
    html = `
      <div class="bench-calc-field-row">
        <div class="form-group">
          <label class="form-label">Cores</label>
          <input class="form-input" type="number" id="bcCpuCores" value="6" oninput="updateBenchHeuristic()">
        </div>
        <div class="form-group">
          <label class="form-label">Threads</label>
          <input class="form-input" type="number" id="bcCpuThreads" value="12" oninput="updateBenchHeuristic()">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Max Boost Clock (GHz)</label>
        <input class="form-input" type="number" id="bcCpuClock" value="4.4" step="0.1" oninput="updateBenchHeuristic()">
      </div>
    `;
  } else if (cat === 'GPU') {
    html = `
      <div class="form-group">
        <label class="form-label">Series / Generation</label>
        <select class="form-select" id="bcGpuGen" onchange="updateBenchHeuristic()">
          <option value="1.3">RTX 40-Series / RX 7000 (Latest)</option>
          <option value="1.0" selected>RTX 30-Series / RX 6000 (Mid)</option>
          <option value="0.75">RTX 20-Series / RX 5000 (Older)</option>
          <option value="0.5">GTX 16 / Entry Level</option>
        </select>
      </div>
      <div class="bench-calc-field-row">
        <div class="form-group">
          <label class="form-label">VRAM (GB)</label>
          <input class="form-input" type="number" id="bcGpuVram" value="8" oninput="updateBenchHeuristic()">
        </div>
        <div class="form-group">
          <label class="form-label">Boost Clock (MHz)</label>
          <input class="form-input" type="number" id="bcGpuClock" value="1800" oninput="updateBenchHeuristic()">
        </div>
      </div>
    `;
  } else if (cat === 'RAM') {
    html = `
      <div class="form-group">
        <label class="form-label">Speed (MHz)</label>
        <input class="form-input" type="number" id="bcRamSpeed" value="3200" oninput="updateBenchHeuristic()">
      </div>
      <div class="form-group">
        <label class="form-label">CAS Latency (CL)</label>
        <input class="form-input" type="number" id="bcRamCL" value="16" oninput="updateBenchHeuristic()">
      </div>
    `;
  } else if (cat === 'Storage') {
    html = `
      <div class="form-group">
        <label class="form-label">Drive Type</label>
        <select class="form-select" id="bcStorType" onchange="updateBenchHeuristic()">
          <option value="95">NVMe Gen 5 (Flagship)</option>
          <option value="85" selected>NVMe Gen 4 (High-end)</option>
          <option value="70">NVMe Gen 3 (Mid-range)</option>
          <option value="45">SATA SSD (Budget)</option>
          <option value="15">HDD (Legacy)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Max Read Speed (MB/s)</label>
        <input class="form-input" type="number" id="bcStorSpeed" value="5000" oninput="updateBenchHeuristic()">
      </div>
    `;
  }

  container.innerHTML = html;
  updateBenchHeuristic();
}

function updateBenchHeuristic() {
  const cat = document.getElementById('apCat').value;
  let score = 0;

  if (cat === 'CPU') {
    const cores = parseInt(document.getElementById('bcCpuCores').value) || 0;
    const threads = parseInt(document.getElementById('bcCpuThreads').value) || 0;
    const clock = parseFloat(document.getElementById('bcCpuClock').value) || 0;

    // Weighted heuristic
    score = (cores * 3) + (threads * 1) + (clock * 10);
    // Architecture bonus/cap
    if (cores >= 12) score += 10;
    if (clock >= 5.2) score += 5;
  }
  else if (cat === 'GPU') {
    const gen = parseFloat(document.getElementById('bcGpuGen').value) || 1;
    const vram = parseInt(document.getElementById('bcGpuVram').value) || 0;
    const clock = parseInt(document.getElementById('bcGpuClock').value) || 0;

    score = ((vram * 4) + (clock * 0.02)) * gen;
  }
  else if (cat === 'RAM') {
    const speed = parseInt(document.getElementById('bcRamSpeed').value) || 0;
    const cl = parseInt(document.getElementById('bcRamCL').value) || 16;

    const speedScore = (speed / 100) * 1.5;
    const latencyAdj = (20 - cl) * 1.5;
    score = speedScore + latencyAdj + 20;
  }
  else if (cat === 'Storage') {
    const typeBase = parseInt(document.getElementById('bcStorType').value) || 0;
    const speed = parseInt(document.getElementById('bcStorSpeed').value) || 0;

    const speedBonus = Math.min(10, speed / 1000);
    score = typeBase + speedBonus;
  }

  score = Math.round(Math.max(1, Math.min(100, score)));
  currentBenchScore = score;

  // Update UI Result
  document.getElementById('benchCalcResultArea').style.display = 'block';
  document.getElementById('bcScoreVal').textContent = score;

  const { label, target } = _getPerfTier(score, cat);
  document.getElementById('bcTierLabel').textContent = label;
  document.getElementById('bcTargetLabel').textContent = target;

  // Color coordination
  let color = '#2563eb';
  if (score >= 95) color = '#ef4444';
  else if (score >= 80) color = '#f97316';
  else if (score >= 55) color = '#2563eb';
  else if (score >= 30) color = '#22c55e';
  else color = '#64748b';

  document.getElementById('bcScoreVal').style.color = color;
  document.getElementById('bcTierLabel').style.color = color;
}

function _getPerfTier(score, cat) {
  let label = 'Entry-level';
  let target = 'Standard productivity';

  if (score >= 95) {
    label = 'Flagship / Enthusiast';
    target = 'Extreme 4K / Professional Work';
  } else if (score >= 80) {
    label = 'High-End Performance';
    target = 'Solid 1440p / AAA Gaming';
  } else if (score >= 55) {
    label = 'Mid-Range Balanced';
    target = '1080p Ultra / Workstation';
  } else if (score >= 30) {
    label = 'Budget / Mainstream';
    target = '1080p Standard Gaming';
  } else {
    label = 'Entry-Level / Essential';
    target = 'Office & Home use';
  }

  return { label, target };
}

function applyBenchScore() {
  const input = document.getElementById('apBenchScore');
  if (input) {
    input.value = currentBenchScore;
    updateBenchPreview(currentBenchScore);
    showToast('Score applied: ' + currentBenchScore, 'success');
    closeBenchCalculator();
  }
}