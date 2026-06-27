import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data', 'sop.db');

// Ensure the directory for the DB file exists (works with a persistent disk)
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- One-time legacy cleanup ----------------------------------------------
// Early versions used a single `categories` axis (sop_files.category_id).
// The schema is now two axes: doc_types + departments. There is no production
// data to preserve, so if a legacy `sop_files` table is found, drop the old
// tables and let the fresh schema below recreate everything.
const sopCols = db.prepare(`PRAGMA table_info(sop_files)`).all();
const isLegacy = sopCols.some((c) => c.name === 'category_id');
if (isLegacy) {
  db.exec(`
    DROP TABLE IF EXISTS sop_files;
    DROP TABLE IF EXISTS categories;
  `);
}

// --- Schema ----------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL
  );

  -- Document type axis (e.g. QP / SOP / Format) — editable in the UI
  CREATE TABLE IF NOT EXISTS doc_types (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  -- Department axis (e.g. Manufacturing / Quality Control) — editable in the UI
  CREATE TABLE IF NOT EXISTS departments (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  -- Customer axis (e.g. TOTO) — editable in the UI; optional on a file
  CREATE TABLE IF NOT EXISTS customers (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS sop_files (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    -- Type & department are required. Deleting a type/department that still has
    -- files is blocked in the API, so a plain FK (NO ACTION) is the right choice.
    doc_type_id   INTEGER NOT NULL REFERENCES doc_types(id),
    department_id INTEGER NOT NULL REFERENCES departments(id),
    -- Customer is optional; deleting a customer just unassigns its files.
    customer_id   INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    -- Header metadata (read from the document; all optional)
    doc_no        TEXT NOT NULL DEFAULT '',   -- e.g. QP-QC-04 / SOP-QC-0021
    revision      TEXT NOT NULL DEFAULT '',   -- e.g. 16
    doc_date      TEXT NOT NULL DEFAULT '',   -- the document's own date, as printed
    model         TEXT NOT NULL DEFAULT '',   -- raw Model line, e.g. TOTO : Operation Panel
    product_name  TEXT NOT NULL DEFAULT '',   -- 品名, e.g. Operation Panel _Domestic
    product_no    TEXT NOT NULL DEFAULT '',   -- e.g. DD360 / DD370 … (SOP)
    stored_name   TEXT NOT NULL,          -- stored file name (within uploads/)
    original_name TEXT NOT NULL,          -- original file name at upload time
    mimetype      TEXT NOT NULL,
    size          INTEGER NOT NULL,
    uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at   TEXT NOT NULL
  );

  -- Individual product codes (品番) per file, parsed from product_no / doc_no.
  -- Enables exact barcode matching (scanning DD360 must not hit DD3600).
  CREATE TABLE IF NOT EXISTS product_codes (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES sop_files(id) ON DELETE CASCADE,
    code    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sop_doc_type   ON sop_files(doc_type_id);
  CREATE INDEX IF NOT EXISTS idx_sop_department ON sop_files(department_id);
  CREATE INDEX IF NOT EXISTS idx_sop_customer   ON sop_files(customer_id);
  CREATE INDEX IF NOT EXISTS idx_sop_title      ON sop_files(title);
  CREATE INDEX IF NOT EXISTS idx_sop_doc_no     ON sop_files(doc_no);
  CREATE INDEX IF NOT EXISTS idx_pcode_code     ON product_codes(code);
  CREATE INDEX IF NOT EXISTS idx_pcode_file     ON product_codes(file_id);
`);

// --- Migration: add newer columns to older databases --------------------
// (CREATE TABLE IF NOT EXISTS never alters an existing table, so add any
// missing columns here. Safe and idempotent.)
const existingCols = new Set(db.prepare(`PRAGMA table_info(sop_files)`).all().map((c) => c.name));
const newCols = {
  doc_no: `TEXT NOT NULL DEFAULT ''`,
  revision: `TEXT NOT NULL DEFAULT ''`,
  doc_date: `TEXT NOT NULL DEFAULT ''`,
  model: `TEXT NOT NULL DEFAULT ''`,
  product_name: `TEXT NOT NULL DEFAULT ''`,
  product_no: `TEXT NOT NULL DEFAULT ''`,
  customer_id: `INTEGER REFERENCES customers(id)`,
};
for (const [col, ddl] of Object.entries(newCols)) {
  if (!existingCols.has(col)) {
    db.exec(`ALTER TABLE sop_files ADD COLUMN ${col} ${ddl}`);
  }
}

// --- Seed data -------------------------------------------------------------
// Initial admin user (override via env vars; defaults to admin / admin123)
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASS || 'admin123';
  db.prepare(
    'INSERT INTO users (username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)'
  ).run(username, bcrypt.hashSync(password, 10), 'Administrator', new Date().toISOString());
  console.log(`Created initial user: ${username} / ${password} (please change after signing in)`);
}

// Initial document types: QP / SOP / Format (editable in the UI afterwards)
const typeCount = db.prepare('SELECT COUNT(*) AS c FROM doc_types').get().c;
if (typeCount === 0) {
  const insert = db.prepare('INSERT INTO doc_types (name) VALUES (?)');
  ['QP', 'SOP', 'Format'].forEach((n) => insert.run(n));
}

// Initial departments (read from the customer's existing folder structure;
// editable in the UI afterwards)
const deptCount = db.prepare('SELECT COUNT(*) AS c FROM departments').get().c;
if (deptCount === 0) {
  const insert = db.prepare('INSERT INTO departments (name) VALUES (?)');
  [
    'CD', 'CS', 'DC', 'EC', 'GA', 'HR', 'IT', 'MC', 'MI', 'MR',
    'PC', 'PE', 'PQA', 'PU', 'QC', 'SCM', 'SL', 'SM', 'WH',
  ].forEach((n) => insert.run(n));
}

// Initial customers (just TOTO to bootstrap; add the rest in the UI)
const custCount = db.prepare('SELECT COUNT(*) AS c FROM customers').get().c;
if (custCount === 0) {
  ['TOTO'].forEach((n) => db.prepare('INSERT INTO customers (name) VALUES (?)').run(n));
}

export default db;
