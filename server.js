import express from 'express';
import session from 'express-session';
import SqliteStoreFactory from 'better-sqlite3-session-store';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { mkdirSync, existsSync, unlinkSync, createReadStream, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
// App version (shown in the header so deploys are visible) — from package.json
const APP_VERSION = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')).version;
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Session (cookie name: connect.sid) ------------------------------------
// Sessions are stored in SQLite so logins survive restarts (e.g. free-tier sleep)
const SqliteStore = SqliteStoreFactory(session);
app.use(
  session({
    name: 'connect.sid',
    secret: process.env.SESSION_SECRET || 'sop-system-dev-secret-change-me',
    store: new SqliteStore({
      client: db,
      expired: { clear: true, intervalMs: 1000 * 60 * 60 }, // hourly cleanup
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
      secure: process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY === '1',
    },
  })
);

if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// --- Upload config (PDF / Excel / Word only) -------------------------------
const ALLOWED = {
  'application/pdf': ['.pdf'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};
const ALLOWED_EXT = new Set(['.pdf', '.xls', '.xlsx', '.doc', '.docx']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const okMime = Object.prototype.hasOwnProperty.call(ALLOWED, file.mimetype);
    if (ALLOWED_EXT.has(ext) && (okMime || file.mimetype === 'application/octet-stream')) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, Excel or Word files can be uploaded'));
  },
});

// --- PDF header extraction (best-effort, experimental) ---------------------
// These quality documents (Kaga Electronics) carry a structured header:
//   Document No.  e.g. QP-QC-04 / SOP-QC-0021   (= <type>-<department>-<serial>)
//   Title / Description, Revision, Date, and for SOPs Model / Product No.
// We read page 1 with `pdftotext -layout` and pull the fields out with
// regexes. The result only ever pre-fills the form — the user reviews/edits
// before saving — so imperfect extraction is acceptable.

// A -layout dump separates columns with runs of spaces; keep only the first
// column of a captured line and collapse the rest.
const firstCol = (s) =>
  (s || '')
    .split(/\s{2,}/)
    .map((x) => x.trim())
    .filter(Boolean)[0] || '';

function extractHeader(filePath, originalName, mimetype) {
  const out = {
    doc_no: '',
    revision: '',
    doc_date: '',
    title: '',
    model: '',
    customer_name: '',
    product_name: '',
    product_no: '',
  };

  // Revision is most reliable from the file name (e.g. ..._Rev.16_...)
  const revFromName = (originalName || '').match(/Rev\.?\s*(\d+)/i);
  if (revFromName) out.revision = revFromName[1];

  if (mimetype !== 'application/pdf') return out;

  let text = '';
  try {
    text = execFileSync('pdftotext', ['-f', '1', '-l', '1', '-layout', filePath, '-'], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return out; // pdftotext missing or failed — fall back to name-only result
  }

  const docNo = text.match(/\b([A-Z]{2,4}-[A-Z]{2,4}-\d{2,5})\b/);
  if (docNo) out.doc_no = docNo[1];

  // First date that looks like 16-May-25 is the document's own (header) date
  const date = text.match(/\b(\d{1,2}-[A-Za-z]{3}-\d{2,4})\b/);
  if (date) out.doc_date = date[1];

  // Title (QP) or Description (SOP) — whichever the header uses
  const title = text.match(/(?:^|\n)\s*Title\s+(.+)/);
  const desc = text.match(/Description\s*:?\s*(.+)/);
  out.title = firstCol(title ? title[1] : desc ? desc[1] : '');

  const model = text.match(/Model\s*:?\s*(.+)/);
  if (model) {
    out.model = firstCol(model[1]);
    // The Model line is usually "<customer> : <product name>", e.g.
    // "TOTO : Operation Panel _Domestic" -> customer=TOTO, 品名=Operation Panel…
    const colon = out.model.indexOf(':');
    if (colon !== -1) {
      out.customer_name = out.model.slice(0, colon).trim();
      out.product_name = out.model.slice(colon + 1).trim();
    } else {
      out.product_name = out.model;
    }
  }
  // Product No. can span several lines before the next label (Drawing /
  // Description). Capture the whole block and keep each line's first column
  // (drops the right-hand columns like the date), so all codes are included.
  const pnBlock = text.match(/Product\s*No\.?\s*:?\s*([\s\S]*?)(?:\n\s*(?:Drawing|Description|Conditions)\b|\n\s*\d+\s*\.)/i);
  if (pnBlock) {
    out.product_no = pnBlock[1].split('\n').map(firstCol).filter(Boolean).join(' ').trim();
  } else {
    const productNo = text.match(/Product\s*No\.?\s*:?\s*(.+)/);
    if (productNo) out.product_no = firstCol(productNo[1]);
  }

  return out;
}

// --- Product codes (品番) for exact barcode matching -----------------------
// Split the product-number text into individual codes. A code is a 3+ char
// token that contains at least one digit (DD360, DEMED216, …); plain words
// like "Operation" are ignored. The document number is included too, so a
// scanned doc number also resolves exactly.
function extractCodes(productNo, docNo) {
  const codes = new Set();
  for (const tok of (productNo || '').split(/[^A-Za-z0-9-]+/)) {
    const t = tok.replace(/^-+|-+$/g, '');
    if (t.length >= 3 && /\d/.test(t)) codes.add(t);
  }
  const dn = (docNo || '').trim();
  if (dn) codes.add(dn);
  return [...codes];
}

const insertCode = db.prepare('INSERT INTO product_codes (file_id, code) VALUES (?, ?)');
const clearCodes = db.prepare('DELETE FROM product_codes WHERE file_id = ?');
// Rebuild the code list for a file (used on upload and for backfill)
function setProductCodes(fileId, productNo, docNo) {
  clearCodes.run(fileId);
  for (const code of extractCodes(productNo, docNo)) insertCode.run(fileId, code);
}

// Backfill codes for any pre-existing file that has none yet (e.g. after the
// feature is deployed onto a database that already holds files)
const filesNeedingCodes = db
  .prepare(
    `SELECT id, product_no, doc_no FROM sop_files f
     WHERE NOT EXISTS (SELECT 1 FROM product_codes p WHERE p.file_id = f.id)
       AND (f.product_no <> '' OR f.doc_no <> '')`
  )
  .all();
for (const f of filesNeedingCodes) setProductCodes(f.id, f.product_no, f.doc_no);

// --- Auth middleware -------------------------------------------------------
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) return next();
  // API -> 401, pages -> sign-in
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Sign in required' });
  res.redirect('/login.html');
};

