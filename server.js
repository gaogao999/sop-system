import express from 'express';
import session from 'express-session';
import SqliteStoreFactory from 'better-sqlite3-session-store';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { mkdirSync, existsSync, unlinkSync, createReadStream, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
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

// --- OCR fallback (scanned / image-only PDFs) ------------------------------
// Some documents are scans with no embedded text, so pdftotext returns almost
// nothing. We rasterise the page range with pdftoppm and run tesseract on each
// image. OCR is best-effort: if the tools are missing or anything fails we
// return '' and the caller carries on with whatever text it already had.
const OCR_LANG = process.env.OCR_LANG || 'eng';
const OCR_MAX_PAGES = Number(process.env.OCR_MAX_PAGES) || 20; // bound the work
const nonSpace = (s) => (s || '').replace(/\s/g, '').length;

function ocrPdf(filePath, firstPage, lastPage) {
  const dir = join(tmpdir(), `ocr-${randomUUID()}`);
  try {
    mkdirSync(dir, { recursive: true });
    const prefix = join(dir, 'p');
    // Rasterise to PNG at 200 DPI — a good accuracy/speed balance for OCR
    execFileSync(
      'pdftoppm',
      ['-png', '-r', '200', '-f', String(firstPage), '-l', String(lastPage), filePath, prefix],
      { maxBuffer: 64 * 1024 * 1024 }
    );
    const images = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
    let text = '';
    for (const img of images) {
      try {
        text +=
          execFileSync('tesseract', [join(dir, img), 'stdout', '-l', OCR_LANG], {
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
          }) + '\n';
      } catch {
        /* skip a page that fails OCR */
      }
    }
    return text;
  } catch {
    return ''; // pdftoppm / tesseract missing or failed
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore temp cleanup errors */
    }
  }
}

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
    text = ''; // pdftotext missing or failed — OCR may still recover the header
  }

  // Scanned/image-only first page yields almost no text — OCR it and use that
  // if it recovers more than pdftotext did.
  if (nonSpace(text) < 20) {
    const ocr = ocrPdf(filePath, 1, 1);
    if (nonSpace(ocr) > nonSpace(text)) text = ocr;
  }
  if (!text) return out; // name-only result

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

// Full PDF body text (all pages) for content search. Truncated to keep DB rows
// reasonable; empty for non-PDFs or if pdftotext is unavailable.
function extractFullText(filePath, mimetype) {
  if (mimetype !== 'application/pdf') return '';
  let txt = '';
  try {
    txt = execFileSync('pdftotext', [filePath, '-'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    txt = '';
  }
  // Scanned PDF: little/no embedded text — OCR the first OCR_MAX_PAGES pages.
  if (nonSpace(txt) < 100) {
    const ocr = ocrPdf(filePath, 1, OCR_MAX_PAGES);
    if (ocr.length > txt.length) txt = ocr;
  }
  return txt.replace(/\s+/g, ' ').trim().slice(0, 200000);
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

// --- Access log ------------------------------------------------------------
const insertLog = db.prepare(
  'INSERT INTO access_log (file_id, doc_no, title, username, action, at) VALUES (?, ?, ?, ?, ?, ?)'
);
function logAccess(row, username, action) {
  try {
    insertLog.run(row.id, row.doc_no || '', row.title || '', username || '', action, new Date().toISOString());
  } catch {
    /* logging must never break the request */
  }
}

// --- Auth middleware -------------------------------------------------------
// Demo login: while showing the mockup we skip the sign-in screen entirely and
// run as the first (admin) user. Turn it off with DEMO_LOGIN=0 to require a
// real sign-in (e.g. once wired to the company /checklogin).
const DEMO_LOGIN = process.env.DEMO_LOGIN !== '0';
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) return next();
  if (DEMO_LOGIN) {
    const u = db.prepare('SELECT id, username, display_name FROM users ORDER BY id LIMIT 1').get();
    if (u) {
      req.session.user = { id: u.id, username: u.username, display_name: u.display_name };
      return next();
    }
  }
  // API -> 401, pages -> sign-in
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Sign in required' });
  res.redirect('/login.html');
};

// --- Auth ------------------------------------------------------------------
// Credential verification is isolated here so it can be swapped for the real
// company sign-in later without touching the route. The deployed KGTH systems
// all authenticate through a shared `POST /checklogin` (form: username =
// 社員ID, password) that issues a `connect.sid` cookie — exactly this shape.
// For now AUTH_MODE=local checks the built-in SQLite user table (the mock);
// set AUTH_MODE=upstream + AUTH_UPSTREAM_URL once the company endpoint contract
// (cookie sharing / CORS / session validation) is confirmed with IT.
const AUTH_MODE = process.env.AUTH_MODE || 'local';

function verifyCredentials(username, password) {
  // Returns the session user object on success, or null on failure.
  if (AUTH_MODE !== 'local') {
    // Placeholder for delegating to the shared company /checklogin. Left
    // unimplemented on purpose — wiring it needs the confirmed upstream
    // contract; until then any non-local mode safely denies sign-in.
    return null;
  }
  const u = (username || '').toString().trim();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(u);
  if (!user || !bcrypt.compareSync((password || '').toString(), user.password_hash)) return null;
  return { id: user.id, username: user.username, display_name: user.display_name };
}

// Sign in: POST /checklogin (username, password sent as a form)
app.post('/checklogin', (req, res) => {
  const { username, password } = req.body;
  const wantsJson = (req.get('accept') || '').includes('application/json');
  const user = verifyCredentials(username, password);

  if (!user) {
    if (wantsJson) return res.status(401).json({ error: 'Incorrect username or password' });
    return res.redirect('/login.html?error=1');
  }

  req.session.user = user;
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

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.session.user, demo: DEMO_LOGIN }));

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

  // Rename
  app.patch(`${basePath}/:id`, requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: `${label} not found` });
    const name = (req.body.name || '').toString().trim().slice(0, 50);
    if (!name) return res.status(400).json({ error: `Please enter a ${label} name` });
    const clash = db.prepare(`SELECT id FROM ${table} WHERE name = ? AND id <> ?`).get(name, id);
    if (clash) return res.status(409).json({ error: `That ${label} already exists` });
    db.prepare(`UPDATE ${table} SET name = ? WHERE id = ?`).run(name, id);
    res.json({ id, name });
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
  if (DEMO_LOGIN) return res.redirect('/'); // no sign-in screen while in demo mode
  noCache(res);
  res.sendFile(join(__dirname, 'public', 'login.html'));
});
app.use('/assets', express.static(join(__dirname, 'public'), { setHeaders: noCache }));

