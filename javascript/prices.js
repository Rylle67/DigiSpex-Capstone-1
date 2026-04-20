// Market Price Engine: Updates products with live prices.

const MARKET = (() => {

  const VOLATILITY = {
    GPU:         0.12,
    CPU:         0.08,
    RAM:         0.10,
    Motherboard: 0.06,
    Storage:     0.07,
    PSU:         0.04,
    Cooling:     0.04,
    Case:        0.03,
  };

  const DEMAND = {
    GPU:         { days: [5, 6], hours: [20, 21, 22, 23] },
    CPU:         { days: [1, 2], hours: [9, 10, 11] },
    RAM:         { days: [3, 4], hours: [14, 15, 16] },
    Storage:     { days: [0, 1], hours: [10, 11, 12] },
    Motherboard: { days: [2, 3], hours: [13, 14, 15] },
    PSU:         { days: [4, 5], hours: [18, 19, 20] },
    Cooling:     { days: [6, 0], hours: [11, 12, 13] },
    Case:        { days: [5, 6], hours: [15, 16, 17] },
  };

  function seededRand(seed) {
    const x = Math.sin(seed + 1) * 43758.5453123;
    return x - Math.floor(x);
  }

  const BASE = {};
  const PREV = {};

  function drift(p) {
    const now    = new Date();
    const minute = Math.floor(Date.now() / 60000);
    const vol    = VOLATILITY[p.cat] || 0.05;
    const demand = DEMAND[p.cat];
    const idHash = p.id.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
    const seed   = minute * 10000 + idHash;

    let d = (Math.sin(minute / 30 + seed) * 0.4 + (seededRand(seed) - 0.5) * 0.6) * vol;

    if (demand) {
      const peakDay  = demand.days.includes(now.getDay());
      const peakHour = demand.hours.includes(now.getHours());
      if (peakDay && peakHour)      d += vol * 0.4;
      else if (peakDay || peakHour) d += vol * 0.15;
    }

    if (BASE[p.id] > 800) d *= 1.2;
    return d;
  }

  function updatePrices() {
    (typeof _getAllProducts === 'function' ? _getAllProducts() : []).forEach(p => {
      p.price = parseFloat((BASE[p.id] * (1 + drift(p))).toFixed(2));
    });
  }

  function snapshot() {
    (typeof _getAllProducts === 'function' ? _getAllProducts() : []).forEach(p => { PREV[p.id] = p.price; });
  }

  return {
    init() {
      (typeof _getAllProducts === 'function' ? _getAllProducts() : []).forEach(p => { BASE[p.id] = p.price; });
      updatePrices();
      snapshot();
      setInterval(() => {
        snapshot();
        updatePrices();
        _marketTick();
      }, 60000);
    },

    trend(id) {
      const cur  = (typeof _getAllProducts === 'function' ? _getAllProducts() : []).find(p => p.id === id)?.price;
      const prev = PREV[id];
      if (!prev || !cur) return 'stable';
      const pct = (cur - prev) / prev;
      return pct > 0.003 ? 'up' : pct < -0.003 ? 'down' : 'stable';
    },

    delta(id) {
      const cur = (typeof _getAllProducts === 'function' ? _getAllProducts() : []).find(p => p.id === id)?.price;
      if (!BASE[id] || !cur) return 0;
      return ((cur - BASE[id]) / BASE[id]) * 100;
    }
  };
})();

function _marketTick() {
  const active = document.querySelector('.page.active');
  if (!active) return;
  const id = active.id.replace('page-', '');
  if (id === 'store')   renderStore();
  if (id === 'builder') renderBuilder();
  if (id === 'home')    renderDeals();
  if (id === 'cart')    renderCart();
  if (document.getElementById('selectModal').classList.contains('open') && typeof currentSlotKey !== 'undefined' && currentSlotKey) {
    openSlotModal(currentSlotKey);
  }
  const dot = document.getElementById('marketPulse');
  if (dot) { dot.classList.add('active'); setTimeout(() => dot.classList.remove('active'), 2000); }
}

MARKET.init();

// Pricing Helpers (Shared Globally)

function getStockStatus(id) {
  try {
    const stock = JSON.parse(localStorage.getItem('ds_stock') || '{}');
    const st = stock[id] || 'normal';

    if (st === 'sale') {
      const saleCfg = JSON.parse(localStorage.getItem('ds_sale_config') || '{}');
      const cfg = saleCfg[id];
      if (cfg) {
        const today = new Date().setHours(0, 0, 0, 0);
        if (cfg.startDate && new Date(cfg.startDate) > today) return 'normal';
        if (cfg.endDate && new Date(cfg.endDate) < today) return 'normal';
      }
    }
    return st;
  }
  catch { return 'normal'; }
}

/**
 * Calculates current price in PHP based on active sales.
 */
function getEffectivePrice(productId) {
  const p = getProduct(productId);
  if (!p) return 0;
  
  const basePHP = Math.round(p.price * 57);
  const status = getStockStatus(productId);
  
  if (status === 'sale') {
    try {
      const saleCfg = JSON.parse(localStorage.getItem('ds_sale_config') || '{}');
      const cfg = saleCfg[productId] || {};
      const discount = cfg.discount || 0.15;
      return Math.round(basePHP * (1 - discount));
    } catch (e) { return basePHP; }
  }
  return basePHP;
}