/**
 * NutriWise - 3D Product Showcase Application
 * Matches Figma Make "3D Product Showcase Card" layout, interactions, and sync
 */

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peso = n => '₱' + Math.max(0, Math.round(Number(n) || 0)).toLocaleString('en-PH');

const post = async (url, data) => {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    let json;
    try {
      json = await r.json();
    } catch {
      json = { error: 'Invalid response from server.' };
    }
    return { ok: r.ok, json };
  } catch (err) {
    return { ok: false, json: { error: 'Network error. Please check your connection and try again.' } };
  }
};

let products = [];
let cart = [];
try {
  const stored = JSON.parse(localStorage.getItem('nw_cart') || '[]');
  cart = Array.isArray(stored) ? stored.filter(c => c && c.id && Number(c.qty) > 0) : [];
} catch {
  cart = [];
}
let currentModalProduct = null;

// Modal 3D tilt tracking state
let modalCurrentRotY = 0;
let modalCurrentRotX = 0;

/* ========================================================
   DATA LOADING & RENDERING
   ======================================================== */
async function load() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Failed to fetch data');
    const data = await res.json();
    products = Array.isArray(data.products) ? data.products : [];

    // Render Product Showcase Grid
    renderProducts(products);

    // Render How It's Made Process Steps
    renderProcess(Array.isArray(data.steps) ? data.steps : []);

    // Populate Inquiry Product Dropdown
    const select = $('f-product');
    if (select) {
      select.innerHTML = '<option value="">Select a product</option>' + 
        products.map(p => `<option value="${esc(p.name)}">${esc(p.name)} (${peso(p.price)} / ${esc(p.unit)})</option>`).join('') +
        '<option value="All Products / Custom Mix">All Products / Custom Mix</option>';
    }

    // Clean cart of removed or out-of-stock products
    cart = cart.filter(c => products.find(p => p.id === c.id && p.inStock));
    renderCart();
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

function renderProducts(items) {
  const grid = $('product-grid');
  if (!grid) return;
  if (!items.length) {
    grid.innerHTML = '<p class="empty-bag" style="grid-column: 1/-1; text-align: center; padding: 40px;">No products currently available.</p>';
    return;
  }

  grid.innerHTML = items.map(p => `
    <article class="product-card" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${esc(p.name)}">
      <div class="product-media">
        <img src="${esc(p.image || '/hero-bar.jpg')}" alt="${esc(p.name)}" class="product-media-img" loading="lazy">
        <span class="stock-tag ${p.inStock ? 'in-stock' : 'out-of-stock'}">
          ${p.inStock ? 'IN STOCK' : 'OUT OF STOCK'}
        </span>
        <div class="inspect-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span>3D Showcase</span>
        </div>
      </div>

      <div class="product-body">
        <div class="product-tags">
          ${(p.badges || []).map(b => `<span class="tag-chip">${esc(b)}</span>`).join('')}
        </div>
        <h3 class="product-name">${esc(p.name)}</h3>
        <p class="product-summary">${esc(p.description)}</p>

        <div class="product-footer">
          <div class="price-wrap">
            <span class="price-amount">${peso(p.price)}</span>
            <span class="price-unit">${esc(p.unit)}</span>
          </div>

          <div class="card-btn-group">
            <button class="btn-pill dark sm" data-action="order" data-id="${p.id}" ${p.inStock ? '' : 'disabled'}>
              ${p.inStock ? 'Pre-order' : 'Unavailable'}
            </button>
          </div>
        </div>
      </div>
    </article>
  `).join('');
}