// Service worker — must be served from the root so its scope covers the whole
// app (a file under /assets would only control /assets). PWA install + cached
// app shell for the shop floor; see public/sw.js.
app.get('/sw.js', (req, res) => {
  noCache(res);
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(join(__dirname, 'public', 'sw.js'));
});

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

// The shared column list. With { snippet:true } it also returns a ~160-char
// excerpt of the PDF body around the search term (two leading ? params: the
// LIKE pattern and the raw term) — used to show *where* a full-text hit is.
function fileSelectSql({ snippet = false } = {}) {
  return `
  SELECT f.id, f.title, f.description,
         f.doc_type_id, t.name AS doc_type_name,
         f.department_id, d.name AS department_name,
         f.customer_id, cu.name AS customer_name,
         f.doc_no, f.revision, f.doc_date, f.model, f.product_name, f.product_no,
         f.status, f.category, f.dept_code, f.effective_date, f.next_review_date,
         f.detail_of_revision, f.changed_pages, f.reviewer, f.approver, f.reject_comment,
         f.last_reviewed_at, f.last_reviewed_by,
         (SELECT GROUP_CONCAT(pc.code, ' ') FROM product_codes pc WHERE pc.file_id = f.id) AS codes,
         (${CURRENT_REV}) AS is_current,
         (SELECT COUNT(*) FROM sop_files g2 WHERE g2.doc_no = f.doc_no AND f.doc_no <> '') AS revision_count,
         f.original_name, f.mimetype, f.size, f.uploaded_at,
         u.username AS uploaded_by_name${
           snippet
             ? `,
         CASE WHEN f.pdf_text LIKE ?
              THEN trim(substr(f.pdf_text, MAX(1, instr(lower(f.pdf_text), lower(?)) - 40), 180))
              ELSE '' END AS snippet`
             : `,
         '' AS snippet`
         }
  FROM sop_files f
  LEFT JOIN doc_types t ON t.id = f.doc_type_id
  LEFT JOIN departments d ON d.id = f.department_id
  LEFT JOIN customers cu ON cu.id = f.customer_id
  LEFT JOIN users u ON u.id = f.uploaded_by
`;
}
const fileSelect = fileSelectSql();

// Mark which rows the given user has starred (★). One query, then a Set lookup.
function markFavorites(rows, username) {
  if (!rows.length) return rows;
  const favs = new Set(
    db.prepare('SELECT file_id FROM favorites WHERE username = ?').all(username).map((r) => r.file_id)
  );
  for (const r of rows) r.favorited = favs.has(r.id) ? 1 : 0;
  return rows;
}

