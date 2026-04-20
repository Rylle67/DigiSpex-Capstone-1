// Product Reviews & Ratings (LocalStorage)

const REVIEWS_KEY = 'ds_reviews';

function _revRead()       { try { return JSON.parse(localStorage.getItem(REVIEWS_KEY)||'{}'); } catch { return {}; } }
function _revWrite(data)  { try { localStorage.setItem(REVIEWS_KEY, JSON.stringify(data)); } catch {} }

function getProductReviews(productId) { return (_revRead()[productId] || []); }

// Purchase Check
function _hasPurchased(productId) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.includes('orders')) continue;
    try {
      const orders = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(orders)) {
        for (const o of orders) {
          const pName = _getProductNameById(productId);
          if (o.items && pName && o.items.some(item => item.name === pName)) return o.id;
        }
      }
    } catch {}
  }
  return null;
}

function _getProductNameById(productId) {
  try { return (typeof getProduct === 'function') ? (getProduct(productId)||{}).name || null : null; } catch { return null; }
}

function _hasReviewed(productId) {
  const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (!user) return false;
  return getProductReviews(productId).some(r => r.userId === user.id);
}

// Review Submission
function submitReview(productId) {
  const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (!user)                    { _setRevErr(productId,'Please log in to leave a review.'); return; }
  const purchasedOrderId = _hasPurchased(productId);
  if (!purchasedOrderId)        { _setRevErr(productId,'You can only review products you have purchased.'); return; }
  if (_hasReviewed(productId))  { _setRevErr(productId,'You have already reviewed this product.'); return; }

  const form  = document.getElementById('reviewStarForm-'+productId);
  const textEl = document.getElementById('reviewText-'+productId);
  const sel   = form ? parseInt(form.dataset.selected||'0') : 0;
  const text  = textEl ? textEl.value.trim() : '';

  if (!sel || sel < 1) { _setRevErr(productId,'Please select a star rating.'); return; }
  if (!text || text.length < 5) { _setRevErr(productId,'Please write at least a few words.'); return; }

  const review = { id:'r_'+Date.now(), userId:user.id, name:user.name, rating:sel, text, ts:Date.now(), orderId:purchasedOrderId, productId:productId };
  all[productId].unshift(review);
  _revWrite(all);

  if (typeof SB !== 'undefined' && SB.pushReview) {
    SB.pushReview(review);
  }

  renderReviewSection(productId);
}

function _setRevErr(productId, msg) {
  const el = document.getElementById('reviewError-'+productId);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

// Star Input UI Logic
function setupStarInput(productId) {
  const form = document.getElementById('reviewStarForm-'+productId);
  if (!form) return;
  form.dataset.selected = '0';
  form.querySelectorAll('.star-input-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const n = parseInt(btn.dataset.star);
      form.querySelectorAll('.star-input-btn').forEach((s,i) => s.classList.toggle('star-hover', i < n));
    });
    btn.addEventListener('mouseleave', () => {
      const sel = parseInt(form.dataset.selected||'0');
      form.querySelectorAll('.star-input-btn').forEach((s,i) => { s.classList.remove('star-hover'); s.classList.toggle('star-active', i < sel); });
    });
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.star);
      form.dataset.selected = n;
      form.querySelectorAll('.star-input-btn').forEach((s,i) => s.classList.toggle('star-active', i < n));
    });
  });
}

function _starsHtml(rating, size) {
  const sz = size || 14;
  return '<span class="stars-display" style="font-size:'+sz+'px">'
    + [1,2,3,4,5].map(i => '<span class="star-d '+(i<=rating?'star-filled':'star-empty')+'"></span>').join('')
    + '</span>';
}

function _avgRating(reviews) {
  if (!reviews.length) return 0;
  return reviews.reduce((s,r)=>s+r.rating,0) / reviews.length;
}

