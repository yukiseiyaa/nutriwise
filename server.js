// NutriWise server — zero dependencies. Run: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const DB_FILE = path.join(__dirname, 'data.json');
const PUBLIC = path.join(__dirname, 'public');
const tokens = new Set();

const seed = {
  products: [
    { id: 'p1', name: 'Power Bites', description: 'Soft-baked cacao and peanut bites made for sustained energy between classes.', price: 85, unit: '6-piece pouch', ingredients: 'Rolled oats, roasted peanuts, single-origin cacao nibs, mung bean protein isolate, medjool dates, and wild honey.', badges: ['High Protein', 'No Refined Sugar'], emoji: '🍫', image: '/hero-bar.jpg', inStock: true },
    { id: 'p2', name: 'Moringa Oat Crisps', description: 'Toasty whole-grain crisps enriched with locally sourced moringa leaves.', price: 120, unit: '200g pack', ingredients: 'Whole grain rolled oats, fresh ground moringa leaf powder, white sesame seeds, unrefined coconut oil.', badges: ['Iron Fortified', 'High Fiber'], emoji: '🥣', image: '/moringa-crisps.jpg', inStock: true },
    { id: 'p3', name: 'Daily Fuel Bar', description: 'A chewy banana, seed, and oat bar built for busy mornings and active days.', price: 55, unit: 'single bar', ingredients: 'Sun-ripened bananas, rolled oats, sunflower seeds, pumpkin pepitas, pistachios, flaxseed meal.', badges: ['Plant Powered', 'Energy Boost'], emoji: '🍌', image: '/fuel-bar.jpg', inStock: false },
    { id: 'p4', name: 'Harvest Trail Mix', description: 'Roasted almonds, pumpkin seeds, dried cranberries, and toasted coconut flakes.', price: 135, unit: '180g pouch', ingredients: 'Dry-roasted almonds, walnuts, mountain cranberries, pumpkin seeds, unsweetened coconut shavings.', badges: ['Healthy Fats', 'Source of Fiber'], emoji: '🥜', image: '/trail-mix.jpg', inStock: true },
    { id: 'p5', name: 'Coconut Oat Cookies', description: 'Golden rolled oat cookies baked with cold-pressed coconut oil and dark chocolate chips.', price: 110, unit: '8-piece box', ingredients: 'Oat flour, rolled oats, coconut oil, 70% dark chocolate chips, coconut sugar, vanilla extract.', badges: ['Whole Grain', 'Dairy Free'], emoji: '🍪', image: '/coconut-cookies.jpg', inStock: true },
    { id: 'p6', name: 'Nut & Seed Crunch', description: 'Clustered pecans, chia seeds, and sunflower kernels lightly seasoned with sea salt.', price: 145, unit: '150g jar', ingredients: 'Crispy roasted pecans, chia seeds, sunflower kernels, sprouted pumpkin seeds, acacia fiber, pink sea salt.', badges: ['Protein Rich', 'Low Sugar'], emoji: '🌰', image: '/nut-crunch.jpg', inStock: true },
    { id: 'p7', name: 'Banana Boost Bites', description: 'Chewy banana and flaxseed energy bites rolled in roasted sesame seeds.', price: 95, unit: '6-piece pouch', ingredients: 'Dehydrated organic bananas, sprouted brown flaxseed, puffed brown rice, cashew butter, white sesame seeds.', badges: ['Potassium', 'Energy Boost'], emoji: '⚡', image: '/banana-bites.jpg', inStock: true },
    { id: 'p8', name: 'Cacao Bean Clusters', description: 'Rich Philippine single-origin cacao nibs folded into crunchy crisped grains.', price: 125, unit: '160g pouch', ingredients: 'Davao cacao nibs, royal quinoa, brown rice crisps, toasted whole hazelnuts, coconut nectar, sea salt.', badges: ['Plant Protein', 'Iron Source'], emoji: '✨', image: '/cacao-clusters.jpg', inStock: true }
  ],
  steps: [
    { id: 's1', title: 'Sourcing', description: 'We select honest, local ingredients from trusted growers.' },
    { id: 's2', title: 'Mixing', description: 'Every batch is measured and mixed for balanced nutrition.' },
    { id: 's3', title: 'Baking', description: 'Slow-baked in small batches to keep flavor and goodness in.' },
    { id: 's4', title: 'Packaging', description: 'Sealed fresh and labeled by hand, ready for your shelves.' }
  ],
  inquiries: [],
  orders: []
};

let db;
try {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch {
  db = seed;
  save();
}
db.products = Array.isArray(db.products) ? db.products : seed.products;
db.steps = Array.isArray(db.steps) ? db.steps : seed.steps;
db.inquiries = Array.isArray(db.inquiries) ? db.inquiries : [];
db.orders = Array.isArray(db.orders) ? db.orders : [];

const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready',
  'Ready to Ship',
  'Out for Delivery',
  'Delivered',
  'Ready for Pickup',
  'Completed',
  'Cancelled'
];

