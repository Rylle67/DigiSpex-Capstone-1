/* Package Customization Engine */

// PHP conversion rate 
const PHP = 57;

// Package Definitions

const PACKAGES = [];

/* Dynamically derive package categories */
const _BASE_PKG_CAT_ORDER = ['Gaming', 'Creator', 'Office', 'School', 'Workstation', 'Streaming'];
function getPkgCategories() {
  const pkgs = _getPackages();
  const catSet = new Set(pkgs.map(p => p.category).filter(Boolean));
  const ordered = _BASE_PKG_CAT_ORDER.filter(c => catSet.has(c));
  catSet.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
  return ['All', ...ordered];
}
const PKG_CATEGORIES = new Proxy([], {
  get(target, prop) {
    const cats = getPkgCategories();
    if (prop === 'length') return cats.length;
    if (typeof cats[prop] === 'function') return cats[prop].bind(cats);
    const idx = Number(prop);
    if (!isNaN(idx)) return cats[idx];
    return cats[prop];
  }
});

/* Read from localStorage */
function _getPackages() {
  try {
    const saved = JSON.parse(localStorage.getItem('ds_custom_packages') || 'null');
    if (Array.isArray(saved)) return saved;
  } catch (e) { }
  return [];
}

const _pkgCustom = {};
let currentPkgCategory = 'All';

function _getPkgSlots(pkg) {
  if (!pkg) return {};
  return Object.assign({}, pkg.slots || {}, _pkgCustom[pkg.id] || {});
}

function _getPkgColor(pkg) {
  const catColors = {
    'Gaming': '#3b82f6',
    'Creator': '#a855f7',
    'Office': '#06b6d4',
    'School': '#f59e0b',
    'Workstation': '#ef4444',
    'Streaming': '#ec4899'
  };
  return _pkgCustom[pkg.id]?._ui_color || 
         pkg.slots?._ui_color || 
         pkg.color || 
         catColors[pkg.category] || 
         '#3b82f6';
}

function _pkgRawTotal(pkg) {
  const slots = _getPkgSlots(pkg);
  return Object.values(slots).reduce((s, id) => {
    return s + (id ? getEffectivePrice(id) : 0);
  }, 0) / PHP;
}

function _pkgIncludes(pkg, max) {
  const slots = _getPkgSlots(pkg);
  const labels = {
    CPU: 'Processor', GPU: 'Graphics', Motherboard: 'Motherboard', RAM: 'Memory',
    Storage: 'Storage', PSU: 'Power Supply', Cooling: 'Cooling', Case: 'Case'
  };
  return Object.entries(slots).slice(0, max || 5).map(([slot, id]) => {
    const p = getProduct(id);
    return `${labels[slot] || slot}: ${p ? p.name : '—'}`;
  });
}

function _renderPkgCard(pkg) {
  const raw = _pkgRawTotal(pkg);
  const includes = _pkgIncludes(pkg, 5);
  const color = _getPkgColor(pkg);
  return `
<div class="package-card ${pkg.featured ? 'featured' : ''}" style="--pc-color:${color}">
  ${pkg.featured ? '<div class="featured-ribbon">Popular</div>' : ''}
  <div class="package-card-banner"></div>
  <div class="package-card-body">
    <div class="package-name">${pkg.name}</div>
    <div class="package-tagline">${pkg.tagline}</div>
    <div class="package-includes">
      ${includes.map(i => `<div class="pkg-include-row"><div class="dot"></div><span>${i}</span></div>`).join('')}
      <div class="pkg-include-row" style="color:var(--text3);font-style:italic">
        <div class="dot" style="background:var(--text3)"></div>
        <span>+ ${Object.keys(pkg.slots).length - 5} more components</span>
      </div>
    </div>
    <div class="package-price-row">
      <div class="pkg-price-now">&#8369;${Math.round(_pkgRawTotal(pkg) * PHP).toLocaleString()}</div>
    </div>
    <div class="pkg-btn-row">
      <button class="btn-pkg-customize" onclick="openPkgCustomizer('${pkg.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        Customize
      </button>
      <button class="btn-pkg-grab"      onclick="grabPackage('${pkg.id}')">Add to Cart &rarr;</button>
    </div>
  </div>
</div>`;
}

