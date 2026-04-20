// Rig Rating Logic

/** 
 * Extracts wattage from PSU product.
 */
function tryParseWattage(p) {
  if (!p) return 0;
  if (p.wattage && !isNaN(p.wattage)) return parseInt(p.wattage);

  const lookIn = (p.name + ' ' + (p.specs || '')).toLowerCase();
  const match = lookIn.match(/(\d{3,4})\s*(w|watt|watts)\b/);
  if (match && match[1]) return parseInt(match[1]);

  if (p.cat === 'PSU' && p.specs) {
    const specMatch = p.specs.match(/(\d{3,4})/);
    if (specMatch && specMatch[1]) return parseInt(specMatch[1]);
  }

  return 0;
}

function calcRigRating(build) {
  const cpu = build.CPU ? getProduct(build.CPU) : null;
  const gpu = build.GPU ? getProduct(build.GPU) : null;
  const ram = build.RAM ? getProduct(build.RAM) : null;
  const stor = build.Storage ? getProduct(build.Storage) : null;
  const psu = build.PSU ? getProduct(build.PSU) : null;
  const cooler = build.Cooling ? getProduct(build.Cooling) : null;

  const cpuM = resolveHardwareMetrics(cpu);
  const gpuM = resolveHardwareMetrics(gpu);
  const ramM = resolveHardwareMetrics(ram);
  const storM = resolveHardwareMetrics(stor);

  // 1. Component Scores
  const cpuScore = cpuM ? (cpuM.single * 0.45 + cpuM.multi * 0.55) : 0;
  const gpuScore = gpuM ? (gpuM.gaming * 0.8 + (gpuM.rt || 0) * 0.2) : 0;
  const ramScore = ramM ? (ramM.speed || ramM.score || 0) : 0;
  const storScore = storM ? (storM.speed || storM.score || 0) : 0;

  // 2. Final System Score (Weighted)
  let finalScore = (gpuScore * 0.50) + (cpuScore * 0.30) + (ramScore * 0.10) + (storScore * 0.10);

  // 3. System Balance (Bottleneck)
  const gap = cpuScore - gpuScore;
  let bottleneck = 'Balanced';
  if (gpuScore > 0 && cpuScore > 0) {
    if (gap < -25) {
      bottleneck = 'CPU Bottleneck';
      finalScore -= (Math.abs(gap) - 25) * 0.55; 
    } else if (gap > 35) {
      bottleneck = 'GPU Bottleneck';
      finalScore -= (gap - 35) * 0.25; 
    }
  }

  // 4. Synergy
  if (cpuScore >= 80 && !cooler) finalScore -= 8;
  if (typeof calculateTotalDraw === 'function') {
    const { total: draw } = calculateTotalDraw(build);
    const psuCap = tryParseWattage(psu);
    if (psuCap > 0 && draw > psuCap * 0.9) finalScore -= 12;
  }

  finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

  const report = {
    final: finalScore,
    cpu: Math.round(cpuScore),
    gpu: Math.round(gpuScore),
    ram: Math.round(ramScore),
    storage: Math.round(storScore),
    bottleneck: bottleneck,
    gamingTier: gpuM?.tier || (gpuScore > 85 ? '4K' : gpuScore > 60 ? '1440p' : '1080p')
  };

  const isEstimate = !cpu || !gpu || !ram || !stor || !build.Motherboard;
  return { score: finalScore, isEstimate, report };
}

function getRigLabel(score) {
  let label = 'Entry-level', color = '#22c55e';
  if (score >= 85) { label = 'Enthusiast / Flagship'; color = '#ff0044'; }
  else if (score >= 60) { label = 'High-end'; color = '#ff6b35'; }
  else if (score >= 35) { label = 'Mid-range'; color = '#3b82f6'; }
  
  return { label: label.toUpperCase(), color };
}

let _ratingTimer = null;

function animateRigRating(ratingObj) {
  const el = document.getElementById('rigRatingValue');
  const arc = document.getElementById('rigRatingArc');
  const badge = document.getElementById('rigRatingBadge');
  if (!el || !arc) return;

  const target = ratingObj?.score ?? 0;
  const isEstimate = ratingObj?.isEstimate ?? false;

  const { label, color } = getRigLabel(target);
  let cur = parseInt(el.textContent) || 0;

  clearInterval(_ratingTimer);
  if (cur === target) { _setRating(target, label, color, el, arc, badge, isEstimate, ratingObj.report); return; }

  const step = target > cur ? 1 : -1;
  const circ = 2 * Math.PI * 42;

  _ratingTimer = setInterval(() => {
    cur += step;
    arc.style.strokeDasharray = circ;
    arc.style.strokeDashoffset = circ * (1 - cur / 100);
    arc.style.stroke = color;
    el.textContent = cur;
    el.style.color = color;

    if ((step === 1 && cur >= target) || (step === -1 && cur <= target)) {
      clearInterval(_ratingTimer);
      _setRating(target, label, color, el, arc, badge, isEstimate, ratingObj.report);
    }
  }, 12);
}

