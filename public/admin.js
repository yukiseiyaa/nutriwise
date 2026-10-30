const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peso = n => '₱' + Math.max(0, Math.round(Number(n) || 0)).toLocaleString('en-PH');

const STATUSES = ['New', 'Quoted', 'Confirmed'];
const DELIVERY_STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Ready to Ship', 'Out for Delivery', 'Delivered', 'Cancelled'];
const PICKUP_STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'];
const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready to Ship',
  'Out for Delivery',
  'Delivered',
  'Ready for Pickup',
  'Ready',
  'Completed',
  'Cancelled'
];

let token = sessionStorage.getItem('ns_token');
let state = { products: [], steps: [], inquiries: [], orders: [] };
let editing = { product: null, step: null };

async function api(path, method = 'GET', data) {
  const r = await fetch('/api/' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: data ? JSON.stringify(data) : undefined
  });
  if (r.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  const j = await r.json();
  if (!r.ok) {
    throw new Error(j.error || 'Request failed');
  }
  return j;
}

let toastTimer;
function toast(t) {
  const e = $('toast');
  if (!e) return;
  e.textContent = t;
  e.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.remove('show'), 2200);
}

function updateGreeting() {
  const greetingEl = $('admin-greeting');
  if (!greetingEl) return;
  const hour = new Date().getHours();
  let timeStr = 'Good morning';
  if (hour >= 12 && hour < 17) timeStr = 'Good afternoon';
  else if (hour >= 17) timeStr = 'Good evening';
  greetingEl.textContent = `${timeStr}, Manager.`;
}

async function refresh() {
  try {
    const [pub, inq, ord] = await Promise.all([
      fetch('/api/data').then(r => r.json()),
      api('inquiries'),
      api('orders')
    ]);
    state = {
      products: Array.isArray(pub?.products) ? pub.products : [],
      steps: Array.isArray(pub?.steps) ? pub.steps : [],
      inquiries: Array.isArray(inq) ? inq : [],
      orders: Array.isArray(ord) ? ord : []
    };
    render();
  } catch (err) {
    console.error('Failed to refresh data:', err);
  }
}

