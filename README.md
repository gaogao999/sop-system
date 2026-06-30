# 📋 SOP File Management System (sop-system)

A web app for managing **SOP (Standard Operating Procedure)** documents in **PDF / Excel / Word** format. Sign-in protected, with upload, two-axis classification (type & department), search and download.

## Features

- **Sign in** (`POST /checklogin` with `username` / `password` sent as a form; session cookie is `connect.sid`)
- **File upload** (PDF / Excel `.xls`/`.xlsx` / Word `.doc`/`.docx`, up to 50 MB)
- **Three classification axes** — **Type (種別)** (QP / SOP / Format) and **Department (部署)** are required; **Customer (顧客)** (e.g. TOTO) is optional. All are fully editable (add / delete). A type/department that still has files cannot be deleted; deleting a customer just unassigns its files.
- **Header metadata** — Document No., Revision, Document date, 品名 (product name), Model and Product No. are stored alongside each file.
- **Document-number auto-fill** — the document number encodes `<type>-<department>-<serial>` (e.g. `SOP-QC-0021`), so typing it auto-selects the matching Type and Department.
- **Experimental PDF header extraction** — on upload, page 1 of a PDF is parsed (`pdftotext`) to pre-fill the document number, title, revision, date, 品名, model and product number, and to auto-select the customer from the Model line (`TOTO : …`). The result is editable and reviewed before saving; if `pdftotext` is unavailable it degrades to manual entry.
- **OCR for scanned PDFs** — when a PDF has little or no embedded text (a scan / image-only document), it is rasterised (`pdftoppm`) and read with OCR (`tesseract`) so the header auto-fill and full-text search still work. OCR is bounded to the first `OCR_MAX_PAGES` pages and degrades silently to the no-OCR result if the tools are unavailable.
- **Dashboard** — a one-click overview: total documents, how many are review-due (>2y), how many are missing a product number or a customer, breakdowns by Type / Department / Customer, and the most recent uploads.
- **CSV export / import** — export the currently shown list to a spreadsheet, edit the metadata, then import it back. Rows are matched by `id` (the document files themselves are never touched); recognised columns update title / doc no / rev / date / model / 品名 / 品番, assign a customer (created if new) and re-classify Type / Department by name. Product codes are re-indexed after each row so barcode lookup stays in sync.
- **Search-first home** — the search box is the centre of the app. As you type, results appear instantly (typeahead), ranked by relevance (doc-no exact > prefix > title > product/customer > body text), with the matched term highlighted and a body-text **snippet** showing *where* a full-text / OCR hit is. Press <kbd>/</kbd> to jump to the box and <kbd>Enter</kbd> to open the top match.
- **Home shelves** — when you're not searching, the page shows **★ Favorites**, **🕘 Recently viewed** (yours) and **🔥 Most viewed** (team, last 60 days), so the document you want is usually one click away without searching at all. Tap ☆ on any document to add it to your shelf.
- **Manage menu** — everything that isn't "finding a document" (upload, bulk upload, CSV, dashboard, settings) lives behind a single **⚙ Manage** menu, keeping the main screen focused on search.
- **Filter by all three axes at once** (Type × Department × Customer, including a "None" filter for files with no customer), plus **search** (partial match on title, description, document number, product name/number, original file name and full PDF/OCR text)
- **Filter by product code (品番)** — each 品番 shows as a clickable chip in the list; click one to see every document maintained for that exact product (with a live count), combinable with the other filters. Backed by `/api/files?code=`.
- **Per-column filters** — a filter row under the table header: text boxes for Doc No./Rev, Title (品名 included) and uploader, and dropdowns for Type / Department / Customer that stay in sync with the sidebar. All filters combine (AND).
- **Revision control** — documents sharing a document number are revisions of the same document; the highest revision number is the **current** one. The list and the barcode lookup show/open only the current revision (so a scan always opens the latest), the current row shows a "最新 (全N版)" badge, and a **旧版も表示** toggle reveals superseded revisions (marked 旧版, retained for traceability — never deleted).
- **Barcode / product-number lookup (inspection station)** — scan a product number (品番) with a keyboard-type barcode reader (or type it) and the matching inspection spec opens immediately; if several documents match, a short pick-list is shown. Each file's 品番 / doc number are indexed as individual codes, so lookup is an **exact** match first (scanning `DD360` never hits `DD3600`), falling back to a substring search only when there is no exact hit.
- **In-app preview** — click a document's title or **View** to open it on screen without downloading. PDFs render inline in a modal; Office files (Excel/Word) can't be rendered by the browser, so a notice with a Download button is shown.
- **Print with controlled-copy stamp** — the **🖨 Print** button in the viewer prints the document with an auto-stamped header (document no., revision, document date, print date/time and the user who printed it) via `@media print`; all app chrome is hidden so only the stamped document prints.
- **PWA / installable** — web app manifest, icons and a service worker (cached app shell) so it can be added to a phone's home screen and loads reliably on the shop-floor LAN.
- **Pluggable authentication** — sign-in goes through `POST /checklogin` (the same shape as the shared KGTH company login). `AUTH_MODE=local` (default) uses the built-in user table; the seam is ready to delegate to the company endpoint (`AUTH_MODE=upstream`) once its contract is confirmed.
- **File list, download and delete**

## Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + Express |
| Session | express-session + SQLite store (cookie name `connect.sid`, survives restarts) |
| Auth | bcryptjs password hashing |
| Upload | multer (validates extension + MIME type) |
| PDF extraction / OCR | `pdftotext` + `pdftoppm` (poppler-utils) and `tesseract` (tesseract-ocr) — optional; bundled in the Docker image |
| Database | SQLite (better-sqlite3) |
| UI | HTML / CSS / vanilla JS (no build step) |

```
.
├─ server.js          … API server (auth, upload, search, download)
├─ db.js              … DB connection, schema, initial user / types / departments
├─ seed.js            … add-user script
├─ public/            … UI (login.html / index.html / app.js / style.css)
├─ uploads/           … uploaded files (git-ignored)
└─ data/sop.db        … data file (auto-created on first run, git-ignored)
```

## Getting started

```bash
npm install
npm start
```

Then open http://localhost:3000 (you are redirected to the sign-in page if not logged in).

> For the experimental PDF header auto-fill to work locally, install `pdftotext`
> (`apt-get install poppler-utils` / `brew install poppler`); for OCR of scanned
> PDFs also install `tesseract` (`apt-get install tesseract-ocr` / `brew install
> tesseract`). Both are already included in the Docker image. Without them, upload
> still works — you just fill the header fields in manually.

### Initial login

An admin user is created automatically on first run (defaults to **`admin` / `admin123`**).
Always override this in production via environment variables.

```bash
ADMIN_USER=yourname ADMIN_PASS=strongpassword SESSION_SECRET=long-random-string npm start
```

### Adding users

```bash
node seed.js <username> <password> "Display Name"
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Listening port |
| `DB_PATH` | `data/sop.db` | SQLite file path |
| `UPLOAD_DIR` | `uploads/` | Where uploaded files are stored |
| `SESSION_SECRET` | (dev default) | Session signing key. Always set in production |
| `ADMIN_USER` / `ADMIN_PASS` | `admin` / `admin123` | Admin user created on first run |
| `NODE_ENV` / `TRUST_PROXY` | - | `production` + `TRUST_PROXY=1` enables Secure cookies & proxy trust |
| `OCR_LANG` | `eng` | Tesseract language(s) for scanned-PDF OCR (e.g. `eng+tha`) |
| `OCR_MAX_PAGES` | `20` | Max pages to OCR per scanned PDF |
| `AUTH_MODE` | `local` | `local` = built-in user table; `upstream` = delegate to the company `/checklogin` (not yet wired — denies until implemented) |

See `.env.example` for a copy-paste starting point.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/checklogin` | Sign in (`username` / `password` as a form) |
| POST | `/logout` | Sign out |
| GET | `/api/me` | Current user |
| GET | `/api/doc-types` | Document type list (with file counts) |
| POST | `/api/doc-types` | Add type (`{name}`) |
| DELETE | `/api/doc-types/:id` | Delete type (blocked with `409` while files still use it) |
| GET | `/api/departments` | Department list (with file counts) |
| POST | `/api/departments` | Add department (`{name}`) |
| DELETE | `/api/departments/:id` | Delete department (blocked with `409` while files still use it) |
| GET | `/api/customers` | Customer list (with file counts) |
| POST | `/api/customers` | Add customer (`{name}`) |
| DELETE | `/api/customers/:id` | Delete customer (its files become unassigned) |
| GET | `/api/files?q=&type=&department=&customer=&code=&docref=&title=&by=&revisions=` | List / search files. Combinable filters: axes (`type`/`department`/`customer`, `customer=none` = none), `code=` (exact 品番), per-column partial matches `docref=` (doc no / rev / date), `title=` (title / 品名), `by=` (uploader). Only the current revision is returned unless `revisions=all`. Each row includes `codes`, `is_current` and `revision_count`. |
| POST | `/api/extract` | Parse an uploaded PDF's header and return `doc_no` / `title` / `revision` / `doc_date` / `model` / `product_name` / `product_no` / `customer_name` (+ `type_code` / `dept_code`). The file is parsed and discarded, not stored. |
| POST | `/api/files` | Upload (multipart: `file`, `title`, `description`, **`doc_type_id`**, **`department_id`** (required), and optional `customer_id`, `doc_no`, `revision`, `doc_date`, `product_name`, `model`, `product_no`). Returns 409 `{duplicate:true}` on a same Doc No.+Rev clash unless `force=1`. |
| POST | `/api/files/import-csv` | Bulk-update document metadata from a CSV (multipart `file`). Rows matched by `id`; updates title / doc no / rev / date / model / 品名 / 品番, assigns a customer (created if new) and re-classifies Type / Department by name. Returns `{updated, total, errors}`. |
| POST | `/api/files/:id/favorite` | Toggle the document in the current user's favourites. Returns `{favorited}`. |
| GET | `/api/home` | Home shelves for the current user: `{recent, favorites, popular}` (current revisions only). |
| GET | `/api/lookup?code=` | Barcode lookup: exact match on the indexed 品番 / doc-number codes first, then a substring fallback across 品番 / doc number / product name / file name |
| GET | `/api/files/:id/download` | Download (add `?inline=1` to view in the browser instead of downloading) |
| DELETE | `/api/files/:id` | Delete |
| GET | `/healthz` | Health check |

