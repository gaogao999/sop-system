# 📋 SOP File Management System (sop-system)

A web app for managing **SOP (Standard Operating Procedure)** documents in **PDF / Excel / Word** format. Sign-in protected, with upload, two-axis classification (type & department), search and download.

## Features

- **Sign in** (`POST /checklogin` with `username` / `password` sent as a form; session cookie is `connect.sid`)
- **File upload** (PDF / Excel `.xls`/`.xlsx` / Word `.doc`/`.docx`, up to 50 MB)
- **Three classification axes** — **Type (種別)** (QP / SOP / Format) and **Department (部署)** are required; **Customer (顧客)** (e.g. TOTO) is optional. All are fully editable (add / delete). A type/department that still has files cannot be deleted; deleting a customer just unassigns its files.
- **Header metadata** — Document No., Revision, Document date, 品名 (product name), Model and Product No. are stored alongside each file.
- **Document-number auto-fill** — the document number encodes `<type>-<department>-<serial>` (e.g. `SOP-QC-0021`), so typing it auto-selects the matching Type and Department.
- **Experimental PDF header extraction** — on upload, page 1 of a PDF is parsed (`pdftotext`) to pre-fill the document number, title, revision, date, 品名, model and product number, and to auto-select the customer from the Model line (`TOTO : …`). The result is editable and reviewed before saving; if `pdftotext` is unavailable it degrades to manual entry.
- **Filter by all three axes at once** (Type × Department × Customer, including a "None" filter for files with no customer), plus **search** (partial match on title, description, document number, product name/number and original file name)
- **Barcode / product-number lookup (inspection station)** — scan a product number (品番) with a keyboard-type barcode reader (or type it) and the matching inspection spec opens immediately; if several documents match, a short pick-list is shown. Matches against 品番 (`product_no`), document number, product name and file name.
- **File list, download and delete**

## Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + Express |
| Session | express-session + SQLite store (cookie name `connect.sid`, survives restarts) |
| Auth | bcryptjs password hashing |
| Upload | multer (validates extension + MIME type) |
| PDF extraction | `pdftotext` (poppler-utils) — optional; bundled in the Docker image |
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
> (`apt-get install poppler-utils` / `brew install poppler`). It is already
> included in the Docker image. Without it, upload still works — you just fill
> the header fields in manually.

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
| GET | `/api/files?q=&type=&department=&customer=` | List / search files (filter by any combination of axes; `customer=none` = no customer) |
| POST | `/api/extract` | Parse an uploaded PDF's header and return `doc_no` / `title` / `revision` / `doc_date` / `model` / `product_name` / `product_no` / `customer_name` (+ `type_code` / `dept_code`). The file is parsed and discarded, not stored. |
| POST | `/api/files` | Upload (multipart: `file`, `title`, `description`, **`doc_type_id`**, **`department_id`** (required), and optional `customer_id`, `doc_no`, `revision`, `doc_date`, `product_name`, `model`, `product_no`) |
| GET | `/api/lookup?code=` | Find documents whose 品番 / doc number / product name / file name contains the scanned code (barcode lookup) |
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

### Docker (anywhere)

```bash
docker build -t sop-system .
docker run -p 3000:3000 -v $(pwd)/data:/data \
  -e SESSION_SECRET=long-random-string -e ADMIN_USER=you -e ADMIN_PASS=secret \
  sop-system
```

> When public, anyone with the URL reaches the sign-in page. Always set a strong
> `ADMIN_PASS` and `SESSION_SECRET`.

## Security notes

- Passwords are stored hashed with bcrypt (never in plain text).
- Uploads are restricted to PDF / Excel / Word by checking both the file extension and the MIME type.
- In production, always set `SESSION_SECRET`, and run behind HTTPS (a reverse proxy) with `TRUST_PROXY=1`.