const STEP_SVGS = [
  // 01 Sourcing: Leaf sprout outline
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4E7843" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22V12"/>
    <path d="M12 12C12 7.5 7.5 4 4 4c0 4.5 3.5 8 8 8z"/>
    <path d="M12 14c0-3.5 3-6 7-6 0 3.5-2.5 6-7 6z"/>
  </svg>`,
  // 02 Mixing: Fork & knife outline
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4E7843" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 2v20"/>
    <path d="M21 2v6a3 3 0 0 1-3 3"/>
    <path d="M4 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/>
    <path d="M6 10v12"/>
    <path d="M6 2v5"/>
  </svg>`,
  // 03 Baking: Baking dish with steam lines
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4E7843" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="9" rx="2"/>
    <line x1="7" y1="5" x2="7" y2="8"/>
    <line x1="12" y1="4" x2="12" y2="8"/>
    <line x1="17" y1="5" x2="17" y2="8"/>
  </svg>`,
  // 04 Packaging: Isometric package box
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4E7843" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>`
];

function renderProcess(steps) {
  const container = $('process-timeline');
  if (!container) return;
  container.innerHTML = steps.map((s, idx) => `
    <div class="process-step-figma">
      <div class="process-circle-num">${String(idx + 1).padStart(2, '0')}</div>
      <div class="process-title-row">
        <span class="process-icon-symbol">${STEP_SVGS[idx % STEP_SVGS.length]}</span>
        <h3 class="process-title-text">${esc(s.title)}</h3>
      </div>
      <p class="process-desc-text">${esc(s.description)}</p>
    </div>
  `).join('');
}

/* ========================================================
   COLLECTION SHOWCASE 3D MODAL (FIGMA IMAGE 3)
   ======================================================== */
const productModal = $('product-modal');
const modalStage = $('modal-stage');
const modalCard = $('modal-card');

function openProductModal(prod) {
  if (!prod) return;
  currentModalProduct = prod;

  const prodIdx = products.findIndex(p => p.id === prod.id);
  const sigNum = $('m-sig-num');
  if (sigNum) sigNum.textContent = String(prodIdx >= 0 ? prodIdx + 1 : 1).padStart(2, '0');

  // Badges
  const badgesBox = $('m-badges');
  if (badgesBox) {
    badgesBox.innerHTML = (prod.badges || []).map(b => `<span class="tag-chip">${esc(b)}</span>`).join('');
  }

  // Left Stage Texts
  const titleEl = $('m-title');
  if (titleEl) titleEl.textContent = prod.name;
  const descEl = $('m-desc');
  if (descEl) descEl.textContent = prod.description;
  const priceEl = $('m-price');
  if (priceEl) priceEl.textContent = peso(prod.price);
  const unitEl = $('m-unit');
  if (unitEl) unitEl.textContent = prod.unit;

  // Image & Portal
  const imgEl = $('m-img');
  if (imgEl) {
    imgEl.src = prod.image || '/hero-bar.jpg';
    imgEl.alt = prod.name;
  }

  // Action Button
  const actionBtn = $('m-action-btn');
  if (actionBtn) {
    if (prod.inStock) {
      actionBtn.textContent = 'Pre-order this product →';
      actionBtn.disabled = false;
    } else {
      actionBtn.textContent = 'Currently Unavailable';
      actionBtn.disabled = true;
    }
  }

  // Floating Calories Badge
  const calNum = $('m-cal-num');
  const calVal = prod.nutrition?.calories || 210;
  if (calNum) calNum.textContent = calVal;

  // Sidebar List
  const sidebarCount = $('sidebar-count');
  if (sidebarCount) sidebarCount.textContent = `${products.length} products`;
  const sidebarList = $('sidebar-products-list');
  if (sidebarList) {
    sidebarList.innerHTML = products.map(p => `
      <div class="sidebar-item ${p.id === prod.id ? 'active' : ''}" data-sidebar-id="${p.id}" tabindex="0" role="button" aria-label="Select ${esc(p.name)}">
        <img src="${esc(p.image || '/hero-bar.jpg')}" alt="${esc(p.name)}" class="sidebar-thumb" loading="lazy">
        <div class="sidebar-item-info">
          <div class="sidebar-item-name">${esc(p.name)}</div>
          <div class="sidebar-item-sub">${peso(p.price)} · ${esc(p.unit)}</div>
        </div>
      </div>
    `).join('');
  }

  // Bottom 3 Cards
  const ingrEl = $('m-ingredients');
  if (ingrEl) ingrEl.textContent = prod.ingredients || 'Crafted with certified wholesome ingredients in small artisan batches.';
  const procEl = $('m-process');
  if (procEl) procEl.textContent = prod.process || 'Every batch is measured and mixed for balanced nutrition, then packed fresh.';

  const servEl = $('m-serv-size');
  if (servEl) servEl.textContent = prod.nutrition?.serving || '3 bites (45g)';
  const tCal = $('m-table-cal');
  if (tCal) tCal.textContent = prod.nutrition?.calories || 210;
  const tProt = $('m-table-prot');
  if (tProt) tProt.textContent = prod.nutrition?.protein || '8g';
  const tFiber = $('m-table-fiber');
  if (tFiber) tFiber.textContent = prod.nutrition?.fiber || '5g';
  const tSugars = $('m-table-sugars');
  if (tSugars) tSugars.textContent = prod.nutrition?.sugars || '9g';

  // Reset 3D rotation angles cleanly
  modalCurrentRotY = 0;
  modalCurrentRotX = 0;
  if (modalCard) {
    modalCard.style.transform = 'translateY(-50%) rotateY(0deg) rotateX(0deg)';
  }

  if (productModal && !productModal.open) {
    productModal.showModal();
  }
}

