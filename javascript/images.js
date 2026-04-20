// Image Management: Handles product images and placeholders.

const CAT_COLOR = {
    CPU:         '#3b82f6',
    GPU:         '#10b981',
    Motherboard: '#8b5cf6',
    RAM:         '#f59e0b',
    Storage:     '#06b6d4',
    PSU:         '#ef4444',
    Cooling:     '#6366f1',
    Case:        '#64748b',
    Laptop:      '#e11d48',
};

function getAdminImages() {
    try {
        return JSON.parse(localStorage.getItem('ds_custom_images') || '{}');
    } catch (e) {
        return {};
    }
}

function makePlaceholder(cat) {
    const color = CAT_COLOR[cat] || '#334155';
    const abbr  = (cat || 'PC').substring(0, 3).toUpperCase();
    const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">',
        '<defs><radialGradient id="g" cx="50%" cy="40%">',
        '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.15"/>',
        '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.03"/>',
        '</radialGradient></defs>',
        '<rect width="200" height="200" fill="url(#g)" rx="16"/>',
        '<rect x="8" y="8" width="184" height="184" fill="none"',
        ' stroke="' + color + '" stroke-opacity="0.15" stroke-width="1.5" rx="12"/>',
        '<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"',
        ' font-size="28" font-weight="700" font-family="JetBrains Mono, monospace"',
        ' letter-spacing="3" fill="' + color + '" fill-opacity="0.5">' + abbr + '</text>',
        '</svg>',
    ].join('');
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// Render product image tag
function productImg(productId, size) {
    const p      = typeof getProduct === 'function' ? getProduct(productId) : null;
    const cat    = p ? p.cat  : '';
    const name   = p ? p.name : '';
    const images = getAdminImages();
    const src    = images[productId] || makePlaceholder(cat);
    const loaded = !!images[productId];

    return '<img'
        + ' class="product-photo product-photo--' + size + (loaded ? ' product-photo--loaded' : ' product-photo--placeholder') + '"'
        + ' src="' + src + '"'
        + ' alt="' + name.replace(/"/g, '&quot;') + '"'
        + ' data-pid="' + productId + '"'
        + ' loading="lazy"'
        + (loaded ? '' : ' data-placeholder="' + makePlaceholder(cat).replace(/"/g, '&quot;') + '"')
        + (loaded ? '' : ' onerror="this.onerror=null;this.src=this.dataset.placeholder"')
        + '>';
}