// --- ISO document control (QP-DC-01) --------------------------------------
// Number generation: build the next number for a category + department/customer.
// Patterns use {dept}/{cust} tokens and '#' for the zero-padded serial.
function buildNumber(category, deptCode, custCode, serial) {
  let width = category.width;
  // Special case: WI issued by EC uses a 5-digit serial (QP-DC-01 5.1)
  if (category.code === 'WI' && deptCode === 'EC') width = 5;
  return category.pattern
    .replace('{dept}', deptCode || '')
    .replace('{cust}', custCode || '')
    .replace('#', String(serial).padStart(width, '0'));
}
function seqKey(categoryCode, scopeCode) {
  return scopeCode ? `${categoryCode}-${scopeCode}` : categoryCode;
}
// Peek the next serial without consuming it (for the live preview in the form)
function peekSerial(key) {
  const row = db.prepare('SELECT n FROM doc_sequences WHERE key = ?').get(key);
  return (row ? row.n : 0) + 1;
}
// Consume (increment) the serial and return the new value (used on create)
const consumeSerial = db.transaction((key) => {
  db.prepare(
    `INSERT INTO doc_sequences (key, n) VALUES (?, 1)
     ON CONFLICT(key) DO UPDATE SET n = n + 1`
  ).run(key);
  return db.prepare('SELECT n FROM doc_sequences WHERE key = ?').get(key).n;
});