// Sidebar product selection delegation
const sidebarList = $('sidebar-products-list');
if (sidebarList) {
  sidebarList.addEventListener('click', e => {
    const item = e.target.closest('[data-sidebar-id]');
    if (!item) return;
    const id = item.dataset.sidebarId;
    const found = products.find(p => p.id === id);
    if (found) {
      openProductModal(found);
    }
  });
}



// Hero showcase card click handler
const heroCard = $('showcase-card');
if (heroCard) {
  const openSignature = () => {
    const signatureProd = products.find(p => p.id === 'p1') || products[0];
    if (signatureProd) openProductModal(signatureProd);
  };
  heroCard.addEventListener('click', openSignature);
  heroCard.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openSignature();
    }
  });
}

const modalCloseBtn = $('modal-close');
if (modalCloseBtn) modalCloseBtn.onclick = () => productModal.close();

if (productModal) {
  productModal.addEventListener('click', e => {
    const rect = productModal.getBoundingClientRect();
    const isInside = (
      rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width
    );
    if (!isInside) productModal.close();
  });
}

/* ========================================================
   ADD TO CART CONFIRMATION MODAL
   ======================================================== */
const confirmCartDialog = $('confirm-cart-dialog');
let pendingConfirmProduct = null;
let pendingConfirmQty = 1;

function promptAddToCart(prod, initialQty = 1) {
  if (!prod || !prod.inStock) return;
  pendingConfirmProduct = prod;
  pendingConfirmQty = Math.max(1, initialQty);
  updateConfirmUI();
  if (confirmCartDialog) {
    confirmCartDialog.showModal();
  }
}

function updateConfirmUI() {
  if (!pendingConfirmProduct) return;
  const p = pendingConfirmProduct;
  const img = $('conf-img');
  if (img) {
    img.src = p.image || '/hero-bar.jpg';
    img.alt = p.name;
  }
  const name = $('conf-name');
  if (name) name.textContent = p.name;
  const unit = $('conf-unit');
  if (unit) unit.textContent = p.unit;
  const price = $('conf-price');
  if (price) price.textContent = peso(p.price);
  const qtyVal = $('conf-qty-val');
  if (qtyVal) qtyVal.textContent = pendingConfirmQty;
  const subtotal = $('conf-subtotal');
  if (subtotal) subtotal.textContent = peso(p.price * pendingConfirmQty);
}

const confDec = $('conf-qty-dec');
if (confDec) {
  confDec.onclick = () => {
    if (pendingConfirmQty > 1) {
      pendingConfirmQty--;
      updateConfirmUI();
    }
  };
}

