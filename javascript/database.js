// Database Layer (LocalStorage & Supabase)

const DB = (() => {

  const PREFIX = 'ds_';
  const USER_SCOPED = ['cart', 'orders', 'build'];

  // Internal Helpers

  function _userPrefix() {
    try {
      const u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      return u && u.id ? `u_${u.id}_` : 'guest_';
    } catch { return 'guest_'; }
  }

  function _key(key) {
    return PREFIX + (USER_SCOPED.includes(key) ? _userPrefix() : '') + key;
  }

  function _read(key) {
    try {
      const raw = localStorage.getItem(_key(key));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error(`[DB] Failed to read "${key}":`, e);
      return null;
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(_key(key), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[DB] Failed to write "${key}":`, e);
      return false;
    }
  }

  function _delete(key) {
    try {
      localStorage.removeItem(_key(key));
      return true;
    } catch (e) {
      console.error(`[DB] Failed to delete "${key}":`, e);
      return false;
    }
  }

  // Supabase Sync
  function _syncCart() {
    const cart = _read('cart') || [];
    if (typeof SB !== 'undefined') SB.pushCart(cart);
  }

  function _syncBuild() {
    const build = _read('build') || {};
    if (typeof SB !== 'undefined') SB.pushBuild(build);
  }

  // Public API

  return {

    init() {
      if (!_read('cart'))   _write('cart',   []);
      if (!_read('orders')) _write('orders', []);
      if (!_read('build'))  _write('build',  {});
    },

    // Generic Storage
    get(key)        { return _read(key); },
    set(key, value) { return _write(key, value); },
    remove(key)     { return _delete(key); },

    // Cart Functions

    getCart() {
      return _read('cart') || [];
    },

    getCartCount() {
      return this.getCart().reduce((sum, item) => sum + item.qty, 0);
    },

    cartAdd(productId) {
      const cart = this.getCart();
      const existing = cart.find(i => i.productId === productId);
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ productId, qty: 1 });
      }
      _write('cart', cart);
      _syncCart();
    },

    cartUpdateQty(productId, delta) {
      let cart = this.getCart();
      const item = cart.find(i => i.productId === productId);
      if (!item) return;
      item.qty += delta;
      if (item.qty <= 0) cart = cart.filter(i => i.productId !== productId);
      _write('cart', cart);
      _syncCart();
    },

    cartRemove(productId) {
      const cart = this.getCart().filter(i => i.productId !== productId);
      _write('cart', cart);
      _syncCart();
    },

    cartClear() {
      _write('cart', []);
      _syncCart();
    },

    // Order Functions

    getOrders() {
      return _read('orders') || [];
    },

    addOrder(order) {
      const orders = this.getOrders();
      orders.unshift(order);
      _write('orders', orders);
      /* Sync to Supabase */
      if (typeof SB !== 'undefined') SB.pushOrder(order);
    },

    async updateOrderStatus(orderId, status, extra = {}) {
      const orders = this.getOrders();
      const order = orders.find(o => o.id === orderId);
      if (order) {
        order.status = status;
        Object.assign(order, extra);
        _write('orders', orders);
        /* Sync to Supabase */
        if (typeof SB !== 'undefined') await SB.updateOrderStatus(orderId, status, extra);
      }
    },

    // PC Build Functions

    getBuild() {
      return _read('build') || {};
    },

    buildSetSlot(slotKey, productId) {
      const build = this.getBuild();
      build[slotKey] = productId;
      _write('build', build);
      _syncBuild();
    },

    buildClearSlot(slotKey) {
      const build = this.getBuild();
      delete build[slotKey];
      _write('build', build);
      _syncBuild();
    },

    buildClear() {
      _write('build', {});
      _syncBuild();
    },

    buildSave(buildObj) {
      _write('build', buildObj);
      _syncBuild();
    },

    // Debug Helpers

    dump() {
      console.group('[DB] Current state');
      console.log('cart:',   this.getCart());
      console.log('orders:', this.getOrders());
      console.log('build:',  this.getBuild());
      console.groupEnd();
    },

    reset() {
      ['cart', 'orders', 'build'].forEach(k => _delete(k));
      this.init();
      console.log('[DB] Database reset to defaults.');
    }
  };

})();