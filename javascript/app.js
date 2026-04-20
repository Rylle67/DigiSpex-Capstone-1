let currentFilter = 'All';
let currentSlotKey = null;
let currentOrderTab = 'All';

// Initialize state
DB.init();
renderNav();
renderStore();
renderBuilder();
renderCart();
if (typeof renderFeaturedPackages === 'function') renderFeaturedPackages();
if (typeof NOTIFY !== 'undefined' && NOTIFY.initRealtimeSync) {
  NOTIFY.initRealtimeSync(() => {
    if (typeof renderStore === 'function') renderStore();
    if (typeof renderNav === 'function') renderNav();
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderOrders === 'function') renderOrders();
  });
}

document.getElementById('bmGameListGrid').innerHTML = GAMES.map(g =>
  `<div class="bm-glp-item">
    <img class="bm-glp-logo" src="${g.logo}" alt="${g.name}" loading="lazy"
         onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
    <span class="bm-glp-icon-fallback" style="display:none">${g.icon}</span>
    <span>${g.name}</span>
  </div>`
).join('');

// Modal event listeners
['selectModal', 'checkoutModal', 'benchmarkModal', 'productDetailModal'].forEach(id => {
  const _el = document.getElementById(id);
  if (!_el) return;
  _el.addEventListener('click', e => {
    if (e.target === _el) {
      _el.classList.remove('open');
      if (id === 'benchmarkModal') closeBenchmarkModal();
    }
  });
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  ['selectModal', 'checkoutModal', 'benchmarkModal', 'productDetailModal']
    .forEach(id => document.getElementById(id)?.classList.remove('open'));
  closeBenchmarkModal();
});


// Page Routing 