function render() {
  updateGreeting();

  // Overview Stats
  const prodCountEl = $('stat-products-count');
  if (prodCountEl) prodCountEl.textContent = state.products.length;

  const inStockCountEl = $('stat-instock-count');
  if (inStockCountEl) inStockCountEl.textContent = state.products.filter(p => p.inStock).length;

  const inqCountEl = $('stat-inquiries-count');
  if (inqCountEl) inqCountEl.textContent = state.inquiries.filter(q => q.status === 'New').length;

  const ordersCountEl = $('stat-orders-count');
  if (ordersCountEl) ordersCountEl.textContent = state.orders.filter(o => o.status === 'Pending').length;

  // View 1: Products List
  const prodList = $('product-list');
  if (prodList) {
    prodList.innerHTML = state.products.map(p => `
      <div class="product-row-item">
        <img src="${esc(p.image || '/hero-bar.jpg')}" alt="${esc(p.name)}" class="product-thumb-img">
        <div class="product-info-col">
          <h3 class="product-info-title">${esc(p.name)}</h3>
          <p class="product-info-desc">${esc(p.description)}</p>
          ${p.ingredients ? `<p class="product-info-ing">${esc(p.ingredients)}</p>` : ''}
          <div class="product-badges-wrap">
            ${(p.badges || []).map(b => `<span class="badge-chip">${esc(b)}</span>`).join('')}
            <span class="badge-chip" style="background:#EBF3E5;color:#2A4822">${esc(p.unit || 'per pack')}</span>
          </div>
        </div>

        <div class="product-actions-col">
          <div class="price-display-block">
            <span class="price-label-small">PRICE</span>
            <span class="price-value-bold">${p.price}</span>
          </div>

          <button class="stock-pill-btn ${p.inStock ? 'in-stock' : 'out-of-stock'}" data-act="stock" data-id="${p.id}" aria-label="Toggle stock status">
            <span class="toggle-knob"></span>
            <span>${p.inStock ? 'In stock' : 'Out of stock'}</span>
          </button>

          <button class="btn-edit-text" data-act="edit-product" data-id="${p.id}">Edit</button>
          <button class="btn-remove-text" data-act="del-product" data-id="${p.id}">Remove</button>
        </div>
      </div>
    `).join('') || `
      <div class="empty-state-box">
        <h3>No products in catalog</h3>
        <p>Click "+ Add product" above to introduce your first nutrition item.</p>
      </div>
    `;
  }

  // View 2: Process Steps List
  const stepList = $('step-list');
  if (stepList) {
    stepList.innerHTML = state.steps.map((s, i) => `
      <div class="process-row-card">
        <div class="process-left-group">
          <div class="process-num-badge">${i + 1}</div>
          <h4 class="process-step-title">${esc(s.title)}</h4>
          <p class="process-step-desc">${esc(s.description)}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
          <button class="btn-edit-text" data-act="edit-step" data-id="${s.id}">Edit</button>
          <button class="btn-remove-text" data-act="del-step" data-id="${s.id}">Remove</button>
        </div>
      </div>
    `).join('') || `
      <div class="empty-state-box">
        <h3>No process steps defined</h3>
        <p>Add small-batch journey steps to showcase transparency on the store.</p>
      </div>
    `;
  }

  // View 3: Inquiries List
  const inqList = $('inquiry-list');
  if (inqList) {
    inqList.innerHTML = state.inquiries.map(q => `
      <div class="data-row-card">
        <div class="data-card-info">
          <div class="data-card-header">
            <span class="data-card-title">${esc(q.name)}</span>
            ${q.organization ? `<span class="badge-chip">${esc(q.organization)}</span>` : ''}
            <span style="font-size:0.8rem;color:var(--ink-muted)">${new Date(q.createdAt).toLocaleDateString()}</span>
          </div>
          <div class="data-card-sub">
            <strong>${esc(q.contact)}</strong> · Requested: <strong>${esc(q.product || 'General Inquiry')}</strong> ${q.quantity ? `(${esc(q.quantity)})` : ''}
          </div>
          ${q.message ? `<div class="data-card-notes">“${esc(q.message)}”</div>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
          <button class="status-chip ${q.status}" data-act="advance" data-id="${q.id}" title="Click to advance status">
            ${q.status} ›
          </button>
          <button class="btn-remove-text" data-act="del-inquiry" data-id="${q.id}">Remove</button>
        </div>
      </div>
    `).join('') || `
      <div class="empty-state-box">
        <h3>No inquiries yet</h3>
        <p>New quote requests from the website will appear here.</p>
      </div>
    `;
  }

  // View 4: Orders List
  const orderList = $('order-list');
  if (orderList) {
    orderList.innerHTML = state.orders.map(o => {
      const isDelivery = o.method === 'Delivery';
      const baseStatuses = isDelivery ? DELIVERY_STATUSES : PICKUP_STATUSES;
      const statuses = baseStatuses.includes(o.status) ? baseStatuses : [o.status, ...baseStatuses];
      return `
      <div class="data-row-card">
        <div class="data-card-info">
          <div class="data-card-header">
            <span class="data-card-title">${esc(o.code)}</span>
            <span class="badge-chip" style="background:#EBF3E5;color:#2A4822">${peso(o.total)}</span>
            <span class="badge-chip" style="background:${isDelivery ? '#E6F0FA;color:#1E5B8E' : '#F5EBE1;color:#7A4515'}">
              ${isDelivery ? '🚚 Delivery' : '🛍️ Pickup'}
            </span>
            <span style="font-size:0.8rem;color:var(--ink-muted)">${new Date(o.createdAt).toLocaleString()}</span>
          </div>
          <div class="data-card-sub">
            <strong>${esc(o.name)}</strong> (${esc(o.contact)}) · ${esc(o.method)}${o.address ? ` → ${esc(o.address)}` : ''}
            ${o.date ? ` · Preferred Date: <strong>${esc(o.date)}</strong>` : ''}
          </div>
          <div style="font-size:0.84rem;color:var(--accent-leaf-dark);margin-top:4px;font-weight:600">
            ${(o.items || []).map(i => `${i.qty} × ${esc(i.name)}`).join(', ')}
          </div>
          ${o.notes ? `<div class="data-card-notes">“${esc(o.notes)}”</div>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
          <select data-order="${o.id}" class="order-status-select" aria-label="Order status">
            ${statuses.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button class="btn-remove-text" data-act="del-order" data-id="${o.id}">Remove</button>
        </div>
      </div>
    `;
    }).join('') || `
      <div class="empty-state-box">
        <h3>No customer orders yet</h3>
        <p>Pre-orders submitted on the showcase store will appear here in real-time.</p>
      </div>
    `;
  }
}

