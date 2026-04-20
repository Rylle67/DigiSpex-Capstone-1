// Open Image Viewer
function openImageViewer(src, altText, caption) {
  if (!src || src.startsWith('data:image/svg')) {
    /* Don't open viewer for SVG placeholder images */
    return;
  }

  const overlay = document.getElementById('imageViewerOverlay');
  const img = document.getElementById('imageViewerImg');
  const cap = document.getElementById('imageViewerCaption');

  if (!overlay || !img) return;

  img.src = src;
  img.alt = altText || '';
  if (cap) cap.textContent = caption || altText || '';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

// Close Image Viewer
function closeImageViewer() {
  const overlay = document.getElementById('imageViewerOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';

  /* Delay clearing src so fade-out completes */
  setTimeout(() => {
    const img = document.getElementById('imageViewerImg');
    if (img) img.src = '';
  }, 300);
}

// Support Escape to Close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeImageViewer();
});

// Automatic Click-to-Zoom Attachment
function _attachImageViewerToContainer(container) {
  if (!container) return;
  container.querySelectorAll('.product-photo--loaded').forEach(img => {
    if (img.dataset.viewerAttached) return;
    img.dataset.viewerAttached = 'true';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = typeof getProduct === 'function' ? getProduct(img.dataset.pid) : null;
      const caption = p ? `${p.cat}  —  ${p.name}` : (img.alt || '');
      openImageViewer(img.src, img.alt, caption);
    });
  });
}

/* Observe productDetailBody for DOM changes */
document.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementById('productDetailBody');
  if (!body) return;

  const observer = new MutationObserver(() => {
    _attachImageViewerToContainer(body);
  });
  observer.observe(body, { childList: true, subtree: true });
});