function _setRating(score, label, color, el, arc, badge, isEstimate, report) {
  el.textContent = score;
  el.style.color = color;
  
  // Show estimation label if applicable
  badge.innerHTML = `${label} ${isEstimate ? '<div style="font-size:0.6rem;opacity:0.8;font-weight:400;margin-top:2px">(Estimated)</div>' : ''}`;
  
  badge.style.color = color;
  badge.style.borderColor = color + '44';
  badge.style.background = color + '11';

  // Update breakdown
  const bd = document.getElementById('rigBreakdown');
  if (bd && report) {
    bd.style.display = 'block';
    document.getElementById('rbCPU').textContent = report.cpu;
    document.getElementById('rbGPU').textContent = report.gpu;
    document.getElementById('rbMisc').textContent = Math.round((report.ram + report.storage) / 2);
    
    const bnk = document.getElementById('rbBottleneck');
    bnk.textContent = report.bottleneck;
    bnk.style.color = report.bottleneck === 'Balanced' ? 'var(--green)' : 'var(--yellow)';
  } else if (bd) {
    bd.style.display = 'none';
  }
}


function calculateTotalDraw(build) {
  let draw = 0;
  let hasMissingData = false;
  let componentCount = 0;

  for (const slotKey in build) {
    const pId = build[slotKey];
    if (!pId) continue;
    
    const p = getProduct(pId);
    if (!p || p.cat === 'PSU' || p.cat === 'Case') continue;

    componentCount++;
    
    // Primary wattage sources
    let pWatts = p.wattage || p.tdp || p.power || 0;
    
    // Fallback/Default wattages if missing
    if (pWatts === 0) {
      if (p.cat === 'CPU') pWatts = 65; // Safe average for non-K/non-X
      else if (p.cat === 'GPU') pWatts = 150; // Mid-range fallback
      else if (p.cat === 'RAM') pWatts = 5;
      else if (p.cat === 'Storage') pWatts = 7;
      else if (p.cat === 'Cooling') pWatts = p.specs?.toLowerCase().includes('liquid') ? 15 : 4;
      else if (p.cat === 'Motherboard') pWatts = 40;
      
      if (pWatts > 0) hasMissingData = true; // We guessed, so it's less "accurate"
    }
    
    draw += pWatts;
  }

  // Base load (Motherboard is often in builder, but fans/controllers are not)
  // If motherboard isn't selected, add a base for it + fans
  const hasMB = Object.values(build).some(id => getProduct(id)?.cat === 'Motherboard');
  const baseLoad = hasMB ? 25 : 65; // 25 for fans/misc, 65 if MB also missing
  
  if (componentCount > 0) {
    draw += baseLoad;
  }

  return { total: Math.round(draw), isEstimate: hasMissingData || componentCount < 4 };
}

// Power Meter Logic

function updatePowerMeter(build) {
  const psu = build.PSU ? getProduct(build.PSU) : null;
  const { total: draw, isEstimate } = calculateTotalDraw(build);
  
  const cap = tryParseWattage(psu);
  const pct = cap > 0 ? Math.min(100, (draw / cap) * 100) : 0;
  const color = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e';

  const fill = document.getElementById('powerFill');
  if (fill) {
    fill.style.width = pct + '%';
    fill.style.background = color;
  }

  const pDraw = document.getElementById('powerDraw');
  if (pDraw) {
    pDraw.innerHTML = `${draw}W draw ${isEstimate ? '<span style="font-size:0.75rem;opacity:0.7;font-weight:400">(Estimated)</span>' : ''}`;
  }

  const pPSU = document.getElementById('powerPSU');
  if (pPSU) pPSU.textContent = cap ? cap + 'W PSU' : (psu ? 'Unidentified Capacity' : 'No PSU');

  const pPct = document.getElementById('powerPct');
  if (pPct) {
    pPct.textContent = cap ? Math.round(pct) + '% load' : '—';
    pPct.style.color = color;
  }
}