const confInc = $('conf-qty-inc');
if (confInc) {
  confInc.onclick = () => {
    pendingConfirmQty++;
    updateConfirmUI();
  };
}

const confClose = $('conf-close');
if (confClose) confClose.onclick = () => confirmCartDialog && confirmCartDialog.close();

const confCancel = $('conf-cancel');
if (confCancel) confCancel.onclick = () => confirmCartDialog && confirmCartDialog.close();

if (confirmCartDialog) {
  confirmCartDialog.addEventListener('click', e => {
    const rect = confirmCartDialog.getBoundingClientRect();
    const isInside = (
      rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width
    );
    if (!isInside) confirmCartDialog.close();
  });
}

const confConfirm = $('conf-confirm');
if (confConfirm) {
  confConfirm.onclick = () => {
    if (!pendingConfirmProduct || !pendingConfirmProduct.inStock) return;
    changeCart(pendingConfirmProduct.id, pendingConfirmQty);
    confirmCartDialog.close();
    if (productModal && productModal.open) {
      productModal.close();
    }
    setCartOpen(true);
  };
}

$('m-action-btn').onclick = () => {
  if (!currentModalProduct || !currentModalProduct.inStock) return;
  promptAddToCart(currentModalProduct, 1);
};

/* ========================================================
   CLICK HANDLING (GRID & PRE-ORDER)
   ======================================================== */
document.addEventListener('click', e => {
  // Check if clicked pre-order button
  const orderBtn = e.target.closest('[data-action="order"]');
  if (orderBtn) {
    e.stopPropagation();
    const pid = orderBtn.dataset.id;
    const prod = products.find(p => p.id === pid);
    if (prod && prod.inStock) {
      promptAddToCart(prod, 1);
    }
    return;
  }

  // Check if clicked product card (excluding button)
  const card = e.target.closest('.product-card');
  if (card && !e.target.closest('button')) {
    const pid = card.dataset.id;
    const prod = products.find(p => p.id === pid);
    if (prod) openProductModal(prod);
  }
});

/* ========================================================
   CART SYSTEM
   ======================================================== */
const saveCart = () => localStorage.setItem('nw_cart', JSON.stringify(cart));
const cartLines = () => cart.map(c => ({ ...c, p: products.find(p => p.id === c.id) })).filter(l => l.p && l.p.inStock);
const cartTotal = () => cartLines().reduce((sum, l) => sum + l.p.price * l.qty, 0);

function renderCart() {
  saveCart();
  const lines = cartLines();
  const totalCount = lines.reduce((s, l) => s + l.qty, 0);

  $('cart-count').textContent = totalCount;
  $('cart-total').textContent = peso(cartTotal());
  $('checkout-btn').disabled = !lines.length;

  const container = $('cart-items');
  if (!lines.length) {
    container.innerHTML = '<div class="empty-bag"><p>Your bag is empty.</p><small>Explore our snacks to add something nourishing.</small></div>';
    return;
  }

  container.innerHTML = lines.map(l => `
    <div class="cart-item-row">
      <img src="${esc(l.p.image || '/hero-bar.jpg')}" alt="${esc(l.p.name)}" class="cart-item-thumb">
      <div class="cart-item-info">
        <h4>${esc(l.p.name)}</h4>
        <small>${peso(l.p.price)} · ${esc(l.p.unit)}</small>
      </div>
      <div class="qty-control">
        <button type="button" data-cart-dec="${l.id}" aria-label="Decrease quantity">−</button>
        <b>${l.qty}</b>
        <button type="button" data-cart-inc="${l.id}" aria-label="Increase quantity">+</button>
      </div>
    </div>
  `).join('');
}

function setCartOpen(open) {
  $('drawer').classList.toggle('open', open);
  $('overlay').classList.toggle('open', open);
}

