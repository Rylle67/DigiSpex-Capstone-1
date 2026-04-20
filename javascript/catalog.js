// Catalog & Builder Definitions

const PRODUCTS = [];
/* All products are added via the Admin Panel → Add Product tab */

// Categories

/* Base category order — ensures consistent sort even if products are sparse */
const _BASE_CAT_ORDER = ['CPU', 'GPU', 'Motherboard', 'RAM', 'Storage', 'PSU', 'Cooling', 'Case', 'Laptop'];

/** Get dynamic category list */
function getCategories() {
  const products = _getAllProducts();
  const catSet = new Set(products.map(p => p.cat).filter(Boolean));
  const ordered = _BASE_CAT_ORDER.filter(c => catSet.has(c));
  /* Append any categories not in the base list (future-proofing) */
  catSet.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
  return ['All', ...ordered];
}

/** Get store-only categories */
function getStoreCategories() {
  const baseCats = _BASE_CAT_ORDER.filter(c => c !== 'Laptop');
  /* Also include any custom categories from products that aren't in the base list */
  const products = _getAllProducts().filter(p => p.cat !== 'Laptop');
  const extraCats = [...new Set(products.map(p => p.cat).filter(c => c && !baseCats.includes(c)))];
  return ['All', ...baseCats, ...extraCats];
}

/* Legacy reference — kept as a getter for backward compatibility with admin.js */
const CATEGORIES = new Proxy([], {
  get(target, prop) {
    const cats = getCategories();
    if (prop === 'length') return cats.length;
    if (prop === 'map' || prop === 'forEach' || prop === 'filter' ||
        prop === 'includes' || prop === 'indexOf' || prop === 'join' ||
        prop === 'slice' || prop === 'some' || prop === 'every' ||
        prop === Symbol.iterator) return cats[prop].bind(cats);
    const idx = Number(prop);
    if (!isNaN(idx)) return cats[idx];
    return cats[prop];
  }
});

// Builder Slots
const BUILDER_SLOTS = [
  { key: 'CPU',         label: 'Processor',     cat: 'CPU',         required: true  },
  { key: 'GPU',         label: 'Graphics Card', cat: 'GPU',         required: true  },
  { key: 'Motherboard', label: 'Motherboard',   cat: 'Motherboard', required: true  },
  { key: 'RAM',         label: 'Memory',        cat: 'RAM',         required: true  },
  { key: 'Storage',     label: 'Storage',       cat: 'Storage',     required: true  },
  { key: 'PSU',         label: 'Power Supply',  cat: 'PSU',         required: true  },
  { key: 'Cooling',     label: 'CPU Cooler',    cat: 'Cooling',     required: false },
  { key: 'Case',        label: 'Case',          cat: 'Case',        required: false },
];

// Catalog Helpers

function _getCustomProducts() {
  try { return JSON.parse(localStorage.getItem('ds_custom_products') || '[]'); } catch(e) { return []; }
}

function _getAllProducts() {
  const hidden = (function(){ try{ return JSON.parse(localStorage.getItem('ds_hidden_products')||'[]'); }catch(e){ return []; }})();
  const base = hidden.length ? PRODUCTS.filter(p => !hidden.includes(p.id)) : PRODUCTS;
  return [...base, ..._getCustomProducts()];
}

function getProduct(id) {
  return _getAllProducts().find(p => p.id === id);
}

/** 
 * Get products by category with alias support (e.g., 'RAM' matches 'Memory')
 */
function getProductsByCategory(cat) {
  if (!cat) return [];
  const target = cat.toLowerCase();
  
  // Category Aliases for Builder Consistency (Fuzzy Match)
  const ALIASES = {
    'ram': ['memory', 'ram', 'memory kit', 'ddr4', 'ddr5'],
    'storage': ['ssd', 'hdd', 'storage', 'nvme', 'sata', 'drive'],
    'cooling': ['cooler', 'cooling', 'fan', 'aio', 'heatsink'],
    'motherboard': ['motherboard', 'board', 'mb', 'mboard'],
    'cpu': ['cpu', 'processor', 'core', 'ryzen'],
    'psu': ['psu', 'power', 'wattage']
  };

  const targets = ALIASES[target] || [target];

  return _getAllProducts().filter(p => {
    const pCat = (p.cat || '').toLowerCase();
    // Use some + includes to catch sub-categories like 'M.2 NVMe SSD'
    return targets.some(t => pCat.includes(t));
  });
}

/** Is product on sale */
function isProductOnSale(productId) {
  try {
    const stock = JSON.parse(localStorage.getItem('ds_stock') || '{}');
    return stock[productId] === 'sale';
  } catch { return false; }
}

/** Get memory type for socket */
function getSocketMemType(socket) {
  if (!socket) return null;
  const s = socket.toUpperCase();
  if (s.includes('AM5'))     return 'DDR5';
  if (s.includes('LGA1851')) return 'DDR5';
  if (s.includes('AM4'))     return 'DDR4';
  if (s.includes('LGA1700')) return null; // Flexible: Depends on the Motherboard
  if (s.includes('LGA1200')) return 'DDR4';
  if (s.includes('LGA1151')) return 'DDR4';
  if (s.includes('LGA1150')) return 'DDR3'; // Retro boards
  if (s.includes('AM3'))     return 'DDR3';
  return null;
}

/** Check if a socket supports multiple RAM types */
function isFlexiblePlatform(socket) {
  if (!socket) return false;
  return socket.toUpperCase().includes('LGA1700');
}

/**
 * Resolves performance metrics for a component dynamically based on its benchScore.
 * This replaces the old hardcoded database, allowing for infinite product flexibility.
 */
function resolveHardwareMetrics(p) {
  if (!p) return null;
  
  // Base score from the product (1-100)
  const score = parseInt(p.benchScore) || 0;
  const cat = (p.cat || '').toUpperCase();

  // Smart derivation based on category
  const res = {
    score,
    single: score,
    multi: score,
    gaming: score,
    rt: score * 0.65, // Generous RT fallback
    speed: score,
    tier: score >= 90 ? 'Enthusiast' : score >= 75 ? 'High-End' : score >= 50 ? 'Mid-Range' : 'Budget'
  };

  // Fine-tuning for specific categories
  if (cat === 'CPU') {
    res.single = score;
    res.multi = Math.max(0, score * 0.95);
  } else if (cat === 'GPU') {
    res.gaming = score;
    res.rt = score * (p.name?.toLowerCase().includes('rtx') ? 0.82 : 0.55);
  } else if (cat === 'RAM' || cat === 'STORAGE') {
    res.speed = score;
  }

  return res;
}