// Wishlist Logic

function _getWishlistKey() {
  try {
    const u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    return u ? 'ds_wishlist_u_' + u.id : null;
  } catch { return null; }
}

function _loadWishlist() {
  const key = _getWishlistKey();
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function _saveWishlist(list) {
  const key = _getWishlistKey();
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { }
  if (typeof SB !== 'undefined') SB.pushWishlist(list);
}

let _wishlist = _loadWishlist();

function _reloadWishlist() {
  _wishlist.length = 0;
  const fresh = _loadWishlist();
  fresh.forEach(id => _wishlist.push(id));
  if (typeof _updateWishlistBadge === 'function') _updateWishlistBadge();
}

function toggleWishlist(productId, btn) {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    if (typeof openLoginModal === 'function') openLoginModal();
    showToast('Sign in to save items to your wishlist', 'error');
    return;
  }
  const i = _wishlist.indexOf(productId);
  if (i === -1) {
    _wishlist.push(productId);
    btn.classList.add('wishlisted');
    btn.title = 'Remove from wishlist';
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', 'currentColor');
    showToast('Saved to wishlist', 'success');
  } else {
    _wishlist.splice(i, 1);
    btn.classList.remove('wishlisted');
    btn.title = 'Save to wishlist';
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', 'none');
    showToast('Removed from wishlist', 'info');
  }
  _saveWishlist(_wishlist);
  if (typeof _updateWishlistBadge === 'function') _updateWishlistBadge();
}

function isWishlisted(id) {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) return false;
  return _wishlist.includes(id);
}


// Flash Deals Logic

function getDailyDeals() {
  const stock = (function () {
    try { return JSON.parse(localStorage.getItem('ds_stock') || '{}'); }
    catch { return {}; }
  })();

  const allItems = typeof _getAllProducts === 'function' ? _getAllProducts() : [];
  const saleProducts = allItems.filter(p => stock[p.id] === 'sale');

  const saleConfig = (function () {
    try { return JSON.parse(localStorage.getItem('ds_sale_config') || '{}'); }
    catch { return {}; }
  })();

  return saleProducts.map(p => {
    const config = saleConfig[p.id] || {};
    
    // Check for expiration or future start
    const today = new Date().setHours(0,0,0,0);
    if (config.startDate && new Date(config.startDate) > today) {
      return null; // Hasn't started yet
    }
    if (config.endDate && new Date(config.endDate) < today) {
      return null; // Expired
    }

    const pct = config.discount || 0.15;
    return {
      product: p,
      pct: pct,
      salePricePHP: getEffectivePrice(p.id),
      endDate: config.endDate
    };
  }).filter(Boolean);
}

function renderDeals() {
  const section = document.getElementById('flashDealsSection');
  const el = document.getElementById('dealCards');
  if (!el) return;

  const deals = getDailyDeals();

  if (!deals.length) {
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = '';

  el.innerHTML = deals.map((d, i) => `
    <div class="deal-card" style="animation-delay:${i * 0.1}s">
      <div class="deal-badge">${Math.round(d.pct * 100)}% OFF</div>
      <div class="deal-img-area">
        ${typeof productImg === 'function' ? productImg(d.product.id, 'card') : ''}
      </div>
      <div class="deal-cat-label">${d.product.cat}</div>
      <div class="deal-name">${d.product.name}</div>
      <div class="deal-specs">${d.product.specs}</div>
      <div class="deal-prices">
        <span class="deal-was">₱${(d.product.price * 57).toLocaleString()}</span>
        <span class="deal-now">₱${d.salePricePHP.toLocaleString()}</span>
      </div>
      <button class="btn-deal" onclick="addToCart('${d.product.id}',event)">Grab Deal →</button>
    </div>`).join('');

}

window.addEventListener('storage', function (e) {
  if (e.key === 'ds_stock' || e.key === 'ds_sale_config') {
    if (typeof renderDeals === 'function') renderDeals();
  }
});


// Sorting Logic

let currentSort = 'default';

function setSort(val) {
  currentSort = val;
  renderStore();
}

function applySortFilter(items) {
  if (currentSort === 'price-asc') return [...items].sort((a, b) => a.price - b.price);
  if (currentSort === 'price-desc') return [...items].sort((a, b) => b.price - a.price);
  if (currentSort === 'name') return [...items].sort((a, b) => a.name.localeCompare(b.name));
  if (currentSort === 'wishlist') return items.filter(p => _wishlist.includes(p.id));
  return items;
}