`/api/*` returns `401` when not signed in. `/` redirects to the sign-in page when not signed in.

## Deployment

The app is containerized (`Dockerfile`). The DB + uploads live under `/data`,
which can be backed by a persistent disk so data and logins survive restarts.

> **Note on the bundled `render.yaml`:** it targets Render's **free plan**, which
> does **not** support a persistent disk. There, `/data` is ephemeral — the
> database and uploads are reset on every restart / redeploy (fine for testing).
> To make data persistent, switch `plan: free` to `plan: starter` (paid) and
> re-add the `disk:` block (instructions are in `render.yaml`).

### Render (public URL)

**Option A — Blueprint (recommended):** **New → Blueprint** and select this
repository. The included `render.yaml` provisions the web service and env vars
automatically (you'll be asked for `ADMIN_USER` / `ADMIN_PASS`).

**Option B — Dashboard (manual):**
1. Sign in to https://render.com with GitHub.
2. **New → Web Service**, select this repository, **Runtime: Docker**.
3. Add a **Disk**: mount path `/data`, size 1 GB.
4. Add environment variables: `ADMIN_USER`, `ADMIN_PASS`, and a long random
   `SESSION_SECRET` (Render can generate one). `DB_PATH` / `UPLOAD_DIR` are
   already baked into the Dockerfile.
5. Deploy — Render gives you a public `https://…onrender.com` URL.

### Run locally / on-prem with Docker (persistent data) — recommended for development

Requires Docker Desktop (or Docker Engine). Data is kept in a named volume, so
it survives restarts and rebuilds — unlike Render's free plan.

```bash
docker compose up -d --build      # build & start
# open http://localhost:3000  → sign in with admin / admin123 (change in docker-compose.yml)
docker compose logs -f            # view logs
docker compose down               # stop (DATA IS KEPT)
docker compose down -v            # stop AND erase all data
```

The SQLite DB and uploads live in the `sop-data` volume mounted at `/data`.
To keep the data as plain files inside the project instead, replace the volume
line in `docker-compose.yml` with a bind mount: `- ./data:/data`.

When you later move to the company server, run the exact same
`docker compose up -d --build` there — the data lives on that server's disk.

### Plain Node (no Docker)

```bash
npm install && npm start   # data in ./data and ./uploads
```

> Note: experimental PDF header extraction needs `pdftotext` (poppler-utils) and
> scanned-PDF OCR needs `tesseract` (tesseract-ocr); the Docker image already
> includes both.

### Docker (single command)

```bash
docker build -t sop-system .
docker run -p 3000:3000 -v sop-data:/data \
  -e SESSION_SECRET=long-random-string -e ADMIN_USER=you -e ADMIN_PASS=secret \
  sop-system
```

> When exposed publicly, anyone with the URL reaches the sign-in page. Always set
> a strong `ADMIN_PASS` and `SESSION_SECRET`.

## Security notes

- Passwords are stored hashed with bcrypt (never in plain text).
- Uploads are restricted to PDF / Excel / Word by checking both the file extension and the MIME type.
- In production, always set `SESSION_SECRET`, and run behind HTTPS (a reverse proxy) with `TRUST_PROXY=1`.