// --- Auth ------------------------------------------------------------------
// Sign in: POST /checklogin (username, password sent as a form)
app.post('/checklogin', (req, res) => {
  const { username, password } = req.body;
  const wantsJson = (req.get('accept') || '').includes('application/json');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get((username || '').toString().trim());

  if (!user || !bcrypt.compareSync((password || '').toString(), user.password_hash)) {
    if (wantsJson) return res.status(401).json({ error: 'Incorrect username or password' });
    return res.redirect('/login.html?error=1');
  }

  req.session.user = { id: user.id, username: user.username, display_name: user.display_name };
  if (wantsJson) return res.json({ ok: true, user: req.session.user });
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    if ((req.get('accept') || '').includes('application/json')) return res.json({ ok: true });
    res.redirect('/login.html');
  });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.session.user }));

// --- Lookup axes (doc types / departments / customers) ---------------------
// All are simple editable name lists. They share the same shape, so a small
// factory builds the CRUD routes for each, keyed by the file column it filters.
// `blockWhenInUse` = true for required axes (delete refused while referenced);
// false for the optional customer axis (deleting just unassigns its files).
function registerLookup(basePath, table, fileColumn, label, blockWhenInUse = true) {
  // List with per-item file counts
  app.get(basePath, requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT t.id, t.name, COUNT(f.id) AS file_count
         FROM ${table} t
         LEFT JOIN sop_files f ON f.${fileColumn} = t.id
         GROUP BY t.id ORDER BY t.name`
      )
      .all();
    res.json(rows);
  });

  // Add
  app.post(basePath, requireAuth, (req, res) => {
    const name = (req.body.name || '').toString().trim().slice(0, 50);
    if (!name) return res.status(400).json({ error: `Please enter a ${label} name` });
    const exists = db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name);
    if (exists) return res.status(409).json({ error: `That ${label} already exists` });
    const info = db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(name);
    res.status(201).json({ id: info.lastInsertRowid, name, file_count: 0 });
  });

  // Delete — required axes refuse while referenced; optional axes unassign
  app.delete(`${basePath}/:id`, requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: `${label} not found` });
    if (blockWhenInUse) {
      const used = db
        .prepare(`SELECT COUNT(*) AS c FROM sop_files WHERE ${fileColumn} = ?`)
        .get(id).c;
      if (used > 0) {
        return res
          .status(409)
          .json({ error: `Cannot delete: ${used} file(s) still use this ${label}` });
      }
    }
    // For the optional customer axis, ON DELETE SET NULL unassigns its files.
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    res.json({ ok: true });
  });
}

registerLookup('/api/doc-types', 'doc_types', 'doc_type_id', 'document type');
registerLookup('/api/departments', 'departments', 'department_id', 'department');
registerLookup('/api/customers', 'customers', 'customer_id', 'customer', false);

// --- PDF header auto-extract (experimental) --------------------------------
// Accepts a file, reads its header, and returns the fields so the upload form
// can pre-fill them. The file is NOT kept — it is parsed and deleted. The real
// upload happens separately via POST /api/files.
app.post('/api/extract', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Please choose a file' });
    const path = join(UPLOAD_DIR, req.file.filename);
    let fields;
    try {
      fields = extractHeader(path, req.file.originalname, req.file.mimetype);
    } finally {
      try {
        unlinkSync(path);
      } catch {
        /* ignore */
      }
    }
    // Split the document number into its type / department codes so the client
    // can preselect the matching dropdowns (e.g. SOP-QC-0021 -> SOP, QC).
    const parts = (fields.doc_no || '').split('-');
    res.json({ ...fields, type_code: parts[0] || '', dept_code: parts[1] || '' });
  });
});

// --- Static files ----------------------------------------------------------
// `no-cache` = the browser may cache but must revalidate every time (cheap 304
// when unchanged). This guarantees users get the latest HTML/JS right after a
// deploy instead of a stale cached frontend, while keeping requests light.
const noCache = (res) => res.setHeader('Cache-Control', 'no-cache');

// The sign-in page and static assets are served without auth
app.get('/login.html', (req, res) => {
  noCache(res);
  res.sendFile(join(__dirname, 'public', 'login.html'));
});
app.use('/assets', express.static(join(__dirname, 'public'), { setHeaders: noCache }));

// The home page requires auth (redirects to sign-in if not logged in)
app.get('/', requireAuth, (req, res) => {
  noCache(res);
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// --- File API --------------------------------------------------------------
// Revision control: documents that share a (non-empty) doc_no are revisions of
// the same document. The "current" one is the highest revision number (ties
// broken by newest id). This SQL condition is true for the current revision.
const CURRENT_REV = `
  NOT EXISTS (
    SELECT 1 FROM sop_files g
    WHERE g.doc_no = f.doc_no AND f.doc_no <> ''
      AND ( CAST(g.revision AS INTEGER) > CAST(f.revision AS INTEGER)
         OR (CAST(g.revision AS INTEGER) = CAST(f.revision AS INTEGER) AND g.id > f.id) )
  )`;

const fileSelect = `
  SELECT f.id, f.title, f.description,
         f.doc_type_id, t.name AS doc_type_name,
         f.department_id, d.name AS department_name,
         f.customer_id, cu.name AS customer_name,
         f.doc_no, f.revision, f.doc_date, f.model, f.product_name, f.product_no,
         (SELECT GROUP_CONCAT(pc.code, ' ') FROM product_codes pc WHERE pc.file_id = f.id) AS codes,
         (${CURRENT_REV}) AS is_current,
         (SELECT COUNT(*) FROM sop_files g2 WHERE g2.doc_no = f.doc_no AND f.doc_no <> '') AS revision_count,
         f.original_name, f.mimetype, f.size, f.uploaded_at,
         u.username AS uploaded_by_name
  FROM sop_files f
  LEFT JOIN doc_types t ON t.id = f.doc_type_id
  LEFT JOIN departments d ON d.id = f.department_id
  LEFT JOIN customers cu ON cu.id = f.customer_id
  LEFT JOIN users u ON u.id = f.uploaded_by
`;

// List + search (q: title/desc/doc no/product/file name; type/department/customer)
app.get('/api/files', requireAuth, (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const where = [];
  const params = [];

  if (q) {
    where.push(
      '(f.title LIKE ? OR f.description LIKE ? OR f.doc_no LIKE ? OR f.product_name LIKE ? OR f.product_no LIKE ? OR f.original_name LIKE ?)'
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }
  // Each axis filters independently; 'all'/empty means no filter on that axis.
  // 'none' matches files with nothing assigned (used by the optional customer axis).
  const axisFilter = (value, column) => {
    if (value === 'none') {
      where.push(`f.${column} IS NULL`);
    } else if (value !== undefined && value !== '' && value !== 'all') {
      where.push(`f.${column} = ?`);
      params.push(Number(value));
    }
  };
  // Exact product-code (品番) filter — "show every document for this product"
  const code = (req.query.code || '').toString().trim();
  if (code) {
    where.push('f.id IN (SELECT file_id FROM product_codes WHERE code = ? COLLATE NOCASE)');
    params.push(code);
  }
  // Per-column text filters (each a partial match over that column's fields)
  const colFilter = (value, columns) => {
    const v = (value || '').toString().trim();
    if (!v) return;
    where.push(`(${columns.map((c) => `${c} LIKE ?`).join(' OR ')})`);
    columns.forEach(() => params.push(`%${v}%`));
  };
  colFilter(req.query.docref, ['f.doc_no', 'f.revision', 'f.doc_date']);
  colFilter(req.query.title, ['f.title', 'f.product_name']);
  colFilter(req.query.by, ['u.username']);
  colFilter(req.query.product, ['f.product_no', 'f.product_name']);
  axisFilter(req.query.type, 'doc_type_id');
  axisFilter(req.query.department, 'department_id');
  axisFilter(req.query.customer, 'customer_id');

  // Show only the current revision unless explicitly asked for all revisions
  if (req.query.revisions !== 'all') where.push(CURRENT_REV);

  const sql = `${fileSelect} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY f.uploaded_at DESC`;
  res.json(db.prepare(sql).all(...params));
});

// Upload — both the document type and the department are required
app.post('/api/files', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Please choose a file' });

    const cleanup = () => {
      try {
        unlinkSync(join(UPLOAD_DIR, req.file.filename));
      } catch {
        /* ignore */
      }
    };

    const docTypeId = Number(req.body.doc_type_id);
    const departmentId = Number(req.body.department_id);
    if (!docTypeId || !db.prepare('SELECT id FROM doc_types WHERE id = ?').get(docTypeId)) {
      cleanup();
      return res.status(400).json({ error: 'Please choose a document type' });
    }
    if (!departmentId || !db.prepare('SELECT id FROM departments WHERE id = ?').get(departmentId)) {
      cleanup();
      return res.status(400).json({ error: 'Please choose a department' });
    }

    // Customer is optional; keep it only if it refers to an existing customer
    let customerId = req.body.customer_id ? Number(req.body.customer_id) : null;
    if (customerId && !db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId)) {
      customerId = null;
    }

    const title = (req.body.title || req.file.originalname).toString().trim().slice(0, 200);
    const description = (req.body.description || '').toString().trim().slice(0, 1000);
    const str = (v, n) => (v || '').toString().trim().slice(0, n);
    const docNo = str(req.body.doc_no, 100);
    const revision = str(req.body.revision, 50);
    const docDate = str(req.body.doc_date, 50);
    const model = str(req.body.model, 200);
    const productName = str(req.body.product_name, 200);
    const productNo = str(req.body.product_no, 500);

    const info = db
      .prepare(
        `INSERT INTO sop_files
          (title, description, doc_type_id, department_id, customer_id, doc_no, revision, doc_date, model, product_name, product_no, stored_name, original_name, mimetype, size, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        description,
        docTypeId,
        departmentId,
        customerId,
        docNo,
        revision,
        docDate,
        model,
        productName,
        productNo,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.session.user.id,
        new Date().toISOString()
      );

    // Index the product codes for exact barcode lookup
    setProductCodes(info.lastInsertRowid, productNo, docNo);

    res.status(201).json(db.prepare(`${fileSelect} WHERE f.id = ?`).get(info.lastInsertRowid));
  });
});