function renderFeaturedPackages() {
  const el = document.getElementById('featuredPackages');
  if (!el) return;
  el.innerHTML = _getPackages().filter(p => p.featured).map(_renderPkgCard).join('');
}

function renderAllPackages() {
  const el = document.getElementById('allPackagesGrid');
  if (!el) return;
  const list = currentPkgCategory === 'All'
    ? _getPackages()
    : _getPackages().filter(p => p.category === currentPkgCategory);
  el.innerHTML = list.map(_renderPkgCard).join('');
}

function renderPkgCatStrip() {
  const el = document.getElementById('pkgCatStrip');
  if (!el) return;
  el.innerHTML = PKG_CATEGORIES.map(c =>
    `<button class="pkg-cat-btn ${currentPkgCategory === c ? 'active' : ''}"
             onclick="setPkgCategory('${c}')">${c}</button>`
  ).join('');
}

function setPkgCategory(cat) {
  currentPkgCategory = cat;
  renderPkgCatStrip();
  renderAllPackages();
}

// Package Customizer Modal Logic

let _custPkgId = null;
let _swapSlot = null;

function openPkgCustomizer(pkgId) {
  const pkg = _getPackages().find(p => p.id === pkgId);
  if (!pkg) return;
  _custPkgId = pkgId;
  document.getElementById('pkgCustTitle').textContent = pkg.name;
  _renderCustBody(pkg);
  document.getElementById('pkgCustomizerModal').classList.add('open');
}

function _renderCustBody(pkg) {
  const slots = _getPkgSlots(pkg);
  const labels = {
    CPU: 'Processor', GPU: 'Graphics Card', Motherboard: 'Motherboard',
    RAM: 'Memory', Storage: 'Storage', PSU: 'Power Supply', Cooling: 'CPU Cooler', Case: 'Case'
  };

  let slotsHtml = '';
  for (const [slot, pid] of Object.entries(slots)) {
    const p = getProduct(pid);
    if (!p) continue;
    slotsHtml += `
    <div class="pkg-cust-slot">
      <div class="pkg-slot-hd">
        <div class="pkg-slot-label">${labels[slot] || slot}</div>
        <button class="btn-pkg-swap" onclick="openPkgSwap('${slot}','${pkg.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:2px">
            <path d="m16 3 4 4-4 4"/>
            <path d="M20 7H4"/>
            <path d="m8 21-4-4 4-4"/>
            <path d="M4 17h16"/>
          </svg>
          Swap
        </button>
      </div>
      <div class="pkg-slot-item">
        <div class="pkg-slot-info">
          <div class="pkg-slot-name">${p.name}</div>
          <div class="pkg-slot-specs">${p.specs}</div>
        </div>
        <div class="pkg-slot-price">&#8369;${getEffectivePrice(pid).toLocaleString()}</div>
      </div>
    </div>`;
  }

  const raw = _pkgRawTotal(pkg);

  const sumLines = Object.entries(slots).map(([slot, pid]) => {
    const p = getProduct(pid);
    const eff = getEffectivePrice(pid);
    return p ? `<div class="pkg-sum-row"><span>${labels[slot] || slot}</span><span>&#8369;${eff.toLocaleString()}</span></div>` : '';
  }).join('');

  const summaryHtml = `
  <div class="pkg-cust-summary">
    <div class="pkg-sum-title">${pkg.name}</div>
    <div class="pkg-sum-rows">${sumLines}</div>
    <div class="pkg-sum-total"><span>Package Total</span><span>&#8369;${Math.round(_pkgRawTotal(pkg) * PHP).toLocaleString()}</span></div>
    <button class="btn-pkg-add-all"
            onclick="grabPackage('${pkg.id}');document.getElementById('pkgCustomizerModal').classList.remove('open')">
      Add Package to Cart
    </button>
    <button class="btn-pkg-build-use" onclick="usePackageInBuilder('${pkg.id}')">
      Use in PC Builder
    </button>
  </div>`;

  document.getElementById('pkgCustBody').innerHTML = `<div class="pkg-cust-slots">${slotsHtml}</div>${summaryHtml}`;
}

