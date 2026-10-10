export const sql = `
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE subcategories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  subcategory_id INTEGER REFERENCES subcategories(id),
  unit TEXT NOT NULL DEFAULT 'pc',
  price REAL NOT NULL DEFAULT 0,
  cost_price REAL NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0,
  low_stock_threshold REAL NOT NULL DEFAULT 0,
  sku TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  balance REAL NOT NULL DEFAULT 0
);

CREATE TABLE bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  party_id INTEGER REFERENCES parties(id),
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  paid_amount REAL NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash','udhar','split')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE party_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL REFERENCES parties(id),
  type TEXT NOT NULL CHECK (type IN ('sale','payment','manual')),
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  note TEXT,
  bill_id INTEGER REFERENCES bills(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES bills(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name_snapshot TEXT NOT NULL,
  qty REAL NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier TEXT NOT NULL,
  total REAL NOT NULL,
  paid_amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name_snapshot TEXT NOT NULL,
  qty REAL NOT NULL,
  unit_cost REAL NOT NULL
);

CREATE TABLE stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('sale','purchase','adjustment','return')),
  qty_change REAL NOT NULL,
  note TEXT,
  reference_bill_id INTEGER REFERENCES bills(id),
  reference_purchase_id INTEGER REFERENCES purchases(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE day_closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  opening_cash REAL NOT NULL,
  counted_cash REAL NOT NULL,
  expected_cash REAL NOT NULL,
  difference REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_subcategory ON products(subcategory_id);
CREATE INDEX idx_party_ledger_party ON party_ledger(party_id);
CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);

INSERT INTO settings (key, value) VALUES
  ('shopName', 'My Shop'),
  ('address', ''),
  ('phone', ''),
  ('gstin', ''),
  ('footer', 'Thank you for your business!'),
  ('taxPercent', '0'),
  ('paperWidth', '80mm'),
  ('billCounter', '0'),
  ('printerName', ''),
  ('printerAddress', '');
`;