function _escH(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Sync Reviews from Order Rating
function addBatchReviewFromOrder(orderId, rating, feedback) {
  const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (!user) return;

  // Find the order
  let order = null;
  const prefix = user && user.id ? `ds_u_${user.id}_` : 'ds_guest_';
  try {
    const orders = JSON.parse(localStorage.getItem(prefix + 'orders') || '[]');
    order = orders.find(o => o.id === orderId);
  } catch (e) {
    console.error('[Reviews] Failed to find order for batch review:', e);
    return;
  }

  if (!order || !order.items) return;

  const all = _revRead();
  let changed = false;

  order.items.forEach(item => {
    const pid = item.productId || item.id;
    if (!pid) return;

    // Skip if already reviewed by this user
    if (all[pid] && all[pid].some(r => r.userId === user.id)) return;

    if (!all[pid]) all[pid] = [];
    
    const review = {
      id: 'r_batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      userId: user.id,
      name: user.name,
      rating: rating,
      text: feedback || 'Great product!',
      ts: Date.now(),
      orderId: orderId,
      productId: pid
    };
    all[pid].unshift(review);
    changed = true;

    // Sync individual review to database
    if (typeof SB !== 'undefined' && SB.pushReview) {
      SB.pushReview(review);
    }
  });

  if (changed) {
    _revWrite(all);
    console.log('[Reviews] Batch reviews added for order:', orderId);
  }
}

// Rendering Logic
function renderReviewSection(productId) {
  const container = document.getElementById('reviewSection-'+productId);
  if (!container) return;

  const reviews = getProductReviews(productId);
  const avg     = _avgRating(reviews);
  const count   = reviews.length;
  const user    = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  const purchased   = _hasPurchased(productId);
  const reviewed    = _hasReviewed(productId);

  const breakdown = [5,4,3,2,1].map(star => {
    const n = reviews.filter(r=>r.rating===star).length;
    return { star, n, pct: count > 0 ? Math.round((n/count)*100) : 0 };
  });

  let html = '<div class="review-section-title">Customer Reviews</div>';

  // Summary
  html += '<div class="rev-summary">';
  if (count > 0) {
    html += '<div class="rev-avg-block"><div class="rev-avg-score">'+avg.toFixed(1)+'</div>'+_starsHtml(Math.round(avg),18)+'<div class="rev-avg-count">'+count+' review'+(count!==1?'s':'')+'</div></div>';
    html += '<div class="rev-breakdown">';
    breakdown.forEach(b => {
      html += '<div class="rev-bar-row"><span class="rev-bar-label">'+b.star+'</span><div class="rev-bar-track"><div class="rev-bar-fill" style="width:'+b.pct+'%"></div></div><span class="rev-bar-pct">'+b.pct+'%</span></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="rev-no-reviews">No reviews yet. Be the first!</div>';
  }
  html += '</div>';

  // Write review
  html += '<div class="rev-write-section">';
  if (!user) {
    html += '<div class="rev-gate rev-gate-login"><span></span>&nbsp;<a onclick="openLoginModal()" class="rev-gate-link">Sign in</a>&nbsp;to leave a review</div>';
  } else if (reviewed) {
    html += '<div class="rev-gate rev-gate-done"><span></span>&nbsp;You have already reviewed this product</div>';
  } else if (!purchased) {
    html += '<div class="rev-gate rev-gate-purchase"><span></span>&nbsp;Purchase this product to leave a review</div>';
  } else {
    html += '<div class="rev-form" data-review-product="'+productId+'">'
      + '<div class="rev-form-title">Write a Review</div>'
      + '<div class="rev-form-stars">'
      +   '<div class="star-input-row" id="reviewStarForm-'+productId+'" data-selected="0">'
      +     [1,2,3,4,5].map(n=>'<button type="button" class="star-input-btn" data-star="'+n+'"></button>').join('')
      +   '</div>'
      +   '<span class="rev-star-hint">Tap to rate</span>'
      + '</div>'
      + '<textarea class="form-input rev-textarea" id="reviewText-'+productId+'" placeholder="Share your experience with this product..." rows="3"></textarea>'
      + '<span class="auth-error" id="reviewError-'+productId+'" style="display:none"></span>'
      + '<button class="btn-primary rev-submit-btn" onclick="submitReview(\''+productId+'\')">Submit Review</button>'
      + '</div>';
  }
  html += '</div>';

  // Review list
  if (reviews.length) {
    html += '<div class="rev-list">';
    reviews.forEach(r => {
      const date = new Date(r.ts).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'});
      html += '<div class="rev-item">'
        + '<div class="rev-item-header">'
        +   '<div class="rev-author-avatar">'+r.name.charAt(0).toUpperCase()+'</div>'
        +   '<div class="rev-author-info"><div class="rev-author-name">'+_escH(r.name)+'</div><div class="rev-author-date">'+date+'</div></div>'
        +   '<div style="margin-left:auto">'+_starsHtml(r.rating,13)+'</div>'
        + '</div>'
        + '<div class="rev-item-text">'+_escH(r.text)+'</div>'
        + '</div>';
    });
    html += '</div>';
  }

  container.innerHTML = html;
  setupStarInput(productId);
}

// Card Badge Helper
function getProductRatingBadge(productId) {
  const reviews = getProductReviews(productId);
  if (!reviews.length) return '';
  const avg = _avgRating(reviews);
  return '<span class="prod-rating-badge"> '+avg.toFixed(1)+' <span class="prod-rating-count">('+reviews.length+')</span></span>';
}