// --- PDF watermark stamps (QP-DC-01 6.1.4-6.1.8) ---------------------------
// Overlay control stamps on a PDF, styled to mirror the physical rubber stamps
// (red bordered box: ORG / TITLE / [boxed date or dest] / DOCUMENT CONTROL
// SECTION). Best-effort: if the PDF can't be parsed we return it unchanged.
const MONTHS3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function stampDate(iso) {
  const m = (iso || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS3[Number(m[2]) - 1]} ${m[1]}`; // 24 JAN 2024
}

// Draw a rubber-stamp-style box at the top-right of a page.
function drawStampBox(page, font, { color, title, boxText, bottom }) {
  const { width, height } = page.getSize();
  const w = 208;
  const h = 96;
  const x = width - w - 34;
  const y = height - h - 34;
  const cx = x + w / 2;
  const c = rgb(...color);
  const center = (text, size, baseY, scale = 1) => {
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: cx - tw / 2, y: baseY, size, font, color: c, opacity: 0.92 });
  };
  // outer border
  page.drawRectangle({ x, y, width: w, height: h, borderColor: c, borderWidth: 2, borderOpacity: 0.92 });
  center('KGT', 12, y + h - 22);
  center(title, 16, y + h - 46);
  // inner boxed value (date for MASTER, destination for CONTROLLED PRINT)
  if (boxText) {
    const bw = 124;
    const bh = 22;
    const bx = x + (w - bw) / 2;
    const by = y + 28;
    page.drawRectangle({ x: bx, y: by, width: bw, height: bh, borderColor: c, borderWidth: 1, borderOpacity: 0.92 });
    const ts = 12;
    const tw = font.widthOfTextAtSize(boxText, ts);
    page.drawText(boxText, { x: bx + (bw - tw) / 2, y: by + (bh - ts) / 2 + 1, size: ts, font, color: c, opacity: 0.92 });
  }
  center(bottom, 8, y + 10);
}

const STAMP = {
  master: { color: [0.85, 0, 0], allPages: false, box: { title: 'MASTER DOCUMENT', bottom: 'DOCUMENT CONTROL SECTION' } },
  controlled: { color: [0.1, 0.3, 0.85], allPages: true, box: { title: 'CONTROLLED PRINT', bottom: 'DOCUMENT CONTROL SECTION' } },
  void: { color: [0.85, 0, 0], allPages: true, diagonal: 'VOID' },
  uncontrolled: { color: [0.85, 0, 0], allPages: true, diagonal: 'UNCONTROLLED' },
};
async function watermarkPdf(bytes, kind, note) {
  const spec = STAMP[kind];
  if (!spec) return bytes;
  let pdf;
  try {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    return bytes; // not a parseable PDF (e.g. a scan wrapper we can't open) — serve as-is
  }
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();
  pages.forEach((page, i) => {
    if (!spec.allPages && i > 0) return;
    const { width, height } = page.getSize();
    if (spec.diagonal) {
      // Big translucent diagonal stamp across the page (VOID / UNCONTROLLED)
      const size = Math.min(width, height) / 5;
      page.drawText(spec.diagonal, {
        x: width * 0.12,
        y: height * 0.42,
        size,
        font,
        color: rgb(...spec.color),
        opacity: 0.28,
        rotate: degrees(35),
      });
    } else {
      // Rubber-stamp-style box (MASTER DOCUMENT / CONTROLLED PRINT).
      // For MASTER the box shows the effective date; for CONTROLLED, the destination.
      const boxText = kind === 'master' ? stampDate(note) : note || '';
      drawStampBox(page, font, { color: spec.color, ...spec.box, boxText });
    }
  });
  return await pdf.save();
}

// Human-readable status label set sent to the client
const STATUS = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  pending_approval: 'Pending Approval',
  master: 'MASTER DOCUMENT',
  void: 'VOID',
  cancelled: 'Cancelled',
};

// List + search (q: title/desc/doc no/product/file name; type/department/customer)
app.get('/api/files', requireAuth, (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const where = [];
  const whereParams = [];
  const like = `%${q}%`;

  if (q) {
    where.push(
      '(f.title LIKE ? OR f.description LIKE ? OR f.doc_no LIKE ? OR f.product_name LIKE ? OR f.product_no LIKE ? OR f.original_name LIKE ? OR f.pdf_text LIKE ?)'
    );
    whereParams.push(like, like, like, like, like, like, like);
  }
  // Each axis filters independently; 'all'/empty means no filter on that axis.
  // 'none' matches files with nothing assigned (used by the optional customer axis).
  const axisFilter = (value, column) => {
    if (value === 'none') {
      where.push(`f.${column} IS NULL`);
    } else if (value !== undefined && value !== '' && value !== 'all') {
      where.push(`f.${column} = ?`);
      whereParams.push(Number(value));
    }
  };
  // Exact product-code (品番) filter — "show every document for this product"
  const code = (req.query.code || '').toString().trim();
  if (code) {
    where.push('f.id IN (SELECT file_id FROM product_codes WHERE code = ? COLLATE NOCASE)');
    whereParams.push(code);
  }
  // Per-column text filters (each a partial match over that column's fields)
  const colFilter = (value, columns) => {
    const v = (value || '').toString().trim();
    if (!v) return;
    where.push(`(${columns.map((c) => `${c} LIKE ?`).join(' OR ')})`);
    columns.forEach(() => whereParams.push(`%${v}%`));
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

  // Relevance ranking when searching: doc-no exact > doc-no prefix > title >
  // product / customer > body text. Falls back to newest-first within a tier.
  // Params are bound in source order, so: SELECT(snippet) → WHERE → ORDER BY.
  const selectParams = q ? [like, q] : [];
  let orderBy = 'f.uploaded_at DESC';
  const orderParams = [];
  if (q) {
    orderBy = `(CASE
        WHEN f.doc_no = ? COLLATE NOCASE THEN 100
        WHEN f.doc_no LIKE ? THEN 90
        WHEN f.title LIKE ? THEN 80
        WHEN f.product_no LIKE ? OR f.product_name LIKE ? THEN 60
        WHEN cu.name LIKE ? THEN 50
        ELSE 20 END) DESC, f.uploaded_at DESC`;
    orderParams.push(q, `${q}%`, like, like, like, like);
  }

  const sql = `${fileSelectSql({ snippet: !!q })} ${
    where.length ? 'WHERE ' + where.join(' AND ') : ''
  } ORDER BY ${orderBy}`;
  const rows = db.prepare(sql).all(...selectParams, ...whereParams, ...orderParams);
  res.json(markFavorites(rows, req.session.user.username));
});

// --- Favourites (★) + home shelves -----------------------------------------
// Toggle a document in the current user's favourites.
app.post('/api/files/:id/favorite', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT id FROM sop_files WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const username = req.session.user.username;
  const existing = db.prepare('SELECT 1 FROM favorites WHERE username = ? AND file_id = ?').get(username, id);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE username = ? AND file_id = ?').run(username, id);
    return res.json({ favorited: false });
  }
  db.prepare('INSERT INTO favorites (username, file_id, created_at) VALUES (?, ?, ?)').run(
    username,
    id,
    new Date().toISOString()
  );
  res.json({ favorited: true });
});

// Home shelves: the user's recently viewed, their favourites, and the most
// opened documents in the last 60 days. Only current revisions, capped small.
app.get('/api/home', requireAuth, (req, res) => {
  const username = req.session.user.username;
  const onlyCurrent = (rows) => markFavorites(rows.filter((r) => r.is_current), username);
  const byIds = (ids) => {
    if (!ids.length) return [];
    const order = new Map(ids.map((id, i) => [id, i]));
    const rows = db
      .prepare(`${fileSelect} WHERE f.id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids);
    rows.sort((a, b) => order.get(a.id) - order.get(b.id)); // preserve ranking order
    return rows;
  };

  // Recently viewed by this user (distinct, newest first)
  const recentIds = db
    .prepare(
      `SELECT file_id, MAX(at) AS last FROM access_log
       WHERE username = ? AND action = 'view' AND file_id IS NOT NULL
       GROUP BY file_id ORDER BY last DESC LIMIT 12`
    )
    .all(username)
    .map((r) => r.file_id);

  // Most opened recently (across everyone) — what the team relies on
  const popularIds = db
    .prepare(
      `SELECT file_id, COUNT(*) AS n FROM access_log
       WHERE action = 'view' AND file_id IS NOT NULL AND at >= ?
       GROUP BY file_id ORDER BY n DESC LIMIT 12`
    )
    .all(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
    .map((r) => r.file_id);

  const favIds = db
    .prepare('SELECT file_id FROM favorites WHERE username = ? ORDER BY created_at DESC LIMIT 24')
    .all(username)
    .map((r) => r.file_id);

  res.json({
    recent: onlyCurrent(byIds(recentIds)),
    favorites: onlyCurrent(byIds(favIds)),
    popular: onlyCurrent(byIds(popularIds)),
  });
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

    // Warn on an exact duplicate (same document number AND revision) unless the
    // client confirms with force=1. Lets the user catch accidental re-uploads.
    if (docNo && !req.body.force) {
      const dup = db.prepare('SELECT id FROM sop_files WHERE doc_no = ? AND revision = ?').get(docNo, revision);
      if (dup) {
        cleanup();
        return res
          .status(409)
          .json({ error: 'A document with this Doc No. and Rev already exists.', duplicate: true });
      }
    }

    const pdfText = extractFullText(join(UPLOAD_DIR, req.file.filename), req.file.mimetype);

    const info = db
      .prepare(
        `INSERT INTO sop_files
          (title, description, doc_type_id, department_id, customer_id, doc_no, revision, doc_date, model, product_name, product_no, pdf_text, stored_name, original_name, mimetype, size, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        pdfText,
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

// --- ISO document control: numbering, DAR, approval workflow ---------------
// Ensure a doc_type row exists for an ISO category code, returning its id (the
// sop_files.doc_type_id FK is required, and this keeps the Type axis in sync).
function ensureDocType(name) {
  const existing = db.prepare('SELECT id FROM doc_types WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO doc_types (name) VALUES (?)').run(name).lastInsertRowid;
}
const addYear = (iso) => {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
};
const oneRow = (id) => db.prepare(`${fileSelect} WHERE f.id = ?`).get(id);

// List the ISO categories (for the DAR form)
app.get('/api/doc-categories', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT code, label, pattern, width, scope FROM doc_categories ORDER BY sort').all());
});

// Preview the next document number for a category + department/customer
app.get('/api/next-number', requireAuth, (req, res) => {
  const cat = db.prepare('SELECT * FROM doc_categories WHERE code = ?').get(req.query.category);
  if (!cat) return res.status(400).json({ error: 'Unknown category' });
  let scopeCode = '';
  if (cat.scope === 'dept') {
    const d = db.prepare('SELECT name FROM departments WHERE id = ?').get(Number(req.query.department_id));
    scopeCode = d ? d.name : '';
  } else if (cat.scope === 'cust') {
    const c = db.prepare('SELECT name FROM customers WHERE id = ?').get(Number(req.query.customer_id));
    scopeCode = c ? c.name : '';
  }
  if (cat.scope !== 'none' && !scopeCode) return res.json({ doc_no: '', revision: '00' });
  const serial = peekSerial(seqKey(cat.code, scopeCode));
  res.json({ doc_no: buildNumber(cat, scopeCode, scopeCode, serial), revision: '00' });
});

// Submit a DAR (Document Action Request): creates a new document in
// "pending_review" with an auto-generated number (revision 00).
app.post('/api/dar', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Please attach a file' });
    const cleanup = () => { try { unlinkSync(join(UPLOAD_DIR, req.file.filename)); } catch { /* ignore */ } };

    const cat = db.prepare('SELECT * FROM doc_categories WHERE code = ?').get(req.body.category);
    if (!cat) { cleanup(); return res.status(400).json({ error: 'Please choose a document category' }); }
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(Number(req.body.department_id));
    if (!dept) { cleanup(); return res.status(400).json({ error: 'Please choose a department' }); }
    let customer = null;
    if (req.body.customer_id) customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(req.body.customer_id));
    if (cat.scope === 'cust' && !customer) { cleanup(); return res.status(400).json({ error: 'This category needs a customer' }); }

    const scopeCode = cat.scope === 'cust' ? customer.name : cat.scope === 'dept' ? dept.name : '';
    const serial = consumeSerial(seqKey(cat.code, scopeCode));
    const docNo = buildNumber(cat, scopeCode, scopeCode, serial);

    const str = (v, n) => (v || '').toString().trim().slice(0, n);
    const title = str(req.body.title, 200) || req.file.originalname;
    const pdfText = extractFullText(join(UPLOAD_DIR, req.file.filename), req.file.mimetype);

    const info = db
      .prepare(
        `INSERT INTO sop_files
          (title, description, doc_type_id, department_id, customer_id, doc_no, revision, status,
           category, dept_code, detail_of_revision, changed_pages, reviewer, approver,
           pdf_text, stored_name, original_name, mimetype, size, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, '00', 'pending_review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title, str(req.body.description, 1000), ensureDocType(cat.code), dept.id,
        customer ? customer.id : null, docNo, cat.code, dept.name,
        str(req.body.detail_of_revision, 1000), str(req.body.changed_pages, 100),
        str(req.body.reviewer, 100), str(req.body.approver, 100),
        pdfText, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size,
        req.session.user.id, new Date().toISOString()
      );
    setProductCodes(info.lastInsertRowid, '', docNo);
    res.status(201).json(oneRow(info.lastInsertRowid));
  });
});

