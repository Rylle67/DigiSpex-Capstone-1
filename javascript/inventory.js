// Inventory Management System (Real-time stock tracking)

const INVENTORY = (() => {

  // Constants
  const INV_KEY = 'ds_inv';
  const STOCK_KEY = 'ds_stock';
  const LOW_STOCK_THRESHOLD = 10;
  const DEFAULT_STOCK = 10;

  // Storage Helpers
  function _readInv() { try { return JSON.parse(localStorage.getItem(INV_KEY) || '{}'); } catch { return {}; } }
  function _writeInv(data) { try { localStorage.setItem(INV_KEY, JSON.stringify(data)); } catch { } }
  function _readStatus() { try { return JSON.parse(localStorage.getItem(STOCK_KEY) || '{}'); } catch { return {}; } }
  function _writeStatus(data) { try { localStorage.setItem(STOCK_KEY, JSON.stringify(data)); } catch { } }

  // Event Dispatcher
  function _dispatch(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { }
  }

  // Status Sync
  function _syncStatus(productId, qty) {
    const statuses = _readStatus();
    const current = statuses[productId] || 'normal';
    let next = current;

    if (qty <= 0) {
      next = 'outofstock';
    } else if (qty <= LOW_STOCK_THRESHOLD) {
      if (['normal', 'lowstock', 'outofstock'].includes(current)) next = 'lowstock';
    } else {
      if (['lowstock', 'outofstock'].includes(current)) next = 'normal';
    }

    if (next !== current) {
      if (next === 'normal') delete statuses[productId];
      else statuses[productId] = next;
      _writeStatus(statuses);

      if (typeof pushAudit === 'function') {
        const name = typeof getProduct === 'function' ? (getProduct(productId) || {}).name || productId : productId;
        pushAudit({
          type: 'status_change',
          productId,
          productName: name,
          oldStatus: current,
          newStatus: next,
          source: 'inventory_auto_sync'
        });
      }

      // Notify UI of the change
      _dispatch('ds:inventory:change', { productId, qty });
    }
  }

  // Push to Supabase helper
  function _pushQty(productId, qty) {
    if (typeof SB !== 'undefined' && typeof SB.updateProduct === 'function') {
      const status = _readStatus()[productId] || 'normal';
      // Use async update but don't block UI
      SB.updateProduct(productId, { stock_qty: qty, stock_status: status })
        .catch(err => console.error('[Inventory] Push failed for', productId, err));
    }
  }

  // Seed Defaults
  function _seedDefaults() {
    const inv = _readInv();
    const statuses = _readStatus();
    let changed = false;

    const products = [
      ...(typeof PRODUCTS !== 'undefined' ? PRODUCTS : []),
      ...(function () { try { return JSON.parse(localStorage.getItem('ds_custom_products') || '[]'); } catch { return []; } })()
    ];

    products.forEach(p => {
      if (typeof inv[p.id] === 'number') return;

      const status = statuses[p.id] || 'normal';
      if (status === 'outofstock') {
        inv[p.id] = 1; // Seed with 1 to break OOS loop and allow sync to correct it
      } else if (status === 'lowstock') {
        inv[p.id] = Math.floor(Math.random() * LOW_STOCK_THRESHOLD) + 1;
      } else {
        inv[p.id] = DEFAULT_STOCK;
      }
      changed = true;
    });

    if (changed) _writeInv(inv);
  }

  // Public API
  return {

    async init() {
      // Wait for Supabase Pull if it is happening
      if (typeof SB !== 'undefined' && typeof SB.pull === 'function') {
        console.log('[Inventory] Waiting for cloud sync before init...');
        try {
          await SB.pull();
        } catch (e) {
          console.warn('[Inventory] Cloud pull failed, using local fallback.', e);
        }
      }
      _seedDefaults();
      // Sync all existing products to ensure statuses match quantities
      const inv = _readInv();
      Object.keys(inv).forEach(pid => this.syncStatus(pid));
    },

    getLowStockThreshold() {
      return LOW_STOCK_THRESHOLD;
    },

    getQty(productId) {
      const inv = _readInv();
      return typeof inv[productId] === 'number' ? inv[productId] : null;
    },

    // Check tracking status
    hasQtyTracking(productId) {
      return typeof _readInv()[productId] === 'number';
    },

    // Set quantity manually
    setQty(productId, qty, reason = 'manual', notes = '') {
      const safeQty = Math.max(0, Math.floor(qty));
      const inv = _readInv();
      const oldQty = inv[productId] ?? null;
      inv[productId] = safeQty;
      _writeInv(inv);
      _syncStatus(productId, safeQty);
      _pushQty(productId, safeQty);

      // Log to Supabase inventory_log if available
      if (typeof SB !== 'undefined' && typeof SB.pushInventoryLog === 'function') {
        const changeQty = oldQty !== null ? safeQty - oldQty : safeQty;
        SB.pushInventoryLog(productId, changeQty, reason, notes)
          .catch(e => console.warn('[Inventory] Log push failed:', e));
      }

      _dispatch('ds:inventory:change', { productId, qty: safeQty, oldQty });
      if (safeQty === 0) _dispatch('ds:inventory:oos', { productId });
    },

    syncStatus(productId) {
      const qty = this.getQty(productId);
      if (qty !== null) _syncStatus(productId, qty);
    },

    // Fulfillment check
    canFulfill(productId, qty) {
      const status = (() => {
        try { return (_readStatus()[productId] || 'normal'); } catch { return 'normal'; }
      })();

      if (status === 'outofstock') {
        return { ok: false, available: 0, message: 'This product is out of stock.' };
      }

      const available = this.getQty(productId);
      if (available === null) {
        return { ok: true, available: Infinity, message: '' };
      }
      if (available <= 0) {
        return { ok: false, available: 0, message: 'This product is out of stock.' };
      }
      if (qty > available) {
        return {
          ok: false,
          available,
          message: `Not enough stock. Only ${available} unit${available !== 1 ? 's' : ''} available.`
        };
      }
      return { ok: true, available, message: '' };
    },

    // Deduct stock after purchase
    deduct(productId, qty, reason = 'sale', notes = '') {
      const check = this.canFulfill(productId, qty);
      if (!check.ok) return { ok: false, remaining: check.available, message: check.message };

      const inv = _readInv();
      const current = inv[productId];
      if (typeof current !== 'number') {
        return { ok: true, remaining: Infinity, message: '' };
      }

      const remaining = Math.max(0, current - qty);
      inv[productId] = remaining;
      _writeInv(inv);
      _syncStatus(productId, remaining);
      _pushQty(productId, remaining);

      // Log to Supabase inventory_log
      if (typeof SB !== 'undefined' && typeof SB.pushInventoryLog === 'function') {
        SB.pushInventoryLog(productId, -qty, reason, notes)
          .catch(e => console.warn('[Inventory] Log push failed:', e));
      }

      _dispatch('ds:inventory:change', { productId, qty: remaining, oldQty: current });
      if (remaining === 0) _dispatch('ds:inventory:oos', { productId });

      return { ok: true, remaining, message: '' };
    },

    // Restore stock (e.g. cancelled order)
    restore(productId, qty, reason = 'return', notes = '') {
      const inv = _readInv();
      const current = inv[productId];
      if (typeof current !== 'number') return;
      const next = current + Math.max(0, qty);
      inv[productId] = next;
      _writeInv(inv);
      _syncStatus(productId, next);
      _pushQty(productId, next);

      // Log to Supabase inventory_log
      if (typeof SB !== 'undefined' && typeof SB.pushInventoryLog === 'function') {
        SB.pushInventoryLog(productId, qty, reason, notes)
          .catch(e => console.warn('[Inventory] Log push failed:', e));
      }

      _dispatch('ds:inventory:change', { productId, qty: next, oldQty: current });
    },

    // Validate cart stock
    validateCart(cartArr) {
      const problems = [];
      cartArr.forEach(item => {
        const check = this.canFulfill(item.productId, item.qty);
        if (!check.ok) {
          const name = typeof getProduct === 'function'
            ? (getProduct(item.productId) || {}).name || item.productId
            : item.productId;
          problems.push({
            productId: item.productId,
            name,
            requested: item.qty,
            available: check.available,
            message: check.message
          });
        }
      });
      return problems;
    },

    // Bulk deduct cart stock
    deductCart(cartArr) {
      cartArr.forEach(item => this.deduct(item.productId, item.qty));
    },

    // Get readable stock text
    getDisplayQty(productId) {
      const qty = this.getQty(productId);
      if (qty === null) return '';
      if (qty <= 0) return 'Out of Stock';
      if (qty <= LOW_STOCK_THRESHOLD) return qty + ' unit' + (qty !== 1 ? 's' : '') + ' left';
      return 'In Stock';
    }
  };

})();

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => {
  INVENTORY.init();
});