// Navigation & Actions event delegation
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-tab],[data-close]');
  if (!t) return;

  if (t.dataset.tab) {
    document.querySelectorAll('.tab-pill').forEach(b => b.classList.toggle('active', b === t));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + t.dataset.tab));
    return;
  }

  if (t.dataset.close !== undefined) {
    const dlg = t.closest('dialog');
    if (dlg) dlg.close();
    return;
  }

  const { act, id } = t.dataset;
  try {
    if (act === 'stock') {
      const p = state.products.find(x => x.id === id);
      if (!p) return;
      await api('products/' + id, 'PUT', { inStock: !p.inStock });
      toast(`${p.name} is now ${!p.inStock ? 'in stock' : 'out of stock'}`);
    } else if (act === 'edit-product') {
      openProduct(state.products.find(x => x.id === id));
      return;
    } else if (act === 'del-product') {
      if (!confirm('Are you sure you want to remove this product?')) return;
      await api('products/' + id, 'DELETE');
      toast('Product removed');
    } else if (act === 'edit-step') {
      openStep(state.steps.find(x => x.id === id));
      return;
    } else if (act === 'del-step') {
      if (!confirm('Are you sure you want to remove this process step?')) return;
      await api('steps/' + id, 'DELETE');
      toast('Step removed');
    } else if (act === 'advance') {
      const q = state.inquiries.find(x => x.id === id);
      if (!q) return;
      const nextStatus = STATUSES[(STATUSES.indexOf(q.status) + 1) % 3];
      await api('inquiries/' + id, 'PATCH', { status: nextStatus });
      toast(`Status advanced to ${nextStatus}`);
    } else if (act === 'del-inquiry') {
      if (!confirm('Are you sure you want to delete this inquiry?')) return;
      await api('inquiries/' + id, 'DELETE');
      toast('Inquiry removed');
    } else if (act === 'del-order') {
      if (!confirm('Are you sure you want to delete this order?')) return;
      await api('orders/' + id, 'DELETE');
      toast('Order removed');
    }
    refresh();
  } catch (err) {
    toast(err.message || 'Action failed');
  }
});

document.addEventListener('change', async e => {
  if (!e.target.dataset.order) return;
  try {
    await api('orders/' + e.target.dataset.order, 'PATCH', { status: e.target.value });
    toast(`Order status updated to ${e.target.value}`);
    refresh();
  } catch (err) {
    toast('Failed to update status');
  }
});

function openProduct(p) {
  editing.product = p?.id || null;
  $('pd-title').textContent = p ? 'Edit Product' : 'Add New Product';
  $('pf-name').value = p?.name || '';
  $('pf-desc').value = p?.description || '';
  $('pf-price').value = p?.price ?? '';
  $('pf-unit').value = p?.unit || 'per pack';
  $('pf-ing').value = p?.ingredients || '';
  $('pf-badges').value = (p?.badges || []).join(', ');
  $('pf-emoji').value = p?.emoji || '🍞';
  $('pf-image').value = p?.image || '';
  $('product-dialog').showModal();
}