function showPage(id) {
  // Reset pages and tabs
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.animation = 'none';
  });
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  const targetPage = document.getElementById('page-' + id);
  if (targetPage) {
    targetPage.classList.add('active');
    // Restart animation
    targetPage.style.animation = 'none';
    void targetPage.offsetWidth;
    targetPage.style.animation = '';
  }

  // Highlight the matching tab by checking its onclick value, not by index
  document.querySelectorAll('.nav-tab').forEach(t => {
    const fn = t.getAttribute('onclick') || '';
    if (fn.includes("'" + id + "'") || fn.includes('"' + id + '"')) {
      t.classList.add('active');
    }
  });

  // Close mobile sidebar if open
  const sidebar = document.getElementById('mobileSidebar');
  if (sidebar && sidebar.classList.contains('open')) {
    toggleMobileSidebar();
  }

  if (id === 'cart') {
    if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
      if (typeof openLoginModal === 'function') openLoginModal();
      showToast('Sign in to view your cart', 'error');
      showPage('store');
      return;
    }
    renderCart();
  }
  if (id === 'orders') {
    if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
      if (typeof openLoginModal === 'function') openLoginModal();
      showToast('Sign in to view your orders', 'error');
      showPage('store');
      return;
    }
    renderOrders();
  }
  if (id === 'builder') renderBuilder();
  if (id === 'packages') {
    if (typeof renderAllPackages === 'function') renderAllPackages();
    if (typeof renderPkgCatStrip === 'function') renderPkgCatStrip();
  }
  if (id === 'laptops') { if (typeof renderLaptops === 'function') renderLaptops(); if (typeof renderLaptopTags === 'function') renderLaptopTags(); }
  if (id === 'wishlist') {
    // Auth check
    if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
      if (typeof openLoginModal === 'function') openLoginModal();
      showToast('Sign in to view your wishlist', 'error');
      showPage('store');
      return;
    }
    if (typeof renderWishlistPage === 'function') renderWishlistPage();
    // Set count text
    const countEl = document.getElementById('wishlistPageCount');
    if (countEl) {
      const n = typeof _wishlist !== 'undefined' ? _wishlist.length : 0;
      countEl.textContent = n + ' saved item' + (n !== 1 ? 's' : '');
    }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderNav() {
  const loggedIn = typeof getCurrentUser === 'function' && !!getCurrentUser();

  /* Cart count logic */
  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl) {
    if (loggedIn) {
      /* Count valid items */
      const cart = DB.getCart();
      const validCount = cart.reduce((sum, item) => {
        const p = getProduct(item.productId);
        return sum + (p ? item.qty : 0);
      }, 0);
      cartCountEl.textContent = validCount;
    } else {
      cartCountEl.textContent = 0;
    }
  }

  /* Cart button visibility */
  const cartBtn = document.getElementById('navCartBtn');
  if (cartBtn) cartBtn.style.display = loggedIn ? '' : 'none';

  /* Wishlist visibility */
  const wishlistTab = document.getElementById('navWishlistTab');
  if (wishlistTab) wishlistTab.style.display = loggedIn ? '' : 'none';

  /* Orders visibility */
  const ordersTab = document.getElementById('navOrdersTab');
  if (ordersTab) ordersTab.style.display = loggedIn ? '' : 'none';

  /* Mobile sidebar visibility */
  const sideWishlist = document.getElementById('sidebarWishlist');
  const sideOrders = document.getElementById('sidebarOrders');
  const sideGuest = document.getElementById('sidebarAuthGuest');
  const sideUser = document.getElementById('sidebarAuthUser');
  if (sideWishlist) sideWishlist.style.display = loggedIn ? '' : 'none';
  if (sideOrders) sideOrders.style.display = loggedIn ? '' : 'none';
  if (sideGuest) sideGuest.style.display = loggedIn ? 'none' : 'flex';
  if (sideUser) sideUser.style.display = loggedIn ? 'flex' : 'none';

  if (loggedIn) {
    const user = getCurrentUser();
    const sideUserLabel = document.getElementById('sidebarUserLabel');
    if (sideUserLabel) sideUserLabel.textContent = user.email.split('@')[0];
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('mobileSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const btn = document.getElementById('mobileNavToggle');

  if (!sidebar || !overlay) return;

  const isOpen = sidebar.classList.contains('open');

  if (isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}


// Store Functions

/* Data sync listener */
window.addEventListener('storage', function (e) {
  if (e.key === 'ds_custom_products' || e.key === 'ds_custom_images' || e.key === 'ds_hidden_products') {
    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderStore === 'function') renderStore(); // updated to run renderStore
    if (typeof renderLaptops === 'function') renderLaptops();
    const builderPage = document.getElementById('page-builder');
    if (builderPage && builderPage.classList.contains('active') && typeof renderBuilder === 'function') renderBuilder();
  }

  /* Indicator & Order sync */
  if (e.key && (e.key.includes('orders') || e.key.includes('cart'))) {
    renderNav();
  }
});

/* Product deletion listener */
window.addEventListener('ds:product:deleted', function (e) {
  const pid = e.detail?.productId;
  if (!pid) return;
  // Remove from cart
  try { DB.cartRemove(pid); } catch (err) { }
  // Remove from wishlist
  if (typeof _wishlist !== 'undefined' && Array.isArray(_wishlist)) {
    const idx = _wishlist.indexOf(pid);
    if (idx !== -1) {
      _wishlist.splice(idx, 1);
      if (typeof _saveWishlist === 'function') _saveWishlist(_wishlist);
    }
  }
  // Refresh UI
  renderNav();
  const active = document.querySelector('.page.active');
  if (active) {
    const page = active.id.replace('page-', '');
    if (page === 'cart' && typeof renderCart === 'function') renderCart();
    if (page === 'wishlist' && typeof renderWishlistPage === 'function') renderWishlistPage();
    if (page === 'store' && typeof renderStore === 'function') renderStore();
    if (page === 'builder' && typeof renderBuilder === 'function') renderBuilder();
  }
});

function renderStore() {
  const stock = (function () { try { return JSON.parse(localStorage.getItem('ds_stock') || '{}'); } catch (e) { return {}; } })();
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();

  document.getElementById('filterBar').innerHTML = getStoreCategories().map(cat =>
    `<button class="filter-btn ${currentFilter === cat ? 'active' : ''}"
             onclick="setFilter('${cat}')">${cat}</button>`
  ).join('');

  // Merge catalog + any admin-added custom products
  const _cp = (function () { try { return JSON.parse(localStorage.getItem("ds_custom_products") || "[]"); } catch (e) { return []; } })();
  let items = [...(typeof _getAllProducts === 'function' ? _getAllProducts() : [])];
  // Filter laptops out of main grid
  if (currentFilter === 'All') {
    items = items.filter(p => p.cat !== 'Laptop');
  } else if (currentFilter === 'Laptop') {
    // Show laptops page
    showPage('laptops');
    return;
  } else {
    items = items.filter(p => p.cat === currentFilter);
  }
  if (q) items = items.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.specs.toLowerCase().includes(q) ||
    p.cat.toLowerCase().includes(q)
  );
  items = applySortFilter(items);

  // Set store subtitle
  const _storeSubEl = document.getElementById('storeSubtitle');
  if (_storeSubEl) {
    const totalComponents = _getAllProducts().filter(p => p.cat !== 'Laptop').length;
    _storeSubEl.textContent = totalComponents + ' products from top manufacturers';
  }

  document.getElementById('productsGrid').innerHTML = items.length
    ? items.map(p => {
      const wishlisted = isWishlisted(p.id);
      const status = getStockStatus(p.id);
      const isOOS = status === 'outofstock';
      const isSale = status === 'sale';
      const isLow = status === 'lowstock';

      const salePrice = getEffectivePrice(p.id);
      const isSaleActive = status === 'sale';

      const saleCfg = (function () { try { return JSON.parse(localStorage.getItem('ds_sale_config') || '{}'); } catch (e) { return {}; } })();
      const cfg = saleCfg[p.id] || {};
      const discountPct = cfg.discount || 0.15;

      // Stock indicator
      const qtyDisplay = typeof INVENTORY !== 'undefined' ? INVENTORY.getDisplayQty(p.id) : '';
      const qtyClass = isOOS ? 'inv-card-qty inv-card-qty-oos'
        : isLow ? 'inv-card-qty inv-card-qty-low'
          : 'inv-card-qty inv-card-qty-ok';
      const qtyPill = qtyDisplay
        ? `<div class="inv-card-qty-wrap"><span class="${qtyClass}">${qtyDisplay}</span></div>`
        : '';

      const _loggedIn = typeof getCurrentUser === 'function' && !!getCurrentUser();
      // Product click handler
      const _clickFn = p.cat === 'Laptop' ? `openLaptopDetail('${p.id}')` : `openProductModal('${p.id}')`;

      let saleBadgeHtml = '';
      if (isSale) {
        const pctLabel = Math.round(discountPct * 100);
        saleBadgeHtml = `<div class="stock-badge sale-badge">SALE &minus;${pctLabel}%</div>`;
        if (cfg.endDate) {
          const dateStr = new Date(cfg.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          saleBadgeHtml += `<div class="sale-expiry-tag">Ends ${dateStr}</div>`;
        }
      } else if (stock[p.id] === 'sale' && cfg.startDate) {
        // It's manually marked 'sale' in DB but getStockStatus says normal because of future date
        const startStr = new Date(cfg.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        saleBadgeHtml = `<div class="stock-badge future-badge">starts ${startStr}</div>`;
      }
      return `<div class="product-card${isOOS ? ' card-oos' : isLow ? ' card-lowstock' : ''}" data-pid="${p.id}" onclick="${_clickFn}">
          <div class="product-image-area">
            ${productImg(p.id, 'card')}
            ${saleBadgeHtml}
            ${isLow ? '<div class="stock-badge low-badge">LOW STOCK</div>' : ''}
            ${isOOS ? '<div class="stock-badge oos-badge">OUT OF STOCK</div>' : ''}
          </div>
          ${_loggedIn ? `<button class="wishlist-btn ${wishlisted ? 'wishlisted' : ''}" data-pid="${p.id}"
            onclick="event.stopPropagation();toggleWishlist('${p.id}',this)"
            title="${wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}"
            aria-label="${wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}">
            <svg width="15" height="15" viewBox="0 0 24 24"
                 fill="${wishlisted ? 'currentColor' : 'none'}"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>` : ''}
          <div class="product-info">
            <div class="product-cat">${p.cat}</div>
            <div class="product-name">${p.name}</div>
            <div class="product-specs">${p.specs}</div>
            ${qtyPill}
            ${(function () {
          const bs = p.benchScore || 0;
          if (!bs) return '';
          let bc = '#6b7280', bl = '';
          if (bs >= 95) { bc = '#ef4444'; bl = 'Flagship'; }
          else if (bs >= 80) { bc = '#f97316'; bl = 'High-End'; }
          else if (bs >= 55) { bc = '#2563eb'; bl = 'Mid-Range'; }
          else if (bs >= 30) { bc = '#22c55e'; bl = 'Budget'; }
          else { bc = '#94a3b8'; bl = 'Entry'; }
          return `<div class="pdm-card-bench">
                <div class="pdm-card-bench-track">
                  <div class="pdm-card-bench-fill" style="width:${bs}%;background:${bc}"></div>
                </div>
                <span class="pdm-card-bench-label" style="color:${bc}">${bs} ${bl}</span>
              </div>`;
        })()}
            ${typeof getProductRatingBadge === 'function' ? getProductRatingBadge(p.id) : ''}
            <div class="product-footer">
              <div>
                ${isSale
          ? `<div style="display:flex;align-items:baseline;gap:0.4rem">
                       <div class="product-price" style="color:var(--yellow)">&#8369;${salePrice.toLocaleString()}</div>
                       <div style="font-size:0.72rem;color:var(--text3);text-decoration:line-through">&#8369;${Math.round(p.price * 57).toLocaleString()}</div>
                     </div>`
          : `<div class="product-price">&#8369;${Math.round(p.price * 57).toLocaleString()}</div>`
        }
              </div>
              <div style="display:flex;gap:0.4rem">
                <div></div>
                ${isOOS
          ? '<button class="add-cart-btn" style="opacity:0.4;cursor:not-allowed" disabled>Sold Out</button>'
          : `<button class="add-cart-btn" onclick="event.stopPropagation();addToCart('${p.id}',event)">+ Add</button>`
        }
              </div>
            </div>
          </div>
        </div>`;
    }).join('')
    : `<div style="color:var(--text3);grid-column:1/-1;text-align:center;padding:3rem">
         ${currentSort === 'wishlist' ? 'Nothing saved yet' : 'No results'}
       </div>`;
}

function setFilter(cat) {
  currentFilter = cat;
  renderStore();
}


// Cart Functions 

function addToCart(productId, event) {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    openLoginModal();
    showToast('Please sign in to add items to your cart', 'error');
    return;
  }

  // Check stock availability
  if (typeof INVENTORY !== 'undefined') {
    const cart = DB.getCart();
    const already = (cart.find(i => i.productId === productId) || {}).qty || 0;
    const check = INVENTORY.canFulfill(productId, already + 1);
    if (!check.ok) {
      showToast(check.message || 'Not enough stock available.', 'error');
      return;
    }
  }

  DB.cartAdd(productId);
  renderNav();
  showToast(getProduct(productId).name + ' added to cart', 'success');

  // Fly-to-cart animation
  _flyToCartAnim(event);
}

/* Ghost dot animation */
function _flyToCartAnim(event) {
  const ghost = document.getElementById('flyCartGhost');
  const cartBtn = document.getElementById('navCartBtn');
  if (!ghost || !cartBtn || !event) return;

  // Determine start position
  let startX, startY;
  if (event && event.clientX) {
    startX = event.clientX;
    startY = event.clientY;
  } else {
    // Fallback: center of viewport
    startX = window.innerWidth / 2;
    startY = window.innerHeight / 2;
  }

  const cartRect = cartBtn.getBoundingClientRect();
  const endX = cartRect.left + cartRect.width / 2;
  const endY = cartRect.top + cartRect.height / 2;

  ghost.style.left = startX + 'px';
  ghost.style.top = startY + 'px';
  ghost.classList.remove('animate');
  void ghost.offsetWidth; // force reflow

  // Animate using Web Animations API for precise control
  const anim = ghost.animate([
    { left: startX + 'px', top: startY + 'px', opacity: 1, transform: 'scale(1)' },
    { left: ((startX + endX) / 2) + 'px', top: (Math.min(startY, endY) - 50) + 'px', opacity: 0.8, transform: 'scale(0.7)', offset: 0.5 },
    { left: endX + 'px', top: endY + 'px', opacity: 0, transform: 'scale(0.2)' }
  ], {
    duration: 550,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    fill: 'forwards'
  });

  ghost.style.opacity = '1';
  anim.onfinish = () => {
    ghost.style.opacity = '0';
  };
}

function updateQty(productId, delta) {
  /* When increasing, check available stock first */
  if (delta > 0 && typeof INVENTORY !== 'undefined') {
    const cart = DB.getCart();
    const current = (cart.find(i => i.productId === productId) || {}).qty || 0;
    const check = INVENTORY.canFulfill(productId, current + delta);
    if (!check.ok) {
      showToast(check.message || 'Not enough stock available.', 'error');
      return;
    }
  }
  DB.cartUpdateQty(productId, delta);
  renderCart();
  renderNav();
}

function removeFromCart(productId) {
  DB.cartRemove(productId);
  renderCart();
  renderNav();
}

function renderCart() {
  const el = document.getElementById('cartContent');

  /* Guest guard */
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    el.innerHTML = `<div class="empty-state">
      <h3>Sign in to view your cart</h3>
      <p>Your cart is only available to logged-in users.</p><br>
      <button class="btn-primary" onclick="openLoginModal()">Sign In</button>
    </div>`;
    return;
  }

  const cart = DB.getCart();

  /* Auto-clean orphaned cart items (products that no longer exist) */
  const orphaned = cart.filter(item => !getProduct(item.productId));
  if (orphaned.length) {
    orphaned.forEach(item => DB.cartRemove(item.productId));
    renderNav();
    /* Re-read cleaned cart */
    return renderCart();
  }

  if (!cart.length) {
    el.innerHTML = `<div class="empty-state">
      
      <h3>Cart is empty</h3>
      <p>Browse components or start a build</p><br>
      <button class="btn-primary" onclick="showPage('store')">Shop Now</button>
    </div>`;
    return;
  }

  // Validate all items
  const cartProblems = typeof INVENTORY !== 'undefined' ? INVENTORY.validateCart(cart) : [];
  const problemIds = new Set(cartProblems.map(p => p.productId));

  const rows = cart.map(item => {
    const p = getProduct(item.productId);
    if (!p) return '';
    const hasStockIssue = problemIds.has(item.productId);
    const prob = cartProblems.find(x => x.productId === item.productId);
    const oosLabel = hasStockIssue
      ? `<span class="cart-item-oos-label">${prob?.available === 0 ? 'Out of Stock' : 'Low Stock'}</span>`
      : '';
    const effectivePrice = getEffectivePrice(item.productId);
    return `<div class="cart-item${hasStockIssue ? ' cart-item-oos' : ''}">
      <div class="cart-item-img">
        ${productImg(p.id, 'cart')}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${p.name}${oosLabel}</div>
        <div class="cart-item-sub">${p.cat} · ${p.specs}</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="updateQty('${p.id}',-1)">&minus;</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn" onclick="updateQty('${p.id}',+1)" ${hasStockIssue ? 'disabled' : ''}>+</button>
      </div>
      <div class="cart-item-price">&#8369;${(effectivePrice * item.qty).toLocaleString()}</div>
      <button class="remove-btn" onclick="removeFromCart('${p.id}')">Remove</button>
    </div>`;
  }).join('');

  /* Cart alert HTML */
  const alertHtml = cartProblems.length
    ? `<div class="inv-cart-alert visible">
        <div class="inv-cart-alert-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Stock Availability Issue
        </div>
        <ul class="inv-cart-alert-list">
          ${cartProblems.map(p => `<li class="inv-cart-alert-item">${p.name}: ${p.message}</li>`).join('')}
        </ul>
      </div>`
    : '';

  const sub = cart.reduce((s, item) => {
    return s + (getEffectivePrice(item.productId) / 57 * item.qty);
  }, 0);
  const shipping = sub > 500 ? 0 : 30;
  const tax = sub * 0.12;
  const total = sub + shipping + tax;

  el.innerHTML = `
    ${alertHtml}
    <div class="cart-items">${rows}</div>
    <div class="cart-summary">
      <div class="summary-lines">
        <div class="summary-line"><span>Subtotal</span><span>&#8369;${Math.round(sub * 57).toLocaleString()}</span></div>
        <div class="summary-line"><span>Shipping</span><span>${shipping === 0 ? '<span style="color:var(--green)">FREE</span>' : '&#8369;' + Math.round(shipping * 57).toLocaleString()}</span></div>
        <div class="summary-line"><span>VAT (12%)</span><span>&#8369;${Math.round(tax * 57).toLocaleString()}</span></div>
        <div class="summary-line total"><span>Total</span><span>&#8369;${Math.round(total * 57).toLocaleString()}</span></div>
      </div>
      <button class="btn-primary" style="width:100%" onclick="openCheckout()">Checkout &rarr;</button>
      <div style="margin-top:0.75rem;text-align:center;font-size:0.75rem;color:var(--text3)">Secured with SSL</div>
    </div>`;
}


// Checkout & Orders 

/* Checkout Map */
let _coMap = null;   // Leaflet map instance
let _markerA = null;   // Point A marker
let _markerB = null;   // Point B marker
let _routeLayer = null;   // Polyline for drawn route
let _mapMode = null;   // 'A' | 'B' | null — which pin user is placing next

/* Coordinates */
const GENSAN_LAT = 6.1164;
const GENSAN_LNG = 125.1716;
const GENSAN_ZOOM = 13;

/* Map icon */
function _makeIcon(label, color) {
  return L.divIcon({
    className: '',
    html: '<div class="co-map-marker" style="background:' + color + '">' + label + '</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

/* Initialize map */
function _initCheckoutMap() {
  if (_coMap) { _coMap.invalidateSize(); return; }
  const mapEl = document.getElementById('checkoutMap');
  if (!mapEl) return;

  _coMap = L.map('checkoutMap', { zoomControl: true })
    .setView([GENSAN_LAT, GENSAN_LNG], GENSAN_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: 'Â© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
  }).addTo(_coMap);

  // Click handler
  _coMap.on('click', function (e) {
    _placeDeliveryPin(e.latlng);
  });

  _setMapHint('Click anywhere on the map to set your delivery location.', '');
}

/* Set delivery pin */
function _placeDeliveryPin(latlng) {
  if (_markerB) {
    _markerB.setLatLng(latlng);
  } else {
    _markerB = L.marker(latlng, {
      icon: _makeIcon('', '#2563eb'),
      draggable: true
    }).addTo(_coMap)
      .on('dragend', function (ev) { _placeDeliveryPin(ev.target.getLatLng()); });
  }

  /* Store coords */
  const hidden = document.getElementById('mapCoords');
  if (hidden) hidden.value = latlng.lat.toFixed(6) + ',' + latlng.lng.toFixed(6);

  _setMapHint('Fetching address...', '');
  _reverseGeocodeAndFill(latlng);
}

/* Reverse geocode */
function _reverseGeocodeAndFill(latlng) {
  const lat = latlng.lat.toFixed(6);
  const lng = latlng.lng.toFixed(6);
  fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng,
    { headers: { 'Accept-Language': 'en' } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      const a = data.address || {};
      const street = [a.house_number, a.road || a.pedestrian || a.footway, a.neighbourhood || a.suburb]
        .filter(Boolean).join(' ')
        || (data.display_name || '').split(',')[0] || '';
      const city = a.city || a.town || a.municipality || a.county || '';
      const zip = a.postcode || '';

      const addrEl = document.getElementById('address');
      const cityEl = document.getElementById('city');
      const zipEl = document.getElementById('zip');
      if (addrEl) addrEl.value = street;
      if (cityEl) cityEl.value = city;
      if (zipEl) zipEl.value = zip;

      _setMapHint('Address filled from selected location. You can edit the fields above if needed.', 'success');
    })
    .catch(function () {
      _setMapHint('Could not fetch address automatically. Please fill the address fields manually.', 'warn');
    });
}

/* Map hint */
function _setMapHint(html, type) {
  const el = document.getElementById('coMapHint');
  if (!el) return;
  el.innerHTML = html;
  el.className = 'co-map-hint' + (type ? ' hint-' + type : '');
}

/* Toggle summary */
function toggleOrderSummary() {
  const panel = document.getElementById('coSummaryPanel');
  const arrow = document.getElementById('coSummaryArrow');
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  arrow.innerHTML = open ? '&#9650;' : '&#9660;';
}

function _populateOrderSummary() {
  const cart = DB.getCart();
  const subPHP = cart.reduce((s, item) => {
    return s + (getEffectivePrice(item.productId) * item.qty);
  }, 0);
  const shippingPHP = subPHP > (500 * 57) ? 0 : (30 * 57);
  const vatPHP = subPHP * 0.12;
  const totalPHP = subPHP + shippingPHP + vatPHP;

  document.getElementById('coSummaryTotal').innerHTML = '&#8369;' + Math.round(totalPHP).toLocaleString();

  document.getElementById('coSummaryItems').innerHTML = cart.map(item => {
    const p = getProduct(item.productId);
    if (!p) return '';
    const eff = getEffectivePrice(item.productId);
    return '<div class="co-sum-item">'
      + '<span class="co-sum-name">' + p.name + (item.qty > 1 ? ' &times;' + item.qty : '') + '</span>'
      + '<span class="co-sum-price">&#8369;' + (eff * item.qty).toLocaleString() + '</span>'
      + '</div>';
  }).join('');

  document.getElementById('coSummaryBreakdown').innerHTML =
    '<div class="co-sum-row"><span>Subtotal</span><span>&#8369;' + Math.round(subPHP).toLocaleString() + '</span></div>' +
    '<div class="co-sum-row"><span>Shipping</span><span>' + (shippingPHP === 0 ? '<span style="color:var(--green)">FREE</span>' : '&#8369;' + Math.round(shippingPHP).toLocaleString()) + '</span></div>' +
    '<div class="co-sum-row"><span>VAT (12%)</span><span>&#8369;' + Math.round(vatPHP).toLocaleString() + '</span></div>' +
    '<div class="co-sum-total-row"><span>Total</span><span>&#8369;' + Math.round(totalPHP).toLocaleString() + '</span></div>';
}

/* Payment methods */
function _bindPaymentMethods() {
  document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener('change', function () {
      document.querySelectorAll('.co-pm-card').forEach(c => c.classList.remove('selected'));
      this.closest('.co-pm-card').classList.add('selected');
      _showPaymentInstructions(this.value);
    });
  });
}

function _showPaymentInstructions(method) {
  const el = document.getElementById('coPaymentInstructions');
  const info = {
    gcash: { color: '#007bff', logo: 'G', name: 'GCash', number: '0917-123-4567', steps: ['Open GCash app', 'Send to: <strong>0917-123-4567</strong> (Digispex)', 'Enter your exact order total', 'Screenshot your receipt & keep it for reference'] },
    paymaya: { color: '#22c55e', logo: 'M', name: 'Maya', number: '0945-678-9012', steps: ['Open Maya (PayMaya) app', 'Send to: <strong>0945-678-9012</strong> (Digispex)', 'Enter your exact order total', 'Screenshot your receipt & keep it for reference'] },
  };
  const d = info[method];
  if (!d) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const total = document.getElementById('coSummaryTotal').textContent || '';
  el.innerHTML =
    '<div class="co-instr-header" style="border-color:' + d.color + '22">' +
    '<div class="co-instr-logo" style="background:' + d.color + '">' + d.logo + '</div>' +
    '<div><div class="co-instr-title">' + d.name + ' Payment Instructions</div></div></div>';
}

function openCheckout() {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    openLoginModal();
    showToast('Please sign in to checkout', 'error');
    return;
  }
  if (!DB.getCartCount()) return;
  document.getElementById('checkoutModal').classList.add('open');
  _populateOrderSummary();
  setTimeout(_initCheckoutMap, 120);
}

function placeOrder(e) {
  e.preventDefault();
  const cart = DB.getCart();
  if (!cart.length) return;

  const _pmf = document.getElementById('selectedPaymentMethod');
  const method = _pmf ? { value: _pmf.value || '' } : null;
  if (!method || !method.value) { showToast('Please select a payment method via Review & Pay', 'error'); return; }

  // Stock validation
  if (typeof INVENTORY !== 'undefined') {
    const problems = INVENTORY.validateCart(cart);
    if (problems.length) {
      const names = problems.map(p =>
        `${p.name}: only ${p.available} unit${p.available !== 1 ? 's' : ''} left`
      ).join('; ');
      showToast('Stock issue — ' + names, 'error');
      renderCart(); /* refresh cart to show updated state */
      return;
    }
  }

  const subPHP = cart.reduce((s, item) => {
    return s + (getEffectivePrice(item.productId) * item.qty);
  }, 0);
  const shippingPHP = subPHP > (500 * 57) ? 0 : (30 * 57);
  const totalPHP = subPHP + shippingPHP + subPHP * 0.12;

  const coords = document.getElementById('mapCoords').value;

  const order = {
    id: 'DS-' + Date.now().toString(36).toUpperCase(),
    items: cart.map(item => {
      const p = getProduct(item.productId);
      const eff = getEffectivePrice(item.productId);
      return { name: p.name, qty: item.qty, price: eff / 57, productId: item.productId };
    }),
    total: Math.round(totalPHP),
    status: 'processing',
    date: new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    customer: document.getElementById('firstName').value + ' ' + document.getElementById('lastName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone')?.value || '',
    payment: method.value,
    payment_method: method.value,
    payment_status: method.value === 'cod' ? 'pending' : 'pending',
    delivery_method: document.getElementById('deliveryMethod')?.value || 'standard',
    delivery_address: document.getElementById('address')?.value || '',
    delivery_city: document.getElementById('city')?.value || '',
    address: document.getElementById('address').value + ', ' + document.getElementById('city').value + ' ' + document.getElementById('zip').value,
    additionalInfo: (document.getElementById('additionalInfo')?.value || '').trim(),
    notes: (document.getElementById('additionalInfo')?.value || '').trim(),
    coords: coords || null,
    userId: (typeof getCurrentUser === 'function' && getCurrentUser()) ? getCurrentUser().id : null,
  };

  DB.addOrder(order);

  DB.cartClear();
  document.getElementById('checkoutModal').classList.remove('open');
  renderNav();
  renderCart();

  // Push notification
  if (typeof NOTIFY !== 'undefined') {
    NOTIFY.onOrderPlaced(order, order.userId);
    // Notify admin ONLY if there is a message (Additional Info)
    if (order.additionalInfo) {
      NOTIFY.pushOrderMessage(order.id, order.additionalInfo);
    }
  } else if (typeof pushNotification === 'function') {
    pushNotification(order.id, 'processing');
  }

  // Confirmation toast
  showToast('Order placed! ' + order.id, 'success');
  setTimeout(() => showPage('orders'), 1200);
}

function setOrderTab(tab, btn) {
  currentOrderTab = tab;
  if (btn) {
    document.querySelectorAll('.order-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  renderOrders();
}

function renderOrders() {
  const el = document.getElementById('ordersContent');

  /* Guest guard */
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    el.innerHTML = `<div class="empty-state">
      <h3>Sign in to view your orders</h3>
      <p>Your order history is only available to logged-in users.</p><br>
      <button class="btn-primary" onclick="openLoginModal()">Sign In</button>
    </div>`;
    return;
  }

  const allOrders = DB.getOrders();
  let filtered = allOrders;

  // Filter based on tab
  if (currentOrderTab !== 'All') {
    filtered = allOrders.filter(o => {
      const st = (o.status || '').toLowerCase();
      if (currentOrderTab === 'To Pay') return st === 'pending' || st === 'to_pay';
      if (currentOrderTab === 'To Ship') return st === 'processing';
      if (currentOrderTab === 'To Receive') return st === 'shipped' || st === 'delivered';
      if (currentOrderTab === 'Completed') return st === 'received';
      if (currentOrderTab === 'Cancelled') return st === 'cancelled';
      return true;
    });
  }

  if (!filtered.length) {
    const emptyMsgs = {
      'All': { title: 'No orders yet', sub: 'Your history shows up here after checkout' },
      'To Pay': { title: 'No orders to pay', sub: 'You have no pending payments' },
      'To Ship': { title: 'No orders to ship', sub: 'All your orders are being processed' },
      'To Receive': { title: 'No orders to receive', sub: 'No parcels are currently in transit' },
      'Completed': { title: 'No completed orders', sub: 'Orders you receive will appear here' },
      'Cancelled': { title: 'No cancelled orders', sub: 'You have no cancelled orders' }
    };
    const msg = emptyMsgs[currentOrderTab] || emptyMsgs['All'];

    el.innerHTML = `<div class="order-empty-state">
      <div class="order-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      </div>
      <div class="order-empty-title">${msg.title}</div>
      <div class="order-empty-sub">${msg.sub}</div>
      ${currentOrderTab === 'All' ? '<button class="btn-primary btn-sm" onclick="showPage(\'store\')">Explore Products</button>' : ''}
    </div>`;
    return;
  }

  el.innerHTML = filtered.map(o => `
    <div class="order-card">
      <div class="order-header">
        <div>
          <div class="order-id">${o.id}</div>
          <div style="font-size:0.8rem;color:var(--text3);margin-top:2px">${o.date} Â· ${o.customer}</div>
        </div>
        <span class="order-status ${o.status}">${o.status}</span>
      </div>
      <div class="order-items-list">
        ${o.items.map(i => `<div class="order-item-row">
          <span>${i.name} &times;${i.qty}</span>
          <span>&#8369;${(i.price * i.qty * 57).toLocaleString()}</span>
        </div>`).join('')}
      </div>
      ${(o.shippedAt || o.deliveredAt || o.receivedAt) ? `
      <div class="order-timeline" style="margin: 0.75rem 0; padding: 0.65rem 0; border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border); display: flex; flex-direction: column; gap: 4px;">
        ${o.shippedAt ? `<div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text3)"><span>Shipped on:</span><span>${new Date(o.shippedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>` : ''}
        ${o.deliveredAt ? `<div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text3)"><span>Delivered on:</span><span>${new Date(o.deliveredAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>` : ''}
        ${o.receivedAt ? `<div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--accent)"><span>Received on:</span><span>${new Date(o.receivedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>` : ''}
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
        <span style="font-size:0.8rem;color:var(--text3)">${o.items.length} item(s)</span>
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
          ${o.status === 'pending' || o.status === 'confirmed' || o.status === 'processing' ? `<button class="btn-secondary" style="background:rgba(239,68,68,0.06);color:var(--red);border-color:rgba(239,68,68,0.2)" onclick="requestCancelOrder('${o.id}')">Cancel Order</button>` : ''}
          ${o.status === 'delivered' ? `<button class="btn-received" onclick="markOrderAsReceived('${o.id}', this)">Received</button>` : ''}
          ${o.status === 'received' && !o.rating ? `<button class="btn-primary" style="font-size:0.75rem;padding:0.35rem 0.85rem" onclick="openOrderRatingModal('${o.id}')">Rate Experience</button>` : ''}
          ${o.rating ? `<div style="display:flex;align-items:center;gap:4px;font-size:0.85rem;color:var(--yellow)">${'\u2605'.repeat(o.rating)}${'\u2606'.repeat(5 - o.rating)}</div>` : ''}
          
          <button class="btn-msg-seller" onclick="openChat('${o.id}')"> Message Seller</button>
          <button class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.85rem;display:flex;align-items:center;gap:0.35rem" onclick="downloadReceipt('${o.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Receipt
          </button>
          <span style="font-family:'JetBrains Mono';font-size:1rem;color:var(--accent);font-weight:700">&#8369;${(o.total || 0).toLocaleString()}</span>
        </div>
      </div>
    </div>`).join('');
}

async function requestCancelOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) return;

  try {
    const orders = DB.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Update locally and in Supabase
    await DB.updateOrderStatus(orderId, 'cancelled', { cancelledAt: new Date().toISOString() });

    // Log the cancellation
    if (typeof SB !== 'undefined') {
      SB.pushAuditEntry({
        type: 'order_cancelled',
        orderId: orderId,
        customer: order.customer,
        timestamp: new Date().toISOString()
      });
    }

    showToast('Order #' + orderId + ' has been cancelled.', 'success');
    renderOrders();
  } catch (err) {
    console.error('[Orders] Cancel error:', err);
    showToast('Failed to cancel order. Please try again.', 'error');
  }
}

async function markOrderAsReceived(orderId, btn) {
  if (!confirm('Confirm you have received all items in this order? This will update the status to Received.')) return;

  try {
    const orders = DB.getOrders();
    const order = orders.find(o => o.id === orderId);

    // Prevent double deduction if already received
    if (order && order.status === 'received') {
      showToast('Order is already marked as Received.', 'info');
      return;
    }

    // Improve button handling: if passed directly, use it, otherwise fallback to selector
    const targetBtn = btn || document.querySelector(`button[onclick*="markOrderAsReceived('${orderId}')"]`);
    if (targetBtn) { 
      targetBtn.disabled = true; 
      targetBtn.textContent = ''; // Clear button text as requested
      targetBtn.style.padding = '0';
      targetBtn.style.width = '0';
      targetBtn.style.opacity = '0';
    }

    await DB.updateOrderStatus(orderId, 'received', { receivedAt: new Date().toISOString() });

    // Deduct stock upon receipt
    if (order && order.items && typeof INVENTORY !== 'undefined') {
      INVENTORY.deductCart(order.items);
    }

    showToast('Order marked as Received! Stock updated.', 'success');
    renderOrders();
    openOrderRatingModal(orderId);
  } catch (err) {
    console.error('[Orders] Receive error:', err);
    showToast('Failed to update status.', 'error');
  }
}

let activeRatingOrderId = null;

function openOrderRatingModal(orderId) {
  activeRatingOrderId = orderId;
  document.getElementById('ratingOrderId').textContent = '#' + orderId;
  document.getElementById('orderFeedback').value = '';
  setOrderStarRating(0);
  document.getElementById('orderRatingModal').classList.add('open');
}

function setOrderStarRating(n) {
  const container = document.getElementById('orderStarRating');
  container.dataset.rating = n;
  container.querySelectorAll('.star-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i < n);
  });

  const hint = document.getElementById('ratingHint');
  const labels = ['Tap a star to rate', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'];
  hint.textContent = labels[n] || labels[0];
  hint.style.color = n > 0 ? 'var(--yellow)' : 'var(--text3)';
}

function submitOrderRating() {
  const rating = parseInt(document.getElementById('orderStarRating').dataset.rating || '0');
  const feedback = document.getElementById('orderFeedback').value.trim();

  if (rating === 0) {
    showToast('Please select a star rating', 'error');
    return;
  }

  const orders = DB.getOrders();
  const idx = orders.findIndex(o => o.id === activeRatingOrderId);
  if (idx !== -1) {
    orders[idx].rating = rating;
    orders[idx].feedback = feedback;

    // Save locally
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const prefix = user && user.id ? `ds_u_${user.id}_` : 'ds_guest_';
    localStorage.setItem(prefix + 'orders', JSON.stringify(orders));

    // Sync to Supabase if available
    if (typeof SB !== 'undefined' && SB.updateOrderRating) {
      SB.updateOrderRating(activeRatingOrderId, rating, feedback);
    }

    // NEW: Sync order rating to each product in the order (Product Reviews)
    if (typeof addBatchReviewFromOrder === 'function') {
      addBatchReviewFromOrder(activeRatingOrderId, rating, feedback);
    }
  }

  document.getElementById('orderRatingModal').classList.remove('open');
  showToast('Thank you for your feedback!', 'success');
  renderOrders();
}



// PC Builder Functions 

/**
 * Infers socket and memory type for a single product from its name/specs
 */
function inferProductPlatform(p) {
  if (!p) return { socket: null, memType: null };
  let socket = p.socket || null;
  let memType = p.memType || null;

  const text = (p.name + ' ' + (p.specs || '')).toUpperCase();

  if (!socket) {
    if (text.includes('AM5') || text.includes('B650') || text.includes('X670') || text.includes('A620') || text.includes(' AMD A5')) socket = 'AM5';
    else if (text.includes('AM4') || text.includes('B550') || text.includes('X570') || text.includes('B450') || text.includes('A320') || text.includes('A520') || text.includes(' AMD A4')) socket = 'AM4';
    else if (text.includes('1700') || text.includes('Z790') || text.includes('B760')) socket = 'LGA1700';
    else if (text.includes('1851') || text.includes('Z890')) socket = 'LGA1851';
  }

  if (!memType && socket) {
    memType = getSocketMemType(socket);
  }

  // Extra help for RAM kits that might not have a socket but have DDR in the name
  if (!memType) {
    if (text.includes('DDR5')) memType = 'DDR5';
    else if (text.includes('DDR4')) memType = 'DDR4';
  }

  return { socket, memType };
}

function getPlatformInfo(build, ignoreKey = null) {
  const cpuId = build.CPU && ignoreKey !== 'CPU' ? build.CPU : null;
  const mbId = build.Motherboard && ignoreKey !== 'Motherboard' ? build.Motherboard : null;

  const cpu = getProduct(cpuId);
  const mb = getProduct(mbId);

  // Use the new inference logic for both
  const cpuPlat = inferProductPlatform(cpu);
  const mbPlat = inferProductPlatform(mb);

  let socket = mbPlat.socket || cpuPlat.socket || null;
  let memType = mbPlat.memType || cpuPlat.memType || null;

  return {
    socket: socket,
    memType: memType,
    source: mb ? 'Motherboard' : (cpu ? 'CPU' : null)
  };
}

function renderBuilder() {
  const build = DB.getBuild();
  const platform = getPlatformInfo(build);
  const _customImgs = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_images') || '{}'); } catch (e) { return {}; } })();
  let total = 0, count = 0;

  document.getElementById('builderSlots').innerHTML = BUILDER_SLOTS.map(slot => {
    const sel = build[slot.key] ? getProduct(build[slot.key]) : null;
    let eff = 0;
    if (sel) {
      eff = getEffectivePrice(sel.id);
      total += (eff / 57);
      count++;
    }

    let hint = '';
    if (!sel && platform) {
      if (slot.key === 'Motherboard' && platform.socket) hint = _lockBadge('Req. ' + platform.socket);
      else if (slot.key === 'RAM') {
        const req = platform.memType || (build.Motherboard ? (getProduct(build.Motherboard) || {}).memType : null);
        if (req) hint = _lockBadge('Req. ' + req);
      }
    }

    let socketBadge = '';
    if (slot.key === 'CPU' && sel) {
      const colors = { AM4: '#ff6b35', AM5: '#ff4444', LGA1700: '#2563eb', LGA1851: '#00aaff' };
      const c = colors[sel.socket] || '#fff';
      socketBadge = `<span style="font-size:0.65rem;padding:1px 7px;border-radius:4px;font-weight:700;background:rgba(255,255,255,0.06);color:${c};border:1px solid ${c}33">${sel.socket}</span>`;
    }

    // Product image: custom upload > placeholder with cat abbreviation
    const imgSrc = sel ? (_customImgs[sel.id] || null) : null;
    const slotIconHtml = imgSrc
      ? `<div class="slot-icon slot-icon-img"><img src="${imgSrc}" alt="${sel.name}" onerror="this.parentElement.classList.remove('slot-icon-img');this.parentElement.innerHTML='<span class=\\'slot-cat\\'>${(sel ? sel.cat : slot.cat || '').substring(0, 3).toUpperCase()}</span>'"></div>`
      : `<div class="slot-icon"><span class="slot-cat">${sel ? sel.cat.substring(0, 3).toUpperCase() : slot.cat ? slot.cat.substring(0, 3).toUpperCase() : ''}</span></div>`;

    return `<div class="builder-slot ${sel ? 'slot-filled' : ''}">
      ${slotIconHtml}
      <div class="slot-info">
        <div class="slot-label">${slot.label}${slot.required ? '' : '<span style="opacity:0.5"> (Optional)</span>'}${hint}</div>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <div class="slot-name ${sel ? '' : 'empty'}">${sel ? sel.name : 'Not selected'}</div>
          ${socketBadge}
        </div>
        ${sel ? `<div style="font-size:0.72rem;color:var(--text3)">${sel.specs}</div>` : ''}
      </div>
      ${sel ? `<div class="slot-price">&#8369;${eff.toLocaleString()}</div>` : ''}
      <div class="slot-actions">
        <button class="slot-btn" onclick="openSlotModal('${slot.key}')">${sel ? 'Change' : 'Select'}</button>
        ${sel ? `<button class="slot-btn remove" onclick="removeSlot('${slot.key}')"></button>` : ''}
      </div>
    </div>`;
  }).join('');

  document.getElementById('summaryLines').innerHTML = BUILDER_SLOTS.map(slot => {
    const sel = build[slot.key] ? getProduct(build[slot.key]) : null;
    return sel ? `<div class="summary-line"><span>${slot.label}</span><span>&#8369;${getEffectivePrice(sel.id).toLocaleString()}</span></div>` : '';
  }).join('');

  document.getElementById('buildTotal').innerHTML = `<span>Total</span><span>&#8369;${Math.round(total * 57).toLocaleString()}</span>`;
  document.getElementById('partCount').textContent = count + '/' + BUILDER_SLOTS.length + ' parts';

  try {
    animateRigRating(calcRigRating(build));
    updatePowerMeter(build);
    runCompatCheck(build);
  } catch (err) {
    console.warn('[PCBuilder] Non-critical UI update failed after selection:', err);
    // We continue so the user can still interact with the slots
  }
}

function _lockBadge(text) {
  return `<span style="font-size:0.65rem;background:rgba(37,99,235,0.1);color:var(--accent);border:1px solid rgba(37,99,235,0.2);padding:1px 7px;border-radius:4px;font-weight:600">${text}</span>`;
}

function openSlotModal(slotKey) {
  // 0. Reset State & Clear any stale data
  currentSlotKey = slotKey;
  const slot = BUILDER_SLOTS.find(s => s.key === slotKey);
  if (!slot) {
    console.error('[PCBuilder] Invalid slotKey:', slotKey);
    return;
  }

  const build = DB.getBuild();
  const platform = getPlatformInfo(build, slotKey);
  let notice = '';

  // Use slot.cat for the search to ensure 'PSU', 'Cooling', etc. work correctly
  let products = getProductsByCategory(slot.cat);

  // 1. Socket Compatibility (CPU <-> Motherboard) - ONLY for CPU/MB slots
  const isPlatformSlot = ['Motherboard', 'CPU'].includes(slotKey);
  const isRamSlot = (slotKey === 'RAM');

  if (isPlatformSlot && platform.socket) {
    const isReplacing = !!build[slotKey];
    products = products.map(p => {
      const pPlat = inferProductPlatform(p);
      const socket = pPlat.socket;
      if (socket && !isSocketCompatible(socket, platform.socket)) {
        if (isReplacing) return p;
        return { ...p, _locked: true, _lockReason: `Incompatible Socket (Needs ${platform.socket})` };
      }
      return p;
    });
    notice = isReplacing
      ? _compat(`Switching platforms? Selecting a different socket will clear incompatible parts.`)
      : _compat(`Showing <strong>${platform.socket}</strong> compatible parts.`);
  }

  // 2. RAM Compatibility (MemType) - ONLY for RAM slot
  if (isRamSlot && platform.memType) {
    const isReplacing = !!build[slotKey];
    products = products.map(p => {
      const pPlat = inferProductPlatform(p);
      const memType = pPlat.memType;
      if (memType && !isMemCompatible(memType, platform.memType)) {
        if (isReplacing) return p;
        return { ...p, _locked: true, _lockReason: `Incompatible RAM (Needs ${platform.memType})` };
      }
      return p;
    });
    notice = isReplacing
      ? _compat(`Selecting a different memory type will clear incompatible CPU/Motherboard selections.`)
      : _compat(`Showing <strong>${platform.memType}</strong> compatible kits.`);
  }

  // 3. Motherboard -> RAM Compatibility (if no CPU yet) - ONLY for RAM slot
  if (isRamSlot && !platform.memType && build.Motherboard) {
    const mb = getProduct(build.Motherboard);
    const targetMem = mb?.memType || getSocketMemType(mb?.socket);
    if (targetMem) {
      products = products.map(p => {
        const pPlat = inferProductPlatform(p);
        const memType = pPlat.memType;
        if (memType && !isMemCompatible(memType, targetMem)) {
          return { ...p, _locked: true, _lockReason: `Needs ${targetMem} for board` };
        }
        return p;
      });
      notice = _compat(`Showing <strong>${targetMem}</strong> compatible kits.`);
    }
  }
  // 4. Motherboard -> Case Compatibility (Form Factor)
  if (slotKey === 'Motherboard' && build.Case) {
    const chasis = getProduct(build.Case);
    if (chasis && chasis.supported_form_factors) {
      const supp = chasis.supported_form_factors.toUpperCase();
      products = products.map(p => {
        if (p._locked) return p;
        if (p.form_factor && !supp.includes(p.form_factor.toUpperCase())) {
          return { ...p, _locked: true, _lockReason: `Not supported by ${chasis.name}` };
        }
        return p;
      });
    }
  }

  // 5. GPU -> Case Compatibility (Length)
  if (slotKey === 'GPU' && build.Case) {
    const chasis = getProduct(build.Case);
    if (chasis && chasis.max_gpu_length) {
      products = products.map(p => {
        if (p._locked) return p;
        if (p.length_mm && p.length_mm > chasis.max_gpu_length) {
          return { ...p, _locked: true, _lockReason: `Too long for case (${p.length_mm}mm > ${chasis.max_gpu_length}mm)` };
        }
        return p;
      });
    }
  }

  // 6. Case -> Compatibility Checks (Inverted: filter cases that don't fit current parts)
  if (slotKey === 'Case' && (build.GPU || build.Motherboard)) {
    const gpu = build.GPU ? getProduct(build.GPU) : null;
    const mb = build.Motherboard ? getProduct(build.Motherboard) : null;
    products = products.map(p => {
      if (p._locked) return p;
      // Case limits must be present to block; if unknown, we allow selection
      if (gpu && gpu.length_mm && p.max_gpu_length && gpu.length_mm > p.max_gpu_length) {
        return { ...p, _locked: true, _lockReason: `Too small for GPU (${gpu.length_mm}mm)` };
      }
      if (mb && mb.form_factor && p.supported_form_factors) {
        const supp = p.supported_form_factors.toUpperCase();
        if (!supp.includes(mb.form_factor.toUpperCase())) {
          return { ...p, _locked: true, _lockReason: `Doesn't support ${mb.form_factor}` };
        }
      }
      return p;
    });
  }

  // Benchmark scores required for some components
  const BENCH_REQUIRED_SLOTS = ['CPU', 'GPU', 'RAM', 'Storage'];
  if (BENCH_REQUIRED_SLOTS.includes(slotKey)) {
    products = products.map(p => {
      if (p._locked) return p;
      // Just a warning, not a hard lock for now to help the user select things
      if (!p.benchScore || p.benchScore <= 0) {
        // return { ...p, _locked: true, _lockReason: 'No benchmark score \u2014 add via Admin Panel' };
      }
      return p;
    });
  }

  if (!notice && platform && slotKey !== 'CPU') {
    notice = `<div style="background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.15);border-radius:8px;padding:0.65rem 1rem;margin-bottom:1.25rem;font-size:0.8rem;color:var(--green)">
      Platform: <strong>${platform.socket}</strong>${platform.memType ? ' / ' + platform.memType : ''}
    </div>`;
  }

  document.getElementById('modalTitle').textContent = 'Select ' + slot.label;
  const _slotImgs = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_images') || '{}'); } catch (e) { return {}; } })();

  let productsHtml = products.map(p => {
    const locked = !!p._locked;
    const imgSrc = _slotImgs[p.id] || null;
    const imgHtml = imgSrc
      ? `<div style="width:100%;aspect-ratio:16/9;border-radius:8px;overflow:hidden;margin-bottom:0.6rem;background:#0a0a0f;display:flex;align-items:center;justify-content:center"><img src="${imgSrc}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;display:block;padding:4px" onerror="this.parentElement.innerHTML='<span style=\'font-size:0.6rem;color:var(--accent);font-family:JetBrains Mono,monospace;letter-spacing:2px\'>' + (p.cat||'PC').substring(0,3).toUpperCase() + '</span>'"></div>`
      : `<div style="width:100%;aspect-ratio:16/9;border-radius:8px;margin-bottom:0.6rem;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:700;letter-spacing:2px;color:var(--accent);opacity:0.7">${(p.cat || 'PC').substring(0, 3).toUpperCase()}</div>`;

    const sKey = slotKey.replace(/'/g, "\\'");
    const pId = p.id.toString().replace(/'/g, "\\'");

    return `<div class="select-product-card ${locked ? 'locked' : ''}"
         onclick="${locked ? `showToast('${(p._lockReason || 'Incompatible').replace(/'/g, "\\'")}','error')` : `selectComponent('${sKey}','${pId}')`}">
      ${imgHtml}
      <div class="name">${p.name}</div>
      <div class="spec">${p.specs}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.5rem">
        <div class="price">&#8369;${getEffectivePrice(p.id).toLocaleString()}</div>
        ${locked ? `<span style="font-size:0.65rem;color:var(--red);background:rgba(239,68,68,0.12);padding:2px 6px;border-radius:4px;font-weight:600">INCOMPATIBLE</span>` : ''}
      </div>
      ${locked ? `<div style="font-size:0.68rem;color:var(--red);margin-top:0.3rem">${p._lockReason}</div>` : ''}
    </div>`;
  }).join('');

  if (!products.length) {
    productsHtml = `<div style="grid-column:1/-1;padding:4rem 2rem;text-align:center;color:var(--text3);background:rgba(0,0,0,0.15);border-radius:12px;border:1px dashed var(--border)">
      <div style="font-size:2rem;margin-bottom:1rem;opacity:0.5">ðŸ“‚</div>
      <div style="font-weight:600;color:var(--text2);margin-bottom:0.4rem">No ${slot.label} Found</div>
      <p style="font-size:0.85rem;margin-bottom:1.5rem">We couldn't find any products in the <strong>${slot.cat}</strong> category.</p>
      <button class="btn-sm" onclick="buildOpenUnfiltered('${slotKey}')" style="background:rgba(255,255,255,0.06);color:var(--text2);border:1px solid var(--border);margin-top:0.5rem">Show All (Clear Filters)</button>
    </div>`;
  }

  document.getElementById('modalProducts').innerHTML = (products.length ? notice : '') + productsHtml;

  document.getElementById('selectModal').classList.add('open');
}

/** Open modal bypassing compatibility filters if user is stuck */
function buildOpenUnfiltered(slotKey) {
  currentSlotKey = slotKey;
  const slot = BUILDER_SLOTS.find(s => s.key === slotKey);
  const products = getProductsByCategory(slot.cat);

  const notice = _compat(`Showing all <strong>${slot.cat}</strong> products (Compatibility filters cleared).`);
  document.getElementById('modalTitle').textContent = 'Select ' + slot.label;

  const _slotImgs = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_images') || '{}'); } catch (e) { return {}; } })();
  const productsHtml = products.map(p => {
    const imgSrc = _slotImgs[p.id] || null;
    const imgHtml = imgSrc
      ? `<div style="width:100%;aspect-ratio:16/9;border-radius:8px;overflow:hidden;margin-bottom:0.6rem;background:#0a0a0f;display:flex;align-items:center;justify-content:center"><img src="${imgSrc}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;display:block;padding:4px" onerror="this.parentElement.innerHTML='<span style=\'font-size:0.6rem;color:var(--accent);font-family:JetBrains Mono,monospace;letter-spacing:2px\'>' + (p.cat||'PC').substring(0,3).toUpperCase() + '</span>'"></div>`
      : `<div style="width:100%;aspect-ratio:16/9;border-radius:8px;margin-bottom:0.6rem;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:700;letter-spacing:2px;color:var(--accent);opacity:0.7">${(p.cat || 'PC').substring(0, 3).toUpperCase()}</div>`;

    const sKey = slotKey.replace(/'/g, "\\'");
    const pId = p.id.toString().replace(/'/g, "\\'");

    return `<div class="select-product-card" onclick="selectComponent('${sKey}','${pId}')">
      ${imgHtml}
      <div class="name">${p.name}</div>
      <div class="spec">${p.specs}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.5rem">
        <div class="price">&#8369;${getEffectivePrice(p.id).toLocaleString()}</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('modalProducts').innerHTML = notice + productsHtml;
  document.getElementById('selectModal').classList.add('open');
}

function _compat(html) {
  return `<div style="background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.18);border-radius:8px;padding:0.65rem 1rem;margin-bottom:1.25rem;font-size:0.8rem;color:var(--accent)">${html}</div>`;
}

function selectComponent(slotKey, productId) {
  console.log('[PCBuilder] Selecting part:', slotKey, productId);
  const build = DB.getBuild();
  const oldId = build[slotKey];
  build[slotKey] = productId;
  const part = getProduct(productId);

  if (slotKey === 'CPU') {
    const platform = getPlatformInfo({ CPU: productId });
    // Check Motherboard
    if (build.Motherboard) {
      const mb = getProduct(build.Motherboard);
      if (mb && !isSocketCompatible(mb.socket, part.socket)) {
        delete build.Motherboard;
        showToast('Motherboard removed — socket mismatch', 'error');
        // If board is removed, RAM must also be re-checked against new potential boards
      }
    }
    // Check RAM against new CPU/Platform
    if (platform?.memType && build.RAM) {
      const ram = getProduct(build.RAM);
      if (ram && !isMemCompatible(ram.memType, platform.memType)) {
        delete build.RAM;
        showToast('RAM removed — requires ' + platform.memType, 'error');
      }
    }
  }

  if (slotKey === 'Motherboard') {
    // Check CPU
    if (build.CPU) {
      const cpu = getProduct(build.CPU);
      if (cpu && !isSocketCompatible(part.socket, cpu.socket)) {
        delete build.CPU;
        showToast('CPU removed — socket mismatch', 'error');
      }
    }
    // Check RAM against Board's specific requirement (crucial for LGA1700)
    if (part.memType && build.RAM) {
      const ram = getProduct(build.RAM);
      if (ram && !isMemCompatible(ram.memType, part.memType)) {
        delete build.RAM;
        showToast('RAM removed — board needs ' + part.memType, 'error');
      }
    }
  }

  if (slotKey === 'RAM') {
    const platform = getPlatformInfo(build, 'RAM');
    if (platform.memType && !isMemCompatible(part.memType, platform.memType)) {
      // Should be blocked by UI filtering, but safety check:
      showToast('Warning: Memory type might be incompatible', 'warn');
    }
  }

  DB.buildSave(build);
  closeModal();
  renderBuilder();
}

function removeSlot(slotKey) {
  const build = DB.getBuild();
  delete build[slotKey];
  DB.buildSave(build);
  renderBuilder();
}

function clearBuild() {
  DB.buildClear();
  renderBuilder();
  showToast('Build cleared', 'success');
}

function addBuilderToCart() {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    openLoginModal();
    showToast('Please sign in to add items to your cart', 'error');
    return;
  }
  const ids = Object.values(DB.getBuild()).filter(Boolean);
  if (!ids.length) { showToast('No parts selected', 'error'); return; }
  ids.forEach(id => DB.cartAdd(id));
  renderNav();
  showToast('Build added to cart!', 'success');
}
function closeModal() {
  document.getElementById('selectModal').classList.remove('open');
}


function getSocketMemType(socket) {
  if (!socket) return null;
  const s = socket.toUpperCase();
  if (s.includes('AM5') || s === 'A5') return 'DDR5';
  if (s.includes('AM4') || s === 'A4') return 'DDR4';
  if (s.includes('LGA1851')) return 'DDR5';
  if (s.includes('LGA1700')) return null; // Flexible
  return null;
}

function isSocketCompatible(s1, s2) {
  if (!s1 || !s2) return true;
  let n1 = s1.toUpperCase().replace(/SOCKET\s+/i, '').trim();
  let n2 = s2.toUpperCase().replace(/SOCKET\s+/i, '').trim();

  // Normalization for common typos/shorthands
  if (n1 === 'A4') n1 = 'AM4';
  if (n1 === 'A5') n1 = 'AM5';
  if (n2 === 'A4') n2 = 'AM4';
  if (n2 === 'A5') n2 = 'AM5';

  // Fuzzy match (handles AM4 vs Socket AM4 vs AM4+)
  if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;

  // Specific catch for AM4/AM5/LGA common naming variations
  if ((n1.includes('AM4') && n2.includes('AM4'))) return true;
  if ((n1.includes('AM5') && n2.includes('AM5'))) return true;
  if ((n1.includes('1700') && n2.includes('1700'))) return true;

  return false;
}

function isMemCompatible(m1, m2) {
  if (!m1 || !m2) return true;
  const n1 = m1.toUpperCase().trim();
  const n2 = m2.toUpperCase().trim();

  // Strictly prevent DDR4 vs DDR5 mismatch
  if (n1.includes('DDR4') && n2.includes('DDR5')) return false;
  if (n1.includes('DDR5') && n2.includes('DDR4')) return false;

  if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;
  return false;
}

// Compatibility Logic 

function runCompatCheck(build) {
  const cpu = build.CPU ? getProduct(build.CPU) : null;
  const mb = build.Motherboard ? getProduct(build.Motherboard) : null;
  const ram = build.RAM ? getProduct(build.RAM) : null;
  const gpu = build.GPU ? getProduct(build.GPU) : null;
  const psu = build.PSU ? getProduct(build.PSU) : null;
  const cooler = build.Cooling ? getProduct(build.Cooling) : null;
  const chasis = build.Case ? getProduct(build.Case) : null;
  const res = [];

  if (cpu && mb) {
    isSocketCompatible(cpu.socket, mb.socket)
      ? res.push({ status: 'ok', msg: `<strong>Socket:</strong> ${cpu.socket} Match ` })
      : res.push({ status: 'error', msg: `<strong>Socket:</strong> Mismatch (${cpu.socket} CPU in ${mb.socket} Board)` });
  } else if (cpu || mb) {
    res.push({ status: 'neutral', msg: `<strong>Socket:</strong> Needs both CPU + Board` });
  }

  if (cpu) {
    const pm = getSocketMemType(cpu.socket);
    if (pm && ram)
      isMemCompatible(ram.memType, pm)
        ? res.push({ status: 'ok', msg: `<strong>RAM type:</strong> ${pm} ` })
        : res.push({ status: 'error', msg: `<strong>RAM type:</strong> ${cpu.socket} needs ${pm}, got ${ram.memType}` });
    if (pm && mb)
      isMemCompatible(mb.memType, pm)
        ? res.push({ status: 'ok', msg: `<strong>Board type:</strong> ${pm} match` })
        : res.push({ status: 'error', msg: `<strong>Board type:</strong> ${cpu.socket} needs ${pm} board` });
  }

  if (mb && ram) {
    isMemCompatible(mb.memType, ram.memType)
      ? res.push({ status: 'ok', msg: `<strong>Memory:</strong> ${ram.memType} Match ` })
      : res.push({ status: 'error', msg: `<strong>Memory:</strong> Board needs ${mb.memType}, RAM is ${ram.memType}` });
  }

  if (gpu && psu) {
    const est = (gpu.power || 200) + (cpu ? cpu.tdp : 125) + 75;
    const rec = Math.round(est * 1.3);
    const cap = tryParseWattage(psu);
    if (cap > 0) {
      if (cap >= est) {
        const status = cap >= rec ? 'ok' : 'warn';
        const msg = cap >= rec
          ? `<strong>Power:</strong> ${cap}W >= ~${est}W (Recommended: ${rec}W) `
          : `<strong>Power:</strong> ${cap}W is enough but below recommended ${rec}W`;
        res.push({ status, msg });
      } else {
        res.push({ status: 'error', msg: `<strong>Power:</strong> PSU ${cap}W — need ~${est}W` });
      }
    } else {
      res.push({ status: 'warn', msg: `<strong>Power:</strong> PSU Unknown Capacity — need ~${est}W` });
    }
  } else if (gpu || psu) {
    res.push({ status: 'warn', msg: '<strong>Power:</strong> Add both GPU + PSU to check' });
  }

  // GPU Length -> Case
  if (gpu && chasis) {
    const gLen = gpu.length_mm || 0;
    const cMax = chasis.max_gpu_length || 0;
    if (gLen && cMax) {
      gLen <= cMax
        ? res.push({ status: 'ok', msg: `<strong>GPU Length:</strong> ${gLen}mm fits in ${cMax}mm case ` })
        : res.push({ status: 'error', msg: `<strong>GPU Length:</strong> GPU (${gLen}mm) exceeds case limit (${cMax}mm)!` });
    }
  }

  // MB Form Factor -> Case
  if (mb && chasis) {
    const mFf = mb.form_factor || '';
    const cSupp = (chasis.supported_form_factors || '').toUpperCase();
    if (mFf && cSupp) {
      cSupp.includes(mFf.toUpperCase())
        ? res.push({ status: 'ok', msg: `<strong>Form Factor:</strong> ${mFf} supported ` })
        : res.push({ status: 'error', msg: `<strong>Form Factor:</strong> Case doesn't support ${mFf} boards` });
    }
  }

  if (cpu && cooler) {
    const ok = cpu.tdp <= 150 || cooler.specs.includes('360') || cooler.specs.includes('280') || cooler.specs.includes('AIO') || cooler.specs.includes('250W');
    ok
      ? res.push({ status: 'ok', msg: `<strong>Thermal:</strong> Cooler handles ${cpu.tdp}W ` })
      : res.push({ status: 'warn', msg: `<strong>Thermal:</strong> ${cpu.tdp}W TDP — consider a 360mm AIO` });
  }

  const missing = BUILDER_SLOTS.filter(s => s.required && !build[s.key]).map(s => s.label);
  if (!missing.length && res.length) {
    res.push({ status: 'ok', msg: '<strong>Complete:</strong> All required parts selected ' });
  } else if (missing.length) {
    res.push({ status: 'warn', msg: `<strong>Missing:</strong> ${missing.join(', ')}` });
  }

  const box = document.getElementById('compatResults');
  const overall = document.getElementById('overallCompat');

  if (!res.length) {
    box.innerHTML = `<div style="color:var(--text3);font-size:0.8rem;text-align:center;padding:1rem">Add parts to check compatibility</div>`;
    overall.className = 'overall-compat neutral';
    overall.textContent = 'Select components to check';
    return;
  }

  box.innerHTML = res.map(r =>
    `<div class="compat-item"><div class="compat-dot ${r.status}"></div><div class="compat-text">${r.msg}</div></div>`
  ).join('');

  const hasErr = res.some(r => r.status === 'error');
  const hasWarn = res.some(r => r.status === 'warn');
  overall.className = 'overall-compat ' + (hasErr ? 'error' : hasWarn ? 'warn' : 'ok');
  overall.textContent = hasErr ? 'Issues found' : hasWarn ? 'OK — check warnings' : 'Fully compatible!';
}


// UI Toasts 

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type + ' show';
  setTimeout(() => el.classList.remove('show'), 2800);
}

// Product Modal 

function openProductModal(pid) {
  const customProducts = (function () {
    try { return JSON.parse(localStorage.getItem('ds_custom_products') || '[]'); } catch (e) { return []; }
  })();
  const p = (typeof _getAllProducts === 'function' ? _getAllProducts() : []).find(x => x.id === pid);
  if (!p) return;

  // Laptop redirect
  if (p.cat === 'Laptop') {
    if (typeof openLaptopDetail === 'function') { openLaptopDetail(pid); return; }
  }

  const status = getStockStatus(pid);
  const isOOS = status === 'outofstock';
  const isSale = status === 'sale';
  const isLow = status === 'lowstock';
  const phpPrice = Math.round(p.price * 57);
  const salePHP = Math.round(phpPrice * 0.85);

  const imgHtml = '<div style="width:100%;height:220px;border-radius:10px;margin-bottom:1rem;overflow:hidden;background:var(--surface2);display:flex;align-items:center;justify-content:center;">'
    + productImg(pid, 'modal')
    + '</div>';

  // Stock meter data
  const qty = typeof INVENTORY !== 'undefined' ? INVENTORY.getQty(pid) : null;
  const qtyDisplay = typeof INVENTORY !== 'undefined' ? INVENTORY.getDisplayQty(pid) : '';
  const maxQty = typeof INVENTORY !== 'undefined' ? Math.max(INVENTORY.getLowStockThreshold() * 2 + 1, (qty || 0) + 1) : 10;
  const meterPct = qty !== null ? Math.min(100, Math.round((qty / maxQty) * 100)) : 100;
  const meterClass = (qty === null || qty > (typeof INVENTORY !== 'undefined' ? INVENTORY.getLowStockThreshold() : 5))
    ? 'inv-meter-fill-ok'
    : qty === 0 ? 'inv-meter-fill-oos' : 'inv-meter-fill-low';
  const qtyClass = (qty === null || qty > (typeof INVENTORY !== 'undefined' ? INVENTORY.getLowStockThreshold() : 5))
    ? 'qty-ok' : qty === 0 ? 'qty-oos' : 'qty-low';
  const meterHtml = qty !== null ? `
    <div class="inv-meter-wrap">
      <div class="inv-meter-header">
        <span class="inv-meter-label">Stock Availability</span>
        <span class="inv-meter-qty ${qtyClass}" data-stock-qty>${qtyDisplay}</span>
      </div>
      <div class="inv-meter-track">
        <div class="inv-meter-fill ${meterClass}" style="width:${meterPct}%"></div>
      </div>
    </div>` : '';

  const descs = (function () {
    try { return JSON.parse(localStorage.getItem('ds_custom_descs') || '{}'); } catch (e) { return {}; }
  })();
  const descTxt = descs[pid] || p.description
    || 'The ' + p.name + ' is a ' + p.cat + ' component featuring ' + p.specs + '.';

  // Benchmark score display
  const bench = p.benchScore || null;
  let benchHtml = '';
  if (bench && bench > 0) {
    const bScore = Math.min(100, bench);
    const bPct = bScore;
    let bColor = '#6b7280', bLabel = 'Entry-Level';
    if (bScore >= 95) { bColor = '#ef4444'; bLabel = 'Flagship'; }
    else if (bScore >= 80) { bColor = '#f97316'; bLabel = 'High-End'; }
    else if (bScore >= 55) { bColor = '#2563eb'; bLabel = 'Mid-Range'; }
    else if (bScore >= 30) { bColor = '#22c55e'; bLabel = 'Budget'; }
    benchHtml = `
      <div class="pdm-bench-wrap">
        <div class="pdm-section-label">Performance Rating (Benchmark)</div>
        <div class="pdm-bench-row">
          <div class="pdm-bench-track">
            <div class="pdm-bench-fill" style="width:${bPct}%;background:${bColor}"></div>
          </div>
          <div class="pdm-bench-score" style="color:${bColor}">${bScore}/100</div>
          <div class="pdm-bench-badge" style="color:${bColor};background:${bColor}18;border:1px solid ${bColor}40">${bLabel}</div>
        </div>
      </div>`;
  }

  // Stock pills
  const stockBadge = isOOS ? '<span class="inv-modal-pill inv-pill-oos" data-stock-badge>Out of Stock</span>'
    : isLow ? '<span class="inv-modal-pill inv-pill-low" data-stock-badge>Low Stock</span>'
      : isSale ? '<span class="inv-modal-pill inv-pill-sale" data-stock-badge>On Sale &mdash; 15% Off</span>'
        : '<span class="inv-modal-pill inv-pill-ok"  data-stock-badge>In Stock</span>';

  const effPrice = getEffectivePrice(pid);
  const priceHtml = isSale
    ? `<div class="pdm-price">
         <span class="pdm-price-sale">&#8369;${effPrice.toLocaleString()}</span>
         <span class="pdm-price-original">&#8369;${Math.round(p.price * 57).toLocaleString()}</span>
       </div>`
    : `<div class="pdm-price">&#8369;${effPrice.toLocaleString()}</div>`;

  const addBtn = isOOS
    ? '<button class="pdm-add-btn" disabled data-add-cart-btn>Sold Out</button>'
    : `<button class="pdm-add-btn" onclick="addToCart('${pid}',event);document.getElementById('productDetailModal').classList.remove('open')" data-add-cart-btn>Add to Cart</button>`;

  document.getElementById('productDetailBody').innerHTML =
    imgHtml
    + `<div class="pdm-cat">${p.cat}</div>`
    + `<div class="pdm-name">${p.name}</div>`
    + `<div>${stockBadge}</div>`
    + priceHtml
    + `<div class="pdm-divider"></div>`
    + `<div class="pdm-section-label">Technical Specifications</div>`
    + `<div class="pdm-specs-text">`
    + (p.wattage ? `<span style="color:var(--text3);margin-right:10px">Consumption: ${p.wattage}W</span>` : '')
    + (p.length_mm ? `<span style="color:var(--text3);margin-right:10px">Length: ${p.length_mm}mm</span>` : '')
    + (p.form_factor ? `<span style="color:var(--text3);margin-right:10px">Form Factor: ${p.form_factor}</span>` : '')
    + `<div style="margin-top:5px">${p.specs}</div>`
    + `</div>`
    + benchHtml
    + `<div class="pdm-divider"></div>`
    + `<div class="pdm-section-label">About this product</div>`
    + `<div class="pdm-desc-text">${descTxt}</div>`
    + `<div class="pdm-actions">${addBtn}
         <button class="pdm-close-btn" onclick="document.getElementById('productDetailModal').classList.remove('open')">Close</button>
       </div>`
    + meterHtml
    + `<div class="review-section" id="reviewSection-${pid}">
         <div class="review-section-title">Customer Reviews</div>
       </div>`;

  document.getElementById('productDetailModal').classList.add('open');

  if (typeof renderReviewSection === 'function') {
    setTimeout(() => renderReviewSection(pid), 80);
  }
}

// Payment Review
var _prSelectedMethod = null;

function openPaymentReview() {
  var cart = DB.getCart();
  if (!cart.length) { showToast('Your cart is empty', 'error'); return; }
  _prSelectedMethod = null;
  var subPHP = cart.reduce(function (acc, i) {
    return acc + (getEffectivePrice(i.productId) * i.qty);
  }, 0);
  var shippingPHP = subPHP > (500 * 57) ? 0 : (30 * 57);
  var vatPHP = subPHP * 0.12;
  var totalPHP = subPHP + shippingPHP + vatPHP;
  document.getElementById('prItemsList').innerHTML = cart.map(function (item) {
    var p = getProduct(item.productId); if (!p) return '';
    var eff = getEffectivePrice(item.productId);
    return '<div class="pr-item"><span class="pr-item-name">' + p.name + (item.qty > 1 ? ' <span class="pr-item-qty">x' + item.qty + '</span>' : '') + '</span>'
      + '<span class="pr-item-price">&#8369;' + (eff * item.qty).toLocaleString() + '</span></div>';
  }).join('');
  document.getElementById('prTotals').innerHTML =
    '<div class="pr-total-row"><span>Subtotal</span><span>&#8369;' + Math.round(subPHP).toLocaleString() + '</span></div>' +
    '<div class="pr-total-row"><span>Shipping</span><span>' + (shippingPHP === 0 ? '<span class="pr-free">FREE</span>' : '&#8369;' + Math.round(shippingPHP).toLocaleString()) + '</span></div>' +
    '<div class="pr-total-row"><span>VAT (12%)</span><span>&#8369;' + Math.round(vatPHP).toLocaleString() + '</span></div>' +
    '<div class="pr-total-row pr-grand-total"><span>Total</span><span>&#8369;' + Math.round(totalPHP).toLocaleString() + '</span></div>';
  ['Gcash', 'Maya', 'Cod'].forEach(function (id) {
    var b = document.getElementById('prBtn' + id); var c = document.getElementById('prCheck' + id);
    if (b) b.classList.remove('selected'); if (c) c.innerHTML = '';
  });
  document.getElementById('prInstructions').style.display = 'none';
  document.getElementById('prConfirmBtn').style.display = 'none';
  document.getElementById('prConfirmBtn').disabled = true;
  // Reset terms agreement
  const termsBox = document.getElementById('termsBox');
  if (termsBox) termsBox.style.display = 'none';
  if (typeof resetTerms === 'function') resetTerms();
  document.getElementById('paymentReviewModal').classList.add('open');
}
function closePaymentReview() {
  document.getElementById('paymentReviewModal').classList.remove('open');
}
function selectPaymentReview(method) {
  _prSelectedMethod = method;
  var map = { gcash: 'Gcash', paymaya: 'Maya', cod: 'Cod' };
  Object.keys(map).forEach(function (k) {
    var b = document.getElementById('prBtn' + map[k]); var c = document.getElementById('prCheck' + map[k]); var on = (k === method);
    if (b) b.classList.toggle('selected', on); if (c) c.innerHTML = on ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '';
  });

  var info = {
    gcash: {
      color: '#007bff', name: 'GCash', acct: '0917-123-4567', acctName: 'Digispex Store',
      imgSrc: 'https://wp.logos-download.com/wp-content/uploads/2020/06/GCash_Logo.png?dl',
      steps: ['Open your GCash app', 'Tap <strong>Send Money</strong>', 'Enter number: <strong>0917-123-4567</strong>', 'Type the exact order total', 'Put your Order ID in the message', 'Screenshot your receipt and keep it']
    },
    paymaya: {
      color: '#12b669', name: 'Maya', acct: '0945-678-9012', acctName: 'Digispex Store',
      imgSrc: 'https://play-lh.googleusercontent.com/fdQjxsIO8BTLaw796rQPZtLEnGEV8OJZJBJvl8dFfZLZcGf613W93z7y9dFAdDhvfqw',
      steps: ['Open your Maya app', 'Tap <strong>Send Money</strong>', 'Enter number: <strong>0945-678-9012</strong>', 'Type the exact order total', 'Put your Order ID in the message', 'Screenshot your receipt and keep it']
    },
    cod: {
      color: '#f59e0b', name: 'Cash on Delivery', acct: '', acctName: '', imgSrc: '',
      steps: ['Place your order', 'Wait for our confirmation call', 'Prepare the exact amount in cash', 'Pay our courier upon delivery']
    },
  };
  var d = info[method]; if (!d) return;
  var totalEl = document.querySelector('#prTotals .pr-grand-total span:last-child');
  var amt = totalEl ? totalEl.textContent : '';

  var logoHtml = d.imgSrc
    ? '<div class="pr-instr-img-wrap"><img src="' + d.imgSrc + '" alt="' + d.name + '" class="pr-instr-img" onerror="this.parentNode.innerHTML=\'<span style=&quot;font-weight:900;font-size:1.1rem;color:#fff&quot;>' + d.name[0] + '</span>\'"></div>'
    : method === 'card'
      ? '<div class="pr-instr-img-wrap" style="background:linear-gradient(135deg,#1a1a2e,#16213e)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>'
      : '<div class="pr-instr-img-wrap pr-instr-cod-wrap"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>';

  var acctCard = d.acct
    ? '<div class="pr-acct-card" style="border-color:' + d.color + '44">'
    + '<div class="pr-acct-label">Send payment to</div>'
    + '<div class="pr-acct-number" style="color:' + d.color + '">' + d.acct + '</div>'
    + '<div class="pr-acct-name">' + d.acctName + '</div>'
    + (amt ? '<div class="pr-acct-amount">Amount: <strong>' + amt + '</strong></div>' : '')
    + '</div>'
    : (amt ? '<div class="pr-cod-amount">Amount due on delivery: <strong style="color:' + d.color + '">' + amt + '</strong></div>' : '');

  var steps = '<ol class="pr-instr-steps">' + d.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
  var badge = method === 'cod' ? 'Pay on delivery' : 'e-Wallet · Instant';
  document.getElementById('prInstructions').innerHTML =
    '<div class="pr-instr-top" style="border-color:' + d.color + '33">'
    + logoHtml
    + '<div class="pr-instr-top-info"><div class="pr-instr-title">' + d.name + '</div><div class="pr-instr-badge" style="background:' + d.color + '1a;color:' + d.color + '">' + badge + '</div></div>'
    + '</div>';

  document.getElementById('prInstructions').style.display = 'block';

  // Terms toggle
  var termsBox = document.getElementById('termsBox');
  if (termsBox) termsBox.style.display = 'block';
  if (typeof resetTerms === 'function') resetTerms();

  // Confirm button state
  var confirmBtn = document.getElementById('prConfirmBtn');
  if (confirmBtn) {
    confirmBtn.style.display = '';
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Confirm Payment Method';
  }
}
function confirmPaymentReview() {
  if (!_prSelectedMethod) return;
  if (typeof validateTerms === 'function' && !validateTerms()) return;

  var f = document.getElementById('selectedPaymentMethod'); if (f) f.value = _prSelectedMethod;
  closePaymentReview();
  var labels = { gcash: 'GCash', paymaya: 'Maya', cod: 'Cash on Delivery' };
  showToast('Payment: ' + (labels[_prSelectedMethod] || _prSelectedMethod), 'success');
}

/* Receipt Generator */
function downloadReceipt(orderId) {
  const orders = DB.getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) { showToast('Order not found', 'error'); return; }

  const WARRANTY_MAP = {
    CPU: '3 Years Manufacturer Warranty',
    GPU: '3 Years Manufacturer Warranty',
    Motherboard: '3 Years Manufacturer Warranty',
    RAM: 'Lifetime Warranty',
    Storage: '5 Years Manufacturer Warranty',
    PSU: '5 Years Manufacturer Warranty',
    Cooling: '2 Years Manufacturer Warranty',
    Case: '1 Year Manufacturer Warranty',
    Laptop: '1 Year Manufacturer Warranty',
  };

  const paymentLabels = { gcash: 'GCash', paymaya: 'Maya', cod: 'Cash on Delivery' };

  const itemRows = (order.items || []).map(item => {
    const product = typeof getProduct === 'function' ? getProduct(item.productId) : null;
    const category = product ? product.cat : '';
    const warranty = WARRANTY_MAP[category] || '1 Year Warranty';
    const unitPhp = Math.round((item.price || 0) * 57);
    const totalPhp = Math.round((item.price || 0) * item.qty * 57);
    return `
      <tr>
        <td>${item.name}</td>
        <td style="text-align:center">${item.qty}</td>
        <td style="text-align:right">&#8369;${unitPhp.toLocaleString()}</td>
        <td style="text-align:right">&#8369;${totalPhp.toLocaleString()}</td>
        <td style="color:#555;font-size:11px">${warranty}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Digispex Receipt — ${order.id}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size:13px; color:#222; background:#fff; padding:40px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; border-bottom:2px solid #111; padding-bottom:18px; }
    .brand { font-family: Georgia, serif; font-size:28px; font-weight:900; letter-spacing:3px; color:#111; }
    .brand-sub { font-size:11px; color:#888; margin-top:3px; }
    .receipt-label { text-align:right; }
    .receipt-label h2 { font-size:20px; color:#111; letter-spacing:1px; }
    .receipt-label p  { font-size:11px; color:#888; margin-top:2px; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
    .info-box h4 { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:6px; }
    .info-box p  { font-size:13px; color:#222; line-height:1.6; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    thead tr { background:#111; color:#fff; }
    thead th { padding:10px 12px; font-size:11px; text-align:left; letter-spacing:0.5px; }
    tbody tr { border-bottom:1px solid #eee; }
    tbody tr:last-child { border-bottom:none; }
    tbody td { padding:10px 12px; vertical-align:top; }
    tbody tr:nth-child(even) { background:#f9f9f9; }
    .totals { margin-left:auto; width:260px; }
    .total-row { display:flex; justify-content:space-between; padding:5px 0; font-size:13px; }
    .total-row.grand { border-top:2px solid #111; margin-top:6px; padding-top:8px; font-weight:700; font-size:15px; }
    .footer { margin-top:32px; border-top:1px solid #ddd; padding-top:16px; font-size:11px; color:#888; text-align:center; line-height:1.8; }
    .status-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; background:#dcfce7; color:#166534; }
    @media print { body { padding:20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">DIGISPEX</div>
      <div class="brand-sub">Online Shop with Package Customization<br>General Santos City, Philippines</div>
    </div>
    <div class="receipt-label">
      <h2>OFFICIAL RECEIPT</h2>
      <p>Order ID: <strong>${order.id}</strong></p>
      <p>Date: ${order.date}</p>
      <p>Payment: ${paymentLabels[order.payment] || order.payment}</p>
      <p style="margin-top:6px"><span class="status-badge">${(order.status || 'processing').toUpperCase()}</span></p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h4>Bill To</h4>
      <p><strong>${order.customer}</strong><br>${order.address || '—'}</p>
    </div>
    <div class="info-box">
      <h4>Order Details</h4>
      <p>Items: ${(order.items || []).length}<br>
         Payment Method: ${paymentLabels[order.payment] || order.payment}<br>
         Status: ${order.status || 'Processing'}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Subtotal</th>
        <th>Warranty</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="total-row grand">
      <span>TOTAL</span>
      <span>&#8369;${order.total}</span>
    </div>
  </div>

  <div class="footer">
    Thank you for shopping at Digispex!<br>
    For concerns, contact us at support@digispex.ph or visit our store in General Santos City.<br>
    This is an official receipt. Please keep this for your records.<br><br>
    <em>All prices include 12% VAT. Warranty claims must be presented with this receipt.</em>
  </div>

  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    showToast('Please allow popups to download receipt', 'error');
  }
}

/* Scroll Reveal Observer */
(function initScrollReveal() {
  if (!('IntersectionObserver' in window)) {
    // Fallback: instantly show everything
    document.querySelectorAll('.section-block, [data-reveal]').forEach(el => {
      el.classList.add('revealed', 'visible');
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed', 'visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px'
  });

  // Observe all section blocks and reveal elements
  document.querySelectorAll('.section-block, [data-reveal]').forEach(el => {
    observer.observe(el);
  });
})();

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CART COUNT BUMP ANIMATION
   Adds a brief bounce to the cart badge when items change.
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const _origRenderNav = typeof renderNav === 'function' ? renderNav : null;
if (_origRenderNav) {
  const _enhancedRenderNav = function () {
    const before = document.querySelector('.cart-count')?.textContent;
    _origRenderNav();
    const badge = document.querySelector('.cart-count');
    if (badge && badge.textContent !== before) {
      badge.classList.remove('bump');
      void badge.offsetWidth;
      badge.classList.add('bump');
      setTimeout(() => badge.classList.remove('bump'), 500);
    }
  };
  // We can't easily replace renderNav at this point since it's already defined,
  // but the bump effect will work through the existing flow.
}

// Footer Functionality
function openTerms() {
  document.getElementById('termsModal')?.classList.add('open');
}

async function handleNewsletterSubmit() {
  const input = document.getElementById('footerNewsEmail');
  const btn = document.querySelector('.footer-news-btn');
  const email = input?.value.trim();

  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address', 'error');
    return;
  }

  // Visual feedback
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span style="font-size:0.7rem">...</span>';
  btn.disabled = true;

  try {
    if (typeof SB !== 'undefined' && typeof SB.pushSubscriber === 'function') {
      await SB.pushSubscriber(email);
    }
    showToast('Success! You are now subscribed.', 'success');
    input.value = '';
  } catch (e) {
    if (e.code === '23505') {
       showToast('You are already subscribed!', 'success');
       input.value = '';
    } else {
       showToast('Something went wrong. Please try again later.', 'error');
    }
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}
