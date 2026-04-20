/*
   Digispex — supabase-sync.js
   Supabase Sync Layer (Syncs Supabase <-> localStorage)
*/
'use strict';

const SB = (() => {

  // Pull Data (Supabase -> LocalStorage)
  async function pull() {
    console.log('[SB] Pulling data from Supabase…');

    try {
      // 1. Fetch critical top-level data in parallel
      const [pRes, pkgRes, uRes] = await Promise.all([
        window.SBClient.from('products').select('*'),
        window.SBClient.from('packages').select('*'),
        window.SBClient.auth.getUser()
      ]);

      const products = pRes.data || [];
      const pkgs = pkgRes.data || [];
      const user = uRes.data?.user;

      if (pRes.error) console.error('[SB] products fetch error:', pRes.error);
      if (pkgRes.error) console.error('[SB] packages fetch error:', pkgRes.error);

      // --- Process Products ---
      const mapped = products.map(p => ({
        id: p.id,
        name: p.name,
        cat: p.category,
        price: p.price_php / 57,
        specs: p.specs || '',
        benchScore: p.bench_score || 0,
        socket: p.socket || '',
        memType: p.mem_type || '',
        tdp: p.tdp || 0,
        power: p.power || 0,
        wattage: p.wattage || 0,
        length_mm: p.length_mm || 0,
        max_gpu_length: p.max_gpu_length || 0,
        form_factor: p.form_factor || '',
        supported_form_factors: p.supported_form_factors || '',
      }));
      localStorage.setItem('ds_custom_products', JSON.stringify(mapped));

      const stock = {}, inv = {}, imgs = {}, descs = {};
      products.forEach(p => {
        if (p.stock_status && p.stock_status !== 'normal') stock[p.id] = p.stock_status;
        if (p.stock_qty !== undefined) inv[p.id] = p.stock_qty;
        if (p.image_url) imgs[p.id] = p.image_url;
        if (p.description) descs[p.id] = p.description;
      });
      localStorage.setItem('ds_stock', JSON.stringify(stock));
      localStorage.setItem('ds_inv', JSON.stringify(inv));
      localStorage.setItem('ds_custom_images', JSON.stringify(imgs));
      localStorage.setItem('ds_custom_descs', JSON.stringify(descs));
      localStorage.setItem('ds_hidden_products', JSON.stringify(products.filter(p => p.hidden).map(p => p.id)));

      // --- Process Packages ---
      localStorage.setItem('ds_custom_packages', JSON.stringify(pkgs.map(p => ({
        id: p.id, name: p.name, category: p.category,
        tagline: p.tagline || '', featured: !!p.featured,
        slots: p.slots || {}
      }))));

      // --- Process Audit Log (Fetch separately if admin) ---
      const sess = JSON.parse(localStorage.getItem('ds_auth_session') || 'null');
      if (sess?.role === 'admin' || sess?.role === 'owner') {
        window.SBClient.from('audit_log').select('*')
          .order('created_at', { ascending: false }).limit(30)
          .then(({ data }) => {
            if (data) localStorage.setItem('ds_audit_log', JSON.stringify(data.map(a => ({ ...a.data, _ts: a.created_at, _sbId: a.id }))));
          });
      }

      // --- Process User-scoped Data ---
      if (user) {
        const sess = JSON.parse(localStorage.getItem('ds_auth_session') || 'null');
        const uid = sess ? sess.id : user.id;
        const prefix = `u_${uid}_`;

        // Orders fetch: Admin/Owner sees all, Customer sees only their own
        const sessObj = JSON.parse(localStorage.getItem('ds_auth_session') || 'null');
        const userRole = sessObj ? sessObj.role : 'customer';
        let ordQuery = window.SBClient.from('orders').select('*').order('created_at', { ascending: false });
        if (userRole === 'customer') {
          ordQuery = ordQuery.eq('user_id', user.id);
        }

        const [cartRes, buildRes, ordersRes, wlRes, notifRes] = await Promise.all([
          window.SBClient.from('cart_items').select('*').eq('user_id', user.id),
          window.SBClient.from('builds').select('slots').eq('user_id', user.id).maybeSingle(),
          ordQuery,
          window.SBClient.from('wishlist').select('product_id').eq('user_id', user.id),
          window.SBClient.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        ]);

        if (cartRes.data) {
          const cart = cartRes.data.map(r => ({ productId: r.product_id, qty: r.qty }));
          localStorage.setItem(`ds_${prefix}cart`, JSON.stringify(cart));
        }
        if (buildRes.data) {
          localStorage.setItem(`ds_${prefix}build`, JSON.stringify(buildRes.data.slots || {}));
        }
        if (ordersRes.data) {
          const remoteOrders = (ordersRes.data || []).map(o => {
            try {
              // Safety fallback mapping to prevent errors if columns are missing
              return {
                ...o,
                customer: o.customer_name || o.customer || o.customer_email || '—',
                email: o.customer_email || o.email || '',
                phone: o.customer_phone || '',
                payment: o.payment_method || o.payment || 'cod',
                payment_method: o.payment_method || 'cod',
                payment_status: o.payment_status || 'pending',
                delivery_method: o.delivery_method || 'standard',
                address: o.delivery_address || o.address || '',
                delivery_address: o.delivery_address || '',
                tracking_number: o.tracking_number || '',
                notes: o.notes || '',
                // Map timestamps from snake_case to camelCase
                shippedAt: o.shipped_at || null,
                deliveredAt: o.delivered_at || null,
                receivedAt: o.received_at || null,
                cancelledAt: o.cancelled_at || null,
                date: o.created_at || o.date || null,
                userId: o.user_id || null
              };
            } catch (e) {
              console.warn('[SB] Error mapping individual order row:', e);
              return o;
            }
          });

          // status regressions.
          const localKey = `ds_${prefix}orders`;
          let localOrders = [];
          try { localOrders = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch(e){}

          const statusRank = { 'processing': 1, 'shipped': 2, 'delivered': 3, 'received': 4, 'cancelled': 0 };

          // 1. Start with remote orders, but preserve newer local statuses
          const updatedRemote = remoteOrders.map(r => {
            const local = localOrders.find(l => l.id === r.id);
            if (local) {
              const localIdx = statusRank[local.status] || 0;
              const remoteIdx = statusRank[r.status] || 0;

              // If local status is "further" along or is a terminal status, keep local
              if (localIdx > remoteIdx || local.status === 'cancelled' || local.status === 'received') {
                console.log(`[SB] Pull: Preserving advanced local status (${local.status}) over cloud status (${r.status}) for order ${r.id}`);
                return {
                  ...r,
                  status: local.status,
                  receivedAt: local.receivedAt || r.receivedAt,
                  shippedAt: local.shippedAt || r.shippedAt,
                  deliveredAt: local.deliveredAt || r.deliveredAt
                };
              }
            }
            return r;
          });

          // 2. Add back local orders that are NOT in the remote set (Syncing in progress)
          const localOnly = localOrders.filter(l => !remoteOrders.some(r => r.id === l.id));
          if (localOnly.length) {
            console.log(`[SB] Pull: Preserving ${localOnly.length} local-only orders.`);
          }

          const mergedOrders = [...updatedRemote, ...localOnly];

          // Sort merged result by date DESC
          mergedOrders.sort((a, b) => {
            const dateA = a.date || a.created_at || '';
            const dateB = b.date || b.created_at || '';
            return dateB.localeCompare(dateA);
          });

          localStorage.setItem(localKey, JSON.stringify(mergedOrders));
        }
        if (wlRes.data) {
          const wlIds = wlRes.data.map(w => w.product_id);
          localStorage.setItem(`ds_wishlist_${uid}`, JSON.stringify(wlIds));
          localStorage.setItem(`ds_wishlist_u_${uid}`, JSON.stringify(wlIds));
        }

        if (notifRes.data) {
          const mappedNotifs = (notifRes.data || []).map(n => {
            const label = n.label || n.title || 'Notification';
            const msg = n.msg || n.body || '';
            let color = n.color || '#2563eb';
            let bg = n.bg || 'rgba(37,99,235,0.12)';

            // Reconstruct colors based on statusKey if they're missing from DB
            const sKey = n.statusKey || n.status_key || null;
            if (sKey && typeof NOTIFY !== 'undefined' && NOTIFY._getStatusMeta) {
               const meta = NOTIFY._getStatusMeta(sKey);
               if (meta) { color = meta.color; bg = meta.bg; }
            } else if (n.type === 'seller_reply') {
               color = '#7c3aed'; bg = 'rgba(124,58,237,0.12)';
            } else if (n.type === 'customer_msg') {
               color = '#f59e0b'; bg = 'rgba(245,158,11,0.12)';
            }

            const ts = n.created_at ? new Date(n.created_at).getTime() : Date.now();
            return { ...n, label, msg, color, bg, ts, statusKey: sKey, orderId: n.order_id || n.ref_id || n.orderId };
          });
          localStorage.setItem(`ds_notif_${uid}`, JSON.stringify(mappedNotifs));
          localStorage.setItem(`ds_notifications_${uid}`, JSON.stringify(mappedNotifs));
        }
      }

      // --- Process Global Reviews ---
      await syncReviews();

      console.log('[SB] Pull complete ✓');
    } catch (err) {
      console.error('[SB] Pull critical error:', err);
    }
  }

  // Push Helpers (LocalStorage -> Supabase)

  async function pushProduct(product) {
    const { error } = await window.SBClient.from('products').upsert({
      id: product.id,
      name: product.name,
      category: product.cat,
      price_php: Math.round(product.price * 57),
      specs: product.specs || '',
      description: product.description || '',
      image_url: product.imageUrl || '',
      bench_score: product.benchScore || 0,
      stock_status: product.stockStatus || 'normal',
      stock_qty: product.stockQty !== undefined ? product.stockQty : 50,
      socket: product.socket || null,
      mem_type: product.memType || null,
      tdp: product.tdp || 0,
      power: product.power || 0,
      wattage: product.wattage || 0,
      length_mm: product.length_mm || 0,
      max_gpu_length: product.max_gpu_length || 0,
      form_factor: product.form_factor || null,
      supported_form_factors: product.supported_form_factors || null,
      hidden: !!product.hidden,
    });
    if (error) console.error('[SB] pushProduct error:', error);
  }

  async function deleteProduct(id) {
    const { error } = await window.SBClient.from('products').delete().eq('id', id);
    if (error) {
      console.error('[SB] deleteProduct error:', error);
      return;
    }

    // Cleanup Cascade: Remove deleted product from all local scopes
    const sess = JSON.parse(localStorage.getItem('ds_auth_session') || 'null');
    const prefix = sess ? `u_${sess.id}_` : 'guest_';

    // 1. Cleanup Cart
    const cartKey = `ds_${prefix}cart`;
    let cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    const newCart = cart.filter(item => item.productId !== id);
    if (newCart.length !== cart.length) localStorage.setItem(cartKey, JSON.stringify(newCart));

    // 2. Cleanup Build
    const buildKey = `ds_${prefix}build`;
    let build = JSON.parse(localStorage.getItem(buildKey) || '{}');
    let changed = false;
    for (const slot in build) {
      if (build[slot] === id) { delete build[slot]; changed = true; }
    }
    if (changed) {
      localStorage.setItem(buildKey, JSON.stringify(build));
      if (typeof renderBuilder === 'function') renderBuilder();
    }

    // 3. Clear from catalog immediately
    let customs = JSON.parse(localStorage.getItem('ds_custom_products') || '[]');
    localStorage.setItem('ds_custom_products', JSON.stringify(customs.filter(p => p.id !== id)));
  }

  async function updateProduct(id, updates) {
    const { error } = await window.SBClient.from('products').update(updates).eq('id', id);
    if (error) console.error('[SB] updateProduct error:', error);
  }

  async function pushCart(cartArray) {
    const { data: { user } } = await window.SBClient.auth.getUser();
    if (!user) return;
    await window.SBClient.from('cart_items').delete().eq('user_id', user.id);
    if (cartArray.length) {
      await window.SBClient.from('cart_items').insert(
        cartArray.map(i => ({ user_id: user.id, product_id: i.productId, qty: i.qty }))
      );
    }
  }

  async function pushBuild(buildObj) {
    const { data: { user } } = await window.SBClient.auth.getUser();
    if (!user) return;
    await window.SBClient.from('builds').upsert(
      { user_id: user.id, slots: buildObj },
      { onConflict: 'user_id' }
    );
  }

  async function pushOrder(order) {
    const { data: { user } } = await window.SBClient.auth.getUser();
    const custName = typeof order.customer === 'string' ? order.customer : (order.customer?.name || '');
    const custEmail = order.email || order.customer?.email || '';
    const custPhone = order.phone || order.customer_phone || '';
    const deliveryAddr = order.address || order.delivery_address || '';

    const { error } = await window.SBClient.from('orders').insert({
      id: order.id,
      user_id: user ? user.id : null,
      items: order.items,
      total: order.total,
      status: order.status || 'processing',
      customer_name: custName,
      customer_email: custEmail,
      customer_phone: custPhone,
      payment_method: order.payment || order.payment_method || 'cod',
      payment_status: order.payment_status || 'pending',
      delivery_method: order.delivery_method || 'standard',
      delivery_address: deliveryAddr,
      tracking_number: order.tracking_number || '',
      notes: order.additionalInfo || order.notes || '',
      shipped_at: order.shippedAt || null,
      delivered_at: order.deliveredAt || null,
      received_at: order.receivedAt || null,
      cancelled_at: order.cancelledAt || null,
    });
    if (error) { console.error('[SB] pushOrder error:', error); return; }

    // Also insert a row in payments table
    await pushPayment(order.id, order.payment || order.payment_method || 'cod', order.total, order.payment_status || 'pending', '', '', user ? user.id : null);
  }

  async function pushPayment(orderId, method, amount, status = 'pending', referenceNo = '', proofUrl = '', userId = null) {
    if (!window.SBClient) return;

    const { error } = await window.SBClient.from('payments').insert({
      order_id: orderId,
      user_id: userId,
      method: method,
      status: status,
      amount: amount,
      reference_no: referenceNo,
      proof_url: proofUrl,
    });
    if (error) console.error('[SB] pushPayment error:', error);
  }

  async function pushDeliveryEvent(orderId, status, location = '', notes = '') {
    if (!window.SBClient) return;
    try {
      const { error } = await window.SBClient.from('delivery_tracking').insert({
        order_id: orderId,
        status,
        location,
        notes,
      });
      if (error) {
        console.error('[SB] pushDeliveryEvent failure:', error.message, error.code);
      } else {
        console.log(`[SB] Tracking event pushed: ${status}`);
      }
    } catch (e) {
      console.warn('[SB] pushDeliveryEvent caught error:', e);
    }
  }

  async function pushInventoryLog(productId, changeQty, reason = 'manual', notes = '') {
    if (!window.SBClient) return;
    try {
      const { data: { user } } = await window.SBClient.auth.getUser();
      const { error } = await window.SBClient.from('inventory_log').insert({
        product_id: productId,
        change_qty: changeQty,
        reason: reason,
        notes: notes,
        performed_by: user ? user.id : null,
      });
      if (error) console.error('[SB] pushInventoryLog error:', error);
    } catch (e) { console.error('[SB] pushInventoryLog exception:', e); }
  }

  async function refreshDailySales(dateStr) {
    if (!window.SBClient) return;
    try {
      const { error } = await window.SBClient.rpc('refresh_daily_sales', {
        p_date: dateStr || new Date().toISOString().slice(0, 10)
      });
      if (error) console.error('[SB] refreshDailySales error:', error);
      else console.log('[SB] Daily sales snapshot refreshed ✓');
    } catch (e) { console.error('[SB] refreshDailySales exception:', e); }
  }

  async function pullDailySalesReport(days = 30) {
    if (!window.SBClient) return [];
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await window.SBClient
        .from('report_daily_sales')
        .select('*')
        .gte('report_date', since.toISOString().slice(0, 10))
        .order('report_date', { ascending: false });
      if (error) { console.error('[SB] pullDailySalesReport error:', error); return []; }
      return data || [];
    } catch (e) { console.error('[SB] pullDailySalesReport exception:', e); return []; }
  }

  async function pullPayments(orderId) {
    if (!window.SBClient) return [];
    try {
      const { data, error } = await window.SBClient
        .from('payments').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
      if (error) { console.error('[SB] pullPayments error:', error); return []; }
      return data || [];
    } catch (e) { return []; }
  }

  async function pullDeliveryTracking(orderId) {
    if (!window.SBClient) return [];
    try {
      const { data, error } = await window.SBClient
        .from('delivery_tracking')
        .select('*')
        .eq('order_id', orderId)
        .order('recorded_at', { ascending: true }); // Aligned with your SQL schema
      if (error) { console.warn('[SB] pullDeliveryTracking warning:', error.message); return []; }
      return data || [];
    } catch (e) {
      console.warn('[SB] pullDeliveryTracking caught error:', e);
      return [];
    }
  }

  async function updatePaymentStatus(orderId, status, referenceNo = '', proofUrl = '') {
    if (!window.SBClient) return;
    const updates = { status };
    if (referenceNo) updates.reference_no = referenceNo;
    if (proofUrl) updates.proof_url = proofUrl;
    if (status === 'paid') updates.paid_at = new Date().toISOString();
    const { error } = await window.SBClient.from('payments').update(updates).eq('order_id', orderId);
    if (error) console.error('[SB] updatePaymentStatus error:', error);
    // Mirror onto orders table
    await window.SBClient.from('orders').update({ payment_status: status }).eq('id', orderId);
  }

  async function updateOrderStatus(orderId, status, extra = {}) {
    const mappedUpdates = { status };
    if (extra.shippedAt) mappedUpdates.shipped_at = extra.shippedAt;
    if (extra.deliveredAt) mappedUpdates.delivered_at = extra.deliveredAt;
    if (extra.receivedAt) mappedUpdates.received_at = extra.receivedAt;
    if (extra.cancelledAt) mappedUpdates.cancelled_at = extra.cancelledAt;
    if (extra.trackingNumber) mappedUpdates.tracking_number = extra.trackingNumber;

    // Mark payment as paid when order is confirmed/shipped
    if (status === 'shipped' || status === 'confirmed') {
      mappedUpdates.payment_status = 'paid';
    }
    if (status === 'cancelled') {
      mappedUpdates.payment_status = 'refunded';
      mappedUpdates.cancelled_at = extra.cancelledAt || new Date().toISOString();
    }

    const { error } = await window.SBClient.from('orders').update(mappedUpdates).eq('id', orderId);
    if (error) {
      console.error(`[SB] updateOrderStatus error for ${orderId}:`, error);
      throw error;
    }
    console.log(`[SB] updateOrderStatus success for ${orderId}: ${status}`);

    // Log delivery tracking event for shipment milestones
    const deliveryEvents = {
      processing: 'processing',
      confirmed: 'confirmed',
      shipped: 'in_transit',
      delivered: 'delivered',
      received: 'delivered',
      cancelled: 'cancelled',
    };
    const deliveryStatus = deliveryEvents[status];
    if (status === 'received') {
      await deleteDeliveryTracking(orderId);
    } else if (deliveryStatus) {
      await pushDeliveryEvent(orderId, deliveryStatus, extra.location || '', `Order status changed to ${status}`);
    }

    // Mirror payment status update
    if (mappedUpdates.payment_status) {
      await window.SBClient.from('payments').update({ status: mappedUpdates.payment_status }).eq('order_id', orderId);
    }
  }

  async function updateOrderRating(orderId, rating, feedback) {
    await window.SBClient.from('orders').update({ rating, feedback }).eq('id', orderId);
  }

  async function pushReview(review) {
    if (!window.SBClient) return;
    const { error } = await window.SBClient.from('reviews').upsert({
      id: review.id.startsWith('r_') ? undefined : review.id, // Generate UUID on DB if it's a local 'r_' prefixed ID
      product_id: review.productId,
      order_id: review.orderId || null,
      user_id: review.userId,
      user_name: review.name,
      rating: parseInt(review.rating),
      text: review.text,
      created_at: review.ts ? new Date(review.ts).toISOString() : new Date().toISOString()
    });
    if (error) console.error('[SB] pushReview error:', error);
  }

  async function deleteOrder(orderId) {
    await window.SBClient.from('orders').delete().eq('id', orderId);
  }

  async function pushWishlist(wishlistIds) {
    const { data: { user } } = await window.SBClient.auth.getUser();
    if (!user) return;
    await window.SBClient.from('wishlist').delete().eq('user_id', user.id);
    if (wishlistIds.length) {
      await window.SBClient.from('wishlist').insert(
        wishlistIds.map(pid => ({ user_id: user.id, product_id: pid }))
      );
    }
  }

  async function pushAuditEntry(entry) {
    if (!window.SBClient) return;
    try {
      const { data: { user } } = await window.SBClient.auth.getUser();
      await window.SBClient.from('audit_log').insert({
        user_id: user ? user.id : null,
        type: entry.type || 'unknown',
        data: entry,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.error('[SB] pushAuditEntry sync failed:', e);
    }
  }

  async function pushPackage(pkg) {
    const { error } = await window.SBClient.from('packages').upsert({
      id: pkg.id,
      name: pkg.name,
      category: pkg.category || pkg.cat || 'Gaming',
      tagline: pkg.tagline || '',
      featured: !!pkg.featured,
      slots: pkg.slots || {},
    });
    if (error) {
      console.error('[SB] pushPackage error:', error);
      showToast('Database Sync Error: ' + error.message, 'error');
    }
  }

  async function deletePackage(id) {
    await window.SBClient.from('packages').delete().eq('id', id);
  }

  async function pushNotification(userId, notif) {
    if (!window.SBClient) return;
    const { error } = await window.SBClient.from('notifications').insert({
      id: notif.id.startsWith('n_') ? undefined : notif.id,
      user_id: userId,
      type: notif.type,
      ref_id: notif.orderId || null,
      title: notif.label,
      body: notif.msg,
      read: !!notif.read,
      created_at: notif.ts ? new Date(notif.ts).toISOString() : new Date().toISOString()
    });
    if (error) console.error('[SB] pushNotification error:', error);
  }

  async function pushMessage(orderId, sender, body) {
    if (!window.SBClient) return;
    await window.SBClient.from('messages').insert({
      order_id: orderId,
      sender,
      body
    });
  }

  async function getMessages(orderId) {
    const { data: { user } } = await window.SBClient.auth.getUser();
    if (!user) return [];

    // Verify user ownership or admin status if possible
    // For now, we fetch by order_id, which is already scoped during order fetch
    const { data, error } = await window.SBClient.from('messages').select('*')
      .eq('order_id', orderId).order('created_at', { ascending: true });

    if (error) {
      console.error('[SB] getMessages error:', error);
      return [];
    }
    return data || [];
  }

  async function deleteUserNotifications(userId) {
    if (!window.SBClient) return;
    const { error } = await window.SBClient.from('notifications')
      .delete().eq('user_id', userId);
    if (error) console.error('[SB] deleteUserNotifications error:', error);
  }

  async function getCustomerCount() {
    if (!window.SBClient) return 0;
    try {
      const { count, error } = await window.SBClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer');
      if (error) { console.error('[SB] getCustomerCount error:', error); return 0; }
      return count || 0;
    } catch (e) {
      return 0;
    }
  }

  async function syncReviews(onComplete) {
    if (!window.SBClient) return;
    try {
      const { data, error } = await window.SBClient.from('reviews').select('*');
      if (error) { console.error('[SB] SyncReviews error:', error); return; }
      const grouped = {};
      (data || []).forEach(r => {
        if (!grouped[r.product_id]) grouped[r.product_id] = [];
        grouped[r.product_id].push({
          id: r.id, productId: r.product_id, orderId: r.order_id,
          userId: r.user_id, name: r.user_name, rating: r.rating,
          text: r.text, ts: new Date(r.created_at).getTime()
        });
      });
      localStorage.setItem('ds_reviews', JSON.stringify(grouped));
      if (typeof onComplete === 'function') onComplete(data);
    } catch (e) {
       console.warn('[SB] syncReviews caught error:', e);
    }
  }

  async function pullAllOrders() {
    if (!window.SBClient) { console.warn('[SB] pullAllOrders: Client not initialized'); return []; }
    console.log('[SB] Pulling ALL orders for Owner…');
    try {
      const { data, error } = await window.SBClient
        .from('orders').select('*').order('created_at', { ascending: false });
      const mapped = (data || []).map(o => {
        try {
          return {
            ...o,
            customer: o.customer_name || o.customer || '—',
            email: o.customer_email || o.email || '',
            phone: o.customer_phone || '',
            payment: o.payment_method || o.payment || 'cod',
            payment_method: o.payment_method || 'cod',
            payment_status: o.payment_status || 'pending',
            delivery_method: o.delivery_method || 'standard',
            address: o.delivery_address || o.address || '',
            delivery_address: o.delivery_address || '',
            tracking_number: o.tracking_number || '',
            notes: o.notes || '',
            shippedAt: o.shipped_at || null,
            deliveredAt: o.delivered_at || null,
            receivedAt: o.received_at || null,
            cancelledAt: o.cancelled_at || null,
            date: o.created_at || o.date || null,
            userId: o.user_id || null
          };
        } catch (e) {
          return o;
        }
      });
      console.log(`[SB] Pulled ${mapped.length} orders.`);
      return mapped;
    } catch (e) {
      console.warn('[SB] pullAllOrders caught error:', e);
      return [];
    }
  }

  async function deleteDeliveryTracking(orderId) {
    if (!window.SBClient) return;
    console.log(`[SB] Clearing delivery tracking for order ${orderId}...`);
    await window.SBClient.from('delivery_tracking').delete().eq('order_id', orderId);
  }

  function initRealtime(uid, onNotif, onReviews) {
    if (!window.SBClient || !uid) return;
    console.log('[SB] Initializing Realtime for user:', uid);
    
    // Listen for new notifications
    const channel = window.SBClient.channel('db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        payload => {
          console.log('[SB] New notification received via Realtime:', payload.new);
          if (typeof onNotif === 'function') onNotif(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reviews' },
        async payload => {
          console.log('[SB] Review change detected:', payload.eventType);
          await syncReviews();
          if (typeof onReviews === 'function') onReviews(payload);
        }
      )
      .subscribe();
      
    return channel;
  }

  async function pushSubscriber(email) {
    if (!window.SBClient) return;
    console.log(`[SB] Adding subscriber: ${email}`);
    const { error } = await window.SBClient.from('subscribers').insert({ email });
    if (error && error.code !== '23505') { // 23505 is unique violation (already subbed)
      console.warn('[SB] pushSubscriber failed:', error.message);
      throw error;
    }
  }

  // Public API
  return {
    pull,
    pushProduct,
    deleteProduct,
    updateProduct,
    pushCart,
    pushBuild,
    pushOrder,
    updateOrderStatus,
    updateOrderRating,
    pushReview,
    deleteOrder,
    pushWishlist,
    pushAuditEntry,
    pushPackage,
    deletePackage,
    pushNotification,
    pushMessage,
    getMessages,
    pushPayment,
    pushDeliveryEvent,
    pushInventoryLog,
    refreshDailySales,
    pullDailySalesReport,
    pullPayments,
    pullDeliveryTracking,
    updatePaymentStatus,
    getCustomerCount,
    pullAllOrders,
    deleteDeliveryTracking,
    deleteUserNotifications,
    deleteNotification: async (id) => {
      if (window.SBClient) await window.SBClient.from('notifications').delete().eq('id', id);
    },
    initRealtime,
    syncReviews,
    pushSubscriber
  };
})();