function openStep(s) {
  editing.step = s?.id || null;
  $('sd-title').textContent = s ? 'Edit Process Step' : 'Add Process Step';
  $('sf-title').value = s?.title || '';
  $('sf-desc').value = s?.description || '';
  $('step-dialog').showModal();
}

$('add-product').onclick = () => openProduct();
$('add-step').onclick = () => openStep();

// Dialog backdrop click to dismiss
[$('product-dialog'), $('step-dialog')].forEach(dlg => {
  if (!dlg) return;
  dlg.addEventListener('click', e => {
    const rect = dlg.getBoundingClientRect();
    const isInside = (
      rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width
    );
    if (!isInside) dlg.close();
  });
});

$('product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('pf-name').value.trim();
  if (!name) {
    alert('Product name is required.');
    return;
  }
  const data = {
    name,
    description: $('pf-desc').value.trim(),
    price: Math.max(0, Number($('pf-price').value) || 0),
    unit: $('pf-unit').value.trim() || 'per pack',
    ingredients: $('pf-ing').value.trim(),
    badges: $('pf-badges').value.split(',').map(s => s.trim()).filter(Boolean),
    emoji: $('pf-emoji').value.trim() || '🍞',
    image: $('pf-image').value.trim()
  };
  try {
    await api('products' + (editing.product ? '/' + editing.product : ''), editing.product ? 'PUT' : 'POST', data);
    $('product-dialog').close();
    toast('Product saved successfully');
    refresh();
  } catch (err) {
    alert(err.message || 'Failed to save product');
  }
});

$('step-form').addEventListener('submit', async e => {
  e.preventDefault();
  const title = $('sf-title').value.trim();
  if (!title) {
    alert('Step title is required.');
    return;
  }
  const data = {
    title,
    description: $('sf-desc').value.trim()
  };
  try {
    await api('steps' + (editing.step ? '/' + editing.step : ''), editing.step ? 'PUT' : 'POST', data);
    $('step-dialog').close();
    toast('Process step saved');
    refresh();
  } catch (err) {
    alert(err.message || 'Failed to save step');
  }
});

// Login form
$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const pw = $('pw').value;
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    const j = await r.json();
    if (!r.ok) {
      $('login-msg').className = 'msg err';
      $('login-msg').textContent = j.error || 'Incorrect password.';
      return;
    }
    token = j.token;
    sessionStorage.setItem('ns_token', token);
    start();
  } catch (err) {
    $('login-msg').className = 'msg err';
    $('login-msg').textContent = 'Connection error. Please try again.';
  }
});

async function logout() {
  if (token) {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      });
    } catch {}
  }
  sessionStorage.removeItem('ns_token');
  token = null;
  const app = $('app');
  const login = $('login-screen');
  if (app) {
    app.hidden = true;
    app.style.display = 'none';
  }
  if (login) {
    login.hidden = false;
    login.style.display = 'grid';
  }
  const pw = $('pw');
  if (pw) pw.value = '';
  const msg = $('login-msg');
  if (msg) {
    msg.className = 'msg';
    msg.textContent = '';
  }
}

$('logout').onclick = logout;

function start() {
  const login = $('login-screen');
  const app = $('app');
  if (login) {
    login.hidden = true;
    login.style.display = 'none';
  }
  if (app) {
    app.hidden = false;
    app.style.display = 'block';
  }
  refresh();
}

async function initAuth() {
  // Always ensure dashboard is hidden and login is shown initially
  const app = $('app');
  const login = $('login-screen');
  if (app) {
    app.hidden = true;
    app.style.display = 'none';
  }
  if (login) {
    login.hidden = false;
    login.style.display = 'grid';
  }

  if (!token) return;

  // Validate existing session token with the server
  try {
    const res = await fetch('/api/auth/verify', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (res.ok) {
      start();
    } else {
      logout();
    }
  } catch {
    logout();
  }
}

initAuth();
