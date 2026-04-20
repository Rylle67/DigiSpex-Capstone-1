// Terms and Agreement Logic

// Internal state
let _termsAgreed = false;

// Check for agreement
function termsAgreed() {
  return _termsAgreed;
}

// Reset agreement state
function resetTerms() {
  _termsAgreed = false;
  const cb  = document.getElementById('termsCheckbox');
  const err = document.getElementById('termsError');
  const btn = document.getElementById('prConfirmBtn');
  if (cb)  cb.checked = false;
  if (err) { err.textContent = ''; err.style.display = 'none'; }
  if (btn) btn.disabled = true;
}

// Handle checkbox change
function handleTermsChange(checkbox) {
  _termsAgreed = checkbox.checked;
  const btn = document.getElementById('prConfirmBtn');
  const err = document.getElementById('termsError');
  if (btn) btn.disabled = !_termsAgreed;
  if (err && _termsAgreed) { err.style.display = 'none'; }
}

// Validate agreement before proceeding
function validateTerms() {
  if (_termsAgreed) return true;
  const err = document.getElementById('termsError');
  if (err) {
    err.textContent = 'You must agree to the Terms and Conditions before confirming payment.';
    err.style.display = 'block';
    err.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  return false;
}