function openPkgSwap(slot, pkgId) {
  _swapSlot = slot;
  _custPkgId = pkgId;
  const pkg = _getPackages().find(p => p.id === pkgId);
  const current = _getPkgSlots(pkg)[slot];
  const labels = {
    CPU: 'Processor', GPU: 'Graphics Card', Motherboard: 'Motherboard',
    RAM: 'Memory', Storage: 'Storage', PSU: 'Power Supply', Cooling: 'CPU Cooler', Case: 'Case'
  };

  document.getElementById('pkgSwapTitle').textContent = 'Choose ' + (labels[slot] || slot);

  const _swapCustom = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_products') || '[]'); } catch (e) { return []; } })();
  const _swapAll = [...(typeof _getAllProducts === 'function' ? _getAllProducts() : []), ..._swapCustom];
  const candidates = _swapAll.filter(p => p.cat === slot && p.id !== current);

  document.getElementById('pkgSwapList').innerHTML = candidates.length
    ? candidates.map(p => `
      <div class="pkg-swap-item" onclick="applyPkgSwap('${p.id}')">
        <div class="pkg-swap-info">
          <div class="pkg-swap-name">${p.name}</div>
          <div class="pkg-swap-spec">${p.specs}</div>
        </div>
        <div class="pkg-swap-price">&#8369;${getEffectivePrice(p.id).toLocaleString()}</div>
      </div>`).join('')
    : '<p style="color:var(--text3);text-align:center;padding:1.5rem">No alternatives available.</p>';

  document.getElementById('pkgSwapModal').classList.add('open');
}

function applyPkgSwap(productId) {
  if (!_custPkgId || !_swapSlot) return;
  if (!_pkgCustom[_custPkgId]) _pkgCustom[_custPkgId] = {};
  _pkgCustom[_custPkgId][_swapSlot] = productId;
  document.getElementById('pkgSwapModal').classList.remove('open');
  const pkg = _getPackages().find(p => p.id === _custPkgId);
  if (pkg) _renderCustBody(pkg);
  showToast('Component swapped!', 'success');
}

function grabPackage(pkgId) {
  const pkg = _getPackages().find(p => p.id === pkgId);
  if (!pkg) return;
  Object.values(_getPkgSlots(pkg)).forEach(id => { if (id) DB.cartAdd(id); });
  renderNav();
  showPage('cart');
  showToast(pkg.name + ' added to cart!', 'success');
}

function usePackageInBuilder(pkgId) {
  const pkg = _getPackages().find(p => p.id === pkgId);
  if (!pkg) return;
  DB.buildSave({ ..._getPkgSlots(pkg) });
  document.getElementById('pkgCustomizerModal').classList.remove('open');
  showPage('builder');
  renderBuilder();
  showToast('Package loaded into PC Builder!', 'success');
}

// Laptop Store Logic

const LAPTOP_CATEGORIES_NAV = ['All', 'Gaming', 'Ultrabook', 'Office', 'Creator', 'Budget'];

const USE_BADGE = {
  Gaming: 'badge-gaming',
  Creator: 'badge-creator',
  Ultrabook: 'badge-ultrabook',
  Office: 'badge-office',
  Budget: 'badge-budget',
};