// Approve the current stage: pending_review -> pending_approval -> master.
// On reaching "master" the effective date (= approval time) and the next review
// date (+1 year, QP-DC-01 6.1.3 / 6.2) are recorded.
app.post('/api/files/:id/approve', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM sop_files WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'File not found' });
  const me = req.session.user.username;
  if (row.status === 'pending_review') {
    db.prepare('UPDATE sop_files SET status = ?, reviewer = ?, reject_comment = ? WHERE id = ?')
      .run('pending_approval', me, '', row.id);
  } else if (row.status === 'pending_approval') {
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE sop_files SET status = ?, approver = ?, effective_date = ?, next_review_date = ? WHERE id = ?'
    ).run('master', me, now, addYear(now), row.id);
  } else {
    return res.status(400).json({ error: `Cannot approve a document that is "${row.status}"` });
  }
  res.json(oneRow(row.id));
});

// Reject -> back to Draft with a comment (QP-DC-01 6.1)
app.post('/api/files/:id/reject', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM sop_files WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'File not found' });
  if (!['pending_review', 'pending_approval'].includes(row.status)) {
    return res.status(400).json({ error: 'Only a pending document can be rejected' });
  }
  db.prepare('UPDATE sop_files SET status = ?, reject_comment = ? WHERE id = ?')
    .run('draft', (req.body.comment || '').toString().slice(0, 500), row.id);
  res.json(oneRow(row.id));
});