function changeCart(id, delta) {
  const prod = products.find(p => p.id === id);
  if (!prod || !prod.inStock) return;

  const item = cart.find(x => x.id === id);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(x => x !== item);
    }
  } else if (delta > 0) {
    cart.push({ id, qty: delta });
  }
  renderCart();
}

$('open-cart').onclick = () => setCartOpen(true);
$('close-cart').onclick = $('overlay').onclick = () => setCartOpen(false);

document.addEventListener('click', e => {
  const inc = e.target.closest('[data-cart-inc]');
  if (inc) {
    changeCart(inc.dataset.cartInc, 1);
    return;
  }
  const dec = e.target.closest('[data-cart-dec]');
  if (dec) {
    changeCart(dec.dataset.cartDec, -1);
  }
});

/* ========================================================
   CHECKOUT FLOW
   ======================================================== */
const checkoutDialog = $('checkout-dialog');

if (checkoutDialog) {
  checkoutDialog.addEventListener('click', e => {
    const rect = checkoutDialog.getBoundingClientRect();
    const isInside = (
      rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width
    );
    if (!isInside) checkoutDialog.close();
  });
}

$('checkout-btn').onclick = () => {
  setCartOpen(false);
  const lines = cartLines();
  if (!lines.length) return;

  $('co-summary').innerHTML = lines.map(l => `
    <div class="summary-row">
      <span>${l.qty} × ${esc(l.p.name)}</span>
      <strong>${peso(l.p.price * l.qty)}</strong>
    </div>
  `).join('') + `
    <div class="summary-row summary-total">
      <span>Total</span>
      <span>${peso(cartTotal())}</span>
    </div>
  `;

  $('co-form').hidden = false;
  $('co-success').hidden = true;
  $('co-msg').className = 'form-feedback';
  $('co-msg').textContent = '';
  
  // Set min date to local calendar date
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  $('c-date').min = `${year}-${month}-${day}`;

  // Default to Pickup and hide delivery address
  $('c-method').value = 'Pickup';
  $('addr-wrap').hidden = true;
  $('c-address').required = false;

  checkoutDialog.showModal();
};

$('c-method').onchange = e => {
  const isDelivery = e.target.value === 'Delivery';
  $('addr-wrap').hidden = !isDelivery;
  $('c-address').required = isDelivery;
};

$('co-cancel').onclick = $('co-done').onclick = () => checkoutDialog.close();

$('checkout-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('place-order');
  const msgBox = $('co-msg');
  msgBox.className = 'form-feedback';
  msgBox.textContent = '';

  const isDelivery = $('c-method').value === 'Delivery';
  const address = $('c-address').value.trim();
  if (isDelivery && !address) {
    msgBox.className = 'form-feedback error';
    msgBox.textContent = 'Please provide your complete delivery address.';
    $('c-address').focus();
    return;
  }

  btn.disabled = true;

  const orderData = {
    name: $('c-name').value.trim(),
    contact: $('c-contact').value.trim(),
    method: $('c-method').value,
    address: isDelivery ? address : '',
    date: $('c-date').value,
    notes: $('c-notes').value.trim(),
    items: cartLines().map(l => ({ id: l.id, qty: l.qty }))
  };

  const { ok, json } = await post('/api/orders', orderData);
  btn.disabled = false;

  if (!ok) {
    msgBox.className = 'form-feedback error';
    msgBox.textContent = json.error || 'Failed to submit order. Please try again.';
    return;
  }

  $('co-code').textContent = json.code;
  $('co-total').textContent = `Total: ${peso(json.total)} — We will confirm your preparation & dispatch schedule shortly.`;
  $('co-form').hidden = true;
  $('co-success').hidden = false;

  cart = [];
  renderCart();
  e.target.reset();
  $('addr-wrap').hidden = true;
});

/* ========================================================
   INQUIRY & ORDER TRACKING
   ======================================================== */