// Live UI Refresh
(function () {
  let _debounceTimer = null;

  function _refreshUI(productId) {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      // Refresh visible page
      const active = document.querySelector('.page.active');
      if (!active) return;
      const pageId = active.id.replace('page-', '');

      if (pageId === 'store' && typeof renderStore === 'function') renderStore();
      if (pageId === 'cart' && typeof renderCart === 'function') renderCart();
      if (pageId === 'builder' && typeof renderBuilder === 'function') renderBuilder();
      if (pageId === 'wishlist' && typeof renderWishlistPage === 'function') renderWishlistPage();
      if (pageId === 'laptops' && typeof renderLaptops === 'function') renderLaptops();
      if (pageId === 'packages' && typeof renderAllPackages === 'function') renderAllPackages();

      const prodModal = document.getElementById('productDetailModal');
      if (prodModal && prodModal.classList.contains('open') && productId) {
        _refreshProductModalStock(productId);
      }
      const lapModal = document.getElementById('laptopDetailModal');
      if (lapModal && lapModal.classList.contains('open') && productId) {
        _refreshLaptopModalStock(productId);
      }

      // Refresh product cards
      _refreshProductCards(productId);
    }, 120);
  }

  // Generic Modal Refresh Logic
  function _refreshProductModalStock(productId) {
    const body = document.getElementById('productDetailBody');
    if (!body) return;
    const qty = INVENTORY.getQty(productId);
    const status = (() => {
      try { return JSON.parse(localStorage.getItem('ds_stock') || '{}')[productId] || 'normal'; } catch { return 'normal'; }
    })();
    const isOOS = status === 'outofstock' || qty === 0;
    const isLow = status === 'lowstock';

    // Update stock pill
    const pill = body.querySelector('[data-stock-badge]');
    if (pill) {
      if (isOOS) { pill.textContent = 'Out of Stock'; pill.className = 'inv-modal-pill inv-pill-oos'; }
      else if (isLow) { pill.textContent = 'Low Stock'; pill.className = 'inv-modal-pill inv-pill-low'; }
      else { pill.textContent = 'In Stock'; pill.className = 'inv-modal-pill inv-pill-ok'; }
    }

    /* Update qty counter */
    const qtyEl = body.querySelector('[data-stock-qty]');
    if (qtyEl) qtyEl.textContent = INVENTORY.getDisplayQty(productId);

    // Update cart button status
    const addBtn = body.querySelector('[data-add-cart-btn]');
    if (addBtn) {
      addBtn.disabled = isOOS;
      addBtn.style.opacity = isOOS ? '0.4' : '1';
      addBtn.style.cursor = isOOS ? 'not-allowed' : 'pointer';
      addBtn.textContent = isOOS ? 'Sold Out' : 'Add to Cart';
    }
  }

  // Laptop Modal Refresh Logic
  function _refreshLaptopModalStock(productId) {
    const body = document.getElementById('laptopDetailBody');
    if (!body) return;
    const qty = INVENTORY.getQty(productId);
    const status = (() => {
      try { return JSON.parse(localStorage.getItem('ds_stock') || '{}')[productId] || 'normal'; } catch { return 'normal'; }
    })();
    const isOOS = status === 'outofstock' || qty === 0;

    // Update cart button status
    const addBtn = body.querySelector('[data-add-cart-btn]');
    if (addBtn) {
      addBtn.disabled = isOOS;
      addBtn.style.opacity = isOOS ? '0.4' : '1';
      addBtn.style.cursor = isOOS ? 'not-allowed' : 'pointer';
      if (isOOS) {
        addBtn.textContent = 'Out of Stock';
      }
    }
  }

  /* Refresh the stock pill on visible product cards */
  function _refreshProductCards(productId) {
    if (!productId) return;
    document.querySelectorAll(`.product-card[data-pid="${productId}"]`).forEach(card => {
      const pillEl = card.querySelector('.inv-card-qty');
      if (pillEl) pillEl.textContent = INVENTORY.getDisplayQty(productId);
    });
  }

  window.addEventListener('ds:inventory:change', e => _refreshUI(e.detail?.productId));
})();