// Re-submit a draft for review
app.post('/api/files/:id/submit', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM sop_files WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'File not found' });
  if (row.status !== 'draft') return res.status(400).json({ error: 'Only a draft can be submitted' });
  db.prepare('UPDATE sop_files SET status = ?, reject_comment = ? WHERE id = ?').run('pending_review', '', row.id);
  res.json(oneRow(row.id));
});

// Revise a master document: create the next revision (effective immediately in
// this mock) and mark the previous revision VOID (QP-DC-01 5.1.9 / 6.1.8).
app.post('/api/files/:id/revise', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Please attach the revised file' });
    const cleanup = () => { try { unlinkSync(join(UPLOAD_DIR, req.file.filename)); } catch { /* ignore */ } };

    const prev = db.prepare('SELECT * FROM sop_files WHERE id = ?').get(Number(req.params.id));
    if (!prev) { cleanup(); return res.status(404).json({ error: 'File not found' }); }
    if (prev.status !== 'master') { cleanup(); return res.status(400).json({ error: 'Only a Master Document can be revised' }); }

    const str = (v, n) => (v || '').toString().trim().slice(0, n);
    const newRev = String(Number(prev.revision || '0') + 1).padStart(2, '0');
    const pdfText = extractFullText(join(UPLOAD_DIR, req.file.filename), req.file.mimetype);
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO sop_files
            (title, description, doc_type_id, department_id, customer_id, doc_no, revision, status,
             category, dept_code, doc_date, model, product_name, product_no,
             detail_of_revision, changed_pages, reviewer, approver, effective_date, next_review_date,
             pdf_text, stored_name, original_name, mimetype, size, uploaded_by, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'master', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          str(req.body.title, 200) || prev.title, prev.description, prev.doc_type_id, prev.department_id,
          prev.customer_id, prev.doc_no, newRev, prev.category, prev.dept_code, prev.doc_date,
          prev.model, prev.product_name, prev.product_no,
          str(req.body.detail_of_revision, 1000), str(req.body.changed_pages, 100),
          req.session.user.username, req.session.user.username, now, addYear(now),
          pdfText, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size,
          req.session.user.id, now
        );
      // Supersede the previous revision (auto-VOID; kept 1 generation for trace)
      db.prepare("UPDATE sop_files SET status = 'void' WHERE id = ?").run(prev.id);
      setProductCodes(info.lastInsertRowid, prev.product_no, prev.doc_no);
      return info.lastInsertRowid;
    });
    res.status(201).json(oneRow(tx()));
  });
});

// Distribution (QP-DC-01 6.1.5): record a controlled-print distribution.
app.post('/api/files/:id/distribute', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id FROM sop_files WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'File not found' });
  const dept = (req.body.dept_code || '').toString().trim().slice(0, 40);
  if (!dept) return res.status(400).json({ error: 'Choose a destination department' });
  const info = db
    .prepare(
      'INSERT INTO distributions (file_id, dept_code, distributed_at, distributed_by) VALUES (?, ?, ?, ?)'
    )
    .run(row.id, dept, new Date().toISOString(), req.session.user.username);
  res.status(201).json({ id: info.lastInsertRowid, dept_code: dept });
});