$('inquiry-form').addEventListener('submit', async e => {
  e.preventDefault();
  const submitBtn = $('submit-inquiry');
  submitBtn.disabled = true;

  const formData = Object.fromEntries(new FormData(e.target));
  const { ok, json } = await post('/api/inquiries', formData);
  submitBtn.disabled = false;

  const msgBox = $('form-msg');
  if (ok) {
    msgBox.className = 'form-feedback success';
    msgBox.textContent = '✓ Quote inquiry sent! A NutriWise manager will contact you with pricing shortly.';
    e.target.reset();
  } else {
    msgBox.className = 'form-feedback error';
    msgBox.textContent = json.error || 'Could not send inquiry. Please check your information.';
  }
});

const DELIVERY_PIPELINE = [
  { key: 'Pending', label: 'Pending', msg: 'Order received and queued for kitchen confirmation.' },
  { key: 'Confirmed', label: 'Confirmed', msg: 'Order confirmed by NutriWise kitchen.' },
  { key: 'Preparing', label: 'Preparing', msg: 'Your snacks are being freshly measured, baked, and packed.' },
  { key: 'Ready to Ship', label: 'Ready to Ship', msg: '📦 Packed & sealed! Waiting for courier pickup.' },
  { key: 'Out for Delivery', label: 'Out for Delivery', msg: '🚚 Courier is out for delivery to your address.' },
  { key: 'Delivered', label: 'Delivered', msg: '🎉 Order safely delivered to your address! Enjoy.' }
];

const PICKUP_PIPELINE = [
  { key: 'Pending', label: 'Pending', msg: 'Order received and queued for kitchen confirmation.' },
  { key: 'Confirmed', label: 'Confirmed', msg: 'Order confirmed by NutriWise kitchen.' },
  { key: 'Preparing', label: 'Preparing', msg: 'Your snacks are being freshly measured, baked, and packed.' },
  { key: 'Ready', label: 'Ready for Pickup', msg: '🛍️ Freshly packed and ready for pickup at our kitchen!' },
  { key: 'Completed', label: 'Completed', msg: '🎉 Order picked up. Thank you for choosing NutriWise!' }
];

function getPipelineIndex(status, pipeline, isDelivery) {
  const norm = (status || '').toLowerCase();
  const idx = pipeline.findIndex(p => p.key.toLowerCase() === norm);
  if (idx >= 0) return idx;

  if (isDelivery) {
    if (norm.includes('ready') || norm.includes('ship')) return 3;
    if (norm.includes('out') || norm.includes('way') || norm.includes('transit')) return 4;
    if (norm.includes('deliver') || norm.includes('complete')) return 5;
  } else {
    if (norm.includes('ready')) return 3;
    if (norm.includes('complete') || norm.includes('picked')) return 4;
  }
  return 0;
}