// Download (or inline view with ?inline=1 — used by the barcode lookup so the
// inspection spec opens straight in the browser instead of downloading)
app.get('/api/files/:id/download', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM sop_files WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'File not found' });
  const path = join(UPLOAD_DIR, row.stored_name);
  if (!existsSync(path)) return res.status(410).json({ error: 'The stored file no longer exists' });

  const disposition = req.query.inline ? 'inline' : 'attachment';
  res.setHeader('Content-Type', row.mimetype || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename*=UTF-8''${encodeURIComponent(row.original_name)}`
  );
  createReadStream(path).pipe(res);
});

// Barcode / product-number lookup — find documents whose product number (品番),
// document number, product name or file name contains the scanned code. Used by
// the inspection station: scan a code, get the matching inspection spec(s).
app.get('/api/lookup', requireAuth, (req, res) => {
  const code = (req.query.code || '').toString().trim();
  if (!code) return res.json([]);

  // Only ever return the current revision so a scan opens the latest version.
  // Tier 1: exact product-code match (case-insensitive). This is the reliable
  // path — scanning DD360 matches only the code "DD360", never "DD3600".
  const exact = db
    .prepare(
      `${fileSelect}
       WHERE f.id IN (SELECT file_id FROM product_codes WHERE code = ? COLLATE NOCASE)
         AND ${CURRENT_REV}
       ORDER BY f.uploaded_at DESC`
    )
    .all(code);
  if (exact.length > 0) return res.json(exact);

  // Tier 2: fall back to a substring search across the identifier fields
  const like = `%${code}%`;
  const rows = db
    .prepare(
      `${fileSelect}
       WHERE (f.product_no LIKE ? OR f.doc_no LIKE ? OR f.product_name LIKE ? OR f.original_name LIKE ?)
         AND ${CURRENT_REV}
       ORDER BY f.uploaded_at DESC`
    )
    .all(like, like, like, like);
  res.json(rows);
});

// Delete
app.delete('/api/files/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM sop_files WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'File not found' });
  db.prepare('DELETE FROM sop_files WHERE id = ?').run(row.id);
  const path = join(UPLOAD_DIR, row.stored_name);
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* The DB row is already gone even if file removal fails; ignore */
  }
  res.json({ ok: true });
});

// Health check
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/api/version', (req, res) => res.json({ version: APP_VERSION }));

app.listen(PORT, () => {
  console.log(`SOP File Management System: http://localhost:${PORT}`);
});