// Confirm receipt of a distributed copy (QP-DC-01 6.1.6)
app.post('/api/distributions/:id/receive', requireAuth, (req, res) => {
  const d = db.prepare('SELECT id FROM distributions WHERE id = ?').get(Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'Distribution not found' });
  db.prepare('UPDATE distributions SET received = 1, received_at = ? WHERE id = ?')
    .run(new Date().toISOString(), d.id);
  res.json({ ok: true });
});

// All distributions (the "notifications / receipt tracking" list)
app.get('/api/distributions', requireAuth, (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT dist.id, dist.dept_code, dist.distributed_at, dist.distributed_by, dist.received, dist.received_at,
                f.id AS file_id, f.doc_no, f.revision, f.title
         FROM distributions dist JOIN sop_files f ON f.id = dist.file_id
         ORDER BY dist.distributed_at DESC LIMIT 100`
      )
      .all()
  );
});

// Documents awaiting review/approval (the approval queue)
app.get('/api/pending', requireAuth, (req, res) => {
  res.json(
    markFavorites(
      db
        .prepare(`${fileSelect} WHERE f.status IN ('pending_review','pending_approval','draft') ORDER BY f.uploaded_at DESC`)
        .all(),
      req.session.user.username
    )
  );
});

// Master List (QP-DC-01 4.1 / 8.2): current revision of every controlled
// document, with status, effective date and next review date.
app.get('/api/master-list', requireAuth, (req, res) => {
  const where = [`f.status <> 'cancelled'`];
  const params = [];
  if (req.query.department) { where.push('f.department_id = ?'); params.push(Number(req.query.department)); }
  if (req.query.category) { where.push('f.category = ?'); params.push(req.query.category); }
  if (req.query.status) { where.push('f.status = ?'); params.push(req.query.status); }
  // current revision, OR any non-master revision (so VOID old versions still show)
  where.push(`(${CURRENT_REV} OR f.status <> 'master')`);
  const sql = `${fileSelect} WHERE ${where.join(' AND ')} ORDER BY f.doc_no, CAST(f.revision AS INTEGER) DESC`;
  res.json(markFavorites(db.prepare(sql).all(...params), req.session.user.username));
});

// Revision history for a document (all revisions sharing its number)
app.get('/api/files/:id/revisions', requireAuth, (req, res) => {
  const row = db.prepare('SELECT doc_no FROM sop_files WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'File not found' });
  if (!row.doc_no) return res.json([]);
  res.json(
    db
      .prepare(
        `SELECT id, revision, status, changed_pages, detail_of_revision, effective_date, uploaded_at, approver
         FROM sop_files WHERE doc_no = ? ORDER BY CAST(revision AS INTEGER) DESC`
      )
      .all(row.doc_no)
  );
});

// Distributions for one document (shown in its detail view)
app.get('/api/files/:id/distributions', requireAuth, (req, res) => {
  res.json(
    db
      .prepare('SELECT id, dept_code, distributed_at, received, received_at FROM distributions WHERE file_id = ? ORDER BY distributed_at DESC')
      .all(Number(req.params.id))
  );
});

// Record an annual review (QP-DC-01 6.2): stamp reviewer + date, push next review +1y
app.post('/api/files/:id/review', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM sop_files WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'File not found' });
  const now = new Date().toISOString();
  db.prepare('UPDATE sop_files SET last_reviewed_at = ?, last_reviewed_by = ?, next_review_date = ? WHERE id = ?')
    .run(now, req.session.user.username, addYear(now), row.id);
  res.json(oneRow(row.id));
});

// --- CSV import (bulk metadata update) -------------------------------------
// Parse CSV text into an array of objects keyed by the (lower-cased) header row.
// Handles quoted fields, escaped quotes ("") and commas/newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/^﻿/, ''); // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((v) => v !== '')) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] || '').trim(); });
    return obj;
  });
}

// Find an existing row by name (case-insensitive); optionally create it.
function lookupIdByName(table, name, create) {
  const n = (name || '').trim();
  if (!n) return null;
  const found = db.prepare(`SELECT id FROM ${table} WHERE name = ? COLLATE NOCASE`).get(n);
  if (found) return found.id;
  if (!create) return null;
  return db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(n).lastInsertRowid;
}

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/files/import-csv', requireAuth, (req, res) => {
  csvUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Please choose a CSV file' });

    let rows;
    try {
      rows = parseCsv(req.file.buffer.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Could not read the CSV file' });
    }
    if (!rows.length) return res.status(400).json({ error: 'The CSV has no data rows' });
    if (!('id' in rows[0])) return res.status(400).json({ error: 'The CSV needs an "id" column' });

    const str = (v, n) => (v || '').toString().trim().slice(0, n);
    // (csv header -> column, max length) for the plain text fields
    const textFields = [
      ['title', 'title', 200], ['doc_no', 'doc_no', 100], ['revision', 'revision', 50],
      ['doc_date', 'doc_date', 50], ['model', 'model', 200],
      ['product_name', 'product_name', 200], ['product_no', 'product_no', 500],
    ];
    let updated = 0;
    const errors = [];

    const apply = db.transaction(() => {
      for (const r of rows) {
        const id = Number(r.id);
        if (!id) { errors.push(`Skipped a row with a missing/invalid id`); continue; }
        const cur = db.prepare('SELECT * FROM sop_files WHERE id = ?').get(id);
        if (!cur) { errors.push(`id ${r.id}: no such document`); continue; }

        const sets = [];
        const vals = [];
        for (const [header, col, max] of textFields) {
          if (header in r) { sets.push(`${col} = ?`); vals.push(str(r[header], max)); }
        }
        // Classification by name (type/department must already exist; customer is created if new)
        if ('customer' in r) {
          sets.push('customer_id = ?');
          vals.push(lookupIdByName('customers', r.customer, true));
        }
        if ('doc_type' in r && r.doc_type.trim()) {
          const tid = lookupIdByName('doc_types', r.doc_type, false);
          if (tid) { sets.push('doc_type_id = ?'); vals.push(tid); }
          else errors.push(`id ${r.id}: unknown type "${r.doc_type}" (left unchanged)`);
        }
        if ('department' in r && r.department.trim()) {
          const did = lookupIdByName('departments', r.department, false);
          if (did) { sets.push('department_id = ?'); vals.push(did); }
          else errors.push(`id ${r.id}: unknown department "${r.department}" (left unchanged)`);
        }
        if (!sets.length) continue;

        vals.push(id);
        db.prepare(`UPDATE sop_files SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

        // Re-index product codes if the doc_no / product_no may have changed
        const after = db.prepare('SELECT doc_no, product_no FROM sop_files WHERE id = ?').get(id);
        setProductCodes(id, after.product_no, after.doc_no);
        updated++;
      }
    });
    apply();

    res.json({ updated, total: rows.length, errors });
  });
});