$('track-form').addEventListener('submit', async e => {
  e.preventDefault();
  const code = $('track-code').value.trim().toUpperCase();
  const resultBox = $('track-result');
  resultBox.innerHTML = '<span style="font-size:0.85rem;color:var(--ink-secondary)">Checking order status...</span>';

  try {
    const res = await fetch('/api/orders/track?code=' + encodeURIComponent(code));
    const data = await res.json();

    if (!res.ok) {
      resultBox.innerHTML = `<div class="form-feedback error" style="display:block">${esc(data.error || 'Order not found.')}</div>`;
      return;
    }

    if (data.status === 'Cancelled') {
      resultBox.innerHTML = `
        <div style="background:#FFFFFF;border-radius:12px;padding:16px;border:1px solid var(--line);box-shadow:var(--shadow-sm)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong>Order ${esc(data.code)}</strong>
            <span style="font-weight:700;color:var(--danger);background:var(--danger-bg);padding:4px 10px;border-radius:6px;font-size:0.8rem">Cancelled</span>
          </div>
          <p style="font-size:0.84rem;color:var(--ink-secondary);margin:8px 0">This order has been cancelled. Contact our team if you need assistance.</p>
          <div style="font-size:0.82rem;color:var(--ink-secondary);margin-top:8px">
            ${(data.items || []).map(it => `<div>${it.qty} × ${esc(it.name)}</div>`).join('')}
            <div style="font-weight:700;margin-top:6px;color:var(--ink)">Total: ${peso(data.total)}</div>
          </div>
        </div>
      `;
      return;
    }

    const isDelivery = data.method === 'Delivery';
    const pipeline = isDelivery ? DELIVERY_PIPELINE : PICKUP_PIPELINE;
    const currentIdx = getPipelineIndex(data.status, pipeline, isDelivery);
    const currentStepInfo = pipeline[currentIdx] || pipeline[0];

    resultBox.innerHTML = `
      <div style="background:#FFFFFF;border-radius:12px;padding:16px;border:1px solid var(--line);box-shadow:var(--shadow-sm)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong>Order ${esc(data.code)}</strong>
          <span style="font-weight:700;color:var(--accent-leaf-dark);background:var(--accent-leaf-light);padding:4px 10px;border-radius:6px;font-size:0.8rem">
            ${isDelivery ? '🚚 ' : '🛍️ '}${esc(data.status)}
          </span>
        </div>

        ${isDelivery && data.address ? `
          <div style="display:flex;align-items:flex-start;gap:8px;font-size:0.82rem;color:var(--ink-secondary);margin:8px 0 10px;background:#F8FBF6;border:1px solid #E1EDDB;padding:8px 12px;border-radius:8px">
            <span style="font-size:1.05rem;line-height:1">📍</span>
            <div>
              <div style="font-weight:600;color:var(--accent-leaf-dark);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em">Delivery Address</div>
              <div style="color:var(--ink);font-weight:500">${esc(data.address)}</div>
              ${data.date ? `<div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px">Scheduled Date: <strong>${esc(data.date)}</strong></div>` : ''}
            </div>
          </div>
        ` : (!isDelivery ? `
          <div style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--ink-secondary);margin:6px 0 10px;background:#FAF8F5;border:1px solid #ECE6DE;padding:6px 10px;border-radius:6px">
            <span>🛍️</span>
            <span>Fulfillment: <strong>Store Pickup</strong></span>
            ${data.date ? ` · Target Date: <strong>${esc(data.date)}</strong>` : ''}
          </div>
        ` : '')}

        <div style="display:flex;gap:4px;margin:12px 0 6px">
          ${pipeline.map((st, i) => `
            <div style="flex:1;height:6px;border-radius:3px;background:${i <= currentIdx ? 'var(--accent-leaf)' : 'var(--line)'};transition:background 0.3s"></div>
          `).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;font-size:0.67rem;color:var(--ink-muted);margin-bottom:12px;text-align:center">
          ${pipeline.map((st, i) => `
            <span style="flex:1;font-weight:${i === currentIdx ? '700' : '400'};color:${i === currentIdx ? 'var(--accent-leaf-dark)' : 'var(--ink-muted)'}">${esc(st.label)}</span>
          `).join('')}
        </div>

        <div style="font-size:0.82rem;color:var(--ink-secondary);background:#FAFAFA;padding:8px 12px;border-radius:8px;margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent-leaf);box-shadow:0 0 0 3px rgba(78,120,67,0.2);flex-shrink:0"></span>
          <span>${currentStepInfo.msg}</span>
        </div>

        <div style="font-size:0.82rem;color:var(--ink-secondary);border-top:1px dashed var(--line);padding-top:10px">
          ${(data.items || []).map(it => `<div>${it.qty} × ${esc(it.name)}</div>`).join('')}
          <div style="font-weight:700;margin-top:6px;color:var(--ink)">Total: ${peso(data.total)}</div>
        </div>
      </div>
    `;
  } catch (err) {
    resultBox.innerHTML = `<div class="form-feedback error" style="display:block">Could not connect to order tracking service.</div>`;
  }
});

// Initial boot
load();
