import express from 'express';
import session from 'express-session';
import SqliteStoreFactory from 'better-sqlite3-session-store';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { mkdirSync, existsSync, unlinkSync, createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
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
  const out = { doc_no: '', revision: '', doc_date: '', title: '', model: '', product_no: '' };

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
  if (model) out.model = firstCol(model[1]);
  const productNo = text.match(/Product\s*No\.?\s*:?\s*(.+)/);
  if (productNo) out.product_no = firstCol(productNo[1]);

  return out;
}

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

// --- Lookup axes (doc types & departments) ---------------------------------
// Both are simple editable name lists. They share the same shape, so a small
// factory builds the CRUD routes for each, keyed by the file column it filters.
function registerLookup(basePath, table, fileColumn, label) {
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

  // Delete — blocked while files still reference it (both axes are required)
  app.delete(`${basePath}/:id`, requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: `${label} not found` });
    const used = db.prepare(`SELECT COUNT(*) AS c FROM sop_files WHERE ${fileColumn} = ?`).get(id).c;
    if (used > 0) {
      return res
        .status(409)
        .json({ error: `Cannot delete: ${used} file(s) still use this ${label}` });
    }
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    res.json({ ok: true });
  });
}

registerLookup('/api/doc-types', 'doc_types', 'doc_type_id', 'document type');
registerLookup('/api/departments', 'departments', 'department_id', 'department');

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
// The sign-in page and static assets are served without auth
app.get('/login.html', (req, res) => res.sendFile(join(__dirname, 'public', 'login.html')));
app.use('/assets', express.static(join(__dirname, 'public')));

// The home page requires auth (redirects to sign-in if not logged in)
app.get('/', requireAuth, (req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));

// --- File API --------------------------------------------------------------
const fileSelect = `
  SELECT f.id, f.title, f.description,
         f.doc_type_id, t.name AS doc_type_name,
         f.department_id, d.name AS department_name,
         f.doc_no, f.revision, f.doc_date, f.model, f.product_no,
         f.original_name, f.mimetype, f.size, f.uploaded_at,
         u.username AS uploaded_by_name
  FROM sop_files f
  LEFT JOIN doc_types t ON t.id = f.doc_type_id
  LEFT JOIN departments d ON d.id = f.department_id
  LEFT JOIN users u ON u.id = f.uploaded_by
`;

// List + search (q: title/description/doc no/file name; type/department: axis ids)
app.get('/api/files', requireAuth, (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const where = [];
  const params = [];

  if (q) {
    where.push(
      '(f.title LIKE ? OR f.description LIKE ? OR f.doc_no LIKE ? OR f.original_name LIKE ?)'
    );
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  // Each axis filters independently; 'all'/empty means no filter on that axis
  const axisFilter = (value, column) => {
    if (value !== undefined && value !== '' && value !== 'all') {
      where.push(`f.${column} = ?`);
      params.push(Number(value));
    }
  };
  axisFilter(req.query.type, 'doc_type_id');
  axisFilter(req.query.department, 'department_id');

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

    const title = (req.body.title || req.file.originalname).toString().trim().slice(0, 200);
    const description = (req.body.description || '').toString().trim().slice(0, 1000);
    const str = (v, n) => (v || '').toString().trim().slice(0, n);
    const docNo = str(req.body.doc_no, 100);
    const revision = str(req.body.revision, 50);
    const docDate = str(req.body.doc_date, 50);
    const model = str(req.body.model, 200);
    const productNo = str(req.body.product_no, 500);

    const info = db
      .prepare(
        `INSERT INTO sop_files
          (title, description, doc_type_id, department_id, doc_no, revision, doc_date, model, product_no, stored_name, original_name, mimetype, size, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        description,
        docTypeId,
        departmentId,
        docNo,
        revision,
        docDate,
        model,
        productNo,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.session.user.id,
        new Date().toISOString()
      );

    res.status(201).json(db.prepare(`${fileSelect} WHERE f.id = ?`).get(info.lastInsertRowid));
  });
});

// Download
app.get('/api/files/:id/download', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM sop_files WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'File not found' });
  const path = join(UPLOAD_DIR, row.stored_name);
  if (!existsSync(path)) return res.status(410).json({ error: 'The stored file no longer exists' });

  res.setHeader('Content-Type', row.mimetype || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`
  );
  createReadStream(path).pipe(res);
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

app.listen(PORT, () => {
  console.log(`SOP File Management System: http://localhost:${PORT}`);
});