// Download (or inline view with ?inline=1). PDFs get the ISO control stamp
// overlaid on the fly based on the document's status (and the distribute /
// uncontrolled query flags), so stored files are never mutated.
//   ?distribute=DEPT  -> blue CONTROLLED PRINT (all pages) + "Distributed to: DEPT"
//   ?uncontrolled=1   -> red UNCONTROLLED (for external sharing, QP-DC-01 6.8)
//   status master     -> red MASTER DOCUMENT (page 1) + effective date
//   status void       -> red VOID (all pages)
app.get('/api/files/:id/download', requireAuth, async (req, res) => {
  const row = db.prepare('SELECT * FROM sop_files WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'File not found' });
  const path = join(UPLOAD_DIR, row.stored_name);
  if (!existsSync(path)) return res.status(410).json({ error: 'The stored file no longer exists' });

  const disposition = req.query.inline ? 'inline' : 'attachment';
  logAccess(row, req.session.user.username, req.query.inline ? 'view' : 'download');
  res.setHeader('Content-Type', row.mimetype || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename*=UTF-8''${encodeURIComponent(row.original_name)}`
  );

  // Decide which control stamp (if any) applies. Only PDFs are stamped.
  const isPdf = (row.mimetype || '').includes('pdf') || /\.pdf$/i.test(row.original_name || '');
  let kind = null;
  let note = '';
  if (req.query.uncontrolled) {
    kind = 'uncontrolled';
  } else if (req.query.distribute) {
    kind = 'controlled';
    note = String(req.query.distribute).slice(0, 40); // destination dept -> stamp box
  } else if (row.status === 'void') {
    kind = 'void';
  } else if (row.status === 'master') {
    kind = 'master';
    note = row.effective_date ? row.effective_date.slice(0, 10) : ''; // -> "24 JAN 2024" in the box
  }

  if (isPdf && kind) {
    try {
      const stamped = await watermarkPdf(readFileSync(path), kind, note);
      return res.end(Buffer.from(stamped));
    } catch {
      /* fall through to the unstamped original */
    }
  }
  createReadStream(path).pipe(res);
});

// Recent access log (views / downloads)
app.get('/api/logs', requireAuth, (req, res) => {
  res.json(
    db
      .prepare('SELECT id, doc_no, title, username, action, at FROM access_log ORDER BY at DESC LIMIT 200')
      .all()
  );
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