function save() {
  try {
    const tempFile = DB_FILE + '.tmp.' + Date.now();
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to save DB:', err);
    try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); } catch {}
  }
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const send = (res, code, obj) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(obj));
};

const body = req => new Promise(resolve => {
  let b = '';
  let destroyed = false;
  req.on('data', c => {
    b += c;
    if (b.length > 5e6) {
      destroyed = true;
      req.destroy();
      resolve(null);
    }
  });
  req.on('end', () => {
    if (destroyed) return;
    try { resolve(JSON.parse(b || '{}')); }
    catch { resolve({}); }
  });
  req.on('error', () => {
    if (!destroyed) resolve(null);
  });
});

const authed = req => {
  const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return Boolean(authHeader && tokens.has(authHeader));
};

const uid = () => crypto.randomBytes(4).toString('hex');
const str = (v, n = 500) => String(v ?? '').trim().slice(0, n);

function cleanProduct(b = {}, old = {}) {
  const name = str(b.name !== undefined ? b.name : old.name, 100) || old.name || 'Unnamed Product';
  const rawPrice = b.price !== undefined ? b.price : old.price;
  const price = Math.max(0, Math.round(Number(rawPrice) || 0));
  return {
    id: old.id || uid(),
    name,
    description: str(b.description !== undefined ? b.description : old.description, 400),
    price,
    unit: str(b.unit !== undefined ? b.unit : old.unit, 40) || 'per pack',
    ingredients: str(b.ingredients !== undefined ? b.ingredients : (old.ingredients || ''), 600),
    process: str(b.process !== undefined ? b.process : (old.process || ''), 600),
    nutrition: b.nutrition !== undefined ? b.nutrition : (old.nutrition || { calories: 210, serving: '3 bites (45g)', protein: '8g', fiber: '5g', sugars: '9g' }),
    badges: (Array.isArray(b.badges) ? b.badges : old.badges || []).map(x => str(x, 30)).filter(Boolean),
    emoji: str(b.emoji !== undefined ? b.emoji : (old.emoji || '🍞'), 8) || '🍞',
    image: str(b.image !== undefined ? b.image : (old.image || ''), 2000),
    inStock: b.inStock !== undefined ? Boolean(b.inStock) : (old.inStock !== false)
  };
}