function _buildCustomLaptopMeta(p) {
  if (!p) return { use: 'Office', brand: '', screen: '', specs2: '', table: {} };
  const specs = p.specs || '';
  const name = p.name || '';
  
  // 1. Resolve Screen Size
  const screenMatch = (name + ' ' + specs).match(/(\d{2}(?:\.\d)?)["”]/);
  const screen = screenMatch ? screenMatch[1] + '"' : '';

  // 2. Resolve Brand
  const brands = ['ASUS', 'MSI', 'Acer', 'Dell', 'HP', 'Lenovo', 'Razer', 'Apple', 'Samsung',
    'Gigabyte', 'LG', 'Huawei', 'Toshiba', 'Sony', 'Microsoft', 'Google', 'Honor'];
  const brand = brands.find(b => name.toLowerCase().includes(b.toLowerCase())) || '';

  // 3. Resolve Usage Category
  let use = 'Office';
  const lower = (name + ' ' + specs).toLowerCase();
  const isGaming = ['gaming', 'rtx', 'rx ', 'gtx', 'rog', 'tuf', 'legion', 'razer', 'predator', 'omen', 'nitro', 'strix', 'zephyrus', 'alienware'].some(k => lower.includes(k));
  const isCreatorArray = ['macbook', 'xps', 'creator', 'studio', 'proart', 'vivobook pro', 'zenbook pro'].some(k => lower.includes(k));
  const isUltrabook = ['ultrabook', 'zenbook', 'spectre', 'swift', 'air', 'slim', 'gram', 'surface', 'matebook'].some(k => lower.includes(k));
  const isBudget = ['budget', 'aspire', 'ideapad', 'vivobook', 'inspiron', 'chromebook', 'vostro'].some(k => lower.includes(k));
  
  if (isGaming) use = 'Gaming';
  else if (isCreatorArray) use = 'Creator';
  else if (isUltrabook) use = 'Ultrabook';
  else if (isBudget) use = 'Budget';

  // 4. Resolve Spec Chips (CPU / GPU / RAM)
  const specs2 = specs.split('/').slice(0, 3).map(s => s.trim()).join(' / ');

  // 5. Build Detail Table
  const table = {};
  specs.split('/').forEach(seg => {
    const s = seg.trim();
    if (!s) return;
    if (/ryzen|intel|apple m|core i|athlon|celeron|pentium/i.test(s)) table['CPU'] = s;
    else if (/rtx|rx |gtx|radeon|iris|uhd|gpu|graphics/i.test(s)) table['GPU'] = s;
    else if (/gb\s*ddr|gb\s*lpddr|gb\s*unified|ram/i.test(s)) table['RAM'] = s;
    else if (/tb|gb\s*nvme|gb\s*ssd|emmc|hdd/i.test(s)) table['Storage'] = s;
    else if (/hz|fhd|qhd|4k|oled|retina|ips|display/i.test(s)) table['Display'] = s;
  });
  
  if (!Object.keys(table).length) table['Details'] = specs;

  return { use, brand, screen, specs2, table };
}

function _getLaptopMeta(productId, product) {
  // Always derive dynamically to ensure data consistency
  return _buildCustomLaptopMeta(product);
}

let currentLaptopFilter = 'All';

function renderLaptopTags() {
  const el = document.getElementById('laptopTags');
  if (!el) return;
  el.innerHTML = LAPTOP_CATEGORIES_NAV.map(c =>
    `<button class="laptop-tag ${currentLaptopFilter === c ? 'active' : ''}"
             onclick="setLaptopFilter('${c}')">${c}</button>`
  ).join('');
}

function setLaptopFilter(cat) {
  currentLaptopFilter = cat;
  renderLaptopTags();
  renderLaptops();
}

function renderLaptops() {
  const el = document.getElementById('laptopsGrid');
  if (!el) return;
  const q = (document.getElementById('laptopSearch')?.value || '').toLowerCase();
  const sort = document.getElementById('laptopSort')?.value || 'default';
  const _customProds = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_products') || '[]'); } catch (e) { return []; } })();
  const _allProds = [...(typeof _getAllProducts === 'function' ? _getAllProducts() : [])];
  let items = _allProds.filter(p => p.cat === 'Laptop');
  if (currentLaptopFilter !== 'All') {
    items = items.filter(p => {
      const m = _getLaptopMeta(p.id, p);
      return m && m.use === currentLaptopFilter;
    });
  }
  if (q) items = items.filter(p =>
    p.name.toLowerCase().includes(q) || p.specs.toLowerCase().includes(q)
  );
  if (sort === 'price-asc') items = [...items].sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') items = [...items].sort((a, b) => b.price - a.price);
  if (sort === 'name') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const _lapSubEl = document.getElementById('laptopSubtitle');
  if (_lapSubEl) {
    const totalLaptops = _allProds.filter(p => p.cat === 'Laptop').length;
    _lapSubEl.textContent = totalLaptops + ' models \u2014 Gaming, Ultrabook, Office and Creator laptops';
  }
  el.innerHTML = items.length
    ? items.map(p => {
      const m = _getLaptopMeta(p.id, p);
      const badge = USE_BADGE[m.use] || 'badge-office';
      const status = typeof getStockStatus !== 'undefined' ? getStockStatus(p.id) : 'normal';
      const isLow = status === 'lowstock';
      const isOOS = status === 'outofstock';
      const chips = (m.specs2 || p.specs).split('/').slice(0, 3)
        .map(s => `<span class="spec-chip">${s.trim()}</span>`).join('');
      const _customImgs = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_images') || '{}'); } catch (e) { return {}; } })();
      const _imgSrc = _customImgs[p.id] || m.imageUrl || null;

      const qtyDisplay = typeof INVENTORY !== 'undefined' ? INVENTORY.getDisplayQty(p.id) : '';
      const qtyClass = isOOS ? 'inv-card-qty inv-card-qty-oos'
        : isLow ? 'inv-card-qty inv-card-qty-low'
          : 'inv-card-qty inv-card-qty-ok';
      const qtyPill = qtyDisplay
        ? `<div class="inv-card-qty-wrap"><span class="${qtyClass}">${qtyDisplay}</span></div>`
        : '';

      return `
        <div class="laptop-card" onclick="openLaptopDetail('${p.id}')">
          <div class="laptop-card-img-col">
            ${_imgSrc
          ? `<img class="laptop-card-img" src="${_imgSrc}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
            <div class="laptop-card-img-placeholder" style="${_imgSrc ? 'display:none' : ''}">${(m.brand || p.cat || 'IMG').substring(0, 4).toUpperCase()}</div>
            ${isLow ? '<div class="stock-badge low-badge">LOW STOCK</div>' : ''}
            ${isOOS ? '<div class="stock-badge oos-badge">OUT OF STOCK</div>' : ''}
          </div>
          <div class="laptop-card-body">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.4rem">
              <span class="laptop-use-badge ${badge}" style="position:static;display:inline-block">${m.use || 'Laptop'}</span>
              ${typeof getProductRatingBadge === 'function' ? getProductRatingBadge(p.id) : ''}
            </div>
            <div class="laptop-brand">${m.brand || ''} ${m.screen ? '· ' + m.screen : ''}</div>
            <div class="laptop-name">${p.name}</div>
            <div class="laptop-spec-chips">${chips}</div>
            ${qtyPill}
            <div class="laptop-footer">
              <div class="laptop-price">&#8369;${getEffectivePrice(p.id).toLocaleString()}</div>
              ${isOOS
                ? `<button class="btn-laptop-add" disabled style="opacity:.4" onclick="event.stopPropagation()">Sold Out</button>`
                : `<button class="btn-laptop-add" onclick="event.stopPropagation();addToCart('${p.id}')">Add to Cart</button>`}
            </div>
          </div>
        </div>`;
    }).join('')
    : '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text3)">No laptops found</div>';
}

function openLaptopDetail(pid) {
  const p = getProduct(pid);
  const m = _getLaptopMeta(pid, p);
  if (!p) return;
  const badge = USE_BADGE[m.use] || 'badge-office';
  const status = typeof getStockStatus !== 'undefined' ? getStockStatus(pid) : 'normal';
  const isOOS = status === 'outofstock';
  document.getElementById('laptopDetailTitle').textContent = p.name;
  const tableRows = m.table
    ? Object.entries(m.table).map(([k, v]) =>
      `<tr><td>${k}</td><td style="color:var(--text)">${v}</td></tr>`).join('')
    : `<tr><td>Specs</td><td style="color:var(--text)">${p.specs}</td></tr>`;
  const _dImgs = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_images') || '{}'); } catch (e) { return {}; } })();
  const _dImg = _dImgs[pid] || m.imageUrl || null;
  const _dImgHtml = _dImg
    ? `<img src="${_dImg}" alt="${p.name}" style="width:100%;height:200px;object-fit:cover;border-radius:10px;display:block;margin-bottom:.75rem">`
    : `<div style="width:100%;height:140px;border-radius:10px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:.75rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--accent);opacity:.5;margin-bottom:.75rem">${(m.brand || p.cat || 'IMG').substring(0, 6).toUpperCase()}</div>`;
  const _custDescs = (function() { try { return JSON.parse(localStorage.getItem('ds_custom_descs') || '{}'); } catch(e) { return {}; } })();
  const _desc = _custDescs[pid] || '';

  document.getElementById('laptopDetailBody').innerHTML = `
  <div class="laptop-detail-grid">
    <div>
      ${_dImgHtml}
      <div style="text-align:center">
        <span class="laptop-use-badge ${badge}" style="position:static;display:inline-block;margin-bottom:.4rem">${m.use || 'Laptop'}</span>
        <div style="font-size:.76rem;color:var(--text3)">${m.brand || ''} ${m.screen ? '· ' + m.screen : ''}</div>
      </div>
    </div>
    <div class="laptop-detail-info">
      <h2>${p.name}</h2>
      <div class="laptop-detail-price">&#8369;${getEffectivePrice(pid).toLocaleString()}</div>
      
      ${_desc ? `<div class="laptop-detail-desc">${_desc}</div>` : ''}

      <table class="laptop-spec-table">${tableRows}</table>
      <div style="margin-top:.9rem;display:flex;gap:.55rem">
        ${isOOS
          ? `<button class="btn-primary" data-add-cart-btn disabled style="opacity:.4;flex:1">Out of Stock</button>`
          : `<button class="btn-primary" data-add-cart-btn style="flex:1" onclick="addToCart('${pid}');document.getElementById('laptopDetailModal').classList.remove('open')">Add to Cart</button>`}
        <button class="btn-secondary" onclick="document.getElementById('laptopDetailModal').classList.remove('open')">Close</button>
      </div>
    </div>
  </div>
  <div id="reviewSection-${pid}" class="laptop-review-wrap"></div>`;
  
  if (typeof renderReviewSection === 'function') {
    renderReviewSection(pid);
  }

  document.getElementById('laptopDetailModal').classList.add('open');
}

// Routing Hooks

const _origShowPage_pkg = window.showPage;
window.showPage = function (id) {
  _origShowPage_pkg(id);
  if (id === 'packages') { renderPkgCatStrip(); renderAllPackages(); }
  if (id === 'laptops') { renderLaptopTags(); renderLaptops(); }
};

//  Modal overlay close handlers 

['pkgCustomizerModal', 'pkgSwapModal', 'laptopDetailModal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', e => {
    if (e.target === el) el.classList.remove('open');
  });
});

//  Initial renders 

renderFeaturedPackages();
renderLaptopTags();
renderLaptops();

/* If the user is on the packages page, ensure it renders on load */
(function() {
  const activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'page-packages') {
    renderPkgCatStrip();
    renderAllPackages();
  }
})();

/* Refresh packages when admin saves changes in another tab */
window.addEventListener('storage', function (e) {
  if (e.key === 'ds_custom_packages') {
    renderFeaturedPackages();
    renderAllPackages();
  }
});

// packages.js loaded