function cleanStep(b = {}, old = {}) {
  const title = str(b.title !== undefined ? b.title : old.title, 60) || old.title || 'Step';
  return {
    id: old.id || uid(),
    title,
    description: str(b.description !== undefined ? b.description : old.description, 300)
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const p = url.pathname;

  if (p.startsWith('/api/')) {
    const m = req.method;

    if (p === '/api/data' && m === 'GET') {
      return send(res, 200, { products: db.products, steps: db.steps });
    }

    if (p === '/api/inquiries' && m === 'POST') {
      const b = await body(req);
      if (!b) return send(res, 400, { error: 'Invalid request body.' });
      if (!str(b.name) || !str(b.contact)) {
        return send(res, 400, { error: 'Name and contact are required.' });
      }
      const inq = {
        id: uid(),
        name: str(b.name, 100),
        contact: str(b.contact, 100),
        organization: str(b.organization, 100),
        product: str(b.product, 100),
        quantity: str(b.quantity, 40),
        message: str(b.message, 1000),
        status: 'New',
        createdAt: new Date().toISOString()
      };
      db.inquiries.unshift(inq);
      save();
      return send(res, 201, { ok: true, id: inq.id });
    }

    if (p === '/api/orders' && m === 'POST') {
      const b = await body(req);
      if (!b) return send(res, 400, { error: 'Invalid request body.' });
      if (!str(b.name) || !str(b.contact)) {
        return send(res, 400, { error: 'Name and contact details are required.' });
      }
      if (!Array.isArray(b.items) || !b.items.length) {
        return send(res, 400, { error: 'Your cart is empty.' });
      }
      const isDelivery = b.method === 'Delivery';
      if (isDelivery && !str(b.address)) {
        return send(res, 400, { error: 'A delivery address is required for delivery orders.' });
      }

      const items = [];
      for (const it of b.items.slice(0, 50)) {
        if (!it || typeof it !== 'object') continue;
        const prod = db.products.find(x => x.id === it.id);
        const qty = Math.floor(Number(it.qty));
        if (!prod || !(qty > 0) || qty > 10000) {
          return send(res, 400, { error: 'Invalid item in cart.' });
        }
        if (!prod.inStock) {
          return send(res, 400, { error: `${prod.name} is currently out of stock. Please update your bag.` });
        }
        items.push({ id: prod.id, name: prod.name, unit: prod.unit, price: prod.price, qty });
      }

      if (!items.length) {
        return send(res, 400, { error: 'No valid items in cart.' });
      }

      const total = items.reduce((s, i) => s + i.price * i.qty, 0);
      const code = 'NW-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const order = {
        id: uid(),
        code,
        name: str(b.name, 100),
        contact: str(b.contact, 100),
        method: isDelivery ? 'Delivery' : 'Pickup',
        address: isDelivery ? str(b.address, 300) : '',
        date: str(b.date, 20),
        notes: str(b.notes, 500),
        items,
        total,
        status: 'Pending',
        createdAt: new Date().toISOString()
      };
      db.orders.unshift(order);
      save();
      return send(res, 201, { ok: true, code, total });
    }

    if (p === '/api/orders/track' && m === 'GET') {
      const searchCode = str(url.searchParams.get('code')).toUpperCase();
      if (!searchCode) return send(res, 400, { error: 'Tracking code is required.' });
      const o = db.orders.find(x => x.code === searchCode);
      if (!o) return send(res, 404, { error: 'Order not found. Please check your tracking code.' });
      return send(res, 200, {
        code: o.code,
        status: o.status,
        method: o.method,
        address: o.address || '',
        date: o.date || '',
        notes: o.notes || '',
        total: o.total,
        items: o.items,
        createdAt: o.createdAt
      });
    }

    if (p === '/api/login' && m === 'POST') {
      const b = await body(req);
      if (b && b.password === ADMIN_PASSWORD) {
        const t = crypto.randomBytes(24).toString('hex');
        tokens.add(t);
        return send(res, 200, { token: t });
      }
      return send(res, 401, { error: 'Incorrect password.' });
    }

    if (p === '/api/auth/verify' && m === 'GET') {
      if (authed(req)) return send(res, 200, { ok: true });
      return send(res, 401, { error: 'Unauthorized' });
    }

    if (p === '/api/logout' && m === 'POST') {
      const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (authHeader) tokens.delete(authHeader);
      return send(res, 200, { ok: true });
    }

    // Public GET endpoints for products and steps
    if ((p === '/api/products' || p === '/api/products/') && m === 'GET') {
      return send(res, 200, db.products);
    }
    if ((p === '/api/steps' || p === '/api/steps/') && m === 'GET') {
      return send(res, 200, db.steps);
    }

    // Authenticated admin endpoints below
    if (!authed(req)) return send(res, 401, { error: 'Unauthorized' });

    if (p === '/api/inquiries' && m === 'GET') return send(res, 200, db.inquiries);
    if (p === '/api/orders' && m === 'GET') return send(res, 200, db.orders);

    const match = p.match(/^\/api\/(products|steps|inquiries|orders)(?:\/(\w+))?$/);
    if (!match) return send(res, 404, { error: 'Endpoint not found' });

    const [, col, id] = match;
    const list = db[col];
    const clean = col === 'products' ? cleanProduct : cleanStep;

    if (m === 'POST' && !id && col !== 'inquiries' && col !== 'orders') {
      const payload = await body(req);
      if (!payload) return send(res, 400, { error: 'Invalid payload.' });
      const item = clean(payload);
      list.push(item);
      save();
      return send(res, 201, item);
    }

    if (!id) {
      if (m === 'GET') return send(res, 200, list);
      return send(res, 400, { error: 'Item ID required' });
    }

    const idx = list.findIndex(x => x.id === id);
    if (idx < 0) return send(res, 404, { error: 'Item not found' });

    if (m === 'GET') {
      return send(res, 200, list[idx]);
    }

    if (m === 'PUT' || m === 'PATCH') {
      const b = await body(req);
      if (!b) return send(res, 400, { error: 'Invalid payload.' });
      if (col === 'inquiries') {
        if (['New', 'Quoted', 'Confirmed'].includes(b.status)) {
          list[idx].status = b.status;
        }
      } else if (col === 'orders') {
        if (ORDER_STATUSES.includes(b.status)) {
          list[idx].status = b.status;
        }
      } else {
        list[idx] = clean(b, list[idx]);
      }
      save();
      return send(res, 200, list[idx]);
    }

    if (m === 'DELETE') {
      list.splice(idx, 1);
      save();
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { error: 'Method not allowed' });
  }

  // Static file serving
  let reqPath = p;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  } else if (reqPath === '/admin' || reqPath === '/admin/') {
    reqPath = '/admin.html';
  }

  try {
    const decodedPath = decodeURIComponent(reqPath);
    const safePath = path.resolve(PUBLIC, '.' + path.sep + decodedPath.replace(/^[/\\]+/, ''));

    // Prevent directory traversal attacks
    if (!safePath.startsWith(PUBLIC)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Forbidden');
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not found');
      }

      fs.readFile(safePath, (readErr, data) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Server error');
        }
        const ext = path.extname(safePath).toLowerCase();
        const contentType = mime[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-store'
        });
        res.end(data);
      });
    });
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
  }
});

server.listen(PORT, () => {
  console.log(`NutriWise running → http://localhost:${PORT}  |  Admin → http://localhost:${PORT}/admin  (password: ${ADMIN_PASSWORD})`);
});
